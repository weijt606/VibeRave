# @viberave/api

Fastify backend that turns user prompts (voice OR text) into Strudel
code. The voice path goes through STT first; text bypasses it and
hits the LLM directly. The LLM is unaware of which input mode fired —
both produce the same code-gen request shape.

Pluggable STT (`whisper` / `vosk` / `api` / `dashscope`) backends and an
**LLM provider chain** with automatic failover (any OpenAI-compatible
endpoint; DashScope → OpenAI → Ollama → LM Studio by default). Settings
from the in-app **API Settings** panel travel as per-request override
headers and are tried before the chain, no `.env` editing required for
end-users. See the [root README](../../README.md) for the project
overview and [docs/booth/CONTRACTS.md](../../docs/booth/CONTRACTS.md) §8
for the booth backend spec this implements.

## LLM provider chain

`LLM_PROVIDERS=dashscope,openai,ollama,lmstudio` (order = priority). Each
provider is an OpenAI-compatible client built from `LLM_<NAME>_API_KEY` /
`LLM_<NAME>_BASE_URL` / `LLM_<NAME>_MODEL` (presets exist for the four
names above; any other name works with the three keys). Providers without
a key / model are skipped at boot. When `LLM_PROVIDERS` is unset the chain
is derived from the legacy `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` /
`OLLAMA_*` keys, so older `.env` files keep working.

Per call (`src/infrastructure/provider-chain.mjs`):

- each provider gets `LLM_TIMEOUT_MS` (15 s) via AbortController and
  `LLM_MAX_TOKENS` (1800); SDK retries are off — the chain retries;
- timeout / 5xx / 429 / network error → next provider;
- 2 consecutive failures → provider skipped for 60 s → half-open probe;
- the serving provider is logged (`[llm] provider=… ms=…`) and returned
  in the response as `provider`;
- `x-llm-*` override headers become a provider **prepended** to the chain.

`GET /health/providers` returns `[{ name, model, healthy, lastError,
lastLatencyMs, consecutiveFailures, cooldownRemainingMs }]`.

## Booth request extensions

`POST /generate` and `POST /generate/stream` accept, on top of
`{ sessionId, prompt, currentCode }`:

| field | values | effect |
|---|---|---|
| `mode` | `'adult'` \| `'kids'` | `kids` prepends **FAMILY MODE ACTIVE** (forces `rules/family-mode.md` regardless of keywords, drops adult templates); `adult` tells the model the kid rules are OFF. Omit → legacy keyword behaviour. |
| `lang` | `'zh'` (default) \| `'en'` | language of the `explain` sentence |
| `intent` | `'generate'` (default) \| `'tweak'` | `tweak` uses the small prompt subset (`TWEAK_ORDER` in `skill-prompt.mjs`: output-format, iteration, error-recovery, meta-commands, siblings, + family-mode when kids) — ~13 KB vs ~160 KB |
| `tracks` | `[{ name, summary }]` | other tracks' one-line summaries → `<siblings>` block (`rules/siblings.md`: don't duplicate roles, same key/tempo) |

Responses gain `explain` (the model's trailing `EXPLAIN: …` line, stripped
server-side — see `rules/output-format.md`) and `provider`.

`POST /generate/stream` is Server-Sent Events:
`received` → `generating {provider}` (once per provider attempt) →
`validating {attempt}` → `done {…same payload as /generate}` |
`error {message, code, status}`.

## Safety

- System prompt cached in memory, re-read when any skill file's mtime changes.
- History window `LLM_HISTORY_TURNS` (6 pairs; META turns kept).
- `prompt` ≤ 500 chars, `currentCode` ≤ 20 KB → `413`.
- `BOOTH_TOKEN` set → `x-booth-token` required on `/generate*` and `/transcribe`
  (`401`); `API_RATE_LIMIT_PER_MIN` (20) per IP on `/generate*` (`429` +
  `retry-after`).
- Static denylist (`import require fetch XMLHttpRequest WebSocket document
  window process globalThis eval Function`) runs before `evaluate()`; the
  rejection is a normal validation error the retry loop asks the model to fix.
- Session read-modify-write is serialised per `sessionId`.
- Whisper zh hallucination blocklist (`请不吝点赞订阅`, `谢谢观看`,
  `字幕由…提供`, …) in `src/infrastructure/stt-hallucinations.mjs`.
- Fast-lane vocabulary (VOSK grammar + `FAST_LANE_COMMANDS`, EN + zh) is
  plain data in `src/infrastructure/fast-lane-grammar.mjs` for the
  front-end to reuse.

## Pregenerated patterns

```bash
pnpm --filter @viberave/api pregenerate            # real LLM, needs keys in .env
pnpm --filter @viberave/api pregenerate:dry        # stub LLM, writes fixtures
node services/api/scripts/pregenerate.mjs --mode kids --only 儿歌 --force
```

12 adult styles + 8 kid genres × 3 keys, validated through the same
pipeline as `/generate`, written to `data/pregen/<mode>/<style>-<n>.json`.
`GET /pregen?mode=adult|kids&style=<style>` returns a random one (`404`
when none).

## Tests

```bash
npx vitest run services/api      # from the repo root
```

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
[llm] provider=openai skipped: LLM_OPENAI_API_KEY is empty
[llm] chain=dashscope → ollama timeout=15000ms max_tokens=1800 history=6 turns
[stt] provider=whisper model=base
[stage-dump] disabled
[transcript-normalizer] disabled
[booth] token=off rate-limit=20/min pregen=…/services/api/data/pregen
```

## HTTP routes

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Liveness + active backend ids |
| `GET` | `/health/providers` | LLM provider chain health (see above) |
| `GET` | `/health/test-llm`, `/health/test-stt` | Round-trip test with the request's override headers |
| `POST` | `/transcribe` | Body: `audio/wav`. Query: `sessionId`, `lang`. Returns `{ text, ... }`. Needs `x-booth-token` when `BOOTH_TOKEN` is set. |
| `POST` | `/generate` | Body: `{ sessionId, prompt, currentCode, mode?, lang?, intent?, tracks? }`. Returns `{ code, explain, provider, ... }` or `{ meta, ... }`. Rate-limited, token-guarded. |
| `POST` | `/generate/stream` | Same body; SSE progress events, `done` carries the `/generate` payload. |
| `POST` | `/generate/fix` | Stateless one-shot fix when the hot-swapped pattern errors (accepts `mode`/`lang`). |
| `GET` | `/pregen?mode=&style=` | Random pregenerated pattern; `404` when none. |
| `GET` | `/sessions/:id` | Replay a session's chat history. |
| `DELETE` | `/sessions/:id` | Wipe a session. |
