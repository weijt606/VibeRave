# VibeRave K-12 课堂使用指南

> 给中小学音乐老师、家长、青少年编程兴趣班的一份操作手册。
> 主文档（中英）见 [README.md](../README.md) / [README.zh-CN.md](../README.zh-CN.md) —— 本文只讲怎么把 VibeRave 用在课堂上。

---

## 这是什么？

**VibeRave** 是一个让人通过**说话、打字、或点按钮**实时"作曲"的工具：你说一句"给我一段儿歌"，几秒钟后浏览器里就会出现可视化代码 + 实时播放的音乐。所有音乐都是 AI 现场生成的 Strudel 代码，不是预录好的音频。

把它带进课堂，孩子们能**同时看到代码、听到音乐**，并且可以**自己说话改变它**。这是给小学生展示"AI 是怎么和人一起创作"的最直观方式之一。

## 为什么适合上课？

| 优势 | 说明 |
|---|---|
| **即时反馈** | 说一句话 → 几秒钟出音乐。不用等渲染、不用编译 |
| **可视化代码** | 编辑器里高亮的代码 = 正在播的音符。孩子能"看到"音乐是什么 |
| **多种风格** | 儿歌、摇篮曲、行进乐队、华尔兹、波尔卡、动画追逐、8-bit 游戏曲、动物嘉年华 |
| **零门槛驱动** | 孩子完全不会编程也能用 —— 嘴说一句、点一个按钮就行 |
| **多模态** | 老师可以让学生轮流"说话"驱动，全班都参与 |
| **课堂安全** | 已经内置了 **family mode**：触发关键词后自动屏蔽 808 sub、FM 失真、黑暗滤波等不适合小朋友的声音 |
| **离线可跑** | 用本地 Whisper + Ollama 模型，不联网也能演示（避免课堂网络故障） |

---

## 5 分钟课前准备

> 这一节是 **简化版** 的安装步骤。完整文档见主 README。

### 1. 安装

```bash
git clone https://github.com/weijt606/VibeRave.git
cd VibeRave
pnpm install                 # 默认轻量方案，约 715 MB
cp .env.example .env
pnpm dev
```

终端会出现两个地址：
- 网页：http://localhost:4321/
- API：http://localhost:4322

### 2. 配 AI 模型

打开 http://localhost:4321/，点右侧 **api** 标签：

- **Language Model** 区域 → 选一个预设（推荐 **OpenAI** 或 **Qwen DashScope** —— 中国用户用 Qwen 速度快、便宜）。
- 粘贴 API key，点 **Test LLM**，看到 `✓` 即可。
- **Speech-to-Text** 区域 → 第一次跑就用默认 **Whisper**（本地、不联网、自动下载模型）。
- **如果你的学生说中文**：在 STT 区下方勾选 **Chinese-English mixed input**。

### 3. 换背景图（可选但推荐）

默认背景是 VibeRave 的 rave 风格图，可能不太适合小学课堂。

打开 **Settings 标签 → Vibe → Background image URL**，可以填：
- 一张课堂友好的图 URL（比如卡通乐器、五线谱、小动物乐队）
- 或者把图放到 `website/public/` 里，填路径如 `/classroom-bg.png`
- 留空 = 默认

点 **Reset** 按钮可以一键还原。

### 4. 测一下能不能出声

点左侧的 `+` 创建一轨，在右侧文本框输入：

```
nursery rhyme in c major
```

回车。应该几秒钟内编辑器填入 Strudel 代码、扬声器开始播一段简单的 C 大调钢琴儿歌。**测试通过** = 可以上课了。

---

## 课堂演示流程（3 个时长档）

### 10 分钟快闪演示

| 时间 | 做什么 |
|---|---|
| 0:00–1:00 | 打开 VibeRave，介绍："我现在要让 AI 给我们做一段音乐，你们来出主意" |
| 1:00–3:00 | 输入 *"nursery rhyme in c major"* → 出儿歌。让孩子听 |
| 3:00–5:00 | 输入 *"marching band, 110 bpm"* → 切换成进行曲 |
| 5:00–7:00 | 让孩子说："你们想听什么？"，把他们的话改成 prompt |
| 7:00–10:00 | 输入 *"animal carnival, flute bird"* → 让孩子猜是什么动物 |

### 20 分钟基础课

| 时间 | 主题 | 做什么 |
|---|---|---|
| 0:00–5:00 | 介绍 | 解释 VibeRave 是什么、AI 怎么参与做音乐 |
| 5:00–10:00 | 三种风格 | 儿歌 → 摇篮曲 → 进行曲，让学生听对比 |
| 10:00–15:00 | 节拍游戏 | 输入 *"waltz at 90"* → 让全班数 "一二三、一二三"；再输入 *"march"* 数 "一二一二" |
| 15:00–20:00 | 学生主导 | 让 5 个学生轮流说一个想要的音乐，老师转成 prompt 发给 AI |

### 45 分钟完整课时

| 时间 | 主题 | 做什么 |
|---|---|---|
| 0:00–5:00 | 开场 | "今天我们用 AI 一起作曲"，演示 1 个 prompt |
| 5:00–15:00 | 节奏 | 演示 4/4（march）vs 3/4（waltz）vs 2/4（polka）vs 6/8（lullaby）的不同感觉 |
| 15:00–25:00 | 调号 | 输入 *"happy game in F major"* vs *"sad lullaby in A minor"*，讲大调小调的情绪 |
| 25:00–35:00 | 乐器 | 输入 *"flute melody"* / *"violin solo"* / *"music box"*，让学生认乐器音色 |
| 35:00–43:00 | 互动 | 学生轮流出主意改变音乐："让它快一点"、"加点小动物的声音" |
| 43:00–45:00 | 总结 | 回顾今天听到的：4 种节拍、2 种调号、5 种乐器，全部由 AI 实时生成 |

---

## 课堂用 Prompt 大全

> 所有 prompt 都可以用英文或中文说。中文经过测试可识别 —— 但用英文识别率更高、速度更快。

### 儿歌（Nursery rhyme）

| Prompt | 你听到 |
|---|---|
| *"nursery rhyme in c major"* | C 大调钢琴儿歌，twinkle 风 |
| *"twinkle twinkle style, gentle piano"* | 同上，更轻柔 |
| *"儿歌, 大调钢琴, 80 bpm"* | 中文输入也能识别 |
| *"simple kids song with marimba"* | 用木琴代替钢琴，更童趣 |

### 摇篮曲（Lullaby）

| Prompt | 你听到 |
|---|---|
| *"lullaby with music box, very slow"* | 音乐盒（gm_celesta）6/8 摇曳节拍 |
| *"摇篮曲, 音乐盒"* | 同上 |
| *"sleepy bedtime music in 6/8"* | 缓慢、安静、适合睡前 |
| *"music box solo, super gentle"* | 只有音乐盒一层，极简 |

### 进行曲 / 行进乐队（March）

| Prompt | 你听到 |
|---|---|
| *"marching band at 110 bpm, brass and drums"* | 经典军乐队、铜管 + 鼓 |
| *"进行曲, 110 bpm"* | 同上 |
| *"school march, fanfare"* | 校园进行曲，更隆重 |
| *"parade music with trumpets"* | 加上小号独奏感 |

### 华尔兹（Waltz）

| Prompt | 你听到 |
|---|---|
| *"waltz at 90 bpm, piano and strings"* | 3/4 钢琴 + 小提琴，舞厅风 |
| *"华尔兹, 90 bpm"* | 同上 |
| *"gentle ballroom waltz in d major"* | D 大调，更明亮 |
| *"viennese waltz, classical strings"* | 维也纳风，弦乐厚一点 |

### 波尔卡（Polka）

| Prompt | 你听到 |
|---|---|
| *"polka oompah at 115, accordion-like"* | 经典 oompah bass + 单簧管旋律 |
| *"波尔卡, 单簧管旋律"* | 同上 |
| *"fast polka with brass"* | 更快、铜管亮一点 |

### 动画追逐曲（Cartoon chase）

| Prompt | 你听到 |
|---|---|
| *"cartoon chase music, fast brass"* | Tom & Jerry 追逐风、铜管碎跑 |
| *"tom and jerry style at 145 bpm"* | 同上 |
| *"looney tunes chase theme"* | Looney Tunes 风格 |
| *"动画追逐, 快速铜管"* | 同上 |

### 8-bit 游戏曲（Happy 8-bit）

| Prompt | 你听到 |
|---|---|
| *"happy 8-bit game music in f major"* | F 大调方波旋律 + 三角波低音，明亮不刺耳 |
| *"Mario theme style, bright and fast"* | 马里奥风格 |
| *"video game music, kid-friendly"* | 游戏曲，已经避开了重失真 |
| *"electronic game music, 8-bit, no distortion"* | 8-bit 但干净 |

### 动物嘉年华（Animal carnival）

| Prompt | 你听到 |
|---|---|
| *"animal carnival, flute bird melody, cello elephant"* | 长笛当小鸟、大提琴当大象、钢片琴当闪光 |
| *"animal carnival in c major"* | 同上 |
| *"动物嘉年华, 长笛小鸟"* | 同上 |
| *"saint-saëns style elephant theme"* | 圣桑《动物狂欢节》风 |

### 音乐基础 / 教学辅助

| Prompt | 你听到 |
|---|---|
| *"c major scale practice, slow piano"* | C 大调音阶上下行，70 BPM，可以让学生跟唱 |
| *"音阶练习, do re mi"* | 同上 |
| *"music box solo, single melody"* | 单一旋律线，便于讲"旋律是什么" |
| *"simple piano melody in g major, 3/4"* | G 大调 3/4 简单旋律，讲拍号用 |

### 已经在播时怎么改

让 AI 改正在播的音乐（**不要重启，直接说**）：

| 你说 | 改变 |
|---|---|
| *"make it faster"* / *"快一点"* | 节奏加快 |
| *"slower"* / *"慢一点"* | 节奏放慢 |
| *"quieter"* / *"轻一点"* | 音量降低 |
| *"add a flute"* / *"加一支长笛"* | 加一个长笛层 |
| *"swap to violin"* / *"换成小提琴"* | 换主旋律乐器 |
| *"make it happier"* / *"开心一点"* | 转大调或加快 |
| *"sleepier"* / *"困一点"* | 慢下来 + 加柔和 |
| *"add bird sounds"* / *"加点小鸟"* | 加高音 sparkle 层 |
| *"like rain"* / *"像下雨"* | 加柔和打击 |

---

## 互动玩法（让孩子参与）

### 1. 学生出主意游戏
老师说："你们能想出一种动物吃东西的音乐吗？大象？小鸟？小老鼠？"  
让学生说，老师把他们的话转成 prompt 发出去。

### 2. "如果……是音乐"
- "如果月亮在跳舞会是什么音乐？"
- "如果春天来了会是什么音乐？"
- "如果你最喜欢的玩具会唱歌会唱什么？"

孩子的想象力是天然的好 prompt。

### 3. 班级投票
A 同学说："我要快的音乐"  
B 同学说："我要慢的"  
全班举手投票，胜出的指令发给 AI。

### 4. 节奏跟拍
出一段 march → 让孩子跟着拍手。出一段 waltz → 让孩子跟着数 "一二三"。出一段 polka → 让孩子跟着跺脚。

### 5. 猜乐器
不告诉学生 prompt 是什么，让他们听完猜："这是什么乐器？" "几个乐器？" "高的还是低的？"

### 6. 接龙作曲
第 1 个学生说"加进行曲鼓"  
第 2 个学生说"加小号"  
第 3 个学生说"加一段动物的声音"  
看看变到第 5 个学生时音乐变成了什么样。

---

## 教学要点（学生能学到什么）

| 维度 | 怎么教 |
|---|---|
| **节拍** | 4/4 march vs 3/4 waltz vs 2/4 polka vs 6/8 lullaby —— 让学生数拍子 |
| **大调 vs 小调** | "happy 8-bit in F major" vs "sad lullaby in A minor" 对比讲情绪 |
| **速度（BPM）** | 同一段 "march at 110" vs "march at 60" 对比听快慢 |
| **乐器音色** | "play it on piano" → "play it on flute" → "play it on violin" 切换 |
| **力度** | "quieter" / "louder" 演示力度记号 |
| **AI 创作** | 解释"AI 在做什么"：听人说的话 → 写代码 → 浏览器播音乐 |
| **代码即音乐** | 让孩子看编辑器："这一行是鼓，这一行是钢琴，这一行是低音" |

---

## 把背景图换成教室主题

默认背景是 VibeRave 的 rave 风格，可能不太合适小学教室。换图步骤：

### 方法 A：用 UI（推荐）

1. 打开 **Settings 标签**
2. 找到 **Vibe** 区块
3. **Background image URL** 输入框里填：
   - 一张图的 URL（https://...）
   - 或本地路径（如 `/img/strudel-themes.png` —— web 服务里现成的图）
   - 或你自己的图：先把图丢进 `website/public/classroom-bg.png`，然后填 `/classroom-bg.png`
4. 点 **Reset** 一键还原到默认

### 方法 B：直接替换默认图（一劳永逸）

把你要的图重命名为 `viberave-bg.png`，覆盖到 `website/public/viberave-bg.png`。浏览器刷新即可。

> 这些设置存在浏览器 localStorage 里，不会上传。每台课堂电脑都可以有自己的背景图。

### 推荐课堂主题图来源
- 免版权图库（Unsplash / Pexels / Pixabay）搜 "music classroom" / "cartoon instruments" / "rainbow music notes"
- AI 生成：在 Midjourney / DALL-E / 通义万相 输入"卡通乐器、彩色五线谱、儿童友好" 等

---

## 常见问题

### Q：学生说脏话或离题怎么办？
A：系统的 LLM 被告知不要瞎编 —— 如果请求无法转成音乐 pattern（比如"写首诗"、"我讨厌妈妈"），它会返回 "Couldn't generate" 标记，编辑器保持不变。不会出现尴尬内容。

### Q：会不会突然出现不适合小朋友的音乐？
A：**Family mode** 已经预防了大部分情况。只要老师的 prompt 包含课堂关键词（kids / 儿童 / 课堂 / nursery / 进行曲 等），就会强制：
- 大调默认（除非明确要求悲伤）
- 只允许声学乐器（钢琴、小提琴、长笛、铜管、木琴等）
- 禁止 808 sub、FM 失真、bit-crush、黑暗滤波
- 最多 4 层、BPM 60–145
- Berghain / brostep / dubstep / IDM 等成人风格会被自动替换成对应的儿童风格

如果老师**不带任何课堂关键词**直接说 "techno"，系统会出常规电子乐 —— 所以**带上课堂关键词是关键**。

### Q：学生想自己来打 prompt？
A：可以！但**推荐先用预设标签开始**（文本框上方的"风格"标签）—— 一键点击，安全。当学生熟悉后再让他们用自己的话打。打字一定要让老师过目再发。

### Q：识别中文准确率不高？
A：检查 **API Settings 标签 → STT → Chinese-English mixed input** 是否勾上。勾上后切换到双语 bias prompt，识别率明显提升。也可以让学生说英语（即便不标准，whisper 容错很好）。

### Q：上课时网络卡 LLM 响应慢？
A：两个办法：
1. **用本地 Ollama**：`ollama pull qwen2.5:14b`，然后在 API Settings 里切换到 Ollama。不联网也能跑。
2. **换更快的 LLM 服务商**：Groq 速度最快（< 1 秒响应），免费额度够上课用。

### Q：出了卡顿 / 报错怎么办？
A：
- 浏览器控制台 F12 看错误
- 检查 API 终端日志（`http://localhost:4322`）
- 重启 `pnpm dev`
- 详细排错见主 README 的 [Troubleshooting](../README.zh-CN.md#故障排查)

### Q：我能不能自己加新的儿童音乐模板？
A：可以。模板都在 `services/api/src/skills/strudel/examples/kids.md` —— 用编辑器打开，照着已有的格式加新的就行。skill 每次请求都会重读（不用重启 API）。

### Q：能录下来给家长听吗？
A：直接用系统的屏幕录制功能（macOS QuickTime、Windows 录屏）录浏览器即可，包含声音 + 画面。也可以用 OBS 分两轨录（系统音频 + 老师讲解）。

---

## 进阶（给会编程的老师 / 教学开发者）

### 加新模板

`services/api/src/skills/strudel/examples/kids.md` 是模板库。每个模板长这样：

```markdown
## 模板名（英文，e.g. "Folk hoedown")

简短描述。

\`\`\`js
setcps(120/60/4)
stack(
  // 三到四层 Strudel 代码
)
\`\`\`
```

加新模板后立即生效（不用重启 API）。

### 调整安全约束

`services/api/src/skills/strudel/rules/family-mode.md` 控制 family mode 的所有规则：触发关键词、允许的乐器、禁止的效果、默认调号、BPM 范围等。改它就改 family mode 行为。

### 加触发关键词

在 `family-mode.md` 的"Activation triggers"小节加你想要触发 family mode 的中英文关键词。常用的"小一"、"二年级"、"四年级"已经隐式可识别，但你也可以加得更精确。

### 调整教学路由

`services/api/src/skills/strudel/recipes/generate.md` 里有"slot-to-code mapping"表，决定关键词 → 模板的映射。改它就改路由逻辑。

---

## 反馈和贡献

- 在 https://github.com/weijt606/VibeRave/issues 提 issue
- 课堂上发现的好 prompt、新点子、安全建议都欢迎 PR 进 `kids.md` / `family-mode.md`

祝你的课堂玩得开心。
