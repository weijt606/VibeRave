function intEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Known provider presets. Any other name listed in LLM_PROVIDERS is read
// from LLM_<NAME>_API_KEY / _BASE_URL / _MODEL with no defaults, so e.g.
// `groq` works with three extra env keys and no code change.
const PROVIDER_PRESETS = {
  dashscope: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    needsKey: true,
  },
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  ollama: { baseURL: 'http://localhost:11434/v1', model: 'qwen2.5:14b', needsKey: false },
  lmstudio: { baseURL: 'http://localhost:1234/v1', model: '', needsKey: false },
};

/**
 * Build the ordered provider list from env. Returns entries shaped
 * `{ name, apiKey, baseURL, model, temperature }`; entries that cannot be
 * built (cloud provider without a key, lmstudio without a model) are
 * returned with `skipReason` so the boot log can say why.
 */
export function loadProviderChain({ provider, temperature }, env = process.env) {
  const listed = (env.LLM_PROVIDERS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (listed.length === 0) {
    // Backwards compatibility: no LLM_PROVIDERS → single legacy provider.
    if (provider === 'ollama') {
      return [
        {
          name: 'ollama',
          apiKey: 'ollama',
          baseURL: env.LLM_OLLAMA_BASE_URL || env.OLLAMA_BASE_URL || PROVIDER_PRESETS.ollama.baseURL,
          model: env.LLM_OLLAMA_MODEL || env.OLLAMA_MODEL || PROVIDER_PRESETS.ollama.model,
          temperature,
        },
      ];
    }
    const apiKey = env.LLM_API_KEY || null;
    return [
      {
        name: 'api',
        apiKey,
        baseURL: env.LLM_BASE_URL || PROVIDER_PRESETS.openai.baseURL,
        model: env.LLM_MODEL || PROVIDER_PRESETS.openai.model,
        temperature,
        ...(apiKey ? {} : { skipReason: 'LLM_API_KEY is empty' }),
      },
    ];
  }

  return listed.map((name) => {
    const preset = PROVIDER_PRESETS[name] || { baseURL: '', model: '', needsKey: true };
    const KEY = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const apiKey = env[`LLM_${KEY}_API_KEY`] || (preset.needsKey ? null : name);
    const baseURL = env[`LLM_${KEY}_BASE_URL`] || preset.baseURL || null;
    const model = env[`LLM_${KEY}_MODEL`] || preset.model || '';
    const entry = { name, apiKey, baseURL, model, temperature };
    if (preset.needsKey && !apiKey) entry.skipReason = `LLM_${KEY}_API_KEY is empty`;
    else if (!model) entry.skipReason = `LLM_${KEY}_MODEL is empty`;
    else if (!baseURL) entry.skipReason = `LLM_${KEY}_BASE_URL is empty`;
    return entry;
  });
}

export function loadConfig() {
  // LLM_PROVIDER picks which backend the composition root wires.
  //   'api'    → any OpenAI-compatible endpoint (OpenAI, Gemini's /openai/
  //              endpoint, OpenRouter, Groq, LM Studio, etc.) — set
  //              LLM_API_KEY + LLM_BASE_URL + LLM_MODEL
  //   'ollama' → local Ollama (also OpenAI-compatible at /v1, but kept as
  //              a separate provider so we can drop the auth requirement
  //              and pre-fill the base URL)
  const provider = (process.env.LLM_PROVIDER || 'api').toLowerCase();
  // 0.85 instead of the more common 0.7 default — for live-coding music
  // we actively WANT the model to spread across drum kits, scales, and
  // visualizers rather than collapse onto its single highest-likelihood
  // template every time. Combined with skills/strudel/rules/diversity.md
  // this gives noticeably more varied output.
  const temperature = Number.isFinite(Number(process.env.LLM_TEMPERATURE)) ? Number(process.env.LLM_TEMPERATURE) : 0.85;

  return {
    server: {
      port: Number(process.env.API_PORT || 4322),
      host: process.env.API_HOST || '0.0.0.0',
      maxBodyBytes: Number(process.env.API_MAX_BYTES || 50 * 1024 * 1024),
    },
    llm: {
      // Legacy single-provider view (LLM_PROVIDER / LLM_API_KEY / ...). Still
      // honoured: when LLM_PROVIDERS is unset the provider chain is derived
      // from these keys so existing .env files keep working unchanged.
      provider,
      api: {
        apiKey: process.env.LLM_API_KEY ?? null,
        baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        temperature,
      },
      ollama: {
        baseURL: process.env.LLM_OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        apiKey: 'ollama',
        model: process.env.LLM_OLLAMA_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:14b',
        temperature,
      },
      // Provider chain (docs/booth/CONTRACTS.md §8.1). Order = priority;
      // the chain fails over on timeout / 5xx / 429 / network error.
      providers: loadProviderChain({ provider, temperature }),
      temperature,
      // Per-provider request budget. The chain does the retrying, so the
      // SDK's own retries are disabled and one slow provider costs at most
      // LLM_TIMEOUT_MS before the next one is tried.
      timeoutMs: intEnv('LLM_TIMEOUT_MS', 15000),
      maxTokens: intEnv('LLM_MAX_TOKENS', 1800),
      // Conversation window handed to the model: N user/assistant turn
      // pairs (= 2N messages). META turns inside the window are kept.
      historyTurns: intEnv('LLM_HISTORY_TURNS', 6),
    },
    booth: {
      // Optional shared secret for the booth. When set, /generate* and
      // /transcribe require a matching `x-booth-token` header.
      token: process.env.BOOTH_TOKEN || null,
      // Per-IP sliding window on /generate* (requests per minute).
      rateLimitPerMin: intEnv('API_RATE_LIMIT_PER_MIN', 20),
      // Request body caps (413 when exceeded).
      maxPromptChars: intEnv('API_MAX_PROMPT_CHARS', 500),
      maxCodeBytes: intEnv('API_MAX_CODE_BYTES', 20 * 1024),
      pregenDir: process.env.API_PREGEN_DIR || null,
    },
    stt: {
      // STT_PROVIDER picks which transcriber the composition root wires:
      //   whisper → local smart-whisper (no network, ~700-900ms warm)
      //   vosk    → local closed-grammar VOSK (~10ms, only canonical phrases)
      //   api     → any OpenAI-compatible /audio/transcriptions endpoint
      //             (OpenAI Whisper, Groq Whisper, etc.)
      provider: (process.env.STT_PROVIDER || 'whisper').toLowerCase(),
      // Default to the *multilingual* base model so Chinese-English mixed
      // input works out of the box once the user toggles bilingual mode in
      // the UI. Switch to base.en / small.en for English-only setups if you
      // want a slight accuracy bump at the cost of zh support.
      modelName: process.env.WHISPER_MODEL || 'base',
      gpu: process.env.WHISPER_GPU !== '0',
      // 'auto' lets whisper detect the language per utterance — required for
      // bilingual input. Per-request `lang` from the frontend overrides this.
      language: process.env.WHISPER_LANGUAGE || 'auto',
      offloadSecs: Number(process.env.WHISPER_OFFLOAD_SECS || 86400),
      initialPrompt: process.env.WHISPER_INITIAL_PROMPT || null,
      // Cloud STT defaults (only used when STT_PROVIDER=api). Frontend
      // can override per-request via headers.
      apiKey: process.env.STT_API_KEY ?? null,
      apiBaseURL: process.env.STT_BASE_URL || 'https://api.openai.com/v1',
      apiModel: process.env.STT_MODEL || 'whisper-1',
      // VOSK model directory (only used when STT_PROVIDER=vosk). Defaults
      // to services/api/models/vosk-model-small-en-us-0.15 — see
      // services/api/README.md for the download command.
      voskModelPath: process.env.VOSK_MODEL_PATH || null,
    },
    sessions: {
      dir: process.env.API_SESSIONS_DIR || null,
    },
    dump: {
      // Per-take audio + transcript dumps under data/stage-dumps/. Default
      // OFF — recordings are PII and disk grows fast. Set API_DUMP_STAGES=1
      // for local debugging.
      stages: /^(1|true|yes|on)$/i.test(process.env.API_DUMP_STAGES || ''),
      dir: process.env.API_DUMP_DIR || null,
    },
    transcript: {
      // Optional LLM cleanup pass after STT. Off by default — adds 500-2000ms
      // and the code-gen LLM tolerates loose input well.
      llmCorrect: /^(1|true|yes|on)$/i.test(process.env.LLM_CORRECT_TRANSCRIPT || ''),
    },
  };
}
