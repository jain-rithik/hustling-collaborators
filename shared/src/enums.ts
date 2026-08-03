/**
 * Central enum definitions — the single source of truth shared by the web app,
 * the server, the Prisma schema (mirrored), and every zod schema.
 *
 * Each enum is a readonly const array (runtime values, e.g. for zod `.enum()` and
 * dropdowns) plus a derived union type (compile-time). Adding a value here is a
 * compile error everywhere it is exhaustively handled.
 */

/** intern vs full-time — drives probation length, cycle length, and accrual rules (PRD §5). */
export const EMPLOYMENT_TYPES = ['intern', 'full_time'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** Standing roles (PRD §3). Campaign Lead is CONTEXTUAL (derived from campaigns.lead_id), not here. */
export const USER_ROLES = ['admin', 'reporting_manager', 'team_member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** How a calendar date is classified for a given employee (PRD §9.1 / §10). */
export const DAY_TYPES = [
  'office',
  'wfh',
  'sunday',
  'fourth_saturday',
  'second_saturday',
  'mandatory_holiday',
  'optional_holiday',
  'birthday',
] as const;
export type DayType = (typeof DAY_TYPES)[number];

/** Attendance outcome for a day (PRD §4.2 / §9). */
export const ATTENDANCE_STATUSES = [
  'present',
  'late',
  'wfh',
  'half_day',
  'absent',
  'on_leave',
  'holiday',
  'weekend_off',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Leave categories (PRD §4.3 / §9.8). `pl` = Paid Leave (casual+sick combined). */
export const LEAVE_TYPES = [
  'pl',
  'lwp',
  'comp_off',
  'half_day',
  'bereavement',
  'maternity',
  'paternity',
  'optional_holiday',
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

/**
 * The leave types a member may pick when raising their own request. Maternity/paternity are
 * recorded by an admin (not self-served), and half-days are captured via the `isHalfDay` flag
 * rather than as a leave type — so neither appears in the self-service selector.
 */
export const SELECTABLE_LEAVE_TYPES = ['pl', 'lwp', 'comp_off', 'bereavement', 'optional_holiday'] as const;
export type SelectableLeaveType = (typeof SELECTABLE_LEAVE_TYPES)[number];

/** Human-friendly display labels for each leave type (UI never shows the raw enum key). */
export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  pl: 'Paid Leave',
  lwp: 'Leave Without Pay',
  comp_off: 'Comp-off',
  half_day: 'Half Day',
  bereavement: 'Bereavement',
  maternity: 'Maternity',
  paternity: 'Paternity',
  optional_holiday: 'Optional Holiday',
};

/** Approval lifecycle for leave / comp-off requests (PRD §9.4 / §9.8). */
export const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Persisted campaign lifecycle. The colour indicator (PRD §11.2) is DERIVED, not stored. */
export const CAMPAIGN_STATUSES = ['new', 'in_progress', 'delivered', 'overdue'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Task lifecycle: todo → active (On it 🔥) → done (Nailed it ✅) (PRD §8.2). */
export const TASK_STATUSES = ['todo', 'active', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Append-only leave ledger entry kinds (derived from PRD §8 policy). */
export const LEDGER_ENTRY_TYPES = [
  'opening',
  'accrual',
  'deduction',
  'adjustment',
  'clawback',
  'expiry',
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

/** In-app notification kinds (PRD §3 / §11 — in-app only, no external channels). */
export const NOTIFICATION_TYPES = [
  'campaign_overdue',
  'comp_off_request',
  'comp_off_credited',
  'leave_request',
  'leave_decided',
  'task_assigned',
  'all_tasks_done',
  'admin_note',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Derived deadline indicator for a campaign card (PRD §11.2). NOT persisted —
 * computed at read time from deadline + IST today + status so it can never go stale.
 */
export const CAMPAIGN_DEADLINE_INDICATORS = ['on_track', 'coming_up', 'due_today', 'overdue'] as const;
export type CampaignDeadlineIndicator = (typeof CAMPAIGN_DEADLINE_INDICATORS)[number];
