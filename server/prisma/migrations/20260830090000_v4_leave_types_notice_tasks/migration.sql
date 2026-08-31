-- v4 change log:
--   • Sick Leave becomes its own leave type (Privilege Leave keeps the historic `pl` key).
--   • Self-declared gender on the profile; Admin-set notice period.
--   • Manual task ordering that survives starting a task.
--   • Campaign Brief & Details notes.

-- ── Enums ───────────────────────────────────────────────────────────────────
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'sick';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
    CREATE TYPE "Gender" AS ENUM ('female', 'male', 'non_binary', 'undisclosed');
  END IF;
END
$$;

-- ── Profile: gender + notice period ─────────────────────────────────────────
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "gender" "Gender";
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "notice_start_date" DATE;
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "notice_last_date" DATE;

-- ── Tasks: manual ordering ──────────────────────────────────────────────────
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Seed a stable order for existing rows: planned start time first, then creation order.
WITH ordered AS (
  SELECT id,
         (ROW_NUMBER() OVER (
            PARTITION BY owner_id, work_date
            ORDER BY planned_start_time NULLS LAST, created_at
          ))::int * 10 AS position
  FROM "tasks"
)
UPDATE "tasks" t SET "sort_order" = o.position FROM ordered o WHERE o.id = t.id;

CREATE INDEX IF NOT EXISTS "tasks_owner_id_status_idx" ON "tasks" ("owner_id", "status");

-- ── Campaign Brief & Details ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "campaign_notes" (
  "id"          UUID NOT NULL,
  "campaign_id" UUID NOT NULL,
  "author_id"   UUID,
  "text"        TEXT NOT NULL,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "campaign_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaign_notes_campaign_id_created_at_idx"
  ON "campaign_notes" ("campaign_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_notes_campaign_id_fkey') THEN
    ALTER TABLE "campaign_notes"
      ADD CONSTRAINT "campaign_notes_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_notes_author_id_fkey') THEN
    ALTER TABLE "campaign_notes"
      ADD CONSTRAINT "campaign_notes_author_id_fkey"
      FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- ── Backfill probation end dates ────────────────────────────────────────────
-- Probation now gates paid leave, so a profile without an end date would skip it
-- entirely. Derive it the same way the app does: whole months from the joining
-- month — 3 for full-time, 2 for an intern.
UPDATE "employee_profiles"
SET "probation_end_date" =
  (date_trunc('month', "joining_date")
   + (CASE WHEN "employment_type" = 'full_time' THEN INTERVAL '3 months' ELSE INTERVAL '2 months' END)
   - INTERVAL '1 day')::date
WHERE "probation_end_date" IS NULL;
