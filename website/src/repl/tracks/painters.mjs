// Per-track painter registry. Each entry is a painter:
//   (ctx, time, haps, drawTime, opts) => paint
// matching Strudel's onPaint signature, plus an extra `opts` arg that
// carries per-track context (currently `analyzerId` so audio-driven
// painters can read this track's AnalyserNode without leaking globals).
// Old painters can ignore `opts` — JS happily drops extra args.

import { __pianoroll, drawSpiral } from '@strudel/draw';
import { analysers, getAnalyzerData } from '@strudel/webaudio';

function getDrawOptions(drawTime, options = {}) {
  // Mirrors getDrawOptions from @strudel/draw without re-importing the
  // un-exported helper. Translates the editor's [lookbehind, lookahead]
  // window into the cycles/playhead pair the painters expect.
  let [lookbehind, lookahead] = drawTime;
  lookbehind = Math.abs(lookbehind);
  const cycles = lookahead + lookbehind;
  const playhead = cycles !== 0 ? lookbehind / cycles : 0;
  return { ...options, cycles, playhead };
}

// Pianoroll with proper midi spacing — autorange so the bars fill the
// canvas vertically (default minMidi=10..maxMidi=90 makes 80 slots, which
// flattens to ~1px-tall notes on an 80px canvas). Solid fill, dim inactive
// vs bright active so you can read the playhead at a glance.
const pianoroll = (ctx, time, haps, drawTime) =>
  __pianoroll({
    ctx,
    time,
    haps,
    ...getDrawOptions(drawTime, {
      fold: 0,
      autorange: 1,
      fill: 1,
      fillActive: 1,
      stroke: 0,
      strokeActive: 0,
      inactive: 'rgba(180,210,255,0.45)',
      active: '#ffffff',
      playheadColor: 'rgba(255,255,255,0.6)',
    }),
  });

const spiral = (ctx, time, haps, drawTime) =>
  drawSpiral({ ctx, time, haps, drawTime });

// === Audio-driven painters ===
// Read live audio from the per-track AnalyserNode that trackVolume.mjs
// registers via `analyze: <analyzerId>`. Until the track has played at
// least one event the analyser doesn't exist yet — each painter renders
// a flat baseline in that case so the canvas isn't blank.

// Classic line oscilloscope — single snapshot of the latest ~1024 samples
// of time-domain audio, aligned to the first downward zero-crossing so the
// trace doesn't jitter horizontally between frames.
const scope = (ctx, _time, _haps, _drawTime, opts) => {
  const id = opts?.analyzerId ?? 1;
  const analyser = analysers[id];
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  const { canvas } = ctx;
  const midY = canvas.height / 2;
  if (!analyser) {
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(canvas.width, midY);
    ctx.stroke();
    return;
  }
  const data = getAnalyzerData('time', id);
  const n = analyser.frequencyBinCount;
  let trigger = 0;
  for (let i = 1; i < n; i++) {
    if (data[i - 1] > 0 && data[i] <= 0) { trigger = i; break; }
  }
  const slice = canvas.width / Math.max(n - trigger, 1);
  const amp = canvas.height * 0.42;
  ctx.beginPath();
  let x = 0;
  for (let i = trigger; i < n; i++) {
    const y = midY - data[i] * amp;
    if (i === trigger) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += slice;
  }
  ctx.stroke();
};

// DAW-style scrolling waveform: each frame we measure the peak amplitude
// of the current time-domain buffer and push it into a per-track ring of
// recent peaks; we render that ring as a filled, symmetric envelope so
// you see the *shape* of the audio over the last ~3-4 seconds rather
// than a single 23ms snapshot like `scope`.
const WAVEFORM_HISTORY = 240;
const waveformHistory = new Map();
const waveform = (ctx, _time, _haps, _drawTime, opts) => {
  const id = opts?.analyzerId ?? 1;
  const analyser = analysers[id];
  const { canvas } = ctx;
  const midY = canvas.height / 2;
  if (!analyser) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, midY - 1, canvas.width, 2);
    return;
  }
  const data = getAnalyzerData('time', id);
  const n = analyser.frequencyBinCount;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(data[i]);
    if (v > peak) peak = v;
  }
  let history = waveformHistory.get(id);
  if (!history || history.length !== WAVEFORM_HISTORY) {
    history = new Float32Array(WAVEFORM_HISTORY);
    waveformHistory.set(id, history);
  }
  history.copyWithin(0, 1);
  history[WAVEFORM_HISTORY - 1] = peak;

  const slice = canvas.width / WAVEFORM_HISTORY;
  const amp = canvas.height * 0.45;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, midY - history[0] * amp);
  for (let i = 0; i < WAVEFORM_HISTORY; i++) {
    ctx.lineTo(i * slice, midY - history[i] * amp);
  }
  for (let i = WAVEFORM_HISTORY - 1; i >= 0; i--) {
    ctx.lineTo(i * slice, midY + history[i] * amp);
  }
  ctx.closePath();
  ctx.fill();
};

// Scrolling log-frequency spectrogram. Maintains a per-track snapshot of
// the previous frame in `spectrogramFrames` so each tick only has to
// shift the prior image and paint the rightmost column.
const spectrogramFrames = new Map();
const spectrum = (ctx, _time, _haps, _drawTime, opts) => {
  const id = opts?.analyzerId ?? 1;
  const analyser = analysers[id];
  const { canvas } = ctx;
  if (!analyser) {
    ctx.fillStyle = 'rgba(180,210,255,0.2)';
    ctx.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
    return;
  }
  const speed = 2; // px scrolled per frame
  const min = -80;
  const max = 0;
  const data = getAnalyzerData('frequency', id);
  const bins = analyser.frequencyBinCount;
  const prev = spectrogramFrames.get(id);
  // onDraw clears the canvas before us, so we re-paint the previous frame
  // shifted left, then add the new column on the right.
  if (prev && prev.width === canvas.width && prev.height === canvas.height) {
    ctx.putImageData(prev, -speed, 0);
  }
  const x = canvas.width - speed;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < bins; i++) {
    const norm = Math.max(0, Math.min(1, (data[i] - min) / (max - min)));
    if (norm <= 0) continue;
    ctx.globalAlpha = norm;
    // Log-scale the bin index so low frequencies aren't squashed at the bottom.
    const y = (Math.log(i + 1) / Math.log(bins)) * canvas.height;
    ctx.fillRect(x, canvas.height - y, speed, 2);
  }
  ctx.globalAlpha = 1;
  spectrogramFrames.set(id, ctx.getImageData(0, 0, canvas.width, canvas.height));
};

// Hook called by useTrackEditors when a track is deleted, so the
// per-track imageData / history buffers and the analyser slot don't leak.
export function disposeAnalyzerArtifacts(analyzerId) {
  spectrogramFrames.delete(analyzerId);
  waveformHistory.delete(analyzerId);
  delete analysers[analyzerId];
}

// `shape` tells the host how to size the canvas:
//   'wide'   — short horizontal bar (time axis runs left↔right)
//   'square' — radial / vertical viz that wants ~equal width and height
export const PAINTERS = {
  pianoroll: { label: 'Piano roll', paint: pianoroll, shape: 'wide' },
  waveform: { label: 'Waveform', paint: waveform, shape: 'wide' },
  spectrum: { label: 'Spectrum', paint: spectrum, shape: 'wide' },
  scope: { label: 'Scope', paint: scope, shape: 'wide' },
  spiral: { label: 'Spiral', paint: spiral, shape: 'square' },
};

export const VIZ_KEYS = Object.keys(PAINTERS);
export const DEFAULT_VIZ = 'waveform';

export function getPainter(viz) {
  return PAINTERS[viz]?.paint || PAINTERS[DEFAULT_VIZ].paint;
}

export function getShape(viz) {
  return PAINTERS[viz]?.shape || PAINTERS[DEFAULT_VIZ].shape;
}
