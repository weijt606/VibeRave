# Rule: host controls (loop count / time limit / continuity)

The host application (LLM service or REPL) may pass control signals alongside
the user prompt. These signals shape **how long** a generated pattern plays
and **what to do next** when it expires.

## Recognized host fields

The host wraps the user's text with optional metadata. When present, these
appear before or alongside the `<current>` block:

| Field | Meaning | Example |
| --- | --- | --- |
| `loop_count: N` | Play the generated pattern for N cycles, then auto-advance. | `loop_count: 8` |
| `time_limit: N` | Play for ~N seconds, then auto-advance. | `time_limit: 30` |
| `auto_advance: true` | Auto-advance is enabled (default off). | — |
| `continue_style: true` | If no new prompt arrived before expiry, generate a continuation in the same style. | — |

Concrete payload example:

```
loop_count: 8
auto_advance: true
continue_style: true

<current>
stack(
  s("bd*4, ~ cp, hh*8").bank("RolandTR909"),
  note("c2*8".add("<0 7 5 3>")).s("sawtooth").lpf(800).gain(0.6)
).scope()
</current>

<no new user prompt>
```

## How to react

1. **The host signal does NOT affect the code you emit.** You still return one
   self-contained Strudel expression that obeys `rules/output-format.md`. The
   `loop_count` / `time_limit` is enforced by the host, not by the pattern.

2. **Do not** add `setcps`, `slow`, or `fast` to satisfy a `time_limit`. Those
   change *speed*, not *duration*. Duration is the host's job.

3. **Do not** include the host fields in your reply.

## Continuity mode (`continue_style: true` and no new prompt)

When the host indicates that the loop expired with no new user input, treat
the `<current>` block as both the iteration target *and* the style anchor.
You should:

- Produce a **fresh** pattern (not the exact same code).
- **Match the existing style** along these dimensions:
  - Same tempo (`setcps(...)` line if present, keep it verbatim).
  - Same drum kit (`.bank(...)`).
  - Same key / scale (read from `note(...)` / `.scale(...)` in current).
  - Same instrument family for melody/bass (e.g. if current uses
    `gm_epiano2`, keep electric piano family).
  - Similar density (drum hits per cycle within ±50%).
  - Similar effect envelope (room/delay amount roughly preserved).
- **Vary** along ONE dimension to keep the set evolving. Pick one of:
  - Different chord progression in the same key.
  - Different bass line over the same drum kit.
  - Add or remove one layer.
  - Same drums but different fill / variation pattern.

Think of this as a DJ playing the next track in the set — listeners hear
something **new** but the room's energy doesn't drop.

## Continuity is NOT iteration

| Iteration mode (`rules/iteration.md`) | Continuity mode (this file) |
| --- | --- |
| User said "make the bass more dubby". | User said nothing — host timer expired. |
| Preserve unchanged elements verbatim. | Generate fresh content; preserve only style. |
| Touch only the layer the user named. | Free to change any layer — keep the vibe. |
| Output is a small edit. | Output is a new track in the same style. |

## When `continue_style` is missing or `false`

If the host provides no continuity signal and there's no user prompt, the
fallback is: do nothing — return the `<current>` code unchanged. (The host
should not call you in this case, but if it does, keep state stable rather
than introducing drift.)

## Anti-patterns

- **Embedding the timer in code**: do not write `.slow(8)` to "make it 8
  cycles long". `loop_count: 8` is enforced externally.
- **Leaking host fields into output**: never echo `loop_count: 8` or any
  meta-line into the response.
- **Drifting on continuity**: each continuation should match the previous
  *style*, not chain off the *previous continuation*. If the user asked for
  techno 5 minutes ago and you've continued 6 times, response 7 should still
  be techno — not "techno gradually morphed into ambient".