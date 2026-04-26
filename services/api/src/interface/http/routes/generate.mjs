export function registerGenerate(fastify, { chatSession }) {
  fastify.post('/generate', async (request) => {
    const { sessionId, prompt, currentCode } = request.body ?? {};
    return chatSession.sendTurn({ sessionId, prompt, currentCode });
  });

  // Stateless fix endpoint: the browser hits this when its hot-swapped
  // pattern emits runtime errors (sound not loaded, NaN AudioParam,
  // wrong-typed control). We synthesize a fix prompt server-side so the
  // synthetic turn never lands in the user-visible chat history.
  fastify.post('/generate/fix', async (request) => {
    const { currentCode, error } = request.body ?? {};
    return chatSession.fix({ currentCode, error });
  });
}
