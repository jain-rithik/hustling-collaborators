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
/** The break allowance shown to the employee when they start one (v4 change log). */
export const LUNCH_ALLOWANCE_MINUTES = LUNCH_MANAGER_ALERT_MINUTES;
export const TEA_ALLOWANCE_MINUTES = TEA_MANAGER_ALERT_MINUTES;

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
/**
 * Sick leave is a same-day event: it cannot be booked for a future date, and it cannot be
 * filed more than this many hours before office start (10:30 − 5h = from 5:30 AM IST).
 */
export const SICK_LEAVE_EARLIEST_HOURS_BEFORE_OFFICE = 5;
/** An optional holiday must be claimed at least this many calendar days ahead, else LWP. */
export const OPTIONAL_HOLIDAY_ADVANCE_DAYS = 5;
/**
 * A half day must be raised at least this many hours before the member leaves. Their intended
 * leaving time is the anchor, so a half day on the 30th with a 2 PM exit must be raised by
 * 2 PM on the 29th; later than that and it is a Half day — Leave Without Pay.
 */
export const HALF_DAY_ADVANCE_HOURS = 24;
/** Assumed leaving time when a half-day request does not name one. */
export const HALF_DAY_DEFAULT_LEAVE_TIME = '14:00';
/** Bereavement leave is capped at this many working days. */
export const BEREAVEMENT_MAX_DAYS = 3;

// ── Half-day (PRD §9.3) ──────────────────────────────────────────────────────
/** A day qualifies as a half-day only with ≥ 4 productive hours; below that = full-day leave. */
export const HALF_DAY_MINUTES = 240; // 4h

// ── Comp-off (PRD §9.4) ──────────────────────────────────────────────────────
/** 6-hour guideline — an ADMIN REFERENCE only; the app never auto-credits comp-off. */
export const COMP_OFF_GUIDELINE_MINUTES = 360; // 6h

// ── Leave entitlements (v4 change log) ───────────────────────────────────────
/**
 * Full-time entitlement per financial year: 11 Privilege + 7 Sick, both PAID and both earned
 * on a prorata basis (you hold 6/12 of the year's entitlement after six months, not all of it
 * on day one). Bereavement and Optional Holiday are paid too but are not accrued balances.
 */
export const FT_ANNUAL_PL = 11; // Privilege Leaves per FY
export const FT_ANNUAL_SICK = 7; // Sick Leaves per FY
/** Prorata credits are rounded DOWN to this granularity so balances stay in clean half-days. */
export const ACCRUAL_GRANULARITY = 0.5;
export const MONTHS_PER_YEAR = 12;
/** Probation: 3 months full-time, 2 months intern. Leave is still EARNED during probation… */
export const FT_PROBATION_MONTHS = 3;
export const INTERN_PROBATION_MONTHS = 2;
/** …but may not be USED — every leave taken before probation ends is Leave Without Pay. */
export const FT_ADVANCE_CAP_DAYS = 5; // full-time may use up to 5 days before they are earned

/**
 * Intern entitlement: 4 leaves in total, earned +1 at the start of every month from the month
 * they join — so 3 by the start of month 3 and the 4th at the start of month 4. Privilege and
 * Sick share this ONE pool of 4 (unlike full-time, where the two pools are separate).
 */
export const INTERN_LEAVE_CAP = 4;
export const INTERN_MONTHLY_ACCRUAL = 1;
/** Interns serve a 15-day notice period. Full-time notice length is set by Admin per person. */
export const INTERN_NOTICE_PERIOD_DAYS = 15;

// ── Optional holidays (PRD §9.1 / §10) ───────────────────────────────────────
/** Up to 2 optional holidays per FY, claimed via the leave flow. Birthday is ADDITIONAL. */
export const OPTIONAL_HOLIDAY_CAP_PER_FY = 2;

// ── Notice period & mid-month separation (PRD §9.7 / v4 change log) ──────────
/**
 * A month's leave credit presumes more than half a month in the company. Notice starting on or
 * before the 15th → that month's Privilege + Sick credit is reversed and any leave taken
 * against it is unpaid; notice starting after the 15th → the credit stands and stays paid.
 */
export const SEPARATION_CLAWBACK_DAY = 15;

// ── Salary (v4 change log) ───────────────────────────────────────────────────
/** Salary is computed on a fixed 30-day month: per-day rate = monthly salary ÷ 30. */
export const SALARY_DAYS_BASIS = 30;

// ── Task history (v4 change log) ─────────────────────────────────────────────
/** How far back a member (and Admin, on their profile) can browse their own daily task log. */
export const TASK_HISTORY_DAYS = 30;

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
