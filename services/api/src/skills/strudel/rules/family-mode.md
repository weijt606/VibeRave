# Rule: family mode (K-12 / classroom / kid-friendly)

This rule activates **only** when the user's prompt contains a kid /
classroom keyword. When inactive, the rest of the skill applies
normally (all genres, all complexity levels). When active, this rule
**overrides** lushness / sound-design / complexity defaults to make
the output safe and pedagogical for primary-school audiences.

## Activation triggers

Scan the prompt + recent history. Activate if ANY match (case-
insensitive):

**English**: for kids, kid-friendly, child, children, kindergarten,
elementary, primary school, K-12, classroom, school music, nursery
rhyme, lullaby, march for kids, music for kids, simple kids song

**Chinese**: 儿童, 小朋友, 小孩, 小学生, 幼儿园, 课堂, 上课, 儿歌,
童谣, 摇篮曲, 进行曲, 行进曲, 学校音乐, 教学示范, 给孩子, 给小朋友,
适合小学

When the user names one of the kid-template categories directly
(*"nursery rhyme"*, *"lullaby"*, *"marching band for school"*,
*"cartoon chase"*, *"polka"*, *"animal carnival"*) — also activate.

If none of these keywords match, **ignore this entire rule** — the
user wants the regular skill behaviour.

## When active, all of the following apply

### Sound palette — ONLY these are allowed

**Melodic / harmonic**:
- `gm_grand_piano`, `gm_epiano1`, `gm_epiano2`
- `gm_marimba`, `gm_xylophone`, `gm_glockenspiel`, `gm_celesta`, `gm_vibraphone`
- `gm_flute`, `gm_clarinet`, `gm_alto_sax`, `gm_trumpet`
- `gm_violin`, `gm_cello`, `gm_string_ensemble_1`, `gm_synth_strings_1`
- `gm_brass_section`
- `gm_acoustic_bass`, `gm_acoustic_guitar_steel`
- `gm_choir_aahs`, `gm_pad_warm` (very soft only)
- Synth waveforms: `triangle`, `square` (bright leads only — never paired with `.crush()`)

**Drums — prefer acoustic samples over drum-machine kits**:

The single biggest classroom-feel killer is drum machines. `RolandTR909`
/ `RolandTR808` / `LinnDrum` all sound "electronic" to young ears even
at low gain. In family mode, reach for **VCSL acoustic samples** instead:
- `s("bassdrum1")` / `s("bassdrum2")` — orchestral bass drum
- `s("snare_modern")` / `s("snare_low")` / `s("snare_hi")` — acoustic snares
- `s("bongo")` / `s("conga")` / `s("darbuka")` / `s("framedrum")` — hand percussion (great for animal / cartoon / chase feels)
- `s("timpani")` — orchestral kettledrum (for "epic" moments)

`bank("RolandTR909")` / `bank("RolandTR808")` are **prohibited** in family
mode. `bank("LinnDrum")` is allowed sparingly — only for **soft tick
sounds** like `s("rim").bank("LinnDrum").gain(0.3)` as a metronome
substitute. Never use `bank("LinnDrum")` on `bd` / `sd` for kid templates.

**Drum gain caps** (much lower than adult electronic music):
- `s("bassdrum1")` / `s("bd")`: ≤ 0.55
- `s("snare_modern")` / `s("sd")`: ≤ 0.45
- `s("bongo")` / `s("conga")`: ≤ 0.4
- Hi-hat / rim / shaker: ≤ 0.3

**Drum-less is often best**. Many kid-template categories have NO drums:
- Nursery rhymes (twinkle / mary had / 儿歌) — no drums, acoustic only
- Lullabies (摇篮曲) — no drums
- Animal carnival (动物嘉年华) — no drums; pictorial orchestration only
- Music box solos — no drums
- Scale practice — no drums (the focus is the scale)
- Waltzes — bass + chord oompah replace drums

If the user doesn't ask for drums in a kid-mode prompt, **omit them**. Adding
a drum kit "for completeness" makes the output feel like a backing track
rather than a song to sing along with.

### Forbidden in family mode

- **FM synthesis** — `.fmh`, `.fmi`, `.fmenv` (too metallic / industrial)
- **Bit-crush at any depth** — `.crush(N)` for any N. Bright 8-bit comes from `square` + `triangle` alone
- **Distortion** — `.distort(N)`, `.shape(N)`
- **Dark filtering** — `.lpf` < 600 Hz (creates ominous tones)
- **High resonance** — `.lpq` > 12 (squelchy / aggressive)
- **Sub bass** — `.s("sine")` below note `f1` for bass roles; never `s("808")`-style territory
- **`.bank("RolandTR808")`** — its 808 sub kicks are too loud for school speakers
- **Heavy reverb** — `.room` > 0.7 (except music-box lullaby, capped at 0.7)
- **Heavy delay feedback** — `.delayfeedback` > 0.5
- **Dark / brooding modes** — `.mode("phrygian")`, `.mode("locrian")`. Default major; minor only if user asked for sad / lullaby
- **The "dark / aggressive" genre family** — Berghain, hyperpop, brostep, dubstep, phonk, drill, trap, IDM, breakcore, hard techno, industrial, gabber, drone, dark ambient, riddim. If the user says "techno for kids", reach for the **march** or **polka** template instead.

### Required in family mode

- **Major key by default** — C major, F major, G major, D major. Only use minor if user explicitly asked for *sad / 悲伤* / *lullaby* (and even then prefer A minor / D minor — natural sounding, not exotic).
- **BPM 60–145** — slower for lullabies and scale practice, faster for marches and chases. Default 100 BPM when unspecified.
- **Maximum 4 layers** — kids' ears get overwhelmed by busy textures.
- **Gain caps**: melodic lead ≤ 0.7, bass ≤ 0.5, drums ≤ 0.55 on kick / ≤ 0.45 on snare / ≤ 0.4 on hand-percussion / ≤ 0.3 on hi-hat. The mix must be quiet enough to play through a small classroom speaker without ear fatigue. **In family mode the melody / bass / pad are the foreground; drums are background or absent.**
- **Lead melody must follow a recognizable shape**: scale walk (`c4 d4 e4 f4 g4...`), triad arpeggio (`c4 e4 g4`), pentatonic line, or known idiom (twinkle, frère jacques, ode to joy contour). NO random `irand()` walks, NO chromatic atonal lines.
- **Soft attacks**: `.attack(0.02)` minimum on melodic / chord layers. Hard attacks (< 0.005s) startle young listeners.
- **Bass register**: stay above note `c2`. No rumble below 60 Hz.

### Template defaults — keyword routing

The kid-friendly templates live in `examples/kids.md`. Route prompts as:

| User says | Pick template |
|---|---|
| nursery rhyme, twinkle, 儿歌, 童谣, simple kids song | **Nursery rhyme** (twinkle-style C major) |
| lullaby, music box, 摇篮曲, 哄睡, sleepy | **Lullaby** (celesta 6/8) — OR **Music box solo** if very minimal |
| march, marching band, 进行曲, 行进曲, school march, parade | **Marching band** (brass + bass drum 110 BPM) |
| waltz, ballroom, 华尔兹, 三拍子 | **Waltz** (piano + violin 3/4 90 BPM) |
| cartoon, chase, Tom and Jerry, looney tunes, 动画追逐 | **Cartoon chase** (syncopated brass 145 BPM) |
| 8-bit (kid context), Mario, Sonic, video game, 电子游戏, 游戏曲 | **Happy 8-bit game** (square + triangle, no crush) |
| polka, oompah, accordion (kid context) | **Polka** (oompah brass 115 BPM) |
| animal, bird, elephant, 动物, 嘉年华, Saint-Saëns | **Animal carnival** (flute + cello + celesta) |
| scale, scale practice, do re mi, 音阶, 练习 | **Piano scale practice** (C major up + down) |
| music box (alone), 音乐盒, very gentle, super simple | **Music box solo** (single celesta line) |

If the user names a genre that's normally aggressive (techno / dubstep
/ trap / hyperpop) in a kid-mode prompt, **substitute the closest
kid-friendly idiom**:
- "techno for kids" → **Marching band** (same 4/4 driving feel, kid-safe instruments)
- "dubstep for kids" → **Cartoon chase** (syncopated, energetic, no wobble)
- "house for kids" → **Polka** (4-on-floor feel, oompah character)
- "hyperpop for kids" → **Happy 8-bit game** (bright, fast, major key)

### Iteration in family mode

When iterating on a kid-mode track:
- Preserve the kid-mode constraints — never introduce FM / crush / distort / dark filter on a follow-up turn.
- "louder" → raise gain ≤ 0.7 cap, no further.
- "more energetic" → raise BPM or add `.fast(2)` on one layer; don't add aggressive new layers.
- "different instrument" → swap within the allowed palette only.

If the user exits family mode (next prompt has no kid keywords), the
normal skill takes over again — no carryover.

## Why this rule exists

Primary-school speakers, ear sensitivity, parental expectations, and
classroom noise levels all argue against the default electronic-music
palette of the skill. A teacher demoing VibeRave to 8-year-olds
should not get a Berghain track, an FM growl, or a `.crush(8)` 8-bit
explosion. This rule trades a slice of the skill's range for a
guarantee: when a teacher says "for the kids", what comes out will be
classroom-appropriate every single time.

## Anti-patterns (do NOT do these in family mode)

- ❌ Mixing kid keywords with adult genres and producing the adult genre (*"trap for kids"* → must come out as **Cartoon chase** or **Marching band**, not soft-trap)
- ❌ Adding "atmospheric" reverb tails > 0.7 just because the skill default says lush — kids find heavy reverb spooky
- ❌ Treating "music box" as license to use the celesta in a dark or chromatic way — music box is gentle major arpeggios only
- ❌ Producing a 5+ layer "complex" track even if user asked for it — the 4-layer cap holds for kid audiences
