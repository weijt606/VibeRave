# Rule: output format

These rules are non-negotiable. Every Strudel-code response must obey all of them.

## Must

- Reply with **only the Strudel code**. No prose before, no prose after,
  no explanation, no markdown fences, no commentary, no viz hint.
- The code must be a **single self-contained expression** that the Strudel REPL
  can evaluate as the entire program. The expression is typically `stack(...)`,
  `note(...)...`, or `s(...)...`.
- Use **double quotes** for mini-notation strings (e.g. `"bd ~ sd ~"`),
  **single quotes** are also accepted by the parser but pick one and stay
  consistent within a single response.
- Keep total length under ~25 non-blank lines unless the user explicitly asked
  for "long", "elaborate", "extended", or similar.
- Functions / methods used must exist. If you are tempted to use something that
  is not in `reference/*` of this skill, follow `rules/uncertainty.md`.
- **Code must compile and play first try.** Run the self-check below before
  responding.

## Visualization

**Do not** pick or emit a viz hint. The host renders a per-track
painter (pianoroll / waveform / spectrum / scope / spiral) chosen by
the user; it owns that decision. You also do **not** need to append
`.scope()` / `.pianoroll()` to the expression; the host renders the
viz on its own canvas.

## Must not

- No `import`, no `require`, no `export`.
- No `console.log`, `print`, `alert`.
- No top-level `return`, no top-level `await`.
- No `Tone.js`, no raw `AudioContext`, no Web Audio API, no `fetch`.
- No DOM manipulation (`document.*`, `window.*`).
- No markdown fences (`` ``` ``) — the response must be raw code.
- No leading or trailing comments. Inline comments are allowed only in
  these cases:
  - **Dual-deck programs** (see `reference/dual-deck.md`): a single short
    `// Left deck — <vibe>` / `// Right deck — <vibe>` line per deck is OK,
    because it materially helps the reader distinguish stereo halves.
  - The user explicitly asked for commented code.
  In all other cases, omit comments.
- Do not explain what changed when iterating — the diff is implicit.

## Output shape

A response is exactly one Strudel expression. For example:

```
stack(
  s("bd ~ ~ bd, ~ ~ sd ~, hh*8").bank("RolandTR909"),
  note("<c2 g1 a1 e1>").s("sawtooth").lpf(800).gain(0.6)
).slow(2)
```

Nothing else — no comment, no fence, no prose.

## Compilation self-check

Run this checklist mentally before sending the response. Failing any one of
these means re-emit, do not ship.

| Check | What to look for |
| --- | --- |
| **One expression** | Only one top-level expression. No bare statements like `let x = ...; x.note()` — wrap state into the expression itself. |
| **Brackets balanced** | `(`/`)`, `[`/`]`, `{`/`}`, `<`/`>` and `"`/`"` all close. Count them in mini-notation strings too. |
| **Method names verified** | Every `.foo(...)` after a pattern is in `reference/effects.md` / `reference/pattern-transforms.md` / `reference/visualization.md`. No `.resonance`, `.reverb`, `.legato`, `.feel`. |
| **Sound names verified** | Every `s("...")` argument decomposes into names from `reference/sounds.md` (drum aliases, GM names, waveform names). No `s("bass")` / `s("kick")` / `s("synth")`. |
| **No forbidden tokens** | No `import`, `require`, `console`, `return`, `await`, `Tone`, `AudioContext`, `document`, `window`. |
| **No prose / no fences / no viz hint** | Output starts directly with the code. Output ends with `)` (or `;` or a method call). No leading or trailing whitespace lines except a single newline. |

If any cell answers "no", fix and re-check the whole list — do not ship a
"close enough" program. Strudel parser errors abort the whole evaluation; the
user hears silence and has to re-prompt.

## Why these rules

- The REPL pipes the response straight into `setCode()` and `evaluate()`. Any
  prose, markdown fence, or extra wrapping breaks evaluation.
- Strudel code runs inside a sandboxed transpiler that disallows the `import`
  keyword and most browser APIs.
- Keeping responses short keeps live-coding iteration fast — the whole point of
  the tool is sub-second turnaround.
