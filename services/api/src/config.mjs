export function loadConfig() {
  // LLM_PROVIDER picks which backend the composition root wires.
  //   'api'    → any OpenAI-compatible endpoint (OpenAI, Gemini's /openai/
  //              endpoint, OpenRouter, Groq, LM Studio, etc.) — set
  //              LLM_API_KEY + LLM_BASE_URL + LLM_MODEL
  //   'ollama' → local Ollama (also OpenAI-compatible at /v1, but kept as
  //              a separate provider so we can drop the auth requirement
  //              and pre-fill the base URL)
  const provider = (process.env.LLM_PROVIDER || 'api').toLowerCase();

  return {
    server: {
      port: Number(process.env.API_PORT || 4322),
      host: process.env.API_HOST || '0.0.0.0',
      maxBodyBytes: Number(process.env.API_MAX_BYTES || 50 * 1024 * 1024),
    },
    llm: {
      provider,
      api: {
        // OpenAI-compatible defaults. baseURL: any provider that speaks
        // /v1/chat/completions. apiKey: that provider's key.
        // The frontend can override all three per-request via headers.
        apiKey: process.env.LLM_API_KEY ?? null,
        baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        // 0.85 instead of the more common 0.7 default — for live-coding music
        // we actively WANT the model to spread across drum kits, scales, and
        // visualizers rather than collapse onto its single highest-likelihood
        // template every time. Combined with skills/strudel/rules/diversity.md
        // this gives noticeably more varied output.
        temperature: Number.isFinite(Number(process.env.LLM_TEMPERATURE))
          ? Number(process.env.LLM_TEMPERATURE)
          : 0.85,
      },
      ollama: {
        // Ollama's OpenAI-compatible endpoint. No API key needed; pass
        // any non-empty string to satisfy the SDK.
        baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        apiKey: 'ollama',
        model: process.env.OLLAMA_MODEL || 'qwen2.5:14b',
        temperature: Number.isFinite(Number(process.env.LLM_TEMPERATURE))
          ? Number(process.env.LLM_TEMPERATURE)
          : 0.85,
      },
    },
    stt: {
      // STT_PROVIDER picks which transcriber the composition root wires:
      //   whisper → local smart-whisper (no network, ~700-900ms warm)
      //   vosk    → local closed-grammar VOSK (~10ms, only canonical phrases)
      //   api     → any OpenAI-compatible /audio/transcriptions endpoint
      //             (OpenAI Whisper, Groq Whisper, etc.)
      provider: (process.env.STT_PROVIDER || 'whisper').toLowerCase(),
      modelName: process.env.WHISPER_MODEL || 'base.en',
      gpu: process.env.WHISPER_GPU !== '0',
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
