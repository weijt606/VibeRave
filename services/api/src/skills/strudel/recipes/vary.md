# Recipe: vary (suggest variations)

Used when the user has a working pattern and asks "give me 3 variations" or
"what else could I try?". Always pair this recipe with `rules/iteration.md` so
each variation is a complete program.

## Five lenses for variation

When the user says "vary it", apply one or more of these lenses:

1. **Rhythm** — change drum patterns, add euclid, stutter, syncopate.
2. **Melody / harmony** — add notes, transpose, change scale, arp differently.
3. **Bass** — swap shape (sawtooth → triangle), change root rhythm.
4. **Sound design** — change synth waveform / soundfont / kit bank.
5. **FX / movement** — add filter LFO, reverb swell, side-chain, distortion.

## Procedure

1. Read the existing program from `<current>`.

2. Pick **3 distinct lenses**. Don't apply the same lens twice — that's not
   variation, that's drift.

3. Generate 3 complete programs, separated by **only newlines** (no headers,
   no prose). Each should be a valid drop-in replacement.

> ⚠️ Caveat: by default, the LLM service expects one program back. If the
> caller hasn't requested multiple, return only the **first** variation and
> mention the others in a comment block ONLY IF the user explicitly asked for
> "show me all of them" / "list 3 variations". When unsure, return one variation.

## Variation cookbook

### Rhythm-lens edits

```js
// Original drums:
s("bd*4, [~ cp]*2, hh*8").bank("RolandTR909")

// Add stutter every 4 cycles
s("bd*4, [~ cp]*2, hh*8").bank("RolandTR909").every(4, x=>x.fast(2))

// Make hats euclidean
s("bd*4, [~ cp]*2").bank("RolandTR909").stack(s("hh").euclid(7,16))

// Swap snare for clap on a 3-against-4 polymeter
s("bd*4, {~ cp}%3, hh*8").bank("RolandTR909")
```

### Melody/harmony-lens edits

```js
// Original bass:
note("c2*8".add("<0 7 5 3>")).s("sawtooth").lpf(800)

// Mode change — minor → phrygian
n("0 2 3 5".add("<0 7 5 3>")).scale("C2:phrygian").s("sawtooth").lpf(800)

// Octave wider — add 12 sometimes
note("c2*8".add("<0 7 5 3>")).s("sawtooth").lpf(800).sometimes(x=>x.add(12))

// Reharm — same melody, shifted root each cycle
note("c2*8".add("<0 7 5 3>")).s("sawtooth").lpf(800).transpose("<0 -2 -5 -3>".slow(4))
```

### Sound-design-lens edits

```js
// Swap kit
.bank("LinnDrum")    // dustier
.bank("AkaiMPC60")   // hip-hop boom-bap
.bank("OberheimDMX") // 80s electronic

// Swap synth wave on bass
.s("triangle")       // softer
.s("square")         // chiptune
.s("gm_synth_bass_1") // smoother soundfont

// Swap pad
.s("gm_pad_poly")
.s("gm_string_ensemble_1").attack(0.5).release(1)
```

### FX-lens edits

```js
// Filter movement
.lpf(sine.range(400, 4000).slow(8)).lpq(15)

// Side-chain
.duckdepth(0.6).duckattack(0.05)

// Stereo width
.jux(rev)            // try the reverse on the right
.jux(x=>x.fast(2))   // double-time on the right

// Tape feel
.crush(8).gain(0.7)
```

## Output discipline

If the request is "give me a variation" (singular) → return ONE program.
If "give me 3 variations" / "show me a few" → return 3, separated by a single
blank line, no headers.

```
<program 1>

<program 2>

<program 3>
```

(Still no markdown fences, still no prose.)
