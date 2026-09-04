import { readLlmOverrides } from '../override-headers.mjs';

// Booth request-body extensions (docs/booth/CONTRACTS.md §8.2). All optional.
function boothFields(body) {
  const { mode, lang, intent, tracks } = body ?? {};
  return { mode, lang, intent, tracks };
}

function sseWrite(res, event, data) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`);
}

export function registerGenerate(fastify, { chatSession }) {
  fastify.post('/generate', async (request) => {
    const { sessionId, prompt, currentCode } = request.body ?? {};
    const llmOverrides = readLlmOverrides(request.headers);
    return chatSession.sendTurn({
      sessionId,
      prompt,
      currentCode,
      llmOverrides,
      ...boothFields(request.body),
    });
  });

  // Same pipeline as /generate, but progress goes out as Server-Sent
  // Events so the booth UI can show "generating on dashscope…" /
  // "validating (2)…" instead of a spinner:
  //   received → generating {provider} (once per provider attempt)
  //            → validating {attempt} → done {…same payload as /generate}
  //            | error {message, code, status}
  // The reply is hijacked, so CORS headers set by the plugin are copied
  // onto the raw response by hand.
  fastify.post('/generate/stream', async (request, reply) => {
    const { sessionId, prompt, currentCode } = request.body ?? {};
    const llmOverrides = readLlmOverrides(request.headers);
    const res = reply.raw;
    reply.hijack();
    res.writeHead(200, {
      ...reply.getHeaders(),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.flushHeaders?.();
    sseWrite(res, 'received', { sessionId: sessionId ?? null });
    try {
      const result = await chatSession.sendTurn({
        sessionId,
        prompt,
        currentCode,
        llmOverrides,
        ...boothFields(request.body),
        onProgress: ({ type, ...data }) => sseWrite(res, type, data),
      });
      sseWrite(res, 'done', result);
    } catch (err) {
      const status = typeof err?.status === 'number' ? err.status : 500;
      if (status >= 500 && !err?.code) request.log.error({ err }, 'stream generate failed');
      sseWrite(res, 'error', {
        message: err?.message || 'internal_error',
        code: err?.code || 'internal_error',
        status,
      });
    } finally {
      res.end();
    }
  });

  // Stateless fix endpoint: the browser hits this when its hot-swapped
  // pattern emits runtime errors (sound not loaded, NaN AudioParam,
  // wrong-typed control). We synthesize a fix prompt server-side so the
  // synthetic turn never lands in the user-visible chat history.
  fastify.post('/generate/fix', async (request) => {
    const { currentCode, error } = request.body ?? {};
    const llmOverrides = readLlmOverrides(request.headers);
    return chatSession.fix({ currentCode, error, llmOverrides, ...boothFields(request.body) });
  });
}
