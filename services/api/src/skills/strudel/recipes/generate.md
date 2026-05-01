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

4. **Liveliness pass** — before shipping, verify the pattern would not
   sound identical for 4 cycles in a row (`rules/variation.md`):
   - At least one non-drum layer must have a cycle-level variation device
     (`.every(N, fn)`, `.sometimes(fn)`, `.degradeBy(N)`, `.chunk(N, fn)`,
     `.palindrome()`, or mini-notation alternation `<a b c>` covering ≥ 3 values).
   - The bass must have melodic motion (alternation, scalar walk, octave
     jump, or `.arp(...)`) — not the same single pitch repeating.
   - The chord/pad layer must alternate ≥ 2 distinct chords across the loop.
   - If the `stack(...)` has ≤ 3 layers and the genre isn't drone /
     ambient / "just a bassline", add a 4th low-gain atmospheric layer
     (ghost pad / counter-melody arp / sparkle).

5. **Sanity-check** before responding (full list lives in
   `rules/output-format.md`):
   - Every `s("...")` references a sound in `reference/sounds.md`.
   - Every method exists per `reference/pattern-transforms.md` /
     `reference/effects.md` (no `resonance`, no `legato`).
   - Mini-notation strings have balanced brackets / quotes.
   - The whole thing is one expression.
   - **No `.scope()` / `.pianoroll()` / `.fscope()` / `.tscope()`** —
     the host renders the per-track viz on its own canvas.

6. **Check host signals**: if the prompt includes `loop_count`, `time_limit`,
   or `continue_style`, defer to `rules/host-controls.md` for behaviour. Do
   NOT bake those values into the code.

7. **Output** following `rules/output-format.md` — code only.

## Slot-to-code mapping cheatsheet

**Pick the row that matches the user's stated genre. Do NOT default to
techno when the user said something else.** Order below is alphabetical,
no genre is "preferred." Every row points at a verified template in
`examples/genres.md`.

| User said | Plug into |
| --- | --- |
| "8-bit / chiptune" | square / triangle + `.crush(8)` |
| "acid" | sawtooth + `.lpf(sine.range(200,2000))` + `.lpq(20)` |
| "ambient" | gm_pad_warm + long attack/release + `room(0.9)` + `slow(4..8)` |
| "Berghain techno" | dedicated template — 130-138 BPM, dub-techno space, delay-drowned clap |
| "DnB" / "drum and bass" | breakbeat (`s("bd ~ ~ sd, hh*8?")` + `setcps(174/60/4)`) |
| "drone / dark ambient" | sustained sub + slow filter sweeps + huge reverb tail |
| "dub" | heavy `.delay()` / `.delaytime(.375)` / `.delayfeedback(.6)` + sparse drums + sub bass |
| "funky / disco" | `gm_clavinet` / `gm_synth_strings_1` + 4-on-floor + chord stab + `.swing(4)` |
| "house" | RolandTR909 + 4-on-floor + acid bass with `lpf(sine.range(...))` + chord stab |
| "hyperpop / chiptune (fast bright)" | square + saw layered, fast `setcps`, vocoder vowel filter, breakbeats |
| "IDM" | mutating breakbeats + `.degradeBy(0.2)` + `.struct(...)` + `.chunk(N, fn)` |
| "jazz / chill" | gm_epiano2 + `.scale("...:minor7")` + `.swing(4)` + chord(...).voicing() |
| "lo-fi" | LinnDrum bank + slow + side-chain pad + small reverb |
| "minimal techno" | sparse `bd ~ ~ ~ bd ~ ~ ~`, mostly kick + ticks |
| "techno" | RolandTR909 + `bd*4, [~ cp]*2, hh*8` + acid line + crush/distort |
| "trap" | 808 sub + half-time `bd`, hi-hat rolls (`hh*16` with degrade), 140 BPM |
| **chord names** ("Cm7", "Am to F", "ii-V-I in C") | `chord("<Cm7 ...>").voicing().anchor("c4")` — see `reference/tonal.md` and the "Jazz progression" template |
| **mode names** ("dorian", "phrygian", "lydian feel") | `.mode("dorian")` instead of `.scale("X:minor")` |
| **"darker / brooding"** | minor scale, low lpf, more reverb, slower setcps |
| **"more energy"** | `.fast(2)`, add `hh*16` layer, raise lpf |
| **"harder bass" / "metallic" / "industrial"** | `.s("sine").fmh(2).fmi("<0 4 8 12>")` — FM synth |
| **"vocal-y" / "wow filter"** | `.vowel("<a e i o>")` on the lead/synth layer |

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
  s("bd ~ ~ ~, ~ ~ sd ~, hh*8").bank("LinnDrum").gain("0.7 0.6 0.7 0.6")
    .sometimes(x => x.fast(2)),
  n("0 2 4 5".add("<0 7 5 -2>")).scale("C2:minor").s("gm_acoustic_bass").gain(0.7)
    .every(4, x => x.add(12)),
  note("<[c3,eb3,g3,bb3] [f2,ab2,c3,eb3] [g2,bb2,d3,f3] [c3,eb3,g3,bb3]>")
    .s("gm_epiano2").attack(0.05).release(0.6).room(0.4).gain(0.5)
    .arp("<0 1 2 1 2 3>"),
  note("<c5 eb5 g4 bb4>").s("gm_celesta").attack(0.2).release(0.6)
    .gain(0.22).room(0.7).sometimes(rev)
).slow(2)
```

Note the **liveliness pass**: `.sometimes(fast(2))` on drums adds an
occasional fill, `.every(4, x => x.add(12))` on bass jumps an octave
every 4 cycles, `.arp(...)` walks the chord voicings within each chord,
and a 4th `gm_celesta` sparkle layer keeps the high-end alive without
crowding the mix. No trailing `.scope()` — the host owns visualization.

## Anti-patterns

- Returning multiple separate expressions on different lines — wrap in `stack`.
- Adding `setcps` when no tempo was mentioned.
- Adding visualizers when not asked.
- "Defending" choices in prose — output is code only (`rules/output-format.md`).
