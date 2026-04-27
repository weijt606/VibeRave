import OpenAI from 'openai';
import wavefile from 'wavefile';

const { WaveFile } = wavefile;

// Domain-context prompt fed to OpenAI Whisper / Groq Whisper / any other
// /audio/transcriptions backend that supports the `prompt` parameter. This
// is the same biasing trick our local whisper-transcriber uses: the
// decoder treats the prompt as recent context, so words appearing here
// are picked over phonetic neighbours. Critical for proper nouns
// (Berghain, Aphex Twin) and DJ jargon (lo-fi, dub, breakbeat) that the
// model is more likely to hallucinate as common English otherwise.
//
// Whisper's prompt window is 224 tokens — keep this comfortably under.
const STT_BIAS_PROMPT =
  'Voice commands for live-coding rave music: techno, house, deep house, ' +
  'lo-fi, dub, dubby, drum and bass, ambient, acid, trance, breakbeat, ' +
  'IDM, hyperpop, trap. Berghain (Berlin techno club). Drum machines: ' +
  'TR-909, TR-808, LinnDrum, MPC60. Synths: sawtooth, square, sine, ' +
  'Rhodes piano, sub bass, acid bass, lead, pad, arp. Effects: reverb, ' +
  'delay, echo, sidechain, distortion. BPM tempos.';

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
      let response;
      try {
        response = await client.audio.transcriptions.create({
          file,
          model,
          ...(lang && lang !== 'auto' ? { language: lang } : {}),
          // Domain biasing — see STT_BIAS_PROMPT comment at the top of
          // this file. Providers that ignore the field (a few Whisper-API
          // clones do) silently drop it; nothing breaks.
          prompt: STT_BIAS_PROMPT,
          response_format: 'json',
        });
      } catch (err) {
        // Surface the real upstream cause instead of a generic 500. Common
        // failure shapes:
        //   • 404  → endpoint doesn't speak /audio/transcriptions (e.g.
        //            user picked a chat-only baseURL).
        //   • 401  → bad / missing API key.
        //   • 400 + "model_not_found" → wrong model id for this provider.
        const status = err?.status ?? err?.response?.status ?? 0;
        const upstreamMsg =
          err?.error?.message ||
          err?.response?.data?.error?.message ||
          err?.message ||
          'unknown error';
        const where = baseURL || 'OpenAI default';
        const message = `STT request to ${where} (model "${model}") failed${status ? ` with HTTP ${status}` : ''}: ${upstreamMsg}`;
        const wrapped = new Error(message);
        wrapped.status = 502;
        wrapped.code = 'stt_upstream_failed';
        throw wrapped;
      }
      const text = (response.text ?? '').trim();
      return { text };
    },
  };
}
