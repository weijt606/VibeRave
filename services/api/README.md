# @viberave/api

Fastify backend that turns voice into Strudel code. Pluggable STT
(`whisper` / `vosk` / `gemini`) and LLM (`gemini` / `ollama`) backends
selected per env. See the [root README](../../README.md) for the
project overview.

## Local model setup

The two local STT backends need a model on disk. Both live under
`services/api/models/` (gitignored).

### Whisper (auto-downloaded)

`smart-whisper` downloads the `WHISPER_MODEL` you choose on first use.
You don't have to do anything — just set `STT_PROVIDER=whisper` and
`WHISPER_MODEL=base.en` (or `small.en` / `medium.en` / `large-v3-turbo`)
and the first transcribe request triggers the download to
`services/api/models/whisper/`.

### VOSK (manual download)

Pick a model from <https://alphacephei.com/vosk/models>. The smallest
useful English model is `vosk-model-small-en-us-0.15` (~40 MB):

```bash
cd services/api/models
curl -LO https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip
rm vosk-model-small-en-us-0.15.zip
```

Then set in `.env`:

```bash
STT_PROVIDER=vosk
# VOSK_MODEL_PATH=./services/api/models/vosk-model-small-en-us-0.15  # optional
```

VOSK runs in **closed-grammar mode** — it only recognises phrases listed
in `DEMO_GRAMMAR` (in `src/infrastructure/vosk-transcriber.mjs`). That
gets you sub-15 ms latency at the cost of free-form recognition. Edit
the grammar to add new phrases; they're rendered as the click-chips in
the frontend so the UI and recognizer stay in sync.

## Run

```bash
pnpm dev:api      # from repo root, watches src/
pnpm start:api    # production mode
```

The server listens on `API_PORT` (default `4322`). Boot log shows the
active LLM + STT backend:

```
[llm] provider=gemini
[stt] provider=whisper model=base.en
[stage-dump] disabled
[transcript-normalizer] disabled
```

## HTTP routes

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Liveness + active backend ids |
| `POST` | `/transcribe` | Body: `audio/wav`. Query: `sessionId`, `lang`. Returns `{ text, ... }`. |
| `POST` | `/generate` | Body: `{ sessionId, prompt, currentCode }`. Returns `{ code, ... }` or `{ meta }`. |
| `POST` | `/generate/fix` | Stateless one-shot fix when the hot-swapped pattern errors. |
| `GET` | `/sessions/:id` | Replay a session's chat history. |
| `DELETE` | `/sessions/:id` | Wipe a session. |
