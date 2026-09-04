import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.mjs';
import { composeLlm } from './llm-composition.mjs';
import { createSkillPromptProvider } from './infrastructure/skill-prompt.mjs';
import { createPregenStore } from './infrastructure/pregen-store.mjs';
import { createOpenAICompatibleStt } from './infrastructure/openai-compatible-stt.mjs';
import { createDashScopeStt } from './infrastructure/dashscope-stt.mjs';
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

// Composable Strudel skill: rules + reference + recipes + examples in the
// order declared in skills/strudel/SKILL.md (SKILL_ORDER / TWEAK_ORDER in
// infrastructure/skill-prompt.mjs). Cached in memory; re-read only when a
// skill file's mtime changes, so editing the skill still needs no restart.
const SKILL_ROOT = resolve(__dirname, 'skills/strudel');
const skillPrompt = createSkillPromptProvider({ root: SKILL_ROOT });
const loadSystemPrompt = (opts) => skillPrompt.load(opts);

// Fail-fast: read every skill file at boot so a missing/renamed entry surfaces
// during startup instead of on the first /generate request.
await loadSystemPrompt();

// LLM provider chain (CONTRACTS.md §8.1): LLM_PROVIDERS order = priority,
// automatic failover, per-provider circuit breaker. Per-request x-llm-*
// overrides from the Settings UI are prepended to the chain.
const { chain: llmChain, defaultLlmClient, llmClientFor } = composeLlm(config);
console.log(
  `[llm] chain=${llmChain.names.join(' → ') || '(none)'} timeout=${config.llm.timeoutMs}ms max_tokens=${config.llm.maxTokens} history=${config.llm.historyTurns} turns` +
    (defaultLlmClient ? '' : ' (no provider configured — provide one via .env or Settings)'),
);

// STT_PROVIDER picks which transcriber to wire. All conform to the same
// Transcriber port (transcribe(pcm, {language, wavBuffer}) → {text}).
function buildTranscriber(sttCfg) {
  if (sttCfg.provider === 'vosk') {
    const modelPath = sttCfg.voskModelPath || resolve(__dirname, '..', 'models', 'vosk-model-small-en-us-0.15');
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
  if (sttCfg.provider === 'dashscope') {
    const t = createDashScopeStt({
      apiKey: sttCfg.apiKey,
      baseURL: sttCfg.apiBaseURL,
      model: sttCfg.apiModel,
      language: sttCfg.language,
    });
    if (!t) {
      console.warn('[stt] STT_PROVIDER=dashscope but STT_API_KEY is missing — falling back to whisper');
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
  file: process.env.API_METRICS_FILE || resolve(__dirname, '..', 'data', 'metrics', 'transcribe.jsonl'),
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
// Per-request STT override factory. The HTTP layer reads the user's API
// settings from request headers and asks for a one-off transcriber when
// the frontend Settings UI is configured. Light cache keyed on a config
// hash keeps the SDK from being re-instantiated on every request.

const transcriberCache = new Map(); // key → Transcriber
function transcriberFor(overrides) {
  if (!overrides || !overrides.provider) return defaultTranscriber;
  const provider = overrides.provider;
  if (provider === 'whisper')
    return defaultTranscriber.getModelId().startsWith('whisper')
      ? defaultTranscriber
      : buildTranscriber({ ...config.stt, provider: 'whisper' });
  if (provider === 'vosk')
    return defaultTranscriber.getModelId().startsWith('vosk')
      ? defaultTranscriber
      : buildTranscriber({ ...config.stt, provider: 'vosk' });
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
  if (provider === 'dashscope') {
    const apiKey = overrides.apiKey ?? null;
    const baseURL = overrides.baseURL || 'https://dashscope-intl.aliyuncs.com';
    const model = overrides.model || 'paraformer-v2';
    if (!apiKey) return defaultTranscriber;
    const key = `dashscope|${baseURL}|${model}|${apiKey.slice(-6)}`;
    let t = transcriberCache.get(key);
    if (!t) {
      t = createDashScopeStt({ apiKey, baseURL, model, language: config.stt.language });
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
const chatSession = makeChatSession({
  sessionStore,
  generateStrudel,
  validatePattern,
  historyTurns: config.llm.historyTurns,
  limits: { maxPromptChars: config.booth.maxPromptChars, maxCodeBytes: config.booth.maxCodeBytes },
});
const pregenStore = createPregenStore({
  dir: config.booth.pregenDir || resolve(__dirname, '..', 'data', 'pregen'),
});
console.log(
  `[booth] token=${config.booth.token ? 'required' : 'off'} rate-limit=${config.booth.rateLimitPerMin}/min pregen=${pregenStore.dir}`,
);

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
    pregenStore,
  },
});

await server.listen({ port: config.server.port, host: config.server.host });
