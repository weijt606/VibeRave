# Reference: pattern transforms

These are chained methods on a `Pattern`. All examples are verified against
`doc.json`.

## Combinators (build composite patterns)

| Function | Behaviour | Example |
| --- | --- | --- |
| `stack(a, b, c)` | Play simultaneously, same length. | `stack(s("bd*4"), s("hh*8"))` |
| `cat(a, b, c)` | Concat — each takes one full cycle. | `cat(s("bd*4"), s("cp*2"))` |
| `seq(a, b, c)` | Like `cat` but crams everything into one cycle. | `seq("c", "d", "e").note()` |
| `sequence(a, b)` | Alias of `seq`. | — |
| `slowcat(a, b)` | Like `cat` but each takes one cycle in turn (good for evolving sections). | — |
| `timecat([n, x], [m, y])` | Like `cat` but with weighted durations. | — |
| `arrange([n, x], [m, y])` | Schedule patterns over multiple cycles. | — |
| `superimpose(fn)` | Layer `fn(self)` on top of `self`. | `note("c3 e3 g3").superimpose(x=>x.add(7))` |
| `layer(fn1, fn2)` | Like `superimpose`, but without the original. | — |

## Time

| Method | Behaviour | Example |
| --- | --- | --- |
| `.slow(N)` | Stretch over N cycles. | `note("c d e f").slow(4)` |
| `.fast(N)` | Cram N copies into one cycle. | `s("bd").fast(4)` |
| `.late(N)` | Delay events by N cycles. | `s("bd*4").late(0.125)` |
| `.early(N)` | Pull events earlier. | — |
| `.iter(N)` | Rotate — start each cycle one Nth later. | `n("0 1 2 3").scale("A:minor").iter(4)` |
| `.swing(N)` | Shorthand for `swingBy(1/3, N)` — adds 1/3 swing every N steps. | `s("hh*8").swing(4)` |
| `.press` / `.press()` | Syncopate by shifting each event halfway into its slot. | `stack(s("hh*4"), s("bd mt sd ht").every(4, press))` |

## Conditional / probabilistic

| Method | Behaviour | Example |
| --- | --- | --- |
| `.every(N, fn)` | Apply `fn` to every Nth cycle. | `note("c3 d3 e3 g3").every(4, x=>x.rev())` |
| `.firstOf(N, fn)` | Alias of `.every`. | — |
| `.lastOf(N, fn)` | Apply on the *last* cycle out of N. | — |
| `.sometimes(fn)` | 50% chance per cycle. | `s("hh*8").sometimes(x=>x.speed(0.5))` |
| `.often(fn)` | 75% chance. | — |
| `.rarely(fn)` | 25% chance. | `s("hh*8").rarely(x=>x.speed(0.5))` |
| `.almostAlways(fn)` | 90% chance. | — |
| `.almostNever(fn)` | 10% chance. | — |
| `.sometimesBy(p, fn)` | Custom probability `p` (0..1). | — |
| `.degrade()` | Drop ~50% of events. | `s("hh*8").degrade()` |
| `.degradeBy(p)` | Drop events with probability `p`. | `s("hh*8").degradeBy(0.2)` |
| `.mask(pat)` | Pattern of 0/1 (or `~`) — mute when 0. | `note("c d e g").mask("<1 [0 1]>")` |
| `.struct(pat)` | Apply rhythmic structure: `x` = trigger, `~` = rest. | `note("c,eb,g").struct("x ~ x ~ ~ x ~ x ~ ~ ~ x ~ x ~ ~")` |

## Pitch / harmony

| Method | Behaviour | Example |
| --- | --- | --- |
| `.add(n)` | Add to numeric values. | `n("0 2 4".add("<0 3>"))` |
| `.sub(n)` | Subtract. | `n("0 2 4").sub("<0 1 2 3>").scale("C4:minor")` |
| `.scale("C:minor")` | Quantize / project numbers onto a scale. | `n("0 2 4 6 4 2").scale("C:major")` |
| `.transpose(n)` | Shift in semitones (or scale steps when used with `.scale`). | `note("c2 c3").fast(2).transpose("<0 -2 5 3>".slow(2))` |
| `.rev()` | Reverse each cycle. | `note("c d e g").rev()` |
| `.palindrome()` | Forward, then backward, then forward... | `note("c d e g").palindrome()` |
| `.arp("0 1 2")` | Pick indices from chords inside the pattern. | `note("<[c,eb,g]!2 [c,f,ab] [d,f,ab]>").arp("0 [0,2] 1 [0,2]")` |

## Structural

| Method | Behaviour | Example |
| --- | --- | --- |
| `.ply(n)` | Repeat each event `n` times within its slot. | `s("bd ~ sd cp").ply("<1 2 3>")` |
| `.chunk(N, fn)` | Split into N parts, apply `fn` to one chunk per cycle. | `"0 1 2 3".chunk(4, x=>x.add(7)).scale("A:minor")` |
| `.jux(fn)` | Apply `fn` only to the right channel — instant stereo width. | `s("bd lt [~ ht] mt cp ~ bd hh").jux(rev)` |
| `.off(t, fn)` | Superimpose `fn(self)` delayed by `t` cycles. | `note("c3 eb3 g3").off(1/8, x=>x.add(7))` |
| `.euclid(P, S)` | Euclidean rhythm: P pulses spread over S steps. | `note("c3").euclid(3, 8)` (Cuban tresillo) |
| `.euclidRot(P, S, R)` | Euclidean with rotation `R`. | `note("c3").euclidRot(3, 16, 14)` |

## Random selection (functions, not methods)

| Function | Behaviour | Example |
| --- | --- | --- |
| `choose(a, b, c)` | Random pick (uniform). | `note("c2 g2!2 d2 f1").s(choose("sine", "triangle", "bd:6"))` |
| `wchoose([a, w], [b, w])` | Weighted random pick. | `note("c2 d2").s(wchoose(["sine",10], ["triangle",1]))` |
| `pick(table, idx)` | Index into a list — also works as a chainable `.pick`. | `note("<0 1 2!2 3>".pick(["g a", "e f", "f g f g", "g c d"]))` |
| `rand` | Continuous random (0..1). | `s("hh*8").gain(rand)` |
| `irand(N)` | Integer 0..N-1, randomized per cycle. | `n(irand(8)).scale("C:minor")` |

## Building a melody from numbers

The idiomatic Strudel melody uses `n(...)` (numeric) → `.scale(...)`:

```js
n("0 2 4 7 4 2".add("<0 3>")).scale("C4:minor").s("triangle")
```

`.scale(...)` already produces playable notes — do **not** chain `.note()` after it (that double-wraps the note value into an object and the audio engine throws `unexpected "note" type "object"`). Use `.note(...)` only to set notes directly from a string, e.g. `note("c d e f").s("piano")`.

This style is more flexible than typing notes directly because it lets you transpose,
permute, and scale-shift with `.add`, `.transpose`, `.scale`.

## Common chains

```js
// Drumkit + filter sweep
s("bd*4, [~ cp]*2, hh*8").bank("RolandTR909")

// Bass with cycling LPF
note("c2*8".add("<0 7 5 3>")).s("sawtooth").lpf(sine.range(400,1800).slow(4)).lpq(15)

// Chord progression with reverb
note("<[c3,eb3,g3] [bb2,d3,f3] [ab2,c3,eb3] [g2,b2,d3]>").s("gm_synth_strings_1").attack(0.05).release(0.4).room(0.5)

// Arpeggio with humanisation
note("<[c,eb,g]!2 [c,f,ab]>").arp("0 1 2 1").s("gm_epiano2").sometimes(x=>x.add(12)).room(0.4)
```
