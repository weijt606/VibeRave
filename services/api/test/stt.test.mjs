import { describe, it, expect } from 'vitest';
import {
  isHallucination,
  normaliseForBlocklist,
  HALLUCINATION_PHRASES,
} from '../src/infrastructure/stt-hallucinations.mjs';
import {
  DEMO_GRAMMAR,
  DEMO_GRAMMAR_EN,
  DEMO_GRAMMAR_ZH,
  FAST_LANE_COMMANDS,
  FAST_LANE_PHRASES,
  CANONICALISE,
  canonicalise,
} from '../src/infrastructure/fast-lane-grammar.mjs';

describe('whisper hallucination blocklist (EN + zh)', () => {
  it('normalises punctuation and spacing before comparing', () => {
    expect(normaliseForBlocklist('谢谢 观看。')).toBe('谢谢观看');
    expect(normaliseForBlocklist('Thanks for watching!')).toBe('thanksforwatching');
  });
  it.each([
    '请不吝点赞订阅',
    '请不吝点赞 订阅 转发 打赏支持明镜与点点栏目',
    '谢谢观看。',
    '謝謝觀看',
    '感谢观看！',
    '字幕由 Amara.org 社区提供',
    '字幕由「点点」提供',
    '请订阅',
    '明镜与点点栏目',
    'Thanks for watching.',
    'Subtitles by the Amara.org community',
    '...',
  ])('blocks %s', (t) => {
    expect(isHallucination(t)).toBe(true);
  });
  it.each(['加个鼓', '更暗一点', '来个 drop', 'make it darker', 'thank you for the drums', '谢谢，再快一点'])(
    'keeps real commands: %s',
    (t) => {
      expect(isHallucination(t)).toBe(false);
    },
  );
  it('exports a plain set', () => {
    expect(HALLUCINATION_PHRASES.has('谢谢观看')).toBe(true);
  });
});

describe('fast-lane grammar export', () => {
  it('is plain data the front-end can reuse', () => {
    expect(Array.isArray(DEMO_GRAMMAR)).toBe(true);
    expect(DEMO_GRAMMAR.every((p) => typeof p === 'string')).toBe(true);
    expect(DEMO_GRAMMAR.at(-1)).toBe('[unk]');
    expect(DEMO_GRAMMAR).toEqual([...DEMO_GRAMMAR_EN, ...DEMO_GRAMMAR_ZH, '[unk]']);
    expect(Array.isArray(CANONICALISE)).toBe(true);
  });
  it('mirrors the CONTRACTS §5 zh phrases', () => {
    for (const p of [
      '更暗一点',
      '更亮',
      '再快一点',
      '再慢一点',
      '更多混响',
      '更空',
      '加鼓',
      '加贝斯',
      '加踩镲',
      '停',
      '全部停',
      '来个drop',
      '换个风格',
    ]) {
      expect(DEMO_GRAMMAR_ZH).toContain(p);
      expect(FAST_LANE_PHRASES.get(p)).toBeTruthy();
    }
    const ids = FAST_LANE_COMMANDS.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'darker',
        'brighter',
        'faster',
        'slower',
        'more_reverb',
        'more_space',
        'more_energy',
        'stop_all',
        'drop',
        'add_drums',
        'add_bass',
        'add_hihat',
        'next_style',
      ]),
    );
    expect(FAST_LANE_PHRASES.get('darker').action).toEqual({ cutoff: -0.15 });
  });
  it('canonicalises zh VOSK output (char-split) and EN variants', () => {
    expect(canonicalise('更 暗 一 点')).toBe('更暗一点');
    expect(canonicalise('全 部 停 止')).toBe('全部停');
    expect(canonicalise('来 一 个 drop')).toBe('来个drop');
    expect(canonicalise('加 个 鼓')).toBe('加鼓');
    expect(canonicalise('berg hain techno at one thirty eight')).toBe('Berghain techno at 138');
    expect(canonicalise('kill it')).toBe('stop all');
    expect(canonicalise('add hats')).toBe('add hi-hat');
  });
});
