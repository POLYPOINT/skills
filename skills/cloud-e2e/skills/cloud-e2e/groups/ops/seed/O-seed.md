# Group ops — seed steps O1, O2 (runner)

Paths relative to the cloud-e2e skill folder; `<env>` = DM-Y env id; results in `results/<run>/ops/`.

## O1 — sessions, tenant facts, names, CPU

1. **Sessions** (headed, personal accounts, ≈ 1.5 h): `node scripts/harness/portal-ops.mjs <portal-profile> login <out>` (PolyPortal ops) and the POMA ops sign-in into a second profile (`portal-ops.mjs <poma-ops-profile> - <out> --base poma-ops --headed`). **OPS-G1**: a script that opens `/ops/features` does not land on `/forbidden` (ADMIN). Not ADMIN → the user names a shared admin account (typed by the operator) or OPS-06 org delete / OPS-09 save / OPS-14 master page / OPS-19 are BLOCKED.
2. **OPS-G2** (portal-ops script, headless, reads only) → `env-facts.md`: the organisation slug (`deploymate-<uuid>`, run config `PORTAL_ORG`) (from `GET /organizations` or the tenant row), `GET /tenants/<env>` (`cloud_connected`, `send_messages`, `test_tenant`, `state`), the **exact** value of `portal.onPrem.deephealthcheckIgnores` (`flag read <env> portal.onPrem.deephealthcheckIgnores`; "no tenant override" if absent) → run config `IGNORES_BASELINE`, `GET /versions/tenants` (bundle `26.99.0`, `last_update`), `GET /tenants/<env>/license` (≥ 1 application) and the history length, `health <env>` (VPN / PING UP), `GET /tenants/<env>/on-prem/services`. Add the DeployMate tenant health the steward recorded (`envs/<env>`), for OPS-07 step 9.
3. **OPS-G3**: run tag (8 characters `[a-z0-9]`, e.g. MMDDHHmm) → `GET /organizations/e2e-ops-<tag>` 404 and no tenant `e2e-ops-<tag>-*`; list older `e2e-ops-*` leftovers for the operator (never delete them automatically).
4. **OPS-G4**: CPU logs in once (`node scripts/harness/app.mjs <env> "<CPU login>" <script> <out> --app customer-portal`, ≤ 1 submission); role names recorded.

## O2 — tools for OPS-20, OPS-23, OPS-22

1. `npx playwright install firefox webkit` once on the runner's machine (OPS-20 step 3); failure → note it, OPS-20 step 3 will be BLOCKED.
2. OPS-23 part A (operator): a scratch copy of the ops frontend from master **without any git write** — `git -C <cloud checkout> archive origin/master polypoint-portal/polypoint-portal-ops-frontend | tar -x -C <scratch>` — then in `<scratch>/polypoint-portal/polypoint-portal-ops-frontend`: `npm ci`, `npx playwright install chromium`, and the suite command of `../references/scenarios.md` OPS-23 with `E2E_BASE_URL`, `E2E_USERNAME`, `E2E_PASSWORD` exported in the operator's own terminal (never in a prompt). The report path → run config `SUITE_REPORT` (else `none`). Never two suite runs at once.
3. OPS-22: only when the user names single-role CT ops accounts — each signs in headed once into its own profile; run config `OPS_ROLE_PROFILES` = `SUPPORT=<dir> OPERATIONS=<dir> POLYPOINT_EMPLOYEE=<dir> DATA_ANALYST=<dir>`; else `none`.
4. OPS-14 part B: ask the operator; `MASTER_FLAG_OK` = `yes` / `no`.

## Run config values

`PORTAL_PROFILE`, `POMA_OPS_PROFILE`, `PORTAL_ORG`, `RUN_TAG`, `IGNORES_BASELINE`, `OPS_ROLE_PROFILES`, `SUITE_REPORT`, `MASTER_FLAG_OK`; employees CPU (+ TA from `kits/<env>`); then `python3 -I scripts/gen-prompts.py results/<run>/ops/run-config.json --group ops --claims results/<run>/ops/claims.json`.
