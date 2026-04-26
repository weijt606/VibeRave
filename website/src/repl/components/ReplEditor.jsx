import Loader from '@src/repl/components/Loader';
import { BottomPanel, MainPanel, RightPanel } from '@src/repl/components/panel/Panel';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { TracksColumn } from '@src/repl/tracks/TracksColumn.jsx';
import { useSettings } from '@src/settings.mjs';

export default function ReplEditor(Props) {
  const { context, ...editorProps } = Props;
  const { error, pending } = context;
  const settings = useSettings();
  const { panelPosition, isZen } = settings;
  const isEmbedded = typeof window !== 'undefined' && window.location !== window.parent.location;

  return (
    <div className="h-full flex flex-col relative" {...editorProps}>
      <Loader active={pending} />
      <div className="flex flex-col grow overflow-hidden">
        <MainPanel context={context} isEmbedded={isEmbedded} />
        <div className="flex overflow-hidden h-full">
          <TracksColumn context={context} />
          {!isZen && panelPosition === 'right' && <RightPanel context={context} />}
        </div>
      </div>
      <UserFacingErrorMessage error={error} />
      {!isZen && panelPosition === 'bottom' && <BottomPanel context={context} />}
    </div>
  );
}
