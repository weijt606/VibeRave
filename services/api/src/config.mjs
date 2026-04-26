export function loadConfig() {
  // LLM_PROVIDER picks which backend the composition root wires.
  // Valid: 'gemini' (default, cloud) | 'ollama' (local daemon).
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

  return {
    server: {
      port: Number(process.env.API_PORT || 4322),
      host: process.env.API_HOST || '0.0.0.0',
      maxBodyBytes: Number(process.env.API_MAX_BYTES || 50 * 1024 * 1024),
    },
    llm: {
      provider,
      gemini: {
        apiKey: process.env.GEMINI_API_KEY ?? null,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        // 0.85 instead of the more common 0.7 default — for live-coding music
        // we actively WANT the model to spread across drum kits, scales, and
        // visualizers rather than collapse onto its single highest-likelihood
        // "lo-fi LinnDrum + Rhodes" template every time. Combined with
        // skills/strudel/rules/diversity.md this gives noticeably more varied
        // output. Override via GEMINI_TEMPERATURE if a particular voice needs
        // it dialled back.
        temperature: Number.isFinite(Number(process.env.GEMINI_TEMPERATURE))
          ? Number(process.env.GEMINI_TEMPERATURE)
          : 0.85,
      },
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'qwen2.5:14b',
        // num_ctx — Ollama default is 2K which truncates our ~16K-token skill
        // prompt into uselessness. Bump to fit the assembled skill plus headroom.
        numCtx: Number(process.env.OLLAMA_NUM_CTX || 32768),
        // Thinking-capable models (qwen3:*) emit chain-of-thought before any
        // answer — fine for research chat, useless for live-coding loops where
        // we want sub-second code drops.
        think: /^(1|true|yes|on)$/i.test(process.env.OLLAMA_THINK || ''),
      },
    },
    stt: {
      // STT_PROVIDER picks which transcriber the composition root wires:
      //   whisper → local smart-whisper (default, no network, ~700-900ms)
      //   gemini  → Gemini multimodal API (~1-2s, best free-form accuracy;
      //             uses the same GEMINI_API_KEY as code-gen)
      //   vosk    → local closed-grammar VOSK (~10ms, only recognises the
      //             canonical phrases — see vosk-transcriber.mjs)
      provider: (process.env.STT_PROVIDER || 'whisper').toLowerCase(),
      modelName: process.env.WHISPER_MODEL || 'base.en',
      gpu: process.env.WHISPER_GPU !== '0',
      language: process.env.WHISPER_LANGUAGE || 'auto',
      // smart-whisper offloads the model after this many seconds idle.
      // Default ~1 day = effectively resident; set to a small number
      // to free RAM aggressively, or 300 to match the SDK default.
      offloadSecs: Number(process.env.WHISPER_OFFLOAD_SECS || 86400),
      // Optional override for the DJ vocab biasing prompt fed to the
      // decoder as `initial_prompt`. When unset, whisper-transcriber.mjs
      // uses its built-in DJ/Strudel vocab.
      initialPrompt: process.env.WHISPER_INITIAL_PROMPT || null,
      // Gemini STT model. gemini-2.5-flash has the broadest free-tier
      // quota and lands transcripts in ~2s warm.
      geminiModel: process.env.GEMINI_STT_MODEL || 'gemini-2.5-flash',
      // VOSK model directory (only used when STT_PROVIDER=vosk). Default
      // points at the small-en model in services/api/models/ — download
      // separately, see services/api/README.md.
      voskModelPath: process.env.VOSK_MODEL_PATH || null,
    },
    sessions: {
      dir: process.env.API_SESSIONS_DIR || null,
    },
    dump: {
      // Writes raw.wav / raw.txt / final.txt / meta.json per voice take so
      // you can A/B different STT backends and diff transcripts offline.
      // Default OFF — recordings are PII and disk grows fast. Set
      // API_DUMP_STAGES=1 to enable for development.
      stages: /^(1|true|yes|on)$/i.test(process.env.API_DUMP_STAGES || ''),
      dir: process.env.API_DUMP_DIR || null,
    },
    transcript: {
      // Optional LLM cleanup pass after STT. Catches recognition errors
      // the static dictionary in whisper-transcriber can't (artist names,
      // half-heard phrases, fillers). Default OFF — adds 500-2000ms per
      // take and the code-gen LLM tolerates loose input well. Set
      // LLM_CORRECT_TRANSCRIPT=true to enable.
      llmCorrect: /^(1|true|yes|on)$/i.test(process.env.LLM_CORRECT_TRANSCRIPT || ''),
    },
  };
}
