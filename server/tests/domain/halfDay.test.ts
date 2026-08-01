import { describe, expect, it } from 'vitest';
import { qualifiesAsHalfDay, resolveHalfDayOutcome } from '../../src/domain/halfDay.js';

describe('half-day rule (domain-rules §5)', () => {
  it.each([
    [240, true],
    [300, true],
    [239, false],
    [0, false],
  ])('qualifiesAsHalfDay(%i) → %s', (mins, expected) => {
    expect(qualifiesAsHalfDay(mins)).toBe(expected);
  });

  it('resolveHalfDayOutcome: ≥4h → half_day 0.5, <4h → on_leave 1.0', () => {
    expect(resolveHalfDayOutcome(300)).toEqual({ status: 'half_day', leaveDaysCharged: 0.5 });
    expect(resolveHalfDayOutcome(240)).toEqual({ status: 'half_day', leaveDaysCharged: 0.5 });
    expect(resolveHalfDayOutcome(180)).toEqual({ status: 'on_leave', leaveDaysCharged: 1.0 });
  });
});
