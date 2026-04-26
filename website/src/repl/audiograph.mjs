/*
audiograph.mjs - show a svg view of the web audio API graph built during a playback
Copyright (C) 2025 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/website/src/repl/audiograph.mjs>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// main entry point is `debugAudiograph`
import { logger } from '@strudel/core';
import { getAudioContext, getSuperdoughAudioController, webaudioOutput } from '@strudel/webaudio';

let mermaid = null;
let svgPanZoom = null;

let running = false;
let hap_count = 0;

let cache = new Map();
const initCache = JSON.stringify({
  connect: [],
  where: [],
  disconnectAll: 0,
  disconnectOne: 0,
  hasStop: false,
  stopCount: 0,
  ac: null,
  creation: null,
});

let toggleOrig;

function stackTrace() {
  var err = new Error();
  const stacktrace = err.stack;
  const lines = stacktrace.split('\n');
  let lineIndex = lines.findIndex((line) => line !== 'Error' && !line.includes('audiograph.mjs'));
  if (lines[lineIndex].includes('gainNode')) lineIndex++;
  if (lines[lineIndex].includes('getWorklet')) lineIndex++;
  const line = lines[lineIndex].replace(/\s*at\s/, '').replace('http', '@');
  let match;
  match = line.match(/([^@]*)@.*packages(\/[^:]+:\d+:\d+)/);
  if (match) {
    return match[1].replace(/[^.:/a-zA-Z0-9]/g, '') + '@' + match[2].replace(/[^.:/a-zA-Z0-9]/g, '');
  }
  return '@';
}

// This captures all AudioNodes lazily
// when an `.audioid` property is called
// no solution was found to hook
// AudioNode's constructor directly
let audioid = 0;
const lazyRegister = (o) => {
  Object.defineProperty(o.prototype, 'audioid', {
    get: function () {
      if (!this._audioid) {
        this._audioid = ++audioid;
        const s = JSON.parse(initCache);
        s.type = this.constructor.name === 'AudiographNode' ? this.constructor._parentClassName : this.constructor.name;
        // special case for subclassed AudioNodes
        // they are implemented in superdough but hard to get a reference on here
        // they are not AudioScheduledSourceNodes anyway
        if (['FeedbackDelayNode', 'VowelNode'].indexOf(s.type) === -1) {
          s.hasStop = window[s.type].prototype instanceof AudioScheduledSourceNode;
        }
        s.ac = this.context?.constructor.name || 'AudioParam';
        s.creation = s.creation || stackTrace();
        cache.set(this._audioid, s);
      }
      return this._audioid;
    },
    enumerable: false,
    configurable: true,
  });
};

// extend a specific AudioNode's constructor
// necessary when creation is done direclty by
// calling the constructor
// eg: new GainNode(...)
const audioNodeHook = (node) => {
  const name = node.prototype.constructor.name;
  const PatchedNode = class AudiographNode extends node {
    constructor(...args) {
      super(...args);
      // trigger the lazy register
      this._audioid = this.audioid;
    }
  };
  PatchedNode._parentClassName = name;
  window[name] = PatchedNode;
};

const drawMessage = async function (message) {
  const element = document.querySelector('.strudel-mermaid');
  let gd = '';
  gd += '---\n';
  gd += 'config:\n';
  gd += '  flowchart:\n';
  gd += '    wrappingWidth: 600\n';
  gd += '---\n';
  gd += 'flowchart LR\n';
  gd += 'id[' + message.replaceAll(' ', '&nbsp;') + ']\n';

  let { svg } = await mermaid.render('strudelSvgId', gd);
  svg = svg.replace(/max-width:\s[0-9.]*px;/i, 'height: 100%');
  svg = svg.replaceAll('&amp;nbsp;', ' ');
  element.innerHTML = svg;
};

const drawDiagram = async function () {
  const element = document.querySelector('.strudel-mermaid');
  let code = window.strudelMirror.code;
  code = code.replace(/^await debugAudiograph.*\n?/gm, '');
  code = '// date: ' + new Date().toISOString() + '\n\n' + code;
  code = '// host: ' + document.location.hostname + '\n' + code;
  const codeLines = code.split(/(?:\n|\r\n?)/);
  const maxLineLength = codeLines.reduce((memo, line) => Math.max(memo, line.length), 0);

  // https://mermaid.js.org/syntax/flowchart.html
  let gd = '';
  gd += '---\n';
  gd += 'config:\n';
  gd += '  flowchart:\n';
  gd += '    wrappingWidth: ' + 14 * maxLineLength + '\n';
  gd += '---\n';
  gd += 'flowchart TB\n';
  gd += '\tsubgraph AG[STRUDEL AUDIOGRAPH]\n';

  // seed graph builder with all
  // unconnected nodes
  let lookup = [];
  cache.forEach((v, k) => {
    if (v.connect.length === 0) lookup.push(k);
  });
  const relations = [];
  let curRelations;
  const zombieCount = 0;
  const sourceLoc = (stack) => {
    if (stack === '@') return stack;
    return stack.replace('@', '\n').replace('/superdough/', '/');
  };
  const label = (s) => {
    const source = s.creation ? '\n' + sourceLoc(s.creation) : '';
    let lb = '[' + '**' + s.type + '**' + source + ']';
    if (s.ac === 'OfflineAudioContext') lb = '[' + lb + ']';
    return lb;
  };
  const isConnectLeak = (s) => {
    return (
      ['AudioDestinationNode', 'AudioParam'].indexOf(s.type) === -1 &&
      s.disconnectAll === 0 &&
      s.connect.length > s.disconnectOne
    );
  };
  const isStopLeak = (s) => {
    return s.hasStop && s.stopCount === 0;
  };
  do {
    curRelations = relations.length;
    lookup.slice().forEach((n) => {
      cache.forEach((v, k) => {
        if (v.connect.indexOf(n) !== -1) {
          if (lookup.indexOf(k) === -1) lookup.push(k);
          gd += v.connect
            .map((i) => {
              if (lookup.indexOf(i) === -1) lookup.push(i);
              if (relations.indexOf(k + '-' + i) === -1) {
                relations.push(k + '-' + i);
                return (
                  '\t\tnode' +
                  k +
                  label(v) +
                  ' -- ' +
                  sourceLoc(v.where[0]) +
                  ' --> node' +
                  i +
                  label(cache.get(i)) +
                  '\n'
                );
              }
            })
            .join('');
        }
        if (k === n) {
          gd += v.connect
            .map((i) => {
              if (lookup.indexOf(i) === -1) lookup.push(i);
              if (relations.indexOf(k + '-' + i) === -1) {
                relations.push(k + '-' + i);
                return (
                  '\t\tnode' +
                  k +
                  label(v) +
                  ' -- ' +
                  sourceLoc(v.where[0]) +
                  ' --> node' +
                  i +
                  label(cache.get(i)) +
                  '\n'
                );
              }
            })
            .join('');
        }
      });
    });
  } while (relations.length > curRelations /*&& lookup.length < 100*/);
  // add orphan nodes
  const inRelation = '-' + relations.join('-') + '-';
  cache.forEach((v, k) => {
    if (!inRelation.includes('-' + k + '-')) {
      gd += '\t\tnode' + k + label(v) + '\n';
    }
  });

  const codePlaceholder = 'm'.repeat(maxLineLength);
  gd += '\tsubgraph LEGEND\n';
  gd += '\t\tlegend1[in AudioContext]\n';
  gd += '\t\tlegend2[[in OfflineAudioContext]]\n';
  gd += '\t\tlegend3[not disconnected]\n';
  gd += '\t\tlegend4[AudioParam]\n';
  gd += '\t\tlegend5[AudioDestinationNode]\n';
  gd += '\t\tlegend6[not stopped]\n';
  gd += '\tend\n';
  gd += '\tsubgraph CODE[Strudel Code]\n';
  // we use a codePlaceholder to
  // - avoid problems with special chars
  // - stop mermaid to split lines on space with multiple tspans
  // - force mermaid to prepare a sufficiently sized zone
  gd += '\ncode[' + (codePlaceholder + '<br>').repeat(codeLines.length) + ']\n';
  gd += '\tend\n';
  gd += '\tend\n';
  gd += '\tclassDef audioparam fill:#6f6;\n';
  gd += '\tclassDef destination fill:#99f;\n';
  gd += '\tclassDef connectleak fill:#f96,stroke:#f00,stroke-width:2px;\n';
  gd += '\tclassDef stopleak fill:#f55,stroke:#f00,stroke-width:2px;\n';
  gd += '\tclass legend3 connectleak;\n';
  gd += '\tclass legend4 audioparam;\n';
  gd += '\tclass legend5 destination;\n';
  gd += '\tclass legend6 stopleak;\n';
  cache.forEach((v, k) => {
    if (isConnectLeak(v)) {
      gd += '\tclass node' + k + ' connectleak;\n';
    } else if (isStopLeak(v)) {
      gd += '\tclass node' + k + ' stopleak;\n';
    }
    if (v.type === 'AudioParam') {
      gd += '\tclass node' + k + ' audioparam;\n';
    }
    if (v.type === 'AudioDestinationNode') {
      gd += '\tclass node' + k + ' destination;\n';
    }
  });
  let { svg } = await mermaid.render('strudelSvgId', gd);

  // put real code in code zone
  let idx = 0;
  const escapeHtml = (unsafe) => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
  svg = svg.replaceAll(codePlaceholder, () => escapeHtml(codeLines[idx++]));

  // improve sizing on web page
  svg = svg.replace(/max-width:\s[0-9.]*px;/i, 'height: 100%');
  element.innerHTML = svg;

  // align the code lines
  let svgText = document.querySelector('[id^=flowchart-code] text');
  svgText.setAttributeNS(null, 'style', 'text-anchor: start;');
  const svgElement = document.querySelector('svg');
  const svgLabel = document.querySelector('svg [id^=flowchart-code] .label');
  const transformList = svgLabel.transform.baseVal;
  const svgTransform = svgElement.createSVGTransform();
  const tspans = Array.from(document.querySelectorAll('[id^=flowchart-code] tspan.text-inner-tspan'));
  let tspansMaxLength = tspans.reduce((memo, tspan) => Math.max(memo, tspan.getComputedTextLength()), 0);
  svgTransform.setTranslate(-tspansMaxLength / 2, 0);
  transformList.appendItem(svgTransform);

  let doPan = false;
  let eventsHandler;
  let panZoom;
  let mousepos;

  eventsHandler = {
    haltEventListeners: ['mousedown', 'mousemove', 'mouseup'],
    mouseDownHandler: function (ev) {
      if (event.target.className == '[object SVGAnimatedString]') {
        doPan = true;
        mousepos = {
          x: ev.clientX,
          y: ev.clientY,
        };
      }
    },
    mouseMoveHandler: function (ev) {
      if (doPan) {
        panZoom.panBy({
          x: ev.clientX - mousepos.x,
          y: ev.clientY - mousepos.y,
        });
        mousepos = {
          x: ev.clientX,
          y: ev.clientY,
        };
        window.getSelection().removeAllRanges();
      }
    },
    mouseUpHandler: function (ev) {
      doPan = false;
    },
    init: function (options) {
      options.svgElement.addEventListener('mousedown', this.mouseDownHandler, false);
      options.svgElement.addEventListener('mousemove', this.mouseMoveHandler, false);
      options.svgElement.addEventListener('mouseup', this.mouseUpHandler, false);
    },
    destroy: function (options) {
      options.svgElement.removeEventListener('mousedown', this.mouseDownHandler, false);
      options.svgElement.removeEventListener('mousemove', this.mouseMoveHandler, false);
      options.svgElement.removeEventListener('mouseup', this.mouseUpHandler, false);
    },
  };
  panZoom = svgPanZoom('#strudelSvgId', {
    zoomEnabled: true,
    controlIconsEnabled: true,
    fit: 1,
    center: 1,
    zoomScaleSensitivity: 0.4,
    customEventsHandler: eventsHandler,
  });
};

const svgExport = async () => {
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style = 'display: none';

  const selector = '.strudel-mermaid';
  const bbox = document.querySelector('svg g').getBBox();
  let transform, style;
  // clean pan-zoom viewport
  const pzViewport = document.querySelector('.svg-pan-zoom_viewport');
  if (pzViewport) {
    transform = pzViewport.transform;
    style = pzViewport.style;
    pzViewport.setAttribute('transform', '');
    pzViewport.style = '';
  }

  const spzMin = await fetch('https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.2/dist/svg-pan-zoom.min.js').then((res) =>
    res.text(),
  );

  const scriptContent = '<![CDATA[' + spzMin + ';svgPanZoom("svg");]]>';
  // prepare svg
  const content = document
    .querySelector(selector)
    .innerHTML.replaceAll('<br>', '<br/>')
    // remove useless tags
    .replace(/<g id="svg-pan-zoom.*<\/g>/, '<script>' + scriptContent + '</script>')
    .replace(/<defs>.*<\/defs>/, '')
    // give inkscape true sizes
    .replace('width="100%"', 'width="' + bbox.width + '" height="' + bbox.height + '"');

  // restore pan-zoom viewport
  if (pzViewport) {
    pzViewport.setAttribute('transform', transform);
    pzViewport.style = style;
  }

  // trigger download
  var blob = new Blob([content], { type: 'image/svg+xml' }),
    url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = 'audiograph.svg';
  a.click();
  window.URL.revokeObjectURL(url);
};

const resetAudioOutput = function (audioid) {
  // calling reset on SuperdoughAudioController
  // will discard output nodes AND recreate them
  // so we keep the same `cache` to handle the
  // `disconnects` knowing that new nodes will be
  // stricly after the current audioid.
  // then we purge the old nodes from the `cache`
  // to have a clean state

  // make sure destination will be recreated in the
  // cache
  const destination = getAudioContext().destination;
  if (destination._audioid) delete destination._audioid;

  const sac = getSuperdoughAudioController();
  sac.reset();
  Array.from(cache.keys()).map((k) => {
    if (k <= audioid) cache.delete(k);
  });
};

const postProcessing = async function () {
  hap_count = 0;
  await drawDiagram();

  resetAudioOutput(audioid);
};

const defaultOptions = {
  StopAfterHapCount: 10,
  hapsBatch: 0,
  maxEdges: 10000,
  maxTextSize: 200000,
  audioAPIBreathingRoomSec: 5,
};

// `StopAfterHapCount` :
//         The player will auto-stop after hap count have
//         been played. when StopAfterHapCount = 0, it will
//         continue playing until 'stop' is clicked
// `audioAPIBreathingRoomSec` :
//         how much time should we wait after 'stop' to let
//         the audioAPI finish its tail of ondended calls
// `hapsBatch` :
//         the AudioGraph will be displayed every hapsBatch haps
//         when hapsBatch = 0, AudioGraph will only be displayed
//         after and auto-stop or after 'stop' is clicked
//         In hapsBatch mode you will probably see a trailing of
//         non disconnected notes on the graph because the audio
//         API may have some lag disconnecting them
//         cf also audioAPIBreathingRoomSec
// `maxEdges`
//         This is a mermaid.js config that forces a hard limit
//         on the maximum number of Edges of a graph
//         needs a reload to be taken into account
// `maxTextSize`
//         This is a mermaid.js config that forces a hard limit
//         on the maximum text size of a graph definition
//         needs a reload to be taken into account

export const debugAudiograph = async (argOptions = {}) => {
  const options = Object.assign({}, defaultOptions, argOptions);
  const { StopAfterHapCount, hapsBatch, maxEdges, maxTextSize, audioAPIBreathingRoomSec } = options;
  const sm = window.strudelMirror;
  const code = sm.code;
  if (!code.match(/await\s+debugAudiograph/)) {
    throw new Error('you need to call `await debugAudiograph()` for audiograph to work');
  }
  const emptyOptions = /await\s+debugAudiograph\(\)/.exec(code);
  if (emptyOptions) {
    const cutCode = emptyOptions.index + emptyOptions[0].length - 1;
    const codeOptions = JSON.stringify({ StopAfterHapCount: StopAfterHapCount }).replaceAll('"', '');
    sm.setCode(code.slice(0, cutCode) + codeOptions + code.slice(cutCode));
  }

  if (window.audiograph === undefined) {
    const ag = (window.audiograph = {});

    toggleOrig = sm.toggle;

    ////////////////////////////////////////
    // step 1: web audio api instrumentation
    ////////////////////////////////////////

    // path AudioNode & AudioParam
    // to give them lazy ids
    // this captures both `ac.createGain`
    // and `new GainNode(..)` patterns
    lazyRegister(AudioNode);
    lazyRegister(AudioParam);
    lazyRegister(PeriodicWave);

    const audioNodes = [
      AudioBufferSourceNode,
      AudioWorkletNode,
      AnalyserNode,
      BiquadFilterNode,
      ChannelMergerNode,
      ChannelSplitterNode,
      ConstantSourceNode,
      ConvolverNode,
      DelayNode,
      DynamicsCompressorNode,
      GainNode,
      IIRFilterNode,
      OscillatorNode,
      PannerNode,
      StereoPannerNode,
      WaveShaperNode,
    ];
    audioNodes.map((n) => {
      if (n.prototype instanceof AudioScheduledSourceNode) {
        const stopOrig = n.prototype.stop;
        n.prototype.stop = function (...args) {
          // stop called
          const result = stopOrig.call(this, ...args);
          const s = cache.get(this.audioid);
          s.stopCount++;
          return result;
        };
      }
      audioNodeHook(n);
    });

    // patch BaseAudioContext factory methods
    // to capture the source reference
    Object.getOwnPropertyNames(BaseAudioContext.prototype)
      .filter((n) => n.startsWith('create') && ['createBuffer'].indexOf(n) === -1)
      .map((name) => {
        const orig = BaseAudioContext.prototype[name];
        BaseAudioContext.prototype[name] = function (...args) {
          const result = orig.call(this, ...args);
          const s = cache.get(result.audioid);
          s.creation = stackTrace();
          return result;
        };
      });

    const connectOrig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...args) {
      const result = connectOrig.call(this, destination, ...args);
      const s = cache.get(this.audioid);
      s.connect.push(destination.audioid);
      s.where.push(stackTrace());
      return result;
    };

    const disconnectOrig = AudioNode.prototype.disconnect;
    AudioNode.prototype.disconnect = function (destination, ...args) {
      const result = disconnectOrig.call(this, destination, ...args);
      const s = cache.get(this.audioid);
      if (s.connect.length) {
        if (destination) {
          s.disconnectOne++;
        } else {
          s.disconnectAll++;
        }
      } else {
        logger('WEIRD: node ' + this.audioid + 'called disconnect before any call to connect !');
        //logger(new Error().stack);
        console.log(cache);
      }
      return result;
    };

    // call reset 2 times to handle reload + 'play'
    // the first reset's disconnect adds audioid tags on previous outputs
    // that were not tagged (wrong cutoff)
    resetAudioOutput(audioid);
    // the second reset has the correct audioid cutoff
    resetAudioOutput(audioid);

    ////////////////////////////////////////
    // step 2: Load external modules
    ////////////////////////////////////////

    const { default: mermaidModule } = await import(
      'https://cdn.jsdelivr.net/npm/mermaid@11.12.1/dist/mermaid.esm.mjs'
    );
    mermaid = mermaidModule;

    mermaid.initialize({
      startOnLoad: false,
      themeCSS: '.flowchart { height: 100%; }',
      maxEdges: maxEdges,
      maxTextSize: maxTextSize,
      htmlLabels: false,
      flowchart: {
        htmlLabels: false,
      },
    });

    const { default: svgPanZoomModule } = await import('https://esm.sh/svg-pan-zoom');
    svgPanZoom = svgPanZoomModule;

    //////////////////////////////////////////
    // step 3: UI modifications
    //////////////////////////////////////////

    // add audiograph panel
    if (!document.querySelector('.strudel-mermaid')) {
      const mermaidDiv = document.createElement('div');
      mermaidDiv.className = 'strudel-mermaid';
      mermaidDiv.style = 'min-height: 600px; width: 60%';
      const referenceNode = document.querySelector('#code');
      referenceNode.parentNode.insertBefore(mermaidDiv, referenceNode.nextSibling);
    }

    // add svg export button
    if (!document.querySelector('button[title=svg]')) {
      const exportButton = document.createElement('button');
      exportButton.innerHTML = '<span>ExportDiagram</span>';
      exportButton.title = 'svg';
      exportButton.onclick = svgExport;
      const updateButton = document.querySelector('button[title=update]');
      updateButton.parentNode.insertBefore(exportButton, updateButton);
    }
  }

  if (!running) {
    running = true;
  }

  if (hapsBatch === 0 || hap_count < hapsBatch) {
    let msg = '';
    msg += 'Recording activity...';
    msg += '\npress stop to build diagram';
    if (StopAfterHapCount) {
      msg += '\nwill stop automatically in ' + Math.max(StopAfterHapCount - hap_count, 0) + ' haps';
    }
    await drawMessage(msg);
  }

  sm.toggle = async () => {
    running = false;
    sm.toggle = toggleOrig;
    // schedule `toggle` on the js main loop
    // to avoid interfering with any on-flight onTick
    // not doing this can lead to a phase > 0 which will
    // break the next start
    setTimeout(sm.toggle.bind(sm), 0);
    await drawMessage('please wait ' + audioAPIBreathingRoomSec + ' seconds\n' + 'the audio API is finishing its work');
    setTimeout(postProcessing, audioAPIBreathingRoomSec * 1000);
  };

  /*global all*/
  all((pat) =>
    pat.onTrigger(async (hap, duration, cps, t) => {
      hap_count++;
      const key = Object.entries(hap.value)
        .map((param) => param.join('/'))
        .join('/');

      // if we reached StopAfterHapCount, click 'stop'
      if (StopAfterHapCount && hap_count > StopAfterHapCount) {
        if (running) {
          await sm.toggle();
        }
        // stop sending haps to superdough(...)
        return;
      }

      await webaudioOutput(hap, t, hap.duration / cps, cps, t);

      if (hapsBatch && hap_count % hapsBatch === 0) drawDiagram();
    }),
  );
};
