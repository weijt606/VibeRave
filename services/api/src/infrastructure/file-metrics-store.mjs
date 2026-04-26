import { mkdir, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/**
 * Append-only JSONL store for transcribe metrics. One JSON object per line
 * lets us tail/grep/jq the file directly during demos without a separate
 * viewer. Each call to `append()` writes one line and never blocks the
 * caller on a write barrier — fire and forget.
 *
 * @param {{ file: string }} args
 * @returns {{ append: (record: object) => Promise<void> }}
 */
export function createFileMetricsStore({ file }) {
  const target = resolve(file);
  const ready = mkdir(dirname(target), { recursive: true });

  return {
    async append(record) {
      await ready;
      const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n';
      await appendFile(target, line, 'utf8');
    },
  };
}
