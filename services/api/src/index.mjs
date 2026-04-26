import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.mjs';
import { createOpenAICompatibleClient } from './infrastructure/openai-compatible-client.mjs';
import { createOpenAICompatibleStt } from './infrastructure/openai-compatible-stt.mjs';
import { createWhisperTranscriber } from './infrastructure/whisper-transcriber.mjs';
import { createVoskTranscriber } from './infrastructure/vosk-transcriber.mjs';
import { createFileSessionStore } from './infrastructure/file-session-store.mjs';
import { createFileMetricsStore } from './infrastructure/file-metrics-store.mjs';
import { createStageDumpStore } from './infrastructure/stage-dump-store.mjs';
import { makeGenerateStrudel } from './application/generate-strudel.mjs';
import { makeValidateStrudel } from './application/validate-strudel.mjs';
import { makeTranscribeAudio } from './application/transcribe-audio.mjs';
import { makeTranscriptNormalizer } from './application/transcript-normalizer.mjs';
import { makeChatSession } from './application/chat-session.mjs';
import { createServer } from './interface/http/server.mjs';

// Composition root: the only place that wires concrete dependencies
// into the application layer. Everything else depends on contracts.

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();

// Composable Strudel skill: rules + reference + recipes + examples loaded in
// the order declared in skills/strudel/SKILL.md. Re-read on every request
// (handled by generateStrudel) so editing the skill doesn't require a restart.
const SKILL_ROOT = resolve(__dirname, 'skills/strudel');
const SKILL_ORDER = [
  'rules/output-format.md',
  'rules/iteration.md',
  'rules/host-controls.md',
  'rules/diversity.md',
  'rules/uncertainty.md',
  'rules/cannot-handle.md',
  'rules/meta-commands.md',
  'rules/error-recovery.md',
  'reference/sounds.md',
  'reference/mini-notation.md',
  'reference/pattern-transforms.md',
  'reference/effects.md',
  'reference/modulation.md',
  'reference/tempo.md',
  'reference/visualization.md',
  'reference/dual-deck.md',
  'recipes/generate.md',
  'recipes/explain.md',
  'recipes/debug.md',
  'recipes/vary.md',
  'examples/genres.md',
  'examples/techniques.md',
];
const loadSystemPrompt = async () => {
  const parts = await Promise.all(
    SKILL_ORDER.map((rel) => readFile(resolve(SKILL_ROOT, rel), 'utf8')),
  );
  return parts.join('\n\n---\n\n');
};

// Fail-fast: read every skill file at boot so a missing/renamed entry surfaces
// during startup instead of on the first /generate request.
await loadSystemPrompt();

// LLM_PROVIDER picks the default backend the composition root wires.
// Per-request overrides (sent from the frontend Settings UI as headers)
// build a one-off client; this is just the fallback used when the user
// hasn't configured anything yet.
function buildLlmClient(llmCfg) {
  const cfg = llmCfg.provider === 'ollama' ? llmCfg.ollama : llmCfg.api;
  return createOpenAICompatibleClient(cfg);
}
const defaultLlmClient = buildLlmClient(config.llm);
console.log(`[llm] provider=${config.llm.provider} ${defaultLlmClient ? `model=${(config.llm.provider === 'ollama' ? config.llm.ollama : config.llm.api).model}` : '(no key configured — provide one via Settings)'}`);

// STT_PROVIDER picks which transcriber to wire. All conform to the same
// Transcriber port (transcribe(pcm, {language, wavBuffer}) → {text}).
function buildTranscriber(sttCfg) {
  if (sttCfg.provider === 'vosk') {
    const modelPath =
      sttCfg.voskModelPath ||
      resolve(__dirname, '..', 'models', 'vosk-model-small-en-us-0.15');
    try {
      return createVoskTranscriber({ modelPath });
    } catch (err) {
      console.warn(`[stt] STT_PROVIDER=vosk failed (${err.message}) — falling back to whisper`);
      return createWhisperTranscriber(sttCfg);
    }
  }
  if (sttCfg.provider === 'api') {
    const t = createOpenAICompatibleStt({
      apiKey: sttCfg.apiKey,
      baseURL: sttCfg.apiBaseURL,
      model: sttCfg.apiModel,
      language: sttCfg.language,
    });
    if (!t) {
      console.warn('[stt] STT_PROVIDER=api but STT_API_KEY is missing — falling back to whisper');
      return createWhisperTranscriber(sttCfg);
    }
    return t;
  }
  return createWhisperTranscriber(sttCfg);
}
const defaultTranscriber = buildTranscriber(config.stt);
console.log(`[stt] provider=${config.stt.provider} model=${defaultTranscriber.getModelId()}`);

const sessionStore = createFileSessionStore({
  dir: config.sessions.dir || resolve(__dirname, '..', 'data', 'sessions'),
});
const metricsStore = createFileMetricsStore({
  file:
    process.env.API_METRICS_FILE ||
    resolve(__dirname, '..', 'data', 'metrics', 'transcribe.jsonl'),
});
const stageDumpStore = createStageDumpStore({
  enabled: config.dump.stages,
  dir: config.dump.dir || resolve(__dirname, '..', 'data', 'stage-dumps'),
});
console.log(`[stage-dump] ${config.dump.stages ? `enabled → ${config.dump.dir || 'data/stage-dumps'}` : 'disabled'}`);

const transcriptNormalizer = config.transcript.llmCorrect
  ? makeTranscriptNormalizer({ llmClient: defaultLlmClient })
  : null;
console.log(`[transcript-normalizer] ${transcriptNormalizer ? 'enabled' : 'disabled'}`);

// ─────────────────────────────────────────────────────────────────────
// Per-request override factories. The HTTP layer reads the user's API
// settings from request headers and asks for a one-off client when the
// frontend Settings UI is configured. Light cache keyed on a config hash
// keeps the SDK from being re-instantiated on every request.

const llmClientCache = new Map(); // key → LlmClient
function llmClientFor(overrides) {
  if (!overrides) return defaultLlmClient;
  const cfg = {
    provider: overrides.provider || config.llm.provider,
    apiKey: overrides.apiKey ?? null,
    baseURL: overrides.baseURL || null,
    model: overrides.model || null,
    temperature: typeof overrides.temperature === 'number' ? overrides.temperature : undefined,
  };
  if (!cfg.apiKey || !cfg.model) return defaultLlmClient;
  const key = `${cfg.provider}|${cfg.baseURL || ''}|${cfg.model}|${cfg.apiKey.slice(-6)}`;
  let c = llmClientCache.get(key);
  if (!c) {
    c = createOpenAICompatibleClient({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL || (cfg.provider === 'ollama' ? config.llm.ollama.baseURL : config.llm.api.baseURL),
      model: cfg.model,
      temperature: cfg.temperature ?? config.llm.api.temperature,
    });
    if (!c) return defaultLlmClient;
    llmClientCache.set(key, c);
  }
  return c;
}

const transcriberCache = new Map(); // key → Transcriber
function transcriberFor(overrides) {
  if (!overrides || !overrides.provider) return defaultTranscriber;
  const provider = overrides.provider;
  if (provider === 'whisper') return defaultTranscriber.getModelId().startsWith('whisper') ? defaultTranscriber : buildTranscriber({ ...config.stt, provider: 'whisper' });
  if (provider === 'vosk') return defaultTranscriber.getModelId().startsWith('vosk') ? defaultTranscriber : buildTranscriber({ ...config.stt, provider: 'vosk' });
  if (provider === 'api') {
    const apiKey = overrides.apiKey ?? null;
    const baseURL = overrides.baseURL || config.stt.apiBaseURL;
    const model = overrides.model || config.stt.apiModel;
    if (!apiKey) return defaultTranscriber;
    const key = `api|${baseURL}|${model}|${apiKey.slice(-6)}`;
    let t = transcriberCache.get(key);
    if (!t) {
      t = createOpenAICompatibleStt({ apiKey, baseURL, model, language: config.stt.language });
      if (!t) return defaultTranscriber;
      transcriberCache.set(key, t);
    }
    return t;
  }
  return defaultTranscriber;
}

const generateStrudel = makeGenerateStrudel({ defaultLlmClient, llmClientFor, loadSystemPrompt });
const transcribeAudio = makeTranscribeAudio({
  defaultTranscriber,
  transcriberFor,
  metricsStore,
  stageDumpStore,
  transcriptNormalizer,
});
const validatePattern = makeValidateStrudel();
const chatSession = makeChatSession({ sessionStore, generateStrudel, validatePattern });

const server = await createServer({
  config,
  deps: {
    config,
    defaultLlmClient,
    defaultTranscriber,
    sessionStore,
    metricsStore,
    generateStrudel,
    transcribeAudio,
    chatSession,
    llmClientFor,
    transcriberFor,
  },
});

await server.listen({ port: config.server.port, host: config.server.host });
