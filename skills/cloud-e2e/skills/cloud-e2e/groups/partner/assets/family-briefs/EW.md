# Family EW — External workforce (PTN-12, 17, 13, 14, 15) · SPX, external HPs A / B / C, days XD1..XD10

|                           |                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | PTN-12, PTN-17, PTN-13, PTN-14, PTN-15                                                                                                                                                                                        |
| Actors                    | SPX `{{SPX_LOGIN}}` ({{SPX_ID}}) in the planner app, BADI and the partner simulator; external HPs `E2E PTN {{RUN_TAG}} A` (main), `… B` (GLN test), `… C` (guards) with e-mails `e2e-ptn-{{RUN_TAG}}-a@zinc.ch`, `-b@`, `-c@` |
| Days                      | `{{XD1}}` … `{{XD8}}` (consecutive weekdays after the seeded roster), `{{XD7N}}` (= day after `{{XD7}}`), `{{LEAD_DAY}}` (inside the 48 h lead time)                                                                          |
| Stage values              | tenant GLN `{{GLN}}` (steward, today), foreign GLN `{{FOREIGN_GLN}}`, provider code `{{PROVIDER_CODE}}`, BADI node `{{SPX_NODE}}`                                                                                             |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/EW` · `{{RUN_DIR}}/EW/<scenario>/` · `created/EW.jsonl`                                                                                                                                  |
| Paused by                 | `S-CT-GWMOCK` (X20 changes the gateway-mock strategies): the runner launches you only outside it                                                                                                                              |
| Read first                | the group part above; scenarios.md PTN-12..17; known-deviations.md                                                                                                                                                            |

One lane, strictly in this order. SPX acts through `node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} {{SPX_LOGIN}} <script> <outdir> --app poma` (the simulator is `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/partner-simulator`). Every availability row gets Policies → GLN = `{{GLN}}` unless the step says otherwise (defaults: booking lead PT48H, cancellation lead PT1H); "Replace existing availabilities…" stays **unchecked**. Record every transaction id (`created/EW.jsonl`). Gateway-mock inbox: `node {{SKILL_DIR}}/scripts/harness/gwmock.mjs {{RUN_DIR}}/EW/<scenario> received --tx <id,id,…>`. External plannings: `sql.sh {{TENANT}} -f {{GROUP_DIR}}/scripts/ext-planning.sql -D node={{SPX_NODE}} -D day_from={{XD1}} -D day_to={{XD10}}`.

## PTN-12 — Partner simulator: register external HPs, create availabilities in pools

1. Simulator loads: capture the status (only) of `GET /api/internal/partner-simulator/token` and `GET /api/external-workforce/v1/health-professionals` (200; a 401 "please set providerCode mapper in client" → BLOCKED "provider gate", stop the family).
2. "External health professionals" → "Add health professional": first / last name `E2E PTN {{RUN_TAG}}` / `A`, e-mail `e2e-ptn-{{RUN_TAG}}-a@zinc.ch`, a mobile number of the form `+41000000001` (not a real number), gender, one skill leaf → save → "Register" → badge "Registered"; capture `POST …/health-professionals` → `hp-register.json`; shot `02-registered.png`. Repeat for B (`-b@`) and C (`-c@`).
3. "Create availabilities" → HP A, rows: `{{XD1}}` EARLY no pool; `{{XD2}}` EARLY + NIGHT no pool; `{{XD3}}` EARLY pool `e2e-ptn-{{RUN_TAG}}-a`; `{{XD4}}` EARLY + NIGHT pool `e2e-ptn-{{RUN_TAG}}-a`; `{{XD5}}` LATE pool `e2e-ptn-{{RUN_TAG}}-b`; `{{XD6}}` EARLY + LATE no pool → "Submit 6 availabilities"; capture `POST …/availabilities` → `avail-post.json`.
4. Planner API as SPX: `GET /api/private/tenant/consumable-external-pools` → `pools.json`; per pool `GET /api/private/external-availability-roster/<poolId>?from={{XD1}}&to={{XD6}}` → `roster-<pool>.json`.

Expect: registration 2xx, "Registered"; availabilities 2xx; pools = the provider-level pool (named after the provider organisation; rows without pool) + `…-a` + `…-b`; HP A in all three with exactly the submitted days: provider pool XD1, XD2, XD6; pool a XD3, XD4; pool b XD5. Empty `consumable-external-pools` → BLOCKED-data "tenant GLN missing" (P-PTN-4), and the rest of the family is BLOCKED too.

## PTN-17 — GLN scoping

1. Simulator → HP B rows: `{{XD1}}` EARLY with GLN `{{FOREIGN_GLN}}`; `{{XD2}}` EARLY with the GLN field **empty**; `{{XD3}}` EARLY with GLN `{{GLN}}` → submit → `avail-b.json`.
2. Planner API as SPX: `consumable-external-pools` + rosters for `{{XD1}}`–`{{XD3}}` → `roster-gln.json`.

Expect: HP B on `{{XD3}}` visible to `{{TENANT}}`; `{{XD1}}` invisible; `{{XD2}}`: record what happens (the simulator says "empty = any organisation", the backend matches only intersecting GLNs) in `notes.md` — not a verdict on its own.

## PTN-13 — BADI external pools: book, consumption, partner receipt, PEP plannings, confirmation text

1. BADI as SPX: `/badi?group-node-id={{SPX_NODE}}&range-start={{XD1}}&cell-width=60&number-of-cells-displayed=14&employee-column-width=220` → toggle "Externe Pools" → confirm "Sind Sie sicher, dass Sie zu den externen Pools wechseln möchten?".
2. Shot `02-badi-external.png`: the provider pool, `…-a`, `…-b`, HP A rows with availability cells.
3. Select HP A on `{{XD3}}` (pool a) and `{{XD5}}` (pool b) → "Weiter" → step 1: shift / category (record the selector options) → step 2: contact person name / phone / e-mail (use `E2E {{RUN_TAG}}`, `+41000000000`, `e2e-ptn-{{RUN_TAG}}-sp@zinc.ch`), cost centre → "Buchen" for each; capture `POST /api/private/external-providers/{{PROVIDER_CODE}}/bookings` (`booking_status`, transaction id) → `bookings.json`.
4. Finish screen: title "Auswahl verarbeitet", subtitle "Vorgenommene Buchungen wurden geplant. Die Mitarbeitenden werden durch den Partner informiert." (shot `04-finish.png`). The internal text "…über myPOLYPOINT informiert" here is a FAIL (PPCLOUD-14127 regression).
5. Close → BADI reloads: pool b no longer shows HP A on `{{XD5}}` (shot `05-after-reload.png`).
6. Book HP A on `{{XD1}}`, on `{{XD2}}` (EARLY) and on `{{XD4}}` (EARLY): the step-1 selector lists both shift types for `{{XD2}}` / `{{XD4}}` (record).
7. `gwmock.mjs … received --tx <the 5 ids>` → `received-bookings.json`.
8. `ext-planning.sql` (node `{{SPX_NODE}}`, `{{XD1}}`..`{{XD5}}`) → `oracle-ext-planning.txt`.
9. `GET /api/private/external-providers/transactions?…` as SPX → `transactions.json`: 5 × BOOKED.

Expect: every booking `BOOKED`; external finish text; consumed availabilities disappear after reload; received bookings BOOKED with `authority.organization.name = {{TENANT}}`, `.gln = {{GLN}}`, the booked date / shift / pool; one planning per booked day for a login-less (external) employee.

## PTN-14 — External booking guards

1. Simulator: HP C rows `{{XD7}}` NIGHT and `{{XD7N}}` EARLY (no pool, GLN `{{GLN}}`), and `{{LEAD_DAY}}` EARLY.
2. BADI external: book HP C `{{XD7}}` NIGHT → BOOKED.
3. Book HP C `{{XD7N}}` EARLY → step 2 shows conflicts, "Buchen" disabled until "Trotzdem Buchen?" is ticked → tick → "Buchen"; capture both POSTs (the second with `ignore-conflicts`) → `conflict-post-1.json`, `conflict-post-2.json`; shot `03-conflicts.png`.
4. Book HP A on `{{XD4}}` again with NIGHT (the second shift type of that availability; if the cell is gone, call the bookings API with the `{{XD4}}` NIGHT payload of the step-1 request) → error → `already-booked.json`.
5. Book HP C on `{{LEAD_DAY}}` → error → `lead-time.json`.
6. If step 3 showed no conflict: try the 6th-consecutive-day variant (HP A `{{XD6}}` after `{{XD1}}`..`{{XD5}}`) and record.

Expect: 3 → the first POST returns conflicts (nothing applied), the second BOOKED; 4 → 409 `EXTERNAL_BOOKING_HP_ALREADY_BOOKED`; 5 → 409 `externalAvailabilityNotBookable`; received bookings and external plannings only for the successful bookings. Neither step 3 nor step 6 yields a conflict → BLOCKED-data "box has no rest-time / consecutive-day rule" (not FAIL).

## PTN-15 — External-pool tab and cancellation paths

1. Simulator: HP A `{{XD8}}` EARLY with Policies cancellation lead `PT720H` → BADI: book it.
2. `/shift-planner/manage-shift-bookings/external-pool` (tab "Externer Pool") as SPX: list with status chips, filters, default order; capture `GET …/external-providers/transactions` → `transactions-1.json`; shot `02-external-pool-tab.png`.
3. Cancel the `{{XD1}}` booking (confirmation) → status CANCELLED; capture `DELETE /api/private/external-providers/{{PROVIDER_CODE}}/transactions/<id>` → `cancel-xd1.json`.
4. Cancel it again through the API → error → `cancel-again.json`.
5. Simulator → "Received from POLYPOINT" → the `{{XD2}}` row → "Cancel as partner" (shot `05-partner-cancel.png`).
6. Planner list: `{{XD2}}` CANCELLED (cancelled by the partner) → `transactions-2.json`.
7. Cancel `{{XD8}}` → refused → `cancel-xd8.json`.
8. `ext-planning.sql` for `{{XD1}}`, `{{XD2}}`, `{{XD8}}`; `gwmock.mjs received --tx` for the XD1 / XD2 ids.

Expect: 3 → CANCELLED, PEP planning of XD1 deleted, received booking `CANCELLED_BY_POLYPOINT`; 4 → `EXTERNAL_WORKFORCE_TRANSACTION_ALREADY_CANCELLED`; 5 / 6 → CANCELLED, PEP XD2 deleted, no provider call; 7 → 409 `bookingNotCancellable` with the deadline, booking stays BOOKED and PEP XD8 remains.

## Cleanup checklist

- Keep HP A / B / C registered and the `{{XD3}}` booking BOOKED: family X20 cancels it inside the window and the runner unregisters the three HPs after X20 (report their state in `created_data`).
- Cancel any other booking you made that is still BOOKED and not needed by X20 (XD4, XD5, XD7, XD7N); list every transaction id with its final status.
- The `{{XD8}}` booking cannot be cancelled by design (PT720H): `created_data` with `cleaned: false`, how "not cancellable, goes with the env destroy".

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
