// Pretty labels for the meta-command chip. Falls back to the action
// name if a new action is added on the backend before this map is
// updated — keeps the UI from showing a literal `META: {"action":...}`.
const META_LABELS = {
  new_track: '+ new track',
  play: '▶ play',
  pause: '⏸ pause',
  stop: '■ stop',
  stop_all: '■ stop all',
};

function renderMetaLabel(meta) {
  if (!meta || typeof meta !== 'object') return '· host action';
  if (meta.action === 'schedule_stop') {
    const seconds = Math.round(Number(meta.delayMs || 0) / 100) / 10;
    return `⏱ stop in ${seconds}s`;
  }
  return META_LABELS[meta.action] || `· ${meta.action}`;
}

export function Message({ msg, onReuse }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-md bg-foreground text-background text-sm whitespace-pre-wrap break-words">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.meta) {
    // For new_track + seed code we render the chip and the code body
    // together, with the same Re-run/Copy affordances as a normal code
    // turn. The Re-run button replays the seed onto whatever track is
    // currently selected — useful if the user navigated away and wants
    // to drop the seeded pattern somewhere else.
    return (
      <div className="flex justify-start">
        <div className="max-w-[95%] w-full space-y-2">
          <div className="px-3 py-1 rounded-full border border-foreground/40 bg-foreground/10 text-foreground text-xs font-mono inline-block">
            {renderMetaLabel(msg.meta)}
          </div>
          {typeof msg.code === 'string' && msg.code && (
            <div className="border border-muted rounded-md p-2 space-y-2">
              <pre className="text-xs whitespace-pre-wrap break-words text-foreground">{msg.code}</pre>
              <div className="flex gap-2">
                <button
                  onClick={() => onReuse(msg.code)}
                  className="px-2 py-0.5 rounded border border-muted text-xs hover:opacity-80"
                >
                  ▶ Re-run
                </button>
                <button
                  onClick={() => navigator.clipboard?.writeText(msg.code)}
                  className="px-2 py-0.5 rounded border border-muted text-xs hover:opacity-80"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (msg.noChange) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-md border border-dashed border-muted text-sm italic opacity-70 whitespace-pre-wrap break-words">
          {msg.text || "Couldn't generate or modify — please try again."}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] w-full border border-muted rounded-md p-2 space-y-2">
        <pre className="text-xs whitespace-pre-wrap break-words text-foreground">{msg.code}</pre>
        <div className="flex gap-2">
          <button
            onClick={() => onReuse(msg.code)}
            className="px-2 py-0.5 rounded border border-muted text-xs hover:opacity-80"
          >
            ▶ Re-run
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(msg.code)}
            className="px-2 py-0.5 rounded border border-muted text-xs hover:opacity-80"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
