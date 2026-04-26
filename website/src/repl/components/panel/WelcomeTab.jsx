import { useSettings } from '@src/settings.mjs';

const { BASE_URL } = import.meta.env;
const baseNoTrailing = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

export function WelcomeTab({ context }) {
  const { fontFamily } = useSettings();
  return (
    <div className="prose dark:prose-invert min-w-full py-4 font-sans px-4 text-sm" style={{ fontFamily }}>
      <h3>welcome</h3>
      <p>
        You have found <span className="underline">VibeRave</span>, a voice-driven live-coding music environment
        built on <a href="https://codeberg.org/uzu/strudel" target="_blank">Strudel</a>. Free and open-source. To get
        started:
        <br />
        <br />
        <span className="underline">1. hit play</span> - <span className="underline">2. change something</span> -{' '}
        <span className="underline">3. hit update</span>
        {/* <br />
        If you don't like what you hear, try <span className="underline">shuffle</span>! */}
      </p>
      <p>
        {/* To learn more about what this all means, check out the{' '} */}
        To get started, check out the{' '}
        <a href={`${baseNoTrailing}/workshop/getting-started/`} target="_blank">
          interactive tutorial
        </a>
        . Also feel free to join the{' '}
        <a href="https://discord.com/invite/HGEdXmRkzT" target="_blank">
          discord channel
        </a>{' '}
        to ask any questions, give feedback or just say hello.
      </p>
      <h3>about</h3>
      <p>
        VibeRave wraps{' '}
        <a href="https://codeberg.org/uzu/strudel" target="_blank">
          Strudel
        </a>
        , a JavaScript port of{' '}
        <a href="https://tidalcycles.org/" target="_blank">
          tidalcycles
        </a>
        , with voice input and an LLM that rewrites the running pattern from natural language. Free/open source under
        the{' '}
        <a href="https://codeberg.org/uzu/strudel/src/branch/main/LICENSE" target="_blank">
          GNU Affero General Public License
        </a>
        . You can find the source code at{' '}
        <a href="https://codeberg.org/uzu/strudel" target="_blank">
          codeberg
        </a>
        . You can also find <a href="https://github.com/felixroos/dough-samples/blob/main/README.md">licensing info</a>{' '}
        for the default sound banks there. Please consider to{' '}
        <a href="https://opencollective.com/tidalcycles" target="_blank">
          support this project
        </a>{' '}
        to ensure ongoing development 💖
      </p>
    </div>
  );
}
