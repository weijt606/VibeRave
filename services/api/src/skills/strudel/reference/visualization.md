# Reference: visualization

Strudel can render the pattern visually in the REPL. All of these are chained
methods on a pattern — they don't change what's heard, only what's drawn.

## Verified-working visualizers

Every name below was confirmed against `doc.json`.

| Method | What it draws |
| --- | --- |
| `.pianoroll()` | Scrolling piano-roll of pitched events behind the editor. |
| `.scope()` | Time-domain oscilloscope of the audio signal. |
| `.fscope()` | Frequency-domain oscilloscope. |
| `.spectrum()` | Spectrum analyzer (FFT). |
| `.spiral()` | Spiral visual — events traced around a logarithmic spiral. |
| `.pitchwheel()` | Renders a pitch circle to visualize frequencies within one octave. |
| `.drawLine()` | Renders the pattern as ASCII (debug helper). |
| `.markcss('...')` | Override CSS on highlighted events. Use **single quotes** for the CSS string. |

## Suggested usage

Visualizers attach to the **last** method in a chain — typically the outer
expression — so the whole stack gets visualised:

```js
stack(
  s("bd*4, ~ cp, hh*8").bank("RolandTR909"),
  note("<c2 g1 a1 e1>").s("sawtooth").lpf(800)
).pianoroll()
```

You can stack visualizers — `.scope().spectrum()` shows both at once.

## When to add a visualizer

- The user explicitly asked ("show me the piano roll", "I want a scope").
- The user is debugging a melody — a `.pianoroll()` instantly reveals wrong
  notes.
- The user is doing a live performance / demo and wants visual feedback —
  `.spiral()` or `.spectrum()` look good on stage.

If the user didn't ask, **don't add visualizers**. They cost CPU and clutter
the REPL.

## Names you might be tempted to use but should avoid

- `punchcard()` — referenced in older Strudel community examples but **not
  found in current `doc.json`**. Mark as `not confirmed by provided docs`. If
  the user asks for "punchcard", offer `pianoroll` as a verified alternative.
- `viz()`, `display()`, `render()` — none of these are Strudel functions.

## CSS hook for highlighted events

```js
note("c a f e").markcss('text-decoration:underline; color:#f0f')
```

Single-quote the CSS so the surrounding string can stay double-quoted.
