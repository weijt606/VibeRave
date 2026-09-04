// MacroBus — five 0..1 macros; see docs/booth/CONTRACTS.md §4.
// STUB: real implementation lands in this file (owner: macro/fast-lane task).
import { atom } from 'nanostores';
export const MACROS = ['cutoff', 'energy', 'space', 'density', 'tempo'];
export const $macros = atom({ cutoff: 0.5, energy: 0.5, space: 0.5, density: 0.5, tempo: 0.5 });
export function setMacro(name, value01, opts = {}) {
  const v = Math.max(0, Math.min(1, Number(value01)));
  $macros.set({ ...$macros.get(), [name]: v });
}
export function setMacros(partial, opts = {}) {
  for (const [k, v] of Object.entries(partial)) setMacro(k, v, opts);
}
export function resetMacros() {
  $macros.set({ cutoff: 0.5, energy: 0.5, space: 0.5, density: 0.5, tempo: 0.5 });
}
export function applyMacros() {}
if (typeof window !== 'undefined') window.vibeMacros = { get: () => $macros.get(), set: setMacro };
