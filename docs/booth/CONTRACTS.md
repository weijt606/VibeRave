# VibeRave × Mañana 展台版 · 模块契约

分支 `feat/manana-booth`。目标：小红书「明日公园 Mañana」（海口 · 2026-10-23 至 25）线下展台。
衡量标准：路人 30 秒内玩起来，3 秒内听到自己造成的变化。

设计稿：`docs/booth/*.dc.html`（Main = iPad 主控台，Stage = 大屏，Attract = 大屏吸引模式，
Remote = 手机遥控，Kids = 儿童模式，System = 设计语言总表），截图 `mock-main.png` / `mock-stage.png`。

四路并行实现，互相只通过本文件定义的接口耦合。**不要改动本文件之外约定的接口形状；需要新增字段时先加到这里。**

---

## 0. 用户已锁定的决策

1. LLM：云端 API 优先，**国内厂商优先**（DashScope/Qwen），保留 OpenAI 兼容接口；**Ollama / LM Studio 本地模型为自动兜底**，云端失败时自动切换。
2. 硬件：大屏/投影、iPad/iPhone 主控、指向性麦克风、MIDI 控制器、稳定光照下的摄像头，都有。
3. **语音 + 文字输入是底座**；手势、声光电是叠加的升级层。
4. **儿童 K-12 模式有前端开关，音乐风格必须与成人不同。**

---

## 1. 设置项（`website/src/settings.mjs` 的 `settingsMap`）

| key | 默认 | 说明 |
|---|---|---|
| `boothMode` | `'adult'` | `'adult' \| 'kids'`。kids 时：白天色、儿童 chips/风格、请求体 `mode:'kids'` |
| `boothPhase` | `'auto'` | `'auto' \| 'day' \| 'afternoon' \| 'twilight' \| 'night'`。auto 按本地时钟：06–13 day，13–17 afternoon，17–19:30 twilight，其余 night；kids 模式强制 day |
| `boothLang` | `'zh'` | `'zh' \| 'en'`，chips 文案和 STT 语言。展台默认中文 |
| `vibeVoiceLang` | 改为 `'zh-CN'` | 现有键，改默认值 |
| `vibeBilingual` | 改为 `true` | 现有键，改默认值 |

---

## 2. 主题令牌（`website/src/styles/manana.css`）

根元素 `<html data-phase="day|afternoon|twilight|night" data-mode="adult|kids">`。
字体通过 Google Fonts `<link>` 加载（Unbounded 400/500/600 · Noto Sans SC 300/400/500/700 · Courier Prime 400/700），
回退栈：`'Noto Sans SC','PingFang SC','Hiragino Sans GB',system-ui`。

```css
:root {
  --mn-display: 'Unbounded', 'Noto Sans SC', sans-serif;
  --mn-body: 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', system-ui, sans-serif;
  --mn-mono: 'Courier Prime', 'Courier New', monospace;
  --mn-sun: radial-gradient(circle at 50% 40%, #FFF8E8 0%, #FBDA8A 30%, #F6B45A 56%, #F0865E 80%, rgba(242,139,184,.85) 93%, rgba(242,139,184,0) 100%);
}
/* 官方现场色卡，一色不改 */
[data-phase="day"]       { --mn-bg-0:#FBF8F1; --mn-bg-1:#F2EBE0; --mn-ink:#1A1714; --mn-ink-2:rgba(26,23,20,.7); --mn-cap:rgba(26,23,20,.45); --mn-hair:rgba(26,23,20,.08); --mn-a1:#F5F1E8; --mn-a2:#82CFEA; --mn-a3:#A8D672; --mn-leak-1:rgba(246,200,95,.55); --mn-leak-2:rgba(130,207,234,.5); --mn-glass:rgba(255,255,255,.55); }
[data-phase="afternoon"] { --mn-bg-0:#1A1226; --mn-bg-1:#2E1A2E; --mn-ink:#F5F1E8; --mn-ink-2:rgba(245,241,232,.7); --mn-cap:rgba(245,241,232,.42); --mn-hair:rgba(245,241,232,.07); --mn-a1:#F6C85F; --mn-a2:#FF735A; --mn-a3:#C8B6FF; --mn-leak-1:rgba(255,115,90,.55); --mn-leak-2:rgba(200,182,255,.3); --mn-glass:rgba(10,11,30,.42); }
[data-phase="twilight"]  { --mn-bg-0:#06071A; --mn-bg-1:#1C1230; --mn-ink:#F5F1E8; --mn-ink-2:rgba(245,241,232,.7); --mn-cap:rgba(245,241,232,.42); --mn-hair:rgba(245,241,232,.07); --mn-a1:#F59E42; --mn-a2:#F28BB8; --mn-a3:#6FA8FF; --mn-leak-1:rgba(245,158,66,.55); --mn-leak-2:rgba(111,168,255,.28); --mn-glass:rgba(10,11,30,.42); }
[data-phase="night"]     { --mn-bg-0:#03051A; --mn-bg-1:#3A1F45; --mn-ink:#F5F1E8; --mn-ink-2:rgba(245,241,232,.7); --mn-cap:rgba(245,241,232,.45); --mn-hair:rgba(245,241,232,.10); --mn-a1:#102A6B; --mn-a2:#177BFF; --mn-a3:#B8C0FF; --mn-leak-1:rgba(255,115,90,.62); --mn-leak-2:rgba(23,123,255,.30); --mn-glass:rgba(5,8,26,.45); }
```

轨道色（四条光带固定顺序）：鼓 `#F6C85F`，贝斯 `#F28BB8`，旋律 `#6FA8FF`，氛围 `#B8C0FF`；第 5 条起循环。
kids 模式轨道色：`#82CFEA` `#A8D672` `#F6C85F` `#F59E42`。

组件：chip 44px 高、胶囊、`linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.03))` + 1px 白 10% 描边 + inset 顶部高光；选中态换当前时段 `--mn-a1` 的 28%/12% 渐变。面板：`--mn-glass` + `backdrop-filter: blur(28px)` + 左侧 1px 白 8% 发丝线。**不要用纯色描边按钮。**

---

## 3. Vibe 状态提升（`website/src/repl/components/panel/vibe/vibeStore.mjs`）

由 nanostores 提供，`VibeTab.jsx` 与新 `BoothConsole.jsx` 共用同一份状态。

```js
export const $vibeStatus = atom({
  phase: 'idle',        // 'idle'|'listening'|'transcribing'|'generating'|'validating'|'applying'|'error'
  heard: '',            // 最近一次 STT 文本
  target: '',           // AI 正在改哪一轨（轨道名）
  explain: '',          // 一句中文解释（来自后端 explain 字段）
  error: '',            // 用户可读错误（中文）
  startedAt: 0, ms: 0,  // 当前请求耗时
  lane: 'llm',          // 'fast'|'llm'
});
export const $vibeMessages = atom([]);   // 当前选中轨道的对话
export const $pendingQueue = atom([]);   // 排队中的 prompt（上限 3，去重）
export function vibeSend(text, { trackId, source = 'text' } = {}) {} // source: 'voice'|'text'|'chip'|'remote'|'gesture'|'midi'
export function vibeReset() {}           // 「下一位」：清会话 + 清轨道 + 载入种子 + 宏归零
window.vibeSend = vibeSend;
```

`vibeSend` 内部先调 `tryFastLane(text)`（第 5 节），命中则不请求 LLM。

---

## 4. MacroBus（`website/src/booth/macroBus.mjs`）

五个 0..1 的宏，所有连续控制（手势 / 手机 / MIDI / 旋钮）只写这里，**永远不经过 LLM**。

```js
export const MACROS = ['cutoff', 'energy', 'space', 'density', 'tempo'];
export const $macros = atom({ cutoff: .5, energy: .5, space: .5, density: .5, tempo: .5 }); // .5 = 中性
export function setMacro(name, value01, { source } = {}) {}
export function setMacros(partial, opts) {}
export function resetMacros() {}
window.vibeMacros = { get: () => $macros.get(), set: setMacro };
```

下游映射（在 `applyMacros()` 内，订阅 `$macros`，30–60 Hz 平滑）：

| 宏 | 去向 | 说明 |
|---|---|---|
| cutoff | 每个 orbit 的 `getDjf(value).value` AudioParam | `packages/superdough/superdoughoutput.mjs:41-51`；.5 中性，<.5 低通，>.5 高通，`setTargetAtTime` 20 ms |
| energy | `getSuperdoughAudioController().output.destinationGain.gain` 0.35..1.0 + pattern 侧 `macro('energy')` | 采样级 |
| space | `setDefaultValue('room', 0..0.9)`（`superdough.mjs:211`）+ `macro('space')` | 事件级 |
| density | 仅 `macro('density')` | 由 skill 规则要求生成代码在 `.degradeBy(1 - macro('density'))` 等处预留挂点 |
| tempo | `window.strudelMirror.repl.setCps(baseCps * (0.7 + 0.6 * v))` | 经 SharedWorker 全局 |

pattern 侧全局：`macro(name)` 返回 `ref(() => $macros.get()[name])`（`packages/core/pattern.mjs:3692`），通过 `evalScope` 注入，
在 `website/src/repl/tracks/strudelGlobalInit.mjs` 的 `loadModules()` 之后注册。

---

## 5. 快通道（`website/src/booth/fastLane.mjs`）

```js
export function resolveFast(text, { mode, lang }) {} // → { kind:'macro'|'meta'|'template', ... } | null
export async function tryFastLane(text, ctx) {}      // 命中并执行 → true；否则 false（交给 LLM）
```

口令表（中英各一份，与 `services/api/src/infrastructure/vosk-transcriber.mjs` 的 DEMO_GRAMMAR 对齐）：

| 口令（zh / en） | kind | 动作 |
|---|---|---|
| 更暗一点 / darker | macro | cutoff −0.15 |
| 更亮 / brighter | macro | cutoff +0.15 |
| 再快一点 / faster | macro | tempo +0.08 |
| 再慢一点 / slower | macro | tempo −0.08 |
| 更多混响 / more reverb | macro | space +0.2 |
| 更空 / more space | macro | density −0.2, space +0.1 |
| 更满 / more energy | macro | energy +0.15, density +0.15 |
| 停 / 全部停 / stop all | meta | `stop_all` |
| 来个 drop / drop | template | 全轨 1 拍静音后 energy=1、cutoff=.5 |
| 加鼓 / add drums · 加贝斯 / add bass · 加踩镲 / add hi-hat | template | 在当前 stack 末尾插入已验证模板行（模板见 `templates.mjs`，按 mode 区分成人/儿童音色） |
| 换个风格 / next style | template | 从预生成缓存取下一个风格（第 8 节） |

不在表内的文本 → LLM 通道。

---

## 6. 舞台桥（`website/src/booth/stageBridge.mjs`）

主控页发布，`/stage` 页订阅。`BroadcastChannel('viberave-stage')`。

```ts
type StageState = {
  type: 'state';
  phase: 'day'|'afternoon'|'twilight'|'night'; mode: 'adult'|'kids';
  bpm: number; key: string; style: string;
  status: VibeStatus['phase']; heard: string; target: string; explain: string; lane: 'fast'|'llm';
  error?: string;       // status === 'error' 时的用户可读中文
  tracks: { id: string; name: string; color: string; playing: boolean; level: number; caption?: string /* 如 "909 · 四踩" */ }[];
  participants: { name: string; trackId: string; color: string }[];
  ts: number;
};
type StageAudio = { type: 'audio'; rms: number; bands: number[] /* 8 段 0..1 */; onset: boolean; ts: number };
type StageDiff  = { type: 'diff'; trackName: string; lines: { text: string; changed: boolean }[]; explain: string; ts: number };
type StageMacro = { type: 'macro'; macros: Record<string, number>; source: string; ts: number };
```

发布频率：state 在变化时 + 每 1 s 心跳；audio 30 Hz（主页面用 `getAnalyzerData('frequency','track-<id>')` 汇总各轨，
再加一个母线分析器 `getAnalyserById('master')` 接到 `destinationGain`）；diff 在每次热切换后；macro 在每次 setMacro 后（节流 60 Hz）。
`/stage` 超过 90 s 没收到 status ≠ idle 的 state → 进入吸引模式。

---

## 7. 页面与文件布局（website）

```
website/src/pages/booth.astro           iPad 主控台（Main.dc.html / Kids.dc.html）
website/src/pages/stage.astro           大屏（Stage.dc.html / Attract.dc.html）
website/src/pages/remote.astro          手机遥控（Remote.dc.html）— 本轮只出壳，第二阶段接 WebSocket
website/src/styles/manana.css           主题令牌
website/src/booth/
  BoothConsole.jsx                      主控台外壳：顶栏 + 左太阳舞台 + 右磨砂面板
  SunButton.jsx                         太阳 PTT（六层光 canvas + 按住录音，复用 voice-recorder.mjs）
  TrackBands.jsx                        光带列表（波形 + 倒影 + 静音）
  ChipRail.jsx                          一句话 chips（点击即发）+ 风格瓦片
  MacroDials.jsx                        四个宏的弧形表盘
  useTimePhase.mjs                      时段计算 + data-phase 写入
  macroBus.mjs · fastLane.mjs · templates.mjs · stageBridge.mjs
  stage/StageView.jsx · stage/sunRenderer.mjs · stage/AttractView.jsx
  chips.zh.mjs / chips.en.mjs / chips.kids.mjs
```

现有 `/`（开发者 REPL）保持可用，不动它的布局；展台只用 `/booth` 与 `/stage`。

---

## 8. 后端（services/api）

### 8.1 供应商链与自动兜底

`.env`：
```
LLM_PROVIDERS=dashscope,openai,ollama,lmstudio     # 顺序即优先级
LLM_DASHSCOPE_API_KEY= / LLM_DASHSCOPE_MODEL=qwen-plus / LLM_DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_OPENAI_API_KEY= / LLM_OPENAI_MODEL=gpt-4o-mini / LLM_OPENAI_BASE_URL=https://api.openai.com/v1
LLM_OLLAMA_BASE_URL=http://localhost:11434/v1 / LLM_OLLAMA_MODEL=qwen2.5:14b
LLM_LMSTUDIO_BASE_URL=http://localhost:1234/v1 / LLM_LMSTUDIO_MODEL=
LLM_TIMEOUT_MS=15000  LLM_MAX_TOKENS=1800  LLM_HISTORY_TURNS=6
```
`infrastructure/provider-chain.mjs`：按顺序尝试，超时 / 5xx / 429 / 网络错误 → 下一个；每个供应商维护健康状态（连续失败 2 次则 60 s 内跳过，之后半开探测）。
`GET /health/providers` 返回 `[{name, model, healthy, lastError, lastLatencyMs}]`。前端 `x-llm-*` 头仍可覆盖（放到链首）。

### 8.2 请求体扩展（`POST /generate`、`POST /generate/stream`）

```ts
{ sessionId, prompt, currentCode,
  mode?: 'adult'|'kids',          // kids → 强制家庭模式规则（不再靠关键词）
  lang?: 'zh'|'en',               // explain 语言
  intent?: 'generate'|'tweak',    // tweak 用精简 prompt（rules/output-format + iteration + error-recovery + 当前 mode 规则，≈4 KB）
  tracks?: { name: string; summary: string }[]  // 其它轨道一行摘要，进 <siblings> 块
}
```
响应新增 `explain: string`（LLM 以 `EXPLAIN: ...` 行返回，服务端剥离；中文一句话，≤ 30 字）和 `provider: string`。

`POST /generate/stream`：SSE，事件 `received` → `generating {provider}` → `validating {attempt}` → `done {code, explain, meta, ...}` | `error {message}`。

### 8.3 质量与安全

- 系统提示词内存缓存（mtime 变化时重读），不再每请求 31 次读盘。
- 历史窗口 `LLM_HISTORY_TURNS`；`prompt` ≤ 500 字、`currentCode` ≤ 20 KB，超出 413。
- `BOOTH_TOKEN` 非空时校验 `x-booth-token` 头；每 IP 每分钟 20 次 `/generate`。
- `validate-strudel.mjs` 的 `evaluate` 前加静态 denylist（`import|require|fetch|XMLHttpRequest|WebSocket|document|window|process|globalThis|eval|Function`）。
- 会话写入按 sessionId 串行化（简单 promise 队列）。
- Whisper 中文幻觉黑名单（「请不吝点赞订阅」「谢谢观看」「字幕由…提供」等）。
- 预生成缓存：`scripts/pregenerate.mjs` 把 12 个成人风格 + 8 个儿童风格各 3 个调性生成到 `data/pregen/<mode>/<style>-<n>.json`；`GET /pregen?mode=&style=` 随机取一个。

---

## 9. 验收（本轮）

- `/booth` 新标签页打开 5 s 内：有种子轨道在响，太阳按钮可按，中文 chips 可点。
- chip 与固定口令 100 ms 内生效（快通道），不发请求。
- `/stage` 在另一标签页收到主控的状态与音频并渲染太阳；90 s 无人自动吸引模式。
- 后端：云端失败自动切本地；`/health/providers` 正确；`npx vitest run` 全绿。
