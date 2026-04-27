import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { defaultSettings } from '@strudel/codemirror';
import { settingsMap, useSettings } from '../../settings.mjs';
import { createTrackEditor } from './createTrackEditor.mjs';
import {
  $tracks,
  $selectedTrackId,
  $editorStates,
  ensureInitialTrack,
  selectTrack,
  setTrackViz,
} from './tracksStore.mjs';
import { DEFAULT_VIZ, disposeAnalyzerArtifacts } from './painters.mjs';
import { setLatestCode } from '../../user_pattern_utils.mjs';
import { spotlight as runSpotlight } from './spotlight.mjs';

const EMPTY_STATE = { started: false, isDirty: false, error: null, activeCode: '', pending: false };

export function useTrackEditors() {
  const { audioEngineTarget, prebakeScript } = useSettings();
  // VibeRave is multi-track by design — every track MUST share the global
  // cycle clock or beats drift apart immediately. We hard-code sync on
  // here regardless of the user's `isSyncEnabled` setting so a stale
  // localStorage value from before this change can't break the rhythm.
  const isSyncEnabled = true;
  const editorsRef = useRef({}); // { [trackId]: StrudelMirror }
  const [editorStates, setEditorStates] = useState({}); // { [trackId]: replState }

  const tracks = useStore($tracks);
  const selectedTrackId = useStore($selectedTrackId);

  // On first mount, make sure there is at least one track. We deliberately
  // do NOT auto-select it — the default state is "all collapsed", so users
  // see the track list, not a code editor. They click a header to expand.
  useEffect(() => {
    const seedCode = settingsMap.get().latestCode || undefined;
    ensureInitialTrack(seedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push codemirror display settings into every live editor when they change
  const _settings = useStore(settingsMap, { keys: Object.keys(defaultSettings) });
  useEffect(() => {
    const editorSettings = {};
    Object.keys(defaultSettings).forEach((key) => {
      editorSettings[key] = _settings[key];
    });
    // Hard-override line wrapping ON — same pattern as isSyncEnabled above.
    // Long method-chain patterns are the norm in Strudel and a horizontal
    // scrollbar interrupts the live-coding flow. We do this here (not by
    // changing the default) so users with an existing localStorage that
    // pinned isLineWrappingEnabled=false don't keep getting horizontal
    // overflow after upgrade.
    editorSettings.isLineWrappingEnabled = true;
    Object.values(editorsRef.current).forEach((ed) => ed?.updateSettings(editorSettings));
  }, [_settings]);

  // Keep window.strudelMirror pointing at the currently selected track so
  // legacy debug helpers (audiograph, etc.) keep working.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ed = editorsRef.current[selectedTrackId];
    if (ed) window.strudelMirror = ed;
  }, [selectedTrackId, editorStates]);

  // Expose a stable controls handle for non-React callers (the vibe
  // meta-command dispatcher). The function bodies close over the live
  // refs so even though this object is set once, the calls always hit
  // the current editors / state. We intentionally do NOT overwrite this
  // on every render — installing on mount and clearing on unmount keeps
  // listeners that grabbed the reference from going stale.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.strudelTracks = {
      togglePlay: (trackId) => editorsRef.current[trackId]?.toggle(),
      stopTrack: (trackId) => editorsRef.current[trackId]?.stop(),
      stopAllTracks: () => {
        Object.values(editorsRef.current).forEach((ed) => {
          try { ed?.stop?.(); } catch {}
        });
      },
      // Pulled from the latest closure, so callers see fresh state even
      // though this controls object is installed once.
      isStarted: (trackId) => !!editorsRef.current[trackId]?.repl?.scheduler?.started,
    };
    return () => {
      if (window.strudelTracks) delete window.strudelTracks;
    };
  }, []);

  // Mirror local editorStates into the global atom so non-React consumers
  // (CycleBar, etc.) can subscribe without prop drilling. Cheap — runs only
  // when state actually flips (started/pending/...), not per audio frame.
  useEffect(() => {
    $editorStates.set(editorStates);
  }, [editorStates]);

  // Push live viz changes from the store into each editor's vizRef so
  // switching is instant — the next animation frame paints with the new
  // painter, no editor rebuild needed.
  useEffect(() => {
    for (const t of tracks) {
      const ed = editorsRef.current[t.id];
      if (ed?.vizRef) ed.vizRef.current = t.viz || DEFAULT_VIZ;
    }
  }, [tracks]);

  // When the user deletes a track, dispose its editor.
  useEffect(() => {
    const liveIds = new Set(tracks.map((t) => t.id));
    Object.keys(editorsRef.current).forEach((id) => {
      if (!liveIds.has(id)) {
        const ed = editorsRef.current[id];
        try {
          ed?.stop?.();
        } catch {}
        if (ed?.analyzerId) disposeAnalyzerArtifacts(ed.analyzerId);
        delete editorsRef.current[id];
        setEditorStates((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  }, [tracks]);

  // Called from each TrackCard's TrackVisualizer once the canvas is mounted.
  // Idempotent: only the first call for a given trackId actually constructs
  // a StrudelMirror — later calls just hot-swap the draw ctx so a remounted
  // canvas (HMR, viz layout change) keeps painting.
  //
  // The editor's CodeMirror root is a detached <div> we create here. The
  // bottom CodePanel grafts whichever root belongs to the selected track
  // into its host, so the editor instance (cursor, history, scheduler)
  // persists when selection changes — only its DOM parent moves.
  const mountTrack = useCallback(
    (trackId, drawContext) => {
      const existing = editorsRef.current[trackId];
      if (existing) {
        if (existing.drawContextRef && drawContext) {
          existing.drawContextRef.current = drawContext;
        }
        return;
      }
      const track = $tracks.get().find((t) => t.id === trackId);
      const root = document.createElement('div');
      root.className = 'code-container text-gray-100 cursor-text overflow-auto h-full';
      const editor = createTrackEditor({
        trackId,
        container: root,
        drawContext,
        initialCode: track?.code ?? '',
        initialViz: track?.viz || DEFAULT_VIZ,
        isSyncEnabled,
        audioEngineTarget,
        prebakeScript,
        onUpdateState: (state) => {
          setEditorStates((prev) => ({ ...prev, [trackId]: state }));
          if (typeof state.code === 'string' && trackId === $selectedTrackId.get()) {
            setLatestCode(state.code);
          }
        },
      });
      editor.setCode(track?.code ?? '');
      editor.editorRoot = root;
      editorsRef.current[trackId] = editor;
      if (typeof window !== 'undefined' && trackId === $selectedTrackId.get()) {
        window.strudelMirror = editor;
      }
    },
    [isSyncEnabled, audioEngineTarget, prebakeScript],
  );

  const getEditor = useCallback((trackId) => editorsRef.current[trackId] || null, []);
  const getEditorRoot = useCallback(
    (trackId) => editorsRef.current[trackId]?.editorRoot || null,
    [],
  );
  const getState = useCallback((trackId) => editorStates[trackId] || EMPTY_STATE, [editorStates]);

  const togglePlay = useCallback((trackId) => {
    editorsRef.current[trackId]?.toggle();
  }, []);
  const stopTrack = useCallback((trackId) => {
    editorsRef.current[trackId]?.stop();
  }, []);
  // Panic stop: kills every editor's scheduler. Used by the global Stop
  // button so a runaway live set can be silenced in one click without
  // hunting down each track header.
  const stopAllTracks = useCallback(() => {
    Object.values(editorsRef.current).forEach((ed) => {
      try {
        ed?.stop?.();
      } catch {}
    });
  }, []);
  const evaluateTrack = useCallback((trackId) => {
    editorsRef.current[trackId]?.evaluate();
  }, []);
  const setCodeFor = useCallback((trackId, code) => {
    const ed = editorsRef.current[trackId];
    if (!ed) return;
    ed.setCode(code);
  }, []);

  const spotlight = useCallback(
    (trackId, durationMs) => {
      runSpotlight({
        trackId,
        allTrackIds: $tracks.get().map((t) => t.id),
        getEditor,
        getState,
        durationMs,
      });
    },
    [getEditor, getState],
  );

  return {
    tracks,
    selectedTrackId,
    editorStates,
    mountTrack,
    getEditor,
    getEditorRoot,
    getState,
    togglePlay,
    stopTrack,
    stopAllTracks,
    evaluateTrack,
    setCodeFor,
    spotlight,
  };
}
