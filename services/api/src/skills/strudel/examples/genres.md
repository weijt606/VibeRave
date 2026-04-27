# Examples: genres

Battle-tested patterns by vibe. Every snippet uses only function and sound
names from `reference/*`. Pick the closest template, then mutate per the
user's request.

**The host renders the visualizer** (per-track painter dropdown — pianoroll
/ waveform / spectrum / scope / spiral). Do **not** append `.scope()` /
`.pianoroll()` / `.fscope()` / `.tscope()` to your output. See
`rules/output-format.md`.

## Lo-fi hip-hop

```js
setcps(80/60/4)
stack(
  s("bd ~ ~ bd, ~ ~ sd ~, hh*8?").bank("LinnDrum"),
  note("<c2 g1 a1 e1>").s("sawtooth").lpf(400).gain(0.6),
  note("<c4 eb4 g4 bb4>").s("gm_epiano2").room(0.6).gain(0.4)
).slow(2)
```

## House (124 BPM)

```js
setcps(124/60/4)
stack(
  s("bd*4, [~ cp]*2, hh*8").bank("RolandTR909"),
  note("c2*8".add("<0 7 5 3>")).s("sawtooth").lpf(sine.range(400,1800).slow(4)).lpq(15).gain(0.6),
  note("<[c4,eb4,g4] [bb3,d4,f4]>").s("gm_synth_strings_1").attack(0.05).release(0.3).gain(0.4).room(0.4)
)
```

## Techno (140 BPM)

```js
setcps(140/60/4)
stack(
  s("bd*4, ~ ~ cp ~, hh*8").bank("RolandTR909").gain("1 .8 1 .8"),
  note("c2!4 c2 eb2 c2 g1").s("sawtooth").lpf(sine.range(300,3000).slow(8)).lpq(20).gain(0.65),
  s("rim*4").bank("RolandTR909").gain(0.4).every(4, rev)
)
```

## Berghain techno (130–138 BPM, dark, hypnotic, dub-techno space)

The Berghain sound is slower than generic peak-time techno, darker, deeper,
and built on tension rather than fills. Big sub, lots of head-room, the
clap drowned in delay tails, hi-hats kept minimal so the kick can breathe.

```js
setcps(132/60/4)
stack(
  s("bd*4").bank("RolandTR909").gain(0.95),
  s("~ ~ cp ~").bank("RolandTR909").gain(0.55).delay(0.5).delaytime(0.375).delayfeedback(0.55).room(0.7),
  s("~ hh ~ hh").bank("RolandTR909").gain(0.35),
  note("c1!2 ~ c1 eb1").s("sine").gain(0.85).attack(0.005).release(0.3).lpf(180),
  note("<c2 ~ eb2 ~ g1 ~ bb1 ~>").s("sawtooth").lpf(sine.range(220,900).slow(16)).lpq(14).gain(0.5)
)
```

## Minimal techno (130 BPM, sparse, lots of space)

```js
setcps(130/60/4)
stack(
  s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR909").gain(0.95),
  s("~ ~ ~ rim ~ ~ rim ~").bank("RolandTR909").gain(0.5),
  s("~ hh ~ ~").bank("RolandTR909").gain(perlin.range(0.25, 0.5)),
  note("c2 ~ ~ ~ ~ ~ eb2 ~").s("sawtooth").lpf(450).gain(0.55).release(0.18)
)
```

## Ambient pad

```js
note("<c3 eb3 g3 bb3>")
  .s("gm_pad_warm")
  .lpf(sine.range(400,2000).slow(8))
  .room(0.9).gain(0.5).slow(4)
```

Layered version with subtle motion:

```js
stack(
  note("<c3 eb3 g3 bb3>").s("gm_pad_warm").lpf(sine.range(400,2000).slow(8)).room(0.9).gain(0.5),
  note("<c5 ~ eb5 ~ g5 ~ bb5 ~>").s("triangle").attack(0.5).release(1.2).gain(0.3).room(0.8).delay(0.4).delaytime(0.5)
).slow(4)
```

## Acid bass (303 emulation)

```js
note("c2 ~ eb2 g2 ~ c3 bb2 g2".add("<0 12>"))
  .s("sawtooth").lpf(sine.range(200,2000).slow(4))
  .lpq(20).gain(0.7)
```

## Chord-stab (deep house / disco)

```js
note("<[c3,eb3,g3] [bb2,d3,f3] [ab2,c3,eb3] [g2,b2,d3]>")
  .s("gm_synth_strings_1").attack(0.05).release(0.4).room(0.5).gain(0.6)
```

## Drum and bass (~174 BPM, breakbeat)

```js
setcps(174/60/4)
stack(
  s("bd ~ ~ sd ~ bd ~ sd, hh*16?").bank("AkaiMPC60").gain(0.85),
  note("c2 ~ ~ ~ eb2 ~ g1 ~").s("sawtooth").lpf(sine.range(200,1500).slow(8)).lpq(15).gain(0.7),
  note("<[c4,eb4,g4] ~ [bb3,d4,f4] ~>").s("gm_pad_poly").room(0.6).gain(0.35)
)
```

## Chiptune / 8-bit

```js
stack(
  s("bd*4, ~ sd, hh*8").bank("RolandTR909").gain(0.7),
  note("<c4 e4 g4 c5 b4 g4 e4 c4>").s("square").gain(0.5),
  note("c2*4".add("<0 7 5 3>")).s("triangle").gain(0.6)
).crush(8)
```

## Drone / dark ambient

```js
note("c2,g2,c3,eb3,g3")
  .s("sawtooth")
  .lpf(perlin.range(200,1200).slow(16))
  .lpq(8).gain(0.4).room(0.95).slow(8)
```

## Jazzy chill (90 BPM)

```js
setcps(90/60/4)
stack(
  s("bd ~ ~ ~, ~ ~ sd ~, hh*8").bank("LinnDrum").gain("0.8 0.6 0.8 0.6").swing(4),
  n("0 2 4 5".add("<0 7 5 -2>")).scale("C2:minor").s("gm_acoustic_bass").gain(0.7),
  note("<[c3,eb3,g3,bb3] [f2,ab2,c3,eb3] [g2,bb2,d3,f3] [c3,eb3,g3,bb3]>")
    .s("gm_epiano2").attack(0.05).release(0.6).room(0.4).gain(0.5)
).slow(2)
```

## Funky / disco

```js
setcps(118/60/4)
stack(
  s("bd*4, ~ cp, hh*16").bank("RolandTR909").gain("1 .8 1 .8"),
  note("c2 c2 eb2 c2 f2 c2 g2 c2").s("gm_electric_bass_finger").gain(0.7),
  note("<[c4,eb4,g4]!2 [f3,ab3,c4]!2>").s("gm_brass_section").attack(0.02).release(0.2).gain(0.5)
)
```

## Dub (heavy delay, sparse drums)

```js
setcps(76/60/4)
stack(
  s("bd ~ ~ ~, ~ ~ sd ~").bank("RolandTR808").gain(0.85),
  s("hh*4?").bank("RolandTR808").gain(0.4).delay(0.6).delaytime("3/16").delayfeedback(0.7),
  note("c2 ~ ~ ~ eb2 ~ ~ ~").s("sawtooth").lpf(280).gain(0.7),
  note("<[c4,eb4,g4] ~ ~ ~>").s("gm_synth_strings_1").attack(0.1).release(0.6)
    .delay(0.5).delaytime(0.375).delayfeedback(0.6).gain(0.4)
)
```

## Trap (140 half-time, 808 sub, hi-hat rolls)

```js
setcps(140/60/4)
stack(
  s("bd ~ ~ ~ ~ ~ bd bd").bank("RolandTR808"),
  s("~ ~ sd ~ ~ ~ sd ~").bank("RolandTR808").gain(0.9),
  s("hh*16").bank("RolandTR808").gain(perlin.range(0.3, 0.9)).every(4, x=>x.fast(2)),
  note("c1 ~ ~ ~ eb1 ~ g1 ~").s("sine").gain(0.85).attack(0.001).release(0.4)
)
```

## IDM (broken beats, mutating effects)

```js
stack(
  s("bd*4").bank("AkaiMPC60").chunk(4, x=>x.fast(2)).sometimes(rev),
  s("hh*16").bank("AkaiMPC60").gain(perlin.range(0.2, 0.9)).degradeBy(0.3),
  n("0 4 7 5 0 7 4 2".add("<0 5 -3>")).scale("D:dorian").s("triangle")
    .lpf(sine.range(400,3000).slow(7)).every(3, x=>x.add(12)),
  note("d2 ~ a1 ~ d2 ~ ~ a1").s("gm_synth_bass_1").gain(0.6)
)
```

## Hyperpop / chiptune (fast, bright, melodic)

```js
setcps(160/60/4)
stack(
  s("bd*4, ~ cp, hh*8").bank("RolandTR909").gain(0.9),
  n("0 5 7 12 7 5 0 -3".add("<0 5 7 3>")).scale("F:major").s("square")
    .gain(0.5).lpf(4000),
  note("<f2 c2 ab1 c2>").s("triangle").lpf(800).gain(0.7).fast(2),
  note("<[f4,a4,c5] [c4,e4,g4] [ab3,c4,eb4] [c4,f4,a4]>")
    .s("gm_lead_1_square").attack(0.01).release(0.2).gain(0.4)
).crush(8)
```

## Hard / industrial techno (FM bass, 138 BPM)

When the user wants the bass to feel metallic, harder, more aggressive
than what a sawtooth+lpf can do, reach for FM synthesis. `fmh` is the
modulator-to-carrier ratio (integer = harmonic, fractional = inharmonic
metallic clang); `fmi` is the modulation index (depth — higher = more
overtones). Modulating `fmi` over time with `<...>` gives the bass
movement without touching the filter.

```js
setcps(138/60/4)
stack(
  s("bd*4").bank("RolandTR909").gain(1),
  s("~ ~ cp ~").bank("RolandTR909").gain(0.55).room(0.5),
  s("hh*8").bank("RolandTR909").gain(perlin.range(0.3, 0.6)),
  note("c2!4 c2 eb2 c2 g1").s("sine").fmh(2).fmi("<0 4 8 12>")
    .adsr(".005:.05:.7:.15").gain(0.7),
  note("<g3 ~ bb3 ~>").s("sine").fmh("<2 3>").fmi(8)
    .adsr(".01:.2:.3:.3").gain(0.4).room(0.4)
)
```

## Jazz progression with chord(...).voicing()

When the user names chords ("Cm7 to Am7 to Fmaj7"), `chord(...).voicing()`
picks idiomatic voicings automatically — much more harmonically rich than
hand-spelling triads. Pair with `.anchor()` to keep voicings in a sane
register.

```js
setcps(90/60/4)
stack(
  s("bd ~ ~ ~, ~ ~ sd ~, hh*8").bank("LinnDrum").gain(0.7).swing(4),
  chord("<Cm7 Fm7 Bb7 Ebmaj7>").voicing().anchor("c4")
    .s("gm_epiano2").attack(0.05).release(0.5).room(0.4).gain(0.5),
  chord("<Cm7 Fm7 Bb7 Ebmaj7>").root().sub(12).s("gm_acoustic_bass").gain(0.6)
)
```

## How to use these

Pick the closest template, then mutate per the user's request:

- **"Make it darker"** → drop `lpf` to ~400-600, raise `room` to ~0.85,
  swap a brighter soundfont (`gm_synth_strings_1`) for a darker one
  (`gm_pad_warm`).
- **"Make it dubby"** → push `delay`, `delaytime`, `delayfeedback` on at
  least one layer (typically the snare/clap or chord). See the Dub
  template above.
- **"More energetic"** → `.fast(2)` somewhere, raise `setcps`, add a
  `hh*16` layer or a euclidean tom fill.
- **"More minimal"** → strip the chord/pad layer, keep drums + bass only.
  See the Minimal techno template.
- **"Harder kick"** → bigger `gain` on the kick layer, sometimes a short
  `release` so it punches; consider swapping the bank to RolandTR909 if
  it isn't already.
- **"More reverb"** → `.room(0.7-0.9)` on the most-prominent melodic
  layer, not the kick.
- **"Harder bass" / "metallic" / "industrial"** → swap `.s("sawtooth")`
  for `.s("sine").fmh(N).fmi(M)` — FM synthesis. `fmh` integer 1-3 = warm
  harmonic; fractional / 5+ = clangy/metallic. `fmi` 4-12 controls
  brightness. See the Hard / industrial techno template.
- **"Vocal-y" / "wow filter" / "warm vowel filter"** → add
  `.vowel("<a e i o>")` to the synth layer. Animates between formant
  poses each cycle — the classic talkbox / wah trick.
- **"Dorian" / "phrygian" / "lydian feel"** → swap `.scale("X:minor")`
  for `.mode("dorian")` (or whichever mode the user named). For chord-based
  prompts ("Cm7 to Am7"), use `chord(...).voicing()` instead — see the
  Jazz progression template above.
- **"Add ADSR shape"** → `.adsr(":a:d:s:r")` shorthand, e.g.
  `.adsr(".005:.05:.7:.15")` for a punchy plucked envelope, or
  `.adsr(".5:.2:.4:1.2")` for a slow swell.
