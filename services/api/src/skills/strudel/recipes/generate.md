# Recipe: generate

Used when the user describes a musical idea and wants a fresh pattern. Also
the fallback when iterating but the `<current>` block is empty.

## Procedure

1. **Parse intent** into 1–4 of these slots:
   - **Genre / vibe**: lo-fi, house, techno, ambient, acid, dnb, jazz, drone…
   - **Tempo**: explicit BPM if mentioned, else skip `setcps`.
   - **Drums**: kit choice (`.bank(...)`), groove (4-on-floor, breakbeat, syncopated).
   - **Bass**: shape (sub, acid, plucky), pitch (e.g. C minor).
   - **Melody / chords**: instrument + key + rhythm.
   - **FX / texture**: reverb, delay, filter movement, sidechain.

2. **Pick a structural template** from `examples/genres.md` (or `examples/techniques.md`).
   Don't reinvent the structure — these templates are battle-tested.

3. **Fill in the slots** with verified function names (`reference/*`).

4. **Sanity-check** before responding (full list lives in
   `rules/output-format.md`):
   - Every `s("...")` references a sound in `reference/sounds.md`.
   - Every method exists per `reference/pattern-transforms.md` /
     `reference/effects.md` (no `resonance`, no `legato`).
   - Mini-notation strings have balanced brackets / quotes.
   - The whole thing is one expression.
   - **No `.scope()` / `.pianoroll()` / `.fscope()` / `.tscope()`** —
     the host renders the per-track viz on its own canvas.

5. **Check host signals**: if the prompt includes `loop_count`, `time_limit`,
   or `continue_style`, defer to `rules/host-controls.md` for behaviour. Do
   NOT bake those values into the code.

6. **Output** following `rules/output-format.md` — code only.

## Slot-to-code mapping cheatsheet

| User said | Plug into |
| --- | --- |
| "lo-fi" | LinnDrum bank + slow + side-chain pad + small reverb |
| "house" | RolandTR909 + 4-on-floor + acid bass with `lpf(sine.range(...))` + chord stab |
| "techno" | RolandTR909 + `bd*4, [~ cp]*2, hh*8` + acid line + crush/distort |
| "ambient" | gm_pad_warm + long attack/release + room(0.9) + slow(4..8) |
| "acid" | sawtooth + `.lpf(sine.range(200,2000))` + `.lpq(20)` |
| "DnB" | breakbeat (`s("bd ~ ~ sd, hh*8?")` + `setcps(174/60/4)`) |
| "jazz / chill" | gm_epiano2 + `.scale("...:minor7")` + .swing(4) |
| "8-bit / chiptune" | square / triangle + .crush(8) |
| "darker / brooding" | minor scale, lpf low, more reverb, slower |
| "more energy" | fast(2), add hh*16 layer, raise lpf |

## Default safety values

When the user doesn't specify, use these so the output is never silent or
piercing:

- `gain(0.6)` on melodic / bass elements
- `gain(0.5)` on pads
- Drums at default gain (≈1)
- `lpf` between 800–4000 unless explicitly bright/dark
- `lpq` ≤ 20 (above can self-oscillate)
- `delayfeedback` ≤ 0.7
- `room` ≤ 0.8

## Worked example

> User: "give me something jazzy in c minor at 90 bpm with a walking bass"

Slots:
- Genre: jazz / chill
- Tempo: 90 BPM 4/4 → `setcps(90/60/4)`
- Drums: brushes feel — use `LinnDrum` or default with low gain hh
- Bass: walking, `gm_acoustic_bass`, scalar
- Chords: `gm_epiano2`, c minor 7
- FX: small room

Output:

```js
setcps(90/60/4)
stack(
  s("bd ~ ~ ~, ~ ~ sd ~, hh*8").bank("LinnDrum").gain("0.7 0.6 0.7 0.6"),
  n("0 2 4 5".add("<0 7 5 -2>")).scale("C2:minor").s("gm_acoustic_bass").gain(0.7),
  note("<[c3,eb3,g3,bb3] [f2,ab2,c3,eb3] [g2,bb2,d3,f3] [c3,eb3,g3,bb3]>").s("gm_epiano2").attack(0.05).release(0.6).room(0.4).gain(0.5)
).slow(2)
```

No trailing `.scope()` — the host owns visualization.

## Anti-patterns

- Returning multiple separate expressions on different lines — wrap in `stack`.
- Adding `setcps` when no tempo was mentioned.
- Adding visualizers when not asked.
- "Defending" choices in prose — output is code only (`rules/output-format.md`).
