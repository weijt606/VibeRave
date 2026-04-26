import Loader from '@src/repl/components/Loader';
import BigPlayButton from '@src/repl/components/BigPlayButton';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { TracksColumn } from '@src/repl/tracks/TracksColumn.jsx';
import { MainPanel } from './panel/Panel';

export default function EmbeddedReplEditor(Props) {
  const { context, ...editorProps } = Props;
  const { pending, started, handleTogglePlay, error } = context;
  return (
    <div className="h-full flex flex-col relative" {...editorProps}>
      <Loader active={pending} />
      <MainPanel context={context} embedded={true} />
      <BigPlayButton started={started} handleTogglePlay={handleTogglePlay} />
      <div className="grow flex relative overflow-hidden">
        <TracksColumn context={context} />
      </div>
      <UserFacingErrorMessage error={error} />
    </div>
  );
}
