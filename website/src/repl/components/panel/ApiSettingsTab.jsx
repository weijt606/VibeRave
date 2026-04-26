import { useState } from 'react';
import {
  useSettings,
  LLM_PRESETS,
  STT_PRESETS,
  setLlmProvider,
  setLlmApiKey,
  setLlmBaseUrl,
  setLlmModel,
  setLlmTemperature,
  setSttProvider,
  setSttApiKey,
  setSttBaseUrl,
  setSttModel,
} from '../../../settings.mjs';
import { API_URL } from './vibe/vibeApi.mjs';

// API Settings — let users plug in any LLM / STT provider without
// touching the backend .env. Settings live in localStorage and travel
// with every API call as override headers; the backend never persists
// them. See services/api/src/interface/http/override-headers.mjs.

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="opacity-70 font-mono">{label}</span>
      {children}
      {hint ? <span className="opacity-50 leading-snug">{hint}</span> : null}
    </label>
  );
}

function TextInput({ value, onChange, type = 'text', placeholder }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className="bg-background border border-muted rounded px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:border-foreground"
    />
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="border border-muted rounded-md p-3 space-y-3 bg-background/40">
      <header>
        <div className="text-sm font-semibold">{title}</div>
        {subtitle ? <div className="text-xs opacity-60 mt-0.5">{subtitle}</div> : null}
      </header>
      {children}
    </section>
  );
}

function Pill({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        'px-2 py-1 text-xs rounded-full border transition-colors ' +
        (active
          ? 'border-foreground text-foreground bg-foreground/10'
          : 'border-muted text-foreground/70 hover:border-foreground/50')
      }
    >
      {children}
    </button>
  );
}

export function ApiSettingsTab() {
  const settings = useSettings();
  const [testStatus, setTestStatus] = useState(null); // null | 'pending' | 'ok' | string error

  function applyLlmPreset(preset) {
    setLlmProvider(preset.provider);
    setLlmBaseUrl(preset.baseUrl);
    setLlmModel(preset.model);
  }
  function applySttPreset(preset) {
    setSttProvider(preset.provider);
    setSttBaseUrl(preset.baseUrl || '');
    setSttModel(preset.model || '');
  }

  async function testConnection() {
    setTestStatus('pending');
    try {
      const res = await fetch(`${API_URL}/health`, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setTestStatus(j.ok ? 'ok' : 'unhealthy');
      setTimeout(() => setTestStatus(null), 3500);
    } catch (err) {
      setTestStatus(`Could not reach ${API_URL}: ${err.message}`);
    }
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4 text-foreground">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">API Settings</h2>
        <p className="text-xs opacity-60 leading-relaxed max-w-prose">
          Configure the language model and speech-to-text backends used by VibeRave.
          Keys are stored in your browser only — never persisted on the server,
          never shared. Leave any field blank to fall back to the server&apos;s
          environment defaults.
        </p>
      </div>

      <Section
        title="Language Model"
        subtitle="Used for code generation. Any OpenAI-compatible endpoint works."
      >
        <div className="flex flex-wrap gap-1.5">
          {LLM_PRESETS.map((p) => (
            <Pill
              key={p.id}
              active={settings.llmBaseUrl === p.baseUrl && settings.llmProvider === p.provider}
              onClick={() => applyLlmPreset(p)}
              title={`${p.label} — ${p.baseUrl}`}
            >
              {p.label}
            </Pill>
          ))}
        </div>

        <Field label="API key" hint={
          settings.llmProvider === 'ollama'
            ? 'Ollama is local — no key required.'
            : 'Stored locally in your browser.'
        }>
          <TextInput
            type="password"
            value={settings.llmApiKey}
            onChange={setLlmApiKey}
            placeholder={settings.llmProvider === 'ollama' ? '(not needed)' : 'sk-...'}
          />
        </Field>

        <Field label="Base URL">
          <TextInput
            value={settings.llmBaseUrl}
            onChange={setLlmBaseUrl}
            placeholder="https://api.openai.com/v1"
          />
        </Field>

        <Field label="Model">
          <TextInput
            value={settings.llmModel}
            onChange={setLlmModel}
            placeholder="gpt-4o-mini"
          />
        </Field>

        <Field
          label={`Temperature: ${settings.llmTemperature}`}
          hint="0 = deterministic, 1 = creative. 0.85 is a good default for music."
        >
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={settings.llmTemperature}
            onChange={(e) => setLlmTemperature(e.target.value)}
            className="w-full"
          />
        </Field>
      </Section>

      <Section
        title="Speech-to-Text"
        subtitle="Pick a local engine for privacy + offline use, or a cloud API for accuracy."
      >
        <div className="flex flex-wrap gap-1.5">
          {STT_PRESETS.map((p) => {
            const active =
              p.provider === settings.sttProvider &&
              (p.provider !== 'api' || settings.sttBaseUrl === p.baseUrl);
            return (
              <Pill key={p.id} active={active} onClick={() => applySttPreset(p)}>
                {p.label}
              </Pill>
            );
          })}
        </div>

        {settings.sttProvider === 'api' && (
          <>
            <Field label="API key" hint="Stored locally in your browser.">
              <TextInput
                type="password"
                value={settings.sttApiKey}
                onChange={setSttApiKey}
                placeholder="sk-..."
              />
            </Field>
            <Field label="Base URL">
              <TextInput
                value={settings.sttBaseUrl}
                onChange={setSttBaseUrl}
                placeholder="https://api.openai.com/v1"
              />
            </Field>
            <Field label="Model">
              <TextInput
                value={settings.sttModel}
                onChange={setSttModel}
                placeholder="whisper-1"
              />
            </Field>
          </>
        )}

        {settings.sttProvider === 'whisper' && (
          <p className="text-xs opacity-60 leading-snug">
            Local <code className="font-mono">smart-whisper</code> — model auto-downloads on
            first use into <code className="font-mono">services/api/models/whisper/</code>.
            Configure the model size via <code className="font-mono">WHISPER_MODEL</code> in <code className="font-mono">.env</code>.
          </p>
        )}

        {settings.sttProvider === 'vosk' && (
          <p className="text-xs opacity-60 leading-snug">
            Local closed-grammar VOSK — only recognises canonical phrases listed in
            <code className="font-mono"> services/api/src/infrastructure/vosk-transcriber.mjs</code>.
            Sub-15&nbsp;ms latency. Download a model first; see <code className="font-mono">services/api/README.md</code>.
          </p>
        )}
      </Section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={testConnection}
          className="px-3 py-1 rounded border border-foreground text-foreground text-sm hover:opacity-80"
        >
          Test backend
        </button>
        {testStatus === 'pending' && <span className="text-xs opacity-70">Pinging…</span>}
        {testStatus === 'ok' && <span className="text-xs text-foreground">✓ Backend reachable</span>}
        {testStatus && testStatus !== 'pending' && testStatus !== 'ok' && (
          <span className="text-xs text-red-400 break-all">{testStatus}</span>
        )}
      </div>

      <p className="text-xs opacity-50 leading-relaxed pt-2">
        These settings travel with each request as <code className="font-mono">x-llm-*</code> /
        <code className="font-mono"> x-stt-*</code> headers. The backend forwards the key to
        your chosen provider but never persists it.
      </p>
    </div>
  );
}
