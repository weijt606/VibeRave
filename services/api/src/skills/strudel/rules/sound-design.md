# Rule: sound design (avoid the "MIDI / 8-bit" feel)

`rules/lushness.md` already enforces atmospheric layers (reverb / delay
/ side-chain). This rule covers the OTHER reasons Strudel output ends
up sounding chiptune even when the user asked for a modern electronic
genre: bare oscillators, GM soundfont thinness, and aggressive `.crush()`.

## Hard rule: never use `.crush(N)` with N < 12 unless the user said "8-bit", "lo-fi", "chiptune", or "destroy"

Bit-depth crush effect quick reference:
- `.crush(8)` — **8-bit / NES territory**. Brutal aliasing. ONLY for chiptune.
- `.crush(10)` — heavy lo-fi. ONLY for lo-fi by request.
- `.crush(12)` — gentle dither, "tape warmth" feel. **Default for warmth.**
- `.crush(14-16)` — barely audible, mostly transparent.
- No `.crush()` at all — clean digital. **Default for modern electronic.**

If the user said "warm" / "vintage" without specifying lo-fi, use
`.crush(12-14)` or `.shape(0.2-0.4)` (soft saturation), NOT `.crush(8)`.
Hard `.crush()` instantly makes the output sound 8-bit even if every
other layer is lush.

## Lead / bass / pad: stack detuned oscillators (supersaw)

A single bare `sawtooth` is the #1 cause of "thin, digital, 8-bit"
output. Real electronic-music supersaw / pad / lead sounds are made
from **multiple oscillators slightly detuned**, summed together. In
Strudel, get this with `.layer()` or `.add(...)` patterns:

```js
// Single saw (thin, chiptune-y)         ❌
note("c2").s("sawtooth").lpf(800)

// Detuned 3-osc supersaw (rich, lush)   ✅
note("c2").s("sawtooth").layer(
  x => x,
  x => x.add(0.1),     // +10 cents
  x => x.add(-0.1),    // -10 cents
).lpf(800).gain(0.5)

// 5-osc supersaw via fan-out pattern    ✅✅
stack(
  note("c2").s("sawtooth"),
  note("c2").s("sawtooth").add(0.07),
  note("c2").s("sawtooth").add(-0.07),
  note("c2").s("sawtooth").add(0.13),
  note("c2").s("sawtooth").add(-0.13),
).lpf(800).gain(0.18)  // each layer at low gain so stack doesn't clip
```

For chord pads, even a 2-osc detuned stack (`x` and `x.add(0.07)`) is
enormously more lush than single oscillator.

When using FM (`.fmh(N).fmi(M)`), stacking less critical — FM already
has spectral richness. But supersaw is the staple for techno / trance
/ house leads, not FM.

## GM soundfont caveats

The `gm_*` samples are General MIDI soundfont — small, dated (~22kHz
mono in many cases). They CAN sound modern when:
- Layered with reverb + delay (per `rules/lushness.md`)
- Combined with a synth layer (e.g. chord on `gm_epiano2` + same chord on detuned `sawtooth` panned ±0.3)
- Filtered with `.lpf(sine.range(...))` for movement

They sound CHIPTUNE-y when used **bare**:
- Bare `gm_synth_strings_1` chord with no fx → sounds 90s-MIDI
- Bare `gm_pad_warm` → muffled and dated

Recommended pairings (combine a GM voice with a synth layer):

| GM voice (warm character) | Pair with synth for body | Use for |
|---|---|---|
| `gm_epiano2` | `gm_synth_strings_1` low-gain | lo-fi / jazz chord |
| `gm_pad_warm` | detuned `sawtooth` pad | ambient / dub chord |
| `gm_choir_aahs` | `triangle` 5th higher | atmospheric vocal pad |
| `gm_synth_strings_1` | `sawtooth` doubled an octave down | house / trance stab |
| `gm_celesta` | `triangle` octave above | sparkly lo-fi top |

## Stereo width is part of "fullness"

Mono = chiptune. Stereo = electronic.
- `.jux(rev)` — flip the right channel through `rev` (free stereo).
- `.off(0.125, x => x.add(7))` — offset a fifth on the right side.
- `.pan(sine.range(0.3, 0.7).slow(8))` — slow LFO pan modulation.
- `.pan("<0.2 0.8>")` — left/right ping-pong.

Use at least one stereo trick on the lead / chord / pad layer.

## Anti-patterns (these reliably produce 8-bit output)

- ❌ `note("...").s("sawtooth").gain(0.6)` — bare saw, no detune, no fx → thin
- ❌ `.crush(8)` for a "warmer" sound — that's 8-bit destruction, not warmth
- ❌ `.s("gm_synth_strings_1").gain(0.4)` only — bare GM strings sound like 90s MIDI without help
- ❌ Mono everywhere — no `jux` / `pan` / `off` movement
- ❌ Hard attack on every layer (`attack: 0.005`) — needs at least one slow-attack pad
