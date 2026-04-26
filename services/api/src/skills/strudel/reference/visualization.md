# Reference: visualization

In VibeRave the **host** renders the per-track visualizer. The user picks a
painter (waveform / pianoroll / spectrum / scope / spiral) from a dropdown
on each track card; the canvas is scoped to that track. Code you generate
should **not** add a visualizer of its own.

## Don't emit these

```
.pianoroll()  .scope()  .fscope()  .tscope()  .spectrum()
.spiral()     .pitchwheel()  .drawLine()
```

The first six lazily create / paint on Strudel's global fullscreen canvas
(`#test-canvas`), which VibeRave hides via CSS to keep the panel chrome
clean. So calling them does nothing visible — just wastes a few CPU cycles
and clutters the chat history.

The host's per-track painter reads the audio analyser registered for this
track automatically (see `services/api/.../trackVolume.mjs`) and routes the
output to the per-track canvas. It does not need any cooperation from your
code.

## The one exception

`.markcss('...')` is fine — it styles editor highlights, not visualization.
Use **single quotes** for the CSS string so the surrounding mini-notation
can stay double-quoted:

```js
note("c a f e").markcss('text-decoration:underline; color:#f0f')
```

## If the user explicitly asks for a viz

Direct them to the **per-track viz dropdown** in the chat reply (or in
the user-visible portion of the response, NOT in the code). Do not append
a viz call to the pattern.
