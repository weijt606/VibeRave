import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { TrackVizPicker } from './TrackVizPicker.jsx';
import { getShape } from './painters.mjs';
import { $tracks, setTrackVizHeight } from './tracksStore.mjs';

// A per-track canvas. The actual painting is done by the editor (chosen
// painter from painters.mjs); this component just owns the DOM element
// and exposes its 2d context to the editor via the `onCanvas` callback
// (called once the element mounts). The viz picker is a small dropdown
// pinned to the top-right of the canvas area.
//
// The canvas backing store is sized at CSS-pixels × devicePixelRatio so
// the painters draw at full hi-DPI resolution and the browser scales the
// backing store down to the CSS box. Painters in @strudel/draw read
// ctx.canvas.width directly, so we deliberately do NOT apply a CSS-px
// transform — that would double the scale and clip half the drawing.

const SQUARE_SIDE = 160; // px — square viz fits this width × height
const MIN_HEIGHT = 40;
const MAX_HEIGHT = 480;

export function TrackVisualizer({ trackId, onCanvas, viz, onVizChange }) {
  const ref = useRef(null);
  const handleRef = useRef(null);
  const shape = getShape(viz);
  // Read THIS track's vizHeight from the global tracks store. Each row
  // resizes independently — a drag on track A only changes track A's
  // height. The store re-renders all subscribers when any track
  // changes, but the actual canvas style only updates for the row
  // whose height changed (React diff is cheap).
  const tracks = useStore($tracks);
  const track = tracks.find((t) => t.id === trackId);
  const wideHeight = Math.max(
    MIN_HEIGHT,
    Math.min(MAX_HEIGHT, track?.vizHeight || 80),
  );
  // Mirror wideHeight into a ref so the resize effect can read the
  // current value at pointerdown WITHOUT having `wideHeight` in its
  // deps array — otherwise every drag step (which changes wideHeight
  // via setTrackVizHeight) would tear down + re-attach the document
  // listeners, killing the drag after the first 1px move.
  const wideHeightRef = useRef(wideHeight);
  useEffect(() => {
    wideHeightRef.current = wideHeight;
  }, [wideHeight]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const sync = () => {
      const cssW = canvas.clientWidth || 320;
      const cssH = canvas.clientHeight || 80;
      canvas.width = Math.round(cssW * ratio);
      canvas.height = Math.round(cssH * ratio);
    };
    sync();
    const ctx = canvas.getContext('2d');
    onCanvas?.(canvas, ctx);
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [onCanvas]);

  // Drag-to-resize. Listeners attach ONCE per shape change (deps don't
  // include wideHeight — see wideHeightRef comment above). Move/up are
  // bound to `document` so the drag keeps tracking even if the cursor
  // leaves the small hit zone while expanding the canvas.
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || shape === 'square') return;
    let startY = 0;
    let startH = 0;
    let dragging = false;
    const onMove = (e) => {
      if (!dragging) return;
      const next = Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, startH + (e.clientY - startY)),
      );
      setTrackVizHeight(trackId, next);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      startY = e.clientY;
      startH = wideHeightRef.current; // read latest from ref (NOT closure)
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    };
    handle.addEventListener('pointerdown', onDown);
    return () => {
      handle.removeEventListener('pointerdown', onDown);
      // Cleanup in case unmount mid-drag.
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [shape]);

  // CSS box: wide viz uses the user-set height (default 80); square viz
  // is a 160px box centered horizontally and not resizable.
  const canvasStyle = shape === 'square'
    ? { width: SQUARE_SIDE, height: SQUARE_SIDE }
    : { width: '100%', height: wideHeight };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-end mb-1 gap-2">
        <TrackVizPicker value={viz} onChange={onVizChange} />
      </div>
      {/* relative wrapper so the resize handle can be absolutely positioned
          at the canvas's bottom edge — the handle is invisible until the
          cursor enters its hit zone (the bottom 10px strip), so the rest
          of the canvas stays clean. */}
      <div className="relative">
        <canvas
          ref={ref}
          // Faint bg + subtle ring so the canvas footprint is visible even
          // when audio is silent / paused — without this it disappears
          // entirely and the user can't tell the viz lane is even there.
          // Painters draw on top, so live content fully covers this.
          className="block rounded mx-auto bg-foreground/5 ring-1 ring-muted/30"
          style={canvasStyle}
        />
        {shape !== 'square' && (
          <div
            ref={handleRef}
            title={`Drag to resize (${wideHeight}px)`}
            // Hit zone — overlaps the canvas's bottom 10px so users
            // grab it naturally on the lower edge. `group` lets the
            // child grip-bar reveal on hover only.
            className="group absolute left-0 right-0 -bottom-1 h-3 cursor-ns-resize touch-none flex items-center justify-center"
            aria-label="Resize visualisation"
          >
            <div className="h-[3px] w-16 rounded-full bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
          </div>
        )}
      </div>
    </div>
  );
}
