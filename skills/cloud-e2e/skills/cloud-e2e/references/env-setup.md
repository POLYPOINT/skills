# Environment setup — DeployMate envs on CT, what the cloud sees, how to reach them

Generic part of the utr-e2e v0.5.0 `env-setup.md` §1–5, corrected with the verified DeployMate facts (deploymate 1.40.4, 2026-10-22). Group-specific gates live in each group package (UTR: `groups/utr/references/gates.md`).

## 1. Topology (one tenant per bundle, one cloud)

- api-gateway ships INSIDE the on-prem bundle together with api-pp, P2/PEP and Oracle. The cloud (CT master: poma-core, myPP, PolyPortal, PolyID) reaches a tenant's api-gw through portal-tenant-access (`apigw-{tenantId}`). So one DeployMate env = one tenant on the shared CT cloud; every env of a run is on the same cloud build.
- The cloud derives on-prem capabilities from the tenant's stored bundle version (portal job `LoadTenantVersions` → flag `general.bundle.version` → poma-core `OnPremReleaseVersion` → endpoint classes `V<maj>_<min>_<patch>`). The string comes from api-gw `GET /api/v1/polypoint-versions/current` (Oracle `ECBERN.POLYPOINTVERSION`), NOT from the build number. Master-track P2 nightlies write `26.99.0 rev:<sha> nightly` → newest endpoint classes, all capabilities, identical for every master-track env.
- Thresholds: `UNIFIED_TIME_RECORDING` ≥ 26.0.2, `LEGACY_IN_OUT_TIME_STAMP_ID` ≥ 26.0.4, `TIME_AMOUNT_TYPE` ≥ 25.0.11, `BENEFITS` / `CREDITED_TIME_FOR_TIME_STAMPS` / `PLANNED_TIME_FOR_*` ≥ 25.0.0, `GET_PLANNED_SHIFT_TIME_RANGE` ≥ 26.3.3, `TIMESHEET` ≥ 26.4.0. A version newer than every known implementation gets all capabilities; an unparsable one → HTTP 500 `UNKOWN_ON_PREM_VERSION`; below an endpoint's minimum → HTTP 412 and empty day plans.
- Stages: **CT only** (proven). REVIEW / PREVIEW are configured in DeployMate but unproven (Keycloak 404 on 2026-08-03); a PREVIEW create is a mutation that needs the user's go. Staging is on the production cluster: out of bounds for every session.

## 2. DeployMate facts (verified 2026-10-22; procedures in the `deploymate` skill)

- **What it is.** Self-service provisioner: API `https://deploymate-api.dev.k8s.polypoint-dev.com/api/v1`, SPA `https://deploymate.dev.k8s.polypoint-dev.com/ops/`. One GCE Windows VM per env (project `ppcloud-deploymate`), FSM `PENDING → [BUILDING_PR_ARTIFACTS] → PROVISIONING_VM → WAITING_FOR_SSH → RUNNING_HEALTH_CHECK → CONFIGURING_CLOUD_TENANT → INSTALLING_NOMAD_CONSUL → INSTALLING_IDM → INSTALLING_SOLUTION → DONE` (sink `ERROR`; `retry` resumes).
- **Auth.** Every caller needs `ROLE_DEPLOY_MATE_USER` and their **own** captured session (`dm-login-capture.mjs`, headed, "stay signed in" ticked) — also to read a shared env. `ROLE_DEPLOY_MATE_ADMIN` is a read-only fleet observer (cannot reveal).
- **Ownership and sharing.** One owner per env, no transfer. `share <id> <sub> VIEWER|OPERATOR`:
  - VIEWER reads the env, logs, services, tenant health and `test-data` (incl. the shared seed login password);
  - OPERATOR also reveals RDP / DB (/ PEP on dump envs) for themselves, adds **single** IPs (`/32`, union only), extends the TTL and starts / stops / restarts the VM;
  - owner-only: SSH keys (≤ 5, a PUT replaces the list), auto-stop, time-recording mode, reseed, retry, destroy, Tailscale, share / unshare.
    Every reveal is audited with the consumer's sub. A person finds their own sub as `userId` in `dm-api.sh me`.
- **Network.** Ports 22, 1521, 3389, 8383, 8443, 9090, 9091 open from `ipAllowlist` only. The API adds **no** office VPN range (only the SPA wizard pre-fills one): every person needs their own public `/32` (people behind one office NAT share one entry). The allowlist is effectively capped at about 10 entries (Cloud Armor), so budget ≈ 9 personal `/32` per env; an 11th may fail silently. `dm-api.sh refresh-ip <id>` **replaces** the allowlist when the owner calls it; on a shared env the owner uses `refresh-ip <id> --union`. Use the DNS name `<id>-host.deploymate.polypoint.dev`, never the IP (it changes on every stop / start).
- **Create request.** `id` (≤ 15, `^[a-z][a-z0-9-]{0,14}$`, also tenant id, Oracle hostname, e-mail domain `<id>.ch`), `track master`, `version 26.1.0` (prefill), `stage CT`, `machineSize DEFAULT`, `p2Enabled true`, `timeRecordingMode UNIFIED|LEGACY`, `seedConfig {preset: "customer-roster", peopleCount 1–50, includePalette, includeLoginUsers, includeRest}`, `ipAllowlist`, `sshPublicKeys`, `ttlDays` (default 7, ≤ 30 from creation; extend 1–14 days per call). Bundle: `masterBuildPins {PP_SERVICES: "0.0.N"}` or `prSources [{repo: PP_SERVICES, prId}]` (≈ 80 min CI build first). Only the `master` and `main-26` tracks can be provisioned.
- **Quotas, time, cost.** 2 envs **in flight** per owner (DONE does not count); global ceiling 50 (effective = vCPU headroom ÷ 4). Fresh provision p50 ≈ 47 min, p90 ≈ 77 min, then the DM-213 repair. DEFAULT ≈ 8.50 CHF per day an env exists. Auto-stop 19:00 / auto-start 07:00 Europe/Zurich **every day** unless the owner opts out.
- **Reset.** No snapshot or restore exists. Reset = reseed (owner, whole env, new MITARBEITER and Keycloak ids: never during a run), a clone of an admin template (frozen dates), or destroy + create.
- **What a DONE env gives.** `GET /{id}` (state, allowlist, SSH keys, resolved `prSources[].artifactVersion`, mode, TTL, `instanceState`, `autoStopEnabled`), `/services`, `/tenant-health`, `/test-data` (people with `login`, mode TIMESTAMPS / BLOCKS, badge, orgUnit; `loginUsers` + shared `loginPassword`; roster span = seed −7 … +6 weekdays), logs. Reveals are one-shot (60 s): RDP `pp-01`, DB proxy login `VINCULUM_FLEET[ECBERN]` on `<host>:1521/POLYP01`.
- **One desktop per box.** PEP runs in `pp-01`'s single interactive session: a box-wide mutex (`locks/<env>~pep`). A second machine with SSH and the RDP password drives the same pep-driver agent (token read over SSH) without redeploying.
- **DM-213.** P4 services dead after DONE on every new master env so far: the owner's manual SYS repair (deploymate skill §6a).
- **Seed traps.** The manifest drifts from the live logins (take logins from `POLYUSER.KUERZEL`); umlaut kürzel break the PolyID form (pick ASCII); `HIERARCHIE.STAMM` is NULL; PSC triggers are missing (gate G4b); every seeded login is in `DMSEED:Planner` (planner over all nodes: candidate lists and dashboards show every group's people).
- **pep-verify inventory** (written by `scripts/dm-join.sh`, 0600, local only):
  ```
  $PEP_ANSIBLE_ROOT/inventories/deploymate/<env-id>/hosts
    [applicationservers]
    <env-id>-host.deploymate.polypoint.dev
    [applicationservers:vars]
    ansible_user=pp-01
    ansible_password="<from the rdp reveal>"
  ```
  Fresh boxes have no interactive session until the finalize reboot ran (pep-verify OPERATIONS §5).

### 2a. Create payloads

Multi-group runs: `steward.md` S0 step 2 (peopleCount 50, same pin on every env). UTR solo: `groups/utr/references/gates.md` §2a (peopleCount 40, master pin or PR, optional `--compare` env).

## 3. Generic gates (record every value in `env-facts.md` and `envs/<id>`)

- **G0 DeployMate state** (steward; daily pre-flight): `dm-api.sh get <id>` → `provisioningState` DONE, `instanceState` RUNNING, `autoStopEnabled` false.
- **G1 version and capabilities**: the version the box reports (`GET http://<host>:9090/pp-api-gateway/api/v1/polypoint-versions/current`) and the version the portal stored (portal ops → tenant → versions); the capabilities an HP user of the tenant gets (`GET /api/capabilities/v1/capabilities` through the app). Each group lists the capabilities it needs in its `group.json` gates. A tenant on `UNKNOWN` or below the needed version: portal reload `PUT /admin/versions/tenants/{id}` (the call DeployMate makes), then re-check.
- **G3 access**: SSH + `sql.sh` (`dm-join.sh` probes), PEP agent and `TfrmPEPMain` (`pep.sh <id> windows`; cold start = steward), api-pp reachable on `:9090/pp-api-personnel-planning`, service secret available where the group needs it.
- **G4b definition cache**: after every definition / palette / rights / closing-date / employment change made in PEP or SQL, `scripts/psc-enqueue.sh` and a read gate (DeployMate boxes have no `TIUD_*_PSC` triggers; api-pp caches up to 7 days).
- **G-FLAGS / G-ROLES** (steward S1): `flags-baseline.py --compare`; one kit member per group logs in and the decoded roles match.

## 4. Reaching api-pp and api-gw on a box

- From an allowlisted IP no tunnel is needed: Traefik `http://<host>:9090` fronts `/pp-api-personnel-planning` and `/pp-api-gateway`, Keycloak `https://<host>:8383` (realm `POLYP01`), Oracle `<host>:1521/POLYP01`. Fallback and stable local ports: `scripts/tunnels.sh <id> - <digit>` (digit per env: `<digit>9090`, `<digit>8383`, `<digit>1521`).
- Service token: client `polypoint-p4-api-personnelplanning`, secret from each person's own vault access into a local 0600 file (never pasted, never in the db); 60 s lifetime. `scripts/api-pp.sh` and `scripts/pp-plan.sh` read it.
- The cloud's own calls are visible in poma-core logs on CT (dev context only — never the production context); workers judge errors on response bodies.

## 5. App access

- **myPP web**: `https://ct-poma-webapp.dev.k8s.polypoint-dev.com`, users `<login>@<env-id>.ch`, password from `<env-id>.test-data.json` (the harness reads it). Mobile in-app path: `mypp-inapp.mjs` (Pixel 7 UA, 390 px, `window.cordova = {}`; the app's own login forms); `mypp.mjs --mobile` only emulates the device.
- **POMA planner / pool manager / tenant admin**: `app.mjs … --app poma` (login predicates `/shift-planner/`, `/pool-manager/`, `/tenant-admin/`, `/invalid-user`, `/badi`, `/partner-simulator`).
- **PolyPortal ops** `https://ct-portal-webapp.dev.k8s.polypoint-dev.com` and **PolyID ops**: personal accounts, headed login into a profile outside `results/` (≈ 1.5 h); `portal-ops.mjs`, `polyid-admin.mjs`.
- Stage-aware URLs: REVIEW / PREVIEW follow the `<stage>-…` pattern on ppcloud-demo; every helper refuses `*.polypointservices.ch`.
- **PolyID brute-force lock**: failed logins lock the caller IP per tenant provider **without expiry**; runners behind one office NAT share it. ≤ 2 password submissions per login and harness call; unlock = steward (`polyid-admin.mjs … unlock`, CT / Preview; Staging never).
- Browser profiles: one persistent profile per worker family and env (`MYPP_PROFILES=<run dir>/.profiles/<F>`); ops profiles outside `results/`.

## 6. Cleanup

Each group lists its cleanup in `group.json` `cleanup[]` and reports it in `groups/<key>.summary`; the steward's S5 check covers the shared state (run partner, GLN, flags back to baseline, time-recording mode, Send Messages, claims and locks). Kits stay until destroy.
