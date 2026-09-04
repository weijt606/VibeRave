// Whisper hallucination blocklist — pure module (no native deps) so it can
// be unit-tested and reused by any transcriber.
//
// Whisper's decoders carry training-data fillers that they emit whenever
// they can't ground on real speech (silence / very short / low-SNR input).
// English models say "Thanks for watching."; the multilingual models fed
// Chinese audio say YouTube / Bilibili outros ("请不吝点赞订阅", "谢谢观看")
// and subtitle credits ("字幕由 Amara.org 社区提供", "明镜与点点栏目").
// These surface as confident-looking sentences that have nothing to do with
// what was said. Rewriting them to '' lets the empty-text guard upstream
// short-circuit the LLM call and show "didn't catch that" instead of
// generating a track from a video outro.
//
// Matching is on a NORMALISED form: lowercased, all punctuation (ASCII and
// CJK) and whitespace removed. Whisper is inconsistent about "谢谢观看。" vs
// "谢谢观看!" vs "谢谢 观看", and the normalisation makes those one entry.
//
// Things INTENTIONALLY not in this list:
//   - bare "okay." / "bye." / "you" — real one-word commands. The
//     voicedRatio < 0.10 gate in transcribe-audio.mjs catches the
//     silence-fed case better than blanket-rejecting the word.

const PUNCT_RE = /[\s\p{P}\p{S}]+/gu;

export function normaliseForBlocklist(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(PUNCT_RE, '');
}

const RAW_PHRASES = [
  // ── English ──
  'thanks for watching.',
  'thanks for watching and see you next time.',
  'thank you.',
  'thank you for watching.',
  'thank you for watching!',
  'thank you so much for watching.',
  'music playing in the background.',
  'music playing.',
  'music plays.',
  'sustain, charge, bass, arpeggio.',
  'beck with us, thank you for your time.',
  'back with us, thank you for your time.',
  '1000 tracks.',
  'subtitles by the amara.org community',
  'subtitles by amara.org',
  // ── Chinese (Whisper multilingual, zh audio / silence) ──
  '请不吝点赞订阅',
  '请不吝点赞 订阅 转发 打赏支持明镜与点点栏目',
  '请不吝点赞订阅转发打赏支持明镜与点点栏目',
  '明镜与点点栏目',
  '订阅明镜与点点栏目',
  '谢谢观看',
  '谢谢收看',
  '感谢观看',
  '感谢收看',
  '谢谢大家',
  '谢谢大家观看',
  '感谢大家观看',
  '请订阅',
  '点赞订阅',
  '记得点赞订阅',
  '别忘了点赞订阅',
  '欢迎订阅',
  '欢迎点赞订阅',
  '字幕由amara.org社区提供',
  '字幕由 Amara.org 社区提供',
  '本字幕由amara.org社区提供',
  '字幕志愿者',
  '中文字幕',
  '字幕制作',
  '优优独播剧场——youtube频道',
  '优优独播剧场',
  '我们下期再见',
  '下期再见',
  '拜拜',
  // Traditional-script variants (whisper picks zh-TW spelling at random)
  '謝謝觀看',
  '謝謝收看',
  '感謝觀看',
  '感謝收看',
  '謝謝大家',
  '請訂閱',
  '請不吝點贊訂閱',
  '請不吝點讚訂閱',
  '點贊訂閱',
  '點讚訂閱',
  '歡迎訂閱',
  '字幕由amara.org社區提供',
  '明鏡與點點欄目',
  '我們下期再見',
];

export const HALLUCINATION_PHRASES = new Set(RAW_PHRASES.map(normaliseForBlocklist).filter(Boolean));

// Open-ended shapes ("字幕由 … 提供" with any provider name in the middle).
export const HALLUCINATION_PATTERNS = [
  /^字幕由.*提供$/u,
  /^本字幕由.*提供$/u,
  /^(?:请|欢迎|记得|别忘了)?(?:点赞|订阅|转发|打赏|关注|支持)+(?:明镜|与点点|栏目|我的频道|本频道)*$/u,
  /^(?:谢谢|感谢|謝謝|感謝)(?:大家|各位)?(?:的)?(?:观看|收看|收听|支持|觀看|收聽)$/u,
  /^(?:请|請|欢迎|歡迎|记得|記得)?(?:点赞|點贊|點讚|订阅|訂閱|转发|轉發|打赏|打賞|关注|關注|支持)+(?:明镜|明鏡|与点点|與點點|栏目|欄目)*$/u,
  /^subtitlesby.*$/,
];

export function isHallucination(text) {
  const norm = normaliseForBlocklist(text);
  if (!norm) return true; // only punctuation / whitespace
  if (HALLUCINATION_PHRASES.has(norm)) return true;
  return HALLUCINATION_PATTERNS.some((re) => re.test(norm));
}
