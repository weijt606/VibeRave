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
      // Domain bias: tell the model what speech to expect. paraformer /
      // qwen-audio-asr / fun-asr all benefit from this context — proper
      // nouns like "Berghain" and DJ jargon ("lo-fi", "dub", "breakbeat")
      // get recognised much more reliably than they would in a generic
      // "transcribe whatever" frame.
      const norm = String(lang || '').toLowerCase();
      const isEnglishOnly = norm.startsWith('en');
      const langLine =
        lang && lang !== 'auto'
          ? `Expected language: ${lang}.`
          : 'The speaker may use English, Chinese, or a mix — transcribe each segment in its own language.';
      // Append Chinese DJ vocabulary unless the user explicitly pinned
      // English. paraformer-v2 / fun-asr / qwen-audio-asr are Chinese-first
      // so the zh anchors significantly help recall on mixed input.
      const zhTerms = isEnglishOnly
        ? ''
        : '中文常见术语：柏林Berghain、低保真lo-fi、深house、techno、鼓机、踢鼓、贝斯、合成器、混响、延迟。';
      const promptText = [
        'Transcribe the speech verbatim.',
        langLine,
        'The speaker is a DJ giving live-coding music commands —',
        'expect terms like: Berghain, lo-fi, dub, dubby, breakbeat,',
        'drum and bass, acid bass, sub bass, TR-909, TR-808, LinnDrum,',
        'Rhodes piano, sidechain, BPM, hi-hat.',
        zhTerms,
        'If the audio contains',
        'no recognisable speech, return an empty string — DO NOT make',
        'up a sentence.',
        'Return only the transcript text — no commentary, no time stamps,',
        'no language tags.',
      ]
        .filter(Boolean)
        .join(' ');

      const dataUri = `data:audio/wav;base64,${wav.toString('base64')}`;

      // Two distinct DashScope body shapes share the multimodal-generation
      // endpoint but expect different request structures:
      //
      //   • Pure ASR models (qwen3-asr, qwen3-asr-flash):
      //     - user content holds ONLY {audio}, no {text} prompt
      //     - system role with empty text is required
      //     - parameters: {asr_options: {enable_itn}}
      //     - the model rejects with "task 'asr' does not support this
      //       input" if you stick a text prompt in user content.
      //
      //   • Multimodal audio models (qwen-audio-asr, qwen-audio-turbo):
      //     - user content can mix {audio} + {text} (text = bias prompt)
      //     - parameters: {result_format: 'message'}
      //
      // We dispatch on the model name prefix so DJ-vocabulary biasing
      // still works on the multimodal models, while qwen3-asr-flash gets
      // the clean shape it expects.
      const isPureAsr = /^qwen3-asr/i.test(model);
      const body = isPureAsr
        ? {
            model,
            input: {
              messages: [
                { role: 'system', content: [{ text: '' }] },
                { role: 'user', content: [{ audio: dataUri }] },
              ],
            },
            parameters: { asr_options: { enable_itn: false } },
          }
        : {
            model,
            input: {
              messages: [
                {
                  role: 'user',
                  content: [{ audio: dataUri }, { text: promptText }],
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

      // DashScope's async-task pattern: a 200 with ONLY `request_id` (no
      // `output`) means the model accepted the audio but is computing the
      // result on a different channel (WebSocket / polling /api/v1/tasks).
      // qwen3-asr-flash-realtime, fun-asr-realtime, and other "-realtime"
      // / "-streaming" models use this pattern. Our sync REST adapter can't
      // handle them; throw a clear error so the user can switch model in
      // the UI instead of seeing silently-empty output.
      const onlyRequestId =
        j && typeof j === 'object' && j.request_id && !j.output && !j.data;
      if (onlyRequestId) {
        const wrapped = new Error(
          `DashScope model "${model}" returned an async task (request_id only, no transcript). ` +
            `Likely cause: the model is streaming-only (uses WebSocket) or async-only (needs task polling). ` +
            `Switch the STT Model field to "qwen3-asr-flash" or "qwen-audio-asr" — these are synchronous ` +
            `and work over our REST adapter. Avoid "-realtime" / "-streaming" variants and the paraformer-* / ` +
            `fun-asr models (different endpoint).`,
        );
        wrapped.status = 502;
        wrapped.code = 'stt_model_unsupported';
        throw wrapped;
      }

      // DashScope's response shape varies by model family:
      //   • paraformer-v2 / fun-asr (synchronous) → output.choices[0].message.content
      //     (string, or array of {text} parts)
      //   • qwen-audio-asr → same as above
      //   • Some clones → output.text / output.transcript / data.text / etc.
      // Try each in turn so we don't silently drop a valid transcript just
      // because the response moved one field to the side.
      const text = extractDashScopeText(j);

      if (!text) {
        // Empty response from a recognised shape — log full body for diagnosis.
        // eslint-disable-next-line no-console
        console.warn('[dashscope-stt] empty transcript', {
          model,
          responseStatus: res.status,
          responseKeys: Object.keys(j || {}),
          outputKeys: Object.keys(j?.output || {}),
          rawResponse: JSON.stringify(j).slice(0, 800),
        });
      }

      return { text: text.trim() };
    },
  };
}

// Defensive multi-shape extractor. DashScope has several response layouts
// across model families and minor version bumps; this walks the common
// ones in order so a transcript hidden one field over still gets picked up.
function extractDashScopeText(j) {
  if (!j) return '';
  // Shape 1: classic multimodal-generation message.content (string OR array)
  const choice = j?.output?.choices?.[0];
  if (choice?.message?.content) {
    const c = choice.message.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) {
      const joined = c
        .filter((p) => typeof p?.text === 'string')
        .map((p) => p.text)
        .join(' ');
      if (joined) return joined;
    }
  }
  // Shape 2: flat output.text (qwen3-asr-flash and similar)
  if (typeof j?.output?.text === 'string' && j.output.text.length > 0) {
    return j.output.text;
  }
  // Shape 3: output.transcript (some ASR-specific endpoints)
  if (typeof j?.output?.transcript === 'string' && j.output.transcript.length > 0) {
    return j.output.transcript;
  }
  // Shape 4: nested output.output (occasional double-wrap)
  if (typeof j?.output?.output === 'string' && j.output.output.length > 0) {
    return j.output.output;
  }
  // Shape 5: top-level data.text (rare, possible compatibility shim)
  if (typeof j?.data?.text === 'string' && j.data.text.length > 0) {
    return j.data.text;
  }
  // Shape 6: result_format='text' returns plain string at output.results[0].text
  if (Array.isArray(j?.output?.results) && j.output.results[0]?.text) {
    return j.output.results[0].text;
  }
  return '';
}
