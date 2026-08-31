# 05 — Domain Rules (Business-Logic Single Source of Truth)

> **Authority.** This document is the **formal, unambiguous specification of every business rule** in Hustling Collaborators. Both the implementation (`server/src/domain/**`) and the test suite (Vitest fixtures) **MUST** conform to this file. Where this file gives an exact number, boundary, or rounding rule, it **overrides** looser phrasing anywhere else (including the PRD prose and the worked examples in `01-architecture.md §11` / `02-product-plan.md App. A`) — those are illustrative; this is normative. Any deviation is a bug in the code or a change request against this document.
>
> **Source of truth chain:** PRD (`docs/PRD.md`, authoritative for *intent*) → **this file** (authoritative for *exact rules*) → architecture (`01`, function homes & schema) → tests. Function names/signatures below match `01-architecture.md §6.3` so the catalogue and the rules stay in lockstep.

---

## 0. Conventions, types & global invariants

### 0.1 Types & vocabulary

| Symbol | Meaning |
|---|---|
| `LocalDate` | An IST calendar date (`YYYY-MM-DD`), no time component. All "business dates" are `LocalDate`. |
| `DateTime` | An instant, always resolved in `Asia/Kolkata` (Luxon `DateTime` with zone `IST_TZ`). |
| `Instant` | A UTC `timestamptz` at rest in Postgres; converted to IST before any rule is applied. |
| `Days` | A `numeric(4,2)` leave quantity. Legal increments: multiples of **0.5** (half-day granularity). Never negative except a tracked *advance-leave debt* (see §9). |
| `Minutes` | Integer minutes. Task/focus durations. |
| `INR` | Rupees, `numeric(12,2)` (two-decimal paise precision). |

### 0.2 Timezone law (non-negotiable)

1. Every rule evaluates in **`Asia/Kolkata` (IST, UTC+05:30)**. No DST.
2. The **business date** of any instant is `toIstDate(instant)` — the calendar date *in IST*. A check-in at `2026-11-08T19:00:00Z` (= `2026-11-09T00:30 IST`) belongs to business date **2026-11-09**, not the 8th.
3. **Never trust a client-supplied date or clock.** The server computes `now`/`today` from a single injected `clock` module. Domain functions receive `now: DateTime` or `today: LocalDate` explicitly; they never call `Date.now()`.
4. FY, month, week and "the 15th" boundaries are all IST boundaries.

### 0.3 Purity & testability law

Every rule in this document is realised as a **pure function** in `server/src/domain/`: plain data in, plain data out, no I/O, no ambient time, no randomness. This is what makes the leave math trustworthy — it is the whole reason the app exists (fix the "a task quietly eats a day" blind spot with *honest, verifiable* math).

### 0.4 Rounding & precision (applies everywhere unless a rule states otherwise)

| Quantity | Rule |
|---|---|
| Leave days | Stored/'computed at `0.5` granularity. Intermediate sums exact; never round a day quantity to less than 0.5. |
| Leaderboard factor ratios | Full `double` precision internally; **not** rounded until the final score. |
| Leaderboard score | `round(mean(nonNullFactors) × 100)` — **round half up** to nearest integer, clamped `[0,100]`. |
| Money (deductions, per-day value, net) | Compute in full precision; **round half up to 2 decimals (paise)** only for display/storage of the final figure. |
| `daysBetween` | Whole IST calendar days (integer), `end − start`. |
| `completedMonths` / month index | Whole calendar months (integer). |

### 0.5 Enum references (from `01-architecture.md §4.2` — do not re-invent)

`day_type` = `office | wfh | sunday | fourth_saturday | second_saturday | mandatory_holiday | optional_holiday | birthday`
`attendance_status` = `present | late | wfh | half_day | absent | on_leave | holiday | weekend_off`
`leave_type` = `pl | lwp | comp_off | half_day | bereavement | maternity | paternity | optional_holiday`
`request_status` = `pending | approved | rejected | cancelled`
`campaign_status` = `new | in_progress | delivered | overdue`
`task_status` = `todo | active | done`

---

## 1. Company constants

> Home: `@hc/shared/constants`. These are the single definition; no magic numbers anywhere else.

| Constant | Value | Unit | Meaning / source |
|---|---|---|---|
| `IST_TZ` | `"Asia/Kolkata"` | tz id | All time math. |
| `OFFICE_START` | `"10:30"` | IST wall time | Scheduled office start (PRD §9.1). |
| `GRACE_CUTOFF` | `"10:45:00"` | IST wall time | **On-time iff check-in ≤ 10:45:00.000**; strictly after → late. Grace is **inclusive** of 10:45:00. |
| `WFH_SATURDAY_ORDINAL` | `2` | ordinal | 2nd Saturday of each month = WFH day. |
| `OFF_SATURDAY_ORDINAL` | `4` | ordinal | 4th Saturday of each month = off. |
| `WEEKLY_OFF_WEEKDAY` | `Sunday` | weekday | Sundays off. |
| `WORK_WEEK` | 6-day (Mon–Sat) | — | 1st/3rd/5th Saturdays are **normal office days** (assumption A1, §18 — confirm). |
| `FY_START` | `01 April` | date | Financial year start. |
| `FY_END` | `31 March` | date | Financial year end (balances lapse). |
| `COMP_OFF_GUIDELINE_MIN` | `360` | minutes (6h) | Admin **guideline** for comp-off; never an automatic gate (PRD §9.4.4). |
| `HALF_DAY_MIN` | `240` | minutes (4h) | ≥ 4 productive hours ⇒ half-day; below ⇒ full-day leave (PRD §9.3). |
| `FT_MONTHLY_ACCRUAL` | `1.5` | days | Full-time monthly credit. |
| `FT_OPENING_CREDIT` | `6.0` | days | Full-time opening balance at start of employment month 4. |
| `FT_PROBATION_MONTHS` | `3` | months | Full-time probation (LWP-only). |
| `FT_FY_CAP` | `18.0` | days | Full-time annual entitlement (Casual+Sick combined). |
| `FT_ADVANCE_CAP` | `5.0` | days | Max PL usable in advance of accrual. |
| `INTERN_MONTHLY_ACCRUAL` | `1.0` | days | Intern monthly credit (after opening). |
| `INTERN_OPENING_CREDIT` | `3.0` | days | Intern opening balance at start of month 3. |
| `INTERN_PROBATION_MONTHS` | `2` | months | Intern no-leave period. |
| `INTERN_TOTAL_CAP` | `4.0` | days | Intern total entitlement over the 6-month internship. |
| `INTERN_TERM_MONTHS` | `6` | months | Internship length. |
| `INTERN_ADVANCE_CAP` | `0.0` | days | Interns cannot take advance leave (assumption A2, §18 — confirm). |
| `OPTIONAL_HOLIDAY_CAP_PER_FY` | `2` | claims | Optional holidays claimable per FY (excludes birthday). |
| `BIRTHDAY_ENTITLEMENT_PER_FY` | `1` | claim | Birthday is an **additional** optional day. |
| `CLAWBACK_CUTOFF_DAY` | `15` | day-of-month | Last working day ≤ 15th ⇒ that month's 1.5 credit clawed back (PRD §9.7). |
| `LEADERBOARD_FACTOR_WEIGHT` | `1/3` each | — | Three equal-weighted factors (PRD §14.1). |
| `CAMPAIGN_COMING_UP_DAYS` | `5` | days | ≤ 5 days to deadline ⇒ "coming up" (PRD §11.2). |

---

## 2. Time & calendar primitives

`time/ist.ts`, `time/fy.ts`, `time/weekday.ts`.

### 2.1 IST date of an instant
```ts
toIstDate(instant: Date): LocalDate           // calendar date of `instant` in Asia/Kolkata
istStartOfDay(day: LocalDate): DateTime        // 00:00:00.000 IST
istEndOfDay(day: LocalDate): DateTime          // 23:59:59.999 IST
```

### 2.2 Financial year
```ts
financialYear(day: LocalDate): { fyStart: LocalDate; fyEnd: LocalDate; label: string }
```
Rule: if `day.month >= 4` (Apr–Dec) ⇒ `fyStart = 01-Apr-day.year`, `fyEnd = 31-Mar-(day.year+1)`; else (Jan–Mar) ⇒ `fyStart = 01-Apr-(day.year−1)`, `fyEnd = 31-Mar-day.year`. `label` = `"${fyStart.year}-${(fyEnd.year % 100)}"`.

- `financialYear(2026-08-15)` → `{2026-04-01, 2027-03-31, "2026-27"}`.
- `financialYear(2027-01-05)` → `{2026-04-01, 2027-03-31, "2026-27"}`.
- `financialYear(2027-04-01)` → `{2027-04-01, 2028-03-31, "2027-28"}`.

`fyEndFor(day)` → `financialYear(day).fyEnd` (used for comp-off expiry).

### 2.3 Nth weekday of month
```ts
nthWeekdayOfMonth(day: LocalDate): { weekday: Weekday; ordinal: 1|2|3|4|5 }
isSecondSaturday(day): boolean   // Saturday AND ordinal === 2
isFourthSaturday(day): boolean   // Saturday AND ordinal === 4
isSunday(day): boolean
```
`ordinal = ceil(day.dayOfMonth / 7)`. Worked (verified): Aug 2026 Saturdays = **1(1st), 8(2nd), 15(3rd), 22(4th), 29(5th)** ⇒ `isSecondSaturday(2026-08-08)=true`, `isFourthSaturday(2026-08-22)=true`, and 2026-08-15 is the **3rd** Saturday (a working office day but overridden by a mandatory holiday — see §3).

### 2.4 Employment month index & completed months
```ts
employmentMonthIndex(joining: LocalDate, asOf: LocalDate): number  // joining's calendar month = 1
completedMonthsSince(joining: LocalDate, asOf: LocalDate): number   // whole calendar months elapsed
```
`employmentMonthIndex = (asOf.year−joining.year)×12 + (asOf.month−joining.month) + 1`.
**Rule A3 (§18):** the joining *calendar month* is index 1 **regardless of the day of month** (matches PRD "credited at the start of each calendar month"). A mid-month joiner's stub month counts as month 1; Admin may pro-rate via balance override (PRD §4.3 explicitly allows "pro-rata adjustments").

- `employmentMonthIndex(2026-04-20, 2026-07-01)` = `(0×12)+(7−4)+1` = **4**.
- `employmentMonthIndex(2026-05-01, 2026-08-01)` = **4**.

---

## 3. Rule R1 — Day-type resolution

```ts
resolveDayType(day: LocalDate, ctx: { holidays: Holiday[]; dob?: LocalDate }): DayType
```
`holidays` carries each seeded/admin holiday with `type ∈ {mandatory_holiday, optional_holiday}`. `dob` is the employee's birth date (month+day matched, any year).

### 3.1 Precedence (first match wins)
| # | Test | Result |
|---|---|---|
| 1 | `day` ∈ holidays where `type = mandatory_holiday` | `mandatory_holiday` |
| 2 | `day` matches `dob` (same month+day) | `birthday` |
| 3 | `day` ∈ holidays where `type = optional_holiday` | `optional_holiday` |
| 4 | `isSunday(day)` | `sunday` |
| 5 | `isFourthSaturday(day)` | `fourth_saturday` |
| 6 | `isSecondSaturday(day)` | `second_saturday` |
| 7 | otherwise | `office` |

> **Why birthday ranks above optional/Sunday/Saturdays:** the *label* the member sees for their own birthday should say "birthday", and a birthday landing on a 2nd-Saturday-WFH is a genuinely claimable day off (see §15/§17). Mandatory beats everything because it is company-wide and unconditional.

### 3.2 Working-day predicate
```ts
isWorkingDay(dt: DayType): boolean
```
| DayType | Working? | Attendance method |
|---|---|---|
| `office` | **yes** | GPS check-in, 10:45 grace |
| `second_saturday` (WFH) | **yes** | WFH toggle, no grace/late |
| `optional_holiday` / `birthday` | **conditionally** — a normal working day **unless the member has an approved optional-holiday/birthday claim for that date** (§15) | as `office` unless claimed |
| `sunday` | no | off; tasks allowed; comp-off-eligible if pre-approved |
| `fourth_saturday` | no | off; tasks allowed; comp-off-eligible if pre-approved |
| `mandatory_holiday` | no | off; tasks allowed; comp-off-eligible if pre-approved |

> **Claim-consumption guard.** `optional_holiday`/`birthday` only *matters* on a day that is otherwise a working day. If an optional holiday or birthday coincides with an already-off day (`mandatory_holiday`, `sunday`, `fourth_saturday`), the day is simply off and **no optional/birthday allowance is consumed** (§15, §17-E2/E7). `isWorkingDay` for an *unclaimed* optional/birthday returns **true**.

### 3.3 Worked examples (canonical fixtures)
| Input | Output | Note |
|---|---|---|
| `resolveDayType(2026-11-09)` | `mandatory_holiday` | Diwali (Mon). |
| `resolveDayType(2026-08-15)` | `mandatory_holiday` | Independence Day; it is the **3rd** Saturday (normally office) — mandatory overrides. |
| `resolveDayType(2026-08-08)` | `second_saturday` | 2nd Sat ⇒ WFH. |
| `resolveDayType(2026-08-22)` | `fourth_saturday` | 4th Sat ⇒ off. |
| `resolveDayType(2026-08-01)` | `office` | 1st Sat ⇒ working. |
| `resolveDayType(2026-08-29)` | `office` | 5th Sat ⇒ working. |
| `resolveDayType(2026-09-12, dob=12-Sep)` | `birthday` | 12-Sep-2026 is also the 2nd Saturday (WFH); birthday label wins; claimable off. |
| `resolveDayType(2026-04-03)` (no claim) | `optional_holiday` | Good Friday; working unless claimed. |

---

## 4. Rule R2 — Check-in lateness & attendance status

### 4.1 Lateness
```ts
classifyCheckIn(checkInAt: DateTime): { isLate: boolean }
```
Let `cutoff = istDateOf(checkInAt) @ 10:45:00.000`. `isLate = checkInAt > cutoff` (strictly greater). Applies **only to `office` days**. WFH/off days: not applicable (`isLate = false`).

| Check-in (IST) | isLate |
|---|---|
| 10:30:00 | false |
| 10:44:59 | false |
| **10:45:00.000** | **false** (grace inclusive) |
| 10:45:01 | true |
| 10:46:00 | true |
| 11:15:00 | true |

### 4.2 Status derivation
```ts
deriveStatus(input: {
  dayType: DayType;
  isOff: boolean;                 // resolved off day for THIS member (unclaimed optional = not off)
  onApprovedLeave: boolean;       // full-day leave approved for this date
  isHalfDayLeave: boolean;        // an approved half-day leave for this date
  checkedIn: boolean;             // GPS check-in exists
  wfhConfirmed: boolean;          // WFH toggle tapped
  isLate: boolean;                // from classifyCheckIn (office days only)
  productiveMinutes: number;      // focus minutes that day (see §6)
}): AttendanceStatus
```
Precedence (first match wins):
1. `onApprovedLeave` ⇒ `on_leave`.
2. `dayType = mandatory_holiday` (and not a claimed working day) ⇒ `holiday`.
3. `dayType ∈ {sunday, fourth_saturday}` ⇒ `weekend_off`.
4. **Working day** (`office`, `second_saturday`, or unclaimed `optional_holiday`/`birthday`):
   a. `isHalfDayLeave`:
      - `productiveMinutes ≥ HALF_DAY_MIN (240)` ⇒ `half_day` (0.5 day leave charged).
      - else ⇒ `on_leave` (the half-day **fails to qualify** and becomes a **full-day** leave — PRD §9.3, see §5).
   b. WFH day (`second_saturday` or Admin-granted WFH): `wfhConfirmed` ⇒ `wfh`; else ⇒ `absent`. (No 10:45 rule for WFH.)
   c. Office day: `checkedIn` ⇒ (`isLate ? late : present`); else ⇒ `absent`.

> **Late handling (PRD §9.2, corrected policy):** a `late` status is **recorded and counted** for the Admin/Manager view but triggers **no automatic PL deduction**. Escalation (warning, or Admin marking the day LWP) is **manual, at Admin/Manager discretion**. The app never auto-penalises lateness.

---

## 5. Rule R3 — Half-day qualification

```ts
qualifiesAsHalfDay(productiveMinutes: number): boolean         // productiveMinutes >= 240
resolveHalfDayOutcome(productiveMinutes: number):
  { status: AttendanceStatus; leaveDaysCharged: Days }
```
Rule (PRD §9.3): a day the member intends as a **half-day** qualifies **only if ≥ 4 productive hours (240 min)** are logged. Otherwise the day is treated as a **full day's leave**.

| `productiveMinutes` | `status` | `leaveDaysCharged` |
|---|---|---|
| `≥ 240` | `half_day` | **0.5** |
| `< 240` | `on_leave` | **1.0** |

- `resolveHalfDayOutcome(300)` → `{half_day, 0.5}`.
- `resolveHalfDayOutcome(180)` → `{on_leave, 1.0}` (3h < 4h ⇒ full leave day charged).

> **"Productive hours" definition (Assumption A4, §18).** `productiveMinutes` = the day's **focus minutes** (sum of task Start→Done, §6) — the only productive-work measure the app has. Consequence: a half-day must be backed by logged tasks. Admin override remains available. Flagged for founder confirmation (could alternatively mean clocked check-in→check-out time).

---

## 6. Rule R4 — Focus time

```ts
computeFocusMinutes(tasksDoneToday: { actualMinutes: number }[]): number   // = Σ actualMinutes
```
Where per task `actualMinutes = round((completedAt − startedAt) in minutes)` and the task is counted under the **IST business date of `startedAt`** (its `work_date`).

**Rules:**
1. Only **Start→Done** (`On it 🔥` → `Nailed it ✅`) time is counted. The **create→Start** gap is excluded *by construction* (never entered into `actualMinutes`).
2. Only tasks with `status = done` for that `work_date` contribute.
3. A task started before midnight and finished after counts **entirely toward its start day** (`work_date`).
4. Rendered by the client as `"Xh Ym in the zone 🎯"` — **never a percentage, never a score, never a live/ticking counter** (PRD §7.3).

- Tasks done today `= [45, 120, 95, 30]` → `computeFocusMinutes = 290` → **"4h 50m in the zone 🎯"**.

> **Concurrency caveat (A5, §18).** If a member has two tasks `active` at once, overlapping Start→Done windows are **summed and thus double-counted**. Recommendation: **enforce at most one `active` task per user** at the service layer (starting a new task auto-completes or blocks until the current one is marked Done). Flagged.

---

## 7. Rule R5 — Full-time leave accrual

> **Superseded by the v4 change log (see §20).** The entitlement figures, the accrual
> shape and the probation rule below describe the original policy. §20 is normative.

`leaveAccrual.ts`. Leave amounts posted as append-only `leave_ledger` entries; balance = running `Σ amount`.

### 7.1 Probation & opening
```ts
probationEndDate(joining: LocalDate, "full_time"): LocalDate  // = firstOfMonth(joining) + 3 months
openingMonthStart(joining): LocalDate                          // = firstOfMonth(joining) + 3 months (start of employment month 4)
```
Leave used **strictly before** `openingMonthStart` (i.e., during employment months 1–3) is **LWP only** — no PL exists yet.

The **opening credit `+6.0`** posted at `openingMonthStart` is exactly **3 probation months × 1.5 (deferred, = 4.5) + current month × 1.5 = 6.0**. I.e., probation accrual is *not lost* — it is held and released as the opening balance.

### 7.2 Accrual algorithm
```ts
monthlyAccrualScheduleFullTime(profile, upTo: LocalDate): LedgerEntry[]
```
Numbered steps (generate entries at each 1st-of-month `m` from `joining` to `upTo`, plus FY expiries):

1. **Probation (employment months 1–3):** post **nothing** (accrual deferred into the opening credit).
2. **Employment month 4 (`m = openingMonthStart`):** post `{ effective_date: m, entry_type: 'opening', amount: +6.0 }`.
3. **Employment month ≥ 5:** post `{ entry_type: 'accrual', amount: +1.5 }` at each 1st-of-month, **subject to the FY cap** (step 5).
4. **FY reset (each `m = 01-Apr`):** *before* the month's accrual, post `{ entry_type: 'expiry', amount: −(remaining balance) }` so the balance resets to **0** (no carry-forward, PRD §9.5). Reset the FY-to-date accrual counter.
5. **FY cap (`FT_FY_CAP = 18`):** total *positive* credits (`opening + accrual`) within a single FY may not exceed **18.0**. If a `+1.5` would breach it, credit only the shortfall (and `0` thereafter that FY).
6. Self-healing: the schedule is a **pure function of `joining` + `upTo`**, so a missed cron simply recomputes all due entries idempotently (R1 mitigation).

`computeBalance(entries): number` = `Σ amount`.

### 7.3 Full FY table — **April joiner** (joins 01-Apr-2026, full-time)

| Emp. month | Calendar month | Event | Δ | Cumulative PL | Usable? |
|---|---|---|---|---|---|
| M1 | Apr 2026 | Probation | 0 | 0.0 | LWP only |
| M2 | May 2026 | Probation | 0 | 0.0 | LWP only |
| M3 | Jun 2026 | Probation | 0 | 0.0 | LWP only |
| **M4** | **Jul 2026** | **Opening** | **+6.0** | **6.0** | ✅ from here |
| M5 | Aug 2026 | Accrual | +1.5 | 7.5 | ✅ |
| M6 | Sep 2026 | Accrual | +1.5 | 9.0 | ✅ |
| M7 | Oct 2026 | Accrual | +1.5 | 10.5 | ✅ |
| M8 | Nov 2026 | Accrual | +1.5 | 12.0 | ✅ |
| M9 | Dec 2026 | Accrual | +1.5 | 13.5 | ✅ |
| M10 | Jan 2027 | Accrual | +1.5 | 15.0 | ✅ |
| M11 | Feb 2027 | Accrual | +1.5 | 16.5 | ✅ |
| M12 | Mar 2027 | Accrual | +1.5 | **18.0** | ✅ (FY cap hit exactly) |
| — | **01-Apr-2027** | **FY reset** | −(unused) | **0.0** | balance lapses |
| M13 | Apr 2027 | Accrual (new FY) | +1.5 | 1.5 | ✅ |

Whole-FY run-rate for an April joiner = `6.0 + 1.5×8 (Aug–Mar) = 18.0` ✓. A **continuing** (post-probation) employee gets a clean `1.5 × 12 = 18.0` each subsequent FY (no new opening credit).

### 7.4 Cross-FY probation edge (Assumption A6, §18)
If probation straddles 01-Apr (e.g., a Jan-2027 full-time joiner: M1–M3 = Jan–Mar 2027, M4 = Apr 2027), the **opening +6.0 posts at employment month 4 (01-Apr-2027, the new FY)**; the earned-but-unusable probation accrual is thus effectively released in the new FY (the old FY balance was 0 anyway since probation is LWP-only). The `FT_FY_CAP = 18` and the 31-Mar lapse still bind the running balance. **Default = as stated; flagged for founder** (rare at 6-person scale; Admin can pro-rate).

---

## 8. Rule R6 — Intern leave accrual

> **Superseded by the v4 change log (see §20).** The entitlement figures, the accrual
> shape and the probation rule below describe the original policy. §20 is normative.

```ts
probationEndDate(joining, "intern"): LocalDate   // = firstOfMonth(joining) + 2 months
monthlyAccrualScheduleIntern(profile, upTo): LedgerEntry[]
```
Numbered steps:
1. **Employment months 1–2:** no leave usable, **no credit** (PRD §9.6).
2. **Employment month 3 (start):** post `{ entry_type:'opening', amount:+3.0 }`.
3. **Employment month 4 (start):** post `{ entry_type:'accrual', amount:+1.0 }` → balance 4.0.
4. **Employment months 5–6:** **+0** — the `INTERN_TOTAL_CAP = 4.0` is reached.
5. **No carry-forward:** unused leave lapses at **internship completion or termination** (post an `expiry` to zero).
6. Interns have **no advance-leave facility** (`INTERN_ADVANCE_CAP = 0`, A2).

### 8.1 Full table — intern (6-month internship starting 01-Apr-2026)
| Emp. month | Calendar month | Event | Δ | Cumulative | Usable? |
|---|---|---|---|---|---|
| M1 | Apr 2026 | Probation | 0 | 0.0 | ❌ |
| M2 | May 2026 | Probation | 0 | 0.0 | ❌ |
| **M3** | **Jun 2026** | **Opening** | **+3.0** | **3.0** | ✅ |
| M4 | Jul 2026 | Accrual | +1.0 | **4.0 (cap)** | ✅ |
| M5 | Aug 2026 | Cap reached | 0 | 4.0 | ✅ |
| M6 | Sep 2026 | Cap reached | 0 | 4.0 | ✅ |
| — | end of internship | Lapse | −(unused) | 0.0 | — |

---

## 9. Rule R7 — Leave priority ordering & deduction

Order (PRD §9.4.5 / §9.5 / §9.6): **comp-off first → then PL → (optional advance PL) → then LWP.**

### 9.1 Signatures
```ts
availableCompOff(credits: CompOffCredit[], asOf: LocalDate): number
  // count credits where !consumed && expires_on >= asOf

advanceCapOk(currentPl: number, requestedDays: number, type: EmploymentType): boolean
  // requestedDays <= max(currentPl,0) + advanceCap(type)

applyLeaveDeduction(
  days: Days,
  state: { compOff: number; pl: number },
  opts?: { allowAdvance?: boolean; advanceCap?: number }   // default { allowAdvance:false, advanceCap:5 }
): { fromCompOff: Days; fromPl: Days; fromAdvance: Days; fromLwp: Days }
```

### 9.2 Deduction algorithm
1. `wholeDays = floor(days)`, `frac = days − wholeDays` (`frac ∈ {0, 0.5}`). **Comp-off is indivisible (whole-day) — it covers only the whole-day portion.**
2. `fromCompOff = min(wholeDays, state.compOff)`.
3. `rem = days − fromCompOff`.
4. `fromPl = min(rem, max(state.pl, 0))`; `rem −= fromPl`.
5. `fromAdvance = opts.allowAdvance ? min(rem, opts.advanceCap) : 0`; `rem −= fromAdvance`. *(Advance drives PL balance negative → tracked **advance-leave debt**, §12.)*
6. `fromLwp = rem`.
7. Post ledger: consume comp-off credits **FIFO by `expires_on` then `created_at`**; post PL/advance deduction and LWP entries.

> **Why `allowAdvance` is opt-in (resolved ambiguity).** PRD §9.4.5 says once comp-off & PL are exhausted the remainder is **LWP** — yet §9.5 offers a 5-day advance facility. These reconcile only if advance is **explicit**, not automatic: a plain approval defaults `allowAdvance=false` (→ remainder = LWP, matching worked example E-below); a member/Admin may opt into advance for a planned longer leave, gated by `advanceCapOk`. This is normative.

### 9.3 Worked examples
| Scenario | Call | Result |
|---|---|---|
| Comp-off 2, PL 1, take 4 (default) | `applyLeaveDeduction(4, {compOff:2, pl:1})` | `{fromCompOff:2, fromPl:1, fromAdvance:0, fromLwp:1}` → comp-off 0, PL 0, **1 LWP** |
| Comp-off 2, PL 9, take 3 | `applyLeaveDeduction(3, {compOff:2, pl:9})` | `{2, 1, 0, 0}` → PL 8, comp-off 0 |
| Half-day, comp-off 2, PL 3 | `applyLeaveDeduction(0.5, {compOff:2, pl:3})` | `{0, 0.5, 0, 0}` → comp-off **preserved** (indivisible), PL 2.5 |
| PL 1, take 7 with advance | `advanceCapOk(1,7,ft)=false` (7 > 6). If forced `applyLeaveDeduction(7,{compOff:0,pl:1},{allowAdvance:true,advanceCap:5})` | `{0, 1, 5, 1}` → PL 0, **advance-debt 5**, **1 LWP** |
| PL 1, take 6 with advance | `advanceCapOk(1,6,ft)=true`; `applyLeaveDeduction(6,{compOff:0,pl:1},{allowAdvance:true})` | `{0, 1, 5, 0}` → **advance-debt 5.0**, 0 LWP |

> The `01-architecture.md §11.2` phrasing "the 7th day → advance-leave debt of 1 day" is **loose**; the precise decomposition above (advance-debt = requested − currentPL, capped at 5; overflow = LWP) is normative.

---

## 10. Rule R8 — Comp-off full lifecycle

Two entities: `comp_off_requests` (the pre-work ask) and `comp_off_credits` (the earned day). State machine:

```
                approve                 admin credit (post off-day)
 [pending] ───────────────▶ [approved] ─────────────────────────▶ (CREDIT created: available)
     │  ▲ guard: now < start(off_date)                                   │
     │  └ (create)                                                       ├─ consume (used before PL) ─▶ [consumed]
     └── reject ─▶ [rejected]                                            └─ 31-Mar reached ─────────▶ [expired]
```

### 10.1 Transitions & guards
| Step | Transition | Actor | Guard(s) |
|---|---|---|---|
| 1. Request | ∅ → `pending` | Team member | `off_date`'s `resolveDayType ∈ {sunday, fourth_saturday, mandatory_holiday}` **and** `isPreApprovalValid(now, off_date)` — **`now < istStartOfDay(off_date)`** (strictly before the off day begins). **Retro requests are hard-rejected** (`now ≥ start` ⇒ 422). |
| 2. Decide | `pending → approved \| rejected` | Admin/Founder (RM copied) | request is `pending`. No approval ⇒ no comp-off, regardless of hours worked. |
| 3. Work | (no state change) | Team member | On the approved off day, logs tasks via Start/Done. **No hour counter / threshold shown** — the app never gates or pressures. |
| 4. Credit | `approved → CREDIT(available)` | Admin/Founder | request `approved` **and** `now ≥ istEndOfDay(off_date)` (off day has passed). Admin reviews logged tasks and credits **exactly 1 day**. `COMP_OFF_GUIDELINE_MIN (360)` is an **advisory reference only** surfaced to Admin — Admin **may credit even if logged < 6h**. `isCompOffEligibleGuideline(mins)= mins>=360` decorates the UI; it **never auto-credits**. |
| 5. Consume | `available → consumed` | System (on leave approval) | comp-off deducted **before PL** (§9). FIFO by `expires_on`. Sets `consumed_by_leave_request_id`, `consumed_on`. |
| 6. Expire | `available → expired` | System (FY-end job) | `expires_on = fyEndFor(credited_for_date)` (**31 Mar**). Unused ⇒ lapse. **No encashment, no carry-forward.** |

```ts
isPreApprovalValid(now: DateTime, offDate: LocalDate): boolean   // now < istStartOfDay(offDate)
creditExpiry(creditedForDate: LocalDate): LocalDate               // = fyEndFor(creditedForDate)
```
Admin may also **grant a credit manually** with no prior request (PRD §4.4) — this bypasses steps 1–2 but still creates a normal credit (`comp_off_request_id = null`).

### 10.2 Worked example
Member requests comp-off for **Sunday 15-Nov-2026**, submitting on **13-Nov 18:00 IST** (`isPreApprovalValid` = true). Admin approves 14-Nov. Member logs `[120, 150, 140]` min = 410 min (6h 50m) on the 15th. On 16-Nov Admin sees "guideline met (≥6h)" and taps credit → `comp_off_credit { credited_for_date: 2026-11-15, expires_on: 2027-03-31, consumed:false }`. Balance +1. If instead the member had submitted on **15-Nov 09:00** (the off day already begun) → **rejected as retrospective**.

---

## 11. Rule R9 — Mid-month separation clawback

```ts
midMonthClawback(input: {
  lastWorkingDay: LocalDate;      // actual LWD after notice served/waived
  monthCreditDate: LocalDate;     // the 1st-of-month the +1.5 was posted
  usedFromThatCredit: Days;       // PL already taken that was funded by THIS month's credit
}): { clawback: boolean; lwpConverted: Days; creditReversed: Days }
```
Rule (PRD §9.7): the month's `+1.5` presumes active employment **through the 15th**.
1. If `lastWorkingDay.dayOfMonth <= 15` (the **15th itself is "on or before"** ⇒ clawed back): `clawback = true`; `creditReversed = 1.5`; `lwpConverted = usedFromThatCredit` (that leave retro-converts to **LWP**, salary value deducted in **F&F**).
2. If `lastWorkingDay.dayOfMonth > 15`: `clawback = false`; `creditReversed = 0`; `lwpConverted = 0` — **the credit stands, regardless of usage.**
3. Applies **uniformly** to voluntary resignation and involuntary termination. Assessed on the **actual** last working day (after notice period served or waived). Only the **separation month's** credit is in scope — prior months' accrual is untouched.

### 11.2 Worked examples
| LWD | month credit | used | Result |
|---|---|---|---|
| **12-Mar-2027** | 01-Mar-2027 (+1.5) | 1.0 | `{clawback:true, lwpConverted:1.0, creditReversed:1.5}` → +1.5 reversed; the 1 used day → LWP, deducted in F&F. |
| **15-Mar-2027** | 01-Mar-2027 (+1.5) | 0.5 | `{clawback:true, lwpConverted:0.5, creditReversed:1.5}` → the 15th is "on or before" ⇒ clawed back. |
| **16-Mar-2027** | 01-Mar-2027 (+1.5) | 2.0 | `{clawback:false, lwpConverted:0, creditReversed:0}` → credit stands even though 2 days were used. |

---

## 12. Rule R10 — Salary & deductions estimate

> **Superseded by the v4 change log (see §20).** The entitlement figures, the accrual
> shape and the probation rule below describe the original policy. §20 is normative.

> **Transparency layer only** — never a payslip. **No PF / ESI / TDS / statutory math.** Visible only to the employee, their Reporting Manager, and Admins (field-scoped like GPS).

```ts
scheduledWorkingDays(year: number, month: number, holidays: Holiday[]): number
  // count of calendar days d in the month where isWorkingDay(resolveDayType(d)) — company schedule,
  // independent of any individual's leave. Unclaimed optional holidays count as working.

lwpDeduction(salary: INR, lwpDays: Days, workingDaysInMonth: number): INR
  // = (lwpDays / workingDaysInMonth) * salary

netEstimate(salary: INR, lwpDeductionAmt: INR, advanceDebtValue: INR):
  { gross: INR; deductions: INR; net: INR; advanceDebtOutstanding: INR; label: "estimate — not a payslip" }
```
**Composition of LWP days:** `lwpDays = (approved LWP-type leave days) + (late days the Admin/Manager explicitly marked LWP, §4)`. Late days are **never** auto-added; only Admin marking converts them.

**Advance-leave debt** is shown **separately as an outstanding balance** (in days and its ₹ value) and is **not netted** into the monthly figure — it is recovered by future accrual or deducted at F&F (PRD §13).

### 12.1 Worked example
Base **₹30,000/month**, `workingDaysInMonth = 22`, **2 LWP days**, advance-leave debt **1 day**:
- Per-day value = `30000 / 22 = ₹1,363.64`.
- `lwpDeduction(30000, 2, 22) = (2/22)×30000 = ₹2,727.27`.
- `net = 30000 − 2727.27 = ₹27,272.73` (labelled *"estimate — not a payslip"*).
- Advance-leave debt shown as **outstanding 1 day ≈ ₹1,363.64** (not netted here).

**With a late→LWP conversion:** if Admin also marks 1 late day as LWP ⇒ `lwpDays = 3`, `lwpDeduction = (3/22)×30000 = ₹4,090.91`, `net = ₹25,909.09`.

---

## 13. Rule R11 — Leaderboard score

Public, **monthly reset**, three **equal-weighted (1/3)** factors → a single 0–100 score.

### 13.1 Factors
```ts
computeFactorAttendance(onTimeDays: number, eligibleDays: number): number | null
computeFactorTask(withinEstimate: number, completed: number): number | null
computeFactorCampaign(deliveredOnTime: number, closedCampaigns: number): number | null
```
Each = `denominator === 0 ? null : numerator / denominator`.

| Factor | Numerator | Denominator |
|---|---|---|
| **Attendance** | member's days in month with `status ∈ {present, wfh}` **and** `isLate=false` | member's days with `status ∈ {present, wfh, late, half_day, absent}` (i.e., scheduled working days **excluding** approved leave / holiday / weekend). |
| **Task accuracy** | tasks `done` this month with `within_estimate = true` (`actual ≤ estimate`) | tasks `done` this month. |
| **Campaign delivery** | campaigns the member belonged to that **closed** this month with `delivered_at ≤ deadline` | campaigns the member belonged to that **closed** this month (became `delivered` **or** `overdue`). |

> **Denominator resolution (normative, refines PRD §14.1 & the `01` matview):** approved **leave/holiday/weekend days are excluded** from the attendance denominator (a member on approved leave is not penalised — consistent with the app's non-punitive framing), but **`absent` days ARE included** (an unexcused absence must reduce the ratio). The simplified SQL in `01-architecture.md §4.7` that omitted `absent` is **superseded here** — the matview must include `absent` in the denominator. Confirm with founder (A7, §18).

### 13.2 Score
```ts
computeLeaderboardScore(f: { attendance: number|null; task: number|null; campaign: number|null }):
  { score: number; hasData: boolean }
```
1. `present = [f.attendance, f.task, f.campaign].filter(x => x !== null)`.
2. If `present.length === 0` ⇒ `{ score: 0, hasData: false }`.
3. Else `score = round(mean(present) × 100)` (half-up, clamp 0–100), `hasData = true`.

**Null factors are dropped and the mean re-weights over the survivors** (a new joiner is not dragged to 0 by absent data).

### 13.3 Rank, movement & streak
```ts
rankAndMovement(current: Score[], prior: Snapshot[]): Ranked[]
onTimeStreakMonths(memberMonthlyHistory: { yearMonth; attendanceFactor }[]): number
```
- **Rank:** sort by `score` desc; ties share a rank (stable by name). Persist to `leaderboard_snapshots(user_id, year_month, score, rank, factors...)` at month close.
- **Movement** vs prior month: `up` (rank number decreased), `down` (increased), `same`, or `new` (no prior snapshot).
- **On-time streak** = count of **consecutive most-recent months (ending at the latest closed month)** with a **perfect** attendance factor (`attendanceFactor === 1.0` and `eligibleDays > 0`). Any month with a late/absent breaks it. Rendered as e.g. *"4 months on-time streak 🔥"* (PRD §14.2). Fires the `STREAK milestone` meme on increment.

### 13.4 Worked examples
**Canonical (24 working days):**
- Attendance `22 on-time / 24 eligible = 0.9167` (the 2 non-on-time were lates).
- Tasks `18 within / 20 done = 0.9000`.
- Campaigns `2 on-time / 3 closed = 0.6667`.
- `computeLeaderboardScore` = `round(mean(0.9167, 0.9000, 0.6667) × 100)` = `round(82.78)` = **83 / 100**.

**Divide-by-zero (new joiner):** 10/10 on-time, **no** completed tasks, **no** closed campaigns:
- `f = { attendance:1.0, task:null, campaign:null }` → `score = round(1.0 × 100) = 100`, `hasData = false`.
- UI shows "building your streak" rather than a hollow #1 (PRD §14.2 tenure note; tenure adjustment deferred).

---

## 14. Rule R12 — Campaign deadline state machine

The colour/state is **derived at read time** — never stored stale.
```ts
type DeadlineState = 'on_track' | 'coming_up' | 'due_today' | 'overdue' | 'delivered';
deadlineState(deadline: LocalDate, today: LocalDate, status: CampaignStatus): DeadlineState
```
1. If `status === 'delivered'` ⇒ `delivered` (short-circuit).
2. `d = daysBetween(today, deadline)` = `deadline − today` in whole IST days.
3. `d > 5` ⇒ `on_track` (teal, `#00D4AA`).
4. `1 ≤ d ≤ 5` ⇒ `coming_up` (amber — derived warm token, `03-ux §2.2`).
5. `d === 0` ⇒ `due_today` (hot pink ≈ Hot Coral `#FF6B6B`).
6. `d < 0` ⇒ `overdue` (hot pink + **notify Campaign Lead and members' Reporting Manager(s)**).

**Boundary decision (normative):** exactly **5 days out ⇒ `coming_up`** (PRD's "5+ days = on track" is superseded by the task spec "≤5 ⇒ coming up"). So `d=6 → on_track`, `d=5 → coming_up`.

**Overdue side-effects (service layer, idempotent):** when a campaign first satisfies `d < 0 AND status != delivered`, set persisted `status = 'overdue'`, create `notification_type = 'campaign_overdue'` for the Lead + each member's RM, and set `overdue_notified = true` so it never re-fires. Delivering later (`delivered_at`) freezes the state to `delivered`.

| `today` | `deadline` | `status` | `d` | State |
|---|---|---|---|---|
| 2026-11-01 | 2026-11-10 | in_progress | +9 | `on_track` |
| 2026-11-05 | 2026-11-10 | in_progress | +5 | `coming_up` |
| 2026-11-09 | 2026-11-10 | in_progress | +1 | `coming_up` |
| 2026-11-10 | 2026-11-10 | in_progress | 0 | `due_today` |
| 2026-11-11 | 2026-11-10 | in_progress | −1 | `overdue` (notify) |
| 2026-11-11 | 2026-11-10 | delivered | — | `delivered` |

---

## 15. Rule R13 — Optional holidays & birthday entitlement

- **Optional holidays:** up to **`OPTIONAL_HOLIDAY_CAP_PER_FY = 2`** per FY, each claimed on a date whose `resolveDayType = optional_holiday` (from the seeded/admin calendar), via the **normal leave request flow** tagged `leave_type = optional_holiday`.
- **Birthday:** **1 additional** entitlement per FY (`BIRTHDAY_ENTITLEMENT_PER_FY`), claimed on the member's DOB (`resolveDayType = birthday`). It does **not** count toward the 2 optional holidays. Total possible = **3 optional-type days/FY**.
- **PL impact:** claiming an optional holiday or birthday **deducts nothing from PL/comp-off** — it is an entitlement, not paid leave. `leaveDaysCharged = 0` against balances; it only decrements the optional/birthday **allowance counter** for the FY.
- **Allowance guard:**
```ts
canClaimOptionalHoliday(fyClaimsUsed: number): boolean   // fyClaimsUsed < 2
canClaimBirthday(fyBirthdayUsed: number, day, dob): boolean // fyBirthdayUsed < 1 && day matches dob
```
- **Coincidence rule:** if the optional/birthday date is already unconditionally off (`mandatory_holiday`, `sunday`, `fourth_saturday`), the day is off anyway and the claim is **not allowed / consumes no allowance** (§3.2, §17-E2/E7). If it lands on a `second_saturday` (WFH working day), it **is** claimable as a full day off (consumes allowance).

---

## 16. Attendance-status ↔ leaderboard/salary cross-reference

| `attendance_status` | Counts in leaderboard **denominator**? | On-time **numerator**? | Counts as `working` for salary `scheduledWorkingDays`? |
|---|---|---|---|
| `present` (on-time) | yes | yes | yes |
| `late` | yes | no | yes |
| `wfh` (confirmed) | yes | yes | yes |
| `half_day` | yes | no | yes (a working day; 0.5 leave charged separately) |
| `absent` | **yes** | no | yes |
| `on_leave` | no | no | yes (scheduled working day; the leave itself is charged) |
| `holiday` (mandatory) | no | no | **no** |
| `weekend_off` (Sun / 4th Sat) | no | no | **no** |

> `scheduledWorkingDays` is a **company schedule** count (same for everyone); the leaderboard denominator is **per-member** (excludes that member's approved leave). Keep the two concepts distinct in code (`scheduledWorkingDays` vs `attendanceEligibleDays`).

---

## 17. Edge-case register (resolved)

| # | Edge case | Resolved rule |
|---|---|---|
| E1 | **Joiner mid-month** (e.g., 20-Apr full-time) | Joining calendar month = employment month 1 (A3). Opening +6 at start of month 4 (Jul). Admin may pro-rate via balance override. |
| E2 | **Birthday on a Sunday / 4th Sat / mandatory holiday** | Day is off anyway; **birthday entitlement is NOT consumed and does NOT shift** to another day by default (A8 — founder may allow Admin to grant an alternate). |
| E3 | **Birthday on a 2nd Saturday (WFH)** | `resolveDayType = birthday`; it is a working (WFH) day, so the birthday **is claimable** as a full day off (consumes the 1 birthday allowance). Verified real case: DOB 12-Sep, 12-Sep-2026 = 2nd Saturday. |
| E4 | **Comp-off requested after the off day started** | Hard-rejected (`isPreApprovalValid=false`). No retrospective comp-off, ever. |
| E5 | **Off-day worked but no pre-approval** | Tasks still log fine (always allowed), but **no comp-off** is creditable — approval is a precondition (PRD §8.1/§9.4.2). |
| E6 | **Off-day pre-approved, worked < 6h** | Admin **may still credit** 1 day at discretion — 6h is a guideline, not a gate (PRD §9.4.4). |
| E7 | **Optional holiday coincides with an already-off day** | Not claimable / consumes no allowance (§15 coincidence rule). |
| E8 | **Leave spanning a month boundary** (e.g., 29-Oct → 03-Nov) | Deduction applied to the total day count via `applyLeaveDeduction`; but for **clawback** and **accrual**, each day is attributed to its own calendar month. Working-day proration in salary uses each month's own `scheduledWorkingDays`. |
| E9 | **Leave spanning an FY boundary** (28-Mar → 04-Apr) | Split at 01-Apr: days ≤ 31-Mar draw on the **old FY** balance (which lapses 31-Mar), days ≥ 01-Apr draw on the **new FY**. Comp-off from the old FY cannot fund new-FY days (expired). |
| E10 | **5th Saturday** | `office` (working). Only 2nd (WFH) and 4th (off) are special. |
| E11 | **1st / 3rd Saturday** | `office` (working) — 6-day week (A1). |
| E12 | **Half-day on a day the member arrived late** | Half-day qualification depends **only** on `productiveMinutes ≥ 240`, not on lateness. If it qualifies ⇒ `half_day` (and the day is *not separately* a `late` status; half_day wins in `deriveStatus` step 4a). Lateness is not re-penalised on a half-day. |
| E13 | **Half-day with < 4h logged** | Fails to qualify ⇒ charged as a **full-day** leave (`on_leave`, 1.0), per §5. |
| E14 | **Check-in exactly 10:45:00.000** | **On-time** (grace inclusive). 10:45:00.001+ ⇒ late. |
| E15 | **Two tasks active at once** | Overlap is double-counted in focus time (A5). Recommend enforcing single active task per user. |
| E16 | **Task started before midnight, finished next day** | Full duration counts toward the **start day** (`work_date = toIstDate(startedAt)`). |
| E17 | **New joiner with zero tasks & zero closed campaigns on leaderboard** | Null factors dropped; score = mean of survivors; `hasData=false` flags the UI (§13.2). If *all* factors null ⇒ score 0, `hasData=false`. |
| E18 | **Member on approved leave the whole month** | Attendance denominator = 0 ⇒ `f_attendance = null`; excluded from the mean (not a zero). |
| E19 | **Advance leave requested beyond cap** | `advanceCapOk=false` ⇒ blocked at submission. Admin may still force via manual balance edit (PRD §4.3), which records advance-leave debt. |
| E20 | **Comp-off used for a half-day** | Comp-off is indivisible; the whole-day portion (=0) is 0, so a lone half-day draws on PL, not comp-off (§9.2). Comp-off is preserved for full days. |
| E21 | **Separation LWD after notice waiver** | Clawback assessed on the **actual** LWD (post-waiver), per §11. |
| E22 | **Mandatory holiday on a 2nd/4th Saturday** | `mandatory_holiday` wins (precedence step 1) — off, no WFH. |
| E23 | **Admin overrides attendance/leave/balance** | Overrides are **authoritative and immediate** (PRD §4, no audit trail). Domain functions still define the *default* the override replaces. |
| E24 | **DST / clock change** | None — IST has no DST. All boundaries are fixed +05:30. |

---

## 18. Assumptions & open questions for the Founder (please confirm)

Consolidated; cross-referenced to `01-architecture.md §13` where overlapping.

| # | Assumption (current default) | Confirm? |
|---|---|---|
| **A1** | **6-day work week** — 1st/3rd/5th Saturdays are normal office days; 2nd Sat WFH; 4th Sat + Sundays off. Drives every working-day count. (= `01`-Q1) | ⬜ |
| **A2** | Interns get **no advance-leave facility** (advance cap 0). | ⬜ |
| **A3** | A mid-month joiner's **joining month counts as employment month 1** (no day-of-month pro-rata); Admin pro-rates via override if desired. | ⬜ |
| **A4** | "**Productive hours**" for half-day qualification = the day's **focus minutes** (logged task Start→Done), not clocked check-in→check-out. | ⬜ |
| **A5** | At most **one active task per user** should be enforced (else focus time double-counts overlaps). | ⬜ |
| **A6** | **Cross-FY probation:** opening +6 posts at employment month 4 even if that lands in a new FY; FY cap + 31-Mar lapse still bind. | ⬜ |
| **A7** | Leaderboard attendance denominator **includes `absent`** but **excludes approved leave/holiday/weekend** (refines the `01` matview, which must add `absent`). | ⬜ |
| **A8** | Birthday/optional holiday landing on an already-off day is **not shifted** and consumes **no allowance**. | ⬜ |
| **A9** | Optional-holiday & birthday claims **deduct nothing from PL/comp-off** (pure entitlement); only decrement the FY allowance counter. (= `01`-Q8) | ⬜ |
| **A10** | Campaign "**closed this month**" = became `delivered` or `overdue` within the IST month (drives leaderboard factor 3). (= `01`-Q10) | ⬜ |
| **A11** | Grace boundary **≤ 10:45:00.000 = on-time** (inclusive). (= `01`-Q7) | ⬜ |
| **A12** | WFH days have **no lateness rule** — a confirmed WFH counts as on-time regardless of confirm time. | ⬜ |
| **A13** | Late→LWP conversion is **never automatic** — only when Admin/Manager explicitly marks it (PRD §9.2). | ⬜ |

---

### Change-control note
This file is normative. If implementation reveals a rule that cannot hold, **change this document first** (with the founder's sign-off on any policy-affecting item, marked A#), then the code and tests. Tests import the worked examples in §3–§14 verbatim as fixtures.
```

---

## 20. v4 change log — leave, tasks and salary (normative)

This section supersedes §7, §8 and §12 where they disagree, and adds the notice-period
and task-scheduling rules. Everything here is implemented in `server/src/domain/` and
covered by `server/tests/domain/` plus `server/tests/api/v4Leave.test.ts`.

### 20.1 Entitlements

| | Privilege (`pl`) | Sick (`sick`) | Pool |
|---|---|---|---|
| Full-time | 11 / FY | 7 / FY | two separate pools, both lapse 31 Mar |
| Intern | 4 lifetime | — | **one shared pool** of 4 across both types |

Bereavement (≤3 days) and Optional Holiday (2/FY) are paid but are not accrued balances.

### 20.2 Accrual

- **Full-time — prorata.** After `m` months of the financial year the member has earned
  `floorToHalf(annual × m ÷ 12)`, capped at the annual figure: 0.5 after one month,
  5.5 Privilege / 3.5 Sick at six, exactly 11 / 7 at twelve. Rounding **down** to the
  half day means leave is never credited before it is earned. Unused balance lapses on
  1 April; a mid-FY joiner earns only their share of that year.
- **Intern — +1 a month** from the joining month, capped at 4. Three by the start of
  month 3, the fourth at the start of month 4. No FY reset.
- Leave is **earned** from month 1 in both cases. Probation restricts *using* it.

### 20.3 Probation

Full-time 3 months, intern 2, counted in whole months from the joining month. A paid
leave (Privilege, Sick, Bereavement, Optional Holiday) that **starts on or before** the
probation end date is granted as Leave Without Pay.

### 20.4 Notice period

- While serving notice, **every** leave raised is Leave Without Pay.
- Notice starting **on or before the 15th** → that month's Privilege + Sick credit is
  reversed (`clawback`), because the member will not complete more than 15 days that
  month. After the 15th the credit stands. The reversal is idempotent.
- Interns serve 15 days; full-time notice length is Admin-set per person.

### 20.5 Request timing — what makes a leave unpaid

Evaluated in this order; the first match converts the request to `lwp` and returns the
matching notice to the client, which shows it as a pop-up before the member leaves the form.

| # | Condition | Outcome |
|---|---|---|
| 1 | Serving notice on the leave's start date | LWP |
| 2 | Paid leave starting on or before probation end | LWP |
| 3 | Half day raised < 24h before its **leaving time** (default 2 PM) | LWP |
| 4 | Sick leave raised after 9:30 AM | LWP |
| 5 | Privilege leave (not a half day) starting < 5 calendar days out | LWP |
| 6 | Optional holiday starting < 5 calendar days out | LWP |

A half day is deliberately exempt from rule 5 — it answers to rule 3 only. Work From
Home and an explicit Leave Without Pay request skip the whole ladder.

**Hard rejections** (400, the request is never created): WFH inside 24 hours;
bereavement over 3 days; sick leave for any date other than today; sick leave filed
before 5:30 AM (office start 10:30 − 5h); an optional holiday that is not a listed
optional holiday, or beyond the 2/FY cap.

### 20.6 Deduction

Comp-off → the leave's own pool → advance (full-time, 5 days, opt-in) → LWP. Sick leave
is a same-day event, so it draws on the Sick pool and then LWP: neither comp-off nor the
advance facility applies to it. An intern's sick leave draws on the shared Privilege pool.

Admin may approve a request **as a different leave type**, which is how a leave the
policy pushed to LWP is granted as paid leave anyway.

### 20.7 Salary

A fixed **30-day month**: per-day rate = monthly salary ÷ 30. Days not worked are
deducted at that rate and the rest is paid. `workingDaysInMonth` remains for the
leaderboard and for display, not for pay.

### 20.8 Task scheduling

- A member's planned windows on one date **may not overlap**. Windows are half-open, so
  a task may start exactly when the previous one ends (10–11 and 11–12 are both fine).
- Order is manual (`sortOrder`) and never changes on its own — starting or completing a
  task leaves it where it is.
- A task planned for an earlier day that is not done is **carried over**: it stays on
  today's list, flagged, until it is closed out, and keeps the day it was committed to
  in the member's history.
