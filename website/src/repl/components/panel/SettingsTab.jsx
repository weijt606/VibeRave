import {
  defaultSettings,
  settingsMap,
  useSettings,
  storePrebakeScript,
  setSettingsTab,
  setVibePttKey,
  setVibeVoiceLang,
} from '../../../settings.mjs';
import { themes } from '@strudel/codemirror';
import { PrebakeCodeMirror } from '../../../repl/prebakeCodeMirror.mjs';
import { confirmAndReloadPage, isUdels } from '../../util.mjs';
import { ButtonGroup } from './Forms.jsx';
import { AudioDeviceSelector } from './AudioDeviceSelector.jsx';
import { AudioEngineTargetSelector } from './AudioEngineTargetSelector.jsx';
import { confirmDialog } from '../../util.mjs';
import { DEFAULT_MAX_POLYPHONY, setMaxPolyphony, setMultiChannelOrbits } from '@strudel/webaudio';
import { ActionButton } from '../button/action-button.jsx';
import { exportScript, ImportPrebakeScriptButton } from './ImportPrebakeScriptButton.jsx';
import { NON_PTT_CODES, displayKey } from './VibeTab.jsx';
import { useEffect, useRef, useState } from 'react';
import cx from '@src/cx.mjs';

const inputClass =
  'bg-background text-xs h-8 max-h-8 border border-box rounded-0 text-foreground border-muted placeholder-muted focus:outline-none focus:ring-0 focus:border-foreground';

export function Textbox({ onChange, className, ...inputProps }) {
  return (
    <input className={cx('px-2', inputClass, className)} onChange={(e) => onChange(e.target.value)} {...inputProps} />
  );
}

function Checkbox({ label, value, onChange, disabled = false }) {
  return (
    <label className="text-xs">
      <input
        className={cx(
          'bg-background text-sm border border-muted focus:outline-none focus:ring-0 focus:border-foreground',
        )}
        disabled={disabled}
        type="checkbox"
        checked={value}
        onChange={onChange}
      />
      {' ' + label}
    </label>
  );
}

//      value: ?ID, options: Map<ID, any>, onChange: ID => null, onClick: event => void, isDisabled: boolean
export function SelectInputDuplicate({ value, options, onChange, onClick, isDisabled }) {
  return (
    <select
      disabled={isDisabled}
      onClick={onClick}
      className={cx('p-2', inputClass)}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.size == 0 && <option value={value}>{`${value ?? 'select an option'}`}</option>}
      {Array.from(options.keys()).map((id) => (
        <option key={id} className="bg-background" value={id}>
          {options.get(id)}
        </option>
      ))}
    </select>
  );
}

function SelectInput({ value, options, onChange }) {
  return (
    <select className={cx('p-2', inputClass)} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([k, label]) => (
        <option key={k} className="bg-background" value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

function NumberSlider({ value, onChange, step = 1, ...rest }) {
  return (
    <div className="flex space-x-2 gap-1 overflow-hidden">
      <input
        className="p-2 grow accent-foreground"
        type="range"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        {...rest}
      />
      <input
        type="number"
        value={value}
        step={step}
        className={cx('w-16', inputClass)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function FormItem({ label, children, sublabel }) {
  return (
    <div className="grid gap-2 text-xs">
      <label className="text-sm">{label}</label>
      {children}
    </div>
  );
}

function PttKeyCapture({ value, onChange }) {
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    if (!capturing) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCapturing(false);
        return;
      }
      // Pressing only a modifier doesn't bind — wait for the user to add
      // a non-modifier key (e.g. Ctrl+Space).
      if (NON_PTT_CODES.has(e.code)) return;
      e.preventDefault();
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.metaKey) parts.push('Meta');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      parts.push(e.code);
      onChange(parts.join('+'));
      setCapturing(false);
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturing, onChange]);
  return (
    <button
      onClick={() => setCapturing((v) => !v)}
      className={cx(
        'px-2 py-1 rounded border text-xs w-fit',
        capturing
          ? 'border-foreground bg-foreground text-background'
          : 'border-muted hover:opacity-80',
      )}
    >
      {capturing ? 'press the combo… (Esc to cancel)' : displayKey(value)}
    </button>
  );
}

const themeOptions = Object.fromEntries(Object.keys(themes).map((k) => [k, k]));
const fontFamilyOptions = {
  monospace: 'monospace',
  Courier: 'Courier',
  CutiePi: 'CutiePi',
  JetBrains: 'JetBrains',
  Hack: 'Hack',
  FiraCode: 'FiraCode',
  'FiraCode-SemiBold': 'FiraCode SemiBold',
  teletext: 'teletext',
  tic80: 'tic80',
  mode7: 'mode7',
  BigBlueTerminal: 'BigBlueTerminal',
  x3270: 'x3270',
  Monocraft: 'Monocraft',
  PressStart: 'PressStart2P',
  'we-come-in-peace': 'we-come-in-peace',
  galactico: 'galactico',
};

function MainSettingsContent({ started }) {
  const {
    theme,
    keybindings,
    isBracketClosingEnabled,
    isBracketMatchingEnabled,
    isLineNumbersDisplayed,
    isPatternHighlightingEnabled,
    isActiveLineHighlighted,
    isAutoCompletionEnabled,
    isTooltipEnabled,
    isFlashEnabled,
    isButtonRowHidden,
    isCSSAnimationDisabled,
    isSyncEnabled,
    isLineWrappingEnabled,
    fontSize,
    fontFamily,
    panelPosition,
    audioDeviceName,
    audioEngineTarget,
    maxPolyphony,
    multiChannelOrbits,
    isTabIndentationEnabled,
    isMultiCursorEnabled,
    patternAutoStart,
    isBlockBasedEvalEnabled,
    vibePttKey,
    vibeAutoApply,
    vibeVoiceLang,
    isCycleBarDisplayed,
  } = useSettings();
  const shouldAlwaysSync = isUdels();
  const canChangeAudioDevice = AudioContext.prototype.setSinkId != null;
  return (
    <div className="p-4 text-foreground space-y-4 w-full overflow-auto" style={{ fontFamily }}>
      {canChangeAudioDevice && (
        <FormItem label="Audio Output Device">
          <AudioDeviceSelector
            isDisabled={started}
            audioDeviceName={audioDeviceName}
            onChange={(audioDeviceName) => {
              confirmAndReloadPage(() => {
                settingsMap.setKey('audioDeviceName', audioDeviceName);
              });
            }}
          />
        </FormItem>
      )}
      <FormItem label="Audio Engine Target">
        <AudioEngineTargetSelector
          target={audioEngineTarget}
          onChange={(target) => {
            confirmAndReloadPage(() => {
              settingsMap.setKey('audioEngineTarget', target);
            });
          }}
        />
      </FormItem>

      <FormItem label="Maximum Polyphony">
        <Textbox
          min={1}
          max={Infinity}
          onBlur={(e) => {
            let v = parseInt(e.target.value);
            v = isNaN(v) ? DEFAULT_MAX_POLYPHONY : v;
            setMaxPolyphony(v);
            settingsMap.setKey('maxPolyphony', v);
          }}
          onChange={(v) => {
            v = Math.max(1, parseInt(v));
            settingsMap.setKey('maxPolyphony', isNaN(v) ? undefined : v);
          }}
          type="number"
          placeholder=""
          value={maxPolyphony ?? ''}
        />
      </FormItem>
      <FormItem>
        <Checkbox
          label="Multi Channel Orbits"
          onChange={(cbEvent) => {
            const val = cbEvent.target.checked;
            confirmAndReloadPage(() => {
              settingsMap.setKey('multiChannelOrbits', val);
              setMultiChannelOrbits(val);
            });
          }}
          value={multiChannelOrbits}
        />
      </FormItem>
      <FormItem label="Theme">
        <SelectInput options={themeOptions} value={theme} onChange={(theme) => settingsMap.setKey('theme', theme)} />
      </FormItem>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormItem label="Font Family">
          <SelectInput
            options={fontFamilyOptions}
            value={fontFamily}
            onChange={(fontFamily) => settingsMap.setKey('fontFamily', fontFamily)}
          />
        </FormItem>
        <FormItem label="Font Size">
          <NumberSlider
            value={fontSize}
            onChange={(fontSize) => settingsMap.setKey('fontSize', fontSize)}
            min={10}
            max={40}
            step={2}
          />
        </FormItem>
      </div>

      <FormItem label="Keybindings">
        <ButtonGroup
          value={keybindings}
          onChange={(keybindings) => settingsMap.setKey('keybindings', keybindings)}
          items={{ codemirror: 'Codemirror', vim: 'Vim', emacs: 'Emacs', helix: 'Helix', vscode: 'VSCode' }}
        ></ButtonGroup>
      </FormItem>
      <FormItem label="Panel Position">
        <ButtonGroup
          value={panelPosition}
          onChange={(value) => settingsMap.setKey('panelPosition', value)}
          items={{ bottom: 'Bottom', right: 'Right' }}
        ></ButtonGroup>
      </FormItem>
      <FormItem label="Vibe">
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-70">Push-to-talk key:</span>
          <PttKeyCapture value={vibePttKey} onChange={setVibePttKey} />
        </div>
        <Checkbox
          label="Auto-apply changes"
          onChange={(cbEvent) => settingsMap.setKey('vibeAutoApply', cbEvent.target.checked)}
          value={vibeAutoApply}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-70">Voice language:</span>
          <ButtonGroup
            value={vibeVoiceLang}
            onChange={setVibeVoiceLang}
            items={{ 'en-US': 'English', 'zh-CN': '中文', auto: 'Browser' }}
          />
        </div>
        <Checkbox
          label="Show cycle indicator bar (top of panel)"
          onChange={(cbEvent) => settingsMap.setKey('isCycleBarDisplayed', cbEvent.target.checked)}
          value={isCycleBarDisplayed}
        />
      </FormItem>
      <FormItem label="More Settings">
        <Checkbox
          label="Enable bracket matching"
          onChange={(cbEvent) => settingsMap.setKey('isBracketMatchingEnabled', cbEvent.target.checked)}
          value={isBracketMatchingEnabled}
        />
        <Checkbox
          label="Auto close brackets"
          onChange={(cbEvent) => settingsMap.setKey('isBracketClosingEnabled', cbEvent.target.checked)}
          value={isBracketClosingEnabled}
        />
        <Checkbox
          label="Display line numbers"
          onChange={(cbEvent) => settingsMap.setKey('isLineNumbersDisplayed', cbEvent.target.checked)}
          value={isLineNumbersDisplayed}
        />
        <Checkbox
          label="Highlight active line"
          onChange={(cbEvent) => settingsMap.setKey('isActiveLineHighlighted', cbEvent.target.checked)}
          value={isActiveLineHighlighted}
        />
        <Checkbox
          label="Highlight events in code"
          onChange={(cbEvent) => settingsMap.setKey('isPatternHighlightingEnabled', cbEvent.target.checked)}
          value={isPatternHighlightingEnabled}
        />
        <Checkbox
          label="Enable auto-completion"
          onChange={(cbEvent) => settingsMap.setKey('isAutoCompletionEnabled', cbEvent.target.checked)}
          value={isAutoCompletionEnabled}
        />
        <Checkbox
          label="Enable tooltips on Ctrl and hover"
          onChange={(cbEvent) => settingsMap.setKey('isTooltipEnabled', cbEvent.target.checked)}
          value={isTooltipEnabled}
        />
        <Checkbox
          label="Enable line wrapping"
          onChange={(cbEvent) => settingsMap.setKey('isLineWrappingEnabled', cbEvent.target.checked)}
          value={isLineWrappingEnabled}
        />
        <Checkbox
          label="Enable Tab indentation"
          onChange={(cbEvent) => settingsMap.setKey('isTabIndentationEnabled', cbEvent.target.checked)}
          value={isTabIndentationEnabled}
        />
        <Checkbox
          label="Enable Multi-Cursor (Cmd/Ctrl+Click)"
          onChange={(cbEvent) => settingsMap.setKey('isMultiCursorEnabled', cbEvent.target.checked)}
          value={isMultiCursorEnabled}
        />
        <Checkbox
          label="Enable Block-based Evaluation (EXPERIMENTAL)"
          onChange={(cbEvent) => settingsMap.setKey('isBlockBasedEvalEnabled', cbEvent.target.checked)}
          value={isBlockBasedEvalEnabled}
        />
        <Checkbox
          label="Enable flashing on evaluation"
          onChange={(cbEvent) => settingsMap.setKey('isFlashEnabled', cbEvent.target.checked)}
          value={isFlashEnabled}
        />
        <Checkbox
          label="Sync across Browser Tabs / Windows"
          onChange={(cbEvent) => {
            const newVal = cbEvent.target.checked;
            confirmAndReloadPage(() => {
              settingsMap.setKey('isSyncEnabled', newVal);
            });
          }}
          disabled={shouldAlwaysSync}
          value={isSyncEnabled}
        />
        <Checkbox
          label="Hide action buttons"
          onChange={(cbEvent) => settingsMap.setKey('isButtonRowHidden', cbEvent.target.checked)}
          value={isButtonRowHidden}
        />
        <Checkbox
          label="Disable CSS Animations"
          onChange={(cbEvent) => settingsMap.setKey('isCSSAnimationDisabled', cbEvent.target.checked)}
          value={isCSSAnimationDisabled}
        />
        <Checkbox
          label="Auto-start pattern on pattern change"
          onChange={(cbEvent) => settingsMap.setKey('patternAutoStart', cbEvent.target.checked)}
          value={patternAutoStart}
        />
      </FormItem>
      <FormItem label="Zen Mode">Try clicking the logo in the top left!</FormItem>
      <FormItem label="Reset Settings">
        <ActionButton
          onClick={() => {
            confirmDialog('Sure?').then((r) => {
              if (r) {
                const { userPatterns } = settingsMap.get(); // keep current patterns
                settingsMap.set({ ...defaultSettings, userPatterns });
              }
            });
          }}
          className="bg-background p-2 max-w-[300px] hover:opacity-50"
        >
          restore default settings
        </ActionButton>
      </FormItem>
    </div>
  );
}

function PrebakeSettingsContent() {
  const { fontFamily, includePrebakeScriptInShare, prebakeScript } = useSettings();
  const editorRef = useRef();
  useEffect(() => {
    return () => {
      editorRef.current?.cleanup();
    };
  });

  return (
    <div className="flex flex-col h-full text-foreground w-full overflow-auto" style={{ fontFamily }}>
      <div className="flex flex-col grow overflow-hidden h-full bg-background">
        <section
          className="pb-0 overflow-auto grow z-10 code-container"
          ref={(el) => {
            if (editorRef.current) {
              return;
            }
            editorRef.current = new PrebakeCodeMirror(prebakeScript, (code) => storePrebakeScript(code), el);
          }}
        ></section>
      </div>
      <div className="flex justify-between items-center border-t border-muted px-4 whitespace-nowrap">
        <Checkbox
          label="share with patterns"
          className="whitespace-nowrap max-w-[200px]"
          onChange={(cbEvent) => settingsMap.setKey('includePrebakeScriptInShare', cbEvent.target.checked)}
          value={includePrebakeScriptInShare}
        />
        <div className="py-2 flex flex-row items-center space-x-3 ">
          <ImportPrebakeScriptButton updateEditor={(code) => editorRef?.current.setCode(code)} />
          <ActionButton onClick={() => exportScript(prebakeScript)}>export</ActionButton>
          <ActionButton onClick={() => editorRef.current?.savePrebake()}>save</ActionButton>
        </div>
      </div>
    </div>
  );
}
export function SettingsTab({ started }) {
  const { settingsTab } = useSettings();
  return (
    <div className="w-full h-full text-foreground flex flex-col overflow-hidden">
      <div className="px-2 shrink-0 h-8 space-x-4 flex max-w-full overflow-x-auto border-b border-muted">
        <ButtonGroup
          wrap
          value={settingsTab}
          onChange={(value) => setSettingsTab(value)}
          items={{
            settings: 'settings',
            prebake: 'prebake',
          }}
        ></ButtonGroup>
      </div>
      {settingsTab === 'settings' && <MainSettingsContent started={started} />}
      {settingsTab === 'prebake' && <PrebakeSettingsContent />}
    </div>
  );
}
