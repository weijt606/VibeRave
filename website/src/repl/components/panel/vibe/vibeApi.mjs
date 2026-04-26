export const API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_API_URL) ||
  'http://localhost:4322';

export async function fetchSessionMessages(sessionId) {
  const res = await fetch(`${API_URL}/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.messages) ? data.messages : [];
}

// `signal` (AbortSignal) lets callers cancel an in-flight request — the
// VibeTab uses this to abort slow LLM calls without leaking handlers.
export async function postGenerate({ sessionId, prompt, currentCode, signal }) {
  const res = await fetch(`${API_URL}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, prompt, currentCode }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

// `lang` is the speech-recognition language hint (e.g. 'en-US'). Omit or
// pass 'auto' to let the backend fall back to its default detection.
export async function postTranscribe({ sessionId, wavBlob, lang }) {
  const params = new URLSearchParams({ sessionId });
  if (lang && lang !== 'auto') params.set('lang', lang);
  const url = `${API_URL}/transcribe?${params.toString()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'audio/wav' },
    body: wavBlob,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Transcribe failed: HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

export async function deleteSession(sessionId) {
  await fetch(`${API_URL}/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

// Stateless one-shot fix: no session history, no chat-log mutation. Used
// when the in-browser scheduler emits runtime errors (sound not loaded,
// NaN AudioParam, wrong-typed control) — we ship the failing code + first
// error back and apply whatever the model returns.
export async function postGenerateFix({ currentCode, error, signal }) {
  const res = await fetch(`${API_URL}/generate/fix`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ currentCode, error }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}
