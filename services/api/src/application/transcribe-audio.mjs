import { InvalidInput, ServiceUnavailable } from '../domain/errors.mjs';
import {
  wavToPcm16kMono,
  computeAudioMetrics,
} from '../infrastructure/audio-metrics.mjs';

/**
 * Use case: transcribe an uploaded WAV using the configured Transcriber.
 * Persists per-take metrics + an optional stage dump so different STT
 * backends can be A/B-compared offline.
 *
 * Returned `text` is the (optionally LLM-cleaned) transcript. The caller
 * posts that to `/generate` unchanged.
 *
 * @param {{
 *   transcriber: import('./ports.mjs').Transcriber | null,
 *   metricsStore?: { append: (record: object) => Promise<void> } | null,
 *   stageDumpStore?: { beginTake: (sessionId: string|null) => null | {
 *     dir: string,
 *     wav: (name: string, buf: Buffer) => void,
 *     text: (name: string, str: string) => void,
 *     json: (name: string, obj: object) => void,
 *   } } | null,
 *   transcriptNormalizer?: { normalize: (raw: string) => Promise<string> } | null,
 * }} deps
 */
export function makeTranscribeAudio({
  transcriber,
  metricsStore = null,
  stageDumpStore = null,
  transcriptNormalizer = null,
}) {
  return async function transcribeAudio({ wavBuffer, language, sessionId }) {
    if (!transcriber) {
      throw new ServiceUnavailable(
        'Transcriber is not initialised. Check STT_PROVIDER and the corresponding model / API key.',
      );
    }
    if (!Buffer.isBuffer(wavBuffer) || wavBuffer.length === 0) {
      throw new InvalidInput(
        'POST a WAV file as the request body (Content-Type: audio/wav).',
      );
    }

    const startedAt = Date.now();
    const take = stageDumpStore ? stageDumpStore.beginTake(sessionId ?? null) : null;
    take?.wav('raw', wavBuffer);

    const decoded = wavToPcm16kMono(wavBuffer);
    const audioMetrics = computeAudioMetrics(decoded.pcm);

    const sttStartedAt = Date.now();
    const rawResult = await transcriber.transcribe(decoded.pcm, {
      language,
      wavBuffer,
    });
    const sttMs = Date.now() - sttStartedAt;
    take?.text('raw', rawResult.text);

    let rawRecommended = rawResult.text || '';

    // Final guard against silence-fed hallucinations. Whisper invents fillers
    // ("Thanks for watching.", "you", "Music playing in the background.")
    // whenever the input is nearly silent. voicedRatio is the cleanest signal
    // that "there was no real speech". < 0.10 means basically the whole
    // window was unvoiced — drop the text and let the frontend show
    // "didn't catch that".
    let pickSource = 'raw';
    if (rawRecommended && audioMetrics.voicedRatio < 0.1) {
      pickSource = 'vad-rejected';
      rawRecommended = '';
    }
    take?.text('picked', `${pickSource}: ${rawRecommended}`);

    // Optional: tiny LLM cleanup pass to fix STT errors that the static
    // post-process dictionary in the transcriber can't handle (artist
    // names, half-heard phrases, fillers). On error or noop the normalizer
    // returns the original text unchanged.
    let text = rawRecommended;
    let normalizeMs = null;
    if (transcriptNormalizer && rawRecommended) {
      const t0 = Date.now();
      try {
        text = await transcriptNormalizer.normalize(rawRecommended);
      } catch (err) {
        console.warn(`[transcribe] normalize threw: ${err.message}`);
      }
      normalizeMs = Date.now() - t0;
    }

    const totalMs = Date.now() - startedAt;

    const record = {
      text,
      rawText: rawRecommended,
      pickSource,
      raw: {
        text: rawResult.text,
        metrics: audioMetrics,
        sttMs,
      },
      normalizeMs,
      sttModel: transcriber.getModelId(),
      audio: {
        durationMs: decoded.durationMs,
        originalSampleRate: decoded.originalSampleRate,
        channels: decoded.channels,
      },
      totalMs,
    };

    if (metricsStore) {
      // Persist asynchronously; don't block the response on disk I/O,
      // but log if the write fails so we don't silently lose evidence.
      metricsStore
        .append({ sessionId: sessionId ?? null, ...record })
        .catch((err) => console.error('metrics append failed:', err));
    }

    if (take) {
      take.text('final', text);
      take.json('meta', { sessionId: sessionId ?? null, ...record });
    }

    return record;
  };
}
