import OpenAI from 'openai';
import wavefile from 'wavefile';

const { WaveFile } = wavefile;

/**
 * Generic OpenAI-compatible STT client (the /audio/transcriptions endpoint).
 * Works with anything that speaks that protocol:
 *
 *   • OpenAI Whisper API   model = whisper-1
 *   • Groq Whisper         baseURL = https://api.groq.com/openai/v1,
 *                          model = whisper-large-v3-turbo
 *   • Local self-hosted whisper.cpp servers exposing the openai shape
 *
 * Conforms to the same Transcriber port as whisper / vosk so
 * transcribe-audio.mjs doesn't have to branch.
 *
 * @param {{
 *   apiKey: string | null,
 *   baseURL?: string | null,
 *   model: string,
 *   language?: string,
 * }} cfg
 * @returns {import('../application/ports.mjs').Transcriber | null}
 */
export function createOpenAICompatibleStt({ apiKey, baseURL, model, language = 'en' }) {
  if (!apiKey) return null;
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  function pcmToWav(pcm, sampleRate = 16000) {
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
    getModelId: () => `${baseURL || 'openai'}:${model}`,
    /**
     * @param {Float32Array} pcm 16 kHz mono PCM
     * @param {{ language?: string, wavBuffer?: Buffer }} [opts]
     */
    async transcribe(pcm, opts = {}) {
      const wav = Buffer.isBuffer(opts.wavBuffer) ? opts.wavBuffer : pcmToWav(pcm);
      const lang = opts.language || language;
      // OpenAI's SDK expects a File-like object with a name + arrayBuffer.
      // The Web File API works fine here under modern Node (≥ 20).
      const file = new File([wav], 'voice.wav', { type: 'audio/wav' });
      const response = await client.audio.transcriptions.create({
        file,
        model,
        ...(lang && lang !== 'auto' ? { language: lang } : {}),
        response_format: 'json',
      });
      const text = (response.text ?? '').trim();
      return { text };
    },
  };
}
