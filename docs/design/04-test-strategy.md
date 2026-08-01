# 04 — Test Strategy & Detailed Test Plan

**Product:** Hustling Collaborators — Internal HRM + Task + Campaign Management PWA
**Document:** `docs/design/04-test-strategy.md`
**Owner of this doc:** SDET / QA Lead
**Status:** Authoritative test design (v1). Hand this directly to test authors.
**Source of truth:** `docs/PRD.md` (v6.0) → business rules; `docs/design/01-architecture.md` → how they are built (domain function signatures in §6.3, worked fixtures in §11); `docs/design/02-product-plan.md` → user stories (Given/When/Then) + Appendix A fixtures + open questions (OQ-#).
**Context:** ~6-person Indian marketing/influencer agency. **₹ INR**, **Asia/Kolkata (IST, UTC+05:30, no DST)**, financial year **1 Apr – 31 Mar**, Hinglish meme copy. Free-tier infra (React/TS PWA, Node/TS/Express, Postgres/Prisma).

> **The #1 quality risk is the correctness of the leave / comp-off / leaderboard / separation-clawback math.** That is the entire reason this app exists (fix the "a 4-hour task quietly eats a day" blind spot with *honest* numbers). This document therefore treats the pure domain layer (`server/src/domain/`) as the highest-priority test target and makes its test matrix exhaustive (§2). Everything else (API, component, E2E) is scoped to protect that core and the RBAC/privacy boundaries around it.

> **How this document maps to the code.** Every domain test cites the architecture §6.3 function it exercises and the §11 / Appendix A fixture it encodes. Test authors should be able to write the test *from the table row alone*, without re-deriving the math.

---

## Table of contents

1. Test philosophy, pyramid, tooling, coverage targets
2. **Domain-logic test matrix (the core — exhaustive)**
   - 2.1 Conventions, fixtures, clock injection
   - 2.2 Day-type resolution
   - 2.3 On-time vs late (grace boundary)
   - 2.4 Half-day rule
   - 2.5 Focus time
   - 2.6 Full-time leave accrual (month-by-month)
   - 2.7 Intern leave accrual
   - 2.8 Leave priority ordering (comp-off → PL → LWP)
   - 2.9 Comp-off (pre-approval, credit, expiry)
   - 2.10 Mid-month separation clawback + F&F
   - 2.11 Salary / deductions
   - 2.12 Leaderboard scoring, rank movement, streak
   - 2.13 Advance-leave cap
3. API integration test scenarios (per endpoint) + RBAC negative matrix
4. Frontend component / interaction tests
5. E2E happy paths
6. Test data & fixtures, deterministic clock, CI plan
7. Coverage gates, exit criteria, traceability
8. Open questions that block or shape tests

---

## 1. Test philosophy, pyramid, tooling, coverage targets

### 1.1 Philosophy

1. **Push correctness down to pure functions.** All business arithmetic lives in `server/src/domain/` as side-effect-free functions (architecture §6.1). They are the cheapest, fastest, most exhaustive thing to test, and they are where the money/leave math lives. **We over-invest here on purpose.**
2. **Test behaviour at the boundary you trust least.** For a solo builder the two biggest risks are (a) wrong math and (b) wrong authorization/privacy. So the two most exhaustive suites are the **domain matrix (§2)** and the **RBAC negative matrix (§3.3)**.
3. **Determinism over cleverness.** No test may read the wall clock, the network, real geolocation, `Math.random()`, or the real "today". Time and randomness are **injected** (§2.1, §6.2). A test that can flake on a date boundary is a bug in the test.
4. **One rule = at least one boundary test on each side of the boundary.** Every threshold (10:45:00, 4h, the 15th, 18-day cap, FY end, 5-day advance) is tested at `boundary−ε`, `boundary`, `boundary+ε`.
5. **Fixtures are copied verbatim from the specs.** Architecture §11 and Product-Plan Appendix A are the canonical fixtures; the domain suite encodes them 1:1 so a spec change forces a visible test diff.
6. **Tone is a testable requirement.** "No ticking clock", "no repeat meme twice in a row", "gentle errors", "≤5 bottom-nav tabs" are PRD §6.7/§7.3 hard rules → they get component tests (§4), not just eyeballing.

### 1.2 The pyramid (with target counts for v1)

```
        ▲  E2E (Playwright)            ~8–12 specs   — happy paths only, §5
       ╱ ╲  Component/interaction (RTL) ~40–60 tests — §4
      ╱   ╲ API integration (Supertest) ~90–120 tests — §3 (RBAC-heavy)
     ╱─────╲ Domain unit (Vitest)        ~250–350 tests — §2 (THE BULK)
```

**Rationale for the shape:** the base is deliberately fat. The domain layer is table-driven, so "250–350 tests" is really ~30 functions × ~8–12 rows each — cheap to write, instant to run, and it is where a regression would silently corrupt someone's salary or leave balance. E2E stays thin (browser tests are slow/flaky and the app is tiny) and covers only the flows a human would demo.

### 1.3 Tooling recommendation

| Layer | Tool | Why (free-tier, solo-builder, TS-everywhere) |
|-------|------|----------------------------------------------|
| **Domain unit** | **Vitest** | Same Vite toolchain as the web app; native ESM + TS, `test.each` for table-driven rows, `vi.useFakeTimers` / injected clock, fast watch mode. This is the priority suite. |
| **API integration** | **Vitest + Supertest** | Drives the real Express app (`app.ts` factory, no `listen`) route→controller→service→repo against a **throwaway Postgres** (Neon branch in CI, or local Docker/`pg-mem` fallback). Exercises RBAC middleware, zod validation, transactions, ledger writes. |
| **Component / interaction** | **Vitest + React Testing Library + `@testing-library/user-event`** | Query by role/text (accessibility-first), assert on rendered output not implementation. `jsdom` environment. MSW (Mock Service Worker) to stub the typed API client. |
| **E2E** | **Playwright** | Cross-browser, auto-wait (less flake than Cypress here), trace viewer, runs headless in GitHub Actions free minutes. Phase-7 / M6 only. |
| **Coverage** | **Vitest coverage via `v8`** (`@vitest/coverage-v8`) | Zero-config, per-package thresholds enforced in CI. Report lines+branches+functions. |
| **Mutation (domain only)** | **Stryker Mutator** (recommended, gated) | For the leave/comp-off/leaderboard/separation/salary files only. 100% line coverage on money-math is not enough — mutation testing proves the assertions actually pin the values (catches `>=` vs `>`, `+` vs `-`). Run nightly, not on every PR (slow). Target mutation score ≥ 85% on the money-math files. |
| **Contract** | **shared `zod` schemas** (`@hc/shared`) | The same schema validates the request on the server and infers the TS type on the client → no drift, no separate contract tool. Tested by validating each Appendix-A request payload against its schema. |
| **Static** | `tsc --noEmit` (strict) + ESLint | Compile-time contract enforcement across all 3 workspaces is itself a test gate in CI. |

**Explicitly not used in v1:** Jest (Vitest is the Vite-native choice), Cypress (Playwright chosen), a heavyweight BDD runner (Given/When/Then lives in test *names*, not Gherkin tooling), any paid test cloud.

### 1.4 Coverage targets (enforced in CI as hard gates)

| Package / layer | Statements | Branches | Functions | Notes |
|-----------------|-----------|----------|-----------|-------|
| `server/src/domain/**` (pure) | **100%** | **100%** | **100%** | Non-negotiable release gate. Every branch of every threshold. Uncovered branch = failing build. Add `/* c8 ignore */` only for provably-unreachable defensive throws, with a comment. |
| `server/src/services/**` | ≥ 85% | ≥ 80% | ≥ 90% | Orchestration + transactions; covered by API integration + a few service unit tests. |
| `server/src/controllers + middleware/**` | ≥ 90% | ≥ 85% | ≥ 90% | RBAC middleware near-100% (privacy risk). |
| `shared/**` (schemas/enums/constants) | ≥ 95% | ≥ 90% | ≥ 95% | Schema edge validation. |
| `web/src/**` components with logic (toast picker, day-chip, forms, arcs) | ≥ 80% | ≥ 75% | ≥ 80% | Presentational-only components exempt via config; logic components must meet target. |
| `web` overall | ≥ 65% | — | — | Whole-app floor; the interaction-heavy pieces carry it. |

> **Gate wording for `ci.yml`:** the build fails if `domain` coverage drops below 100% on any metric, or if any other package drops below its floor. The domain gate is separate from the rest so a UI coverage dip can never mask a domain regression.

---

## 2. Domain-logic test matrix (the core — exhaustive)

This is the heart of the plan. Each subsection targets one architecture §6.3 function, states its signature, then gives an input→expected table. **Test authors: encode each row as one `test.each` case; the "Test ID" is the case label.**

### 2.1 Conventions, fixtures, clock injection

- **Times** are Luxon `DateTime` in `Asia/Kolkata`. **`LocalDate`** = IST calendar date. Constants (`OFFICE_START='10:30'`, `GRACE_CUTOFF='10:45'`, `MAX_ADVANCE_FT=5`, `PL_CAP_FT=18`, `INTERN_CAP=4`, `IST_TZ='Asia/Kolkata'`) come from `@hc/shared/constants` — tests import the constant, never re-hardcode the number, so a spec change is a single-point edit.
- **Clock injection is mandatory.** No domain function calls `new Date()`; `now`/`today` is a parameter. Tests pass a frozen IST instant. This makes "before the off day", "on/before the 15th", "grace until 10:45", and FY boundaries deterministic (architecture §6.2, Risk R3).
- **RNG injection** for meme selection: `pickMeme(bank, lastLine, rng)` takes an injected RNG so no-repeat is deterministic (§4).
- **Money rounding rule (pin this):** all rupee outputs are rounded **half-up to 2 decimals** at the final step only; intermediate values stay full-precision. Leave-day amounts are `numeric(4,2)` (0.5 granularity). Leaderboard factor ratios stay full-precision; the final score rounds **half-up to nearest integer 0–100**.
- **Canonical FY under test:** **1 Apr 2026 – 31 Mar 2027** unless a row says otherwise. All dates below are **verified against a real calendar** (see the weekday column).

### 2.2 Day-type resolution — `resolveDayType(day, { holidays, dob })` → `DayType`

**Precedence (first match wins, architecture §6.3):** `mandatory_holiday` → `optional_holiday`/`birthday` → `sunday` → `fourth_saturday` → `second_saturday` → `office`.
Also tests `isWorkingDay(dayType)`: working = `office`, `second_saturday` (WFH); non-working = `sunday`, `fourth_saturday`, `mandatory_holiday`, `optional_holiday` (unclaimed).

| Test ID | Input date (IST) | Real weekday | Context | Expected `dayType` | `isWorkingDay` | Rule exercised |
|---------|------------------|--------------|---------|--------------------|----------------|----------------|
| DAYTYPE-01 | 2026-04-01 | Wed | — | `office` | true | plain office weekday (FY start) |
| DAYTYPE-02 | 2026-08-01 | Sat (1st) | — | `office` | true | 1st Saturday = office (6-day week, OQ-1) |
| DAYTYPE-03 | 2026-08-08 | Sat (2nd) | — | `second_saturday` | true | 2nd Sat = WFH, **is** a working day |
| DAYTYPE-04 | 2026-08-22 | Sat (4th) | — | `fourth_saturday` | false | 4th Sat = off |
| DAYTYPE-05 | 2026-08-29 | Sat (5th) | — | `office` | true | 5th Saturday = office |
| DAYTYPE-06 | 2026-04-11 | Sat (2nd) | — | `second_saturday` | true | 2nd-Sat in a different month |
| DAYTYPE-07 | 2026-04-25 | Sat (4th, last) | — | `fourth_saturday` | false | 4th-Sat is also last that month |
| DAYTYPE-08 | 2027-02-27 | Sat (4th, last) | — | `fourth_saturday` | false | Feb has only 4 Saturdays |
| DAYTYPE-09 | 2026-04-05 | Sun | — | `sunday` | false | Sunday = off |
| DAYTYPE-10 | 2027-03-14 | Sun | — | `sunday` | false | Sunday near FY end |
| DAYTYPE-11 | 2026-05-01 | Fri | Maharashtra Day (mand) | `mandatory_holiday` | false | mandatory holiday on a weekday |
| DAYTYPE-12 | 2026-11-09 | Mon | Diwali (mand) | `mandatory_holiday` | false | fixture from arch §11.1 |
| DAYTYPE-13 | 2026-09-14 | Mon | Ganesh Chaturthi (mand) | `mandatory_holiday` | false | mandatory |
| DAYTYPE-14 | **2026-08-15** | **Sat (3rd)** | Independence Day (mand) | `mandatory_holiday` | false | **mandatory beats Saturday-nth logic** (arch §11.1) |
| DAYTYPE-15 | 2026-04-03 | Fri | Good Friday (opt) | `optional_holiday` | false | optional holiday, off by default |
| DAYTYPE-16 | 2026-12-25 | Fri | Christmas (opt) | `optional_holiday` | false | optional |
| DAYTYPE-17 | 2027-03-26 | Fri | Good Friday 2027 (opt) | `optional_holiday` | false | last optional of the FY |
| DAYTYPE-18 | 2026-09-10 | Thu | **dob = 10-Sep** | `birthday` | false | birthday on a plain office weekday → becomes optional entitlement |
| DAYTYPE-19 | **2026-09-12** | **Sat (2nd)** | **dob = 12-Sep** | `birthday` | false | **precedence: birthday (optional) beats 2nd-Saturday** — the arch §11.1 example date is *itself* a 2nd Saturday; confirms birthday wins |
| DAYTYPE-20 | 2026-11-09 | Mon | dob = 09-Nov | `mandatory_holiday` | false | **precedence: mandatory holiday beats birthday** (Diwali on someone's birthday) |
| DAYTYPE-21 | 2026-08-15 | Sat | dob = 15-Aug | `mandatory_holiday` | false | mandatory beats birthday even on a Saturday |
| DAYTYPE-22 | 2027-02-28 | Sun | dob = 28-Feb | `sunday` OR `birthday`? | — | **OPEN (OQ-10): birthday on a Sunday** — does the entitlement have value on an already-off day? Pin expected = `sunday` (no double benefit) unless Founder says otherwise. |
| DAYTYPE-23 | leap check: dob = 29-Feb | — | non-leap FY | (no birthday in FY26-27) | — | **Edge: 29-Feb DOB in a non-leap year** — pin rule (observe 28-Feb or 1-Mar?). Flag as test-blocking mini-OQ. |

> **Coverage assertion:** every `DayType` enum value must appear at least once in the expected column, and both precedence orderings (mandatory>birthday, birthday>2nd-Sat) must be present.

### 2.3 On-time vs late — `classifyCheckIn(checkInAt)` → `{ isLate }`

Rule (architecture §6.3 / §11.1, OQ-17): office start **10:30**, grace **until 10:45** inclusive. `isLate = checkInAt(IST) > 10:45:00.000`. We treat **≤ 10:45:00.000 = on-time**, strictly after = late.

| Test ID | Check-in (IST, same day) | Expected `isLate` | Boundary exercised |
|---------|--------------------------|-------------------|--------------------|
| LATE-01 | 10:30:00.000 | false | exactly on office start |
| LATE-02 | 09:15:00 | false | early bird |
| LATE-03 | 10:44:59.999 | false | just inside grace |
| LATE-04 | **10:45:00.000** | **false** | **grace boundary, inclusive** (OQ-17 assumption) |
| LATE-05 | **10:45:00.001** | **true** | **strictly after boundary → late** |
| LATE-06 | 10:45:01 | true | 1 second late |
| LATE-07 | 10:46:00 | true | fixture: "10:46 = late" (arch §11.1) |
| LATE-08 | 13:00:00 | true | very late |
| LATE-09 | UTC instant `2026-06-01T05:15:00Z` = **10:45:00 IST** | false | **IST conversion boundary** — the same instant expressed in UTC must classify identically (Risk R3) |
| LATE-10 | UTC `2026-06-01T05:15:00.001Z` = 10:45:00.001 IST | true | UTC→IST off-by-a-millisecond |
| LATE-11 | UTC `2026-06-01T05:16:00Z` = 10:46 IST | true | server runs in UTC (Render) → must still compute IST lateness |

> **OQ flag for the Founder (blocks final assertion of LATE-05/06):** is the sub-minute window **10:45:01–10:45:59** on-time or late? PRD says "after 10:45 = late". Tested default (per arch): **anything after 10:45:00.000 is late.** If the Founder means "after 10:45:59" (i.e. the whole 10:45 minute is grace), flip LATE-05/06 to `false` and re-pin. **This single decision changes real people's late-counts and their leaderboard factor — do not ship it unconfirmed.**

### 2.4 Half-day rule — `qualifiesAsHalfDay(productiveMinutes)` → `boolean`

Rule (PRD §9.3, arch §6.3): `>= 240` (4h) → half-day (consumes 0.5 leave); `< 240` → treated as a **full day's leave**. "Productive minutes" = task Start→Done total (OQ-6 assumption, aligned with Focus Time).

| Test ID | `productiveMinutes` | Expected `qualifiesAsHalfDay` | Leave consumed (per OQ-22) | Boundary |
|---------|---------------------|-------------------------------|----------------------------|----------|
| HALFDAY-01 | 0 | false | full-day leave (1.0) | zero work |
| HALFDAY-02 | 239 (3h59m) | **false** | **full-day leave (1.0)** | just below 4h (fixture) |
| HALFDAY-03 | **240 (4h00m)** | **true** | **half-day (0.5)** | exactly 4h boundary (fixture) |
| HALFDAY-04 | 241 (4h01m) | true | half-day (0.5) | just above |
| HALFDAY-05 | 300 (5h) | true | half-day (0.5) | mid-range |
| HALFDAY-06 | 480 (8h) | true | half-day? | **OPEN (OQ-22): upper bound.** Is a day with ≥ (say) a full-day threshold a *present* day consuming 0 leave, not a half-day? PRD only defines the 4h floor. Pin: ≥4h on a **leave-tagged** day = half-day (0.5); the "full present day" path is a separate attendance status, not this function's job. |

> **Reconciliation note (OQ-22):** `qualifiesAsHalfDay` decides *leave consumed on a day the member was otherwise on leave/absent*. The attendance-status `half_day` and the leave-ledger 0.5 deduction must be **one source of truth** — assert in an integration test (§3) that marking a day half-day posts exactly `-0.5` in priority order, never both a `half_day` status **and** a separate full-day deduction.

### 2.5 Focus time — `computeFocusMinutes(tasksDoneToday[])` → `number`

Rule (PRD §12.1, arch §6.3 / §11.6): sum of `actualMinutes` across **done** tasks. `actualMinutes = completed_at − started_at` — the creation→start gap is **excluded by construction**.

| Test ID | Done-task `actualMinutes[]` | Expected sum | Rendered label | Notes |
|---------|------------------------------|--------------|----------------|-------|
| FOCUS-01 | [45, 120, 95, 30] | **290** | "4h 50m in the zone 🎯" | canonical fixture (arch §11.6) |
| FOCUS-02 | [] | 0 | "0m in the zone" (empty-state copy) | no done tasks |
| FOCUS-03 | [60] | 60 | "1h 0m in the zone" | single task |
| FOCUS-04 | [59] | 59 | "59m in the zone" | sub-hour formatting |
| FOCUS-05 | [600, 600] | 1200 | "20h 0m in the zone" | large sum |
| FOCUS-06 | includes 1 `active` (not done) task of 500 | sum of **done only** | — | active tasks excluded (only Start→Done counted) |
| FOCUS-07 | task with `started_at`=10:00, `completed_at`=10:00 (0 min) | 0 for that task | — | zero-duration task |
| FOCUS-08 | two tasks whose Start→Done windows **overlap** in wall-clock (e.g. 10:00–11:00 and 10:30–11:30) → naive sum = 120 | **120** (naive sum) | — | **KNOWN LIMITATION / OQ:** focus can exceed clocked hours if a member runs two tasks "On it" at once. Tested behaviour = simple sum (per spec). Flag to Founder: do we forbid two active tasks, or de-dup overlap? Pin current = allow, sum. |

### 2.6 Full-time leave accrual — month-by-month (`monthlyAccrualSchedule` + `computeBalance`)

Rules (PRD §9.5, arch §6.3 / §11.2, Product-Plan A.1):
- Probation = 3 months → **LWP only**, PL balance 0.
- Start of **month 4**: `opening +6.0` (3 probation months × 1.5 + current month 1.5).
- Months ≥ 5: `accrual +1.5` each, **capped at 18/FY**.
- **No carry-forward** — unused PL lapses at 31-Mar; new FY starts fresh.

**FT-ACCRUAL table A — joiner 1-Apr-2026 (hits the cap exactly, then lapses):**

| Test ID | Month start (IST) | Month # | Event | Δ | Expected balance | Assertion |
|---------|-------------------|---------|-------|-----|------------------|-----------|
| FTACC-A01 | 2026-04-01 | M1 | probation | 0 | 0.0 | leave used here = LWP only |
| FTACC-A02 | 2026-05-01 | M2 | probation | 0 | 0.0 | |
| FTACC-A03 | 2026-06-01 | M3 | probation | 0 | 0.0 | |
| FTACC-A04 | 2026-07-01 | M4 | **opening** | +6.0 | **6.0** | probation ends 30-Jun; 6 = 3×1.5 + 1.5 |
| FTACC-A05 | 2026-08-01 | M5 | accrual | +1.5 | 7.5 | |
| FTACC-A06 | 2026-09-01 | M6 | accrual | +1.5 | 9.0 | |
| FTACC-A07 | 2026-10-01 | M7 | accrual | +1.5 | 10.5 | |
| FTACC-A08 | 2026-11-01 | M8 | accrual | +1.5 | 12.0 | |
| FTACC-A09 | 2026-12-01 | M9 | accrual | +1.5 | 13.5 | |
| FTACC-A10 | 2027-01-01 | M10 | accrual | +1.5 | 15.0 | |
| FTACC-A11 | 2027-02-01 | M11 | accrual | +1.5 | 16.5 | |
| FTACC-A12 | 2027-03-01 | M12 | accrual | +1.5 | **18.0** | **CAP reached exactly** — assert balance == PL_CAP_FT |
| FTACC-A13 | 2027-03-31 end-of-day | — | **lapse** | −(unused) | **0.0** | **LAPSE** — assert no carry-forward into new FY |
| FTACC-A14 | 2027-04-01 | new FY M1 | accrual (past probation) | +1.5 | 1.5 | new-FY accrual resumes at 1.5/mo (no new probation) |

**FT-ACCRUAL table B — joiner 1-May-2026 (mid-year; opening lands in Aug):**

| Test ID | Month start | Month # | Event | Δ | Expected balance |
|---------|-------------|---------|-------|-----|------------------|
| FTACC-B01 | 2026-05 / 06 / 07 | M1–M3 | probation | 0 | 0.0 (each) |
| FTACC-B02 | 2026-08-01 | M4 | **opening** | +6.0 | 6.0 |
| FTACC-B03 | 2026-09 … 2027-03 | M5–M11 | accrual ×7 | +1.5 ea | 7.5 → 9.0 → 10.5 → 12.0 → 13.5 → 15.0 → **16.5** |
| FTACC-B04 | 2027-03-31 EOD | — | lapse | — | 0.0 |

> Full-year run-rate check (arch §11.2): 6.0 + 1.5×7 = **16.5** for a 1-May joiner — under the 18 cap, so cap does **not** bind here; only balance & lapse assertions apply.

**FT-ACCRUAL cap-binding guard (defensive):**

| Test ID | Scenario | Expected | Assertion |
|---------|----------|----------|-----------|
| FTACC-C01 | Continuing employee (joined a prior FY, past probation) accrues +1.5 every month Apr..Mar | final accrued = 12 × 1.5 = **18.0** | natural full-year rate == cap, never exceeds |
| FTACC-C02 | Injected 13th `+1.5` accrual entry in one FY (simulated bug/duplicate cron) | balance **clamped to 18.0** | **cap must clamp**, not 19.5 — this is the regression the cap exists to stop; self-healing idempotent accrual (arch §9.1) must not double-credit |
| FTACC-C03 | Admin manual `adjustment +5` on top of 18.0 | balance = 23.0 **allowed** | admin override is intentional and **bypasses** the accrual cap (PRD §4.3) — cap applies to *accrual*, not to admin adjustments |

> **Encoding note:** `computeBalance(entries)` = `sum(amount)`; the cap is enforced inside `monthlyAccrualSchedule` (it stops emitting `accrual` entries once accrued-this-FY would exceed 18), **not** by clamping the sum — so an admin `+5` still shows 23. Test both the schedule generator and the balance summer separately.

### 2.7 Intern leave accrual — `monthlyAccrualSchedule(intern)`

Rules (PRD §9.6, Product-Plan A.2): 6-month internship; months 1–2 probation (no leave usable); **start of month 3: opening +3**; month 4: +1 (reaches 4 cap); months 5–6: none; no carry-forward.

**INTERN table — 6-month intern joining 1-Apr-2026:**

| Test ID | Month start | Month # | Event | Δ | Expected balance | Assertion |
|---------|-------------|---------|-------|-----|------------------|-----------|
| INTACC-01 | 2026-04-01 | M1 | probation | 0 | 0.0 | no leave usable |
| INTACC-02 | 2026-05-01 | M2 | probation | 0 | 0.0 | no leave usable |
| INTACC-03 | 2026-06-01 | M3 | **opening** | +3.0 | **3.0** | credited at start of month 3 |
| INTACC-04 | 2026-07-01 | M4 | accrual | +1.0 | **4.0** | **CAP reached** — assert == INTERN_CAP |
| INTACC-05 | 2026-08-01 | M5 | none (cap) | 0 | 4.0 | no further accrual past 4 |
| INTACC-06 | 2026-09-01 | M6 | none (cap) | 0 | 4.0 | last month |
| INTACC-07 | internship end / termination | — | **lapse** | −(unused) | 0.0 | **LAPSE** — no carry-forward at completion |
| INTACC-08 | intern requests PL in M1 or M2 | — | rejected/flagged **LWP** | — | probation-leave-is-LWP rule for interns |
| INTACC-09 | Admin switches intern→full_time mid-tenure (OQ-11) | forward-only recompute | — | past accrual untouched; FT rules apply from change date. **Assert forward-only** per OQ-11 assumption. |

### 2.8 Leave priority ordering — `applyLeaveDeduction(days, { compOff, pl })` → `{ fromCompOff, fromPl, fromLwp }`

Rule (PRD §9.4 step 5 / §9.5 / §9.6): **comp-off first → then PL → then LWP.**

| Test ID | `days` | `compOff` | `pl` | Expected split `{compOff, pl, lwp}` | Scenario |
|---------|--------|-----------|------|--------------------------------------|----------|
| PRIO-01 | 3 | **2** | 9 | **{2, 1, 0}** | **task's headline case: 2 comp-off + apply 3 → 2 comp-off + 1 PL** |
| PRIO-02 | 4 | 2 | 1 | {2, 1, 1} | fixture A.3: comp-off 2 → PL 1 → **1 LWP** |
| PRIO-03 | 2 | 5 | 10 | {2, 0, 0} | fully covered by comp-off, PL untouched |
| PRIO-04 | 3 | 0 | 9 | {0, 3, 0} | no comp-off → all PL |
| PRIO-05 | 3 | 0 | 2 | {0, 2, 1} | PL runs out → 1 LWP |
| PRIO-06 | 5 | 0 | 0 | {0, 0, 5} | no balance → all LWP (probation-style) |
| PRIO-07 | 0.5 | 1 | 5 | {0.5, 0, 0} | **half-day** consumes 0.5 comp-off first |
| PRIO-08 | 0.5 | 0 | 0.5 | {0, 0.5, 0} | half-day from PL |
| PRIO-09 | 2.5 | 1 | 1 | {1, 1, 0.5} | fractional across all three buckets |
| PRIO-10 | 3 | 2.0 | 9.0 (but 2 comp-off credits expire before leave start) | {0, 3, 0} | **expired comp-off must not be consumed** — availableCompOff filters expiry before this fn is called; assert integration in §3 (COMPOFF path) |

> **Ordering invariant test:** for any random `(days, compOff, pl)`, assert `fromCompOff + fromPl + fromLwp === days`, `fromCompOff ≤ compOff`, `fromPl ≤ pl`, and comp-off is exhausted before any PL is used, PL before any LWP. A **property-based test** (fast-check, optional) is ideal here.

### 2.9 Comp-off — pre-approval, credit guideline, expiry, availability

**2.9.1 Pre-approval time-gate — `isPreApprovalValid(now, offDate)` → `boolean`**
Rule (PRD §9.4 step 1, arch §6.3): `now < istStartOfDay(offDate)`. Must be **before** the off day begins in IST; **no retrospective**.

| Test ID | `now` (IST) | `offDate` | Expected valid | Boundary / rule |
|---------|-------------|-----------|----------------|-----------------|
| CMPRE-01 | 2026-08-21 14:00 | 2026-08-23 (Sun) | **true** | request 2 days before off day |
| CMPRE-02 | 2026-08-22 23:59:59 | 2026-08-23 | true | night before, still valid |
| CMPRE-03 | **2026-08-23 00:00:00** | 2026-08-23 | **false** | **exactly at start of off day → invalid** (not strictly before) |
| CMPRE-04 | 2026-08-23 00:00:01 | 2026-08-23 | false | one second into off day |
| CMPRE-05 | 2026-08-23 11:00 | 2026-08-23 | false | mid off-day retro attempt |
| CMPRE-06 | 2026-08-24 09:00 | 2026-08-23 | false | **retro next-day → rejected** (Risk R6) |
| CMPRE-07 | UTC `2026-08-22T18:30:00Z` (= 2026-08-23 00:00:00 IST) | 2026-08-23 | **false** | **IST boundary**: an instant that is "still 22nd" in UTC is already "the 23rd" in IST → invalid. Guards against server-TZ bug. |
| CMPRE-08 | UTC `2026-08-22T18:29:59Z` (= 2026-08-22 23:59:59 IST) | 2026-08-23 | true | one second earlier in IST → valid |

**2.9.2 Credit guideline (advisory only) — `isCompOffEligibleGuideline(loggedMinutes)` → `boolean`**
Rule (PRD §9.4 step 4, arch §6.3): `>= 360` (6h) is a **guideline surfaced to Admin only**; it **never auto-credits**.

| Test ID | `loggedMinutes` | Expected | Note |
|---------|-----------------|----------|------|
| CMPEL-01 | 359 | false (guideline not met) | just under 6h |
| CMPEL-02 | 360 | true | exactly 6h |
| CMPEL-03 | 420 | true | over 6h |
| CMPEL-04 | 300 | false | **but Admin may still credit** (judgment) — assert this fn is advisory: crediting is a separate Admin action, tested in §3; there is **no** code path where this boolean gates a credit |

**2.9.3 Expiry — `creditExpiry(creditedForDate)` → `LocalDate`** and **`availableCompOff(credits, asOf)`**
Rule (PRD §9.4 step 6): valid until **31 Mar** of that FY; unused lapses.

| Test ID | Function | Input | Expected | Rule |
|---------|----------|-------|----------|------|
| CMPEXP-01 | creditExpiry | 2026-08-23 | **2027-03-31** | credited in FY26-27 |
| CMPEXP-02 | creditExpiry | 2027-02-10 | 2027-03-31 | still same FY |
| CMPEXP-03 | creditExpiry | 2027-04-05 | 2028-03-31 | next FY |
| CMPEXP-04 | availableCompOff | 2 unconsumed, expire 2027-03-31; asOf 2027-03-31 | 2 | on expiry day still valid (inclusive) |
| CMPEXP-05 | availableCompOff | same; asOf 2027-04-01 | **0** | **lapsed at FY roll-over** |
| CMPEXP-06 | availableCompOff | 1 unconsumed + 1 consumed; asOf 2026-12-01 | 1 | consumed excluded |
| CMPEXP-07 | availableCompOff | 1 expiring 2027-03-31, 1 expiring 2028-03-31; asOf 2027-06-01 | 1 | only the future-FY credit survives |

### 2.10 Mid-month separation clawback — `midMonthClawback({ lastWorkingDay, monthCreditDate, usedFromThatCredit })`

Rule (PRD §9.7, arch §6.3 / §11.3, Product-Plan A.5): if `lastWorkingDay.day <= 15` → month's +1.5 **not earned** → `clawback=true`; any used portion → **LWP** (deducted in F&F). If `> 15` → credit stands. **The 15th itself is clawed back.** Same for voluntary & involuntary.

| Test ID | `lastWorkingDay` | `monthCreditDate` | `usedFromThatCredit` | Expected `{clawback, lwpConverted}` | Rule |
|---------|------------------|-------------------|----------------------|--------------------------------------|------|
| SEP-01 | 2027-03-12 | 2027-03-01 | 1 | **{true, 1}** | canonical fixture — 1 used day → LWP in F&F |
| SEP-02 | 2027-03-01 | 2027-03-01 | 0 | {true, 0} | LWD on the 1st → clawed back; nothing used to convert |
| SEP-03 | 2027-03-14 | 2027-03-01 | 1.5 | {true, 1.5} | full credit used, all → LWP |
| SEP-04 | **2027-03-15** | 2027-03-01 | 1 | **{true, 1}** | **the 15th = "on or before" → clawed back** |
| SEP-05 | **2027-03-16** | 2027-03-01 | 1 | **{false, 0}** | **16th → credit stands, no clawback regardless of usage** |
| SEP-06 | 2027-03-31 | 2027-03-01 | 0 | {false, 0} | end of month, after 15th → stands |
| SEP-07 | 2027-03-12, `voluntary=true` | 2027-03-01 | 1 | {true, 1} | **voluntary resignation** → same result |
| SEP-08 | 2027-03-12, `voluntary=false` | 2027-03-01 | 1 | {true, 1} | **involuntary termination** → identical (flag must not change output) |
| SEP-09 | 2026-02-15 (non-Mar month) | 2026-02-01 | 0.5 | {true, 0.5} | clause is per-month, not only March |
| SEP-10 | LWD after notice waived, actual LWD 2027-03-10 | 2027-03-01 | 2 (but only 1.5 came from this credit) | {true, **1.5**} | `usedFromThatCredit` is only the portion attributable to **this** month's credit — cap `lwpConverted` at 1.5 |

**F&F worked example (integration of SEP-01 into salary — assert end-to-end in §3 / §2.11):**
Base ₹30,000/month, March has **22 working days** (illustrative), LWD 12-Mar, 1 used day clawed to LWP.
- LWP deduction in F&F = (1 / 22) × 30,000 = **₹1,363.636… → ₹1,363.64**.
- PL ledger also reverses the March `+1.5` (a `clawback −1.5` entry).
- If the member also had **advance-leave debt** (§2.13), that rupee value is added to F&F recovery. Assert the salary view labels this "Full & Final estimate", never a payslip.

### 2.11 Salary / deductions — `lwpDeduction`, `netEstimate`, `workingDaysInMonth`

Rules (PRD §13, arch §6.3 / §11.5, Product-Plan A.6): `lwpDeduction = (lwpDays / workingDaysInMonth) × salary`. `netEstimate` labelled **estimate**, **no** PF/ESI/TDS.

| Test ID | Function | Inputs | Expected | Rule |
|---------|----------|--------|----------|------|
| SAL-01 | lwpDeduction | salary 30000, lwp 2, workingDays 22 | (2/22)×30000 = **₹2,727.27** | canonical fixture |
| SAL-02 | lwpDeduction | 30000, 0, 22 | ₹0.00 | no LWP → no deduction |
| SAL-03 | lwpDeduction | 30000, 22, 22 | ₹30,000.00 | full month LWP → whole salary |
| SAL-04 | lwpDeduction | 30000, 0.5, 22 | (0.5/22)×30000 = **₹681.82** | **half-day LWP** |
| SAL-05 | lwpDeduction | 45000, 3, 24 | (3/24)×45000 = **₹5,625.00** | different salary/den |
| SAL-06 | lwpDeduction | 30000, 1, **0** | **guarded error / 0** | **divide-by-zero guard** — a month with 0 working days must not `NaN`/throw silently; assert defensive behaviour |
| SAL-07 | netEstimate | gross 30000, lwpDeduction 2727.27, advanceDebtValue 0 | { gross 30000, deductions 2727.27, net **27272.73** } | fixture; net = 30000 − 2727.27 |
| SAL-08 | netEstimate | gross 30000, lwp 2727.27, **advanceDebt 1363.64** | advance debt shown **separately as outstanding**, **not netted** in monthly estimate | PRD §13: advance debt is outstanding until F&F, not a monthly deduction (OQ-13) |
| SAL-09 | netEstimate | any | response contains label "estimate — not a payslip" and **omits** `pf`, `esi`, `tds` fields entirely | PRD §13 / §2.2 non-goal — assert **absence** of statutory fields |
| SAL-10 | workingDaysInMonth | Aug 2026, seeded holidays | **23** | verified: office+2nd-Sat WFH; Independence Day (mand) + 4th-Sat + Sundays off; **optional holidays treated as off** |
| SAL-11 | workingDaysInMonth | Nov 2026 | **22** | verified (Diwali mandatory + Bhai Duj optional off) |
| SAL-12 | workingDaysInMonth | Apr 2026 | **24** | verified |
| SAL-13 | workingDaysInMonth | Feb 2027 | **21** | verified (short month, 4 Saturdays) |

> **BLOCKING OQ for SAL-10..13 (OQ-8):** these counts assume **unclaimed optional holidays are NON-working days**. That understates the denominator and inflates both the LWP per-day value and the attendance leaderboard factor. The alternative reading — "optional holidays are normal working days unless the member *claims* one" — gives higher working-day counts (e.g. Aug 2026 = 24, Nov = 23). **This choice must be confirmed before Salary (M5) and Leaderboard (M5) ship.** Whichever is chosen, `workingDaysInMonth` and the leaderboard denominator must use the **same** definition — assert that invariant with a shared-helper test.

### 2.12 Leaderboard — factors, score, rank movement, streak

Rules (PRD §14.1, arch §6.3 / §11.4, Product-Plan A.4): 3 equal-weight factors, each a ratio; **score = mean of the non-null factors × 100**, rounded half-up to 0–100. A factor with a **zero denominator → null** and is dropped (OQ-23). Monthly reset; rank movement vs prior snapshot; on-time streak from consecutive months.

**2.12.1 Individual factor functions (divide-by-zero → null):**

| Test ID | Function | Inputs (num/den) | Expected | Rule |
|---------|----------|------------------|----------|------|
| LBF-01 | computeFactorAttendance | 22 / 24 | 0.91667 | on-time ÷ working days |
| LBF-02 | computeFactorAttendance | 20 / 22 | 0.90909 | fixture A.4 |
| LBF-03 | computeFactorAttendance | 0 / **0** | **null** | zero working days → null (dropped) |
| LBF-04 | computeFactorTask | 18 / 20 | 0.90 | within-estimate ÷ completed |
| LBF-05 | computeFactorTask | 12 / 15 | 0.80 | fixture A.4 |
| LBF-06 | computeFactorTask | 0 / **0** | **null** | no tasks completed → null |
| LBF-07 | computeFactorCampaign | 2 / 3 | 0.66667 | delivered-on-time ÷ closed |
| LBF-08 | computeFactorCampaign | 0 / **0** | **null** | no campaigns closed → null |
| LBF-09 | computeFactorCampaign | 3 / 3 | 1.0 | all delivered on time |

**2.12.2 Score — `computeLeaderboardScore({attendance, task, campaign})` → `{ score, hasData }`:**

| Test ID | Factors `{att, task, camp}` | Mean of non-null | Expected score | `hasData` | Worked calc |
|---------|------------------------------|------------------|----------------|-----------|-------------|
| LBS-01 | {0.91667, 0.90, 0.66667} | 0.82778 | **83** | true | **arch §11.4**: mean×100 = 82.78 → round-half-up → 83 |
| LBS-02 | {0.90909, 0.80, 0.66667} | 0.79192 | **79** | true | **fixture A.4**: (90.9+80.0+66.7)/3 = 79.2 → 79 |
| LBS-03 | {1.0, null, null} | 1.0 | **100** | true (`hasData` w/ note "building your streak") | **new joiner** — only attendance has data (arch §11.4) |
| LBS-04 | {null, null, null} | — | **0** | **false** | no data at all → 0, UI shows encouragement not a hollow rank |
| LBS-05 | {0.5, 0.5, null} | 0.5 | 50 | true | one factor dropped, remaining two averaged (re-weight, OQ-23) |
| LBS-06 | {1.0, 1.0, 1.0} | 1.0 | 100 | true | perfect |
| LBS-07 | {0.0, 0.0, 0.0} | 0.0 | 0 | true | present but scored zero on all (distinct from LBS-04 `hasData=false`) |
| LBS-08 | {0.835, 0.835, null} → mean 0.835 → 83.5 | 0.835 | **84** | true | **round-half-up boundary** at .5 |

**2.12.3 Rank, movement, streak — `rankAndMovement(current[], priorSnapshots[])`:**

| Test ID | Scenario | Expected | Rule |
|---------|----------|----------|------|
| LBR-01 | scores A=83, B=79, C=100 | ranks C#1, A#2, B#3 | sort desc |
| LBR-02 | A this month rank 2, last month rank 4 | movement **up** (teal ▲), fires "Rank MOVED UP" meme | vs prior snapshot |
| LBR-03 | B this month rank 3, last month rank 1 | movement **down** (coral ▼), "Rank MOVED DOWN" meme | |
| LBR-04 | C rank 1 this and last month | movement **same**; #1 → "Leaderboard RANK #1" + Sunny-Yellow badge | |
| LBR-05 | tie: A=80, B=80; A on-time 0.95 vs B 0.90 | A ranks above B | **tie-break: higher on-time attendance** then earlier joining (OQ-19) |
| LBR-06 | full tie incl. attendance; A joined 2025-01, B joined 2026-01 | A (earlier joiner) above B | second tie-break |
| LBR-07 | member on-time every month Jan–Apr | streak badge "**4 months on-time streak 🔥**", fires STREAK meme | consecutive prior snapshots |
| LBR-08 | member with a late month in the middle | streak resets to current run length | streak breaks on a non-perfect month |
| LBR-09 | brand-new member, no prior snapshot | movement = **none/new** (no arrow), personal-best marker instead | new joiners have no prior to compare |
| LBR-10 | 1st-of-month IST midnight | board resets; prior month frozen for comparison | monthly reset (I3) |

### 2.13 Advance-leave cap — `advanceCapOk(currentBalance, requestedDays, type)` + debt split

Rules (PRD §9.5, arch §6.3 / §11.2, OQ-13): full-time may go up to **5 days beyond accrued** (balance to −5). Excess beyond the cap → deducted in F&F.

| Test ID | balance | requested | type | Expected `advanceCapOk` | advanceDebt (days) | excessBeyondCap (F&F) | Rule |
|---------|---------|-----------|------|--------------------------|--------------------|------------------------|------|
| ADV-01 | 9.0 | 3 | full_time | true | 0 | 0 | fully covered, no advance |
| ADV-02 | 1.0 | 6 | full_time | **true** | 5 | 0 | **balance → −5 exactly (cap boundary)** |
| ADV-03 | 1.0 | 7 | full_time | **false** (beyond cap) | 5 | **1** | fixture arch §11.2 — 7th day is F&F-recoverable excess |
| ADV-04 | 0.0 | 5 | full_time | true | 5 | 0 | all advance, at the cap |
| ADV-05 | 0.0 | 6 | full_time | false | 5 | 1 | 1 beyond cap |
| ADV-06 | 3.0 | 2 | full_time | true | 0 | 0 | no advance needed |
| ADV-07 | 0.0 | 1 | intern | **false / 0 cap** | 0 | 1 | **interns have no advance entitlement** (assumption — flag OQ) |

> **OQ-13 decision needed:** does the app **hard-block** a request beyond the 5-day cap, or **allow-and-flag** the excess as F&F-recoverable? Tested default (per arch §11.2) = **allow, split the excess into `excessBeyondCap` for F&F**. If Founder wants a hard block, ADV-03/05 flip to a 422 at request time (§3) and the split fn is only used for the ≤cap portion.

---

## 3. API integration test scenarios (per endpoint) + RBAC negative matrix

**Harness:** Supertest against the Express `app.ts` factory, real Postgres (Neon branch in CI / Docker locally), DB reset + re-seed per test file (§6). Each test: seed users of each role → get JWTs → hit endpoint → assert status + body + **DB side-effects** (ledger rows, notifications). Auth via `Authorization: Bearer`. The **injected clock** (§6.2) fixes "today" so date-dependent endpoints are deterministic.

### 3.1 Positive per-endpoint happy paths (one per endpoint minimum)

| Test ID | Endpoint | Actor | Assert |
|---------|----------|-------|--------|
| API-AUTH-01 | POST `/auth/login` valid | public | 200, access token + httpOnly refresh cookie |
| API-AUTH-02 | POST `/auth/login` bad password | public | 401, gentle error envelope, **no token** |
| API-AUTH-03 | GET `/auth/me` | TM | 200, returns role + `is_admin` + permissions |
| API-TASK-01 | POST `/tasks` | TM (self) | 201, `owner_id`=self, `work_date` server-computed in IST |
| API-TASK-02 | POST `/tasks/:id/start` then `/complete` | TM | `actual_minutes` = complete−start; `within_estimate` correct |
| API-TASK-03 | POST `/tasks` on a Sunday | TM | 201 — **off-day logging allowed, no comp-off needed to log** (PRD §8.1) |
| API-ATT-01 | POST `/attendance/check-in` at 10:44 IST (clock injected) | TM | 200, `is_late=false`, status `present` |
| API-ATT-02 | POST `/attendance/check-in` at 10:46 IST | TM | 200, `is_late=true`, status `late` |
| API-ATT-03 | POST `/attendance/check-in` twice same day | TM | 2nd → **409 conflict** (one row per day, unique(user_id,day)) |
| API-ATT-04 | POST `/attendance/wfh-confirm` on a 2nd Saturday | TM | 200, status `wfh`; on a non-WFH day → 409/422 |
| API-LEAVE-01 | POST `/leave/requests` then approve | TM→RM | ledger posts deduction in priority order; balance updated; "leave_decided" notification |
| API-LEAVE-02 | approve leave with 2 comp-off + 3 days PL request | RM | **comp-off credits consumed FIFO-by-expiry (2), PL −1**, LWP 0 (encodes PRIO-01 end-to-end) |
| API-CMP-01 | POST `/comp-off/requests` before off day | TM | 201 pending; **RM copied (notified), routed to Admin** (PRD §9.4) |
| API-CMP-02 | POST `/comp-off/requests` for a date already started | TM | **422** — retro rejected (CMPRE boundary end-to-end) |
| API-CMP-03 | POST `/comp-off/credits` by Admin | Admin | +1 credit, `expires_on`=31-Mar-FY; "comp_off_credited" notification |
| API-CAMP-01 | POST `/campaigns/:id/deliver` on/before deadline | CL | status `delivered`, `delivered_at` set, feeds leaderboard factor 3 |
| API-HOL-01 | GET `/holidays?fy=2026` | any auth | 23 seeded rows, correct mandatory/optional split |
| API-LB-01 | GET `/leaderboard?month=` | any auth | ranked list w/ movement arrows + streak badges |
| API-SAL-01 | GET `/profiles/:id/salary-view` (self) | TM | base + LWP deduction + advance debt + net **estimate label**, no PF/ESI/TDS |
| API-JOB-01 | POST `/internal/jobs/monthly-accrual` with `JOB_SECRET` | cron | idempotent — running twice does **not** double-credit (Risk R1) |

### 3.2 Validation / boundary API tests

| Test ID | Endpoint | Input | Expected |
|---------|----------|-------|----------|
| API-VAL-01 | POST `/tasks` `estimatedMinutes = 0` / negative | 422 zod | must be > 0 |
| API-VAL-02 | POST `/leave/requests` end_date < start_date | 422 | date-range validation |
| API-VAL-03 | any write with malformed body | 422, `{error:{code,message,details}}` envelope | single error funnel (arch §8.4) |
| API-VAL-04 | POST `/comp-off/requests` with `off_date` that is a normal office day | 422/409 | comp-off only on approved off days (§9.4) |
| API-VAL-05 | client sends a `work_date`/`off_date` in body | server **ignores** and computes IST date server-side | never trust client dates (arch §8.1) |
| API-VAL-06 | DELETE `/profiles/:id` with wrong `confirmName` | **422**, gentle message, **no deletion** | name-typed gate (arch §10.2) |
| API-VAL-07 | DELETE `/profiles/:id` with exact `confirmName` (case/space-normalized) | 200, cascades all child data | destructive delete confirmed |

### 3.3 RBAC negative matrix (the privacy firewall — exhaustive)

**Actors seeded:** `ADMIN` (Anshuman), `FOUNDER` (locked admin), `RM` (manages `TM_A`), `TM_A` (reportee of RM), `TM_B` (reports to Founder, NOT to RM), `CL` (Campaign Lead of `CAMP_X`, plain member of nothing else). Each cell asserts the **denied** actor gets **403** (or a scoped/empty result), and the DB is unchanged.

| Test ID | Endpoint / action | Actor | Target | Expected | PRD/OQ ref |
|---------|-------------------|-------|--------|----------|------------|
| RBAC-01 | GET `/profiles/:B/salary-view` | **TM_A** | TM_B | **403 / salary omitted** | §5, §10.1 — **team member cannot see a peer's salary** |
| RBAC-02 | GET `/profiles` list | TM_A | all | own row only; **`salary_amount` field absent** on others | §10.1 field-scoping |
| RBAC-03 | GET `/profiles/:A/salary-view` | RM | TM_A (reportee) | **200 — allowed** (RM sees reportee salary) | §5, OQ-24 |
| RBAC-04 | GET `/profiles/:B/salary-view` | RM | TM_B (**not** reportee) | **403** | RM scope = reportees only |
| RBAC-05 | DELETE `/tasks/:id` (TM_B's task) | TM_A | TM_B's task | **403** | §4.1 — only owner or Admin deletes |
| RBAC-06 | DELETE `/tasks/:id` | **Admin** | anyone's task | **200** | §4.1 — **only admin can delete any** |
| RBAC-07 | DELETE `/profiles/:id` | RM / TM | anyone | **403** | §4.5 — delete is Admin-only |
| RBAC-08 | PATCH `/admin/users/:id/admin-toggle` | RM / TM | anyone | **403** | §3 — admin toggle is Admin-only |
| RBAC-09 | PATCH `/admin/users/:founder/admin-toggle` off | Admin | Founder | **403/blocked** | Founder admin is locked (arch §7.4) |
| RBAC-10 | PATCH `/admin/users/:self/admin-toggle` off (last admin) | Admin | self | **blocked**, gentle msg | last-admin safeguard (OQ-21) |
| RBAC-11 | GET `/campaigns/:Y/tasks` (a campaign CL does **not** lead) | CL | CAMP_Y | **403** | §11.3 — **CL sees only own campaign** |
| RBAC-12 | GET `/campaigns/:X/tasks` (CL's own campaign) | CL | CAMP_X | **200** — member task **status** only (no timers, no salary/attendance) | §11.3 |
| RBAC-13 | POST `/leave/requests/:id/approve` (TM_B's request) | RM | TM_B | **403** | §9.8 — **manager approves only own reportees** |
| RBAC-14 | POST `/leave/requests/:id/approve` (TM_A's request) | RM | TM_A | **200** | reportee approval allowed |
| RBAC-15 | POST `/comp-off/requests/:id/approve` | **RM** | reportee | **403 — RM cannot approve comp-off** (only Admin), even for own reportee | §9.4, OQ-9 (asymmetry vs ordinary leave) |
| RBAC-16 | POST `/comp-off/requests/:id/approve` | Admin | anyone | 200 | §9.4 |
| RBAC-17 | PATCH `/attendance/:userId/:day` override | RM / TM | anyone | **403** | §4.2 — override is Admin-only |
| RBAC-18 | GET `/focus/:B` (structured coaching view) | RM | TM_B (not reportee) | **403** | §12.3 — reportee-scoped |
| RBAC-19 | GET `/attendance?userId=B` | TM_A | TM_B | **403** | own/reportee/admin only |
| RBAC-20 | POST `/campaigns` (create) | TM / CL | — | **403** | OQ-1 — Admin-only create (confirm) |
| RBAC-21 | Any admin-only endpoint | **Admin** | — | **200 (short-circuit)** | arch §7.3 — **admin short-circuits every check**; assert across a sample of ≥8 endpoints |
| RBAC-22 | GET another user's GPS coords via any payload | TM_A | TM_B | coords **absent/403** | §10.5 — GPS is PII, scoped like salary |
| RBAC-23 | Admin "act-as" POST `/tasks` with `X-Act-For: TM_A` | Admin | TM_A | 201, `owner_id=TM_A`, `created_by=Admin` | arch §7.6 on-behalf |
| RBAC-24 | Same `X-Act-For` header sent by **non-admin** | TM_A | TM_B | header **ignored**, acts as self only | act-as gated to admins |
| RBAC-25 | Disabled user (`is_active=false`) valid JWT | ex-member | any | **403** | arch §7.3 |
| RBAC-26 | Expired access token | any | any | **401**, refresh flow | §7.2 |

> **Assertion discipline:** each RBAC-negative test must assert **both** the HTTP status **and** that no row was written/changed (query the DB after). A 403 that still mutated state is a real defect this suite exists to catch. RBAC middleware coverage target is near-100% (§1.4).

### 3.4 Cross-cutting integration invariants

| Test ID | Invariant | Assert |
|---------|-----------|--------|
| INV-01 | Ledger reconstructs balance | After a sequence of accrual/deduction/adjustment/clawback entries, `computeBalance(ledger)` == the stored `balance_after` of the last row |
| INV-02 | Half-day single source of truth | Marking a day `half_day` posts exactly one `−0.5` deduction in priority order — never a `half_day` status **and** a separate full-day deduction (OQ-22) |
| INV-03 | Comp-off consumed-before-PL end-to-end | Approving leave when comp-off>0 leaves PL untouched until comp-off hits 0 (encodes §2.8) |
| INV-04 | Expired comp-off not consumed | Approving leave after a credit's `expires_on` uses PL/LWP, not the lapsed credit (encodes CMPEXP-05) |
| INV-05 | Overdue notification idempotency | Running `flag-overdue` twice fires the Lead+Manager notification **once** (`overdue_notified` guard) |
| INV-06 | Monthly accrual idempotency | Running `monthly-accrual` twice for the same month does not double-credit (self-healing, Risk R1) |
| INV-07 | workingDays == leaderboard denominator | The same `workingDaysInMonth` helper drives salary and the attendance factor (guards OQ-8 drift) |

---

## 4. Frontend component / interaction tests (RTL)

Query by accessible role/text; assert rendered output and user-visible behaviour. API stubbed with MSW. **These enforce PRD §6.7 / §7.3 tone rules as code, not vibes.**

| Test ID | Component / behaviour | Assert |
|---------|-----------------------|--------|
| FE-TOAST-01 | Meme toast **no-repeat-twice-in-a-row** | With injected RNG forced to return the same index twice, `pickMeme(bank, lastLine, rng)` **re-rolls**; rendered line ≠ previous line for the same event (PRD §6.5). Run 100 injected sequences. |
| FE-TOAST-02 | Toast anatomy | dark-lifted bg, purple border, emoji left, DM-Sans-Medium text, auto-dismiss after 3s (fake timers), never blocks UI (no modal backdrop), ≤90% width |
| FE-TOAST-03 | Correct bank per event | on-time check-in → line from "ON-TIME check-in" bank; late → "LATE check-in" bank; approval → "Leave APPROVED" bank + tiny HC stamp |
| FE-TOAST-04 | Late/rank-drop toasts are **never punitive** | asserted lines come only from the affectionate banks; no all-caps except allowed cases |
| FE-CLOCK-01 | **No ticking clock / countdown rendered** | Active task card shows a glow class, **no** element matching a timer/`hh:mm:ss`/countdown pattern; campaign proximity shows label ("Coming up"), not a live countdown (PRD §6.7 / §7.3) |
| FE-CLOCK-02 | Active task glow | On "On it 🔥", card gets the purple-glow class; no timestamp/number shown to the member |
| FE-EMPTY-01 | Empty task list = **invitation** | With 0 tasks, renders an "EMPTY task list" meme/invitation ("Add your first task"), not "No tasks logged" (§7.3) |
| FE-EMPTY-02 | Empty leaderboard / new joiner | shows personal-best/"building your streak" framing, not a hollow "#last" |
| FE-DELETE-01 | **Type-name-to-confirm** delete | Delete button stays **disabled** until typed text exactly equals the employee's `full_name`; case/space-normalized; a mismatch keeps it disabled (arch §10.2) |
| FE-DELETE-02 | Confirm modal copy | shows "Type the employee's name to confirm deletion"; cancel closes without calling the API |
| FE-NUM-01 | **No raw number without human interpretation** | Late-count widget renders "3 slow starts this month — baaki mahina baaki hai 💪", never a bare "3" (§6.7) |
| FE-NAV-01 | **≤5 bottom-nav tabs** | bottom nav renders exactly Home/Tasks/Campaigns/Attendance/Profile — asserts count === 5, never more (§6.7) |
| FE-ERR-01 | Gentle error rendering | A 401/403/409 from the client maps to a friendly line, never a raw stack, never all-caps, never shaming (§6.7) |
| FE-CAPS-01 | No all-caps except leaderboard rank | scan rendered text nodes; the only all-caps allowed is the 48px leaderboard rank number |
| FE-FOCUS-01 | Focus card framing | renders "Today's Focus: 4h 50m in the zone 🎯" (from FOCUS-01 data), **no percentage**, no teammate comparison, not live-updating |
| FE-DAYCHIP-01 | Attendance calendar colour coding | teal=on-time, coral=late, lavender=WFH, grey=weekend/holiday, white=upcoming; 2nd-Sat shows WFH toggle, 4th-Sat/Sun show off (§6.4) |
| FE-ARC-01 | Profile leave arcs | comp-off arc (purple) + PL arc (teal) render from balance props; salary card visible to self, **hidden** when viewer prop is a non-RM peer |
| FE-WFH-01 | WFH toggle visibility | appears only on 2nd-Saturday / admin-granted WFH day; tapping confirms WFH without requesting GPS |
| FE-LEAVE-01 | Probation warning | submitting PL during probation shows "probation leave is LWP-only" flag, request still allowed (F1) |
| FE-CAMP-01 | Campaign proximity states | ≥5d teal "On track", <5d amber "Coming up", day-of hot-pink "Due today", past hot-pink "This one needs your attention 🔴" (D2) |
| FE-FORM-01 | Shared zod validation on client | task form rejects `estimatedMinutes ≤ 0` using the **same** `@hc/shared` schema as the server (no drift) |

---

## 5. E2E happy paths (Playwright)

Thin, deterministic, seeded DB, **clock pinned** via a test-only header/env so lateness and dates are stable. Cover the flows a human would demo; do **not** re-test math here (that's §2).

| Test ID | Flow | Steps → assertions |
|---------|------|--------------------|
| E2E-01 | **Check-in → task → done → focus** | Login as TM → tap GPS check-in (mock geolocation, clock=10:30) → on-time meme toast → create task (est 30m) → "On it 🔥" (card glows) → advance clock 28m → "Nailed it ✅" → on-time meme → Home shows "Today's Focus: 0h 28m in the zone" |
| E2E-02 | **Late check-in path** | clock=10:46 → check-in → late (coral) friendly meme → attendance chip coral |
| E2E-03 | **Leave request → approve → balance update** | TM submits 2-day PL (has 9.0 PL) → RM sees it in queue → approves → "Leave APPROVED" toast + HC stamp → TM profile PL arc drops 9.0 → 7.0; ledger shows the entry |
| E2E-04 | **Comp-off: request → approve → credit → used-before-PL** | Day before a Sunday: TM submits comp-off request → Admin approves → (advance clock past the Sunday; TM logs tasks that day) → Admin credits +1 comp-off → later TM applies 1-day leave → **comp-off consumed first (comp-off 1→0), PL unchanged** |
| E2E-05 | **Retro comp-off blocked** | TM tries to submit a comp-off request for a date already begun → gentle "no retrospective" error, no request created |
| E2E-06 | **WFH on 2nd Saturday** | clock = a 2nd Saturday → Home surfaces WFH toggle → tap "Working from home today 🏠" → WFH meme → attendance chip lavender |
| E2E-07 | **Admin edit/delete** | Admin marks another member's forgotten task Done with a manual completion time → actual recomputes → Admin deletes a task → gone (no recovery) |
| E2E-08 | **Profile delete confirmation** | Admin opens delete on a test profile → Delete disabled → type exact name → enabled → confirm → profile + data gone |
| E2E-09 | **Campaign overdue notification** | clock advances past a campaign deadline → Lead + Manager see an in-app overdue notification exactly once; card flips coral "This one needs your attention 🔴" |
| E2E-10 | **Leaderboard reset + movement** | End of month → board freezes; new month → ranks reset, previous ranks drive up/down arrows |
| E2E-11 | **PWA install + 5-tab nav + dark theme** | Install prompt works; bottom nav shows 5 tabs; renders on dark palette at phone width |
| E2E-12 | **RBAC smoke** | TM_A navigates to TM_B's profile URL directly → salary section not shown / access blocked (UI-level guard mirrors API) |

---

## 6. Test data & fixtures, deterministic clock, CI plan

### 6.1 Fixtures & seed strategy

- **Canonical numeric fixtures** live in one shared module `server/tests/fixtures/canonical.ts`, transcribed **verbatim** from arch §11 + Product-Plan Appendix A (accrual tables, priority splits, clawback, leaderboard, salary, focus). The domain suite imports these — a spec edit forces a fixture diff, which forces a test review. **No magic numbers inline in tests.**
- **Seed personas** (`server/tests/fixtures/seed.ts`), joining dates chosen to straddle every boundary:
  - `FOUNDER` (locked admin), `ADMIN` (Anshuman), `RM`.
  - `TM_APR` — full-time, joined **1-Apr-2026** (hits 18 cap; drives FTACC-A).
  - `TM_MAY` — full-time, joined **1-May-2026** (opening in Aug; FTACC-B).
  - `TM_PROBATION` — full-time, joined **1-Jul-2026** (still in probation "today").
  - `INTERN` — joined 1-Apr-2026 (INTACC).
  - `CL` — Campaign Lead of `CAMP_X` only.
  - `TM_B` — reports to Founder (not RM) — for RBAC scope tests.
  - Birthdays set to **10-Sep** (weekday) and **12-Sep** (2nd-Sat overlap) to drive DAYTYPE-18/19.
  - Sample salaries flagged fake.
- **Holiday seed:** all 23 FY26-27 rows (Product-Plan A.7); weekends/2nd-Sat/4th-Sat are **computed, not seeded** (arch §8.7) — so the day-type engine is genuinely exercised, not read back from a table.
- **DB lifecycle:** each API test file runs in a **transaction rolled back after each test**, OR against a freshly-migrated+seeded Neon branch per file. Prefer transaction-rollback for speed; use branch-per-file only where a test needs committed cross-connection state (cron jobs).
- **Meme bank** seeded from PRD §6.6 (20 events × 10 lines) so no-repeat and bank-selection tests run against real data.

### 6.2 Deterministic clock (inject "today") — the single most important test-infra rule

- **No domain function reads the wall clock.** `now: DateTime`/`today: LocalDate` is always a parameter (arch §6.2). Domain tests pass a frozen IST instant literal.
- **Services** obtain `now` from one `clock` module (`clock.nowIst()`). In unit/integration tests, `clock` is replaced with a **fixed clock** (`makeFixedClock('2026-08-08T10:46:00+05:30')`). In E2E, a test-only mechanism (env `TEST_CLOCK` or an `X-Test-Clock` header honoured **only when `NODE_ENV=test`**) pins server time; the browser's `Date`/geolocation is faked via Playwright.
- **Every date-boundary rule gets a frozen-clock test on both sides:** 10:45:00 vs 10:45:00.001; 15th 23:59 vs 16th 00:00; 31-Mar-2027 23:59 vs 1-Apr-2027 00:00; off-day start in IST vs the equivalent UTC instant.
- **Timezone guard tests** feed a UTC instant that lands on a different IST calendar day (e.g. `18:30Z` = next-day `00:00 IST`) and assert the IST-correct outcome — this is the explicit defence against Risk R3 (IST/UTC off-by-one).
- **Randomness** (meme picker) uses an injected RNG; tests pass a seeded/stubbed RNG.

### 6.3 CI plan (GitHub Actions)

**`ci.yml` (on every PR → required to merge):**

```yaml
name: ci
on: [pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]          # LTS + current; catches engine drift
    services:
      postgres:
        image: postgres:16       # local PG for API tests (fast, free, no Neon quota)
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: hc_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://postgres:test@localhost:5432/hc_test
      TZ: UTC                    # prove IST logic works on a UTC host (Render parity)
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ matrix.node }}', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck            # tsc --noEmit across web/server/shared
      - run: npm run lint                 # eslint
      - run: npx prisma migrate deploy && npm run seed:test
      - run: npm run test:domain -- --coverage   # Vitest domain — 100% gate
      - run: npm run test:api                     # Supertest against PG service
      - run: npm run test:web                     # RTL component tests
      - run: npm run build                        # web + server build must pass
      - name: Enforce coverage gates
        run: node scripts/check-coverage.mjs      # fails if domain < 100% or floors breached
```

- **`TZ: UTC` in CI is deliberate** — running the suite on a UTC host proves the IST math doesn't secretly depend on the server timezone (Render runs UTC). This is a cheap, high-value guard for Risk R3.
- **Node matrix (20 + 22):** catches engine-specific date/Intl differences.
- **Postgres service container** (not Neon) for PR speed and to avoid Neon branch quota; Neon-branch integration is optional on a nightly/`main` workflow.

**`nightly.yml` (scheduled, `main`):**
- Full API suite against a **Neon preview branch** (real target engine).
- **Stryker mutation run** on the money-math domain files (`leaveAccrual`, `compOff`, `separation`, `leaderboard`, `salary`, `applyLeaveDeduction`) — gate: mutation score ≥ 85%; report but don't block PRs (too slow), block the nightly badge.
- **Playwright E2E** against a deployed preview.

**`cron.yml` (already in the repo, arch §9):** unrelated to tests, but its target endpoints (`monthly-accrual`, `flag-overdue`, `nightly-leaderboard`) are covered by INV-05/06 idempotency tests so a double-fire never corrupts balances.

---

## 7. Coverage gates, exit criteria, traceability

### 7.1 Release gates (v1 cannot ship unless all are green)

1. **Domain coverage = 100%** (statements/branches/functions) on `server/src/domain/**`.
2. **Every arch §11 and Product-Plan Appendix-A fixture** has a passing domain test (traceability table below).
3. **RBAC negative matrix (§3.3) fully green** — no denied actor can read salary/GPS or mutate another's data.
4. **Half-day / clawback / accrual / priority / leaderboard** worked examples pass to the exact expected value (money & leave to 2 dp).
5. **Tone guardrails (§4)** green: no-repeat meme, no ticking clock, ≤5 tabs, gentle errors, type-name-to-delete.
6. **E2E happy paths (§5)** green on a deployed preview.
7. **Mutation score ≥ 85%** on money-math files (nightly).
8. **All blocking OQs resolved** (§8) — especially the grace boundary, working-day definition, and half-day measurement, because they change *tested expected values*.

### 7.2 Traceability (fixture → test IDs)

| Spec fixture | Encoded by |
|--------------|-----------|
| Arch §11.1 day-type & lateness | DAYTYPE-01..21, LATE-01..11 |
| Arch §11.2 / A.1 full-time accrual + priority + advance | FTACC-A/B/C, PRIO-01/02, ADV-02/03 |
| A.2 intern accrual | INTACC-01..09 |
| Arch §11.3 / A.5 separation clawback | SEP-01..10 |
| Arch §11.4 / A.4 leaderboard | LBF-*, LBS-01..08, LBR-* |
| Arch §11.5 / A.6 salary | SAL-01..13 |
| Arch §11.6 focus | FOCUS-01..08 |
| A.3 priority ordering | PRIO-02 (+ PRIO-01 headline) |
| Comp-off §9.4 | CMPRE-*, CMPEL-*, CMPEXP-*, API-CMP-*, E2E-04/05 |

---

## 8. Open questions that block or shape test-expected values

These are the subset of Product-Plan §7 / arch §13 OQs whose resolution **changes a number a test asserts**. They must be confirmed before the affected suite's expected values are frozen.

| OQ | Question | Tested default (what the tables assume) | What flips if changed |
|----|----------|------------------------------------------|------------------------|
| OQ-17 / Q7 | Is 10:45:01–10:45:59 on-time or late? | **Late** (anything > 10:45:00.000) | LATE-05/06 expected `isLate`, every late-count, attendance leaderboard factor |
| OQ-6 | Half-day "productive hours" = task Start→Done or check-in→check-out? | **Task Start→Done total** | HALFDAY-* input semantics, focus/half-day coupling |
| OQ-8 / OQ-23 | Do unclaimed **optional holidays** count as working days? Are leave days excluded from denominators? | **Optional holidays = non-working; leave days excluded** | SAL-10..13 working-day counts, LBF attendance denominator, LWP per-day value |
| OQ-10 | Birthday inside the 2-optional cap or separate? Birthday on an already-off day? | **Separate**; on a Sunday → no double benefit (DAYTYPE-22) | DAYTYPE-22, optional-holiday cap tests |
| OQ-13 | Advance beyond 5 days: hard-block or allow-and-flag F&F? | **Allow, split excess to F&F** | ADV-03/05 (422 vs split), salary F&F |
| OQ-9 | Can RM approve comp-off? | **No — Admin only, RM copied** | RBAC-15 expected 403 |
| OQ-1 / OQ-2 | Who creates campaigns / marks delivered? | Create = **Admin only**; deliver = **CL + Admin** | RBAC-20, API-CAMP-01 |
| OQ-19 | Leaderboard tie-break + reset timing | **Higher on-time, then earlier joiner; monthly IST-midnight reset** | LBR-05/06/10 |
| OQ-11 | employment_type switch: retroactive or forward? | **Forward-only** | INTACC-09 |
| — | 29-Feb DOB in a non-leap FY: observe 28-Feb or 1-Mar? | **Pin needed** (DAYTYPE-23) | birthday resolution edge |
| — | Two simultaneous "On it" tasks → focus double-counts overlap? | **Allow, naive sum** (FOCUS-08) | focus-time upper bound |

> **QA Lead recommendation:** freeze OQ-17, OQ-6, and OQ-8 **before M2/M3 build** — they are the ones that silently change real people's late-counts, leave balances, and leaderboard ranks. Everything else can be defaulted and revisited without re-baselining the money math.

---

*End of `04-test-strategy.md`. Companion docs: `01-architecture.md` (build), `02-product-plan.md` (stories + Appendix-A fixtures), PRD v6.0 (authoritative rules).*
