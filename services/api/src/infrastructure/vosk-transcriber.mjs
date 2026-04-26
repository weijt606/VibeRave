import { Model, Recognizer, setLogLevel } from 'vosk-koffi';

// Closed grammar: the recogniser will only ever output one of these phrases
// (or [unk]). Mirrors the prompt-chip list in
// website/src/repl/components/panel/VibeTab.jsx so the click-chip UI and the
// voice vocabulary share one mental model. Add new chips → add the same
// phrase here. Words missing from the small-en model's pronunciation lex
// (Berghain, lo-fi, hi-hat) are spelled phonetically so the decoder can
// match them; the post-process map below renames them back to the canonical
// form before the LLM sees them.
const DEMO_GRAMMAR = [
  // Generation seeds
  'lo fi beat at eighty bpm',
  'lo fi beat',
  'berg hain techno',
  'berg hain techno at one thirty eight',
  'drum and bass',
  'drum and bass at one seventy four',
  'acid bass',
  'house music at one twenty',
  'minimal techno',
  // Stem / drum / effect edits
  'add high hat',
  'add reverb',
  'more bass',
  'more reverb',
  'double the drums',
  'double drums',
  'make it darker',
  'make it dubby',
  // Transport / META
  'open a new track',
  'stop all',
  'stop',
  'play',
  'pause',
  // Catch-all for off-grammar speech
  '[unk]',
];

// VOSK doesn't carry "berghain", "lo-fi", "hi-hat" in its small-en lex, so
// they're spelled phonetically in the grammar above. Rename them to the
// canonical form here so the downstream code-gen LLM gets a familiar
// vocabulary regardless of which STT backend produced the text.
const CANONICALISE = [
  [/\bberg\s*hain\b/gi, 'Berghain'],
  [/\blo\s+fi\b/gi, 'lo-fi'],
  [/\bhigh\s+hat\b/gi, 'hi-hat'],
  [/\bone\s+twenty\b/gi, '120'],
  [/\bone\s+thirty\s+eight\b/gi, '138'],
  [/\bone\s+seventy\s+four\b/gi, '174'],
  [/\beighty\b/gi, '80'],
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
 * path for the canonical commands" backend, not a free-form transcriber.
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
        // VOSK's [unk] sentinel means "no grammar match" — return empty
        // so the upstream pipeline behaves identically to a silent take.
        if (!raw || raw === '[unk]') return { text: '' };
        return { text: canonicalise(raw) };
      } finally {
        rec.free();
      }
    },
  };
}
