import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Pregenerated pattern cache: `<dir>/<mode>/<style-slug>-<n>.json`, written
 * by scripts/pregenerate.mjs and served by GET /pregen (docs/booth/
 * CONTRACTS.md §8.3). Read-only at runtime; a fresh directory listing per
 * call keeps a re-run of the script visible without a restart.
 */

export const PREGEN_MODES = new Set(['adult', 'kids']);

/** Style → filename stem. Keeps CJK, folds spaces / punctuation to `-`. */
export function styleSlug(style) {
  return String(style ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function pregenFileName(style, n) {
  return `${styleSlug(style)}-${n}.json`;
}

export function createPregenStore({ dir, random = Math.random }) {
  const base = resolve(dir);

  async function listFiles(mode) {
    try {
      const names = await readdir(join(base, mode));
      return names.filter((n) => n.endsWith('.json')).sort();
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  return {
    dir: base,
    async list(mode) {
      return listFiles(mode);
    },
    /** Random pick; `style` omitted → any style in that mode. Null when none. */
    async pick(mode, style) {
      if (!PREGEN_MODES.has(mode)) return null;
      let files = await listFiles(mode);
      if (style) {
        const slug = styleSlug(style);
        files = files.filter(
          (n) => n.startsWith(`${slug}-`) && /-\d+\.json$/.test(n) && n.slice(0, n.lastIndexOf('-')) === slug,
        );
      }
      if (files.length === 0) return null;
      const name = files[Math.floor(random() * files.length)];
      const raw = await readFile(join(base, mode, name), 'utf8');
      const parsed = JSON.parse(raw);
      return { ...parsed, file: `${mode}/${name}` };
    },
  };
}
