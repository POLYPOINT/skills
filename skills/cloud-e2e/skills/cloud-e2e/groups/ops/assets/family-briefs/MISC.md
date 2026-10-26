# Family MISC — Feature flags, customer portal, incidents, role matrix, POMA ops, recording, Config Generator (OPS-14, 20, 21, 22, 24, 25, 23)

|                           |                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | OPS-14, OPS-20, OPS-21, OPS-22, OPS-24, OPS-25, OPS-23                                                                                                                                 |
| Actors                    | OPS (`{{PORTAL_PROFILE}}`), OPS-POMA (`{{POMA_OPS_PROFILE}}`), CPU `{{CPU_LOGIN}}` ({{CPU_ID}}), TA `{{TA_LOGIN}}` (optional, read-only), single-role profiles `{{OPS_ROLE_PROFILES}}` |
| Attended                  | OPS-23: the operator ran the Config Generator suite (report `{{SUITE_REPORT}}`) and types the master password in the headed window                                                     |
| Paused by                 | W-Y-HEALTH (OPS-20 reads customer-portal health), W-Y-MSG (HARD)                                                                                                                       |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/MISC` · `{{RUN_DIR}}/MISC/<scenario>/` · `created/MISC.jsonl`                                                                                     |
| Read first                | the group part above; scenarios.md OPS-14, 20–25; known-deviations.md OPS-K1, OPS-S2, OPS-S3, OPS-S4, OPS-S8                                                                           |

## OPS-14 — Feature flags: tenant override round trip, master page, optional inert master flag

1. `section('{{PORTAL_ORG}}', '{{TENANT}}', 'features')`: groups per app (POLYID, POMA, PORTAL, GENERAL …); no warning icon (bundle 26.99 ≥ every `dependency`); the button "Disable incompatible features" exists — **do not press it**. Shot `01-features.png`.
2. `portal-ops.mjs {{PORTAL_PROFILE}} "flag read {{TENANT}} general.logs.skip" <out>` → value, master, override present? (`features-before.json`).
3. `"flag set {{TENANT}} general.logs.skip true"` → read → true; audit `TENANT_FEATURE` UPDATE row.
4. `"flag delete {{TENANT}} general.logs.skip"` → read → the master value again; audit row.
5. `/ops/features` (ADMIN): "Master features (affect all Tenants)" and "Features per Tenant (only set default values)" load; master rows = `GET /features/master` length. No edit.
6. Part B only when `MASTER_FLAG_OK` = `{{MASTER_FLAG_OK}}` is `yes`: create `e2e.ops.f{{RUN_TAG}}`, type STRING, value `x`, description "e2e inert flag" → it appears in `{{TENANT}}`'s Features; audit `MASTER_FEATURE` CREATE; delete it (confirm "Are you sure you want to delete this feature …") → gone from both pages; audit DELETE. `no` → part B "not run (no operator OK)".

## OPS-20 — Customer portal: anonymous health, tenant view, details, languages, browsers

1. Anonymous (chromium, a fresh context with no login: `app.mjs` is for logins, so write a minimal Playwright script that refuses any URL not starting with `{{PORTAL_HOST}}/portal/`): `{{PORTAL_HOST}}/portal/health` → sections PolyID, POMA, Shared services, TPMS with a health colour; no Incidents / Certificates; header link "Login". Capture `GET …/systems/reports/health` (200 without token) → `health-anon.json`. Shot `01-anon-chromium.png`.
2. Click each row → `/portal/health-details/<systemId>/<subSystemId>` loads (components with status); back. Record failing rows.
3. Repeat 1–2 in firefox and webkit (engines installed by the runner; missing → step 3 BLOCKED "engines missing", not FAIL).
4. As CPU (`app.mjs {{TENANT}} "{{CPU_LOGIN}}" <script> <out> --app customer-portal`): the on-prem system of `{{TENANT}}` appears (infrastructure + Java services), plus "Incidents" and "Certificates"; no "User management". Record poly-time-connect's status: DOWN although ignored = **KNOWN-FAIL OPS-S2**. Shot `04-tenant.png`; `health-tenant.json`.
5. Incidents "show more" → `/portal/incidents`; open one (if any) → detail; reload the detail URL → record that it is empty (known behaviour SD-51: a note, not a verdict). Open a certificate → `/portal/certificate-details`.
6. Language selector en → de → fr → it → nl: per language the frontend title (`header-container-title`) and the section titles from the health API → `i18n-<lang>.json`. de / en translated; fr / it / nl section titles in English = **KNOWN-FAIL OPS-K1** (PPCLOUD-12894 / PPCLOUD-14105), not new.
7. Logout via the user menu → `/portal/logged-out` (or anonymous health).

## OPS-21 — Incidents: lifecycle, duplicate suppression, ignore rule, customer view

All incidents on `{{TENANT}}` with type `E2E_OPS_TEST` and descriptions starting `E2E-OPS-{{RUN_TAG}}`.

1. Seed one with the ops bearer (portal-ops script): `api.call('POST', '{{PORTAL_API}}/api/v1/incidents', {tenant_id: '{{TENANT}}', type: 'E2E_OPS_TEST', severity: 'INFO', description: 'E2E-OPS-{{RUN_TAG}}-A'})` (absolute URL; if the helper accepts only admin paths, use the incident endpoint the ops UI itself calls, from `api-index.jsonl`). 403 → record and continue read-only with an auth AUT-17 impersonation incident as the subject.
2. POST the same body again → `GET …/api/v1/incidents?…` shows **one** OPEN `…-A` (duplicate suppression) → `incidents-1.json`.
3. `/ops/incidents`: the card shows tenant, type, severity INFO, description (shot `03-card.png`). "Acknowledge" → ACKNOWLEDGED (`PUT …/incidents/<id>/state/ACKNOWLEDGED`); CPU's customer portal incidents table shows it ACKNOWLEDGED.
4. "Resolve" → RESOLVED; it leaves the open list and appears in "Past Incidents"; "Reopen" → OPEN; resolve again (shot `04-history.png`).
5. Ignore rule: POST `E2E-OPS-{{RUN_TAG}}-IGN-0` → its card → "Ignore" → the form is pre-filled with Tenant `{{TENANT}}` and pattern `^E2E-OPS-{{RUN_TAG}}-IGN-0$` → change the pattern to `^E2E-OPS-{{RUN_TAG}}-IGN.*$` (**keep the tenant**) → "Create" (`POST /admin/incidents/ignored`). POST `…-IGN-1` → 2xx but no incident appears (dropped without any record = **OPS-S8**, observation). POST `…-B` → appears. "Show Ignores" → delete the rule; resolve `-IGN-0` and `-B` → `ignored-*.json`.
6. CPU's customer portal: `-A` / `-B` with their states; no resolve button for tenant users → `cp-incidents.json`.
7. Cleanup: every `E2E-OPS-{{RUN_TAG}}-*` incident RESOLVED; `GET /admin/incidents/ignored` has no rule with the run pattern.

## OPS-22 — Ops role matrix (needs single-role accounts)

`{{OPS_ROLE_PROFILES}}` = `none` → BLOCKED "no single-role ops accounts (OQ-25)"; nothing else to do.
Otherwise per role profile (`portal-ops.mjs <role profile> <script> {{RUN_DIR}}/MISC/OPS-22/<role>`):

1. Open `/dashboard`, `/organizations`, `/security-report`, `/incidents`, `/partners`, `/monitor`, `/versions`, `/tenant-analytics`, `/tenant-access`, `/support-token`, `/recording`, `/config-generator`, `/audit-log`, `/data-plugins`, `/features`, `/vault`, `/rotate-key`; record the landing path (allowed or `/forbidden?location=…`) → `routes-<role>.json`.
2. `{{TENANT}}` Tenant Details: visibility of "Create Tenant", "Save Tenant", "Delete Tenant", "Delete Organization" (shot `buttons-<role>.png`).
3. Backend probe with the role's session: `flag set {{TENANT}} general.logs.skip true` then `flag delete …` (record each status → `writes-<role>.json`). SUPPORT accepted = **KNOWN-FAIL OPS-S3** (intended: refused).
4. POLYPOINT_EMPLOYEE: "Save Tenant" without changes → expected 403 (button shown although refused) — run it only when no W-Y-MSG / W-Y-HEALTH window is draining / active.

## OPS-24 — POMA ops: read smoke and the single-tenant cache-reset scope (intercepted)

`portal-ops.mjs {{POMA_OPS_PROFILE}} {{RUN_DIR}}/scripts/MISC-OPS-24.mjs {{RUN_DIR}}/MISC/OPS-24 --base poma-ops`.

1. `/ops/dashboard`; `/ops/tenants/{{TENANT}}` tabs Details / Conflict Checker / Availability Sync load; record `active` and the api-gw URL field (no edit, no "sync"). Shot `01-tenant.png`.
2. `/ops/teamroster-metrics` loads (may be empty); `/ops/support-files` list loads (no upload).
3. `/ops/cache` (ADMIN): **first** `routeAbort('**/admin/tenants/devices/reset-cache**')` (the helper logs the URL and aborts the request), then choose `{{TENANT}}`, press the single-tenant reset, accept the confirmation. Record the intercepted URL → `intercepted-url.txt`; verify in `api-index.jsonl` that no reset request got a response. Parameter `tenantId=` (the API binds `tenant-id`, so the server would reset **all** tenants) = **KNOWN-FAIL OPS-S4**. If the abort is not in place, do **not** press the button: BLOCKED.

## OPS-25 — Recording of a tenant's HTTP traffic

1. Tenant editor of `{{TENANT}}` → "Record HTTP traffic for this tenant" → `/recording?tenant={{TENANT}}&fromOrg={{PORTAL_ORG}}` → "Start Recording" (`POST …/recording-sessions/{{TENANT}}` 2xx); the live stream connects. Shot `01-recording.png`.
2. CPU (`app.mjs {{TENANT}} "{{CPU_LOGIN}}" <script> <out> --app mypp`): open home and Kalender once.
3. Within 1 min the recording lists exchanges poma-api / poma-core → api-gw for `{{TENANT}}`; password-like headers are masked (spot-check one exchange's header **names**).
4. "Stop Recording"; the list stays readable; exchange count per service → `recordings-summary.json` (paths + counts only, never bodies).

## OPS-23 — Config Generator (attended)

Part A (operator-run suite): `{{SUITE_REPORT}}` = `none` → part A BLOCKED "suite not run". Otherwise read the report: passed / failed / flaky of the 13 template-editor tests → `playwright-summary.json`; then `/ops/config-generator` "POLYPOINT Version" dropdown: no `99.*` version of this run left (`versions-after.json`).
Part B (headed: `portal-ops.mjs {{PORTAL_PROFILE}} {{RUN_DIR}}/scripts/MISC-OPS-23.mjs {{RUN_DIR}}/MISC/OPS-23 --headed`; log `WAITING FOR OPERATOR: master password`): 3. `section('{{PORTAL_ORG}}', '{{TENANT}}', 'config')`: the master-password dialog; the operator types a wrong value once → refusal (HTTP 409, invalid-password code; record status only → `03-mp-error.json`); then the correct one → the config list loads. 4. `/ops/rotate-key` (ADMIN): status page loads; **do not start** a rotation → `rotate-status.json`. 5. New config for `{{TENANT}}` on version 26.99 (or the newest offered) → defaults → "validate and generate" → ZIP downloaded (size and file list only → `zip-listing.txt`, delete the file); the encryption hint shows "encrypted". 6. Two configs of `{{TENANT}}` exist → compare → diff renders (else note "one config only"). 7. Audit `TENANT_ON_PREM_CONFIG` CREATE row → `audit-config.json`.

## Cleanup checklist

- `general.logs.skip` override deleted (read back); inert flag deleted (if created); every `E2E-OPS-{{RUN_TAG}}-*` incident RESOLVED and the ignore rule gone; recording stopped; downloaded files deleted.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
