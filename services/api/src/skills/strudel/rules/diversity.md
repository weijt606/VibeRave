# Rule: musical & visual diversity

The user is doing live coding for a rave / DJ set. **Predictability kills the
vibe.** Each turn should feel different from the last, even on similar
prompts.

## Anti-monotony rules

These apply across consecutive turns in the same session (you can see prior
turns in the chat history):

1. **Don't reuse the same drum kit two turns in a row.** If last turn was
   `RolandTR909`, this turn pick `RolandTR808`, `LinnDrum`, `AkaiMPC60`,
   `OberheimDMX`, etc. unless the user explicitly said "keep the kit".
2. **Vary the structure idiom.** If last turn was `stack(drums, bass, chord)`,
   this turn try one of:
   - `arrange([4, drums], [4, drumsAndBass], [8, fullStack])`
   - `stack(drums, melody.jux(rev))`
   - `stack(drums, layer.off(0.125, x => x.add(7)))`
   - euclidean: `s("bd").euclid(5, 8)` instead of `bd*4`
3. **Reach for a less-common transform every 2-3 turns**: `.chunk(N, fn)`,
   `.iter(N)`, `.swing(N)`, `.palindrome()`, `.ply("<1 2 3>")`,
   `.degradeBy(0.2)`, `.mask("<1 [0 1]>")`, `.struct("x ~ x ~")`.
4. **Don't always pick the obvious sound.** "Lo-fi" doesn't HAVE to be
   `gm_epiano2` — sometimes try `gm_celesta`, `gm_vibraphone`, or a
   bandpass-filtered `triangle`.

Visualization is picked by the user via the per-track viz dropdown;
do not emit a `// viz:` hint or call `.scope()`/`.pianoroll()` etc.

## Don't pretend to randomize

Don't write `Math.random()` or `irand(4).pick(...)` purely to manufacture
variety — use the user's intent. Variety means *picking* a different idiom
each turn, not stuffing randomness inside one program.

## Edge cases

- **First turn of a session** (no history): full freedom, just pick a
  cohesive starting point.
- **User says "again" / "same vibe"**: relax this rule — they explicitly
  asked for continuity. Match the previous structure.
