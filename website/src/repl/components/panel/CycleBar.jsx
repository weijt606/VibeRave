import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { getTime } from '@strudel/core';
import { $anyPlaying } from '../../tracks/tracksStore.mjs';

// 2-pixel horizontal indicator at the top of the panel content. The fill
// width is driven by Strudel's continuous cycle counter (`getTime()` →
// `scheduler.now()`), wrapped to [0, 1) so it scans left → right once per
// cycle. Magenta→cyan gradient ties into the brand palette.
//
// We update via a `requestAnimationFrame` loop that writes directly to the
// fill `<div>` style — no React re-renders per frame. The loop is started
// only while at least one track is playing, so the bar freezes (zero-width)
// when the user pauses everything; otherwise `getTime()` would keep
// advancing because scheduler.now() reads real time.
export function CycleBar() {
  const anyPlaying = useStore($anyPlaying);
  const fillRef = useRef(null);

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    if (!anyPlaying) {
      fill.style.width = '0%';
      return;
    }
    let raf = 0;
    const tick = () => {
      try {
        const t = getTime();
        if (typeof t === 'number' && Number.isFinite(t)) {
          // ((t % 1) + 1) % 1 → safe wrap for negative t (shouldn't happen
          // but cheap insurance vs. NaN if scheduler clock glitches).
          const progress = ((t % 1) + 1) % 1;
          fill.style.width = `${progress * 100}%`;
        }
      } catch {
        // setTime() not yet wired by any scheduler — pre-init state.
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anyPlaying]);

  return (
    <div className="relative w-full h-[2px] overflow-hidden pointer-events-none">
      <div
        ref={fillRef}
        className="absolute top-0 left-0 h-full"
        style={{
          width: '0%',
          background:
            'linear-gradient(90deg, var(--vr-accent-magenta), var(--vr-accent-cyan))',
        }}
      />
    </div>
  );
}
