# 03 — UX & Design System

**Product:** Hustling Collaborators — Internal HRM + Task + Campaign Management PWA
**Owner of this doc:** Senior Product Designer (UI/UX)
**Source of truth:** `/home/user/hustling-collaborators/docs/PRD.md` (v6.0). Where this spec and the PRD disagree, the PRD wins — raise a change request instead of diverging silently.
**Sibling doc:** `/home/user/hustling-collaborators/docs/design/02-product-plan.md` (personas, permission matrix, epics, open questions OQ‑1…OQ‑26, Appendix A fixtures). This design spec assumes the permission scoping and screen list from that plan.
**Context:** ~6-person Indian marketing/influencer agency. Currency **₹**, timezone **Asia/Kolkata (IST, UTC+05:30, no DST)**, financial year **1 Apr – 31 Mar**, Hinglish meme copy. Free-tier infra (React/TS PWA, Node/TS, Postgres). **Single dark theme only** — there is no light mode in v1.

> **How to read this document.** §1 fixes the principles every pixel must obey. §2 is the token layer — copy the CSS custom-property block verbatim into `tokens.css` and reference nothing but tokens thereafter. §3 is the component library (props, states, tokens, microcopy). §4 specs every screen (layout grid → content → loading/empty/error/success → interactions → exact copy). §5 is the meme-toast engine + the canonical **17 event keys** the frontend must implement. §6 is logo usage, §7 accessibility, §8 responsive/PWA. Appendix B is the copy-bank JSON skeleton.

---

## 0. Design-level decisions & reconciliations (confirm with founder)

The PRD is the authority, but a few visual instructions need reconciliation before implementation. Each decision below is what this spec adopts; each is flagged so the founder can veto.

| # | Tension in PRD | Decision this spec makes | Flag |
|---|---|---|---|
| **DD‑1** | §6.4 says campaign card shows a **"deadline countdown"**; §6.7/§7.3 say **never show a ticking clock or countdown timer**. | The "countdown" is a **day-granularity static label** ("3 days left", "Due today", "On track"), recomputed once at IST midnight. **Never** a live HH:MM:SS. This satisfies both. | Adopted |
| **DD‑2** | §11.2 names deadline states **teal-green / amber / hot-pink**, but §6.2 palette has no "amber" or "hot pink" token. | Map **amber → Sunny Yellow `#FFD60A`**, **hot-pink → Hot Coral `#FF6B6B`**. On-track → Teal Mint `#00D4AA`. | Adopted |
| **DD‑3** | §6.4 gives a campaign card **one of 4 identity colours** AND §11.2/§6.4 say overdue cards **flip to coral**. Two colour systems on one card. | **Two independent layers:** (a) *identity accent* = a fixed 16px left border in one of the 4 campaign colours, assigned at creation (client branding); (b) *proximity signal* = the deadline pill colour + border treatment, which changes with time and, when overdue, overrides the whole card border to coral + pulse. | Adopted |
| **DD‑4** | White text on Electric Purple `#7B61FF` measures **4.20:1** — below AA‑normal (4.5:1). | Primary-button labels use **pure white `#FFFFFF`** at **≥16px, weight ≥600** so they qualify as *large/bold text* (AA threshold 3:1) and as *UI-component* contrast (3:1). Never set small (<16px) purple-background text. | Adopted — see §7.1 |
| **DD‑5** | Comp-off has **no fixed cap** (§9.4), so the purple arc has no natural denominator. | Purple (comp-off) ring fills against a design constant `COMPOFF_RING_MAX = 8` days; balance > 8 renders a full ring + a small "8+" glyph. PL (teal) ring fills against annual entitlement (18 FT / 4 intern). | Adopted — see §3.11 |
| **DD‑6** | §6.2 gives 12 colour roles but no borders, overlays, disabled, or state-layer values — all needed to build. | This spec adds a **derived token set** (§2.2) built only from the 12 PRD hexes via opacity, never inventing new hues. | Adopted |
| **DD‑7** | Fonts named (Plus Jakarta Sans, DM Sans) but **button font weight** unspecified. | Buttons use **Plus Jakarta Sans SemiBold 600** for a confident, non-corporate feel. | Adopted |

---

## 1. Design Principles

Distilled from PRD §6 (visual brief) and §7 (tone principles — *"the most important design requirement in the entire document"*). Every component and screen below is checked against these seven laws.

### 1.1 The seven laws

| # | Law | Source | What it means in the UI |
|---|---|---|---|
| **P1** | **Self-insight, never surveillance.** | §7.1 | Every number answers *"what does this tell ME about MY day?"* — never *"what is this reporting about me?"* Member views hide raw scores behind human interpretation; only Manager/Admin views expose numbers (for coaching). |
| **P2** | **Positive framing first.** | §7.3 | Anything readable as negative is reframed as opportunity. "3 late arrivals" → "3 slow starts this month — still plenty of time to finish strong 💪". No red error walls; errors are gentle, funny, instructive. |
| **P3** | **No ticking clocks.** | §6.7, §7.3 | No countdown timers, no live stopwatch, no HH:MM:SS anywhere a member can see. Active work = a **soft glow**, not a clock. Deadlines = day-granularity labels (DD‑1). |
| **P4** | **Numbers stay in the background.** | §7.3 | Pair every raw number with an interpretation. The only bare numbers allowed: the **leaderboard rank** and **score/100** (explicit §6.4 exception), and the **stat-card counts** on Home (which still carry a label). |
| **P5** | **Dark, gamified, minimal.** | §6.1 | Deep-space base so colour pops hit hard; rounded coloured cards; bold type hierarchy; scoreboard energy. Minimal outline icons only — no filled icons, no illustrations. If a screen feels cluttered, remove something (§6.7). |
| **P6** | **One deliberate animation per key moment.** | §6.1 | Motion only at: task completion, rank change, overdue flip, check-in confirm, leave approval. Nothing else animates. Everything respects `prefers-reduced-motion`. |
| **P7** | **Meme culture, rotating, never repetitive.** | §6.5, §6.6 | Key actions fire a meme toast (bottom pill, 3s, non-blocking). Random line per event; never the same line twice in a row for one event. Friendly banter, never punitive or shaming — even late taunts are affectionate. |

### 1.2 Hard "never" rules (§6.7) — treat as lint failures

1. Never show a ticking clock / countdown timer to a Team Member.
2. Never show a raw number without a human interpretation (except leaderboard rank & score/100, and labelled stat counts).
3. Never repeat the same meme line twice in a row for the same event.
4. Never use all-caps in the UI **except** the leaderboard rank number.
5. Never make an error feel punitive — gentle, funny, instructive.
6. Never put more than 5 items in the bottom nav.
7. Never let a screen feel cluttered — when in doubt, remove.

### 1.3 Member vs. Manager/Admin framing switch (§7.3)

The *same data* renders in two registers. Every component that shows a metric declares a `frame` prop:

| `frame` | Who sees it | Register |
|---|---|---|
| `"insight"` | Team Member on own data | Interpretation-first, numbers hidden or softened, positive. Default. |
| `"coaching"` | Reporting Manager on reportees; Admin on anyone | Structured, numbers visible, neutral (never punitive). Adds columns/values the insight frame hides. |

---

## 2. Design Tokens

All values below are the single source for the app. **PRD-exact** values are the 12 colours of §6.2 and the type specs of §6.3. Everything else (derived colours, spacing, radii, elevation, motion, z-index) is defined here for the first time and marked *(derived)* — derived colours are built **only** from the 12 PRD hexes via alpha, never new hues (DD‑6).

### 2.1 Colour palette — roles & usage (PRD §6.2, exact)

| Token | Name | Hex | Role | Where used |
|---|---|---|---|---|
| `--color-bg` | Deep Space | `#0F0E17` | Background | Every screen base; splash; manifest theme/background colour |
| `--color-surface` | Dark Lifted | `#1C1A2E` | Surface | All cards, modals, bottom nav, toast background |
| `--color-primary` | Electric Purple | `#7B61FF` | Primary accent | Buttons, active nav state, active-task glow border, leaderboard rank highlight, focus ring, comp-off arc |
| `--color-campaign-coral` | Hot Coral | `#FF6B6B` | Campaign 1 / urgent | Urgent/active campaign cards; **also** overdue indicator & late-arrival count |
| `--color-campaign-teal` | Teal Mint | `#00D4AA` | Campaign 2 / success | In-progress campaign cards; **also** on-time success (task done, check-in), PL arc |
| `--color-campaign-yellow` | Sunny Yellow | `#FFD60A` | Campaign 3 / new | New campaign cards; **also** leaderboard #1 badge; "coming up" deadline (DD‑2) |
| `--color-campaign-lavender` | Soft Lavender | `#C4B5FD` | Campaign 4 / low-pri | Completed / low-priority campaign cards; **also** WFH day chips |
| `--color-warning` | Hot Coral | `#FF6B6B` | Overdue / warning | Overdue campaign, late count, due-today deadline (alias of coral) |
| `--color-success` | Teal Mint | `#00D4AA` | Success | Task on-time, on-time check-in (alias of teal) |
| `--color-text` | Near White | `#F0EFF8` | Primary text | All main text on dark |
| `--color-text-muted` | Muted Lavender | `#9896A8` | Secondary text | Dates, subtitles, metadata, secondary info |
| `--color-toast-border` | (Purple border) | `#7B61FF` | Toast border | Meme-toast pill border (on `--color-surface`) |

### 2.2 Derived tokens *(new — built only from the 12 hexes)*

| Token | Value | Purpose |
|---|---|---|
| `--color-surface-2` | `#232043` *(= surface lifted; use `color-mix(in srgb, #1C1A2E 82%, #7B61FF 18%)` ≈ `#2A2640`)*, spec value `#252238` | Nested surface (input fields, list rows inside a card) |
| `--color-border` | `rgba(240,239,248,0.10)` | Hairline dividers, card borders on surface |
| `--color-border-strong` | `rgba(240,239,248,0.18)` | Input borders, focused separators |
| `--color-overlay` | `rgba(15,14,23,0.72)` | Modal scrim over `--color-bg` |
| `--color-primary-hover` | `rgba(123,97,255,0.88)` | Button hover (purple over surface) |
| `--color-primary-press` | `rgba(123,97,255,0.72)` | Button active/pressed |
| `--color-primary-ghost` | `rgba(123,97,255,0.14)` | Ghost/secondary button fill, active-nav pill fill |
| `--color-success-ghost` | `rgba(0,212,170,0.14)` | Nailed-it button fill, on-time chip fill |
| `--color-coral-ghost` | `rgba(255,107,107,0.14)` | Overdue chip fill, late chip fill |
| `--color-yellow-ghost` | `rgba(255,214,10,0.14)` | Coming-up chip fill, #1 badge fill |
| `--color-lavender-ghost` | `rgba(196,181,253,0.16)` | WFH chip fill |
| `--color-on-primary` | `#FFFFFF` | Text/icon on Electric-Purple fill (DD‑4) |
| `--color-on-accent` | `#0F0E17` | Text on high-luminance fills (yellow/teal solid badges) — dark text for contrast |
| `--color-disabled-fill` | `rgba(240,239,248,0.06)` | Disabled control background |
| `--color-disabled-text` | `rgba(240,239,248,0.32)` | Disabled control label |
| `--color-scrim-nav` | `rgba(15,14,23,0.85)` | Bottom-nav backdrop (semi over content) |
| `--color-skeleton` | `rgba(240,239,248,0.06)` | Loading skeleton base |
| `--color-skeleton-shimmer` | `rgba(240,239,248,0.12)` | Skeleton shimmer highlight |

> Rule: a solid fill in **Yellow** or **Teal** (high luminance) uses `--color-on-accent` (dark) for its label; a solid **Purple** or **Coral** fill uses `--color-on-primary` (white). Never place `--color-text` (near-white) on a yellow/teal solid — it fails contrast.

### 2.3 Ready-to-use CSS custom properties

```css
/* tokens.css — Hustling Collaborators design system. Dark theme only. */
:root {
  color-scheme: dark;

  /* ---- Colour: PRD §6.2 (exact) ---- */
  --color-bg:               #0F0E17;
  --color-surface:          #1C1A2E;
  --color-primary:          #7B61FF;
  --color-campaign-coral:   #FF6B6B;
  --color-campaign-teal:    #00D4AA;
  --color-campaign-yellow:  #FFD60A;
  --color-campaign-lavender:#C4B5FD;
  --color-warning:          #FF6B6B;   /* alias of coral */
  --color-success:          #00D4AA;   /* alias of teal  */
  --color-text:             #F0EFF8;
  --color-text-muted:       #9896A8;
  --color-toast-border:     #7B61FF;

  /* ---- Colour: derived (alpha of the 12 above) ---- */
  --color-surface-2:        #252238;
  --color-border:           rgba(240,239,248,0.10);
  --color-border-strong:    rgba(240,239,248,0.18);
  --color-overlay:          rgba(15,14,23,0.72);
  --color-primary-hover:    rgba(123,97,255,0.88);
  --color-primary-press:    rgba(123,97,255,0.72);
  --color-primary-ghost:    rgba(123,97,255,0.14);
  --color-success-ghost:    rgba(0,212,170,0.14);
  --color-coral-ghost:      rgba(255,107,107,0.14);
  --color-yellow-ghost:     rgba(255,214,10,0.14);
  --color-lavender-ghost:   rgba(196,181,253,0.16);
  --color-on-primary:       #FFFFFF;
  --color-on-accent:        #0F0E17;
  --color-disabled-fill:    rgba(240,239,248,0.06);
  --color-disabled-text:    rgba(240,239,248,0.32);
  --color-scrim-nav:        rgba(15,14,23,0.85);
  --color-skeleton:         rgba(240,239,248,0.06);
  --color-skeleton-shimmer: rgba(240,239,248,0.12);

  /* ---- Typography: PRD §6.3 ---- */
  --font-head: "Plus Jakarta Sans", system-ui, sans-serif; /* headings + numbers */
  --font-body: "DM Sans", system-ui, sans-serif;           /* body */

  --fw-regular: 400;
  --fw-medium:  500;
  --fw-semibold:600;
  --fw-bold:    700;
  --fw-extrabold:800;

  /* type scale — size / line-height / tracking (px unless noted) */
  --type-hero-size: 40px;     --type-hero-lh: 46px;   --type-hero-track: -0.02em; /* greeting; 32px on <360w */
  --type-rank-size: 48px;     --type-rank-lh: 48px;   --type-rank-track: -0.03em; /* leaderboard rank */
  --type-stat-size: 32px;     --type-stat-lh: 36px;   --type-stat-track: -0.02em; /* stat-card number */
  --type-h1-size:   24px;     --type-h1-lh:   32px;   --type-h1-track:  -0.01em;  /* section heading */
  --type-h2-size:   20px;     --type-h2-lh:   28px;   --type-h2-track:  -0.005em;
  --type-cardtitle-size: 18px;--type-cardtitle-lh: 24px; --type-cardtitle-track: 0;/* card/campaign title */
  --type-cardtitle-sm-size: 16px; --type-cardtitle-sm-lh: 22px;
  --type-body-lg-size: 15px;  --type-body-lg-lh: 22px;
  --type-body-size: 14px;     --type-body-lh: 20px;
  --type-meta-size: 13px;     --type-meta-lh: 18px;   /* muted metadata */
  --type-meta-sm-size: 12px;  --type-meta-sm-lh: 16px;
  --type-toast-size: 14px;    --type-toast-lh: 20px;  /* DM Sans Medium */
  --type-button-size: 15px;   --type-button-lh: 20px; /* PJS SemiBold */

  /* ---- Spacing: 4px base grid ---- */
  --space-xxs: 2px;
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  12px;
  --space-base:16px;
  --space-lg:  20px;
  --space-xl:  24px;
  --space-2xl: 32px;
  --space-3xl: 40px;
  --space-4xl: 48px;
  --space-5xl: 64px;

  /* ---- Radii ---- */
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;   /* cards */
  --radius-xl: 20px;   /* hero cards, modals */
  --radius-2xl:24px;
  --radius-pill: 999px;
  --radius-circle: 50%;

  /* ---- Elevation, shadows & glows ---- */
  --shadow-card:  0 2px 8px rgba(0,0,0,0.35);
  --shadow-raised:0 6px 20px rgba(0,0,0,0.45);
  --shadow-modal: 0 12px 40px rgba(0,0,0,0.55);
  --shadow-nav:   0 -2px 16px rgba(0,0,0,0.40);
  --shadow-toast: 0 8px 28px rgba(0,0,0,0.50);
  --glow-purple:  0 0 0 1px #7B61FF, 0 0 16px rgba(123,97,255,0.45); /* active task */
  --glow-teal:    0 0 16px rgba(0,212,170,0.35);                     /* on-time success */
  --glow-coral:   0 0 16px rgba(255,107,107,0.40);                   /* overdue */
  --glow-yellow:  0 0 20px rgba(255,214,10,0.35);                    /* rank #1 */
  --focus-ring:   0 0 0 2px #0F0E17, 0 0 0 4px #7B61FF;              /* dark gap + purple */

  /* ---- Motion ---- */
  --dur-instant:   100ms;
  --dur-fast:      150ms;
  --dur-base:      220ms;
  --dur-slow:      320ms;
  --dur-celebrate: 480ms;   /* task complete pop, rank change */
  --dur-toast-in:  280ms;
  --dur-toast-out: 240ms;
  --dur-toast-hold:3000ms;  /* PRD §6.5: sits 3s */
  --dur-pulse:     2000ms;  /* overdue pulse cycle */
  --ease-standard:   cubic-bezier(0.2, 0, 0, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0, 1);
  --ease-accelerate: cubic-bezier(0.3, 0, 1, 1);
  --ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1); /* celebrate pop */
  --ease-pulse:      ease-in-out;

  /* ---- Z-index ---- */
  --z-base: 0;
  --z-sticky-header: 90;
  --z-bottom-nav: 100;
  --z-overlay: 1000;
  --z-modal: 1001;
  --z-toast: 1100;   /* toast sits above modals so it is never hidden */

  /* ---- Layout ---- */
  --content-max: 480px;       /* member screens: single centred column on tablet+ */
  --content-max-admin: 1200px;/* admin console / manager tables */
  --nav-height: 64px;
  --header-height: 56px;
  --hit-min: 44px;            /* minimum touch target */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --dur-instant: 0ms; --dur-fast: 0ms; --dur-base: 0ms; --dur-slow: 0ms;
    --dur-celebrate: 0ms; --dur-toast-in: 0ms; --dur-toast-out: 0ms; --dur-pulse: 0ms;
  }
  /* Transforms become instant opacity swaps; infinite pulses are disabled (see §7.4). */
}

@media (max-width: 359px) {
  :root { --type-hero-size: 32px; --type-hero-lh: 38px; --type-rank-size: 40px; --type-rank-lh: 40px; }
}
```

### 2.4 Typography scale (PRD §6.3 → named roles)

| Role token | Font | Weight | Size / LH | Tracking | Case | Used for |
|---|---|---|---|---|---|---|
| `type-hero` | Plus Jakarta Sans | 800 ExtraBold | 40/46 (32/38 <360w) | −0.02em | Sentence | Home greeting, hero numbers |
| `type-rank` | Plus Jakarta Sans | 800 ExtraBold | 48/48 | −0.03em | **UPPER allowed** | Leaderboard rank number only (§6.7 exception) |
| `type-stat` | Plus Jakarta Sans | 800 ExtraBold | 32/36 | −0.02em | Sentence | Stat-card big number |
| `type-h1` | Plus Jakarta Sans | 700 Bold | 24/32 | −0.01em | Sentence | Section headings |
| `type-h2` | Plus Jakarta Sans | 700 Bold | 20/28 | −0.005em | Sentence | Sub-section headings |
| `type-card-title` | Plus Jakarta Sans | 600 SemiBold | 18/24 | 0 | Sentence | Campaign name, card title |
| `type-card-title-sm` | Plus Jakarta Sans | 600 SemiBold | 16/22 | 0 | Sentence | Task title, dense card title |
| `type-body-lg` | DM Sans | 400 Regular | 15/22 | 0 | Sentence | Primary body |
| `type-body` | DM Sans | 400 Regular | 14/20 | 0 | Sentence | Task descriptions, list body |
| `type-meta` | DM Sans | 400 Regular | 13/18 | +0.005em | Sentence | Dates, subtitles (muted colour) |
| `type-meta-sm` | DM Sans | 400 Regular | 12/16 | +0.01em | Sentence | Fine print, chip subtext |
| `type-toast` | DM Sans | 500 Medium | 14/20 | 0 | Sentence | Meme-toast text |
| `type-button` | Plus Jakarta Sans | 600 SemiBold | 15/20 (16 on lg) | 0 | Sentence | All button labels |

Google Fonts load (self-host the woff2 in `/public/fonts` to keep the CSP/offline shell working — do **not** hotlink):
`Plus Jakarta Sans` weights 600/700/800; `DM Sans` weights 400/500. Preload the two most-used files (`PlusJakartaSans-ExtraBold`, `DMSans-Regular`).

### 2.5 Spacing scale

4px base grid. Component internal padding and gaps use only these tokens.

| Token | px | Typical use |
|---|---|---|
| `--space-xxs` | 2 | Icon-to-text nudge, chip inner |
| `--space-xs` | 4 | Tight gaps inside chips/badges |
| `--space-sm` | 8 | Gap between related items, chip padding-y |
| `--space-md` | 12 | Card inner row gaps, list-item padding |
| `--space-base` | 16 | Card padding, screen horizontal gutter (mobile) |
| `--space-lg` | 20 | Section gaps, card padding (roomy) |
| `--space-xl` | 24 | Between screen sections |
| `--space-2xl` | 32 | Above a hero block |
| `--space-3xl` | 40 | Splash vertical rhythm |
| `--space-4xl` | 48 | Empty-state vertical centring |
| `--space-5xl` | 64 | Splash logo top offset |

Screen gutter: **16px** on mobile (`--space-base`), **24px** on ≥600px. Bottom scroll padding must include `--nav-height` + `--safe-bottom` so content is never hidden behind the nav.

### 2.6 Radii

| Token | px | Applied to |
|---|---|---|
| `--radius-xs` | 6 | Chips, tags, small badges |
| `--radius-sm` | 8 | Inputs, day-chips |
| `--radius-md` | 12 | Buttons, list rows |
| `--radius-lg` | 16 | Cards (task, campaign, stat) |
| `--radius-xl` | 20 | Hero cards, modals, bottom sheet top |
| `--radius-2xl` | 24 | Splash logo lockup container |
| `--radius-pill` | 999 | Toast, leave pill, check-in pill, chips-as-pills |
| `--radius-circle` | 50% | Avatars, arc rings, FAB |

### 2.7 Elevation, shadows & glows

Dark UI reads depth from **surface lift + subtle black shadow + coloured glow for meaning**, not heavy drop shadows.

| Token | Value | Applied to |
|---|---|---|
| `--shadow-card` | `0 2px 8px rgba(0,0,0,.35)` | Resting cards |
| `--shadow-raised` | `0 6px 20px rgba(0,0,0,.45)` | Pressed/dragged card, popover |
| `--shadow-modal` | `0 12px 40px rgba(0,0,0,.55)` | Modals, bottom sheets |
| `--shadow-nav` | `0 -2px 16px rgba(0,0,0,.40)` | Bottom nav top edge |
| `--shadow-toast` | `0 8px 28px rgba(0,0,0,.50)` | Meme toast |
| `--glow-purple` | inset purple ring + soft bloom | **Active task** ("On it" state) — the visual substitute for a timer (§7.2) |
| `--glow-teal` | teal bloom | On-time success moment |
| `--glow-coral` | coral bloom | Overdue campaign |
| `--glow-yellow` | yellow bloom | Leaderboard #1 hero |
| `--focus-ring` | dark gap + purple ring | `:focus-visible` on every interactive element |

### 2.8 Motion tokens (P6 — one animation per key moment)

| Moment | Token(s) | Spec |
|---|---|---|
| Micro-interaction (tap feedback, chip toggle) | `--dur-fast` + `--ease-standard` | scale 0.98 press, opacity |
| Screen/route transition | `--dur-base` + `--ease-standard` | 12px slide + fade |
| **Task completion** ("Nailed it") | `--dur-celebrate` + `--ease-spring` | Checkmark scales 0.6→1.0 with spring; card border pulses teal once; on-time meme toast fires |
| **Rank change** (leaderboard) | `--dur-celebrate` + `--ease-standard` | Row slides to new position; arrow fades in; rank meme fires |
| **Overdue flip** (campaign) | `--dur-slow` + `--ease-standard`, then `--dur-pulse` loop | Border colour crossfades to coral; indicator dot pulses (opacity 1→0.4→1) every 2s |
| **Check-in confirm** | `--dur-base` + `--ease-spring` | Pill fills teal (or coral for late), check icon pops; check-in meme fires |
| **Leave approval** | `--dur-base` | Toast with tiny HC stamp slides up |
| Toast lifecycle | `--dur-toast-in` in, `--dur-toast-hold` hold, `--dur-toast-out` out | See §5 |

Everything not in this table is **static** (P6). Reduced-motion collapses all durations to 0 and disables the pulse loop (§7.4).

### 2.9 Z-index

`base 0 < sticky-header 90 < bottom-nav 100 < overlay 1000 < modal 1001 < toast 1100`. Toast is deliberately above modals so a confirmation (e.g. leave approved inside a modal) is still visible.

### 2.10 Iconography (§6.1)

- **Outline icons only.** Stroke 1.75px, 24×24 grid, round caps/joins. No filled icons, no illustrations, no emoji-as-icon (emoji live only in meme copy and inline microcopy).
- Recommended set: Lucide (MIT, tree-shakeable, self-hostable — matches CSP/offline).
- Icon colour inherits `currentColor`; default `--color-text-muted`, active `--color-primary` or the contextual accent.
- Nav icons: 24px. Inline meta icons: 16px. Every icon-only control needs an `aria-label` (§7.5).

### 2.11 Breakpoints

| Name | Range | Behaviour |
|---|---|---|
| `mobile` | ≤600px | Mobile-first default. Single column, 16px gutter, bottom nav. |
| `tablet` | 601–1024px | Member screens: centre a `--content-max` (480px) column, 24px gutter. Bottom nav persists. |
| `desktop` | >1024px | Member screens stay centred 480px (it is a phone-first tool). **Admin console / manager tables** expand to `--content-max-admin` (1200px) with a left rail instead of bottom nav. |

---

## 3. Component Inventory

Each component lists: **anatomy**, **props**, **states**, **tokens**, and **microcopy**. Props use TS-ish notation. `frame` (§1.3) appears wherever a metric is shown.

### 3.0 Component index

Buttons · Stat card · Campaign card · Campaign tag pill · Task card · Avatar · Badge/streak · Meme toast · Bottom nav · Leaderboard row + rank hero · Attendance day-chip · Leave arc rings · Leave-balance pill · Salary/deductions card · Check-in pill · WFH toggle · Notification list item · Empty state · Modal / confirm dialog · Type-name-to-delete dialog · Form controls · Skeleton loader.

---

### 3.1 Buttons

**Variants:** `primary` · `secondary` (ghost) · `on-it` · `nailed-it` · `destructive` · `link`. **Sizes:** `sm` (36px), `md` (44px), `lg` (52px). Min height honours `--hit-min` (44px) — `sm` is only for dense contexts where the full row is a 44px hit target.

```ts
interface ButtonProps {
  variant: "primary" | "secondary" | "on-it" | "nailed-it" | "destructive" | "link";
  size?: "sm" | "md" | "lg";            // default "md"
  label: string;                         // sentence case (P: no all-caps)
  leadingIcon?: IconName;                // outline only
  disabled?: boolean;
  loading?: boolean;                     // shows spinner, keeps width, disables input
  fullWidth?: boolean;
  onPress: () => void;
  ariaLabel?: string;                    // required if label is icon-only
}
```

| Variant | Fill | Label colour | Border | Radius | Notes |
|---|---|---|---|---|---|
| `primary` | `--color-primary` | `--color-on-primary` (#FFF, DD‑4) | none | `--radius-md` | Label ≥16px 600 → passes AA large/UI (§7.1) |
| `secondary` | `--color-primary-ghost` | `--color-primary` | 1px `--color-border-strong` | `--radius-md` | Low-emphasis, cancel |
| `on-it` | `--color-primary-ghost` | `--color-primary` | 1px `--color-primary` @40% | `--radius-pill` | Label **"On it 🔥"** (§7.2). Toggles task to active. |
| `nailed-it` | `--color-success-ghost` | `--color-campaign-teal` | 1px teal @40% | `--radius-pill` | Label **"Nailed it ✅"**. On press → celebrate anim (§2.8). |
| `destructive` | transparent | `--color-campaign-coral` | 1px coral @45% | `--radius-md` | Delete actions; still gentle copy |
| `link` | none | `--color-primary` | none | — | Inline text action |

**States (all variants):**

| State | Treatment |
|---|---|
| Default | as table |
| Hover (pointer) | fill → `--color-primary-hover` (primary) / +6% brightness (others) |
| Active/pressed | `transform: scale(.98)`, fill → `--color-primary-press` |
| Focus-visible | `box-shadow: var(--focus-ring)` |
| Disabled | fill `--color-disabled-fill`, text `--color-disabled-text`, no shadow, `cursor:not-allowed`, `aria-disabled` |
| Loading | inline 16px spinner (border spin, `--dur-base` linear infinite — allowed as a busy indicator, exempt from P6), label hidden but width preserved, `aria-busy` |

---

### 3.2 Stat card (Home, 2-col grid)

Home shows exactly two: **today's task count** and **current leaderboard rank** (§6.4). Big number allowed (P4) because it carries a label.

```ts
interface StatCardProps {
  kind: "tasks-today" | "rank";
  value: string;          // "3"  |  "#2"
  label: string;          // "tasks on your plate" | "on the board this month"
  caption?: string;       // interpretation line (P4)
  accent: "primary" | "teal" | "yellow";
  icon: IconName;
  onPress?: () => void;   // navigates to Tasks / Leaderboard
}
```

- **Anatomy:** `--color-surface` card, `--radius-lg`, `--space-base` padding; top row = 16px outline icon (accent colour) + tiny label; big `type-stat` number in accent colour; `type-meta` caption in `--color-text-muted`.
- **Grid:** `grid-template-columns: 1fr 1fr; gap: var(--space-md);`
- **Copy examples:** tasks-today → value `"3"`, label `"on your plate today"`, caption `"Let's knock 'em out 🎯"`. Empty variant (0 tasks) → value `"0"`, caption `"Fresh slate — add your first task"`. rank → value `"#2"`, label `"on the board this month"`, caption `"climbing 🚀"`.
- **States:** loading = skeleton block (number + 2 lines); pressable → `--shadow-raised` on press.

---

### 3.3 Campaign card

Two colour layers (DD‑3): **identity accent** (fixed) + **proximity signal** (time-driven). No ticking clock — day-granularity label (DD‑1).

```ts
interface CampaignCardProps {
  clientName: string;                 // "Sugar Cosmetics"
  identityColor: "coral"|"teal"|"yellow"|"lavender"; // assigned at creation
  lead: { name: string; avatarUrl?: string };
  memberCount: number;
  proximity: "on-track" | "coming-up" | "due-today" | "overdue" | "delivered";
  daysLabel: string;                  // "5 days left" | "Due today" | derived, day-granularity
  onPress: () => void;
}
```

**Anatomy (top→bottom):**
- Left **16px identity border** in the identity colour (`--space-base` = accent stripe), card body `--color-surface`, `--radius-lg`, `--shadow-card`, padding `--space-base` (left padding +16 for stripe).
- Row 1: **client name** `type-card-title`, `--color-text`.
- Row 2: lead **avatar** (24px) + lead name `type-meta` + member count `type-meta` muted → `"Priya · +3 members"`.
- Row 3 (bottom-right aligned): **proximity pill** (see below).

**Proximity pill (DD‑1/DD‑2):**

| `proximity` | Trigger (IST, day granularity) | Pill fill | Pill text colour | Label | Card border override |
|---|---|---|---|---|---|
| `on-track` | ≥5 days to deadline | `--color-success-ghost` | teal | "On track" | none (identity stripe only) |
| `coming-up` | 1–4 days | `--color-yellow-ghost` | yellow | "Coming up" | none |
| `due-today` | deadline == today | `--color-coral-ghost` | coral | "Due today" | 1px coral |
| `overdue` | past deadline | `--color-coral-ghost` | coral | **"This one needs your attention 🔴"** (§7.2) | 1px coral + **pulse** |
| `delivered` | marked delivered | `--color-lavender-ghost` | lavender | "Delivered ✅" | none; card body → 88% opacity |

**Overdue pulse:** an 8px dot before the label pulses opacity `1→0.4→1` over `--dur-pulse`, `--ease-pulse`, infinite. Disabled under reduced-motion (static solid dot). SR text: `"Overdue — needs attention"`.

**States:** loading = skeleton with stripe + 3 lines. Pressable → `--shadow-raised`.

---

### 3.4 Campaign tag pill (on task cards & pickers)

```ts
interface CampaignTagProps { name: string; color: "coral"|"teal"|"yellow"|"lavender"; size?: "sm"|"md"; }
```
- Pill, `--radius-pill`, ghost fill of the campaign colour, text in the campaign colour, `type-meta-sm`, leading 8px dot. Prefixed `@`: `"@Sugar Cosmetics"` (§8.1). Padding `2px 8px`.

---

### 3.5 Task card

States: **idle** → **active-glow** → **completed-faded** (§6.4). No clock, ever (P3) — active work reads as glow (§7.2).

```ts
interface TaskCardProps {
  title: string;                 // "100 profiles shortlisting"
  campaign?: CampaignTagProps;
  estimateLabel: string;         // "~30 min planned"  (self-set, no live timer)
  state: "idle" | "active" | "completed";
  outcome?: "on-time" | "over";  // only when completed; NEVER shown as negative to member
  onOnIt: () => void;
  onNailedIt: () => void;
  isOwn: boolean;                // members only act on own tasks
}
```

**Anatomy:** `--color-surface` card, `--radius-lg`, padding `--space-base`.
- Row 1: **title** `type-card-title-sm`, `--color-text`.
- Row 2: campaign tag pill + estimate `type-meta` muted (`"~30 min planned"` — the word *planned*, never a running count).
- Row 3: action — idle shows **On it 🔥**; active shows **Nailed it ✅**; completed shows a static teal check + `"Done 🎯"`.

| State | Card treatment | Action shown | Motion |
|---|---|---|---|
| `idle` | resting surface | `on-it` button | none |
| `active` | `box-shadow: var(--glow-purple)`; 1px purple border; subtle background warmth (`--color-primary-ghost` at 6%) | `nailed-it` button | glow fades in over `--dur-base` |
| `completed` (on-time) | opacity 0.55, teal check | static "Done 🎯" | celebrate pop once on transition (§2.8), teal border flash |
| `completed` (over est.) | opacity 0.55, muted check | static "Done ✅" — **no red, no "late" word** (§8.2) | quiet fade, no flag |

**Completed stack:** completed tasks sink to the bottom of the list at 0.55 opacity (§6.4). Reordering animates `--dur-base`.

**Admin/Manager on someone else's task:** adds a small "edit" affordance and (Admin) manual-done with completion-time entry (§4.1) — see Admin console §4.12.

---

### 3.6 Avatar

```ts
interface AvatarProps { name: string; url?: string; size?: 24|32|40|56|72; ring?: "none"|"primary"|"gold"; }
```
- Circle, `--radius-circle`. With `url` → image cover. Without → initials on `--color-surface-2`, `type-card-title-sm`, `--color-text`. `ring="gold"` (2px `--color-campaign-yellow`) for leaderboard #1; `ring="primary"` for active/self. `alt` = name.

### 3.7 Badge / streak badge

```ts
interface BadgeProps { kind:"streak"|"rank1"|"personal-best"|"count"; label:string; tone:"yellow"|"teal"|"purple"|"coral"|"lavender"; icon?:IconName; }
```
- Pill, ghost fill of tone, tone-coloured text, `type-meta-sm`. Streak example `"4-month on-time streak 🔥"` (§14.2). #1 badge uses solid `--color-campaign-yellow` with `--color-on-accent` (dark) text (§2.2 rule).

---

### 3.8 Meme toast

The signature component. Full engine in §5; anatomy here.

```ts
interface MemeToastProps {
  eventKey: MemeEventKey;   // one of the 17 keys, §5.3
  emoji: string;            // parsed from the chosen line (leading/trailing)
  text: string;             // chosen line, DM Sans Medium 14
  stamp?: boolean;          // true only for leave_approved / comp_off_approved → tiny HC mark (§6.8)
}
```
- **Anatomy:** rounded pill, `--color-surface` bg, **1px `--color-toast-border`** (Electric Purple), `--radius-pill`, `--shadow-toast`, padding `10px 16px`, gap `--space-sm`. Left: emoji (or HC stamp if `stamp`). Right: `type-toast` text, `--color-text`. **Width fits text, max 90vw, centred** (§6.5).
- **Placement:** fixed, bottom, `bottom: calc(var(--nav-height) + var(--safe-bottom) + var(--space-md))` so it floats just above the bottom nav; horizontally centred.
- **Timing:** slide up `--dur-toast-in` (`translateY 24px→0` + fade) → hold `--dur-toast-hold` (3s) → slide down `--dur-toast-out`. Non-blocking (`pointer-events:none` on the container; the toast itself is not interactive). `role="status"`, `aria-live="polite"`.

---

### 3.9 Bottom navigation (5 tabs — hard cap, §6.7)

Tabs, in order: **Home · Tasks · Campaigns · Attendance · Profile** (§6.4). Never a 6th (P: never >5).

```ts
interface BottomNavProps { active: "home"|"tasks"|"campaigns"|"attendance"|"profile"; badges?: Partial<Record<Tab, number>>; }
```
- **Anatomy:** fixed bottom bar, height `--nav-height` + `--safe-bottom` padding, `--color-surface` @ `--color-scrim-nav` backdrop-blur(12px), `--shadow-nav`, top hairline `--color-border`. 5 equal columns.
- **Item:** 24px outline icon + 11px label. Inactive `--color-text-muted`; active icon+label `--color-primary` on a `--color-primary-ghost` pill behind the icon. Hit target ≥ `--hit-min` full height.
- **Badge:** small coral dot (unread notification / pending approval) top-right of icon; `aria-label` includes count.
- **Admin/Manager:** the console and manager views are reached from **Profile** (or a left rail on desktop), **not** a 6th tab.
- `role="tablist"`, each item `role="tab"` + `aria-selected` + `aria-label`.

---

### 3.10 Leaderboard row + rank hero

Scoreboard energy (§6.4, §14.2). Two sub-components.

**Rank hero (top 3):**
```ts
interface RankHeroProps {
  rank: 1|2|3; person:{name:string;avatarUrl?:string};
  score: number;               // 0–100, one clean number (§6.4 exception)
  movement: "up"|"down"|"same"|"new"; movementDelta?: number;
  streakLabel?: string;        // "4-month streak 🔥"
  personalBest?: boolean;
}
```
- **#1** centred and largest: avatar 72px with gold ring, **rank number `type-rank` (48px ExtraBold)** in `--color-campaign-yellow`, `--glow-yellow` behind, #1 badge, name `type-card-title`, score as `"92"` big + `"/100"` small muted. **UPPERCASE allowed on the rank number only.**
- **#2/#3** flanking, avatar 56px, rank 48px in `--color-primary`.
- **Movement:** up = teal ▲ + `+n`; down = coral ▼ + `-n`; same = grey dash; new = lavender "new". SR text `"moved up 2 places"` etc.

**Leaderboard row (rank 4+):**
```ts
interface LeaderRowProps { rank:number; person; score:number; movement; streakLabel?:string; personalBest?:boolean; isMe?:boolean; frame:"insight"|"coaching"; }
```
- Row: `--color-surface`, `--radius-md`. Left: rank `type-h2` muted. Avatar 40px. Name + streak/PB badge under. Right: score `type-h2` + `/100` muted + movement arrow.
- `isMe` → 1px `--color-primary` border + `--color-primary-ghost` tint.
- **`frame="insight"` (member):** one line of interpretation under the score, e.g. `"crushing it on deadlines, building your streak"` (§7.2). **`frame="coaching"` (manager/admin):** expands the 3 factor sub-scores (attendance / estimate / delivery) as small numbers.

---

### 3.11 Attendance calendar & day-chip

Month grid (§6.4). One chip per day.

```ts
interface DayChipProps {
  date: string;                    // ISO, IST
  status: "on-time"|"late"|"wfh"|"off"|"upcoming"|"present-override"|"absent"|"half-day"|"holiday-mandatory"|"holiday-optional";
  isToday?: boolean;
  hasRemark?: boolean;             // admin/self remark exists
  label?: string;                  // holiday name on hover/tap
}
```

**Colour states (§6.4 + §9.1):**

| status | Chip fill | Text | Meaning |
|---|---|---|---|
| `on-time` | `--color-success-ghost`, teal text | teal | Checked in ≤10:45 IST |
| `late` | `--color-coral-ghost`, coral text | coral | Checked in >10:45 |
| `wfh` | `--color-lavender-ghost`, lavender text | lavender | WFH day confirmed |
| `off` | transparent, muted text | muted | Sunday / 4th Saturday |
| `holiday-mandatory` | `--color-surface-2`, muted + tiny dot | muted | Company holiday |
| `holiday-optional` | `--color-surface-2`, muted + hollow dot | muted | Optional holiday |
| `upcoming` | transparent, `--color-text` | white | Future working day (§6.4 "white = upcoming") |
| `half-day` | teal/coral split | — | 0.5 day (see OQ‑22) |
| `absent` | coral outline | coral | Admin-marked absent |
| `present-override` | teal outline | teal | Admin override |

- **Chip:** 40×40, `--radius-sm`, day number `type-body` centred, status colour. **Today:** 2px `--color-primary` ring. **Remark:** 4px dot bottom-centre; tap opens remark sheet (self can read; Admin can edit/delete §4.2). SR label combines date+status+remark.
- **Grid:** 7-col, `gap: var(--space-xs)`, weekday header row muted. Month title `type-h1` with ‹ › month steppers.
- **No timer anywhere** on this screen (P3).

**Leave arc rings (Profile, §6.4):** overlapping comp-off (purple) + PL (teal) arcs.
```ts
interface LeaveArcProps {
  plBalance: number; plEntitlement: number;      // 18 FT / 4 intern
  compOffBalance: number;                         // no cap → COMPOFF_RING_MAX=8 (DD-5)
  centerLabel: string;                            // "7 in the bank"
}
```
- **SVG spec:** two concentric circles, viewBox 120×120, centre (60,60).
  - **Outer (PL, teal):** r=52, stroke-width 10, track `--color-border`, progress `--color-campaign-teal`, `strokeDasharray = 2π·52 = 326.7`, `strokeDashoffset = 326.7 · (1 − plBalance/plEntitlement)`, start at 12 o'clock (`transform: rotate(-90deg)`), round caps.
  - **Inner (comp-off, purple):** r=38, stroke-width 10, track `--color-border`, progress `--color-primary`, `dasharray = 2π·38 = 238.8`, `offset = 238.8 · (1 − min(compOffBalance,8)/8)`. If `compOffBalance>8` → full ring + `"8+"` glyph.
  - **Centre:** combined available (`comp-off + PL`) as `type-stat` + `type-meta` label `"leaves in the bank"`.
- Legend below: teal dot `"PL: {plBalance}"`, purple dot `"Comp-off: {compOffBalance}"` — numbers here are OK (own data, factual balance), still paired with a positive pill on Home (§3.13).

---

### 3.12 Check-in pill & WFH toggle

**GPS check-in pill (Attendance top, §6.4):** large pill, full width, `--radius-pill`, height 52px.
```ts
interface CheckInPillProps {
  dayType: "office"|"wfh"|"off";
  status: "not-checked-in"|"checking"|"checked-in-on-time"|"checked-in-late"|"denied"|"error";
  onCheckIn: () => void;   // calls navigator.geolocation.getCurrentPosition
}
```
| status | Fill | Label |
|---|---|---|
| not-checked-in (office) | `--color-primary` | `"Check in 📍"` |
| checking | primary, spinner | `"Getting your location…"` |
| checked-in-on-time | `--color-success-ghost`, teal border, `--glow-teal` | `"Checked in ✅ You're on time"` |
| checked-in-late | `--color-coral-ghost`, coral border | `"Checked in ✅ A little late, no stress"` |
| denied | secondary | `"Turn on location to check in — we only look once 📍"` (gentle, §9.1) |
| error | secondary | `"Couldn't reach GPS — try once more?"` |

- Confirm animation: pill fills + check pops (`--dur-base`, `--ease-spring`); fires `checkin_on_time` / `checkin_late` (and `monday_first_checkin` if first check-in of ISO week is Monday) meme.

**WFH toggle (2nd Saturday / Admin-granted, §9.1):** shown only on WFH days.
- Copy: **"Working from home today 🏠 — tap to confirm"** (§7.2). On confirm → lavender, `wfh_checkin` meme. No GPS. No late cutoff (OQ‑7 assumption).

---

### 3.13 Leave-balance pill (Home)

Bottom of Home (§6.4). Positive framing (P2/P4).
```ts
interface LeavePillProps { available: number; onPress: ()=>void; } // available = compOff+PL
```
- Pill, `--color-surface`, `--radius-pill`, leading 🏖️. Copy: `"You've got {available} leaves in the bank 🏖️"`; 0 → `"No leaves banked yet — they'll build up 🌱"`; probation → `"Leave unlocks after your probation — hang tight 🌱"`. Tap → Profile leave arc.

### 3.14 Salary / deductions card (Profile — self/RM/Admin only, §5, §13)

```ts
interface SalaryCardProps {
  baseSalary: number; workingDays: number; lwpDays: number;
  lateAsLwpDays: number; advanceLeaveDebtDays: number;
  frame:"insight"|"coaching";
}
```
- Card `--color-surface`, `--radius-lg`. Rows (₹, IST FY context):
  - Base salary — `₹30,000`
  - Unpaid leave (LWP) — `−₹2,727.27` with sub `"(2 of 22 days)"` (Appendix A.6)
  - Late-as-LWP (if any) — `−₹…`
  - Advance-leave debt — `1 day ≈ ₹1,363.64 outstanding`
  - **Net estimated** `type-h2` — `≈ ₹27,272.73`
- **Mandatory footer chip:** `"This is an estimate, not a payslip — no PF/ESI/TDS here"` (§13). Never omit.
- Visibility: hidden entirely for non-self / non-RM / non-Admin.

### 3.15 Notification list item (in-app only, §2.2)

```ts
interface NotifItemProps { type:"overdue"|"comp-off-request"|"leave-decision"|"comp-off-credited"; title:string; body:string; ts:string; read:boolean; onPress:()=>void; }
```
- Row `--color-surface`; unread → leading coral dot + slight tint. Title `type-card-title-sm`, body `type-body` muted, relative IST time `type-meta-sm` (`"2h ago"`). Icon by type. All copy positive/gentle.

### 3.16 Empty state (invitations, §7.3)

```ts
interface EmptyStateProps { illustrationless:true; icon:IconName; headline:string; sub?:string; cta?:{label:string;onPress:()=>void}; }
```
- Centred, `--space-4xl` vertical. 40px outline icon (muted), headline `type-h2`, sub `type-body` muted, optional primary CTA. **Never** "No data" / "Empty". Examples in §4 per screen.

### 3.17 Modal / confirm dialog

```ts
interface ModalProps { title:string; body?:ReactNode; primary:{label:string;variant:ButtonVariant;onPress:()=>void}; secondary?:{label:string;onPress:()=>void}; onDismiss:()=>void; tone?:"default"|"destructive"; }
```
- Bottom sheet on mobile (`--radius-xl` top, slides up `--dur-base`), centred dialog on ≥600px. Scrim `--color-overlay`, `--shadow-modal`. Focus trapped; `Esc`/scrim dismiss; `role="dialog"` `aria-modal`. Destructive tone → primary is `destructive` variant, copy still gentle.

### 3.18 Type-name-to-delete dialog (§4.5 — the only delete safeguard)

Profile deletion requires typing the exact name (§4.5).
```ts
interface DeleteProfileDialogProps { employeeName:string; onConfirm:()=>void; onCancel:()=>void; }
```
- Title: `"Delete {employeeName}'s profile?"`. Body: `"This removes their profile and all associated data permanently. There's no undo."` (honest, no audit trail §4.5). Input labelled `"Type “{employeeName}” to confirm"`. **Delete button disabled** until input === exact name (case-sensitive, trimmed). Enabled → `destructive` variant `"Delete permanently"`. This gate is required **only** for profile delete; all other deletes are immediate (§4.5, L2).

### 3.19 Form controls (leave/comp-off/task/admin forms)

| Control | Spec |
|---|---|
| Text input | `--color-surface-2` fill, 1px `--color-border-strong`, `--radius-sm`, 44px, `type-body`, label above `type-meta`, focus → `--focus-ring`, error → coral border + gentle helper |
| Textarea (reason) | as input, min 3 rows |
| Select / picker | native-styled trigger; campaign picker lists **only campaigns the user belongs to** (§8.1); opens bottom sheet on mobile |
| Date / date-range | IST calendar sheet; disables invalid dates (e.g. comp-off past dates blocked, §9.4); shows off-days/holidays inline |
| Estimate input | number + unit toggle (min/hr), no live timer implication; helper `"just your best guess 🙂"` |
| Toggle/switch | 44px hit, track `--color-border-strong` → `--color-primary` on |
| Radio/segmented (leave type) | segmented pills, active `--color-primary-ghost` |

### 3.20 Skeleton loader

- Blocks in `--color-skeleton` with a shimmer sweep (`--color-skeleton-shimmer`, `--dur-slow` linear infinite; disabled under reduced-motion → static). Match the real component's shape (card → card skeleton, list → 3–5 row skeletons). Never a full-screen spinner for content (only the check-in GPS call uses an inline spinner).

---

## 4. Screen-by-Screen Specs

Template per screen: **Route / entry · Roles · Layout grid · Content (ordered) · States (loading / empty / error / success) · Interactions · Microcopy (exact) · Meme triggers.** All times/dates IST. Mobile-first; ≥600px centres the 480px column unless noted.

### 4.1 Splash / Login

- **Route:** `/` (unauth) → `/login`. Entry: app open, expired session (A1).
- **Roles:** all (pre-auth).
- **Layout:** full-bleed `--color-bg`. Vertically centred column, 24px gutter, safe-area padded.
- **Content:**
  1. **HC white logo** centred (§6.8 — logo on deep-space is the first thing seen every open). ~140px wide, `--space-5xl` from top.
  2. Wordmark tagline (optional) `type-meta` muted `"Hustle. Together."`
  3. Login card (`--color-surface`, `--radius-xl`, `--space-lg`): email input, password input, **primary** `"Let's go 🚀"` full-width, `link` `"Forgot password?"`.
- **States:**
  - *Loading (splash):* logo only, subtle fade-in (`--dur-slow`), while session check runs. If valid session → route to Home (no login shown).
  - *Empty:* n/a.
  - *Error (bad credentials, A1):* gentle inline under the button — `"Hmm, that didn't match. Try again? 🙂"` (P: never punitive). No lockout copy.
  - *Success:* fade to Home `--dur-base`.
- **Interactions:** Enter submits; button → loading spinner; on success issue token, route Home.
- **Meme triggers:** none on login itself. First Home load may fire `monday_first_checkin` context is on Attendance, not here.

### 4.2 Home / Dashboard

- **Route:** `/home`. Tab: Home. **Roles:** all (own data; Admin/Manager see own Home + entry to consoles via Profile).
- **Layout (mobile):** vertical stack, 16px gutter, scroll padded for nav.
  1. Header row: **small HC white logo top-left** (§6.8) above greeting; **date top-right** `type-meta` muted (`"Sat, 1 Aug"`, IST).
  2. **Greeting** `type-hero`: **"Hey Hustler {FirstName}, Let's go 🚀"** (§6.4).
  3. **Stat grid** (2-col, §3.2): tasks-today · rank.
  4. **Focus card** (§12) — `"Today's Focus: {Xh Ym} in the zone 🎯"` + 5-day trend row labelled `"Your focus this week"` (no %). If day not closed yet → `"Focus lands at day's end 🌙"`.
  5. **Most-urgent active campaign card** (§3.3) — the single most urgent (nearest/overdue) campaign the member belongs to (§6.4).
  6. **Leave-balance pill** (§3.13) at bottom.
- **States:**
  - *Loading:* skeletons for greeting (2 lines), stat grid (2 cards), focus, campaign, pill.
  - *Empty:* no tasks → tasks-today stat shows `0` + caption `"Fresh slate — add your first task"`; no campaigns → campaign slot becomes an empty invite `"No campaigns yet — they'll show up here"`.
  - *Error:* per-section soft retry chip `"Couldn't load this — tap to retry"`; never a full-page error.
  - *Success:* normal.
- **Interactions:** stat cards navigate (Tasks / Leaderboard); campaign card → Campaign detail; pill → Profile. Pull-to-refresh.
- **Meme triggers:** on first open of the day, no auto-meme (memes are action-driven). If arriving right after check-in, the check-in meme is already shown on Attendance.
- **Frame:** `insight` always on Home.

### 4.3 Tasks

- **Route:** `/tasks`. Tab: Tasks. **Roles:** Team Member (own); Campaign Lead sees own tasks here (campaign roll-up is in Campaign detail); Admin/Manager act on others via console.
- **Layout:**
  1. Section header `type-h1`: **"Kya plan hai aaj ka? 🎯"** (§6.4).
  2. Sub-line `type-meta` muted: today's date + off-day indicator if applicable (`"Sunday — off day. Log freely, no pressure 🌤️"`, §8.3) — **no** hours counter (§9.4 step 3, G6).
  3. **Active/idle task cards** (§3.5) in a scrolling column; active card glows.
  4. **Completed** tasks stacked at bottom at 0.55 opacity, under a divider `"Done today"`.
  5. **FAB / add button** bottom-right above nav: `"+ Add task"` → task-create sheet.
- **Task-create sheet:** title input, campaign picker (only campaigns you belong to, §8.1), estimate input (min/hr). Primary `"Add it"`. Available every day incl. off-days (§8.1). No comp-off gating (§8.1).
- **States:**
  - *Loading:* 3 task-card skeletons.
  - *Empty (morning, no tasks):* empty-state invitation — headline `"Ready for today?"`, sub `"Add your first task and let's get the day going"`, CTA `"+ Add your first task"`. **Also fires `empty_task_list` meme** on first view of an empty list that morning (§6.6).
  - *Error:* soft retry.
  - *Success:* task added slides in `--dur-base`.
- **Interactions:**
  - **On it 🔥** → card → active glow; `start_ts` recorded silently IST (§8.2). No timer shown (P3).
  - **Nailed it ✅** → `end_ts`; `actual = end − start`; celebrate pop; if `actual ≤ estimate` → warm teal cue + **`task_completed_on_time`** meme; if `actual > estimate` → quiet completion, **no negative flag**, may fire friendly **`task_completed_late`** meme (§8.2).
  - Edit own uncompleted task (title/tag/estimate) via long-press/kebab (OQ‑4 assumption). Completed tasks locked to member.
- **Meme triggers:** `task_completed_on_time`, `task_completed_late`, `empty_task_list`.

### 4.4 Campaigns (list)

- **Route:** `/campaigns`. Tab: Campaigns. **Roles:** member sees campaigns they belong to; RM sees reportees' (frame coaching); Admin all.
- **Layout:** single scrolling column of **campaign cards** (§3.3), `gap: var(--space-md)`. Optional filter chips top (`All · Active · Overdue · Delivered`).
- **Content order:** overdue first (attention), then due-today, coming-up, on-track, delivered last.
- **States:**
  - *Loading:* 3 card skeletons with stripes.
  - *Empty:* `"No campaigns yet"` / `"When you're added to a campaign, it'll live here 🎬"`. Admin sees CTA `"+ New campaign"` (OQ‑1: Admin-only creation).
  - *Error:* soft retry.
- **Interactions:** card → detail. Admin `+` → create-campaign sheet (name, members, one Lead, deadline, identity colour — §11.1). Overdue cards pulse (§3.3).
- **Meme triggers:** when a campaign flips overdue at IST midnight, **`campaign_overdue`** fires for the Lead (+ in-app notif to Lead & Manager, §11.2); when marked delivered on time → **`campaign_delivered_on_time`**.

### 4.5 Campaign detail

- **Route:** `/campaigns/:id`. **Roles:** members of campaign; **Lead** gets elevated member-task-status roll-up (§11.3); Admin full.
- **Layout:**
  1. Header: identity-colour band, client name `type-h1`, proximity pill, deadline day-label (DD‑1), lead avatar + member avatars row.
  2. **Member task-status roll-up** (Lead/Admin only, §11.3): list of members with a **status chip** each — `Not started · Active 🔥 · Done ✅` — **no timers, no cross-campaign data** (§11.3). Frame: status-level read only.
  3. Member (non-Lead) view: sees the campaign meta + own tasks tagged to it, not others' status.
  4. Admin actions: edit deadline/members/Lead; **mark delivered** (Lead+Admin, OQ‑2).
- **States:** loading = header + 4 row skeletons; empty roll-up = `"No tasks logged on this campaign yet"`; error soft retry; success normal.
- **Interactions:** Lead taps a member row → sees that member's task **statuses** on this campaign (not timers). Mark delivered → confirm modal → `campaign_delivered_on_time` meme if on/before deadline.
- **Meme triggers:** `campaign_delivered_on_time`, `campaign_overdue`.

### 4.6 Attendance

- **Route:** `/attendance`. Tab: Attendance. **Roles:** own; Admin/Manager view others via console (frame coaching).
- **Layout:**
  1. **Check-in pill** (§3.12) large at top (office day) OR **WFH toggle** (§3.12) on WFH days OR off-day banner on Sundays/4th-Sat/holidays (`"Off day — rest up. Tasks still open if you want 🌤️"`).
  2. **Late-count insight line** (P2/P4): if lates this month → **"{n} slow starts this month — still plenty of time to finish strong 💪"** (§7.2). Zero → nothing shown (don't invent a metric).
  3. **Month calendar** (§3.11) with colour-coded day-chips; ‹ › month steppers; weekday header.
  4. Legend row (muted): teal on-time · coral late · lavender WFH · grey off/holiday · white upcoming.
- **States:**
  - *Loading:* pill skeleton + calendar grid skeleton.
  - *Empty:* new joiner, month with no data → chips render (upcoming/off) but no history; no scary empty state.
  - *Error (GPS denied/failed):* pill shows gentle denied/error copy (§3.12); the rest of the screen still works.
  - *Success:* check-in confirmed → chip for today updates colour; meme fires.
- **Interactions:** one-tap check-in (Geolocation, §9.1); tap a day-chip → day detail sheet (status + any remark; self read-only, Admin edit §4.2). No countdown/timer anywhere (P3).
- **Meme triggers:** `checkin_on_time` (≤10:45), `checkin_late` (>10:45), `wfh_checkin`, `monday_first_checkin` (first check-in of ISO week on Monday), and month-boundary evaluations: `perfect_attendance_month` (zero late) and `late_arrivals_3plus` (on the 3rd late). See §5.4 mapping.

### 4.7 Leaderboard

- **Route:** `/leaderboard`. Entry from Home rank stat / Profile. **Roles:** all (public, §14).
- **Layout (scoreboard, §6.4):**
  1. **Full HC white logo** above the board (§6.8 — "official, earned-trophy feel").
  2. Month label `type-h2` + reset note `type-meta` muted (`"Resets 1st. Fresh game every month."`).
  3. **Rank hero** (§3.10): top 3, #1 centred largest with 48px ExtraBold number + gold badge + `--glow-yellow`.
  4. **Rows 4+** (§3.10) list.
  5. Own-row highlight + a **personal-best / streak** badge when applicable (§14.2) — new joiners get PB markers so they always have something to celebrate.
- **States:**
  - *Loading:* hero skeleton (3) + 3 row skeletons.
  - *Empty (month 1, day 1, no data):* `"Board's warming up — first scores land as the month rolls 🏆"`.
  - *Error:* soft retry.
  - *Success:* rank changes animate (§2.8).
- **Interactions:** frame `insight` for members (interpretation line under score, numbers hidden); frame `coaching` for Manager/Admin (factor sub-scores visible). Score is the one allowed bare number (`/100`).
- **Microcopy example (member):** `"#3 this month 🚀 — crushing it on deadlines, building your streak"` (§7.2).
- **Meme triggers:** on reveal after a monthly recompute / rank move: `leaderboard_rank_1` (if #1), `rank_moved_up`, `rank_moved_down`, `streak_milestone` (e.g. 4 weeks on-time).

### 4.8 Profile

- **Route:** `/profile`. Tab: Profile. **Roles:** own; Admin/Manager reach others' profiles via console/roster.
- **Layout:**
  1. **HC white logo watermark** subtle in top corner (§6.8), low opacity (~8%).
  2. Avatar 72px + name `type-h1` + designation/department `type-meta` muted + employment-type/probation chip (`"Full-time"` / `"Intern · probation ends {date}"`).
  3. **Leave arc rings** (§3.11): comp-off purple + PL teal overlapping, centre `"{available} in the bank"`, legend below.
  4. **Salary/deductions card** (§3.14) — self/RM/Admin only; hidden otherwise.
  5. **Leave history ledger** (§5): scrolling list of every request — dates, type, reason, status, approver, IST timestamp (persists full tenure).
  6. Footer: entry points — `"Team birthdays"` (B5), and for Admin/Manager `"Admin console"` / `"My team"` links; `"Log out"`.
- **States:** loading = avatar+rings+ledger skeleton; empty ledger = `"No leave history yet — it'll build up over time"`; error soft retry.
- **Interactions:** self may edit own photo only (OQ‑5); all other fields Admin-only (grey, with `"Ask an admin to change this"` hint). Ledger row → detail sheet.
- **Meme triggers:** none on view; leave-decision memes fire from the leave flow.

### 4.9 Leave request flow

- **Entry:** Profile → `"Request leave"`, or leave pill. **Roles:** member submits; RM/Admin approve (§9.8).
- **Flow (bottom-sheet steps):**
  1. **Type** — segmented pills: `PL · Optional holiday · Comp-off · Bereavement · Maternity · Paternity · Half-day` (§9.8). Birthday claim appears as an optional-holiday option when near DOB.
  2. **Dates** — date-range picker (IST); shows off-days/holidays inline; blocks nonsensical ranges.
  3. **Reason** — textarea.
  4. **Balance preview (P4, honest):** `"This uses {comp-off first, then PL} → {n} PL left after"` reflecting priority order comp-off → PL → LWP (§9.4 step 5). Probation warning if applicable: `"Heads up — during probation this counts as unpaid (LWP). Still fine to apply 🙂"` (§9.5/§9.6, F1). Optional-holiday cap: block the 3rd with `"You've used both optional holidays for this year 🌸"` (F5).
  5. **Submit** → routes to RM (Admin can also approve). Appears in ledger as `pending`.
- **States:** submitting spinner; success sheet `"Sent! Your manager will take a look 🙌"`; error gentle retry; empty balance handled by preview.
- **Approver view (RM/Admin):** approval queue (see §4.13 manager views) with Approve/Reject; on approve → balances update in priority order + **`leave_approved` meme with tiny HC stamp** (§6.8) to the member; on reject → logged with approver, no balance change (F2).
- **Meme triggers:** `leave_approved` (with HC stamp).

### 4.10 Comp-off request flow

- **Entry:** Attendance/Profile → `"Request comp-off"` (only for upcoming approved off-days). **Roles:** member submits; **Admin/Founder approves, RM copied** (§9.4, OQ‑9).
- **Flow:**
  1. **Off-day date** — picker restricted to **future** Sundays / 4th-Sat / holidays; **past/started dates are blocked** with `"Comp-off has to be requested before the off day 🙂"` (§9.4 note — no retrospective).
  2. **Reason + planned work/campaign** — textarea + campaign picker.
  3. **Submit** → routes to **Admin/Founder**; **RM copied** (notified only, N in §2.6). Ledger shows `pending`.
- **On the off day:** member logs tasks normally with On it/Nailed it — **no hour counter, no 6h threshold, no progress gauge** shown (§9.4 step 3, G6). Off-day banner: `"Off day — logging freely, zero pressure 🌤️"`.
- **After the off day:** Admin reviews logged tasks and **credits comp-off in one tap** (6h is Admin's internal reference, not an app gate; may credit slightly under 6h — §9.4 step 4). On credit → member sees **`comp_off_approved` meme with HC stamp** (§6.8).
- **States:** submit success `"Sent to admin for approval 🤝"`; blocked-retrospective error copy above; pending/credited reflected in ledger.
- **Meme triggers:** `comp_off_approved`.

### 4.11 Admin console

- **Route:** `/admin`. **Roles:** Admin only (gated; others 404-gentle `"This corner's for admins ✨"`). Desktop → left rail + 1200px width; mobile → sectioned list.
- **Sections (all of §4.1–4.5):**
  1. **People / profiles:** list all employees; edit any field (name, employment type, joining date, DOB, RM, designation, salary); **grant/revoke Admin toggle** (§3, block last-Admin removal OQ‑21); **delete profile → type-name-to-delete dialog** (§3.18).
  2. **Tasks:** view/edit any member's task; add task on behalf; **mark done + manual completion time**; delete task (immediate).
  3. **Attendance & remarks:** override any day's status; add/edit/delete calendar remarks; mark any date a company holiday.
  4. **Leave:** add any leave type/date range; edit balance; approve/reject; delete record.
  5. **Comp-off:** approve/reject requests; grant manually; adjust balance; **credit from off-day logs**; delete.
  6. **Holiday calendar:** view seeded FY 26–27 (Appendix A.7); add/edit/remove (refreshes for all immediately).
  7. **Salary:** edit base salary (feeds §13 view).
- **Destructive actions (§4.5, L2):** all deletes are **immediate & permanent, no audit trail** — copy stays honest and gentle but clear (`"This is permanent — there's no undo"`). **Only** profile-delete uses the type-name gate.
- **States:** table loading skeletons; empty search `"No one matches that"`; error soft retry; success inline confirm toast (non-meme, factual).
- **Frame:** `coaching` throughout — numbers visible, neutral.
- **Meme triggers:** admin approvals still fire the member-facing memes (`leave_approved`, `comp_off_approved`); admin's own UI stays factual (no memes in the console itself — keep it a control surface).

### 4.12 Admin editing tasks/attendance (detail behaviours)

- **Manual done + completion time (§4.1):** modal with a completion time-of-day field (IST); on save, `actual` recomputes from stored `start_ts` and the manual end. If no start exists, ask for both (or record duration directly per implementer choice — flag).
- **Attendance override (§4.2):** segmented `present / absent / WFH / half-day / late`; recomputes late-count, leaderboard, deductions downstream (E4).
- **All admin edits take effect immediately and permanently** (§4.5 note).

### 4.13 Manager views

- **Route:** `/team` (RM). **Roles:** Reporting Manager (reportees only); Admin superset.
- **Layout:**
  1. **Reportee roster:** cards/rows per reportee — avatar, name, today's status (checked-in?/late?), pending-approval badge.
  2. **Approval queue:** pending **leave** requests (RM can approve/reject) and **comp-off** items shown as **copied/notified only** (approval routes to Admin — OQ‑9) — comp-off rows show `"Awaiting admin approval"` with no approve button for RM.
  3. **Per-reportee view:** attendance calendar (frame coaching, numbers visible), tasks, **Focus Time structured** (§12.3 — numbers visible, coaching not critique), late count, campaign flags.
- **States:** empty queue `"All caught up — nothing waiting 🙌"`; loading skeleton rows; error soft retry.
- **Frame:** `coaching` everywhere here (§7.3 — "managers see the same data in a slightly more structured view; numbers more visible for coaching purposes"). Tone still never punitive.
- **Meme triggers:** none for the manager UI itself; RM receives **in-app notifications** for reportee overdue campaigns and comp-off filings (§3, §9.4, M2).

---

## 5. Meme Toast System

The mechanism that makes the app feel alive (§6.5/§6.6). This section is the contract the frontend implements.

### 5.1 Anatomy (recap of §3.8)

Rounded pill · `--color-surface` bg · **1px Electric-Purple border** · emoji (or HC stamp) left · DM Sans Medium 14 text · `--shadow-toast` · width fits text, **max 90vw, centred** · floats just above the bottom nav.

### 5.2 Timing & rules

| Rule | Spec |
|---|---|
| Slide up | `translateY(24px)→0` + fade, `--dur-toast-in` (280ms), `--ease-decelerate` |
| Hold | **3000ms** (`--dur-toast-hold`, §6.5) |
| Slide down | reverse, `--dur-toast-out` (240ms), `--ease-accelerate` |
| Non-blocking | container `pointer-events:none`; never covers actionable UI (§6.5) |
| No repeat twice in a row | per event, last line persisted; next pick excludes it (§6.5, algorithm §5.5) |
| One at a time | if multiple events fire, **queue** and play sequentially (FIFO); coalesce duplicates within 500ms |
| Reduced motion | no slide; fade in/out `--dur-fast` still respecting 3s hold; `aria-live="polite"` |
| Accessibility | `role="status"`, `aria-live="polite"`; text is readable by SR; emoji has no essential meaning beyond the text |

### 5.3 The 17 meme-bank event keys (canonical — frontend MUST support all)

Derived directly from PRD §6.6. The copy bank is a JSON object keyed by these strings; each value is an array (10 lines shipped, extendable without code change §6.6).

```
1.  task_completed_on_time      // Task completed ON TIME
2.  task_completed_late         // Task completed LATE (over estimate)
3.  checkin_on_time             // ON-TIME check-in (≤ 10:45)
4.  checkin_late                // LATE check-in (> 10:45)
5.  late_arrivals_3plus         // 3+ LATE arrivals in one month
6.  perfect_attendance_month    // PERFECT ATTENDANCE month (zero late)
7.  wfh_checkin                 // WFH day check-in
8.  campaign_delivered_on_time  // Campaign DELIVERED on time
9.  campaign_overdue            // Campaign OVERDUE
10. leaderboard_rank_1          // Leaderboard RANK #1
11. rank_moved_up               // Rank MOVED UP
12. rank_moved_down             // Rank MOVED DOWN
13. leave_approved              // Leave APPROVED           (HC stamp)
14. monday_first_checkin        // MONDAY morning first check-in
15. streak_milestone            // STREAK milestone (e.g. 4 weeks on time)
16. empty_task_list             // EMPTY task list (morning)
17. comp_off_approved           // COMP-OFF approved         (HC stamp)
```

`stamp: true` (tiny HC mark instead of emoji, §6.8) for **`leave_approved`** and **`comp_off_approved`** only.

### 5.4 Trigger → event mapping (event source → key)

| App event (source in product-plan epic) | Condition | Event key | Where fired |
|---|---|---|---|
| Task "Nailed it" | `actual ≤ estimate` (C2) | `task_completed_on_time` | Tasks |
| Task "Nailed it" | `actual > estimate` (C2) | `task_completed_late` | Tasks |
| GPS check-in | time ≤ 10:45:00 IST (E1) | `checkin_on_time` | Attendance |
| GPS check-in | time > 10:45:00 IST | `checkin_late` | Attendance |
| Check-in recorded | this is the 3rd late of the month (E5) | `late_arrivals_3plus` | Attendance |
| Month close | zero lates in the month | `perfect_attendance_month` | Attendance / Home |
| WFH toggle confirm | WFH day (E2) | `wfh_checkin` | Attendance |
| Campaign marked delivered | delivered ≤ deadline (D4) | `campaign_delivered_on_time` | Campaign detail |
| Deadline crossed | day flips past deadline (D2/D3) | `campaign_overdue` | Campaigns (Lead) + notif |
| Monthly recompute | member is rank #1 (I2) | `leaderboard_rank_1` | Leaderboard |
| Monthly recompute | rank improved vs M−1 | `rank_moved_up` | Leaderboard |
| Monthly recompute | rank dropped vs M−1 | `rank_moved_down` | Leaderboard |
| Leave approved | RM/Admin approves (F2) | `leave_approved` (stamp) | member device |
| First check-in | first of ISO week & it's Monday (E6) | `monday_first_checkin` | Attendance |
| Streak milestone | e.g. 4 weeks on-time (I2/§14.2) | `streak_milestone` | Leaderboard / Home |
| Empty task list | morning view, no tasks (C5) | `empty_task_list` | Tasks |
| Comp-off credited | Admin credits (G2) | `comp_off_approved` (stamp) | member device |

Precedence when several fire together (e.g. Monday + on-time check-in): queue in this order — **check-in result → monday → streak → perfect-month**. Rank memes: `leaderboard_rank_1` supersedes `rank_moved_up`.

### 5.5 No-repeat picker (pseudocode)

```ts
const lastShown: Record<MemeEventKey, string> = loadFromLocalStorage(); // persists per device

function pickMeme(key: MemeEventKey): string {
  const bank = MEME_BANK[key];           // array of ≥1 lines (JSON, §6.6)
  if (bank.length <= 1) return bank[0];
  const last = lastShown[key];
  const pool = bank.filter(line => line !== last);   // exclude previous → never twice in a row
  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastShown[key] = pick;
  saveToLocalStorage(lastShown);
  return pick;
}
```

Emoji extraction: keep the emoji inline in the string (as authored in §6.6); the toast renders the whole line. If `stamp` events, replace the leading visual with the HC mark and keep the text.

---

## 6. Logo Usage (PRD §6.8)

**Always the white text version on dark; never the black-text version inside the app.** The coloured purple-yellow HC handshake mark is preserved as-is (it already matches the palette).

| Placement | Treatment | Spec |
|---|---|---|
| **Login / splash** | Logo **centred** on `--color-bg` (`#0F0E17`) — first thing seen every open | ~140px wide, `--space-5xl` from top, fade-in `--dur-slow` |
| **Home dashboard** | **Small** logo **top-left**, above the greeting — brand present, not dominating | ~88px wide, aligned with 16px gutter |
| **Leaderboard header** | **Full** logo **above** the scoreboard — official, earned-trophy feel | ~120px wide, centred, `--space-lg` below |
| **Profile** | Logo as a **subtle watermark** in the top corner | ~120px, opacity ~8%, non-interactive, behind content |
| **Leave-approval toast** | **Tiny HC mark** beside the approval message — like an official company stamp | 20px, replaces the emoji slot; also on `comp_off_approved` |
| **PWA icon / manifest** | HC mark on `#0F0E17` maskable icon set | see §8.2 |

Assets: ship `logo-white.svg` (full lockup) and `hc-mark.svg` (handshake mark only) self-hosted in `/public/brand` (CSP/offline). Provide 1× and 2× PNG fallbacks for the manifest.

---

## 7. Accessibility on the Dark Theme

Dark-only UI must still meet WCAG AA. Contrast measured against the two base surfaces (`#0F0E17` bg, `#1C1A2E` card).

### 7.1 Contrast checks (computed, WCAG 2.1)

| Foreground | On | Ratio | AA normal (4.5) | AA large/UI (3.0) | Verdict |
|---|---|---|---|---|---|
| Near White `#F0EFF8` | `#0F0E17` | **16.8:1** | ✅ | ✅ | AAA |
| Near White `#F0EFF8` | `#1C1A2E` | **14.9:1** | ✅ | ✅ | AAA |
| Muted Lavender `#9896A8` | `#0F0E17` | **6.6:1** | ✅ | ✅ | Pass |
| Muted Lavender `#9896A8` | `#1C1A2E` | **5.9:1** | ✅ | ✅ | Pass |
| Electric Purple `#7B61FF` (text) | `#0F0E17` | **4.56:1** | ✅ (barely) | ✅ | Use ≥14px; prefer for large/UI |
| Teal Mint `#00D4AA` | `#0F0E17` | **10.0:1** | ✅ | ✅ | Pass |
| Hot Coral `#FF6B6B` | `#0F0E17` | **6.9:1** | ✅ | ✅ | Pass |
| Sunny Yellow `#FFD60A` | `#0F0E17` | **13.6:1** | ✅ | ✅ | Pass |
| Soft Lavender `#C4B5FD` | `#0F0E17` | **10.4:1** | ✅ | ✅ | Pass |
| **White `#FFFFFF` on Electric Purple `#7B61FF`** (primary button) | — | **4.20:1** | ⚠️ (<4.5) | ✅ | **DD‑4:** OK for ≥16px/≥600 (large/UI). Do **not** use for <16px text on purple. |
| Near-white on Electric Purple | — | 3.68:1 | ❌ | ✅ | Prefer pure white (above) on purple fills |
| Dark `#0F0E17` on Sunny Yellow (badge) | — | 13.6:1 | ✅ | ✅ | Use dark text on yellow/teal solids (§2.2) |

**Actionable rules:** (a) primary-button labels: pure white, ≥16px, weight ≥600. (b) Never put purple text smaller than 14px on the bg; never put near-white text on a purple/yellow/teal **solid** fill (use the §2.2 on-fill rule). (c) Muted lavender is safe for metadata at all sizes.

### 7.2 Focus-visible

Every interactive element shows `:focus-visible { box-shadow: var(--focus-ring); }` — a 2px dark gap + 2px purple ring, so focus is visible even on coloured buttons and on the dark bg. Focus is never removed (`outline:none` only when replaced by the ring). Modal/bottom-sheet **traps focus**; `Esc` + scrim dismiss. Tab order follows visual order.

### 7.3 Hit targets

Minimum **44×44px** (`--hit-min`); recommended 48. Bottom-nav items span the full 64px height. Day-chips are 40px visual but sit in a 44px touch cell. Icon-only controls (nav, kebab, month steppers, movement arrows) meet 44px.

### 7.4 Reduced motion (P6, §2.3)

`@media (prefers-reduced-motion: reduce)` zeroes all durations and **disables the overdue pulse** (static solid dot instead), the skeleton shimmer (static block), and celebrate springs (instant state change). Toasts still appear and hold 3s but fade instead of slide. No essential information is conveyed by motion alone (overdue is also colour + text; rank change is also arrow + number).

### 7.5 Screen-reader labels for icon-only & colour-coded controls

| Control | `aria-label` / SR text |
|---|---|
| Bottom-nav item | `"Home"`, `"Tasks"`, … + `aria-selected`; badge → `"Tasks, 2 new"` |
| Check-in pill | announces result: `"Checked in at 10:32, on time"` / `"…, a little late"` |
| Day-chip | `"1 August, on time"` / `"…, work from home"` / `"…, company holiday: Independence Day"` + `", has a note"` |
| Campaign proximity | `"On track"` / `"Due today"` / `"Overdue, needs attention"` (not colour alone) |
| Rank movement arrow | `"moved up 2 places"` / `"moved down 1 place"` / `"no change"` / `"new this month"` |
| Leave arc rings | `"Paid leave: 5 of 18. Comp-off: 2. 7 leaves available."` |
| Overdue pulse dot | `"Overdue"` (text, not just the pulsing colour) |
| Meme toast | `role="status" aria-live="polite"` reads the line; decorative emoji not announced as essential |
| Kebab / edit icons | `"Edit task"`, `"More options for {title}"` |

Colour is **never the only signal**: every colour-coded state (day-chip, proximity, task outcome, rank movement) is paired with text/icon.

### 7.6 Language & readability

Hinglish copy is fine for tone, but every **functional** label (buttons, form fields, nav) is clear and unambiguous; memes are decorative/`aria-live` and never the sole carrier of a required action. Set `lang="en-IN"`. Numbers use Indian formatting where currency (₹, comma grouping e.g. `₹27,272.73`).

---

## 8. Responsive & PWA

### 8.1 Layout behaviour

- **Mobile-first** (§8, §6). Design canvas 360–430px. Single column, 16px gutter, bottom nav.
- **≥600px:** member screens **centre a 480px column** (`--content-max`) on the deep-space bg (the app stays phone-shaped — it's a phone tool). 24px gutter.
- **>1024px (Admin/Manager only):** console/roster expand to `--content-max-admin` (1200px) with a **left rail** replacing the bottom nav; member screens still centre 480px.
- **Wide content guard:** any table (admin), calendar, or long row lives in an `overflow-x:auto` container — the page body never scrolls horizontally.

### 8.2 PWA install & manifest

`manifest.webmanifest`:
```json
{
  "name": "Hustling Collaborators",
  "short_name": "Hustling",
  "description": "Task, campaign & attendance — the Hustler way.",
  "start_url": "/home",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0F0E17",
  "theme_color": "#0F0E17",
  "icons": [
    { "src": "/brand/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/brand/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/brand/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
- **Install prompt (N1):** capture `beforeinstallprompt`, suppress the default mini-infobar, and surface a custom, dismissible chip (`"Add Hustling to your home screen 📲"`) on Home after the 2nd session — never nag; store dismissal.
- **iOS:** provide `apple-touch-icon`, `apple-mobile-web-app-status-bar-style=black-translucent`, and a splash on `#0F0E17`.

### 8.3 Offline shell

- Service worker **precaches the app shell** (HTML skeleton, `tokens.css`, fonts woff2, logo/mark SVGs, nav, icon sprite) → the dark shell + logo render instantly offline.
- Data is network-first with a cache fallback for read views; **writes (check-in, task taps) are online-only in v1** (OQ‑25 deferred) — on no-network, show a gentle inline banner `"You're offline — we'll sync when you're back 📶"` and disable the write, never lose the tap silently.
- **Offline fallback screen** (hard offline, no cache): centred HC mark + `"No signal right now — the hustle waits for the internet 📶"` + retry.
- CSP is strict/self-contained: **self-host all fonts, icons, logo** (no CDN, no hotlinked Google Fonts) so the shell works offline and passes CSP.

### 8.4 Safe-area insets

- Bottom nav & toast use `--safe-bottom`; sticky header uses `--safe-top`; horizontal gutters add `--safe-left/right` on notched landscape. Content scroll padding = `--nav-height + --safe-bottom` so nothing hides behind the nav.

---

## Appendix A — Component → token cheat-sheet

| Component | Key tokens |
|---|---|
| Primary button | `--color-primary`, `--color-on-primary`, `--radius-md`, `--type-button-size`, `--focus-ring` |
| On-it / Nailed-it | `--color-primary-ghost` / `--color-success-ghost`, `--radius-pill`, `--glow-purple` (active) |
| Task card active | `--glow-purple`, `--color-primary-ghost`, `--dur-base` |
| Campaign card | identity accent (4 campaign colours) + proximity ghost fills + `--glow-coral` (overdue) + `--dur-pulse` |
| Meme toast | `--color-surface`, `--color-toast-border`, `--radius-pill`, `--shadow-toast`, `--dur-toast-*` |
| Bottom nav | `--color-surface`, `--color-scrim-nav`, `--shadow-nav`, `--nav-height`, `--z-bottom-nav` |
| Rank hero #1 | `--color-campaign-yellow`, `--glow-yellow`, `--type-rank-*` |
| Day-chip | ghost fills per status, `--radius-sm`, `--color-primary` today ring |
| Leave arc | `--color-campaign-teal` (PL), `--color-primary` (comp-off), `--color-border` track |
| Modal / delete gate | `--color-overlay`, `--shadow-modal`, `--radius-xl`, `--z-modal` |

## Appendix B — Copy-bank JSON skeleton (frontend loads verbatim from §6.6)

```json
{
  "task_completed_on_time":     ["…10 lines from PRD §6.6…"],
  "task_completed_late":        ["…"],
  "checkin_on_time":            ["…"],
  "checkin_late":               ["…"],
  "late_arrivals_3plus":        ["…"],
  "perfect_attendance_month":   ["…"],
  "wfh_checkin":                ["…"],
  "campaign_delivered_on_time": ["…"],
  "campaign_overdue":           ["…"],
  "leaderboard_rank_1":         ["…"],
  "rank_moved_up":              ["…"],
  "rank_moved_down":            ["…"],
  "leave_approved":             ["…"],
  "monday_first_checkin":       ["…"],
  "streak_milestone":           ["…"],
  "empty_task_list":            ["…"],
  "comp_off_approved":          ["…"]
}
```
Load the 10 lines per key exactly as authored in PRD §6.6 (Hinglish, emoji preserved). New lines may be appended to any array without code changes (§6.6). `leave_approved` and `comp_off_approved` render with the HC stamp (§6.8) instead of a leading emoji.

---

*End of UX & Design System. Consumes PRD v6.0 §6/§7 and product-plan §1–3. Blocking cross-refs the founder must still resolve before build: DD‑1…DD‑7 (this doc) and OQ‑6/OQ‑8/OQ‑15 (product plan).*
