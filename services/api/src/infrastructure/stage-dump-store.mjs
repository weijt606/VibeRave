import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, join } from 'node:path';

/**
 * Per-take dump of the speech-enhancement pipeline. When enabled, opens a
 * fresh folder per voice take and lets the caller drop the raw + enhanced
 * WAVs, the per-stage transcripts, and the full metrics JSON next to each
 * other so we can A/B in Audacity / diff the texts offline.
 *
 * Writes are fire-and-forget — they never block the response. Failures are
 * logged so a full disk doesn't silently swallow evidence.
 *
 * Layout: <dir>/<sessionId|anon>/<ISO-ts>-<rand>/{raw.wav,enhanced.wav,
 * raw.txt,enhanced.txt,final.txt,meta.json}
 *
 * @param {{ enabled: boolean, dir: string }} args
 * @returns {{ beginTake: (sessionId: string|null) => null | {
 *   dir: string,
 *   wav: (name: string, buf: Buffer) => void,
 *   text: (name: string, str: string) => void,
 *   json: (name: string, obj: object) => void,
 * } }}
 */
export function createStageDumpStore({ enabled, dir }) {
  if (!enabled) {
    return { beginTake: () => null };
  }
  const root = resolve(dir);
  // Best-effort root mkdir; per-take mkdir handles the actual leaf.
  mkdir(root, { recursive: true }).catch((err) => {
    console.error('[stage-dump] root mkdir failed:', err.message);
  });

  return {
    beginTake(sessionId) {
      const session = sanitize(sessionId) || 'anon';
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const rand = randomBytes(3).toString('hex');
      const takeDir = join(root, session, `${ts}-${rand}`);
      const ready = mkdir(takeDir, { recursive: true });

      const write = (filename, data) => {
        ready
          .then(() => writeFile(join(takeDir, filename), data))
          .catch((err) =>
            console.error(`[stage-dump] write ${filename} failed:`, err.message),
          );
      };

      return {
        dir: takeDir,
        wav: (name, buf) => write(`${name}.wav`, buf),
        text: (name, str) => write(`${name}.txt`, str ?? ''),
        json: (name, obj) => write(`${name}.json`, JSON.stringify(obj, null, 2)),
      };
    },
  };
}

// Strip path separators / weird chars so a hostile sessionId can't escape root.
function sanitize(id) {
  if (!id) return null;
  return String(id).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
}
