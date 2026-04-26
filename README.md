<h1 align="center">VibeRave</h1>

<p align="center">
  <img src="src-tauri/images/viberave-banner.png" alt="VibeRave — voice → music engine" width="100%" />
</p>

<p align="center">
  <strong>Vibe-code rave music with your voice.</strong>
</p>

<p align="center">
  Hold a key, speak a command — VibeRave hot-swaps the running pattern<br/>
  in the <a href="https://strudel.cc">Strudel</a> editor without breaking the beat.
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> ·
  <a href="#backend-matrix">Backends</a> ·
  <a href="#voice-command-reference">Voice commands</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="LICENSE">License</a>
</p>

<br/>

VibeRave is a fork of [Strudel](https://strudel.cc) that adds a voice-to-code
agent loop. It is fully open source: every backend in the pipeline can be
swapped between **local-only** (offline, free) and **cloud** (faster, more
accurate) implementations — you can run the whole stack with no paid services.

```
       you (in your room or on stage)
            │  "lo-fi beat at 80 bpm, more reverb, swap drums for a 909"
            ▼
   ┌────────────────────────────────────────────────────────────────┐
   │  Voice → Music pipeline                                        │
   │                                                                │
   │   mic → STT  (whisper · vosk · any OpenAI-compat /audio API)   │
   │       → LLM  (any OpenAI-compat chat API · or Ollama)          │
   │       → Strudel code                                           │
   │       → hot-swap into the in-browser scheduler                 │
   └────────────────────────────────────────────────────────────────┘
            │
            ▼  the music keeps playing — your edit lands on the next cycle
```

<br/>

---

<br/>

## Features

- **Hot-swap live coding** — voice commands edit the pattern that's
  currently playing; the audio scheduler keeps the beat across the swap.
- **Pluggable STT** — three speech-to-text backends, switchable per request:
  `whisper` (local), `vosk` (local, sub-15 ms on a closed grammar), or
  `api` (any OpenAI-compatible `/audio/transcriptions` endpoint).
- **Pluggable LLM** — `api` (any OpenAI-compatible Chat Completions endpoint)
  or `ollama` (local, no API key, runs on your laptop). Configure both from
  the in-app **API Settings** panel — no `.env` editing required.
- **Multi-track** — independent tracks with per-track visualizers
  (pianoroll / waveform / spectrum / scope / spiral).
- **Click-to-prompt chips** — 10 canonical commands (`lo-fi beat`,
  `Berghain techno`, `add reverb`, `stop all`, …) above the input. Useful
  when STT is flaky or for first-time visitors who don't know what to say.
- **Per-take metrics + stage dumps** (optional) — every voice take can
  be persisted as `raw.wav` + transcript + JSON metrics so you can
  A/B different STT backends offline.

<br/>

<p align="center">
  <img src="src-tauri/images/viberave-interface.png" alt="VibeRave — live UI" width="100%" />
</p>

<br/>

---

<br/>

## Quickstart

### Requirements

- **Node ≥ 20.6** (the `--env-file` flag the API uses landed in 20.6)
- **pnpm** ≥ 9
- A microphone, a quiet-ish room
- One of:
  - An LLM API key for any OpenAI-compatible provider — paste it into the
    in-app **API Settings** panel after launch (no `.env` editing required), or
  - **Ollama** running locally with a model pulled (e.g. `ollama pull qwen2.5:14b`)

### Install + run

```bash
git clone https://github.com/weijt606/VibeRave.git
cd VibeRave
pnpm install
cp .env.example .env

pnpm dev
# Web:  http://localhost:4321
# API:  http://localhost:4322
```

Then open http://localhost:4321/, click the **api** tab in the side panel,
pick a provider preset (OpenAI / Groq / OpenRouter / Qwen DashScope / Ollama /
Custom), and paste your API key. Settings live in your browser only — they're
never persisted on the server.

The first time you record audio, smart-whisper auto-downloads the `base.en`
model (~150 MB) into `services/api/models/whisper/`. To use a larger model
edit `WHISPER_MODEL` in `.env`.

### Switching STT backends

Pick one in the **API Settings** panel, or pre-configure via env:

```bash
# .env

STT_PROVIDER=whisper   # default — local, no network, ~700-900 ms
STT_PROVIDER=vosk      # local, ~10 ms, closed-grammar (download model first)
STT_PROVIDER=api       # any OpenAI-compatible /audio/transcriptions endpoint
```

For VOSK, download a model and place it in `services/api/models/`:

```bash
cd services/api/models
curl -LO https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip && rm vosk-model-small-en-us-0.15.zip
```

The grammar VOSK matches against lives in
`services/api/src/infrastructure/vosk-transcriber.mjs` (`DEMO_GRAMMAR`).
It mirrors the prompt-chip list in the frontend so the click chips and
the recognized vocabulary stay in sync.

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
      transcribe-audio.mjs             voice → text (any STT backend)
      generate-strudel.mjs             text → Strudel code (any LLM backend)
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
      VibeTab.jsx                      voice-driven prompt + chat UI
      ApiSettingsTab.jsx               BYO key + base URL UI
    tracks/                            multi-track UI + per-track visualizers
```

The backend follows a clean-architecture layering: HTTP routes call use
cases, use cases depend on **ports** (interfaces in `application/ports.mjs`),
and infrastructure provides adapter implementations. Adding a new STT
backend is one new file in `infrastructure/` plus a branch in
`index.mjs#buildTranscriber`.

---

## Voice command reference

Common phrases the system handles well across all STT backends:

| Category | Examples |
|---|---|
| **Generation** | `lo-fi beat at 80 bpm`, `Berghain techno`, `drum and bass`, `acid bass`, `house at 120` |
| **Drums** | `add hi-hat`, `mute kick`, `double drums`, `more snare` |
| **Effects** | `add reverb`, `more delay`, `make it dubby`, `make it darker` |
| **Stems** | `more bass`, `bring back the lead`, `mute the pad` |
| **Transport** | `play`, `pause`, `stop all`, `open a new track` |

The 10 chips above the input box are also clickable as a deterministic
fallback when speech recognition struggles.

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

---

## Built on

- [Strudel](https://strudel.cc) — pattern language + audio scheduler (AGPL-3.0).
- [smart-whisper](https://github.com/JacobLinCool/smart-whisper) — Node binding for whisper.cpp (Metal / CUDA accelerated).
- [vosk-koffi](https://github.com/tocha688/vosk-koffi) — modern FFI binding for the [VOSK](https://alphacephei.com/vosk/) toolkit.
- [openai](https://github.com/openai/openai-node) — official Node SDK for OpenAI-compatible HTTP shapes (works against any compatible provider).
- [Ollama](https://ollama.com/) — local LLM runtime (offline alternative, no API key needed).

---

## License

[AGPL-3.0-or-later](LICENSE) — inherited from upstream Strudel.
