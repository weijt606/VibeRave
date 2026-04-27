import { useEffect, useRef, useState } from 'react';
import { PlayIcon, StopIcon, TrashIcon, BoltIcon } from '@heroicons/react/16/solid';
import cx from '@src/cx.mjs';

export function TrackHeader({
  name,
  isSelected,
  isPlaying,
  pending,
  onSelect,
  onTogglePlay,
  onSpotlight,
  onRename,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) onRename?.(next);
    else setDraft(name);
  }

  // When selected, the row goes full hazard-tape: bright yellow background +
  // pure black text/icons. Loud on purpose so the active track is unmissable
  // at a glance during a live set.
  const textCx = isSelected ? 'text-black' : 'text-foreground';

  return (
    <div
      className={cx(
        'flex items-center gap-2 px-3 py-2 cursor-pointer select-none border-b border-muted',
        isSelected ? 'bg-yellow-400 text-black' : 'hover:bg-lineHighlight/40',
      )}
      onClick={onSelect}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay?.();
        }}
        title={isPlaying ? 'stop' : 'play'}
        className={cx('shrink-0 p-1 rounded hover:opacity-70', textCx)}
      >
        {isPlaying ? <StopIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onSpotlight?.();
        }}
        title="Cut to this track (fade out the rest)"
        className={cx('shrink-0 p-1 rounded hover:opacity-70 opacity-70 hover:opacity-100', textCx)}
      >
        <BoltIcon className="w-4 h-4" />
      </button>

      <div
        className={cx(
          'shrink-0 w-1.5 h-1.5 rounded-full',
          isPlaying
            ? 'bg-[var(--vr-accent-cyan)] animate-pulse shadow-[0_0_6px_var(--vr-accent-cyan)]'
            : pending
              ? 'bg-[var(--vr-accent-magenta)] animate-pulse shadow-[0_0_5px_var(--vr-accent-magenta)]'
              : isSelected
                ? 'bg-black/40'
                : 'bg-muted',
        )}
        aria-hidden
      />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') {
              setEditing(false);
              setDraft(name);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-background border border-muted rounded px-1 text-sm text-foreground"
        />
      ) : (
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={cx('min-w-0 truncate text-sm font-medium', textCx)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            title="Double-click to rename"
          >
            {name}
          </span>
          {isSelected && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-black text-yellow-400 font-bold">
              Active
            </span>
          )}
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Delete "${name}"?`)) onDelete?.();
        }}
        title="delete track"
        className={cx('shrink-0 p-1 rounded hover:opacity-70 opacity-50 hover:opacity-100', textCx)}
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
