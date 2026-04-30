import { code2hash, errorLogger, evalScope, hash2code, logger } from '@strudel/core';
import { settingPatterns } from '../settings.mjs';
import { setVersionDefaults } from '@strudel/webaudio';
import { getMetadata } from '../metadata_parser';
import { isTauri } from '../tauri.mjs';
import './Repl.css';
import { createClient } from '@supabase/supabase-js';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { $featuredPatterns /* , loadDBPatterns */ } from '@src/user_pattern_utils.mjs';

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  'https://pidxdsxphlhzjnzmifth.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZHhkc3hwaGxoempuem1pZnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTYyMzA1NTYsImV4cCI6MTk3MTgwNjU1Nn0.bqlw7802fsWRnqU5BLYtmXk_k-D1VFmbkHMywWc15NM',
);

let dbLoaded;
/* if (typeof window !== 'undefined') {
  dbLoaded = loadDBPatterns();
} */

export async function initCode() {
  // load code from url hash (either short hash from database or decode long hash)
  try {
    const initialUrl = window.location.href;
    const hash = initialUrl.split('?')[1]?.split('#')?.[0]?.split('&')[0];
    const codeParam = window.location.href.split('#')[1] || '';
    if (codeParam) {
      // looking like https://strudel.cc/#ImMzIGUzIg%3D%3D (hash length depends on code length)
      return hash2code(codeParam);
    } else if (hash) {
      // looking like https://strudel.cc/?J01s5i1J0200 (fixed hash length)
      return supabase
        .from('code_v1')
        .select('code')
        .eq('hash', hash)
        .then(({ data, error }) => {
          if (error) {
            console.warn('failed to load hash', error);
          }
          if (data.length) {
            //console.log('load hash from database', hash);
            return data[0].code;
          }
        });
    }
  } catch (err) {
    console.warn('failed to decode', err);
  }
}

export const parseJSON = (json) => {
  json = json != null && json.length ? json : '{}';
  try {
    return JSON.parse(json);
  } catch {
    return '{}';
  }
};

export async function getRandomTune() {
  await dbLoaded;
  const featuredTunes = Object.entries($featuredPatterns.get());
  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const [_, data] = randomItem(featuredTunes);
  return data;
}

// Optional dynamic import — resolves to a no-op module when the
// requested package isn't installed (lite install profile). Lets us
// list every Strudel workspace package below without forcing each one
// onto the dependency tree. Required packages still use plain
// `import()` so a real missing-dep bug surfaces loudly.
function optionalImport(path) {
  return import(/* @vite-ignore */ path).catch((err) => {
    // eslint-disable-next-line no-console
    console.info(`[loadModules] optional package not installed: ${path} (${err.message})`);
    return {};
  });
}

export function loadModules() {
  // Required core — always present in both lite and full installs.
  let modules = [
    import('@strudel/core'),
    import('@strudel/draw'),
    import('@strudel/edo'),
    import('@strudel/tonal'),
    import('@strudel/mini'),
    import('@strudel/xen'),
    import('@strudel/webaudio'),
    import('@strudel/codemirror'),
    import('@strudel/hydra'),
    import('@strudel/soundfonts'),
    import('@strudel/mondo'),
    // Optional — only loaded if the matching workspace package is
    // installed (see pnpm-workspace.full.yaml for the opt-in profile).
    optionalImport('@strudel/serial'),
    optionalImport('@strudel/csound'),
    optionalImport('@strudel/tidal'),
    optionalImport('@strudel/gamepad'),
    optionalImport('@strudel/motion'),
    optionalImport('@strudel/mqtt'),
  ];
  if (isTauri()) {
    modules = modules.concat([
      optionalImport('@strudel/desktopbridge/loggerbridge.mjs'),
      optionalImport('@strudel/desktopbridge/midibridge.mjs'),
      optionalImport('@strudel/desktopbridge/oscbridge.mjs'),
    ]);
  } else {
    modules = modules.concat([import('@strudel/midi'), import('@strudel/osc')]);
  }

  return evalScope(settingPatterns, ...modules);
}
// confirm dialog is a promise in webkit and a boolean in other browsers... normalize it to be a promise everywhere
export function confirmDialog(msg) {
  const confirmed = confirm(msg);
  if (confirmed instanceof Promise) {
    return confirmed;
  }
  return new Promise((resolve) => {
    resolve(confirmed);
  });
}
export const SETTING_CHANGE_RELOAD_MSG = 'Changing this setting requires the window to reload itself. OK?';

export function confirmAndReloadPage(onSuccess) {
  confirmDialog(SETTING_CHANGE_RELOAD_MSG).then((r) => {
    if (r == true) {
      try {
        onSuccess();
        return window.location.reload();
      } catch (e) {
        errorLogger(e);
      }
    }
  });
}
//RIP due to SPAM
// let lastShared;
// export async function shareCode(codeToShare) {
//   // const codeToShare = activeCode || code;
//   if (lastShared === codeToShare) {
//     logger(`Link already generated!`, 'error');
//     return;
//   }

//   confirmDialog(
//     'Do you want your pattern to be public? If no, press cancel and you will get just a private link.',
//   ).then(async (isPublic) => {
//     const hash = nanoid(12);
//     const shareUrl = window.location.origin + window.location.pathname + '?' + hash;
//     const { error } = await supabase.from('code_v1').insert([{ code: codeToShare, hash, ['public']: isPublic }]);
//     if (!error) {
//       lastShared = codeToShare;
//       // copy shareUrl to clipboard
//       if (isTauri()) {
//         await writeText(shareUrl);
//       } else {
//         await navigator.clipboard.writeText(shareUrl);
//       }
//       const message = `Link copied to clipboard: ${shareUrl}`;
//       alert(message);
//       // alert(message);
//       logger(message, 'highlight');
//     } else {
//       console.log('error', error);
//       const message = `Error: ${error.message}`;
//       // alert(message);
//       logger(message);
//     }
//   });
// }

export async function shareCode(codeToShare) {
  try {
    const hash = '#' + code2hash(codeToShare);
    const shareUrl = window.location.origin + window.location.pathname + hash;
    if (isTauri()) {
      await writeText(shareUrl);
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
    const message = `Link copied to clipboard!`;
    alert(message);
    logger(message, 'highlight');
  } catch (e) {
    console.error(e);
  }
}

export const isIframe = () => window.location !== window.parent.location;
function isCrossOriginFrame() {
  try {
    return !window.top.location.hostname;
  } catch (e) {
    return true;
  }
}

export const isUdels = () => {
  if (isCrossOriginFrame()) {
    return false;
  }
  return window.top?.location?.pathname.includes('udels');
};

export function setVersionDefaultsFrom(code) {
  try {
    const metadata = getMetadata(code);
    setVersionDefaults(metadata.version);
  } catch (err) {
    console.error('Error parsing metadata..');
    console.error(err);
  }
}
