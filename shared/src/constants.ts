/**
 * Business constants — every magic number the policy engine needs, named and cited
 * to the PRD. The domain layer imports these; nothing here does I/O.
 */

// ── Timezone & financial year ────────────────────────────────────────────────
/** Everything "day / month / before 10:45 / on-or-before the 15th / FY" is IST. */
export const IST_TZ = 'Asia/Kolkata';
/** Financial year runs 1 April – 31 March (PRD §9.5). April = month 4 (1-indexed). */
export const FY_START_MONTH = 4;

// ── Attendance (PRD §9.1 / §9.2) ─────────────────────────────────────────────
/** Office start time (IST). */
export const OFFICE_START = '10:30';
/** Grace cutoff (IST). On or before 10:40:00 = on-time; 10:40:01+ = late (v2 change log §03). */
export const GRACE_CUTOFF = '10:40';
/** When an employee reaches this many late arrivals in a calendar month, they (+ RM + Admin) are notified. */
export const LATE_ARRIVAL_ALERT_COUNT = 5;

// ── Break tracking (v2 change log §02 / §07) ─────────────────────────────────
/** Manager+admin are silently notified when a lunch break exceeds this many minutes. */
export const LUNCH_MANAGER_ALERT_MINUTES = 45;
/** The employee gets a visible popup + sound when a lunch break exceeds this many minutes. */
export const LUNCH_EMPLOYEE_ALERT_MINUTES = 55;
/** Manager+admin are silently notified when a tea break exceeds this many minutes. */
export const TEA_MANAGER_ALERT_MINUTES = 15;

// ── Leave request rules (v2 change log §05) ──────────────────────────────────
/** Paid leave must be applied at least this many calendar days in advance, else it becomes LWP. */
export const PL_ADVANCE_DAYS = 5;
/** Annual leave longer than this many consecutive days needs extra advance notice + review. */
export const LONG_LEAVE_CONSECUTIVE_DAYS = 3;
/** A long (3+ day) leave requested inside this many days of the start is routed to Admin for review. */
export const LONG_LEAVE_ADVANCE_DAYS = 15;
/** A WFH request must be submitted at least this many hours before the intended day. */
export const WFH_ADVANCE_HOURS = 24;
/** A sick-leave request is only same-day-valid if submitted on or before this IST time, else LWP. */
export const SICK_LEAVE_CUTOFF = '09:30';
/** Bereavement leave is capped at this many working days. */
export const BEREAVEMENT_MAX_DAYS = 3;

// ── Half-day (PRD §9.3) ──────────────────────────────────────────────────────
/** A day qualifies as a half-day only with ≥ 4 productive hours; below that = full-day leave. */
export const HALF_DAY_MINUTES = 240; // 4h

// ── Comp-off (PRD §9.4) ──────────────────────────────────────────────────────
/** 6-hour guideline — an ADMIN REFERENCE only; the app never auto-credits comp-off. */
export const COMP_OFF_GUIDELINE_MINUTES = 360; // 6h

// ── Full-time leave accrual (PRD §9.5) ───────────────────────────────────────
export const FT_ANNUAL_PL = 18; // Paid Leaves per FY (casual + sick combined)
export const FT_MONTHLY_ACCRUAL = 1.5; // credited at the start of each calendar month
export const FT_PROBATION_MONTHS = 3; // probation; leave during probation is LWP only
export const FT_OPENING_CREDIT = 6; // credited at the start of month 4 (3 mo probation + 1 current)
export const FT_OPENING_MONTH_INDEX = 4; // 1-indexed tenure month the opening credit posts
export const FT_ADVANCE_CAP_DAYS = 5; // up to 5 days in advance of accrual; excess → F&F debt

// ── Intern leave accrual (PRD §9.6) ──────────────────────────────────────────
export const INTERN_PL_CAP = 4; // up to 4 Paid Leaves across the 6-month internship
export const INTERN_PROBATION_MONTHS = 2; // first 2 months — no leave may be used
export const INTERN_OPENING_CREDIT = 3; // credited at the start of month 3
export const INTERN_OPENING_MONTH_INDEX = 3; // 1-indexed tenure month the opening credit posts
export const INTERN_MONTHLY_ACCRUAL = 1; // +1/month after opening, capped at 4

// ── Optional holidays (PRD §9.1 / §10) ───────────────────────────────────────
/** Up to 2 optional holidays per FY, claimed via the leave flow. Birthday is ADDITIONAL. */
export const OPTIONAL_HOLIDAY_CAP_PER_FY = 2;

// ── Mid-month separation clawback (PRD §9.7) ─────────────────────────────────
/** Last working day on or before the 15th → that month's 1.5-day credit is clawed back. */
export const SEPARATION_CLAWBACK_DAY = 15;

// ── Leaderboard (PRD §14.1) ──────────────────────────────────────────────────
/** Three equal-weighted factors: on-time attendance, task-estimate accuracy, campaign delivery. */
export const LEADERBOARD_FACTOR_WEIGHT = 1 / 3;

// ── Campaign deadline indicator (PRD §11.2) ──────────────────────────────────
/** 5+ days away → on track; within 5 days → coming up; day of → due today; past → overdue. */
export const CAMPAIGN_COMING_UP_DAYS = 5;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 8;

// ── Meme event keys (PRD §6.6) — MUST match the meme-bank seed keys exactly ───
export const MEME_EVENT_KEYS = [
  'task_completed_on_time',
  'task_completed_late',
  'checkin_on_time',
  'checkin_late',
  'late_3plus_month',
  'perfect_attendance_month',
  'wfh_checkin',
  'campaign_delivered',
  'campaign_overdue',
  'leaderboard_rank_1',
  'rank_moved_up',
  'rank_moved_down',
  'leave_approved',
  'monday_first_checkin',
  'streak_milestone',
  'empty_task_list',
  'comp_off_approved',
] as const;
export type MemeEventKey = (typeof MEME_EVENT_KEYS)[number];

// ── Brand palette (PRD §6.2) — canonical hex; web mirrors these into CSS vars ─
export const BRAND_COLORS = {
  bgDeepSpace: '#0F0E17',
  surfaceDarkLifted: '#1C1A2E',
  primaryElectricPurple: '#7B61FF',
  campaignHotCoral: '#FF6B6B',
  campaignTealMint: '#00D4AA',
  campaignSunnyYellow: '#FFD60A',
  campaignSoftLavender: '#C4B5FD',
  textNearWhite: '#F0EFF8',
  textMutedLavender: '#9896A8',
} as const;

/** The four campaign-card accent colours in rotation (PRD §6.4). */
export const CAMPAIGN_COLORS = ['#FF6B6B', '#00D4AA', '#FFD60A', '#C4B5FD'] as const;
