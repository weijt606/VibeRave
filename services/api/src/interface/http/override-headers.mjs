// Per-request override headers from the frontend Settings UI.
//
// The frontend stores LLM/STT credentials in localStorage and sends them
// with every API call. The backend never persists these values — they
// pass through into a cached client and stay in process memory only.
//
// Header names are intentionally x-prefixed and lowercase so they survive
// reverse-proxy normalisation. All are optional; missing headers fall
// back to the env-configured defaults.

function pick(headers, name) {
  const v = headers[name.toLowerCase()];
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  return v.trim();
}

function pickNumber(headers, name) {
  const v = pick(headers, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function readLlmOverrides(headers) {
  const provider = pick(headers, 'x-llm-provider');
  const apiKey = pick(headers, 'x-llm-api-key');
  const baseURL = pick(headers, 'x-llm-base-url');
  const model = pick(headers, 'x-llm-model');
  const temperature = pickNumber(headers, 'x-llm-temperature');
  if (!apiKey && !baseURL && !model && !provider && temperature === undefined) {
    return null;
  }
  return { provider, apiKey, baseURL, model, temperature };
}

export function readSttOverrides(headers) {
  const provider = pick(headers, 'x-stt-provider');
  const apiKey = pick(headers, 'x-stt-api-key');
  const baseURL = pick(headers, 'x-stt-base-url');
  const model = pick(headers, 'x-stt-model');
  if (!provider && !apiKey && !baseURL && !model) return null;
  return { provider, apiKey, baseURL, model };
}
