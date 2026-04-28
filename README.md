<h1 align="center">VibeRave</h1>

<p align="center">
  <img src="docs/images/viberave-banner.png" alt="VibeRave — multimodal music engine" width="100%" />
</p>

<p align="center">
  <strong>Vibe-code rave music — speak it, type it, or click it.</strong>
</p>

<p align="center">
  Multimodal live coding for <a href="https://strudel.cc">Strudel</a>: hold a key
  to talk, hit Enter to type, or click a preset chip.<br/>
  Same agent loop, same hot-swap — no broken beats.
</p>

<p align="center">
  <a href="#quickstart"><img src="https://img.shields.io/badge/Quickstart-ec4899?style=for-the-badge" alt="Quickstart"></a>
  <a href="#input-modes"><img src="https://img.shields.io/badge/Input%20modes-22d3ee?style=for-the-badge" alt="Input modes"></a>
  <a href="#ui-guide"><img src="https://img.shields.io/badge/UI%20guide-ec4899?style=for-the-badge" alt="UI guide"></a>
  <a href="#prompt-cookbook"><img src="https://img.shields.io/badge/Prompt%20cookbook-22d3ee?style=for-the-badge" alt="Prompt cookbook"></a>
  <a href="#backend-matrix"><img src="https://img.shields.io/badge/Backends-ec4899?style=for-the-badge" alt="Backends"></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/Architecture-22d3ee?style=for-the-badge" alt="Architecture"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-ec4899?style=for-the-badge" alt="License: AGPL-3.0"></a>
</p>

<p align="center">
  <a href="https://github.com/weijt606/VibeRave/stargazers"><img src="https://img.shields.io/github/stars/weijt606/VibeRave?style=flat-square&color=ec4899" alt="GitHub stars"></a>
  <a href="https://strudel.cc"><img src="https://img.shields.io/badge/built%20on-Strudel-22d3ee?style=flat-square" alt="Built on Strudel"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A520.6-22d3ee?style=flat-square" alt="Node ≥ 20.6">
  <img src="https://img.shields.io/badge/PRs-welcome-ec4899?style=flat-square" alt="PRs welcome">
</p>

<br/>

VibeRave is a fork of [Strudel](https://strudel.cc) that adds a multimodal
agent loop on top — voice, text, and one-click chip presets are all
first-class entry points to the same code-generation pipeline. It is fully
open source: every backend can be swapped between **local-only** (offline,
free) and **cloud** (faster, more accurate) — you can run the whole stack
with no paid services.

```
       you (in your room or on stage)
            ├─ 🎙  voice  →  STT (whisper · vosk · any OpenAI-compat /audio API)
            │                       │
            ├─ ⌨   typing  ─────────┤
            │                       ▼
            └─ 🔘  chip click  →  LLM (any OpenAI-compat chat API · or Ollama)
                                     │
                                     ▼
                              Strudel code
                                     │
                                     ▼
                       hot-swap into the in-browser scheduler

            the music keeps playing — your edit lands on the next cycle
```

<br/>

---

<br/>

## Features

- **Multimodal input** — voice (push-to-talk), text (typing), and one-click
  chip presets are all first-class. Mix and match in the same session — voice
  for fast generation, typing for precise edits, chips for the most-used
  commands. All three feed into the same LLM agent loop.
- **Hot-swap live coding** — every command edits the pattern that's currently
  playing; the audio scheduler keeps the beat across the swap.
- **Pluggable STT** — three speech-to-text backends, switchable per request:
  `whisper` (local), `vosk` (local, sub-15 ms on a closed grammar), or
  `api` (any OpenAI-compatible `/audio/transcriptions` endpoint, including
  Qwen DashScope's native paraformer / fun-asr path).
- **Pluggable LLM** — `api` (any OpenAI-compatible Chat Completions endpoint)
  or `ollama` (local, no API key, runs on your laptop). Configure both from
  the in-app **API Settings** panel — no `.env` editing required.
- **Multi-track** — independent tracks with per-track visualizers
  (pianoroll / waveform / spectrum / scope / spiral); all share one global
  cycle clock so beats align.
- **Command queue** — submit while a previous prompt is still generating;
  prompts queue and fire in order. Drop one with × before its turn.
- **Click-to-prompt chips** — 10 canonical commands above the input. Click
  fills the textarea (does not auto-send), so you can edit before sending.
- **Per-take metrics + stage dumps** (optional) — every voice take can be
  persisted as `raw.wav` + transcript + JSON metrics so you can A/B
  different STT backends offline.

<br/>

<p align="center">
  <img src="docs/images/demo-1.gif" alt="VibeRave — live demo (voice → LLM → hot-swap → music)" width="100%" />
</p>

<br/>

---

<br/>

## Input modes

VibeRave is **dual-input by design**. Pick whichever feels right for the moment
— or switch mid-session.

| Mode | How | When to use |
|---|---|---|
| 🎙 **Voice (push-to-talk)** | Hold the configured PTT key (default <kbd>Space</kbd>) anywhere on the page, speak a command, release | Live performance, hands-on-controller flow, "make it dubby" while watching the dancefloor |
| ⌨ **Text (typing)** | Type directly into the textarea, press <kbd>Enter</kbd> | Precise prompts ("Berghain techno at 132 bpm with sidechain on the bass"), debugging when STT mis-hears, quiet rooms |
| 🔘 **Chip presets** | Click any of the 10 prompt chips above the textarea | First-run discoverability, sub-second canned commands during a demo, when you forget the exact phrase |

All three feed the same backend pipeline. Voice goes through STT first; text
and chips skip that hop entirely. **The LLM doesn't know or care which mode
fired the prompt.**

A common workflow is *voice for speed, text for precision*: start a track
with "lo-fi beat at 80 bpm" by voice, then type a precise iteration like
"raise lpf on the bass to 1200, add 1/4-dotted delay on the rhodes."

<br/>

---

<br/>

## Quickstart

> **Goal: from `git clone` to your first track in under 5 minutes.**

### 0. Prerequisites

| | Requirement |
|---|---|
| Runtime | **Node ≥ 20.6** &nbsp;·&nbsp; **pnpm ≥ 9** &nbsp;·&nbsp; Chrome / Edge / Firefox 118+ |
| Hardware | A microphone — only required if you want voice input. Text input works on any device |
| Account (pick one) | An API key from any OpenAI-compatible provider (free tiers exist for Groq, OpenAI, OpenRouter, Qwen, Gemini), **or** [Ollama](https://ollama.com/) running locally with a model pulled |

### 1. Clone + install + start

```bash
git clone https://github.com/weijt606/VibeRave.git
cd VibeRave
pnpm install
cp .env.example .env        # leave the placeholders — config happens in-app
pnpm dev
```

You should see two URLs in the terminal:
```
[web]  http://localhost:4321/
[api]  Server listening at http://localhost:4322
```

### 2. Configure your provider in the browser

1. Open <http://localhost:4321/>.
2. Click the **api** tab in the right-hand panel.
3. **Language Model** section → pick a preset chip (OpenAI / Groq / OpenRouter / Qwen / Ollama / Custom), paste your API key.
4. Click **Test LLM** → you should see `✓ <ms> · <model>`. If you see ✗, fix the error before continuing — almost always wrong key, wrong base URL, or wrong model name.
5. **Speech-to-Text** section → leave it on **Whisper** for the first run (zero config, downloads automatically).
6. Click **Test STT** → `✓ <ms> · base.en`.

> Settings persist in your browser's localStorage. They never leave your machine except as headers on requests to your own backend, which forwards them to the chosen provider.

### 3. Drive it — voice, text, or chips

Click the `+` at the top of the left column to create your first track. Then
pick whichever input mode feels right:

**Voice** (push-to-talk):
1. Hold **Space** anywhere on the page, say *"lo-fi beat at eighty BPM"*, release.
2. The transcript appears in the textarea, auto-sends after ~2 seconds, the editor fills with Strudel code, the music starts playing.
3. Hold Space again, say *"more reverb"*. The new pattern hot-swaps on the next cycle.

**Text** (typing):
1. Click in the textarea, type *"lo-fi beat at 80 bpm"*, press <kbd>Enter</kbd>.
2. Same agent loop, just no STT hop. Lower latency, perfect recognition.

**Chips** (one click):
1. Click any chip above the textarea (`lo-fi beat`, `Berghain techno`, `add reverb`, …) — it fills the prompt.
2. Edit if you want, then press <kbd>Enter</kbd> or click **Send**.

> Don't know what to say? Jump straight to the [Prompt cookbook](#prompt-cookbook) — it has session walkthroughs and one-liners for lo-fi, Berghain techno, jazz progressions, hyperpop, and more.

### Switching STT backends later

The fastest path is the **api** tab; the table below describes when to pick which.

| Backend | Best for | Setup |
|---|---|---|
| **Whisper** (default) | Privacy / offline / no setup | Auto-downloads `base.en` (~150 MB) on first record. Edit `WHISPER_MODEL` in `.env` for `medium.en` / `large-v3-turbo`. |
| **VOSK** | Sub-15 ms latency on the canonical command vocabulary | One-time model download — see "Optional: VOSK setup" below. |
| **API** (OpenAI Whisper / Groq Whisper / self-hosted) | Best free-form accuracy | Pick the preset, paste a key, **Test STT**. |
| **Qwen DashScope native** | DashScope ASR (paraformer / fun-asr) | Native adapter, separate from the OpenAI-compatible path. |

#### Optional: VOSK setup

```bash
cd services/api/models
curl -LO https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip && rm vosk-model-small-en-us-0.15.zip
```

Then pick **VOSK (local, ~10ms)** in the api panel. The matched vocabulary
mirrors the prompt-chip list (`DEMO_GRAMMAR` in
`services/api/src/infrastructure/vosk-transcriber.mjs`) — add phrases there
to expand what VOSK will accept.

### Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| **Test LLM ✗ HTTP 401** | Wrong API key or you pasted into the wrong provider preset. |
| **Test LLM ✗ HTTP 404** | Wrong base URL or model name. Double-check the preset filled the right URL — some providers nest the path (e.g. `/v1` vs `/openai/v1`). |
| **Test STT ✗ HTTP 404 on DashScope** | DashScope's OpenAI-compat shim has no `/audio/transcriptions`. Use the **Qwen (DashScope native)** preset instead of plain Custom. |
| **First voice take takes 5+ seconds** | Whisper's `medium.en` model is downloading or pre-warming. Subsequent takes are ~700-900 ms. |
| **No mic prompt / "Could not start recording"** | Browser blocked microphone access. Click the lock icon in the URL bar → allow Microphone. Reload. |
| **Tracks drift / beats don't align** | Should not happen on `main` — sync is hard-coded on. If you see it, file an issue with browser + Strudel pattern code. |
| **Browser console shows CORS errors** | The web app is not on `localhost:4321` (or wherever the API expects). The API has CORS open by default; check your reverse proxy rewrites if you've fronted it with one. |

---

## UI guide

The interface has four regions. If you've used the Strudel REPL, the
left and bottom areas will look familiar; the right panel and the
multi-track UI are VibeRave-specific.

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │  ◐  VIBERAVE                                                         │  ← header (logo only)
 ├────────────────────────────────────┬─────────────────────────────────┤
 │  + New track  ■ Stop all  🗑 Clear │  [vibe] [api] [sounds] ...      │  ← tabs row
 ├────────────────────────────────────┤▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  │  ← cycle indicator (1px, scans per cycle)
 │ ▶ ⚡ ● Track 1 ┃ABC┃ ▮▮▮ 🗑 │ Piano roll ▼  │                         │
 │ ┌────────── viz canvas ─────────┐  │   (drag bottom edge to resize)  │
 │ │ ▓▓▓▓ ▓▓▓ ▓▓▓▓▓ (per-track)    │  │                                 │
 │ └───────────────────────────────┘  │     Vibe / API / Settings panel │
 │ ▶ ⚡ ● Track 2 ┃ABC┃ ▮▮▮ 🗑 │Scope ▼│                                 │
 │ ┌─── viz canvas ───┐               │                                 │
 │ │ ~~~~~~~~~~~~~    │               │                                 │
 │ └──────────────────┘               │                                 │
 ├────────────────────────────────────┤                                 │
 │  </>  CODE · TRACK 1   ▼   ▶ APPLY │                                 │  ← collapsible code panel
 │  // CodeMirror editor for selected track                             │
 └──────────────────────────────────────────────────────────────────────┘
```

### Track row

Each track has its own row with:

| Element | Function |
|---|---|
| ▶ / ■ | Play / stop **just this track** (other tracks keep playing) |
| ⚡ | **Spotlight** — fade other playing tracks down over ~1.5 s, leave only this one |
| ● dot | Status: cyan glow + pulse = playing · magenta = LLM generating · grey = idle |
| Name | Double-click to rename |
| `ACTIVE` badge | Visible only on the selected track (yellow hazard-tape row) |
| Level bar | 60 × 4 px deep-cyan bar — live RMS of this track's audio output |
| 🗑 | Delete this track (asks confirmation) |
| Viz dropdown | Top-right — pick the visualization style (see below) |

Selected track gets a **yellow hazard-tape** background; unselected
tracks have a subtle white card overlay so they don't blend into the
dark theme.

### Visualization modes

11 per-track modes, all reading from the same per-track `AnalyserNode`.
**Drag the bottom edge of the canvas** to resize a row's viz height
(40–480 px, persisted per track). Square-shape modes don't resize.

| Mode | Style | Best for |
|---|---|---|
| **Piano roll** | Strudel-native scrolling notes | Melodic patterns; drum-only loops show as a single bar |
| **Waveform** | Scrolling peak history (~3 s) | Seeing dynamics over time |
| **Spectrum** | Log-frequency spectrogram | Frequency content over time |
| **Scope** *(default)* | 1024-sample triggered oscilloscope | Wave shape — clean for synths |
| **Chromatic** | Scope with magenta / cyan offset (logo-style aberration) | Brand-flavoured demo |
| **AM Bars** | 64 log-frequency bars, rainbow gradient | Classic spectrum analyser |
| **AM Octaves** | 24 wider bars, magenta→cyan gradient | Less noisy than AM Bars on melodic content |
| **AM LED** | 32 bars × 12 LED rows, Winamp-style | Retro club look |
| **AM Mirror** | Bars symmetric around mid-line | Stereo-meter feel |
| **AM Curve** | Smooth curve through 96 bars, gradient fill | Continuous flowing shape |
| **AM Radial** | 64 coloured spokes from canvas centre (square) | Eye-catcher; needs the square slot |
| **Spiral** | Strudel's radial cycle viz (square) | Cyclical structure |

### Top of right panel: cycle indicator

A 1 px magenta→cyan gradient bar at the top of the panel scans
0% → 100% once per Strudel cycle, synced to the global clock. It
freezes when nothing is playing. Toggle from
**Settings → Vibe → Show cycle indicator bar**.

### Vibe tab (right panel)

The default tab — multimodal prompt entry plus a chat history.

- **Push-to-talk button** — hold (or hold the configured key, default
  Space) to record. Border + glow turn cyan; the glow size pulses with
  your live mic level. Release to send. Configure the key in
  **Settings → Vibe → Push-to-talk key**.
- **Chip presets** — 10 one-click prompts above the textarea. Click
  fills the textarea (does not auto-send) so you can edit before
  sending.
- **Auto-send after** — on PTT release, wait this long before firing
  the LLM. **0 s** = instant send (no review window). 2-10 s gives
  you time to read the transcript and override by typing (typing
  cancels the timer).
- **Command queue** — submit while a previous prompt is still
  generating; prompts queue and fire in order. Drop one with × before
  its turn.
- **Code-flash** — when the LLM applies new code, the changed lines
  in the open code editor briefly tint cyan with a 3 px diff-gutter
  bar on the left, fading over 0.8 s.

### API Settings tab

BYO LLM + STT keys, base URLs, and models. Settings live in
`localStorage` and travel as `x-llm-*` / `x-stt-*` headers per
request — never persisted on the server. **Chinese-English mixed
input** checkbox under STT enables bilingual bias prompts and
`lang=auto` on transcribe calls. See [Backend matrix](#backend-matrix).

### Differences from native Strudel

If you're coming from strudel.cc, here's what's new:

- **Multi-track** instead of one global editor — each track has its
  own scheduler instance, viz canvas, level meter, and code state.
- **Per-track viz** — every track shows its own analyser-driven viz;
  no need to sprinkle `.scope()` / `.pianoroll()` in your code.
- **Sync is always on** — `isSyncEnabled = true` at the editor level
  regardless of the saved setting. Multiple tracks sharing one cycle
  clock is a hard requirement, not a preference.
- **Line wrapping is always on** — long method chains never overflow
  horizontally.
- **Right panel** carries the multimodal Vibe + API + Sounds + Settings
  tabs that drive the LLM agent loop. The bottom code panel is a
  collapsible CodeMirror editor for the selected track only.
- **Cycle indicator + per-track level meter + drag-resizable viz** —
  small live-coding ergonomics on top of the Strudel base.

---

## Backend matrix

### STT

| `STT_PROVIDER` | Latency (warm) | Accuracy | Where audio runs | Best for |
|---|---|---|---|---|
| `whisper` (default) | 700–900 ms | medium | Local CPU/GPU | Privacy / offline |
| `vosk` | **~10 ms** | high on grammar | Local CPU | Live performance / canonical commands |
| `api` | ~1–2 s | high (free-form) | Your chosen provider | Free-form natural prompts |

The `api` mode targets any endpoint that implements OpenAI's
`/audio/transcriptions` shape — OpenAI Whisper, Groq Whisper, Qwen DashScope's
OpenAI-compatible mode, self-hosted whisper.cpp servers, and so on.

### LLM (code generation)

| `LLM_PROVIDER` | Where it runs | Notes |
|---|---|---|
| `api` (default) | Your chosen provider | Any OpenAI-compatible Chat Completions endpoint |
| `ollama` | Local daemon | Requires `ollama pull <model>` first; verified with `qwen2.5:14b`, `qwen3:8b` |

<br/>

---

<br/>

## Architecture

```
services/api/                          Fastify backend (Node ≥ 20.6, ESM)
  src/
    application/                       Use cases — depend only on ports
      transcribe-audio.mjs             voice → text (any STT backend; only
                                       hit when input mode is voice)
      generate-strudel.mjs             text → Strudel code (any LLM backend;
                                       hit by voice / text / chip alike)
      validate-strudel.mjs             syntactic guard pre-hot-swap
      transcript-normalizer.mjs        optional LLM cleanup of STT output
      chat-session.mjs                 persisted conversation per session
    domain/                            Pure value objects + errors + WER
    infrastructure/                    Adapters
      whisper-transcriber.mjs          smart-whisper local STT
      vosk-transcriber.mjs             VOSK closed-grammar STT (~10 ms)
      openai-compatible-stt.mjs        any OpenAI-compatible STT API
      openai-compatible-client.mjs     any OpenAI-compatible LLM API
      file-{session,metrics}-store.mjs
      stage-dump-store.mjs
    interface/http/                    Fastify routes
      override-headers.mjs             reads x-llm-* / x-stt-* per request
    skills/strudel/                    composable LLM prompt package

website/                               Astro / React Strudel REPL
  src/repl/
    components/panel/
      VibeTab.jsx                      multimodal prompt input (voice + text
                                       + chips) + chat UI + command queue
      ApiSettingsTab.jsx               BYO key + base URL UI
    tracks/                            multi-track UI + per-track visualizers
```

The backend follows a clean-architecture layering: HTTP routes call use
cases, use cases depend on **ports** (interfaces in `application/ports.mjs`),
and infrastructure provides adapter implementations. Adding a new STT
backend is one new file in `infrastructure/` plus a branch in
`index.mjs#buildTranscriber`.

---

## Prompt cookbook

What kinds of prompts produce what kinds of music? VibeRave is opinionated:
the skill prompt that drives the LLM has 16 hand-tuned genre templates,
explicit chord / mode / FM / vowel knowledge, and a mutation cheatsheet
for common iteration commands. Use this section as a starting menu.

### Vocabulary at a glance

| Category | Phrases the system handles cleanly |
|---|---|
| **Genre / vibe** | `lo-fi beat at 80 bpm`, `Berghain techno`, `minimal techno`, `house at 120`, `drum and bass at 174`, `acid bass`, `ambient pad`, `dub at 76 bpm`, `trap, half-time`, `IDM broken beats`, `chiptune / 8-bit`, `hyperpop`, `dark drone`, `funky disco`, `jazzy chill at 90` |
| **Drums** | `add hi-hat`, `mute kick`, `more snare`, `double drums`, `swap drums for a 909 kit`, `swap to LinnDrum`, `harder kick` |
| **Effects** | `add reverb`, `more delay`, `make it dubby`, `make it darker`, `more crush`, `add a phaser` |
| **Stems / synths** | `more bass`, `deeper bass`, `harder bass` (FM), `bring back the lead`, `mute the pad`, `add an arp`, `vocal-y filter` (formant) |
| **Harmony** | `Cm7 to Am7 to Fmaj7`, `play in dorian`, `phrygian feel`, `ii-V-I in C`, `darker / brooding` (minor + low lpf) |
| **Energy** | `more energetic`, `more minimal`, `make it faster / slower`, `fast(2)`, `half-time` |
| **Transport** | `play`, `pause`, `stop all`, `restart`, `open a new track`, `kill it` |

### Session walkthroughs

#### Build a lo-fi study beat (3 turns)

| Turn | Prompt | What you hear |
|---|---|---|
| 1 | *"lo-fi beat at eighty bpm"* | LinnDrum kit + saw bass + Rhodes chords (C–Am–G–Eb), slow swing, ~80 BPM |
| 2 | *"add reverb on the rhodes"* | Same pattern, `room(0.7)` on the Rhodes layer; drums + bass untouched |
| 3 | *"make it sleepier"* | LPF drops, attack/release lengthen, slight slow |

#### Berghain → minimal techno → drum and bass (multi-track)

| Turn | Prompt | What you hear |
|---|---|---|
| 1 | *"Berghain techno at one thirty-eight"* | 132 BPM dark/hypnotic — 909 kick, delay-drowned clap, minimal hats, sub bass |
| 2 | *"harder bass"* | Bass swaps from sawtooth+lpf to FM synth (`.s("sine").fmh(2).fmi(...)`) — metallic, more aggressive |
| 3 | *"open a new track. minimal techno"* | Track 2 starts in sync — sparse 130 BPM, just kick + ticks |
| 4 | *"open a new track. drum and bass at one seventy-four"* | Track 3 — 174 BPM breakbeat, Amen-style chops |
| 5 | *"stop all"* | All three tracks stop on the next cycle |

#### Jazz harmonic exploration (chord + mode prompts)

| Turn | Prompt | What you hear |
|---|---|---|
| 1 | *"Cm7 to Fm7 to Bb7 to Ebmaj7, dorian, ninety bpm"* | `chord(...).voicing().anchor("c4")` over LinnDrum brushes + walking acoustic bass |
| 2 | *"make the chord more dubby"* | `delay(0.5)` + `delaytime(0.375)` + `delayfeedback(0.6)` on the chord layer; bass and drums untouched |
| 3 | *"add a walking bass in c minor"* | `gm_acoustic_bass` scale walk added to the `stack` |

#### Hyperpop sound design

| Turn | Prompt | What you hear |
|---|---|---|
| 1 | *"hyperpop at one sixty bpm"* | 160 BPM, square lead, triangle bass, F major, `.crush(8)` on the master |
| 2 | *"more crush"* | Crush bit-depth drops to 4-5 |
| 3 | *"vocal-y filter on the lead"* | `.vowel("<a e i o>")` cycling on the square lead |

### Single-shot one-liners

Drop these into the textarea (or speak them) for instant results.

| Prompt | Style |
|---|---|
| *"give me a chill lo-fi beat at 80 bpm with rhodes chords"* | Lo-fi hip-hop |
| *"deep house at 120, sidechain on the pad"* | Deep house with the classic ducking pad |
| *"Berghain techno at 132 with FM bass"* | Dark / industrial |
| *"jungle at 174 with amen break and sub bass"* | DnB / jungle |
| *"ambient pad in c minor, slow, lots of reverb"* | Drone / dark ambient |
| *"acid 303 bassline, lpf swept, lpq high"* | Acid |
| *"trap at 140 half-time, 808 sub, hi-hat rolls"* | Trap |
| *"chiptune in F major at 160 with crush"* | 8-bit |
| *"phrygian techno at 138, minor feel"* | Modal techno |
| *"jazz progression Cm7-Am7-Fmaj7-G7 with walking bass at 90"* | Modal jazz |

### Iteration patterns (when something is already playing)

The LLM **always sees the current pattern** in a `<current>` block, so
iterations preserve whatever you don't ask to change.

| You say | What changes | What stays |
|---|---|---|
| *"more reverb"* | `room(0.7-0.9)` on the most-prominent melodic layer | drums, kick, structure |
| *"make it dubby"* | `delay` / `delaytime` / `delayfeedback` on a non-drum layer | tempo, kit, melody |
| *"swap to RolandTR808"* | `.bank("RolandTR808")` on drum lines | melody, structure, tempo |
| *"darker"* | LPF drops, room rises, soundfont swaps to a darker one | rhythm, harmony |
| *"harder bass"* | `.s("sine").fmh(2).fmi(...)` swap (FM synth) | drums, melody |
| *"vocal-y filter"* | `.vowel("<a e i o>")` added to lead/synth | drums, bass, harmony |
| *"every 4 bars flip the hihats"* | `.every(4, rev)` on the hh layer | everything else |
| *"quieter overall"* | Outer `.gain(0.6)` or per-layer gain reductions | structure |
| *"more energetic"* | `.fast(2)` somewhere, optional `hh*16` layer added | core idea |
| *"strip everything except drums and bass"* | The chord/pad/lead `stack` items removed | drums, bass |

### Things the system will refuse politely

The LLM is told not to invent — when a request can't be turned into a
pattern, it returns a "Couldn't generate" sentinel and the editor stays
unchanged. Triggers:

- Off-topic ("write me a poem", "what's the weather")
- Genre / instrument the skill doesn't know (very obscure regional styles)
- Requests that would need code outside Strudel's verified API surface

### Tips

- **Voice is fastest** for short canned commands (`"more reverb"`, `"stop all"`).
- **Typing is best** for precise tweaks the LLM might mis-interpret from
  speech: *"raise lpf to 1200 on the bass layer"* is much safer typed.
- **Chips are first** for discovery — click one, edit if you want, send.
- **Multi-track sessions stay in beat** automatically (one global cycle
  clock). Open a new track at any time without disturbing the others.

The 10 chips above the textarea mirror the most-used prompts. The skill
prompts driving the LLM live in `services/api/src/skills/strudel/` —
add new genre templates or mutation recipes there and the LLM picks
them up on the next request (no restart needed; skill files are re-read
per `/generate` call).

---

## Development

```bash
pnpm dev           # web + api together
pnpm dev:web       # web only
pnpm dev:api       # api only
pnpm test          # vitest
pnpm lint          # eslint
pnpm format-check  # prettier
pnpm build         # production web build
```

`services/api` runs under `node --watch` so source-file edits restart
the server automatically; the web side is Astro's standard HMR.

<br/>

---

<br/>

## Contributing

PRs are welcome. A few conventions to keep things sane:

### How to add a new STT or LLM backend

The whole pipeline is one-file-per-adapter. To add a backend:

1. Create the adapter in `services/api/src/infrastructure/<name>-stt.mjs`
   (or `<name>-client.mjs` for an LLM). It must conform to the
   `Transcriber` / `LlmClient` shape declared in
   `services/api/src/application/ports.mjs`.
2. Wire it into `services/api/src/index.mjs#buildTranscriber` (or
   `buildLlmClient`) plus the per-request `transcriberFor` /
   `llmClientFor` cache.
3. Add a preset to `website/src/settings.mjs` so users can pick it
   from the API tab in one click.

That's it — no plugin system, no registry, no config schema. Each
backend is a small file. See `vosk-transcriber.mjs` and
`dashscope-stt.mjs` for examples that follow non-OpenAI protocols.

### How to extend the voice grammar (VOSK)

VOSK runs in closed-grammar mode. To make a new phrase recognisable:

1. Add it to `DEMO_GRAMMAR` in
   `services/api/src/infrastructure/vosk-transcriber.mjs`.
2. If the phrase contains a word missing from the small-en
   pronunciation lex (Berghain, lo-fi, hi-hat), spell it phonetically
   in the grammar and add a regex to `CANONICALISE` that renames it
   back to the canonical form before the LLM sees it.
3. Optionally add it to the chip row in
   `website/src/repl/components/panel/VibeTab.jsx#PROMPT_CHIPS` so
   users can discover it.

### Pull requests

- Branch off `main`. Keep PRs small and focused — one concern per PR.
- Run `pnpm format-check` and `pnpm lint` before pushing.
- Don't add new dependencies casually. The repo intentionally has a
  small dependency surface; pitch the use case in the PR description.
- For changes to user-visible UI, attach a before / after screenshot
  in the PR description.
- Don't commit anything under `services/api/data/` (PII recordings)
  or `services/api/models/` (multi-GB binaries). Both are gitignored.

### Code style

- ESM throughout. No CommonJS. No mixed `require` + `import`.
- Prefer small files with single responsibility. The clean-architecture
  layering (`application` / `domain` / `infrastructure` / `interface`)
  is intentional — adapter code goes in `infrastructure`, business
  logic goes in `application`, neither touches the other.
- Comments explain *why*, not *what*. Naming should make the *what*
  obvious; comments are reserved for non-obvious constraints, hidden
  invariants, or workaround context.

### Filing issues

Useful repro info:
- **Browser + version + OS** (Chrome 120 / macOS 14, etc.)
- **STT and LLM provider** picked in the API tab
- **The exact phrase you said** + what the chat / textarea ended up showing
- A copy-paste of the relevant `[api]` log line, or the failing request shown in the browser DevTools network tab
- Whether `pnpm test` and `pnpm lint` pass on `main`

<br/>

---

<br/>

## Built on

- [Strudel](https://strudel.cc) — pattern language + audio scheduler (AGPL-3.0).
- [smart-whisper](https://github.com/JacobLinCool/smart-whisper) — Node binding for whisper.cpp (Metal / CUDA accelerated).
- [vosk-koffi](https://github.com/tocha688/vosk-koffi) — modern FFI binding for the [VOSK](https://alphacephei.com/vosk/) toolkit.
- [openai](https://github.com/openai/openai-node) — official Node SDK for OpenAI-compatible HTTP shapes (works against any compatible provider).
- [Ollama](https://ollama.com/) — local LLM runtime (offline alternative, no API key needed).

---

## License

VibeRave is licensed under [**AGPL-3.0-or-later**](LICENSE), inherited from
upstream [Strudel](https://github.com/tidalcycles/strudel) (which is also
AGPL-3.0). Because Strudel is the strongest copyleft license in the
dependency graph, the combined work has to ship under AGPL-3.0.

### Dependency licenses

| Component | License | Compatible |
|---|---|---|
| **Strudel** (in `packages/`) | AGPL-3.0-or-later | inherited |
| **openai** (Node SDK for OpenAI-compatible APIs) | Apache-2.0 | ✓ |
| **smart-whisper** (whisper.cpp binding) | MIT | ✓ |
| **vosk-koffi** (VOSK FFI binding) | MIT | ✓ |
| **wavefile** | MIT | ✓ |
| **fastify** | MIT | ✓ |

All runtime dependencies are MIT/Apache-2.0 (permissive, compatible with
AGPL). External services we *connect to over the network* (OpenAI, Groq,
DashScope, your Ollama instance, etc.) are governed by their own terms —
not bundled, not redistributed, not affected by VibeRave's license.

### What AGPL-3.0 means in practice

Because of the AGPL "network use is distribution" clause, **if you run a
modified version of VibeRave as a public network service, you must make
your modified source available to the users of that service**. Forks for
private use don't have to publish — only public deployments. See the
[full license text](LICENSE).
