// Briefly highlight the lines that changed between two code snapshots.
// Called after the LLM rewrites a track so the user can see WHICH lines
// the model touched without diffing in their head — the old approach
// ("the whole editor just got swapped, find the diff yourself") meant
// users often missed subtle one-line tweaks (a swapped sound, a new
// effect chained on, a tempo change).
//
// Algorithm: bag-of-lines diff. We don't care about position, only
// presence — if a trimmed line in `nextCode` was also in `prevCode`,
// it's "unchanged" (consume one count from the prev bag). Anything
// not consumable from the prev bag is "new/changed" and gets the flash.
// Empty lines are always skipped — flashing whitespace looks like noise.
//
// This is a deliberately simple heuristic, not a real Myers diff. The
// edge case it gets wrong: if the LLM duplicates an existing line, the
// duplicate won't flash. Worth it for the 30 lines of code instead of
// pulling in a diff library.

const FLASH_CLASS = 'vr-line-flash';
const ANIMATION_MS = 1200; // CSS keyframe is 0.8s; pad to be safe.

function bagOf(lines) {
  const bag = new Map();
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    bag.set(t, (bag.get(t) || 0) + 1);
  }
  return bag;
}

/**
 * @param {import('@codemirror/view').EditorView | undefined} view
 * @param {string} prevCode
 * @param {string} nextCode
 */
export function flashChangedLines(view, prevCode, nextCode) {
  if (!view || !view.contentDOM) return;
  if (!nextCode || prevCode === nextCode) return;

  const prevBag = bagOf((prevCode || '').split('\n'));
  const nextLines = nextCode.split('\n');
  const changedIndices = [];

  nextLines.forEach((line, idx) => {
    const t = line.trim();
    if (!t) return; // empty line: don't flash whitespace
    const count = prevBag.get(t) || 0;
    if (count > 0) {
      prevBag.set(t, count - 1);
    } else {
      changedIndices.push(idx);
    }
  });

  if (changedIndices.length === 0) return;

  // Wait one paint so CodeMirror has rendered the new doc — running
  // querySelectorAll synchronously after setCode hits the OLD line nodes
  // (which CM is about to throw away).
  requestAnimationFrame(() => {
    const lineNodes = view.contentDOM.querySelectorAll('.cm-line');
    if (!lineNodes || !lineNodes.length) return;
    for (const idx of changedIndices) {
      const node = lineNodes[idx];
      if (!node) continue;
      // Restart the animation if the same line got re-flashed within
      // the cleanup window: remove + reflow + add.
      node.classList.remove(FLASH_CLASS);
      // eslint-disable-next-line no-unused-expressions
      node.offsetWidth;
      node.classList.add(FLASH_CLASS);
      setTimeout(() => node.classList.remove(FLASH_CLASS), ANIMATION_MS);
    }
  });
}
