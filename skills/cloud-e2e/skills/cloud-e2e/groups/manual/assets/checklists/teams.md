# Manual session — MS Teams (SWP-32, BKG-29, HPN-25, AUT-15)

|         |                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Testers | 1 person with a Teams client (desktop; mobile Teams for one layout check)                                                                                                                                                            |
| Where   | CT `ct-zinc-master` + the Teams app "myPOLYPOINT Testing"; Azure dev tenant `wr7g0` users `engsa`, `schre`, `shasm` (HP), `schbea` (SP) — passwords from the team's secret store, typed by the tester only                           |
| Before  | shared HPN-26 = **GO** (`results/<run>/shared/SH-TEAMS/HPN-26/teams-preflight.md`); ct-zinc-master owners informed (link resets, notifications); `poma.msTeams.notifications` ON on ct-zinc-master (owners decide; record the value) |
| Time    | ≈ 2.5 h (HPN-25 first: it is the login every other case needs)                                                                                                                                                                       |
| Record  | per scenario: PASS / FAIL / BLOCKED + one line; screenshots of every wrong card / page (crop names other than the test users) → the runner writes `scenarios/manual~<id>`                                                            |

DeployMate tenants cannot get Teams (one e-mail domain maps to one provider stage-wide). Never add a domain mapping.

## HPN-25 — MS Teams personal app: login, link reset, allow-myPP, layout, activity deep link

1. PolyID ops → Tenants → `ct-zinc-master` → Users → `engsa` → expand → "Reset MS Teams Link" → "Linked: NO".
2. Teams → myPOLYPOINT app → PolyID login with the on-prem user → dialog "allow myPOLYPOINT outside Teams" → "Ja" → dashboard inside Teams; PolyID ops shows "Linked: YES".
3. Close and reopen the app → no login.
4. Teams desktop: tab bar at the bottom; Teams mobile: at the top; no heat-map FAB, no "Zwischenspeicher leeren".
5. Trigger one notification for `engsa` (e.g. the BKG-29 booking below) → the Teams activity card → opens the target page and marks the notification-centre row read.
6. Optional, only on a tenant you own: "Enforce MS Teams only" ON → browser login of the same user is refused (`EnforceMsTeamsOnly`), Teams login works → switch OFF.
   Expect: as listed. Known: shift-swap cards open the legacy pages (see SWP-32).

## SWP-32 — MS Teams notifications and deep links of the swap lifecycle

1. With Teams users of one roster: `engsa` creates a direct swap inviting `shasm` (SWP-06 path in myPP), `shasm` accepts, `engsa` submits, `schbea` (SP) approves (SWP-08 → SWP-11 chain).
2. In Teams check each activity card (invitation, response, submission, approval); click the invitation and the response card.
   Expect: one card per event; the links open a working swap page. Today they open the legacy pages `/flows/calendar/opportunity-shift-trade-details/<id>` and `/flows/shift-marketplace/trade/<id>` → **KNOWN-FAIL SW-K5** if broken or legacy.

## BKG-29 — MS Teams activity notifications for booking / RR / IPO events

1. `schbea` books `engsa` via Find HP (one booking, BKG-12 path); starts an RR with `engsa` / `shasm` as candidates (invite, selection, rejection; BKG-21 path); publishes an IPO invite (BKG-23 path).
2. Check each Teams activity card and its deep link.
   Expect: one card per event; links open the routes of BKG-28. Known mismatches: selection opens WEEK_VIEW, rejection opens OPPORTUNITY_DETAIL (**N-11 / N-12**).

## AUT-15 — Logout from myPOLYPOINT inside Microsoft Teams

1. In the Teams app (logged in from HPN-25): Profile → "Ausloggen".
   Expect: the login page or the app start page — **not** the Ory page "Logout failed because query parameter state is set but id_token_hint is missing"; reopening the tab requires the Teams auto-login again (PPCLOUD-14322 part 2).

## After the session

- Leave `engsa` linked or reset — as agreed with the owners (record which).
- Cancel / reject the swap, booking, RR and IPO created here (myPP / planner app).
