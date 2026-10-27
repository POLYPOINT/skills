# Group brief — ops

Runner notes (the part above the `---` line is not sent to workers): fills the `{{GROUP_BRIEF}}` slot of `assets/agent-brief.md`. Values come from `env-facts.md` (OPS-G1..G5) and the run config. Window families X08, X13, X16, X18, X19 are launched only when their window doc is `active` (X16 / X18 also need the steward's STAGE doc with the user's OK). X13 part 2 starts after the steward switched Send Messages ON. LIFE and X16 never touch DM-Y: count them under `activeWorkers.ct` so DM-Y windows (also W-Y-MSG) do not wait for them. The PolyPortal ops ADMIN profile `{{PORTAL_PROFILE}}` lasts ≈ 1.5 h: re-login before TEN (OPS-09), MISC (OPS-14) and X19.

---

## Group ops — what every worker of this group needs

You test PolyPortal ops, the customer portal, cloud monitoring, jobs, data plugins, the Config Generator and POMA ops — on the **CT portal (stage-wide)** and on the DeployMate tenant **`{{TENANT}}`** (role {{ENV_ROLE}}, organisation `{{PORTAL_ORG}}`, shared with the groups utr, planner and auth). Everything you create carries the run tag `{{RUN_TAG}}`.

### Actors and sessions

| Who                      | What                                                                              | Use                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| OPS                      | the runner's PolyPortal ops session, role **ADMIN**, profile `{{PORTAL_PROFILE}}` | every ops page and the portal admin API (captured bearer, never printed) |
| OPS-POMA                 | the runner's POMA ops session, profile `{{POMA_OPS_PROFILE}}`                     | OPS-24                                                                   |
| CPU                      | seed login `{{CPU_LOGIN}}` ({{CPU_ID}}) of `{{TENANT}}` (HP role)                 | customer-portal reads, employee check, myPP read for the recording       |
| TA                       | `{{TA_LOGIN}}` (steward kit tenant admin)                                         | read-only, optional customer view in OPS-21                              |
| single-role ops accounts | `{{OPS_ROLE_PROFILES}}`                                                           | OPS-22 only (`none` → BLOCKED)                                           |

### Owned names (create, change or delete only these)

Organisation `e2e-ops-{{RUN_TAG}}`; tenants T1 `e2e-ops-{{RUN_TAG}}-test`, T2 `e2e-ops-{{RUN_TAG}}-prod`; e-mail domain / api-gw host `e2e-ops-{{RUN_TAG}}.invalid`; plugin `e2e-ops-p{{RUN_TAG}}`; inert master flag `e2e.ops.f{{RUN_TAG}}` (only with `MASTER_FLAG_OK` = `{{MASTER_FLAG_OK}}`); incidents with descriptions `E2E-OPS-{{RUN_TAG}}-*` and one **tenant-scoped** ignore rule; one recording session. On `{{TENANT}}` only the listed changes: the ignore flag (X08), the licence re-save (OPS-09), the override `general.logs.skip` (OPS-14 / 22), one unchanged "Save Tenant" (X19), incidents with the run prefix. Never touch another organisation or tenant.

### Hosts

PolyPortal ops `{{PORTAL_HOST}}/ops/`; customer portal `{{PORTAL_HOST}}/portal/`; portal-api `{{PORTAL_API}}` (admin base `/api/private/admin`); POMA ops `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/ops/`; myPP `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app`.

### Harness (exact flags: `{{SKILL_DIR}}/references/harness.md`; `cd {{RUN_DIR}}`)

```
node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} <script.mjs> <outdir> [--dialogs '<json>']           # ops UI script
node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "<command>" <outdir>                                  # commands
node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{POMA_OPS_PROFILE}} <script.mjs> <outdir> --base poma-ops               # POMA ops
node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} "{{CPU_LOGIN}}" <script.mjs|-> <outdir> --app customer-portal|mypp   # CPU (MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}})
```

- Script mode gives `{page, ctx, out, shot, log, api, section, select, pods, actuator, metricSum, routeAbort, urls, base, org}`: `api.call(method, path, body)` on the portal admin API (paths relative to `/api/private/admin`), `section('{{PORTAL_ORG}}', '{{TENANT}}', '<key>')` deep-links the tenant editor (keys `details, features, license, api-gateway, monitoring, data-exports, onprem-installation, diagnostics, config`), `select(label, optionText)` for `mat-select`, `pods(service)` / `actuator(service, podIp, endpoint)` through the Monitor proxy (refuses `env`, `configprops`, `heapdump`, `threaddump` bodies), `metricSum(service, name, tag)` over all pods, `routeAbort(pattern)`.
- Commands: `flag read|set|delete <tenant> <code> [value]`, `tenant read <tenant>`, `job list <service>`, `job run <service> <job> [--tenant {{TENANT}}] [--window S-CT-JOBS]` (allow-list only), `health <tenant>`, `audit [--tenant <id>] [--since ISO]`.
- Native dialogs: destructive actions use `prompt()` ("type DELETE", "type 'DO IT'"), `confirm()`, `alert()`; answer them with `--dialogs '[{"prompt":"DELETE"},{"confirm":true}]'`; every dialog text lands in `dialogs.log` (alerts are the UI's only result messages).
- Exit 3 = `LOGIN_NEEDED` → stop, blocker "portal ops session expired"; exit 6 with 403 = missing rights (record).
- Helpers: `import { issueShot, jsonShot, act, alertText, roles } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'`.

### Oracles (screenshots are evidence, never the oracle)

| What                    | How (portal admin API unless noted)                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Organisations / tenants | `GET /dashboard/organizations`, `GET /organizations/<org>[/tenants]`, `GET /tenants/<id>`, `…/services`, `…/ips`, `GET /features/tenants/<id>`, `GET /tenants/<id>/license[/history]`, `GET /versions/tenants`, `GET /logfiles/<id>` |
| Health                  | `GET /health?tenantIds=<id>&force=false` → `{tenant: [{component_name, status, details}]}` (UP / WARN / MAINTENANCE_DOWN / PRE_PROD_DOWN / DOWN / UNKNOWN)                                                                           |
| Admin audit (API only)  | `GET /audit-logs?tenant=<id>&target-type=<T>&action=<A>` (`TENANT`, `TENANT_FEATURE`, `MASTER_FEATURE`, `TENANT_IP_ACCESS_LIST`, `TENANT_LICENSE`, `TENANT_ON_PREM_CONFIG`, `ORGANIZATION`; CREATE / UPDATE / DELETE)                |
| Customer portal         | `GET {{PORTAL_API}}/api/private/business/portal/systems/reports/health`, `…/portal/incidents`, `…/portal/keycloak/certificates`                                                                                                      |
| Actuator                | `pods()` / `actuator()` / `metricSum()` through the Monitor proxy                                                                                                                                                                    |
| Event handler           | `GET /admin/plugins/<name>`, `…/data…`, `GET /metadata/event-types` (host from `api-index.jsonl`)                                                                                                                                    |

### Redaction (the harness does it; never undo it)

Never store: producer credentials, Keycloak client secrets, actuator `env` / `configprops` / `heapdump` bodies, licence `raw_xml` (SHA-256 only), downloaded log or ZIP contents (size, line count, file list only), recording bodies (paths + counts only), Config Generator master-password requests. Shots mask `.code` spans and the "Test Send Messages" number field.

### Evidence and report

- Folder `{{RUN_DIR}}/{{FAMILY}}/<scenario>/`: `NN-<step>.png`, `<endpoint>.json`, `audit-*.json`, `dialogs.log`, `notes.md`.
- Every created object one JSON line in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl`.
- KNOWN-FAIL only with a matching signature of `{{GROUP_DIR}}/references/known-deviations.md` (OPS-K1, OPS-S1..S8); new findings `N-OPS-<n>`.

### Never

- Never call a path containing `/test/` (portal-api, portal-core, polyid-login, event-handler, poma-api); no "Clean Test Data".
- Never press "Disable incompatible features", "reconcile enabled_for", "run automated fix", a cache clear (portal Cache Management, POMA ops cache reset), key rotation (Rotate Key, POMA Vault), "migrate to PolyPortal".
- Never run a job outside the allow-list (Tier A in S-CT-JOBS, Tier T with `--tenant {{TENANT}}` in J-Y-JOBS); never a job with empty `tenantIds`.
- Never change a master flag except `e2e.ops.f{{RUN_TAG}}`; never create a global incident ignore rule (the tenant field stays `{{TENANT}}`).
- Never toggle Send Messages on `{{TENANT}}` (the steward does it inside W-Y-MSG); SMS only to the pre-filled sms-logger test number, only in X13 part 2.
- Never print, copy or save passwords (ops accounts, Config Generator master password, PEP DB login), tokens or secrets: the operator types them in headed windows.
- **Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
