-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('intern', 'full_time');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'reporting_manager', 'team_member');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('office', 'wfh', 'sunday', 'fourth_saturday', 'second_saturday', 'mandatory_holiday', 'optional_holiday', 'birthday');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'late', 'wfh', 'half_day', 'absent', 'on_leave', 'holiday', 'weekend_off');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('pl', 'lwp', 'comp_off', 'half_day', 'bereavement', 'maternity', 'paternity', 'optional_holiday');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('new', 'in_progress', 'delivered', 'overdue');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'active', 'done');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('opening', 'accrual', 'deduction', 'adjustment', 'clawback', 'expiry');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('campaign_overdue', 'comp_off_request', 'comp_off_credited', 'leave_request', 'leave_decided', 'task_assigned', 'admin_note');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'team_member',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_founder" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "employee_code" TEXT,
    "photo_url" TEXT,
    "employment_type" "EmploymentType" NOT NULL,
    "joining_date" DATE NOT NULL,
    "date_of_birth" DATE,
    "designation" TEXT,
    "department" TEXT,
    "salary_amount" DECIMAL(12,2),
    "reporting_manager_id" UUID,
    "probation_end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_key" TEXT NOT NULL,
    "permission_key" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_key","permission_key")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "client_name" TEXT,
    "lead_id" UUID NOT NULL,
    "deadline" DATE NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'new',
    "color" TEXT,
    "delivered_at" TIMESTAMPTZ(6),
    "overdue_notified" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_members" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "campaign_id" UUID,
    "estimated_minutes" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "work_date" DATE NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "actual_minutes" INTEGER,
    "within_estimate" BOOLEAN,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_days" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "day_type" "DayType" NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "check_in_at" TIMESTAMPTZ(6),
    "check_out_at" TIMESTAMPTZ(6),
    "check_in_lat" DECIMAL(9,6),
    "check_in_lng" DECIMAL(9,6),
    "check_out_lat" DECIMAL(9,6),
    "check_out_lng" DECIMAL(9,6),
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "wfh_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "admin_override" BOOLEAN NOT NULL DEFAULT false,
    "overridden_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DayType" NOT NULL,
    "seeded" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_remarks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "requested_days" DECIMAL(5,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "approver_id" UUID,
    "decision_note" TEXT,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "effective_date" DATE NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "leave_type" "LeaveType",
    "amount" DECIMAL(5,2) NOT NULL,
    "balance_after" DECIMAL(6,2) NOT NULL,
    "source_leave_request_id" UUID,
    "source_comp_off_credit_id" UUID,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comp_off_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "off_date" DATE NOT NULL,
    "campaign_id" UUID,
    "planned_work" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "approver_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "comp_off_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comp_off_credits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credited_for_date" DATE NOT NULL,
    "comp_off_request_id" UUID,
    "expires_on" DATE NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "consumed_by_leave_request_id" UUID,
    "consumed_on" DATE,
    "credited_by" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comp_off_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meme_lines" (
    "id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meme_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "year_month" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "factor_attendance" DECIMAL(5,4),
    "factor_task" DECIMAL(5,4),
    "factor_campaign" DECIMAL(5,4),
    "on_time_streak" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_user_id_key" ON "employee_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_employee_code_key" ON "employee_profiles"("employee_code");

-- CreateIndex
CREATE INDEX "employee_profiles_reporting_manager_id_idx" ON "employee_profiles"("reporting_manager_id");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_lead_id_idx" ON "campaigns"("lead_id");

-- CreateIndex
CREATE INDEX "campaigns_deadline_idx" ON "campaigns"("deadline");

-- CreateIndex
CREATE INDEX "campaign_members_user_id_idx" ON "campaign_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_members_campaign_id_user_id_key" ON "campaign_members"("campaign_id", "user_id");

-- CreateIndex
CREATE INDEX "tasks_owner_id_work_date_idx" ON "tasks"("owner_id", "work_date");

-- CreateIndex
CREATE INDEX "tasks_campaign_id_idx" ON "tasks"("campaign_id");

-- CreateIndex
CREATE INDEX "attendance_days_day_idx" ON "attendance_days"("day");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_days_user_id_day_key" ON "attendance_days"("user_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_day_key" ON "holidays"("day");

-- CreateIndex
CREATE INDEX "calendar_remarks_user_id_day_idx" ON "calendar_remarks"("user_id", "day");

-- CreateIndex
CREATE INDEX "leave_requests_user_id_status_idx" ON "leave_requests"("user_id", "status");

-- CreateIndex
CREATE INDEX "leave_requests_approver_id_status_idx" ON "leave_requests"("approver_id", "status");

-- CreateIndex
CREATE INDEX "leave_ledger_user_id_effective_date_idx" ON "leave_ledger"("user_id", "effective_date");

-- CreateIndex
CREATE INDEX "comp_off_requests_user_id_idx" ON "comp_off_requests"("user_id");

-- CreateIndex
CREATE INDEX "comp_off_requests_status_idx" ON "comp_off_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "comp_off_credits_comp_off_request_id_key" ON "comp_off_credits"("comp_off_request_id");

-- CreateIndex
CREATE INDEX "comp_off_credits_user_id_consumed_expires_on_idx" ON "comp_off_credits"("user_id", "consumed", "expires_on");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_is_read_created_at_idx" ON "notifications"("recipient_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "meme_lines_event_key_is_active_idx" ON "meme_lines"("event_key", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "meme_lines_event_key_text_key" ON "meme_lines"("event_key", "text");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_year_month_idx" ON "leaderboard_snapshots"("year_month");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_user_id_year_month_key" ON "leaderboard_snapshots"("user_id", "year_month");

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_key_fkey" FOREIGN KEY ("role_key") REFERENCES "roles"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_remarks" ADD CONSTRAINT "calendar_remarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_source_leave_request_id_fkey" FOREIGN KEY ("source_leave_request_id") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_source_comp_off_credit_id_fkey" FOREIGN KEY ("source_comp_off_credit_id") REFERENCES "comp_off_credits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_requests" ADD CONSTRAINT "comp_off_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_credits" ADD CONSTRAINT "comp_off_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_off_credits" ADD CONSTRAINT "comp_off_credits_comp_off_request_id_fkey" FOREIGN KEY ("comp_off_request_id") REFERENCES "comp_off_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

