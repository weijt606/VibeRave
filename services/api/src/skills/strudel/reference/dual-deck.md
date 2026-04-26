# Reference: dual-deck (left / right channel split)

Strudel can be played as if it were a two-deck DJ controller — one pattern
panned hard left, another hard right, with a crossfader-style gain LFO
swapping focus between them. Use this when the user asks for things like
"left house, right techno", "DJ mode", "stereo split", or "alternate decks".

## The core trick: pan + gain modulation

`.pan(0)` = full left, `.pan(1)` = full right. Stack two patterns, hard-pan
each, and modulate gain on each in opposite phase.

| Building block | Effect |
| --- | --- |
| `.pan(0)` | Hard left. |
| `.pan(1)` | Hard right. |
| `sine.range(0, 1).slow(N)` | Smooth gain wave from 0 to 1 to 0 over N cycles. |
| `cosine.range(0, 1).slow(N)` | Same shape, **90° offset** — peaks when sine is at 0. |

Pairing `sine` on one deck with `cosine` on the other gives a proper
crossfader: when one deck is at full volume, the other is silent.

## Recipe 1: hard split, no crossfader

Both decks always audible, just panned to opposite sides:

```js
stack(
  s("bd*4, [~ cp]*2, hh*8").bank("RolandTR909").pan(0),
  s("bd ~ ~ bd, ~ ~ sd ~, hh*8?").bank("LinnDrum").pan(1)
).scope()
```

Plays a 909 techno groove on the left ear, a LinnDrum lo-fi groove on the
right. Useful for A/B comparison or stereo width.

## Recipe 2: regular crossfader (left ↔ right alternates)

Volume sloshes between decks every N cycles:

```js
stack(
  s("bd*4, [~ cp]*2, hh*8").bank("RolandTR909").pan(0).gain(sine.range(0, 1).slow(8)),
  s("bd ~ ~ sd, hh*8?").bank("LinnDrum").pan(1).gain(cosine.range(0, 1).slow(8))
).scope()
```

`sine` on left + `cosine` on right with the **same `.slow(8)`** keeps them
locked 90° apart, so the perceived total volume stays roughly constant.

For a DJ-style longer transition use `.slow(16)` or `.slow(32)`.

## Recipe 3: left-house, right-techno (genre fusion)

```js
setcps(124/60/4)
stack(
  // Left deck — house
  stack(
    s("bd*4, ~ cp, hh*8").bank("RolandTR909"),
    note("<[c3,eb3,g3] [bb2,d3,f3]>").s("gm_synth_strings_1").attack(0.05).release(0.3).gain(0.5)
  ).pan(0).gain(sine.range(0.2, 1).slow(16)),
  // Right deck — techno
  stack(
    s("bd*4, ~ ~ cp ~, hh*16").bank("RolandTR909").gain("1 .8 1 .8"),
    note("c2!4 c2 eb2 c2 g1").s("sawtooth").lpf(sine.range(300, 3000).slow(8)).lpq(20).gain(0.65)
  ).pan(1).gain(cosine.range(0.2, 1).slow(16))
).scope()
```

`gain(...).range(0.2, 1)` (instead of 0..1) keeps each deck barely audible
even at its lowest — DJ-style "pre-fading" rather than full mute.

## Recipe 4: hard switch (binary chop, no fade)

For a more abrupt "channel switch" use a square LFO instead of sine:

```js
stack(
  patA.pan(0).gain(square.range(0, 1).slow(4)),
  patB.pan(1).gain(square.range(1, 0).slow(4))
).scope()
```

Each deck is on for 2 cycles, off for 2 cycles. Useful for radio-tuner /
glitch effects.

## Recipe 5: cue / preview pattern (deck B preview at low gain)

Mimic having one deck "cued" — barely audible while the other plays full:

```js
stack(
  patA.pan(0).gain(1),
  patB.pan(1).gain(0.15)
).scope()
```

Then switch by running it again with the gains inverted.

## Anti-patterns

- **Stereo without panning**: `stack(patA, patB).gain(sine.range(0,1))` only
  modulates total volume, not L/R focus. Always pan first.
- **Both decks at `.pan(0)`**: defeats the purpose. Use exactly `0` and `1`,
  not `0.3` and `0.7` (those leak across).
- **Same LFO phase on both decks**: both rise and fall together, so silence
  appears in the middle. Use `sine` + `cosine`, OR `sine.range(0,1)` +
  `sine.range(1,0)` (Strudel's `.range` accepts inverted bounds).
- **Different `slow` numbers for each deck's crossfade LFO**: drifts out of
  phase over time. Lock both to the same number unless that drift is the
  intent (e.g. very long ambient sets).

## Hooking a real DJ controller

If the user has a hardware controller and asks how to wire it up — that's
out of scope for this file. Strudel has MIDI input via `packages/midi/`; mark
the question as **`not confirmed by provided docs`** in this skill and direct
the user to `packages/midi/README.md`.