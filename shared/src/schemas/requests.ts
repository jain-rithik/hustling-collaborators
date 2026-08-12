import { z } from 'zod';
import { clockTime, email, geoPoint, isoDate, uuid } from './common.js';
import {
  ATTENDANCE_STATUSES,
  BEREAVEMENT_RELATIONSHIPS,
  BREAK_TYPES,
  EMPLOYMENT_TYPES,
  LEAVE_TYPES,
  MEME_EVENT_KEYS,
  USER_ROLES,
} from '../index.js';

// ── Profiles ─────────────────────────────────────────────────────────────────
export const createProfileSchema = z.object({
  email,
  password: z.string().min(8),
  fullName: z.string().min(1),
  employeeCode: z.string().min(1).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  joiningDate: isoDate,
  dateOfBirth: isoDate.optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  salaryAmount: z.number().nonnegative().optional(),
  reportingManagerId: uuid.optional(),
  role: z.enum(USER_ROLES).default('team_member'),
});
export const updateProfileSchema = createProfileSchema.partial().omit({ password: true });
export const deleteProfileSchema = z.object({ confirmName: z.string().min(1) });

// ── Tasks ────────────────────────────────────────────────────────────────────
export const createTaskSchema = z.object({
  title: z.string().min(1),
  campaignId: uuid.nullable().optional(),
  estimatedMinutes: z.number().int().positive(),
  // Optional planned window (HH:mm) — a scheduling aid shown on the card; the estimate
  // (derived from these on the client) remains the source of truth for timing.
  plannedStartTime: clockTime.nullable().optional(),
  plannedEndTime: clockTime.nullable().optional(),
  workDate: isoDate.optional(),
  ownerId: uuid.optional(), // admin on-behalf
});
export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  campaignId: uuid.nullable().optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  plannedStartTime: clockTime.nullable().optional(),
  plannedEndTime: clockTime.nullable().optional(),
});
export const completeTaskSchema = z.object({
  // admin may supply a completion time on behalf; otherwise server uses now
  completedAt: z.string().datetime().optional(),
  // captured when a task runs past its estimate (client prompts for it)
  delayReason: z.string().min(1).max(500).optional(),
});

// ── Campaigns ────────────────────────────────────────────────────────────────
export const createCampaignSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().optional(),
  leadId: uuid,
  deadline: isoDate,
  color: z.string().optional(),
  memberIds: z.array(uuid).default([]),
});
export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  clientName: z.string().optional(),
  leadId: uuid.optional(),
  deadline: isoDate.optional(),
  color: z.string().optional(),
});
export const addMemberSchema = z.object({ userId: uuid });

// ── Attendance ───────────────────────────────────────────────────────────────
export const checkInSchema = geoPoint;
export const overrideAttendanceSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
  isLate: z.boolean().optional(),
  note: z.string().optional(),
});

// ── Breaks (lunch / tea) ─────────────────────────────────────────────────────
export const startBreakSchema = z.object({ type: z.enum(BREAK_TYPES) });

// ── Leave ────────────────────────────────────────────────────────────────────
export const createLeaveSchema = z
  .object({
    leaveType: z.enum(LEAVE_TYPES),
    startDate: isoDate,
    endDate: isoDate,
    isHalfDay: z.boolean().default(false),
    // For a half-day: the hours actually worked around it (HH:mm) — captured on the request.
    halfDayArrival: clockTime.nullable().optional(),
    halfDayLeave: clockTime.nullable().optional(),
    // A Paid-Leave request the employee flags as sick — waives the 5-day rule (server enforces the 9:30 cutoff).
    isSick: z.boolean().default(false),
    // Required when leaveType === 'bereavement'; visible only to RM + Admin.
    bereavementRelationship: z.enum(BEREAVEMENT_RELATIONSHIPS).nullable().optional(),
    reason: z.string().min(1),
    allowAdvance: z.boolean().default(false),
  })
  .refine((v) => v.endDate >= v.startDate, { message: 'endDate must be on/after startDate', path: ['endDate'] })
  .refine((v) => v.leaveType !== 'bereavement' || !!v.bereavementRelationship, {
    message: 'Please select your relationship to the deceased',
    path: ['bereavementRelationship'],
  });
export const decideRequestSchema = z.object({ note: z.string().optional() });
export const manualLeaveSchema = z.object({
  userId: uuid,
  leaveType: z.enum(LEAVE_TYPES),
  startDate: isoDate,
  endDate: isoDate,
  isHalfDay: z.boolean().default(false),
  halfDayArrival: clockTime.nullable().optional(),
  halfDayLeave: clockTime.nullable().optional(),
  reason: z.string().min(1),
});
export const adjustLeaveSchema = z.object({
  userId: uuid,
  amount: z.number(),
  note: z.string().min(1),
});

// ── Comp-off ─────────────────────────────────────────────────────────────────
export const createCompOffRequestSchema = z.object({
  offDate: isoDate,
  campaignId: uuid.nullable().optional(),
  plannedWork: z.string().min(1),
  reason: z.string().min(1),
});
export const creditCompOffSchema = z.object({
  userId: uuid,
  creditedForDate: isoDate,
  compOffRequestId: uuid.optional(),
  note: z.string().optional(),
});

// ── Holidays & remarks ───────────────────────────────────────────────────────
export const createHolidaySchema = z.object({
  day: isoDate,
  name: z.string().min(1),
  type: z.enum(['mandatory_holiday', 'optional_holiday']),
});
export const updateHolidaySchema = createHolidaySchema.partial();
export const createRemarkSchema = z.object({
  userId: uuid,
  day: isoDate,
  text: z.string().min(1),
});
export const updateRemarkSchema = z.object({ text: z.string().min(1) });

// ── Admin ────────────────────────────────────────────────────────────────────
export const adminToggleSchema = z.object({ isAdmin: z.boolean() });
export const setRoleSchema = z.object({ role: z.enum(USER_ROLES) });
export const setActiveSchema = z.object({ isActive: z.boolean() });

// ── Meme ─────────────────────────────────────────────────────────────────────
export const memeQuerySchema = z.object({ event: z.enum(MEME_EVENT_KEYS) });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
