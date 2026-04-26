/*
signal.test.mjs - <short description TODO>
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/packages/core/test/pattern.test.mjs>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import Fraction from 'fraction.js';

import { describe, it, expect, vi } from 'vitest';

import { saw, saw2, isaw, isaw2, per, perx, cyclesPer } from '../signal.mjs';
import { fastcat, sequence, State, TimeSpan, Hap, note } from '../index.mjs';

const st = (begin, end) => new State(ts(begin, end));
const ts = (begin, end) => new TimeSpan(Fraction(begin), Fraction(end));
const hap = (whole, part, value, context = {}) => new Hap(whole, part, value, context);

const third = Fraction(1, 3);
const twothirds = Fraction(2, 3);

const sameFirst = (a, b) => {
  return expect(a.sortHapsByPart().firstCycle()).toStrictEqual(b.sortHapsByPart().firstCycle());
};

describe('signal()', () => {
  it('Can make saw/saw2', () => {
    expect(saw.struct(true, true, true, true).firstCycle()).toStrictEqual(
      sequence(0, 1 / 4, 1 / 2, 3 / 4).firstCycle(),
    );

    expect(saw2.struct(true, true, true, true).firstCycle()).toStrictEqual(sequence(-1, -0.5, 0, 0.5).firstCycle());
  });
  it('Can make isaw/isaw2', () => {
    expect(isaw.struct(true, true, true, true).firstCycle()).toStrictEqual(sequence(1, 0.75, 0.5, 0.25).firstCycle());

    expect(isaw2.struct(true, true, true, true).firstCycle()).toStrictEqual(sequence(1, 0.5, 0, -0.5).firstCycle());
  });
});

describe('cyclesPer', () => {
  it('gives cycles per hap', () => {
    sameFirst(
      cyclesPer.struct(true, true, true, fastcat(true, true)),
      sequence(0.25, 0.25, 0.25, fastcat(0.125, 0.125)).fmap(Fraction),
    );
  });
});
describe('per', () => {
  it('gives haps per cycle', () => {
    sameFirst(per.struct(true, true, true, fastcat(true, true)), sequence(4, 4, 4, fastcat(8, 8)).fmap(Fraction));
  });
});

describe('perx', () => {
  it('gives exponential haps per cycle', () => {
    sameFirst(
      perx.struct(true, true, true, fastcat(true, fastcat(true, true))),
      sequence(3, 3, 3, fastcat(4, fastcat(5, 5))),
    );
  });
});

describe('shuffle', () => {
  it('returns original pattern if input is 1', () => {
    expect(note('c d e f').sound('piano').shuffle(1).firstCycle()).toEqual(note('c d e f').sound('piano').firstCycle());
  });
});
