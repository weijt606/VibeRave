# Changelog

All notable changes to VibeRave are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this file starts at the audio-engine / style-fidelity overhaul — earlier
history lives in `git log`.

## [Unreleased] - 2026-07-16

### Audio engine (packages/superdough)

#### Added

- **Master-bus brickwall limiter** (`superdoughoutput.mjs`) — the summed
  orbit mix used to hit `audioContext.destination` raw, so stacked layers
  hard-clipped into harsh digital distortion. A transparent
  `DynamicsCompressorNode` stage (threshold −1.5 dB, ratio 20:1,
  attack 1 ms) now sits between the master gain and the destination.
  Auto-bypassed when the destination has more than 2 channels, because
  `DynamicsCompressorNode` would downmix multichannel/surround output.

#### Changed

- **Envelope declick floors** — minimum attack raised from 1 ms to 2 ms in
  `getADSRValues` (`helpers.mjs`) and in the basic-waveform synth defaults
  (`synth.mjs`). A 1 ms linear ramp still produced an audible click on
  sustained tones at high gain; 2 ms declicks without losing punch.

### Generation quality (services/api skill prompt)

#### Added

- **`rules/style-fidelity.md`** — "a named genre is a contract": fingerprint
  table (tempo range / drum feel / signature element) for 14 genre families
  plus a pre-emit checklist, so named-genre requests stop drifting into
  generic four-on-floor techno. Registered in the system-prompt assembly
  order (`services/api/src/index.mjs`).
- **Texture & realism section** in `rules/sound-design.md` — gentle drive
  over bit-crush, humanized velocities, ghost-note variation, genre-aware
  swing, frequency-register separation, soft attacks on sustained layers.
- **Anti-homogenization rules** in `rules/diversity.md` — rotate the key
  (mood → root guidance, never default everything to C minor), vary tempo
  inside the genre's authentic range, vary melodic register and rhythm
  placement between turns.

#### Changed

- **`examples/genres.md` templates transposed out of the C-minor
  monoculture** — lo-fi → F minor, house → A minor, DnB → G minor,
  trap & jazzy chill → D minor, ambient → E minor, acid → A minor —
  plus a header note telling the model to transpose templates and pick
  tempos inside the genre range instead of copying verbatim. All
  transposed patterns verified against the project's mini-notation parser.
- `SKILL.md` loading order and the skill `README.md` layout/loading lists
  synced with the actual `SKILL_ORDER` in `services/api/src/index.mjs`
  (both had drifted, missing several rule files).
