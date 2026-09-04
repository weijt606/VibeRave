import { NotFound, InvalidInput } from '../../../domain/errors.mjs';
import { PREGEN_MODES } from '../../../infrastructure/pregen-store.mjs';

// GET /pregen?mode=adult|kids&style=<style>  → one random pregenerated
// pattern (written by scripts/pregenerate.mjs). 404 when nothing matches
// so the front-end fast lane can fall back to the LLM path.
export function registerPregen(fastify, { pregenStore }) {
  fastify.get('/pregen', async (request) => {
    const mode = String(request.query?.mode || 'adult').toLowerCase();
    const style = request.query?.style ? String(request.query.style) : '';
    if (!PREGEN_MODES.has(mode)) throw new InvalidInput("`mode` must be 'adult' or 'kids'.");
    const hit = pregenStore ? await pregenStore.pick(mode, style) : null;
    if (!hit) {
      throw new NotFound(
        style
          ? `No pregenerated pattern for mode=${mode} style=${style}. Run scripts/pregenerate.mjs.`
          : `No pregenerated patterns for mode=${mode}. Run scripts/pregenerate.mjs.`,
      );
    }
    return hit;
  });
}
