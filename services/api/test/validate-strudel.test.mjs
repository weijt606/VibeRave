import { describe, it, expect } from 'vitest';
import { findDeniedToken, makeValidateStrudel } from '../src/application/validate-strudel.mjs';

describe('static denylist', () => {
  it('finds forbidden identifiers outside string literals', () => {
    expect(findDeniedToken('fetch("x")')).toBe('fetch');
    expect(findDeniedToken('s("bd").gain(fetch("x"))')).toBe('fetch');
    expect(findDeniedToken('window.location')).toBe('window');
    expect(findDeniedToken('globalThis.x')).toBe('globalThis');
    expect(findDeniedToken('new Function("x")')).toBe('Function');
    expect(findDeniedToken('eval("1")')).toBe('eval');
    expect(findDeniedToken('import x from "y"')).toBe('import');
    expect(findDeniedToken('require("fs")')).toBe('require');
  });
  it('ignores the same words inside strings and as property names', () => {
    expect(findDeniedToken('s("window process fetch")')).toBe(null);
    expect(findDeniedToken('note("c e g").s("gm_piano")')).toBe(null);
    // property access on a pattern is harmless (undefined) — only bare globals matter
    expect(findDeniedToken('x.process')).toBe(null);
    expect(findDeniedToken('s("bd").fetch')).toBe(null);
    expect(findDeniedToken('const documentation = 1')).toBe(null);
  });
  it('rejects before evaluate and ignores the EXPLAIN line', async () => {
    const validate = makeValidateStrudel();
    const bad = await validate('s("bd").gain(fetch("http://x"))');
    expect(bad.valid).toBe(false);
    expect(bad.error).toMatch(/forbidden token "fetch"/);
    expect(await validate('s("bd sd")\nEXPLAIN: 加鼓')).toEqual({ valid: true });
    expect((await validate('EXPLAIN: only')).valid).toBe(false);
  });
});
