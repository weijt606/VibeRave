// Spotlight: gradually fade other playing tracks down to silence over a
// short window, then stop them; meanwhile keep the spotlighted track
// playing (start it if needed). Restores the muted tracks' volumes after
// they've stopped so re-playing them later starts at full volume.
//
// `getEditor(id)` returns the StrudelMirror (with `.volumeRef` attached
// by createTrackEditor). `getState(id)` returns its current replState.

let activeFade = null; // { cancelled: boolean }

export function cancelActiveFade() {
  if (activeFade) activeFade.cancelled = true;
  activeFade = null;
}

export function spotlight({ trackId, allTrackIds, getEditor, getState, durationMs = 1500 }) {
  cancelActiveFade();
  const token = { cancelled: false };
  activeFade = token;

  const target = getEditor(trackId);
  if (target) {
    // Make sure the spotlighted track is at full volume and playing.
    target.volumeRef.current = 1;
    if (!getState(trackId)?.started) {
      try {
        target.toggle();
      } catch {}
    }
  }

  // Snapshot which tracks are currently playing so we can fade just those.
  const fading = allTrackIds
    .filter((id) => id !== trackId)
    .map((id) => ({
      id,
      editor: getEditor(id),
      startVolume: getEditor(id)?.volumeRef?.current ?? 1,
      wasPlaying: !!getState(id)?.started,
    }))
    .filter((t) => t.editor && t.wasPlaying);

  if (fading.length === 0) return token;

  const t0 = performance.now();
  function frame(now) {
    if (token.cancelled) return;
    const k = Math.min(1, (now - t0) / durationMs);
    // Equal-power-ish curve: linear ramp on volume for simplicity.
    for (const t of fading) {
      t.editor.volumeRef.current = t.startVolume * (1 - k);
    }
    if (k < 1) {
      requestAnimationFrame(frame);
      return;
    }
    // Fade complete: stop the muted tracks and restore their nominal volume
    // so the next play starts at full level.
    for (const t of fading) {
      try {
        t.editor.stop?.();
      } catch {}
      t.editor.volumeRef.current = t.startVolume;
    }
    if (activeFade === token) activeFade = null;
  }
  requestAnimationFrame(frame);
  return token;
}
