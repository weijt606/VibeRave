# Examples: kid-friendly / K-12 classroom templates

Templates designed for primary-school music demos. The defining
properties are: **bright major keys, acoustic GM instruments, no
heavy filtering or distortion, recognizable melodic shapes, modest
loudness, 3–4 layers max.** No 808 sub, no FM growl, no `.crush()`,
no Berghain / brostep / dark / brooding.

These activate when `rules/family-mode.md` triggers (kid / nursery /
classroom / 儿歌 / 课堂 / 小朋友 keywords), OR when the user names one
of these template categories explicitly.

## Nursery rhyme (twinkle-style, C major, 80 BPM)

A simple I–vi–IV–V progression with a melody walking the C major
scale. **No drums** — kids' nursery songs are acoustic / unaccompanied
by default; adding a drum kit makes it sound like a backing track
rather than a song to sing along to.

```js
setcps(80/60/4)
stack(
  note("<c4 c4 g4 g4 a4 a4 g4 ~ f4 f4 e4 e4 d4 d4 c4 ~>")
    .s("gm_grand_piano").gain(0.6).attack(0.02).release(0.3).room(0.3),
  note("<c2 a1 f2 g2>").s("gm_acoustic_bass").gain(0.45)
)
```

## Lullaby (music box, slow 6/8, gentle)

`gm_celesta` gives the music-box character. Single melody line, very
soft pad underneath, lots of room for the breathing sustain.

```js
setcps(60/60/6)
stack(
  note("<[c5 e5 g5 e5 g5 e5] [a4 c5 e5 c5 e5 c5] [f4 a4 c5 a4 c5 a4] [g4 b4 d5 b4 d5 b4]>")
    .s("gm_celesta").attack(0.05).release(0.5).gain(0.5).room(0.65),
  note("<c3 a2 f2 g2>").s("gm_pad_warm").attack(0.6).release(1.6).gain(0.22).room(0.7)
).slow(2)
```

## Marching band (4/4, brass + drums, 110 BPM)

Quarter-note bass drum is the march pulse; snare on beats 2 and 4 is
the classic military backbeat. Uses **VCSL acoustic samples** (`bassdrum1`,
`snare_modern`) instead of drum-machine kits — they sound like a real
marching band, not a 808/909 club. Drum gain dialled down so the brass
melody stays in front.

```js
setcps(110/60/4)
stack(
  s("bassdrum1*4").gain(0.55),
  s("~ snare_modern ~ snare_modern").gain(0.4),
  note("<g4 g4 g4 c5 ~ e5 d5 c5 d5 e5 ~ g5 ~ ~ ~ ~>")
    .s("gm_brass_section").attack(0.02).release(0.2).gain(0.7),
  note("<c2 ~ g2 ~>").s("gm_brass_section").gain(0.5).lpf(700)
)
```

## Waltz (3/4, piano + strings, 90 BPM)

The "oom-pah-pah" of waltz: bass on 1, chord on 2 and 3. Strings
carry the flowing melody on top. Gentle room reverb so it feels
"ballroom."

```js
setcps(90/60/3)
stack(
  note("<c2 ~ ~>").s("gm_acoustic_bass").gain(0.5),
  note("~ [c3,e3,g3] [c3,e3,g3]").s("gm_grand_piano")
    .gain(0.4).attack(0.05).release(0.4),
  note("<g4 e4 c5 d5 c5 e4 g4 a4 c5 a4 ~ g4>")
    .s("gm_violin").attack(0.1).release(0.5).gain(0.5).room(0.45)
)
```

## Cartoon chase (fast syncopated brass, 145 BPM)

Tom-and-Jerry / Looney-Tunes feel — runs of brass over a bouncing
walking bass. Uses **hand percussion** (`bongo`, `conga`) instead of a
drum kit — gives the chase its bouncy, comedic character without the
electronic-club feel of `bank("LinnDrum")`.

```js
setcps(145/60/4)
stack(
  s("bongo*4").gain(0.4),
  s("~ ~ conga ~").gain(0.4),
  note("<c4 e4 g4 e4 c4 e4 g4 a4 g4 e4 c4 e4 g4 a4 c5 b4>")
    .s("gm_brass_section").gain(0.65).attack(0.01).release(0.15),
  note("<c2 e2 g2 e2 c2 e2 g2 a2>").s("gm_acoustic_bass").gain(0.5)
)
```

## Happy 8-bit game (bright chiptune, F major, 130 BPM)

The kid-safe version of chiptune — bright square lead in F major,
triangle bass bouncing octaves, no `.crush()` (clean 8-bit, not the
NES-distort kind). Drums kept light — a single rim tick + soft kick
so the melody and bass are the star. No 909 / 808 — Mario didn't
have a club kit either.

```js
setcps(130/60/4)
stack(
  s("bassdrum1 ~ ~ ~").gain(0.45),
  s("~ ~ rim ~").bank("LinnDrum").gain(0.3),
  note("<f4 a4 c5 f5 a4 c5 f5 d5 c5 a4 g4 f4>")
    .s("square").gain(0.55).lpf(3000),
  note("<f2 f3 c2 c3 a1 a2 c2 c3>").s("triangle").gain(0.65)
)
```

## Polka (2/4, oompah, accordion-like, 115 BPM)

Oompah bass is the polka signature: low note on 1, chord on 2. Fast
16th-note clarinet melody on top. Acoustic snare on 2 (real polka
backbeat) instead of drum-machine snare.

```js
setcps(115/60/2)
stack(
  note("<c2 [c3,e3,g3] g1 [c3,e3,g3]>")
    .s("gm_brass_section").gain(0.55).attack(0.02).release(0.2),
  s("~ snare_low").gain(0.4),
  note("<g4 a4 b4 c5 d5 c5 b4 a4 g4 a4 g4 e4 ~ d4 e4 g4>")
    .s("gm_clarinet").gain(0.55).attack(0.02).release(0.18)
)
```

## Animal carnival (Saint-Saëns-style descriptive, 95 BPM)

Pictorial: flute as a soaring bird, cello as a heavy walking animal,
celesta as occasional sparkle. **No drums** — Saint-Saëns'
"Carnival of the Animals" is purely orchestral; drum-machine ticks
break the imagination of "this is an animal walking." Great for
"guess what animal this is" classroom games.

```js
setcps(95/60/4)
stack(
  note("<g5 a5 b5 c6 b5 a5 g5 e5 ~ c5 d5 e5 g5 ~ ~ ~>")
    .s("gm_flute").gain(0.55).attack(0.03).release(0.3).room(0.45),
  note("<c2 ~ g1 ~ a1 ~ f2 ~>")
    .s("gm_cello").attack(0.12).release(0.5).gain(0.55).lpf(900),
  note("<~ c5 ~ e5>").s("gm_celesta").gain(0.32).room(0.55)
)
```

## Piano scale practice (educational, 70 BPM)

A complete C major scale up and down at a slow tempo. **No drums** —
the focus is the scale; a metronome tick would distract. If the
teacher wants a metronome, they can ask for it ("with metronome
clicks") and the LLM will add a soft `s("rim").gain(0.2)`.

```js
setcps(70/60/4)
note("c4 d4 e4 f4 g4 a4 b4 c5 c5 b4 a4 g4 f4 e4 d4 c4")
  .s("gm_grand_piano").gain(0.6).attack(0.02).release(0.3)
```

## Music box solo (very simple, very gentle)

Single layer — just the celesta carrying a slow melodic arc. Useful
when the room is loud and you want to draw attention to silence.

```js
setcps(55/60/4)
note("<c5 e5 g5 e5 a4 c5 e5 c5 f4 a4 c5 a4 g4 b4 d5 b4>")
  .s("gm_celesta").attack(0.05).release(0.6).gain(0.5).room(0.6).slow(2)
```

## How to extend (for teachers comfortable editing code)

To add a new kid-friendly template:

1. Pick a recognizable musical idiom (folk dance, hymn, sea shanty, etc.).
2. Use the allowed palette from `rules/family-mode.md` — gm_* instruments + triangle/square only, no FM, no .crush(), no .distort(), no sub bass.
3. Stay within the BPM range 60–145 and use a major key by default.
4. Aim for 3–4 layers. Keep the lead melody between c4 and c6 — that's the comfortable singing register for kids to hum along.
5. Soft attacks (>= 0.02 s) so notes don't startle.

## Anti-patterns (these get the K-12 mode disabled)

- ❌ Adding `.s("sine").fmh(2).fmi(...)` — FM growl is too aggressive
- ❌ `.crush(8)` for "chiptune" — use the **Happy 8-bit** template above which is crush-free
- ❌ `.bank("RolandTR808")` with low-tuned 808 sub — overwhelming bass for primary school speakers
- ❌ Modal music (`.mode("phrygian")` / `.mode("locrian")`) — too "dark" for kids by default. Use major (default scale) or minor only if the user asked for sad / lullaby
- ❌ `.lpf` < 600 — creates ominous "horror movie" filter sweeps
- ❌ Anything from `rules/lushness.md` Tier B that's also in the heavy electronic family (dubstep / brostep / phonk / drill / IDM / breakcore / hard techno / industrial)
