# Recipe: debug

Used when the user pastes code that errors, plays silence, or sounds wrong.

## Three classes of failure

| Symptom | Likely class | Where to look |
| --- | --- | --- |
| Console: `function X is not defined` | Hallucinated function | `rules/uncertainty.md`, swap for a verified one. |
| Console: `sound X not found` | Bad sample/synth name | `reference/sounds.md`. |
| Plays silence or barely audible | gain / mute / structure issue | `reference/effects.md` `gain`, mini-notation rests `~`. |
| Plays wrong notes / out of key | scale / pitch issue | `reference/pattern-transforms.md` `scale`, `add`, `note`. |
| Console: `unexpected token` / parse error | Mini-notation or JS syntax | `reference/mini-notation.md`, balanced brackets. |
| Sound is harsh / clipping | Filter/distortion/gain | Cap `gain(≤0.8)`, drop `lpq`, drop `crush`. |

## Procedure

1. **Read the error** the user pasted (if any). Copy the function/sound name out.

2. **Check the error category**:
   - "is not defined" → name of a JS function, probably a hallucinated method.
     Look for it in `reference/*`. If absent, replace per substitution table below.
   - "not found" / "sound not found" → sample / synth name issue. Check
     `reference/sounds.md`.

3. **If silence**: scan for these issues in this order:
   - `gain(0)` somewhere?
   - All-rest mini-notation (`"~ ~ ~ ~"`)?
   - `.mask("0")` or `.degrade()` on a one-event pattern?
   - Unbalanced bracket so half the pattern is consumed?

4. **Return** a corrected single expression. **Do not** paste a "// fixed:"
   comment in the output (rule: `rules/output-format.md`). The user can see
   the diff.

## Common substitutions (hallucinated → verified)

| Wrong | Right | Notes |
| --- | --- | --- |
| `.resonance(N)` | `.lpq(N)` (or `.hpq`) | Q-value of the relevant filter. |
| `.legato(N)` | `.clip(N)` | Same idea — note duration. |
| `.feel(N)` | `.swing(N)` or `.late("0 0.05 0 0.05")` | Humanisation. |
| `s("kick")` / `s("808")` | `s("bd")` + `.bank("RolandTR808")` | |
| `s("hat")` / `s("hihat")` | `s("hh")` (closed) or `s("oh")` (open) | |
| `s("bass")` | `note(...).s("sawtooth").lpf(...)` | Build it from a wave. |
| `s("synth")` / `s("lead")` | `note(...).s("triangle")` or `s("sawtooth")` | |
| `s("piano1")` | `s("piano")` | |
| `setBpm(N)` | `setcps(N/60/4)` | |
| `.cps(N)` (chained) | Use `setcps(N)` at top, or `.fast(N)` for speed change. | |
| `.punchcard()` | `.pianoroll()` | Closest verified viz. |

## Reading the error inline (in case the user dumps a message)

`Cannot read properties of undefined (reading 'fmap')` → almost always means
a function returned `undefined` because of a typo in the function name. Use
the substitution table.

`Mini parse error at position X` → bracket / quote imbalance. Re-emit the
mini-notation string and count brackets.

`Audio context suspended` → not a code bug. Tell the user to click on the
REPL once before evaluating.

## Worked example

User pastes:

```js
note("c3 e3 g3").s("synth").resonance(15).reverb(0.5)
```

Errors: `function reverb is not defined`. Also `synth` is not a sound.

Fix (output only):

```js
note("c3 e3 g3").s("triangle").lpq(15).room(0.5)
```

(`reverb` → `room`, `synth` → `triangle`, `resonance` → `lpq`. No comment, no diff.)
