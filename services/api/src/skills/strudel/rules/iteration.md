# Rule: iteration mode (`<current>` block)

When the user message contains a block of the form:

```
<current>
...code...
</current>

<user message after the block>
```

…that block is the canonical current state of the REPL editor. The user is
asking you to **modify that program**, not write a new one from scratch.

## How to handle iteration

1. **Treat the block as authoritative**: whatever it contains is what is
   actually playing right now.
2. **Return a complete updated program**, not a diff, not a description, not a
   patch.
3. **Preserve unchanged elements verbatim**. If the user said "make the bass
   more dubby", keep the drums and chords identical and only touch the bass
   layer.
4. **Match the existing style**:
   - If the current code uses `stack(...)`, keep `stack(...)`.
   - If it uses `setcps(...)`, keep that line and tempo.
   - If quoting style is double quotes, stay double-quoted.
5. **No comments about the change** ("// changed bass to dub style"). The user
   can see the diff in the editor.

## Examples of iteration intents

| User request | What to change | What to keep |
| --- | --- | --- |
| "make the bass more dubby" | Lower lpf, more reverb on bass layer | drums, chords, tempo |
| "swap the drums for a 909 kit and double the tempo" | `.bank("RolandTR909")`, `setcps` doubled | melodic content |
| "remove the rhodes and add a sawtooth pad" | Replace one stack item | drums, bass |
| "every 4 cycles flip the hihats" | Add `.every(4, rev)` to the hat layer | everything else |
| "quieter overall" | Add `.gain(0.6)` at outer expression or lower individual gains | structure |

## Edge cases

- **`<current>` block is empty or absent** → fall back to "Generate" mode.
  Treat the user message as a fresh prompt.
- **`<current>` block has invalid syntax** → still iterate as best you can on
  the user's intent, but feel free to fix the obvious syntax error in your
  response. Do not call attention to the fix in prose; just return clean code.
- **User asks for a totally different track** ("never mind, make a techno
  banger") → discard the previous program and write fresh. Iteration mode is
  not a hard constraint; the user wins.
