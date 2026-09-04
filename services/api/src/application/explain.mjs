// EXPLAIN protocol (skills/strudel/rules/output-format.md): the model may end
// its response with exactly one line `EXPLAIN: <one short sentence>`. It is
// the only non-code line allowed besides META. The server strips it here
// and hands it to the client as `explain`; validation never sees it.

const EXPLAIN_LINE_RE = /^\s*(?:\/\/\s*)?EXPLAIN\s*[:：]\s*(.*?)\s*$/i;
const MAX_EXPLAIN_CHARS = 120;

/**
 * @param {string} text
 * @returns {{ text: string, explain: string }}
 */
export function stripExplain(text) {
  const src = String(text ?? '');
  const lines = src.split('\n');
  let explain = '';
  // Walk from the end: skip trailing blank lines (and a closing fence),
  // then take the last real line if it is an EXPLAIN line. Only one
  // EXPLAIN line is honoured; a second one is dropped as garbage.
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === '' || line.trim() === '```') continue;
    const m = line.match(EXPLAIN_LINE_RE);
    if (!m) break;
    if (!explain) explain = m[1].slice(0, MAX_EXPLAIN_CHARS);
    lines.splice(i, 1);
  }
  // Also drop a stray EXPLAIN line the model put at the top.
  while (lines.length && EXPLAIN_LINE_RE.test(lines[0])) {
    const m = lines[0].match(EXPLAIN_LINE_RE);
    if (!explain) explain = m[1].slice(0, MAX_EXPLAIN_CHARS);
    lines.shift();
  }
  return { text: lines.join('\n').replace(/\s+$/, ''), explain };
}

/** Code-only view, for validators. */
export function stripExplainLine(code) {
  return stripExplain(code).text;
}
