# Strudel skill

A reusable knowledge package for an LLM that generates / explains / debugs /
iterates on Strudel live-coding code.

## What this is

A directory of markdown files. Each file is a topic. Together they teach an
LLM how to behave like a competent Strudel collaborator without hallucinating
function names or sound IDs.

The skill is designed to be:

- **Composable** — load the whole thing, or only the parts you need.
- **Verifiable** — every function name in `reference/*` has been checked
  against the local Strudel `doc.json` (596 entries from `pnpm jsdoc-json`).
- **Honest** — uncertain features are tagged per `rules/uncertainty.md`
  rather than silently invented.

## Layout

```
SKILL.md                manifest, capability map, suggested loading order
README.md               this file
rules/
  output-format.md      hard rules on what the response can contain
                        (incl. mandatory visualizer + compile self-check)
  iteration.md          how to handle <current>...</current> blocks
  host-controls.md      loop_count / time_limit / continue_style protocol
  uncertainty.md        markers for unverified info, hallucination guard
reference/
  sounds.md             s("..."), .bank(...), GM list, drum aliases
  mini-notation.md      "bd*4", "<a b c>", "[a, b]", polymeter, chords
  pattern-transforms.md slow/fast/every/struct/scale/euclid/jux/off/...
  effects.md            lpf/lpq/room/delay/crush/distort/phaser/duck/fm
  modulation.md         sine/saw/perlin .range / .rangex / LFO chaining
  tempo.md              setcps / setcpm / cycles
  visualization.md      pianoroll/scope/spectrum/spiral/pitchwheel
  dual-deck.md          stereo split, crossfader, left-house / right-techno
recipes/
  generate.md           intent → pattern (slot-fill template)
  explain.md            beginner-friendly explanation template
  debug.md              error → fix substitution table
  vary.md               variation cookbook (5 lenses)
examples/
  genres.md             lo-fi / house / techno / ambient / acid / DnB / jazz
  techniques.md         polyrhythm / call-response / arp / sidechain / euclid
```

## How to load

### As one big system prompt (simplest)

Concatenate all files in the order listed in `SKILL.md`'s "Loading order"
section. The total is roughly 8–10 KB of markdown — well under the 100 KB
soft limit for a Gemini system prompt.

```js
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function loadStrudelSkill(skillRoot) {
  const order = [
    'rules/output-format.md',
    'rules/iteration.md',
    'rules/host-controls.md',
    'rules/uncertainty.md',
    'reference/sounds.md',
    'reference/mini-notation.md',
    'reference/pattern-transforms.md',
    'reference/effects.md',
    'reference/modulation.md',
    'reference/tempo.md',
    'reference/visualization.md',
    'reference/dual-deck.md',
    'recipes/generate.md',
    'recipes/explain.md',
    'recipes/debug.md',
    'recipes/vary.md',
    'examples/genres.md',
    'examples/techniques.md',
  ];
  const parts = await Promise.all(
    order.map((p) => readFile(join(skillRoot, p), 'utf8'))
  );
  return parts.join('\n\n---\n\n');
}
```

### Routed per intent (smaller prompts, more accurate)

Pick the recipe that matches the user's request, then load only the references
it touches. The capability table in `SKILL.md` maps intent → required refs.

A minimal viable prompt is:

```
rules/output-format.md
rules/iteration.md
reference/sounds.md
reference/mini-notation.md
reference/pattern-transforms.md
reference/visualization.md
examples/genres.md
recipes/generate.md
```

(~5.5 KB; covers ~80% of REPL prompts. `visualization.md` is now in the
minimum set because the output rule mandates a visualizer on every response.)

## History

This skill replaced a flat `services/api/src/prompts/strudel-system.md` system
prompt. The api service now composes the prompt from this folder; the legacy
file has been removed.

## Verification & maintenance

This skill was built against:

- `packages/core` 1.2.6
- `packages/mini` 1.2.6
- `packages/webaudio` 1.3.0
- `doc.json` regenerated 2026-04-25 via `pnpm jsdoc-json`

When upgrading Strudel:

1. Re-run `pnpm jsdoc-json`.
2. Diff names: `node -e "..."` (see `rules/uncertainty.md` for the verification
   loop).
3. Update `reference/*` for any function added / removed.
4. Bump `version:` in `SKILL.md` frontmatter.
