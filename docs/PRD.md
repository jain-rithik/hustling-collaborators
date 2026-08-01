
HUSTLING COLLABORATORS
Product Requirements Document
Internal HRM + Task + Campaign Management Tool
Version 6.0  •  July 31, 2026
Field
Detail
Prepared for
Hustling Collaborators — Founder
Prepared by
HR / Ops function, with Claude
Built by
Founder's brother (from-scratch, React / Node)
Team size at launch
6 team members + Reporting Manager + Founder
Admin access
Founder (always) + any person the Founder designates (e.g. Anshuman)
Target monthly cost
₹0–500/month (free-tier infrastructure)
Version
v6.0 — Final version: dark creative theme, meme copy bank, full design brief, all revisions integrated

# 1. Purpose & Background
Hustling Collaborators currently manages day-to-day task tracking through a shared sheet, where team members list tasks and mark them complete. This has one significant blind spot: task time is not tracked, so a task that genuinely takes 4 hours can quietly consume an entire working day with no visibility into why.
Attendance and leave intimation currently run informally over WhatsApp, per the company's Attendance Policy, and leave balances are tracked manually against the Leave Policy's accrual rules.
This PRD defines a single internal web application — installable as a mobile Progressive Web App (PWA) — that unifies:
- Task management with honest Start/Done time-tracking against self-set estimates
- Campaign management with ownership (Lead role), deadlines, and auto-flagging
- GPS-based attendance for office days; WFH toggle for work-from-home days
- A personal daily Focus Time metric, framed as self-insight not surveillance
- Leave balance tracking encoding the company's actual Leave Policy math
- Comp-off request flow with in-app approval, auto-calculation from task logs, and correct leave-priority ordering
- A company holiday calendar (FY 26–27) seeded directly into the app
- Employee profiles with joining date, birthday, salary, and a leave remarks ledger
- A public, monthly, gamified leaderboard rewarding punctuality and delivery
- Full Admin edit and delete controls across all data, per Founder's discretion

# 2. Goals & Non-Goals

## 2.1 Goals
- Fix the time-tracking blind spot: make actual time spent on a task visible against what was estimated, so effort and pace become honest.
- Replace informal attendance tracking: GPS check-in/out for office days; WFH toggle for home days — together replacing the WhatsApp intimation process entirely.
- Encode leave policy correctly: automate accrual, deduction, and balance tracking exactly per the company's updated Leave Policy, including the new mid-month separation clause.
- Give campaigns real ownership: every campaign has a named Lead, a deadline, and automatic flagging when overdue.
- Make the team feel empowered, not watched: every feature is presented as a personal tool the team member owns, not a management surveillance system.
- Give Admins full control: Admins can edit or permanently delete any record — tasks, attendance, leave, calendar remarks — without restriction.
- Keep monthly running cost near-zero: free-tier hosting/database, browser-native GPS, in-app-only notifications.

## 2.2 Non-Goals (explicitly out of scope for v1)
- Statutory payroll processing (PF, ESI, TDS) — the salary view is a transparency layer only.
- Native iOS/Android apps — ships as a responsive web app, installable as a PWA.
- WhatsApp or email notification integration — v1 is in-app notifications only.
- Continuous/background GPS tracking — location used only at check-in and check-out.
- Client-facing access — internal-only.

# 3. User Roles & Permissions
Role
Who
Key permissions
Admin
Founder (always) + anyone the Founder designates — e.g. Anshuman
Full visibility AND full edit/delete access across all data: tasks, attendance, leave records, calendar remarks, comp-off approvals, holiday calendar, salary, and employee profiles. Can grant or revoke Admin status for any other person via a simple toggle in the Admin control panel — no code change required. Can permanently delete any record.
Reporting Manager
Assigned per team member
Views and manages tasks, attendance, leave requests, and campaign flags for their own reportees. Approves leave requests. Receives deadline-overdue and comp-off request in-app notifications for their reportees.
Team Member
All 6 team members
Full access to their own data: tasks, attendance, leave balance/history, focus time, salary/deductions view. Sees the public leaderboard and campaigns they belong to. Can log tasks on off days and submit comp-off requests.
Campaign Lead (contextual)
One member per campaign
Elevated view of task status for all members within that specific campaign only — not a standing company-wide role.

Note: Admin access is a simple toggle in the Admin control panel. The Founder can assign or revoke it for any employee at any time. Anshuman should be set up as Admin from day one.

# 4. Admin Edit & Delete Controls
Admins have unrestricted edit and delete access across every module in the app. This section specifies exactly what can be edited or deleted in each area.

## 4.1 Tasks
Action
Detail
Edit task
Admin can change the title, campaign tag, estimated time, or status of any team member's task.
Add task on behalf
Admin can create a task and assign it to any team member.
Mark task done
Admin can mark a task as Done on behalf of a team member (e.g. if they forgot to tap Done), and manually enter the completion time.
Delete task
Admin can permanently delete any task record. No recovery after deletion.

## 4.2 Attendance & Calendar remarks
Action
Detail
Override attendance
Admin can change any day's attendance status for any employee: present / absent / WFH / half-day / late — regardless of what GPS or the employee's own entry shows.
Add calendar remark
Admin can add a free-text note to any specific date on any employee's calendar (e.g. "WFH approved", "Late — verbal warning given", "Comp-off approved for this day"). These remarks are visible to the employee on their own calendar view.
Edit calendar remark
Admin can edit any remark already added.
Delete calendar remark
Admin can permanently delete any remark. No recovery after deletion.
Mark holiday
Admin can mark any date as a company holiday (in addition to the pre-seeded FY 26–27 calendar), affecting all employees.

## 4.3 Leave records
Action
Detail
Manually add leave
Admin can add any leave type (PL / LWP / comp-off / half-day / bereavement / maternity / paternity) directly to any employee's record, for any date range.
Edit leave balance
Admin can directly adjust any employee's leave balance — useful for one-time corrections or pro-rata adjustments.
Approve or reject leave
Admin can approve or reject any pending leave request from any employee.
Delete leave record
Admin can permanently delete any leave entry. No recovery after deletion.

## 4.4 Comp-off
Action
Detail
Approve comp-off request
Admin approves the pre-work comp-off request submitted by the employee before the off day.
Grant comp-off manually
Admin can grant a comp-off for any employee for any date, without the employee having submitted a request.
Adjust comp-off balance
Admin can edit the comp-off balance directly.
Delete comp-off record
Admin can permanently delete any comp-off entry.

## 4.5 Employee profiles
Action
Detail
Edit profile fields
Admin can edit any field on any employee's profile: name, employment type, joining date, birthday, salary, reporting manager, designation.
Delete employee profile
Admin can permanently delete an employee's profile and all associated data. This is a destructive action — the app should require a confirmation step ("Type the employee's name to confirm deletion") before executing.
Note: There is no audit trail — Admin edits and deletions take effect immediately and permanently, with no recovery. The confirmation step on profile deletion is the only safeguard. Admins should exercise caution, especially on delete actions.

# 5. Employee Profile Module
Every team member has a profile record — the single source of truth that drives probation status, leave accrual, and cycle timing automatically.
Field
Purpose
Name & photo
Identification — shown across the app, leaderboard, and campaign cards.
Employee ID
Internal reference number.
Employment type
Intern or Full-time — drives probation length, cycle length (6 or 12 months), and leave accrual rules automatically.
Joining date
Drives probation countdown, leave accrual start date, and appraisal cycle timing.
Date of birth
Displayed on profile; drives the birthday optional-holiday entitlement per the Holiday Calendar. A team calendar view shows all upcoming birthdays.
Reporting manager
Assigned manager — drives leave-approval routing and visibility.
Designation / department
Display context across the app.
Salary amount
Visible only to the employee, their Reporting Manager, and Admins. Feeds the Deductions view (Section 9).
Current leave balance
Auto-calculated from the accrual rules in Section 8. Never manually entered (except by Admin override).
Comp-off balance
Auto-calculated from approved comp-off records. Used before PL when leave is applied.
Leave remarks / history ledger
Running, timestamped log of every leave request: dates, type, reason, approval status, and approver. Persists for the employee's full tenure.

# 6. Visual Design Brief

Hustling Collaborators is a marketing and influencer agency. The internal tool should feel like it belongs to that world — energetic, creative, confident — not like a generic HR portal. The design language is: dark base, bold colour pops, gamified presentation, minimal chrome, and meme-culture copy that makes people actually look forward to opening the app. The Hustling Collaborators logo (white version with the purple-yellow HC handshake mark) is used throughout the app as specified in Section 6.8 below.

## 6.1 Design direction
Element
Direction
Reason
Overall feel
Dark, gamified, minimal — like a creator tool, not a corporate HR system
Matches agency culture; dark base makes colour pops hit harder; minimal keeps it fast to use
References
Codzgarage task management UI + Daily Productivity Exploration — dark base, rounded coloured cards, bold typography hierarchy, scoreboard leaderboard energy
These references show the exact card-and-dark-base language that works for this app
Meme copy
Rotating viral Indian meme dialogues (Hera Pheri, Mirzapur, Golmaal, Doraemon, Gen-Z office humour) — shown as toast notifications, not permanent UI text
Makes the app feel alive and human; never repetitive because lines rotate randomly per event
Typography
Plus Jakarta Sans Bold for headings and numbers; DM Sans Regular for body — both free on Google Fonts
Rounded, confident, modern — not corporate
Icons
Minimal outline icons only — no filled icons, no illustrations
Keeps the UI clean against the dark base
Motion
One deliberate animation per key moment (task completion, rank change, overdue flip) — nothing else
Feels rewarding, not distracting

## 6.2 Colour palette
Role
Name
Hex
Where used
Background
Deep Space
#0F0E17
All screens — the base everything sits on
Surface / cards
Dark Lifted
#1C1A2E
All cards, modals, bottom nav
Primary accent
Electric Purple
#7B61FF
Buttons, active nav state, leaderboard rank highlight
Campaign colour 1
Hot Coral
#FF6B6B
Campaign cards — urgent or active campaigns
Campaign colour 2
Teal Mint
#00D4AA
Campaign cards — in progress; also on-time success states
Campaign colour 3
Sunny Yellow
#FFD60A
Campaign cards — new campaigns; also leaderboard #1 badge
Campaign colour 4
Soft Lavender
#C4B5FD
Campaign cards — completed or low priority
Overdue / warning
Hot Coral
#FF6B6B
Overdue campaign indicator, late arrival count
Success
Teal Mint
#00D4AA
Task completed on time, on-time check-in confirmation
Primary text
Near White
#F0EFF8
All main text on dark backgrounds
Secondary text
Muted Lavender
#9896A8
Dates, subtitles, metadata, secondary info
Toast background
Dark Lifted + border
#1C1A2E + #7B61FF border
Meme toast notification pill

## 6.3 Typography
Use case
Font
Weight
Size
Greeting / hero number
Plus Jakarta Sans
ExtraBold 800
32–40px
Section headings
Plus Jakarta Sans
Bold 700
20–24px
Card titles / campaign names
Plus Jakarta Sans
SemiBold 600
16–18px
Leaderboard rank number
Plus Jakarta Sans
ExtraBold 800
48px — the hero element of that screen
Body / task descriptions
DM Sans
Regular 400
14–15px
Secondary / metadata
DM Sans
Regular 400
12–13px, muted lavender colour
Meme toast text
DM Sans
Medium 500
14px — friendly, readable, not too bold

## 6.4 Screen-by-screen layout guide
Screen
Layout
Home / Dashboard
Greeting top-left (large bold): "Hey Hustler [Name], Let's go 🚀". Date top-right. Two stat cards in a 2-column grid: today's task count + current leaderboard rank. Below: one active campaign card (most urgent). Bottom: leave balance pill. Bottom nav: 5 tabs — Home / Tasks / Campaigns / Attendance / Profile.
Task screen
Section header: "Kya plan hai aaj ka? 🎯". Task list as cards — each card has: task title bold, campaign tag pill, estimated time, On it/Nailed it buttons. Active task card glows with a soft purple border. Completed tasks stack at the bottom with a faint opacity.
Campaign screen
Campaign cards in a single scrolling column — each card uses one of the 4 campaign colours as a left border accent (16px wide) or as the card header background. Client name bold at top, Lead avatar + member count below, deadline countdown at bottom-right. Overdue cards flip to coral border + gentle pulsing indicator.
Leaderboard
Full scoreboard feel. Top 3 ranks shown large with rank number in ExtraBold (48px). Rank movement shown as an up/down arrow with colour (teal = up, coral = down). Streak badge shown below the person's name. Each person's score shown as one clean number out of 100.
Attendance
Calendar view of the current month. Each day chip colour-coded: teal = on time, coral = late, lavender = WFH, grey = weekend/holiday, white = upcoming. GPS check-in button is a large pill at the top — tap once to check in. WFH toggle appears on 2nd Saturday automatically.
Profile
Name + avatar at top. Leave balance shown as a circular arc — comp-off balance in purple arc, PL balance in teal arc, overlapping. Below: salary/deductions card (visible only to self/Admin). Leave history ledger in a scrolling list below.

## 6.5 Meme toast system
Every key action triggers a meme toast — a rounded pill notification that slides up from the bottom of the screen, sits for 3 seconds, then slides back down. It never blocks the UI. It never repeats the same line twice in a row. The line is randomly selected from the relevant bank each time.
Toast anatomy: dark lifted background (#1C1A2E) with a thin electric purple border, emoji on the left, meme text in DM Sans Medium, subtle slide-up animation. Width: fits the text, centred on screen, max 90% screen width.

## 6.6 Meme copy bank — full JSON structure
The following copy bank is structured as a JSON object. Each key maps to an event type; each value is an array of strings. The app picks one randomly per event. New lines can be added to any array at any time without touching the app code.
Note: All meme lines are written in the spirit of friendly banter — the same energy as a WhatsApp group with close colleagues. Nothing is punitive or shaming. Even the late-arrival taunts are clearly affectionate, not disciplinary.
Event
Meme lines — 10 per event, rotate randomly, never repeat twice in a row
Task completed ON TIME
1. Abhi maja aayega na bhidu! Deadline crusher in the building 🔥
2. Ye badhiya tha guru — seriously, no notes 🙌
3. Estimated: 30 mins. Actual: 28 mins. Are you even human?! 🤖
4. Campaign agency mein ek hi cheez on time aati hai — tera kaam 😎
5. Kohli wali energy — deadline se pehle century 🏏
6. Client ne abhi tak kuch nahi bola matlab kaam solid tha 💎
7. Task done. Chai deserve karta/karti hai tu ab ☕
8. Bhai kuch bhi ho, kaam time pe — bas yahi kaafi hai 🎯
9. Hustle unlocked. Experience +10. Respect +100 🚀
10. Sab log plan karte hain, tu execute karta/karti hai — farak yahi hai 💪
Task completed LATE (over estimate)
1. Late but done — better than a ghost town task list 👻
2. Ye toh hona hi tha... but chalega, aage badh 🙏
3. Itna time laga? Bhai 30 minute task tha, IPL match nahi 😂
4. Next time estimate thoda realistic rakh — hum judge nahi kar rahe, bas bata rahe hain 😅
5. Done is done. Ship karo, improve karo, repeat karo 🔄
6. Ek baar aur hoga toh Doraemon se time machine maangni padegi 🚪⏰
7. Overthinking ki dukaan band karo — next task mein faster honge 💭
8. Slow and steady wala kachhua bhi race jeeta tha, but deadline zyada important hai yaar 🐢
9. Chalo, at least abandoned nahi kiya — completion counts 🏁
10. Badhiya kaam slow se better hai junk kaam fast se — but faster bhi karo next time 😌
ON-TIME check-in (before 10:45)
1. 10:30 pe check-in? Bhai tu toh office ka door khol ke aa gaya 🚪
2. Early bird vibes — baaki log abhi snooze maar rahe hain 😴
3. Punctual Hustler has entered the chat ⚡
4. Sharma ji ka beta bhi itna time pe nahi aata 😤 (respect, seriously)
5. GPS ne confirm kar diya — tu actually aa gaya! Not a drill 📍
6. Subah subah aa gaye — monday is mondaying but you said nahi 💪
7. Tera future boss bhi proud hoga is check-in se 👔
8. Attendance: Present. Attitude: Ready. Chai: Mandatory ☕
9. Very demure, very punctual, very Hustling Collaborators 🎀
10. Naya din shuru hua — aaj ka Hustler ready khada hai 🌅
LATE check-in (after 10:45)
1. Aye bhidu, traffic ya neend — dono ne dhoka diya aaj? 😭
2. 10:46 pe aa gaye — ek minute aur hota toh drama nahi hota 🙃
3. Office aa gaye, late se, but aaye toh sahi! Count it 🚶
4. Doraemon ka anywhere door hota toh ye naubat nahi aati 🚪✨
5. Monday is mondaying extra hard aaj bhi, hum samjhe 😂
6. Bhai subah uthna padega — duniya 9 baje ki hai, boss ka office 10:30 ka 😬
7. Late aaye, par mood leke aaye? That's the deal we accept 😌
8. GPS ne dekha sab — but hum Chill Guy hain, sirf note kar rahe hain 😎
9. Ruk ruk ruk — aa toh gaye, next time alarm thoda serious le yaar ⏰
10. Golmaal ho gaya subah? Kal se seedha! Pinky promise? 🤙
3+ LATE arrivals in one month
1. Teen slow starts — bhai alarm pe visa lagana padega kya? 😂
2. Tera kya hoga re... 3 baar late? Recovery mode: ON 🔄
3. Hum judge nahi karte, but teen baar toh bhai thoda zyada hua 🤷
4. Seedha baat — subah uthna padega. Bas. No notes 📝
5. 3 late arrivals ek mahine mein — iss se zyada Golmaal nahi hona chahiye bhai 🎬
6. Baaki mahina abhi baaki hai — comeback ki script likh le jaldi 📖
7. Teen baar late aaye is mahine — bhai hero wala arc choose karo, villain wala boring hota hai 😂
8. Tu capable hai yaar, subah ki neend pe mat lutao ye potential 💤
9. Office waale tujhse pyaar karte hain — bas time pe aaja please 🙏
10. Arey mujhe chakkar aane laga yaar — teen baar? Kal seedha aana, deal? 🤝
PERFECT ATTENDANCE month (zero late)
1. POORA MAHINA! Zero late! Abhi maja aayega na bhidu! 🏆🔥
2. Tu toh Dev Maanus nikla re — ek bhi baar late nahi! 🙏
3. Indian Railways bhi itna punctual nahi hoti 🚂 (highest honour)
4. Bhai ye badge frame karke ghar pe laga — PERFECT ATTENDANCE 🖼️
5. Very demure, very mindful, very on-time — every single day 🎀
6. Sharma ji ka beta dekh raha hai aur roo raha hai 😭 (tu jeet gaya)
7. GPS ka kaam aasaan kar diya tune — hamesha sahi jagah, sahi time ⏱️
8. Tera alarm bhi proud hoga aaj 📱✨
9. 0 late arrivals — ye badhiya tha guru, sach bol raha hoon 🌟
10. Hustling Collaborators ka asli Hustler crowned ho gaya aaj 👑
WFH day check-in
1. Ghar se kaam — pajame mein bhi Hustler, respect 🏠🔥
2. WFH checked in — camera on rakhna bhai, hum jaante hain 😂
3. Bed aur laptop ke beech ki doori — zero. Productivity — maximum (hopefully) 💻
4. Ghar ka khana, ghar ka chai, ghar ka hustle — life set hai 🍽️☕
5. Remote Hustler has entered the building... err, the bedroom 🛏️
6. 2nd Saturday WFH — God bless the one who made this policy 🙌
7. Ek baar ghar se kaam karo, office ki AC yaad aane lagti hai 😅
8. Very demure WFH energy — neend aaye toh batana 😴
9. Doraemon ka anywhere door aaj teri desk hai 🚪✨
10. Checked in from home — kaam karo, Netflix baad mein 👀
Campaign DELIVERED on time
1. Campaign delivered! Abhi maja aayega na bhidu — aur kaise! 🏆
2. Client khush. Boss khush. Team khush. Aur hum bhi khush 🎯
3. Deadline se pehle wrap? This team is built different 💎
4. Ye badhiya tha guru — campaign bhi, execution bhi, team bhi 🙌
5. Log kehte the influencer marketing easy hoti hai... aur tum ne prove kar diya 😤
6. Khatam! Brief se delivery tak — ek bhi drama nahi. Rare achievement 🔓
7. Client ka phone aayega — iss baar complain ke liye nahi, taarif ke liye 📞✨
8. Campaign done. Portfolio mein add karo. Screenshot lo. Memories 📸
9. Pehle koi nahi bolta tha hum kuch kar sakte hain — ab dekh 🚀
10. Hustling Collaborators ne deliver kiya — golmaal bilkul nahi tha bhai 💪
Campaign OVERDUE
1. Yeh wala thoda golmal ho gaya bhai 🔴 — attention urgent hai
2. Deadline gayi... bhai Doraemon ka time machine seriously order karo ab 🚪⏰
3. Aye bhidu, is campaign ne deadline cross kar li — uthke dekho zara 👀
4. Arey! Mujhe chakkar aane laga — deadline nikal gayi kya?! 😵
5. Campaign status: golmaal. Solution status: turant chahiye 🔧
6. Bhai kya scene hai yaar — deadline cross? Sambhalo jaldi 🎬
7. Client waale poochh rahe hain... hum kya bolein unhe? Recovery plan bhejo 📋
8. Ye toh hona hi tha... nahi hona tha actually — fix karo jaldi 😬
9. Lead, team ko sambhalo — hum sab mile toh kuch bhi ho sakta hai 💪
10. Overdue flag laga — par Hustlers kabhi nahi rukते, recovery mode ON ⚡
Leaderboard RANK #1
1. NUMBER ONE! Abhi toh maja aayega na bhidu — KING/QUEEN OF THE BOARD 👑🔥
2. #1 — ye badhiya tha guru, iss baar sach mein 🌟
3. Table pe aa jao bhai — sabse upar khade ho aaj 🎉
4. Tu toh Dev Maanus nikla re — top of Hustling Collaborators! 🙏
5. Sharma ji ka beta dekh raha hai aur career switch soch raha hai 😂
6. Kya karenge aap itni achievement ka? Frame karoge? 🖼️
7. Bhai rank 1 pe aa gaye — treat kab de raha/rahi hai? 🍕🙃
8. Agency mein ek hi star hota hai is mahine — wo tu hai ⭐
9. Chill guy energy with rank 1 results — that combo hits different 😎📈
10. Screenshot le. LinkedIn pe daal. Caption: 'Hustling.' 💼
Rank MOVED UP
1. Upar aa gaye! Treat kab de raha/rahi hai? 📈🍕
2. Rank badha — momentum pakad liya, mat chodna 🚀
3. Climb ho rahi hai bhai — baaki log dekh rahe hain 👀
4. Consistency ka fal mitha hota hai — aur tu chakh raha/rahi hai 🍯
5. Ek ek kadam — top pe pahunchenge, promise 🎯
6. Pichle mahine se better — glow up confirmed 💫
7. Upar aa gaye matlab kuch sahi kar rahe ho — continue karo 👍
8. Bhai graph upar ja raha hai — tu stocks se better perform kar raha/rahi hai 📊
9. Rank up! Seedha Virat ki tarah — bas aur aggressive hona baaki hai 🏏
10. Hustle dikh raha hai score mein — badhte raho, dekh rahe hain 🔭
Rank MOVED DOWN
1. Iss mahine thoda slow — next month comeback pakka 🔄
2. Rank neeche? Golmaal tha thoda — but Hustlers bounce back 💪
3. Arey! Mujhe chakkar aane laga... but chill, ye temporary hai 😅
4. Drop hua rank — but RCB bhi kabhi kabhi haar ke comeback karta hai 🏏
5. Ye toh hona hi tha is mahine — but agle mahine nahi hona chahiye 😬
6. Neeche aaye, but hum tujhpe believe karte hain — next month solid aa 🙏
7. Bhai kya scene tha is mahine? Baat karein? 👀
8. Rank drop is data, not destiny — tu decide karta/karti hai aage kya hoga 💡
9. Bohot zyada self-roast mat karo — bas agle mahine better karo 🎯
10. Plot twist incoming next month — we can feel it already 📖
Leave APPROVED
1. Chutti approved! REST KARO PROPERLY — you have earned this 🏖️
2. Off day confirmed — recharge ho ke aana, fully charged please 🔋
3. Ghar pe Hustler rehna optional hai aaj 😂
4. Kuch mat socho, kuch mat karo — ye chutti hai, sponsored by HC 🎉
5. Doraemon bhi break leta tha — tu bhi le 🚪✨
6. OOO (Out of Office) activated — see you on the other side 👋
7. Leave approved — aur please actual rest karna, kaam mat karna chhutti pe 🙅
8. Sab sambhaal lenge — tu bas phone band rakh 😌
9. Kal ki chinta kal karenge — aaj chutti, aaj khushi 🌸
10. Boss ne sign kar diya, app ne confirm kar diya — tu FREE hai bhai! 🕊️
MONDAY morning first check-in
1. Monday is mondaying... but Hustling Collaborators kabhi nahi rukta 🚀
2. Naya hafta, naya mauka, nayi energy — ya toh chai pee pehle ☕
3. Aayo aayo — office khula hai, dimag bhi kholo 🧠
4. Monday ko bura mat bol — Monday ne kuch nahi kiya, neend ne kiya 😴
5. Bhai kya scene hai is hafte ka? Briefing mein milte hain 🎬
6. Week starts NOW — 5 days, endless hustle, let's build something 💪
7. Monday morning check-in — the most underrated flex of the week 💅
8. Golmaal hai bhai... but Monday mein bhi maja aata hai agar sahi log hon 😎
9. Fresh week, fresh campaigns, fresh chances — don't waste the Monday energy ⚡
10. Subah subah check-in — tu toh seedha Hustler hai, no warm-up needed 🔥
STREAK milestone (e.g. 4 weeks on time)
1. 4 hafte on time — ye badhiya tha guru, seriously, no jokes 🔥
2. Streak alive! Chin tapak dum dum level consistency 💪
3. Bhai teri punctuality ab streak ban gayi — Sachin ki centuries jaisi 🏏
4. Alarm ne kabhi zyada kaam nahi kiya hoga is mahine — respect 📱
5. Abhi maja aayega na bhidu — streak chal rahi hai, tod mat dena! 🏆
6. Consistent Hustler badge: EARNED. Legitimately. No shortcuts 🥇
7. Tu toh machine hai bhai — same time, same energy, every single day ⚙️
8. Streaks batate hain character kaisa hai — tera character solid hai 💎
9. Koi ye streak tod nahi sakta — sirf tu hi tod sakta/sakti hai, mat todna 🙏
10. Agency mein ek hi consistency wala hota hai — this month it's YOU 👑
EMPTY task list (morning)
1. Khaali list? Bhidu, din shuru kar — tasks khud nahi aate 🎯
2. Koi kaam nahi? Golmaal hai bhai 😅 — add your first task, let's go
3. Blank canvas — great things start from here 🎨
4. Task list empty hai — brain full hoga, usko yahan daal 🧠⬇️
5. Hustle bolta hai — 'Bhai mujhe kuch toh do karne ko' ⚡
6. Doraemon ka gadget bhi tere tasks ke bina kaam nahi karega 🚪😂
7. Empty list = opportunity. Full list = hustle. Which one are you choosing? 🤔
8. Aaj kya plan hai? Khud se poochh, phir yahan likh 📝
9. Din shuru hua, tasks nahi shuru hue — ek minute mein fix karo yaar ⏱️
10. Sharma ji ka beta pehle se 5 tasks daal chuka hai. Just saying. 😤
COMP-OFF approved
1. Sunday ka kaam, weekday ki chutti — deal pakka bhai 🤝
2. Comp-off approved! Extra hustle ka extra reward — fair trade ⚖️
3. Sunday pe kaam kiya? Tu toh Dev Maanus hai yaar 🙏
4. Abhi maja aayega — rest day earned legitimately 🏖️
5. Ye badhiya tha guru — Sunday hustle deserves a weekday break 🌟
6. Off day credited. Use wisely. Netflix bhi option hai, hum judge nahi karenge 😂
7. Worked on a holiday. Earned a day off. Living the Hustler life, not just talking about it 💎
8. Working on off days is elite behaviour — here's your reward 👑
9. Bhai Sunday pe bhi aaya/aayi? Puri team salute kar rahi hai 🫡
10. Hustle on a holiday = comp-off voucher. Simple maths, big reward 🧮

## 6.7 Things the design must never do
- Never show a ticking clock or countdown timer to the team member — not for tasks, not for anything.
- Never show raw numbers without context — always pair a number with a human interpretation (e.g. not just "3" but "3 slow starts this month — baaki mahina baaki hai 💪").
- Never repeat the same meme line twice in a row for the same event.
- Never use all-caps text in the UI except for the leaderboard rank number.
- Never make an error message feel punitive — errors are gentle, funny, and instructive.
- Never add more than 5 items to the bottom navigation bar.
- Never let a screen feel cluttered — if in doubt, remove something.

## 6.8 Logo usage in the app

- The coloured HC handshake mark (purple + yellow) is preserved as-is — it sits perfectly on the dark background and matches the app palette exactly.
- Always use the white text version on dark backgrounds — never use the black text version inside the app.
- Profile screen: Logo as a subtle watermark in the top corner.
- Leave approval toast: Tiny HC mark shown beside the approval message — feels like an official company stamp.
- Leaderboard header: Full logo above the scoreboard — gives the board an official, earned-trophy feel.
- Home dashboard: Small logo top-left, above the greeting text. Brand present without dominating.
- Login / splash screen: Logo centred on deep space dark background (#0F0E17) — first thing seen every time the app opens.
The white version of the Hustling Collaborators logo is used throughout the app. The text turns white for dark backgrounds while the purple-yellow HC handshake mark remains unchanged — it already matches the app colour palette exactly.

6.8 Logo — white version for dark background

# 7. Tone & Presentation Principles
This is the most important design requirement in the entire document. The exact same data can feel like surveillance or like a personal game, entirely based on how it is presented. Every feature must be built with this framing from day one — not added as a UI polish pass later.

## 7.1 The core principle
Every piece of information the app shows should answer one question from the team member's perspective: "What does this tell ME about MY day, so I can do better?" — not "What is this reporting to my manager about me?"

## 7.2 Language rewrites — feature by feature
Tasks

Instead of saying...
Say this instead
Start timer / Stop timer
On it 🔥  /  Nailed it ✅

Instead of saying...
Say this instead
Timer running: 1h 23m
A soft background glow on the task card — no clock face, no ticking numbers. Just a visual warmth that signals active work.

Daily Focus Time

Instead of saying...
Say this instead
Productivity score: 67%
Today's Focus: 6h 20m in the zone 🎯

Late arrivals

Instead of saying...
Say this instead
You have 3 late arrivals this month.
3 slow starts this month — still plenty of time to finish strong 💪

WFH days

Instead of saying...
Say this instead
Work from home marked.
Working from home today 🏠 — tap to confirm

Campaign overdue

Instead of saying...
Say this instead
OVERDUE — deadline missed
This one needs your attention 🔴

Leaderboard

Instead of saying...
Say this instead
Rank #3 — Punctuality: 82%, Task efficiency: 74%
#3 this month 🚀 — crushing it on deadlines, building your streak

## 7.3 Design rules
- No ticking clocks or countdown timers visible to the team member — not for tasks, not for anything.
- Positive framing first, always. Data that could be read as negative is reframed as opportunity.
- Numbers stay in the background. The team member reads the human interpretation, not the raw number.
- Streaks and personal bests celebrated as loudly as rankings.
- Empty states are invitations: "Ready for today? Add your first task" — not "No tasks logged."
- Managers see the same data in a slightly more structured view — numbers more visible for coaching purposes.

# 8. Task Management Module
Directly addresses the original problem: tasks with no time visibility. A task is created, tagged to a campaign, self-estimated, then started and finished — producing an honest actual-vs-estimate comparison without aggressive timers.

## 8.1 Task creation
- Task title, free text (e.g. "100 profiles shortlisting")
- Campaign tag — selected from campaigns the person belongs to (e.g. @Sugar Cosmetics)
- Estimated time — self-set, in minutes or hours (e.g. 30 mins)
- Task creation is always available — including on Sundays, mandatory holidays, and any other off day. Logging work on an off day does not require comp-off approval; only the comp-off credit itself requires prior approval.

## 8.2 Task execution
Action
What the member sees
What the system records
Tap "On it 🔥"
Task card shifts to active state — subtle visual warmth/glow. No clock, no timer.
Exact start timestamp recorded silently.
Tap "Nailed it ✅"
A small satisfying visual moment. If within estimate: a warm positive cue. If over estimate: card completes quietly — no negative flag shown to the member.
End timestamp. Actual duration = Done − Start. Comparison to estimate stored.

Note: Only the Start-to-Done window is counted as task time. The gap between creation and Start is not. This keeps the timing honest without feeling like a stopwatch.

## 8.3 Off-day task logging
- On Sundays, mandatory holidays, and other company off days, the app shows a clear indicator that it is a non-working day (per the holiday calendar).
- Task logging remains fully available on these days regardless.
- If total task-logged time on an approved off day exceeds 6 hours, the app flags the employee as comp-off eligible (see Section 8.4).

# 9. Attendance, WFH & Leave Module
This module fully replaces the current WhatsApp-based intimation process and encodes the company's Leave Policy (updated version, July 2026) directly.

## 9.1 Day types — how each type of day is handled
Day type
Attendance method
Notes
Regular office day
GPS check-in / check-out via app
Office timing 10:30 AM, grace period until 10:45 AM. After 10:45 AM = late arrival marked.
WFH day (2nd Saturday, or Admin-granted)
Simple WFH toggle — no GPS required
Employee taps "Working from home today 🏠" to confirm attendance. Shown distinctly in the attendance view.
Sunday / 4th Saturday
Off — tasks available, attendance not required
Visible as a non-working day in the calendar. Task logging available. If worked 6+ hours with prior approval, comp-off eligible.
Mandatory holiday
Off — tasks available, attendance not required
Shown as a company holiday in the calendar. If worked 6+ hours with prior approval, comp-off eligible.
Optional holiday
Off by default — employee may avail via leave request
Up to 2 optional holidays may be claimed per financial year. Claimed via the normal leave request flow.
Employee's birthday
Optional holiday — may claim via leave request
Per the published Holiday Calendar, each employee's birthday is an optional holiday entitlement.

## 9.2 Late arrivals — corrected per updated Leave Policy
The previous draft of this PRD incorrectly applied the Attendance Policy's automated PL deduction rule (5 lates = −0.5 PL; 10 lates = −1 day). The updated Leave Policy (July 2026) does not include automatic PL deductions for late arrivals. The correct rule is:
- Late arrivals are recorded and counted in the attendance view.
- Continued non-compliance is handled at Admin/Manager discretion — a warning letter may be issued, or the day may be marked as LWP, per the Attendance Policy's consequences clause.
- The app surfaces the late arrival count clearly to the Admin/Manager view, but takes no automated punitive action — the decision to escalate remains with the Admin or Manager.
Note: This is a deliberate correction from v2 of this PRD. The automated deduction rule from the older Attendance Policy document is superseded by the updated Leave Policy shared by the Founder in July 2026.

## 9.3 Half-day logic
A day qualifies as a half-day only if the employee logs at least 4 productive working hours (excluding breaks). Below 4 hours, the system treats the day as a full day's leave.

## 9.4 Comp-off — full flow
Compensatory leave is earned when an employee works more than 6 hours on an approved off day (Sunday, 4th Saturday, or a company holiday).
Step
What happens
1 — Pre-approval request (before the off day)
Employee submits an in-app comp-off work request before the off day begins: date, reason, and planned work/campaign. Routes to Admin/Founder for approval (Reporting Manager copied). This step must happen before the off day — no retrospective requests accepted.
2 — Admin approves or rejects
Admin approves or rejects in-app. Only pre-approved off-day work is eligible for comp-off credit. No approval = no comp-off, regardless of how much was worked.
3 — Employee works and logs tasks
On the approved off day, employee logs tasks normally using Start/Done. No hour counter shown, no threshold displayed — the app does not gate or pressure the employee on hours worked.
4 — Admin credits comp-off
After the off day, Admin reviews the tasks logged by the employee for that day (visible in Admin view) and credits 1 comp-off day at their discretion — one tap from the Admin side. The 6-hour guideline is the Admin's internal reference, not an automated app rule. Admin may credit comp-off even if logged hours are slightly under 6, based on judgment of the work done.
5 — Comp-off used before PL
When the employee applies for leave on any future day, comp-off balance is deducted first. Only once comp-off balance reaches zero does PL begin to be deducted.
6 — Comp-off expiry
Comp-off days are valid until the end of the financial year (31 March). Unused comp-off lapses at year-end and cannot be encashed or carried forward.

Note: The request must be submitted and approved before the off day begins — not after. The 6-hour guideline exists as an internal policy reference for the Admin when reviewing task logs, but is not enforced automatically by the app. The Admin's judgment is the final authority on whether comp-off is credited.

## 9.5 Full-time leave accrual (confirmed figures)
Rule
Value
Annual entitlement
18 Paid Leaves per financial year (1 April – 31 March), covering Casual/Personal and Sick Leave combined.
Pro-rata accrual
1.5 days credited at the start of each calendar month.
Probation length
3 months. Leave during probation is LWP only.
Opening balance after probation
6 days credited at the start of month 4 (3 months' probation accrual + 1 month current).
Advance leave cap
Up to 5 days in advance of accrual. Any excess is deducted in Full & Final Settlement.
Leave priority order
Comp-off used first → then PL → then LWP if both exhausted.
Carry-forward
None — unused PL lapses at financial year end.

## 9.6 Intern leave accrual (confirmed figures)
Rule
Value
Total entitlement
Up to 4 Paid Leaves across the 6-month internship, accruing 1 per completed month.
Probation length
First 2 months — no leave may be used.
Opening balance at month 3
3 days, credited at the start of month 3.
Accrual after month 3
1 additional day per month, up to the 4-day cap.
Leave priority order
Comp-off used first → then PL → then LWP.
Carry-forward
None — lapses at internship completion or termination.

## 9.7 Mid-Month Separation — Leave Accrual Reversal (new clause)

Policy clause: The 1.5 days of Paid Leave credited at the start of each month is granted on the presumption that the employee will remain in active employment through at least the 15th of that month. If the employee's last working day falls on or before the 15th of that month, that month's 1.5-day credit shall be treated as not earned. Any leave already used from that credit shall be retroactively converted to Leave Without Pay (LWP), with the corresponding salary value deducted in the employee's Full & Final Settlement. If the last working day falls after the 15th, the month's credit stands as fully earned, regardless of usage. The 15th itself counts as "on or before" — the credit is clawed back. This rule applies uniformly to voluntary resignation and involuntary termination, and is assessed against the employee's actual last working day after the notice period is served or waived.

## 9.8 Leave request flow
- Team Member submits a leave request (type, dates, reason) from the app.
- Routes to Reporting Manager for approval; Admin can also approve directly.
- On approval, balance updates automatically and request is logged permanently in the Leave Remarks ledger.
- All leave types (comp-off, bereavement, maternity/paternity, optional holiday) use the same flow, tagged by type.

# 10. Company Holiday Calendar — FY 2026–27
The following holidays are pre-seeded into the app from launch. Mandatory holidays are shown as company-wide off days for all employees. Optional holidays are shown in the calendar and may be claimed (up to 2 per financial year per employee) via the leave request flow.
Sundays and the 4th Saturday of every month are also marked as off days in the calendar. The 2nd Saturday of every month is marked as a WFH day.
Sr.
Date
Day
Holiday
Type
1
03 Apr 2026
Friday
Good Friday
Optional
2
01 May 2026
Friday
Maharashtra Day
Mandatory
3
28 May 2026
Thursday
Bakri ID
Optional
4
26 Jun 2026
Friday
Moharram
Optional
5
15 Aug 2026
Saturday
Independence Day
Mandatory
6
28 Aug 2026
Friday
Raksha Bandhan
Optional
7
04 Sep 2026
Friday
Janmashtami
Optional
8
14 Sep 2026
Monday
Ganesh Chaturthi
Mandatory
9
25 Sep 2026
Friday
Ganesh Visarjan
Optional
10
02 Oct 2026
Friday
Mahatma Gandhi Jayanti
Mandatory
11
20 Oct 2026
Tuesday
Dussehra
Optional
12
09 Nov 2026
Monday
Diwali
Mandatory
13
11 Nov 2026
Wednesday
Bhai Duj
Optional
14
25 Dec 2026
Friday
Christmas
Optional
15
01 Jan 2027
Friday
New Year
Mandatory
16
15 Jan 2027
Friday
Makar Sankranti / Pongal
Optional
17
26 Jan 2027
Tuesday
Republic Day
Mandatory
18
19 Feb 2027
Friday
Shivaji Jayanti
Optional
19
24 Feb 2027
Wednesday
Mahaveer Jayanti
Optional
20
10 Mar 2027
Wednesday
Ramzan ID
Optional
21
19 Mar 2027
Friday
Gudi Padwa
Optional
22
22 Mar 2027
Monday
Holi
Mandatory
23
26 Mar 2027
Friday
Good Friday
Optional
24
—
—
Each employee's birthday
Optional

Note: The holiday calendar is editable by Admins — new holidays can be added and existing ones can be edited or removed from the Admin control panel. The calendar refreshes for all employees immediately on any Admin change.

# 11. Campaign Management Module

## 11.1 Creating a campaign
- Campaign name (e.g. "Sugar Cosmetics"), members, one Campaign Lead, deadline.

## 11.2 Campaign cards
Each campaign displayed as a bold, client-branded card — not a table row. Deadline indicator changes character as deadline approaches:
- 5+ days away: calm teal-green — "On track"
- Within 5 days: amber — "Coming up"
- Deadline day: hot pink — "Due today"
- Overdue: hot pink + "This one needs your attention 🔴" + in-app notification to Lead and Manager

## 11.3 Lead visibility
Campaign Lead sees all members' task status (not timers) within that campaign — enough to track flow and spot blockers, without company-wide manager access.

## 10.4 Task tagging
Tasks tagged to a campaign roll up into campaign-level time and on-estimate data, feeding the leaderboard's campaign-delivery factor.

# 12. Focus Time & Daily Productivity
A personal window into how much of the workday went toward actual logged work — framed as self-insight, not a performance report.

## 12.1 Calculation
Input
How it works
Total clocked hours
Check-in to check-out time (GPS or WFH toggle).
Task time
Total Start-to-Done time across all tasks completed that day.
Focus Time
Task time expressed as "X hours Y minutes in the zone" — not a percentage, not a score. Simply the total logged task time for the day.

## 12.2 What the team member sees
- Personal stat card: "Today's Focus: 6h 20m in the zone 🎯"
- 5-day personal trend — simple bar or icon row, no percentages. Labelled "Your focus this week."
- No comparison to teammates. No ranking. Score updates once at end of day or check-out — not live.

## 12.3 What managers see
- Same data per team member in a slightly more structured view with numbers visible — for coaching and workload-balancing, not performance critique.
Note: Focus Time is not included in the public leaderboard in v1. Revisit after 2–3 months once the team has internalized the self-insight framing.

# 13. Salary & Deductions View
A transparency layer, not a payroll engine. Visible only to the employee, their Reporting Manager, and Admins.
Element
Description
Base salary
As recorded on the employee's profile.
Unpaid leave (LWP) deduction
(LWP days ÷ working days in month) × salary.
Late-arrival LWP conversion
If Admin/Manager marks late-arrival days as LWP, those are reflected here.
Advance-leave debt
Leave used in advance of accrual — shown as outstanding balance until covered by future accrual or deducted at separation.
Net estimated figure
Labelled explicitly as an estimate — not an official payslip.
Note: This is a calculated estimate for transparency only. It does not compute tax, PF, ESI, or other statutory deductions. Payroll compliance should continue through the company's existing statutory process.

# 14. Leaderboard Module
Public to the whole team, resetting monthly. Presented as a scoreboard — energetic and worth checking daily.

## 14.1 Formula (3 equal-weighted factors)
Factor
What it measures
Weight
On-time attendance
GPS/WFH check-ins before the late cutoff ÷ total working days in the month
33.3%
Task estimate accuracy
Tasks completed within self-set estimated time ÷ total tasks completed in the month
33.3%
Campaign deadline delivery
Campaigns delivered by deadline ÷ total campaigns the person was part of that closed in the month
33.3%

## 14.2 Presentation
- Rank with visible movement indicator (up/down arrow vs. last month).
- Streak recognition surfaced as a badge — e.g. "4 months on-time streak 🔥"
- Personal-best markers for each individual — newer team members have something to celebrate independent of raw rank.
- Language follows Section 6 Tone Principles throughout — celebrates what they did, not raw percentages.
Note: Launch as simple raw ranking in month 1. After the first full month, check with the team — if it is discouraging newer joiners, add tenure-aware adjustments at that point.

# 15. Technical Approach & Monthly Cost

## 15.1 Recommended stack
- Frontend: React — responsive web app, installable as a PWA. No App Store needed.
- Backend: Node.js
- Database: Postgres via Supabase or Neon free tier.
- Hosting: Vercel or Render free tier.
- GPS: browser-native Geolocation API — no paid SDK.
- Notifications: in-app only — no external service.

## 15.2 Estimated monthly cost
Component
Approach
Est. monthly cost
Hosting
Free tier — Vercel or Render
₹0
Database
Free-tier Postgres — Supabase or Neon
₹0
GPS check-in
Browser Geolocation API
₹0
Notifications
In-app only
₹0
Mobile access
Installable PWA — no native app
₹0
Domain (optional)
Custom domain if desired
₹800–1,500/year
Total
At current team scale (6–10 people)
₹0–500/month
Note: Cost rises meaningfully only if paid WhatsApp Business API notifications or a native mobile app are added later — both explicitly out of scope for v1.