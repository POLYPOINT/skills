# Group swap — scenario catalogue (SWP, 33 scenarios)

Converted from `areas/swap/scenarios.md` (A-swap, 2026-10-22; code base cloud master 89d7e960e0, pp-services origin/master ff3895d970) with the S1 reconciliations of 2026-10-23:

- environment = **DM-X** (shared with booking, partner, hp, ts); flags = steward baseline; definitions (DIENSTTAUSCH, DIENST_TEILEN, swappable absence) and rights = steward kits; the group only seeds its own claimed people and days (`data-plan.md`);
- **PSP-14 merged into SWP-15** (read-only SP detail modal, step 6);
- SWP-31 reads the steward's **run partner** (never edits it);
- moved out: SWP-20 → group `shared` (needs on-prem < 26), SWP-32 (MS Teams client) and SWP-34 (phone push) → group `manual`;
- harness names: `app.mjs --app mypp|poma` (was `mypp.mjs` / `poma-web.mjs`), `portal-ops.mjs` (was `portal-flag.mjs` / `portal-partner-log.mjs`), `plan-day.sh` (was `swap-day.sh`), `pp-plan.sh` (api-pp `direct-shift-planning`, was harness item H-4).

Families: A gates (SWP-01, 02, 04, 05) · B direct lifecycle (06, 08, 11, 09, 10, 12, 13, 15, 16) · C flexible (17, 18, 19) · D PEP-driven cancellation (21–25) · E half-shift (26–29) · F channels (33, 35, 36, 30, 31) · window families X03 (SWP-03), X07 (SWP-07), X14 (SWP-14). The worker-facing steps with resolved tokens are in `assets/family-briefs/<F>.md`; this file is the reference text.

| Moved out                                                 | Now in                   | Why                                       |
| --------------------------------------------------------- | ------------------------ | ----------------------------------------- |
| SWP-20 Below on-prem 26: generic list keeps "Abwesenheit" | `shared`                 | DeployMate offers only master and main-26 |
| SWP-32 MS Teams notifications and deep links              | `manual` (Teams session) | real Teams client and tenant              |
| SWP-34 Real push on a phone                               | `manual` (phone session) | real device                               |

Data and concurrency: `data-plan.md`. Dashboard rows: `../assets/scenarios.json`.

Conventions used by every scenario:

- **Environment**: DeployMate env DM-X (`customer-roster`, master pin, bundle reports 26.99.0 → every capability) after the steward kits and this group's seed (`data-plan.md` §3). Tenant flags = steward baseline: `poma.flows.shiftTrades` ON, `poma.flows.shiftTradesWithCategories` ON, `poma.onPrem.writeShiftsOnPrem` ON, `poma.onPrem.nodeBasedApprovers` ON. A scenario that needs another value runs in its window (X03 / X07 / X14).
- **Actors and apps**: HP1 = owner, HP2/HP3 = candidates, HP4 = other personnel category, HPX = HP without the right "Diensttausch einreichen", SP = shift planner. HPs act in myPP web `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app` through `scripts/harness/app.mjs <tenant> <login> <script> <outdir> --app mypp` (one persistent profile per worker and login; in-app mobile path `mypp-inapp.mjs` only in SWP-35). SP acts in the POMA web app `…/shift-planner` through `app.mjs … --app poma` (login predicate `/shift-planner/`). Multi-actor scenarios run one harness call per actor step, in the order given; never two calls for the same login at once inside one worker.
- **People and days**: the role names (HP1, HP2, HP3, HP5, HP6, HPX …) and day tokens (F1..F22, FA1..FA4, FC2..FC4, H1..H13, TODAY, P−1) used below are scenario-local placeholders; `data-plan.md` §2.3 maps each scenario to real people (T1..T10, U1..U4, SP) and days (D1..D5 seeded future weekdays, W1/W2, HA..HD painted, TODAY, PM1 = P−1); the family briefs carry the resolved tokens. A (person, day) belongs to exactly one scenario (locks are per user and day); the same calendar day is shared by scenarios with different people.
- **API evidence**: capture the XHR responses (the harness records every `/api/` call). HP base `/api/mobile/health-professional/v1` (`calendar/planned-shift-detail`, `calendar/user-calendar-locks`, `shift-definition/roster`, `calendar/shift-trade-candidates`, `shift-trades`, `shift-trades/open-shift-trades[/{id}]`, `shift-trades/cancelled-shift-trades?limit=10`, `shift-trades/tradable-shifts-for-compensation[-from-conflict-checker]`, `opportunities/{id}/application`, `opportunities/{id}/submission?shift-trade-request-id=`, `DELETE opportunities/{id}`, notification-center `notifications…`), capabilities `GET /api/capabilities/v1/capabilities`, features `GET …/config/features?appGroup=…`. SP base `/api/private/shift-trades` (`past-and-current[?opportunity-state&hp-id]`, `past-and-current/participants`, `PUT {id}/check-conflicts-and-write` `{shift_trade_request_id, operation: APPROVE|REJECT, status_message}`, `PUT {id}/apply-and-write`). Save each as `<endpoint>.json`.
- **Shortcut creation**: scenarios that are not about the creation UI may create their swap through `api.call('POST', '/api/mobile/health-professional/v1/shift-trades', body)` inside the HP1 harness session, with the body `{shift: {shift: <planned-shift-detail>, message, candidates: [<chosen entries of the candidates response>]}, compensation_shift?: {shift: <planned shift>, message, candidates}}` (`CreateShiftTrade`, myPP `shift-swap-api.service.ts`); helper `createSwap()` in `../scripts/swap-lib.mjs`. The response carries only `url`: read the opportunity id from the owner's `open-shift-trades`. Record the opportunity id.
- **Oracles** (never "looks fine"):
  - **PEP/DB**: `ECBERN.PLANUNG` rows of the employee and day — `PA_CODE`, `DIENSTPOSITION` (`GANZ`/`LINKS`/`RECHTS`), `DIENSTTEIL` (`G`/`L`/`R`), `PLANUNG_ID` — read with `scripts/plan-day.sh <tenant> <emp> <day>` (core helper). No PEP lock needed for DB reads.
  - **Cloud state**: owner `GET …/shift-trades/open-shift-trades/{id}` (`state`, `shift_trade_requests[].status`, `applications[].response`), owner lists (`open-shift-trades`, `cancelled-shift-trades`), SP `past-and-current?opportunity-state=…` filtered by **the scenario's own opportunity id** (never by counts: the SP sees every swap of the tenant).
  - **Locks**: `POST …/calendar/user-calendar-locks?from=<day>&to=<day>` as the user → `user_calendar_locks[0].is_locked`.
  - **Notifications**: the recipient's notification-center response (type `SHIFT_TRADE…`, the opportunity id, created after the step's timestamp) — this is the record behind the push (same `sendPushCenterNotification` call). Partner delivery is SWP-31; real push and MS Teams are group `manual`.
- **Selectors** (no data-test attributes; harness locale de-CH): footer `#primaryButton` / `#secondaryButton` / `#backButton`; planned-shift detail primary button text "Diensttausch"; FAB inner button `.shift-swap-button` (title "Diensttausch"); stepper titles "Wunsch", "Vorschläge", "Angebot", "Auswahl", "Übersicht"; buttons "Weiter", "Zurück", "Bestätigen"; candidate checkbox aria-label "<Name> am <Datum> auswählen"; pre-page / offer card aria-label "Angebot für <Titel> am <Datum> auswählen"; filters "Alle Filter (n)", toggle "Mitarbeitende mit Konflikten anzeigen", tree "Personalkategorie"; candidate decline = "Ablehnen" with option "Ablehnen mit Kommentar"; owner cancel "Tausch löschen"; marketplace `/tabs/shiftmarketplace?tab=shift-trade` sections "Meine Tauschanfragen", "Auf Annahme wartend", "Abgesagt"; swap detail routes `/flows/shift-swap/detail-view/{id}` (candidate) and `/flows/shift-swap/detail-manage/{id}` (owner) — entered from the marketplace or a notification, not deep-linked cold. SP: side menu "Diensttausch" → `/shift-planner/shift-swap-marketplace`, filter "Status" (options "Alle", "Offene Anfragen", "Zugesagt", "Abgelehnt", "Abgelaufen"), "Mitarbeitende", "Filter zurücksetzen"; dialog "Detailansicht" with `#shift-swap-request-accept-button` ("Bestätigen"), `#shift-swap-request-cancel-button` ("Ablehnen"), textarea "Kommentar (optional)", `#shift-swap-request-close-button`.
- **Evidence naming**: `NN-<step>-<actor>.png`, `<endpoint>.json`, `oracle-<what>.txt|json`, `notes.md`. Every non-PASS has an outlined issue screenshot (`issueShot`) or a `jsonShot` (`e2e-lib.mjs`).
- **Cleanup**: every scenario ends with no OPEN/SUBMITTED swap of its own (cancel what is left) and reports PEP writes in `created_data` (approved swaps change the roster; the runner restores the paint-plan cells only if the env is reused).

## Known deviations

KNOWN-FAIL ids SW-K1..SW-K7 with their signatures: `known-deviations.md` (this folder).

## A. Gates and entry rules

### SWP-01 Swap preconditions gate (API)

> Data prerequisite: steward kits + flag baseline (DM-X) and this group's seed S1–S8 (`data-plan.md` §3) done. BLOCKED otherwise (every swap scenario depends on it).
> Pre: tenant flags at baseline; HP1..HP3, HP4, HPX, SP logins from the env facts.
> Steps: 1. HP1 harness: log in, open `/tabs/home`; capture `GET /api/capabilities/v1/capabilities` and `GET …/config/features?appGroup=…`. 2. HP1 opens `calendar/planned-shift-detail` of its F1 planning (calendar → day F1 → tile); capture the response. 3. HPX: log in, capture the PolyID profile/permissions request the app makes at start (the `/permissions` or user-profile call carrying `permissions.shift_trade`). 4. SP (`app.mjs --app poma`): log in, open "Diensttausch"; capture `GET /api/private/shift-trades/past-and-current?opportunity-state=SUBMITTED`. 5. DB: `plan-day.sh` for HP1..HP3 on F1 and for the half days H1..H6.
> Expect: capabilities contain `GET_SHIFT_TRADE_CANDIDATES`, `GET_SHIFT_TRADE_CANDIDATES_EXTENDED_SEARCH`, `GET_SHIFT_TRADE_CANDIDATES_WITH_TARGET_EMPLOYMENT_IDS`; features `shiftTrades: true`, `shiftTradesWithCategories: true`; planned shift `available_for_shift_trade: true`, `shift_kind: PRESENCE`; HP1 `shift_trade.submit_shift_trade: true`, HPX `false` (present, not missing — a missing block defaults to true in myPP); SP list call 200 and the user lands on `/shift-planner/…` (role SHIFT_PLANNER); PLANUNG rows exactly as `data-plan.md` §2.
> Oracle: the captured JSON fields above; DB rows vs the data plan.
> Evidence: capabilities.json, features.json, planned-shift-detail.json, permissions-hpx.json, sp-past-and-current.json, oracle-planung.txt. Source: 14144700420#1, 14149976102#2/#3/#6/#10, gap G-01, PPCLOUD-14262.

### SWP-02 Trade-button rules on the planned-shift detail

> Data prerequisite: HP1 plannings on P−1 (past), TODAY (start later than the run time), F2 (swappable presence), F3 (on-call Pikett), F4 (presence of a non-swappable definition, `DIENSTTAUSCH='F'`), FA1 (swappable absence).
> Pre: no open swap of HP1 on these days.
> Steps: for each day: calendar (`/tabs/calendar`) → day → planned-shift tile → detail; screenshot; capture `planned-shift-detail`.
> Expect: P−1: no "Diensttausch" button; TODAY: no button, info text "Diensttausche sind nur am nächsten Tag möglich"; F2: button present; F3: no button (kind ON_CALL); F4: no button (`available_for_shift_trade: false`); FA1: button present (absence date in the future).
> Oracle: presence/absence of the footer `#primaryButton` with text "Diensttausch" + the `shift_kind` / `available_for_shift_trade` fields of the captured response for the same planning.
> Evidence: 01..06-detail-<day>.png, planned-shift-detail-<day>.json. Source: 14150369282#1, #4, 11465982071#8, 14149976102#4/#6/#9, gap G-22.

### SWP-03 Flag and right negatives (exclusive)

> Data prerequisite: HPX planned on F5 (swappable presence) and in the HP1 team; the runner's portal-ops session (`portal-ops.mjs login`, ≈ 1.5 h) and the window W-X-TRADES-OFF `active`.
> Pre: window W-X-TRADES-OFF `active` (it pauses every swap family, partner PAPI/PE and hp HP/PV: the flag disables every swap endpoint of the tenant).
> Steps: Part A (right): 1. HPX: detail of F5 → no button; calendar month view, select F5, open FAB → no `.shift-swap-button`. 2. HPX: navigate to `/flows/shift-swap/planned-shift` via `api.goto` → record what opens (SW-K4). 3. If the pre-page opens: pick F5, step 1, candidates, summary "Bestätigen"; capture `POST shift-trades`. 4. Cancel any created swap ("Tausch löschen"). Part B (flag): 5. Operator: `portal-ops.mjs … flag set <env> poma.flows.shiftTrades false`; wait ≈4 min (portal cache + poma reload). 6. HP1: hard reload; detail of F2 → no button; FAB → no shift-swap entry; `api.goto('/flows/shift-swap/planned-shift')` → guard refuses (stays/redirects); `api.get('/api/mobile/health-professional/v1/shift-trades/open-shift-trades')` → 4xx (`@EnabledByFeature`). 7. Restore: `portal-ops.mjs … flag delete <env> poma.flows.shiftTrades`; HP1 reload → button back on F2.
> Expect: A1 no entry points; A2/A3 expected **refused** — today the flow opens and creation answers 200 → KNOWN-FAIL SW-K4; B6 no entry points and the endpoint refuses; B7 restored.
> Oracle: DOM (button/FAB entry), final URL after `api.goto`, HTTP status of the direct calls, portal feature read after restore.
> Evidence: screenshots per step, create-response.json (if any), features-before/after.json. Source: 14150369282#2/#3/#14/#15, 14149976102#2/#3, gap G-04.

### SWP-04 FAB entry and pre-page

> Data prerequisite: HP1 plannings F2 (swappable), F4 (non-swappable) and past days; month and week view available.
> Pre: no open swap of HP1 on F2/F4.
> Steps: 1. `/tabs/calendar`, month view, select P−1, FAB → "Diensttausch" → pre-page "Welchen Dienst möchten Sie tauschen?": record selected day, past/today days disabled. 2. Back; select F2 → FAB → pre-page selected day = F2; card of the F2 planning selectable. 3. Select F4 in the pre-page → card disabled (PPCLOUD-13978). 4. Week view → FAB → pre-page selected day = tomorrow. 5. In the pre-page select F2's card → "Weiter" → stepper step "Wunsch" shows the F2 shift as "Folgenden Dienst tauschen"; back out without creating.
> Expect: as listed; the FAB entry is visible in all cases with flag + right (no date condition).
> Oracle: DOM state (disabled days/cards via `aria-disabled`/class, selected day header), URL `/flows/shift-swap/<sp>/<rc>/request` with the F2 planning's ids from `planned-shift-detail`.
> Evidence: 01..05 screenshots, calendar responses. Source: 14150369282#13/#16/#17/#19, 14149976102#14, gap G-22.

### SWP-05 Day locks: owner blocked, locked candidate hidden

> Data prerequisite: HP5, HP6 and a second owner HP1' of the same team planned on F6 with three different swappable definitions, plus one more team member as a control candidate (allocation: U1 = HP5, U2 = HP6, U3 = HP1', U4 control, day D1).
> Pre: none of them in a swap on F6.
> Steps: 1. HP5 creates a direct swap on F6 inviting HP6 (shortcut creation). 2. HP6 accepts (detail-view "Bestätigen") → HP6 locked on F6. 3. HP5: detail of F6 → "Diensttausch" → modal "Tausch blockiert"; FAB pre-page → F6 dot greyed + banner "Dieses Datum ist derzeit nicht verfügbar."; capture `user-calendar-locks`. 4. HP5: `api.call('POST', …/calendar/shift-trade-candidates, {F6 planning})` → error `USER_IS_LOCKED`. 5. HP1': start a swap on F6 → step "Vorschläge": HP6 **not** listed, the control candidate listed; capture candidates; back out. 6. HP5: "Tausch löschen" → locks released; HP1' repeats step 5 → HP6 listed again. (The compensation-day lock of a flexible swap is checked in SWP-17 steps 3 and 7.)
> Expect: as listed.
> Oracle: `user-calendar-locks` `is_locked`, modal text, candidates response before/after (employee ids), error body name `USER_IS_LOCKED`.
> Evidence: locks-\*.json, candidates-before/after.json, modal + banner screenshots. Source: 14150369282#5/#18, 14149550106#2, 14149124142#4, 14149976102#5, gap G-02.

## B. Direct swap lifecycle (core regression; replaces 11465982071)

### SWP-06 Direct swap creation from the shift detail

> Data prerequisite: F1: HP1 Früh 111, HP2 Spät 112, HP3 Mittel 113 (same team and category), HP4 (other category, same roster) Spät 112; one candidate with a WARNING/FORBIDDEN conflict on F1 (data-plan §2 "conflict candidate"; BLOCKED for step 6 if none could be built); HPX planned on F1 (must not appear).
> Pre: clear local storage key `…show_shift_swap_candidates_conflicts` in HP1's profile (fresh profile or `localStorage.clear()`).
> Steps: 1. HP1: dashboard tile or calendar → F1 detail → "Diensttausch" → step "Wunsch"; capture `shift-definition/roster`. 2. Check nothing selected, `#primaryButton` disabled. 3. Open the selector: list = roster definitions with `available_for_shift_trade`, presences and absences, without 111. Pick 112 → "Weiter" enabled; stepper shows 3 steps. 4. "Weiter" → "Vorschläge": `#primaryButton` disabled; capture `shift-trade-candidates`. 5. Candidates shown: HP2 (and HP3 only if 113 is chosen); HPX not shown; the conflict candidate hidden. 6. "Alle Filter" → toggle "Mitarbeitende mit Konflikten anzeigen" on → conflict candidate shown; off → hidden; on again; note the localStorage value. 7. "Personalkategorie" filter: add HP4's category → HP4 listed (categories request captured). 8. Select HP2 → "Weiter" → "Übersicht" (texts "Ich möchte am …", "Tausch") → "Bestätigen"; capture `POST shift-trades` (save body + response) → page "Tauschanfrage gesendet". 9. `/tabs/shiftmarketplace?tab=shift-trade` → "Meine Tauschanfragen" contains the swap. 10. New harness session for HP1 (same profile) → start another swap → toggle still on (persisted). 11. HP2: notification center → new swap invitation; tap → `/flows/shift-swap/detail-view/{id}` "Offene Tauschanfrage". 12. HP1 locked on F1 (`user-calendar-locks`).
> Expect: as listed; `POST shift-trades` 200 with an opportunity id; owner list entry state OPEN.
> Oracle: captured JSON (definition list, candidates ids, create response, open-shift-trades), localStorage value `true` after reload, HP2 notification record with the opportunity id, lock `is_locked: true`.
> Evidence: 01..12 screenshots, shift-definition-roster.json, candidates.json, create-request.json, create-response.json, open-shift-trades.json, hp2-notifications.json, locks.json. Source: 14150369282#6–#11, #19, 11465982071#1, 14149124142#3, 14149976102#1/#7/#11/#12/#15, gap G-02.

### SWP-07 Category filter OFF (exclusive flag)

> Data prerequisite: as SWP-06 on F8 (HP4 other category).
> Pre: window W-X-CATEGORIES-OFF `active`; runner portal-ops session.
> Steps: 1. `portal-ops.mjs … flag set <env> poma.flows.shiftTradesWithCategories false`, wait ≈4 min, HP1 hard reload. 2. HP1: F8 detail → stepper → "Vorschläge": no "Personalkategorie" filter; HP4 not listed; no categories request (or 4xx if called). 3. Back out. 4. Restore (`delete` override → baseline ON), reload, HP4's category filter is back.
> Expect: as listed.
> Oracle: DOM (filter tree absent), candidates response, absence of the categories call in `api-index.jsonl`, portal feature read after restore.
> Evidence: screenshots, candidates.json, features.json. Source: 14150369282#9, 14149124142#3, 14149976102#12.

### SWP-08 Candidates answer, owner selects and submits

> Data prerequisite: depends on the swap of SWP-06 extended to HP3, or a fresh shortcut swap on F9 inviting HP2 and HP3 (HP1 111, HP2 112, HP3 112).
> Pre: swap OPEN, nobody answered.
> Steps: 1. HP1: marketplace → "Meine Tauschanfragen" → swap → detail-manage: cards HP2, HP3 with chip "Ausstehend", checkboxes disabled, "Bestätigen" disabled. 2. HP2: notification center → tap → detail-view (calendar of HP2's events, "Bestätigen", "Ablehnen") → "Bestätigen" → "Zusage gesendet"; capture `POST opportunities/{id}/application` `{response: YES}`. 3. HP3: same → YES. 4. HP1: notification center shows two responses; detail-manage: chips "Zugesagt", checkboxes enabled, "Bestätigen" still disabled; tick HP2 → enabled → "Bestätigen"; capture `submission`. 5. HP1 marketplace: swap in "Auf Annahme wartend". 6. HP3: notification "not selected" (SHIFT_TRADE_NONSELECTION); HP3 unlocked on F9 (`user-calendar-locks`); HP2 still locked. 7. SP: "Diensttausch" (landing "Offene Anfragen") → the swap row present (HP1 ↔ HP2, F9).
> Expect: as listed; owner state SUBMITTED, HP2 request SUBMITTED.
> Oracle: application/submission responses 200, `open-shift-trades/{id}` statuses, notification records for HP1 (2 responses) and HP3 (non-selection), locks of HP2/HP3, SP `past-and-current?opportunity-state=SUBMITTED` contains the opportunity id.
> Evidence: per-step screenshots and JSON. Source: 14149124150#1–#5, 11465982071#2/#3, 14149976102#17, gap G-02.

### SWP-09 Single candidate declines → swap cancelled

> Data prerequisite: F10: HP1 111, HP2 112. Shortcut swap HP1 → HP2 only.
> Steps: 1. HP2: notification → detail-view → "Ablehnen" (main click) → "Angebot abgelehnt"; capture `application` `{response: NO}`. 2. HP1: notification "abgelehnt"; marketplace: swap in "Abgesagt"; detail shows "Der Tausch wurde abgesagt." 3. HP1 and HP2 unlocked on F10. 4. HP1 can start a new swap on F10 (step "Wunsch" opens; back out).
> Expect: swap CANCELLED at once, requests DENIED.
> Oracle: `cancelled-shift-trades` contains the id; `open-shift-trades/{id}` state CANCELLED (or 404 from the open list); locks false; HP1 notification record.
> Evidence: screenshots, JSON. Source: 14149124150#6, 14199619612#2/#7/#12/#17/#22/#27/#32.

### SWP-10 Decline with comment while another candidate is pending

> Data prerequisite: F11: HP1 111, HP2 112, HP3 112. Shortcut swap HP1 → HP2, HP3.
> Steps: 1. HP2: detail-view → open the "Ablehnen" menu → "Ablehnen mit Kommentar" → dialog → text "SWP-10 Kommentar" → send; capture `application` `{response: NO, message}`. 2. HP1: detail-manage: HP2 card "Abgelehnt" with the comment, HP3 "Ausstehend"; swap still in "Meine Tauschanfragen". 3. HP3 does nothing. 4. Cleanup: HP1 "Tausch löschen".
> Expect: swap stays OPEN; comment visible to HP1.
> Oracle: application request body + response; `open-shift-trades/{id}` state OPEN with HP2's application NO + message; HP1 notification record.
> Evidence: screenshots incl. the dialog, JSON. Source: 14149124150#7, 14149976102#16.

### SWP-11 SP approves a direct swap — PEP written (core)

> Data prerequisite: the SUBMITTED swap of SWP-08 (F9) — or a fresh one prepared by shortcut + accept + submit. `writeShiftsOnPrem` ON.
> Pre: DB before: HP1 F9 = 111, HP2 F9 = 112 (`plan-day.sh`).
> Steps: 1. SP: "Diensttausch" → row of the swap → "Detailansicht" (description "Folgende Mitarbeitende möchten neu …"), no conflict banner → `#shift-swap-request-accept-button` "Bestätigen"; capture `check-conflicts-and-write` (`state: SUCCESS`). 2. SP list: filter "Zugesagt" → swap present. 3. DB after: HP1 F9 = 112, HP2 F9 = 111, same `DIENSTPOSITION`; no extra planning. 4. HP1 + HP2: notification "genehmigt" (SHIFT*TRADE_APPROVAL); HP1 calendar F9 tile shows 112; detail-view/manage text "Der Tausch wurde genehmigt." 5. Locks of HP1/HP2 on F9 released.
> Expect: as listed.
> Oracle: `check-conflicts-and-write` body `state`; PLANUNG before/after; notification records; locks false; owner list no longer OPEN/SUBMITTED.
> Evidence: sp-*.png, check-conflicts-and-write.json, oracle-planung-before/after.txt, notifications-\_.json. Source: 14149287976#1–#3, 11465982071#4–#6, 14149976102#19.

### SWP-12 SP declines — without and with comment

> Data prerequisite: two SUBMITTED swaps prepared by shortcut (create + YES + submission): S-A on F12 (HP5 ↔ HP6), S-B on F12b (HP1 ↔ HP3; data-plan day F12b).
> Steps: 1. SP: S-A → "Detailansicht" → "Ablehnen" with empty comment; capture `check-conflicts-and-write` `{operation: REJECT, status_message: null}`. 2. SP: S-B → type "SWP-12 Ablehnungsgrund" into "Kommentar (optional)" → `#shift-swap-request-accept-button` disabled → "Ablehnen"; capture request (`status_message`). 3. SP list filter "Abgelehnt": S-A state "Abgelehnt", S-B "Abgelehnt mit Kommentar"; open S-B → comment read-only. 4. HP1 (S-B): notification rejection; marketplace "Abgesagt"; detail-manage shows "Kommentar Dienstplaner: SWP-12 Ablehnungsgrund". HP3 notified too. 5. DB: PLANUNG of all four unchanged; locks released.
> Expect: as listed.
> Oracle: request bodies, SP list rows by opportunity id (`state`, `state_message`), notification records, PLANUNG unchanged.
> Evidence: screenshots incl. disabled button, JSON, oracle files. Source: 14149287976#4/#5, 11465982071#4, 14149976102#18.

### SWP-13 SP approval with new conflicts: dialog accept / dialog cancel

> Data prerequisite: two SUBMITTED swaps S-C (HP1 ↔ HP2 on F13) and S-D (HP5 ↔ HP6 on F13). After submission the worker adds a conflicting planning (`{{CONFLICT_RECIPE}}`, via `pp-plan.sh` or PEP under the db lock) for HP2 and for HP6 on F13 that makes on-prem report a conflict for the incoming shift (seed S7 recipe; BLOCKED-data if no conflict appears).
> Steps: 1. SP: S-C → row shows the conflict banner (names) if the conflict existed at creation; "Bestätigen" → `check-conflicts-and-write` answers `state: CONFLICT` → dialog lists the conflicts with HP1/HP2 names → accept → `apply-and-write` 200. 2. DB: S-C swapped. 3. SP: S-D → "Bestätigen" → dialog → cancel → UI sends REJECT; capture. 4. DB: S-D plannings unchanged (no created-but-unapplied planning left: compare `PLANUNG_ID`s and count before/after). 5. HP5: S-D in "Abgesagt"; HP1: S-C approved notification.
> Expect: as listed.
> Oracle: responses (`state` CONFLICT → SUCCESS), PLANUNG before/after for 4 employees, SP list states.
> Evidence: dialog screenshot, JSON, oracles. Source: 14149287976#6, 11465982071#4, 14149976102#18, 14780334107#17 (pattern).

### SWP-14 SP approval in pull mode (`writeShiftsOnPrem` OFF, exclusive)

> Data prerequisite: a SUBMITTED swap S-E (HP1 ↔ HP3 on F14). PEP running (pull is PEP-side, UNVERIFIABLE in code).
> Pre: window W-X-WRITE-OFF `active` (state 1 of 2: swap; booking BKG-25 follows in the same window); runner portal-ops session.
> Steps: 1. `portal-ops.mjs … flag set <env> poma.onPrem.writeShiftsOnPrem false`, wait ≈4 min. 2. SP: S-E → "Bestätigen" → no dialog; capture `check-conflicts-and-write` (`state: SUCCESS`). 3. SP list "Zugesagt". 4. API: `GET /api/v1/shift-trades/submitted` with a token that may call it (SP token first; record the status) → S-E listed or not. 5. DB: read PLANUNG of HP1/HP3 on F14 every 2 min for 20 min; record when (if) they swap. 6. Restore the flag (`delete` override), wait, verify the feature read.
> Expect: cloud FINALIZED immediately; PEP swap only if PEP pulls — expectation to be confirmed (record the observed delay or "not applied within 20 min").
> Oracle: responses, public API body, PLANUNG time series.
> Evidence: JSON, oracle-planung-timeseries.txt. Source: 14149287976#1 (variant), 11465982071#6, 14149976102#19, gaps G-05, G-12.

### SWP-15 SP marketplace list, filters and read-only detail modal (PPCLOUD-14282; absorbs PSP-14)

> Data prerequisite: swaps of SWP-08/11 (Zugesagt), SWP-12 (Abgelehnt, mit Kommentar), one SUBMITTED swap left open for this scenario (S-F, U3 ↔ U4 on D5).
> Steps: 1. SP opens "Diensttausch" (`/shift-planner/shift-swap-marketplace`): landing filter "Offene Anfragen" (`#shift-marketplace-status-filter`); capture `past-and-current?opportunity-state=SUBMITTED` and `past-and-current/participants`; S-F row present. 2. Status "Alle" → rows of all states incl. the SWP-11/12 ids; "Zugesagt", "Abgelehnt", "Abgelaufen" each filter correctly. 3. "Mitarbeitende" (`#shift-marketplace-hp-filter`) → pick U3 → only U3's swaps (`hp-id`); pick a person without swaps → S-F not listed. 4. "Filter zurücksetzen" (`#shift-marketplace-clear-filters`) → status "Alle" (not the landing filter), request without `opportunity-state`. 5. Paging if more than 10 rows. 6. **Read-only modal (PSP-14):** open S-F → "Detailansicht" with both HPs and shifts; `#shift-swap-request-cancel-button` ("Ablehnen") and `#shift-swap-request-accept-button` ("Bestätigen") enabled; type a comment into "Kommentar (optional)" → "Bestätigen" disabled; clear it; close with `#shift-swap-request-close-button` (or Escape) without acting → no `PUT …/check-conflicts-and-write` in `api-index.jsonl`; a fresh list read shows S-F still SUBMITTED. 7. Cleanup: SP rejects S-F.
> Expect: as listed; ordering as implemented by PPCLOUD-14282 (record the order key observed: newest first expected — confirm).
> Oracle: request parameters + responses, rows by opportunity id; absence of a write call before step 7.
> Evidence: screenshots per filter, 06-modal.png, 06-comment-disables.png, JSON. Source: 14149124150#4, gap G-09; PSP-14 (11462934676#9–#10, 11484037225#22–#25, POMA-SWAP-01/02).

### SWP-16 Owner cancels an open swap ("Tausch löschen")

> Data prerequisite: F16: HP1 111, HP2 112, HP3 112; shortcut swap HP1 → HP2, HP3.
> Steps: 1. HP2 YES (detail-view "Bestätigen"); HP3 no answer. 2. HP1: detail-manage → `#secondaryButton` "Tausch löschen"; capture `DELETE opportunities/{id}`. 3. HP2: notification of the cancellation; detail shows "Der Tausch wurde abgesagt." 4. HP3: no cancellation notification. 5. HP1 not notified (own action). 6. Locks of HP1/HP2 released; HP1 list "Abgesagt" (last 10).
> Expect: as listed.
> Oracle: DELETE status, `cancelled-shift-trades` contains the id, notification records (HP2 yes, HP3 none, HP1 none), locks false.
> Evidence: JSON, screenshots. Source: 14149976102#13, 14199619612#5/#10/#15/#20/#25/#30/#35, gap G-03.

## C. Flexible swap (presence ↔ absence with compensation)

### SWP-17 Flexible creation with compensation

> Data prerequisite: FA2: HP1 presence 111, HP2 swappable absence (e.g. "Frei", `DIENSTTAUSCH='T'`), HP3 swappable absence; compensation day FC2: HP2 presence 112, HP3 nothing (to get the "Einige passende Personen" state), HP1 absence (or free); a third day FC2b where HP1 is locked (prepare by a shortcut swap of HP1 on FC2b).
> Steps: 1. HP1: FA2 detail → "Diensttausch" → "Wunsch": pick the absence definition → stepper shows 5 steps. 2. "Vorschläge": select HP2 and HP3 → "Weiter". 3. "Angebot": calendar; FC2b greyed + banner "Dieses Datum ist derzeit nicht verfügbar."; select FC2 → banner "Einige passende Personen" (first a preliminary "Vermutlich …" may show); capture `tradable-shifts-for-compensation-from-conflict-checker` and `tradable-shifts-for-compensation`. 4. "Auswahl": only HP2 offerable for FC2 ("Sie übernehmen dafür den Dienst"); select HP2. 5. "Übersicht": rows "Tausch" (FA2) and "Angebot" (FC2) → "Bestätigen"; capture `POST shift-trades` (`compensation_shift` present; main candidates reduced to HP2). 6. HP1 marketplace: swap with compensation row. 7. Locks: HP1 locked on FA2 and FC2. 8. HP2 notified; HP3 **not** invited (intersection rule).
> Expect: as listed.
> Oracle: create request body (main candidates = [HP2]), response id, open-shift-trades detail with `compensation_shift_trade_shift`, locks, notification records for HP2/HP3.
> Evidence: screenshots per step, JSON. Source: 14149124142#1–#7, 14149976102#1/#15, gap G-17.

### SWP-18 Flexible swap approved — main and compensation written

> Data prerequisite: the swap of SWP-17. DB before: HP1 FA2 111 / FC2 absence-or-free; HP2 FA2 absence / FC2 112.
> Steps: 1. HP2: detail-view shows "Tausch" ("Sie übernehmen den Einsatz") and "Angebot" ("Sie erhalten den folgenden Einsatz von …") → "Bestätigen". 2. HP1: tick HP2 → "Bestätigen". 3. SP: "Bestätigen" (write mode); if PEP-embedded is not available, no "In PEP ansehen" button (expected). 4. DB after: FA2 HP1 = HP2's absence, HP2 = 111; FC2 HP1 = 112, HP2 = HP1's former FC2 entry (absence or empty). 5. Notifications HP1/HP2.
> Expect: both swaps applied; if the compensation write fails → `SHIFT_TRADE_COMPENSATION_TO_PEP_FAILED` (record as FAIL with the partial state).
> Oracle: PLANUNG before/after on two days × two employees, responses.
> Evidence: oracle files, JSON. Source: 14149287976#2, 14149124142#7.

### SWP-19 Planned absence → presence (flexible from the absence side)

> Data prerequisite: FA3: HP1 swappable absence; HP2 presence 112 on FA3; compensation day FC3 with HP2 absence-capable state (HP2 free/absence) and HP1 presence.
> Steps: 1. HP1: FA3 (absence) detail → "Diensttausch" → "Wunsch" list shows **only presences** (no absence definitions). 2. Pick 112 → 5 steps; complete with HP2 and compensation FC3; capture create. 3. Cleanup "Tausch löschen".
> Expect: as listed.
> Oracle: definition list (all `shift_kind: PRESENCE`), stepper step count, create response.
> Evidence: screenshots, JSON. Source: 14149976102#8.

## D. PEP-driven cancellation (WIP page 14199619612)

Common data prerequisite for D: inbound planned-shift events reach poma-core on the DeployMate box (gate G-SWP-EVT, `seed/S8-verify-gates.md`: change one planning and see the owner's swap cancel within 5 min; family D BLOCKED if not). PEP changes are made with `pp-plan.sh` (api-pp `direct-shift-planning`: another definition = "changed", `DELETE` = "deleted") or, as fallback, in PEP under the db lock `locks/<env>~pep` with `scripts/pep/pe-paint.sh`, on the scenario's own (employee, day) only. Gate G-SWP-EVT records which write path produces the inbound event; use that one.

### SWP-21 Owner's shift changed / deleted in PEP

> Data prerequisite: F17 + F18: HP1 111, HP2 112. Variant a (changed, HP2 silent), b (changed, HP2 YES), c (deleted, HP2 YES, owner submitted).
> Steps: a: shortcut swap on F17 → PEP repaint HP1 F17 to 113 → wait ≤5 min. b: new swap on F17 after a → HP2 YES → PEP repaint HP1 to 111 → wait. c: swap on F18 → HP2 YES → HP1 submits → PEP delete HP1's F18 planning → wait. After each: owner and HP2 states, notifications.
> Expect: each swap CANCELLED (reason PLANNING_CHANGED); HP1 notified in a, b, c; HP2 notified in b and c, not in a; SP list no longer shows c as open.
> Oracle: owner `open-shift-trades` / `cancelled-shift-trades`, SP `past-and-current`, notification records, locks released.
> Evidence: oracle files, JSON. Source: 14199619612#1/#3/#4/#11/#13/#14/#21/#23/#24/#31/#33/#34.

### SWP-22 Accepted candidate's shift deleted (single candidate)

> Data prerequisite: F19: HP1 111, HP2 112.
> Steps: shortcut swap → HP2 YES → PEP delete HP2's F19 planning → wait.
> Expect: HP2 request INVALID, swap CANCELLED (ALL_PARTICIPANTS_REMOVED); HP1 notified. HP2: code sends the cancellation notice too — record; WIP log saw none → KNOWN-FAIL/decision SW-K7 whichever way, note the observed value.
> Oracle: owner detail statuses, notification records of HP1 and HP2.
> Evidence: JSON. Source: 14199619612#8/#18.

### SWP-23 Un-answered candidate's shift changed — swap stays open (SW-K3)

> Data prerequisite: F20: HP1 111, HP2 112 (HP2 later repainted to 113).
> Steps: 1. Shortcut swap HP1 → HP2. 2. PEP repaint HP2 F20 to 113; wait 5 min. 3. Owner state + notifications. 4. HP2 opens the invitation → detail shows which shift? → "Bestätigen". 5. HP1 submits HP2. 6. SP approves (write mode). 7. DB after.
> Expect: per code: 3 → still OPEN, no notification (SW-K3); 4..7 → record exactly what is written (HP1 receives 113 or the stored 112? error?). Any write that does not match the current roster = finding (gap G-27).
> Oracle: owner detail, notification records, `check-conflicts-and-write` response, PLANUNG before/after.
> Evidence: JSON, oracle files. Source: 14199619612#6/#16/#26, gap G-27.

### SWP-24 Selected candidate's shift changed after submission; SP acts on a stale row

> Data prerequisite: F21: HP1 111, HP2 112.
> Steps: 1. Shortcut swap → HP2 YES → HP1 submits. 2. SP opens "Diensttausch" (row visible) and keeps the page open. 3. PEP repaint HP2 F21 → wait. 4. SP clicks the stale row → "Bestätigen". 5. SP reloads.
> Expect: 3 → CANCELLED, HP1 + HP2 notified; 4 → error dialog (state conflict, e.g. `SHIFT_TRADE_STATE_CONFLICT_*` or `SHIFT_TRADE_NOT_ACCEPTED`), PEP unchanged; 5 → row gone from "Offene Anfragen".
> Oracle: notifications, `check-conflicts-and-write` error body name, PLANUNG unchanged, SP list.
> Evidence: error screenshot (issueShot), JSON. Source: 14199619612#9/#19/#29, gap G-25.

### SWP-25 Flexible swap: compensation-day change

> Data prerequisite: as SWP-17 on FA4/FC4.
> Steps: flexible shortcut swap → HP2 YES → PEP repaint HP2's FC4 planning (compensation day) → wait.
> Expect: HP2 INVALID → swap CANCELLED (single candidate); notifications as SWP-22.
> Oracle: as SWP-22.
> Evidence: JSON. Source: 14199619612#26/#28/#29.

## E. Half-shift swap (matrix 14787182601 v6; re-read the page before a run)

Bundle note: behaviour depends on the pp-services build (PR 12177 2026-09-25, APIPP-1876 2026-10-13). Record the pinned version; the matrix's v26 column is the main-26 line, v25 needs a main-25 box (compare overlay only).

### SWP-26 Half-shift candidate matrix (direct + flexible offer), API

> Data prerequisite: half days H1..H6 painted per data-plan §2 (HP1 = requester "Monica" role, HP2 = candidate "Fred" role; definitions with `DIENST_TEILEN='T'`; A/B/C/D = 111/112/113/a fourth swappable presence). One day per configuration.
> Steps: for each matrix case: HP1 harness `api.call('POST', '/api/mobile/health-professional/v1/calendar/shift-trade-candidates', {shift_planning_id, roster_cell_id, target_node_ids: [], target_employment_ids: []})` for the offered half/full planning (ids from `calendar/planned-shift-detail` of that day, `shift_position`); for flexible rows add `target_employment_ids` = HP2's employment. Record whether HP2 is in the result and with which `shift`/`shift_position`. One UI pass for #1 and #3 (screenshots of "Vorschläge").
> Expect: per matrix row "Current behaviour v26" = PASS reference; rows whose expectation differs (#3, #8, #11, #12, #17, #22, #25, #26) → KNOWN-FAIL SW-K1; 4-halves cells "NO candidates" → KNOWN-FAIL SW-K6 until the author confirms intent; any other difference = new finding.
> Oracle: candidates response per case (`partner.id`, `shift.shift_position`, `shift.shift_definition_id`), matrix table.
> Evidence: candidates-<case>.json, matrix-result.md (case → observed → verdict). Source: 14787182601#1–#38, 14780334107#1–#15.

Matrix 14787182601 v6 (copied 2026-10-22 from the area test-case inventory; re-read the page before a run if you can). Expectation rule of v6: full and half never mix; LEFT only with LEFT, RIGHT only with RIGHT.

| Id  | Flow     | HP1 offers          | Candidate has | Expectation (page)                | Current v26 (page)                                     |
| --- | -------- | ------------------- | ------------- | --------------------------------- | ------------------------------------------------------ |
| #1  | direct   | LEFT                | LEFT          | offered, only LEFT halves swap    | OK                                                     |
| #2  | direct   | LEFT                | RIGHT         | not offered                       | OK                                                     |
| #3  | direct   | LEFT                | FULL          | not offered                       | MISMATCH: offered, candidate's full splits             |
| #4  | direct   | LEFT                | LEFT+RIGHT    | offered, only LEFT halves swap    | OK                                                     |
| #5  | direct   | LEFT (HP1 has L+R)  | LEFT+RIGHT    | offered, only LEFT halves swap    | PARTIALLY: in some cases no candidate (4-halves table) |
| #6  | direct   | RIGHT               | LEFT          | not offered                       | OK                                                     |
| #7  | direct   | RIGHT               | RIGHT         | offered, only RIGHT halves swap   | OK                                                     |
| #8  | direct   | RIGHT               | FULL          | not offered                       | MISMATCH: offered, candidate's full splits             |
| #9  | direct   | RIGHT               | LEFT+RIGHT    | offered, only RIGHT halves        | OK                                                     |
| #10 | direct   | RIGHT (HP1 has L+R) | LEFT+RIGHT    | offered, only RIGHT halves        | PARTIALLY                                              |
| #11 | direct   | FULL                | LEFT          | not offered                       | MISMATCH: offered, HP1's full splits                   |
| #12 | direct   | FULL                | RIGHT         | not offered                       | MISMATCH: offered, HP1's full splits                   |
| #13 | direct   | FULL                | FULL          | offered, full shifts swap         | OK                                                     |
| #14 | direct   | FULL                | LEFT+RIGHT    | not offered                       | OK                                                     |
| #15 | flexible | LEFT                | LEFT          | offered, only LEFT                | PARTIALLY: compensation FULL \| HALF                   |
| #16 | flexible | LEFT                | RIGHT         | not offered                       | OK                                                     |
| #17 | flexible | LEFT                | FULL          | not offered                       | MISMATCH: offered, candidate's full splits             |
| #18 | flexible | LEFT                | LEFT+RIGHT    | offered, only LEFT                | PARTIALLY: compensation FULL \| HALF                   |
| #19 | flexible | LEFT (HP1 L+R)      | LEFT+RIGHT    | offered, only LEFT                | PARTIALLY: compensation FULL \| HALF                   |
| #20 | flexible | RIGHT               | LEFT          | not offered                       | OK                                                     |
| #21 | flexible | RIGHT               | RIGHT         | offered, only RIGHT               | PARTIALLY: compensation FULL \| HALF                   |
| #22 | flexible | RIGHT               | FULL          | not offered                       | MISMATCH: offered, candidate's full splits             |
| #23 | flexible | RIGHT               | LEFT+RIGHT    | "only the LEFT halves swap" (sic) | PARTIALLY: compensation FULL \| HALF                   |
| #24 | flexible | RIGHT (HP1 L+R)     | LEFT+RIGHT    | "only the LEFT halves swap" (sic) | PARTIALLY: compensation FULL \| HALF                   |
| #25 | flexible | FULL                | LEFT          | not offered                       | MISMATCH: offered, HP1's full splits                   |
| #26 | flexible | FULL                | RIGHT         | not offered                       | MISMATCH: offered, HP1's full splits                   |
| #27 | flexible | FULL                | FULL          | offered, full shifts swap         | PARTIALLY: compensation FULL \| HALF                   |
| #28 | flexible | FULL                | LEFT+RIGHT    | not offered                       | OK                                                     |

4-halves table (letters = shift definitions, `X | Y` = LEFT | RIGHT; odd id = trade LEFT, even id = trade RIGHT): #29/#30 A\|B vs C\|A → OK / NO candidates; #31/#32 A\|B vs B\|A → NO / NO; #33/#34 A\|B vs B\|C → NO / OK; #35/#36 A\|B vs C\|B → OK / NO; #37/#38 A\|B vs C\|D → OK / OK. Page summary: "Hidden when the candidate's shift on the slot you're trading matches one of HP1's. It ignores their other slot."

### SWP-27 Half-shift approval effects in PEP

> Data prerequisite: three half days H7 (LEFT↔LEFT), H8 (LEFT→candidate FULL), H9 (LEFT→candidate LEFT+RIGHT).
> Steps: per day: shortcut swap of HP1's LEFT with HP2 → HP2 YES → HP1 submit → SP approve (write mode) → DB.
> Expect: H7: only the LEFT plannings exchanged, RIGHT/empty halves untouched; H8: HP2's FULL split into LEFT (to HP1) + RIGHT (kept) — current behaviour (KNOWN-FAIL SW-K1 against the new expectation, which would not offer it); H9: only HP2's LEFT used, HP2's RIGHT untouched.
> Oracle: PLANUNG rows (`PA_CODE`, `DIENSTPOSITION`, `DIENSTTEIL`, count) before/after for both employees.
> Evidence: oracle-planung-H7..H9-before/after.txt. Source: 14787182601#1/#3/#4, 14780334107#2/#4/#5/#17.

### SWP-28 Half-shift flexible compensation granularity (SW-K2)

> Data prerequisite: H10: HP1 LEFT presence, HP2 swappable absence; compensation day H11 with HP2 a FULL presence and a LEFT half presence of another definition (one of them suffices per run).
> Steps: HP1: H10 LEFT detail → "Diensttausch" → absence → candidates HP2 → "Angebot" H11 → record which HP2 shifts are offered (FULL and/or half) in `tradable-shifts-for-compensation*` and on screen.
> Expect (findings page, TBD): only half presences offered when a half is on either side; today a FULL is offered → KNOWN-FAIL SW-K2. Also check the matrix's corrected RIGHT rows (#23, #24) once.
> Oracle: tradable-shifts responses (`shift_position`), offered cards.
> Evidence: JSON, screenshots. Source: 14787182601#15/#18/#19/#21/#23/#24/#27, 14780334107#16, gap G-18.

### SWP-29 Half swap declined or conflict-cancelled leaves the halves intact

> Data prerequisite: H12 (HP1 LEFT, HP2 FULL) and H13 (HP1 LEFT, HP2 LEFT) plus a conflict for H13 as in SWP-13.
> Steps: H12: swap → YES → submit → SP "Ablehnen" → DB. H13: swap → YES → submit → conflict added → SP "Bestätigen" → dialog cancel → DB.
> Expect: both days: PLANUNG identical to before (no split FULL, no extra halves, same `PLANUNG_ID`s).
> Oracle: PLANUNG before/after.
> Evidence: oracle files. Source: 14780334107#17, gap G-19.

## F. Channels, mobile, legacy

### SWP-30 Notification center records and tap navigation

> Data prerequisite: runs alongside SWP-08/09/11/12/16 (reads their notifications) — no own swap.
> Steps: for HP1, HP2, HP3: open the bell → notification center; filter type "Diensttausch"; for each swap notification of the run: record type, text, timestamp, read state; tap one invitation (HP2) → lands on `/flows/shift-swap/detail-view/{id}`; tap one response (HP1) → `/flows/shift-swap/detail-manage/{id}`; tap an approval → week view; "mark all read" → unread counter 0.
> Expect: one record per event of the lifecycle (invitation, response, non-selection, approval, rejection, cancellation) to the recipients listed in SWP-08..16; navigation targets as listed.
> Oracle: notification-center responses, URL after tap, unread counter response.
> Evidence: JSON, screenshots. Source: 14150369282#12/#20, 14149124142#8, 14149124150#5, 14149287976#3, 11465982071#5/#7.

### SWP-31 Partner events of the swap lifecycle (PolyPortal)

> Data prerequisite: the steward's **run partner** `{{PARTNER_NAME}}` (id `{{PARTNER_ID}}`, stage object S-CT-REG) with tenant access to DM-X and event logging ON. **Read only: never save, edit or toggle the partner** (any save switches logging off and deletes every logged event). Runner's portal-ops session (ADMIN for the Debug tab).
> Steps: after SWP-06/08/11/12/16 ran: `portal-ops.mjs … partner logs {{PARTNER_ID}}` (= `GET /admin/integration-partners/{id}/logs`, paged) for the run window; one screenshot of the Debug tab.
> Expect: one partner event per lifecycle notification (invitation, response, submission, approval, rejection, cancellation; `ShiftTradeCancellation` on decline-cancel) with the opportunity id. `v1/ShiftTradeNonselection` is never logged (no matching access right, SD-30): record its absence, not a FAIL.
> Oracle: event log entries by opportunity id and subclass.
> Evidence: partner-log.json, partner-match.json (expected vs found), portal screenshot. Source: 11465982071#7, 14150369282#12, 14149124150#5, 14149287976#3.

### SWP-33 Legacy trade pages reachable from MS Teams links

> Data prerequisite: one OPEN swap (HP1 → HP2) and one swap where HP2 answered.
> Steps: HP2: `api.goto('/flows/calendar/opportunity-shift-trade-details/<id>')`; HP1: `api.goto('/flows/shift-marketplace/trade/<id>')` (the two targets `MsTeamsNotificationDeliveryService` builds); screenshot; try the page's primary action only on a throw-away swap.
> Expect: pages render the swap (or redirect to the new routes); no error; record the behaviour (SW-K5 decision input).
> Oracle: final URL, rendered content, API responses of the page.
> Evidence: screenshots, JSON. Source: gap G-08, inventory D2.

### SWP-35 Mobile in-app path incl. capabilities on login (PPCLOUD-14262)

> Data prerequisite: HP1 (fresh in-app profile), F22 swappable presence, HP2 candidate.
> Steps: 1. `mypp-inapp.mjs` (the only in-app login path; `--mobile` on `app.mjs` sets UA / viewport only) fresh login (on-board e-mail form, login, consent, tutorial). 2. Capture the capabilities request issued after the login transition. 3. Calendar → F22 → "Diensttausch" (real pointer clicks) → step "Wunsch" leaves the loading state, roster definitions listed (capability path). 4. Choose an absence definition → 5 steps (flexible available). 5. Back; choose 112 → candidates → HP2 → create. 6. Cleanup "Tausch löschen".
> Expect: capabilities loaded once after login; step 1 not stuck; flows as on web.
> Oracle: capabilities.json timing (after the token response), `shift-definition/roster` called, create response.
> Evidence: screenshots, JSON. Source: PPCLOUD-14262, gap G-21.

### SWP-36 Expiry of an unanswered swap (optional, long-running)

> Data prerequisite: HP5 planning TODAY starting ≥ 2 h after the run start and before the next job tick (`0 20 */6 * * *`: 00:20, 06:20, 12:20, 18:20 server time), HP6 candidate.
> Steps: HP5 creates the swap by shortcut (the UI hides today; the API accepts a future start); leave it unanswered; after the shift start and the next job tick read the owner list and the SP list (filter "Abgelaufen"); HP6's detail.
> Expect: state EXPIRED, SP list "Abgelaufen", candidate detail "Abgelaufene Tauschanfrage"; partner `OpportunityExpired` event if SWP-31 setup exists.
> Oracle: responses by opportunity id.
> Evidence: JSON. Source: gap G-07.

## Mapping of the Confluence test cases (summary)

| Page        | Case ids → scenarios                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 11465982071 | #1 SWP-06 · #2 SWP-08 · #3 SWP-08 · #4 SWP-11/13 · #5 SWP-11/30 · #6 SWP-11/14 · #7 SWP-30/31/32/34 · #8 SWP-02                                        |
| 14144700420 | #1 SWP-01                                                                                                                                              |
| 14150369282 | #1 SWP-02 · #2/#3/#14/#15 SWP-03 · #4 SWP-02 · #5/#18 SWP-05 · #6–#11 SWP-06 · #9 SWP-06/07 · #12/#20 SWP-30/31/32/34 · #13/#16/#17/#19 SWP-04         |
| 14149124142 | #1/#2/#5/#6/#7 SWP-17 · #3 SWP-06 · #4 SWP-05/17 · #8 SWP-30                                                                                           |
| 14149124150 | #1–#5 SWP-08 · #6 SWP-09 · #7 SWP-10                                                                                                                   |
| 14149287976 | #1–#3 SWP-11 · #4/#5 SWP-12 · #6 SWP-13                                                                                                                |
| 14149550106 | #1 SWP-20 · #2 SWP-05                                                                                                                                  |
| 14199619612 | declines SWP-09 · owner cancels SWP-16 · owner's shift SWP-21 · accepted candidate SWP-22/25 · silent candidate SWP-23 · submitted candidate SWP-24/25 |
| 14787182601 | direct + 4-halves SWP-26 · approval effects SWP-27 · flexible compensation SWP-28                                                                      |
| 14780334107 | #1–#15 SWP-26/27 · #16 SWP-28 · #17 SWP-29                                                                                                             |
| 14149976102 | rules → SWP-01..06, 08, 10..20 (see the analysis table)                                                                                                |
