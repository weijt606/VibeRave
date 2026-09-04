import { Model, Recognizer, setLogLevel } from 'vosk-koffi';
import { DEMO_GRAMMAR, canonicalise } from './fast-lane-grammar.mjs';

// DEMO_GRAMMAR + CANONICALISE live in fast-lane-grammar.mjs (plain data, no
// native deps) so the front-end fast lane and the tests can reuse them.

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
