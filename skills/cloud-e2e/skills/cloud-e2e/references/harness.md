# Harness — CLI contracts, host guard, redaction

Every helper a worker, a runner or the steward calls. Paths are relative to the skill folder (`{{SKILL_DIR}}`). The usage line
in each script header is the same contract in short. Offline self-test of everything below (no network):
`node scripts/harness/tests/run-tests.mjs`.

## 1. Overview

| helper                                   | for                                                                                         | replaces / extends                                                                                                                 | live status                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `scripts/harness/app.mjs`                | myPP web, POMA planner web app (+ BADI, partner simulator, POMA ops pages), customer portal | UTR `mypp.mjs`; booking H1 `poma.mjs`, swap / pool-sp H-1, booking H2 (console), pool-sp H-3 (downloads), hp H-HPN-1 (token entry) | myPP path verified (UTR runs); poma / customer-portal / token entry unverified |
| `scripts/harness/mypp.mjs`               | myPP web (UTR)                                                                              | wrapper = `app.mjs --app mypp`                                                                                                     | verified (UTR)                                                                 |
| `scripts/harness/mypp-inapp.mjs`         | myPP in-app login path (cordova shim)                                                       | UTR file, now on the shared core                                                                                                   | verified 2026-10-14 (UTR MO)                                                   |
| `scripts/harness/e2e-lib.mjs`            | helpers for worker scripts                                                                  | generic part of UTR `utr-lib.mjs` + `roles`, `ncSince`, `waitFlag`, `byId`, `dialogText`                                           | UTR part verified; new helpers unverified                                      |
| `scripts/harness/portal-ops.mjs`         | PolyPortal ops: flags, tenant, partners, jobs, health, audit; script mode                   | booking H3 `portal-read`, swap H-2, partner `portal-partner`, ops H-OPS-1, pool-sp H-5                                             | unverified                                                                     |
| `scripts/harness/portal-flag.mjs`        | one tenant flag through the ops UI (UTR P-03)                                               | wrapper over `lib/portal.mjs` (same UI flow)                                                                                       | string path verified (UTR); boolean path unverified                            |
| `scripts/harness/polyid-admin.mjs`       | PolyID ops: provider / user reads and writes, audit, applied policies, steward unlock       | `polyid-unlock.mjs`, auth H-AUTH-2, hp H-HPN-2, partner HP-5                                                                       | unverified                                                                     |
| `scripts/harness/polyid-unlock.mjs`      | lockout read / unlock (UTR)                                                                 | wrapper = `polyid-admin.mjs applied-policies / unlock`                                                                             | unverified (as before)                                                         |
| `scripts/harness/polyid-flow.mjs`        | PolyID login flows without auto-login (auth)                                                | auth H-AUTH-1                                                                                                                      | unverified                                                                     |
| `scripts/harness/partner-api.mjs`        | partner tokens, Partner-API / full-sync calls, partner-sessions                             | partner HP-1                                                                                                                       | unverified                                                                     |
| `scripts/harness/pwa-embed.mjs`          | partner PWA embedding mock                                                                  | partner HP-2                                                                                                                       | unverified                                                                     |
| `scripts/harness/gwmock.mjs`             | gateway-mock received bookings / strategies                                                 | partner HP-3                                                                                                                       | unverified                                                                     |
| `scripts/pp-plan.sh`                     | paint / delete one cell through api-pp (no PEP desktop)                                     | swap H-4, booking / partner / planner paints                                                                                       | **unverified — first live use must verify** (§5.1)                             |
| `scripts/plan-day.sh`                    | PEP planning rows of one employee and day                                                   | swap H-3                                                                                                                           | unverified (plain SELECT)                                                      |
| `scripts/api-pp.sh`                      | api-pp calls with the box service token                                                     | booking H4, hp H-HPN-3                                                                                                             | token / avail pattern from UTR `oracles.md` §1; script unverified              |
| `scripts/pep/pe-ready.sh`, `pe-paint.sh` | PEP session ready state, one-cell PEP paint                                                 | moved unchanged from UTR                                                                                                           | verified (UTR)                                                                 |
| `scripts/seed/common/*.sql`              | steward kits, kit memberships                                                               | swap S2, booking P2/P4, pool-sp R1–R5, partner P-PTN-6, auth A4                                                                    | unverified (`seed/common/README.md`)                                           |

Shared internals (not called directly): `scripts/harness/lib/{guard,redact,util,session,portal}.mjs`.

## 2. Rules for every helper

- **Playwright** is resolved from `$DM_CONFIG_DIR` (default `~/.config/deploymate`, installed by the deploymate skill).
- **Profiles** (persistent Chromium user-data dirs) live outside `results/`: `$MYPP_PROFILES` (default `./profiles`) for app logins,
  an explicit `<profileDir>` for ops sessions. Ops sessions are personal (portal ops / PolyID ops account of the person running
  the step), signed in headed with the `login` action, ≈ 1.5 h.
- **Credentials** never appear in a prompt, row, brief or file under `results/` (hard rule 7):
  - seed password: `$DM_CONFIG_DIR/<env>.test-data.json` (`manifest.loginPassword`, from `dm-api.sh test-data` / `dm-join.sh`);
  - shared tenants (ct-zinc-master, Preview): `--cred-file <file>` = 0600 JSON `{"tenant": "<id>", "users": [{"login", "email", "password"}]}`, created by the person from their vault — a file with group/other bits is refused;
  - api-pp service secret: a 0600 file from your own vault access (§5.3);
  - partner client secret: read in memory through the portal ops session (`partner-api.mjs`), never saved;
  - TOTP secrets, mail links, SMS codes: in memory (a mail link may go to `<outdir>/.mail-link`, 0600, deleted after use).
- **Password budget** (hard rule 4): at most 2 password submissions per login and harness call; `polyid-flow.mjs` enforces a
  budget and refuses WRONG passwords unless the login is named by `--allow-wrong`. PolyID locks the caller IP per provider
  without expiry; unlock = steward only.
- **Exit codes** (common meaning): 0 ok · 1 script error · 2 usage (or "not found" where stated) · 3 LOGIN_NEEDED · 4 usage
  (portal) / change not applied (PolyID, gateway mock) · 5 guard refusal · 6 HTTP error (403 = missing rights) · 7 staging.
- **Never** from a helper: `/test/**` on portal-api / polyid-login / event-handler / poma-api, GAT `clean` / `shift-trades`,
  untargeted or Tier B / D jobs, cache resets, actuator `env` / `configprops` / `heapdump`, edits of non-`e2e-*` partners,
  gateway-mock inbox DELETE.

## 3. Host guard (`lib/guard.mjs`)

| stage                    | allowed hosts                                                                  | how                                                                              |
| ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `ct` (default)           | `ct-*.dev.k8s.polypoint-dev.com` (and `ct-*.k8s.polypoint-dev.com`)            | always                                                                           |
| `preview`                | `preview-*.demo.k8s.polypoint-dev.com` (and `preview-*.k8s.polypoint-dev.com`) | only with `--stage preview` (e.g. the shared group's SWP-20 on `pre-dev-main24`) |
| `staging`, anything else | —                                                                              | refused (`polyid-admin` / `polyid-unlock` print manual instructions, exit 7)     |

Refused always: `*.polypointservices.ch` (Staging / Production cluster), host names containing `prod` or `staging`, `http:`,
explicit ports, credentials in URLs, `/test/**` paths (except the three gateway-mock paths of `gwmock.mjs` / `pwa-embed.mjs`:
`/test/received-bookings`, `/test/booking-response-strategy`, `/test/cancel-booking-response-strategy`), `/gat/clean`,
`/gat/shift-trades`. Every env override (`MYPP_URL`, `POMA_API_URL`, `PORTAL_URL`, `PORTAL_API_URL`, `POLYID_LOGIN_URL`,
`KEYCLOAK_URL`, `GWMOCK_URL`, `HYDRA_URL`) is guarded too. Browsers additionally abort any request to a production host or a
forbidden path. Bash helpers (`api-pp.sh`) accept only `localhost` / `127.0.0.1` (tunnels) and `*.deploymate.polypoint.dev`.

CT bases (from the frontends' `environment.ct.ts`): POMA webapp `https://ct-poma-webapp.dev.k8s.polypoint-dev.com` (myPP under
`/health-professional-app`, planner `/shift-planner`, POMA ops `/ops/`), poma-api `https://ct-poma-api.dev.k8s.polypoint-dev.com`,
portal `https://ct-portal-webapp.dev.k8s.polypoint-dev.com` (`/ops`, `/portal`), portal-api `https://ct-portal-api.dev.k8s.polypoint-dev.com`,
polyid-login + PolyID ops `https://ct-polyid-login.dev.k8s.polypoint-dev.com` (`/ops`), Keycloak `https://ct-keycloak.dev.k8s.polypoint-dev.com`,
gateway mock `https://ct-poma-gateway-mock.dev.k8s.polypoint-dev.com`. Preview: placement / portal / portal-api / polyid-login /
iam / gateway-mock hosts are built in; the Preview poma-api must be given with `POMA_API_URL`.

## 4. Redaction (`lib/redact.mjs`)

Applied to every `api/NNN-*.json`, `api-index.jsonl`, `result.json` and every helper JSON output.

| what                                                                                                                                                                                                      | rule                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| keys named like a secret (`access_token`, `refresh_token`, `id_token`, `token`, `*Token`, `client_secret`, `*Secret`, `password`, `*Password`, `otp_secret`, `authorization`, `cookie`, `credentials`, …) | value → `"[redacted]"` (boolean / metadata keys such as `token_type`, `hasPassword`, `showResetPasswordButton`, `password_strength_level` stay)                                                                                             |
| any string containing a JWT                                                                                                                                                                               | the JWT → `"[redacted-jwt]"`; `Bearer …` → `Bearer [redacted]`; `password=…` / `client_secret=…` inside strings → `[redacted]`                                                                                                              |
| URLs                                                                                                                                                                                                      | query parameters `access_token`, `token`, `id_token_hint`, `client_secret`, `password`, `login_challenge`, … → `[redacted]`; `code` only on auth redirects (`state` present or an auth path) — the portal feature API's `code=<flag>` stays |
| request bodies                                                                                                                                                                                            | JSON → deep rule; form bodies → secret fields `[redacted]`                                                                                                                                                                                  |
| `…/consumer-service-account-credentials`, `…/producer-service-account-credentials`, client-secret endpoints, `/support-token`                                                                             | body not recorded (marker + byte count)                                                                                                                                                                                                     |
| actuator `env` / `configprops` / `heapdump` / `threaddump`                                                                                                                                                | body not recorded (the portal helper never even requests them)                                                                                                                                                                              |
| PolyID `/api/auth/*`                                                                                                                                                                                      | request and response bodies not recorded; `/ui/login-form                                                                                                                                                                                   | 2fa-form | password-management/submit`, `/ui/impersonation/\*`: request body not recorded |
| token endpoints (`…/openid-connect/token`, `/api/partner/<tenant>/token`)                                                                                                                                 | body not recorded; decoded claims (header + payload) may be saved by `partner-api.mjs`                                                                                                                                                      |
| licence `raw_xml`                                                                                                                                                                                         | `"sha256:<hex>"`                                                                                                                                                                                                                            |
| log files, ZIP / PEP-config exports                                                                                                                                                                       | `{bytes, lines}` only                                                                                                                                                                                                                       |
| screenshots                                                                                                                                                                                               | PolyID: `.otp-img`, `.qr_code`, `#otp_secret`, `.copy-secret-container`, `.otp-setup-container` masked; portal ops: `.code` spans (Tenant Details client id / secret), phone fields of "Test Send Messages" masked                          |

What is recorded per helper: `app.mjs` — `/api/` responses of the app's API host (poma-api; customer portal: portal-api); never
PolyID. `portal-ops.mjs` — portal admin / business / v1 / v2 API responses. `polyid-flow.mjs` — app API + polyid-login `/api/`.
`polyid-admin.mjs` writes its own result files only.

## 5. Contracts

### 5.1 `app.mjs` (+ `mypp.mjs`, `mypp-inapp.mjs`)

```
node scripts/harness/app.mjs <tenant> <login> <script.mjs|-> <outdir> [--app mypp|poma|customer-portal] [--stage ct|preview]
     [--headed] [--mobile] [--downloads] [--console info] [--token-entry <url>] [--cred-file <file>]
node scripts/harness/mypp.mjs <tenant-id> <login> <script.mjs|-> <outdir> [--headed] [--mobile]        (= --app mypp, UTR CLI)
node scripts/harness/mypp-inapp.mjs <tenant-id> <login> <script.mjs|-> <outdir> [--headed]              (in-app login path)
```

- `<tenant>` = DeployMate env id (`^[a-z][a-z0-9-]{0,14}$`); shared tenants need `--cred-file` (`^[a-z][a-z0-9-]{0,62}$`).
- Login: PolyID web pages (step 1 e-mail `<ascii login>@<tenant>.ch` or the cred-file e-mail / `MYPP_EMAIL`, step 2 IDM login +
  password, consent, "allow myPP" modal). **Logged in** = mypp: URL `/tabs/` or `health-professional-app`; poma: `/shift-planner/`,
  `/pool-manager/`, `/tenant-admin/`, `/invalid-user`, `/badi`, `/partner-simulator` — or myPP for an HP-only user — after a
  poma-api call with a bearer (`result.landing` = the landing path, the role-landing oracle); customer-portal: `/portal/…` after a
  portal-api call with a bearer. Entry: mypp `/`, poma `/` (`POMA_ENTRY` overrides), customer-portal `/portal/` (`PORTAL_ENTRY`).
- `mypp-inapp.mjs` = the app's own in-app forms (Pixel 7 UA, 390 px, touch, `window.cordova = {}`); `--mobile` on `app.mjs` /
  `mypp.mjs` only emulates the device on the **browser** login path.
- Profiles: `<MYPP_PROFILES>/<tenant>-<login>` (+ `-mobile`), `-inapp`, `-poma`, `-portal`, `-token`.
- Script: `export default async ({page, ctx, out, shot, log, api, env, envId, login, MYPP, APP, app, stage, urls, POMA, PORTAL}) => result`.
  `api.token()` (bearer, memory only), `api.call(method, path|url, body)` / `api.get(path)` (guarded, recorded with `direct: true`),
  `api.wait(frag)`, `api.goto(path, waitFrag)` (`/tabs/…` → myPP SPA, other paths → webapp root; the tour is dismissed),
  `api.dismissTour()`, `api.seen(frag)` (last app-host URL containing frag, e.g. `/config/features`), `api.download(action, name)`
  (`--downloads`: saves under `<outdir>/downloads/`, returns `{file, bytes, lines}`). `shot(name, {mask, fullPage})` → `NN-<name>.png`.
- `--console info`: console `info` / `log` lines go to `harness.log` (`CONSOLE-INFO`) and `console.jsonl` (simulatePEP bridge lines).
- `--token-entry <url>`: no PolyID form; the URL (with its token) is guarded and never logged; logged in when the app reaches a
  `flows/` or `tabs/` route.
- Files: `harness.log`, `api/NNN-<METHOD>-<path>.json` + `api-index.jsonl` (redacted), `result.json` `{env, envId, login, user,
loggedIn, url, script}` (+ `app, stage, landing` for poma / customer-portal), screenshots, `login-failed.png/.html` (input values
  masked). Exit 0 even when the login failed: read `result.loggedIn`.
- Env: `MYPP_URL`, `POMA_API_URL`, `PORTAL_URL`, `PORTAL_API_URL`, `MYPP_PROFILES`, `MYPP_EMAIL`, `MYPP_USER_FORMAT=email`,
  `MYPP_TRACE` (logs every non-static response, secrets masked), `POMA_ENTRY`, `PORTAL_ENTRY`, `DM_CONFIG_DIR`.

### 5.2 `e2e-lib.mjs`

`import { … } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'`

| function                                                          | does                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tour(page)`, `leaveTutorial(page, log)`                          | dismiss the myPP welcome tour / page through the onboarding tutorial                                                                                                                       |
| `go(page, api, log, path, frag)`                                  | `api.goto` with a tutorial retry                                                                                                                                                           |
| `act(page, method, frag, action)`                                 | run a UI action, return the first matching response `{status, url, method, requestBody, body}`                                                                                             |
| `alertText(page)`                                                 | text of a visible myPP error dialog (UTR filter); else the last visible Material dialog / snackbar                                                                                         |
| `dialogText(page)`                                                | text of the last visible Material dialog / snackbar (planner app, portal ops)                                                                                                              |
| `stepper(log)`, `save(out, name, obj)`, `dumpButtons(page)`       | step log, JSON save, visible buttons                                                                                                                                                       |
| `issueShot(page, out, name, target, {fullPage, mask})`            | red outline on `target`, `<out>/ISSUE-<name>.png` (FAIL / KNOWN-FAIL / BLOCKED-by-error evidence)                                                                                          |
| `jsonShot(page, out, name, {request, status, expected, excerpt})` | render an API failure as `ISSUE-<name>.png` (no secrets in `excerpt`)                                                                                                                      |
| `issueName(name)`                                                 | normalised issue name; throws on empty / `undefined` parts                                                                                                                                 |
| `roles(api)`                                                      | `{ok, roles, byClient}`: role names of the captured bearer, decoded in memory (gate G-ROLES, PSP-G1)                                                                                       |
| `ncSince(api, iso, {type, objectId, path})`                       | notification-center items created at / after `iso` (default HP NC `/api/mobile/health-professional/v1/notifications`; planners pass `path`), filtered by type and object id                |
| `waitFlag(api, code, value, maxMin, {path, everySec, log})`       | poll a fresh `config/features` read (the app's own last request via `api.seen`, or `path`) until `code` = `value`; `{ok, value, polls, minutes}` (portal cache ≈ 3 min + POMA reload 60 s) |
| `byId(json, path, id)`                                            | element of the array at a dotted path whose `id` / `*_id` / `*Id` equals `id`                                                                                                              |

### 5.3 `portal-ops.mjs` (+ `portal-flag.mjs`)

```
node scripts/harness/portal-ops.mjs <profileDir> <script.mjs|-> <outDir> [--base ops|poma-ops|customer] [--stage ct|preview] [--headed] [--dialogs '<json>']
node scripts/harness/portal-ops.mjs <profileDir> <cmd> <outDir> [cmd args…] [options]
node scripts/harness/portal-ops.mjs <profileDir> "<cmd> <args…> [options]" <outDir>          (quoted form; inner quotes and flags allowed)
```

| command                                                   | effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | output                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `login`                                                   | headed; the operator signs in; waits ≤ 5 min for an authenticated admin call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | profile session                                                                                               |
| `flag read <tenant> <code>`                               | `GET /api/private/admin/features/tenants/<tenant>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `flag-read.json` (exit 2 if absent)                                                                           |
| `flag set <tenant> <code> <value>`                        | `PUT …?code=&value=`, re-read; screenshot of the row when the organisation resolves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `flag-set.json` `{before, after, applied}` (exit 5 not applied)                                               |
| `flag delete <tenant> <code>`                             | remove the tenant override (= restore to master)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `flag-delete.json`                                                                                            |
| `tenant read <tenant>`                                    | tenant row, services, IPs, licence (raw_xml hashed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `tenant-<tenant>.json`                                                                                        |
| `partner create <id> --spec <file>`                       | `POST /integration-partners` with the IntegrationPartner JSON of the spec (`id`, `name`, `active`, `subscription_config_list`, `tenant_access_list`, `contacts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `partner-create-<id>.json`                                                                                    |
| `partner delete <id>`                                     | delete, verified by a list read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `partner-delete-<id>.json`                                                                                    |
| `partner logging on                                       | off <id>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `PUT /integration-partners/<id>/logs {enabled}` (Debug tab); remember: every partner edit wipes the Debug log | `partner-logging-<id>.json` |
| `partner logs <id> [--since ISO] [--count N] [--pages P]` | Debug-tab events (default since 24 h, 100 × 5 pages)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `partner-logs-<id>.json`                                                                                      |
| `partner secret-to-mem <id>`                              | proves the client secret is readable (length only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                                                                                                             |
| `job list <service>`                                      | jobs + arguments of a monitored service                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `jobs-<service>.json`                                                                                         |
| `job run <service> <job> --tenant <id>`                   | Tier T (poma-core `ResyncEmployeesWithNoEmployments`, `AvailabilityConflictChecker`, `EmploymentExpiration`, `ResyncUserEmployments`, `UsersSync`): `--tenant` mandatory, must be an env this machine joined (`$DM_CONFIG_DIR/<id>.test-data.json`), the job must offer `tenantIds`. Tier A (portal-core `LoadTenantVersions`, `TenantHealthEventJob`; event-handler `PluginTableMaintenanceCronJob`; polyid-login `DeleteExpiredTwoFactorAuthCodesJob`, `RefreshJsonWebKeysJob`; conflict-checker `FindAbandonedSyncJobs`, `ProcessTeamRoster*MetricsCronJob`): only with `--window S-CT-JOBS`. Everything else refused | `job-run-<job>.json` (success = counters, script `metricSum`)                                                 |
| `health <tenant> [--force]`                               | `GET /health?tenantIds=<tenant>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `health-<tenant>.json`                                                                                        |
| `audit [--tenant <id>] [--since ISO]`                     | portal audit logs (tenant / global + user management)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `audit*.json`                                                                                                 |

- `partner …` accepts only `e2e-*` ids (the run partner `e2e-ptn-<run>` and throw-aways); it never edits a shared partner.
- `flag set` refuses `poma.internalPool.sendEmailConfirmation=true` and `poma.msTeams.notifications=true` without `--allow-messaging`.
- Organisation slug for screenshots: `--org`, else `PORTAL_ORG`, else resolved from `GET /organizations?expand=tenants`.
- Script mode: `export default async ({page, ctx, out, shot, log, api, section, select, pods, actuator, metricSum, routeAbort, urls, base, org})`;
  `api.call(method, path, body)` relative to `<portal-api>/api/private/admin`; `section(org, tenant, key)` → tenant editor tab;
  `select(label, optionText)` → `mat-select` by `mat-label`; `pods(service)` → `[{name, ip}]`; `actuator(service, podIp, endpoint)`
  (GET only; refuses env / configprops / heapdump / threaddump); `metricSum(service, name, tag)` → `{sum, per}` over all pods;
  `routeAbort(pattern)`. Writes `result.json`.
- `--dialogs '[{"prompt":"DELETE"},{"confirm":true}]'` answers prompt / confirm dialogs in order (unanswered ones are dismissed);
  alerts are accepted; every text goes to `dialogs.log`.
- Files: `portal-ops.log`, `api/NNN-*.json`, `api-index.jsonl`, `dialogs.log`, the command JSON. Exit: 0, 2 not found,
  3 LOGIN_NEEDED, 4 usage, 5 guard / not applied, 6 HTTP error.

`portal-flag.mjs` keeps the UTR CLI and UI flow (string flags verified; boolean toggle path unverified — prefer `portal-ops.mjs flag`):

```
PORTAL_ORG=<org slug> [PORTAL_FEATURE=<code>] node scripts/harness/portal-flag.mjs <profileDir> <outDir> <tenant-id> <login|read|set|delete> [value]
```

### 5.4 `polyid-admin.mjs` (+ `polyid-unlock.mjs`)

```
node scripts/harness/polyid-admin.mjs <profileDir> <outDir> <tenant-id> <cmd> [args] [--stage ct|preview|staging] [--provider <id>] [options]
node scripts/harness/polyid-unlock.mjs <profileDir> <outDir> <tenant-id> <login|read|unlock> [--subject <ip|username|my-ip>] [--provider <id>]   (UTR CLI)
```

| command                                 | API (`<polyid-login>/api/admin`)                                                                            | who                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------ |
| `login`                                 | headed sign-in to `/ops/security`                                                                           | operator                        |
| `applied-policies`                      | `GET /applied-policies/provider/<id>?exceeds-threshold=true`, summary, thresholds → `applied-policies.json` | anyone with ops rights          |
| `unlock --subject <ip                   | username                                                                                                    | my-ip>`                         | `DELETE /applied-policies/provider/<id>?subject=<one exact subject>`, re-read                                                                                     | **steward only** (the DeployMate owner of `<tenant>`, checked via `dm-api.sh get` / `token`) |
| `provider-read`                         | `GET /providers/<tenant>` → `provider.json` (clientSecret redacted)                                         | anyone                          |
| `provider-2fa <DISABLED                 | TOTP                                                                                                        | MOBILE_OR_EMAIL> --window <id>` | `PUT /providers/<tenant>` with `capabilities.twoFactorType` changed (refused when the GET returns a masked secret) → `provider-2fa.json` with the restore command | config-window owner (W-Y-TENANT2FA)                                                          |
| `user-read <username>`                  | `GET /users?tenant-id=&username=` → `user-<username>.json`                                                  | worker owning the actor         |
| `user-2fa <username> <DEFAULT           | DISABLED                                                                                                    | TOTP                            | MOBILE_OR_EMAIL>`                                                                                                                                                 | `PUT /users/<id>/2fa {twoFactorType}` (DEFAULT = null)                                       | owner of the actor |
| `reset-otp <username>`                  | `DELETE /otp/<polyId>`                                                                                      | owner of the actor              |
| `user-state <username> <ACTIVE          | BLOCKED                                                                                                     | DISABLED                        | TEMPORARY_BLOCK> --reason <text>`                                                                                                                                 | `PUT /users/<id>/state`                                                                      | owner of the actor |
| `revoke-sessions <username>`            | `DELETE /hydra/sessions?subject=`                                                                           | owner of the actor              |
| `reset-teams-link <username>`           | `DELETE /msTeams/<tenant>/<tenantSubject>`                                                                  | owner (manual / shared windows) |
| `reset-partner-link <username>`         | `DELETE /users/<id>/partner-link`                                                                           | owner (W-SH-ANTBE)              |
| `audit [--since ISO] [--target-type T]` | `GET /audit-logs?tenant=` → `audit.json`                                                                    | anyone                          |

User writes re-read the user and exit 4 when the change is not visible; outputs `<cmd>-<username>.json` `{before, after, applied}`.
A never-logged-in user has no PolyID record (exit 2). `polyid-unlock.mjs` maps `read` → `applied-policies`, logs to
`polyid-unlock.log` and skips the owner check (legacy orchestrator entry point; only the steward's brief names it).

### 5.5 `polyid-flow.mjs`

```
node scripts/harness/polyid-flow.mjs <tenant-id> <login|-> <script.mjs> <outdir> [--app mypp|poma|portal|inapp] [--fresh | --profile <dir>]
     [--headed] [--stage ct|preview] [--max-password-submits N] [--allow-wrong <login>] [--grant-clipboard] [--cred-file <file>]
```

Fresh incognito context by default. Script: `export default async ({page, ctx, out, shot, log, api, polyid, env, envId, login, MYPP, APP, POMA, PORTAL, urls, app, stage})`.
`polyid.open([app])` · `onboard([email])` · `password('SEED'|'WRONG')` · `errors()` → `{errors, warnings, texts}` ·
`readOtpSecret()` (memory only) · `totp(secret)` · `submitOtp(code)` · `consent('accept'|'reject')` · `chain()` · `state()`.
Budget: 2 submissions by default; more only with `--allow-wrong <the same login>` (AUT-05 inside W-Y-LOCKOUT). `result.json`
carries `submissions`, `wrong`, `wrongWithoutSuccess` (true = the last submission was WRONG: follow with a SEED success from the
same IP). `chain.json`: host + path + parameter names; values only for `errors`, `warnings`, `language`, `providerId`; presence
flags for `code`, `state`, `id_token_hint`, `login_challenge`, `consent_challenge`, `logout_challenge`.

### 5.6 `partner-api.mjs`

```
node scripts/harness/partner-api.mjs <partner-id> <outdir> token client --portal-profile <dir>
node scripts/harness/partner-api.mjs <partner-id> <outdir> token hp <tenant> <tenant-subject> [locale] --portal-profile <dir>
node scripts/harness/partner-api.mjs <partner-id> <outdir> call <METHOD> <[api:|portal-api:|pidl:]path | url> [--as client|hp:<tenant>:<subject>|none] [--body <file.json>] --portal-profile <dir>
node scripts/harness/partner-api.mjs <partner-id> <outdir> session <body.json>
node scripts/harness/partner-api.mjs <partner-id> <outdir> <script.mjs> --portal-profile <dir>
```

Client token: `<keycloak>/auth/realms/polypoint-polyportal-realm/protocol/openid-connect/token` (client_credentials, client
`event-consumer-integration-<partner-id>`, `--client-id` overrides; secret read in memory through the portal ops profile, ADMIN,
`e2e-*` partners only). HP token: `POST <polyid-login>/api/partner/<tenant>/token {"tenant_subject", "locale"}`. Saved:
`claims-client.json`, `claims-hp-<n>.json` (header + payload), `api/NNN-*.json` (redacted), `session-NNN.json` (partner-sessions
evidence, JWTs redacted). Script: `export default async ({tokens: {client(), hp(tenant, subject, locale)}, call(method, url, {as, body}), claims(token), save, log, out, urls, partnerId})`.
Full sync example: `call GET portal-api:/api/v2/events/consumer/<env>/users?cursor=0&page-size=20`.

### 5.7 `pwa-embed.mjs` and `gwmock.mjs`

```
node scripts/harness/pwa-embed.mjs <outdir> <script.mjs|-> [--stage ct|preview] [--headed] [--profile <dir>] [--mock-path <path>]
node scripts/harness/gwmock.mjs <outdir> received [--tx <id,id,…>]
node scripts/harness/gwmock.mjs <outdir> strategy get
node scripts/harness/gwmock.mjs <outdir> strategy set <booking|cancel> <STRATEGY> --lock <locks/ct~gwmock doc version> --window S-CT-GWMOCK
```

- `pwa-embed.mjs` opens `<gateway-mock>/partner-pwa-embedding-mock/` in a fresh context, writes `partner-sessions.json`
  (request, status, outcome, decoded claims; never the token) and the embedded myPP's poma-api responses. Script:
  `({page, ctx, out, shot, log, frame, myppFrame, sessions, claims, urls})`. The mock only knows ct-zinc-master users
  (`antbe` = `code_challenge_3`, `aermo` = `code_challenge_4`); answering `POLYPOINT-AUTH-INIT` for another tenant is not implemented.
- `gwmock.mjs`: strategies booking `SUCCESS|CONFLICT|GENERIC_ERROR|HTTP_500`, cancel `SUCCESS|DEADLINE_PASSED|GENERIC_ERROR|HTTP_500`
  (body `{"strategy": …}`, as the partner simulator sends it); `set` only by the holder of `locks/ct~gwmock` inside S-CT-GWMOCK,
  restore = `SUCCESS`, GET-verified (exit 4 when the re-read differs). Never DELETE the inbox, never restart the mock.

### 5.8 `pp-plan.sh` — UNVERIFIED, first live use must verify

```
scripts/pp-plan.sh <env> <emp MA_ID> <YYYY-MM-DD> <defId PA_CODE | -> FULL|LEFT|RIGHT|DELETE        (ON_CALL also accepted)
```

- FULL / LEFT / RIGHT / ON_CALL: `POST /pp-api-personnel-planning/api/v2/direct-shift-planning/<defId>/<emp>/<date>/<position>`
  body `$PP_PLAN_BODY` (default `{}`) — "plan a shift and remove or create temporary assignments and previous planning".
- DELETE: `DELETE /api/v2/delete-shift-planning/<emp>/<date>/<position>` body `{}`, position `$PP_DELETE_POSITION` (FULL);
  `<defId>` = the PA code the cell must hold before (refused otherwise) or `-`.
- Every call: `plan-day.sh` snapshot → `api-pp.sh raw` → snapshot → verdict; files under `$PP_OUT` (default `./pp-plan`).
  Exit 0 applied + verified · 1 2xx but the cell did not change (stamped day or allowances: paint in PEP) · 2 usage · 3 HTTP error
  · 4 secret / token · 5 guard · 6 2xx but no DB read-back (no SSH).
- **Verification (steward, S1 step 8, once per env):** on a spare, claimed employee, a free future day: `pp-plan.sh <env> <emp> <day> 113 FULL`
  → exit 0 and `plan-day.sh` shows `PA=113`; a half cell (`… 111 LEFT`) → note the `POS` / `TEIL` codes PEP writes; then
  `… 113 DELETE` (FULL) and `… 111 DELETE` with `PP_DELETE_POSITION=LEFT` → the day is empty; one PEP screenshot of the cells
  (PEP lock). Record outcome and codes in `kits/<env>`. Until then (and whenever it exits 1) paint with `scripts/pep/pe-paint.sh`
  under the PEP lock. Only own claimed employees and days (hard rule 5).

### 5.9 `plan-day.sh` and `api-pp.sh`

```
scripts/plan-day.sh <env> <emp> <YYYY-MM-DD>
  → PL|<PLANUNG_ID>|<date>|PA=<code>|POS=<DIENSTPOSITION>|TEIL=<DIENSTTEIL>|NODE=<KNOTEN_ID>|SOLL=<s>|TYP=<P/A/I>|<title>   or "(no rows)"
scripts/api-pp.sh <env> avail <emp> <from> <to>          POST /api/v2/poma-availability-info/employee-ids/range/<from>/<to>  [<emp>]
scripts/api-pp.sh <env> timesheet <employment> <YYYY-MM> GET $APIPP_TIMESHEET_PATH ({employment}, {month}); path to be found with `paths`
scripts/api-pp.sh <env> raw <GET|POST|PUT|DELETE> <path> [json|@file]
scripts/api-pp.sh <env> paths [filter]                   OpenAPI paths (GET /v3/api-docs)
scripts/api-pp.sh <env> token-check                      client id + expiry of a fresh token (never the token)
```

- `plan-day.sh` is read-only SQL through `sql.sh` (SSH). Exit 0 (rows or `(no rows)`), 2 usage, 3 `sql.sh` failed (never reported
  as `(no rows)`). Identify plannings by employee, day, PA code and position, never by id.
- `api-pp.sh`: service client `polypoint-p4-api-personnelplanning` (`APIPP_CLIENT_ID`), realm `POLYP01`, token minted per call
  (60 s). Secret file: `$APIPP_SECRET_FILE`, else `$DM_CONFIG_DIR/<env>.apipp-secret`, else `$DM_CONFIG_DIR/apipp-service-secret`
  (first line, mode 600 / 400; from your own vault access — a runner without vault access asks a runner who has it, OQ-11). The
  secret goes to curl on stdin, the token through a `/dev/fd` header file (not visible in `ps`). Endpoints: box Traefik
  `http://<box>:9090/pp-api-personnel-planning` + Keycloak `https://<box>:8383` from an allowlisted IP (`<box>` = `.db.host` of the
  credentials file or `DM_HOST`), or tunnels with `APIPP_TUNNEL=<digit>`; overrides `APIPP_BASE`, `KC_BASE`. `APIPP_OUT=<dir>`
  saves response copies. Exit 0 2xx · 2 usage · 3 HTTP ≥ 300 · 4 secret / token · 5 guard.

### 5.10 PEP helpers (moved unchanged from UTR)

`scripts/pep/pe-ready.sh <tenant-id>` and `scripts/pep/pe-paint.sh <tenant-id> <emp> <YYYY-MM-DD> <want_pa> <radio_y> <slot_x> <slot_y> <row_y>`
— contracts in their headers (they call `scripts/pep.sh` and `scripts/sql.sh`). Their headers still name the UTR lock file; in
cloud-e2e runs the PEP lock is the db document `locks/<env>~pep` (coordination.md, agent brief), held around every call.

### 5.11 Common seed SQL

`scripts/seed/common/README.md`: who runs `audit.sql`, `rights.sql`, `r0-root-rows.sql`, `stamm-fix.sql`, `definitions-kit.sql`,
`role-kit.sql`, `kit-member.sql`, `verify-kits.sql`, `psc-batch.sql`, with parameters, kit groups, gates and the
"PEP - Leitbediener" seed trap.
