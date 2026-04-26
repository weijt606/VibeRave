# Reference: modulation (continuous values, LFOs)

In Strudel, almost any numeric parameter can take a **pattern of numbers** or a
**continuous waveform** instead of a constant. That's how filter sweeps, LFOs,
and evolving textures get built.

## The four built-in waves

These are signal generators, used as values (not in `s(...)`):

| Name | Output range | Meaning |
| --- | --- | --- |
| `sine` | -1..1 | Bipolar sine. |
| `cosine` | -1..1 | Bipolar cosine. |
| `saw` | 0..1 | Unipolar sawtooth (rising). |
| `tri` | 0..1 | Unipolar triangle. |
| `square` | 0..1 | Unipolar square. |
| `perlin` | 0..1 | Smooth noise (band-limited). |
| `rand` | 0..1 | Random per cycle. |
| `irand(N)` | int 0..N-1 | Integer random. |

> ⚠️ Note: `sine` / `tri` / `saw` / `square` here are the **signal** versions
> (continuous values). The same names also appear inside `s(...)` strings as
> oscillator sound names — Strudel disambiguates by context.

## Mapping to a useful range — `.range(min, max)`

The raw signals are `[-1..1]` or `[0..1]`. Use `.range(min, max)` to map:

```js
sine.range(200, 2000).slow(4)        // sine LFO from 200 to 2000 over 4 cycles
saw.range(0.5, 1).slow(8)            // ramp from 0.5 to 1 every 8 cycles
perlin.range(400, 4000).slow(2)      // smooth noisy filter sweep
```

`.rangex(min, max)` is the same but **exponential** mapping — preferred for
frequencies, since human pitch perception is logarithmic.

```js
.lpf(sine.rangex(200, 8000).slow(4))   // smoother audio sweep than .range
```

## Wiring a signal into an effect

Anywhere a number is accepted, a signal works:

```js
// Filter sweep
note("c2*8").s("sawtooth").lpf(sine.range(400, 1800).slow(4)).lpq(15)

// Tremolo via gain
s("hh*16").gain(sine.range(0.2, 1).fast(2))

// Pan auto
s("bd*4").pan(sine.range(0, 1).slow(2))

// Reverb amount swelling in
note("c4 e4 g4").s("piano").room(saw.range(0, 0.8).slow(8))
```

## Slowing / speeding modulators

`.slow(N)` and `.fast(N)` apply to signals exactly like patterns:

```js
sine.slow(4)         // 1 cycle of sine = 4 cycles
sine.fast(2)         // sine cycles twice as fast
```

## Stacked LFOs (cross-modulation)

```js
// Filter sweep where the LFO speed itself is modulated
.lpf(sine.range(400, 4000).slow(saw.range(2, 8).slow(8)))
```

This is correct Strudel — you can pass a *pattern* to `.slow`.

## Choosing modulation per cycle

Combine signals with `<...>` to switch shape per cycle:

```js
.lpf("<400 800 1600 3200>")                    // step-LFO via mini-notation
.lpf(pick([sine, perlin, saw], "<0 1 2 1>"))   // alternating waveforms
```

## Anti-patterns

- `sine.range(0, 1).slow(0)` — division by zero. Always pass a positive number.
- Using `sine` directly without `.range` for filter cutoff: `[-1..1]` Hz is
  meaningless; `.lpf(sine)` will misbehave.
- Putting `sine` inside an `s("...")` mini-notation string when you meant the
  signal — instead pass it as the method argument.
