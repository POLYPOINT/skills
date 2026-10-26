# Family LIFE — Throw-away organisation and tenant lifecycle (OPS-02 … OPS-06) · CT portal only

|                           |                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | OPS-02, OPS-03, OPS-04, OPS-05, OPS-06                                                                                                                     |
| Actor                     | OPS (`{{PORTAL_PROFILE}}`, ADMIN)                                                                                                                          |
| Objects you own           | organisation `e2e-ops-{{RUN_TAG}}`, T1 `e2e-ops-{{RUN_TAG}}-test`, T2 `e2e-ops-{{RUN_TAG}}-prod`, domain / host `e2e-ops-{{RUN_TAG}}.invalid`              |
| Scope                     | CT portal only — you never touch `{{TENANT}}`. The header may list W-Y-MSG because it is a HARD window of DM-Y: LIFE is exempt (env-plan §7.2), keep going |
| Profiles / results        | `{{RUN_DIR}}/LIFE/<scenario>/` · `created/LIFE.jsonl`                                                                                                      |
| Read first                | the group part above; scenarios.md OPS-02..06; known-deviations.md OPS-S6                                                                                  |

One portal-ops script per scenario: `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} {{RUN_DIR}}/scripts/LIFE-<scenario>.mjs {{RUN_DIR}}/LIFE/<scenario> [--dialogs '…']`. **OPS-06 always runs**, also when an earlier scenario failed or was blocked; record every created id in `created/LIFE.jsonl` the moment it exists.

## OPS-02 — Create a throw-away organisation (form validation)

Pre: `api.call('GET', '/organizations/e2e-ops-{{RUN_TAG}}')` → 404 (else stop the family: BLOCKED "name taken", report it).

1. `{{PORTAL_HOST}}/ops/create/organization` (or Organizations → selector → "Create new"); shot of the empty form `01-form.png`.
2. Organization Name `E2E OPS {{RUN_TAG}}`, Customer Number `0x1` → Create stays disabled (digits only); clear Customer Number → still disabled (required). Shot `02-invalid.png`.
3. Customer Number `0`, Abbreviation `E2E` → Create → `alert("Organization Created")`, navigation to `/organizations/e2e-ops-{{RUN_TAG}}`.
4. `GET /organizations/e2e-ops-{{RUN_TAG}}` → id, `customer_number` `0`, `active` true; record the composed display name → `organization.json`.
5. `GET /audit-logs?target-type=ORGANIZATION&action=CREATE` (newest first) contains the id, actor = the operator → `audit-org-create.json`.

## OPS-03 — Create-tenant wizard: Test, cloud connected, Smart PEP default (T1)

1. In `/organizations/e2e-ops-{{RUN_TAG}}` press "Create Tenant" → `/create/tenant/e2e-ops-{{RUN_TAG}}`.
2. "Type of system" = Test → "Is this tenant cloud connected?" Yes → "Will the VPN be used with this tenant?" No.
3. "Should Smart PEP (CPP) be enabled for this tenant?": **Yes** is pre-selected (PPCLOUD-14097). Shot `03-smartpep-default.png`. Leave it.
4. Name `e2e-ops-{{RUN_TAG}}`, e-mail domain `e2e-ops-{{RUN_TAG}}.invalid`, Url to API Gateway `https://e2e-ops-{{RUN_TAG}}.invalid:8099/pp-api-gateway` (if PolyID refuses `.invalid`, use `e2e-ops-{{RUN_TAG}}.example` and note it).
5. "Review Configuration then create" → the dialog shows id `e2e-ops-{{RUN_TAG}}-test`, name `TEST: e2e-ops-{{RUN_TAG}}`, e-mail `test.e2e-ops-{{RUN_TAG}}.invalid`, Smart PEP yes (shot `05-review.png`) → "Confirm Creation".
6. Capture `POST /tenants`, `POST /tenants/<id>/services/POMA|PolyId|CPP`, `PUT /tenants/<id>/ips`; expect navigation to `/organizations/e2e-ops-{{RUN_TAG}}/e2e-ops-{{RUN_TAG}}-test`. An alert "an error occurred while creating tenant" → record which calls failed (**OPS-S6**) and continue (OPS-06 cleans the partial state).
7. `GET /tenants/<T1>` → `cloud_connected` true, `test_tenant` true, `send_messages` false, state MAINTENANCE "Tenant is being created", `enabled_for` [POMA, PolyId, CPP], `polyid_domain` `test.e2e-ops-{{RUN_TAG}}.invalid`; `…/services` POMA, PolyId, CPP; `…/ips` one entry `127.0.0.1` "block all vpn connections".
8. Tenant Details → Services: link icon for "PolyId (PolyId)", "Workforce Management (POMA)", "Smart PEP (CPP)" (shot).
9. Audit: `GET /audit-logs?tenant=<T1>&target-type=TENANT&action=CREATE` → 1 row; a `TENANT_IP_ACCESS_LIST` row.

## OPS-04 — Wizard variant: Production without cloud connection (T2), duplicate id, security report

1. Create Tenant → Test → cloud connected No → Name `e2e-ops-{{RUN_TAG}}` → Review → inline error "A tenant with id "e2e-ops-{{RUN_TAG}}-test" already exists. Choose a different name." (`.id-error`), no dialog. Shot `01-duplicate.png`. "Reset".
2. Create Tenant → Production → cloud connected No (no VPN / Smart PEP question) → Name `e2e-ops-{{RUN_TAG}}-prod` → Review: id `e2e-ops-{{RUN_TAG}}-prod` (affix **not** doubled), name `PROD: e2e-ops-{{RUN_TAG}}-prod` → Confirm Creation.
3. `GET /tenants/<T2>`: `cloud_connected` false, `test_tenant` false, `enabled_for` [], no `polyid_domain`; services []; record what `…/ips` returns.
4. Section select offers only Tenant Details, On-Prem Installation, Config (PPCLOUD-14103). Shot of the open select `04-sections.png`.
5. "Delete Tenant" is enabled (no services) — do **not** delete here.
6. State select → DISABLED → "save state": refusal alert for a non-test tenant (no "type 'DO IT'" prompt), no `PUT …/state`, state unchanged (MAINTENANCE).
7. `/ops/security-report`: T2 listed with reason `NO_POLYID_PROVIDER`; T1 not listed; "Open tenant" on T2 opens its editor. Capture the report API → `security-report.json`; shot `07-report.png`.

## OPS-05 — Throw-away tenant administration (T1 only)

`--dialogs '[{"prompt":"DO IT"}]'`.

1. T1 Tenant Details: links "Navigate to PolyId Admin UI", "… Workforce Management Admin UI", "… Smart PEP Admin UI" exist; record each `href` and request each once (status < 500; a login redirect is fine) → `01-links.json`.
2. "Delete Tenant" **disabled** (services exist); "Delete Organization" **disabled** (organisation has tenants). Shot `02-guards.png`.
3. IP White List: "Add range" `192.0.2.0/24` with a description → Save Tenant → `GET /tenants/<T1>/ips` contains it; "Delete range" → Save Tenant → back to the single `127.0.0.1` entry (PPCLOUD-13115 regression). Audit `TENANT_IP_ACCESS_LIST` UPDATE × 2.
4. Toggle "Send Messages" ON → Save Tenant → `send_messages` true → OFF → Save → false (T1 has no api-gw; nothing can be sent). Audit `TENANT` UPDATE rows.
5. State MAINTENANCE → ACTIVE → "save state" → ACTIVE, `last_state_modified_by` = operator; DISABLED → prompt "type 'DO IT'" answered → DISABLED.
6. Back to ACTIVE.

## OPS-06 — Teardown (always run)

`--dialogs '[{"prompt":"DELETE"},{"prompt":"DELETE"},{"prompt":"DELETE"}]'`; confirmations accepted.

1. List what exists: `GET /organizations/e2e-ops-{{RUN_TAG}}/tenants`; per tenant `…/services` → `services-before.json`.
2. T1: Services → "Delete" for Smart PEP (CPP), Workforce Management (POMA), PolyId; after each the icon turns to "link_off"; `…/services` = [] → "Delete Tenant" enabled. Shot `02-missing.png`.
3. "Delete Tenant" → prompt `DELETE` → alert `Tenant "<T1>" deleted`. Same for T2.
4. "Delete Organization" → prompt `DELETE` → alert `Organization "e2e-ops-{{RUN_TAG}}" deleted`.
5. `GET /tenants/<T1>` and `<T2>` → 404; `GET /organizations/e2e-ops-{{RUN_TAG}}` → 404; audit `TENANT` DELETE × 2 and `ORGANIZATION` DELETE; none of the ids in `GET /dashboard/organizations`.
6. A service delete fails (past PPCLOUD-12903) → FAIL with the response; write the leftover ids to `leftovers.json` and `blockers` (never any test-data fallback).

## Cleanup checklist

- `leftovers.json` = `[]` on PASS; every id of `created/LIFE.jsonl` marked `cleaned: true` or named in `blockers`.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
