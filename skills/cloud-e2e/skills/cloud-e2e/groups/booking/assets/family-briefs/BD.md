# Family BD — BADI and the PEP-side availability cancel (BKG-16, 17, 18, 19, 20, 26) · HPE, HPF, SP (optional HPM)

|                           |                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | BKG-16, BKG-17, BKG-18, BKG-19, BKG-20, BKG-26                                                                                                             |
| Actors                    | HPE `{{HPE_LOGIN}}` ({{HPE_ID}}), HPF `{{HPF_LOGIN}}` ({{HPF_ID}}), SP `{{SP_LOGIN}}`; optional HPM `{{HPM_LOGIN}}` ({{HPM_ID}})                           |
| Days                      | HPE: `{{HPE_FREE1}}`, `{{HPE_NIGHT}}` (night painted), `{{HPE_CONF}}` · HPF: `{{HPF_FREE1}}`, `{{TODAY}}`, `{{HPF_FREE2}}`, `{{HPF_FREE3}}`                |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/BD` · `{{RUN_DIR}}/BD/<id>/` · `created/BD.jsonl`                                                                     |
| Read first                | the group brief; scenarios.md family BD and BKG-26                                                                                                         |
| PEP                       | BKG-26 paint: `pp-plan.sh`; PEP UI only as fallback under `{{PEP_LOCK_DOC}}`                                                                               |
| Windows / jobs            | BKG-26 fallback job only inside **J-X-JOBS** (`windows/{{ENV}}~J-X-JOBS` `active`; poll 60 s, max 30 min, else that step BLOCKED); paused by W-X-WRITE-OFF |

BADI URL: `/badi?group-node-id={{GROUP_NODE}}&range-start=<Monday of the week>&cell-width=60&number-of-cells-displayed=14&employee-column-width=220`. Captures: `GET /api/private/tenant/consumable-pools`, `GET /api/private/availability-roster/<poolId>?from&to`, bookings `POST /api/private/availability-roster/assignment` (+ `…/assignment/{id}` apply after CONFLICT), cancel `PUT /api/private/assignments/{id}/cancel`.

## BKG-16 — BADI view: load, header, refresh, filters, categories

0. HPE: one-off Frühdienst on `{{HPE_FREE1}}`; HPF: one-off Nachtdienst on `{{HPF_FREE1}}` (pool A); at least one more pool-A HP with an availability in the 14 days (any E2E-BKG HP of yours; else note "2 HPs only"). 1. SP: open the BADI URL for the week of `{{HPE_FREE1}}`; capture both GETs. 2. Header "Verfügbarkeiten", "aktualisiert HH:MM"; after ≥ 1 min the refresh button → time changes, roster re-fetched. 3. Diensttyp filter: Frühdienst, Tagesdienst, Spätdienst, Nachtdienst (+ "Alle"); "nur verfügbare Mitarbeitende" on by default; select Frühdienst → only Früh icons coloured, HPF's row still shown. 4. Toggle "nur verfügbare Mitarbeitende" off → HPs without availability appear. 5. Personalkategorie: only categories valid in the range; select HPE's → only matching rows. 6. Name search with HPE's last name.
   Expect: as listed; no external-pools toggle visible unless `externalAvailabilities` is on (it is ON on DM-X for group partner: record whether the toggle shows, no verdict impact).

## BKG-17 — BADI books two HPs

1. BADI as BKG-16 → click HPE's and HPF's availability cells → "Weiter". 2. First HP form: Station / Planblatt, Dienst (list = plannable Dienste of the Planblatt only), Tageszeit, Zielkategorie, Anstellung (if offered), "Text für Mitarbeitende" → "Buchen"; capture the assignment call(s). 3. Second HP → "Buchen". 4. Final "Auswahl verarbeitet" / "Vorgenommene Buchungen wurden geplant …". 5. `plan-day.sh` HPE `{{HPE_FREE1}}`, HPF `{{HPF_FREE1}}`. 6. NC of both HPs (`ncRows(api, {sinceIso, typeRe: /BOOKING/})`). 7. Optional HPM (only if P7 ran): its availability → the Anstellung select is empty by default and must be chosen; else note "HPM not available" (BLOCKED-data part).
   Expect: SUCCESS (or CONFLICT → "Möchten Sie den Dienst trotzdem buchen?" → apply → SUCCESS); PLANUNG rows with the chosen Dienst; NC `BOOKING` rows; booked cells update without reload (PPCLOUD-14155).

## BKG-18 — BADI conflict booking and the started-shift confirmation

Cells: HPE night `{{NIGHT_DEF}}` on `{{HPE_NIGHT}}` (= `{{HPE_CONF}}` − 1, painted by the seed). 0. HPE: one-off on `{{HPE_CONF}}`; HPF: one-off for `{{TODAY}}` with a Dienst that already started (e.g. Frühdienst after its start time). 1. BADI: book HPE on `{{HPE_CONF}}`. 2. CONFLICT → the UI lists the conflicts + "Möchten Sie den Dienst trotzdem buchen?" → confirm; capture the apply call. 3. BADI: book HPF `{{TODAY}}` with the started Dienst → dialog `BADI.BOOKING_FLOW.SHIFT_ALREADY_STARTED_DIALOG` → confirm; capture the retry with `ignore_started_shift=true`. 4. `plan-day.sh` both.
Expect: 1–2 CONFLICT then SUCCESS (UI not stuck, PPCLOUD-10835); 3 first 4xx `ASSIGNMENT_VALIDATION_SHIFT_ALREADY_STARTED`, retry SUCCESS; PLANUNG rows exist. No conflict in step 1 → record it and mark the conflict half BLOCKED-data (not FAIL).

## BKG-19 — BADI selection rules, delete dialogs and range reload (no booking)

Needs ≥ 11 availability cells in the view and HPE in pool A and pool B with an all-pools availability on one day (create it in step 0 on a free HPE day of the week). 1. Select HPE's cell in pool A, then the same day in pool B → second selection refused / blocked. 2. Select cells until 10 → further cells blocked, "Sie können maximal 10 Buchungen zugleich vornehmen". 3. "Weiter", then "Löschen" on a not-yet-booked item → the NOT_BOOKED wording (no "delete booking" text); remove all → BADI back to normal without a booking confirmation. 4. `range-start` + 7 d in the URL → roster re-fetched (`from` / `to`).
Expect: as listed; no `POST …/assignment` in steps 1–3. Fewer than 11 cells → step 2 "not testable" in notes (P6 not run), the rest decides.

## BKG-20 — BADI cancel of a booked item removes the PEP shift

0. HPF: one-off on `{{HPF_FREE2}}`. 1. BADI: book HPF on `{{HPF_FREE2}}` (SUCCESS); `plan-day.sh` before/after. 2. In the same booking list "Löschen" on that booked item → BOOKED dialog → accept; capture `PUT /api/private/assignments/{id}/cancel`. 3. `plan-day.sh`. 4. HPF: availability back; NC cancellation row.
   Expect: cancel 2xx; the PLANUNG row of that Dienst gone (PPCLOUD-11044 / 12473); availability restored; NC `BOOKING` cancellation.

## BKG-26 — PEP planning on an availability day cancels the availability

0. HPF: one-off on `{{HPF_FREE3}}`; `dayView` before. 1. Paint a presence Dienst for HPF on `{{HPF_FREE3}}`: `pp-plan.sh {{TENANT}} {{HPF_ID}} {{HPF_FREE3}} {{DAY_DEF}} FULL` (fallback PEP under the lock); `plan-day.sh`. 2. Wait ≤ 5 min; HPF day view + NC (`ncRows(api, {sinceIso, typeRe: /AVAILABILITY/})`). 3. Still there → inside J-X-JOBS: `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "job run poma-core AvailabilityConflictChecker --tenant {{TENANT}}" {{RUN_DIR}}/BD/BKG-26/job` and re-read. 4. Remove the painted planning (`pp-plan.sh … DELETE`).
   Expect: availability removed for that day; NC row `AVAILABILITY` (N-04, inbound event `AvailabilityAssignmentStatus`) or, after the job, removal with a DELETED event. Record which path fired. The partner `v1/AvailabilityDeleted` is checked in BKG-27 (SD-30).

## Cleanup checklist

- Bookings of BKG-17 / 18 stay (BKG-13 / 27 / 28 read them; list ids in `created/BD.jsonl`); BKG-20 cancelled; BKG-26 paint deleted; remaining HPE / HPF availabilities deleted.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
