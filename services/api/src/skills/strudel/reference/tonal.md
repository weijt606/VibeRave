# Reference: tonal (chords, voicings, modes)

High-level harmonic API. Reach for these whenever the user names chords
(`Cm7 to Am7`), modes (`dorian`, `phrygian`), or describes a progression
in functional / Roman-numeral terms (`ii-V-I in C major`) — they produce
musically idiomatic output without you having to spell out every note.

Verified against Strudel's `doc.json` and the official workshop:
<https://strudel.cc/workshop/getting-started/>.

## `chord(spec)` — name chords symbolically

`chord` accepts standard chord-symbol notation: root + quality (`maj` /
`m` / `7` / `maj7` / `m7` / `dim` / `sus2` / `sus4` / `aug` / `add9` /
`9` / `13`).

```js
chord("Cm7 Am7 Fmaj7 G7").voicing()
```

Spaces separate chords; one chord per cycle by default. Combine with
mini-notation for rhythm:

```js
chord("<Cm7 Am7 Fmaj7 G7>").voicing().s("gm_epiano2").attack(0.05).gain(0.5)
```

## `voicing()` — auto-pick a playable voicing

Without `.voicing()`, `chord()` produces all the chord tones in close
position from the root, which often sounds cluttered. `.voicing()` picks
a sensible inversion and spread for the previous chord — like a session
pianist's left hand. **Always pair `chord(...)` with `.voicing()`** unless
the user explicitly asked for a specific voicing layout.

## `mode("scale")` — modal scales

Equivalent to `.scale("X:mode")` but more idiomatic for jazz / fusion /
modal prompts. Common modes:

| Mode | Vibe |
| --- | --- |
| `ionian` (= major) | Bright, classical |
| `dorian` | Jazz / fusion / cool |
| `phrygian` | Spanish / Middle-Eastern / metal |
| `lydian` | Dreamy / cinematic |
| `mixolydian` | Bluesy / rock |
| `aeolian` (= minor) | Default minor |
| `locrian` | Tense / dissonant |

```js
n("0 2 4 5 4 2 0 7").s("triangle").mode("D dorian")
```

For a bass line locked to the chord's mode:

```js
chord("<Dm7 G7 Cmaj7>").voicing()
  .stack(chord("<Dm7 G7 Cmaj7>").root().sub(12).s("sawtooth").lpf(600))
```

## `anchor("note")` — pin the voicing centre

When a chord progression keeps jumping octaves, `.anchor("c4")` tells
`.voicing()` to keep voicings close to that pitch. Smooths leaps:

```js
chord("Cmaj7 Fmaj7 G7 Cmaj7").voicing().anchor("c4")
```

## When to use raw `note(...)` vs `chord(...)`

- **Raw**: precise control, atypical voicings, custom inversions.
  ```js
  note("[c3,eb3,g3,bb3]")
  ```
- **`chord(...).voicing()`**: when the user names chords symbolically or
  wants typical voicings without you having to think about them.
  ```js
  chord("Cm7").voicing()
  ```

The two compose — you can `.stack()` a `chord()` line with raw `note()`
basslines / leads.

## Anti-patterns

- `chord("Cmaj").note()` — `.note()` after `.chord()` strips the chord
  back to its root only. Use `.voicing()` instead to keep all the tones.
- Mixing `chord()` and `.scale()` on the same pattern — pick one harmonic
  source. `chord(...).voicing()` already implies the right scale.
- Using `chord()` for a single-note bassline. Just `note(...)`.
