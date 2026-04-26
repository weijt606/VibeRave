# Reference: mini-notation

Mini-notation is the string-based pattern language inside `s(...)`,
`note(...)`, `n(...)`. It compiles to the same `Pattern` you build with code,
but is much terser for rhythms and melodies.

## Atoms

| Token | Meaning |
| --- | --- |
| `bd`, `sd`, `c3`, `60` | A single event (sample alias, note name, MIDI number). |
| `~` | A rest — silence for that step. |
| `_` | Hold the previous event for an extra step. |
| `c?` | 50% chance of playing this step. `c?0.7` for custom probability. |

## Sequencing

A whitespace-separated list inside one set of double quotes is a **sequence**
that fits in one cycle:

```
"c d e f"          → 4 events evenly spaced over one cycle
"bd ~ sd ~"        → kick, rest, snare, rest
```

## Repetition

| Form | Meaning |
| --- | --- |
| `bd*4` | Repeat 4× — speed up to fit. `"bd*4"` plays 4 kicks per cycle. |
| `bd!4` | Repeat 4× without speeding up. Each repeat takes its full step. |
| `bd/4` | Slow down — one bd over 4 cycles. |
| `bd*<2 4>` | Cycle the multiplier per cycle (2× then 4× then back). |

```js
s("bd*4")           // four-on-the-floor
s("[bd*2]!2")       // two pairs of bd
s("hh/2")           // a hh every other cycle
```

## Subdivision & grouping — `[ ]`

Square brackets group events into a sub-cycle. `[a b]` plays `a` and `b` in the
duration that one element would have taken:

```
"bd [sd sd] cp ~"     → 4 steps; step 2 contains two snares
"[bd hh] cp"          → first half is bd+hh sequence, second half is cp
```

## Stacking — `,`

A comma at the top level of a string means "play these in parallel":

```
"c d e f, bd hh sd hh"     → melody and drums in parallel
"[c, e, g]"                → C-major chord (all 3 at once)
```

## Alternation — `< >`

Angle brackets cycle one element per **cycle** (not per step):

```
"<a b c>"          → cycle 0 → a, cycle 1 → b, cycle 2 → c, cycle 3 → a, …
"c <e g> c <f a>"  → a melody whose 2nd and 4th notes alternate per cycle
```

## Polymeter — `{ }` and `{ }%N`

Curly braces play multiple sub-sequences such that the **steps line up**, not
the durations:

```
"{c d e, bd sd}"           → 3 against 2
"{bd sd cp}%4"             → forces the polymeter to line up with 4 steps/cycle
```

## Elongation — `@`

`a@N` makes `a` take N times the duration of the surrounding step:

```
"c@3 d"           → c lasts 3/4 of the cycle, d lasts 1/4
"bd@2 sd cp"      → bd is twice as long as sd or cp
```

## Randomness inside the string

| Token | Meaning |
| --- | --- |
| `bd?` | 50% chance of playing. |
| `bd?0.7` | 70% chance. |
| `[bd, sd]?` | Apply probability to a group. |

For full random choice across alternatives, use the `pick` /  `choose` /
`wchoose` functions (see `reference/pattern-transforms.md`).

## Chords (with `note(...)`)

Inside `note("...")` mini-notation, a comma inside square brackets stacks
notes into a chord:

```js
note("[c3,e3,g3]")              // a single C-major chord
note("<[c3,eb3,g3] [bb2,d3,f3]>")  // alternate two voicings per cycle
```

## Combining everything

A more involved example:

```js
note("<[c3,eb3,g3]@3 [bb2,d3,f3]>")     // alternating chord, first one held longer
  .s("gm_epiano2")
  .room(0.5)
```

## Common gotchas

- **Don't put `*N` and `!N` together** unintentionally. `bd*2!2` will surprise
  you: `*2` first speeds up `bd` to 2 per cycle, then `!2` repeats that twice.
- **Top-level `,` only stacks at the outermost level of the string.** Inside
  `[...]` it stacks within the group; inside `<...>` it doesn't stack — each
  comma-separated value becomes a candidate cycle.
- **Mini-notation is not a code expression.** `note("c + 7")` doesn't transpose;
  use `.add(7)` outside the string.
