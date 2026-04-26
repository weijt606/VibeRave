import { PAINTERS } from './painters.mjs';

// Compact dropdown for choosing the per-track visualization. Click
// events stop propagating so picking a viz on a collapsed card doesn't
// also expand it.
export function TrackVizPicker({ value, onChange }) {
  return (
    <select
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        onChange?.(e.target.value);
      }}
      title="Visualization"
      className="bg-background border border-muted rounded px-1 py-0.5 text-[11px] text-foreground hover:opacity-80 focus:outline-none"
    >
      {Object.entries(PAINTERS).map(([key, def]) => (
        <option key={key} value={key}>
          {def.label}
        </option>
      ))}
    </select>
  );
}
