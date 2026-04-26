import { useEffect, useRef } from 'react';
import { TrackVizPicker } from './TrackVizPicker.jsx';
import { getShape } from './painters.mjs';

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

export function TrackVisualizer({ trackId, onCanvas, viz, onVizChange }) {
  const ref = useRef(null);
  const shape = getShape(viz);

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

  // CSS box: wide viz fills the row at 80px high; square viz is a 160px
  // box centered horizontally. Same canvas element across viz switches
  // so the editor's ctx ref stays valid.
  const canvasStyle = shape === 'square'
    ? { width: SQUARE_SIDE, height: SQUARE_SIDE }
    : { width: '100%', height: 80 };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-end mb-1 gap-2">
        <TrackVizPicker value={viz} onChange={onVizChange} />
      </div>
      <canvas
        ref={ref}
        className="block rounded mx-auto"
        style={canvasStyle}
      />
    </div>
  );
}
