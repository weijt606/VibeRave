/*
useReplContext.jsx — coordinates the multi-track REPL.

Each track has its own StrudelMirror instance (managed by useTrackEditors).
The "selected" track is what the right-side Vibe panel and the header
play/update buttons act on; other tracks keep playing independently.
*/

import { logger } from '@strudel/core';
import { resetGlobalEffects, resetLoadedSounds, resetDefaults, initAudio } from '@strudel/webaudio';
import { renderPatternAudio } from '@strudel/webaudio';
import { clearHydra } from '@strudel/hydra';
import { useCallback } from 'react';
import { settingsMap } from '../settings.mjs';
import { setLatestCode } from '../user_pattern_utils.mjs';
import { prebake } from './prebake.mjs';
import { getRandomTune, shareCode } from './util.mjs';
import './Repl.css';
import { debugAudiograph } from './audiograph';
import { useTrackEditors } from './tracks/useTrackEditors.jsx';
import {
  $tracks,
  selectTrack,
  addTrack as addTrackToStore,
  deleteTrack as deleteTrackFromStore,
  clearAllTracks as clearAllTracksFromStore,
  renameTrack as renameTrackInStore,
  setTrackCode,
  setTrackViz as setTrackVizInStore,
} from './tracks/tracksStore.mjs';
import { getModule } from './tracks/strudelGlobalInit.mjs';

if (typeof window !== 'undefined') {
  window.debugAudiograph = debugAudiograph;
}

export function useReplContext() {
  const editors = useTrackEditors();
  const { selectedTrackId, getState, getEditor } = editors;
  const selectedState = getState(selectedTrackId);
  const { started, isDirty, error, activeCode, pending } = selectedState;

  // Selected-track handlers — these are what the header buttons call.
  const handleTogglePlay = useCallback(() => {
    if (!selectedTrackId) return;
    editors.togglePlay(selectedTrackId);
  }, [editors, selectedTrackId]);

  const handleEvaluate = useCallback(() => {
    if (!selectedTrackId) return;
    editors.evaluateTrack(selectedTrackId);
  }, [editors, selectedTrackId]);

  const resetEditor = useCallback(async () => {
    (await getModule('@strudel/tonal'))?.resetVoicings();
    resetDefaults();
    resetGlobalEffects();
    clearHydra();
    resetLoadedSounds();
    const ed = getEditor(selectedTrackId);
    ed?.repl?.setCps?.(0.5);
    await prebake();
  }, [getEditor, selectedTrackId]);

  // Update the *selected* track's code — used by Vibe hot-swap and the
  // legacy "load pattern" flow.
  const handleUpdate = useCallback(
    async (patternData, reset = false) => {
      if (!selectedTrackId || !patternData?.code) return;
      setTrackCode(selectedTrackId, patternData.code);
      editors.setCodeFor(selectedTrackId, patternData.code);
      if (reset) {
        await resetEditor();
        editors.evaluateTrack(selectedTrackId);
      }
    },
    [editors, selectedTrackId, resetEditor],
  );

  const handleExport = useCallback(
    async (begin, end, sampleRate, maxPolyphony, multiChannelOrbits, downloadName = undefined) => {
      const ed = getEditor(selectedTrackId);
      if (!ed) return;
      await ed.evaluate(false);
      ed.repl.scheduler.stop();
      await renderPatternAudio(
        ed.repl.state.pattern,
        ed.repl.scheduler.cps,
        begin,
        end,
        sampleRate,
        maxPolyphony,
        multiChannelOrbits,
        downloadName,
      ).finally(async () => {
        const { latestCode, maxPolyphony, audioDeviceName, multiChannelOrbits } = settingsMap.get();
        await initAudio({ latestCode, maxPolyphony, audioDeviceName, multiChannelOrbits });
        ed.repl.scheduler.stop();
      });
    },
    [getEditor, selectedTrackId],
  );

  const handleShuffle = useCallback(async () => {
    if (!selectedTrackId) return;
    const patternData = await getRandomTune();
    logger(`[repl] ✨ loading random tune "${patternData.id}"`);
    setTrackCode(selectedTrackId, patternData.code);
    await resetEditor();
    editors.setCodeFor(selectedTrackId, patternData.code);
    editors.evaluateTrack(selectedTrackId);
  }, [editors, selectedTrackId, resetEditor]);

  const handleShare = useCallback(async () => {
    setLatestCode(selectedState.code || '');
    shareCode(selectedState.code || '');
  }, [selectedState.code]);

  // Track lifecycle handlers exposed to the UI.
  const addTrack = useCallback(() => {
    const t = addTrackToStore();
    selectTrack(t.id);
    return t;
  }, []);

  // Single-source disposal: just remove from the store, useTrackEditors
  // reacts and runs the full fade → stop → clear → dispose flow. Don't
  // ed.stop() here too — the duplicate call previously could fire while
  // the disposal useEffect was already mid-flight.
  const deleteTrack = useCallback((id) => {
    deleteTrackFromStore(id);
  }, []);

  // "Clear all" — atomic store wipe. The deletion useEffect picks up the
  // empty list and disposes every editor in one React batch. UI must
  // confirm before calling — see TracksColumn's button.
  const clearAllTracks = useCallback(() => {
    clearAllTracksFromStore();
  }, []);

  return {
    // selected-track shortcuts (legacy contract for header buttons)
    started,
    pending,
    isDirty,
    activeCode,
    error,
    handleTogglePlay,
    handleEvaluate,
    handleUpdate,
    handleShuffle,
    handleShare,
    handleExport,
    // multi-track surface
    tracks: editors.tracks,
    selectedTrackId,
    selectTrack,
    addTrack,
    deleteTrack,
    clearAllTracks,
    renameTrack: renameTrackInStore,
    setTrackViz: setTrackVizInStore,
    mountTrack: editors.mountTrack,
    getEditorRoot: editors.getEditorRoot,
    togglePlayTrack: editors.togglePlay,
    stopTrack: editors.stopTrack,
    stopAllTracks: editors.stopAllTracks,
    evaluateTrack: editors.evaluateTrack,
    getTrackState: editors.getState,
    spotlightTrack: editors.spotlight,
    // back-compat shims so things that referenced editorRef/containerRef
    // don't crash. Code.jsx is no longer used; ReplEditor reads these but
    // the new TracksColumn doesn't need them.
    editorRef: { current: getEditor(selectedTrackId) },
    containerRef: { current: null },
    init: () => {},
  };
}

// keep $tracks reachable from the dev console for debugging
if (typeof window !== 'undefined') {
  window.$tracks = $tracks;
}
