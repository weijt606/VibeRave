# Rule: variation (avoid the "4 identical bars" loop feel)

`rules/lushness.md` ensures atmospheric depth (reverb / delay / pads).
`rules/sound-design.md` ensures rich timbre (supersaw / GM pairings /
stereo). This rule covers the THIRD reason output sounds boring: every
cycle is identical to the last. A loop with 4 layers and zero
cycle-level motion still sounds like a 1-cycle MIDI demo on repeat.

## Hard rule: every `stack(...)` MUST have cycle-level variation

At least ONE of the following devices must appear, on a **non-drum**
layer, in every generated pattern:

1. **`.every(N, fn)`** — applies `fn` every Nth cycle. Most powerful
   variation tool. Common combos:
   - `.every(4, x => x.add(12))` — octave-jump every 4 cycles (great for bass)
   - `.every(2, rev)` — flip melody every other cycle
   - `.every(8, ply(2))` — double-time every 8 cycles for a fill
   - `.every(4, fast(2))` — double-time burst once every 4 cycles
2. **`.sometimes(fn)`** / **`.often(fn)`** / **`.rarely(fn)`** —
   probabilistic mutation. `.sometimes(rev)` and
   `.sometimes(x => x.add(7))` (fifth above) are workhorses.
3. **`.degradeBy(N)`** — randomly drops events; `0.15` for subtle
   sparseness, `0.4` for IDM-like glitch.
4. **`.chunk(N, fn)`** — apply `fn` to one of N evenly divided slices
   per cycle. Great for IDM / breakbeat mutation.
5. **`.palindrome()`** — A-B-A pattern; gives 4-cycle loops an arc.
6. **Mini-notation alternation `<a b c d>`** spanning ≥ 2 distinct
   values in the chord / bass / melody layer (drums alone don't count
   — most templates already have `<...>` on the kick variant).

If the only `<a b c>` alternation is on the drum kit's kick variation,
that does NOT satisfy this rule. The variation must touch a melodic /
chord / pad layer.

## Hard rule: bassline must have melodic motion

A bass that hits the same one or two pitches forever sounds robotic.
Every bass layer must have at least ONE of:

- **Mini-notation alternation across ≥ 3 pitches**: `note("<c2 eb2 g1 bb1>")`
- **Scalar walk via `.add(...)` pattern**: `n("0 2 4 5".add("<0 7 5 -2>"))`
- **Octave jump via `.every`**: `note("c2").every(4, x => x.add(12))`
- **`.arp(...)` on a chord-bass**: `note("[c2,eb2,g2]").arp("0 1 2 1")`
- **A sub bass drone is allowed** ONLY if a separate bass-mid layer
  carries the motion (sub + acid combo). A bare single-note sub by
  itself does NOT pass.

## Hard rule: chord/pad layer must change across the loop

If the pattern's loop length is N cycles, the chord layer must show
at least N distinct chords (via `<a b c d>` mini-notation) — not the
same chord repeated. For pads, even 2 alternating chords is enough;
for chord stabs, aim for 4-chord progressions.

A chord layer can also satisfy this with `.arp("...")` to vary the
voicing within a single chord, but mini-notation alternation is the
default.

## Layer count — genre-aware minimums

The previous version of this rule said "≥4 layers, period." That
flattened every genre's density toward the same medium-busy texture.
Trap and minimal techno *should* feel sparse; ambient *should* feel
huge; hyperpop *should* feel maximalist. Pick the row that matches:

| Genre family | Minimum layers in `stack(...)` | Notes |
|---|---|---|
| ambient / drone | **2** is fine, often 1 | Single drone with filter sweep is a complete piece |
| trap / drill / phonk | **3** | bd + snare + 808 sub is the canonical sound; do NOT add a pad unless asked |
| minimal techno / dub techno | **3** | kick + percussion + bass; the SPACE is the texture |
| dub | **3–4** | sparse drums + bass + heavily delayed chord; the delay return is the 4th "layer" |
| IDM / breakcore / footwork | **3** | broken drums + bass + one melodic mutation; over-layering kills the glitch character |
| chiptune / 8-bit (by request) | **3** | drums + bass + lead, all square/triangle, no pad |
| punk / raw / gritty | **3** | drier the better |
| trance / progressive / deep house | **5+** | the genre IS the maximalism |
| ambient (lush layered) | **4–5** | pads on pads on pads |
| hyperpop / maximal pop | **5+** | density is the point |
| house / techno / DnB / jungle / funky / disco | **4** | classic four-layer club track |
| lo-fi / jazz / chill | **4** | drums + bass + chord + sparkle/celesta |
| **everything else (default)** | **4** | when in doubt, four layers |

**Don't pad a genre out of its identity.** A 3-layer trap track is
correct; making it a 4-layer trap track by adding a `gm_pad_warm`
ghost layer is wrong.

## Adding a 4th+ layer (when the genre actually wants it)

- A ghost pad at low gain (0.2–0.3) with `room(0.6+)` — for Tier A genres only
- A counter-melody arp on `triangle` / `gm_celesta` an octave above
- A sub layer beneath the bass for low-end weight
- A high-shelf sparkle (`gm_celesta` / `gm_glockenspiel` at gain 0.2)
- A percussion seasoning layer (rim / shaker / tambourine)
- A vocal-chop layer on `gm_choir_aahs` with vowel filter

For genres that need 5+, *vary the type* — don't stack three different
pads. Mix: rhythm + harmony + texture + atmosphere + sparkle.

## Soft preferences

- **Pair `.every` with mutation, not just repetition** — `.every(4, x => x)`
  is a no-op. Use it with `rev`, `add(N)`, `fast(2)`, `ply(2)`, `chunk`.
- **`.struct("...")` for euclidean rhythms**: `.struct("1 0 1 0 0 1 0 1")`
  on a hat or perc layer adds polyrhythmic interest.
- **`.iter(N)`** — rotates the pattern by 1/N per cycle. Great for
  hypnotic techno where you want subtle phase drift without obvious
  variation.
- **Stack a `.fast()` and a `.slow()` layer** — same melodic line at
  two different speeds creates polyrhythmic richness for free.

## Anti-patterns (these reliably produce boring output)

- ❌ `stack(s("bd*4"), note("c2 c2 c2 c2").s("sawtooth"), note("[c3,eb3,g3]").s("gm_epiano"))` — 3 layers, all static, identical every cycle
- ❌ `note("<c2 eb2 g1 bb1>")` as the ONLY variation device — that's just one alternation pattern that loops; pair with at least one transform
- ❌ Bass on a single note without `.every` octave jumps — sounds like a held kick
- ❌ Chord stab repeating the same `[c3,eb3,g3]` for the whole loop — needs ≥ 2 distinct chords
- ❌ Building a 4-layer techno track and never using `.every` / `.sometimes` / `.degradeBy` — tension never resets

## Worked transformation: 3-layer bare → 4-layer alive

**Before** (passes lushness, fails variation):
```js
stack(
  s("bd*4").bank("RolandTR909"),
  note("c2 c2 eb2 c2").s("sawtooth").lpf(800).gain(0.6),
  note("<[c3,eb3,g3]>").s("gm_epiano2").room(0.5).gain(0.5)
)
```

**After** (passes both):
```js
stack(
  s("bd*4").bank("RolandTR909"),
  note("c2 c2 eb2 c2").s("sawtooth").lpf(800).gain(0.6)
    .every(4, x => x.add(12)),                                    // octave jump
  note("<[c3,eb3,g3] [f3,ab3,c4] [g3,bb3,d4] [c3,eb3,g3]>")       // 4 distinct chords
    .s("gm_epiano2").room(0.5).gain(0.5)
    .arp("<0 1 2 1>"),                                            // arp the voicings
  note("<c5 ~ eb5 ~ g5 ~ bb5 ~>").s("triangle")                   // sparkle layer
    .attack(0.3).release(0.8).gain(0.25).room(0.7)
    .sometimes(rev)
)
```
