export function registerSessions(fastify, { chatSession }) {
  fastify.get('/sessions/:id', async (request) => {
    return chatSession.getMessages(request.params.id);
  });

  fastify.delete('/sessions/:id', async (request) => {
    await chatSession.clear(request.params.id);
    return { ok: true };
  });
}
