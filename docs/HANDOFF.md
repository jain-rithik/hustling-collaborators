# Handoff — Hustling Collaborators HRM

Everything a new engineer (or a fresh Claude session) needs to pick this up cold. Written
2026-09-01, at `main` = the merge of PR #10.

---

## 1. What this is

An internal HRM + task + campaign PWA for the Hustling Collaborators team (a small Indian
influencer-marketing agency, ~8 people). It handles attendance and breaks, a daily task plan,
campaigns, the leave policy, comp-off, a salary transparency estimate, an admin console and a
light leaderboard. Everything is **IST-based** and the whole product is built and run on free
tiers for now — the client has said they will move to paid services with storage once the
build settles.

| | |
| --- | --- |
| Web | https://hustling-collaborators.vercel.app (Vercel, auto-deploys `main`) |
| API | https://hc-api-yc66.onrender.com (Render service `hc-api`, auto-deploys `main`) |
| DB | Neon Postgres (free tier) |
| Repo | https://github.com/jain-rithik/hustling-collaborators |
| Docs | `docs/PRD.md`, `docs/design/01..05`, `docs/DEPLOYMENT.md` |

**Test login** (also the founder/admin account): `admin@hustlingcollaborators.com` /
`Hustle@123`. Every seeded user shares that password.

---

## 2. Where things stand

All four rounds of client feedback are shipped and merged. `main` is deployed and live.

| Round | Content | PR |
| --- | --- | --- |
| v1 | 26-item list: professional tone, task planning + delay tracking, admin day view | #5 |
| v2 | `HRM_Version_2.pdf`: break tracking, leave rules, calendar upgrades, admin approvals | #6 |
| v3 | Bereavement/optional-holiday form behaviour, calendar order, blue/pink status colours | #7 |
| — | Fix scheduled workflows failing on unset secrets | #8 |
| v4 | Sick Leave entitlement, notice periods, task planning/ordering/history, desktop layout | #9, #10 |

**v4 is verified live**: the deployed web bundle contains the v4 UI strings, and
`GET /api/v1/leave/balances/:userId` on production returns the new shape
(`privilege {total: 11}`, `sick {total: 7}`, probation/notice fields), which also proves the
v4 migration ran on Neon.

### Open items the CLIENT must action

1. **Set the repo secrets `API_URL` and `JOB_SECRET`** (Settings → Secrets and variables →
   Actions). `API_URL` = `https://hc-api-yc66.onrender.com`; `JOB_SECRET` = the value Render
   generated for the `hc-api` service (Render dashboard → hc-api → Environment). **Until this
   is done no leave accrues in production** — `monthly-accrual` is what posts each month's
   credit, and the workflow currently skips itself with a warning. Outstanding since v2.
2. **Run the one-time ledger rebase** (see §6.4). Production currently shows Privilege 6.5/11
   and **Sick 0/7** for the founder, because the ledger still holds credits written under the
   old 18-combined-Paid-Leave model. The rebase fixes that. It has not been run — it deletes
   and re-posts ledger rows, so it needs a human's go-ahead.
3. **Rotate the Neon database password.** It was pasted into a chat transcript in an earlier
   session. Rotate in Neon, then update `DATABASE_URL` and `DIRECT_URL` on Render.

### Known cosmetic nits (not bugs)

- The production founder profile is named "Founder" because `SEED_ADMIN_NAME` was never set on
  Render. Editing the name in the app fixes it.

---

## 3. Repo layout and stack

npm workspaces monorepo, TypeScript strict throughout, Node ≥ 20 (CI uses 20).

```
shared/    @hc/shared  — enums, business constants, zod schemas. THE contract.
server/    @hc/server  — Express + Prisma + Postgres API
web/       @hc/web     — React 18 + Vite PWA
docs/                  — PRD, design docs, deployment, this file
.github/workflows/     — ci.yml, cron.yml, break-sweep.yml, seed.yml
```

- **shared** is imported by both sides. Change an enum or constant here and it is a compile
  error everywhere it matters. `shared/src/enums.ts` is mirrored by hand into
  `server/prisma/schema.prisma` — keep them in sync.
- **server**: Express, Prisma, JWT (15 min) + rotating refresh tokens in an httpOnly cookie
  (`SameSite=None` in prod), zod validation middleware, RBAC middleware, pino logging.
  - `src/domain/` is a **pure** layer: no I/O, no wall clock (callers inject `now` via
    `lib/clock.ts`). It carries a coverage gate — 100% lines/functions/statements, ≥95%
    branches. Everything policy-shaped belongs here.
  - `src/services/` does the I/O and orchestration; `src/routes/` is thin.
- **web**: React Query, Zustand (`store/auth`, `store/toast`), React Router, Tailwind with
  CSS-variable design tokens, `vite-plugin-pwa` (`registerType: 'autoUpdate'`).

### Commands

```bash
npm run typecheck          # all workspaces
npm run lint               # eslint, must be clean
npm test                   # server + web unit tests
npm run build              # shared → server → web
npx vitest run --root server            # server suite
npx vitest run --root web               # web suite
npx vitest run --root server --coverage # enforces the domain coverage gate
```

---

## 4. Conventions that are not optional

These have been applied consistently across every round. Match them.

- **Tone**: professional, warm, plain English. No Hindi, no slang, never punitive (PRD §6).
  Times are shown 12-hour (`4 pm`, `4:30 pm`) via `web/src/lib/format.ts`.
- **Comments explain WHY**, not what, and cite the rule (`v4 change log`, `PRD §9.5`,
  `domain-rules §11.2`). Match the existing density — sparse but load-bearing.
- **Never invent a magic number** in a service or component. It goes in
  `shared/src/constants.ts` with a comment citing its source.
- **IST everywhere.** The server computes every day/month/cutoff in IST. The client must too —
  use `istToday()` from `web/src/lib/format.ts`, never `new Date().toLocaleDateString('en-CA')`
  (that reads the browser's timezone and breaks either side of midnight IST).
- **Git**: develop on `claude/hrm-system-architecture-1a5yba`, PR into `main`, never push
  elsewhere without permission. If that branch's PR is already merged, restart it from the
  latest `main` rather than stacking on merged history.
- **Never put a model identifier** in a commit message, PR title/body, code comment or any
  other pushed artefact.
- **Never print live secrets** into chat (Render's generated `JOB_SECRET`, DB passwords).

---

## 5. The business rules

`docs/design/05-domain-rules.md` is the normative source. **§20 is the current leave, salary
and task-scheduling policy** and supersedes §7, §8 and §12 where they disagree. Read §20
before touching anything leave-shaped. In short:

- **Entitlements**: full-time 11 Privilege + 7 Sick per FY as two separate pools, both earned
  prorata (`floorToHalf(annual × months ÷ 12)`), both lapsing 31 March. Interns get +1/month to
  a **lifetime pool of 4 shared** by Privilege and Sick.
- **`pl` is still the stored key for Privilege Leave** — only the label changed in v4, so no
  ledger migration was needed. `sick` is a new enum value.
- **Probation** (full-time 3 months, intern 2) earns leave but cannot spend it: any paid leave
  starting on or before the probation end date is Leave Without Pay.
- **Notice period**: while serving notice every leave is LWP; notice starting on or before the
  15th reverses that month's credit.
- **Timing → LWP ladder** (first match wins): notice → probation → half day raised <24h before
  its *leaving time* → sick after 9:30 am → privilege <5 days out → optional holiday <5 days
  out. A half day is deliberately exempt from the 5-day rule.
- **Hard rejections** (400): WFH inside 24h; bereavement >3 days; sick leave for any date but
  today; sick leave before 5:30 am; an optional holiday that is not listed or is over the
  2/FY cap.
- **Salary**: fixed 30-day month, per-day = salary ÷ 30.
- **Tasks**: a day's planned windows may not overlap (half-open, so 10–11 and 11–12 are fine);
  order is manual and never changes on its own; unfinished work from earlier days carries over
  flagged until closed.

Three readings were judgement calls where the client's brief was ambiguous — they are
documented in §20 and were reported to the client: the prorata rounding shape, "sick leave 5
hours before office hours" (= same-day only, not before 5:30 am), and the half-day 24 hours
being anchored to the leaving time.

---

## 6. Environments, deploy and jobs

### 6.1 Deploy

Both sides auto-deploy from `main`. Render's start command runs
`prisma migrate deploy` before `node dist/index.js`, so **migrations apply themselves on
deploy** — you do not run them by hand against Neon.

### 6.2 Environment variables

Server (`server/src/config/env.ts` validates these at boot and fails fast):
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (≥16), `REFRESH_SECRET` (≥16), `JOB_SECRET` (≥8),
`NODE_ENV`, `PORT`, `CORS_ORIGIN`, optional `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` /
`SEED_ADMIN_NAME`.

Web: `VITE_API_BASE_URL` (defaults to `/api/v1`, which only works behind the dev proxy — the
deployed build points at the Render URL).

### 6.3 Migrations

Hand-written SQL under `server/prisma/migrations/<timestamp>_<name>/migration.sql`, because
this environment cannot reach the production DB to run `prisma migrate dev`. Write the SQL,
then verify with `prisma migrate deploy` against a local Postgres (§7). Use `IF NOT EXISTS` /
`DO $$ … $$` guards so re-application is safe.

**Prisma gotcha**: `/** … */` block comments are a P1012 schema error. Use `//` only.

### 6.4 Scheduled jobs

`.github/workflows/cron.yml` (nightly) and `break-sweep.yml` (every 15 min, Mon–Sat working
hours only, to avoid burning Render's free instance-hours) POST to
`/api/v1/internal/jobs/<job>` with `Authorization: Bearer $JOB_SECRET`. Jobs:
`flag-overdue`, `monthly-accrual`, `nightly-leaderboard`, `break-sweep`, and the manual
`rebase-accrual`. All are idempotent and self-healing.

The one-time v4 rebase, to run once after deploy:

```bash
curl -fsS -X POST "https://hc-api-yc66.onrender.com/api/v1/internal/jobs/rebase-accrual" \
  -H "Authorization: Bearer $JOB_SECRET"
```

It clears only system-generated entries (`opening`/`accrual`/`expiry`/`clawback`) and re-posts
them from the current schedule. **Deductions and manual Admin adjustments are untouched.**

---

## 7. Running and testing locally (the recipe that works here)

These sandboxes are recycled between sessions. If anything behaves strangely, check the
basics first — an empty `node_modules` makes `npx eslint` silently fetch a *different* major
version and fail with "couldn't find an eslint config", which looks like a code problem and
is not one:

```bash
ls node_modules | wc -l          # 0 means the container was rebuilt
npm ci && npx prisma generate --schema server/prisma/schema.prisma
```

There is no Docker registry access here, so Postgres is installed via apt and has to be
started again after a restart.

```bash
# Postgres 16 (already installed at /usr/lib/postgresql/16; data dir /var/lib/pgsql/data)
export PATH=/usr/lib/postgresql/16/bin:$PATH
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/pgsql/data -l /var/lib/pgsql/pg.log start"
pg_isready -h 127.0.0.1 -p 5432

# API integration tests (they are skipped unless RUN_API_TESTS is set)
export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/hc" DIRECT_URL="$DATABASE_URL"
export JWT_SECRET="test-jwt-secret-test-jwt-secret" REFRESH_SECRET="test-refresh-secret-test-refresh"
export JOB_SECRET="test-job-secret" NODE_ENV=test RUN_API_TESTS=1
npx prisma migrate deploy --schema server/prisma/schema.prisma
npx vitest run --root server
```

For a full end-to-end run against the **production bundle**:

```bash
# 1. fresh DB + seed
psql -h 127.0.0.1 -U postgres -d postgres -c "DROP DATABASE IF EXISTS hc_e2e;" -c "CREATE DATABASE hc_e2e;"
DATABASE_URL=...hc_e2e DIRECT_URL=...hc_e2e npx prisma migrate deploy --schema server/prisma/schema.prisma
SEED_ADMIN_EMAIL=admin@hustlingcollaborators.com SEED_ADMIN_PASSWORD='Hustle@123' npx tsx server/prisma/seed.ts

# 2. API on :4000 with CORS_ORIGIN=http://localhost:4173
(setsid node server/dist/index.js > api.log 2>&1 &)      # after: npm run build --workspace @hc/server

# 3. web built against that API, served as a real production build
VITE_API_BASE_URL="http://localhost:4000/api/v1" npm run build --workspace @hc/web
npx vite preview web --port 4173 --strictPort        # NOTE: root is POSITIONAL, --root is not a flag

# 4. Playwright (pre-installed; do NOT run `playwright install`)
NODE_PATH=/opt/node22/lib/node_modules node your-e2e.cjs
#   chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
#                     args: ['--no-sandbox'] })
```

E2E traps learned the hard way:

- **Reset the DB before every run.** The task-overlap test creates a 10–11 window; a second run
  against the same data fails because it now overlaps itself.
- **Grant geolocation** on the browser context — check-in reads it, and breaks only appear once
  you are checked in.
- **The login rate limiter is in-memory**; repeated e2e runs trip a 429. Restarting the API
  process clears it.
- The login form has **no placeholders** — select `input[type="email"]` / `input[type="password"]`
  and the "Sign in" button.
- Google Fonts fail (no egress for them) — filter that out of any console-error assertion.

---

## 8. Sandbox / network reality

- Outbound HTTPS goes through an agent proxy. **curl and node fetch reach the live hosts**
  (`hustling-collaborators.vercel.app`, `hc-api-yc66.onrender.com`) — verified 2026-09-01.
- **Headless Chromium still cannot tunnel through the proxy** (`ERR_CONNECTION_RESET`, the
  relay closes the exchange mid-handshake), with or without `--proxy-server`. So: live **API**
  verification works, live **browser** click-through does not. Verify the UI by building the
  production bundle locally and driving that (§7), then confirm the deployed bundle contains
  the expected strings by fetching `/assets/index-*.js` and grepping it.
- Render and Vercel MCP connectors come and go between sessions. The Render tools need a
  `workspaceId` and will refuse to guess one — ask the user which workspace before using them.
- `gh` CLI is not available; use the GitHub MCP tools (`mcp__github__*`) via ToolSearch.

---

## 9. Traps that have already bitten this project

- **Tailwind opacity modifiers are silently dropped on `var()` colours.** `bg-mint/20` produced
  *nothing* until the palette was re-expressed as RGB channel triplets consumed as
  `rgb(var(--rgb-x) / <alpha-value>)`. If a tint looks missing, check `web/src/theme/tokens.css`
  and `tailwind.config.js` before anything else.
- **Vitest runs test files in parallel by default.** The API suites share one database and each
  truncates it, so `server/vitest.config.ts` sets `fileParallelism: false`. Keep it.
- **Time-of-day-dependent API tests must mock the clock.** `server/tests/api/v4Leave.test.ts`
  replaces `src/lib/clock.js` with a `vi.hoisted` holder so "now" is deterministic; without it
  the sick-leave and half-day tests flip depending on when CI runs.
- **Seeding**: `prisma/seed.ts` does not auto-load `.env` — export the vars inline. The meme
  bank is `deleteMany` + `createMany` (an upsert left stale copy behind). Passwords are never
  overwritten on re-seed.
- **`probationEndDate` must never be null** now that probation gates paid leave. The v4
  migration backfills it and the seed sets it; `profileService` derives it on create/update.
- The domain coverage gate will fail the build if you add an uncovered branch to
  `server/src/domain/`. Add the test in the same change.

---

## 10. If you are a fresh Claude session

Start here:

1. Read this file, then `docs/design/05-domain-rules.md §20`, then the file you are about to
   change.
2. `git checkout -B claude/hrm-system-architecture-1a5yba origin/main`.
3. Make the change; keep `npm run typecheck`, `npm run lint` and both test suites green.
4. Bring up the local stack (§7) and prove the change in a browser against the production
   bundle — this project's bugs have consistently been the kind only a real render catches
   (the missing Tailwind tints, the timezone date, the empty task list).
5. Commit with a message that explains the *why*, push, open a PR, wait for CI, merge.
6. Verify the live API afterwards with curl (§8), and tell the client plainly what you could
   and could not verify.
