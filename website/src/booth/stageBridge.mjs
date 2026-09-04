// Stage bridge — BroadcastChannel('viberave-stage') publisher; see CONTRACTS.md §6.
// STUB: real implementation lands in this file (owner: macro/fast-lane task).
export const STAGE_CHANNEL = 'viberave-stage';
export function publishState(partial) {}
export function publishDiff(diff) {}
export function startStageBridge() { return () => {}; }
