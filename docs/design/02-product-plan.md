# 02 — Product Plan

**Product:** Hustling Collaborators — Internal HRM + Task + Campaign Management PWA
**Owner of this doc:** Senior Product Manager
**Source of truth:** `/home/user/hustling-collaborators/docs/PRD.md` (v6.0). Where this plan and the PRD ever disagree, the PRD wins — raise a change request instead of diverging silently.
**Context:** ~6-person Indian marketing/influencer agency. Currency ₹, timezone **Asia/Kolkata (IST, UTC+05:30, no DST)**, financial year **1 Apr – 31 Mar**, Hinglish meme copy. Free-tier infra (React/TS PWA, Node/TS, Postgres).

> **How to read this document.** Sections 1–2 define *who* and *what they may do*. Section 3 is the implementation + QA backlog (epics → stories → Given/When/Then). Sections 4–5 define *what ships when*. Section 6 defines *how we know it worked*. Section 7 lists every ambiguity the founder must resolve **before** build starts on the affected module — these are blocking for the modules they touch. Appendix A holds worked numeric examples that test authors should turn into fixtures verbatim.

---

## 1. Personas

Five personas. Note the distinction that drives the whole permission model: **Admin, Reporting Manager, and Campaign Lead are *roles* (permission overlays); Intern is an *employment type* (a Team Member whose profile field `employment_type = Intern`).** An Intern is therefore *not* a separate column in the permission matrix — they inherit Team Member permissions and differ only in leave-accrual and probation math (PRD §9.6).

### 1.1 Founder / Admin — "Ravi" (and designated Admin "Anshuman")
| Attribute | Detail |
|---|---|
| Role | Admin (Founder always; Anshuman set as Admin from day one per PRD §3 note) |
| Context | Runs the agency, wears every hat, low tolerance for admin overhead and monthly cost |
| Goals | (a) See honest actual-vs-estimate time on every task; (b) replace WhatsApp attendance/leave with one system; (c) full edit/delete control over any record without a developer; (d) grant/revoke Admin via a toggle; (e) keep running cost ₹0–500/mo |
| Pain points | Task time invisible (4h task silently eats a day); attendance/leave scattered across WhatsApp; leave-balance math done by hand; campaigns have no clear owner or overdue signal |
| Key screens | Admin console, all-employee attendance/leave/task views, campaign board, salary view (all), holiday calendar editor |
| "Good" looks like | Opens app once a day, sees who's late / what's overdue / what needs approving, resolves it in taps, never touches a spreadsheet |

### 1.2 Reporting Manager — "Neha"
| Attribute | Detail |
|---|---|
| Role | Reporting Manager (assigned *per team member* on each profile) |
| Context | Coordinates a subset of the team; coaches on pace and punctuality |
| Goals | Approve/reject reportee leave fast; see reportee tasks, attendance, focus-time and campaign flags in one structured view; get notified when a reportee's campaign goes overdue or a reportee files comp-off |
| Pain points | Chasing status over WhatsApp; no single view of who is late this month; approvals get lost in chat |
| Key screens | Reportee roster, per-reportee attendance/leave/task/focus view (numbers visible for coaching per PRD §7.3), leave-approval queue |
| "Good" looks like | Clears the approval queue daily; spots a slipping reportee early from the structured (not punitive) view |

### 1.3 Team Member — "Arjun" (full-time)
| Attribute | Detail |
|---|---|
| Role | Team Member (base role everyone has for their own data) |
| Context | Executes tasks across campaigns; full-time, past probation |
| Goals | Log tasks and honest Start/Done time without a stopwatch breathing down his neck; know his leave balance without asking; apply for leave in-app; climb the leaderboard; feel like the app is *his* tool, not surveillance (PRD §7.1) |
| Pain points | Feels watched by timers; never sure of leave balance; tasks quietly overrun; wants credit for punctuality and delivery |
| Key screens | Home dashboard, Tasks, Campaigns (his own), Attendance calendar, Profile (own leave arc + salary + ledger), Leaderboard |
| "Good" looks like | Taps *On it 🔥* / *Nailed it ✅*, checks in at 10:30, sees a meme toast, watches his rank and streak grow |

### 1.4 Campaign Lead — "Priya"
| Attribute | Detail |
|---|---|
| Role | Campaign Lead — **contextual overlay** on Team Member, scoped to *one specific campaign only* (PRD §3, §11.3). Not a standing company-wide role. |
| Context | A Team Member who additionally owns delivery of one campaign |
| Goals | See task status of every member on *her* campaign to spot blockers and flow; know the moment the campaign trends toward overdue; keep the client-branded card green |
| Pain points | No visibility into teammates' progress on her campaign; deadline surprises; no lever to coordinate without pinging a manager |
| Key screens | Campaign detail (member task-status roll-up, no timers per §11.3), overdue notifications for her campaign |
| "Good" looks like | Reads the campaign card, sees one member stalled, nudges them, delivers before the countdown flips coral |

### 1.5 Intern — "Sana"
| Attribute | Detail |
|---|---|
| Role | Team Member with `employment_type = Intern` |
| Context | 6-month internship; first 2 months are probation (no leave usable); up to 4 PL total (PRD §9.6) |
| Goals | Understand exactly what she can/can't do during probation; feel included from day one; celebrate small wins even while ranked low |
| Pain points | Unclear probation leave rules; risk of feeling permanently bottom-of-board; unsure whether her birthday/optional-holiday entitlements apply |
| Key screens | Home, Tasks, own Profile (shows probation status + accrual countdown), Leaderboard (personal-best markers per §14.2) |
| "Good" looks like | Sees a clear "leave unlocks after month 2" message, earns a personal-best badge in week 3, never confused about balance |

---

## 2. Roles × Permissions Matrix

**Columns are the 4 permission roles** (Admin, Reporting Manager, Team Member, Campaign Lead), derived precisely from PRD §3 and §4. Intern is not a column (see §1). Every cell is **fully evaluated** so a column can be read standalone — the Campaign Lead column already includes the Team Member baseline plus the campaign elevation.

**Legend**
| Symbol | Meaning |
|---|---|
| **A** | Allowed — across *all* records / all employees |
| **O** | Allowed — **own** records only |
| **R** | Allowed — **direct reportees** only (this person is their assigned Reporting Manager) |
| **C** | Allowed — **within the assigned campaign** only |
| **N** | No action rights, but **receives a notification / is copied** on the event |
| **—** | Denied |

> Precedence note: a person is often several roles at once (e.g. an Admin who is also a Reporting Manager and a Campaign Lead). Effective permission = the **most permissive** cell across the roles they hold. Admin is a superset of everything below it.

### 2.1 Profiles & People
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| View own profile | A | O | O | O |
| View another employee's basic profile (name, photo, designation, DOB) | A | A | A | A |
| View salary/deductions | A | R | O | O |
| Edit salary amount | A | — | — | — |
| Edit core profile fields (employment type, joining date, RM, designation, name) | A | — | — | — |
| Edit own profile photo *(assumption — see OQ‑5)* | A | O | O | O |
| Delete an employee profile (with "type name to confirm" step, PRD §4.5) | A | — | — | — |
| Grant / revoke Admin status via toggle (PRD §3) | A | — | — | — |

### 2.2 Tasks
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| View own tasks | A | O | O | O |
| View another employee's tasks | A | R | — | C¹ |
| Create own task (incl. on off days, PRD §8.1) | A | O | O | O |
| Edit own task (title, campaign tag, estimate) *before completion* | A | O | O | O |
| Tap On it 🔥 / Nailed it ✅ on own task | A | O | O | O |
| Create a task **on behalf of** another member (PRD §4.1) | A | — | — | — |
| Edit **any** member's task (title, tag, estimate, status) | A | — | — | — |
| Mark **any** member's task Done + manually enter completion time | A | — | — | — |
| Delete own task *(assumption — see OQ‑4)* | A | O | O | O |
| Delete **any** task, permanently (PRD §4.1) | A | — | — | — |

¹ Campaign Lead sees **task status** of all members within their campaign (flow/blockers), **not timers** (PRD §11.3). This is status-level read, not full task edit.

### 2.3 Campaigns
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| View campaigns I belong to | A | O | O | O |
| View all campaigns | A | R² | — | C |
| Create campaign / set members, Lead, deadline *(assumption — see OQ‑1)* | A | — | — | — |
| Edit campaign (deadline, members, Lead) | A | — | — | — |
| See all members' task status within a campaign | A | — | — | C |
| Mark campaign **delivered** / change status *(assumption — see OQ‑2)* | A | — | — | C |
| Delete campaign | A | — | — | — |
| Receive overdue notification for a campaign (PRD §11.2) | A³ | R | — | C |

² Reportee-scoped: an RM sees campaigns their reportees belong to for flag visibility (PRD §3 "campaign flags for their own reportees").
³ Admin visibility is total; overdue in-app notification is explicitly routed to **Lead and Manager** per §11.2 (Admin sees via the board and Admin console).

### 2.4 Attendance & Calendar Remarks
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| GPS check-in / check-out (own) | A | O | O | O |
| WFH toggle (own, on WFH days) | A | O | O | O |
| View own attendance calendar | A | O | O | O |
| View another employee's attendance | A | R | — | — |
| View late-arrival count | A | R | O | O |
| Override any day's attendance status (present/absent/WFH/half-day/late) (PRD §4.2) | A | — | — | — |
| Add / edit / delete calendar remark (PRD §4.2) | A | — | — | — |
| View remarks on own calendar | A | O | O | O |
| Mark any date as a company holiday (PRD §4.2) | A | — | — | — |

### 2.5 Leave
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| Submit own leave request (any type) (PRD §9.8) | A | O | O | O |
| View own leave balance & history ledger | A | O | O | O |
| View reportee leave balance & requests | A | R | — | — |
| Approve / reject a leave request | A | R | — | — |
| Manually add leave of any type/date range (PRD §4.3) | A | — | — | — |
| Edit (override) a leave balance | A | — | — | — |
| Delete a leave record, permanently | A | — | — | — |

### 2.6 Comp-off
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| Submit pre-approval comp-off work request (before off day) (PRD §9.4) | A | O | O | O |
| View own comp-off balance | A | O | O | O |
| Receive comp-off request notification | A | N⁴ | — | — |
| **Approve / reject** comp-off request | A | —⁴ | — | — |
| Grant comp-off manually (no request) (PRD §4.4) | A | — | — | — |
| Credit comp-off after reviewing off-day task logs (PRD §9.4 step 4) | A | — | — | — |
| Adjust comp-off balance | A | — | — | — |
| Delete a comp-off record | A | — | — | — |

⁴ Per PRD §9.4: comp-off requests route to **Admin/Founder for approval**, with the **Reporting Manager copied** (notified only). This is a deliberate asymmetry vs ordinary leave (which the RM *can* approve). Confirm in OQ‑9.

### 2.7 Focus Time
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| View own Focus Time (self-insight framing, PRD §12.2) | A | O | O | O |
| View reportee Focus Time (structured, numbers visible, §12.3) | A | R | — | — |
| View any employee's Focus Time | A | — | — | — |

### 2.8 Leaderboard
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| View public monthly leaderboard | A | A | A | A |
| Edit / recompute score | System-only | — | — | — |

Leaderboard scores are **system-calculated** (PRD §14.1) — no role can hand-edit a score. Admin influence is indirect (via editing the underlying attendance/task/campaign records).

### 2.9 Salary & Deductions View
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| View salary/deductions estimate (PRD §5, §13) | A | R | O | O |
| Edit base salary | A | — | — | — |

### 2.10 Holiday Calendar
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| View seeded FY 26–27 holiday calendar | A | A | A | A |
| Add / edit / remove a holiday (refreshes for all immediately, §10 note) | A | — | — | — |

### 2.11 Admin Console
| Capability | Admin | Reporting Mgr | Team Member | Campaign Lead |
|---|:--:|:--:|:--:|:--:|
| Access Admin console | A | — | — | — |
| All destructive edit/delete actions of §4.1–4.5 | A | — | — | — |

---

## 3. Epics → User Stories

Format: each story has an ID, the `As a / I want / so that` statement, and **acceptance criteria in Given/When/Then**. Stories tagged **[MVP]** ship in v1; **[v2]** are deferred (see §4). Numeric behaviour references Appendix A fixtures.

### EPIC A — Auth & Onboarding

**A1 [MVP]** — *As a* Team Member, *I want* to log in securely on my phone, *so that* only my agency can see my data.
- **Given** a seeded account with email+password, **When** I enter valid credentials, **Then** I land on the Home dashboard and a session token is issued.
- **Given** invalid credentials, **When** I submit, **Then** I see a gentle, non-punitive error (per §6.7) and no token is issued.
- **Given** an expired/absent session, **When** I open any authenticated route, **Then** I am redirected to the login/splash screen (logo centred on `#0F0E17`, PRD §6.8).

**A2 [MVP]** — *As an* Admin, *I want* to create employee accounts and set the initial role/employment type, *so that* the team can onboard without a developer.
- **Given** I am Admin, **When** I create a profile with name, employee ID, employment type, joining date, DOB, RM, designation and salary, **Then** the account exists and leave accrual begins per the joining date (Appendix A.1/A.2).
- **Given** I mark Anshuman as Admin at setup, **When** he logs in, **Then** he has full Admin capabilities (PRD §3 note).

**A3 [MVP]** — *As an* Admin, *I want* a toggle to grant/revoke Admin for any employee, *so that* control needs no code change (PRD §3).
- **Given** employee X is not Admin, **When** I toggle Admin on for X, **Then** X immediately gains Admin capabilities on next action/refresh and the change persists.
- **Given** I revoke my own Admin while another Admin exists, **When** confirmed, **Then** revoke succeeds; **but Given** I am the last remaining Admin, **When** I try to revoke myself, **Then** the system blocks it with a gentle message (safeguard — see OQ‑21).

**A4 [MVP]** — *As a* returning user, *I want* the app to remember me between sessions, *so that* I don't re-login daily.
- **Given** I logged in and did not log out, **When** I reopen the PWA within the session window, **Then** I resume without re-entering credentials.

### EPIC B — Profiles

**B1 [MVP]** — *As a* Team Member, *I want* to view my profile (joining date, DOB, designation, RM, leave arc, salary, ledger), *so that* I have one source of truth about me.
- **Given** I open Profile, **Then** I see leave balance as overlapping arcs (comp-off purple, PL teal — §6.4), salary/deductions card (self-visible), and the full leave-remarks ledger.

**B2 [MVP]** — *As an* Admin, *I want* to edit any profile field, *so that* corrections don't need a developer (PRD §4.5).
- **Given** I edit joining date, **When** saved, **Then** probation countdown and accrual recompute from the new date (Appendix A.1).
- **Given** I change an employee's `employment_type` Intern→Full-time, **When** saved, **Then** accrual rules switch to §9.5 going forward (recompute rule — confirm OQ‑11).

**B3 [MVP]** — *As an* Admin, *I want* to delete an employee profile with a confirmation gate, *so that* destructive deletes aren't accidental (PRD §4.5).
- **Given** I press Delete on employee X, **When** the confirm modal appears, **Then** I must type X's exact name; a mismatch keeps Delete disabled.
- **Given** I type the exact name and confirm, **Then** the profile and all associated data are permanently removed with no recovery (PRD §4.5 note — no audit trail).

**B4 [MVP]** — *As a* Reporting Manager, *I want* to view my reportees' salary/deductions, *so that* I can contextualise coaching (PRD §5).
- **Given** employee Y reports to me, **When** I open Y's profile, **Then** I can see Y's salary/deductions; **Given** Z does not report to me, **Then** salary is hidden.

**B5 [MVP]** — *As a* Team Member, *I want* a team birthday view, *so that* I can see upcoming birthdays (PRD §5).
- **Given** the team calendar view, **Then** upcoming birthdays are listed by date across all employees (names/photos only, no salary).

### EPIC C — Tasks

**C1 [MVP]** — *As a* Team Member, *I want* to create a task with a title, campaign tag, and self-set estimate, *so that* I can plan my day (PRD §8.1).
- **Given** I create a task, **When** I pick a campaign, **Then** the picker only lists campaigns I belong to.
- **Given** it is a Sunday / mandatory holiday / any off day, **When** I create a task, **Then** creation succeeds (task logging always available, §8.1) and no comp-off approval is required to *log* work.

**C2 [MVP]** — *As a* Team Member, *I want* to tap "On it 🔥" and "Nailed it ✅", *so that* my honest actual time is captured without a visible timer (PRD §8.2, §7.2).
- **Given** a task, **When** I tap On it, **Then** the card shows a soft glow (no clock/countdown, §6.7) and `start_ts` is recorded silently in IST.
- **Given** an active task, **When** I tap Nailed it, **Then** `end_ts` is recorded and `actual = end − start`; **only** the Start→Done window counts (gap between creation and Start is excluded, §8.2 note).
- **Given** actual ≤ estimate, **Then** a warm positive cue + an "on time" meme toast fires; **Given** actual > estimate, **Then** the card completes quietly with **no negative flag** shown to the member (a late-completion meme may still fire in the friendly bank).

**C3 [MVP]** — *As a* Campaign Lead, *I want* to see task status of all members on my campaign, *so that* I can spot blockers (PRD §11.3).
- **Given** I lead campaign K, **When** I open K, **Then** I see each member's task **status** (not started / active / done) — no timers, no cross-campaign data.

**C4 [MVP]** — *As an* Admin, *I want* to add/edit/mark-done/delete any member's task with manual completion time, *so that* I can fix omissions (PRD §4.1).
- **Given** a member forgot to tap Done, **When** I mark it Done and enter a completion time, **Then** actual recomputes from the stored start and my manual end.
- **Given** I delete a task, **Then** it is permanently removed (no recovery, no audit trail).

**C5 [MVP]** — *As a* Team Member, *I want* an empty-task-list state that invites me in, *so that* it feels like a game not a scold (PRD §7.3).
- **Given** no tasks this morning, **Then** I see an "EMPTY task list" meme toast/invitation, not "No tasks logged."

### EPIC D — Campaigns

**D1 [MVP]** — *As an* Admin, *I want* to create a campaign with name, members, one Lead, and a deadline, *so that* every campaign has clear ownership (PRD §11.1). *(Creator authority = OQ‑1.)*
- **Given** I create campaign "Sugar Cosmetics" with members + one Lead + deadline, **Then** it appears as a client-branded card using one of the 4 campaign colours (§6.4).

**D2 [MVP]** — *As a* Team Member, *I want* the campaign card to change character as the deadline nears, *so that* urgency is obvious without a countdown clock (PRD §11.2).
- **Given** deadline ≥ 5 days away → teal "On track"; **Given** within 5 days → amber "Coming up"; **Given** deadline day → hot pink "Due today"; **Given** past deadline → hot pink + "This one needs your attention 🔴" + in-app notification to **Lead and Manager**.
- All thresholds evaluated at IST day boundaries.

**D3 [MVP]** — *As a* Campaign Lead / Reporting Manager, *I want* an in-app overdue notification, *so that* I act immediately (PRD §11.2, §3).
- **Given** campaign K crosses its deadline at IST midnight, **When** the day flips, **Then** the Lead and the members' Managers receive an in-app overdue notification (once, not repeated per §6.7 anti-spam intent).

**D4 [MVP]** — *As a* Campaign Lead, *I want* to mark my campaign delivered, *so that* delivery feeds the leaderboard (PRD §10.4, §14.1). *(Authority = OQ‑2.)*
- **Given** K is delivered on/before deadline, **When** marked delivered, **Then** a "Campaign DELIVERED on time" meme fires and K counts as an on-time delivery in that month's leaderboard for its members.

### EPIC E — Attendance & WFH

**E1 [MVP]** — *As a* Team Member, *I want* a one-tap GPS check-in on office days, *so that* attendance replaces WhatsApp (PRD §9.1).
- **Given** it is a regular office day, **When** I tap the check-in pill, **Then** the browser Geolocation API returns coords, a check-in is recorded with IST timestamp; **Given** check-in ≤ 10:45 IST → on-time (teal, success meme); **Given** > 10:45 → late (coral, friendly late meme).
- **Given** the browser denies location, **Then** I get a gentle prompt to enable location; behaviour on denial = OQ‑17.
- *Geofence radius/office coordinates = OQ‑17 (blocking for this epic).*

**E2 [MVP]** — *As a* Team Member, *I want* a WFH toggle (no GPS) on WFH days, *so that* home days are captured simply (PRD §9.1).
- **Given** it is the **2nd Saturday** of the month (auto) or an Admin-granted WFH day, **Then** the WFH toggle appears; **When** I tap "Working from home today 🏠", **Then** attendance is marked WFH (lavender) with a WFH meme, no GPS required.
- Whether WFH has a late cutoff = OQ‑7.

**E3 [MVP]** — *As a* Team Member, *I want* a colour-coded monthly calendar, *so that* I read my month at a glance (PRD §6.4).
- **Given** the attendance screen, **Then** each day chip is: teal=on-time, coral=late, lavender=WFH, grey=weekend/holiday, white=upcoming; Sundays + 4th Saturday = off; 2nd Saturday = WFH.

**E4 [MVP]** — *As an* Admin, *I want* to override any day's attendance status, *so that* GPS/entry errors are fixable (PRD §4.2).
- **Given** any employee/day, **When** I set status to present/absent/WFH/half-day/late, **Then** it overrides GPS/self-entry and recomputes downstream (late count, leaderboard, deductions).

**E5 [MVP]** — *As an* Admin/Manager, *I want* a clear late-arrival count per employee, *so that* I decide escalation manually, *so that* the app never auto-punishes (PRD §9.2).
- **Given** an employee has N late arrivals this month, **Then** the Admin/Manager view surfaces N clearly; **Then** the app takes **no** automatic PL deduction (the old 5/10-late rule is superseded, §9.2).
- **Given** 3+ lates in a month, **Then** the member gets the affectionate "3+ late arrivals" meme (friendly, not disciplinary, §6.6).

**E6 [MVP]** — *As a* Team Member on Monday, *I want* a Monday first-check-in meme, *so that* the week starts with energy (PRD §6.6).
- **Given** my first check-in of the ISO week falls on Monday, **Then** a "MONDAY morning first check-in" meme fires.

### EPIC F — Leave

**F1 [MVP]** — *As a* Team Member, *I want* to submit a leave request (type, dates, reason), *so that* WhatsApp intimation is replaced (PRD §9.8).
- **Given** I submit, **Then** it routes to my Reporting Manager (Admin can also approve); it appears in my ledger as "pending".
- **Given** I am within probation (full-time: first 3 months; intern: first 2 months), **When** I request paid leave, **Then** the app warns that probation leave is LWP-only (§9.5/§9.6) — request still allowed but flagged LWP.

**F2 [MVP]** — *As a* Reporting Manager, *I want* to approve/reject reportee leave, *so that* approvals aren't lost in chat (PRD §9.8).
- **Given** a pending reportee request, **When** I approve, **Then** balances update automatically in leave-priority order (comp-off → PL → LWP, §9.5) and a "Leave APPROVED" meme + tiny HC stamp toast fires to the member (§6.8).
- **Given** I reject, **Then** the request is logged rejected in the ledger with me as approver; no balance change.

**F3 [MVP]** — *As the* system, *I want* to accrue leave automatically, *so that* balances are never hand-entered (PRD §9.5/§9.6). *(Balances only Admin-overridable, §5.)*
- **Full-time:** 1.5 days credited at the **start of each calendar month**; probation = 3 months (LWP only); **6 days credited at start of month 4** (3 probation months + current); cap advance use at 5 days; **no carry-forward** (lapses 31 Mar). See Appendix A.1.
- **Intern:** up to 4 PL across 6 months, 1/completed month; first 2 months no leave usable; **3 days credited at start of month 3**; +1/month to the 4-day cap; no carry-forward. See Appendix A.2.

**F4 [MVP]** — *As a* Team Member, *I want* correct half-day handling, *so that* short days aren't wrongly counted as full-day leave (PRD §9.3).
- **Given** I log ≥ 4 productive working hours, **Then** the day is a **half-day** (0.5 leave). **Given** < 4 hours, **Then** the system treats it as a **full day's leave**.
- *Definition of "productive working hours" (task Start→Done total vs check-in→check-out) = OQ‑6 (blocking for this story).*

**F5 [MVP]** — *As a* Team Member, *I want* to claim optional holidays and my birthday via the leave flow, *so that* entitlements are easy (PRD §9.1, §10).
- **Given** the FY, **When** I claim an optional holiday, **Then** I may claim up to **2 optional holidays per FY** (excess blocked with a gentle message).
- **Given** my birthday, **When** I claim it as an optional holiday, **Then** it is allowed per §9.1. *Whether birthday counts inside the 2-cap or is separate = OQ‑10.*

**F6 [MVP]** — *As an* Admin, *I want* to manually add/edit/delete leave and adjust balances, *so that* one-off corrections need no developer (PRD §4.3).
- **Given** any employee, **When** I add a leave of any type for any date range, **Then** it posts to the ledger and adjusts balance; **When** I edit a balance directly, **Then** the override persists and is reflected in the salary view.
- **Given** I delete a leave record, **Then** it is permanently removed (no recovery).

**F7 [MVP]** — *As the* system, *I want* to apply the mid-month separation clawback, *so that* unearned accrual is reversed at F&F (PRD §9.7).
- **Given** last working day ≤ **15th** of a month, **Then** that month's 1.5-day credit is treated as **not earned**; any used portion retroactively converts to LWP and is deducted in Full & Final Settlement.
- **Given** last working day is **after** the 15th, **Then** the month's credit stands fully earned regardless of usage. The 15th itself = "on or before" (clawed back). Applies to resignation and termination alike. See Appendix A.5.

### EPIC G — Comp-off

**G1 [MVP]** — *As a* Team Member, *I want* to submit a pre-work comp-off request **before** an off day, *so that* off-day work can earn a comp-off (PRD §9.4).
- **Given** an upcoming approved off day, **When** I submit a request (date, reason, planned work/campaign) **before that day begins**, **Then** it routes to **Admin/Founder** for approval with my **Reporting Manager copied**.
- **Given** I try to submit for a date that has already started/passed, **Then** the app refuses — **no retrospective requests** (§9.4 note).

**G2 [MVP]** — *As an* Admin, *I want* to approve/reject the comp-off request, *so that* only pre-approved off-day work is eligible (PRD §9.4 steps 2 & 4).
- **Given** a pending request, **When** I approve, **Then** the off day becomes comp-off-eligible; **no approval = no comp-off** regardless of hours worked.
- **Given** the off day has passed and I review the member's logged tasks, **When** I tap "credit comp-off", **Then** +1 comp-off day is added. The **6-hour guideline is my internal reference, not an app gate**; I may credit even if logged hours are slightly under 6 (§9.4 step 4). A "COMP-OFF approved" meme fires.

**G3 [MVP]** — *As the* system, *I want* comp-off consumed before PL, *so that* the leave-priority order is honoured (PRD §9.4 step 5, §9.5).
- **Given** a member with comp-off balance > 0 applies for leave, **When** approved, **Then** comp-off is deducted first; PL is touched only after comp-off hits 0; LWP only after PL is exhausted. See Appendix A.3.

**G4 [MVP]** — *As the* system, *I want* comp-off to expire at FY end, *so that* it isn't carried or encashed (PRD §9.4 step 6).
- **Given** unused comp-off on 31 Mar, **When** the FY rolls over, **Then** it lapses (no carry-forward, no encashment).

**G5 [MVP]** — *As an* Admin, *I want* to grant/adjust/delete comp-off directly, *so that* judgment calls need no developer (PRD §4.4).
- **Given** any employee/date, **When** I grant a comp-off with no prior request, **Then** balance increases; **When** I adjust the balance or delete a record, **Then** it persists permanently.

**G6 [MVP]** — *As a* Team Member on an off day, *I want* off-day work logging with **no** hour counter or threshold shown, *so that* I'm not pressured (PRD §9.4 step 3).
- **Given** an approved off day, **When** I log tasks, **Then** no hour gauge/threshold/"6h" progress is displayed to me.

### EPIC H — Focus Time

**H1 [MVP]** — *As a* Team Member, *I want* to see "Today's Focus: Xh Ym in the zone 🎯", *so that* I get self-insight, not a score (PRD §12.1/§12.2).
- **Given** end of day / check-out, **When** Focus Time computes, **Then** it equals total Start→Done task time for the day, shown as "Xh Ym in the zone" — **not** a percentage, **not** live-updating, **no** teammate comparison, **no** ranking.

**H2 [MVP]** — *As a* Team Member, *I want* a 5-day personal focus trend, *so that* I see my own week (PRD §12.2).
- **Given** the Focus card, **Then** a 5-day bar/icon row labelled "Your focus this week" shows, with no percentages and no comparison.

**H3 [MVP]** — *As a* Reporting Manager, *I want* a structured focus view for reportees, *so that* I can coach and balance workload (PRD §12.3).
- **Given** a reportee, **Then** I see the same data with numbers visible — framed for coaching, not critique.

**H4 [v2]** — *As the* product, *I want* Focus Time excluded from the leaderboard in v1 and revisited later (PRD §12.3 note).
- **Given** v1, **Then** Focus Time contributes **0%** to the leaderboard; revisit after 2–3 months.

### EPIC I — Leaderboard

**I1 [MVP]** — *As a* Team Member, *I want* a public monthly leaderboard of 3 equal factors, *so that* punctuality and delivery are rewarded (PRD §14.1).
- **Given** month M, **Then** score = mean of three 0–100 factors, each weighted 33.3%: (1) on-time attendance = on-time check-ins ÷ working days; (2) task estimate accuracy = tasks within estimate ÷ tasks completed; (3) campaign deadline delivery = campaigns delivered by deadline ÷ campaigns the person was part of that **closed** that month. See Appendix A.4.
- Denominator/edge-case definitions (WFH counted? leave days? zero-task month? zero-campaign month?) = OQ‑8/OQ‑23 (blocking for this epic).

**I2 [MVP]** — *As a* Team Member, *I want* rank movement, streaks, and personal-best markers, *so that* even new joiners have something to celebrate (PRD §14.2, §7.3).
- **Given** M vs M−1, **Then** each person shows an up/down arrow (teal up, coral down) and rank meme fires on change; streak badge shows below the name; personal-best markers surface independent of raw rank.
- The top-3 render large with 48px ExtraBold rank number (§6.4); #1 gets the Sunny Yellow badge + "Leaderboard RANK #1" meme.

**I3 [MVP]** — *As the* system, *I want* the board to reset monthly, *so that* it stays a fresh game (PRD §14).
- **Given** the 1st of a month at IST midnight, **Then** the board resets; the prior month's final ranks are frozen for movement comparison.

**I4 [v2]** — *As the* product, *I want* tenure-aware adjustments added only if raw ranking discourages new joiners (PRD §14.2 note).
- **Given** month 1 launches as **raw ranking**; **When** the team reports it discourages newer joiners, **Then** tenure-aware adjustments are introduced (deferred).

### EPIC J — Salary & Deductions View

**J1 [MVP]** — *As a* Team Member, *I want* a salary/deductions estimate visible only to me, my RM, and Admin, *so that* there's transparency without a payslip (PRD §5, §13).
- **Given** I open the salary card, **Then** I see base salary, LWP deduction = (LWP days ÷ working days in month) × salary, late-arrival-as-LWP conversions (if any), advance-leave debt, and a **net estimated** figure explicitly labelled "estimate — not a payslip". See Appendix A.6.
- **Given** a non-RM, non-Admin peer, **Then** the card is not visible.

**J2 [MVP]** — *As the* view, *I want* no statutory computation, *so that* scope stays a transparency layer (PRD §13 note, §2.2).
- **Given** the estimate, **Then** it computes **no** PF/ESI/TDS; a note directs payroll to the existing statutory process.

### EPIC K — Holiday Calendar

**K1 [MVP]** — *As a* Team Member, *I want* the FY 26–27 calendar pre-seeded, *so that* off days are correct from launch (PRD §10).
- **Given** launch, **Then** all 23 listed holidays are seeded with correct mandatory/optional type; Sundays + 4th Saturday = off; 2nd Saturday = WFH; each employee's birthday = optional entitlement. See seed table Appendix A.7.

**K2 [MVP]** — *As an* Admin, *I want* to add/edit/remove holidays, *so that* the calendar stays current without a developer (PRD §10 note).
- **Given** I add/edit/remove a holiday, **When** saved, **Then** the calendar refreshes for **all** employees immediately and downstream off-day logic updates.

### EPIC L — Admin Console

**L1 [MVP]** — *As an* Admin, *I want* one console surfacing all §4.1–4.5 controls, *so that* I manage everything in one place.
- **Given** I open the console, **Then** I can reach task/attendance/remark/leave/comp-off/profile/holiday/salary/Admin-toggle controls, each gated to Admins only.

**L2 [MVP]** — *As an* Admin, *I want* destructive actions to be immediate and permanent (except the profile-delete name gate), *so that* the app matches the stated no-audit-trail model (PRD §4.5 note).
- **Given** any delete except profile-delete, **When** confirmed, **Then** it executes immediately with no recovery; **Given** profile-delete, **Then** the type-the-name gate is required first.

### EPIC M — Meme Toasts & In-App Notifications

**M1 [MVP]** — *As a* Team Member, *I want* a rotating meme toast on key actions, *so that* the app feels alive (PRD §6.5/§6.6).
- **Given** a key event (task on-time/late, check-in on-time/late, 3+ lates, perfect month, WFH, campaign delivered/overdue, rank #1/up/down, leave approved, Monday, streak, empty list, comp-off approved), **Then** a random line from that event's bank shows in a bottom pill for 3s, never blocking the UI, and **never the same line twice in a row** (§6.5).
- **Given** the copy bank is JSON keyed by event, **When** a new line is appended, **Then** no app code change is needed (§6.6).

**M2 [MVP]** — *As a* Reporting Manager, *I want* in-app notifications for reportee overdue campaigns and comp-off requests, *so that* I act promptly (PRD §3, §9.4).
- **Given** a reportee's campaign goes overdue, **Then** I receive an in-app notification; **Given** a reportee files comp-off, **Then** I am copied (notified) while approval routes to Admin.

**M3 [MVP]** — *As the* app, *I want* notifications to be **in-app only**, *so that* cost stays near-zero (PRD §2.2, §15).
- **Given** v1, **Then** no WhatsApp/email/push channel is used; all notifications live inside the app.

**M4 [MVP]** — *As a* designer's guardrail, *I want* copy rules enforced, *so that* tone never turns punitive or cluttered (PRD §6.7, §7.3).
- **Given** any surface, **Then**: no ticking clock/countdown to members; no raw number without human interpretation; no all-caps except the leaderboard rank number; errors are gentle/funny/instructive; bottom nav ≤ 5 items.

### EPIC N — PWA

**N1 [MVP]** — *As a* Team Member, *I want* to install the app to my home screen, *so that* it feels like an app without an app store (PRD §2.2, §15).
- **Given** a supported mobile browser, **When** I choose "Add to Home Screen", **Then** the PWA installs with the HC icon, splash on `#0F0E17`, and standalone display.

**N2 [MVP]** — *As a* Team Member, *I want* the 5-tab bottom nav (Home/Tasks/Campaigns/Attendance/Profile), *so that* navigation is fast and uncluttered (PRD §6.4, §6.7).
- **Given** any screen, **Then** the bottom nav shows exactly these 5 tabs, never more.

**N3 [MVP]** — *As a* Team Member, *I want* the app usable on a phone in the dark theme, *so that* it matches the agency's creator-tool feel (PRD §6).
- **Given** any screen, **Then** it renders on the dark palette (Deep Space base, Dark Lifted cards), Plus Jakarta Sans headings / DM Sans body, minimal outline icons, responsive to phone widths.

**N4 [v2 / confirm]** — *As a* user with flaky network, *I want* basic offline resilience, *so that* check-in/task taps aren't lost.
- **Given** intermittent connectivity, **Then** the app should degrade gracefully; full offline queue = OQ‑25 (likely deferred).

---

## 4. MVP (v1) Scope vs. Deferred

### 4.1 In scope for v1 (ships)
| Area | v1 includes |
|---|---|
| Auth/Onboarding | Email+password login, Admin-created accounts, Admin toggle, session persistence |
| Profiles | Full profile CRUD (Admin), self-view, salary visibility rules, birthday view, leave ledger |
| Tasks | Create + campaign tag + estimate, On it/Nailed it honest timing, off-day logging, Admin task controls |
| Campaigns | Create/assign Lead+members+deadline, colour-coded proximity states, overdue flag+notify, Lead status roll-up, mark delivered |
| Attendance | GPS check-in/out, 10:45 late cutoff, WFH toggle (2nd Sat/Admin), colour calendar, Admin override, late count (no auto-punish) |
| Leave | Request flow, RM/Admin approval, auto-accrual (full-time §9.5 + intern §9.6), half-day rule, optional-holiday/birthday claims, mid-month separation clawback, Admin leave controls |
| Comp-off | Pre-approval request (Admin approves, RM copied), Admin credit from task logs, comp-off-before-PL, FY expiry, Admin controls |
| Focus Time | Personal "in the zone" card + 5-day trend, RM structured view |
| Leaderboard | 3-factor equal-weight monthly board, **raw ranking**, movement/streak/personal-best, monthly reset |
| Salary view | Transparency estimate (base, LWP deduction, late-LWP, advance debt, net estimate), scoped visibility, no statutory calc |
| Holiday Calendar | Seeded FY 26–27 + Sundays/4th-Sat off + 2nd-Sat WFH + birthdays; Admin editable |
| Admin console | All §4.1–4.5 controls, immediate/permanent deletes, profile-delete name gate |
| Meme/Notifications | Full rotating meme bank, in-app-only notifications, RM overdue/comp-off notifications, tone guardrails |
| PWA | Installable, 5-tab nav, dark responsive theme |

### 4.2 Explicitly deferred / out of scope
| Item | Status | Reason / source |
|---|---|---|
| Focus Time **in the leaderboard** | **Deferred to v2** | PRD §12.3 note — revisit after 2–3 months once self-insight framing internalised |
| **Tenure-aware** leaderboard adjustments | **Deferred to v2** | PRD §14.2 note — launch raw; add only if it discourages new joiners |
| Statutory **payroll** (PF/ESI/TDS) | **Out of scope** | PRD §2.2, §13 — salary is a transparency layer only |
| **Native iOS/Android** apps | **Out of scope** | PRD §2.2 — ships as installable PWA |
| **WhatsApp / email** notifications | **Out of scope (v1)** | PRD §2.2, §15 — in-app only to keep cost near-zero |
| **Continuous / background GPS** | **Out of scope** | PRD §2.2 — location only at check-in/out |
| **Client-facing** access | **Out of scope** | PRD §2.2 — internal only |
| **Audit trail** of Admin edits/deletes | **Out of scope (v1)** | PRD §4.5 note — no audit trail; confirm acceptable (OQ‑20) |
| Automated PL deduction for lates | **Removed** | PRD §9.2 — superseded by updated Leave Policy; manual escalation only |
| Offline write queue | **Likely deferred** | OQ‑25 |

---

## 5. Milestone / Release Plan

Sequenced so each milestone is demoable and later milestones depend only on earlier ones. Admin edit/delete for a module is built **with** that module (not saved for the end), while the standalone Admin console (toggle, profile CRUD, cross-cutting controls) is consolidated in M6.

| Milestone | Theme | Epics / stories | Exit criteria (demoable) |
|---|---|---|---|
| **M0 — Foundations** | Skeleton the whole app can grow on | Design system + dark theme tokens (§6.2/§6.3), DB schema, PWA shell (N1–N3), Auth (A1–A4), Profiles read (B1) + seed accounts (A2), Holiday calendar seed (K1) | Team can install PWA, log in, see their profile and the seeded holiday calendar in the dark theme |
| **M1 — Tasks + Campaigns** | The original problem: honest time + ownership | C1–C5, D1–D4, campaign colour states, task→campaign roll-up (§10.4) | A member logs a task with On it/Nailed it; a campaign card flips through proximity states and flags overdue |
| **M2 — Attendance + Focus Time** | Replace WhatsApp intimation | E1–E6, H1–H3 | GPS check-in with 10:45 cutoff, WFH toggle on 2nd Sat, colour calendar, "in the zone" card |
| **M3 — Leave engine** | Encode the policy correctly | F1–F7 (accrual, half-day, optional/birthday, clawback) + Appendix A fixtures as tests | Accrual matches Appendix A.1/A.2 exactly; half-day + clawback pass fixtures |
| **M4 — Comp-off** | Earned-leave flow | G1–G6 | Pre-approval before off day → Admin credit from logs → comp-off-before-PL → FY expiry |
| **M5 — Leaderboard + Salary** | Gamify + transparency | I1–I3, J1–J2 | Monthly 3-factor raw board with movement/streak; salary estimate matches Appendix A.6 |
| **M6 — Admin console + Meme/Notifications + hardening** | Control, delight, polish | A3, B2–B5, K2, L1–L2, M1–M4, all §4 Admin controls consolidated, PWA polish (N4 decision) | Admin can edit/delete anything per §4; memes rotate per bank; in-app notifications land; tone guardrails enforced |
| **Release v1** | Launch to the 6-person team | — | UAT sign-off; cost verified ₹0–500/mo (§15); all OQ resolved |
| **v2 (post-launch, 2–3 mo later)** | Revisit gamification | H4 (Focus in board), I4 (tenure-aware), optional email/WhatsApp | Based on team feedback |

> Dependency notes: Leave (M3) needs Attendance (M2) for half-day/working-day math; Leaderboard (M5) needs M1+M2+M4 factor inputs; Salary (M5) needs Leave (M3) LWP/advance data; Meme/Notifications (M6) hooks events emitted by M1–M5, so those events must be raised as each module is built even though the toast/notification layer is finished in M6.

---

## 6. Success Metrics / KPIs

Framed against the PRD's actual goals (§2.1). Targets are proposals for the founder to confirm.

### 6.1 Adoption & replacement (did it replace WhatsApp?)
| KPI | Definition | Target |
|---|---|---|
| Attendance capture rate | Working days with an in-app check-in/WFH toggle ÷ total working days, per member | ≥ 95% within 4 weeks of launch |
| WhatsApp intimation eliminated | Leave/attendance messages still sent on WhatsApp (self-reported) | → ~0 within 6 weeks |
| Leave requests in-app | Leave requests filed in-app ÷ total leave taken | 100% |
| Comp-off via app | Comp-off pre-approvals filed in-app ÷ comp-off credited | 100% |

### 6.2 The core problem (is task time now honest & visible?)
| KPI | Definition | Target |
|---|---|---|
| Task logging depth | Tasks with **both** Start and Done recorded ÷ tasks created, per member | ≥ 80% by week 4 |
| Estimate-accuracy trend | Tasks completed within estimate ÷ completed tasks, tracked monthly | Upward trend over first quarter |
| Tasks per active member per working day | Count | ≥ 2 (sanity that the tool is actually used) |

### 6.3 Engagement & delight
| KPI | Definition | Target |
|---|---|---|
| Daily active openers | Distinct members opening the app ÷ team size, per working day | ≥ 80% |
| Leaderboard check-ins | Leaderboard views per member per week | Trending up first month |
| Meme non-repeat compliance | Consecutive identical memes per event | 0 (hard rule §6.5) |

### 6.4 Operations & correctness
| KPI | Definition | Target |
|---|---|---|
| Leave-balance disputes | Manual Admin balance overrides due to computed-balance errors | → 0 after M3 fixtures pass |
| Leave approval latency | Median time from request to decision | < 1 working day |
| Campaign overdue caught | Overdue campaigns that fired a Lead/Manager notification ÷ overdue campaigns | 100% |
| Accrual correctness | Automated balances matching Appendix A fixtures | 100% (release gate) |

### 6.5 Cost & scope discipline
| KPI | Definition | Target |
|---|---|---|
| Monthly running cost | Infra + services | ₹0–500/mo (§15) |
| Scope integrity | Out-of-scope items (payroll/native/WhatsApp) shipped in v1 | 0 |

---

## 7. Open Questions & Assumptions (confirm with Founder before affected build)

Each item lists the ambiguity, the **assumption this plan currently makes**, why it matters, and which epic it blocks.

| # | Open question | Current assumption | Blocks |
|---|---|---|---|
| **OQ‑1** | Who may **create/edit campaigns** and assign the Lead? PRD §11.1 doesn't name an authority. | **Admin only** creates campaigns and assigns Lead/members/deadline. | EPIC D, D1 |
| **OQ‑2** | Who may mark a campaign **"delivered"** (which feeds the leaderboard)? | **Campaign Lead + Admin** can mark delivered. | EPIC D, D4, I1 |
| **OQ‑3** | Does a Reporting Manager have any **edit/delete** on reportee tasks, or only view + leave approval? PRD §3 says RM "manages" tasks — ambiguous. | RM has **view + leave/campaign-flag visibility only**; all task edit/delete stays **Admin-only** per §4.1. | §2.2, EPIC C/F |
| **OQ‑4** | Can a Team Member **delete their own task**, and can any task be edited **after** completion (which would corrupt honest actual-vs-estimate)? | TM may delete/edit **own, uncompleted** tasks; **completed** tasks are locked to members (Admin can still edit via §4.1). | EPIC C, C4 |
| **OQ‑5** | Which profile fields (if any) can a member self-edit — e.g. **photo, DOB**? PRD §4.5 gives edit to Admin. | Member may edit **own photo only**; all other fields Admin-only. | EPIC B, B1/B2 |
| **OQ‑6** | Half-day "**≥ 4 productive working hours**" (§9.3) — measured from **task Start→Done total** or from **check-in→check-out** clocked time? These can diverge widely. | Measured from **task Start→Done total** (consistent with Focus Time §12.1). | EPIC F, F4 (blocking) |
| **OQ‑7** | Do **WFH days** have a late cutoff, or is any WFH toggle "on-time"? Leaderboard §14.1 counts "GPS/WFH check-ins before the late cutoff." | WFH toggle at **any time = on-time** (no late on WFH days). | EPIC E, E2; EPIC I, I1 |
| **OQ‑8** | Leaderboard **denominators**: does "working days" include WFH days? Are approved-leave days excluded? Is a member on leave penalised on the attendance factor? | Working days = office+WFH days the member was **expected** to work (approved-leave and off days **excluded** from both numerator and denominator). | EPIC I, I1 (blocking) |
| **OQ‑9** | Comp-off approval authority — confirm **RM cannot approve** comp-off (only copied) even for their own reportees, unlike ordinary leave. | RM is **notified only**; **Admin/Founder approves** comp-off (§9.4). | EPIC G, §2.6 |
| **OQ‑10** | Is an employee's **birthday** optional-holiday **inside** the 2-per-FY optional cap, or **separate**? §9.1/§10 list it as its own entitlement. | Birthday is **separate** from the 2 optional holidays. | EPIC F, F5 |
| **OQ‑11** | When Admin switches `employment_type` mid-tenure, does accrual **recompute retroactively** or apply **forward only**? | **Forward only** from the change date; past accrual untouched. | EPIC B, B2; EPIC F |
| **OQ‑12** | §9.5 states 18 PL covers **Casual/Personal + Sick combined** — confirm there is **no separate sick-leave bucket**. | Single combined PL bucket; no separate sick balance. | EPIC F, F3 |
| **OQ‑13** | **Advance-leave** mechanics: allow the balance to go negative down to **−5 days**? How surfaced to the member? | Balance may go to **−5**; shown as "advance-leave debt" on salary view (§13), not a hard block until −5. | EPIC F, F1; EPIC J |
| **OQ‑14** | Entitlement figures for **bereavement / maternity / paternity** leave types are not specified (only listed as types). Paid? Capped? | Treated as **Admin-granted, uncapped, paid** leave types tagged in the ledger (no auto-accrual), pending policy. | EPIC F, F1/F6 |
| **OQ‑15** | **GPS geofence**: office coordinates + acceptable radius, and behaviour when location is **denied/spoofed/out-of-radius**. PRD gives no coordinates or radius. | Record coordinates at check-in; **do not hard-block** on radius in v1 (record + flag out-of-radius for Admin review); office coords to be provided by founder. | EPIC E, E1 (blocking) |
| **OQ‑16** | Who is the **Reporting Manager** in a 6-person team — one RM for all, or per-member? PRD §3 says "assigned per team member." | Per-member assignment on the profile; a member may report to the Founder. | EPIC A/B, permission scoping |
| **OQ‑17** | **Late cutoff & grace** confirmation: 10:30 start, grace to 10:45, late **after** 10:45 (i.e. 10:45:00 exactly = on-time?). | On-time if check-in **≤ 10:45:00 IST**; late strictly after. | EPIC E, E1 |
| **OQ‑18** | Campaign leaderboard factor: what counts as a campaign that **"closed in the month"** (delivered, or deadline passed, or Admin-closed)? | A campaign **closes** in month M if it was **marked delivered** or its **deadline fell** in M. | EPIC I, I1 |
| **OQ‑19** | **Leaderboard reset** exact timing/tie-breaks: reset at **1 Apr FY** or every calendar month? Tie-break rule for equal scores? | Reset **every calendar-month** boundary (IST midnight, 1st); ties broken by higher on-time attendance then earlier-joined. | EPIC I, I3 |
| **OQ‑20** | PRD §4.5 states **no audit trail** — confirm the founder accepts irreversible, untracked Admin deletes for v1. | Accepted as stated; profile-delete name gate is the only safeguard. | EPIC L |
| **OQ‑21** | **Last-Admin safeguard**: should the app prevent removing the final remaining Admin? PRD is silent. | **Yes** — block revoking the last Admin. | EPIC A, A3 |
| **OQ‑22** | Attendance status **"half-day"** appears both as an attendance status (§4.2) and as a leave outcome (§9.3). How do they reconcile in the ledger and salary view? | A half-day is one attendance status that consumes **0.5** leave in priority order; single source of truth in the leave engine. | EPIC E/F |
| **OQ‑23** | Leaderboard edge cases: member with **0 tasks** or **0 campaigns** in a month — is that factor scored 0, or dropped and remaining factors re-weighted? | Factor with a **zero denominator is dropped**; remaining factors re-weighted equally (avoids unfair 0). | EPIC I, I1 |
| **OQ‑24** | Does an **RM see reportee salary** raise a privacy concern the founder wants to restrict? §5 currently allows it. | Keep §5 as written (RM sees reportee salary). | EPIC B/J |
| **OQ‑25** | **Offline resilience**: do we need a check-in/task offline queue for flaky mobile networks? | **Deferred** — online-only in v1; graceful error on no-network. | EPIC N, N4 |
| **OQ‑26** | Login method: is **email+password** acceptable, or does the founder want Google sign-in / magic link (affects cost & effort)? | **Email+password** in v1 (zero external cost). | EPIC A |

---

## Appendix A — Worked Numeric Examples (turn these into test fixtures)

All dates IST. FY = 1 Apr 2026 – 31 Mar 2027.

### A.1 Full-time leave accrual (PRD §9.5)
Joining date **1 Apr 2026**, employment type Full-time.
| Month | Event | PL credited | Cumulative PL | Notes |
|---|---|---|---|---|
| Apr (M1) | Probation | 0 (LWP only) | 0 | Any leave used = LWP |
| May (M2) | Probation | 0 | 0 | |
| Jun (M3) | Probation | 0 | 0 | |
| Jul (M4) | Probation ends | **+6.0** at month start | 6.0 | 3 probation months (3×1.5=4.5) + current month 1.5 = 6.0 |
| Aug (M5) | Accrual | +1.5 | 7.5 | |
| … | +1.5/month | | | Advance use capped at 5 days; excess recovered in F&F |
| Mar (M12) | Last month | +1.5 | — | **No carry-forward** — unused PL lapses 31 Mar |

Full-year run-rate = 6.0 (at M4) + 1.5 × 8 (Aug–Mar) = **18.0 PL** for a member who joined 1 Apr — matches the 18/FY entitlement.

### A.2 Intern leave accrual (PRD §9.6)
Employment type Intern, 6-month internship starting **1 Apr 2026**.
| Month | Event | Credited | Cumulative | Notes |
|---|---|---|---|---|
| M1 (Apr) | Probation | 0 | 0 | No leave usable |
| M2 (May) | Probation | 0 | 0 | No leave usable |
| M3 (Jun) | Opening balance | **+3.0** | 3.0 | Credited at start of month 3 |
| M4 (Jul) | Accrual | +1.0 | **4.0 (cap)** | |
| M5 (Aug) | Accrual | +0 | 4.0 | Cap reached — no further accrual |
| M6 (Sep) | Accrual | +0 | 4.0 | Lapses at internship completion; no carry-forward |

### A.3 Leave-priority ordering (PRD §9.4 step 5, §9.5)
Member has **comp-off = 2**, **PL = 1**, applies for **4 days** leave (all approved).
- Deduct comp-off first: 2 days → comp-off 0.
- Then PL: 1 day → PL 0.
- Remaining 1 day → **LWP** (salary deducted per A.6).
Result: comp-off 0, PL 0, **1 LWP day** recorded.

### A.4 Leaderboard score (PRD §14.1)
Member in a month with **22 working days**:
- On-time check-ins = 20 → attendance factor = 20/22 = **90.9**
- Tasks completed = 15, within estimate = 12 → accuracy factor = 12/15 = **80.0**
- Campaigns closed they were part of = 3, delivered on time = 2 → delivery factor = 2/3 = **66.7**
- Score = (90.9 + 80.0 + 66.7) / 3 = **79.2 / 100**
(Edge cases: zero-denominator factor dropped and remaining re-weighted — see OQ‑23.)

### A.5 Mid-month separation clawback (PRD §9.7)
Full-time member, last working day scenarios in a month whose 1.5-day credit was posted on the 1st and **1 day already used**:
- **LWD = 15th** → "on or before 15th" → credit **not earned** → the 1 used day converts to **LWP**, deducted in F&F.
- **LWD = 16th** → after 15th → credit **stands fully earned** → the used day remains PL, **no** clawback.

### A.6 Salary/deductions estimate (PRD §13)
Base salary **₹30,000/month**, **22 working days**, **2 LWP days**, advance-leave debt **1 day**:
- Per-day value = 30,000 / 22 = **₹1,363.64**
- LWP deduction = (2 / 22) × 30,000 = **₹2,727.27**
- Advance-leave debt shown as outstanding **1 day ≈ ₹1,363.64** (recovered on future accrual or at F&F)
- **Net estimated ≈ ₹27,272.73** — labelled "estimate, not a payslip"; **no** PF/ESI/TDS applied.

### A.7 Holiday seed (PRD §10) — mandatory vs optional
Seed exactly these, plus rules: **Sundays = off; 4th Saturday = off; 2nd Saturday = WFH; each employee birthday = optional**.

| # | Date | Day | Holiday | Type |
|---|---|---|---|---|
| 1 | 03 Apr 2026 | Fri | Good Friday | Optional |
| 2 | 01 May 2026 | Fri | Maharashtra Day | **Mandatory** |
| 3 | 28 May 2026 | Thu | Bakri ID | Optional |
| 4 | 26 Jun 2026 | Fri | Moharram | Optional |
| 5 | 15 Aug 2026 | Sat | Independence Day | **Mandatory** |
| 6 | 28 Aug 2026 | Fri | Raksha Bandhan | Optional |
| 7 | 04 Sep 2026 | Fri | Janmashtami | Optional |
| 8 | 14 Sep 2026 | Mon | Ganesh Chaturthi | **Mandatory** |
| 9 | 25 Sep 2026 | Fri | Ganesh Visarjan | Optional |
| 10 | 02 Oct 2026 | Fri | Mahatma Gandhi Jayanti | **Mandatory** |
| 11 | 20 Oct 2026 | Tue | Dussehra | Optional |
| 12 | 09 Nov 2026 | Mon | Diwali | **Mandatory** |
| 13 | 11 Nov 2026 | Wed | Bhai Duj | Optional |
| 14 | 25 Dec 2026 | Fri | Christmas | Optional |
| 15 | 01 Jan 2027 | Fri | New Year | **Mandatory** |
| 16 | 15 Jan 2027 | Fri | Makar Sankranti / Pongal | Optional |
| 17 | 26 Jan 2027 | Tue | Republic Day | **Mandatory** |
| 18 | 19 Feb 2027 | Fri | Shivaji Jayanti | Optional |
| 19 | 24 Feb 2027 | Wed | Mahaveer Jayanti | Optional |
| 20 | 10 Mar 2027 | Wed | Ramzan ID | Optional |
| 21 | 19 Mar 2027 | Fri | Gudi Padwa | Optional |
| 22 | 22 Mar 2027 | Mon | Holi | **Mandatory** |
| 23 | 26 Mar 2027 | Fri | Good Friday | Optional |
| 24 | (each employee) | — | Birthday | Optional |

Optional holidays claimable: **max 2 per FY** via the leave flow (birthday separate pending OQ‑10).

---

*End of Product Plan. Resolve Section 7 open questions (especially the blocking ones: OQ‑6, OQ‑8, OQ‑15) before M2/M3 build begins.*
