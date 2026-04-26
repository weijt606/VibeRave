# Recipe: explain

Used when the user asks "what does this do?", "how does this work?", "why does
the bass change?".

> Note: explain mode breaks the output-only rule on purpose. The user is asking
> for prose. But the prose **must reference verified function names only** —
> follow `rules/uncertainty.md`.

## Procedure

1. Identify the structural skeleton: is it `stack(...)` of how many layers?
   What is each layer (drums / bass / melody / pad / fx)?

2. For each layer, name:
   - The **sound source** (e.g. "RolandTR909 drums", "sawtooth synth bass").
   - The **rhythmic structure** (e.g. "four-on-the-floor with snare on 2 and 4").
   - The **transformations** (e.g. "every 4 cycles the hats are reversed").

3. If the pattern uses notable idioms — `.scale`, `sine.range`, `every`,
   `chunk`, `arp` — explain *what those do conceptually*, then point to the
   reference.

4. Beginner mode: if the user signals they're new ("new to Strudel", "just
   started", "first time"), use plain language — avoid jargon like
   "polymeter" without a one-line gloss.

## Template

```
This is a [stack of N layers / single line of …] at [tempo if set].

Layer 1 — [drum kit]
  s("...").bank("…")  → [explain the rhythm in plain English]
  Effects: …

Layer 2 — [bass / melody / pad]
  …

Key idiom: [the most interesting transform], which means …

Try changing:
  - … to make it [denser / brighter / weirder].
  - … to swap the kit.
```

## Worked example

Input:
```js
setcps(124/60/4)
stack(
  s("bd*4, [~ cp]*2, hh*8").bank("RolandTR909"),
  note("c2*8".add("<0 7 5 3>")).s("sawtooth").lpf(sine.range(400,1800).slow(4)).lpq(15).gain(0.6)
)
```

Output (explain mode):

```
This is a 124 BPM techno groove with two layers:

Layer 1 — drums (Roland TR-909 kit):
  - bd*4: kick on every beat (four-on-the-floor)
  - [~ cp]*2: clap on beats 2 and 4
  - hh*8: closed hihat on every 8th
  All resolved through .bank("RolandTR909") so the actual samples are 909.

Layer 2 — acid bass:
  - note("c2*8".add("<0 7 5 3>")) plays a C2 eight times per cycle, but the
    .add("<0 7 5 3>") shifts the pitch each cycle (C2 → G2 → F2 → Eb2 → …).
  - .s("sawtooth") is the synth source — pure sawtooth wave, no sample.
  - .lpf(sine.range(400, 1800).slow(4)) is the classic acid filter sweep —
    the cutoff oscillates between 400 Hz and 1800 Hz over 4 cycles.
  - .lpq(15) is a strong filter resonance — the sweep "sings" because of
    this. Higher values (~25) self-oscillate.
  - .gain(0.6) keeps the bass below the drums.

Try changing:
  - "<0 7 5 3>" to "<0 12 7 5>" for a wider acid line.
  - .lpq(15) to .lpq(25) for a screamier sweep — but watch the volume.
  - Add .every(4, x => x.fast(2)) to the bass for a stutter every 4 cycles.
```

## Don't do this

- Don't quote any function name that isn't in `reference/*` without marking it
  per `rules/uncertainty.md`.
- Don't write more than ~20 lines unless the user asked for "deep" /
  "in-depth". One concise paragraph per layer is enough for most questions.
- Don't recommend changes that introduce unverified functions.
