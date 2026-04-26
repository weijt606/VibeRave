import Fastify from 'fastify';
import cors from '@fastify/cors';
import { DomainError } from '../../domain/errors.mjs';
import { registerHealth } from './routes/health.mjs';
import { registerGenerate } from './routes/generate.mjs';
import { registerTranscribe } from './routes/transcribe.mjs';
import { registerSessions } from './routes/sessions.mjs';

export async function createServer({ deps, config }) {
  const fastify = Fastify({
    logger: true,
    bodyLimit: config.server.maxBodyBytes,
  });

  await fastify.register(cors, { origin: true });

  fastify.addContentTypeParser(
    ['audio/wav', 'audio/x-wav', 'application/octet-stream'],
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  fastify.setErrorHandler((err, request, reply) => {
    if (err instanceof DomainError) {
      return reply.code(err.status).send({ error: err.message, code: err.code });
    }
    // Upstream provider errors thrown by the LLM/STT adapters carry an
    // explicit `status` (typically 502) plus a `code` like
    // 'llm_upstream_failed' / 'stt_upstream_failed' and a message that
    // already names the provider + status. Pass these through so the
    // frontend can show "OpenAI returned 401: Incorrect API key" instead
    // of a generic internal_error.
    if (typeof err?.status === 'number' && typeof err?.code === 'string' && err.code.endsWith('_upstream_failed')) {
      return reply.code(err.status).send({ error: err.message, code: err.code });
    }
    request.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'internal_error' });
  });

  registerHealth(fastify, deps);
  registerGenerate(fastify, deps);
  registerSessions(fastify, deps);
  registerTranscribe(fastify, deps);

  return fastify;
}
