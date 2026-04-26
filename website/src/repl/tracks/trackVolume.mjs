// Per-track output wrapper. Multiplies each event's `gain` by a live ref
// (so the volume slider + spotlight fade engine can mutate the value
// without re-evaluating the pattern) and tags every hap with an
// `analyze` control so superdough routes that track's signal into a
// dedicated AnalyserNode (read by the per-track spectrum / scope viz).
//
// hap.ensureObjectValue() is called inside webaudioOutput (via hap2value),
// so we touch hap.value directly here as well.

export function makeTrackOutput(baseOutput, volumeRef, analyzerId) {
  return (hap, deadline, hapDuration, cps, t) => {
    if (!hap?.value) hap.ensureObjectValue?.();
    const v = hap.value || (hap.value = {});
    const originalGain = typeof v.gain === 'number' ? v.gain : 1;
    const originalAnalyze = v.analyze;
    v.gain = originalGain * volumeRef.current;
    if (analyzerId && originalAnalyze == null) v.analyze = analyzerId;
    try {
      return baseOutput(hap, deadline, hapDuration, cps, t);
    } finally {
      // Restore so the same hap object isn't permanently mutated if the
      // scheduler reuses it elsewhere.
      v.gain = originalGain;
      if (analyzerId && originalAnalyze == null) delete v.analyze;
      else if (originalAnalyze !== undefined) v.analyze = originalAnalyze;
    }
  };
}
