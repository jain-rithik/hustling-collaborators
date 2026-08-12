-- CreateEnum
CREATE TYPE "BreakType" AS ENUM ('lunch', 'tea');

-- AlterEnum: a Work-From-Home request is modelled as a (non-balance-affecting) leave type.
ALTER TYPE "LeaveType" ADD VALUE 'wfh';

-- AlterEnum: break threshold alerts + the 5th-late-arrival warning.
ALTER TYPE "NotificationType" ADD VALUE 'break_alert' BEFORE 'admin_note';
ALTER TYPE "NotificationType" ADD VALUE 'break_reminder' BEFORE 'admin_note';
ALTER TYPE "NotificationType" ADD VALUE 'late_arrival' BEFORE 'admin_note';

-- AlterTable: sick-leave flag + bereavement relationship (RM/Admin-visible only).
ALTER TABLE "leave_requests"
  ADD COLUMN "is_sick" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bereavement_relationship" TEXT;

-- CreateTable: silent lunch/tea break tracking.
CREATE TABLE "break_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "BreakType" NOT NULL,
    "day" DATE NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "manager_alerted_at" TIMESTAMPTZ(6),
    "employee_alerted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "break_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "break_logs_user_id_day_idx" ON "break_logs"("user_id", "day");

-- CreateIndex
CREATE INDEX "break_logs_ended_at_idx" ON "break_logs"("ended_at");

-- AddForeignKey
ALTER TABLE "break_logs" ADD CONSTRAINT "break_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
