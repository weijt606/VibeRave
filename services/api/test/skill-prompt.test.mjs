import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSkillPromptProvider,
  composeSystemPrompt,
  filesFor,
  SKILL_ORDER,
  TWEAK_ORDER,
} from '../src/infrastructure/skill-prompt.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'skills', 'strudel');

describe('skill prompt assembly', () => {
  const provider = createSkillPromptProvider({ root: ROOT });

  it('kids mode forces family mode ON and includes kids examples but not adult templates', async () => {
    const p = await provider.load({ mode: 'kids', intent: 'generate', lang: 'zh' });
    expect(p.startsWith('# HOST: FAMILY MODE ACTIVE')).toBe(true);
    expect(p).toMatch(/regardless of keywords/);
    expect(p).toContain('# Rule: family mode');
    expect(p).toMatch(/examples\/kids\.md|Nursery rhyme|儿歌/);
    expect(p).not.toContain('# Rule: family mode OFF');
    // adult-only template files are dropped
    const full = await provider.load({ mode: 'adult', intent: 'generate', lang: 'zh' });
    expect(full.length).toBeGreaterThan(p.length);
    expect(filesFor({ mode: 'kids', intent: 'generate' })).not.toContain('examples/genres.md');
  });

  it('adult mode says family mode is OFF; no mode keeps keyword behaviour', async () => {
    const adult = await provider.load({ mode: 'adult' });
    expect(adult.startsWith('# HOST: family mode OFF')).toBe(true);
    const legacy = await provider.load();
    expect(legacy).not.toMatch(/^# HOST: (FAMILY MODE ACTIVE|family mode OFF)/);
    expect(legacy).toContain('# HOST: EXPLAIN line');
  });

  it('explain language follows lang', async () => {
    expect(await provider.load({ lang: 'en' })).toMatch(/one short English sentence/);
    expect(await provider.load({ lang: 'zh' })).toMatch(/一句中文/);
  });

  it('tweak prompt is a small subset of the generate prompt', async () => {
    const tweak = await provider.load({ mode: 'adult', intent: 'tweak', lang: 'zh' });
    const gen = await provider.load({ mode: 'adult', intent: 'generate', lang: 'zh' });
    expect(tweak.length).toBeLessThan(gen.length / 5);
    expect(tweak.length).toBeLessThan(20_000);
    expect(tweak).toContain('# Rule: output format');
    expect(tweak).toContain('# Rule: iteration mode');
    expect(tweak).toContain('# Error recovery');
    expect(tweak).toContain('# Rule: meta-commands');
    expect(tweak).toContain('# Rule: sibling tracks');
    expect(tweak).not.toContain('# Rule: family mode');
    const kidsTweak = await provider.load({ mode: 'kids', intent: 'tweak' });
    expect(kidsTweak).toContain('# Rule: family mode');
    expect(filesFor({ intent: 'tweak' })).toEqual(TWEAK_ORDER);
    expect(SKILL_ORDER).toContain('rules/siblings.md');
  });

  it('reads the skill files once and serves variants from cache', async () => {
    const p = createSkillPromptProvider({ root: ROOT });
    await p.load({ mode: 'kids' });
    await p.load({ mode: 'kids' });
    await p.load({ mode: 'adult', intent: 'tweak' });
    expect(p.stats()).toMatchObject({ reads: 1, composes: 2, cachedVariants: 2 });
  });

  it('composeSystemPrompt fails loudly on a missing file', () => {
    expect(() => composeSystemPrompt({ files: new Map(), intent: 'tweak' })).toThrow(/skill file missing/);
  });
});
