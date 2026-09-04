#!/usr/bin/env node
// Pregenerate booth patterns (docs/booth/CONTRACTS.md §8.3).
//
//   node scripts/pregenerate.mjs [--dry-run] [--mode adult|kids|all]
//                                [--only <style>] [--out <dir>] [--force]
//
// Runs the SAME pipeline as POST /generate (skill prompt → provider chain →
// validate → retry) for 12 adult styles + 8 kid genres × 3 keys and writes
// data/pregen/<mode>/<style-slug>-<n>.json, which GET /pregen serves at
// random. `--dry-run` swaps the LLM for a stub so the fixture layout and
// the validator can be exercised without an API key.
//
// Env comes from the root .env (`pnpm --filter @viberave/api pregenerate`
// uses --env-file); the script never starts the HTTP server.

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../src/config.mjs';
import { composeLlm } from '../src/llm-composition.mjs';
import { createProviderChain } from '../src/infrastructure/provider-chain.mjs';
import { createSkillPromptProvider } from '../src/infrastructure/skill-prompt.mjs';
import { pregenFileName } from '../src/infrastructure/pregen-store.mjs';
import { makeGenerateStrudel } from '../src/application/generate-strudel.mjs';
import { makeValidateStrudel } from '../src/application/validate-strudel.mjs';
import { makeChatSession } from '../src/application/chat-session.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ADULT_STYLES = [
  'lo-fi',
  'house',
  'deep house',
  'techno',
  'minimal techno',
  'acid',
  'drum and bass',
  'dub',
  'trap',
  'IDM',
  'ambient',
  '国风电子',
];
export const KID_STYLES = ['儿歌', '摇篮曲', '进行曲', '圆舞曲', '动画追逐', '8-bit 游戏', '动物狂欢', '太空探险'];
export const ADULT_KEYS = ['A minor', 'F major', 'D minor'];
export const KID_KEYS = ['C 大调', 'G 大调', 'F 大调'];

function parseArgs(argv) {
  const args = { dryRun: false, mode: 'all', only: null, out: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--mode') args.mode = argv[++i];
    else if (a === '--only') args.only = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log(
        'usage: pregenerate.mjs [--dry-run] [--mode adult|kids|all] [--only <style>] [--out <dir>] [--force]',
      );
      process.exit(0);
    }
  }
  return args;
}

export function buildPrompt(mode, style, key) {
  return mode === 'kids' ? `${style}，${key}，给小朋友听的` : `${style} in ${key}`;
}

// Deterministic stub for --dry-run: one valid pattern per mode with the
// style baked into the melody so fixtures are distinguishable.
function stubChain() {
  let n = 0;
  const client = {
    name: 'stub',
    model: 'stub-model',
    async complete({ userMessage, systemPrompt }) {
      n += 1;
      const kids = /FAMILY MODE ACTIVE/.test(systemPrompt);
      const degree = n % 4;
      const code = kids
        ? `stack(\n  note("<c4 e4 g4 e4>*2").s("gm_xylophone").gain(0.6).attack(0.02).room(0.3),\n  note("<c3 g2>").s("gm_acoustic_bass").gain(0.4).attack(0.02)\n)`
        : `stack(\n  s("bd ~ ~ bd, ~ ~ sd ~, hh*8").bank("RolandTR909").gain(0.8),\n  note("<a1 f1 d1 e1>").s("sawtooth").lpf(${600 + degree * 100}).gain(0.55)\n)`;
      const style = userMessage.split('\n').pop();
      return { text: `${code}\nEXPLAIN: 预生成：${style.slice(0, 20)}`, model: 'stub-model' };
    },
  };
  return createProviderChain({ providers: [{ name: 'stub', model: 'stub-model', client }], log: () => {} });
}

function memorySessionStore() {
  return {
    async load(id) {
      return { id, createdAt: '', updatedAt: '', messages: [] };
    },
    async save() {},
    async clear() {},
  };
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function pregenerate({ dryRun, mode, only, out, force, log = console.log }) {
  const config = loadConfig();
  const skillPrompt = createSkillPromptProvider({ root: resolve(__dirname, '..', 'src', 'skills', 'strudel') });
  const llm = dryRun ? stubChain() : composeLlm(config, { log }).defaultLlmClient;
  if (!llm) throw new Error('No LLM provider configured (set LLM_PROVIDERS / keys in .env, or use --dry-run).');

  const generateStrudel = makeGenerateStrudel({
    defaultLlmClient: llm,
    loadSystemPrompt: (opts) => skillPrompt.load(opts),
  });
  const chatSession = makeChatSession({
    sessionStore: memorySessionStore(),
    generateStrudel,
    validatePattern: makeValidateStrudel(),
    historyTurns: 0,
  });

  const outDir = resolve(out || config.booth.pregenDir || resolve(__dirname, '..', 'data', 'pregen'));
  const modes = mode === 'all' ? ['adult', 'kids'] : [mode];
  const summary = { written: 0, skipped: 0, failed: 0, invalid: 0, files: [] };

  for (const m of modes) {
    const styles = (m === 'kids' ? KID_STYLES : ADULT_STYLES).filter((s) => !only || s === only);
    const keys = m === 'kids' ? KID_KEYS : ADULT_KEYS;
    await mkdir(join(outDir, m), { recursive: true });
    for (const style of styles) {
      for (let i = 0; i < keys.length; i++) {
        const n = i + 1;
        const file = join(outDir, m, pregenFileName(style, n));
        if (!force && (await exists(file))) {
          summary.skipped += 1;
          continue;
        }
        const prompt = buildPrompt(m, style, keys[i]);
        const t0 = Date.now();
        try {
          const result = await chatSession.sendTurn({
            sessionId: `pregen-${m}-${n}`,
            prompt,
            mode: m,
            lang: 'zh',
            intent: 'generate',
          });
          if (!result.code || result.noChange) throw new Error(result.message || 'no code returned');
          const record = {
            mode: m,
            style,
            key: keys[i],
            n,
            prompt,
            code: result.code,
            explain: result.explain || '',
            provider: result.provider,
            model: result.model,
            validated: result.validated,
            validationAttempts: result.validationAttempts,
            generatedAt: new Date().toISOString(),
            dryRun: !!dryRun,
          };
          if (!result.validated) summary.invalid += 1;
          await writeFile(file, JSON.stringify(record, null, 2));
          summary.written += 1;
          summary.files.push(file);
          log(
            `[pregen] ${m}/${style} #${n} ${result.validated ? 'ok' : 'UNVALIDATED'} provider=${result.provider} ${Date.now() - t0}ms`,
          );
        } catch (err) {
          summary.failed += 1;
          log(`[pregen] ${m}/${style} #${n} FAILED: ${err.message}`);
        }
      }
    }
  }
  log(
    `[pregen] done → ${outDir}: written=${summary.written} skipped=${summary.skipped} invalid=${summary.invalid} failed=${summary.failed}`,
  );
  return { ...summary, outDir };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!['adult', 'kids', 'all'].includes(args.mode)) {
    console.error('--mode must be adult | kids | all');
    process.exit(2);
  }
  pregenerate(args)
    .then((s) => process.exit(s.failed > 0 ? 1 : 0))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
