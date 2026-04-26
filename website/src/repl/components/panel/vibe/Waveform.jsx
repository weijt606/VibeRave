// Live waveform from a rolling RMS buffer. Each bar maps a single sample to
// 15..100% of the bar height; the multiplier is empirical so normal speech
// fills 60-90% without clipping.
export function Waveform({ levels }) {
  return (
    <span className="flex items-end gap-px h-3 w-[42px]" aria-hidden>
      {levels.map((rms, i) => {
        const h = Math.max(15, Math.min(100, rms * 700));
        return (
          <span
            key={i}
            className="w-0.5 bg-background rounded-sm transition-all duration-75"
            style={{ height: `${h}%` }}
          />
        );
      })}
    </span>
  );
}
