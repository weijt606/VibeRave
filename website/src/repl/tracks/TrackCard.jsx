import { useCallback } from 'react';
import { TrackHeader } from './TrackHeader.jsx';
import { TrackVisualizer } from './TrackVisualizer.jsx';

export function TrackCard({
  track,
  isSelected,
  state,
  onSelect,
  onTogglePlay,
  onSpotlight,
  onVizChange,
  onRename,
  onDelete,
  mountTrack,
}) {
  // The visualizer canvas is the only mount point now — the editor's
  // CodeMirror root lives in a detached <div> owned by useTrackEditors,
  // grafted into the bottom CodePanel when this track is selected.
  const onCanvas = useCallback(
    (_canvas, ctx) => {
      mountTrack(track.id, ctx);
    },
    [track.id, mountTrack],
  );

  return (
    <div className="flex flex-col">
      <TrackHeader
        trackId={track.id}
        name={track.name}
        isSelected={isSelected}
        isPlaying={!!state?.started}
        pending={!!state?.pending}
        onSelect={() => onSelect(track.id)}
        onTogglePlay={() => onTogglePlay(track.id)}
        onSpotlight={() => onSpotlight(track.id)}
        onRename={(name) => onRename(track.id, name)}
        onDelete={() => onDelete(track.id)}
      />
      <TrackVisualizer
        trackId={track.id}
        onCanvas={onCanvas}
        viz={track.viz}
        onVizChange={(v) => onVizChange(track.id, v)}
      />
    </div>
  );
}
