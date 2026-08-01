import { describe, expect, it } from 'vitest';
import { computeFocusMinutes, formatFocus } from '../../src/domain/focus.js';

describe('focus time (domain-rules §6)', () => {
  it('sums Start→Done durations (canonical example → 290)', () => {
    expect(
      computeFocusMinutes([
        { actualMinutes: 45 },
        { actualMinutes: 120 },
        { actualMinutes: 95 },
        { actualMinutes: 30 },
      ]),
    ).toBe(290);
  });

  it('treats null actualMinutes as 0 and empty list as 0', () => {
    expect(computeFocusMinutes([{ actualMinutes: null }, { actualMinutes: 60 }])).toBe(60);
    expect(computeFocusMinutes([])).toBe(0);
  });

  it('formats as "Xh Ym in the zone" — never a percentage', () => {
    expect(formatFocus(290)).toBe('4h 50m in the zone');
    expect(formatFocus(120)).toBe('2h in the zone');
    expect(formatFocus(45)).toBe('45m in the zone');
    expect(formatFocus(0)).toBe('0m in the zone');
  });
});
