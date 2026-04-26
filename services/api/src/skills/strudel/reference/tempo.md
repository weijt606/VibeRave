# Reference: tempo

Strudel measures time in **cycles per second (CPS)**, not BPM. There is one
canonical way to set tempo:

```js
setcps(N)
```

Where `N` is in cycles per second.

> `setcps` is exposed by the REPL runtime in `packages/core/repl.mjs` (alias of
> `setCps`). It is **safe to use** even though `doc.json` doesn't include it —
> the alternative `setcpm(N)` (cycles per minute) IS in `doc.json`.

## Converting BPM → cps

The convention: a "cycle" is typically one bar, and a bar typically has 4
beats. So:

```
cps = bpm / 60 / beats_per_bar
```

Common values:

| Tempo | Time signature | `setcps(...)` |
| --- | --- | --- |
| 80 BPM | 4/4 | `setcps(80/60/4)` ≈ 0.333 |
| 120 BPM | 4/4 | `setcps(120/60/4)` = 0.5 |
| 124 BPM | 4/4 (house) | `setcps(124/60/4)` ≈ 0.517 |
| 140 BPM | 4/4 (techno) | `setcps(140/60/4)` ≈ 0.583 |
| 174 BPM | 4/4 (DnB) | `setcps(174/60/4)` = 0.725 |
| 90 BPM | 3/4 (waltz feel) | `setcps(90/60/3)` = 0.5 |

Always write the BPM-style fraction (`120/60/4`), not the precomputed decimal.
It makes the tempo intent obvious in the code.

## Without `setcps`

If the user hasn't specified a tempo, **don't add `setcps` at all**. The
default cycle length (~1.6 s) is fine for most experimentation, and the user
can change it later via the REPL UI or by editing.

## Per-pattern speed: `.cpm(N)` / `.fast(N)` / `.slow(N)`

These are alternatives that change the *perceived* tempo of a sub-pattern
without affecting the global cycle:

```js
stack(
  s("bd*4").bank("RolandTR909"),                   // global cps drives the beat
  note("c4 e4 g4 c5").s("piano").slow(2)           // melody at half speed
)
```

## Anti-patterns

- `setBpm(120)` — there is no `setBpm`. Use `setcps(120/60/4)`.
- `setcps(120)` — that's 120 cycles/second, deafening. Did you mean `setcps(120/60/4)`?
- Mixing `setcps` and `setcpm` in the same program — pick one.
