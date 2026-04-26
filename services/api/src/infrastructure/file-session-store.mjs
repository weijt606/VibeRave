import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

function emptyRecord(id) {
  const now = new Date().toISOString();
  return { id, createdAt: now, updatedAt: now, messages: [] };
}

/**
 * File-backed implementation of the SessionStore port. Each session
 * lives in `<dir>/<id>.json`. Writes go through a temp file + rename
 * so a crash mid-write doesn't leave a half-written record.
 *
 * @param {{ dir: string }} args
 * @returns {import('../application/ports.mjs').SessionStore}
 */
export function createFileSessionStore({ dir }) {
  const base = resolve(dir);
  const ready = mkdir(base, { recursive: true });
  const pathFor = (id) => join(base, `${id}.json`);

  return {
    async load(id) {
      await ready;
      try {
        const raw = await readFile(pathFor(id), 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.messages)) parsed.messages = [];
        return parsed;
      } catch (err) {
        if (err.code === 'ENOENT') return emptyRecord(id);
        throw err;
      }
    },

    async save(record) {
      await ready;
      record.updatedAt = new Date().toISOString();
      const target = pathFor(record.id);
      const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
      await writeFile(tmp, JSON.stringify(record, null, 2));
      await rename(tmp, target);
    },

    async clear(id) {
      await ready;
      try {
        await unlink(pathFor(id));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    },
  };
}
