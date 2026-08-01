import { describe, expect, it } from 'vitest';
import {
  computeFactor,
  computeFactorAttendance,
  computeFactorCampaign,
  computeFactorTask,
  computeLeaderboardScore,
  onTimeStreak,
  rankAndMovement,
} from '../../src/domain/leaderboard.js';

describe('leaderboard factors & score (domain-rules §13.4)', () => {
  it('factor is null on a zero denominator', () => {
    expect(computeFactor(0, 0)).toBeNull();
    expect(computeFactorAttendance(22, 24)).toBeCloseTo(0.9167, 4);
    expect(computeFactorTask(18, 20)).toBe(0.9);
    expect(computeFactorCampaign(2, 3)).toBeCloseTo(0.6667, 4);
    expect(computeFactorTask(0, 0)).toBeNull();
    expect(computeFactorCampaign(1, 0)).toBeNull();
  });

  it('canonical score → 83 (mean of 0.9167, 0.90, 0.6667)', () => {
    const f = {
      attendance: 22 / 24,
      task: 18 / 20,
      campaign: 2 / 3,
    };
    expect(computeLeaderboardScore(f)).toEqual({ score: 83, hasData: true });
  });

  it('new joiner with only attendance → 100, hasData false when others null', () => {
    expect(computeLeaderboardScore({ attendance: 1.0, task: null, campaign: null })).toEqual({
      score: 100,
      hasData: true,
    });
  });

  it('all null → 0 with hasData false', () => {
    expect(computeLeaderboardScore({ attendance: null, task: null, campaign: null })).toEqual({
      score: 0,
      hasData: false,
    });
  });

  it('clamps into [0,100]', () => {
    expect(computeLeaderboardScore({ attendance: 1, task: 1, campaign: 1 }).score).toBe(100);
    expect(computeLeaderboardScore({ attendance: 0, task: 0, campaign: 0 }).score).toBe(0);
  });
});

describe('rank & movement (domain-rules §13.3)', () => {
  it('sorts desc, ties share rank, computes movement vs prior', () => {
    const ranked = rankAndMovement(
      [
        { userId: 'a', score: 90 },
        { userId: 'b', score: 90 },
        { userId: 'c', score: 70 },
        { userId: 'd', score: 50 },
      ],
      [
        { userId: 'a', rank: 2 },
        { userId: 'b', rank: 1 },
        { userId: 'c', rank: 3 },
        // d has no prior snapshot → 'new'
      ],
    );
    expect(ranked).toEqual([
      { userId: 'a', score: 90, rank: 1, movement: 'up' },
      { userId: 'b', score: 90, rank: 1, movement: 'same' },
      { userId: 'c', score: 70, rank: 3, movement: 'same' },
      { userId: 'd', score: 50, rank: 4, movement: 'new' },
    ]);
  });
});

describe('on-time streak (domain-rules §13.3)', () => {
  it('counts the trailing run of perfect months', () => {
    expect(onTimeStreak([true, false, true, true, true])).toBe(3);
    expect(onTimeStreak([true, true, false])).toBe(0);
    expect(onTimeStreak([])).toBe(0);
    expect(onTimeStreak([true, true, true])).toBe(3);
  });
});
