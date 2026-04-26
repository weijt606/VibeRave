export function registerHealth(fastify, { defaultLlmClient, defaultTranscriber, config }) {
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
}
