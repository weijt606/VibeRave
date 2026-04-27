import { atom, computed } from 'nanostores';
import { useStore } from '@nanostores/react';
import { nanoid } from 'nanoid';
import { settingsMap } from '../../settings.mjs';
import { DEFAULT_VIZ, PAINTERS } from './painters.mjs';

const TRACKS_KEY = 'tracks';
const SELECTED_KEY = 'selectedTrackId';

const DEFAULT_CODE = '$: s("[bd <hh oh>]*2").bank("tr909").dec(.4)';

// Fill in defaults for fields added after a track was first persisted —
// keeps older saved tracks (and any LLM-stripped cases where viz came
// back null) from leaking nulls into the editor.
function normalizeTrack(t) {
  if (!t) return t;
  // Drop any viz key that no longer exists in the registry (e.g. old
  // `punchcard` / `wordfall` / `pitchwheel` saves) so the picker doesn't
  // sit on a value it can't render.
  const validViz = t.viz && PAINTERS[t.viz] ? t.viz : DEFAULT_VIZ;
  return {
    ...t,
    viz: validViz,
    volume: typeof t.volume === 'number' ? t.volume : 1,
  };
}

function readTracks() {
  const raw = settingsMap.get()[TRACKS_KEY];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeTrack) : null;
  } catch {
    return null;
  }
}

function writeTracks(list) {
  settingsMap.setKey(TRACKS_KEY, JSON.stringify(list));
}

export function createTrackId() {
  return nanoid(10);
}

export function makeTrack({ name, code, viz } = {}) {
  return {
    id: createTrackId(),
    name: name || 'Untitled track',
    code: code ?? DEFAULT_CODE,
    viz: viz || DEFAULT_VIZ,
    createdAt: Date.now(),
  };
}

export const $tracks = atom(readTracks() ?? []);

// Mirror of useTrackEditors' editorStates — written from the hook,
// subscribed by global UI (CycleBar, future indicators) that need to
// know which tracks are currently playing without drilling through
// the React tree. Shape: { [trackId]: { started, pending, ... } }.
export const $editorStates = atom({});

// Cheap derived signal: true when at least one track's scheduler is
// running. Lets the cycle indicator freeze without re-running the
// whole map check on every frame.
export const $anyPlaying = computed($editorStates, (states) =>
  Object.values(states).some((s) => s?.started),
);

settingsMap.subscribe((state, key) => {
  if (key === TRACKS_KEY) {
    const next = readTracks() ?? [];
    if (next !== $tracks.get()) $tracks.set(next);
  }
});

const sessionAtom = (name, initial) => {
  const storage = typeof sessionStorage !== 'undefined' ? sessionStorage : {};
  const store = atom(typeof storage[name] !== 'undefined' ? storage[name] : initial);
  store.listen((v) => {
    if (typeof v === 'undefined' || v === null) delete storage[name];
    else storage[name] = v;
  });
  return store;
};

export const $selectedTrackId = sessionAtom(SELECTED_KEY, null);

export const $selectedTrack = computed([$tracks, $selectedTrackId], (tracks, id) => {
  if (!id) return null;
  return tracks.find((t) => t.id === id) || null;
});

export function useTracks() {
  return useStore($tracks);
}
export function useSelectedTrackId() {
  return useStore($selectedTrackId);
}
export function useSelectedTrack() {
  return useStore($selectedTrack);
}

export function selectTrack(id) {
  $selectedTrackId.set(id || null);
}

export function ensureInitialTrack(seedCode) {
  const list = $tracks.get();
  if (list.length > 0) return list[0];
  const t = makeTrack({ name: 'Track 1', code: seedCode || DEFAULT_CODE });
  writeTracks([t]);
  $tracks.set([t]);
  return t;
}

export function addTrack(partial = {}) {
  const list = $tracks.get();
  const idx = list.length + 1;
  const t = makeTrack({ name: partial.name || `Track ${idx}`, code: partial.code });
  // Prepend: new tracks land right under the "+ New track" button at
  // the top of the column so the user sees what they just created
  // without having to scroll past existing tracks.
  const next = [t, ...list];
  writeTracks(next);
  $tracks.set(next);
  return t;
}

export function deleteTrack(id) {
  const list = $tracks.get();
  const next = list.filter((t) => t.id !== id);
  writeTracks(next);
  $tracks.set(next);
  if ($selectedTrackId.get() === id) {
    $selectedTrackId.set(next[0]?.id || null);
  }
}

export function updateTrack(id, patch) {
  const list = $tracks.get();
  let changed = false;
  const next = list.map((t) => {
    if (t.id !== id) return t;
    const merged = { ...t, ...patch };
    // Detect a real change across any field in the patch — important so
    // viz / volume / future settings aren't silently dropped.
    const anyDiff = Object.keys(patch).some((k) => merged[k] !== t[k]);
    if (!anyDiff) return t;
    changed = true;
    return merged;
  });
  if (!changed) return;
  writeTracks(next);
  $tracks.set(next);
}

export function setTrackCode(id, code) {
  updateTrack(id, { code });
}

export function renameTrack(id, name) {
  updateTrack(id, { name });
}

export function setTrackViz(id, viz) {
  updateTrack(id, { viz });
}

export function getTrack(id) {
  return $tracks.get().find((t) => t.id === id) || null;
}

