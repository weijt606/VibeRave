import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.mjs';
import { createGeminiClient } from './infrastructure/gemini-client.mjs';
import { createOllamaClient } from './infrastructure/ollama-client.mjs';
import { createWhisperTranscriber } from './infrastructure/whisper-transcriber.mjs';
import { createGeminiStt } from './infrastructure/gemini-stt.mjs';
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

// LLM_PROVIDER picks which backend to use:
//   gemini → Google AI Studio (default; needs GEMINI_API_KEY, free tier OK)
//   ollama → local Ollama daemon (needs the model already pulled)
function buildLlmClient(llmCfg) {
  if (llmCfg.provider === 'ollama') {
    return createOllamaClient(llmCfg.ollama);
  }
  return createGeminiClient(llmCfg.gemini);
}
const llmClient = buildLlmClient(config.llm);
console.log(`[llm] provider=${config.llm.provider}`);

// STT_PROVIDER picks which transcriber to wire. All conform to the same
// Transcriber port (transcribe(pcm, {language, wavBuffer}) → {text}).
//   whisper → local smart-whisper (no network, ~700-900ms warm)
//   gemini  → Gemini multimodal API (~1-2s, best free-form accuracy)
//   vosk    → local closed-grammar VOSK (~10ms, only canonical phrases)
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
  if (sttCfg.provider === 'gemini') {
    const t = createGeminiStt({
      apiKey: config.llm.gemini.apiKey,
      model: sttCfg.geminiModel,
      language: sttCfg.language,
    });
    if (!t) {
      console.warn('[stt] STT_PROVIDER=gemini but GEMINI_API_KEY is missing — falling back to whisper');
      return createWhisperTranscriber(sttCfg);
    }
    return t;
  }
  return createWhisperTranscriber(sttCfg);
}
const transcriber = buildTranscriber(config.stt);
console.log(`[stt] provider=${config.stt.provider} model=${transcriber.getModelId()}`);
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

// Optional post-STT LLM cleanup. Catches recognition errors the static
// dictionary in whisper-transcriber can't (artist names, half-heard
// phrases, fillers). Default OFF; set LLM_CORRECT_TRANSCRIPT=true to
// enable (adds one Gemini/Ollama call per voice take).
const transcriptNormalizer = config.transcript.llmCorrect
  ? makeTranscriptNormalizer({ llmClient })
  : null;
console.log(`[transcript-normalizer] ${transcriptNormalizer ? 'enabled' : 'disabled'}`);

const generateStrudel = makeGenerateStrudel({ llmClient, loadSystemPrompt });
const transcribeAudio = makeTranscribeAudio({
  transcriber,
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
    llmClient,
    transcriber,
    sessionStore,
    metricsStore,
    generateStrudel,
    transcribeAudio,
    chatSession,
  },
});

await server.listen({ port: config.server.port, host: config.server.host });
