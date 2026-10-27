# Family PA — Integration partner administration (PTN-01, PTN-02) · throw-away partners only

|                           |                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | PTN-01, PTN-02                                                                                                                                                                              |
| Actors                    | portal ops ADMIN = the runner's profile `{{PORTAL_PROFILE}}`; POMA ops ADMIN = `{{POMA_OPS_PROFILE}}`; PH5 `{{PH5_LOGIN}}` ({{PH5_ID}}) only as the subject of a published event (no login) |
| Objects you own           | `e2e-ptn-x-{{RUN_TAG}}` (PTN-01), `e2e-ptn-l-{{RUN_TAG}}` (PTN-02) — never the run partner `{{PARTNER_ID}}`                                                                                 |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/PA` · `{{RUN_DIR}}/PA/<scenario>/` · `created/PA.jsonl`                                                                                                |
| Read first                | the group part above; scenarios.md PTN-01, PTN-02; known-deviations.md PF-1                                                                                                                 |

The partner editor is `https://ct-portal-webapp.dev.k8s.polypoint-dev.com/ops/partners`. Drive it with a portal-ops script (`node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} {{RUN_DIR}}/scripts/PA-<scenario>.mjs {{RUN_DIR}}/PA/<scenario>`); the harness records every portal admin response. Answer the delete prompt with `--dialogs '[{"prompt":"DELETE"}]'`. A `LOGIN_NEEDED` exit (3) → stop, blocker "portal ops session expired" (the runner signs in again).

## PTN-01 — Integration partner lifecycle

1. Pre-check: `api.call('GET', '/integration-partners?count=200')` (portal admin API) has no id `e2e-ptn-x-{{RUN_TAG}}` → `pre-list.json`. If it exists (leftover), stop: BLOCKED "leftover partner", report it.
2. UI: add a new partner — id `e2e-ptn-x-{{RUN_TAG}}`, names `E2E PTN X {{RUN_TAG}}`, active; subscription 1 name `users`, "Event Types" = `USERS` (defaults for ack 120 s, retention 1440 min, expiry 31 d) → "Save". Capture the POST → `partner-create.json`; shot `01-create.png`.
3. Reopen the partner: tab "Details" shows "Keycloak Client Id: event-consumer-integration-e2e-ptn-x-{{RUN_TAG}}" (shot); capture `GET …/integration-partners/<id>` → `partner-get.json`; record the stored subscription name.
4. Edit: add subscription 2 `shifts` = `PLANNED_SHIFTS`; add tenant access `{{TENANT}}` with rights USERS + PLANNED_SHIFTS. Try "Save" without a change-request id → the button is disabled (shot `04-save-disabled.png`). Enter change-request id `E2E-{{RUN_TAG}}` + comment `e2e PTN-01` → "Save" → alert "Partner Updated"; capture the PUT → `partner-put.json`.
5. Tab "Change Log": a row with `E2E-{{RUN_TAG}}` (shot `05-change-log.png`).
6. Client token: `node {{SKILL_DIR}}/scripts/harness/partner-api.mjs e2e-ptn-x-{{RUN_TAG}} {{RUN_DIR}}/PA/PTN-01/token token client --portal-profile {{PORTAL_PROFILE}}` → exit 0, `claims-client.json` has `partner_id = e2e-ptn-x-{{RUN_TAG}}` and role `EVENT_CONSUMER`.
7. Delete: "Delete" → prompt `DELETE` → alert (its text says "Tenant … deleted": cosmetic, record it in notes) → the partner is gone from `GET …/integration-partners?count=200` → `post-list.json`.
8. The same `token client` call again → fails (exit 6, status 400 / 401 in the log): the Keycloak client is deleted.
9. Optional Pub/Sub reads (`gcloud`, only if the runner's family notes allow it): not part of the verdict; the dead-letter check of PF-1 is recorded as "not checked" otherwise.

Expect: create 2xx; stored subscription names start with `<env partner-events topic>-e2e-ptn-x-{{RUN_TAG}}-` (auto-prefixed); filters hold access-right categories (`USERS`, `PLANNED_SHIFTS`); Save disabled without a change-request id; change-log row present; the client token works while the partner exists and fails after the delete. Oracles: `subscription_config_list[].name`, `.event_subscription_filters`, `tenant_access_list` of the API responses; token exit codes + claims.

## PTN-02 — Partner Debug log: enable, routed events appear, an edit disables logging and deletes the log

1. Create `e2e-ptn-l-{{RUN_TAG}}` exactly like PTN-01 steps 2 + 4 but with subscription `shifts` = `PLANNED_SHIFTS` and tenant access `{{TENANT}}` = `PLANNED_SHIFTS` only (change-request id `E2E-{{RUN_TAG}}`). Log the id in `created/PA.jsonl`.
2. Logging on: `portal-ops.mjs {{PORTAL_PROFILE}} "partner logging on e2e-ptn-l-{{RUN_TAG}}" {{RUN_DIR}}/PA/PTN-02/log-on` (or the Debug tab toggle "Log partner events" + confirm; shot `01-toggle.png`). Note the time T0.
3. Publish events: POMA ops script (`portal-ops.mjs {{POMA_OPS_PROFILE}} {{RUN_DIR}}/scripts/PA-PTN-02-publish.mjs <out> --base poma-ops`): `/ops/conflict-checker` → tab "Partner" → Type `CREATE`, From = `{{TODAY}}`, To = 6 days later, Tenant Subject = PH5's subject (`partner-allocation.md`), tenant `{{TENANT}}` → "Publish Events"; capture the POST (shot `02-publish.png`). This publish reaches only partners with access to `{{TENANT}}`.
4. Wait up to 2 min, then `portal-ops.mjs … "partner logs e2e-ptn-l-{{RUN_TAG}} --since <T0>"` → `partner-log-before.json`. Expect ≥ 1 `type v1/UpdatePlannedShift` (often also `v1/UpdateShiftBlock`) with `source {{TENANT}}` and PH5's subject in `data`.
5. Edit the partner (UI): change the comment, change-request id `E2E-{{RUN_TAG}}` → "Save".
6. Logs again → `partner-log-after.json`: 0 events; partner `GET` shows `logging_config.enabled` false.
7. Cleanup: delete `e2e-ptn-l-{{RUN_TAG}}` (prompt `DELETE`), verify by the list read.

Expect: step 4 events of PH5's seed plannings; after the edit logging is off and the log is empty (an edit always disables logging and deletes the logged events). If step 4 shows no event within 2 min: FAIL with both log files and the publish response.

## Cleanup checklist

- Neither `e2e-ptn-x-{{RUN_TAG}}` nor `e2e-ptn-l-{{RUN_TAG}}` exists (list read saved); both lines in `created/PA.jsonl` with `cleaned: true`.
- The run partner `{{PARTNER_ID}}` was never opened in edit mode.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
