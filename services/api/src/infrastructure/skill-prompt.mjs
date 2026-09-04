import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Composable Strudel skill → system prompt.
 *
 * The skill is a directory of markdown files (skills/strudel). This module
 * decides WHICH files go into the prompt for a request (`intent`, `mode`)
 * and prepends the host block that tells the model about booth mode and
 * the EXPLAIN language. Files are cached in memory and re-read only when
 * the newest mtime among them changes, so editing the skill still needs
 * no restart but a request no longer costs 31 disk reads.
 */

// Full prompt — mirrors "Loading order" in skills/strudel/SKILL.md.
export const SKILL_ORDER = [
  'rules/output-format.md',
  'rules/iteration.md',
  'rules/host-controls.md',
  'rules/diversity.md',
  'rules/lushness.md',
  'rules/sound-design.md',
  'rules/style-fidelity.md',
  'rules/variation.md',
  'rules/complexity.md',
  'rules/family-mode.md',
  'rules/uncertainty.md',
  'rules/cannot-handle.md',
  'rules/meta-commands.md',
  'rules/error-recovery.md',
  'rules/siblings.md',
  'reference/sounds.md',
  'reference/mini-notation.md',
  'reference/pattern-transforms.md',
  'reference/effects.md',
  'reference/modulation.md',
  'reference/tempo.md',
  'reference/tonal.md',
  'reference/visualization.md',
  'reference/dual-deck.md',
  'recipes/generate.md',
  'recipes/explain.md',
  'recipes/debug.md',
  'recipes/vary.md',
  'examples/genres.md',
  'examples/techniques.md',
  'examples/complex.md',
  'examples/kids.md',
];

// Tweak intent (docs/booth/CONTRACTS.md §8.2): a small edit to code that is
// already playing. Only the output contract, iteration semantics, error
// recovery, host commands, and the sibling rule — plus family-mode when the
// booth is in kids mode.
export const TWEAK_ORDER = [
  'rules/output-format.md',
  'rules/iteration.md',
  'rules/error-recovery.md',
  'rules/meta-commands.md',
  'rules/siblings.md',
];
const MODE_RULE = 'rules/family-mode.md';
// Adult-only templates are dropped from kids-mode prompts so the model has
// nothing to "borrow" a Berghain kick from.
const ADULT_ONLY = new Set(['examples/genres.md', 'examples/complex.md']);

export const MODES = new Set(['adult', 'kids']);
export const INTENTS = new Set(['generate', 'tweak']);
export const LANGS = new Set(['zh', 'en']);

export function filesFor({ mode, intent } = {}) {
  if (intent === 'tweak') {
    return mode === 'kids' ? [...TWEAK_ORDER, MODE_RULE] : TWEAK_ORDER;
  }
  return mode === 'kids' ? SKILL_ORDER.filter((f) => !ADULT_ONLY.has(f)) : SKILL_ORDER;
}

const KIDS_HEADER = [
  '# HOST: FAMILY MODE ACTIVE',
  '',
  'The host has switched this session to **family (K-12) mode**. The rule in',
  '`rules/family-mode.md` is ACTIVE for every response in this session',
  'regardless of keywords — do not scan the prompt for triggers, treat them as',
  'already matched. Use only the family-mode sound palette, gain caps, BPM',
  'range, and layer limit, and route requests to the templates in',
  '`examples/kids.md`. Never emit an adult genre template, even if the user',
  'names one ("techno", "trap", "dubstep") — substitute the kid-friendly idiom',
  'exactly as `rules/family-mode.md` prescribes.',
].join('\n');

const ADULT_HEADER = [
  '# HOST: family mode OFF',
  '',
  'The host runs in adult booth mode. The keyword triggers in',
  '`rules/family-mode.md` are DISABLED for this session: do not activate family',
  'mode on your own; the full adult palette and genre list applies.',
].join('\n');

function explainHeader(lang) {
  const zh = lang !== 'en';
  return [
    '# HOST: EXPLAIN line',
    '',
    'After the code (or after a META line), append exactly ONE final line:',
    zh
      ? '`EXPLAIN: <一句中文，不超过 30 字，说明你改了什么或做了什么>`'
      : '`EXPLAIN: <one short English sentence, max 12 words, saying what you changed or made>`',
    'It is the only non-code line allowed besides META. Never omit it, never',
    'write more than one, never put it before the code.',
  ].join('\n');
}

export function hostHeader({ mode, lang } = {}) {
  const parts = [];
  if (mode === 'kids') parts.push(KIDS_HEADER);
  else if (mode === 'adult') parts.push(ADULT_HEADER);
  parts.push(explainHeader(lang));
  return parts.join('\n\n');
}

/**
 * Pure composition step (unit-testable): given file contents, build the
 * final system prompt string.
 * @param {{ files: Map<string,string>, mode?: string, intent?: string, lang?: string }} args
 */
export function composeSystemPrompt({ files, mode, intent, lang }) {
  const order = filesFor({ mode, intent });
  const body = order.map((rel) => {
    const text = files.get(rel);
    if (typeof text !== 'string') throw new Error(`skill file missing: ${rel}`);
    return text;
  });
  return [hostHeader({ mode, lang }), ...body].join('\n\n---\n\n');
}

/**
 * @param {{ root: string, statEveryMs?: number, now?: () => number }} opts
 * @returns {{ load: (opts?: { mode?: string, intent?: string, lang?: string }) => Promise<string>, files: string[], stats: () => object }}
 */
export function createSkillPromptProvider({ root, statEveryMs = 1000, now = Date.now }) {
  const allFiles = Array.from(new Set([...SKILL_ORDER, ...TWEAK_ORDER, MODE_RULE]));
  let contents = null; // Map<rel, string>
  let contentsMtime = -1; // max mtime of the cached read
  let lastStatAt = -Infinity;
  let lastStatMtime = -1;
  const composed = new Map(); // `${mode}|${intent}|${lang}` → string
  let reads = 0;
  let composes = 0;

  async function maxMtime() {
    const stats = await Promise.all(allFiles.map((rel) => stat(resolve(root, rel))));
    return Math.max(...stats.map((s) => s.mtimeMs));
  }

  async function ensureFresh() {
    const t = now();
    // Stat at most once per `statEveryMs` — hot prompts shouldn't pay 33
    // stat() calls each; edits still show up within a second.
    if (contents && t - lastStatAt < statEveryMs) return;
    const mtime = await maxMtime();
    lastStatAt = t;
    lastStatMtime = mtime;
    if (contents && mtime === contentsMtime) return;
    const texts = await Promise.all(allFiles.map((rel) => readFile(resolve(root, rel), 'utf8')));
    contents = new Map(allFiles.map((rel, i) => [rel, texts[i]]));
    contentsMtime = mtime;
    composed.clear();
    reads += 1;
  }

  return {
    files: allFiles,
    async load({ mode, intent, lang } = {}) {
      await ensureFresh();
      const key = `${mode || ''}|${intent || ''}|${lang || ''}`;
      let prompt = composed.get(key);
      if (!prompt) {
        prompt = composeSystemPrompt({ files: contents, mode, intent, lang });
        composed.set(key, prompt);
        composes += 1;
      }
      return prompt;
    },
    stats: () => ({ reads, composes, cachedVariants: composed.size, mtime: contentsMtime, lastStatMtime }),
  };
}
