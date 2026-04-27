import { useEffect, useMemo, useRef, useState } from 'react';
import cx from '@src/cx.mjs';
import { useSettings } from '../../../settings.mjs';
import { useStore } from '@nanostores/react';
import {
  $selectedTrackId,
  $selectedTrack,
  setTrackCode,
} from '../../tracks/tracksStore.mjs';
import { createVoiceRecorder } from './voice-recorder.mjs';
import {
  displayKey,
  eventMatchesHotkey,
  isModalHotkey,
  isTextInput,
  parseHotkey,
} from './vibe/keyHelpers.mjs';
import { readOrCreateSessionId, clearSessionId } from './vibe/sessionId.mjs';
import {
  fetchSessionMessages,
  postGenerate,
  postGenerateFix,
  postTranscribe,
  deleteSession,
} from './vibe/vibeApi.mjs';
import { Waveform } from './vibe/Waveform.jsx';
import { Message } from './vibe/Message.jsx';
import { dispatchMetaCommand } from './vibe/metaCommands.mjs';

const FLUSH_KEY = 'strudel:vibe:silenceFlush';
const SILENCE_MS_KEY = 'strudel:vibe:silenceMs';
const SILENCE_OPTIONS = [2000, 3000, 5000, 8000, 10000];
const DEFAULT_SILENCE_MS = 5000;
const WAVEFORM_BARS = 18;
// Auto-send delay: STT lands → wait this long → fire /generate. Lets the
// user read the transcript and override (typing in textarea cancels the
// timer). 2s is short enough to feel responsive but long enough to react.
const AUTO_SEND_DELAY_MS = 2000;

// One-click prompt suggestions — appear as chips above the textarea so
// the user has a deterministic fallback when STT is flaky. Click fills
// the prompt textarea (does not auto-send), so they can still edit /
// combine before hitting Send. Chosen mix: 4 generation seeds, 4 stem /
// effect edits, 2 META commands. Keep this list short — anything past
// ~10 chips fights the chat for vertical space.
const PROMPT_CHIPS = [
  'lo-fi beat',
  'Berghain techno',
  'drum and bass',
  'acid bass',
  'add hi-hat',
  'add reverb',
  'more bass',
  'double drums',
  'open a new track',
  'stop all',
];

// Re-export so existing settings UI that imports these from VibeTab keeps working.
export { displayKey };
export { NON_PTT_CODES } from './vibe/keyHelpers.mjs';

function readFlush() {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage?.getItem(FLUSH_KEY);
  return raw === null ? true : raw === 'true';
}
function readSilenceMs() {
  if (typeof window === 'undefined') return DEFAULT_SILENCE_MS;
  const n = Number(window.localStorage?.getItem(SILENCE_MS_KEY));
  return SILENCE_OPTIONS.includes(n) ? n : DEFAULT_SILENCE_MS;
}

// How long to listen for runtime errors after a hot-swap before deciding
// the new code is fine. The scheduler emits `getTrigger error: ...` log
// events as soon as a hap with a bad sound/value tries to play, which is
// usually within the first cycle. Tightened from 1500 → 600 ms so a
// broken swap finds its way to /generate/fix faster and the audible
// gap between "old pattern stopped emitting" and "fixed pattern starts"
// is much shorter.
const RUNTIME_ERROR_WINDOW_MS = 600;
// Logger events (see packages/core/logger.mjs) we treat as runtime errors
// worth asking the LLM to fix.
const RUNTIME_ERROR_PREFIX_RE = /^\[(getTrigger|cyclist|repl)\]\s*error:\s*(.+)$/i;

// Watch the global logger event bus for `[getTrigger] error: ...` style
// messages for a short window, returning the first error or null. Used by
// the runtime-fix loop to detect "the swap looked fine to evaluate() but
// the scheduler fails on every cycle" regressions (e.g. NaN AudioParam,
// `unexpected "note" type "object"`, missing soundfont).
function watchForRuntimeError(ms = RUNTIME_ERROR_WINDOW_MS) {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      document.removeEventListener('strudel.log', onLog);
      clearTimeout(timer);
      resolve(value);
    };
    const onLog = (e) => {
      const msg = e?.detail?.message;
      if (typeof msg !== 'string') return;
      const m = msg.match(RUNTIME_ERROR_PREFIX_RE);
      if (m) finish(m[2].trim());
    };
    document.addEventListener('strudel.log', onLog);
    const timer = setTimeout(() => finish(null), ms);
  });
}

// Apply incoming code to the *selected* track: update the persisted
// store, then hot-swap the live editor.
//
// When `allowFix` is true, we also listen for runtime errors from the
// scheduler for ~600 ms after the swap; if any fire, we POST the failing
// code + first error to /generate/fix and re-apply the corrected version
// once. If the fix LLM can't help (noChange / network error), we revert
// to the previous code so the music keeps playing instead of leaving
// the scheduler stuck on a broken pattern. The recursive fix call is
// gated to one retry so a model that keeps regenerating bad code can't
// melt the API.
//
// IMPORTANT: never call .stop() / .repl.stop() on the editor here. If
// the new pattern has a runtime error, the scheduler keeps its previous
// pattern slot — calling stop in that path produces the "music drops on
// every input" regression from the old code path.
async function applyCodeToSelectedTrack(code, onError, { allowFix = false } = {}) {
  if (!code) return;
  const id = $selectedTrackId.get();
  if (!id) return;
  if (typeof window === 'undefined') return;
  // window.strudelMirror always points at the selected track's editor.
  const editor = window.strudelMirror;
  if (!editor) return;
  // Snapshot the previous editor code so we can revert if the new code
  // turns out to be a runtime-error trap that the fix LLM can't handle.
  // Without this, a bad LLM swap leaves the scheduler emitting silence
  // and the user perceives the previous music as "stopped".
  const previousCode = typeof editor.code === 'string' ? editor.code : '';
  setTrackCode(id, code);
  editor.setCode(code);
  // Arm the runtime-error watcher *before* awaiting evaluate so we don't
  // miss errors emitted between the eval finishing and the next tick.
  const watcher = allowFix ? watchForRuntimeError() : null;
  try {
    await editor.evaluate(true);
  } catch (err) {
    onError?.(err?.message || String(err));
    return;
  }
  if (!watcher) return;
  const runtimeError = await watcher;
  if (!runtimeError) return;

  async function revertToPrevious(reason) {
    if (!previousCode) {
      onError?.(reason);
      return;
    }
    setTrackCode(id, previousCode);
    editor.setCode(previousCode);
    try {
      await editor.evaluate(true);
      onError?.(`${reason} — reverted to previous pattern`);
    } catch (err) {
      onError?.(`${reason} (revert also failed: ${err?.message || err})`);
    }
  }

  try {
    const fix = await postGenerateFix({ currentCode: code, error: runtimeError });
    if (fix?.code && !fix.noChange) {
      // One-shot retry. allowFix:false prevents an infinite loop if the
      // fix itself is broken — surface the original error instead.
      await applyCodeToSelectedTrack(fix.code, onError, { allowFix: false });
    } else {
      // Fix LLM couldn't help — keep the music going by reverting.
      await revertToPrevious(`runtime error: ${runtimeError}`);
    }
  } catch (err) {
    // Network / 500 from the fix endpoint — also revert so we don't leave
    // the scheduler holding a broken pattern.
    await revertToPrevious(
      `runtime error: ${runtimeError} (auto-fix failed: ${err?.message || err})`,
    );
  }
}

export function VibeTab() {
  const {
    fontFamily,
    vibePttKey: pttKey,
    vibeAutoApply: auto,
    vibeVoiceLang,
    vibeBilingual,
  } = useSettings();
  const selectedTrackId = useStore($selectedTrackId);
  const selectedTrack = useStore($selectedTrack);

  // Bail early to a friendly placeholder when nothing is selected.
  if (!selectedTrackId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-sm opacity-60 text-center px-6 py-10" style={{ fontFamily }}>
        <div className="mb-2">No track selected</div>
        <div className="text-xs">Pick a track on the left to start vibing.</div>
      </div>
    );
  }

  // Bilingual mode overrides whatever vibeVoiceLang holds — the backend
  // expects 'auto' so each utterance gets language-detected (and the bias
  // prompts flip to bilingual variants).
  const effectiveLang = vibeBilingual ? 'auto' : vibeVoiceLang;

  return (
    <VibeForTrack
      key={selectedTrackId}
      trackId={selectedTrackId}
      trackName={selectedTrack?.name || 'this track'}
      pttKey={pttKey}
      auto={auto}
      voiceLang={effectiveLang}
      fontFamily={fontFamily}
    />
  );
}

function VibeForTrack({ trackId, trackName, pttKey, auto, voiceLang, fontFamily }) {
  const sessionId = useMemo(() => readOrCreateSessionId(trackId), [trackId]);

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [flush, setFlush] = useState(readFlush);
  const [silenceMs, setSilenceMs] = useState(readSilenceMs);
  const [pttHint, setPttHint] = useState(false);
  const [waveform, setWaveform] = useState(() => new Array(WAVEFORM_BARS).fill(0));
  // Last STT transcript — pinned in the UI so it stays visible even after
  // the textarea is cleared by send(). Cleared on next recording.
  const [lastTranscript, setLastTranscript] = useState('');
  // Re-render trigger for the auto-send "2s remaining" hint — refs alone
  // aren't reactive so we bump this when the timer is set/cleared.
  const [autoSendArmed, setAutoSendArmed] = useState(false);
  // Pending command queue. While `loading` is true (a /generate is in
  // flight), additional submissions are pushed here instead of being
  // dropped. Each entry is { id, text }; the user can drag the X to
  // remove an item before its turn. When the in-flight call finishes,
  // the first entry is dequeued and run.
  const [pendingQueue, setPendingQueue] = useState([]);

  const recorderRef = useRef(null);
  const pttActiveRef = useRef(false);
  const pttKeyDownRef = useRef(false);
  // Tracks press-and-hold via pointer (mouse / touch) on the mic pill —
  // separate from the keyboard ref so a stray keyup doesn't end a
  // pointer-driven recording.
  const pttPointerActiveRef = useRef(false);
  const scrollRef = useRef(null);
  const sendRef = useRef(null);
  // AbortController for the in-flight /generate fetch — lets the user
  // cancel a slow LLM call (esp. local Ollama with cold prefill) and edit.
  const abortRef = useRef(null);
  // Pending auto-send timer fired AUTO_SEND_DELAY_MS after STT lands.
  const autoSendTimerRef = useRef(null);
  const flushRef = useRef(flush);
  const silenceMsRef = useRef(silenceMs);
  const levelBufferRef = useRef(new Array(WAVEFORM_BARS).fill(0));

  useEffect(() => {
    flushRef.current = flush;
    if (typeof window !== 'undefined') window.localStorage?.setItem(FLUSH_KEY, String(flush));
  }, [flush]);
  useEffect(() => {
    silenceMsRef.current = silenceMs;
    if (typeof window !== 'undefined') window.localStorage?.setItem(SILENCE_MS_KEY, String(silenceMs));
  }, [silenceMs]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // Pump the level buffer into React state at ~30 fps while listening.
  useEffect(() => {
    if (!listening) {
      levelBufferRef.current = new Array(WAVEFORM_BARS).fill(0);
      setWaveform(new Array(WAVEFORM_BARS).fill(0));
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (t) => {
      if (t - last > 33) {
        last = t;
        setWaveform([...levelBufferRef.current]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [listening]);

  // Hydrate chat history when the (per-track) session id changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const msgs = await fetchSessionMessages(sessionId);
        if (!cancelled) setMessages(msgs);
      } catch {
        /* backend offline → empty history */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(
    () => () => {
      pttActiveRef.current = false;
      const r = recorderRef.current;
      recorderRef.current = null;
      r?.stop().catch(() => {});
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }
      abortRef.current?.abort();
    },
    [],
  );

  function clearAutoSendTimer() {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
      setAutoSendArmed(false);
    }
  }

  async function send(textOverride) {
    const text = (textOverride ?? prompt).trim();
    if (!text) return;
    // Already generating — queue the new prompt instead of dropping it.
    // The user can dismiss queued items via the X button while they wait.
    if (loading) {
      setPendingQueue((prev) => [
        ...prev,
        { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text },
      ]);
      setPrompt('');
      return;
    }
    setError('');
    setLoading(true);
    const currentCode = (typeof window !== 'undefined' && window.strudelMirror?.code) || '';
    setMessages((prev) => [...prev, { role: 'user', text, ts: 'pending' }]);
    setPrompt('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const data = await postGenerate({
        sessionId,
        prompt: text,
        currentCode,
        signal: ctrl.signal,
      });
      if (Array.isArray(data.messages)) setMessages(data.messages);
      // Meta-command path: the LLM classified the prompt as a host
      // control (play/pause/stop/new track/schedule_stop). Dispatch
      // before the music-edit branch so we don't try to overwrite the
      // currently-selected track — for new_track + seed code we *want*
      // the code applied, but to the freshly-created track, which the
      // dispatcher handles itself via whenEditorReady.
      if (data.meta) {
        dispatchMetaCommand(data.meta, { seedCode: data.code || '' });
      } else {
        const code = data.code || '';
        // noChange: model couldn't turn the request into a pattern (see
        // skills/strudel/rules/cannot-handle.md). Don't overwrite the editor.
        if (auto && code && !data.noChange) {
          applyCodeToSelectedTrack(code, setError, { allowFix: true });
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        // user cancelled — drop the optimistic bubble; input was already cleared
        setMessages((prev) => prev.filter((msg) => msg.ts !== 'pending'));
      } else {
        setError(err.message || String(err));
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function dropFromQueue(id) {
    setPendingQueue((prev) => prev.filter((q) => q.id !== id));
  }

  function cancelSend() {
    abortRef.current?.abort();
  }

  // Drain the queue whenever a request finishes and there's something
  // pending. We dequeue the head item and re-enter send() with it as
  // the textOverride; send() will set loading=true again and re-trigger
  // this effect when it finishes, walking the queue one item at a time.
  useEffect(() => {
    if (loading) return;
    if (pendingQueue.length === 0) return;
    const [head, ...rest] = pendingQueue;
    setPendingQueue(rest);
    sendRef.current?.(head.text);
  }, [loading, pendingQueue]);

  sendRef.current = send;

  function startRecording({ ptt = false } = {}) {
    if (recorderRef.current) return;
    setError('');
    // Reset banner + cancel any pending auto-send so a new take starts clean.
    setLastTranscript('');
    clearAutoSendTimer();
    const recorder = createVoiceRecorder({
      silenceMs: ptt && flushRef.current ? silenceMsRef.current : 0,
      onSilence: handleSilenceFlush,
      onLevel: (rms) => {
        const buf = levelBufferRef.current;
        for (let i = 0; i < buf.length - 1; i++) buf[i] = buf[i + 1];
        buf[buf.length - 1] = rms;
      },
    });
    recorder
      .start()
      .then(() => {
        recorderRef.current = recorder;
        pttActiveRef.current = ptt;
        setListening(true);
      })
      .catch((err) => {
        setError(`Could not start recording: ${err?.message || err}`);
      });
  }

  async function handleSilenceFlush() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    setListening(false);
    let blob = null;
    try {
      blob = await recorder.stop();
    } catch (err) {
      setError(`Recording failed: ${err?.message || err}`);
    }
    if (pttKeyDownRef.current) startRecording({ ptt: true });
    if (blob) transcribeAndSend(blob);
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    setListening(false);
    const wasPtt = pttActiveRef.current;
    pttActiveRef.current = false;
    let blob = null;
    try {
      blob = await recorder.stop();
    } catch (err) {
      setError(`Recording failed: ${err?.message || err}`);
      return;
    }
    if (blob && wasPtt) transcribeAndSend(blob);
  }

  async function transcribeAndSend(wavBlob) {
    if (!wavBlob || wavBlob.size < 2048) return;
    setTranscribing(true);
    try {
      const data = await postTranscribe({
        sessionId,
        wavBlob,
        lang: voiceLang,
      });
      const text = (data.text || '').trim();
      if (!text) return;
      setPrompt(text);
      // Pin so the user sees what was heard even after send() clears
      // the textarea. Independent of textarea timing.
      setLastTranscript(text);
      // Delayed auto-send: gives the user time to read and override.
      // Typing in the textarea cancels the timer.
      clearAutoSendTimer();
      setAutoSendArmed(true);
      autoSendTimerRef.current = setTimeout(() => {
        autoSendTimerRef.current = null;
        setAutoSendArmed(false);
        sendRef.current?.(text);
      }, AUTO_SEND_DELAY_MS);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setTranscribing(false);
    }
  }

  // Truly global push-to-talk handler. We listen in the capture phase so
  // we run before codemirror's keymap (which would otherwise interpret
  // Ctrl+Space as autocomplete) and call stopImmediatePropagation to keep
  // the event from reaching any other listener. When the hotkey is bare
  // (no modifier — only the legacy 'Space' default), we still bail when
  // focus is in a text input so users can type a space character.
  useEffect(() => {
    const modal = isModalHotkey(pttKey);
    // keyup may arrive without modifier flags (e.g. user releases Ctrl
    // before Space) — match on `code` alone for the release.
    const releaseCode = parseHotkey(pttKey).code;
    function onKeyDown(e) {
      if (!eventMatchesHotkey(e, pttKey)) return;
      if (!modal && isTextInput(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat || pttKeyDownRef.current) return;
      pttKeyDownRef.current = true;
      setPttHint(true);
      startRecording({ ptt: true });
    }
    function onKeyUp(e) {
      if (e.code !== releaseCode) return;
      if (!pttKeyDownRef.current) return;
      pttKeyDownRef.current = false;
      setPttHint(false);
      if (recorderRef.current && pttActiveRef.current) stopRecording();
    }
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pttKey]);

  function reuse(code) {
    applyCodeToSelectedTrack(code, setError, { allowFix: true });
  }

  async function reset() {
    setMessages([]);
    setError('');
    try {
      await deleteSession(sessionId);
    } catch (err) {
      setError(err.message || String(err));
    }
    clearSessionId(trackId);
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ fontFamily }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-muted text-xs opacity-70 shrink-0 gap-2">
        <span className="truncate">Vibe coding · {trackName}</span>
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="px-2 py-0.5 rounded border border-muted hover:opacity-80 shrink-0"
          >
            Reset
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 space-y-3 min-h-0 relative"
        style={{
          // Banner is now persistent across all states — same visual
          // identity whether the chat is empty or full. The dim gradient
          // overlay keeps message text legible; individual messages add
          // their own backdrop-blur cards on top so the bg shows through
          // without competing with the chat.
          backgroundImage: `linear-gradient(rgba(0,0,0,${messages.length === 0 ? 0.55 : 0.7}), rgba(0,0,0,${messages.length === 0 ? 0.75 : 0.85})), url('/viberave-bg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'local',
        }}
      >
        {messages.length === 0 && (
          <div className="text-sm leading-relaxed text-white drop-shadow-lg flex flex-col h-full justify-end">
            <div className="bg-black/55 rounded-lg p-4 backdrop-blur-sm border border-white/10">
              <div className="opacity-90">
                Describe a track or a change. Each turn iterates on whatever is currently in the editor — no need to repeat what's already there.
              </div>
              <ul className="list-disc list-inside mt-2 space-y-1 opacity-80">
                <li>"lo-fi hip-hop at 80 bpm with a soft kick and rhodes chords"</li>
                <li>"make the bass more dubby"</li>
                <li>"swap the drums for a 909 kit and double the tempo"</li>
              </ul>
              <div className="mt-3 opacity-80 leading-relaxed">
                <div>Hold <kbd className="px-1 border border-white/30 rounded bg-black/40">{displayKey(pttKey)}</kbd> anywhere to talk, release to send.</div>
                <div>Or type and press <kbd className="px-1 border border-white/30 rounded bg-black/40">Enter</kbd>, or click any chip below.</div>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} onReuse={reuse} />
        ))}

        {transcribing && <div className="text-xs opacity-60">Transcribing…</div>}
        {loading && <div className="text-xs opacity-60">Generating…</div>}

        {error && (
          <div className="text-xs text-background bg-foreground p-2 rounded whitespace-pre-wrap break-words">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-muted p-3 space-y-2 shrink-0">
        {lastTranscript && (
          <div
            className="text-xs px-2 py-1 rounded border border-muted opacity-80 truncate"
            title={lastTranscript}
          >
            <span className="opacity-60">📝 heard:</span> {lastTranscript}
            {autoSendArmed && (
              <span className="opacity-60 ml-2">
                — auto-sending in {AUTO_SEND_DELAY_MS / 1000}s, type to cancel
              </span>
            )}
          </div>
        )}
        {pendingQueue.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            title="Queued commands — they fire one at a time after the current generation finishes. Click × to drop one."
          >
            <span className="text-[10px] opacity-60 uppercase tracking-wide">queued</span>
            {pendingQueue.map((q, i) => (
              <span
                key={q.id}
                className="text-xs px-2 py-0.5 rounded-full border border-muted bg-background/60 text-foreground/90 inline-flex items-center gap-1.5"
              >
                <span className="opacity-50 tabular-nums">{i + 1}.</span>
                <span className="max-w-[180px] truncate">{q.text}</span>
                <button
                  type="button"
                  onClick={() => dropFromQueue(q.id)}
                  className="opacity-50 hover:opacity-100 hover:text-red-400 leading-none"
                  title="Drop from queue"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div
          className="flex flex-wrap gap-1 mb-1.5"
          title="Click a chip to fill the prompt — useful when STT is unreliable. You can still edit before sending."
        >
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                clearAutoSendTimer();
                setPrompt(chip);
              }}
              className="px-2 py-0.5 text-xs rounded-full border border-muted text-foreground/80 hover:border-foreground hover:text-foreground bg-background/60 backdrop-blur-sm transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => {
            // User edited — cancel any pending auto-send so the typed text
            // isn't immediately blown away.
            clearAutoSendTimer();
            setPrompt(e.target.value);
          }}
          placeholder={
            listening
              ? pttHint
                ? `Recording… release ${displayKey(pttKey)} to send`
                : 'Recording… speak now'
              : transcribing
                ? 'Transcribing…'
                : `Describe the change. Enter to send, Shift+Enter for newline. Hold ${displayKey(pttKey)} for push-to-talk.`
          }
          className="w-full min-h-[68px] p-2 bg-background border border-muted rounded-md text-foreground resize-y focus:outline-none focus:border-foreground"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div
              role="button"
              tabIndex={-1}
              title={`Press and hold to record (or hold ${displayKey(pttKey)} anywhere on the page). Release to send.`}
              onPointerDown={(e) => {
                if (e.button !== undefined && e.button !== 0) return; // primary button only
                if (recorderRef.current) return;
                e.preventDefault(); // suppress focus / text-selection while held
                e.currentTarget.setPointerCapture?.(e.pointerId);
                pttPointerActiveRef.current = true;
                setPttHint(true);
                startRecording({ ptt: true });
              }}
              onPointerUp={(e) => {
                if (!pttPointerActiveRef.current) return;
                pttPointerActiveRef.current = false;
                setPttHint(false);
                e.currentTarget.releasePointerCapture?.(e.pointerId);
                if (recorderRef.current && pttActiveRef.current) stopRecording();
              }}
              onPointerCancel={() => {
                if (!pttPointerActiveRef.current) return;
                pttPointerActiveRef.current = false;
                setPttHint(false);
                if (recorderRef.current && pttActiveRef.current) stopRecording();
              }}
              className={cx(
                'px-3 py-1 rounded-md border text-sm flex items-center gap-2 select-none cursor-pointer touch-none transition-shadow duration-75',
                listening
                  ? 'border-[var(--vr-accent-cyan)] bg-foreground text-background'
                  : transcribing
                    ? 'border-[var(--vr-accent-magenta)] text-foreground opacity-70'
                    : 'border-muted text-foreground hover:border-[rgb(var(--vr-accent-cyan-rgb)/0.6)]',
              )}
              style={
                listening
                  ? {
                      // RMS → glow size. Speech RMS typically peaks around
                      // 0.05–0.15; keep a 6px floor so the button still looks
                      // "armed" during silence pauses, cap at 28px so loud
                      // peaks don't bloom across the whole row.
                      boxShadow: `0 0 ${Math.min(
                        28,
                        6 + (waveform[waveform.length - 1] || 0) * 180,
                      )}px var(--vr-accent-cyan)`,
                    }
                  : transcribing
                    ? { boxShadow: '0 0 8px rgb(var(--vr-accent-magenta-rgb) / 0.4)' }
                    : undefined
              }
            >
              {listening ? (
                <>
                  <Waveform levels={waveform} />
                  <span className="tabular-nums">release to send</span>
                </>
              ) : transcribing ? (
                '… Transcribing'
              ) : (
                `🎤 Hold to talk (${displayKey(pttKey)})`
              )}
            </div>
            <label
              className="flex items-center gap-1 cursor-pointer text-xs opacity-70"
              title={`While holding ${displayKey(pttKey)}, auto-send after the chosen pause and keep listening for the next utterance.`}
            >
              <input
                type="checkbox"
                checked={flush}
                onChange={(e) => setFlush(e.target.checked)}
              />
              auto-send after
            </label>
            <select
              value={silenceMs}
              onChange={(e) => setSilenceMs(Number(e.target.value))}
              disabled={!flush}
              title="How long of a pause counts as 'done speaking'."
              className={cx(
                'bg-background border border-muted rounded px-1 py-0.5 text-xs',
                !flush && 'opacity-50 cursor-not-allowed',
              )}
            >
              {SILENCE_OPTIONS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms / 1000}s
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelSend}
                title="Cancel the in-flight request"
                className="px-3 py-1 rounded-md border border-foreground text-foreground text-sm hover:opacity-80"
              >
                ✕ Cancel
              </button>
              {prompt.trim() && (
                <button
                  onClick={() => send()}
                  title="Queue this prompt to fire after the current one"
                  className="px-3 py-1 rounded-md border border-muted text-foreground/80 text-sm hover:border-foreground hover:text-foreground"
                >
                  + Queue
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => send()}
              disabled={!prompt.trim()}
              className={cx(
                'px-3 py-1 rounded-md border border-foreground text-foreground text-sm',
                !prompt.trim() && 'opacity-50 cursor-not-allowed',
              )}
            >
              Send (Enter)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
