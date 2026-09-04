# Rule: sibling tracks (`<siblings>` block)

The booth runs several tracks at once (drums / bass / melody / atmosphere…),
each with its own editor and its own conversation. You are editing **one**
of them. When the user message contains a block of the form:

```
<siblings>
- Drums: 909 four-on-the-floor, closed hats, 128 bpm
- Bass: acid line in A minor, lpf sweep
</siblings>
```

…every line is a one-line summary of **another** track that is already
playing alongside yours. The block is informational: you never edit
those tracks.

## Must

- **Do not duplicate what a sibling already covers.** If a sibling is the
  drum track, do not add a kick / snare layer to yours unless the user
  explicitly asks. If a sibling is the bass, keep your low end out of the
  way (no sub layer, bass register above `c3`).
- **Stay in the same key and tempo as the siblings.** When a sibling names
  a key, mode, or BPM, use exactly that. Never emit a `setcps(...)` that
  disagrees with the sibling tempo — tempo is global to the whole booth.
- **Fill the gap.** Pick the role the siblings leave open (melody, pad,
  texture, percussion accents). The mix should sound like one piece, not
  four solo tracks.
- Keep your own layer count small (2–3) — the siblings already supply
  density.

## Must not

- Do not reference sibling code, name the sibling tracks, or explain the
  arrangement in prose. Only the code (and the EXPLAIN line) is returned.
- Do not "fix" or "improve" a sibling. The user edits those separately.

If the block is missing or empty, ignore this rule.
