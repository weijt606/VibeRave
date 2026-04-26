// Dispatch host-control commands the LLM detected — see
// services/api/src/skills/strudel/rules/meta-commands.md for the
// vocabulary and services/api/src/application/generate-strudel.mjs for
// the parser. The backend hands the client a `{ action, ... }` object;
// this module turns that into actual track-list / transport calls.
//
// Track controls live in useTrackEditors and are exposed on
// `window.strudelTracks` so non-React code can reach them without
// prop-drilling. Track CRUD comes from the nanostores tracksStore
// directly because it has no editor-instance dependency.
import { addTrack, selectTrack, $selectedTrackId } from '../../../tracks/tracksStore.mjs';

// How long to keep polling for the new track's editor before giving
// up. Editor mounting is driven by the TracksColumn re-rendering and
// the TrackVisualizer canvas mounting — usually one or two animation
// frames. A 3s ceiling is generous and avoids hanging on a stuck DOM.
const EDITOR_READY_TIMEOUT_MS = 3000;

// Wait for the editor for `trackId` to become the live one
// (window.strudelMirror === editor for that id) before invoking `fn`
// with the editor. Used by `new_track + code` so the seed code can be
// evaluated on the *new* track, not whatever was selected before.
function whenEditorReady(trackId, fn) {
  if (typeof window === 'undefined') return;
  const deadline = Date.now() + EDITOR_READY_TIMEOUT_MS;
  function check() {
    const ed = window.strudelMirror;
    if (ed && $selectedTrackId.get() === trackId) {
      fn(ed);
      return;
    }
    if (Date.now() > deadline) return;
    requestAnimationFrame(check);
  }
  requestAnimationFrame(check);
}

// Single pending stop timer, intentionally module-scoped so a fresh
// schedule_stop replaces (not stacks onto) the prior one. The user
// confirmed this override semantics — saying "stop in 20s" after "stop
// in 10s" should leave one timer firing at +20s, not two.
let pendingStopTimer = null;

function clearPendingStop() {
  if (pendingStopTimer) {
    clearTimeout(pendingStopTimer);
    pendingStopTimer = null;
  }
}

function getControls() {
  return typeof window !== 'undefined' ? window.strudelTracks : null;
}

// Run the meta action and return a short human-readable description for
// the chat-feedback bubble. The optional `seedCode` is applied for the
// `new_track` action — it lets the LLM bundle "open a track + here is
// what it should sound like" into a single round-trip. Returns null if
// the action is unknown or can't be applied (no selected track for
// transport, etc.) — the caller shows "(unrecognized command)" in that
// case.
export function dispatchMetaCommand(meta, { seedCode } = {}) {
  if (!meta || typeof meta !== 'object') return null;
  const ctrl = getControls();
  switch (meta.action) {
    case 'new_track': {
      // Seed the new track with the optional code body so the editor
      // initializes with it the moment its canvas mounts. Without this,
      // the editor would init with DEFAULT_CODE first and then we'd
      // have to swap the code in afterward — which both flickers and
      // races against the play/evaluate call below.
      const t = addTrack(seedCode ? { code: seedCode } : {});
      selectTrack(t.id);
      if (seedCode) {
        // Evaluate on the new track once its editor is live so the
        // seeded pattern actually starts playing — without this the
        // user would see the code but hear nothing until they hit
        // play. A best-effort evaluate; mirrors the existing vibe
        // hot-swap path.
        whenEditorReady(t.id, async (ed) => {
          try {
            await ed.evaluate(true);
          } catch {
            /* runtime errors surface via the logger; not our concern here */
          }
        });
        return `+ new track (${t.name}) with seed code`;
      }
      return `+ new track (${t.name})`;
    }
    case 'play': {
      const id = $selectedTrackId.get();
      if (!id || !ctrl) return null;
      if (!ctrl.isStarted(id)) ctrl.togglePlay(id);
      return '▶ play';
    }
    case 'pause': {
      const id = $selectedTrackId.get();
      if (!id || !ctrl) return null;
      if (ctrl.isStarted(id)) ctrl.togglePlay(id);
      return '⏸ pause';
    }
    case 'stop': {
      const id = $selectedTrackId.get();
      if (!id || !ctrl) return null;
      ctrl.stopTrack(id);
      return '■ stop';
    }
    case 'stop_all': {
      if (!ctrl) return null;
      clearPendingStop();
      ctrl.stopAllTracks();
      return '■ stop all';
    }
    case 'schedule_stop': {
      const id = $selectedTrackId.get();
      if (!id || !ctrl) return null;
      const delayMs = Number(meta.delayMs);
      if (!Number.isFinite(delayMs) || delayMs < 0) return null;
      clearPendingStop();
      pendingStopTimer = setTimeout(() => {
        pendingStopTimer = null;
        const live = getControls();
        live?.stopTrack($selectedTrackId.get());
      }, delayMs);
      const seconds = Math.round(delayMs / 100) / 10;
      return `⏱ stop in ${seconds}s`;
    }
    default:
      return null;
  }
}

// Exposed for tests and for callers that want to cancel a pending
// schedule_stop (e.g. the user explicitly hits "stop all" before the
// timer fires — `dispatchMetaCommand` already does this for stop_all).
export function cancelPendingMeta() {
  clearPendingStop();
}
