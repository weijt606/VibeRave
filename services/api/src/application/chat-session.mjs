import { InvalidInput, PayloadTooLarge } from '../domain/errors.mjs';
import { createKeyedQueue } from './session-queue.mjs';

const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
// How many extra LLM round-trips we'll spend asking the model to fix a
// pattern that fails server-side validation. Two retries catches almost
// every transient regression we've seen without blowing the latency
// budget for the user-visible turn.
const MAX_VALIDATION_RETRIES = 2;
const DEFAULT_HISTORY_TURNS = 6;
const DEFAULT_LIMITS = { maxPromptChars: 500, maxCodeBytes: 20 * 1024 };
const MODES = new Set(['adult', 'kids']);
const LANGS = new Set(['zh', 'en']);
const INTENTS = new Set(['generate', 'tweak']);
const MAX_TRACKS = 16;

function assertSessionId(id) {
  if (typeof id !== 'string' || !SESSION_ID_RE.test(id)) {
    throw new InvalidInput('Body must include a valid `sessionId` (1–64 chars: letters, digits, _, -).');
  }
}

function toLlmHistory(messages) {
  const out = [];
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.meta && typeof msg.text === 'string') {
      // Replay META turns verbatim so the model can see (and per the
      // skill rule, ignore) past host commands. Checked first so a
      // new_track + code turn — which has BOTH meta and code — is
      // replayed as the original META line plus the seed code, not
      // just the bare code (which would look like a stranded edit).
      out.push({ role: 'assistant', text: msg.text });
    } else if (msg.role === 'assistant' && typeof msg.code === 'string') {
      out.push({ role: 'assistant', text: msg.code });
    } else if (msg.role === 'user' && typeof msg.text === 'string') {
      out.push({ role: 'user', text: msg.text });
    }
  }
  return out;
}

/**
 * Keep only the last `turns` user/assistant pairs (2N messages). META
 * turns inside the window are kept as-is — they're replayed verbatim so
 * the model can see (and ignore) past host actions. The window always
 * starts on a user message so the model never sees a stranded reply.
 */
export function windowHistory(turns, historyTurns = DEFAULT_HISTORY_TURNS) {
  const n = Number.isFinite(historyTurns) && historyTurns > 0 ? Math.floor(historyTurns) : DEFAULT_HISTORY_TURNS;
  let out = turns.length > n * 2 ? turns.slice(-n * 2) : turns.slice();
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/**
 * Validate the booth extensions on the request body (CONTRACTS.md §8.2).
 * Every field is optional; unknown values are a 400 rather than a silent
 * fallback so a client bug is caught during the build, not on stage.
 */
export function normaliseBoothFields({ mode, lang, intent, tracks } = {}) {
  if (mode !== undefined && !MODES.has(mode)) {
    throw new InvalidInput("`mode` must be 'adult' or 'kids'.");
  }
  if (lang !== undefined && !LANGS.has(lang)) {
    throw new InvalidInput("`lang` must be 'zh' or 'en'.");
  }
  if (intent !== undefined && !INTENTS.has(intent)) {
    throw new InvalidInput("`intent` must be 'generate' or 'tweak'.");
  }
  let siblings;
  if (tracks !== undefined) {
    if (!Array.isArray(tracks)) throw new InvalidInput('`tracks` must be an array of { name, summary }.');
    siblings = tracks.slice(0, MAX_TRACKS).map((t) => {
      if (!t || typeof t !== 'object' || typeof t.name !== 'string' || typeof t.summary !== 'string') {
        throw new InvalidInput('`tracks` entries must be { name: string, summary: string }.');
      }
      return { name: t.name, summary: t.summary };
    });
  }
  return { mode, lang: lang ?? 'zh', intent: intent ?? 'generate', tracks: siblings };
}

function buildFixPrompt(error, code) {
  return [
    `[validation error] The previous code failed: ${error}`,
    'Return ONLY the corrected Strudel code (no prose, no fences) that fixes this error.',
    "Keep the user's original intent. Obey all output-format rules.",
    `<failing>\n${code}\n</failing>`,
  ].join('\n\n');
}

// META + code variant: the previous turn was a host action (e.g.
// `new_track`) bundled with seed code that failed validation. Ask the
// model to re-emit the same META line plus a corrected code body, so
// the host side-effect is preserved and only the music part changes.
function buildMetaFixPrompt(error, meta, code) {
  const metaLine = `META: ${JSON.stringify(meta)}`;
  return [
    `[validation error] The seed code for ${metaLine} failed: ${error}`,
    'Re-emit the META line VERBATIM, a blank line, then a corrected Strudel program.',
    "Keep the user's original musical intent. Obey all output-format rules for the code body.",
    `<failing>\n${metaLine}\n\n${code}\n</failing>`,
  ].join('\n\n');
}

/**
 * Use cases for a persistent chat session: send a turn (which delegates
 * to generateStrudel and appends the result), read the message log,
 * clear it.
 *
 * @param {{
 *   sessionStore: import('./ports.mjs').SessionStore,
 *   generateStrudel: ReturnType<typeof import('./generate-strudel.mjs').makeGenerateStrudel>,
 *   validatePattern?: (code: string) => Promise<{ valid: boolean, error?: string }>,
 * }} deps
 */
export function makeChatSession({
  sessionStore,
  generateStrudel,
  validatePattern,
  historyTurns = DEFAULT_HISTORY_TURNS,
  limits = DEFAULT_LIMITS,
}) {
  const maxPromptChars = limits?.maxPromptChars ?? DEFAULT_LIMITS.maxPromptChars;
  const maxCodeBytes = limits?.maxCodeBytes ?? DEFAULT_LIMITS.maxCodeBytes;
  // Per-session promise queue: load → generate → save never interleaves
  // for the same sessionId, so two quick PTT presses can't clobber each
  // other's history.
  const queue = createKeyedQueue();

  function assertLimits({ prompt, currentCode }) {
    if (typeof prompt === 'string' && prompt.length > maxPromptChars) {
      throw new PayloadTooLarge(`\`prompt\` is limited to ${maxPromptChars} characters.`);
    }
    if (typeof currentCode === 'string' && Buffer.byteLength(currentCode, 'utf8') > maxCodeBytes) {
      throw new PayloadTooLarge(`\`currentCode\` is limited to ${maxCodeBytes} bytes.`);
    }
  }

  // Run the LLM, then loop validate→retry until the pattern is sane or
  // we've burned MAX_VALIDATION_RETRIES extra calls. Last-attempt code is
  // returned regardless so the user always sees something — annotated with
  // `validated: false` plus the error so the client can decide how loud to
  // be about it.
  async function generateValidated({ prompt, currentCode, history, llmOverrides, booth = {}, onProgress }) {
    const common = { history, llmOverrides, ...booth, onProgress };
    let attempts = 0;
    const validate = async (code) => {
      attempts += 1;
      onProgress?.({ type: 'validating', attempt: attempts });
      return validatePattern(code);
    };
    let result = await generateStrudel({ prompt, currentCode, ...common });

    // META + code: validate the seed code and retry on failure with a
    // META-aware fix prompt. Without this, a `new_track + drums` turn
    // with broken Strudel would happily seed a track that fails to
    // evaluate in the browser. We do this BEFORE the noChange short-
    // circuit because META responses carry noChange:true (to keep the
    // *current* track's editor untouched) but their code body is real
    // and worth validating.
    if (result.meta && result.code && validatePattern) {
      let validation = await validate(result.code);
      while (!validation.valid && attempts <= MAX_VALIDATION_RETRIES) {
        const fixPrompt = buildMetaFixPrompt(validation.error, result.meta, result.code);
        const next = await generateStrudel({
          prompt: fixPrompt,
          currentCode: result.code,
          ...common,
        });
        // Retry returned plain code (no META): the model dropped the
        // host action when fixing. Preserve the original META so the
        // track is still created — only the code body is replaced.
        // We rebuild `message` so toLlmHistory still sees a META line
        // for this turn; otherwise the next turn's history would show
        // the user asking for a "new track with drums" answered by
        // bare code, with the host action invisible to the model.
        if (next.code && !next.meta) {
          const reconstructed = `META: ${JSON.stringify(result.meta)}\n\n${next.code}`;
          result = {
            ...result,
            code: next.code,
            message: reconstructed,
            explain: next.explain || result.explain,
            provider: next.provider,
          };
        } else if (next.meta && next.code) {
          // Got a fresh META + code pair. Adopt wholesale (the model
          // may have decided a slightly different action fits better).
          result = next;
        } else {
          // Retry came back as cannot-handle, or as a META without
          // code, or otherwise unusable for fixing. Stop retrying and
          // ship whatever the prior round produced — the frontend
          // surfaces runtime errors and the user can iterate from
          // there. validated:false is preserved by the loop exit.
          break;
        }
        validation = await validate(result.code);
      }
      return {
        ...result,
        validated: validation.valid,
        validationError: validation.valid ? undefined : validation.error,
        validationAttempts: attempts,
      };
    }

    // Pure META turns (play/pause/stop/...) and cannot-handle turns
    // both set noChange:true and have no code to validate.
    if (result.noChange || !validatePattern) {
      return { ...result, validated: !validatePattern ? undefined : true };
    }
    let validation = await validate(result.code);
    while (!validation.valid && attempts <= MAX_VALIDATION_RETRIES) {
      const fixPrompt = buildFixPrompt(validation.error, result.code);
      const next = await generateStrudel({
        prompt: fixPrompt,
        currentCode: result.code,
        ...common,
      });
      if (next.noChange) break;
      // A fix retry rarely bothers with a fresh EXPLAIN; keep the first one.
      result = { ...next, explain: next.explain || result.explain };
      validation = await validate(result.code);
    }
    return {
      ...result,
      validated: validation.valid,
      validationError: validation.valid ? undefined : validation.error,
      validationAttempts: attempts,
    };
  }

  return {
    async getMessages(sessionId) {
      assertSessionId(sessionId);
      const record = await sessionStore.load(sessionId);
      return { id: record.id, messages: record.messages };
    },

    async clear(sessionId) {
      assertSessionId(sessionId);
      await queue.run(sessionId, () => sessionStore.clear(sessionId));
    },

    // Stateless one-shot: no session history loaded, no messages stored.
    // Used by the client-side runtime-error recovery loop, where appending
    // synthetic "fix this NaN" turns to the user-visible chat would be noise.
    async fix({ currentCode, error, llmOverrides, mode, lang, intent, tracks }) {
      if (typeof currentCode !== 'string' || currentCode.trim() === '') {
        throw new InvalidInput('Body must include a non-empty string `currentCode` field.');
      }
      if (typeof error !== 'string' || error.trim() === '') {
        throw new InvalidInput('Body must include a non-empty string `error` field.');
      }
      assertLimits({ currentCode });
      const booth = normaliseBoothFields({ mode, lang, intent: intent ?? 'tweak', tracks });
      const fixPrompt = buildFixPrompt(error, currentCode);
      const result = await generateValidated({
        prompt: fixPrompt,
        currentCode,
        history: [],
        llmOverrides,
        booth,
      });
      return {
        code: result.code,
        message: result.message,
        noChange: !!result.noChange,
        model: result.model,
        provider: result.provider,
        explain: result.explain || '',
        validated: result.validated,
        validationError: result.validationError,
        validationAttempts: result.validationAttempts,
      };
    },

    async sendTurn({ sessionId, prompt, currentCode, llmOverrides, mode, lang, intent, tracks, onProgress }) {
      assertSessionId(sessionId);
      if (typeof prompt !== 'string' || prompt.trim() === '') {
        throw new InvalidInput('Body must include a non-empty string `prompt` field.');
      }
      assertLimits({ prompt, currentCode });
      const booth = normaliseBoothFields({ mode, lang, intent, tracks });

      return queue.run(sessionId, async () => {
        const record = await sessionStore.load(sessionId);
        const history = windowHistory(toLlmHistory(record.messages), historyTurns);

        const result = await generateValidated({
          prompt,
          currentCode,
          history,
          llmOverrides,
          booth,
          onProgress,
        });

        const ts = new Date().toISOString();
        const extra = {
          ...(result.explain ? { explain: result.explain } : {}),
          ...(result.provider ? { provider: result.provider } : {}),
        };
        record.messages.push({ role: 'user', text: prompt, ts });
        if (result.meta) {
          // Persist meta-command turns so the chat shows what was
          // dispatched and toLlmHistory can replay the META: line.
          // For new_track + code the seed is also stored so the message
          // bubble can render the code preview alongside the chip and a
          // page reload still has the seed available for re-runs.
          record.messages.push({
            role: 'assistant',
            text: result.message,
            meta: result.meta,
            ...(result.code ? { code: result.code } : {}),
            noChange: true,
            ...extra,
            ts,
          });
        } else if (result.noChange) {
          // Cannot-handle path: keep the user-visible message but skip
          // pushing assistant `code`, so the LLM history transformer
          // drops it on the next turn.
          record.messages.push({
            role: 'assistant',
            text: result.message,
            noChange: true,
            ...extra,
            ts,
          });
        } else {
          record.messages.push({ role: 'assistant', code: result.code, ...extra, ts });
        }
        await sessionStore.save(record);

        return {
          code: result.code,
          message: result.message,
          meta: result.meta,
          noChange: !!result.noChange,
          model: result.model,
          provider: result.provider ?? null,
          explain: result.explain || '',
          messages: record.messages,
          validated: result.validated,
          validationError: result.validationError,
          validationAttempts: result.validationAttempts,
        };
      });
    },
  };
}
