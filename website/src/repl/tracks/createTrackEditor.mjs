import { getPerformanceTimeSeconds, silence } from '@strudel/core';
import { transpiler, evaluate } from '@strudel/transpiler';
import {
  getAudioContextCurrentTime,
  webaudioOutput,
} from '@strudel/webaudio';
import { superdirtOutput } from '@strudel/osc/superdirtoutput';
import { StrudelMirror } from '@strudel/codemirror';
import { clearHydra } from '@strudel/hydra';
import { setInterval, clearInterval } from 'worker-timers';
import { audioEngineTargets } from '../../settings.mjs';
import {
  getAudioReady,
  getModulesLoading,
  getPresetsLoading,
} from './strudelGlobalInit.mjs';
import { setTrackCode } from './tracksStore.mjs';
import { makeTrackOutput } from './trackVolume.mjs';
import {
  getPainter,
  DEFAULT_VIZ,
  drawCyclePlayhead,
  SKIP_PLAYHEAD,
} from './painters.mjs';

// Build a StrudelMirror bound to a single track. Each editor runs its own
// scheduler so multiple tracks can play in parallel — we pass solo:false to
// suppress the default "stop the others" event.
export function createTrackEditor({
  trackId,
  container,
  initialCode,
  initialVolume = 1,
  initialViz = DEFAULT_VIZ,
  isSyncEnabled,
  audioEngineTarget,
  prebakeScript,
  onUpdateState,
  drawContext, // initial per-track 2d ctx
}) {
  // Ref-based ctx so the host can swap in a new canvas after a remount
  // (HMR, viz layout change, container resize) without rebuilding the
  // editor — the next animation frame paints into the new canvas.
  const drawContextRef = { current: drawContext || null };
  const shouldUseWebaudio = audioEngineTarget !== audioEngineTargets.osc;
  const baseOutput = shouldUseWebaudio ? webaudioOutput : superdirtOutput;
  const getTime = shouldUseWebaudio ? getAudioContextCurrentTime : getPerformanceTimeSeconds;
  const drawTime = [-2, 2];

  // Live mutable volume — read on every event, written by the volume
  // slider and the spotlight fade engine. Stays attached to the editor
  // so callers can update it without a re-render or re-evaluation.
  const volumeRef = { current: typeof initialVolume === 'number' ? initialVolume : 1 };
  // Stable analyser id per track — superdough lazily creates an
  // AnalyserNode on this id when the first hap with `analyze: <id>` plays,
  // and the audio-driven painters (waveform, spectrum) read from it.
  const analyzerId = `track-${trackId}`;
  const defaultOutput = makeTrackOutput(baseOutput, volumeRef, analyzerId);

  // Live ref for the chosen viz key — the onDraw closure reads this every
  // frame so switching viz at runtime doesn't require a re-eval or a
  // new editor instance. Also forwards to any user-set painters so
  // .scope() / .pianoroll() in the user's code still work alongside.
  const vizRef = { current: initialViz || DEFAULT_VIZ };
  const painterOpts = { trackId, analyzerId };
  const onDraw = (haps, time, painters) => {
    const ctx = drawContextRef.current;
    if (!ctx) return;
    const c = ctx.canvas;
    ctx.clearRect(0, 0, c.width, c.height);
    const vizKey = vizRef.current;
    try {
      getPainter(vizKey)(ctx, time, haps, drawTime, painterOpts);
    } catch {}
    // Per-track cycle playhead overlay (option A). Skipped for painters
    // that already convey cycle position (pianoroll) or have no
    // horizontal time axis (spiral). Practically free — reuses the
    // existing onDraw RAF and adds one line draw.
    if (!SKIP_PLAYHEAD.has(vizKey)) {
      try {
        drawCyclePlayhead(ctx, time);
      } catch {}
    }
    painters?.forEach?.((painter) => {
      try {
        painter(ctx, time, haps, drawTime);
      } catch {}
    });
  };

  const editor = new StrudelMirror({
    id: `track-${trackId}`,
    sync: isSyncEnabled,
    defaultOutput,
    getTime,
    setInterval,
    clearInterval,
    transpiler,
    autodraw: false,
    root: container,
    initialCode: initialCode ?? '',
    pattern: silence,
    drawTime,
    drawContext,
    onDraw,
    solo: false,
    prebake: async () => {
      await Promise.all([getModulesLoading(), getPresetsLoading()]);
      if (prebakeScript) {
        return evaluate(prebakeScript, { addReturn: false });
      }
    },
    onUpdateState: (state) => onUpdateState?.({ ...state }),
    onToggle: (playing) => {
      if (!playing) clearHydra();
    },
    beforeEval: () => getAudioReady(),
    afterEval: () => {
      const code = editor.code;
      if (typeof code === 'string') setTrackCode(trackId, code);
    },
    bgFill: false,
  });

  // Expose the live refs so the hook can update them at runtime.
  editor.volumeRef = volumeRef;
  editor.vizRef = vizRef;
  editor.drawContextRef = drawContextRef;
  editor.analyzerId = analyzerId;
  return editor;
}
