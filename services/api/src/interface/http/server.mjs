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
    request.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'internal_error' });
  });

  registerHealth(fastify, deps);
  registerGenerate(fastify, deps);
  registerSessions(fastify, deps);
  registerTranscribe(fastify, deps);

  return fastify;
}
