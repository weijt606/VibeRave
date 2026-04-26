import { readLlmOverrides, readSttOverrides } from '../override-headers.mjs';

export function registerHealth(
  fastify,
  { defaultLlmClient, defaultTranscriber, llmClientFor, transcriberFor, config },
) {
  fastify.get('/health', async () => {
    const provider = config.llm.provider;
    const cfg = provider === 'ollama' ? config.llm.ollama : config.llm.api;
    return {
      ok: true,
      service: 'viberave-api',
      llm: {
        ready: Boolean(defaultLlmClient),
        provider,
        baseURL: cfg.baseURL,
        model: cfg.model,
      },
      stt: {
        ready: Boolean(defaultTranscriber),
        provider: config.stt.provider,
        model: defaultTranscriber ? defaultTranscriber.getModelId() : null,
      },
    };
  });

  // Test buttons in the API Settings panel hit these to verify the
  // user's configured provider actually responds. Both endpoints accept
  // the same x-llm-* / x-stt-* override headers as /generate and
  // /transcribe, so a successful 200 here guarantees the same client
  // will work in production calls. Latency is the round-trip from
  // request enter to provider response.

  fastify.get('/health/test-llm', async (request, reply) => {
    const llmOverrides = readLlmOverrides(request.headers);
    const client = llmClientFor ? llmClientFor(llmOverrides) : defaultLlmClient;
    if (!client) {
      return reply.code(503).send({
        ok: false,
        error:
          'LLM not configured — paste an API key into the API Settings panel or set LLM_API_KEY in .env.',
      });
    }
    const t0 = Date.now();
    try {
      const result = await client.complete({
        systemPrompt: 'Reply with exactly the single word: ok',
        userMessage: 'ping',
        temperature: 0,
      });
      return {
        ok: true,
        ms: Date.now() - t0,
        model: result.model,
        sample: (result.text || '').slice(0, 64),
      };
    } catch (err) {
      const status =
        typeof err?.status === 'number' && err.status >= 400 ? err.status : 502;
      return reply.code(status).send({
        ok: false,
        ms: Date.now() - t0,
        error: err?.message || String(err),
      });
    }
  });

  fastify.get('/health/test-stt', async (request, reply) => {
    const sttOverrides = readSttOverrides(request.headers);
    const transcriber = transcriberFor ? transcriberFor(sttOverrides) : defaultTranscriber;
    if (!transcriber) {
      return reply.code(503).send({
        ok: false,
        error: 'STT not configured — pick a provider in the API Settings panel.',
      });
    }
    // Synthetic 0.5s mono 16-kHz silence WAV. We mostly care about the
    // round-trip latency + that the provider accepts the request — the
    // empty transcript is fine.
    const sampleRate = 16000;
    const seconds = 0.5;
    const numSamples = Math.round(sampleRate * seconds);
    const pcm = new Float32Array(numSamples);
    const t0 = Date.now();
    try {
      const result = await transcriber.transcribe(pcm, { language: 'en' });
      return {
        ok: true,
        ms: Date.now() - t0,
        model: transcriber.getModelId(),
        sample: (result.text || '').slice(0, 64),
      };
    } catch (err) {
      const status =
        typeof err?.status === 'number' && err.status >= 400 ? err.status : 502;
      return reply.code(status).send({
        ok: false,
        ms: Date.now() - t0,
        error: err?.message || String(err),
      });
    }
  });
}
