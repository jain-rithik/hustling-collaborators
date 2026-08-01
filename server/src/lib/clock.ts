import { DateTime } from 'luxon';
import { IST_TZ } from '@hc/shared';

/**
 * The ONLY place `DateTime.now()` is allowed. Services obtain "now" here and pass it
 * into pure domain functions, which never read the wall clock themselves — that is
 * what makes "before the off day", "on or before the 15th", and "grace until 10:45"
 * deterministic under test (architecture §6.2).
 */
export interface Clock {
  now(): DateTime;
}

export const systemClock: Clock = {
  now: () => DateTime.now().setZone(IST_TZ),
};

/** A fixed clock for tests. `at` may be an ISO string or a Luxon DateTime. */
export function fixedClock(at: string | DateTime): Clock {
  const dt = typeof at === 'string' ? DateTime.fromISO(at, { zone: IST_TZ }) : at.setZone(IST_TZ);
  return { now: () => dt };
}
