import { Model, Recognizer, setLogLevel } from 'vosk-koffi';
import { existsSync, readdirSync } from 'node:fs';

// Closed grammar: the recogniser will only ever output one of these phrases
// (or [unk]). Mirrors the prompt-chip list in
// website/src/repl/components/panel/VibeTab.jsx so the click-chip UI and the
// voice vocabulary share one mental model. Add new chips → add the same
// phrase here.
//
// Multiple phrasings of the same intent are listed so the user doesn't have
// to remember exact words ("more reverb" / "add reverb" / "more echo on it"
// all work). The post-process map below normalises words missing from the
// small-en pronunciation lex (Berghain, lo-fi, hi-hat) back to canonical
// form before the LLM sees them.
const DEMO_GRAMMAR = [
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

  // ── Vibe edits ──────────────────────────────────────────────────
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

  // Catch-all for off-grammar speech.
  '[unk]',
];

// VOSK doesn't carry "berghain", "lo-fi", "hi-hat" in its small-en lex,
// and number words ("eighty") are clearer to the LLM as digits. Rename
// here so downstream code-gen sees a familiar vocabulary regardless of
// which STT backend produced the text.
const CANONICALISE = [
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
  // Variant phrasing → canonical.
  [/\bopen\s+new\s+track\b/gi, 'open a new track'],
  [/\bnew\s+track\b/gi, 'open a new track'],
  [/\badd\s+a\s+new\s+track\b/gi, 'open a new track'],
  [/\bstop\s+everything\b/gi, 'stop all'],
  [/\bkill\s+it\b/gi, 'stop all'],
];

function canonicalise(text) {
  let out = text;
  for (const [re, rep] of CANONICALISE) out = out.replace(re, rep);
  return out;
}

/**
 * VOSK closed-grammar transcriber. Sub-15ms latency on the demo vocabulary.
 *
 * Tradeoff vs whisper / Gemini: only phrases in DEMO_GRAMMAR are recognised.
 * Off-grammar utterances return '' (mapped from [unk] / empty match), which
 * the upstream voicedRatio gate already handles cleanly. This is a "fast
 * path for canonical commands" backend, not a free-form transcriber.
 *
 * The default model in services/api/README.md is the lgraph variant
 * (vosk-model-en-us-0.22-lgraph, ~128 MB) — it has a larger acoustic
 * model than vosk-model-small-en-us-0.15 (40 MB) and noticeably better
 * accuracy on natural speech without the latency hit of the full
 * 1.8 GB model. Override via VOSK_MODEL_PATH if you want a different
 * trade-off.
 *
 * @param {{ modelPath: string, sampleRate?: number }} cfg
 * @returns {import('../application/ports.mjs').Transcriber}
 */
export function createVoskTranscriber({ modelPath, sampleRate = 16000 }) {
  setLogLevel(-1); // suppress per-call vocab warnings on stderr
  const tLoad = Date.now();
  const model = new Model(modelPath);
  console.log(`[vosk-transcriber] model loaded path=${modelPath} took=${Date.now() - tLoad}ms`);

  function pcmFloat32ToInt16Buffer(pcm) {
    const i16 = new Int16Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return Buffer.from(i16.buffer, i16.byteOffset, i16.byteLength);
  }

  return {
    getModelId: () => `vosk:${modelPath.split('/').pop()}`,
    /**
     * @param {Float32Array} pcm 16 kHz mono PCM
     * @param {{ language?: string, wavBuffer?: Buffer }} [_opts]  unused
     */
    async transcribe(pcm /* , _opts */) {
      // Each request gets a fresh recognizer — VOSK's grammar mode
      // results are sticky across utterances if the recognizer is
      // reused, and a new one is sub-millisecond to construct.
      const rec = new Recognizer({ model, sampleRate, grammar: DEMO_GRAMMAR });
      try {
        rec.acceptWaveform(pcmFloat32ToInt16Buffer(pcm));
        const r = rec.finalResult();
        const raw = (r.text || '').trim();
        if (!raw || raw === '[unk]') return { text: '' };
        return { text: canonicalise(raw) };
      } finally {
        rec.free();
      }
    },
  };
}
