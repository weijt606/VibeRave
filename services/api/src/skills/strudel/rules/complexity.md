# Rule: complexity dial (1–5)

`rules/lushness.md` controls *atmosphere*. `rules/variation.md` controls
*how much each loop changes per cycle*. This rule controls a third
axis: **how much is happening at once**.

A track can be lush + varying and still feel monotonous if every layer
is a straight loop with simple harmony. Real complexity comes from
**polyrhythm, voice leading, counter-melody, modulation depth, and
arrangement** — all dialled together. This rule defines a 1–5 dial,
maps user keywords to a level, and lists concrete techniques per level.

## Level definitions

### Level 1 — minimal / stripped
- 1–2 layers
- One variation device max (e.g. a single `<a b>` alternation)
- Single harmonic centre, no chord motion
- Use when user says: minimal, sparse, stripped, raw, naked, bare, simple, just X, 极简, 简单, 干净

### Level 2 — standard club
- 3–4 layers
- 1–2 variation devices (`.every` OR `.sometimes`)
- 2-chord alternation OK
- The current default for plain genre prompts (will be RAISED — see below)

### Level 3 — rich (NEW DEFAULT)
- 4–5 layers including one texture / counter-rhythm layer
- 2+ variation devices distributed across DIFFERENT layers
- 4-chord progression with at least one non-tonic chord
- One of: polyrhythmic hat (`hh*16` + `.struct(...)`), counter-bass octave jump, pad with `.chunk(N, fn)`
- Use when user says **nothing about complexity** OR mentions: full, fuller, normal, classic, proper

### Level 4 — complex / layered
- 5–6 layers covering: drums + bass + chord + counter-melody + texture + (optional sparkle)
- 3+ variation devices, with at least one *probabilistic* (`.sometimes` / `.degradeBy` / `.rarely`)
- Voice leading across the chord progression (not just transposed copies)
- At least one polyrhythmic relationship (e.g. drums in 4, hats in `euclid(7,16)`, melody in `slow(3)`)
- One sound-design move beyond defaults: FM bass, vowel filter, formant shift, granular `.chop`, ring mod, `.shape(0.4)` saturation, or detuned supersaw stack
- Use when user says: complex, complicated, layered, rich, dense, busy, intricate, polyphonic, polyrhythmic, sophisticated, full-stack, lots of layers, 复杂, 丰富, 有层次, 密集, 立体, 饱满

### Level 5 — maximalist / baroque
- 6+ layers, multi-section arrangement via `arrange([N, partA], [N, partB], ...)`
- 4+ variation devices, including at least one nested transform (`.chunk(4, x => x.fast(2).rev())`)
- Polymeter (one layer in 7/8 against 4/4) or metric modulation
- Counter-melody that itself has variation — not a static line
- Multiple sound-design moves layered (FM bass + supersaw chord + vowel filter on lead + granular chop on a percussion)
- Use when user says: maximalist, baroque, IDM-style density, hyperpop-density, kitchen-sink, everything, every layer, 极致, 满, 最大化

## Keyword detection (case-insensitive, prompt + history)

Scan the user's prompt (and recent history if iterating) for the
keywords above. The HIGHEST level mentioned wins — "minimal complex
techno" reads as level 4 because "complex" trumps "minimal" (the user
wants complex; "minimal" is then a sub-style modifier, not a density
modifier).

Negation: "not too complex" / "less busy" / "simpler" → drop ONE level
from whatever the current track is at.

## Default level

**The default is level 3 (rich), not level 2.** Plain prompts like
"techno at 130" should produce a rich 4–5 layer track with proper
voice leading, not a 3-layer skeleton. Level 2 is what you produce
ONLY when the user said "minimal" / "sparse" / "stripped".

## Genre interaction with the dial

Genre and complexity are independent axes. Level 4 trap is still trap
(no pad if not asked) — but it gets a hi-hat polyrhythm, an 808 with
pitch envelope variation, and a counter-melodic bass-stab layer. Level
4 minimal techno is still minimal — but it gets polymetric percussion,
a slowly-evolving filter sweep on the bass, and chord motion on the
ghost layer (which IS allowed at level 4 even for minimal — the user
asked for complexity).

Tier B genres from `rules/lushness.md` (trap / minimal / IDM / etc.)
do NOT auto-add a lush pad even at level 4. They get complexity
through *rhythm and counter-motion*, not atmosphere. The trap example
above shows the principle.

## Concrete level-up techniques

When pushing from level N to level N+1, reach for these in order:

1. **Add a polyrhythmic percussion layer** — `.struct("1 0 1 0 0 1 0 1")` or `.euclid(5, 8)` on hats / shaker / rim
2. **Add a counter-melody** — same root, different rhythm, different octave, different timbre. `slow(3)` or `slow(5)` against a 4-bar loop creates phase interplay.
3. **Add voice leading** — instead of `<Cm Fm Bb Eb>`, write `chord("<Cm7 Fm9 Bb7sus Ebmaj7>").voicing().anchor("c4")` so the LLM picks smooth voicings.
4. **Add probabilistic mutation** — `.sometimes(rev)` / `.rarely(x => x.fast(2))` / `.degradeBy(0.15)` on a non-drum layer.
5. **Add a sound-design move** — pick ONE: FM bass (`.fmh.fmi`), vowel filter (`.vowel("<a e i o>")`), granular chop (`.chop(8)`), supersaw stack (3 detuned saws), or `.shape(0.35)` saturation.
6. **Add structural arrangement** — wrap in `arrange([4, intro], [8, full], [4, breakdown], [8, full])` so the loop has sections.
7. **Add nested transforms** — `.every(4, x => x.chunk(4, rev))` instead of just `.every(4, rev)`.

## Worked example: same prompt at level 2 vs level 4

**Prompt:** *"deep house at 122"*

**Level 2 (the OLD default — sounds correct but flat):**
```js
setcps(122/60/4)
stack(
  s("bd*4, [~ cp]*2, hh*8").bank("RolandTR909"),
  note("c2*8".add("<0 5 3 7>")).s("sawtooth").lpf(sine.range(400,1800).slow(4)).gain(0.6),
  note("<[c4,eb4,g4] [bb3,d4,f4]>").s("gm_synth_strings_1").attack(0.05).release(0.4).room(0.5).gain(0.4)
)
```

**Level 4 (the new default for "complex deep house" or just "deep house"):**
```js
setcps(122/60/4)
stack(
  // Layer 1: kick + clap
  s("bd*4, [~ cp]*2").bank("RolandTR909").gain("1 .9 1 .9"),
  // Layer 2: polyrhythmic hats (7-against-16)
  s("hh*16").bank("RolandTR909").gain(perlin.range(0.3, 0.6))
    .struct("1 0 1 0 0 1 0 1 1 0 0 1 0 1 0 0").sometimes(fast(2)),
  // Layer 3: bass with octave jump every 4 cycles
  note("c2*8".add("<0 5 3 7>")).s("sawtooth")
    .lpf(sine.range(400, 2000).slow(8)).lpq(15).gain(0.6)
    .every(4, x => x.add(12)),
  // Layer 4: chord with proper voice leading + side-chain feel
  chord("<Cm9 Fm11 Bb7sus Ebmaj9>").voicing().anchor("c4")
    .s("gm_synth_strings_1").attack(0.05).release(0.6)
    .room(0.5).delay(0.3).delaytime(0.375).delayfeedback(0.45).gain(0.4),
  // Layer 5: counter-melody (slow against the loop, creates phase interplay)
  note("<eb5 g4 bb4 c5 ~ g4 ~ eb5>").s("gm_celesta")
    .attack(0.1).release(0.5).gain(0.25).room(0.7)
    .slow(3).sometimes(rev),
  // Layer 6: detuned supersaw pad ghost layer for body
  note("<c3 ~ ~ ~>").s("sawtooth").layer(
    x => x,
    x => x.add(0.07),
    x => x.add(-0.07)
  ).attack(0.4).release(1.5).lpf(800).gain(0.18).room(0.6)
)
```

The level 4 version has: polyrhythmic hat layer, octave-jumping bass,
voice-led extended chords, counter-melodic celesta in `slow(3)`
against the 4-bar loop, and a detuned supersaw ghost. Same genre.
Same tempo. Same key. **Massively richer listening experience.**

## Anti-patterns

- ❌ Hitting level 5 by stacking 6 nearly-identical pad layers — that's "soup," not "complex." Different *rhythms* and *roles* per layer.
- ❌ Adding 6 layers without any polyrhythm — feels busy but flat. Level 4+ requires at least one cross-rhythm.
- ❌ Using level 5 maximalism on a Tier B genre when user didn't ask — trap stays trap. Push trap complexity through hi-hat rolls, 808 pitch movement, vocal chops, NOT through ambient pads.
- ❌ Treating the dial as "more reverb" — complexity ≠ atmosphere. Don't drown the mix to fake density.
