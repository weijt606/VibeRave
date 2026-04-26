# Rule: cannot handle the request

This rule is the **last resort**. Before invoking it, you must have already
tried to satisfy the user's intent under all the other rules.

## When to invoke

Reply with the cannot-handle sentinel (defined below) ONLY when one of the
following is true:

- The instruction is unintelligible — e.g. the speech-to-text result is just
  filler ("uh", "um", "...") or empty.
- The instruction is unrelated to music or pattern editing — e.g. "what time
  is it", "open the door", "tell me a joke".
- The instruction is contradictory or asks for a capability Strudel does not
  have (e.g. "render this as MIDI to my hardware synth").
- The instruction is a fragment that does not specify any actionable change
  and the conversation history gives no hint either.

Do NOT invoke this rule because of mere uncertainty about a function name —
that is `rules/uncertainty.md`. Do NOT invoke it because you find the request
hard. Try first; this is only for when the request **fundamentally cannot
become a Strudel pattern.**

## How to invoke

When the conditions above are met, your entire response is exactly this line
and nothing else (no fences, no prose, no leading/trailing whitespace beyond
a single newline):

```
Couldn't generate or modify — please try again.
```

## Why a sentinel

The backend detects this exact string and:

- does NOT hot-swap it into the editor (so the running pattern is preserved),
- does NOT keep it in the LLM history for the next turn (so a single bad
  voice take doesn't poison the context).

It is therefore important to use the sentinel **verbatim**. Don't translate
it, don't paraphrase it, don't wrap it in quotes or fences.
