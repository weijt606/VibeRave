# Rule: lushness (genre-aware atmosphere)

Modern electronic music is often "lush" — reverb tails, delay returns,
side-chained pads, slow filter sweeps. But not always. Trap should hit
dry. Hard techno should be brutalist. IDM lives on close-mic'd grit.
Footwork is mostly transients. **Forcing atmosphere onto every track
is the #1 reason different genres start sounding the same.**

So: lushness is **genre-tiered**, not universal. Pick the tier that
matches the user's stated vibe; only Tier A is required to ship a
"lush" layer.

## Tier A — atmosphere required (one of the lushness devices below)

Genres that lose their identity without atmospheric depth:

- ambient / drone / dark ambient
- dub / dub techno / deep house
- lo-fi / chillhop / chill
- jazz / chill jazz / smooth jazz / ballad
- trance / progressive / shoegaze / vaporwave / dream-pop
- trip-hop / downtempo
- future garage (the dubby cousin of dubstep — slower BPM, atmosphere on)

For these, every `stack(...)` MUST include at least ONE of:

1. **Reverb tail** — `.room(>= 0.4)` on a melodic / chord / pad layer.
2. **Delay tail** — `.delay(>= 0.3).delaytime(0.25 | 0.375 | 0.5).delayfeedback(0.4–0.7)` on a chord stab or lead.
3. **Side-chain ducking** — pad/sub with `.attack(0.005).release(0.5)`.
4. **Filter sweep modulation** — `.lpf(sine.range(low, high).slow(4..16))` on a melodic / pad layer.

## Tier B — DRY by default (do NOT auto-add atmosphere)

Genres whose identity is dryness, transient impact, or raw timbre.
**Skip the ghost pad. Skip the reverb tail. Skip the delay return.**
Add atmosphere only if the user explicitly asks ("more reverb", "lush",
"atmospheric", "dubbier", "more space"):

- minimal techno / hard techno / industrial techno / gabber / hardcore
- trap / drill / phonk / memphis
- dubstep / brostep / riddim (wobble character lives in the dry mids; pad smothers it)
- IDM / breakcore / footwork / juke
- punk / raw / gritty / lofi-punk / no-wave
- chiptune / 8-bit / NES-style (when user asked for it)
- jersey club / baltimore club / dembow
- garage / UK garage / 2-step (the dry transient kind) — **future garage** is the exception, it lives in Tier A

A Tier B track may still have **one** subtly reverbed transient (e.g.
`.room(0.25)` on a clap or rim) — that's a percussion-design touch,
not a "lushness layer." It does not break the dry feel.

## Tier C — use judgment (most user prompts land here)

Generic techno, house, hyperpop, DnB, jungle, funky disco, drum and
bass, modal jazz, anything ambiguous. Default behaviour:

- If the prompt mentions atmosphere words ("warm", "dreamy", "spacious",
  "deep", "moody", "atmospheric", "underwater") → treat as Tier A.
- If it mentions impact words ("hard", "raw", "punchy", "stripped",
  "tight", "pumping", "club", "industrial") → treat as Tier B.
- Otherwise: **one** atmospheric device is fine but not required.
  Prefer a single delay return on the chord layer over a full ghost
  pad — it's lighter and won't dominate the mix.

## Key change from previous version

Earlier versions said even minimal techno needs a "ghost pad at gain
0.25 with room 0.5". **That rule is repealed.** Minimal techno's
identity IS the empty space; filling it makes every minimal track
sound like every dub track sound like every ambient track. If the
user wants atmosphere on top of minimal, they'll ask.

## Soft preferences (apply across all tiers)

- **Pads / chord stabs** default to soft attacks: `.attack(0.05–0.3).release(0.4–0.8)`.
- **Stereo width**: `.jux(rev)` or `.off(0.125, x => x.add(7))` on a non-drum layer is essentially free — applies even to Tier B.
- **Gentle saturation**: `.crush(12)` is barely audible warmth. Use `.shape(0.3)` for soft drive when going for "lush."
- **FM synthesis** (`.s("sine").fmh(N).fmi(M)`) gives industrial bite — fights chiptune for hard genres without needing reverb.

## Anti-patterns

- ❌ Adding a `gm_pad_warm` ghost layer to a trap / minimal / IDM track the user didn't ask for atmosphere on
- ❌ `room(0.9)` on EVERYTHING — the mix turns to mud. Pick ONE primary atmospheric layer.
- ❌ Using `gm_synth_strings_1` for the bass — wrong frequency band, sounds gauzy.
- ❌ A Tier A genre (ambient / dub / lo-fi) with no atmospheric layer at all — that's the one case the old "every stack needs lush" rule still applies.
