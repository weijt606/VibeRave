import { useEffect, useRef, useState } from 'react';
import { PlayIcon, StopIcon, TrashIcon, BoltIcon } from '@heroicons/react/16/solid';
import { analysers } from '@strudel/webaudio';
import cx from '@src/cx.mjs';

// Tiny RMS level meter pinned to the track header. Reads from the
// per-track AnalyserNode that trackVolume.mjs registers under
// `track-${trackId}` whenever a hap with `analyze: <id>` plays. While
// idle (track stopped, or never played a hap with that analyze tag),
// the meter sits at 0% width — no canvas, no DOM thrash.
//
// We update via requestAnimationFrame and write directly to inline
// `style.width` so React stays out of the per-frame loop. CSS
// `transition: width` smooths the ~50ms RAF jitter into a fluid bar
// without us having to maintain a peak-decay state machine.
function TrackLevelMeter({ analyzerId, isPlaying }) {
  const fillRef = useRef(null);

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    if (!isPlaying || !analyzerId) {
      fill.style.width = '0%';
      return;
    }
    let raf = 0;
    let buf = null;
    const tick = () => {
      const an = analysers[analyzerId];
      if (an && fill) {
        if (!buf || buf.length !== an.fftSize) buf = new Float32Array(an.fftSize);
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        // RMS → width. Music sits around 0.05–0.25 RMS; ×260 gives
        // a comfortable mapping where a normal mix peaks ~80% and only
        // very loud transients hit 100%. Clamped so a clip can't
        // stretch the bar beyond its container.
        const pct = Math.min(100, rms * 260);
        fill.style.width = `${pct}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, analyzerId]);

  return (
    <div
      className="shrink-0 w-[60px] h-[4px] rounded overflow-hidden bg-foreground/10"
      aria-hidden
    >
      <div
        ref={fillRef}
        className="h-full"
        style={{
          width: '0%',
          // Use the *deep* variant of the brand cyan (≈ cyan-700) at full
          // alpha. The neon cyan-400 was correct hue but too bright for a
          // small, peripheral element — translucent neon still reads as
          // "look at me!" The deep tone keeps the brand identity but sits
          // back in the visual hierarchy.
          backgroundColor: 'var(--vr-accent-cyan-deep)',
          transition: 'width 0.05s linear',
        }}
      />
    </div>
  );
}

export function TrackHeader({
  trackId,
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
        // Unselected headers use a literal-white overlay (theme-agnostic).
        // `bg-foreground/N` doesn't compose into an alpha value when
        // `foreground` is wired to `var(--foreground)` in tailwind config,
        // so on dark themes the bg silently rendered invisible. White at
        // 8% alpha shows up on any dark theme and is invisible on light
        // (where the row contrast comes from the bg itself).
        'flex items-center gap-2 px-3 py-2 cursor-pointer select-none border-b border-muted',
        isSelected
          ? 'bg-yellow-400 text-black'
          : 'bg-white/[0.08] hover:bg-white/[0.14]',
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

      <TrackLevelMeter
        analyzerId={trackId ? `track-${trackId}` : null}
        isPlaying={isPlaying}
      />

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
