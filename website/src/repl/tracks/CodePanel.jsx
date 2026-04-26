import { useEffect, useRef, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CodeBracketIcon,
  PlayIcon,
} from '@heroicons/react/16/solid';
import cx from '@src/cx.mjs';

// Fixed bottom-spanning collapsible window that hosts the selected
// track's CodeMirror editor. Editors live in detached <div>s owned by
// useTrackEditors; we graft whichever one belongs to the selected track
// into our host on expand / selection change. Default collapsed so the
// stage is uncluttered until the user wants to read or hand-edit code.
export function CodePanel({ context }) {
  const { selectedTrackId, tracks, getEditorRoot, handleEvaluate } = context;
  const [expanded, setExpanded] = useState(false);
  const hostRef = useRef(null);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) || null;

  useEffect(() => {
    if (!expanded) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    if (!selectedTrackId) {
      host.replaceChildren();
      return undefined;
    }
    // The editor for a freshly created track may not exist yet — its
    // canvas mounts on the next tick. Poll a few frames before giving up
    // so a "create + immediately expand" sequence still ends up grafted.
    let frame;
    const attempt = (n = 0) => {
      const root = getEditorRoot(selectedTrackId);
      if (root) {
        if (root.parentNode !== host) host.replaceChildren(root);
        return;
      }
      if (n < 12) frame = requestAnimationFrame(() => attempt(n + 1));
    };
    attempt();
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [expanded, selectedTrackId, getEditorRoot, tracks]);

  return (
    <div
      className={cx(
        'shrink-0 flex flex-col min-w-0',
        'bg-background/95 border-t border-muted shadow-[0_-2px_8px_rgba(0,0,0,0.25)]',
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? 'Collapse code editor' : 'Expand code editor'}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-wide text-foreground/70 hover:text-foreground hover:bg-foreground/5"
        >
          <CodeBracketIcon className="w-4 h-4" />
          <span className="flex-1 text-left truncate">
            Code{selectedTrack ? ` · ${selectedTrack.name}` : ''}
          </span>
          {expanded ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronUpIcon className="w-4 h-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleEvaluate?.()}
          disabled={!selectedTrackId}
          title="Apply changes (re-evaluate the current code)"
          className={cx(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wide font-medium border-l border-muted',
            'bg-yellow-400 text-black hover:bg-yellow-300',
            'disabled:bg-foreground/10 disabled:text-foreground/40 disabled:cursor-not-allowed',
          )}
        >
          <PlayIcon className="w-3.5 h-3.5" />
          Apply
        </button>
      </div>
      <div
        className={cx(
          'overflow-hidden transition-[max-height] duration-150',
          expanded ? 'max-h-[50vh]' : 'max-h-0',
        )}
      >
        {selectedTrackId ? (
          <div ref={hostRef} className="h-[50vh] w-full overflow-auto" />
        ) : (
          <div className="px-3 py-6 text-xs opacity-60">
            No track selected — pick one to see its code here.
          </div>
        )}
      </div>
    </div>
  );
}
