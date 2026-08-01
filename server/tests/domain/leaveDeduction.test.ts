import { describe, expect, it } from 'vitest';
import { advanceCapOk, applyLeaveDeduction } from '../../src/domain/leaveDeduction.js';

describe('applyLeaveDeduction — priority ordering (domain-rules §9.3)', () => {
  it('comp-off 2, PL 1, take 4 (default, no advance) → 1 LWP', () => {
    expect(applyLeaveDeduction(4, { compOff: 2, pl: 1 })).toEqual({
      fromCompOff: 2,
      fromPl: 1,
      fromAdvance: 0,
      fromLwp: 1,
    });
  });

  it('comp-off 2, PL 9, take 3 → PL covers the rest', () => {
    expect(applyLeaveDeduction(3, { compOff: 2, pl: 9 })).toEqual({
      fromCompOff: 2,
      fromPl: 1,
      fromAdvance: 0,
      fromLwp: 0,
    });
  });

  it('half-day preserves comp-off (indivisible) → draws PL (E20)', () => {
    expect(applyLeaveDeduction(0.5, { compOff: 2, pl: 3 })).toEqual({
      fromCompOff: 0,
      fromPl: 0.5,
      fromAdvance: 0,
      fromLwp: 0,
    });
  });

  it('1.5 days with comp-off 2 → comp-off covers only the whole day, PL the half', () => {
    expect(applyLeaveDeduction(1.5, { compOff: 2, pl: 3 })).toEqual({
      fromCompOff: 1,
      fromPl: 0.5,
      fromAdvance: 0,
      fromLwp: 0,
    });
  });

  it('PL 1, take 7 with advance → PL 1 + advance 5 + LWP 1', () => {
    expect(
      applyLeaveDeduction(7, { compOff: 0, pl: 1 }, { allowAdvance: true, advanceCap: 5 }),
    ).toEqual({ fromCompOff: 0, fromPl: 1, fromAdvance: 5, fromLwp: 1 });
  });

  it('PL 1, take 6 with advance (default cap 5) → no LWP', () => {
    expect(applyLeaveDeduction(6, { compOff: 0, pl: 1 }, { allowAdvance: true })).toEqual({
      fromCompOff: 0,
      fromPl: 1,
      fromAdvance: 5,
      fromLwp: 0,
    });
  });
});

describe('advanceCapOk (domain-rules §9.1)', () => {
  it('full-time allows currentPL + 5', () => {
    expect(advanceCapOk(1, 6, 'full_time')).toBe(true);
    expect(advanceCapOk(1, 7, 'full_time')).toBe(false);
  });
  it('intern has no advance', () => {
    expect(advanceCapOk(3, 3, 'intern')).toBe(true);
    expect(advanceCapOk(3, 4, 'intern')).toBe(false);
  });
});
