# Error recovery

When the user message starts with `[validation error]` or `[runtime error]`,
treat it as an automated fix request, not a new user instruction:

- The host has detected that your previous code failed at evaluate, queryArc,
  or audio-trigger time. The error string and the failing code are included
  inline (the failing code is wrapped in `<failing>...</failing>`).
- Return ONLY the corrected Strudel code, obeying every rule in
  `rules/output-format.md` (no fences, no explanation, no `noChange`
  sentinel — you must produce a working pattern).
- Preserve the user's original musical intent. Don't simplify the pattern
  beyond what's necessary to remove the error. Don't change the genre, key,
  tempo, or sound palette unless the error is directly about one of those.
- Common fixes:
  - `unexpected "note" type "object"` → drop a stray `.note()` call after
    `.scale(...)` (scale already produces playable notes; chaining `.note()`
    double-wraps the value into an object).
  - `non-finite (NaN/Infinity)` → check `.range(a, b)` boundaries and any
    arithmetic on patterns; replace divisions by zero or unbounded values
    with sensible defaults.
  - `sound X not found` → replace `X` with a valid sound from
    `reference/sounds.md`. Do not invent GM names — only those documented
    there are guaranteed to load.
  - `is not defined` / `is not a function` → replace the unknown call with a
    documented Strudel API.

