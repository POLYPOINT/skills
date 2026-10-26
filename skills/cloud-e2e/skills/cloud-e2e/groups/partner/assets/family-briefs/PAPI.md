# Family PAPI — Partner API (PTN-03, 04, 05, 06, 07, 19) · run partner read-only, PH1–PH5, SPX

|                           |                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scenarios (in this order) | PTN-03, PTN-04, PTN-05, PTN-06, PTN-07, PTN-19                                                                                                                                                                                                                                                   |
| Actors                    | PH1 `{{PH1_LOGIN}}` ({{PH1_ID}}), PH2 `{{PH2_LOGIN}}` ({{PH2_ID}}), PH3 `{{PH3_LOGIN}}` ({{PH3_ID}}), PH4 `{{PH4_LOGIN}}` ({{PH4_ID}}), PH5 `{{PH5_LOGIN}}` ({{PH5_ID}}), SPX `{{SPX_LOGIN}}` ({{SPX_ID}}), optional ERX `{{ERX_LOGIN}}` ({{ERX_ID}}); portal ops profile `{{PORTAL_PROFILE}}`   |
| Days                      | `{{ST_DAY}}` (PH1 seed presence, PH2 / PH3 candidates), `{{SR_DAY}}` (PH4 free), `{{RRX_DAY}}` (ERX presence, PH5 free)                                                                                                                                                                          |
| Partners                  | run partner `{{PARTNER_ID}}` (read-only: tokens, Testing tab, logs); throw-away `e2e-ptn-g-{{RUN_TAG}}` (PTN-05, yours)                                                                                                                                                                          |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/PAPI` · `{{RUN_DIR}}/PAPI/<scenario>/` · `created/PAPI.jsonl`                                                                                                                                                                                               |
| Window-sensitive          | PTN-07 and PTN-19 write PEP plannings and depend on `shiftTrades` / the write flags: before each, read `windows/` (dashboard {{DASHBOARD_URL}}); W-X-TRADES-OFF, W-X-CATEGORIES-OFF or W-X-WRITE-OFF `draining` / `active` → finish nothing new, report the rest BLOCKED "paused by window <id>" |
| Read first                | the group part above; scenarios.md PTN-03..07, 19; known-deviations.md PF-3                                                                                                                                                                                                                      |

Token and call pattern (one script per scenario is easiest: `node {{SKILL_DIR}}/scripts/harness/partner-api.mjs {{PARTNER_ID}} {{RUN_DIR}}/PAPI/<scenario> {{RUN_DIR}}/scripts/PAPI-<scenario>.mjs --portal-profile {{PORTAL_PROFILE}}`; the script gets `tokens.client()`, `tokens.hp('{{TENANT}}', subject, 'de')`, `call(method, url, {as, body})`, `claims(token)`, `save(name, obj)`). Never return, log or save a token; save statuses, error names and decoded claims only. Subjects: `partner-allocation.md`.

## PTN-03 — Partner tokens

1. `token client` → save `claims-client.json`: role `EVENT_CONSUMER`, claim `partner_id = {{PARTNER_ID}}`.
2. `token hp {{TENANT}} <PH1 subject> de` → `claims-hp.json`: `partner_id = {{PARTNER_ID}}`, `partner_rights` = the 8 rights of the run partner for `{{TENANT}}`, tenant `{{TENANT}}`, `sub` = PH1's subject.
3. Negative tenant: `call POST pidl:/api/partner/ct-zinc-master/token` with body `{"tenant_subject": "<PH1 subject>", "locale": "de"}` `--as client` → status (expected 403 `InsufficientPermissionsException`: the run partner has no access to that tenant). Save `neg-tenant.json` (status + error name).
4. Negative role: the same `/api/partner/{{TENANT}}/token` call with PH1's myPP bearer instead of the client token (capture it inside an `app.mjs … --app mypp` script as `api` and call the polyid-login URL from there; never save the bearer) → expected 403 (`hasRole('EVENT_CONSUMER')`). Save `neg-role.json`.

Expect: 1 → 200; 2 → 200 with the claims above; 3 → 403; 4 → 403.

## PTN-04 — Full sync users and shifts

1. PolyPortal ops (portal-ops script) → Partner `{{PARTNER_ID}}` → tab **"Testing"** (no edit, no Save): run "Cursor Paging Full User Sync" (Tenant ID `{{TENANT}}`, expected e-mail domain `{{TENANT}}.ch`), "V1 Paging Full User Sync", "Shift Full Sync" (Tenant Subject = PH5's, From `{{TODAY}}`, To 6 days later). Capture each `POST …/tests/<id>` → `tests-results.json`; shot `01-testing.png`.
2. `call GET portal-api:/api/v2/events/consumer/{{TENANT}}/users?cursor=0&page-size=20` (all pages, `--as client`) → `users-v2.json`; `call GET portal-api:/api/v1/events/consumer/{{TENANT}}/users?current-page=0&page-size=100` → `users-v1.json`.
3. `call POST portal-api:/api/v1/events/consumer/{{TENANT}}/shifts?range-start={{TODAY}}&range-end=<TODAY+6>` with body `["<PH5 subject>"]` → `shifts.json`.
4. DB oracle per day of the range: `plan-day.sh {{TENANT}} {{PH5_ID}} <day>` → `oracle-pl-{{PH5_ID}}-<day>.txt`.
5. Negative: `range-start` = 2 months before `{{TODAY}}` → status → `neg-range.json`.

Expect: every Testing result OK (no ERROR rows); v1 and v2 list the same subjects, count = seed users with a login; the shift list equals PH5's PEP plannings day by day (date, definition code, times); step 5 → 416.

## PTN-05 — Partner API access guards

1. With the run partner's HP token for PH1: `GET api:/api/partner/v1/user-features` → 200; with the client token `GET api:/api/partner/v1/health/ping/{{TENANT}}` → 200.
2. With PH1's myPP bearer (inside an `app.mjs --app mypp` script): `GET /api/partner/v1/user-features` → denied (401 / 403, "Non-partner token attempted to make a partner API call").
3. With the run partner's HP token: `GET api:/api/mobile/health-professional/v1/notifications?current-page=0&page-size=1` → denied (no UI_EMBEDDING).
4. Create the throw-away `e2e-ptn-g-{{RUN_TAG}}` in the PolyPortal ops UI (portal-ops script, as family PA does it): subscription `users` = `USERS`, then tenant access `{{TENANT}}` with **USERS + API_GATEWAY only** (no POMA\_\* right, no UI_EMBEDDING), change-request id `E2E-{{RUN_TAG}}`. Log it in `created/PAPI.jsonl`. Then with `partner-api.mjs e2e-ptn-g-{{RUN_TAG}} … token hp {{TENANT}} <PH1 subject> de`: `GET api:/api/partner/v1/scheduling-requests/shift-definitions?day={{SR_DAY}}` and `GET api:/api/partner/v1/shift-trade-candidates?shift-planning-id=<id>&roster-cell-id=<id>` (ids of PH1's `{{ST_DAY}}` shift from PH1's myPP `calendar/day-view?date={{ST_DAY}}`, same lookup as PTN-07 step 1).
5. Edit `e2e-ptn-g-{{RUN_TAG}}`: add UI_EMBEDDING to its tenant access (change-request id) → new HP token → repeat step 3's call.
6. Delete `e2e-ptn-g-{{RUN_TAG}}` (prompt `DELETE`), verify by a list read.

Expect: 1 → 200 / 200; 2 → denied; 3 → denied; 4 → **intended** 403 (missing POMA_SHIFT_REQUEST_API / POMA_SHIFT_TRADE_API) — a 200 is **KNOWN-FAIL PF-3** (`findings_confirmed: ["PF-3"]`, jsonShot of the 200); 5 → 200 (mobile API allowed with UI_EMBEDDING). Save one table `guards.json` (token kind, partner, path, status).

## PTN-06 — Scheduling requests V1 through the Partner API

1. HP token of the run partner for PH4.
2. `GET api:/api/partner/v1/scheduling-requests/shift-definitions?day={{SR_DAY}}` → non-empty → pick one id → `sr-defs.json`.
3. `POST api:/api/partner/v1/scheduling-requests` body `{"from_date":"{{SR_DAY}}","to_date":"{{SR_DAY}}","employment_id":null,"note":"E2E {{RUN_TAG}}","schedule_position":"FULL","shift_definition_id":"<id>"}` → 2xx with id → `sr-create.json`; log it in `created/PAPI.jsonl`.
4. `GET …/scheduling-requests?from={{SR_DAY}}&to={{SR_DAY}}` and `GET …/scheduling-requests/<id>` → contain it (note, definition, day) → `sr-get.json`.
5. myPP as PH4 (`app.mjs … --app mypp`): calendar day `{{SR_DAY}}` (or the Dienstwunsch list) shows the wish; capture the day-view XHR; shot `05-mypp-day.png`.
6. `DELETE …/scheduling-requests/<id>` → 2xx; `GET` by id → 404 / absent → `sr-delete.json`.
7. Run partner log since step 3 (`partner logs {{PARTNER_ID}} --since <T>`): record whether `v1/HealthProfessionalUpdateSchedulingRequest` / `…DeleteSchedulingRequest` appear (informational, not part of the verdict).

## PTN-07 — Shift trade on behalf of an HP via the Partner API

1. myPP as PH1: `GET /api/mobile/health-professional/v1/calendar/day-view?date={{ST_DAY}}` → `shift_planning_id`, `roster_cell_id` of PH1's shift → `day-view.json`. Oracles before: `plan-day.sh {{TENANT}} {{PH1_ID}} {{ST_DAY}}`, same for PH2 / PH3.
2. HP token for PH1: `GET api:/api/partner/v1/shift-trade-allowed?shift-planning-id=<id>&roster-cell-id=<id>` and `GET api:/api/partner/v1/shift-trade-candidates?shift-planning-id=<id>&roster-cell-id=<id>` → PH2 and PH3 listed → `candidates.json`. Missing → BLOCKED-data "candidates" (do not pick other people).
3. `POST api:/api/partner/v1/shift-trades` body `{"shift":{"shift_planning_id":"<id>","roster_cell_id":"<id>"},"message":"E2E {{RUN_TAG}}","candidates":[{"tenantsubject":"<PH2 subject>"},{"tenantsubject":"<PH3 subject>"}]}` → 201, response `url` = `…?opportunity=<oppId>` → `trade-create.json`. Write `oppId` and the start time T into `notes.md` (family PE reads them) and `created/PAPI.jsonl`.
4. HP token for PH2: `POST api:/api/partner/v1/opportunities/<oppId>/application` with the YES body (`{"response":"YES"}`; record the exact body the API accepts) → 2xx → `apply-ph2.json`; PH3 with NO → `apply-ph3.json`.
5. myPP as PH2: `ncSince(api, T, {objectId: oppId})` lists the invitation → `nc-ph2.json`.
6. Planner app as SPX (`app.mjs … --app poma`): the shift-swap approval list (`/api/private/shift-trades/past-and-current?opportunity-state=…`, filter by **your** oppId) → approve the request of PH2 (`PUT /api/private/shift-trades/<oppId>/check-conflicts-and-write` with `operation: APPROVE`) → shot `06-approve.png`.
7. Oracles after: `plan-day.sh` for PH1 and PH2 on `{{ST_DAY}}` → the planning moved from PH1 to PH2.

Expect: 2 PH2 / PH3 listed; 3 → 201 + url; 4 → 2xx; 6 approved; 7 planning moved. Record in notes which swap generation the box answers with and whether PPCLOUD-12263 (partner trade broken, 04/2025) is gone.

## PTN-19 — Partner applies to a resource-replacement invitation (optional)

Only when `partner-allocation.md` lists the ERX presence on `{{RRX_DAY}}` (seed P-PTN-9b); else BLOCKED-data "P-PTN-9b not prepared".

1. Create the resource replacement for ERX's `{{RRX_DAY}}` planning with PH5 as the only candidate, by the booking group's PEP stand-in recipe ("RR creation (PEP stand-in)" in `{{SKILL_DIR}}/groups/booking/assets/family-briefs/RR.md`, read-only): ids with `sql.sh {{TENANT}} -f {{SKILL_DIR}}/groups/booking/scripts/rr-ids.sql -D er={{ERX_ID}} -D day={{RRX_DAY}} -D cands={{PH5_ID}}`; ERX's planned-shift detail from ERX's myPP session; then as SPX (`--app poma`) `createRR(api, rrBodyFrom(detail, {…, roster: {id: '{{SPX_NODE}}', name: '<Planblatt name>'}, pool: [{employeeId: {{PH5_ID}}, keycloakUserId: <rr-ids R4>}]}))` imported from `{{SKILL_DIR}}/groups/booking/scripts/booking-lib.mjs`; publish it to PH5 on the RR page. `oppId` (`oppIdFromUrl`) → `created/PAPI.jsonl`. A 4xx naming a field → fix that field once, else BLOCKED "RR creation body".
2. HP token of the run partner for PH5: `GET api:/api/partner/v1/opportunities/<oppId>` → 200 → `opp.json`.
3. `POST …/opportunities/<oppId>/application` (YES) → 2xx → `apply.json`; then `PUT …/opportunities/<oppId>/application` to NO and back to YES — record what the API allows.
4. Planner app as SPX: "Anfragen verwalten" → the opportunity shows PH5's answer; shot `05-sp-view.png`.
5. Run partner log since step 1: `v1/OpportunityResourceReplacementInvitation` for PH5 and `v1/OpportunityResponse` → `partner-log.json`.
6. Cleanup: cancel the opportunity as SPX (no selection) and verify ERX's planning is unchanged (`plan-day.sh`).

## Cleanup checklist

- `e2e-ptn-g-{{RUN_TAG}}` deleted (list read); PH4's scheduling request deleted; PTN-19 opportunity cancelled.
- The PTN-07 trade is approved (planning moved: listed in `created_data` with `cleaned: false`, how: "approved swap, kept") or cancelled if step 6 failed.
- The run partner `{{PARTNER_ID}}` was only read (tokens, Testing tab, logs).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
