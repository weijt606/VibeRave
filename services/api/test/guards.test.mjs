import { describe, it, expect } from 'vitest';
import { createSlidingWindowLimiter } from '../src/interface/http/guards.mjs';
import { createServer } from '../src/interface/http/server.mjs';
import { testConfig } from './helpers.mjs';

describe('sliding window rate limiter', () => {
  it('allows `limit` hits per window, then 429s with retryAfter, then recovers', () => {
    let t = 0;
    const rl = createSlidingWindowLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    expect(rl.hit('ip').ok).toBe(true);
    t = 10_000;
    expect(rl.hit('ip').ok).toBe(true);
    expect(rl.hit('ip')).toMatchObject({ ok: true, remaining: 0 });
    const denied = rl.hit('ip');
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterMs).toBe(50_000); // first hit at t=0 expires at 60 s
    expect(rl.hit('other').ok).toBe(true);
    t = 60_001; // first hit expired
    expect(rl.hit('ip').ok).toBe(true);
    expect(rl.hit('ip').ok).toBe(false);
  });
});

async function server(
  booth,
  chatSession = {
    sendTurn: async (a) => ({ code: 's("bd")', ok: true, ...a }),
    fix: async (a) => ({ code: 's("bd")', ...a }),
  },
) {
  const config = testConfig({ booth });
  return createServer({
    config,
    deps: {
      config,
      chatSession,
      transcribeAudio: async () => ({ text: 'hi' }),
      defaultLlmClient: null,
      defaultTranscriber: null,
      llmClientFor: () => null,
      transcriberFor: () => null,
      pregenStore: null,
    },
  });
}

describe('booth token + rate limit hooks', () => {
  it('rejects /generate* and /transcribe without the token, passes other routes', async () => {
    const app = await server({ token: 'secret', rateLimitPerMin: 0 });
    const body = { sessionId: 's', prompt: 'x' };
    expect((await app.inject({ method: 'POST', url: '/generate', payload: body })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/generate/stream', payload: body })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/transcribe',
          payload: Buffer.alloc(0),
          headers: { 'content-type': 'audio/wav' },
        })
      ).statusCode,
    ).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    const ok = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: body,
      headers: { 'x-booth-token': 'secret' },
    });
    expect(ok.statusCode).toBe(200);
    await app.close();
  });
  it('limits /generate per IP and sets retry-after', async () => {
    const app = await server({ token: null, rateLimitPerMin: 2 });
    const body = { sessionId: 's', prompt: 'x' };
    expect((await app.inject({ method: 'POST', url: '/generate', payload: body })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/generate/fix', payload: body })).statusCode).toBe(200);
    const third = await app.inject({ method: 'POST', url: '/generate', payload: body });
    expect(third.statusCode).toBe(429);
    expect(third.json()).toMatchObject({ code: 'rate_limited' });
    expect(Number(third.headers['retry-after'])).toBeGreaterThan(0);
    // /health is not limited
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    await app.close();
  });
});
