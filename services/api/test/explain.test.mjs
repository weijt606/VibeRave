import { describe, it, expect } from 'vitest';
import { stripExplain, stripExplainLine } from '../src/application/explain.mjs';
import { makeGenerateStrudel } from '../src/application/generate-strudel.mjs';
import { scriptedClient } from './helpers.mjs';

describe('EXPLAIN stripping', () => {
  it('strips a trailing EXPLAIN line into explain', () => {
    const r = stripExplain('s("bd sd")\nEXPLAIN: 加了一个底鼓');
    expect(r).toEqual({ text: 's("bd sd")', explain: '加了一个底鼓' });
  });
  it('tolerates blank lines, full-width colon, and a leading EXPLAIN', () => {
    expect(stripExplain('s("bd")\n\nEXPLAIN：更亮了\n\n')).toEqual({ text: 's("bd")', explain: '更亮了' });
    expect(stripExplain('EXPLAIN: top\ns("bd")')).toEqual({ text: 's("bd")', explain: 'top' });
  });
  it('leaves code without EXPLAIN untouched', () => {
    expect(stripExplain('stack(\n  s("bd")\n)')).toEqual({ text: 'stack(\n  s("bd")\n)', explain: '' });
    expect(stripExplainLine('s("bd")')).toBe('s("bd")');
  });
  it('is not fooled by "explain" inside code', () => {
    const code = 'note("c e g").s("gm_piano") // explain: nope';
    expect(stripExplain(code).text).toBe(code);
  });
});

describe('generateStrudel + EXPLAIN', () => {
  const load = async () => 'SYS';
  it('returns explain + provider and validation never sees the line (inside a fence too)', async () => {
    const gen = makeGenerateStrudel({
      defaultLlmClient: scriptedClient(['```js\ns("bd sd")\nEXPLAIN: 鼓来了\n```'], { name: 'dashscope' }),
      loadSystemPrompt: load,
    });
    const r = await gen({ prompt: 'drums' });
    expect(r).toMatchObject({ code: 's("bd sd")', explain: '鼓来了', provider: 'dashscope' });
  });
  it('strips EXPLAIN from META and cannot-handle responses', async () => {
    const gen = makeGenerateStrudel({
      defaultLlmClient: scriptedClient([
        'META: {"action":"stop_all"}\nEXPLAIN: 全部停止',
        "Couldn't generate or modify - please try again.\nEXPLAIN: 听不懂",
      ]),
      loadSystemPrompt: load,
    });
    const meta = await gen({ prompt: '全部停' });
    expect(meta.meta).toEqual({ action: 'stop_all' });
    expect(meta.message).toBe('META: {"action":"stop_all"}');
    expect(meta.explain).toBe('全部停止');
    const nope = await gen({ prompt: '???' });
    expect(nope.noChange).toBe(true);
    expect(nope.explain).toBe('听不懂');
  });
  it('passes mode/intent/lang to the prompt provider and builds the <siblings> block', async () => {
    const client = scriptedClient(['s("hh*8")']);
    let seen;
    const gen = makeGenerateStrudel({
      defaultLlmClient: client,
      loadSystemPrompt: async (o) => {
        seen = o;
        return 'SYS';
      },
    });
    await gen({
      prompt: '加踩镲',
      mode: 'kids',
      intent: 'tweak',
      lang: 'zh',
      currentCode: 's("bd")',
      tracks: [{ name: 'Bass', summary: 'A minor acid' }],
    });
    expect(seen).toEqual({ mode: 'kids', intent: 'tweak', lang: 'zh' });
    expect(client.calls[0].userMessage).toBe(
      '<current>\ns("bd")\n</current>\n\n<siblings>\n- Bass: A minor acid\n</siblings>\n\n加踩镲',
    );
  });
});
