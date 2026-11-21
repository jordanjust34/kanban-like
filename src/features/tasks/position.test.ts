import { describe, it, expect } from 'vitest';
import { POSITION_STEP, needsRenumber, positionBetween, renumber } from './position';

describe('positionBetween', () => {
  it('starts an empty column at 1000', () => {
    expect(positionBetween()).toBe(1000);
    expect(positionBetween(undefined, undefined)).toBe(1000);
  });

  it('puts a card at the top 1000 above the first card', () => {
    expect(positionBetween(undefined, 1000)).toBe(0);
    expect(positionBetween(undefined, -500)).toBe(-1500);
  });

  it('puts a card at the bottom 1000 below the last card', () => {
    expect(positionBetween(3000, undefined)).toBe(4000);
  });

  it('takes the midpoint between two neighbours', () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(1000, 1001)).toBe(1000.5);
  });

  it('works whichever way round the neighbours are passed', () => {
    expect(positionBetween(2000, 1000)).toBe(1500);
  });

  it('keeps strict ordering through many halvings until the gap is tiny', () => {
    let prev = 1000;
    const next = 2000;
    for (let i = 0; i < 30; i++) {
      const mid = positionBetween(prev, next);
      expect(mid).toBeGreaterThan(prev);
      expect(mid).toBeLessThan(next);
      prev = mid;
    }
  });

  it('uses a 1000 step', () => {
    expect(POSITION_STEP).toBe(1000);
  });
});

describe('needsRenumber', () => {
  it('is false when either side is open', () => {
    expect(needsRenumber(undefined, 1)).toBe(false);
    expect(needsRenumber(1, undefined)).toBe(false);
    expect(needsRenumber(undefined, undefined)).toBe(false);
  });

  it('is false for a healthy gap', () => {
    expect(needsRenumber(1000, 2000)).toBe(false);
    expect(needsRenumber(1, 1 + 1e-6)).toBe(false);
  });

  it('is true when the gap is below 1e-9', () => {
    expect(needsRenumber(1, 1 + 1e-10)).toBe(true);
    expect(needsRenumber(5, 5)).toBe(true);
  });

  it('is true when the midpoint would not land strictly between (float exhaustion)', () => {
    const a = 1e15;
    const b = a + 0.125;
    expect(needsRenumber(a, b)).toBe(true);
  });
});

describe('renumber', () => {
  it('assigns 1000, 2000, … in the given order', () => {
    const out = renumber([
      { id: 'a', position: 7 },
      { id: 'b', position: 7 },
      { id: 'c', position: 7.0000000001 },
    ]);
    expect(out).toEqual([
      { id: 'a', position: 1000 },
      { id: 'b', position: 2000 },
      { id: 'c', position: 3000 },
    ]);
  });

  it('returns an empty list for an empty column', () => {
    expect(renumber([])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [{ id: 'a', position: 1 }];
    renumber(input);
    expect(input).toEqual([{ id: 'a', position: 1 }]);
  });
});
