# Rule: style fidelity (a named genre is a contract)

When the user names a genre, the output must be **recognizable as that
genre within the first two bars**. The most common failure mode is
drifting back to a generic four-on-floor + saw-bass + string-pad mold
and putting the genre's name on it — that's how every request starts
sounding the same.

## Genre fingerprints

Tempo, drum feel, and one signature element are the identity of a
genre. Get these three right before anything else:

| Genre | Tempo (BPM) | Drum feel | Signature element (must be present) |
|---|---|---|---|
| house / deep house | 120–128 | four-on-floor, offbeat open hats | warm chord stab on the offbeat |
| techno (peak-time) | 135–150 | four-on-floor, relentless | driving filtered bassline, minimal harmony |
| minimal / dub techno | 125–132 | four-on-floor, SPARSE | empty space; one delay-tailed element |
| trance / progressive | 132–140 | four-on-floor, rolling 16th bass | supersaw lead/pad, long filter sweeps |
| drum and bass / jungle | 160–180 | breakbeat (NOT four-on-floor) | fast broken drums over half-time sub |
| dubstep / riddim | ~140 | half-time (kick on 1, snare on 3) | LFO wobble bass in the mids |
| trap / drill | 130–150 | half-time, 808 kick, hat rolls | sliding sub, `hh*16` with gain rolls |
| UK garage / 2-step | 130–138 | syncopated 2-step (skipped kicks) | shuffled hats, chopped chord stabs |
| lo-fi hip-hop | 70–90 | swung boom-bap | dusty ep/keys chord, laid-back swing |
| dub / reggae-adjacent | 70–80 | one-drop-ish, sparse | heavy delay feedback on skank/snare |
| ambient / drone | free / slow | little or no drums | evolving pad, long reverb, slow LFOs |
| disco / funk | 110–122 | four-on-floor + 16th hats | syncopated bassline, brass/clav stabs |
| IDM / breakcore | varies | deliberately broken, mutating | per-cycle transforms (`chunk`, `iter`, `degradeBy`) |
| hyperpop | 150–170 | bright four-on-floor or half-time | fast major-key melody, pitched-up energy |

## Pre-emit checklist

Before returning code for a named genre, verify:

1. **Tempo in range?** A "drum and bass" request at 120 BPM is not DnB.
2. **Drum feel correct?** Four-on-floor vs breakbeat vs half-time vs
   2-step is the single loudest genre cue. Never put four-on-floor
   under trap, DnB, dubstep, or 2-step.
3. **Signature element present?** From the table above — one per genre.
4. **Nothing that contradicts the genre?** e.g. a lush supersaw pad on
   minimal techno, `.swing(4)` on trance, a busy melody on riddim,
   `.crush(8)` on anything the user didn't call lo-fi/8-bit.

If the user names a genre you don't have a fingerprint for, use the
closest row and say so via the uncertainty markers
(`rules/uncertainty.md`) — don't silently substitute generic techno.

## Mixing genres

"Jazzy house", "ambient DnB": drum feel + tempo come from the SECOND
(rhythm) genre, harmony/instrumentation from the first. When only a
mood word is given ("dreamy", "dark"), pick the genre from context or
history — mood alone never overrides an explicitly named genre.
