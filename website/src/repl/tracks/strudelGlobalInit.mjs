import { initAudioOnFirstClick } from '@strudel/webaudio';
import { parseBoolean, settingsMap } from '../../settings.mjs';
import { loadModules } from '../util.mjs';
import { prebake } from '../prebake.mjs';

let modulesLoading;
let presets;
let audioReady;

export function getAudioReady() {
  return audioReady;
}
export function getModulesLoading() {
  return modulesLoading;
}
export function getPresetsLoading() {
  return presets;
}

export async function getModule(name) {
  if (!modulesLoading) return;
  const mods = await modulesLoading;
  return mods.find((m) => m.packageName === name);
}

if (typeof window !== 'undefined') {
  const { maxPolyphony, audioDeviceName, multiChannelOrbits } = settingsMap.get();
  audioReady = initAudioOnFirstClick({
    maxPolyphony,
    audioDeviceName,
    multiChannelOrbits: parseBoolean(multiChannelOrbits),
  });
  modulesLoading = loadModules();
  presets = prebake();
}
