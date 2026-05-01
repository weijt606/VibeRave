# Rule: lushness (avoid 8-bit dryness)

Bare `sawtooth` / `square` / `triangle` oscillators + dry drums + no reverb
= chiptune. Even on club genres (techno / house / trance), modern
electronic music **always** has at least one of: a reverberant pad, a
delay-tailed lead, a side-chained sub, or a stereo-spread layer. Without
those the output sounds 8-bit, not electronic.

## Hard requirement

Every generated `stack(...)` MUST include at least ONE of the following,
on a layer that isn't drums:

1. **Reverb tail** — `.room(>= 0.4)` on a melodic / chord / pad layer.
2. **Delay tail** — `.delay(>= 0.3).delaytime(0.25 | 0.375 | 0.5).delayfeedback(0.4–0.7)` on a chord stab or lead.
3. **Side-chain ducking** — pad/sub layer with `.attack(0.005).release(0.5)` and gain modulated by kick (use the dub / Berghain template's structure).
4. **Filter sweep modulation** — `.lpf(sine.range(low, high).slow(4..16))` on a melodic / pad layer (NOT the same one that already has reverb — diversity).

For genres that traditionally feel "dry" (minimal techno, hard techno,
chiptune-by-request), still include a subtle atmospheric layer — a
**ghost pad** at low gain (0.2–0.3) with `.room(0.5)` works without
breaking the genre identity. Don't be afraid to add a 4th layer to a
3-layer template if the result sounds bare.

## Soft preferences (use unless user contradicts)

- **Pads / chord stabs** should default to soft attacks: `.attack(0.05–0.3).release(0.4–0.8)`.
- **Synths beyond raw waveforms**: prefer `gm_synth_strings_1`, `gm_choir_aahs`, `gm_pad_warm`, `gm_epiano2`, `gm_celesta` for melodic layers when the genre allows. They already sound less chiptune than bare `sawtooth`.
- **FM synthesis** (`.s("sine").fmh(N).fmi(M)`) gives a "metallic / industrial / bell" character that fights the chiptune feel for harder genres.
- **Stereo width**: `.jux(rev)` or `.off(0.125, x => x.add(7))` on a non-drum layer adds depth at zero extra cost.
- **Gentle saturation**: `.crush(8)` is too lo-fi for most genres; `.crush(12)` is barely audible warmth. Use `.shape(0.3)` or skip distortion entirely when going for "lush."

## When to skip atmosphere

- **Chiptune / 8-bit** explicitly requested by user → keep it dry, that's the genre's identity.
- **Drone** explicitly → reverb is mandatory but everything else can be sparse.
- **First half of a build-up / drop sequence** in `arrange()` → first slice can be dry to make the wet drop hit harder.

## Anti-patterns

- ❌ `stack(s("bd*4"), note("...").s("sawtooth"))` — two dry layers, no atmosphere. Add a third with reverb.
- ❌ `room(0.9)` on EVERYTHING — the mix turns to mud. Pick ONE primary atmospheric layer.
- ❌ Using `gm_synth_strings_1` for the bass — wrong frequency band, sounds gauzy. Strings are for chord/pad layers.
