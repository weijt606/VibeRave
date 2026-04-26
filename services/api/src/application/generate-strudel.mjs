import { InvalidInput, ServiceUnavailable, UpstreamError } from '../domain/errors.mjs';

const FENCE_RE = /^```(?:javascript|js|strudel)?\n([\s\S]*?)\n```$/;

// Visualization is picked by the user via the per-track viz dropdown.
// The skill prompt tells the LLM not to emit a viz hint, but we still
// strip a leading `// viz:` comment defensively so any model that ignores
// the rule doesn't leak a stray comment into the editor.
const STALE_VIZ_HINT_RE = /^\s*\/\/\s*viz\s*:\s*[a-zA-Z_-]+\s*\r?\n/;

function stripStaleVizHint(text) {
  return text.replace(STALE_VIZ_HINT_RE, '');
}

// Sentinel emitted by the model when the request can't be turned into a
// pattern — see skills/strudel/rules/cannot-handle.md. Detected here so we
// can flag the response and prevent the editor from being overwritten.
export const CANNOT_HANDLE_SENTINEL = 'Couldn’t generate or modify — please try again.';
const CANNOT_HANDLE_PLAIN = "Couldn't generate or modify - please try again.";

// Sentinel emitted by the model when the user's prompt is a host control
// (open a track, play/pause/stop, schedule stop) rather than a music
// edit — see skills/strudel/rules/meta-commands.md. The line shape is
// `META: {"action":"...",...}` with the JSON on a single line. For the
// `new_track` action a Strudel program may optionally follow on
// subsequent lines — that lets prompts like "open a new track with
// some drums" both create the track and seed it with code in one turn.
const META_FIRST_LINE_RE = /^META:\s*(\{[^\n]*\})\s*(?:\n([\s\S]*))?$/;
const ALLOWED_META_ACTIONS = new Set([
  'new_track',
  'play',
  'pause',
  'stop',
  'stop_all',
  'schedule_stop',
]);
// Only `new_track` makes sense as a host action plus a code body — the
// rest don't touch a track's contents. Any code that follows a non-
// new_track META line is dropped; the rule asks the model not to emit
// it in the first place.
const META_ACTIONS_TAKING_CODE = new Set(['new_track']);

// Parse a META response. Returns `{ meta, code }` on success (with
// `code` set only when the response includes a code body for an action
// that accepts one), or null if the response isn't a META response or
// the JSON is malformed / has an unknown action / fails per-action
// validation. Falling back to null means the response is treated as
// music code (which then likely fails to validate) — safer than
// executing a host action we can't trust.
function parseMeta(text) {
  const m = text.match(META_FIRST_LINE_RE);
  if (!m) return null;
  let parsed;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const { action } = parsed;
  if (typeof action !== 'string' || !ALLOWED_META_ACTIONS.has(action)) return null;

  let meta;
  if (action === 'schedule_stop') {
    const delayMs = Number(parsed.delayMs);
    if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 24 * 60 * 60 * 1000) return null;
    meta = { action, delayMs: Math.round(delayMs) };
  } else {
    meta = { action };
  }

  const tail = (m[2] ?? '').trim();
  const code = tail && META_ACTIONS_TAKING_CODE.has(action) ? stripCodeFences(tail) : '';
  return { meta, code };
}

function stripCodeFences(text) {
  const m = text.match(FENCE_RE);
  return m ? m[1] : text;
}

function isCannotHandle(text) {
  // Be lenient with smart-vs-straight quotes and em-dashes since the model
  // sometimes "auto-corrects" punctuation.
  const norm = text
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return (
    norm === CANNOT_HANDLE_PLAIN.toLowerCase() ||
    norm === CANNOT_HANDLE_PLAIN.toLowerCase().replace(/\.$/, '')
  );
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const out = [];
  for (const turn of history) {
    if (!turn || typeof turn.text !== 'string') continue;
    if (turn.role !== 'user' && turn.role !== 'assistant') continue;
    out.push({ role: turn.role, text: turn.text });
  }
  return out;
}

/**
 * @param {{
 *   llmClient: import('./ports.mjs').LlmClient | null,
 *   loadSystemPrompt: import('./ports.mjs').SystemPromptProvider,
 * }} deps
 */
export function makeGenerateStrudel({ llmClient, loadSystemPrompt }) {
  return async function generateStrudel({ prompt, currentCode, history }) {
    if (!llmClient) {
      throw new ServiceUnavailable('GEMINI_API_KEY is not set in the root .env file.');
    }
    if (typeof prompt !== 'string' || prompt.trim() === '') {
      throw new InvalidInput('Body must include a non-empty string `prompt` field.');
    }

    const turns = sanitizeHistory(history);
    const userMessage = currentCode
      ? `<current>\n${currentCode}\n</current>\n\n${prompt}`
      : prompt;

    // Re-read on every request so prompt edits don't require a restart.
    const systemPrompt = await loadSystemPrompt();

    let completion;
    try {
      completion = await llmClient.complete({
        systemPrompt,
        userMessage,
        history: turns,
      });
    } catch (err) {
      throw new UpstreamError(`Gemini error: ${err.message}`);
    }

    const cleaned = stripCodeFences((completion.text ?? '').trim());

    if (isCannotHandle(cleaned)) {
      return {
        code: '',
        message: CANNOT_HANDLE_SENTINEL,
        noChange: true,
        model: completion.model,
      };
    }

    const parsed = parseMeta(cleaned);
    if (parsed) {
      return {
        // For new_track the body code is the seed for the new track;
        // for other actions it is empty. The chat-session layer treats
        // a meta turn as "noChange" for the *current* track so the
        // editor isn't overwritten — the seed is applied client-side
        // once the new track's editor mounts.
        code: parsed.code ? stripStaleVizHint(parsed.code) : '',
        meta: parsed.meta,
        // Echo the raw response so it can round-trip into LLM history
        // verbatim on the next turn (the skill rule asks the model to
        // ignore prior META lines when planning music).
        message: cleaned,
        noChange: true,
        model: completion.model,
      };
    }

    return {
      code: stripStaleVizHint(cleaned),
      model: completion.model,
    };
  };
}
