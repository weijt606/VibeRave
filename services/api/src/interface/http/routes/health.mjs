export function registerHealth(fastify, { llmClient, transcriber, config }) {
  fastify.get('/health', async () => {
    const provider = config.llm.provider;
    const model = provider === 'ollama'
      ? config.llm.ollama.model
      : config.llm.gemini.model;
    return {
      ok: true,
      service: 'viberave-api',
      llm: {
        ready: Boolean(llmClient),
        provider,
        model,
      },
      stt: {
        ready: Boolean(transcriber),
        provider: config.stt.provider,
        model: transcriber ? transcriber.getModelId() : null,
      },
    };
  });
}
