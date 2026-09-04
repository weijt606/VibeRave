// /stage — crowd-facing big screen. Subscribes to BroadcastChannel
// ('viberave-stage', CONTRACTS.md §6) and renders the Stage.dc.html layout
// (live) or Attract.dc.html (idle > 90 s / before first message) as DOM on
// top of the six-layer sun canvas (sunRenderer.mjs).
//
// Dev preview without a console tab: /stage?demo=1 (fake 124 bpm session
// loop) or /stage?demo=attract (audio only → attract mode). `?phase=day`
// overrides the phase in demo mode.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createSunRenderer } from './sunRenderer.mjs';
import { encodeQR, qrToPath } from './qr.mjs';

const CHANNEL = 'viberave-stage';
const ATTRACT_AFTER_MS = 90_000;
const HEARD_LINGER_MS = 20_000;
const DESIGN_W = 1920;
const DESIGN_H = 1080;

const PHASE_LABEL = {
  day: '白天 Day',
  afternoon: '午后 Afternoon',
  twilight: '傍晚 Twilight',
  night: '夜晚 Night',
};
const BUSY = new Set(['transcribing', 'generating', 'validating']);
const ATTRACT_PROMPTS = ['来点 lo-fi', '像海边的傍晚', '再快一点', '加个鼓', '来个 Drop'];
const TRACK_FALLBACK_COLORS = ['#F6C85F', '#F28BB8', '#6FA8FF', '#B8C0FF'];

function fmtClock(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "    .lpf(1800 → 400).room(0.4)," → [pre, old, new, post]
const ARROW_RE = /^(.*?)([^\s(),]+)\s*(?:→|->)\s*([^\s(),]+)(.*)$/;

function CodeLine({ line }) {
  if (!line.changed) return <div className="st-code">{line.text}</div>;
  const m = ARROW_RE.exec(line.text);
  if (!m) return <div className="st-code hi">{line.text}</div>;
  return (
    <div className="st-code hi">
      {m[1]}
      <span className="st-strike">{m[2]}</span> {m[3]}
      {m[4]}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 28 28" fill="none" stroke="var(--st-a-warm)" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
      <line x1="14" y1="2" x2="14" y2="8" /><line x1="14" y1="20" x2="14" y2="26" />
      <line x1="2" y1="14" x2="8" y2="14" /><line x1="20" y1="14" x2="26" y2="14" />
      <line x1="5.5" y1="5.5" x2="9.8" y2="9.8" /><line x1="18.2" y1="18.2" x2="22.5" y2="22.5" />
      <line x1="22.5" y1="5.5" x2="18.2" y2="9.8" /><line x1="9.8" y1="18.2" x2="5.5" y2="22.5" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--st-a3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11.5V4.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M14 11.5V6.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M17 11.5V8.5a1.5 1.5 0 0 1 3 0v5.5a7 7 0 0 1-7 7h-1.5a7 7 0 0 1-6-3.4L3.2 15a1.6 1.6 0 0 1 2.6-1.8L8 15.5" />
    </svg>
  );
}

function QrCard({ url }) {
  const qr = useMemo(() => {
    try {
      const q = encodeQR(url, { ecl: 'M' });
      return { size: q.size, d: qrToPath(q) };
    } catch {
      return null;
    }
  }, [url]);
  return (
    <div className="st-qrcard">
      <div className="st-qr">
        {qr && (
          <svg width="100" height="100" viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" aria-label={url}>
            <path d={qr.d} fill="#14122A" />
          </svg>
        )}
      </div>
      <div className="st-qrtext">
        <div className="st-qrtitle">扫码，认领一条光带</div>
        <div className="st-cap st-cap-sm">用你的手机说话 · 拧旋钮</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo feed (?demo=1 | ?demo=attract) — synthetic StageState / StageAudio /
// StageDiff messages so the page can be previewed without the console.
function startDemo(kind, emit, phase) {
  const bpm = 124;
  const beatMs = 60000 / bpm;
  const t0 = performance.now();
  const timers = [];
  const tracks = [
    { id: 't1', name: '鼓', color: '#F6C85F', playing: true, level: 0.6, caption: '909 · 四踩' },
    { id: 't2', name: '贝斯', color: '#F28BB8', playing: true, level: 0.5, caption: '锯齿 · 滤波 400' },
    { id: 't3', name: '旋律', color: '#6FA8FF', playing: true, level: 0.4, caption: 'F 小调 · 三音循环' },
    { id: 't4', name: '氛围', color: '#B8C0FF', playing: true, level: 0.3, caption: '暖垫 · 长混响' },
  ];
  const participants = [
    { name: '小红', trackId: 't1', color: '#F6C85F' },
    { name: '阿杰', trackId: 't2', color: '#F28BB8' },
    { name: 'Mia', trackId: 't3', color: '#6FA8FF' },
  ];
  const base = { type: 'state', phase, mode: 'adult', bpm, key: 'F minor', style: 'techno', lane: 'llm', tracks, participants };
  let cur = { status: 'idle', heard: '', target: '', explain: '' };
  const sendState = () => emit({ ...base, ...cur, ts: Date.now() });

  // Audio at 30 Hz: pulse on every beat, bass-heavy.
  let lastBeat = -1;
  timers.push(
    setInterval(() => {
      const el = performance.now() - t0;
      const beat = Math.floor(el / beatMs);
      const ph = (el % beatMs) / beatMs;
      const env = Math.exp(-ph * 5);
      const onset = beat !== lastBeat;
      lastBeat = beat;
      const bands = [0.35 + 0.6 * env, 0.3 + 0.5 * env, 0.35 + 0.2 * env, 0.3, 0.28 + 0.1 * Math.sin(el / 700), 0.22, 0.18, 0.12];
      emit({ type: 'audio', rms: 0.3 + 0.55 * env, bands, onset, ts: Date.now() });
    }, 33),
  );

  if (kind === 'attract') return () => timers.forEach(clearInterval);

  // Session script: listening → transcribing → generating → validating → applying → idle.
  const script = [
    { status: 'listening', dur: 1800, heard: '' },
    { status: 'listening', dur: 1400, heard: '来点更暗的，像日落之后' },
    { status: 'transcribing', dur: 700 },
    { status: 'generating', dur: 2600 },
    { status: 'validating', dur: 700 },
    { status: 'applying', dur: 600, diff: true },
    { status: 'idle', dur: 12000 },
  ];
  let idx = 0;
  let stepTimer = 0;
  const step = () => {
    const s = script[idx];
    cur = { ...cur, status: s.status };
    if (s.heard !== undefined) cur.heard = s.heard;
    if (s.status === 'transcribing') cur.target = '贝斯';
    if (s.diff) {
      cur.explain = '把贝斯的滤波从 1800 压到 400，留了混响，鼓没动。';
      emit({
        type: 'diff',
        trackName: '贝斯',
        lines: [
          { text: 'stack(', changed: false },
          { text: '  s("bd*4, ~ cp").bank("RolandTR909"),', changed: false },
          { text: '  note("f1 ~ ab1 f1").s("sawtooth")', changed: true },
          { text: '    .lpf(1800 → 400).room(0.4),', changed: true },
          { text: '  note("<f3 ab3 c4>").s("gm_pad_warm")', changed: false },
          { text: ')', changed: false },
        ],
        explain: cur.explain,
        ts: Date.now(),
      });
    }
    sendState();
    idx = (idx + 1) % script.length;
    stepTimer = setTimeout(step, s.dur);
  };
  step();
  timers.push(setInterval(sendState, 1000));
  return () => {
    timers.forEach(clearInterval);
    clearTimeout(stepTimer);
  };
}

// ---------------------------------------------------------------------------
export function StageView() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const audioRef = useRef(null);
  const attractRef = useRef(true);
  const lastActiveRef = useRef(0);
  const busyStartRef = useRef(0);
  const heardUntilRef = useRef(0);

  const [state, setState] = useState(null);
  const [diff, setDiff] = useState(null);
  const [macro, setMacro] = useState(null);
  const [attract, setAttract] = useState(true);
  const [clock, setClock] = useState(() => fmtClock());
  const [elapsed, setElapsed] = useState(0);
  const [heardVisible, setHeardVisible] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [promptIdx, setPromptIdx] = useState(0);
  const [promptFade, setPromptFade] = useState(false);
  const [scale, setScale] = useState(1);
  const [remoteUrl, setRemoteUrl] = useState('');

  const params = useMemo(() => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()), []);
  const demo = params.get('demo');
  const phase = state?.phase || (demo ? params.get('phase') || 'night' : 'night');
  const mode = state?.mode || 'adult';

  // Bridge subscription -----------------------------------------------------
  useEffect(() => {
    setRemoteUrl(`${location.origin}/remote`);
    const handle = (msg) => {
      if (!msg || typeof msg !== 'object') return;
      const now = performance.now();
      switch (msg.type) {
        case 'state': {
          stateRef.current = msg;
          setState(msg);
          const status = msg.status || 'idle';
          if (status !== 'idle') {
            lastActiveRef.current = now;
            if (attractRef.current) {
              attractRef.current = false;
              setAttract(false);
            }
          }
          if (BUSY.has(status)) {
            if (!busyStartRef.current) busyStartRef.current = now;
          } else {
            busyStartRef.current = 0;
          }
          if (msg.heard) {
            if (status !== 'idle') heardUntilRef.current = Infinity;
            else if (heardUntilRef.current === Infinity) heardUntilRef.current = now + HEARD_LINGER_MS;
            else if (!heardUntilRef.current) heardUntilRef.current = now + HEARD_LINGER_MS;
            setHeardVisible(now < heardUntilRef.current);
          } else {
            heardUntilRef.current = 0;
            setHeardVisible(false);
          }
          if (status === 'applying') setFlashKey((k) => k + 1);
          break;
        }
        case 'audio':
          audioRef.current = msg;
          break;
        case 'diff':
          setDiff(msg);
          setFlashKey((k) => k + 1);
          break;
        case 'macro':
          setMacro(msg);
          break;
        default:
          break;
      }
    };

    let bc = null;
    try {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (e) => handle(e.data);
    } catch {
      /* BroadcastChannel unavailable — page stays in attract mode */
    }
    const stopDemo = demo ? startDemo(demo, handle, params.get('phase') || 'night') : null;
    return () => {
      bc?.close();
      stopDemo?.();
    };
  }, [demo, params]);

  // Housekeeping tick: attract timeout, busy timer, heard linger, clock -----
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      if (!attractRef.current && now - lastActiveRef.current > ATTRACT_AFTER_MS) {
        attractRef.current = true;
        setAttract(true);
      }
      if (busyStartRef.current) setElapsed(now - busyStartRef.current);
      if (heardUntilRef.current && heardUntilRef.current !== Infinity && now > heardUntilRef.current) {
        heardUntilRef.current = 0;
        setHeardVisible(false);
      }
      setClock((c) => {
        const n = fmtClock();
        return n === c ? c : n;
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Attract prompt rotation --------------------------------------------------
  useEffect(() => {
    if (!attract) return undefined;
    const id = setInterval(() => {
      setPromptFade(true);
      setTimeout(() => {
        setPromptIdx((i) => (i + 1) % ATTRACT_PROMPTS.length);
        setPromptFade(false);
      }, 600);
    }, 6000);
    return () => clearInterval(id);
  }, [attract]);

  // Phase / mode on <html> (the console sets it in its own tab; we run alone).
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.phase = phase;
    el.dataset.mode = mode;
  }, [phase, mode]);

  // Canvas + scale wrapper ----------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const renderer = createSunRenderer(canvas);
    const fit = () => {
      renderer.resize();
      const s = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      setScale(s);
    };
    fit();
    window.addEventListener('resize', fit);
    let raf = 0;
    const loop = (t) => {
      renderer.render({ phase: stateRef.current?.phase || phase, attract: attractRef.current }, audioRef.current, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      renderer.dispose();
    };
    // `phase` only seeds the first frames before a state arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived view data --------------------------------------------------------
  const status = state?.status || 'idle';
  const tracks = Array.isArray(state?.tracks) ? state.tracks : [];
  const participants = Array.isArray(state?.participants) ? state.participants : [];
  const trackById = useMemo(() => Object.fromEntries(tracks.map((t) => [t.id, t])), [tracks]);
  const target = state?.target || diff?.trackName || '';
  const explain = diff?.explain || state?.explain || '';
  const targetColor = tracks.find((t) => t.name === target)?.color || 'var(--st-a-warm)';
  const showCode = !attract && (diff || BUSY.has(status) || status === 'applying');
  const heardText = state?.heard || '';
  const listening = status === 'listening';
  const showHeard = !attract && (listening || (heardVisible && heardText));
  const macroActive = macro && Date.now() - (macro.ts || 0) < 1500;

  const rootStyle = { '--st-scale': scale };

  return (
    <div ref={rootRef} className={`mn-stage${attract ? ' is-attract' : ''}`} data-phase={phase} data-mode={mode} data-status={status} style={rootStyle}>
      <canvas ref={canvasRef} className="st-canvas" aria-hidden="true" />

      <div className="st-ui">
        {/* identity */}
        <div className="st-identity">
          <SunIcon />
          <div className="st-brand">VIBERAVE</div>
          <div className="st-cap">{attract ? '× Mañana 明日公园 · 04 生长' : '× Mañana · 你说，代码就变'}</div>
        </div>

        {attract ? (
          <>
            <div className="st-cap st-topright-cap">海口 Haikou · 10.23 – 10.25</div>
            <div className="st-attract">
              <div className="st-cap st-cap-warm">走过来 · 对着麦克风说</div>
              <div className={`st-prompt${promptFade ? ' is-fade' : ''}`}>“{ATTRACT_PROMPTS[promptIdx]}”</div>
              <div className="st-sub">三秒后，你会听到 AI 把它写成代码，然后放出来。</div>
            </div>
            <div className="st-ghost">
              {ATTRACT_PROMPTS.filter((_, i) => i !== promptIdx).map((p, i, arr) => (
                <span key={p} className="st-ghost-item">
                  <span className={p === '来个 Drop' ? 'st-ghost-drop' : undefined}>{p}</span>
                  {i < arr.length - 1 && <span className="st-dot" />}
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* phase / time + BPM */}
            <div className="st-topright">
              <div className="st-cap st-cap-cool">
                {PHASE_LABEL[phase] || PHASE_LABEL.night} · {clock}
              </div>
              <div className="st-bpmrow">
                <div className="st-bpm">{state?.bpm ? Math.round(state.bpm) : '—'}</div>
                <div className="st-cap">
                  bpm{state?.key ? ` · ${state.key}` : ''}{state?.style ? ` · ${state.style}` : ''}
                </div>
              </div>
            </div>

            {/* heard */}
            <div className={`st-heard${showHeard ? '' : ' is-hidden'}${listening ? ' is-listening' : ''}`}>
              <div className="st-cap">听到 · Heard</div>
              <div className="st-quote">{heardText ? `“${heardText}”` : '正在听…'}</div>
              {BUSY.has(status) && (
                <div className="st-progress">
                  <span className="st-progress-dot" />
                  AI 正在写代码 · {(elapsed / 1000).toFixed(1)} s
                </div>
              )}
              {status === 'error' && <div className="st-progress is-error">{state?.error || '没听清，再说一次'}</div>}
            </div>
            {!showHeard && BUSY.has(status) && (
              <div className="st-progress st-progress-solo">
                <span className="st-progress-dot" />
                AI 正在写代码 · {(elapsed / 1000).toFixed(1)} s
              </div>
            )}

            {/* code, left */}
            {showCode && (
              <div className={`st-codeblock${status === 'applying' ? ' is-applying' : ''}`} key={flashKey}>
                <div className="st-codehead">
                  <span className="st-dot-glow" style={{ background: targetColor, boxShadow: `0 0 16px ${targetColor}` }} />
                  <div className="st-cap st-cap-strong">AI 正在改{target ? ` · ${target}` : ''}</div>
                </div>
                {diff?.lines?.length ? (
                  <div className="st-codelines">
                    {diff.lines.map((line, i) => (
                      <CodeLine key={i} line={line} />
                    ))}
                  </div>
                ) : (
                  <div className="st-codelines">
                    <div className="st-code st-code-ghost">…</div>
                  </div>
                )}
                {explain && <div className="st-explain">{explain}</div>}
              </div>
            )}

            {/* participants + QR, right */}
            <div className="st-right">
              {participants.length > 0 && (
                <div className="st-people">
                  <div className="st-cap">正在一起玩 · {participants.length}</div>
                  {participants.map((p, i) => {
                    const color = p.color || trackById[p.trackId]?.color || TRACK_FALLBACK_COLORS[i % 4];
                    const tn = trackById[p.trackId]?.name;
                    return (
                      <div className="st-person" key={`${p.name}-${p.trackId}-${i}`}>
                        <span>{p.name}{tn ? ` · ${tn}` : ''}</span>
                        <span className="st-dot-glow" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
                      </div>
                    );
                  })}
                </div>
              )}
              {remoteUrl && <QrCard url={remoteUrl} />}
            </div>

            {/* bottom: legend + gesture hint */}
            <div className="st-bottom">
              <div className="st-legend">
                {tracks.map((t, i) => (
                  <div className={`st-legend-item${t.playing === false ? ' is-muted' : ''}`} key={t.id || i}>
                    <div className="st-cap st-cap-sm" style={{ color: t.color || TRACK_FALLBACK_COLORS[i % 4] }}>{t.name}</div>
                    <div className="st-legend-cap">{t.caption || t.summary || (t.playing === false ? '静音' : '在响')}</div>
                  </div>
                ))}
              </div>
              <div className="st-gesture">
                <HandIcon />
                <div className="st-gesture-text">
                  <div className="st-gesture-main">{macroActive ? `${macro.source || '旋钮'} 正在拧` : '举起手，滤波跟着手升起'}</div>
                  <div className="st-cap st-cap-sm">握拳 2 秒 = Drop · 挥手 = 换风格</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default StageView;
