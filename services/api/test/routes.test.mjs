import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../src/interface/http/server.mjs';
import { createProviderChain } from '../src/infrastructure/provider-chain.mjs';
import { createPregenStore, styleSlug } from '../src/infrastructure/pregen-store.mjs';
import { makeChatSession } from '../src/application/chat-session.mjs';
import { makeGenerateStrudel } from '../src/application/generate-strudel.mjs';
import { memorySessionStore, scriptedClient, failingClient, testConfig, VALID_CODE } from './helpers.mjs';

function parseSse(text) {
  return text
    .split('\n\n')
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const ev = /^event: (.*)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      return { event: ev, data: data ? JSON.parse(data) : null };
    });
}

async function boot({ chain, pregenStore = null } = {}) {
  const config = testConfig({
    llm: {
      provider: 'api',
      providers: [{ name: 'dashscope', model: 'qwen-plus', baseURL: 'https://x/v1' }],
      api: {},
      ollama: {},
    },
  });
  const generateStrudel = makeGenerateStrudel({ defaultLlmClient: chain, loadSystemPrompt: async () => 'SYS' });
  const chatSession = makeChatSession({
    sessionStore: memorySessionStore(),
    generateStrudel,
    validatePattern: async () => ({ valid: true }),
  });
  const app = await createServer({
    config,
    deps: {
      config,
      chatSession,
      transcribeAudio: async () => ({ text: '' }),
      defaultLlmClient: chain,
      defaultTranscriber: null,
      llmClientFor: () => chain,
      transcriberFor: () => null,
      pregenStore,
    },
  });
  return app;
}

describe('/generate + /generate/stream', () => {
  const chain = () =>
    createProviderChain({
      providers: [
        { name: 'dashscope', model: 'qwen-plus', client: failingClient('dashscope', { status: 503 }) },
        {
          name: 'ollama',
          model: 'qwen2.5:14b',
          client: scriptedClient([`${VALID_CODE}\nEXPLAIN: 加了鼓`], { name: 'ollama' }),
        },
      ],
      log: () => {},
    });

  it('non-stream response gains provider + explain', async () => {
    const app = await boot({ chain: chain() });
    const res = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: {
        sessionId: 's1',
        prompt: '加鼓',
        mode: 'adult',
        lang: 'zh',
        intent: 'generate',
        tracks: [{ name: 'Bass', summary: 'x' }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ code: VALID_CODE, provider: 'ollama', explain: '加了鼓', validated: true });
    const bad = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { sessionId: 's1', prompt: 'x', mode: 'nope' },
    });
    expect(bad.statusCode).toBe(400);
    await app.close();
  });

  it('SSE emits received → generating (per provider) → validating → done', async () => {
    const app = await boot({ chain: chain() });
    const res = await app.inject({
      method: 'POST',
      url: '/generate/stream',
      payload: { sessionId: 's2', prompt: '加鼓' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const events = parseSse(res.body);
    expect(events.map((e) => e.event)).toEqual(['received', 'generating', 'generating', 'validating', 'done']);
    expect(events[1].data).toEqual({ provider: 'dashscope' });
    expect(events[2].data).toEqual({ provider: 'ollama' });
    expect(events[3].data).toEqual({ attempt: 1 });
    expect(events[4].data).toMatchObject({ code: VALID_CODE, explain: '加了鼓', provider: 'ollama' });
    await app.close();
  });

  it('SSE error event carries the domain error', async () => {
    const app = await boot({ chain: chain() });
    const res = await app.inject({ method: 'POST', url: '/generate/stream', payload: { sessionId: 's3', prompt: '' } });
    const events = parseSse(res.body);
    expect(events.at(-1).event).toBe('error');
    expect(events.at(-1).data).toMatchObject({ status: 400, code: 'invalid_input' });
    await app.close();
  });
});

describe('/health/providers', () => {
  it('reports chain health', async () => {
    const c = chainWith();
    const app = await boot({ chain: c });
    await app.inject({ method: 'POST', url: '/generate', payload: { sessionId: 'h', prompt: 'x' } });
    const res = await app.inject({ method: 'GET', url: '/health/providers' });
    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list.map((p) => p.name)).toEqual(['dashscope', 'ollama']);
    expect(list[0]).toMatchObject({ model: 'qwen-plus', healthy: true, consecutiveFailures: 1 });
    expect(list[0].lastError).toMatch(/503/);
    expect(list[1]).toMatchObject({ healthy: true, lastError: null });
    const health = (await app.inject({ method: 'GET', url: '/health' })).json();
    expect(health.llm).toMatchObject({ ready: true, provider: 'dashscope', providers: ['dashscope'] });
    await app.close();
  });
  function chainWith() {
    return createProviderChain({
      providers: [
        { name: 'dashscope', model: 'qwen-plus', client: failingClient('dashscope', { status: 503 }) },
        { name: 'ollama', model: 'qwen2.5:14b', client: scriptedClient([VALID_CODE], { name: 'ollama' }) },
      ],
      log: () => {},
    });
  }
});

describe('/pregen', () => {
  it('404 when empty, random pick when present, style-slug matching', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pregen-'));
    await mkdir(join(dir, 'adult'), { recursive: true });
    await mkdir(join(dir, 'kids'), { recursive: true });
    await writeFile(join(dir, 'adult', 'deep-house-1.json'), JSON.stringify({ style: 'deep house', code: 'a' }));
    await writeFile(join(dir, 'adult', 'deep-house-2.json'), JSON.stringify({ style: 'deep house', code: 'b' }));
    await writeFile(
      join(dir, 'kids', `${styleSlug('8-bit 游戏')}-1.json`),
      JSON.stringify({ style: '8-bit 游戏', code: 'k' }),
    );
    let seq = [0.1, 0.9];
    const store = createPregenStore({ dir, random: () => seq.shift() ?? 0 });
    const app = await boot({ chain: createProviderChain({ providers: [], log: () => {} }), pregenStore: store });

    expect((await app.inject({ method: 'GET', url: '/pregen?mode=adult&style=techno' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/pregen?mode=teen' })).statusCode).toBe(400);
    const a = await app.inject({ method: 'GET', url: '/pregen?mode=adult&style=deep%20house' });
    expect(a.json()).toMatchObject({ code: 'a', file: 'adult/deep-house-1.json' });
    const b = await app.inject({ method: 'GET', url: '/pregen?mode=adult&style=deep%20house' });
    expect(b.json().code).toBe('b');
    // "house" must not match "deep-house-*"
    expect((await app.inject({ method: 'GET', url: '/pregen?mode=adult&style=house' })).statusCode).toBe(404);
    const k = await app.inject({ method: 'GET', url: `/pregen?mode=kids&style=${encodeURIComponent('8-bit 游戏')}` });
    expect(k.json().code).toBe('k');
    expect((await app.inject({ method: 'GET', url: '/pregen?mode=kids' })).json().code).toBe('k');
    await app.close();
  });
});
