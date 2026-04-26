# Reference: sounds (`s(...)`, `note(...)`, `.bank(...)`)

Picking a sound that doesn't exist throws `sound X not found` in the user's
console. Be strict — only use names from this file.

## Three ways to make a sound

| Use this | When | Example |
| --- | --- | --- |
| `s("...")` | Drums and named samples / soundfonts | `s("bd*4").bank("RolandTR909")` |
| `note("...").s("...")` | Pitched melodic / bass parts | `note("c2 g1 a1 e1").s("sawtooth")` |
| `n("...").s("...")` | Cycling through indices of a sample bank | `n("0 1 2 3").s("piano")` |

## Synth waveforms — pitched, no samples needed

These are always available; they are real oscillators in `superdough`.

```
sine (alias sin), sawtooth (alias saw), square (alias sqr),
triangle (alias tri), white, pink, brown
```

```js
note("c2 ~ eb2 g2").s("sawtooth").lpf(800)        // synth bass
note("c4 e4 g4").s("triangle").gain(0.5)          // soft melody
note("c3").s("square").lpf(2000).gain(0.3)        // 8-bit lead
s("white*8").gain(perlin.range(0,0.5))            // noise hat
```

There is **no** `s("bass")`, `s("lead")`, `s("pad")`, `s("synth")`, `s("808")`.
Build those from waveforms + filters + envelopes (see `reference/effects.md`).

## Drum aliases — mini-notation strings

Use any of these inside `s("...")`. They resolve through the active drum-machine
bank (set with `.bank(...)`).

```
bd  (kick)        sd  (snare)       hh  (closed hat)   oh  (open hat)
cp  (clap)        rim (rimshot)     cr  (crash)        rd  (ride)
lt  (low tom)     mt  (mid tom)     ht  (high tom)     cb  (cowbell)
tb  (tambourine)  sh  (shaker)      misc              perc
brk (break)
```

## Drum-machine banks (`.bank("...")`)

Common verified banks:

```
RolandTR808       RolandTR909       RolandTR707
LinnDrum          AkaiMPC60         AkaiXR10
OberheimDMX       KorgKR55          EmuDrumulator
RhythmAce         ViscoSpaceDrum
```

```js
s("bd*2, ~ sd, hh*8").bank("RolandTR909")         // 909 kit
s("bd ~ sd ~, hh*8?").bank("LinnDrum")            // dustier
```

Without `.bank(...)`, Strudel uses a default kit — still works.

## Piano

`s("piano")` — the default Salamander grand piano sample bank. Pair with `note(...)`.

```js
note("c3 e3 g3 c4").s("piano").room(0.4)
```

## General-MIDI soundfonts

Auto-registered. Use them with `s("gm_<name>")`. Verified-useful list:

```
gm_piano   gm_epiano1   gm_epiano2
gm_celesta                gm_xylophone          gm_marimba
gm_vibraphone

gm_acoustic_bass          gm_electric_bass_finger
gm_electric_bass_pick     gm_synth_bass_1       gm_synth_bass_2

gm_violin     gm_cello    gm_string_ensemble_1
gm_synth_strings_1

gm_pad_warm   gm_pad_poly
gm_lead_1_square   gm_lead_2_sawtooth

gm_choir_aahs   gm_voice_oohs
gm_brass_section   gm_trumpet   gm_alto_sax
gm_flute   gm_clarinet

gm_overdriven_guitar   gm_distortion_guitar   gm_acoustic_guitar_steel
```

```js
note("c3 g3 c4 g3").s("gm_epiano2").room(0.6)
note("c2 c2 g1 c2").s("gm_synth_bass_1")
```

## VCSL orchestral sample names

A small library of orchestral / world percussion samples. These are samples
(not synths), so they have a fixed pitch unless explicitly sample-pitched:

```
bassdrum1, bassdrum2, bongo, conga, darbuka, framedrum,
snare_modern, snare_hi, snare_low, timpani,
bowed_glass, melodica, harp
```

Use them as `s("bongo*4")` etc. Pitching them with `note(...)` only works
reliably when you know the underlying sample is pitched (e.g. `harp`,
`melodica`).

## Picking a sample variant — `.n(N)`

Many `s(...)` names actually have multiple sub-samples. `.n(N)` selects which
one (0-indexed):

```js
s("bd*4").n("<0 1 2 3>")    // cycle through the four available BDs
```

## What to do when no sound matches the user's vibe

If the user says "make a vibey 808 bass", `s("808")` is **not** a sound. Build:

```js
note("c2*8".add("<0 7 5 3>")).s("sawtooth").lpf(sine.range(400,1800).slow(4)).lpq(15).gain(0.6)
```

If the user says "soft pad", combine `gm_pad_warm` (or `triangle` + long
attack/release + reverb) — see `examples/genres.md` "Ambient pad".

## Anti-patterns (don't do these)

- `s("RolandTR909_bd")` — use `s("bd").bank("RolandTR909")`.
- `s("Roland 909")` — banks have no spaces; use exact name.
- `s("piano1")` — `s("piano")` is the only verified piano name.
- `s("808kick")`, `s("kick")` — use `s("bd")`.
- `s("hat")`, `s("hihat")` — use `s("hh")` for closed, `s("oh")` for open.
- `note("c3").s("808")` — there is no `808` sound; use `sawtooth`/`triangle`.
