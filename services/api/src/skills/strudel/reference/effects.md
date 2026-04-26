# Reference: audio effects

All effects are chained methods on a pattern. Every name in this file was
verified against `doc.json`.

## Filters

| Method | Range | Notes |
| --- | --- | --- |
| `.lpf(Hz)` | ~50–20000 | Low-pass cutoff. |
| `.lpq(N)` | 0–30+ | Low-pass resonance / Q. **Use this — `resonance` is not a real method.** |
| `.hpf(Hz)` | ~50–20000 | High-pass cutoff. |
| `.hpq(N)` | 0–30+ | High-pass Q. |
| `.bpf(Hz)` | ~50–20000 | Band-pass center. |
| `.bpq(N)` | — | Band-pass Q. |
| `.vowel("a e i o u")` | — | Formant filter — instant "vowel synth". |

```js
s("bd sd [~ bd] sd,hh*8").lpf(2000).lpq("<0 10 20 30>")
note("[c2 <eb2 <g2 g1>>]*2").s('sawtooth').vowel("<a e i <o u>>")
```

## Envelope (ADSR)

| Method | What it does |
| --- | --- |
| `.attack(s)` | Attack time in seconds. `0` = instant. |
| `.decay(s)` | Decay time. |
| `.sustain(0..1)` | Sustain level. |
| `.release(s)` | Release time after note-off. |

```js
note("c3 e3 g3 c4").attack(0.05).release(0.4)
```

## Spatial — reverb / delay

| Method | Range | Notes |
| --- | --- | --- |
| `.room(0..1)` | dry-wet | Reverb amount. Mini-notation also accepts `"0.5:size"` to set size. |
| `.roomsize(0..1)` | — | Reverb size. |
| `.roomdim(0..1)` | — | Reverb damping (high-frequency loss). |
| `.delay(0..1)` | dry-wet | Delay send amount. |
| `.delaytime(s)` | — | Delay time in seconds. |
| `.delayfeedback(0..0.99)` | — | Delay feedback. **Cap at 0.95 to avoid runaway.** |

```js
note("<c3 eb3 g3 bb3>").s("gm_pad_warm").room(0.9).delay(0.3).delaytime(0.375).delayfeedback(0.5)
```

## Distortion / shaping

| Method | What it does |
| --- | --- |
| `.crush(N)` | Bit-crusher; `N` = bits (e.g. `8`, `4`). Lower = grittier. |
| `.coarse(N)` | Sample-rate reduction. |
| `.distort(N)` | Wave-shaping distortion (preferred over `shape`). |
| `.distorttype("...")` | Distortion algorithm name (community-defined; `not confirmed by provided docs` for advanced types). |
| `.shape(0..1)` | **Deprecated** — wave shaping. Can get suddenly loud. Use `distort` instead. |

```js
s("<bd sd>,hh*3").fast(2).crush("<16 8 7 6 5 4 3 2>")
```

## Modulation effects

| Method | What it does |
| --- | --- |
| `.phaser(rate)` | Phaser pedal. Pair with `.phaserdepth`, `.phasercenter`, `.phasersweep`. |
| `.tremolo(rate)` | Amplitude tremolo. Pair with `.tremolodepth`, `.tremoloshape`, etc. |
| `.chorus(N)` | Stereo chorus. |
| `.leslie(rate)` | Rotary speaker simulation. |

```js
n(run(8)).scale("D:pentatonic").s("sawtooth").release(0.5).phaser("<1 2 4 8>")
```

## Gain / dynamics

| Method | Range | Notes |
| --- | --- | --- |
| `.gain(0..1)` | exponential | Per-event volume. Use 0.4–0.8 for normal, 1.0 for accents. |
| `.pan(0..1)` | 0=left, 1=right | `.pan(0.5)` is centre. |
| `.speed(N)` | — | Sample playback speed (cheap pitch). Negative reverses. |
| `.compressor(...)` | — | Compressor. |

```js
s("[bd hh]*2").pan("<.5 1 .5 0>")
s("bd*6").speed("1 2 4 1 -2 -4")
s("hh*8").gain(".4!2 1 .4!2 1 .4 1").fast(2)
```

## Side-chain ducking

`.duckattack`, `.duckdepth`, `.duckonset`, `.duckorbit` — set up so a kick can
duck a pad. All four exist in `doc.json`. Typical recipe:

```js
stack(
  s("bd*4").bank("RolandTR909"),
  note("<c3 eb3 g3 bb3>").s("gm_pad_warm").room(0.6).duckdepth(0.6).duckattack(0.05)
)
```

## Wavetable synthesis (verified, advanced)

`.wt(name)`, `.wtenv(...)`, `.wtshape(...)`, `.wtsync(...)`, etc. exist in
core. Use only if the user explicitly asked for wavetable synthesis; otherwise
sawtooth + filter is more predictable.

## FM synthesis (verified)

| Method | Notes |
| --- | --- |
| `.fmh(N)` | FM harmonic ratio. |
| `.fmi(N)` | FM index (depth of modulation). |
| `.fmenv(...)` | FM envelope. |
| `.fmattack`, `.fmdecay`, `.fmsustain`, `.fmrelease` | FM ADSR. |

```js
note("c3 e3 g3 c4").s("sine").fmh(2).fmi("<0 4 8 12>").release(0.4)
```

## Anti-patterns

- `.resonance(N)` — not a real method. Use `.lpq(N)` (or `.hpq`).
- `.shape(...)` is deprecated — prefer `.distort(...)` for new code.
- Long delay feedback ≥ 0.99 — will runaway and clip.
- Heavy `crush(2)` + `distort` + max `gain` — instant ear damage. Cap at 0.7 gain.
