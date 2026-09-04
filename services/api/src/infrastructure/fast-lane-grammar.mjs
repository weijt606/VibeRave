// Fast-lane command vocabulary — plain data, no native deps, so both the
// VOSK closed-grammar transcriber and the front-end fast lane
// (website/src/booth/fastLane.mjs, docs/booth/CONTRACTS.md §5) can share one
// list. Add a chip → add the phrase here.
//
// `FAST_LANE_COMMANDS` is the booth table: every phrase maps to a
// front-end-side action that never touches the LLM. `DEMO_GRAMMAR` is the
// superset VOSK is allowed to output (generation seeds + edits + transport).

/** @type {{ id: string, kind: 'macro'|'meta'|'template', zh: string[], en: string[], action: object }[]} */
export const FAST_LANE_COMMANDS = [
  {
    id: 'darker',
    kind: 'macro',
    zh: ['更暗一点', '暗一点', '更暗'],
    en: ['darker', 'make it darker'],
    action: { cutoff: -0.15 },
  },
  {
    id: 'brighter',
    kind: 'macro',
    zh: ['更亮', '更亮一点', '亮一点'],
    en: ['brighter', 'make it brighter'],
    action: { cutoff: 0.15 },
  },
  {
    id: 'faster',
    kind: 'macro',
    zh: ['再快一点', '快一点', '更快'],
    en: ['faster', 'make it faster', 'speed it up'],
    action: { tempo: 0.08 },
  },
  {
    id: 'slower',
    kind: 'macro',
    zh: ['再慢一点', '慢一点', '更慢'],
    en: ['slower', 'make it slower', 'slow it down'],
    action: { tempo: -0.08 },
  },
  {
    id: 'more_reverb',
    kind: 'macro',
    zh: ['更多混响', '加混响', '多点混响'],
    en: ['more reverb', 'add reverb'],
    action: { space: 0.2 },
  },
  {
    id: 'more_space',
    kind: 'macro',
    zh: ['更空', '空一点'],
    en: ['more space'],
    action: { density: -0.2, space: 0.1 },
  },
  {
    id: 'more_energy',
    kind: 'macro',
    zh: ['更满', '满一点', '更有力'],
    en: ['more energy', 'fuller'],
    action: { energy: 0.15, density: 0.15 },
  },
  {
    id: 'stop_all',
    kind: 'meta',
    zh: ['停', '全部停', '全部停止', '停止'],
    en: ['stop', 'stop all', 'stop everything', 'kill it'],
    action: { action: 'stop_all' },
  },
  {
    id: 'drop',
    kind: 'template',
    zh: ['来个drop', '来个 drop', '来一个drop', 'drop'],
    en: ['drop', 'drop it', 'drop the beat'],
    action: { template: 'drop' },
  },
  {
    id: 'add_drums',
    kind: 'template',
    zh: ['加鼓', '加个鼓', '加点鼓'],
    en: ['add drums', 'add the drums', 'add kick'],
    action: { template: 'drums' },
  },
  {
    id: 'add_bass',
    kind: 'template',
    zh: ['加贝斯', '加个贝斯', '加点贝斯'],
    en: ['add bass'],
    action: { template: 'bass' },
  },
  {
    id: 'add_hihat',
    kind: 'template',
    zh: ['加踩镲', '加个踩镲', '加镲'],
    en: ['add hi-hat', 'add high hat', 'add hats'],
    action: { template: 'hihat' },
  },
  {
    id: 'next_style',
    kind: 'template',
    zh: ['换个风格', '换风格', '下一个风格'],
    en: ['next style', 'switch style', 'change the style'],
    action: { template: 'next_style' },
  },
];

/** Flat phrase → command lookup (both languages, lowercase, spaces removed for zh). */
export const FAST_LANE_PHRASES = (() => {
  const out = new Map();
  for (const cmd of FAST_LANE_COMMANDS) {
    for (const p of cmd.zh) out.set(p.replace(/\s+/g, '').toLowerCase(), cmd);
    for (const p of cmd.en) out.set(p.toLowerCase(), cmd);
  }
  return out;
})();

// Closed grammar for the English VOSK model. Mirrors the prompt-chip list in
// website/src/repl/components/panel/VibeTab.jsx. Multiple phrasings of the
// same intent are listed so the user doesn't have to remember exact words.
export const DEMO_GRAMMAR_EN = [
  // ── Generation seeds ─────────────────────────────────────────────
  'lo fi beat',
  'lo fi beat at eighty bpm',
  'lo fi at eighty',
  'make a lo fi beat',
  'make a lo fi beat at eighty bpm',
  'berg hain techno',
  'berg hain techno at one thirty eight',
  'make berg hain techno',
  'hard techno',
  'minimal techno',
  'minimal techno at one thirty',
  'deep house',
  'deep house at one twenty',
  'house music',
  'house music at one twenty',
  'drum and bass',
  'drum and bass at one seventy four',
  'jungle',
  'breakbeat',
  'ambient',
  'acid bass',
  'acid techno',
  'trance',

  // ── Drum edits ──────────────────────────────────────────────────
  'add kick',
  'mute kick',
  'more kick',
  'harder kick',
  'remove kick',
  'add snare',
  'mute snare',
  'more snare',
  'add clap',
  'add high hat',
  'mute high hat',
  'more high hat',
  'open the high hat',
  'add hats',
  'add drums',
  'add the drums',
  'remove the drums',
  'mute the drums',
  'double the drums',
  'double drums',
  'half the drums',

  // ── Stem / synth edits ──────────────────────────────────────────
  'add bass',
  'remove bass',
  'mute bass',
  'more bass',
  'less bass',
  'deeper bass',
  'add lead',
  'mute lead',
  'add pad',
  'mute pad',
  'add melody',

  // ── Effect edits ────────────────────────────────────────────────
  'add reverb',
  'more reverb',
  'less reverb',
  'add delay',
  'more delay',
  'add echo',
  'more echo',
  'add distortion',
  'more distortion',
  'open the filter',
  'close the filter',
  'lo pass',
  'high pass',

  // ── Vibe edits (fast-lane macros) ───────────────────────────────
  'darker',
  'brighter',
  'faster',
  'slower',
  'more space',
  'more energy',
  'fuller',
  'make it darker',
  'make it brighter',
  'make it harder',
  'make it softer',
  'make it dubby',
  'make it minimal',
  'make it faster',
  'make it slower',
  'speed it up',
  'slow it down',
  'drop',
  'drop it',
  'drop the beat',
  'next style',
  'switch style',
  'change the style',

  // ── Transport / META ────────────────────────────────────────────
  'play',
  'pause',
  'stop',
  'stop all',
  'stop everything',
  'kill it',
  'open a new track',
  'open new track',
  'new track',
  'add a new track',
  'restart',
];

// Chinese mirror (docs/booth/CONTRACTS.md §5). Only recognised when a zh
// VOSK model is loaded (e.g. vosk-model-small-cn-0.22) — the English model
// has no Mandarin phones. A zh model emits space-separated characters
// ("更 暗 一 点"); CANONICALISE joins them back before the fast lane sees
// the text.
export const DEMO_GRAMMAR_ZH = [
  '更暗一点',
  '暗一点',
  '更暗',
  '更亮',
  '更亮一点',
  '亮一点',
  '再快一点',
  '快一点',
  '更快',
  '再慢一点',
  '慢一点',
  '更慢',
  '更多混响',
  '加混响',
  '多点混响',
  '更空',
  '空一点',
  '更满',
  '满一点',
  '停',
  '停止',
  '全部停',
  '全部停止',
  '来个drop',
  '来一个drop',
  '加鼓',
  '加个鼓',
  '加点鼓',
  '加贝斯',
  '加个贝斯',
  '加踩镲',
  '加个踩镲',
  '加镲',
  '换个风格',
  '换风格',
  '下一个风格',
  '播放',
  '暂停',
  '新轨道',
  '加一轨',
];

export const DEMO_GRAMMAR = [...DEMO_GRAMMAR_EN, ...DEMO_GRAMMAR_ZH, '[unk]'];

// VOSK doesn't carry "berghain", "lo-fi", "hi-hat" in its small-en lex,
// and number words ("eighty") are clearer to the LLM as digits. Rename
// here so downstream code-gen sees a familiar vocabulary regardless of
// which STT backend produced the text.
export const CANONICALISE = [
  // Spoken numbers → digits. Compound forms FIRST (longer matches win).
  [/\bone\s+twenty\s+eight\b/gi, '128'],
  [/\bone\s+thirty\s+eight\b/gi, '138'],
  [/\bone\s+seventy\s+four\b/gi, '174'],
  [/\bone\s+hundred\b/gi, '100'],
  [/\bone\s+twenty\b/gi, '120'],
  [/\bone\s+thirty\b/gi, '130'],
  [/\bone\s+forty\b/gi, '140'],
  [/\bone\s+fifty\b/gi, '150'],
  [/\bone\s+sixty\b/gi, '160'],
  [/\bone\s+seventy\b/gi, '170'],
  [/\beighty\b/gi, '80'],
  [/\bninety\b/gi, '90'],
  // Phonetic spellings → canonical words.
  [/\bberg\s*hain\b/gi, 'Berghain'],
  [/\blo\s+fi\b/gi, 'lo-fi'],
  [/\bhigh\s+hat\b/gi, 'hi-hat'],
  [/\badd\s+hats\b/gi, 'add hi-hat'],
  // Variant phrasing → canonical.
  [/\bopen\s+new\s+track\b/gi, 'open a new track'],
  [/\bnew\s+track\b/gi, 'open a new track'],
  [/\badd\s+a\s+new\s+track\b/gi, 'open a new track'],
  [/\bstop\s+everything\b/gi, 'stop all'],
  [/\bkill\s+it\b/gi, 'stop all'],
  [/\bswitch\s+style\b/gi, 'next style'],
  [/\bchange\s+the\s+style\b/gi, 'next style'],
  // ── Chinese ──
  // zh VOSK models emit one token per character; re-join CJK runs.
  [/(?<=[㐀-鿿])\s+(?=[㐀-鿿])/g, ''],
  [/(?<=[㐀-鿿])\s+(?=drop)/gi, ''],
  // Whole-utterance variants → the canonical fast-lane phrase (§5 table).
  [/^(?:暗一点|更暗)$/, '更暗一点'],
  [/^(?:更亮一点|亮一点)$/, '更亮'],
  [/^(?:快一点|更快)$/, '再快一点'],
  [/^(?:慢一点|更慢)$/, '再慢一点'],
  [/^(?:加混响|多点混响)$/, '更多混响'],
  [/^空一点$/, '更空'],
  [/^满一点$/, '更满'],
  [/^(?:全部停止|停止)$/, '全部停'],
  [/^来一个drop$/i, '来个drop'],
  [/^(?:加个鼓|加点鼓)$/, '加鼓'],
  [/^(?:加个贝斯|加点贝斯)$/, '加贝斯'],
  [/^(?:加个踩镲|加镲)$/, '加踩镲'],
  [/^(?:换风格|下一个风格)$/, '换个风格'],
  [/^(?:新轨道|加一轨)$/, 'open a new track'],
];

export function canonicalise(text) {
  let out = String(text ?? '');
  for (const [re, rep] of CANONICALISE) out = out.replace(re, rep);
  return out;
}
