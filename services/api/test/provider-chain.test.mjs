import { describe, it, expect } from 'vitest';
import { createProviderChain } from '../src/infrastructure/provider-chain.mjs';
import { scriptedClient, failingClient } from './helpers.mjs';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, tick: (ms) => (t += ms) };
}

describe('provider chain', () => {
  it('fails over to the next provider and reports which one served', async () => {
    const chain = createProviderChain({
      providers: [
        { name: 'dashscope', model: 'qwen-plus', client: failingClient('dashscope', { status: 503 }) },
        { name: 'ollama', model: 'qwen2.5:14b', client: scriptedClient(['s("bd")'], { name: 'ollama' }) },
      ],
      log: () => {},
    });
    const seen = [];
    const r = await chain.complete({ systemPrompt: 's', userMessage: 'u', onAttempt: (n) => seen.push(n) });
    expect(r.provider).toBe('ollama');
    expect(r.text).toBe('s("bd")');
    expect(typeof r.latencyMs).toBe('number');
    expect(seen).toEqual(['dashscope', 'ollama']);
  });

  it('opens the breaker after 2 consecutive failures, cools down, then half-open probes', async () => {
    const c = clock();
    const primary = failingClient('cloud', { timedOut: true });
    const local = scriptedClient(['ok'], { name: 'local' });
    const chain = createProviderChain({
      providers: [
        { name: 'cloud', model: 'm', client: primary },
        { name: 'local', model: 'l', client: local },
      ],
      now: c.now,
      cooldownMs: 60_000,
      log: () => {},
    });
    await chain.complete({});
    expect(chain.health()[0].healthy).toBe(true); // 1 failure — still tried
    await chain.complete({});
    let h = chain.health();
    expect(h[0]).toMatchObject({ name: 'cloud', healthy: false, consecutiveFailures: 2 });
    expect(h[0].lastError).toMatch(/timed out|failed/);
    expect(h[0].cooldownRemainingMs).toBe(60_000);
    expect(h[1]).toMatchObject({ name: 'local', healthy: true, lastError: null });
    expect(typeof h[1].lastLatencyMs).toBe('number');

    // Within the cooldown the primary is skipped entirely.
    const before = primary.calls.length;
    await chain.complete({});
    expect(primary.calls.length).toBe(before);
    expect(chain.nextAvailable()).toBe('local');

    // After the cooldown: half-open probe. Success closes the breaker.
    c.tick(60_001);
    expect(chain.nextAvailable()).toBe('cloud');
    const recovered = scriptedClient(['back'], { name: 'cloud' });
    chain.health(); // no side effects
    // Swap the client's behaviour by making the failing client succeed once.
    primary.complete = recovered.complete;
    const r = await chain.complete({});
    expect(r.provider).toBe('cloud');
    h = chain.health();
    expect(h[0]).toMatchObject({ healthy: true, consecutiveFailures: 0, lastError: null });
  });

  it('a failed half-open probe re-arms the cooldown', async () => {
    const c = clock();
    const chain = createProviderChain({
      providers: [
        { name: 'a', model: 'm', client: failingClient('a') },
        { name: 'b', model: 'm', client: scriptedClient(['ok'], { name: 'b' }) },
      ],
      now: c.now,
      cooldownMs: 1000,
      log: () => {},
    });
    await chain.complete({});
    await chain.complete({});
    c.tick(1001);
    await chain.complete({}); // probe fails
    expect(chain.health()[0].healthy).toBe(false);
    expect(chain.health()[0].cooldownRemainingMs).toBe(1000);
  });

  it('throws a 502 with every failure listed when all providers fail, 503 when all are cooling down', async () => {
    const c = clock();
    const chain = createProviderChain({
      providers: [
        { name: 'a', model: 'm', client: failingClient('a', { status: 429 }) },
        { name: 'b', model: 'm', client: failingClient('b', { status: 0, message: 'ECONNREFUSED' }) },
      ],
      now: c.now,
      log: () => {},
    });
    await expect(chain.complete({})).rejects.toMatchObject({ status: 502, code: 'llm_upstream_failed' });
    await expect(chain.complete({})).rejects.toThrow(/a: .*429.*\| b: .*ECONNREFUSED/);
    await expect(chain.complete({})).rejects.toMatchObject({ status: 503 });
  });

  it('503 when nothing is configured', async () => {
    const chain = createProviderChain({ providers: [], log: () => {} });
    await expect(chain.complete({})).rejects.toMatchObject({ status: 503, code: 'llm_not_configured' });
  });

  it('withPrepended puts the override first and shares base health', async () => {
    const base = createProviderChain({
      providers: [{ name: 'base', model: 'm', client: scriptedClient(['base'], { name: 'base' }) }],
      log: () => {},
    });
    const over = base.withPrepended({
      name: 'override:api',
      model: 'gpt',
      client: scriptedClient(['over'], { name: 'override:api' }),
    });
    expect(over.names).toEqual(['override:api', 'base']);
    const r = await over.complete({});
    expect(r.provider).toBe('override:api');
    await base.complete({});
    expect(over.health()[1].lastLatencyMs).toBe(base.health()[0].lastLatencyMs);
  });
});
