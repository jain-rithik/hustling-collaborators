<p align="center">
  <img src="assets/hc-logo.png" alt="Hustling Collaborators" width="420" />
</p>

<h1 align="center">Hustling Collaborators — HRM</h1>

<p align="center">
  <em>Internal HRM + Task + Campaign management PWA for a marketing &amp; influencer agency.</em><br/>
  Dark, gamified, meme-fuelled — a creator tool, not a corporate HR portal.
</p>

---

> **Status:** 🏗️ In active development. This repository is being built from the
> [Product Requirements Document](docs/PRD.md) (v7).

## What this is

A single internal web application — installable as a mobile **PWA** — that unifies
task management with honest time-tracking, GPS/WFH attendance, policy-accurate
leave & comp-off, campaign ownership, a personal Focus-Time metric, a gamified
monthly leaderboard, and full Admin controls. Built to run on **free-tier
infrastructure** (target ₹0–500/month).

## Core modules

| Module | What it does |
| --- | --- |
| **Tasks** | Self-estimated tasks with silent Start→Done timing ("On it 🔥" / "Nailed it ✅") — actual vs. estimate, no visible timers. |
| **Attendance** | GPS check-in/out for office days (10:30, grace to 10:45), automatic 2nd-Saturday WFH, calendar view. |
| **Leave & Comp-off** | Policy-exact accrual (full-time & intern), comp-off → PL → LWP priority, pre-approval comp-off flow, mid-month separation clawback. |
| **Campaigns** | Client-branded cards with a named Lead, deadline states, and auto-flagging when overdue. |
| **Focus Time** | Personal "X hours in the zone" daily metric — self-insight, never surveillance. |
| **Leaderboard** | Public monthly scoreboard: on-time attendance + task-estimate accuracy + campaign delivery. |
| **Salary view** | Transparency-only estimate of LWP/advance-leave deductions (not a payroll engine). |
| **Admin** | Full edit/delete across every module, holiday calendar, and role management. |
| **Meme toasts** | Rotating Hinglish meme copy per event — the app feels alive. |

## Design language

Dark base (`#0F0E17`), Electric Purple accent (`#7B61FF`), campaign colour pops,
Plus Jakarta Sans + DM Sans, minimal outline icons, one deliberate animation per
key moment. Every feature is framed as _"what does this tell **me** about **my**
day"_ — positive-first, never punitive. See [`docs/PRD.md` §6–7](docs/PRD.md).

## Tech stack

- **Frontend:** React + TypeScript + Vite, installable PWA
- **Backend:** Node.js + TypeScript (Express)
- **Database:** PostgreSQL (Neon / Supabase free tier)
- **Hosting:** Vercel (web) + Render (API), free tier
- **GPS:** browser-native Geolocation API · **Notifications:** in-app only

## Repository layout

```
docs/          PRD + engineering design docs (architecture, product, UX, test, domain rules)
assets/        Brand assets (logo)
```
_(Application packages are added as the build progresses — see `docs/design/` for the plan.)_

## Documentation

- 📄 [Product Requirements Document](docs/PRD.md)
- 🏛️ [Engineering design docs](docs/design/) — architecture, product plan, UX system, test strategy, domain rules

---

<p align="center"><sub>Built for Hustling Collaborators.</sub></p>
