// Per-track sessionId persistence. Each track has its own conversation
// thread on the backend so chats don't bleed between tracks.

const SESSION_PREFIX = 'strudel:vibe:sessionId:';
const VALID = /^[A-Za-z0-9_-]{1,64}$/;

function generateSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `s${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readOrCreateSessionId(trackId) {
  if (!trackId) return null;
  if (typeof window === 'undefined') return generateSessionId();
  const key = SESSION_PREFIX + trackId;
  const existing = window.localStorage?.getItem(key);
  if (existing && VALID.test(existing)) return existing;
  const fresh = generateSessionId();
  try {
    window.localStorage?.setItem(key, fresh);
  } catch {}
  return fresh;
}

export function clearSessionId(trackId) {
  if (!trackId || typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem(SESSION_PREFIX + trackId);
  } catch {}
}
