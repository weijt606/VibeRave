# Examples: techniques

Idiomatic Strudel patterns showing specific compositional / production
techniques. Pull these out when the user asks for the technique by name.

> **Note: these are fragments, not whole programs.** Each snippet illustrates
> one technique in isolation. When you ship code to the REPL, wrap the
> technique into a complete `stack(...)` and append a visualizer (`.scope()`
> by default) per `rules/output-format.md`. Snippets in `examples/genres.md`
> and `reference/dual-deck.md` are already shaped as ship-ready programs.

## Polyrhythm — `{a, b}`

3 against 4:

```js
stack(
  s("bd cp ~").bank("RolandTR909"),     // 3
  s("hh*4").bank("RolandTR909")          // 4
)
```

Forced polymeter with `%`:

```js
"{bd cp ht, hh*8}%4"   // both interpreted with 4 steps per cycle
```

## Call-and-response

Two phrases that alternate:

```js
note("<[c4 e4 g4 c5] [bb4 g4 e4 c4]>")
  .s("piano").every(2, x=>x.rev())
```

## Arpeggios — `arp`

Cycle through chord voicings:

```js
note("<[c,eb,g]!2 [c,f,ab] [d,f,ab]>")
  .arp("0 [0,2] 1 [0,2]")
  .s("gm_epiano2")
  .room(0.4)
```

`arp` indices index into the comma-stacked notes inside `[ , , ]`.

## Filter sweep with sine LFO

```js
note("c2*8").s("sawtooth")
  .lpf(sine.range(400, 4000).slow(4))
  .lpq(18)
```

For a smoother, ear-friendly sweep, use `rangex`:

```js
.lpf(sine.rangex(200, 8000).slow(4))
```

## Side-chain ducking (kick → pad)

```js
stack(
  s("bd*4").bank("RolandTR909"),
  note("<c3 eb3 g3 bb3>")
    .s("gm_pad_warm")
    .room(0.7)
    .duckdepth(0.7).duckattack(0.05)
)
```

## Stereo width with `jux`

`jux(fn)` applies `fn` only to the right channel:

```js
s("bd lt [~ ht] mt cp ~ bd hh").jux(rev)            // right channel reversed
note("c2*8".add("<0 7 5 3>")).s("sawtooth").jux(x=>x.fast(2))
```

## Euclidean rhythms

```js
s("bd").euclid(3, 8)        // tresillo (Cuban)
s("bd").euclidRot(3, 16, 14) // samba necklace
note("c3 eb3 g3").euclid(5, 8) // 5-over-8 melody pulse
```

## Probabilistic variation

```js
s("hh*16").sometimes(x=>x.speed(0.5))      // 50% chance to drop an octave
s("bd*4").rarely(x=>x.degradeBy(0.5))       // 25% chance to thin out
note("c3").almostAlways(x=>x.add("<0 7>"))  // 90% chance to alternate w/ 5th
```

## Cycle-based mutation

```js
.every(4, x=>x.rev())                  // reverse every 4 cycles
.every(8, x=>x.fast(2))                // double-time every 8
.every(3, x=>x.add(12))                // octave up every 3
```

## Building a melody from scale degrees

```js
n("0 2 4 7 4 2 0".add("<0 3 -2>"))
  .scale("C4:minor")
  .note()
  .s("triangle")
```

This is more flexible than typing notes literally — you can transpose with
`.add`, change the scale, or chunk the line.

## Chord progressions with voice-leading

```js
note("<[c3,eb3,g3] [bb2,d3,f3] [ab2,c3,eb3] [g2,b2,d3]>")
  .s("gm_synth_strings_1")
  .attack(0.05).release(0.5).room(0.5)
```

Each `[...]` is a chord; the `<...>` cycles them per cycle. Voicings here are
already arranged for smooth movement (each chord shares 1–2 notes with the
next).

## Layered tempo (groove on top of drone)

```js
stack(
  note("c2 g2").s("sawtooth").lpf(400).gain(0.4).slow(8),    // very slow drone
  s("bd*4, [~ cp]*2, hh*8").bank("RolandTR909")               // groove on top
)
```

## Resampling / micro-loops

```js
s("bd").chop(8).rev()                           // reverse-chop
s("breaks165").chop(16).fast(2).bank("AkaiMPC60") // chopped break (sample-dependent)
```

`chop` is in `doc.json`. `breaks165` and similar named breaks are samples — do
NOT invent break names; verify in `reference/sounds.md` or fall back to
combining drum aliases.

## Generative / evolving texture

```js
note(irand(8)).scale("C:dorian").s("gm_celesta")
  .room(0.6).gain(0.4)
  .every(4, x=>x.add(12))
  .late(perlin.range(0,0.05))
```

`.late(perlin.range(0,0.05))` adds a tiny humanizing wobble — events drift up
to 5% of a cycle late at random.

## Dual-deck (left = house, right = techno) with crossfader

Full reference in `reference/dual-deck.md`. Quick template:

```js
setcps(126/60/4)
stack(
  stack(
    s("bd*4, ~ cp, hh*8").bank("RolandTR909"),
    note("<[c3,eb3,g3] [bb2,d3,f3]>").s("gm_synth_strings_1").attack(0.05).release(0.3).gain(0.5)
  ).pan(0).gain(sine.range(0.2, 1).slow(16)),
  stack(
    s("bd*4, ~ ~ cp ~, hh*16").bank("RolandTR909"),
    note("c2!4 c2 eb2 c2 g1").s("sawtooth").lpf(sine.range(300,3000).slow(8)).lpq(20).gain(0.65)
  ).pan(1).gain(cosine.range(0.2, 1).slow(16))
).scope()
```

`sine` on left + `cosine` on right at the same `.slow(16)` keeps a 90°-offset
crossfader: when one deck peaks, the other troughs. `.range(0.2, 1)` keeps the
quieter deck barely audible (DJ pre-fade) instead of muting it.
