import { RateLimited, Unauthorized } from '../../domain/errors.mjs';

/**
 * Tiny in-memory sliding-window rate limiter (no deps). One bucket per key
 * (client IP); each bucket keeps the timestamps of hits inside the window.
 * Idle buckets are pruned lazily so memory tracks active clients only.
 *
 * @param {{ limit: number, windowMs?: number, now?: () => number }} opts
 */
export function createSlidingWindowLimiter({ limit, windowMs = 60_000, now = Date.now }) {
  const buckets = new Map(); // key → number[] (hit timestamps, ascending)
  let lastSweep = 0;

  function sweep(t) {
    if (t - lastSweep < windowMs) return;
    lastSweep = t;
    for (const [key, hits] of buckets) {
      if (hits.length === 0 || hits[hits.length - 1] <= t - windowMs) buckets.delete(key);
    }
  }

  return {
    /** @returns {{ ok: boolean, remaining: number, retryAfterMs: number }} */
    hit(key) {
      const t = now();
      sweep(t);
      let hits = buckets.get(key);
      if (!hits) {
        hits = [];
        buckets.set(key, hits);
      }
      const cutoff = t - windowMs;
      while (hits.length && hits[0] <= cutoff) hits.shift();
      if (hits.length >= limit) {
        return { ok: false, remaining: 0, retryAfterMs: hits[0] + windowMs - t };
      }
      hits.push(t);
      return { ok: true, remaining: limit - hits.length, retryAfterMs: 0 };
    },
    reset() {
      buckets.clear();
    },
    get size() {
      return buckets.size;
    },
  };
}

const GENERATE_RE = /^\/generate(?:\/|$|\?)/;
const TRANSCRIBE_RE = /^\/transcribe(?:\/|$|\?)/;

/**
 * Register booth-token + rate-limit hooks on a Fastify instance.
 *   • BOOTH_TOKEN set → /generate* and /transcribe need `x-booth-token`.
 *   • /generate* is limited to `rateLimitPerMin` hits per client IP.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ token?: string | null, rateLimitPerMin?: number, limiter?: ReturnType<typeof createSlidingWindowLimiter> }} opts
 */
export function registerGuards(fastify, { token = null, rateLimitPerMin = 20, limiter } = {}) {
  const rl = limiter || (rateLimitPerMin > 0 ? createSlidingWindowLimiter({ limit: rateLimitPerMin }) : null);

  fastify.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return; // CORS preflight
    const path = request.url || '';
    const isGenerate = GENERATE_RE.test(path);
    const isTranscribe = TRANSCRIBE_RE.test(path);
    if (!isGenerate && !isTranscribe) return;

    if (token) {
      const got = request.headers['x-booth-token'];
      if (typeof got !== 'string' || got.trim() !== token) throw new Unauthorized();
    }

    if (rl && isGenerate) {
      const res = rl.hit(request.ip || 'unknown');
      reply.header('x-ratelimit-limit', String(rateLimitPerMin));
      reply.header('x-ratelimit-remaining', String(res.remaining));
      if (!res.ok) {
        const secs = Math.max(1, Math.ceil(res.retryAfterMs / 1000));
        reply.header('retry-after', String(secs));
        throw new RateLimited(`Rate limit: ${rateLimitPerMin} requests per minute per client.`, res.retryAfterMs);
      }
    }
  });

  return rl;
}
