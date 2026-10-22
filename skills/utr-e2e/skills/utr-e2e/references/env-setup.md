# Environment setup — the on-prem bundle under test on CT (optional compare environment)

## 1. Topology (one tenant per bundle, one cloud)

- api-gateway ships INSIDE the on-prem bundle together with api-pp, P2/PEP and Oracle (ansible role `windows/jobs/api-gateway`, artifact `apigateway.jar` per release line). The cloud (CT master: poma-core, myPP) reaches a tenant's api-gw through portal-tenant-access (`apigw-{tenantId}` service). So the bundle under test = one tenant on the shared CT cloud; the optional `--compare` overlay adds a second tenant (another bundle) on the same cloud.
- The cloud derives on-prem capabilities from the tenant's stored bundle version (portal job `LoadTenantVersions` → feature flag `general.bundle.version` → poma-core `OnPremReleaseVersion` → endpoint classes `V<maj>_<min>_<patch>`). The version string comes from api-gw `GET /api/v1/polypoint-versions/current`, which reads the Oracle table `ECBERN.POLYPOINTVERSION` (bundleVersion, p2Version). It is NOT the build number.
- Thresholds that matter: `UNIFIED_TIME_RECORDING` ≥ 26.0.2 (counted block/break writes), `LEGACY_IN_OUT_TIME_STAMP_ID` ≥ 26.0.4, `TIME_AMOUNT_TYPE` ≥ 25.0.11, `BENEFITS` / `CREDITED_TIME_FOR_TIME_STAMPS` / `PLANNED_TIME_FOR_*` ≥ 25.0.0, `GET_PLANNED_SHIFT_TIME_RANGE` ≥ 26.3.3, `TIMESHEET` ≥ 26.4.0. A version newer than every known implementation (e.g. 27.0.0) gets the newest implementation and all capabilities; an unparsable version → HTTP 500 `UNKOWN_ON_PREM_VERSION`; a version below an endpoint's minimum → HTTP 412 and empty day plans.

## 2. DeployMate facts (verified 2026-10-13 against repo `cloud/deploy-mate` @ 8264e0f and the live API)

The full procedure, API reference and helper scripts live in the `deploymate` skill (`dm-login-capture.mjs`, `dm-api.sh`, `references/api.md`, `references/environment.md`). This section keeps only what the UTR run needs.

- **What it is.** Self-service provisioner for on-prem test envs: Kotlin/Spring API + React SPA in the `ppcloud-dev` GKE cluster, namespace `deploymate`. API `https://deploymate-api.dev.k8s.polypoint-dev.com/api/v1`, SPA `https://deploymate.dev.k8s.polypoint-dev.com/ops/`. Each env = one GCE Windows VM (project `ppcloud-deploymate`) booted from the master track's hand-curated 26.99 image pair, driven through a DB-backed FSM: `PENDING → [BUILDING_PR_ARTIFACTS] → PROVISIONING_VM → WAITING_FOR_SSH → RUNNING_HEALTH_CHECK → CONFIGURING_CLOUD_TENANT → INSTALLING_NOMAD_CONSUL → INSTALLING_IDM → INSTALLING_SOLUTION → DONE` (failure sink `ERROR`, `POST /{id}/retry` resumes; `DELETE` → `CANCEL_REQUESTED → CLEANING_UP → DESTROYED`). Backlog/decisions live in Jira project `DM`.
- **Auth.** Every route needs `Authorization: Bearer <JWT>` from Keycloak realm `polypoint-polyid-realm` (`https://ct-keycloak.dev.k8s.polypoint-dev.com/auth/realms/polypoint-polyid-realm`) carrying realm role `ROLE_DEPLOY_MATE_USER` (create/manage own envs; `ROLE_DEPLOY_MATE_ADMIN` is read-only). The SPA's public client `deploy-mate-spa` allows ONLY authorization-code+PKCE and refresh_token (password and device grants are disabled — probed). Procedure: run the deploymate skill's `dm-login-capture.mjs` once (headed Chromium, the human signs in with "stay signed in" pre-set), it stores the offline refresh token in a 0600 file; `dm-api.sh` mints short-lived access tokens from it for the whole run. Alternative for unattended runs: a confidential client with client_credentials (`deploy-mate-automation` / `vinculum-fleet` exist; their secrets live in GCP Secret Manager `ppcloud-dev` — ask the secrets' owner before touching them). Never write a token into artifacts, dashboards or the skill.
- **Create request** (`POST /environments`, see the payloads in §2a): `id` (≤15 chars, `^[a-z][a-z0-9-]{0,14}$`, also the CT tenant id and the Oracle hostname), `track: "master"`, `version: "26.1.0"` (DeployMate's own prefill for master; the real bundle versions come from the ADO feeds), `stage: "CT"`, `onPremStage` null → DEV, `machineSize: DEFAULT` (n4d-standard-4), `p2Enabled: true`, `timeRecordingMode: UNIFIED` (sets `poma.mobileApp.timeRecording` + `poma.mobileApp.unifiedTimeRecording` on the tenant; `LEGACY` = unified OFF; switchable live via `PUT /{id}/time-recording {"mode":"LEGACY|UNIFIED"}` — this is how the Classic family C flips the flag without the portal UI), `seedConfig {preset:"customer-roster", peopleCount:40, includePalette:true, includeLoginUsers:true, includeRest:false}`, `ipAllowlist` (your public IP/32 — DeployMate also adds the office VPN CIDR; `POST /{id}/refresh-ip` re-applies the firewall when your IP changes), `sshPublicKeys` (≤5 OpenSSH lines → `pp-01` authorized_keys, SSH port 22), `emailDomain` null → `<id>.ch`, `ttlDays` (default 7, `POST /{id}/extend {"days":≤14}`, hard cap 30).
- **Pinning the bundle.** `masterBuildPins: {"PP_SERVICES": "0.0.N"}` pins an already-published `master-dev` feed version (no build; list them with `GET /master-builds?repo=PP_SERVICES&track=master`). `prSources: [{"repo":"PP_SERVICES","prId":12910}]` makes the env detour through `BUILDING_PR_ARTIFACTS`: DeployMate queues pp-services pipeline 401 on `refs/pull/12910/merge` with `publish_pr_env_artifacts=true`, the run publishes the whole artifact set (api-pp, api-gw, …) as `0.12910.<buildId>` into feed `pr-env-dev` (≈75–80 min, same duration as a master run; the master-only publish stages — Maven downstream publish, git tag, SaaS cohort — are skipped for PR-env builds, so the nightly master failures of 2026-10-12 do not apply). The PR must be active, non-draft and target master (12910 is). Create-time validation checks the PR and the pinned version against live ADO. P2 is master-latest at creation (with `--compare`, create both envs in the same hour) — leave it unpinned (the P2 pin version namespace differs per language installer).
- **Bundle version seen by the cloud (gate G1).** The version comes from the P2 installer's `ECBERN.POLYPOINTVERSION` row, NOT from the pp-services feed version. Master-track P2 nightlies write `26.99.0 rev:<sha> nightly`, which `OnPremReleaseVersion` cleans to `26.99.0` (split on space) → newest endpoint classes, ALL capabilities, identical for every master-track env (a pp-services PR build does not change P2). DeployMate calls `PUT /admin/versions/tenants/{id}` at the end of `INSTALLING_SOLUTION` so the portal registry is not "unknown" until the daily cron (`tenant.version.load.cron` = 10:07). Verify live on each box: `GET http://<ip>:9090/pp-api-gateway/api/v1/polypoint-versions/current` (Traefik 9090 is open to the allowlist) or portal ops → tenant → versions.
- **What the env gives you once DONE.** `GET /{id}` (state, `ipAllowlist`, `sshPublicKeys`, `prSources` with the resolved `artifactVersion`, `timeRecordingMode`, `ttlExpiresAt`, `instanceState`), `GET /{id}/services` (reachable service URLs), `GET /{id}/tenant-health` (PolyPortal view: vpn/ping/health/deephealthcheck), `GET /{id}/test-data` (the seeded manifest: people with `login`, `timeRecordingMode` TIMESTAMPS|BLOCKS, badge, orgUnit; SSO `loginUsers` + the shared seed password; roster span), `GET /{id}/logs` / `/logs/stream` (SSE) / `/logs/steps`. Credentials are one-shot reveal pairs (`POST .../credentials/{rdp|db|pep}/reveal` → token, `.../consume` → the secret, 60 s): RDP = user `pp-01` (feeds `pep-verify`), DB = Oracle proxy login `VINCULUM_FLEET[ECBERN]` on `<ip>:1521/POLYP01` (direct SQL on ECBERN from your Mac — the api-pp curl oracle's companion). The `pep` reveal exists only for dump envs with preserved identities; on seeded envs PEP logins are the manifest's `loginUsers` (shared `loginPassword`) and `adminec`. The box's address is `<id>-host.deploymate.polypoint.dev` (resolve with `dig +short`); the env response has no IP field. Firewall per env: 22/1521/3389/8443/8383/9090/9091 from the allowlist; the cloud reaches api-gw through the VPN tunnel api-gw dials out, nothing inbound needed.
- **Lifecycle knobs.** Auto-stop at 19:00 Europe/Zurich and auto-start 07:00 — disable for the run with `PUT /{id}/auto-stop {"enabled":false}` (the external IP rotates on stop/start). Quotas: per-owner 2 envs _in flight_ (DONE does not count), global 10. `POST /{id}/reseed` re-runs the seed layer (409 on dump envs). Destroy = `DELETE /{id}` (snapshot of D: optional in the SPA).
- **Seeded data (stack `deploymate-customer`, 40 people by default).** Blueprint hospital org tree, shift catalog + palette, roster, licence, PEP admin, and the `time-recording-modes` layer: EVEN-indexed employments are TIMESTAMPS (`AUTO_ZEITSTEMPEL='F'`, must stamp), ODD-indexed are BLOCKS (auto-stamp, editable credited blocks), everyone has badge `DM<employee-id>` + PIN 1234, and with `includeLoginUsers` each person gets a Keycloak + POLYUSER login with PEP and myPOLYPOINT roles. So E1–E6 of data-plan.md can be PICKED from the manifest (3 TIMESTAMPS + 3 BLOCKS people on different Stationen) instead of created; only the on-call definitions and the M-1/M-2 history still need data-plan.md steps.
- **Legacy ansible details** (only if you must go around DeployMate): the chain is `component-deploymate-prepare.yml` (rewrites the baked hostname), the install playbooks, `component-deploymate-keycloak-bootstrap.yml`, `component-deploymate-p4-db.yml`, `component-deploymate-finalize.yml` (task `pep-auto-init.yml` writes the PEP IDM login profile under `HKLM\SOFTWARE\POLYPOINT\Config\IDM` in both registry views, sets AutoAdminLogon for `pp-01`, reboots once). Ansible SSH uses port 2222 with DeployMate's own key; never copy credentials out of the ansible inventories. For `pep-verify`, synthesise an inventory:
  ```
  $PEP_ANSIBLE_ROOT/inventories/deploymate/<env-id>/hosts
    [applicationservers]
    <external-ip>
    [applicationservers:vars]
    ansible_user=pp-01
    ansible_password="<RDP pw from the reveal endpoint>"
  ```
  Fresh boxes have no interactive session until the finalize reboot ran (pep-verify OPERATIONS §5). PEP's IDM login form is UIA-readable (`edit auto=username`, `edit auto=password`, `button auto=kc-login`); the first "cloud features unavailable" warning is benign.

### 2a. Create payloads (fill `<…>` at run time)

Default run: **one environment**, the bundle under test — a master build pin or a PR. `--compare <second env>` adds a second environment created the same way with the other payload (first run: PR 12910 vs master); it only feeds the `diff` overlay.

Master bundle (pin a published `master-dev` pp-services build — re-read the list from `GET /master-builds` on the day; **version gate: ≥ 0.0.1800** (APIPP-1899 + APIPP-1884), class 1801 from 0.0.1829, SKILL.md Phase 0 step 2):

```json
{
  "id": "<env-id, e.g. utr-m-1801 (first run)>",
  "track": "master",
  "version": "26.1.0",
  "stage": "CT",
  "machineSize": "DEFAULT",
  "p2Enabled": true,
  "timeRecordingMode": "UNIFIED",
  "ttlDays": 14,
  "seedConfig": {
    "preset": "customer-roster",
    "peopleCount": 40,
    "includePalette": true,
    "includeLoginUsers": true,
    "includeRest": false
  },
  "ipAllowlist": ["<your public IP>/32"],
  "sshPublicKeys": ["<ed25519 public key line>"],
  "masterBuildPins": { "PP_SERVICES": "<newest master-dev version>" }
}
```

PR bundle (same, built from the PR merged onto master at build time; example PR 12910):

```json
{
  "id": "<env-id, e.g. utr-p-1801 (first run)>",
  "track": "master",
  "version": "26.1.0",
  "stage": "CT",
  "machineSize": "DEFAULT",
  "p2Enabled": true,
  "timeRecordingMode": "UNIFIED",
  "ttlDays": 14,
  "seedConfig": {
    "preset": "customer-roster",
    "peopleCount": 40,
    "includePalette": true,
    "includeLoginUsers": true,
    "includeRest": false
  },
  "ipAllowlist": ["<your public IP>/32"],
  "sshPublicKeys": ["<ed25519 public key line>"],
  "prSources": [{ "repo": "PP_SERVICES", "prId": 12910 }]
}
```

A PR env's build adds ≈80 min before the VM even starts. With `--compare`, create the PR env first, then the master env; both use the same seed (`randomSeed` default 42) → byte-identical test data, which is what makes the overlay diffs meaningful. Record in the env facts file: env id(s), the resolved `prSources[0].artifactVersion` or the pin, the manifest's chosen people, and the version each api-gw reports (never an IP or a credential).

## 3. Gates (run before any scenario; record every value in the run meta)

G0 DeployMate state: `dm-api.sh get <id>` → `provisioningState` DONE, `instanceState` RUNNING and **`autoStopEnabled` false** (the 19:00 auto-stop rotates the IP and kills PEP; run a1801 was provisioned with it ON) — else `dm-api.sh auto-stop <id> off` and re-read. Re-checked in every daily pre-flight.

G1 Version and capabilities

1. Read the version each box reports: `GET http://<ip>:9090/pp-api-gateway/api/v1/polypoint-versions/current` (expected `26.99.0 rev:<sha> nightly` on a master-track box — see §2), and the version the portal stored: portal ops (`https://ct-portal-webapp.dev.k8s.polypoint-dev.com`) → tenant → versions, or `SELECT * FROM ECBERN.POLYPOINTVERSION` over the revealed DB login.
2. As an HP user of the tenant call poma-core `GET /api/capabilities` (through myPP: open the app, the capabilities request appears in the network log after login). Required: `UNIFIED_TIME_RECORDING`, `LEGACY_IN_OUT_TIME_STAMP_ID`, `TIME_AMOUNT_TYPE`, `BENEFITS`, `CREDITED_TIME_FOR_TIME_STAMPS`, `PLANNED_TIME_FOR_BLOCKS`, `PLANNED_TIME_FOR_ON_CALL_SHIFTS`, `BLOCK_COMMENTS`.
3. Only if a tenant reads `UNKNOWN` or something below 26.4.0: trigger the portal reload (`PUT /admin/versions/tenants/{id}` — the same call DeployMate makes; DeployMate's `POST /{id}/retry` from INSTALLING_SOLUTION also re-runs it) and re-check; as a last resort update the `POLYPOINTVERSION` row on the box to an explicit value (with `--compare`: the same value on both boxes — both tenants must then end with the identical capability list, scenario X-04).

G2 Feature flags: DeployMate already set `poma.mobileApp.timeRecording` ON and `poma.mobileApp.unifiedTimeRecording` ON (UNIFIED mode). Check `mobileApp.monthTimeReport` ON, `flows.timesheet` OFF (out of scope), `onPrem.timeRecodingMaxAllowedPastDays` = default 7 (P-03 changes it in the exclusive phase) in portal ops feature admin. The operator's portal session (P-03, and the C family's possible `mobileApp.unifiedTimeRecording` override) lasts about 1.5 h: the operator's headed `portal-flag.mjs … login` happens right before P is launched (SKILL.md Phase 2). Hard-reload myPP after flag changes (flags are cached client-side). The Classic family's part 2 needs unified OFF: `PUT /environments/{id}/time-recording {"mode":"LEGACY"}` (`dm-api.sh time-recording <id> LEGACY`) on the environment under test (and the compare env) for that exclusive phase at the end, then back to `UNIFIED`.

G3 PEP and oracle access: RDP reveal → `pep-verify` preflight on the box (and the compare box) (RDP session active after the finalize reboot, pep-driver deployed — first time per box — agent up **and PEP running** — `pep.sh <tenant-id> windows` lists `TfrmPEPMain`; on a fresh box or after a restart `pe-ready.sh` exits 4; the orchestrator runs `PE_COLD_START=1 PE_USER=<login> scripts/pep/pe-ready.sh <tenant-id>`, which also deploys pep-driver on a box without an agent token, SKILL.md Phase 0 step 4); re-checked every run day; api-pp reachable on `http://<ip>:9090/pp-api-personnel-planning` (§4); DB reveal consumed and stored in the credentials file (0600, outside the skill); service-client secret available.

G4 Data audit and creation: data-plan.md and `scripts/seed/README.md`. With `--compare`, the same data on the compare env; record the ids (employment ids, planning ids, shift definition ids) in the env facts file.

G4b api-pp definition cache: after creating or changing definitions / palettes in PEP (or rights / closing dates in SQL), enqueue the persistence-state-change events on the box (`SHIFT_DEFINITION` per definition, `SHIFT_DEFINITION_PALETTE` per palette node, `PERMISSION_ROLE`, `PERIOD_CLOSING`) and COMMIT — DeployMate boxes have no `TIUD_*_PSC` triggers and api-pp caches these for up to 7 days. Verify with `scripts/harness/days-check.mjs` (`EXPECT_DEF=<id>`) on an employee planned with the definition. Commands: SKILL.md Phase 1 "Gate G4b", seed README step (c2); scenario X-05.

G5 Baseline fixtures: for every test employment and the three months (M-2, M-1, M0) capture on the environment under test (and the compare env), before any write: api-gw `GET /api/v1/roster-cells?from&to` (impersonated as the employee), `GET /api/v1/legacy-time-recording/{emp}/days?from&to`, `GET /api/v1/daily-time-report?employment-id&from-day&to-day`, `GET /api/v1/time-recording/closing-dates`; store under `fixtures/<env>/<employment>-<month>.json`. Run `scripts/diff-roster-cells.py` (one capture: its own signature lines; with `--compare`: each pair): on a 1801 bundle the F1/F2 signatures are expected and confirm the static analysis before any UI test.

## 4. Reaching api-pp and api-gw on a box

- DeployMate envs: no tunnel needed from an allowlisted IP — Traefik on `http://<ip>:9090` fronts the P4 APIs (`/pp-api-personnel-planning`, `/pp-api-gateway`), Keycloak is on `https://<ip>:8383`, Oracle on `<ip>:1521` (service `POLYP01`). Fallback: `ssh -i <key> pp-01@<ip>` (port 22) and forward the box's local ports. Classic CT tenants instead use `poco onprem port-forward --target <tenant>` (Keycloak `https://localhost:8383`, api-pp `http://localhost:9090/pp-api-personnel-planning`, api-gw port printed by poco).
- Service token: client `polypoint-p4-api-personnelplanning`, secret from the vault note "03 Configuration §8" / credentials file. 60 s lifetime.
- The cloud's own calls are visible in poma-core logs on CT (`kubectl logs` in the CT namespace, dev context only — never the prod context).

## 5. myPP access (web and mobile)

- Web: the CT myPP URL for the tenant (from the env facts). Users: the employees created in data-plan.md with their myPP logins; CT convention password = username for throw-away test users (CT only).
- PolyID lockout on CT (USER_OR_IP_LOCKED after failed logins): only the orchestrator reads / removes it with `scripts/harness/polyid-unlock.mjs <profile> <outdir> <tenant-id> login|read|unlock [--subject my-ip|<subject>]` (operator's PolyID ops session, CT host guard; `troubleshooting.md`).
- Mobile app in-app path against the deployed CT webapp (first run, no local serve needed): `scripts/harness/mypp-inapp.mjs <tenant-id> <login> <script|-> <outdir>` — Pixel 7 UA, 390 px, touch and the `window.cordova = {}` init script, so Ionic reports hybrid+android and the app's own login forms run (on-board e-mail, login, `#btn-accept` consent, team-roster tutorial); records only poma-API traffic. `mypp.mjs --mobile` only emulates the device and stays on the web (PolyID page) login.
- Mobile app from a local build (the app is Capacitor 8, not Cordova): serve `polypoint-poma/polypoint-mypolypoint-app` with `npm run ionic_serve_ct` (or `npm run ionic_emulator_browser_minikube`), then in the playwright session set an Android user agent via CDP `Emulation.setUserAgentOverride` and `addInitScript(() => { window.cordova = {}; })` so Ionic reports hybrid+android and the in-app `LoginAuthPolyidService` path runs. Login with the employee's email user (`<login>@<tenant-id>.ch` on a DeployMate tenant). Shift-swap-style card clicks must be real pointer clicks, not `el.click()`.
- Browser profiles: one persistent `--user-data-dir` per agent and environment; sessions expire — the orchestrator logs in once per profile at the start of the run.

## 6. Cleanup after the run

Delete created stamps/blocks on writable days (agents report `created_data`), restore flags (`mobileApp.unifiedTimeRecording` ON, past-days flag: the P-03 tenant override deleted), restore PEP rights toggled by P-01a/P-01b/P-04, the optional X-02 CODEART 'S' row deleted (seed step r), keep the prepared M-1/M-2 data (it is the reusable baseline). Archive `fixtures/` and `results/` next to the report.
