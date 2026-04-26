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

Pick a model from <https://alphacephei.com/vosk/models>. Three useful
options for English:

| Model | Size | Accuracy | Use when |
|---|---|---|---|
| `vosk-model-small-en-us-0.15` | 40 MB | OK | Disk-constrained / quick test |
| `vosk-model-en-us-0.22-lgraph` | 128 MB | Good | **Default — best size/accuracy balance** |
| `vosk-model-en-us-0.22` | 1.8 GB | Best | When latency tolerance allows |

Recommended (the lgraph variant — larger acoustic model than small-en,
much smaller than the full one):

```bash
cd services/api/models
curl -LO https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip
unzip vosk-model-en-us-0.22-lgraph.zip
rm vosk-model-en-us-0.22-lgraph.zip
```

Then set in `.env`:

```bash
STT_PROVIDER=vosk
VOSK_MODEL_PATH=./services/api/models/vosk-model-en-us-0.22-lgraph
```

VOSK runs in **closed-grammar mode** — it only recognises phrases listed
in `DEMO_GRAMMAR` (in `src/infrastructure/vosk-transcriber.mjs`). That
gets you sub-15 ms latency at the cost of free-form recognition. Edit
the grammar to add new phrases. The grammar covers natural variants
like `"more reverb"` / `"add reverb"`, `"open a new track"` /
`"open new track"` / `"new track"`, so users don't have to memorise
exact wording. Words missing from the model's pronunciation lex
(`berghain`, `lo-fi`, `hi-hat`) are spelled phonetically in the
grammar and renamed back to canonical form by `CANONICALISE` before
the LLM sees them.

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
