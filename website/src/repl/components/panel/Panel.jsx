import { Bars3Icon, XMarkIcon } from '@heroicons/react/16/solid';
import cx from '@src/cx.mjs';
import { StrudelIcon } from '@src/repl/components/icons/StrudelIcon';
import { useSettings, setIsZen, setIsPanelOpened, setActiveFooter as setTab } from '../../../settings.mjs';
import '../../Repl.css';
import { useLogger } from '../useLogger';
import { ApiSettingsTab } from './ApiSettingsTab';
import { ConsoleTab } from './ConsoleTab';
import { CycleBar } from './CycleBar';
import { FilesTab } from './FilesTab';
import { Reference } from './Reference';
import { SettingsTab } from './SettingsTab';
import { SoundsTab } from './SoundsTab';
import { VibeTab } from './VibeTab';

const TAURI = typeof window !== 'undefined' && window.__TAURI__;

const { BASE_URL } = import.meta.env;
const baseNoTrailing = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

export function LogoButton({ context, isEmbedded }) {
  const { started } = context;
  const { isZen, isCSSAnimationDisabled, fontFamily } = useSettings();
  return (
    <div
      className={cx(
        'mt-[1px]',
        started && !isCSSAnimationDisabled && 'animate-spin',
        'cursor-pointer text-blue-500',
        isZen && 'fixed top-2 right-4',
      )}
      onClick={() => {
        if (!isEmbedded) {
          setIsZen(!isZen);
        }
      }}
    >
      <span className="block text-foreground rotate-90">
        <StrudelIcon className="w-5 h-5 fill-foreground" />
      </span>
    </div>
  );
}

export function MainPanel({ context, isEmbedded = false, className }) {
  const { isZen, isButtonRowHidden, fontFamily } = useSettings();
  let loc = window.location;
  let ver = 'unofficial';
  let hot = false;
  let b = loc.hostname.match(/^(.+)\.(strudel)/);
  if (/(strudel.cc$)/.test(loc.hostname)) {
    // if there's no text before 'strudel', it's warm, otherwise use the text before strudel
    ver = b ? b[1] : 'warm';
  } else {
    // match both versions of localhost
    if (/(localhost)|(127.0.0.1)/.test(loc.hostname)) ver = 'dev';
  }
  let pr = ver.match(/pr-([0-9]+)/);
  if (pr) {
    pr = pr[1];
    ver = `hot: ${pr}`;
    hot = true;
    pr = `https://codeberg.org/uzu/strudel/pulls/${pr}`;
  }

  return (
    <nav
      id="header"
      className={cx(
        'flex-none text-black z-[100] text-sm select-none min-h-10 max-h-10',
        !isZen && !isEmbedded && 'border-b border-muted bg-lineHighlight',
        isZen ? 'h-12 w-8 fixed top-0 left-0' : '',
        'flex items-center',
        className,
      )}
      style={{ fontFamily }}
    >
      <div className={cx('flex w-full justify-between')}>
        <div className="px-3 py-1 flex space-x-2 select-none">
          <h1
            onClick={() => {
              if (isEmbedded) window.open(window.location.href.replace('embed', ''));
            }}
            className={cx(
              isEmbedded ? 'text-l cursor-pointer' : 'text-xl',
              'text-foreground font-bold flex space-x-2 items-center',
            )}
          >
            <LogoButton context={context} isEmbedded={isEmbedded} />
            {!isZen && (
              <div className="space-x-3 flex items-center">
                <span className="vr-logo hidden sm:inline-block">VIBERAVE</span>
                {!hot ? (
                  <span className="vr-version hidden sm:inline-block">{ver}</span>
                ) : (
                  <a className="hover:opacity-80" href={pr} target="_blank">
                    <span className="vr-version hidden sm:inline-block">{ver}</span>
                  </a>
                )}
              </div>
            )}
          </h1>
        </div>
        {!isZen && (
          <div className="flex grow justify-end">
            <PanelToggle isEmbedded={isEmbedded} isZen={isZen} />
          </div>
        )}
      </div>
    </nav>
  );
}

export function Footer({ context, isEmbedded = false }) {
  return (
    <div className="border-t border-muted bg-lineHighlight block lg:hidden">
      <MainMenu context={context} isEmbedded={isEmbedded} />
    </div>
  );
}

function MainMenu({ context, isEmbedded = false, className }) {
  const { started, pending, isDirty, activeCode, handleTogglePlay, handleEvaluate, handleShare } = context;
  const { isCSSAnimationDisabled } = useSettings();
  return (
    <div className={cx('flex text-sm max-w-full shrink-0 overflow-hidden text-foreground px-2 h-10', className)}>
      <button
        onClick={handleTogglePlay}
        title={started ? 'stop' : 'play'}
        className={cx('px-2 hover:opacity-50', !started && !isCSSAnimationDisabled && 'animate-pulse')}
      >
        <span className={cx('flex items-center space-x-2')}>
          {started ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          {!isEmbedded && <span>{pending ? '...' : started ? 'stop' : 'play'}</span>}
        </span>
      </button>
      <button
        onClick={handleEvaluate}
        title="update"
        className={cx('flex items-center space-x-1 px-2', !isDirty || !activeCode ? 'opacity-50' : 'hover:opacity-50')}
      >
        {!isEmbedded && <span>update</span>}
      </button>
    </div>
  );
}

function PanelCloseButton() {
  const { isPanelOpen } = useSettings();
  return (
    isPanelOpen && (
      <button
        onClick={() => setIsPanelOpened(false)}
        className={cx('px-2 py-0 text-foreground hover:opacity-50')}
        aria-label="Close Menu"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>
    )
  );
}

export function BottomPanel({ context }) {
  const { isPanelOpen, activeFooter: tab } = useSettings();
  return (
    <PanelNav
      className={cx(
        isPanelOpen ? `min-h-[360px] max-h-[360px]` : 'min-h-10 max-h-10',
        'overflow-hidden flex flex-col relative',
      )}
    >
      <div className="flex justify-between min-h-10 max-h-10 grid-cols-2 items-center border-t border-muted">
        <PanelCloseButton />
        <Tabs setTab={setTab} tab={tab} className={cx(isPanelOpen && 'border-l border-muted')} />
      </div>
      {isPanelOpen && (
        <>
          <CycleBar />
          <div className="w-full h-full overflow-auto border-t border-muted">
            <PanelContent context={context} tab={tab} />
          </div>
        </>
      )}
    </PanelNav>
  );
}

export function RightPanel({ context }) {
  const settings = useSettings();
  const { activeFooter: tab, isPanelOpen } = settings;
  if (!isPanelOpen) {
    return;
  }
  return (
    <PanelNav
      settings={settings}
      className={cx(
        'border-l border-muted shrink-0 h-full overflow-hidden',
        isPanelOpen ? `min-w-[min(600px,100vw)] max-w-[min(600px,80vw)]` : 'min-w-12 max-w-12',
      )}
    >
      <div className={cx('flex flex-col h-full')}>
        <div className="flex justify-between w-full overflow-hidden border-b border-muted min-h-10 max-h-10">
          <PanelCloseButton />
          <Tabs setTab={setTab} tab={tab} className="border-l border-muted" />
        </div>
        <CycleBar />
        <div className="overflow-auto h-full">
          <PanelContent context={context} tab={tab} />
        </div>
      </div>
    </PanelNav>
  );
}

const tabNames = {
  vibe: 'vibe',
  api: 'api',
  sounds: 'sounds',
  reference: 'reference',
  console: 'console',
  settings: 'settings',
};
if (TAURI) {
  tabNames.files = 'files';
}

function PanelNav({ children, className, ...props }) {
  const settings = useSettings();
  return (
    <nav
      onClick={() => {
        if (!settings.isPanelOpen) {
          setIsPanelOpened(true);
        }
      }}
      aria-label="Menu Panel"
      className={cx('h-full bg-lineHighlight group overflow-x-auto', className)}
      {...props}
    >
      {children}
    </nav>
  );
}

function PanelContent({ context, tab }) {
  useLogger();
  switch (tab) {
    case tabNames.console:
      return <ConsoleTab />;
    case tabNames.sounds:
      return <SoundsTab />;
    case tabNames.reference:
      return <Reference />;
    case tabNames.settings:
      return <SettingsTab started={context.started} />;
    case tabNames.files:
      return <FilesTab />;
    case tabNames.api:
      return <ApiSettingsTab />;
    case tabNames.vibe:
    default:
      return <VibeTab />;
  }
}

function PanelTab({ label, isSelected, onClick }) {
  return (
    <>
      <button
        onClick={onClick}
        className={cx(
          'h-10 px-2 text-sm border-t-2 border-t-transparent text-foreground cursor-pointer hover:opacity-50 flex items-center space-x-1 border-b-2',
          isSelected ? 'border-foreground' : 'border-transparent',
        )}
      >
        {label}
      </button>
    </>
  );
}
function Tabs({ className }) {
  const { isPanelOpen, activeFooter: tab } = useSettings();
  return (
    <div
      className={cx(
        'px-2 w-full flex select-none max-w-full h-10 max-h-10 min-h-10 overflow-auto items-center',
        className,
      )}
    >
      {Object.keys(tabNames).map((key) => {
        const val = tabNames[key];
        return <PanelTab key={key} isSelected={tab === val && isPanelOpen} label={key} onClick={() => setTab(val)} />;
      })}
    </div>
  );
}

export function PanelToggle({ isEmbedded, isZen }) {
  const { panelPosition, isPanelOpen } = useSettings();
  return (
    !isEmbedded &&
    !isZen &&
    panelPosition === 'right' && (
      <button
        title="menu"
        className={cx('border-l border-muted px-2 py-0 text-foreground hover:opacity-50')}
        onClick={() => setIsPanelOpened(!isPanelOpen)}
      >
        <Bars3Icon className="w-6 h-6" />
      </button>
    )
  );
}
