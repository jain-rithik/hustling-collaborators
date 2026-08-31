# Deployment

Target: **₹0–500/month** on free tiers — Neon (Postgres) + Render (API) + Vercel (web).
All times are IST; the servers run in UTC and convert in-app.

## 0. Prerequisites

- Node 20+, npm 10+
- A GitHub repo (this one)
- Free accounts: [Neon](https://neon.tech), [Render](https://render.com), [Vercel](https://vercel.com)

## 1. Database — Neon

1. Create a project (region **Singapore** — closest to India).
2. Copy the **pooled** connection string → `DATABASE_URL`, and the **direct** one → `DIRECT_URL`.
3. Nothing else to do here — migrations run automatically on API deploy.

## 2. API — Render

The repo ships a `render.yaml` blueprint. In Render → **New → Blueprint**, point it at this repo.

Set these env vars (the blueprint marks them `sync:false` / auto-generates the secrets):

| Var | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `CORS_ORIGIN` | your Vercel URL, e.g. `https://hustling.vercel.app` |
| `JWT_SECRET`, `REFRESH_SECRET`, `JOB_SECRET` | auto-generated (or your own) |

Build runs `prisma generate` + `tsup`; start runs `prisma migrate deploy` + `node dist`.
Health check: `GET /health`. First request after idle is slow (free tier sleeps) — the UI
shows a gentle "waking up ☕".

**Seed once** (optional, for demo data) from a Render shell or locally against the same DB:

```bash
SEED_ADMIN_EMAIL=founder@yourco.com SEED_ADMIN_PASSWORD='a-strong-password' \
  npm run db:seed --workspace @hc/server
```

## 3. Web — Vercel

The repo ships a root `vercel.json` (monorepo build + SPA rewrites). In Vercel → **New Project**,
import this repo (keep Root Directory = repo root). Add one build-time env var:

| Var | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://<your-render-app>.onrender.com/api/v1` |

Deploy. The app installs as a PWA from the browser's "Add to Home Screen".

## 4. Scheduled jobs — GitHub Actions

`.github/workflows/cron.yml` fires the nightly jobs (overdue flagging, leaderboard refresh,
leave accrual — all idempotent). Add two repo **secrets**:

| Secret | Value |
| --- | --- |
| `API_URL` | `https://<your-render-app>.onrender.com` |
| `JOB_SECRET` | same value as the API's `JOB_SECRET` |

(Alternatively use Render Cron Jobs hitting the same `/api/v1/internal/jobs/*` endpoints.)

Until these two secrets are set the workflow skips itself with a warning instead of failing —
but **no leave accrues**, because `monthly-accrual` is what posts each month's credit.

### One-time after the v4 leave change

Ledgers written before v4 hold the old 18-combined-Paid-Leave credits, so they need rebuilding
on the new model (11 Privilege + 7 Sick, earned prorata). Run once, from anywhere with the
`JOB_SECRET`:

```bash
curl -fsS -X POST "$API_URL/api/v1/internal/jobs/rebase-accrual" \
  -H "Authorization: Bearer $JOB_SECRET"
```

It clears only the entries the system generates (opening / accrual / expiry / clawback) and
re-posts them from the current schedule. **Leave people have actually taken, and any manual
Admin adjustment, are left untouched.** Running it twice is harmless. It is deliberately not
on the cron — an Admin runs it on purpose.

## 5. Custom domain (optional)

Point a domain at Vercel (web) and, if desired, a subdomain at Render (API). Update
`CORS_ORIGIN` and `VITE_API_BASE_URL` accordingly. Cost: ~₹800–1,500/year for the domain.

---

## Local development

```bash
npm ci
docker compose up -d                     # local Postgres on :5432
cp .env.example server/.env              # fill DATABASE_URL/DIRECT_URL + secrets
npm run db:migrate --workspace @hc/server
npm run db:seed --workspace @hc/server   # founder + Anshuman + sample team
npm run dev                              # server :4000 + web :5173 together
```

Log in with the founder credentials you seeded, or any sample user (`<name>@hustlingcollaborators.com` / `Hustle@123`).

## Testing

```bash
npm run test:domain --workspace @hc/server   # 113 pure-logic tests, 100% line coverage
npm run test --workspace @hc/web             # component tests (jsdom)
RUN_API_TESTS=1 npm run test --workspace @hc/server   # + API integration (needs Postgres)
```
