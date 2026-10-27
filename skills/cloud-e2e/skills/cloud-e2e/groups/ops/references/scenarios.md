# Group ops — scenario catalogue (OPS, 25 scenarios)

Converted from `areas/portal-ops/scenarios.md` (A-portal-ops, 2026-10-23; code base cloud master 89d7e960e0) with the S1 reconciliations of 2026-10-23:

- environments: the **CT portal (stage-wide)** for OPS-02..06 (throw-away organisation) and OPS-16 (Monitor), the DeployMate tenant **DM-Y** (shared with utr, planner, auth) for the rest;
- the tenant admin `TA` is the steward's kit actor (`E2E:TA`), borrowed read-only; `CPU` is a seed login of DM-Y (Geburtshilfe, shared Gruppe with planner G-B);
- windows are the env-plan ones: **W-Y-HEALTH** (OPS-08 part B, FLAG, family X08), **W-Y-MSG** (OPS-13 part B, HARD, shared with auth and manual AUT-19; the **steward** switches Send Messages, the worker only reads it — family X13 in two parts), **J-Y-JOBS + S-CT-JOBS** (OPS-18, family X18), **S-CT-LOGLEVEL** (OPS-16, family X16), **T-Y-TENANTFORM** (OPS-19 step 4, family X19); OPS-09 holds the PEP lock of DM-Y;
- run-unique names use the run tag `<tag>` (`{{RUN_TAG}}` in the briefs, 8 lowercase characters, e.g. MMDDHHmm) instead of the area's `{{RUN}}`;
- harness names: `portal-ops.mjs` (H-OPS-1; commands `flag read|set|delete`, `tenant read`, `job list|run`, `health`, `audit`; script mode with `section`, `select`, `pods`, `actuator`, `metricSum`, `routeAbort`; `--base poma-ops` for POMA ops), `app.mjs --app customer-portal|mypp` for CPU (was `polyid-flow.mjs --app portal` / `mypp.mjs`);
- OPS-23 part A (the committed Config Generator Playwright suite) is run by the operator in their own terminal with their own ops credentials, from a read-only `git archive` copy of master; the worker reads the report. Part B is attended (master password typed by the operator);
- OPS-22 stays BLOCKED until single-role CT ops accounts exist (OQ-25).

Families (worker steps: `../assets/family-briefs/<F>.md`; this file is the reference text): **LIFE** OPS-02..06 · **TEN** OPS-07, 10, 11, 12, 09 · **MON** OPS-01, 15, 17 · **MISC** OPS-14, 20, 21, 22, 24, 25, 23 · window families **X08** OPS-08 · **X13** OPS-13 (parts 1/2) · **X16** OPS-16 · **X18** OPS-18 · **X19** OPS-19. Data, job allow-list and concurrency: `data-plan.md`. Known defects and suspicions: `known-deviations.md` (OPS-K1, OPS-S1..S8 = area S1..S8). Dashboard rows: `../assets/scenarios.json`.

## Conventions used by every scenario

- **Environments.** CT portal: PolyPortal ops `{{PORTAL_HOST}}/ops/` (`https://ct-portal-webapp.dev.k8s.polypoint-dev.com`), portal-api `{{PORTAL_API}}` (`https://ct-portal-api.dev.k8s.polypoint-dev.com`); event-handler host from `api-index.jsonl`. DeployMate tenant `{{TENANT}}` in organisation `{{PORTAL_ORG}}` (`deploymate-<uuid>`). Throw-away organisation `e2e-ops-<tag>` with T1 `e2e-ops-<tag>-test`, T2 `e2e-ops-<tag>-prod`, created by OPS-02..04 and **always** removed by OPS-06. Never touch an organisation or tenant this run did not create (other than `{{TENANT}}` read-mostly as stated).
- **Actors.** `OPS` = the runner's PolyPortal ops session (ADMIN, profile `{{PORTAL_PROFILE}}`, headed sign-in ≈ 1.5 h). `OPS-POMA` = the runner's POMA ops session. `CPU` = seed login of `{{TENANT}}` reserved for this group. `TA` = steward kit tenant admin, read-only. `OPS-SUP`, `OPS-OPR`, `OPS-EMP`, `OPS-DA` = optional single-role CT ops accounts (OPS-22).
- **Oracles** (screenshots are evidence, never the oracle): portal admin API (`/dashboard/organizations`, `/health?tenantIds=`, `/tenants/<id>[/services|/ips|/license[/history]]`, `/features/tenants/<id>`, `/versions/tenants`, `/logfiles/<id>`), the admin audit log (API only: `/audit-logs?tenant=&target-type=&action=`), the customer-portal API, actuator through the Monitor proxy, event-handler plugin / metadata endpoints.
- **UI mechanics.** No data-test attributes. Tenant sections are chosen in the **Section** select (deep link `…/ops/organizations/<org>/<tenant>?section=<key>`). Destructive actions use native `prompt()` / `confirm()` / `alert()`; the harness answers from `--dialogs` and logs every text.
- **Hard limits.** No `/test/**` call on any host; no master-flag change except the inert flag of OPS-14 part B (operator OK); no cache clear, key rotation, "Disable incompatible features", "run automated fix", "reconcile enabled_for", "Clean Test Data"; no job outside the allow-list (`data-plan.md` §6); SMS only to the owned sms-logger test number inside W-Y-MSG.
- **Evidence naming.** `NN-<step>.png`, `<endpoint>.json`, `oracle-<what>.json`, `notes.md`; every non-PASS gets an outlined issue shot (`e2e-lib.mjs issueShot`) or a `jsonShot`.
- **Expected values.** `PASS`, `KNOWN-FAIL OPS-K1` (open defect PPCLOUD-12894 / PPCLOUD-14105) or `SUSPECT-FAIL OPS-S<n>` (code reading); a confirmed suspicion is reported as `KNOWN-FAIL OPS-S<n>`, one that does not reproduce as PASS with "OPS-S<n> not reproduced".
- **Gates** (runner, before the families): OPS-G1 ADMIN session (`/ops/features` not forbidden); OPS-G2 DM-Y tenant facts (cloud connected, Send Messages OFF, ignore list value, bundle 26.99.0, licence, VPN / PING UP); OPS-G3 throw-away names free; OPS-G4 CPU logged in once; OPS-G5 (X13 part 2) owned sms-logger number + live host confirmed.

---

### OPS-02 Create a throw-away organisation (form validation)

> Data prerequisite: OPS-G3 passed. Owns organisation `e2e-ops-<tag>` (until OPS-06).
> Pre: `portal-ops.mjs … ops02.mjs out/OPS-02 --dialogs '[]'`.
> Steps:
>
> 1. `{{PORTAL_HOST}}/ops/organizations` → Organization selector → "Create new" (or `{{PORTAL_HOST}}/ops/create/organization`). Shot of the empty form.
> 2. Fill Organization Name `E2E OPS <tag>`, Customer Number `0x1` → the Create button stays disabled (pattern digits only); record. Clear Customer Number → still disabled (required).
> 3. Customer Number `0` (internal), Abbreviation `E2E` → Create. Expect `alert("Organization Created")` and navigation to `/organizations/e2e-ops-<tag>`.
> 4. `GET /organizations/e2e-ops-<tag>` → id `e2e-ops-<tag>`, `customer_number` `0`, `active` true; record the composed display name.
> 5. Admin audit: `GET /audit-logs?target-type=ORGANIZATION&action=CREATE` (newest first) contains this id, actor = operator.
>    Expect: validation as described; organisation created and audited.
>    Oracle: button disabled state; organisation JSON; audit row.
>    Evidence: 01-form.png, 02-invalid.png, organization.json, audit-org-create.json.
>    Source: 11525521456#1; PORT-ORG-01; PPCLOUD-13831.

### OPS-03 Create-tenant wizard: Test, cloud connected, Smart PEP default (T1)

> Data prerequisite: OPS-02. Owns T1 `e2e-ops-<tag>-test`. Dummy api-gw URL and e-mail domain under the reserved TLD `.invalid` (no real host or mailbox behind them; if PolyID rejects the domain, use `e2e-ops-<tag>.example` and note it).
> Pre: `portal-ops.mjs … ops03.mjs out/OPS-03`.
> Steps:
>
> 1. In `/organizations/e2e-ops-<tag>` press "Create Tenant" → `/create/tenant/e2e-ops-<tag>`.
> 2. "Type of system" = Test → radio "Is this tenant cloud connected?" Yes → "Will the VPN be used with this tenant?" No.
> 3. Read "Should Smart PEP (CPP) be enabled for this tenant?": the **Yes** radio is pre-selected (PPCLOUD-14097). Shot. Leave it.
> 4. Name `e2e-ops-<tag>` (no "test"), email domain `e2e-ops-<tag>.invalid`, Url to API Gateway `https://e2e-ops-<tag>.invalid:8099/pp-api-gateway`.
> 5. "Review Configuration then create" → the dialog table shows id `e2e-ops-<tag>-test`, name `TEST: e2e-ops-<tag>`, e-mail `test.e2e-ops-<tag>.invalid`, Smart PEP yes. Shot → "Confirm Creation".
> 6. Capture `POST /tenants`, `POST /tenants/<id>/services/POMA|PolyId|CPP`, `PUT /tenants/<id>/ips`. Expect navigation to `/organizations/e2e-ops-<tag>/e2e-ops-<tag>-test`. Any `alert('an error occurred while creating tenant')` → record which calls failed (OPS-S6) and continue to OPS-06 cleanup.
> 7. Oracles: `GET /tenants/<T1>` → `cloud_connected` true, `test_tenant` true, `send_messages` false, `state.status` MAINTENANCE with message "Tenant is being created", `enabled_for` = [POMA, PolyId, CPP], `polyid_domain` `test.e2e-ops-<tag>.invalid`; `GET /tenants/<T1>/services` contains POMA, PolyId, CPP; `GET /tenants/<T1>/ips` = one entry `127.0.0.1` "block all vpn connections".
> 8. Tenant Details: Services shows the link icon (exists) for "PolyId (PolyId)", "Workforce Management (POMA)", "Smart PEP (CPP)". Shot.
> 9. Audit: `GET /audit-logs?tenant=<T1>&target-type=TENANT&action=CREATE` → 1 row; also a `TENANT_IP_ACCESS_LIST` row.
>    Expect: as in steps 3–9. Smart PEP default Yes creates the CPP tenant.
>    Oracle: tenant / services / IPs JSON, audit rows, dialog table.
>    Evidence: 03-smartpep-default.png, 05-review.png, tenant.json, services.json, ips.json, audit-\*.json, notes.md (OPS-S6 if seen).
>    Source: 11525521456#2, #3, #4, #6 (wizard), #5 (TPMS → CPP); PORT-TEN-01, PORT-TEN-03, PORT-TEN-04; PPCLOUD-14097; gap G1, G2.

### OPS-04 Wizard variant: Production without cloud connection (T2), duplicate id, security report

> Data prerequisite: OPS-03 done (T1 exists). Owns T2 `e2e-ops-<tag>-prod`. T2 is a non-test PROD tenant for a few minutes; it has no api-gw and no services, so it does not page anyone (its dashboard pill may show UNKNOWN / 0).
> Pre: `portal-ops.mjs … ops04.mjs out/OPS-04`.
> Steps:
>
> 1. Create Tenant → Test → cloud connected No → Name `e2e-ops-<tag>` → Review → expect the inline error "A tenant with id "e2e-ops-<tag>-test" already exists. Choose a different name." (`.id-error`), no dialog. Shot. Press "Reset".
> 2. Create Tenant → Production → cloud connected No (no VPN / Smart PEP questions shown) → Name `e2e-ops-<tag>-prod` → Review: id `e2e-ops-<tag>-prod` (affix **not** doubled), name `PROD: e2e-ops-<tag>-prod` → Confirm Creation.
> 3. `GET /tenants/<T2>`: `cloud_connected` false, `test_tenant` false, `enabled_for` [], no `polyid_domain`; `GET /tenants/<T2>/services` = []; no IP entry was written by the wizard (`GET …/ips` = the backend's allow-all default entry only — record what it returns).
> 4. Section select offers only Tenant Details, On-Prem Installation, Config (PPCLOUD-14103). Shot of the open select.
> 5. Tenant Details: "Delete Tenant" is enabled (no services). Do **not** delete here.
> 6. State select → DISABLED → "save state": expect a refusal alert for a non-test tenant (no "type 'DO IT'" prompt; `tenant-detail.component.ts:369-374`), no `PUT …/state` call, and `GET /tenants/<T2>` state unchanged (MAINTENANCE).
> 7. `/ops/security-report` ("PROD tenants without 2-factor authentication"): T2 is listed with reason `NO_POLYID_PROVIDER`; T1 is not listed (test tenant). "Open tenant" on T2's row opens `/organizations/e2e-ops-<tag>/<T2>?section=…`. Capture the report API.
>    Expect: duplicate rejected client-side; T2 with the listed fields; reduced sections; DISABLED refused; security-report entry.
>    Oracle: `.id-error` text; tenant / services JSON; section list; report JSON entry `{tenant_id: T2, reason: NO_POLYID_PROVIDER}`.
>    Evidence: 01-duplicate.png, 02-review.png, tenant-T2.json, 04-sections.png, 06-disable-refused (alert in notes), security-report.json, 07-report.png.
>    Source: 11525521456#2 (variant); PORT-TEN-01, PORT-TEN-05, PORT-SEC-01; PPCLOUD-10451, 14103; gaps G1, G4, G6.

### OPS-05 Throw-away tenant administration: state, IP list, Send Messages, admin links, delete guards

> Data prerequisite: OPS-03 (T1). Only T1 is changed.
> Pre: `portal-ops.mjs … ops05.mjs out/OPS-05 --dialogs '[{"prompt":"DO IT"}]'`.
> Steps:
>
> 1. T1 Tenant Details: the links "Navigate to PolyId Admin UI", "Navigate to Workforce Management Admin UI", "Navigate to Smart PEP Admin UI" exist; record each `href` (expected `…/ops/providers/<T1>`, `…/ops/tenants/<T1>` on the PolyID-login, POMA webapp and CPP hosts) and request each URL once (status < 500; a login redirect is fine).
> 2. "Delete Tenant" is **disabled** (services exist) and, as ADMIN, "Delete Organization" is **disabled** (organisation has tenants). Shot.
> 3. IP White List: icon button "Add range" → `192.0.2.0/24` (TEST-NET-1) with a description → Save Tenant (the list is saved with the tenant, `PUT /tenants/<T1>/ips`); `GET /tenants/<T1>/ips` contains it; "Delete range" on it → Save Tenant; back to the single `127.0.0.1` entry (PPCLOUD-13115 regression check). Audit rows `TENANT_IP_ACCESS_LIST` UPDATE ×2.
> 4. Toggle "Send Messages" on → Save Tenant → `GET /tenants/<T1>` `send_messages` true → toggle off → Save → false. (T1 has no api-gw, so nothing can be sent.) Audit `TENANT` UPDATE rows.
> 5. State: MAINTENANCE → ACTIVE → "save state" → `state.status` ACTIVE, `last_state_modified_by` = operator; then DISABLED → "save state" → prompt "type 'DO IT'" answered → DISABLED. Optional: POMA ops `…/ops/tenants/<T1>` (POMA webapp host) shows the tenant inactive (only if the operator's session reaches POMA ops; else "not checked").
> 6. Back to ACTIVE (so OPS-06 deletes from a normal state).
>    Expect: links present; guards disabled; IP add/delete round trip; Send Messages persists; state transitions with the typed confirmation.
>    Oracle: hrefs + status codes; button `disabled` attributes; tenant / IPs JSON; audit rows; dialog log.
>    Evidence: 01-links.json, 02-guards.png, ips-_.json, tenant-_.json, audit-\*.json, notes.md.
>    Source: 11525521456#6, #7, #8; PORT-TEN-02, PORT-TEN-04, PORT-TEN-05; PPCLOUD-14026; gaps G3, G4, G5.

### OPS-06 Teardown: delete services, tenants and the throw-away organisation (always run)

> Data prerequisite: whatever OPS-02…OPS-05 created (also after their failure). Runs even when earlier scenarios FAIL or are BLOCKED. Needs ADMIN for the organisation delete.
> Pre: `portal-ops.mjs … ops06.mjs out/OPS-06 --dialogs '[{"prompt":"DELETE"},{"prompt":"DELETE"},{"prompt":"DELETE"}]'`.
> Steps:
>
> 1. List what exists: `GET /organizations/e2e-ops-<tag>/tenants`; for each tenant `GET /tenants/<id>/services`.
> 2. T1: in Services press "Delete" for Smart PEP (CPP), Workforce Management (POMA), PolyId (accept confirmations); after each, the icon turns to "link_off" (missing). `GET /tenants/<T1>/services` = [] → "Delete Tenant" becomes enabled.
> 3. "Delete Tenant" → prompt "type DELETE" → alert `Tenant "<T1>" deleted`. Same for T2 (no services).
> 4. "Delete Organization" (ADMIN) → enabled now → prompt "type DELETE" → alert `Organization "e2e-ops-<tag>" deleted`.
> 5. Oracles: `GET /tenants/<T1>` and `<T2>` → 404; `GET /organizations/e2e-ops-<tag>` → 404; audit rows `TENANT` DELETE ×2 and `ORGANIZATION` DELETE; customer-visible residue: none of the ids appears in `GET /dashboard/organizations`.
> 6. If any service delete fails (e.g. PolyID, past bug PPCLOUD-12903) → FAIL with the response, then report the leftover ids to the runner (never any test-data fallback).
>    Expect: complete removal and audit trail.
>    Oracle: 404s, empty services, audit rows, dashboard list.
>    Evidence: services-before.json, 02-missing.png, alerts in notes.md, audit-delete.json, leftovers.json (empty on PASS).
>    Source: 11525521456#9, #10, #11; PORT-TEN-07, PORT-ORG-01; PPCLOUD-12903; gap G2.

### OPS-07 DeployMate tenant: Monitoring section, certificates, versions, uptime, metrics, installation reports

> Data prerequisite: OPS-G2. Read-only except "Update Version Matrix" (a version re-scrape of `{{TENANT}}` only).
> Pre: `portal-ops.mjs … ops07.mjs out/OPS-07`.
> Steps:
>
> 1. `{{PORTAL_HOST}}/ops/organizations/{{PORTAL_ORG}}/{{TENANT}}?section=monitoring`. The status badge next to the tenant name (UP/WARN/DOWN) equals the worst non-skipped component of `GET /health?tenantIds={{TENANT}}`.
> 2. Tenant status dashboard: one row per report (vpn, ping, health, deephealthcheck, ratelimiter …) with the same status as the health map.
> 3. On-prem services status: each tile UP/DOWN; the list equals `GET /tenants/{{TENANT}}/on-prem/services` minus the ignore list (poly-time-connect absent, see OPS-08).
> 4. Certificates: at least the Keycloak certificate with an expiry date; compare with `GET …/keycloak/certificates` (captured).
> 5. Versions: "P2" and "Release Bundle" (expect `26.99.0`) equal `GET /versions/tenants` entry of `{{TENANT}}`; press "Update Version Matrix" → `alert("Version matrix updated…")`; `PUT /versions/tenants/{{TENANT}}` 2xx; the entry's `last_update` is newer than before.
> 6. Tab Uptime: Time Range "Last hour" default; switch to "Last 3 hours"; the captured `POST /monitor/graphql` request carries the new range and the response has points; toggle "Ping" on → its line appears. Shot.
> 7. Tab Metrics: Service = the first on-prem service (e.g. `api-pp-personnel-planning`), Metric `http.server.requests`, Displayed Statistics "TOTAL_TIME" (or the first offered) → one chart per instance within 30 s. Shot.
> 8. Section "On-Prem Installation": record whether reports exist (reported vs expected servers) or the empty state. Either is PASS; note which (DeployMate installer reporting is unknown).
> 9. Cross-check: the DeployMate tenant health recorded by the runner in `env-facts.md` (vpn / ping / health / deephealthcheck) agrees with step 2.
>    Expect: monitoring data consistent across UI, portal API and DeployMate; version reload works.
>    Oracle: health map vs badge/rows; services list; versions JSON `last_update` before/after; GraphQL request/response.
>    Evidence: 01-monitoring.png, health.json, services.json, certificates.json, versions-before/after.json, graphql-\*.json, 06-uptime.png, 07-metrics.png, 08-installation.png.
>    Source: 11524833388#1, #6, #7; PORT-TMON-01, PORT-PMON-01, PORT-VER-01 (reload), PORT-INST-01; gaps G8, G10, G35.

### OPS-10 Api Gateway section: actuator viewer and VPN stats

> Data prerequisite: OPS-G2. Read-only (GET only).
> Pre: `portal-ops.mjs … ops10.mjs out/OPS-10`.
> Steps:
>
> 1. `?section=api-gateway`: heading "Actuator for {{TENANT}}". "Select Service" = "Api Gateway" (default), "Select Endpoint" = `health` → one text area per instance with JSON (`status` present). Then Service = `api-pp-personnel-planning` (or the first listed), Endpoint `info` → JSON per instance.
> 2. Never choose `env`, `configprops`, `heapdump`, `loggers` writes or any non-GET action; the harness refuses to store such bodies.
> 3. Toggle "On-prem / Cloud" once each: the VPN viewer reloads (captured call 2xx).
> 4. If a requests table / connection-errors table is rendered, record its row count; no 503 dialog appears when tenant-access answers 503 (PPCLOUD-14475) — record any dialog text.
>    Expect: actuator data for api-gw and one on-prem service; VPN stats load.
>    Oracle: captured `/tenants/{{TENANT}}/actuator…` responses (status, JSON keys only).
>    Evidence: 01-health.png, actuator-\*.json (keys only), notes.md.
>    Source: 11524833388#8; PORT-APIGW-01, PORT-MON-03.

### OPS-11 Logs and Data Exports: on-prem service log, P2 log, optional PEP config export

> Data prerequisite: OPS-G2; for part C the operator types a PEP database login into the headed dialog (never stored). Log requests run on the box (api-gw uploads the file to portal storage).
> Pre: `portal-ops.mjs … ops11.mjs out/OPS-11` (headed for part C only).
> Steps:
>
> 1. `?section=data-exports` "Data Exports for {{TENANT}}": rows `<service> logs` for each on-prem service plus `p2 logs`, and "PEP config export" (bundle 26.99 ≥ 26.0.0). Capture `GET /logfiles/{{TENANT}}`.
> 2. Part A: row `api-gateway logs` (or the first service row) → "Request" → chip PREPARING → refresh icon until READY (timeout 5 min) or FAILED. READY → "View" opens the viewer (record line count only) → "Download" saves the file (record size, then delete the local file).
> 3. Part B: row `p2 logs` → "Request" → dialog with Format and Date range (today) → Request → READY → View opens the "P2 Logs" table dialog (record row count) → OK.
> 4. Cancel path: request one more service log and press "Cancel" while PREPARING → state back to IDLE/FAILED (record).
> 5. Part C (optional): "PEP config export" → Request → dialog Database username / password / Max cache age → operator fills in the headed window → PREPARING → READY → Download (size only). Without an operator login: BLOCKED "no PEP DB login" (not FAIL).
>    Expect: each export reaches READY and its file is non-empty; cancel works.
>    Oracle: `/logfiles/{{TENANT}}` status JSON per service; file sizes; dialog row counts.
>    Evidence: 01-exports.png, logfiles-\*.json, sizes in notes.md.
>    Source: 11524833388#9; PORT-EXP-01, PORT-EXP-02; PR 13133; gaps G13, G14.

### OPS-12 Diagnostics: typical checks, employee checks, E2E events, long-running list, outage debugger

> Data prerequisite: OPS-G2; one seed login of `{{TENANT}}` (`CPU`) for the employee check. Read / trigger only; never "run automated fix", never start or reset a long-running validator.
> Pre: `portal-ops.mjs … ops12.mjs out/OPS-12`.
> Steps:
>
> 1. `?section=diagnostics` → Validation "Check Typical configuration mistakes" → component list and report load (capture `…/diagnostics/components`, `…/validation-report`); record the number of findings per component. Do not press any fix button.
> 2. "Employee configuration checks" → search the on-prem user by `CPU`'s username → one hit → validate → report loads (`…/diagnostics/user-report/<subject>`); record errors / warnings count.
> 3. "E2E Events Validation" → trigger → results appear (`GET /api/v1/event-test?tenant-id={{TENANT}}` or the captured equivalent) with per-event outcome; record pass/fail per event.
> 4. "Long Running Checks" → list loads (names + status); nothing started.
> 5. "Debug on-prem crash / outage" → search the last 24 h → records list (may be empty) loads without error.
> 6. "Test Send Messages" is covered by OPS-13.
>    Expect: every panel loads from the live api-gw; the E2E events flow completes.
>    Oracle: captured diagnostics JSON (counts), event-test result JSON.
>    Evidence: 01-typical.png, diagnostics-\*.json, event-test.json, notes.md.
>    Source: 11524833388 (new Part 5 proposal); PORT-DIAG-01, -02, -03, -05; PPCLOUD-13594; gap G12.

### OPS-09 Licence: view, history and unchanged save (View / Update On-prem license)

> Data prerequisite: OPS-G1 (ADMIN) + OPS-G2 (licence present). **Writes the on-prem licence of the DeployMate box with identical content**; exclusive with any PEP-driving worker on the box (take the PEP lock although no PEP step is done — the licence is read by PEP).
> Pre: `portal-ops.mjs … ops09.mjs out/OPS-09`.
> Steps:
>
> 1. `?section=license`: Customer Type (Medical / Other) and the Applications table (each row: title, "Limit: …", "KEYID: …"; rows with key data expand on click). Capture `GET /tenants/{{TENANT}}/license` and `…/license/history`. Shot.
> 2. Compare the UI rows with the API applications (count, titles, key ids). Optional box oracle: read-only `SELECT COUNT(*) FROM ECBERN.SCHLUESSEL` via `sql.sh` equals the number of licensed applications (record if the mapping is not 1:1).
> 3. "License information" text area = the API `raw_xml` (compare hash only; do not store the XML).
> 4. Version select: "Current from On-prem" + n history entries (n may be 0 on a fresh box).
> 5. Save (ADMIN) without editing → `alert("License updated successfully")`; `PUT …/license` 2xx; history length = min(n+1, 10); audit `TENANT_LICENSE` UPDATE row (details "License XML pushed to the on-prem API gateway…").
> 6. Select the new "V.<n+1>" entry → XML hash equals step 3; select "Current from On-prem" again → same hash; `GET …/license` unchanged.
>    Expect: licence readable and consistent; an unchanged save is a no-op on content and leaves history + audit.
>    Oracle: API JSON (applications, hashes), history length, audit row, optional SQL count.
>    Evidence: 01-license.png, license.json (raw XML replaced by its SHA-256), history-before/after.json, audit-license.json, notes.md.
>    Source: 11524833388#2, #3, #4, #5; 11524866122#1, #2, #3; 11524767882 (empty page); PORT-LIC-01; PPCLOUD-11097, 14467; gap G15.

### OPS-01 Ops dashboard: organisation health cards and organisation detail

> Data prerequisite: none beyond OPS-G1 (CT portal, stage-wide, read-only). `{{TENANT}}`'s organisation card is the controlled sample.
> Pre: `portal-ops.mjs {{PORTAL_PROFILE}} ops01.mjs out/OPS-01`.
> Steps:
>
> 1. Open `{{PORTAL_HOST}}/ops/dashboard`; start a timer at navigation; stop when the first organisation card (`.card` with `.card-status-header`) is visible. Shot.
> 2. Capture `GET /dashboard/organizations` and the `GET /health?tenantIds=…` calls the page makes.
> 3. Count cards and compare with the organisations returned; for every card read the header class `status-<X>` and the tenant pills (`.tenant-status-pill.status-DOWN|WARN|PRE_PROD_DOWN|UP|UNKNOWN`).
> 4. Find the card of `{{PORTAL_ORG}}` (name as in `GET /organizations/{{PORTAL_ORG}}`). Its UP/DOWN pill counts must match the statuses of its tenants in the captured health map (a tenant is DOWN if any component is DOWN).
> 5. Use the filters (tenant type PROD / TEST, status) once each; record the card count change.
> 6. Click the `{{PORTAL_ORG}}` card → `/dashboard/{{PORTAL_ORG}}`: the tenant list shows `{{TENANT}}` with per-component status; clicking it opens `/organizations/{{PORTAL_ORG}}/{{TENANT}}`.
> 7. Public probes (no token): `GET {{PORTAL_API}}/api/v1/version` and `/api/v1/server/time` → 200.
>    Expect: first card ≤ 10 s; cards = organisations; every card has a status class; `{{PORTAL_ORG}}` pills consistent with the health map; detail and deep link work.
>    Oracle: card count vs `dashboard/organizations` length; pill counts vs `health` map; load time.
>    Evidence: 01-dashboard.png, dashboard-organizations.json, health-\*.json, 06-org-detail.png, timing in notes.md.
>    Source: 11526275073#1; PORT-DASH-01, PORT-PUB-01 (G38).

### OPS-15 Versions page, version matrix, bundle compare, tenant analytics (read)

> Data prerequisite: OPS-G1. Read-only (the reload of `{{TENANT}}` is in OPS-07).
> Pre: `portal-ops.mjs … ops15.mjs out/OPS-15`.
> Steps:
>
> 1. `/ops/versions` tab "Tenant Versions": a row for `{{TENANT}}` with bundle `26.99.0` and P2 version; equals `GET /versions/tenants`.
> 2. "Show bundle details" on that row → dialog with application versions (`application_versions_list`); close.
> 3. Select two rows (`{{TENANT}}` and any other) → "Compare" → comparison dialog renders.
> 4. Tab "Version Matrix" loads (`GET /versions/matrix`), ≥ 1 bundle row.
> 5. `/ops/tenant-analytics`: summary and browse tabs render; a filter chip on "bundle 26.99.0" narrows the browse list to include `{{TENANT}}`. Do **not** press "reconcile enabled_for".
>    Expect: pages load; data consistent with the API.
>    Oracle: versions JSON vs table; matrix JSON; analytics list contains `{{TENANT}}`.
>    Evidence: 01-versions.png, versions.json, matrix.json, 05-analytics.png.
>    Source: gaps G10, G11; PORT-VER-01, PORT-ANA-01; PPCLOUD-13927.

### OPS-17 Tenant access page and uptime dialog

> Data prerequisite: OPS-G1/G2. Read-only.
> Pre: `portal-ops.mjs … ops17.mjs out/OPS-17`.
> Steps:
>
> 1. `/ops/tenant-access` "VPN Endpoints": tabs "Default VPN Endpoints" and "Tenant Specific VPN Endpoints" render tables.
> 2. In the tab that lists `{{TENANT}}`, press "expand row" on its endpoint → tenant rows; on `{{TENANT}}` press "Show Uptime Graph" → dialog titled `{{TENANT}}` with a table "Health %, Deephealthcheck %, Vpn %, Ping %, Ratelimiter %".
> 3. Time Range "Last 3 hours" → the displayed range text changes and a new `POST /monitor/graphql` is captured with the new bounds; toggle "Ping" → a Ping line appears. Close.
> 4. "Open tenant details page" on the same row → `/organizations/{{PORTAL_ORG}}/{{TENANT}}…`.
>    Expect: page, dialog and graph react as described; uptime % values in 0–100.
>    Oracle: GraphQL request bounds and response points; dialog values range.
>    Evidence: 01-tabs.png, 02-dialog.png, graphql-\*.json.
>    Source: 11525914644#6; PORT-TACC-01, PORT-PMON-01; gap G8.

### OPS-14 Feature flags: tenant override round trip, master page, optional inert master flag

> Data prerequisite: OPS-G1/G2. Part A touches one tenant override on `{{TENANT}}`: `general.logs.skip` (skips log writing; no functional effect for other areas). Part B (optional) creates and deletes one inert master flag `e2e.ops.f<tag>` on CT (stage-wide, no consumer) — run only with the operator's OK.
> Pre: `portal-ops.mjs … ops14.mjs out/OPS-14`; `portal-ops.mjs flag read|set|delete`.
> Steps (part A):
>
> 1. `?section=features`: groups per app (POLYID, POMA, PORTAL, GENERAL …) with rows; no warning icon for any flag (bundle 26.99 ≥ every `dependency`); the button "Disable incompatible features" exists — **do not press it**.
> 2. `GET /features/tenants/{{TENANT}}` → record `general.logs.skip` (value, master, tenant override present?).
> 3. `portal-ops.mjs … "flag set {{TENANT}} general.logs.skip true"` → `PUT /features/tenants/{{TENANT}}?code=general.logs.skip&value=true` 2xx; read → value true; audit `TENANT_FEATURE` UPDATE row.
> 4. `portal-ops.mjs … flag delete` → override removed; read → master value again; audit row.
> 5. `/ops/features` (ADMIN): headings "Master features (affect all Tenants)" and "Features per Tenant (only set default values)" load; count of master rows = `GET /features/master` length. No edit.
>    Steps (part B, optional):
> 6. On `/ops/features` create feature `e2e.ops.f<tag>`, type STRING, value `x`, description "e2e inert flag" → saved; it appears in `{{TENANT}}`'s Features section; audit `MASTER_FEATURE` CREATE.
> 7. Delete it (confirm "Are you sure you want to delete this feature …") → gone from both pages; audit `MASTER_FEATURE` DELETE.
>    Expect: override set / delete round trip with audit; master page lists all; inert flag lifecycle.
>    Oracle: features JSON before/after, audit rows.
>    Evidence: 01-features.png, features-_.json, flag/ logs, audit-_.json.
>    Source: 11526307843#1, #2, #3; PORT-FEAT-01, PORT-FEAT-02; PPCLOUD-14517; `FeatureAdminAPIScenarioTest` empty.

### OPS-20 Customer portal: anonymous health, tenant view, details, languages, browsers

> Data prerequisite: `CPU` (seed login of `{{TENANT}}`, HP role). Read-only. Expected known defect: system titles not translated in fr/it/nl.
> Pre: anonymous: plain Playwright context per browser (`--browser chromium`, then `firefox`, `webkit`); logged in: `app.mjs {{TENANT}} <CPU> ops20.mjs out/OPS-20 --app customer-portal`.
> Steps:
>
> 1. Anonymous `{{PORTAL_HOST}}/portal/health` (no login): sections for the cloud systems PolyID, POMA, Shared services, TPMS with a health colour; no Incidents / Certificates sections; header link "Login" (`MENU_OPTIONS.LOGIN`). Capture `GET …/systems/reports/health` (200 without token).
> 2. Click each row → `/portal/health-details/<systemId>/<subSystemId>` loads (sub-system components with status); back. Record any row that fails.
> 3. Repeat steps 1–2 in firefox and webkit (cross-browser substitute for the manual Safari / Firefox / Edge cells).
> 4. Logged in as `CPU`: the on-prem system of `{{TENANT}}` appears (infrastructure + Java services from the 24.x report), plus the tables "Incidents" and "Certificates"; no "User management" entry (not a tenant admin). Record poly-time-connect's status (OPS-S2, see OPS-08).
> 5. Open "Incidents" "show more" → `/portal/incidents` loads; open one incident (if any) → detail; reload the detail URL → record that the page is empty (known PORT-CUST-03 behaviour). Open a certificate → `/portal/certificate-details`.
> 6. Language selector: en → de → fr → it → nl. Per language record the frontend title (`header-container-title`) and the section titles from the health API (`name` maps): de/en translated; fr/it/nl section titles stay English → KNOWN-FAIL PPCLOUD-12894 / PPCLOUD-14105 (Transifex), not a new finding.
> 7. Logout via the user menu → `/portal/logged-out` (or back to anonymous health).
>    Expect: anonymous and tenant views as described in all three engines; languages as known.
>    Oracle: health API JSON (systems, statuses, `name` per language), page states, per-browser result table.
>    Evidence: 01-anon-<browser>.png, health-anon.json, 04-tenant.png, health-tenant.json, i18n-<lang>.json, notes.md.
>    Source: 12764839945#1–#5; PORT-CUST-01…04, PORT-CUST-06; PPCLOUD-12894, 14105, 12047; OPS-S2; gaps G9, G28.

### OPS-21 Incidents: ops lifecycle, duplicate suppression, ignore rule, customer view

> Data prerequisite: OPS-G1; `CPU` (or `TA`, read-only) for the customer view. Incidents are written to `{{TENANT}}` with type `E2E_OPS_TEST` and descriptions starting with `E2E-OPS-<tag>` so area auth's incident checks (type `SUPPORT_USER_IMPERSONATION`, lockout, 2FA) are unaffected. The ignore rule is **tenant-scoped** (`tenant_id={{TENANT}}`) with a pattern that matches only `E2E-OPS-<tag>-IGN.*`; never leave the editor's tenant field empty ("empty applies to all").
> Pre: `portal-ops.mjs … ops21.mjs out/OPS-21`.
> Steps:
>
> 1. Seed: `api.call('POST', '/api/v1/incidents', {tenant_id:'{{TENANT}}', type:'E2E_OPS_TEST', severity:'INFO', description:'E2E-OPS-<tag>-A'})` with the ops bearer (portal-core allows support/ops/admin, `CORE/service/IncidentService.java:48-50`; if portal-api refuses with 403, record and continue with an impersonation incident of area auth AUT-17 as the subject, read-only).
> 2. POST the same body again → `GET /api/v1/incidents?…` shows **one** OPEN `E2E-OPS-<tag>-A` (duplicate suppression).
> 3. `/ops/incidents`: the card shows tenant, type, severity INFO, description. "Acknowledge" → state ACKNOWLEDGED (`PUT /api/v1/incidents/<id>/state/ACKNOWLEDGED`); customer portal (`CPU`) Incidents table shows it with that state.
> 4. "Resolve" → RESOLVED; it leaves the open list and appears in "Past incidents" (dialog "Past Incidents"); "Reopen" there → OPEN; resolve again.
> 5. Ignore rule (the editor only accepts a regex that matches the description of the incident it was opened from): POST an incident `E2E-OPS-<tag>-IGN-0` → on its card press "Ignore" → the form is pre-filled with Tenant `{{TENANT}}` and pattern `^E2E-OPS-<tag>-IGN-0$` → change the pattern to `^E2E-OPS-<tag>-IGN.*$` (keep the tenant!) → "Create" (`POST /admin/incidents/ignored`). POST `E2E-OPS-<tag>-IGN-1` → 2xx but no incident appears (dropped, OPS-S8: no record of the drop). POST `E2E-OPS-<tag>-B` → appears (rule is narrow). "Show Ignores" → delete the rule; resolve `-IGN-0` and `-B`.
> 6. Customer portal: `CPU` sees `-A`/`-B` with their states; no resolve button for tenant users (area auth S10).
> 7. Cleanup: every `E2E-OPS-<tag>-*` incident RESOLVED; `GET /admin/incidents/ignored` has no rule with this pattern.
>    Expect: lifecycle OPEN → ACKNOWLEDGED → RESOLVED → OPEN → RESOLVED; duplicates suppressed; ignore rule drops only its pattern.
>    Oracle: incidents API JSON per step; ignored-rules list; customer-portal incidents JSON.
>    Evidence: incidents-_.json, 03-card.png, 04-history.png, ignored-_.json, cp-incidents.json.
>    Source: 12764839945#3, #4 (incidents); PORT-INC-01, -02, PORT-CUST-03; OPS-S8; gap G19.

### OPS-22 Ops role matrix: route guards, hidden buttons, backend writes per role

> Data prerequisite: CT ops accounts `OPS-SUP`, `OPS-OPR`, `OPS-EMP`, `OPS-DA` (one role each; open question, data-plan §8). Without them the scenario is BLOCKED "no single-role ops accounts" (ADMIN-only coverage exists through the other scenarios). Each account signs in headed once into its own profile.
> Pre: `portal-ops.mjs <profile-of-role> ops22.mjs out/OPS-22/<role>`.
> Steps:
>
> 1. Per role open the routes `/dashboard`, `/organizations`, `/security-report`, `/incidents`, `/partners`, `/monitor`, `/versions`, `/tenant-analytics`, `/tenant-access`, `/support-token`, `/recording`, `/config-generator`, `/audit-log`, `/data-plugins`, `/features`, `/vault`, `/rotate-key`; record landing path (allowed or `/forbidden?location=…`). Expected matrix: `code/portal-polyid-features.md` §1.1 guard table (e.g. SUPPORT forbidden on `/config-generator`, `/features`; DATA_ANALYST-only lands on `/data-plugins`).
> 2. On `{{TENANT}}` Tenant Details per role: visibility of "Create Tenant", "Save Tenant", "Delete Tenant", "Delete Organization" (OPS-OPR: Create/Delete Tenant yes, Delete Organization no; OPS-SUP: none of them except Save; OPS-EMP: Save shown).
> 3. Backend probes with each role's bearer on `{{TENANT}}` (harmless writes, immediately reverted): `PUT /features/tenants/{{TENANT}}?code=general.logs.skip&value=true` then `DELETE …?code=general.logs.skip`. Record status per role. Product intent: SUPPORT and POLYPOINT_EMPLOYEE refused. Code: SUPPORT accepted (OPS-S3), POLYPOINT_EMPLOYEE 403.
> 4. OPS-EMP: "Save Tenant" without changes → expect 403 (button shown although the backend refuses).
>    Expect: guard matrix as in code; write results per role recorded (OPS-S3).
>    Oracle: landing paths; button presence; HTTP statuses; features JSON back to baseline.
>    Evidence: routes-<role>.json, buttons-<role>.png, writes-<role>.json, notes.md.
>    Source: PORT-AUTH-01; OPS-S3; gap G27 (area auth hands portal-ops login and guards to this area).

### OPS-24 POMA ops: read smoke and the single-tenant cache-reset scope (intercepted)

> Data prerequisite: the operator's POMA ops session (`https://ct-poma-webapp.dev.k8s.polypoint-dev.com/ops/`, roles ADMIN / OPERATIONS / SUPPORT; headed login once into its own profile). Read-only; the cache reset request is **aborted in the browser** and never reaches the server.
> Pre: `portal-ops.mjs <poma-ops-profile> ops24.mjs out/OPS-24 --base https://ct-poma-webapp.dev.k8s.polypoint-dev.com/ops/` (same harness, POMA ops host allowed by the host guard).
> Steps:
>
> 1. `/ops/dashboard` loads; `/ops/tenants/{{TENANT}}` tabs Details / Conflict Checker / Availability Sync load; record `active` and the api-gw URL field (do not edit, do not press "sync").
> 2. `/ops/teamroster-metrics` loads (data may be empty on a fresh tenant); `/ops/support-files` list loads (no upload).
> 3. `/ops/cache` (ADMIN): install `page.route('**/admin/tenants/devices/reset-cache**', r => { log(r.request().url()); r.abort(); })`, choose `{{TENANT}}` and press the single-tenant reset, accept the confirmation. Record the intercepted URL: OPS-S4 expects the query parameter `tenantId=` while the API binds `tenant-id` (so the server would reset all tenants). Verify that no request reached the server (route aborted).
>    Expect: pages load; the intercepted request uses `tenant-id` (product intent). Code: SUSPECT-FAIL OPS-S4.
>    Oracle: intercepted request URL; page loads.
>    Evidence: 01-tenant.png, intercepted-url.txt, notes.md.
>    Source: POMA-OPS-01…04, -11, -13, -14; OPS-S4; gap G33.

### OPS-25 Recording of a tenant's HTTP traffic (debugging aid)

> Data prerequisite: OPS-G1; `CPU` for one myPP read. The recording captures the traffic of `{{TENANT}}` from every area running at that moment: store counts and paths only, never bodies.
> Pre: `portal-ops.mjs … ops25.mjs out/OPS-25`; `app.mjs --app mypp {{TENANT}} <CPU> - out/OPS-25/mypp` for the read.
> Steps:
>
> 1. Tenant editor of `{{TENANT}}` → record button ("Record HTTP traffic for this tenant") → `/recording?tenant={{TENANT}}&fromOrg={{PORTAL_ORG}}` → "Start Recording" (`POST …/recording-sessions/{{TENANT}}` 2xx); the live stream (SSE) connects.
> 2. `CPU` opens myPP home and Kalender once.
> 3. Within 1 min the recording lists exchanges from poma-api / poma-core to api-gw for `{{TENANT}}` (filter by service); password-like headers are masked (spot check one exchange's header list).
> 4. "Stop Recording"; the list stays readable; record exchange count per service.
>    Expect: session start / stream / stop; the myPP read is visible as cloud → api-gw exchanges.
>    Oracle: recordings API counts per service; masked header names.
>    Evidence: 01-recording.png, recordings-summary.json (paths + counts), notes.md.
>    Source: PORT-REC-01; gap G25.

### OPS-23 Config Generator: template editor suite and tenant configuration with master password

> Data prerequisite: part A: the existing Playwright suite `polypoint-portal/polypoint-portal-ops-frontend/e2e` (13 template-editor tests that need no master password; they create and delete a throw-away version `99.<MMDD>.<HHmmss>`). Part B: the CT Config Generator master password (secret store; typed by the operator into the headed window only, never given to a worker, never written), first key rotation completed on CT (status read in step 4).
> Pre: part A runner (from `polypoint-portal/polypoint-portal-ops-frontend`, after `npx playwright install chromium` once): `npx playwright test --config=e2e/playwright.config.ts e2e/tests/config-generator/{version-lifecycle,config-keys-editor,template-files,changeset-lifecycle,revert-changeset,concurrent-conflicts,layer-axis,priority-filter,export-import-bundle}.spec.ts` with `E2E_BASE_URL={{PORTAL_HOST}}/ops/` and `E2E_USERNAME` / `E2E_PASSWORD` set by the operator in their own terminal (never in a prompt, never the README defaults); the suite copy comes from a read-only `git archive` of master into a scratch folder (no worktree, no git writes); part B `portal-ops.mjs … ops23.mjs out/OPS-23 --headed`.
> Steps (part A):
>
> 1. Run the 13 ungated tests (version lifecycle, config keys, template files, changesets, revert, concurrent conflicts, layers, priority filter, export/import bundle); collect the HTML report summary (passed / failed / flaky).
> 2. After the run: no `99.*` version created by this run remains in the "POLYPOINT Version" dropdown (suite teardown).
>    Steps (part B):
> 3. `{{TENANT}}` Section "Config": master-password dialog appears; enter a wrong value once → refusal (HTTP 409 with the invalid-password code, `ConfigDataCaller.ADMIN`); then the correct one (operator) → config list loads.
> 4. `/ops/rotate-key` (ADMIN): status page loads; **do not start** a rotation. Record the status.
> 5. New config for `{{TENANT}}` on version 26.99 (or the newest offered) → fill required fields with the defaults → "validate and generate" → ZIP downloaded (size and file list only); the encryption hint shows "encrypted".
> 6. Compare two versions of `{{TENANT}}`'s configs (if two exist) → diff renders.
> 7. Audit: `TENANT_ON_PREM_CONFIG` CREATE row for `{{TENANT}}`.
>    Expect: suite green; master-password gate works; generation produces a non-empty ZIP; audit row.
>    Oracle: Playwright report counts; HTTP status of the wrong-password call; ZIP file list; audit row.
>    Evidence: playwright-summary.json, versions-after.json, 03-mp-error.json, rotate-status.json, zip-listing.txt, audit-config.json.
>    Source: PORT-CFG-01…04; PPCLOUD-13757, 14154 (docs), 14465, 14493; gaps G16, G17.

### OPS-08 Deephealthcheck ignore list: UI, tenant-access and customer portal (PPCLOUD-14296)

> Data prerequisite: OPS-G2 (ignore list contains `onprem-poly-time-connect`; poly-time-connect is a known permanent DOWN on DeployMate boxes). **Exclusive "tenant-health window"** on `{{TENANT}}` for part B (≈ 5 min): no other scenario reads `{{TENANT}}`'s health or customer portal meanwhile. Tenant flag change, restored in step 7.
> Pre: `portal-ops.mjs … ops08.mjs out/OPS-08`; customer portal via `app.mjs {{TENANT}} <CPU> ops08-cp.mjs out/OPS-08 --app customer-portal`.
> Steps (part A, read-only):
>
> 1. `GET /features/tenants/{{TENANT}}` → value of `portal.onPrem.deephealthcheckIgnores` (record exactly).
> 2. `GET /health?tenantIds={{TENANT}}&force=false` → the deephealthcheck report: status UP with a details text like "Deephealthcheck passed by skipping `onprem-poly-time-connect` checks", or DOWN with "Failing components: …". Record.
> 3. Ops Monitoring section: poly-time-connect is not among the on-prem service tiles.
> 4. Customer portal as `CPU`: `/portal/health` → the on-prem system's services list (`GET …/systems/reports/health`) — record the status of `poly-time-connect`. OPS-S2 suspicion: listed DOWN although ignored.
>    Steps (part B, exclusive):
> 5. `portal-ops.mjs {{PORTAL_PROFILE}} "flag set {{TENANT}} portal.onPrem.deephealthcheckIgnores poly-time-connect" out/OPS-08/flag` (value **without** the `onprem-` prefix).
> 6. Wait ≥ 60 s (tenant-access ignore cache 30 s + 10 s check), then repeat steps 2 and 3. OPS-S1 suspicion: the tile stays hidden (UI strips the prefix) while the deephealthcheck report turns DOWN "Failing components: onprem-poly-time-connect" and the tenant badge turns DOWN.
> 7. Restore: `portal-ops.mjs … flag set <value recorded in step 1>` (or `delete` if step 1 showed no tenant override); wait 60 s; step 2 again equals the step-2 baseline.
>    Expect (product intent): an ignored component never turns the tenant DOWN, in either spelling, and customers do not see ignored components as DOWN. Expected by code: SUSPECT-FAIL OPS-S1 (part B) and OPS-S2 (step 4).
>    Oracle: feature value; health report status + details text before / during / after; customer-portal service status.
>    Evidence: features-_.json, health-_.json, 03-tiles.png, 04-customer-portal.png, cp-health.json, flag/ logs, notes.md with the OPS-S1/OPS-S2 outcome.
>    Source: 11524833388#6 (ignore behaviour); PPCLOUD-14296; OPS-S1, OPS-S2; gap G7.

### OPS-13 Send test SMS: disabled path (403) and enabled path in the messaging window

> Data prerequisite: part A none (Send Messages is off by default, OPS-G2). Part B: OPS-G5, run **inside the HARD window W-Y-MSG** (Send Messages on opens the relay for every on-prem sender of `{{TENANT}}`), recipient = the pre-filled sms-logger test number only.
> Pre: `portal-ops.mjs … ops13.mjs out/OPS-13`.
> Steps (part A):
>
> 1. `?section=diagnostics` → Validation "Test Send Messages": text "The default SMS number will send an SMS to a test number…" with the sms-logger link (record the href); the Mobile number field is pre-filled — do not change it.
> 2. `GET /tenants/{{TENANT}}` → `send_messages` false. Press "Send test message" → `POST /tenants/{{TENANT}}/diagnostics/messaging/sms?recipient=…` → **403**, body "SMS messages are disabled for this tenant"; alert "Error sending message: …". No SMS is sent (the check is before api-gw).
>    Steps (part B, messaging window):
> 3. The steward switches Send Messages ON (the worker only reads `send_messages` true).
> 4. Diagnostics → Send test message → 200 "SMS message sent, verify that it arrived"; alert "Message sent, check your phone for the message".
> 5. Oracle: the sms-logger page (operator-confirmed host) lists a new message for the test number within 2 min (record time and the first 20 characters only); optionally event-handler `GET /metadata/attributes/…` / an `e2e` data plugin shows `PORTAL_SMS_SENT` for `{{TENANT}}`.
> 6. The steward switches Send Messages OFF after the last item of the window and verifies `send_messages` false.
>    Expect: A: 403 with the exact text and no send. B: 200 and one logged SMS; restored.
>    Oracle: HTTP status + body; tenant flag before/after; sms-logger entry.
>    Evidence: 01-panel.png, sms-403.json, tenant-\*.json, sms-200.json, sms-logger shot (number masked), notes.md.
>    Source: 11525652551#1, #2, #3; PORT-DIAG-04, PORT-MSG-01, SHS-SMS-03; PPCLOUD-12260; gap G30.

### OPS-16 Cloud monitoring: threads, logging level (with restore), database, metrics, generic, monitor extras

> Data prerequisite: OPS-G1. CT stage-wide: step 3 changes one logger level on **all poma-core pods** for ≤ 5 min and restores it (window S-CT-LOGLEVEL, announced by the steward; no other team effect besides log volume).
> Pre: `portal-ops.mjs … ops16.mjs out/OPS-16`.
> Steps:
>
> 1. `/ops/monitor` → Service "Poma Core" → Aspect "Threads" → "Single" → Select Pod (first) → thread select → stack trace shown; the captured threaddump JSON has ≥ 1 thread. Store thread names only.
> 2. Aspect "Logging Level": default "Configured"; Sort by "Name" → entries alphabetical except ROOT; search `actuate` → Show "Effective" → more entries than "Configured"; search `endpoint.jmx` → "Configured" shows none → Show "All" → ≥ 1 entry.
> 3. Set `org.springframework.boot.actuate.endpoint.jmx` to TRACE → reload the page → reselect Poma Core / Logging Level → TRACE "(configured)". Oracle per pod: `GET /services/<podIp>/actuator/loggers/org.springframework.boot.actuate.endpoint.jmx…` → `configuredLevel` TRACE on every pod. Restore: set INFO (or the recorded original; if it had no configured level, set the effective level) → all pods back. A missing restore is a FAIL.
> 4. Aspect "Database" → "JDBC Metrics / JDBC Active vs Idle" chart per pod within 30 s.
> 5. Aspect "Metrics" → Select Pod → Endpoint `hikari.connections.usage` → JSON shown → tick the COUNT checkbox → chart appears within 30 s.
> 6. Aspect "Generic" → Select Pod → Endpoint `health` → JSON with `status`. Optional: Service "Messaging" → Generic → `deephealthcheck` → record the "SMS Sending Service" component status (daily self-test, SHS-MSG-04).
> 7. Smoke of the extras (load only, no actions): Poma Core "Notifications" (dead-letter queues), "Execution Metrics"; Portal Core "VPN"; any service "Cache Management" (**never** press clear).
>    Expect: every aspect renders data; logger change applied to all pods and restored.
>    Oracle: threaddump / loggers / metrics JSON per pod; restore check.
>    Evidence: 01-threads.png, threads-names.json, loggers-before/trace/after.json, 04-db.png, 05-metrics.png, health.json, notes.md.
>    Source: 11525914644#1, #2, #3, #4, #5; PORT-MON-01…05, SHS-MSG-04; PPCLOUD-12905; gaps G22, G31.

### OPS-18 Job management: safe job runs with a metrics oracle

> Data prerequisite: OPS-G1/G2. Only jobs of the allow-list (`data-plan.md` §6): Tier A on the CT stage, Tier T with `tenantIds={{TENANT}}`; windows J-Y-JOBS + S-CT-JOBS, announced by the steward; not concurrent with pool-sp PSP-18/PSP-19.
> Pre: `portal-ops.mjs … ops18.mjs out/OPS-18`.
> Steps:
>
> 1. `/ops/monitor` → for each service of the list (Poma API, Poma Core, Poma Conflict Checker, Portal API, Portal Core, Portal Monitor, Portal Events, Event Handler, Messaging, PolyId Login) select Aspect "Job Management" → record the job names (table "Job management"). For Tenant Access, Poma Webapp, Skill Catalog Core, CPP API, CPP, IPSP: no table and no error alert (PPCLOUD-12698).
> 2. Per job to run: read `GET /services/<podIp>/actuator/metrics/polypoint.job.task.executed?tag=class:<X>` and `…unrecoverable.errors…` on **every pod** of the service (class values from `availableTags` of the metric; record the baseline sum).
> 3. Run Tier A jobs one at a time via "Execute" → dialog → Execute: Portal Core `LoadTenantVersions`, `TenantHealthEventJob`; Event Handler `PluginTableMaintenanceCronJob`; PolyId Login `DeleteExpiredTwoFactorAuthCodesJob`, `RefreshJsonWebKeysJob`; Poma Conflict Checker `FindAbandonedSyncJobs`. Tier T: Poma Core `ResyncEmployeesWithNoEmploymentsJob` with `tenantIds={{TENANT}}`. Capture each `POST …/actuator/polypointjobs/<name>?…` → 200.
> 4. After each run poll the metrics (≤ 3 min): the executed counter sum increased; the unrecoverable-errors sum did not. Additional effect oracle for `LoadTenantVersions`: `GET /versions/tenants` → `{{TENANT}}`'s `last_update` advanced.
> 5. Record the UI feedback: none besides the closed dialog (OPS-S5).
>    Expect: listed jobs per service; every allow-listed job executes without unrecoverable errors.
>    Oracle: actuator POST status; counter deltas per class; versions `last_update`.
>    Evidence: jobs-<service>.json, metrics-before/after-<job>.json, versions-\*.json, notes.md (OPS-S5).
>    Source: 12807077892#1; PORT-JOB-01; PPCLOUD-12698, 11604; OPS-S5; gap G20.

### OPS-19 Data plugins: create, validate, data table / graph, load more, delete

> Data prerequisite: OPS-G1 (ADMIN; DATA_ANALYST also allowed). Event handler is shared by the CT stage; the plugin is own-named `e2e-ops-p<tag>` and removed at the end. Trigger: one unchanged "Save Tenant" on `{{TENANT}}` (audit-only write; never concurrent with OPS-08 / OPS-13 / auth's messaging window, because the save sends the whole tenant form).
> Pre: `portal-ops.mjs … ops19.mjs out/OPS-19`.
> Steps:
>
> 1. `/ops/data-plugins` "Data Plugins": tag filter and plugin selector load; capture `GET /admin/plugins` and `/admin/plugins/summary`.
> 2. Plugin → "Create new": Name `e2e-ops-p<tag>`, filter `event.type == 'AUDIT_LOG' && event.tenantId == '{{TENANT}}'`, mapping `event.attributes.get('auditType')` → target `audit_type` (STRING_255), tag `e2e`; use the expression preview (`PUT /admin/plugins/expression`) → no validation error; Save → 201.
> 3. Validation negative: change the filter to `event.type` (not boolean) → error message shown, nothing saved; restore.
> 4. Trigger: Tenant Details of `{{TENANT}}` → "Save Tenant" without changes → `PUT /tenants/{{TENANT}}` 2xx (data-lake `AUDIT_LOG` with `auditType` UPDATE_TENANT).
> 5. Tab "Data Table": within 3 min ≥ 1 row with `audit_type` = `UPDATE_TENANT` (`GET /admin/plugins/e2e-ops-p<tag>/data…`); "Load more data into report table" works (PPCLOUD-12907). Tab "Data Graph" renders.
> 6. `GET /metadata/event-types` contains `AUDIT_LOG`.
> 7. Delete the plugin ("Delete" button, `[disabled]` only while locked) → `GET /admin/plugins/e2e-ops-p<tag>` 404.
>    Expect: plugin lifecycle; the audited write reaches the plugin table.
>    Oracle: plugin JSON, data rows, metadata, 404 after delete.
>    Evidence: 01-list.png, plugin.json, data.json, 05-table.png, 05-graph.png, notes.md.
>    Source: 11524636774 (empty page → new content); PORT-DATA-01, SHS-EVT-03/04/05; PPCLOUD-12907; gap G32.
