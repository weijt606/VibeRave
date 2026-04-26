import wavefile from 'wavefile';

const { WaveFile } = wavefile;

/**
 * DashScope native ASR client (Aliyun Bailian).
 *
 * DashScope's OpenAI-compatible mode (/compatible-mode/v1) only carries chat;
 * audio transcriptions live on a different surface. This adapter targets the
 * *recognition* endpoint of DashScope's native multimodal API — same as the
 * one used by `qwen-audio-asr`, `paraformer-v2`, and the synchronous
 * fun-asr family. fun-asr-realtime (websocket streaming) needs a separate
 * adapter; this one handles single-utterance, file-upload-style requests.
 *
 * Endpoints:
 *   • China:        https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
 *   • International: https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
 *
 * Conforms to the same Transcriber port as whisper / vosk.
 *
 * @param {{
 *   apiKey: string | null,
 *   baseURL?: string | null,
 *   model: string,
 *   language?: string,
 * }} cfg
 * @returns {import('../application/ports.mjs').Transcriber | null}
 */
export function createDashScopeStt({ apiKey, baseURL, model, language = 'auto' }) {
  if (!apiKey) return null;

  // Normalise the user-supplied baseURL. The frontend lets users paste
  // either the OpenAI-compat URL (which won't work for audio) or the
  // native one. We rewrite the compat path to the multimodal endpoint
  // so the user doesn't have to know the difference.
  const root = (baseURL || 'https://dashscope-intl.aliyuncs.com')
    .replace(/\/+$/, '')
    .replace(/\/compatible-mode\/v1$/, '')
    .replace(/\/api\/v1.*$/, '');
  const endpoint = `${root}/api/v1/services/aigc/multimodal-generation/generation`;

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
    getModelId: () => `dashscope:${model}`,
    /**
     * @param {Float32Array} pcm 16 kHz mono PCM
     * @param {{ language?: string, wavBuffer?: Buffer }} [opts]
     */
    async transcribe(pcm, opts = {}) {
      const wav = Buffer.isBuffer(opts.wavBuffer) ? opts.wavBuffer : pcmToWav(pcm);
      const lang = opts.language || language;

      // DashScope multimodal-generation accepts inline audio as a base64
      // data URI. paraformer-v2 / fun-asr / qwen-audio-asr all share the
      // same request shape; the model field selects which one decodes.
      const dataUri = `data:audio/wav;base64,${wav.toString('base64')}`;
      const body = {
        model,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { audio: dataUri },
                {
                  text:
                    lang && lang !== 'auto'
                      ? `Transcribe the speech verbatim. Expected language: ${lang}. Return only the transcript text — no commentary, no time stamps.`
                      : 'Transcribe the speech verbatim. Return only the transcript text — no commentary, no time stamps.',
                },
              ],
            },
          ],
        },
        parameters: { result_format: 'message' },
      };

      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        const wrapped = new Error(
          `DashScope ASR network error to ${endpoint}: ${err.message || err}`,
        );
        wrapped.status = 502;
        wrapped.code = 'stt_upstream_failed';
        throw wrapped;
      }

      if (!res.ok) {
        let upstreamMsg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          upstreamMsg = j?.message || j?.error?.message || JSON.stringify(j).slice(0, 200);
        } catch {
          /* keep status-only message */
        }
        const wrapped = new Error(
          `DashScope ASR (model "${model}") failed: ${upstreamMsg}`,
        );
        wrapped.status = 502;
        wrapped.code = 'stt_upstream_failed';
        throw wrapped;
      }

      const j = await res.json();
      // DashScope multimodal returns text in output.choices[0].message.content
      // — the content is usually a single text part.
      const choice = j?.output?.choices?.[0];
      let text = '';
      if (choice?.message?.content) {
        const c = choice.message.content;
        if (typeof c === 'string') text = c;
        else if (Array.isArray(c)) {
          text = c
            .filter((p) => typeof p?.text === 'string')
            .map((p) => p.text)
            .join(' ');
        }
      }
      return { text: (text || '').trim() };
    },
  };
}
