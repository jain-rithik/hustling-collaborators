import { describe, expect, it } from 'vitest';
import { canClaimBirthday, canClaimOptionalHoliday } from '../../src/domain/optionalHoliday.js';

describe('optional holiday & birthday entitlement (domain-rules §15)', () => {
  it('up to 2 optional holidays per FY', () => {
    expect(canClaimOptionalHoliday(0)).toBe(true);
    expect(canClaimOptionalHoliday(1)).toBe(true);
    expect(canClaimOptionalHoliday(2)).toBe(false);
  });

  it('1 birthday claim, only on the DOB month+day', () => {
    expect(canClaimBirthday(0, '2026-09-12', '1998-09-12')).toBe(true);
    expect(canClaimBirthday(1, '2026-09-12', '1998-09-12')).toBe(false); // already used
    expect(canClaimBirthday(0, '2026-09-13', '1998-09-12')).toBe(false); // wrong day
  });

  it('29-Feb birthday claimable on 28-Feb in a non-leap year', () => {
    expect(canClaimBirthday(0, '2027-02-28', '2000-02-29')).toBe(true);
    expect(canClaimBirthday(0, '2027-02-27', '2000-02-29')).toBe(false);
  });
});
