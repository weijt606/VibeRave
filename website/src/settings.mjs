import { persistentMap } from '@nanostores/persistent';
import { useStore } from '@nanostores/react';
import { register } from '@strudel/core';
import { isUdels } from './repl/util.mjs';
import { computed } from 'nanostores';

export const audioEngineTargets = {
  webaudio: 'webaudio',
  osc: 'osc',
};

export const soundFilterType = {
  USER: 'user',
  DRUMS: 'drums',
  SAMPLES: 'samples',
  SYNTHS: 'synths',
  WAVETABLES: 'wavetables',
  ALL: 'all',
};

const initialPrebakeScript = `// Prebake script
//
// This is code that is loaded before your pattern is run.
// You can use it to define custom functions to use in any pattern.
// 
// This is an initial example script. You can edit it to add 
// your own funtions.
//
// To use a script shared by some other user you can use
// the import-button or paste the script in this editor.

const ratchet = register('ratchet', (pat) => pat.sometimes(ply(2)))
`;

export const defaultSettings = {
  activeFooter: 'vibe',
  keybindings: 'codemirror',
  isBracketMatchingEnabled: true,
  isBracketClosingEnabled: true,
  isLineNumbersDisplayed: true,
  isActiveLineHighlighted: true,
  isAutoCompletionEnabled: false,
  isTooltipEnabled: false,
  isFlashEnabled: true,
  isSyncEnabled: false,
  isLineWrappingEnabled: false,
  isPatternHighlightingEnabled: true,
  isTabIndentationEnabled: false,
  isMultiCursorEnabled: false,
  isBlockBasedEvalEnabled: false,
  theme: 'strudelTheme',
  fontFamily: 'monospace',
  fontSize: 18,
  latestCode: '',
  isZen: false,
  soundsFilter: soundFilterType.ALL,
  referenceTag: 'all',
  patternFilter: 'community',
  // panelPosition: window.innerWidth > 1000 ? 'right' : 'bottom', //FIX: does not work on astro
  panelPosition: 'right',
  isPanelPinned: false,
  isPanelOpen: true,
  userPatterns: '{}',
  prebakeScript: initialPrebakeScript,
  audioEngineTarget: audioEngineTargets.webaudio,
  isButtonRowHidden: false,
  isCSSAnimationDisabled: false,
  maxPolyphony: 128,
  multiChannelOrbits: false,
  includePrebakeScriptInShare: true,
  settingsTab: 'settings',
  vibePttKey: 'Space',
  vibeAutoApply: true,
  // Speech recognition language hint sent to the backend on /transcribe.
  // 'auto' uses navigator.language — but on Chinese-locale browsers that's
  // zh-CN, which butchers English prompts via the wrong phonetic model.
  // Defaulting to en-US matches the demo language.
  vibeVoiceLang: 'en-US',
  // ─── API settings (LLM + STT) ─────────────────────────────────────────
  // Live in localStorage and are sent as override headers on every API
  // request. Backend never persists them. Empty values mean "use the
  // backend's env-configured default", so a plain dev clone with no
  // browser-side config still works as long as .env has values.
  llmProvider: 'api',          // 'api' | 'ollama'
  llmApiKey: '',
  llmBaseUrl: 'https://api.openai.com/v1',
  llmModel: 'gpt-4o-mini',
  llmTemperature: 0.85,
  sttProvider: 'whisper',      // 'whisper' | 'vosk' | 'api'
  sttApiKey: '',
  sttBaseUrl: 'https://api.openai.com/v1',
  sttModel: 'whisper-1',
  // Persisted multi-track state.
  tracks: '[]',
};

// One-click LLM provider presets — fill the URL + model fields, the
// user just pastes their key. Source of truth for the API Settings UI.
export const LLM_PRESETS = [
  {
    id: 'openai',
    label: 'OpenAI',
    provider: 'api',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyHelp: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    provider: 'api',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyHelp: 'https://console.groq.com/keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    provider: 'api',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
    keyHelp: 'https://openrouter.ai/settings/keys',
  },
  {
    id: 'qwen',
    label: 'Qwen (DashScope)',
    provider: 'api',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    keyHelp: 'https://bailian.console.aliyun.com/?apiKey=1',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:14b',
    keyHelp: null,
  },
  {
    id: 'custom-llm',
    label: 'Custom…',
    provider: 'api',
    // Empty defaults — user fills baseURL/model/key. Any OpenAI-
    // compatible Chat Completions endpoint works.
    baseUrl: '',
    model: '',
    keyHelp: null,
  },
];

// One-click STT provider presets.
export const STT_PRESETS = [
  {
    id: 'whisper',
    label: 'Whisper (local)',
    provider: 'whisper',
    baseUrl: '',
    model: '',
    keyHelp: null,
    needsKey: false,
  },
  {
    id: 'vosk',
    label: 'VOSK (local, ~10ms)',
    provider: 'vosk',
    baseUrl: '',
    model: '',
    keyHelp: null,
    needsKey: false,
  },
  {
    id: 'openai-whisper',
    label: 'OpenAI Whisper',
    provider: 'api',
    baseUrl: 'https://api.openai.com/v1',
    model: 'whisper-1',
    keyHelp: 'https://platform.openai.com/api-keys',
    needsKey: true,
  },
  {
    id: 'groq-whisper',
    label: 'Groq Whisper',
    provider: 'api',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'whisper-large-v3-turbo',
    keyHelp: 'https://console.groq.com/keys',
    needsKey: true,
  },
  {
    id: 'qwen-asr',
    label: 'Qwen (DashScope)',
    provider: 'api',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    // DashScope's OpenAI-compatible mode exposes paraformer / fun-asr
    // family models via /audio/transcriptions. Override the model field
    // for fun-asr-realtime, paraformer-v2, etc.
    model: 'paraformer-v2',
    keyHelp: 'https://bailian.console.aliyun.com/?apiKey=1',
    needsKey: true,
  },
  {
    id: 'custom-stt',
    label: 'Custom…',
    provider: 'api',
    // Empty defaults — user fills the fields. The custom path goes
    // through the same OpenAI-compatible /audio/transcriptions adapter,
    // so any endpoint that speaks that protocol works out of the box.
    // Non-compatible engines (e.g. websocket-streaming ASR) need a
    // dedicated adapter — see services/api/src/infrastructure/.
    baseUrl: '',
    model: '',
    keyHelp: null,
    needsKey: true,
  },
];

let search = null;
if (typeof window !== 'undefined') {
  search = new URLSearchParams(window.location.search);
}
// if running multiple instance in one window, it will use the settings for that instance. else default to normal
const instance = parseInt(search?.get('instance') ?? '0');
const settings_key = `strudel-settings${instance > 0 ? instance : ''}`;

export const settingsMap = persistentMap(settings_key, defaultSettings);

export const $settings = computed(settingsMap, (state) => {
  const userPatterns = JSON.parse(state.userPatterns);
  Object.keys(userPatterns).forEach((key) => {
    const data = userPatterns[key];
    data.id = data.id ?? key;
    userPatterns[key] = data;
  });
  return {
    ...state,
    isZen: parseBoolean(state.isZen),
    isBracketMatchingEnabled: parseBoolean(state.isBracketMatchingEnabled),
    isBracketClosingEnabled: parseBoolean(state.isBracketClosingEnabled),
    isLineNumbersDisplayed: parseBoolean(state.isLineNumbersDisplayed),
    isActiveLineHighlighted: parseBoolean(state.isActiveLineHighlighted),
    isAutoCompletionEnabled: parseBoolean(state.isAutoCompletionEnabled),
    isPatternHighlightingEnabled: parseBoolean(state.isPatternHighlightingEnabled),
    isButtonRowHidden: parseBoolean(state.isButtonRowHidden),
    isCSSAnimationDisabled: parseBoolean(state.isCSSAnimationDisabled),
    isTooltipEnabled: parseBoolean(state.isTooltipEnabled),
    isLineWrappingEnabled: parseBoolean(state.isLineWrappingEnabled),
    isFlashEnabled: parseBoolean(state.isFlashEnabled),
    isSyncEnabled: isUdels() ? true : parseBoolean(state.isSyncEnabled),
    isTabIndentationEnabled: parseBoolean(state.isTabIndentationEnabled),
    isMultiCursorEnabled: parseBoolean(state.isMultiCursorEnabled),
    isBlockBasedEvalEnabled: parseBoolean(state.isBlockBasedEvalEnabled),
    fontSize: Number(state.fontSize),
    panelPosition: state.activeFooter !== '' && !isUdels() ? state.panelPosition : 'bottom', // <-- keep this 'bottom' where it is!
    isPanelPinned: parseBoolean(state.isPanelPinned),
    isPanelOpen: parseBoolean(state.isPanelOpen),
    userPatterns: userPatterns,
    multiChannelOrbits: parseBoolean(state.multiChannelOrbits),
    includePrebakeScriptInShare: parseBoolean(state.includePrebakeScriptInShare),
    vibeAutoApply: state.vibeAutoApply === undefined ? true : parseBoolean(state.vibeAutoApply),
    patternAutoStart: isUdels()
      ? false
      : state.patternAutoStart === undefined
        ? true
        : parseBoolean(state.patternAutoStart),
  };
});

export const parseBoolean = (booleanlike) => ([true, 'true'].includes(booleanlike) ? true : false);

export function useSettings() {
  return useStore($settings);
}

export const setActiveFooter = (tab) => settingsMap.setKey('activeFooter', tab);
export const setVibePttKey = (code) => settingsMap.setKey('vibePttKey', code);
export const setVibeAutoApply = (bool) => settingsMap.setKey('vibeAutoApply', !!bool);
export const setVibeVoiceLang = (lang) => settingsMap.setKey('vibeVoiceLang', lang);
// API settings setters — wired to the API Settings tab.
export const setLlmProvider = (v) => settingsMap.setKey('llmProvider', v);
export const setLlmApiKey = (v) => settingsMap.setKey('llmApiKey', v);
export const setLlmBaseUrl = (v) => settingsMap.setKey('llmBaseUrl', v);
export const setLlmModel = (v) => settingsMap.setKey('llmModel', v);
export const setLlmTemperature = (v) => settingsMap.setKey('llmTemperature', Number(v));
export const setSttProvider = (v) => settingsMap.setKey('sttProvider', v);
export const setSttApiKey = (v) => settingsMap.setKey('sttApiKey', v);
export const setSttBaseUrl = (v) => settingsMap.setKey('sttBaseUrl', v);
export const setSttModel = (v) => settingsMap.setKey('sttModel', v);
export const setPanelPinned = (bool) => settingsMap.setKey('isPanelPinned', bool);
export const setIsPanelOpened = (bool) => settingsMap.setKey('isPanelOpen', bool);
export const setSettingsTab = (tab) => settingsMap.setKey('settingsTab', tab);

export const storePrebakeScript = (script) => settingsMap.setKey('prebakeScript', script);

export const setIsZen = (active) => settingsMap.setKey('isZen', !!active);

const patternSetting = (key) =>
  register(key, (value, pat) =>
    pat.onTrigger(() => {
      value = Array.isArray(value) ? value.join(' ') : value;
      if (value !== settingsMap.get()[key]) {
        settingsMap.setKey(key, value);
      }
      return pat;
    }, false),
  );

export const theme = patternSetting('theme');
export const fontFamily = patternSetting('fontFamily');
export const fontSize = patternSetting('fontSize');

export const settingPatterns = { theme, fontFamily, fontSize };
