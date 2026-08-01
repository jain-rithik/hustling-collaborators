/**
 * Leaderboard scoring (domain-rules §13 / PRD §14.1). Three equal-weighted factors —
 * on-time attendance, task-estimate accuracy, campaign-deadline delivery — averaged to a
 * 0–100 score. A factor with a zero denominator is NULL and excluded from the mean (a new
 * joiner with no closed campaigns isn't punished). Monthly reset; movement vs prior month.
 */

/** numerator ÷ denominator, or null when the denominator is 0 (excluded from the mean). */
export function computeFactor(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/**
 * Attendance factor: on-time days ÷ eligible days. Eligible = the member's scheduled working
 * days present/late/half_day/absent (i.e. EXCLUDING approved leave/holiday/weekend, but
 * INCLUDING absent). On-time numerator = present/wfh with isLate=false (domain-rules §13.1).
 */
export const computeFactorAttendance = (onTimeDays: number, eligibleDays: number): number | null =>
  computeFactor(onTimeDays, eligibleDays);

/** Task accuracy: tasks done within estimate ÷ tasks done this month. */
export const computeFactorTask = (withinEstimate: number, completed: number): number | null =>
  computeFactor(withinEstimate, completed);

/** Campaign delivery: campaigns closed on-time this month ÷ campaigns closed this month. */
export const computeFactorCampaign = (deliveredOnTime: number, closed: number): number | null =>
  computeFactor(deliveredOnTime, closed);

export interface LeaderboardFactors {
  attendance: number | null;
  task: number | null;
  campaign: number | null;
}

export interface ScoreResult {
  score: number;
  hasData: boolean;
}

export function computeLeaderboardScore(f: LeaderboardFactors): ScoreResult {
  const present = [f.attendance, f.task, f.campaign].filter((x): x is number => x !== null);
  if (present.length === 0) return { score: 0, hasData: false };
  const mean = present.reduce((s, x) => s + x, 0) / present.length;
  // round-half-up, clamp [0,100]
  const score = Math.min(100, Math.max(0, Math.round(mean * 100)));
  return { score, hasData: true };
}

export type Movement = 'up' | 'down' | 'same' | 'new';

export interface RankInput {
  userId: string;
  score: number;
}
export interface PriorSnapshot {
  userId: string;
  rank: number;
}
export interface Ranked extends RankInput {
  rank: number;
  movement: Movement;
}

/** Sort by score desc, assign standard competition ranks (ties share a rank), compute movement. */
export function rankAndMovement(current: RankInput[], prior: PriorSnapshot[]): Ranked[] {
  const sorted = [...current].sort((a, b) => b.score - a.score);
  const priorRank = new Map(prior.map((p) => [p.userId, p.rank]));

  let rank = 0;
  let lastScore = Number.NaN;
  return sorted.map((c, i) => {
    if (c.score !== lastScore) {
      rank = i + 1;
      lastScore = c.score;
    }
    const pr = priorRank.get(c.userId);
    let movement: Movement;
    if (pr === undefined) movement = 'new';
    else if (rank < pr) movement = 'up';
    else if (rank > pr) movement = 'down';
    else movement = 'same';
    return { userId: c.userId, score: c.score, rank, movement };
  });
}

/** On-time streak = trailing run of perfect (zero-late) months, most recent last (domain-rules §13.3). */
export function onTimeStreak(perfectMonthsChronological: boolean[]): number {
  let streak = 0;
  for (let i = perfectMonthsChronological.length - 1; i >= 0; i--) {
    if (perfectMonthsChronological[i]) streak++;
    else break;
  }
  return streak;
}
