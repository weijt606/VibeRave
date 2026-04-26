export function registerTranscribe(fastify, { transcribeAudio }) {
  fastify.post('/transcribe', async (request) => {
    const language = request.query?.lang || undefined;
    const sessionId = request.query?.sessionId || request.headers['x-session-id'] || null;
    return transcribeAudio({
      wavBuffer: request.body,
      language,
      sessionId,
    });
  });
}
