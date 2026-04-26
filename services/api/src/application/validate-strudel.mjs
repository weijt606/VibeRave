// Server-side guard that runs the LLM's Strudel output through the real
// transpiler + queryArc, then walks the resulting haps for known-bad
// shapes (object-typed `note`, non-finite numeric controls). Catches the
// regressions that surface in the browser as `getTrigger error: ...` so
// chat-session can ask the LLM to fix them before the user ever sees it.
//
// This pipeline is browser-leaning — `setcps` / `hush` etc. are normally
// supplied by `@strudel/core/repl`, which we don't run here. We stub them
// as no-ops so a track that opens with `setcps(120/60/4)` still validates.

const STRING_LIKE_CONTROLS = new Set([
  'note',
  'n',
  's',
  'sound',
  'bank',
  'scale',
  'vowel',
]);

// queryArc length used for validation. Long enough to expand `<a b c d>` and
// `slow(2)` patterns into their full cycle, short enough that hot prompts
// stay snappy. We start a hair before 0 because a few transforms emit edge
// haps at exactly 0 that escape the [0, n) window otherwise.
const QUERY_FROM = -0.001;
const QUERY_TO = 4;

function describeBadHap(value) {
  if (!value || typeof value !== 'object') return null;
  for (const [key, v] of Object.entries(value)) {
    if (STRING_LIKE_CONTROLS.has(key) && v !== null && typeof v === 'object') {
      return `control "${key}" must be string/number, got object: ${truncate(JSON.stringify(v), 80)}`;
    }
    if (typeof v === 'number' && !Number.isFinite(v)) {
      return `control "${key}" is non-finite (${v})`;
    }
  }
  return null;
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

let initPromise = null;
async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // No-op stubs for repl-scoped globals so user code that begins with
    // `setcps(...)` doesn't fail with "X is not defined" during validation.
    globalThis.setcps ??= () => {};
    globalThis.setcpm ??= () => {};
    globalThis.hush ??= () => {};

    const core = await import('@strudel/core');
    const mini = await import('@strudel/mini');
    const tonal = await import('@strudel/tonal');
    const draw = await import('@strudel/draw');
    const transpilerPkg = await import('@strudel/transpiler');
    await core.evalScope(core, mini, tonal, draw);
    return { evaluate: core.evaluate, transpiler: transpilerPkg.transpiler };
  })();
  return initPromise;
}

export function makeValidateStrudel() {
  return async function validatePattern(code) {
    if (typeof code !== 'string' || code.trim() === '') {
      return { valid: false, error: 'empty code' };
    }
    let evaluate, transpiler;
    try {
      ({ evaluate, transpiler } = await init());
    } catch (err) {
      return { valid: false, error: `validate-init: ${err.message}` };
    }

    let pattern;
    try {
      const result = await evaluate(code, transpiler);
      pattern = result?.pattern;
    } catch (err) {
      return { valid: false, error: `evaluate: ${err.message}` };
    }
    if (!pattern || typeof pattern.queryArc !== 'function') {
      return { valid: false, error: 'top-level expression is not a Strudel pattern' };
    }

    let haps;
    try {
      haps = pattern.queryArc(QUERY_FROM, QUERY_TO);
    } catch (err) {
      return { valid: false, error: `queryArc: ${err.message}` };
    }
    if (!Array.isArray(haps) || haps.length === 0) {
      // Empty pattern is suspicious but not always wrong (e.g. `silence`).
      // Don't fail — the LLM's output-format rules forbid silence anyway.
      return { valid: true };
    }
    for (const hap of haps) {
      const issue = describeBadHap(hap?.value);
      if (issue) return { valid: false, error: issue };
    }
    return { valid: true };
  };
}
