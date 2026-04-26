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
    // ALWAYS route this track's audio into its own per-track AnalyserNode.
    // The previous "only set if not already set" guard meant any pattern
    // that the LLM wrote with `.scope()` / `.pianoroll()` (which sticks
    // analyze: 1 on every hap via Strudel's `.analyze` control) would
    // register the audio under analysers[1] and starve our per-track
    // painter — making the per-track viz lane look broken (just the idle
    // dashed baseline). Overriding here is safe: our scoped painter
    // takes priority, the global #test-canvas where .scope() would have
    // drawn is hidden anyway, and the user's intended viz is the
    // per-track painter selected via the dropdown.
    if (analyzerId) v.analyze = analyzerId;
    try {
      return baseOutput(hap, deadline, hapDuration, cps, t);
    } finally {
      // Restore so the same hap object isn't permanently mutated if the
      // scheduler reuses it elsewhere.
      v.gain = originalGain;
      if (originalAnalyze === undefined) delete v.analyze;
      else v.analyze = originalAnalyze;
    }
  };
}
