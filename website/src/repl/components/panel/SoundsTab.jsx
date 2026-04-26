import useEvent from '@src/useEvent.mjs';
import { useStore } from '@nanostores/react';
import { getAudioContext, soundMap, connectToDestination } from '@strudel/webaudio';
import { useMemo, useRef, useState } from 'react';
import { settingsMap, soundFilterType, useSettings } from '../../../settings.mjs';
import { ButtonGroup } from './Forms.jsx';
import ImportSoundsButton from './ImportSoundsButton.jsx';
import { Textbox } from '@src/repl/components/panel/SettingsTab.jsx';
import { ActionButton } from '../button/action-button.jsx';
import { confirmDialog } from '@src/repl/util.mjs';
import { clearIDB, userSamplesDBConfig } from '@src/repl/idbutils.mjs';
import { prebake } from '@src/repl/prebake.mjs';

const getSamples = (samples) =>
  Array.isArray(samples) ? samples.length : typeof samples === 'object' ? Object.values(samples).length : 1;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function SoundsTab() {
  const sounds = useStore(soundMap);

  const { soundsFilter } = useSettings();
  const [search, setSearch] = useState('');
  const { BASE_URL } = import.meta.env;
  const baseNoTrailing = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

  const soundEntries = useMemo(() => {
    if (!sounds) {
      return [];
    }

    let filtered = Object.entries(sounds)
      .filter(([key]) => !key.startsWith('_'))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()));

    if (soundsFilter === soundFilterType.USER) {
      return filtered.filter(([_, { data }]) => !data.prebake);
    }
    if (soundsFilter === soundFilterType.DRUMS) {
      return filtered.filter(([_, { data }]) => data.type === 'sample' && data.tag === 'drum-machines');
    }
    if (soundsFilter === soundFilterType.SAMPLES) {
      return filtered.filter(([_, { data }]) => data.type === 'sample' && data.tag !== 'drum-machines');
    }
    if (soundsFilter === soundFilterType.SYNTHS) {
      return filtered.filter(([_, { data }]) => ['synth', 'soundfont'].includes(data.type));
    }
    if (soundsFilter === soundFilterType.WAVETABLES) {
      return filtered.filter(([_, { data }]) => data.type === 'wavetable');
    }
    //TODO: tidy this up, it does not need to be saved in settings
    if (soundsFilter === 'importSounds') {
      return [];
    }
    return filtered;
  }, [sounds, soundsFilter, search]);

  // holds mutable ref to current triggered sound
  const trigRef = useRef();
  const numRef = useRef(0);

  // stop current sound on mouseup
  useEvent('mouseup', () => {
    const ref = trigRef.current;
    trigRef.current = undefined;
    ref?.stop?.(getAudioContext().currentTime + 0.01);
  });
  useEvent('keydown', (e) => {
    if (!isNaN(Number(e.key))) {
      numRef.current = Number(e.key);
    }
  });
  useEvent('keyup', (e) => {
    numRef.current = 0;
  });
  return (
    <div id="sounds-tab" className="flex flex-col w-full h-full text-foreground">
      <Textbox placeholder="Search..." className="border-0" value={search} onChange={(v) => setSearch(v)} />

      <div className="flex shrink-0 flex-wrap border-y border-muted">
        <ButtonGroup
          wrap
          value={soundsFilter}
          onChange={(value) => settingsMap.setKey('soundsFilter', value)}
          items={{
            samples: 'samples',
            drums: 'drum-machines',
            synths: 'Synths',
            wavetables: 'Wavetables',
            user: 'User',
            importSounds: 'import-sounds',
          }}
        ></ButtonGroup>
      </div>

      {soundsFilter === soundFilterType.USER && soundEntries.length > 0 && (
        <ActionButton
          className="pl-2"
          label="delete-all"
          onClick={async () => {
            try {
              const confirmed = await confirmDialog('Delete all imported user samples?');
              if (confirmed) {
                clearIDB(userSamplesDBConfig.dbName);
                soundMap.set({});
                await prebake();
              }
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}

      <div className="min-h-0 max-h-full grow overflow-auto break-normal p-2">
        {soundEntries.map(([name, { data, onTrigger }]) => {
          return (
            <span
              key={name}
              className="cursor-pointer hover:opacity-50"
              onMouseDown={async () => {
                const ctx = getAudioContext();
                const params = {
                  note: ['synth', 'soundfont'].includes(data.type) ? 'a3' : undefined,
                  s: name,
                  n: numRef.current,
                  clip: 1,
                  release: 0.5,
                  sustain: 1,
                  duration: 0.5,
                };
                const onended = () => trigRef.current?.node?.disconnect();
                // Attempt to play the sample and retry every 200ms until 10 attempts have been reached
                let errMsg;
                for (let attempt = 0; attempt < 10; attempt++) {
                  try {
                    // Pre-load the sample by calling onTrigger with a future time
                    // This triggers the loading but schedules playback for later
                    const time = ctx.currentTime + 0.05; // Give 50ms for loading
                    const ref = await onTrigger(time, params, onended);
                    trigRef.current = ref;
                    if (ref?.node) {
                      connectToDestination(ref.node);
                      break;
                    }
                  } catch (err) {
                    errMsg = err;
                  }
                  if (attempt == 9) {
                    console.warn('Failed to trigger sound after 10 attempts' + (errMsg ? `: ${errMsg}` : ''));
                  } else {
                    await wait(200);
                  }
                }
              }}
            >
              {' '}
              {name}
              {data?.type === 'sample' ? `(${getSamples(data.samples)})` : ''}
              {data?.type === 'wavetable' ? `(${getSamples(data.tables)})` : ''}
              {data?.type === 'soundfont' ? `(${data.fonts.length})` : ''}
            </span>
          );
        })}
        {!soundEntries.length && soundsFilter === 'importSounds' ? (
          <div className="prose dark:prose-invert min-w-full text-sm">
            <ImportSoundsButton onComplete={() => settingsMap.setKey('soundsFilter', 'user')} />
            <p>
              To import sounds into strudel, they must be contained{' '}
              <a href={`${baseNoTrailing}/learn/samples/#from-disk-via-import-sounds-folder`} target="_blank">
                within a folder or subfolder
              </a>
              . The best way to do this is to upload a “samples” folder containing subfolders of individual sounds or
              soundbanks (see diagram below).{' '}
            </p>
            <pre className="bg-background" key={'sample-diagram'}>
              {`└─ samples <-- import this folder
   ├─ swoop
   │  ├─ swoopshort.wav
   │  ├─ swooplong.wav
   │  └─ swooptight.wav
   └─ smash
      ├─ smashhigh.wav
      ├─ smashlow.wav
      └─ smashmiddle.wav`}
            </pre>
            <p>
              The name of a subfolder corresponds to the sound name under the “user” tab. Multiple samples within a
              subfolder are all labelled with the same name, but can be accessed using “.n( )” - remember sounds are
              zero-indexed and in alphabetical order!
            </p>
            <p>
              For more information, and other ways to use your own sounds in strudel,{' '}
              <a href={`${baseNoTrailing}/learn/samples/#from-disk-via-import-sounds-folder`} target="_blank">
                check out the docs
              </a>
              !
            </p>
            <h3>Preview Sounds</h3>
            <pre className="bg-background" key={'sample-preview'}>
              n("0 1 2 3 4 5").s("sample-name")
            </pre>
            <p>
              Paste the line above into the main editor to hear the uploaded folder. Remember to use the name of your
              sample as it appears under the "user" tab.
            </p>
          </div>
        ) : (
          ''
        )}
        {!soundEntries.length && soundsFilter !== 'importSounds'
          ? search == ''
            ? 'No sounds loaded'
            : 'No sounds found'
          : ''}
      </div>
    </div>
  );
}
