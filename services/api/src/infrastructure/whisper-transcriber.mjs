import { Whisper, manager } from 'smart-whisper';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// DJ command dictionary — single source of truth, JSON sibling file. Used
// to build the whisper initial_prompt below; can also be reused by the
// frontend (autocomplete) and by future fuzzy-match post-processing.
const DJ_VOCAB = (() => {
  try {
    return JSON.parse(readFileSync(resolve(__dirname, 'dj-vocabulary.json'), 'utf8'));
  } catch (err) {
    console.warn(`[whisper-transcriber] failed to load dj-vocabulary.json: ${err.message}`);
    return {};
  }
})();

// Domain-specific biasing prompt fed to whisper as `initial_prompt`. The
// decoder uses this as recent-context, so words appearing here are picked
// over phonetic neighbours.
//
// Whisper's prompt window is 224 tokens. We DON'T dump the whole DJ
// dictionary in — that would blow the budget and front-truncate the
// Berghain bias we need most. Instead we hand-pick the high-value
// fragments: distinctive multi-word phrases, technical jargon, proper
// nouns. Common single-word verbs ("start", "stop", "play", "louder",
// "faster") are dropped because whisper already handles them fine.
//
// Mishears we're specifically targeting (keep these prominent):
//   "berghain" → "Burgaine" / "Burgane" / "berg high"
//   "lo-fi"    → "low-fi"
//   "dubby"    → "doubty"
//   "Rhodes"   → "roads"
//   "bass"     → "base"     (homophone — also handled by post-process)
//   "hi hat"   → "high hat" / "hihat"
//   "lpf/hpf"  → "L P F" / "low-pass filter"
//   "arp/arpeggio" → "arp egg" / "harp"
//   "sidechain" → "side chain"
function buildBiasingPrompt(vocab) {
  // Anchor: proper-noun + jargon biasing. Always present, placed LAST so
  // it survives any front-truncation by whisper.
  const anchor = [
    'Strudel live coding for a DJ in a noisy rave. Genres: techno, house,',
    'deep house, lo-fi, dub, dubby, drum and bass, ambient, acid, trance,',
    'breakbeat, chiptune, drone, jazz, disco, trap, IDM, hyperpop. Berghain',
    '(Berlin techno club): in the Berghain style, Berghain bass. Drum',
    'machines: RolandTR909, RolandTR808, LinnDrum, AkaiMPC60. Synths:',
    'sawtooth, square, triangle, sine, Rhodes piano, sub bass, acid bass,',
    'lead, pad, arp, arpeggio. Effects: lpf, hpf, reverb, delay, echo,',
    'sidechain ducking, crush, distortion, phaser, vowel filter.',
  ].join(' ');

  // Command bias: only the multi-word command shapes whisper might mis-segment
  // (e.g. "hi hat" → "hihat"; "build up" → "buildup"; "low pass" → "lowpass").
  // Single-word verbs ("start", "stop", "louder", "faster") are dropped — whisper
  // gets those right unaided. Trimmed hard to keep total prompt under whisper's
  // 224-token window.
  const distinctive = [
    'next pattern', 'switch pattern', 'drop the beat', 'build up',
    'hold tension', 'breakdown',
    'add kick', 'mute kick', 'add hi hat', 'open hi hat', 'add snare',
    'add clap', 'only drums',
    'add bass', 'mute bass', 'more bass', 'deeper bass',
    'add lead', 'add melody', 'add pad', 'add arp',
    'open filter', 'close filter', 'more low pass', 'more high pass',
    'add delay', 'more reverb', 'add echo', 'add distortion',
    'show waveform', 'show piano roll', 'show pitch wheel',
    'mute all', 'bring everything back',
  ];
  const cmdBlock = `Commands: ${distinctive.join(', ')}.`;

  // Order: commands first (less critical), anchor LAST (must survive).
  // Total budget ≈ 210 tokens, under whisper's 224 cap.
  return `${cmdBlock} ${anchor}`;
}

// Bilingual variant — same proper-noun anchors plus a compact Chinese DJ
// vocabulary. Used when the user enables "Chinese-English mixed input" in
// the API Settings panel (frontend then sends lang=auto). Keeping the
// English half identical means proper-nouns like Berghain still survive
// whisper's front-truncation pass, while the appended zh terms steer the
// decoder when zh phonetic frames are detected. Total stays under the
// 224-token window.
function buildBilingualBiasingPrompt(vocab) {
  const en = buildBiasingPrompt(vocab);
  const zh = [
    '中文DJ术语:',
    '柏林Berghain、低保真lo-fi、深house、迪斯科、雷鬼、',
    'techno、节奏、鼓机、踢鼓、军鼓、镲片、贝斯、合成器、',
    '混响、延迟、滤波器、加速、减速、安静、停止、播放。',
  ].join(' ');
  return `${en} ${zh}`;
}

const DEFAULT_DJ_VOCAB = buildBiasingPrompt(DJ_VOCAB);
const BILINGUAL_DJ_VOCAB = buildBilingualBiasingPrompt(DJ_VOCAB);

// Decide which bias prompt to feed whisper for a given request. English-only
// keeps the prompt budget on EN proper nouns; bilingual adds zh anchors when
// the user opts into mixed input or auto-detect.
function pickBiasPrompt(lang, fallback, bilingualFallback) {
  const norm = String(lang || '').toLowerCase();
  if (!norm || norm === 'auto') return bilingualFallback;
  if (norm.startsWith('en')) return fallback;
  // Any non-English explicit hint → bilingual prompt (still has full EN
  // anchor so EN proper nouns aren't lost).
  return bilingualFallback;
}

// Post-process replacement table. Whisper consistently makes these errors
// even with biasing — handle them deterministically. Order matters: more
// specific patterns first.
const POST_PROCESS_FIXES = [
  // Berghain spelling variants (TTS / many real speakers).
  [/\bBurg[a-z]*ine?\b/gi, 'Berghain'],
  [/\bBurg[a-z]*ane\b/gi, 'Berghain'],
  [/\bBurg high\b/gi, 'Berghain'],
  [/\bBerg high\b/gi, 'Berghain'],
  // bass / base homophone — in this domain, "base" almost certainly means "bass".
  [/\bacid base\b/gi, 'acid bass'],
  [/\bsub base\b/gi, 'sub bass'],
  [/\bduck on the base\b/gi, 'duck on the bass'],
  [/\b(drop|cut|kill|boost|bring back) the base\b/gi, '$1 the bass'],
  [/\bbase ?line\b/gi, 'bassline'],
  // lo-fi normalisation
  [/\blow[ -]?fi\b/gi, 'lo-fi'],
  // Rhodes proper noun
  [/\broad piano\b/gi, 'Rhodes piano'],
  [/\broads piano\b/gi, 'Rhodes piano'],
  // bpm number → digits + lowercase unit
  [/(\d+)\s*BPM\b/g, '$1 bpm'],
];

// Whisper's medium.en model carries a handful of training-data fillers that
// it emits whenever it can't ground on real speech — typically when the
// audio is silent / very short / low-SNR. These show up as confident-looking
// sentences that have nothing to do with what was said. Rewriting them to
// '' lets the empty-text guard upstream short-circuit the LLM call and
// surface "didn't catch that" instead of generating a track from a
// YouTube outro.
//
// The list is anchored to the EXACT decoded text (after trim + lowercase)
// because a substring match could eat real input ("you" / "thanks").
//
// Things INTENTIONALLY not in this list:
//   - bare "okay." / "bye." — these are real one-word commands a DJ might
//     say (confirmation / end-of-set). The voicedRatio < 0.10 gate in
//     transcribe-audio.mjs catches the silence-fed case better than
//     blanket-rejecting the word.
//   - bare "you" — same reason; voicedRatio gate handles silence.
const HALLUCINATION_PHRASES = new Set([
  'thanks for watching.',
  'thanks for watching',
  'thanks for watching and see you next time.',
  'thank you.',
  'thank you',
  'thank you for watching.',
  'thank you for watching!',
  'music playing in the background.',
  'music playing in the background',
  'music playing.',
  'music plays.',
  'sustain, charge, bass, arpeggio.',
  'beck with us, thank you for your time.',
  'back with us, thank you for your time.',
  '1000 tracks.',
  '.',
  '...',
  '. .',
]);
function isHallucination(text) {
  return HALLUCINATION_PHRASES.has(String(text || '').trim().toLowerCase());
}

function postProcess(text) {
  if (isHallucination(text)) return '';
  let out = text;
  for (const [re, replacement] of POST_PROCESS_FIXES) {
    out = out.replace(re, replacement);
  }
  return out;
}

/**
 * Lazy whisper.cpp transcriber. Downloads the model on first use (cached
 * in `~/.smart-whisper/models/`) and keeps the process-wide model alive
 * across requests. By default we set a very long idle window so the model
 * stays resident — the alternative is paying ~5 s of disk reload latency
 * whenever the user pauses for longer than the offload timeout.
 *
 * Decoder params worth calling out:
 *   no_context: true       Disables prior-prompt context. Without this
 *                          whisper carries tokens from the previous request
 *                          into the next decode, which shows up as "the
 *                          model just repeated my last prompt back to me"
 *                          hallucinations. Critical for chat-style usage
 *                          where each utterance is independent.
 *   temperature: 0,
 *   temperature_inc: 0     Disables temperature-fallback decoding paths.
 *                          Greedy-only. Fixes repetition / loop
 *                          hallucinations on noisy or short audio.
 *   initial_prompt         Domain vocabulary biasing — see DEFAULT_DJ_VOCAB.
 *
 * @param {{
 *   modelName: string,
 *   gpu: boolean,
 *   language: string,
 *   offloadSecs?: number,
 *   initialPrompt?: string | null,
 * }} cfg
 * @returns {import('../application/ports.mjs').Transcriber}
 */
export function createWhisperTranscriber({
  modelName,
  gpu,
  language,
  offloadSecs,
  initialPrompt,
}) {
  let whisper = null;
  let loadPromise = null;
  // Two biasing prompts: pure-English (DEFAULT_DJ_VOCAB) and EN+zh
  // (BILINGUAL_DJ_VOCAB). pickBiasPrompt() chooses per request based on
  // opts.language. An explicit WHISPER_INITIAL_PROMPT env override always
  // wins — that's still a single prompt regardless of language.
  const overridePrompt = initialPrompt || null;
  // Token estimate: whisper's BPE averages ~1.3 tokens/word for English.
  // Hard ceiling is 224; warn if we're flirting with truncation so the
  // boot log makes the cause obvious instead of silently dropping the
  // Berghain bias from the front of the prompt.
  for (const [label, p] of [
    ['EN', DEFAULT_DJ_VOCAB],
    ['EN+ZH', BILINGUAL_DJ_VOCAB],
    ...(overridePrompt ? [['override', overridePrompt]] : []),
  ]) {
    const wordCount = p.split(/\s+/).filter(Boolean).length;
    const estTokens = Math.round(wordCount * 1.3);
    console.log(
      `[whisper-transcriber] ${label} biasing prompt: ${wordCount} words, ~${estTokens} tokens` +
        (estTokens > 220 ? ' ⚠ exceeds whisper 224-token window — front will be truncated' : ''),
    );
  }

  async function ensureModel() {
    if (whisper) return whisper;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      if (!manager.check(modelName)) {
        await manager.download(modelName);
      }
      const file = manager.resolve(modelName);
      whisper = new Whisper(file, { gpu, offload: offloadSecs ?? 86400 });
      return whisper;
    })();
    try {
      return await loadPromise;
    } finally {
      loadPromise = null;
    }
  }

  // Fire-and-forget pre-warm. offload: 86400 keeps the model resident BETWEEN
  // requests, but the FIRST request after boot still pays the cold load
  // (~1-5s for base.en, ~5-10s+ for medium.en — disk → RAM, plus the Metal
  // kernel warm-up on the inaugural inference). This kick at construction
  // time moves both costs to boot so the user's first PTT is on the warm
  // path. Errors are non-fatal — they'd surface on the first real request
  // anyway. Doesn't block server.listen because we don't await the promise.
  (async () => {
    const t0 = Date.now();
    const w = await ensureModel();
    const silentPcm = new Float32Array(16000); // 1s of silence at 16 kHz
    const task = await w.transcribe(silentPcm, {
      language: 'en',
      format: 'simple',
      no_timestamps: true,
      no_context: true,
      temperature: 0,
      temperature_inc: 0,
    });
    await task.result;
    console.log(`[whisper-transcriber] pre-warm complete model=${modelName} took=${Date.now() - t0}ms`);
  })().catch((err) => {
    console.warn(`[whisper-transcriber] pre-warm failed: ${err?.message || err}`);
  });

  return {
    getModelId: () => modelName,
    async transcribe(pcm, opts = {}) {
      const w = await ensureModel();
      const lang = opts.language || language;
      const biasingPrompt =
        overridePrompt || pickBiasPrompt(lang, DEFAULT_DJ_VOCAB, BILINGUAL_DJ_VOCAB);
      const task = await w.transcribe(pcm, {
        language: lang === 'auto' ? 'auto' : lang,
        format: 'simple',
        no_timestamps: true,
        suppress_non_speech_tokens: true,
        no_context: true,
        temperature: 0,
        temperature_inc: 0,
        initial_prompt: biasingPrompt,
      });
      const segments = await task.result;
      const raw = segments.map((s) => s.text).join('').trim();
      return { text: postProcess(raw) };
    },
  };
}
