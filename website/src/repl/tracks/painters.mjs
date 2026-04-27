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

// Pianoroll using Strudel's stock __pianoroll. Default fold=1 wraps notes
// into the unique-pitch set, fillActive=false + strokeActive=true gives
// the classic "block lights up as the playhead crosses it" feel. Known
// limitation: a pattern with only ONE unique pitch (e.g. `s("bd*4")`)
// collapses to a single full-canvas-height stripe — Strudel's algorithm
// allocates `canvas_height / unique_count` per bin. For drum-only loops
// without pitch variation, prefer the Scope or Waveform viz instead.
// Per-canvas hap buffer. Strudel's @strudel/draw `Drawer` is supposed to
// accumulate haps into a sliding 4-cycle window (visibleHaps) and pass
// the full buffer to onDraw, but in our multi-track setup the array
// arriving at our painter is always just the single currently-active
// hap. Without context (past + future haps) `__pianoroll` collapses to
// a single full-canvas-height stripe of the current note.
//
// Workaround: accumulate haps ourselves, keyed by canvas (one buffer
// per track). On each tick we add the haps coming in, prune anything
// outside the [time-2, time+2] window, then hand the union to
// __pianoroll. Buffer entries are deduped by `whole.begin + value` so
// the same hap arriving on consecutive frames doesn't double up.
const __pianorollBuffer = new WeakMap(); // canvas → Map<key, hap>
const PIANO_KEEP_BEHIND = 2; // cycles to keep in the past
const PIANO_KEEP_AHEAD = 2; // cycles to keep ahead

function __hapKey(h) {
  const begin = h.whole?.begin?.valueOf?.() ?? h.whole?.begin ?? '?';
  const v = h.value;
  let valKey;
  if (typeof v === 'object' && v !== null) {
    valKey = (v.note ?? v.n ?? v.freq ?? v.s ?? 'unknown') + '';
  } else {
    valKey = '' + v;
  }
  return begin + '|' + valKey;
}

const pianoroll = (ctx, time, haps, drawTime) => {
  const canvas = ctx.canvas;
  let buffer = __pianorollBuffer.get(canvas);
  if (!buffer) {
    buffer = new Map();
    __pianorollBuffer.set(canvas, buffer);
  }

  // Add incoming haps (Drawer only sends the current onset most frames,
  // but it adds up over time).
  for (const h of haps || []) {
    if (!h?.whole) continue;
    buffer.set(__hapKey(h), h);
  }

  // Prune out-of-window haps so the buffer doesn't grow unbounded as
  // the loop plays for minutes. Use the same window __pianoroll renders.
  const minTime = time - PIANO_KEEP_BEHIND;
  const maxTime = time + PIANO_KEEP_AHEAD;
  for (const [k, h] of buffer) {
    const begin = h.whole?.begin?.valueOf?.() ?? 0;
    const end =
      h.endClipped?.valueOf?.() ??
      h.whole?.end?.valueOf?.() ??
      begin;
    if (end < minTime || begin > maxTime) buffer.delete(k);
  }

  // Strudel patterns with `.add(perlin.range(...))` or `.superimpose(...)`
  // produce floating-point note values (e.g. 47.83 instead of a clean 48
  // for c3) — different on every cycle. __pianoroll treats every unique
  // float as its own pitch row, so a busy detuned pattern fans out into
  // hundreds of sub-pixel-tall lanes that read as horizontal lines.
  // Quantise to nearest semitone for the visualiser only — clones each
  // hap (preserving prototype + getters like .endClipped, .hasOnset) so
  // we never mutate the audio-side data.
  const buffered = [...buffer.values()];
  const renderHaps = buffered.map((h) => {
    const v = h?.value;
    if (
      !v ||
      typeof v !== 'object' ||
      typeof v.note !== 'number' ||
      Number.isInteger(v.note)
    ) {
      return h;
    }
    const clone = Object.create(Object.getPrototypeOf(h));
    Object.assign(clone, h);
    clone.value = { ...v, note: Math.round(v.note) };
    return clone;
  });

  return __pianoroll({
    ctx,
    time,
    haps: renderHaps,
    ...getDrawOptions(drawTime, {
      inactive: 'rgba(180,210,255,0.85)',
      active: '#ffffff',
      playheadColor: 'rgba(255,255,255,0.6)',
    }),
  });
};

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
    // Idle baseline — 60% opacity dashed line so it's clearly visible
    // even before audio starts (analyser only registers after the first
    // hap that carries `analyze: <id>` plays).
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(canvas.width, midY);
    ctx.stroke();
    ctx.restore();
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
    // Idle baseline — visible 2-px dashed line so the viz lane reads
    // as "alive but waiting for audio" rather than "broken".
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(canvas.width, midY);
    ctx.stroke();
    ctx.restore();
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

// Chromatic aberration oscilloscope — the same triggered-trace logic as
// `scope`, but stamped three times: a magenta copy offset 2px left, a
// cyan copy offset 2px right, and a thin white core. Uses additive
// (`globalCompositeOperation = 'lighter'`) blending so where the colours
// overlap they sum to white — visually identical to the .vr-logo CSS
// chromatic aberration. The offset only becomes obvious on transients
// with steep slopes (drum hits, pluck attacks); steady-state tones stay
// mostly-white with a subtle colour fringe.
//
// NOTE: colours are hard-coded (#ec4899 / #22d3ee) instead of read from
// CSS vars — Canvas2D doesn't have a getComputedStyle path to a context.
// If you ever rebrand by editing --vr-accent-* in index.css, sync the
// constants below by hand. The duplication is annotated so search picks
// it up.
const CHROMATIC_MAGENTA = 'rgba(236, 72, 153, 0.85)'; // sync with --vr-accent-magenta
const CHROMATIC_CYAN = 'rgba(34, 211, 238, 0.85)';    // sync with --vr-accent-cyan
const CHROMATIC_OFFSET = 2; // px — matches .vr-logo's text-shadow offset

const chromaticScope = (ctx, _time, _haps, _drawTime, opts) => {
  const id = opts?.analyzerId ?? 1;
  const analyser = analysers[id];
  const { canvas } = ctx;
  const midY = canvas.height / 2;

  if (!analyser) {
    // Idle baseline carries the same chromatic-aberration look so the
    // viz lane reads as branded even before audio starts.
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.globalCompositeOperation = 'lighter';

    ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
    ctx.beginPath();
    ctx.moveTo(-CHROMATIC_OFFSET, midY);
    ctx.lineTo(canvas.width - CHROMATIC_OFFSET, midY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
    ctx.beginPath();
    ctx.moveTo(CHROMATIC_OFFSET, midY);
    ctx.lineTo(canvas.width + CHROMATIC_OFFSET, midY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(canvas.width, midY);
    ctx.stroke();

    ctx.restore();
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

  // One trace, parameterised by horizontal offset. The closure over
  // `data`, `trigger`, `slice`, `amp`, `midY` keeps the inner loop tight.
  function tracePath(xOffset) {
    ctx.beginPath();
    let x = xOffset;
    for (let i = trigger; i < n; i++) {
      const y = midY - data[i] * amp;
      if (i === trigger) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.stroke();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.5;

  ctx.strokeStyle = CHROMATIC_MAGENTA;
  tracePath(-CHROMATIC_OFFSET);

  ctx.strokeStyle = CHROMATIC_CYAN;
  tracePath(CHROMATIC_OFFSET);

  // Thin white core so the actual signal stays readable when the
  // chromatic offsets pull apart on high-amplitude transients.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  tracePath(0);

  ctx.restore();
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

// 1-pixel vertical hairline showing the current cycle position (0..1
// fraction of canvas width). Drawn AFTER the painter so it sits on top
// of the audio viz. Brand cyan at low alpha — visible against any
// painter without dominating. Two skips:
//  - pianoroll already draws its own playhead (would overlap)
//  - spiral is radial, has no horizontal time axis to anchor on
// On scope/chromatic the canvas isn't a literal cycle timeline (it's a
// 23ms scope snapshot), but the line still reads as a useful "where in
// the loop are we" reference and helps the user time hot-swaps.
const PLAYHEAD_COLOR = 'rgba(34, 211, 238, 0.45)'; // sync with --vr-accent-cyan
export const SKIP_PLAYHEAD = new Set(['pianoroll', 'spiral']);
export function drawCyclePlayhead(ctx, time) {
  if (typeof time !== 'number' || !Number.isFinite(time)) return;
  const { canvas } = ctx;
  const cyclePos = ((time % 1) + 1) % 1;
  const x = Math.round(cyclePos * canvas.width) + 0.5; // crisp 1px on integer pixel
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = PLAYHEAD_COLOR;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvas.height);
  ctx.stroke();
  ctx.restore();
}

// `shape` tells the host how to size the canvas:
//   'wide'   — short horizontal bar (time axis runs left↔right)
//   'square' — radial / vertical viz that wants ~equal width and height
export const PAINTERS = {
  pianoroll: { label: 'Piano roll', paint: pianoroll, shape: 'wide' },
  waveform: { label: 'Waveform', paint: waveform, shape: 'wide' },
  spectrum: { label: 'Spectrum', paint: spectrum, shape: 'wide' },
  scope: { label: 'Scope', paint: scope, shape: 'wide' },
  chromaticScope: { label: 'Chromatic', paint: chromaticScope, shape: 'wide' },
  spiral: { label: 'Spiral', paint: spiral, shape: 'square' },
};

export const VIZ_KEYS = Object.keys(PAINTERS);
export const DEFAULT_VIZ = 'scope';

export function getPainter(viz) {
  return PAINTERS[viz]?.paint || PAINTERS[DEFAULT_VIZ].paint;
}

export function getShape(viz) {
  return PAINTERS[viz]?.shape || PAINTERS[DEFAULT_VIZ].shape;
}
