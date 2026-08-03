<p align="center">
  <img src="assets/hc-logo.png" alt="Hustling Collaborators" width="420" />
</p>

<h1 align="center">Hustling Collaborators — HRM</h1>

<p align="center">
  <em>Internal HRM + Task + Campaign management PWA for a marketing &amp; influencer agency.</em><br/>
  Dark, gamified, and people-first — a modern creator tool with a clean, professional tone.
</p>

---

A single internal web app — installable as a mobile **PWA** — that unifies honest task
time-tracking (planned start/end window, estimated vs. actual, an on-time / before-time /
delayed status with a reason captured on delays), GPS/WFH attendance with check-in **and
check-out**, policy-accurate leave &amp; comp-off (half-day arrival/leave times, admin-allotted
paid leaves), campaign ownership, a personal Focus-Time metric, a monthly leaderboard with a
distinct podium, salary behind a password re-confirmation, and a full Admin console (delete
campaigns, allot paid leaves, and a daily overview of everyone's arrival time and task
progress, with a founder ping when a teammate finishes all their tasks). Built from scratch to
run on **free-tier infrastructure** (target ₹0–500/month). Every feature is framed as _"what
does this tell **me** about **my** day"_ — positive-first, never punitive.

## Modules

| Module | What it does |
| --- | --- |
| **Tasks** | Self-estimated tasks with a planned start/end window and silent Start→Done timing — estimated vs. actual, an on-time / before-time / delayed status (reason captured on delays), no visible timers. One active task at a time. |
| **Attendance** | GPS check-in **and check-out** for office days (10:30, grace to 10:45), automatic 2nd-Saturday WFH, a month calendar with navigation and marked holidays/offs, Admin override. |
| **Leave &amp; Comp-off** | Policy-exact accrual (full-time 18/yr &amp; intern 4/6mo), comp-off → PL → advance → LWP priority, pre-approval comp-off flow, mid-month separation clawback, FY-end lapse. |
| **Campaigns** | Client-branded cards, a named Lead, derived deadline states, auto-flag + notify when overdue. |
| **Focus Time** | Personal "X hours in the zone" daily metric with a 5-day trend — self-insight, never a score. |
| **Leaderboard** | Public monthly scoreboard: on-time attendance + task-estimate accuracy + campaign delivery, with rank movement &amp; streaks. |
| **Salary view** | Transparency-only estimate of LWP/advance-leave deductions (not a payroll engine). |
| **Admin** | Full edit/delete across every module (including deleting campaigns), admin toggle, allot paid leaves per person, a daily overview of everyone's arrival time and task progress, holiday calendar, late report. |
| **Motivational toasts** | Rotating professional, motivational copy per event (17 events × 10 lines) — encouraging, never punitive. |

## Tech

- **Frontend:** React 18 + TypeScript + Vite, installable PWA, Tailwind + CSS-variable design tokens
- **Backend:** Node 20 + TypeScript + Express, Zod validation, JWT + rotating refresh tokens
- **Database:** PostgreSQL + Prisma
- **Shared:** an `@hc/shared` workspace package (enums, constants, zod schemas) imported by both sides — one contract, no drift
- **Hosting:** Vercel (web) + Render (API) + Neon (DB), all free tier · GPS via the browser Geolocation API · in-app notifications only

### The domain engine

All business math — leave accrual, comp-off ordering, mid-month clawback, leaderboard scoring,
day-type resolution, salary, focus — lives in **pure, clock-injected functions** under
[`server/src/domain/`](server/src/domain), with **113 unit tests at 100% line coverage**
conforming to the normative [domain rules](docs/design/05-domain-rules.md). That's the whole
point of the app: fix the "a task quietly eats a day" blind spot with _honest, verifiable_ math.

## Repository layout

```
shared/   @hc/shared — enums, business constants, zod schemas (client+server contract)
server/   Node/Express API — routes → controllers → services → domain(pure) + prisma
web/      React/Vite PWA — design system, screens, stores, API client
docs/     PRD + engineering design docs + deployment guide
```

## Quick start

```bash
npm ci
docker compose up -d                          # local Postgres on :5432
cp .env.example server/.env                   # fill DATABASE_URL/DIRECT_URL + secrets
npm run db:migrate --workspace @hc/server
npm run db:seed   --workspace @hc/server      # founder + Anshuman + sample team + holidays + motivational copy
npm run dev                                   # API :4000 + web :5173
```

Sample logins after seeding: `rohan@hustlingcollaborators.com` … `/ Hustle@123` (founder uses the seed env vars).

## Testing

```bash
npm run test:domain --workspace @hc/server            # 113 pure-logic tests, 100% line coverage
npm run test        --workspace @hc/web               # component tests (jsdom)
RUN_API_TESTS=1 npm run test --workspace @hc/server   # + API integration (needs Postgres)
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, the domain-coverage gate, web build, and
the API integration suite against a Postgres service on every push/PR.

## Documentation

- 📄 [Product Requirements Document](docs/PRD.md)
- 🏛️ [Architecture](docs/design/01-architecture.md) · [Product plan](docs/design/02-product-plan.md) · [UX &amp; design system](docs/design/03-ux-design-system.md) · [Test strategy](docs/design/04-test-strategy.md) · [Domain rules](docs/design/05-domain-rules.md)
- 🚀 [Deployment guide](docs/DEPLOYMENT.md)

---

<p align="center"><sub>Built for Hustling Collaborators.</sub></p>
