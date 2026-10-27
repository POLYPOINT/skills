# Family FH — Find HP and manage shift bookings (BKG-11, 12, 14, 15, 13) · HPD, SP

|                           |                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | BKG-11, BKG-12, BKG-14, BKG-15, BKG-13 (BKG-13 needs the BADI bookings of family BD: the runner launches FH after BD)                             |
| Actors                    | HPD `{{HPD_LOGIN}}` ({{HPD_ID}}), SP `{{SP_LOGIN}}` ({{SP_ID}})                                                                                   |
| Days                      | HPD: `{{HPD_FREE1}}`, `{{HPD_ABS}}`, `{{HPD_FREE2}}`, `{{HPD_FREE3}}`, `{{HPD_FREE4}}`, `{{HPD_PRES}}`, `{{HPD_FAR}}`                             |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/FH` · `{{RUN_DIR}}/FH/<id>/` · `created/FH.jsonl`                                                            |
| Read first                | the group brief; scenarios.md family FH and the notification oracle table                                                                         |
| PEP                       | none (bookings write PEP through the cloud; `plan-day.sh` is the oracle)                                                                          |
| Windows                   | none of its own; **paused by W-X-WRITE-OFF** (cloud-write mode off): finish the running scenario, report the rest BLOCKED "paused by window <id>" |

Find HP form: `/shift-planner/health-professionals`, fields Datum, Planblatt (`{{GROUP_NAME}}`), Dienst (`#shift-definition-type-field`), Pools, toggle "blockierte Mitarbeitende", "Filter löschen" (`#search-clear-filters`). Booking dialog "Einsatz buchen": Dienst, Tageszeit (position), Pool, Zielkategorie, Kommentar → "Bestätigen" → resume page "Person in PEP eingetragen und benachrichtigt" (write mode: `POST /api/private/availability-roster/assignment`).

## BKG-11 — Find HP: entry, mandatory filters, pool filter, blocked toggle, horizon

0. HPD: one-off on `{{HPD_FREE1}}` (Tagdienst, pool A). 1. SP: `/shift-planner/dashboard` → `#find-hp-btn` "Mitarbeitende finden" → `/shift-planner/health-professionals` (record whether the dashboard shows the tile "Nächste gebuchte Dienste": observation SD-28). 2. Only Datum set: no results, hint "Bitte ergänzen Sie die Pflichtfelder Datum, Planblatt und Dienst". 3. Planblatt + Dienst → list with "Buchen" per row; capture `consumable-pools/availabilities` (save the query string: later scenarios replay it with `findHp(api, query)`). 4. Pools = `E2E-BKG-A` → HPD listed; = `E2E-BKG-B` → HPD not listed. 5. Toggle "blockierte Mitarbeitende" on → blocked HPs appear with a reason (e.g. "Mitarbeitende hat eine geplante Schicht …"; record the texts). 6. Datum picker: days after today + 3 months not selectable. 7. "Filter löschen" resets.
   Expect: as listed (request parameters per filter state = the table).

## BKG-12 — Book via Find HP in cloud-write mode: absence day, free day, day from a series

0. HPD: one-offs on `{{HPD_ABS}}` and `{{HPD_FREE2}}`; a weekly series (2 weeks, all weekdays) covering `{{HPD_FREE3}}`. `plan-day.sh` before for the three days. 1. SP: Find HP `{{HPD_ABS}}` → "Buchen" HPD → dialog → "Bestätigen"; capture `POST /api/private/availability-roster/assignment` and the resume page. 2. Same for `{{HPD_FREE2}}` and `{{HPD_FREE3}}`. 3. `plan-day.sh` after for each day. 4. Find HP `{{HPD_FREE3}}` again → HPD no longer offered. 5. HPD: NC rows (`ncRows(api, {sinceIso, typeRe: /BOOKING/})`); open one booking row → `…/calendar/booking-details/<assignment id>`. 6. SP: `assignments(api)` shows 3 CONFIRMED rows of HPD.
   Expect: each booking 2xx state SUCCESS (or CONFLICT handled with "Trotzdem Buchen?" — note which); a PLANUNG row with the chosen Dienst on each day (absence day: record whether the absence stays or is replaced — observation); 3 NC rows `BOOKING` / `ASSIGNMENT_DETAIL` / assignment ids; series day consumed. Partner events are checked in BKG-27 (log the assignment ids in `created/FH.jsonl`). **Leave the `{{HPD_ABS}}` and `{{HPD_FREE2}}` bookings for BKG-13 / BKG-14.**

## BKG-14 — Cancel a booking: availability restored, PEP shift removed, re-book possible

0. HPD: one-off on `{{HPD_FREE4}}`; SP books it (as BKG-12). `plan-day.sh` before. 1. "Geplante Dienste verwalten" → HPD / `{{HPD_FREE4}}` row → cancel → confirm; capture `PUT /api/private/assignments/{id}/cancel`. 2. `plan-day.sh`. 3. HPD: day view `{{HPD_FREE4}}`; NC. 4. Find HP `{{HPD_FREE4}}` → HPD offered again → "Buchen". 5. `plan-day.sh` again.
   Expect: status CANCELLED; the booked Dienst's PLANUNG row gone; availability back without user action; NC `BOOKING` cancellation row (N-03); second booking SUCCESS with a new PLANUNG row. Leave the second booking (BKG-13 counts it).

## BKG-15 — Booking API validations: presence day, beyond 3 months, past

0. HPD: one-off at `{{HPD_FAR}}` (one-off creation allows it). 1. SP, captured bearer: `POST /api/private/assignments` with the classic body of the planner app (`NewAssignment`, `assignment-api.service.ts`): `{shifts: [{date: "<day>", type: "<EARLY|NORMAL|LATE|NIGHT>"}], user_id: "<HPD's POMA user id from find-hp.json>", pool_id: "{{POOL_A}}", notes: "BKG-15"}` for `{{HPD_PRES}}`. 2. Same for `{{HPD_FAR}}`. 3. Same for yesterday. 4. UI: the Find HP date picker refuses `{{HPD_FAR}}`.
   Expect: 1 → `ASSIGNMENT_VALIDATION_PLANNED_PRESENCE`; 2 → `ASSIGNMENT_VALIDATION_DATE_TOO_FAR`; 3 → `ASSIGNMENT_VALIDATION_DATE_VIOLATION`. A 400 for a malformed body is not the validation: fix the body once from the captured shape, else BLOCKED "classic booking body unknown". Cleanup: delete the far one-off.

## BKG-13 — Manage shift bookings list: menu, filters, sort, cancelled toggle, paging (read-only)

Needs ≥ 11 bookings in the tenant (BKG-12, 14, BD's BKG-17/20, P6 extras). 1. SP: side menu "Geplante Dienste verwalten" → `/shift-planner/manage-shift-bookings/internal-pool`. 2. `#manage-bookings-date-filter` = `{{HPD_ABS}}` → only that day; add `#manage-bookings-pool-filter`, `#manage-bookings-shift-type-filter`; "Filter löschen" (`#shift-booking-clear-filter`). 3. `#manage-bookings-sort-by`: "Shift creation", "Date ascending", "Date descending"; default = booking time descending. 4. "Show cancelled bookings" → BKG-14's cancelled row appears. 5. Page size 10 → page 2; change page size.
Expect: each action sends `GET /api/private/assignments` with matching params and the table equals the response. Fewer than 11 rows → paging "not testable" in notes (not a FAIL).

## Cleanup checklist

- Cancel the bookings you leave at the very end only if the runner says the env is reused; otherwise list them (assignment ids, days) in `created_data` — they are on PEP and visible to BKG-27 / BKG-28.
- Delete HPD's remaining availabilities not consumed by a booking.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
