// PTT hotkey shape: a "+"-joined string of optional modifiers + one
// physical key code, e.g. "Ctrl+Space", "Meta+Backquote", "Space".
// Modifiers are the lowercase tokens 'ctrl', 'meta', 'shift', 'alt'.
// Anything else is treated as the KeyboardEvent.code.

export const NON_PTT_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight',
  'AltLeft',
  'AltRight',
  'OSLeft',
  'OSRight',
]);

const MODS = ['ctrl', 'meta', 'shift', 'alt'];
const MOD_LABEL = { ctrl: 'Ctrl', meta: 'Cmd', shift: 'Shift', alt: 'Alt' };

export function parseHotkey(str) {
  if (!str) return { code: null, ctrl: false, meta: false, shift: false, alt: false };
  const parts = str.split('+').map((p) => p.trim()).filter(Boolean);
  const out = { code: null, ctrl: false, meta: false, shift: false, alt: false };
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (MODS.includes(lower)) out[lower] = true;
    else out.code = p; // preserves casing (e.g. "Space", "KeyG")
  }
  return out;
}

export function formatHotkey(hk) {
  if (!hk?.code) return '—';
  const segs = MODS.filter((m) => hk[m]).map((m) => MOD_LABEL[m]);
  segs.push(formatCode(hk.code));
  return segs.join('+');
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

function formatCode(code) {
  if (!code) return '';
  if (code === 'Space') return 'Space';
  if (code === 'Backquote') return '`';
  if (code === 'Backslash') return '\\';
  if (code === 'Tab') return 'Tab';
  if (code === 'Enter') return 'Enter';
  if (code === 'AltLeft') return isMac ? 'Left Option' : 'Left Alt';
  if (code === 'AltRight') return isMac ? 'Right Option' : 'Right Alt';
  if (code === 'ControlLeft') return 'Left Ctrl';
  if (code === 'ControlRight') return 'Right Ctrl';
  if (code === 'ShiftLeft') return 'Left Shift';
  if (code === 'ShiftRight') return 'Right Shift';
  if (code === 'MetaLeft' || code === 'OSLeft') return isMac ? 'Left Cmd' : 'Left Win';
  if (code === 'MetaRight' || code === 'OSRight') return isMac ? 'Right Cmd' : 'Right Win';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (/^F\d+$/.test(code)) return code;
  if (code.startsWith('Arrow')) return code.slice(5);
  return code;
}

export function displayKey(str) {
  return formatHotkey(parseHotkey(str));
}

// When the configured "main key" is itself a modifier (e.g. AltRight as
// PTT), pressing it makes the corresponding *Key flag true — which would
// fail the strict modifier check below. Skip that one flag instead.
const MODIFIER_CODE_FLAG = {
  ControlLeft: 'ctrl',
  ControlRight: 'ctrl',
  MetaLeft: 'meta',
  MetaRight: 'meta',
  OSLeft: 'meta',
  OSRight: 'meta',
  AltLeft: 'alt',
  AltRight: 'alt',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
};

// Whether `e` is the configured hotkey (modifiers must match exactly so
// e.g. Ctrl+Space doesn't fire on Ctrl+Shift+Space).
export function eventMatchesHotkey(e, str) {
  const hk = parseHotkey(str);
  if (!hk.code) return false;
  if (e.code !== hk.code) return false;
  const skip = MODIFIER_CODE_FLAG[hk.code];
  if (skip !== 'ctrl' && !!e.ctrlKey !== hk.ctrl) return false;
  if (skip !== 'meta' && !!e.metaKey !== hk.meta) return false;
  if (skip !== 'shift' && !!e.shiftKey !== hk.shift) return false;
  if (skip !== 'alt' && !!e.altKey !== hk.alt) return false;
  return true;
}

// A "modal" hotkey is one that won't be confused with normal typing in a
// text input — either it has at least one explicit modifier, or its main
// key is itself a modifier code (Alt / Ctrl / Meta / Shift left/right).
// In either case we don't need to bail when focus is in a textarea /
// codemirror.
export function isModalHotkey(str) {
  const hk = parseHotkey(str);
  if (hk.ctrl || hk.meta || hk.alt) return true;
  return !!MODIFIER_CODE_FLAG[hk.code];
}

export function isTextInput(target) {
  if (!target || target.nodeType !== 1) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  if (target.getAttribute?.('role') === 'textbox') return true;
  let n = target;
  for (let i = 0; i < 5 && n; i++) {
    if (n.classList?.contains('cm-content')) return true;
    n = n.parentElement;
  }
  return false;
}
