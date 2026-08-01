import { describe, expect, it } from 'vitest';
import {
  deadlineState,
  deadlineIndicator,
  deliveredOnTime,
  isOverdue,
} from '../../src/domain/campaign.js';

describe('campaign deadline state machine (domain-rules §14)', () => {
  it.each([
    ['2026-11-01', '2026-11-10', 'in_progress', 'on_track'], // +9
    ['2026-11-05', '2026-11-10', 'in_progress', 'coming_up'], // +5 boundary
    ['2026-11-04', '2026-11-10', 'in_progress', 'on_track'], // +6
    ['2026-11-09', '2026-11-10', 'in_progress', 'coming_up'], // +1
    ['2026-11-10', '2026-11-10', 'in_progress', 'due_today'], // 0
    ['2026-11-11', '2026-11-10', 'in_progress', 'overdue'], // -1
  ] as const)('today %s, deadline %s → %s', (today, deadline, status, expected) => {
    expect(deadlineState(deadline, today, status)).toBe(expected);
  });

  it('delivered short-circuits regardless of dates', () => {
    expect(deadlineState('2026-11-10', '2026-11-20', 'delivered')).toBe('delivered');
    expect(deadlineIndicator('2026-11-10', '2026-11-20', 'delivered')).toBe('on_track');
  });

  it('deadlineIndicator maps overdue/coming_up/due_today through', () => {
    expect(deadlineIndicator('2026-11-10', '2026-11-11', 'in_progress')).toBe('overdue');
    expect(deadlineIndicator('2026-11-10', '2026-11-09', 'in_progress')).toBe('coming_up');
  });

  it('isOverdue only for non-delivered past deadline', () => {
    expect(isOverdue('2026-11-10', '2026-11-11', 'in_progress')).toBe(true);
    expect(isOverdue('2026-11-10', '2026-11-09', 'in_progress')).toBe(false);
    expect(isOverdue('2026-11-10', '2026-11-11', 'delivered')).toBe(false);
  });

  it('deliveredOnTime: delivered ≤ deadline', () => {
    expect(deliveredOnTime('2026-11-10', '2026-11-10')).toBe(true);
    expect(deliveredOnTime('2026-11-10', '2026-11-09')).toBe(true);
    expect(deliveredOnTime('2026-11-10', '2026-11-11')).toBe(false);
  });
});
