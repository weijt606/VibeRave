// Browser-side WAV recorder. Captures mic audio, downsamples to 16 kHz mono,
// and encodes a 16-bit PCM WAV blob — the format the backend STT (whisper /
// vosk / OpenAI-compat) expects, so it can decode without ffmpeg or libopus.
//
// Uses ScriptProcessorNode (deprecated but universally supported and tiny).
// AudioWorklet would be the modern path; not worth the build wiring here.
//
// CRITICAL: we reuse Strudel's *existing* AudioContext instead of creating
// a new one. Spinning up a second AudioContext during playback causes the
// browser to renegotiate the audio device — that's the audible glitch /
// stutter the user hears when they hit push-to-talk while music is playing.
// Sharing the context means no renegotiation; cost is that capture runs at
// Strudel's playback context rate (typically 44.1 or 48 kHz), which the
// encode path below handles by resampling to 16 kHz on stop().

import { getAudioContext } from '@strudel/webaudio';

const TARGET_SAMPLE_RATE = 16000;

/**
 * @param {{
 *   silenceMs?: number,         // notify after this many ms of continuous silence (0 disables)
 *   silenceRmsThreshold?: number, // 0..1 linear RMS, default 0.012 (~ -38 dBFS)
 *   onSilence?: () => void,     // fired once per silence run (call stop() to flush)
 *   onLevel?: (rms: number) => void, // optional VU meter feed
 * }} [opts]
 */
export function createVoiceRecorder(opts = {}) {
  const silenceMs = opts.silenceMs ?? 0;
  const silenceRms = opts.silenceRmsThreshold ?? 0.012;
  const onSilence = opts.onSilence;
  const onLevel = opts.onLevel;

  let ctx = null;
  let stream = null;
  let source = null;
  let processor = null;
  let nodesToDispose = null;
  /** @type {Float32Array[]} */
  let chunks = [];
  let captureRate = TARGET_SAMPLE_RATE;
  let silenceStartedAt = 0;
  let silenceFired = false;
  let voiceSeen = false;

  async function start() {
    if (ctx) return;
    chunks = [];
    silenceStartedAt = 0;
    silenceFired = false;
    voiceSeen = false;

    // Reuse Strudel's existing AudioContext (the one playing the music)
    // instead of creating a new one — see file header comment. We resample
    // to 16 kHz at encode time on stop().
    ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch {}
    }
    captureRate = ctx.sampleRate;

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: false, // we want raw audio so AIC has work to do
        autoGainControl: false,
      },
    });
    source = ctx.createMediaStreamSource(stream);
    processor = ctx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);
      chunks.push(copy);

      let sumSq = 0;
      for (let i = 0; i < copy.length; i++) sumSq += copy[i] * copy[i];
      const rms = Math.sqrt(sumSq / copy.length);
      onLevel?.(rms);

      if (rms > silenceRms) {
        voiceSeen = true;
        silenceStartedAt = 0;
        silenceFired = false;
      } else if (silenceMs > 0 && voiceSeen && !silenceFired) {
        const now = performance.now();
        if (silenceStartedAt === 0) silenceStartedAt = now;
        else if (now - silenceStartedAt >= silenceMs) {
          silenceFired = true;
          onSilence?.();
        }
      }
    };

    source.connect(processor);
    // ScriptProcessorNode only fires onaudioprocess when there's a path to
    // the destination. We route through a muted gain node so the mic
    // doesn't echo into playback. Stash the sink so stop() can disconnect
    // it cleanly without leaking audio nodes into Strudel's shared graph.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    processor.connect(sink);
    sink.connect(ctx.destination);
    nodesToDispose = { sink };
  }

  /**
   * Stop the recorder and return the captured audio as a 16-bit PCM WAV blob
   * at 16 kHz mono. Returns `null` if no audio was captured.
   */
  async function stop() {
    if (!ctx) return null;
    try {
      processor?.disconnect();
      source?.disconnect();
      nodesToDispose?.sink?.disconnect();
    } catch {}
    stream?.getTracks().forEach((t) => t.stop());
    // CRITICAL: do NOT close ctx — it's the SHARED Strudel audio context
    // that's also playing the user's music. Closing it would kill all
    // sound. We just disconnect the recorder's nodes and let the GC sweep
    // them; the context stays alive.
    const localChunks = chunks;
    const localRate = captureRate;
    ctx = null;
    stream = null;
    source = null;
    processor = null;
    nodesToDispose = null;
    chunks = [];

    if (localChunks.length === 0) return null;
    let total = 0;
    for (const c of localChunks) total += c.length;
    const merged = new Float32Array(total);
    let offset = 0;
    for (const c of localChunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const pcm16k = localRate === TARGET_SAMPLE_RATE
      ? merged
      : resampleLinear(merged, localRate, TARGET_SAMPLE_RATE);
    if (pcm16k.length === 0) return null;
    return encodeWav(pcm16k, TARGET_SAMPLE_RATE);
  }

  function isActive() {
    return ctx !== null;
  }

  return { start, stop, isActive };
}

/**
 * Linear resample. Quality is dominated by mic + room, not interpolation —
 * this is fine for speech.
 */
function resampleLinear(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const t = srcIdx - i0;
    out[i] = samples[i0] * (1 - t) + samples[i1] * t;
  }
  return out;
}

function encodeWav(float32, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = float32.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
