# Rule: handling uncertainty

Strudel is a moving target — package versions change, community-defined helpers
exist, some features are experimental. **Never silently invent function names.**

When in doubt about a function, sound name, or feature, you have two choices:

1. **Don't use it.** Pick a safer alternative documented in `reference/*`.
2. **Use it but mark it.** When the user explicitly asked for the feature, or
   the alternative would be much weaker, you may still use it — but only in a
   non-output context (e.g. when *explaining* code, not when *generating* it).
   Use one of the markers below.

> **Important:** uncertainty markers are for **explain / debug / chat** modes
> only. They must NEVER appear in generated Strudel code (rule:
> `rules/output-format.md` is non-negotiable).

## Markers (use verbatim)

- `version-dependent` — known to exist in some Strudel version, may not be in
  the version you are running.
- `experimental` — present in source but flagged unstable.
- `community-defined` — a helper that exists in user patterns / community
  snippets but not in the published packages.
- `not confirmed by provided docs` — you have only seen it in this user's
  message or in tutorials, you cannot verify it from `doc.json` or
  `reference/*`.

Example use in an *explain* response:

```
The function `punchcard()` is a viz helper [not confirmed by provided docs];
if your REPL version doesn't have it, replace it with `pianoroll()` which is
documented in core.
```

## What this means concretely

- Do NOT generate code that calls a function name that does not appear in
  `reference/*` of this skill. As of this version, the following commonly-cited
  names were verified against `doc.json`:
  - **Verified**: `arp`, `clip`, `pianoroll`, `pitchwheel`, `spiral`, `scope`,
    `fscope`, `spectrum`, `drawLine`, `markcss`, `setcpm`, `lpq`, `hpq`
    (q-values for filters).
  - **Not verified** (do not use in generated code): `legato`, `feel`,
    `punchcard`, `resonance` (use `lpq` / `hpq` instead — `resonance` is a
    common but unsupported name in current source).
  - **Verified in source but not in the JSDoc dump**: `setcps` — it is
    exposed via `packages/core/repl.mjs` and is the canonical tempo setter,
    safe to use.
- Do NOT invent sound names. If the user says "make a vibey 808 bass" and
  there's no GM/sample by that exact name, build it from `sawtooth`/`triangle`
  + filter + envelope (see `reference/sounds.md`).
- If the user is clearly asking about a feature the docs don't cover, in
  *explain mode* you may say so plainly: "the docs in this version don't list
  X, here's the closest verified alternative".

## When you violate this rule

If you generate code with an unverified function and it errors in the REPL,
the user sees `function X is not defined` or `sound X not found`. The
correction loop is expensive — they have to re-prompt and you have to redo the
whole pattern. Spending one extra token to pick a verified alternative the
first time is always cheaper.
