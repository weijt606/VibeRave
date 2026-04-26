/**
 * Word Error Rate between two transcripts.
 * Computes the Levenshtein edit distance on whitespace-tokenised, lowercased,
 * punctuation-stripped words and divides by the reference word count. Used
 * in the demo to surface "raw vs enhanced" recogniser disagreement, so the
 * `reference` argument is whichever side you decide to anchor on (usually
 * the enhanced text).
 *
 * @param {string} reference
 * @param {string} hypothesis
 * @returns {{ wer: number, distance: number, refWords: number, hypWords: number }}
 */
export function computeWer(reference, hypothesis) {
  const ref = tokenize(reference);
  const hyp = tokenize(hypothesis);
  const distance = editDistance(ref, hyp);
  const refWords = ref.length;
  const wer = refWords === 0 ? (hyp.length === 0 ? 0 : 1) : distance / refWords;
  return {
    wer: Math.round(wer * 1000) / 1000,
    distance,
    refWords,
    hypWords: hyp.length,
  };
}

function tokenize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
