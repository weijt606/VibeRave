# Rule: meta-commands (host transport / track list)

The user's message may be a **host control** — they want to manage the
application (open a new track, start / stop playback, schedule a stop)
rather than edit the music. When that happens, you must respond with a
single META line instead of Strudel code.

## When to emit a META line

Emit META **only** when the user's intent is unambiguously about the
application's transport or track list, not about the audible pattern.

| User says (examples) | META | Notes |
| --- | --- | --- |
| "open a new track", "add a track", "新轨道", "加一轨", "start a fresh track" | `{"action":"new_track"}` | Creates and selects a blank track. |
| "play", "start", "resume", "play it", "播放", "开始" | `{"action":"play"}` | Starts the selected track if paused. |
| "pause", "pause it", "暂停" | `{"action":"pause"}` | Pauses the selected track if playing. |
| "stop", "stop this track", "停" | `{"action":"stop"}` | Stops the selected track. |
| "stop all", "stop everything", "panic", "kill it", "全停", "全部停止" | `{"action":"stop_all"}` | Stops every track. |
| "stop in 10 seconds", "pause in 5s", "10秒后停", "5秒后暂停" | `{"action":"schedule_stop","delayMs":10000}` | Stops the selected track after `delayMs`. Replaces any pending timer. |

If the request looks like a transport command but specifies a count
("stop in N seconds / minutes"), normalize the duration to **delayMs**
(`30 seconds` → `30000`, `1 minute` → `60000`). Round to the nearest
whole millisecond. If the user gives no number, do not invent one — fall
through to the music path.

## When NOT to emit META

Do **not** treat a prompt as META just because it contains the word
"stop" or "pause". The user is editing music when they say things like:

- "add a pause to the rhythm" (musical rest, not transport)
- "stop the bass from playing" (mute / remove a layer)
- "make the kick drop out for 4 bars" (arrangement edit)
- "open up the filter" (effect change, not a new track)
- "play it slower" (tempo change, not transport)

When in doubt, fall back to normal generation. A wrong META is more
disruptive (the user hears nothing change) than a wrong music edit
(they hear the wrong edit and can correct it).

## How to emit a META line

When the conditions above are met, your response **starts** with one line:

```
META: {"action":"<action>"[,"delayMs":<number>]}
```

Rules for the META line:

- It must start with the literal prefix `META:` followed by one space.
- The JSON must be a single-line object — no newlines inside the braces.
- Use only the actions listed in the table above. Do not invent actions
  (`mute`, `solo`, `next`, `bpm`, etc. are not meta — they are music
  edits and should be handled by the normal Strudel-code path).
- No prose before the META line, no markdown fences.

## Combining META with generated code

For `new_track` only, the user may include a musical request in the same
sentence — e.g. "open a new track with some drums", "新建一个轨道，加点
techno 鼓". When that happens, emit the META line first, then a blank
line, then a complete Strudel program for the new track that obeys
`rules/output-format.md` exactly as if it were a normal generation:

```
META: {"action":"new_track"}

stack(
  s("bd*4, ~ cp, hh*8").bank("RolandTR909")
)
```

The host will create and select the new track, seed it with the code,
and start playback automatically. The code half must still be a single
self-contained expression — it is dropped straight into the new track's
editor, just like a normal generation.

For all other actions (`play`, `pause`, `stop`, `stop_all`,
`schedule_stop`), do **not** include any code after the META line.
Those actions don't take a body. If the user asked for both a transport
change and a music edit in one breath ("stop and make the bass dubby"),
treat it as a music edit only and ignore the transport half — the user
can re-issue the transport command after they hear the change.

## Why a sentinel

The backend detects this exact prefix and:

- does **not** hot-swap any code into the editor (so the running pattern
  is preserved),
- dispatches the action to the in-browser host (track list, transport,
  scheduler),
- still records the turn in chat history so the conversation makes
  sense to the user.

## How META turns appear in later history

Earlier META turns will show up in the conversation history as
`META: {...}` lines from the assistant. **Ignore them when planning the
next musical change.** They were host actions, not musical edits, and
they say nothing about what the audible pattern should sound like. Only
the most recent `<current>` block plus the user's latest musical
prompts shape the next response.
