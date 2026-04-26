import { GoogleGenAI } from '@google/genai';
import wavefile from 'wavefile';

const { WaveFile } = wavefile;

/**
 * Gemini multimodal STT. Sends a WAV (built from the use case's PCM if
 * needed) inline as a Gemini audio part and asks for a verbatim transcript.
 *
 * Quality is much better than whisper-medium.en on short DJ commands —
 * Gemini doesn't carry whisper's training-data fillers ("Thanks for
 * watching.", "Music playing in the background."), and it handles spoken
 * numbers ("one thirty-eight" → 138) cleanly. Cost: one extra Gemini call
 * per voice take, plus network round-trip (~1 s warm).
 *
 * Conforms to the same Transcriber port as whisper so transcribe-audio.mjs
 * doesn't have to branch. The use case passes `wavBuffer` in opts; if it's
 * absent we re-encode the PCM. PCM-only callers get a free re-encode.
 *
 * @param {{ apiKey: string | null, model: string, language: string }} cfg
 * @returns {import('../application/ports.mjs').Transcriber | null}
 */
export function createGeminiStt({ apiKey, model, language = 'en' }) {
  if (!apiKey) return null;
  const genai = new GoogleGenAI({ apiKey });

  function pcmToWav(pcm, sampleRate = 16000) {
    // Float32 → 16-bit PCM is what wavefile + Gemini both prefer; saves a
    // few bytes vs sending 32f and is what whisper would have used anyway.
    const i16 = new Int16Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const wav = new WaveFile();
    wav.fromScratch(1, sampleRate, '16', i16);
    return Buffer.from(wav.toBuffer());
  }

  return {
    getModelId: () => model,
    /**
     * @param {Float32Array} pcm  16 kHz mono PCM the use case decoded.
     * @param {{ language?: string, wavBuffer?: Buffer }} [opts]
     */
    async transcribe(pcm, opts = {}) {
      // Prefer the original WAV when the caller has it (avoids re-encode).
      const wav = Buffer.isBuffer(opts.wavBuffer) ? opts.wavBuffer : pcmToWav(pcm);
      const lang = opts.language || language;
      const langLine =
        lang && lang !== 'auto'
          ? `Expected language: ${lang}.`
          : 'The speaker may use English, Mandarin, or a mix — transcribe each part in its own script.';

      const response = await genai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } },
              {
                text: [
                  'Transcribe the speech in this audio verbatim.',
                  langLine,
                  'The speaker is a DJ giving short live-coding music commands',
                  '(e.g. "lo-fi beat at 80 bpm", "add reverb", "open a new track",',
                  '"Berghain techno", "stop all"). If the audio is silent or contains',
                  'no recognisable speech, return an empty string — DO NOT make up',
                  'a sentence.',
                  'Return only the transcribed words. No quotes, no commentary, no',
                  'time stamps, no language tags.',
                ].join(' '),
              },
            ],
          },
        ],
        config: { temperature: 0 },
      });
      const text = (response.text ?? '').trim();
      return { text };
    },
  };
}
