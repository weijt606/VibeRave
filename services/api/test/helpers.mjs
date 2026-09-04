// Shared stubs for services/api tests. No network, no ports, no native STT.

export function memorySessionStore() {
  const records = new Map();
  return {
    records,
    async load(id) {
      const r = records.get(id);
      return r ? JSON.parse(JSON.stringify(r)) : { id, createdAt: 't', updatedAt: 't', messages: [] };
    },
    async save(record) {
      records.set(record.id, JSON.parse(JSON.stringify(record)));
    },
    async clear(id) {
      records.delete(id);
    },
  };
}

/** LlmClient whose replies come from `script` (array or fn(args)). */
export function scriptedClient(script, { name = 'stub', model = 'stub-model', delayMs = 0 } = {}) {
  const calls = [];
  let i = 0;
  return {
    name,
    model,
    calls,
    async complete(args) {
      calls.push(args);
      args.onAttempt?.(name);
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      const item = typeof script === 'function' ? script(args, i) : script[Math.min(i, script.length - 1)];
      i += 1;
      if (item instanceof Error) throw item;
      if (typeof item === 'string') return { text: item, model, provider: name };
      return { model, provider: name, ...item };
    },
  };
}

export function failingClient(name, { status = 500, timedOut = false, message } = {}) {
  return scriptedClient(
    () => {
      const err = new Error(message || `${name} failed${status ? ` with HTTP ${status}` : ''}`);
      err.status = 502;
      err.code = 'llm_upstream_failed';
      err.upstreamStatus = status;
      err.timedOut = timedOut;
      return err;
    },
    { name },
  );
}

export const VALID_CODE = 's("bd sd")';
export const testConfig = (over = {}) => ({
  server: { maxBodyBytes: 1024 * 1024, logger: false },
  llm: { provider: 'api', providers: [], api: {}, ollama: {} },
  stt: { provider: 'whisper' },
  booth: { token: null, rateLimitPerMin: 0 },
  ...over,
});
