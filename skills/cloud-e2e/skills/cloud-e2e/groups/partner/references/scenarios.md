# Group partner — scenario catalogue (PTN, 18 scenarios)

Converted from `areas/partner/scenarios.md` (A-partner, 2026-10-23; code base cloud master 89d7e960e0, pp-services origin/master 2026-10-15) with the S1 reconciliations of 2026-10-23:

- environment = **DM-X** (shared with swap, booking, hp, ts) plus the CT stage registries next to it; flags = steward baseline (`partnerSimulator`, `externalAvailabilities`, `schedulingRequestV1`, `shiftTrades`, `opportunities`, write flags ON; messaging flags OFF), never flipped by this group;
- the **run partner `e2e-ptn-<run>`** (area step P-PTN-1) is created, logged and deleted by the **steward** (S-CT-REG, gate G-PTN-1) and read by this group, swap SWP-31 and booking BKG-27 — **never edited** (an edit switches logging off and deletes every logged event);
- the provider gate (P-PTN-3) and the tenant GLN (P-PTN-4, S-CT-GLN after 00:00 of each run day) are steward stage objects; this group only reads `stage/provider-gate` and `stage/gln`;
- SPX's rights 1065 + 1062 come from the steward's role kit group **`E2E:EXTPOOL`**; this group only moves SPX into it (seed P-PTN-6);
- moved out: the PW family PTN-10, PTN-11, PTN-18 → group `shared` (the embedding mock's users are hard-coded to `ct-zinc-master`); PTN-22, PTN-23, PTN-24 → group `manual`; PTN-21 stays here as family **PWAPI** (API negatives against this env);
- PTN-20 runs as its own window family **X20** inside the CT-wide window S-CT-GWMOCK; strategy changes go through `gwmock.mjs strategy set` under the lock `locks/ct~gwmock` (not through the simulator selectors);
- run-unique names use the run tag `<tag>` (`{{RUN_TAG}}` in the briefs): throw-away partners `e2e-ptn-x|l|g-<tag>`, external HPs `E2E PTN <tag> A|B|C` with e-mails `e2e-ptn-<tag>-a|b|c@zinc.ch`, pools `e2e-ptn-<tag>-a|b`, change-request id `E2E-<tag>`.

Families (worker steps with resolved tokens: `../assets/family-briefs/<F>.md`; this file is the reference text): **PA** PTN-01, 02 · **PAPI** PTN-03, 04, 05, 06, 07, 19 · **PE** PTN-09, 08 · **EW** PTN-12, 17, 13, 14, 15 · **EB** PTN-16 · **PWAPI** PTN-21 · **X20** PTN-20 (window S-CT-GWMOCK). Data and concurrency: `data-plan.md`. Known product deviations: `known-deviations.md`. Dashboard rows: `../assets/scenarios.json`.

| Moved out                                      | Now in                       | Why                                                   |
| ---------------------------------------------- | ---------------------------- | ----------------------------------------------------- |
| PTN-10, PTN-11, PTN-18 (PWA embedding)         | `shared` (family SH-PW)      | mock users hard-coded to `ct-zinc-master`; W-SH-ANTBE |
| PTN-22 (sync an external booking into PEP)     | `manual` (PEP-RDP session)   | the sync button exists only inside PEP                |
| PTN-23 (Pub/Sub delivery to a real subscriber) | `manual` (externals session) | needs GCP access to the partner subscription          |
| PTN-24 (real external providers)               | `manual` (externals session) | third-party systems                                   |

## Conventions used by every scenario

- **Hosts (CT).** planner web app, BADI, partner simulator, POMA ops `{{POMA}}` = `https://ct-poma-webapp.dev.k8s.polypoint-dev.com` (BADI needs `&cell-width=60&number-of-cells-displayed=14&employee-column-width=220`, else the roster body stays empty); myPP `{{MYPP}}` = `{{POMA}}/health-professional-app`; poma-api `{{API}}` = `https://ct-poma-api.dev.k8s.polypoint-dev.com`; PolyPortal ops `{{PORTAL}}/ops/` = `https://ct-portal-webapp.dev.k8s.polypoint-dev.com/ops/`; portal-api `{{PORTAL_API}}` = `https://ct-portal-api.dev.k8s.polypoint-dev.com`; polyid-login `{{PIDL}}` = `https://ct-polyid-login.dev.k8s.polypoint-dev.com`; Keycloak `{{KC}}` = `https://ct-keycloak.dev.k8s.polypoint-dev.com`; gateway mock `{{GWM}}` = `https://ct-poma-gateway-mock.dev.k8s.polypoint-dev.com` (read through `gwmock.mjs` only). The `{{…}}` host names in this file are descriptive; the briefs spell the hosts out.
- **Actors.** PH1–PH5 (Notfallzentrum; PH1–PH3 one personnel category), SPX (kit `E2E:EXTPOOL` = 1065 + 1062, keeps `DMSEED:Planner` 1050 / 1070), SPN (seed planner without 1062 / 1065), optional ERX (Intensivpflege); OPS = the runner's PolyPortal ops ADMIN session (Debug tab, "Show" secret, partner CRUD) and POMA ops ADMIN session (conflict-checker "Partner" publish). Logins `dmseed-<kürzel>` (ASCII), passwords only from the DeployMate manifest through the harness.
- **Harness** (core `scripts/harness/`, contracts in `references/harness.md`): `app.mjs --app poma|mypp` (planner app / BADI / simulator, myPP), `portal-ops.mjs` (partner logs, logging toggle, create / delete of `e2e-*` partners, ops UI scripts; `--base poma-ops` for POMA ops), `partner-api.mjs` (client-credentials and impersonation tokens, Partner-API and full-sync calls, raw partner-session calls; secrets in memory), `gwmock.mjs` (received bookings by transaction id, strategy get; strategy set only in X20), `plan-day.sh` (PEP plannings of a seed employee), group script `scripts/ext-planning.sql` (plannings of login-less = external employees). Saved JSON has tokens and secrets replaced by `[redacted]`; decoded claims (header / payload) may be saved.
- **Never call** a `/test/**` path yourself (portal-api, polyid-login, event-handler, poma-api), the embedding mock's "Notification simulator", the gateway mock's clear / demo-data / inbox-delete calls; never restart the gateway mock. Reading the received-bookings inbox through `gwmock.mjs received` is allowed (OQ-32); strategy changes only in X20.
- **Partner event oracle.** The Debug log of the partner: `portal-ops.mjs … "partner logs <id> --since <ISO>"` (UI: PolyPortal ops → Partner → tab Debug). Match by CloudEvent `type` (`v1/<Subclass>`), `source` (= tenant id) and the object id / tenant subject in `data`. A logged event proves routing to the partner's subscription.
- **Days** (tokens of `rules.json`): `{{XD1}}`…`{{XD8}}` eight consecutive weekdays ≥ R+7 after the seeded roster (outside the booking lead time PT48H), `{{XD7N}}` = the day after `{{XD7}}`, `{{XD9}}` / `{{XD10}}` = `{{XD8}}` + 1 / + 2, `{{CM_DAY}}` a future day of the current month, `{{NM_DAY}}` a day of the next month, `{{SR_DAY}}` ≥ R+3, `{{ST_DAY}}` a seed presence day of PH1 ≥ R+2, `{{RRX_DAY}}` ERX's painted presence (PTN-19), `{{LEAD_DAY}}` = R+1.
- **Evidence naming.** `NN-<step>.png`, `<endpoint>.json`, `partner-log*.json`, `received-bookings.json`, `oracle-<what>.txt`, `claims-<token>.json`, `notes.md`; every non-PASS gets an outlined issue screenshot (`e2e-lib.mjs issueShot`) or a `jsonShot`.
- **Expected values.** `PASS`, or `KNOWN-FAIL PF-<n>` where the code shows a defect (`known-deviations.md`).

---

### PTN-01 Integration partner lifecycle: create, subscriptions, tenant access, change log, Keycloak client, delete

> Data prerequisite: none from the seed; `OPS` session; the env id `{{TENANT}}` exists in PolyPortal. Throwaway partner `e2e-ptn-x-<tag>` (stage-wide registry, owned and deleted by this scenario).
> Pre: no partner with that id exists (`GET …/integration-partners?count=200`).
> Steps: 1. PolyPortal ops `{{PORTAL}}/ops/partners` → add a new partner: id `e2e-ptn-x-<tag>`, names, active; subscription 1 name `users`, "Event Types" = `USERS` (ack 120 s, retention 1440 min, expiry 31 d defaults) → "Save"; capture `POST …/integration-partners`. 2. Reopen the partner: tab "Details" shows "Keycloak Client Id: event-consumer-integration-e2e-ptn-x-<tag>"; capture `GET …/integration-partners/{id}`; note the stored subscription name. 3. (optional, operator gcloud read-only, ask first) list Pub/Sub subscriptions with prefix `<stored name>` in the CT project: one subscription, filter contains `routeto…`, no `deadLetterPolicy` (PF-1). 4. Edit: add subscription 2 `shifts` with `PLANNED_SHIFTS`, add tenant access `{{TENANT}}` with rights USERS, PLANNED_SHIFTS; try "Save" without change-request id → button disabled; enter change-request id `E2E-<tag>` + comment → "Save" → alert "Partner Updated"; capture `PUT`. 5. Tab "Change Log": entry with `E2E-<tag>`. 6. partner-api.mjs: client-credentials token for the partner (secret via "Show", in memory) → 200, claims `partner_id = e2e-ptn-x-<tag>`, role EVENT_CONSUMER (save `claims-client.json`). 7. (optional gcloud) two subscriptions now. 8. "Delete" → prompt, type `DELETE` → alert (text says "Tenant … deleted" — cosmetic) → partner absent from the list. 9. partner-api.mjs token request again → 401/400 (client deleted). 10. (optional gcloud) no subscription with that prefix.
> Expect: create 2xx; stored subscription names start with `<env-specific partner-events topic>-e2e-ptn-x-<tag>-` (auto-prefixed, `IntegrationPartnerAdminService.java:125-141`); filters hold right categories; edit blocked without change-request id; change-log row present; token works while the partner exists and fails after delete; subscriptions gone.
> Oracle: API responses (`subscription_config_list[].name`, `.event_subscription_filters`, `tenant_access_list`), `GET …/partner-changes`, token endpoint status + claims, optional gcloud listing.
> Evidence: 01-create.png, 04-save-disabled.png, 05-change-log.png, partner-create.json, partner-get.json, partner-put.json, claims-client.json, gcloud-\*.txt (optional).
> Source: 11473649825#1–#7; PORT-PART-01, PORT-PART-02 (change log); PF-1.

### PTN-02 Partner event logging (Debug tab): enable, routed events appear, a partner edit disables logging and deletes the log

> Data prerequisite: throwaway partner `e2e-ptn-l-<tag>` created at the start of this scenario (same recipe as PTN-01 step 1+4: subscription `shifts` = PLANNED_SHIFTS, tenant access `{{TENANT}}` = PLANNED_SHIFTS) — never the shared `{{PARTNER_ID}}`. POMA ops ADMIN session. `PH5` has seed plannings in the current month.
> Pre: run after P-PTN-1 (independent of it).
> Steps: 1. Partner → tab "Debug" → toggle "Log partner events" → confirm ("…store a month of events…"); capture `PUT …/logs`. 2. POMA ops `{{POMA}}/ops/conflict-checker` → tab "Partner" → Type CREATE, From/To = TODAY…TODAY+6, Tenant Subject = `PH5`'s subject, tenant `{{TENANT}}` → "Publish Events"; capture the POST. 3. Wait ≤ 2 min; Debug tab (set the date picker to TODAY) → capture logs. 4. Open one row (expand) → JSON with `type v1/UpdatePlannedShift`, `source {{TENANT}}`. 5. Edit the partner (comment + change-request id) → "Save". 6. Debug tab again: toggle off, `0 events displayed`; capture logs. 7. Toggle logging on again, delete the partner (cleanup).
> Expect: step 3 ≥ 1 `v1/UpdatePlannedShift` (+ `v1/UpdateShiftBlock`) for `PH5`'s seed plannings; after step 5 logging is disabled and the log is empty (fact 3, `IntegrationPartnerAdminService.java:162`, `EventLoggingService.java:162-170`).
> Oracle: logs response `items[]` before/after; partner `logging_config.enabled` false after the edit.
> Evidence: 01-toggle.png, 02-publish.png, partner-log-before.json, partner-log-after.json, notes.md.
> Source: 11473649825#4 (correction); PORT-PART-02, POMA-OPS-10; gap G-01, G-11.

### PTN-03 Partner tokens: client credentials and HP impersonation

> Data prerequisite: P-PTN-1; `PH1` tenant subject (from the full-sync users list or the manifest).
> Steps: 1. partner-api.mjs `token client`: `POST {{KC}}/auth/realms/polypoint-polyportal-realm/protocol/openid-connect/token` (client_credentials, client `event-consumer-integration-{{PARTNER_ID}}`, secret read in memory) → save decoded claims. 2. partner-api.mjs `token hp`: `POST {{PIDL}}/api/partner/{{TENANT}}/token` body `{"tenant_subject":"<PH1 subject>","locale":"de"}` with the client token → save decoded claims. 3. Negative: same call with `tenant_subject` of a user of another tenant (e.g. a ct-zinc-master subject) and `tenantId` = that tenant (not granted) → status. 4. Negative: call 2 with an HP myPP token (from `app.mjs --app mypp` capture) instead of the client token → status.
> Expect: 1 → 200, role EVENT_CONSUMER, claim `partner_id`; 2 → 200, PolyID token for `PH1` with `partner_id = {{PARTNER_ID}}`, `partner_rights` = the seven rights of `{{TENANT}}`, tenant `{{TENANT}}`; 3 → 403 (`InsufficientPermissionsException`, `PIDL/service/PortalService.java:51-60`); 4 → 403 (`hasRole('EVENT_CONSUMER')`).
> Oracle: status codes; claims JSON (`partner_id`, `partner_rights`, `tenant_id`, `sub`).
> Evidence: claims-client.json, claims-hp.json, neg-tenant.json, neg-role.json (tokens redacted).
> Source: 11525881991#0, #10; PID-API-04; facts 7.

### PTN-04 Full sync users and shifts (Testing tab + API) with range and right checks

> Data prerequisite: P-PTN-1; seed roster (14 days around seed date); DB oracle (`scripts/sql.sh --install`).
> Steps: 1. PolyPortal ops → Partner `{{PARTNER_ID}}` → tab "Testing" → run "Cursor Paging Full User Sync" (Tenant ID `{{TENANT}}`, expected e-mail domain `{{TENANT}}.ch`), "V1 Paging Full User Sync", "Shift Full Sync" (Tenant Subject `PH5`, From TODAY, To TODAY+6); capture `POST …/tests/{id}` results. 2. partner-api.mjs: `GET {{PORTAL_API}}/api/v2/events/consumer/{{TENANT}}/users?cursor=0&page-size=20` (all pages) and `GET …/api/v1/events/consumer/{{TENANT}}/users?current-page=0&page-size=100`. 3. partner-api.mjs: `POST {{PORTAL_API}}/api/v1/events/consumer/{{TENANT}}/shifts?range-start=TODAY&range-end=TODAY+6` body = list with `PH5`'s subject. 4. DB oracle `plan-day.sh {{TENANT}} <PH5 MA_ID> <day>` for each day of the range. 5. Negative: `range-start` = TODAY−2 months → status. 6. (optional) tab "Monitoring" → users-synced count for `{{TENANT}}`.
> Expect: every Testing result OK (no ERROR rows: "All Users have Employee ID / Categories / Tenant Subject / expected email domain"); v1 and v2 user lists contain the same subjects, count = seeded users with login; shift list = the PEP plannings of `PH5` (date, shift definition code, times) day by day; step 5 → 416 (`FullSyncController.java:113-140`).
> Oracle: Testing results JSON; users JSON vs manifest; shifts JSON vs `PL|` lines of the DB oracle.
> Evidence: 01-testing.png, tests-results.json, users-v1.json, users-v2.json, shifts.json, oracle-pl-<emp>-<day>.txt, neg-range.json.
> Source: 11525881991#1, #2; 11329798210#3, #5; PORT-EVT-02, PORT-PART-03, PORT-PART-04.

### PTN-05 Partner API access guards (rights, token type, UI_EMBEDDING) and health / user-features

> Data prerequisite: throwaway partner `e2e-ptn-g-<tag>` created by this scenario with tenant access `{{TENANT}}` = USERS + API*GATEWAY only (no POMA*\* rights, no UI_EMBEDDING); deleted at the end. `PH1` subject; an HP myPP token of `PH1`.
> Steps: 1. With `{{PARTNER_ID}}` HP token (PTN-03): `GET {{API}}/api/partner/v1/user-features` and `GET {{API}}/api/partner/v1/health/ping/{{TENANT}}` (client token). 2. With an HP myPP token (no partner id): `GET {{API}}/api/partner/v1/user-features`. 3. With `{{PARTNER_ID}}` HP token: `GET {{API}}/api/mobile/health-professional/v1/notifications?current-page=0&page-size=1` (non-partner API, no UI_EMBEDDING). 4. Create `e2e-ptn-g-<tag>`; partner-api.mjs impersonation token through it → call `GET {{API}}/api/partner/v1/scheduling-requests/shift-definitions?day={{SR_DAY}}` and `GET …/shift-trade-candidates?shift-planning-id=…&roster-cell-id=…` (ids from `PH1`'s calendar day-view of `{{ST_DAY}}`, same lookup as PTN-07 step 1). 5. Edit `e2e-ptn-g-<tag>`: add UI_EMBEDDING (change-request id) → new token → repeat step 3's call. 6. Delete `e2e-ptn-g-<tag>`.
> Expect: 1 → 200 / 200 ("up"); 2 → denied (401/403, "Non-partner token attempted to make a partner API call"); 3 → denied; 4 → **intended** 403 (missing POMA_SHIFT_REQUEST_API / POMA_SHIFT_TRADE_API) — code enforces nothing → 200 = KNOWN-FAIL PF-3; 5 → 200 (mobile API allowed with UI_EMBEDDING, `PomaApiSecurityConfiguration.java:122-137`).
> Oracle: status codes per call.
> Evidence: guards.json (one row per call: token kind, path, status), notes.md.
> Source: 11525881991#10; POMA-PARTNER-01; gaps G-03, G-04, G-28; PF-3.

### PTN-06 Scheduling requests V1 through the Partner API

> Data prerequisite: tenant flag `poma.flows.schedulingRequestV1` = true (steward flag baseline); `PH4` free on `{{SR_DAY}}`.
> Steps: 1. partner-api.mjs impersonation token for `PH4`. 2. `GET {{API}}/api/partner/v1/scheduling-requests/shift-definitions?day={{SR_DAY}}` → pick one id. 3. `POST {{API}}/api/partner/v1/scheduling-requests` `{"from_date":"{{SR_DAY}}","to_date":"{{SR_DAY}}","employment_id":null,"note":"E2E <tag>","schedule_position":"FULL","shift_definition_id":"<id>"}`. 4. `GET …/scheduling-requests?from={{SR_DAY}}&to={{SR_DAY}}` and `GET …/scheduling-requests/{id}`. 5. myPP as `PH4` → calendar day `{{SR_DAY}}` (or the Dienstwunsch list) → the wish is shown; capture the calendar day-view XHR. 6. `DELETE …/scheduling-requests/{id}` → GET by id.
> Expect: 2 non-empty list; 3 2xx with id; 4 contains it (note, shift definition, day); 5 visible for the HP; 6 2xx, then 404 / absent. Partner event `v1/HealthProfessionalUpdateSchedulingRequest` / `…DeleteSchedulingRequest` in the `{{PARTNER_ID}}` log if on-prem emits them (record, right SHIFT_REQUESTS).
> Oracle: API responses; myPP day-view JSON; partner log (informational).
> Evidence: sr-defs.json, sr-create.json, sr-get.json, 05-mypp-day.png, sr-delete.json, partner-log.json.
> Source: 11525881991#3, #4; POMA-PARTNER-04.

### PTN-07 Shift trade on behalf of an HP via the Partner API (create → candidate applies → SP approves)

> Data prerequisite: flag `poma.flows.shiftTrades` = true (shared with swap); `PH1` presence planning on `{{ST_DAY}}` (seed); `PH2`, `PH3` same personnel category, free on `{{ST_DAY}}`; on-prem trade candidate rules satisfied (swap data-plan S-steps). Coordinate with the swap area: these three HPs are owned by this area.
> Steps: 1. partner-api.mjs token for `PH1`; find the shift: `{{API}}/api/mobile/health-professional/v1/calendar/day-view?date={{ST_DAY}}` via `app.mjs --app mypp` as `PH1` (shift_planning_id + roster_cell_id). 2. `GET {{API}}/api/partner/v1/shift-trade-allowed?…` and `GET …/shift-trade-candidates?shift-planning-id=<id>&roster-cell-id=<id>` → `PH2`, `PH3` listed. 3. `POST {{API}}/api/partner/v1/shift-trades` `{"shift":{"shift_planning_id":"<id>","roster_cell_id":"<id>"},"message":"E2E <tag>","candidates":[{"tenantsubject":"<PH2>"},{"tenantsubject":"<PH3>"}]}` → 201, response `url` = `{{POMA}}?opportunity=<id>`. 4. partner-api.mjs token for `PH2` → `POST …/opportunities/<id>/application` (YES body as the Bruno request `3- POST ApplyForOpportunity YES`); for `PH3` NO. 5. myPP as `PH2`: notification centre has the invitation (`GET …/notifications`). 6. Planner app as `SPX` → shift-swap approval list (swap area path) → approve the trade with `PH2`. 7. DB oracle: `plan-day.sh` for `PH1` and `PH2` on `{{ST_DAY}}`.
> Expect: 2 candidates include PH2/PH3; 3 201 + url; 4 2xx; 6 approved; 7 the planning moved from PH1 to PH2. Record which swap generation the box runs (old trade vs new swap, swap area SW notes) and whether PPCLOUD-12263 (partner shift trade broken, 04/2025) is gone.
> Oracle: API responses; NC rows; DB `PL|` lines before/after.
> Evidence: candidates.json, trade-create.json, apply-ph2.json, apply-ph3.json, nc-ph2.json, 06-approve.png, oracle-pl-\*.txt.
> Source: 11525881991#5; POMA-PARTNER-02, POMA-PARTNER-03; swap gap G-13.

### PTN-19 Partner applies to a resource-replacement invitation on behalf of an HP (optional)

> Data prerequisite: an open RR opportunity of `{{TENANT}}` with `PH5` as participant, created by `SPX` with the booking recipe BKG-21 steps 1–3 on `{{RRX_DAY}}` (presence of the replaced employee ERX — seed P-PTN-9b); flags as booking P1 (`opportunities`, `writeResourceReplacementShiftsToPep`).
> Steps: 1. partner-api.mjs token for `PH5`. 2. `GET {{API}}/api/partner/v1/opportunities/<id>` → details. 3. `POST …/opportunities/<id>/application` (YES). 4. `PUT …/opportunities/<id>/application` (change to NO, then YES — record what the API allows). 5. Planner app `SPX` → "Anfragen verwalten" → the opportunity shows `PH5`'s answer. 6. Partner log: `v1/OpportunityResourceReplacementInvitation` for PH5 and `v1/OpportunityResponse` to the SP.
> Expect: 2 200; 3/4 2xx; answer visible to the SP; events logged.
> Oracle: API responses; planner opportunity detail XHR; partner log.
> Evidence: opp.json, apply.json, 05-sp-view.png, partner-log.json.
> Source: POMA-PARTNER-03 (`ResourceReplacementPartnerAPIScenarioTest`, dormant); gap G-27.

### PTN-09 Planned-shift partner events: current month vs next month, delete, ops publish (+ optional user event)

> Data prerequisite: P-PTN-1 (logging on, right PLANNED*SHIFTS); `PH5` free on `{{CM_DAY}}` and `{{NM_DAY}}`; the Dienst used is **not** "always visible" (check in PEP Definitionen; `alwaysVisible` false) and no roster snapshot (Sollplan) is saved for next month; PEP lock.
> Steps: 1. Worker (PEP lock): paint a Dienst for `PH5` on `{{CM_DAY}}` and on `{{NM_DAY}}` (`scripts/pep/pe-paint.sh`). 2. Wait ≤ 3 min; read the partner log since step 1. 3. Delete the `{{CM_DAY}}` planning in PEP (pe-paint clear). 4. Read the log. 5. POMA ops `/ops/conflict-checker` → tab "Partner" → CREATE, From/To = `{{NM_DAY}}`, Tenant Subject `PH5` → "Publish Events" → read the log. 6. (optional) edit `PH5`'s last name in the on-prem IdM / PEP user admin, revert after → log. 7. DB oracle for both days.
> Expect: 2 → `v1/UpdatePlannedShift` (+ `v1/UpdateShiftBlock`) for `{{CM_DAY}}`, **none** for `{{NM_DAY}}` (fact 6, `UpdatePlannedShiftTopicPublishingDeterminer.java:9-21`); 4 → `v1/DeletePlannedShift` for `{{CM_DAY}}`; 5 → `v1/UpdatePlannedShift` for `{{NM_DAY}}`; 6 → `v1/UpdateUser` for `PH5` (if the IdM edit is possible; else BLOCKED-data, not FAIL).
> Oracle: partner log by `data` subject + date; DB `PL|` lines.
> Evidence: partner-log-*.json, oracle-pl-\_.txt, 05-publish.png.
> Source: 11525881991#8, #9; POMA-OPS-10, POMA-CONF-07; gaps G-10, G-11.

### PTN-08 Partner notification events of the partner-initiated trade + opportunity callback API

> Data prerequisite: PTN-07 done; P-PTN-1 logging on.
> Steps: 1. Read the `{{PARTNER_ID}}` log from PTN-07 start. 2. For the opportunity id: `GET {{API}}/api/partner/v1/events/consumer/opportunities/<id>` with the **client** token (EVENT_CONSUMER). 3. Check the absence of `v1/ShiftTradeNonselection` for `PH3` (PF-2).
> Expect: events `v1/OpportunityShiftTradeInvitation` (recipients PH2, PH3), `v1/OpportunityResponse` (to PH1 after PH2's YES), `v1/ShiftTradeSubmission` (approvers), `v1/ShiftTradeApproval` (PH1/PH2) — each with `source {{TENANT}}` and the opportunity id in `data`; callback 200 with full opportunity details; no `ShiftTradeNonselection` (expected by design today = PF-2; flag it in notes).
> Oracle: partner log matching table `partner-match.json` (expected vs found); callback JSON.
> Evidence: partner-log.json, partner-match.json, opp-callback.json.
> Source: 11525881991#7; POMA-PARTNER-03, POMA-EVENT-07, PORT-EVT-01; PF-2. (Booking events → BKG-27; full swap lifecycle → SWP-31.)

### PTN-12 Partner simulator: register external HPs and create availabilities in pools

> Data prerequisite: P-PTN-3 (provider row + simulator providerCode mapper, stage-wide gate), P-PTN-4 (tenant GLN `{{GLN}}` on `{{TENANT}}`), P-PTN-5 flags (`poma.webApp.partnerSimulator`, `poma.flows.externalAvailabilities`), P-PTN-6 (`SPX` with 1065).
> Steps: 1. `app.mjs --app poma` as `SPX` → `{{POMA}}/partner-simulator`; capture `GET {{API}}/api/internal/partner-simulator/token` status only and `GET {{API}}/api/external-workforce/v1/health-professionals`. 2. "External health professionals" → "Add health professional" → first/last name `E2E PTN <tag> A`, e-mail `e2e-ptn-<tag>-a@zinc.ch`, mobile, gender, skills (any leaf) → save → "Register" → badge "Registered"; capture `POST …/health-professionals`. Repeat for B and C. 3. "Create availabilities" → HP A → rows: `{{XD1}}` EARLY no pool; `{{XD2}}` EARLY+NIGHT no pool; `{{XD3}}` EARLY pool `e2e-ptn-<tag>-a`; `{{XD4}}` EARLY+NIGHT pool `…-a`; `{{XD5}}` LATE pool `e2e-ptn-<tag>-b`; `{{XD6}}` EARLY+LATE no pool; every row Policies → GLN = `{{GLN}}` (booking lead PT48H, cancellation lead PT1H defaults); "Replace existing availabilities…" unchecked → "Submit 6 availabilities"; capture `POST …/availabilities`. 4. Planner API as `SPX`: `GET {{API}}/api/private/tenant/consumable-external-pools` and for each pool `GET {{API}}/api/private/external-availability-roster/{poolId}?from={{XD1}}&to={{XD6}}`.
> Expect: registration 2xx, HP visible as "Registered" (server list); availabilities 2xx; pools = provider-level pool named after the provider organisation (rows without pool) + `…-a` + `…-b`; HP A appears in all three with exactly the submitted days/shifts (provider pool: XD1, XD2, XD6; pool a: XD3, XD4; pool b: XD5).
> Oracle: consumer API responses; planner API `consumable-external-pools`, `external-availability-roster` per pool.
> Evidence: 02-registered.png, hp-register.json, avail-post.json, pools.json, roster-<pool>.json.
> Source: 13304725524#2–#5; 14548467779#1; POMA-PSIM-01, POMA-EXTWF-01/02, POMA-BADI-05.

### PTN-17 GLN scoping: a tenant sees only availabilities offered to its health organisation

> Data prerequisite: PTN-12 done; HP B registered.
> Steps: 1. Simulator → HP B → rows `{{XD1}}` EARLY GLN = `{{FOREIGN_GLN}}` (foreign test GLN), `{{XD2}}` EARLY GLN empty (no restriction), `{{XD3}}` EARLY GLN = `{{GLN}}` → submit. 2. Planner API `consumable-external-pools` + rosters for XD1–XD3. 3. (optional) a planner of a second CT tenant with another GLN (if one is available read-only, e.g. ct-zinc-master) reads the same.
> Expect: XD3 visible for `{{TENANT}}`; XD1 invisible; XD2: record (simulator says "empty = any org"; backend query matches only intersecting GLNs — `ExternalWorkforcePoolService.java:35-46`); optional step 3 never shows `{{GLN}}` rows.
> Oracle: roster JSON per day.
> Evidence: avail-b.json, roster-gln.json, notes.md (XD2 behaviour).
> Source: gap G-17 (fact 8).

### PTN-13 BADI external pools: book single- and multi-shift availabilities; partner receipt; confirmation text

> Data prerequisite: PTN-12; `SPX` node id of a Planblatt (`group-node-id`) from the manifest; `scripts/ext-planning.sql` (DB oracle).
> Steps: 1. `app.mjs --app poma` as `SPX` → BADI URL (range-start `{{XD1}}`, 14 cells) → toggle "Externe Pools" → confirm ("Sind Sie sicher, dass Sie zu den externen Pools wechseln möchten?"). 2. Screenshot: pools listed (provider pool, `…-a`, `…-b`), HP A rows with availability cells. 3. Select `{{XD3}}` (pool a) and `{{XD5}}` (pool b) cells → "Weiter" → step 1 (shift / category; note the shift selector options) → step 2: Ansprechperson name / phone / e-mail, Kostenstelle → "Buchen" for each; capture `POST {{API}}/api/private/external-providers/{providerCode}/bookings` (response `booking_status`, transaction id). 4. Finish screen: title "Auswahl verarbeitet", subtitle "Vorgenommene Buchungen wurden geplant. Die Mitarbeitenden werden durch den Partner informiert." 5. Close → BADI reloads: pool b no longer shows HP A on XD5. 6. Book `{{XD1}}`, `{{XD2}}` (EARLY), `{{XD4}}` (EARLY) — check the step-1 selector lists both shift types for XD2/XD4. 7. gwmock.mjs: `gwmock.mjs received` → filter by the 5 transaction ids. 8. ext-planning.sql: PEP planning of the external employee on each booked day. 9. Planner `GET {{API}}/api/private/external-providers/transactions?…` → 5 × BOOKED.
> Expect: every booking `BOOKED`; finish text is the external key (PPCLOUD-14127 fix `a4772d67ef`, never the internal "…über myPOLYPOINT informiert"); consumed availabilities disappear after reload (pool rows without remaining availabilities hidden); received bookings have status BOOKED, `authority.organization.name = {{TENANT}}`, `.gln = {{GLN}}`, the booked date/shift and the pool; PEP has one planning per booked day for the external employee.
> Oracle: booking responses; received-bookings JSON; transactions JSON; DB planning rows.
> Evidence: 02-badi-external.png, 03-step1.png, 04-finish.png, 05-after-reload.png, bookings.json, received-bookings.json, transactions.json, oracle-ext-planning.txt.
> Source: 14548467779#0, #2, #3, #5; POMA-BADI-05, POMA-BADI-06, POMA-EXTWF-03; PPCLOUD-14127, -14018, -14358, -14155.

### PTN-14 External booking guards: conflict + "Trotzdem Buchen?", already booked that day, booking lead time

> Data prerequisite: PTN-13 done (XD4 booked EARLY for HP A); HP C with availabilities: `{{XD6}}` EARLY (from PTN-12, HP A), plus HP C rows `{{XD7}}` NIGHT and `{{XD7N}}` EARLY (pool none, GLN `{{GLN}}`), HP C row `{{LEAD_DAY}}` EARLY (booking lead PT48H).
> Steps: 1. BADI external: book HP C `{{XD7}}` NIGHT (expect BOOKED). 2. Book HP C `{{XD7N}}` EARLY → step 2 shows conflicts, "Buchen" disabled until "Trotzdem Buchen?" is ticked → tick → "Buchen"; capture both POSTs (`?ignore-conflicts`). 3. Try to book HP A on `{{XD4}}` again (second shift type NIGHT still offered as availability? if the cell is gone, call the API with the XD4 NIGHT payload) → error. 4. Try HP C `{{LEAD_DAY}}` → error. 5. If step 2 shows no conflict, try the 6th-consecutive-day variant (HP A `{{XD6}}` after XD1–XD5) and record.
> Expect: 2 → first POST returns conflicts (no PEP apply), second BOOKED; 3 → 409 `EXTERNAL_BOOKING_HP_ALREADY_BOOKED` (`ExternalWorkforceBookingService.java:356-375`); 4 → 409 `externalAvailabilityNotBookable` (lead time, `ExternalWorkforceAvailabilitiesService.java:161-172`); PEP and received bookings only for the successful bookings. If neither variant yields a conflict → BLOCKED-data "box has no rest-time / consecutive-day rule" (not FAIL).
> Oracle: responses (conflict list, error codes); received-bookings; DB planning rows.
> Evidence: 02-conflicts.png, conflict-post-1.json, conflict-post-2.json, already-booked.json, lead-time.json.
> Source: 14548467779#4; POMA-BADI-06; gap G-13.

### PTN-15 External-pool bookings tab and cancellation paths (planner, partner, double cancel, deadline)

> Data prerequisite: PTN-13/14 bookings; one extra availability + booking with a long cancellation lead time: HP A `{{XD8}}` EARLY with Policies cancellation lead `PT720H` (booked in step 1).
> Steps: 1. Simulator: add HP A `{{XD8}}` EARLY cancellation lead PT720H → BADI book it. 2. `{{POMA}}/shift-planner/manage-shift-bookings/external-pool` as `SPX` (tab "Externer Pool"): list with status chips, filters, default order; capture `GET …/external-providers/transactions`. 3. Cancel the `{{XD1}}` booking (confirmation) → status CANCELLED; capture `DELETE {{API}}/api/private/external-providers/{providerCode}/transactions/{id}`. 4. Cancel it again via the API → error. 5. Simulator → "Received from POLYPOINT" → `{{XD2}}` row → "Cancel as partner". 6. Planner list: XD2 CANCELLED (cancelled by the partner). 7. Cancel `{{XD8}}` → refused. 8. ext-planning.sql DB rows for XD1, XD2, XD8; gwmock.mjs received bookings for XD1/XD2.
> Expect: 3 → CANCELLED, PEP planning of XD1 deleted, received booking `CANCELLED_BY_POLYPOINT`; 4 → `EXTERNAL_WORKFORCE_TRANSACTION_ALREADY_CANCELLED`; 5/6 → CANCELLED, PEP XD2 deleted, no provider call; 7 → 409 `bookingNotCancellable` with the deadline, booking stays BOOKED and PEP XD8 remains (`ExternalWorkforceBookingService.java:600-640`).
> Oracle: transactions JSON (status per id, `allowed_actions`), cancel responses, received bookings, DB rows.
> Evidence: 02-external-pool-tab.png, transactions-_.json, cancel-xd1.json, cancel-again.json, 05-partner-cancel.png, cancel-xd8.json, oracle-ext-planning-_.txt.
> Source: 14548467779#6; POMA-BOOK-04, POMA-BOOK-05, POMA-EXTWF-04; PPCLOUD-14041, -14219, -12478; gap G-15, G-16.

### PTN-16 "Externer Anbieter" tab: list, columns, sort, synchronised toggle, paging, permission

> Data prerequisite: ≥ 11 external booking records for `{{TENANT}}` (P-PTN-8: pushed with a BOOKING_PARTNER client through `POST {{API}}/api/booking-partner/v1/external-bookings/bulk`; if no such client exists on CT → BLOCKED-data); `SPX` with 1062, `SPN` without.
> Steps: 1. `{{POMA}}/shift-planner/manage-shift-bookings/external-bookings` as `SPX` → tab "Externer Anbieter"; capture `GET {{API}}/api/private/external-bookings?page-size=10&current-page=0&state=UNSYNCED…`. 2. Columns (creation date, date, location, health professional, pool, information; no sync column outside PEP); sort by two columns (heart icons) → request params `sort-by`, `sort-direction`. 3. Tick "Zeige bereits synchronisierte Buchungen" → request `state` changes, synced rows appear. 4. Paging: page 2, page size change. 5. As `SPN`: the tab is absent; then open `{{POMA}}/external-bookings/manage-shift-bookings` directly and call `GET {{API}}/api/private/external-bookings` with `SPN`'s token.
> Expect: 1–4 as described (sorting exists, unlike the Confluence page); 5 → tab hidden for `SPN`, but the direct route renders the list and the API answers 200 = KNOWN-FAIL PF-4 (intended: denied).
> Oracle: list XHRs (params, `total`, `state`), DOM columns, status for `SPN`.
> Evidence: 01-tab.png, list-\*.json, 05-spn-direct.png, spn-api.json.
> Source: 13224148994#0–#3; POMA-BOOK-06, POMA-PARTNER-05; booking G-FH-5 / pool-sp G-22; PF-4.

### PTN-21 Partner session negatives (API level, no link side effects)

> Data prerequisite: none (read-only towards links: an unlinked challenge never creates a link without a login).
> Steps: partner-api.mjs raw calls to `POST {{PIDL}}/api/auth/partner-sessions` with body `{partner_id, code_challenge, customer_id, tenant_id}`: (a) `partner_id = does-not-exist-<tag>`; (b) `partner_id = partner-embedding-mock`, `tenant_id = {{TENANT}}` (not granted UI_EMBEDDING); (c) missing `code_challenge`.
> Expect: (a) 404 (`NoPartnerFoundException`); (b) 403 (`InsufficientPermissionsException`); (c) 400.
> Oracle: status codes and error names.
> Evidence: partner-sessions-neg.json.
> Source: PID-API-04 (`PIDL/rest/AuthApi.java:340-366`, `PartnerSessionService.java:100-127`); gap G-23.

### PTN-20 Provider error strategies for booking and cancellation (CT-wide exclusive window)

> Data prerequisite: window S-CT-GWMOCK active (steward, user OK, announced to all CT teams) and the lock `locks/ct~gwmock` held; HP C availabilities `{{XD9}}` EARLY and `{{XD10}}` EARLY (GLN `{{GLN}}`); one BOOKED transaction to cancel (`{{XD3}}` from PTN-13).
> Steps: 1. `gwmock.mjs strategy get` (record); `gwmock.mjs strategy set booking CONFLICT --lock <version> --window S-CT-GWMOCK` (the simulator's "Partner behaviour" selectors only display the value). 2. BADI: book HP C `{{XD9}}` → dialog "Buchung abgelehnt" ("Die Buchung wurde vom Personalverleiher abgelehnt.", reason shown). 3. `strategy set booking GENERIC_ERROR`, book `{{XD10}}` → same dialog family; then HTTP_500 → error dialog. 4. `strategy set booking SUCCESS`. 5. `strategy set cancel DEADLINE_PASSED`; cancel `{{XD3}}` in the external-pool tab → dialog "Partner nicht informiert". 6. `strategy set cancel SUCCESS`; `strategy get` reads SUCCESS / SUCCESS. 7. Delete the lock `locks/ct~gwmock`.
> Expect: 2/3 → no transaction recorded, no PEP planning, availability still bookable (nothing to compensate, fact 10); received bookings show `REJECTED_CONFLICT` / `REJECTED_GENERIC_ERROR` / `FAILED_HTTP_500`; 5 → transaction `CANCELLED_PROVIDER_NOT_NOTIFIED`, PEP XD3 deleted, received booking shows the refused cancellation (`lastCancellationRefusal = DEADLINE_PASSED`) and stays "Booked" on the partner side; 6 strategies restored.
> Oracle: booking/cancel responses, transactions JSON, received-bookings JSON, DB rows, strategy GETs before/after.
> Evidence: 02-rejected.png, 05-not-notified.png, strategies-before.json, strategies-after.json, received-bookings.json, transactions.json.
> Source: POMA-PSIM-02, POMA-BOOK-05, POMA-BADI-06; PPCLOUD-14206, -14041; gap G-14, G-15.
