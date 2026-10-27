# Family AV — Availabilities (BKG-01, 02, 04, 03, 09, 07, 05, 06, 33, 08) · HPA, HPB, HPC, HPN, PM; SP reads

|                           |                                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | Part 1: BKG-01, BKG-02, BKG-04, BKG-03, BKG-09, BKG-07 (part 1), BKG-05, BKG-06, BKG-33, BKG-08 · Part 2 (run date R+1): BKG-07 (part 2)                                                                                                      |
| Actors                    | HPA `{{HPA_LOGIN}}` ({{HPA_ID}}), HPB `{{HPB_LOGIN}}` ({{HPB_ID}}), HPC `{{HPC_LOGIN}}` ({{HPC_ID}}), HPN `{{HPN_LOGIN}}`, PM `{{PM_LOGIN}}`, SP `{{SP_LOGIN}}` (Find HP reads, BKG-03 / BKG-33 bookings of your own HPs only)                |
| Days                      | HPA: `{{HPA_FREE1}}`, `{{HPA_PRES}}`, `{{HPA_ABS}}`, `{{HPA_FREE2}}`, week of `{{W2}}`, `{{TODAY}}` … +21 d, `{{R1}}` · HPB: from `{{HPB_MON}}` (BKG-05/06), `{{HPB_MON2}}` (BKG-33) · HPC: `{{HPC_FREE1}}`, `{{HPC_FREE2}}`, `{{HPC_FREE3}}` |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/AV` · `{{RUN_DIR}}/AV/<id>/` · `created/AV.jsonl`                                                                                                                                                        |
| Read first                | the group brief; scenarios.md family AV and BKG-08; `{{RUN_DIR}}/day-tokens.md`                                                                                                                                                               |
| PEP                       | none                                                                                                                                                                                                                                          |
| Windows                   | none of its own; **paused by W-X-SERIES-OFF** (BKG-10: series flag off): finish the running scenario, report the rest BLOCKED "paused by window <id>"                                                                                         |
| PENDING convention        | Part 1 reports BKG-07 with verdict `PENDING` (part 1 evidence + series id in `notes`); part 2 reads that report first and gives the final verdict                                                                                             |

Series form ("Wiederholend"): "Von", "Bis" (or "Offen"), "Wochentage" (Mo … So / "Alle"), "Wiederholung" (Wöchentlich, alle 2 / 3 Wochen, Monatlich), Dienstgruppe (Frühdienst, Tagdienst, Spätdienst, Nachtdienst), pools ("Alle Pools ausgewählt" or single). Delete / edit from the day view: "Löschen" / "Bearbeiten" → "Einzelner Tag der Serienverfügbarkeit" / "Alle Tage der Serienverfügbarkeit" → Ok (PPCLOUD-14571; several availabilities on one day → card picker).

## BKG-01 — One-off availability: create, see it as HP, SP and on-prem

1. HPA: `/tabs/calendar` → floating "+" → "Verfügbarkeit erfassen". 2. "Einmalig" (if the radio is shown), date `{{HPA_FREE1}}`, Dienstgruppe "Tagdienst" only, pool `E2E-BKG-A` only → "Verfügbarkeit senden"; capture `POST …/v1/availabilities`. 3. "Danke. Ihre Verfügbarkeit wurde erfolgreich eingetragen" → day view `{{HPA_FREE1}}` (`dayView`). 4. Month view, toggle "Meine Verfügbarkeiten anzeigen" on; screenshot. 5. SP: `/shift-planner/health-professionals` → Datum `{{HPA_FREE1}}`, Planblatt `{{GROUP_NAME}}`, a day Dienst, Pools `E2E-BKG-A`; capture `consumable-pools/availabilities` → `find-hp.json`. 6. `api-pp.sh avail {{HPA_ID}} {{HPA_FREE1}} {{HPA_FREE1}}`.
   Expect: POST 2xx; day view one availability (`shifts == ["NORMAL"]`, pool A); month cell marked; Find HP lists HPA with "Buchen"; api-pp lists the date.

## BKG-02 — One-off on a presence day is rejected (de and fr)

1. HPA (de): one-off on `{{HPA_PRES}}`, Tagdienst, pool A → send. 2. Capture the POST response and the alert. 3. Profile → "Sprache auswählen" → Français; repeat; screenshot. 4. Back to Deutsch.
   Expect: 4xx `AVAILABILITY_VALIDATION_ERROR_CONFLICT`; alert "Konflikt Verfügbarkeiten/Dienste" (de) and the French text from `fr.json` (no raw key, OK closes); `dayView('{{HPA_PRES}}')` has no availability.

## BKG-04 — Week series across presence / absence / free days: conflict modal and force

Cells: week of `{{W2}}` — Tue presence, Thu absence (painted), other days free.

1. HPA → form → the "Häufigkeit" radio (Einmalig / Wiederholend) is visible → "Wiederholend". 2. Von = `{{W2}}` (Mon), Bis = Sunday of that week, Wochentage "Alle", "Wöchentlich", Tagdienst, pool A → send; capture `POST …/availabilities-series?force=false` (save the body: X10 reuses it). 3. Modal "Verfügbarkeitskonflikt" ("… gibt es 1 Konflikte …") lists Tuesday → Ok; capture `…?force=true`. 4. Day view for each of the 7 days; week + month screenshots. 5. `api-pp.sh avail {{HPA_ID}} <Mon> <Sun>`.
   Expect: exactly one conflict (Tue, presence); forced POST 2xx; availabilities Mon, Wed, Thu (absence), Fri, Sat, Sun — not Tue; api-pp the same 6 dates. Cleanup: delete the series ("Alle Tage").

## BKG-03 — Absence and free day accept an availability; a booked day does not

1. HPA: one-off on `{{HPA_ABS}}` (Spätdienst). 2. One-off on `{{HPA_FREE2}}` (Frühdienst). 3. `api-pp.sh avail` for both days. 4. Booked-day guard: a. HPC one-off on `{{HPC_FREE3}}` (Tagdienst, pool A). b. SP: Find HP `{{HPC_FREE3}}` (Planblatt `{{GROUP_NAME}}`, day Dienst, pool A) → "Buchen" on HPC → "Bestätigen"; capture the assignment call. c. HPC: second one-off on `{{HPC_FREE3}}`. d. Cleanup: SP `cancelAssignment(api, <id>)`; HPC deletes its availability; `plan-day.sh {{HPC_ID}} {{HPC_FREE3}}` shows no booked Dienst.
   Expect: 1–2 2xx and visible; api-pp both dates; 4c 4xx `AVAILABILITY_VALIDATION_ERROR_BOOKING` "Konflikt Verfügbarkeiten/Buchungen". Cleanup HPA: delete both one-offs.

## BKG-09 — Availability form validation and the no-pool HP

1. HPA: open the form, untick every Dienstgruppe → send → alert "Verfügbarkeitsfehler" (`ERROR.AVAILABILITY_NOT_VALID`). 2. Tick one, untick every pool and "Alle Pools" → alert `AVAILABILITY_SELECT_POOL_ERROR`. 3. "Wiederholend" without weekday ("Wöchentlich") → alert `AVAILABILITY_SELECT_WEEK_DAY_ERROR`. 4. `createAvailability(api, {date: <yesterday>, shifts: ['NORMAL'], poolIds: ['{{POOL_A}}']})` → 4xx. 5. HPN: calendar FAB → no "Verfügbarkeit erfassen"; `api.goto('/health-professional-app/flows/calendar/add-availability')` → "Sie sind noch keinem Pool zugewiesen" and no pools.
   Expect: alerts 1–3 with **no** POST in `api-index.jsonl`; 4 → 4xx; 5 as listed.

## BKG-07 — Started series is split on edit; past one-offs immutable (two parts)

Part 1 (run date R = `{{TODAY}}`): 1. HPA series "Wiederholend", Von `{{TODAY}}`, Bis `{{TODAY}}` + 21 d, Wochentage "Alle", Spätdienst (skip days carrying earlier HPA fixtures: none of them lie in that range except `{{HPA_ABS}}` and the HPA_FREE days if the runner placed them there — check `day-tokens.md`); note the series id. 2. One-off for `{{TODAY}}` (Nachtdienst); note its id. Report BKG-07 `PENDING` with both ids.
Part 2 (run date `{{R1}}`): 3. Edit the series from `{{R1}}`: Dienstgruppe → Frühdienst; capture `PUT …/availabilities-series?force=false&from={{R1}}`. 4. Read the series / day views for `{{TODAY}}` (now yesterday) and `{{R1}}`. 5. Try to edit and delete yesterday's one-off (`api.call('PUT'|'DELETE', '/api/mobile/health-professional/v1/availabilities/<id>', …)` when the UI hides it). 6. Cleanup: delete the remaining series from `{{R1}}` on.
Expect: step 3 truncates the old series to end `{{TODAY}}` and creates a new series from `{{R1}}` (two ids); yesterday keeps Spätdienst, no edit / delete offered; step 5 → 4xx (invalid / past date).

## BKG-05 — Series repetition matrix and the 3-month on-prem horizon (HPB)

One config at a time, each start ≥ `{{HPB_MON}}`: (a) Di, wöchentlich, 3 Wochen; (b) Mo + Mi + Fr, alle 2 Wochen, 2 Monate; (c) Fr, alle 3 Wochen, 15 Wochen; (d) Monatlich, Bis "Offen" (the weekday row must be hidden). Per config: 1. create (capture POST). 2. `availabilityDates(api, <start>, <start + 6 months>)`. 3. `api-pp.sh avail {{HPB_ID}} <today> <today + 6 months>`. 4. Delete via the day view → "Löschen" → "Alle Tage der Serienverfügbarkeit" (capture DELETE). 5. Re-read both.
Expect: dates follow the rule exactly ((a) 3 Tuesdays; (b) Mo/Mi/Fr every second week for 2 months; (c) 6 Fridays; (d) one per month — record the day-of-month rule observed); myPP shows iterations after month 3; api-pp only dates ≤ today + 3 months; empty after delete. Evidence `series-<a..d>-dates.json` (expected vs actual).

## BKG-06 — Edit a not-started series, delete one iteration, delete the series, one-off on the freed day (HPB)

1. Series Mo + Mi + Fr wöchentlich from `{{HPB_MON}}`, 2 Monate; note the id. 2. Day view of the first Friday → "Bearbeiten" → "Alle Tage …" → Mo + Fr, end + 3 Monate → send; capture `PUT …/availabilities-series?force=false&from=…`. 3. Dates (myPP + api-pp). 4. Second Friday → "Löschen" → "Einzelner Tag …" → Ok; capture `DELETE …/availabilities-series/{id}/iteration?day=`. 5. Delete the whole series. 6. One-off on that second Friday; then delete it.
   Expect: step 2 keeps the same id (not started: no split), Wednesdays gone, end extended; step 4 removes only that Friday (myPP + api-pp); 5 removes all; 6 visible in myPP and api-pp.

## BKG-33 — Overlapping series: booking and cancel restore exactly one availability (HPB, SP)

1. HPB: series S1 Mo–Fr Tagdienst 2 weeks from `{{HPB_MON2}}`; series S2 Mo–Fr Spätdienst the same 2 weeks (if refused: record `AVAILABILITY_VALIDATION_ERROR_ALREADY_EXISTS` and stop = PASS of the guard). 2. Delete Wednesday (first week) of S1 (iteration). 3. SP: Find HP (Spätdienst Dienst) for that Wednesday → book HPB. 4. HPB day view Wednesday: no availability left. 5. SP cancels the booking. 6. HPB day view Wednesday.
   Expect: after 5 exactly one availability (S2, Spätdienst) is back; S1's deleted iteration stays deleted. Cleanup: delete S1 and S2; `plan-day.sh` Wednesday has no booked Dienst.

## BKG-08 — All-pools vs single-pool availability after the HP joins a new pool (HPC, PM, SP)

1. HPC: one-off `{{HPC_FREE1}}` with "Alle Pools ausgewählt"; one-off `{{HPC_FREE2}}` with only `E2E-BKG-A`. 2. PM: `/pool-manager/manage-pools/hp` (or edit pool `E2E-BKG-B`) → add HPC to `E2E-BKG-B`; capture the save. 3. SP: Find HP on each day with Pools = B only, then A only. 4. HPC: NC row "added to pool" (N-20, record only). 5. Delete the all-pools availability; repeat step 3 for day 1; `api-pp.sh avail` day 1.
   Expect: day 1 (all pools) HPC listed for B and A; day 2 (single pool) for A only; after the delete not listed, api-pp empty for day 1. Cleanup: remove HPC from pool B; delete the day-2 availability.

## Cleanup checklist

- No availability of HPA / HPB / HPC left except what a later family needs (none); no booking of HPC / HPB left (SP cancelled); HPC not in pool B.
- Every created id with its final state in `created/AV.jsonl`.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
