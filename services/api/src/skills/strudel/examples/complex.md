# Examples: complex / layered patterns (level 4–5)

Battle-tested *richer* patterns. Reach for these when the user asks
for: complex, layered, rich, dense, intricate, polyphonic, sophisticated,
maximalist, baroque, IDM-density, hyperpop-density — or any equivalent
in Chinese (复杂, 丰富, 有层次, 密集, 立体, 饱满, 极致).

The `examples/genres.md` templates are correct but flat. These show
what the **same genre family** sounds like when pushed to level 4+ via:

- **nested `stack(...)`** with sub-group processing
- **polyrhythmic / polymetric** layers
- **`.late()`** micro-timing for groove
- **`.mask("<...>/16")`** for sectional gating
- **continuous parameter modulation** via `sine.range().slow()` /
  `perlin.range()` on `.lpf` / `.fm` / `.gain` / `.pan`
- **probabilistic transforms**: `.rarely(ply(2))`, `.chunk(N, fast(2))`,
  `.sometimes(rev)`
- **`chord(...).dict('ireal').voicing()`** for jazz-rich extended chords
- **`.set(chords)`** to inherit chord notes across layers
- **`.segment(N)` / `.clip(rand.range(...))`** for granular feel
- **detuned supersaw** stacks
- **FM with modulated index** (`.fm(sine.range(...).slow(...))`)

## Canonical reference: "coastline" (eddyflux)

This is the gold-standard for "rich layered Strudel." Study every line.

```js
// "coastline" @by eddyflux — reference for level 4-5 complexity
samples('github:eddyflux/crate')
setcps(.75)
let chords = chord("<Bbm9 Fm9>/4").dict('ireal')
stack(
  // DRUMS — nested stack with bank() applied to the whole sub-group,
  // then a master mask gates whole 4-cycle sections in/out
  stack(
    s("bd").struct("<[x*<1 2> [~@3 x]] x>"),         // kick alternating between busy + simple
    s("~ [rim, sd:<2 3>]").room("<0 .2>"),           // rim+snare with cycling room amount
    n("[0 <1 3>]*<2!3 4>").s("hh"),                  // hat density alternates 2-2-2-4
    s("rd:<1!3 2>*2").mask("<0 0 1 1>/16").gain(.5)  // ride masked in for half the loop
  ).bank('crate')
   .mask("<[0 1] 1 1 1>/16".early(.5)),
  // CHORDS — voiced-down chords through phaser + reverb
  chords.offset(-1).voicing().s("gm_epiano1:1")
    .phaser(4).room(.5),
  // BASS — inherits chord notes via .set(chords), in root mode for bass register
  n("<0!3 1*2>").set(chords).mode("root:g2")
    .voicing().s("gm_acoustic_bass"),
  // LEAD — granular arpeggio with FM, LFO filter, chunk-based mutation
  chords.n("[0 <4 3 <2 5>>*2](<3 5>,8)")
    .anchor("D5").voicing()
    .segment(4).clip(rand.range(.4,.8))
    .room(.75).shape(.3).delay(.25)
    .fm(sine.range(3,8).slow(8))
    .lpf(sine.range(500,1000).slow(8)).lpq(5)
    .rarely(ply("2")).chunk(4, fast(2))
    .gain(perlin.range(.6, .9))
    .mask("<0 1 1 0>/16")
)
.late("[0 .01]*4").late("[0 .01]*2").size(4)
```

**Why this feels rich:**
- Drums alone have FOUR sub-layers, each with its own variation device
- Chord progression uses 9th-extended jazz voicings via `dict('ireal')`
- Bass *inherits* the chord motion via `.set(chords)` — automatic voice leading
- Lead modulates THREE parameters continuously (`fm`, `lpf`, `gain`) and runs through `chunk` + `rarely(ply)` for unpredictability
- Master `.late("[0 .01]*4").late("[0 .01]*2")` adds humanizing micro-swing
- `.size(4)` widens the stereo image
- `.mask(...)` gates whole sections so the loop has macro-structure, not just a 1-cycle repeat

**Note on `samples('github:eddyflux/crate')`:** that line fetches a
sample pack. Only emit it when the user explicitly mentions a sample
pack. Otherwise, swap `bank('crate')` for `bank('RolandTR909')` /
`bank('LinnDrum')` etc. and drop the `samples(...)` line.

## Complex techno (level 4) — "deep techno with movement"

```js
setcps(132/60/4)
let chords = chord("<Cm9 Abmaj7 Fm11 Bb7sus>/4").dict('ireal')
stack(
  // Drums sub-group with shared bank + master gain envelope
  stack(
    s("bd*4"),
    s("~ ~ cp ~").gain(0.55).room(0.5).delay(0.4).delaytime(0.375).delayfeedback(0.5),
    s("hh*16").gain(perlin.range(0.25, 0.55)).struct("1 0 1 1 0 1 0 1 1 1 0 1 0 1 1 0"),
    s("~ rim ~ ~ ~ ~ rim ~").gain(0.4).every(4, rev)
  ).bank("RolandTR909"),
  // Sub bass — inherits chord roots, octave jump every 8
  chords.rootNotes(2).s("sine").gain(0.85).attack(0.005).release(0.3).lpf(180)
    .every(8, x => x.add(12)),
  // Mid bass — FM with modulated index for industrial bite
  chords.rootNotes(2).s("sine")
    .fmh(2).fmi(sine.range(2, 9).slow(16))
    .adsr(".005:.05:.6:.15").gain(0.5)
    .struct("1 ~ 1 1 ~ 1 ~ 1"),
  // Chord stab — supersaw 3-osc detune through phaser + delay
  chords.voicing().anchor("c4").layer(
    x => x.s("sawtooth"),
    x => x.s("sawtooth").add(0.07),
    x => x.s("sawtooth").add(-0.07)
  ).attack(0.05).release(0.4).gain(0.18).lpf(sine.range(800, 2400).slow(16))
   .phaser(2).delay(0.3).delaytime(0.375).delayfeedback(0.4)
   .mask("<0 1 1 1>/16"),
  // Counter-melody — slow against the loop, masked in for half the time
  chords.n("0 [3 5] 2 [4 ~ 7]").voicing().anchor("c5")
    .s("triangle").attack(0.1).release(0.5).gain(0.25).room(0.7)
    .slow(3).rarely(ply(2)).mask("<0 0 1 1>/16")
).late("[0 .005]*4").size(3)
```

## Complex deep house (level 4) — "lush, voice-led, polyrhythmic"

```js
setcps(122/60/4)
let chords = chord("<Cm9 Fm11 Bb7sus Ebmaj9>/4").dict('ireal')
stack(
  stack(
    s("bd*4"),
    s("[~ cp]*2").gain(0.85).room(0.4),
    s("hh*16").struct("1 0 1 0 0 1 0 1 1 0 0 1 0 1 0 0").gain(perlin.range(0.3, 0.55)),
    s("~ ~ ~ shaker").gain(0.4).sometimes(fast(2))
  ).bank("RolandTR909"),
  chords.rootNotes(2).s("sawtooth").lpf(sine.range(400, 1800).slow(8)).lpq(15).gain(0.55)
    .every(4, x => x.add(12)),
  chords.voicing().anchor("c4").s("gm_synth_strings_1")
    .attack(0.05).release(0.6).gain(0.4)
    .delay(0.3).delaytime(0.375).delayfeedback(0.45).room(0.5),
  chords.n("0 2 4 5 7 4 2 0").voicing().anchor("c5")
    .s("gm_celesta").attack(0.1).release(0.4).gain(0.22)
    .room(0.7).slow(3).sometimes(rev),
  chords.voicing().anchor("c3").s("gm_pad_warm")
    .attack(0.5).release(1.5).gain(0.18).room(0.7)
    .lpf(sine.range(600, 1400).slow(16)).mask("<0 1 1 1>/16")
).late("[0 .008]*4").size(4)
```

## Complex IDM (level 4–5) — "broken, generative, polymetric"

```js
setcps(160/60/4)
stack(
  stack(
    s("bd*4").chunk(4, x => x.fast(2)).sometimes(rev),
    s("hh*16").gain(perlin.range(0.2, 0.9)).degradeBy(0.3)
      .struct("1 0 1 1 0 1 0 1 1 1 0 1 0 0 1 0"),
    s("~ sd ~ ~").chop(8).clip(rand.range(0.3, 0.7)).gain(0.7),
    s("rim*8").mask("<0 0 1 1 1 0 1 1>/16").gain(0.5).speed("<1 1.5 0.5 1>")
  ).bank("AkaiMPC60"),
  n("0 4 7 5 0 7 4 2".add("<0 5 -3 2>")).scale("D:dorian")
    .s("triangle").lpf(sine.range(400, 3000).slow(7))
    .every(3, x => x.add(12)).rarely(ply(2)),
  note("d2 ~ a1 ~ d2 ~ ~ a1").s("sine").fmh(2).fmi(sine.range(2, 12).slow(11))
    .adsr(".001:.05:.5:.1").gain(0.6).chunk(4, fast(2)),
  note("<f4 ~ a4 c5 ~ a4 f4 ~>").s("gm_celesta")
    .attack(0.05).release(0.4).gain(0.3).room(0.6)
    .delay(0.2).delaytime(0.375).delayfeedback(0.5)
    .slow(5).sometimes(rev)
).late(perlin.range(0, 0.015)).size(3)
```

Note `slow(7)` on the LFO + `slow(3)` and `slow(5)` on melody lines —
seven-against-three-against-five-against-the-4-cycle-loop creates the
hallmark "never-quite-repeats" IDM phase interplay.

## Complex ambient (level 5) — "evolving, layered, breathing"

```js
setcps(60/60/4)
let chords = chord("<Cm9 Abmaj7#11 Fm11 Bb7sus>/8").dict('ireal')
stack(
  // Drone bed — 5-osc detuned supersaw under everything
  chords.rootNotes(2).layer(
    x => x.s("sawtooth"),
    x => x.s("sawtooth").add(0.07),
    x => x.s("sawtooth").add(-0.07),
    x => x.s("sawtooth").add(0.13),
    x => x.s("sawtooth").add(-0.13)
  ).attack(2).release(4).gain(0.12).lpf(perlin.range(300, 1200).slow(32)).room(0.9),
  // Pad — extended chord voicings, slow phaser modulation
  chords.voicing().anchor("c4").s("gm_pad_warm")
    .attack(1).release(3).gain(0.35).room(0.85)
    .phaser(0.25).lpf(sine.range(800, 2200).slow(24)),
  // Melodic murmur — random walk through chord tones
  chords.n(irand(8)).voicing().anchor("c5")
    .s("gm_celesta").attack(0.5).release(2).gain(0.18)
    .room(0.9).delay(0.5).delaytime(0.5).delayfeedback(0.6)
    .slow(7).rarely(rev),
  // Sub pulse — only audible at every cycle change
  chords.rootNotes(1).s("sine").attack(0.1).release(0.8).gain(0.4)
    .struct("1 ~ ~ ~ ~ ~ ~ ~").mask("<1 0 1 1 0 1 1 1>/16"),
  // Air sparkle — high-shelf glitter, sparse
  note("<c6 ~ ~ eb6 ~ g5 ~ ~>").s("triangle")
    .attack(0.3).release(1.5).gain(0.12).room(0.95)
    .delay(0.3).delaytime(0.75).delayfeedback(0.5)
    .slow(4).degradeBy(0.4)
).late(perlin.range(0, 0.02)).size(5).slow(2)
```

## Complex dubstep (level 4) — "multi-LFO wobble, ghost-snare polyrhythm, masked drop"

Level-4 dubstep keeps the half-time DRY identity but pushes density
through *rhythm and modulation depth*, not atmosphere. Multiple LFOs
route to different parameters at different rates (the "talking" effect),
ghost snares add polyrhythmic interest under the main snare hits, and
sectional masking creates a drop / breakdown arc across 16 cycles.

```js
setcps(140/60/4)
stack(
  // Drums sub-stack: layered kit with distort applied to the whole group
  stack(
    s("bd ~ ~ ~ sd ~ ~ ~"),                                         // main kick + snare-on-3
    s("hh*16").gain(perlin.range(0.2, 0.55))
      .struct("1 0 1 1 0 1 0 1 1 1 0 1 0 1 0 0")
      .every(4, fast(2)),                                           // hi-hat roll fill every 4 cycles
    s("~ ~ rim ~ ~ rim ~ ~ rim ~ ~ ~ rim ~ ~ ~").gain(0.4).speed("<1 1.3 0.8>"), // ghost-snare polyrhythm
    s("~ ~ ~ ~ ~ ~ cp ~").gain(0.5).room(0.3).delay(0.2).delaytime(0.375).delayfeedback(0.4)
  ).bank("RolandTR808").distort(0.25),
  // Side-chained deep sub — short envelope so it ducks under the kick
  note("<f1!2 ab1 c2>").s("sine").attack(0.001).release(0.35).gain(0.9).lpf(140)
    .every(8, x => x.add(12)),
  // Main wobble bass — TWO LFOs at different rates routed to lpf + fmi
  note("<f2!2 ab2 c3>").s("sine")
    .fmh(2).fmi(sine.range(1, 8).slow(0.5))                         // FM index wobble (timbral)
    .lpf(sine.range(220, 1800).slow(0.25)).lpq(15)                  // filter wobble (brightness) — 2x faster
    .adsr(".005:.05:.7:.15").gain(0.6).distort(0.2),
  // Masked stab — only present in the "drop" sections (cycles 1, 2, 3 of every 16)
  note("<[f3,ab3,c4]*2 ~ ~ ~ ~>").s("sawtooth").layer(
    x => x, x => x.add(0.07), x => x.add(-0.07)
  ).lpf(sine.range(1000, 4500).slow(0.25)).lpq(20).gain(0.18)
    .mask("<1 1 1 0>/16"),
  // Reese-style mid bass — appears only in the breakdown (inverse mask)
  note("<f3 ~ ab3 ~ c4 ~ ~ ~>").s("sawtooth").layer(
    x => x, x => x.add(0.05), x => x.add(-0.05)
  ).lpf(sine.range(400, 1800).slow(2)).lpq(10).gain(0.32)
    .mask("<0 0 0 1>/16")                                           // inverse of stab — only in breakdown
    .room(0.3)
).late("[0 .008]*4").size(3)
```

The two LFOs at different `.slow()` values (0.5 vs 0.25) are the
secret — they desync over the loop, so the wobble *never quite
repeats* the same shape across consecutive bars. Combined with the
mask that swaps stab and reese-bass roles every 16 cycles, you get a
real drop / breakdown arc without writing an `arrange()`.

## How to use these

1. **Pick the closest example by genre family** (techno / house / IDM / ambient).
2. **Mutate the slots** per the user's request (key, BPM, kit) — keep the structural moves (nested stack, polyrhythm, masking, modulation routing).
3. **Don't drop techniques to "fit"** the user's tweak. If they say "make it darker", lower the LPF range and swap to gm_pad_warm — don't strip the chunk / mask / phaser layers.

## Anti-patterns (these defeat the purpose of "complex")

- ❌ Stacking 6 nearly-identical layers (3 different supersaw pads in the same register) — that's "soup," not complexity. Different *roles*: rhythm + counter-rhythm + harmony + counter-melody + texture + atmosphere.
- ❌ Hitting `.mask("<0 0 1 1>/16")` on every layer — masking is sectional gating; if everything masks the same way, the texture flat-lines together.
- ❌ Ignoring polyrhythm. Level 4+ requires at least one layer running at a different denominator (`slow(3)`, `slow(5)`, `slow(7)` against the 4-cycle base, OR a `struct` pattern with prime-number length).
- ❌ Modulating *every* parameter on *every* layer with `sine.range()` — pick 2–3 modulation routings total. Mass modulation = wobbly mush.
- ❌ Forgetting `.late(...).size(...)` on the master — the eddyflux trick of trailing `.late("[0 .01]*4").late("[0 .01]*2").size(4)` is what gives the whole mix its "produced" feel. Apply at the outermost `stack(...)`.
