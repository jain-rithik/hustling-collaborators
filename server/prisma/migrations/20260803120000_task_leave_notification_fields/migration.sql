-- AlterEnum
-- Founder/admin notification fired when a member finishes every task for the day.
ALTER TYPE "NotificationType" ADD VALUE 'all_tasks_done' BEFORE 'admin_note';

-- AlterTable
-- Task: optional planned window (HH:mm) + captured reason when a task runs past its estimate.
ALTER TABLE "tasks"
  ADD COLUMN "planned_start_time" TEXT,
  ADD COLUMN "planned_end_time" TEXT,
  ADD COLUMN "delay_reason" TEXT;

-- AlterTable
-- Leave: hours actually worked around a half-day (HH:mm).
ALTER TABLE "leave_requests"
  ADD COLUMN "half_day_arrival" TEXT,
  ADD COLUMN "half_day_leave" TEXT;
