import { PlusIcon, StopIcon, TrashIcon } from '@heroicons/react/16/solid';
import { TrackCard } from './TrackCard.jsx';
import { CodePanel } from './CodePanel.jsx';

export function TracksColumn({ context }) {
  const {
    tracks,
    selectedTrackId,
    selectTrack,
    addTrack,
    deleteTrack,
    clearAllTracks,
    renameTrack,
    togglePlayTrack,
    spotlightTrack,
    stopAllTracks,
    setTrackViz,
    mountTrack,
    getTrackState,
  } = context;

  // Click a header to expand it. Click the already-expanded one to collapse.
  const onSelect = (id) => selectTrack(selectedTrackId === id ? null : id);

  // Confirm before wiping — track deletion can't be undone (no soft-delete
  // or trash bin). A native confirm() is enough; this is rare-but-final.
  const onClearAll = () => {
    if (!tracks.length) return;
    const msg =
      tracks.length === 1
        ? 'Delete this track? This cannot be undone.'
        : `Delete all ${tracks.length} tracks? This cannot be undone.`;
    if (window.confirm(msg)) clearAllTracks?.();
  };

  return (
    <div className="flex flex-col grow bg-background min-h-0 min-w-0">
      <div className="shrink-0 flex items-stretch border-b border-muted">
        <button
          type="button"
          onClick={addTrack}
          title="Add a new track"
          className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-foreground opacity-70 hover:opacity-100 hover:bg-lineHighlight"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New track</span>
        </button>
        <button
          type="button"
          onClick={stopAllTracks}
          title="Stop every track (panic)"
          className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-red-400 opacity-80 hover:opacity-100 hover:bg-red-500/10 border-l border-muted"
        >
          <StopIcon className="w-4 h-4" />
          <span>Stop all</span>
        </button>
        <button
          type="button"
          onClick={onClearAll}
          disabled={!tracks.length}
          title="Delete every track (asks for confirmation)"
          className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-red-400 opacity-80 hover:opacity-100 hover:bg-red-500/10 border-l border-muted disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          <TrashIcon className="w-4 h-4" />
          <span>Clear all</span>
        </button>
      </div>
      <div className="flex flex-col grow overflow-auto min-h-0">
        {tracks.length === 0 && (
          <div className="px-4 py-6 text-sm opacity-60">
            No tracks yet — add one to start.
          </div>
        )}
        {tracks.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            state={getTrackState(track.id)}
            isSelected={track.id === selectedTrackId}
            onSelect={onSelect}
            onTogglePlay={togglePlayTrack}
            onSpotlight={spotlightTrack}
            onVizChange={setTrackViz}
            onRename={renameTrack}
            onDelete={deleteTrack}
            mountTrack={mountTrack}
          />
        ))}
      </div>
      <CodePanel context={context} />
    </div>
  );
}
