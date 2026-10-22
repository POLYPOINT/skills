# What a DeployMate environment is

Verified 2026-10-13 against `cloud/deploy-mate` @ 8264e0f, the ansible repo (`Ansible/ansible` master) and the pp-services pipeline.

## 1. Provisioning path and durations

DeployMate runs a database-backed state machine (one claim every 5 s, handlers run outside the row lock, 10 min claim timeout with heartbeats; transient failures retry with back-off, `ERROR` waits for a manual retry). Typical standard provision:

| State                      | What happens                                                                                                                                                                                                                                                                                  | Order of magnitude                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `BUILDING_PR_ARTIFACTS`    | only with `prSources`: queue the repo's CI on `refs/pull/<id>/merge`, poll, record `artifactFeed`/`artifactVersion`                                                                                                                                                                           | ≈80 min for pp-services (same as a master run)             |
| `PROVISIONING_VM`          | OpenTofu applies `infra/terraform/env` (VM from the track's image pair, cloned data disk, firewall, two DNS records); zone rotation on GCE stock-outs                                                                                                                                         | minutes                                                    |
| `WAITING_FOR_SSH`          | probe port 22 (default 30 min budget); one automatic power-cycle for the first-boot Oracle wedge                                                                                                                                                                                              | 5–15 min                                                   |
| `RUNNING_HEALTH_CHECK`     | ansible facts + Oracle up                                                                                                                                                                                                                                                                     | minutes                                                    |
| `LOADING_DB_DUMP`          | only with `dbDump`: download from GCS, `impdp full=Y`, re-key ECBERN, rewrite hostnames, second prepare                                                                                                                                                                                       | ≈1 h (390 min timeout)                                     |
| `CONFIGURING_CLOUD_TENANT` | PolyPortal admin API: org `deploymate-<owner>`, tenant `<id>`, services, IP whitelist allow-all, producer credentials, 2FA off, feature toggles                                                                                                                                               | minutes                                                    |
| `INSTALLING_NOMAD_CONSUL`  | `component-rabbitmq.yml`, `component-nomad-consul.yml`                                                                                                                                                                                                                                        | 5–10 min                                                   |
| `INSTALLING_IDM`           | Keycloak chain (`component-keycloak*.yml`, pp-config-service)                                                                                                                                                                                                                                 | 10 min                                                     |
| `INSTALLING_SOLUTION`      | `solution.yml` (PolyUpdate P2 + P4 APIs from the feed), `component-deploymate-p4-db.yml` (bootstrap-app schema baseline, master only), seed (`component-deploymate-seed.yml`), fleet DB user, `component-deploymate-finalize.yml` (PEP IDM profile, autologon, portal version reload, reboot) | p50 ≈28 min, 45 min ansible timeout (180 min on dump envs) |

`GET /provisioning/eta-profile` gives live p50/p90 per state. Budget ≈1.5 h end to end, ≈3 h with a PR pin, +1 h with a dump.

## 2. On the box

Windows Server VM (`n4d-standard-4` by default, hyperdisk boot + data disk) booted from the track's golden image pair (`master`: hand-curated 26.99 pair `deploymate-base-{boot,data}-20260525`; `main-26`: empty 25.1.6 schema pair). Services: Oracle 19c PDB `POLYP01` (schemas ECBERN, APIPPDBA, KEYCLOAKDBA, VINCULUM_FLEET…), P2/PEP (`pepwin.exe`, PolyTimeConnect), Keycloak on 8383 (realm `POLYP01`), RabbitMQ, Nomad + Consul running the P4 API jobs behind Traefik on 9090 (API on 9091), api-gw dialling the cloud's tenant-access tunnel (`polypoint-vpn`), sshd for ansible (port 2222, DeployMate's key) and for `pp-01` (port 22, your `sshPublicKeys`).

DNS (Cloud DNS zone `deploymate.polypoint.dev`): `<id>.deploymate.polypoint.dev` = load-balancer VIP (TLS via wildcard cert, forwards a few ports), `<id>-host.deploymate.polypoint.dev` = the VM's external IP (SSH, RDP, Oracle, 9090/9091). The external IP changes on every stop/start; DNS is reconciled by DeployMate.

Firewall (per env, source = `ipAllowlist` + office VPN range): tcp 22, 1521, 3389, 8383, 8443, 9090, 9091. The cloud needs no inbound port: api-gw dials out. `POST /{id}/refresh-ip` rewrites the rule with the caller's current IP.

Windows users: `pp-01` (RDP + SSH; password via the rdp reveal), `deploymate` (ansible). PEP users: the seeded login users (shared seed password in the manifest) and `adminec` (configurer superuser); on `PRESERVE_IDENTITIES` dump envs the dump's own users with the pep-reveal password.

## 3. Versions the cloud sees

The cloud derives on-prem capabilities from the tenant's stored bundle version (portal `LoadTenantVersions`, daily cron 10:07, also triggered by DeployMate at the end of `INSTALLING_SOLUTION` through `PUT /admin/versions/tenants/{id}`). That version is api-gw `GET /api/v1/polypoint-versions/current` ← Oracle `ECBERN.POLYPOINTVERSION`, written by the P2 installer, not by the pp-services feed version. Master-track P2 nightlies write `26.99.0 rev:<sha> nightly`; poma-core's `OnPremReleaseVersion` keeps the part before the first space → `26.99.0` → newest endpoint classes and every capability. A pp-services PR or master pin does not change this. `main-26` envs report the installed release (e.g. `26.0.x`). `UNKNOWN` → POMA refuses roster calls (412/500) until the reload succeeds.

## 4. Artifacts, feeds and PR-env builds

- Tracks come from the ansible bundle's `vars/<track>/<stage>.yml`; ADO feeds are `<target_release>-<stage_name>` (`master-dev`, `main_26-dev`, `feature-dev`); rc/prod stages install released builds from `gs://polypoint-releases/<line>/<version>/`.
- Master track latest = newest version in `master-dev` (pp-services `0.0.N`, one version per publish run spanning all modules; P2 `p2-installer-de-ch 0.0.N`). The feed keeps only a few versions, so `masterBuildPins` are pre-warmed into DeployMate's GCS artifact cache at create time.
- PR pins (`prSources`): DeployMate queues pp-services pipeline 401 with template parameter `publish_pr_env_artifacts=true` (P2: pipeline 54, `publishPrEnvArtifacts=true`, de-CH only) on `refs/pull/<id>/merge`, i.e. the PR merged onto current master. The run publishes the whole artifact set (api-pp, api-gw, api-ap, api-pc, apl, bootstrap-app, …) as version `0.<prId>.<buildId>` into the org feed `pr-env-dev`, then ansible installs with `dm_java_feed_override` / `dm_java_version_override` (`dm_p2_*` for P2). PR-env builds skip the master-only stages (Maven downstream publish, git tag, SaaS release cohort), so failures there on master do not affect PR envs. Nothing triggers these builds except DeployMate (`pr: none`).
- `prSources[].buildWebUrl` is the ADO run to watch; `artifactVersion` is set when the run completes; cancelling the env during the build cancels the run (best effort).

## 5. Cloud tenant

Created on the chosen stage's PolyPortal (CT = ppcloud-dev `ct` namespace; REVIEW/PREVIEW = ppcloud-demo): organisation `deploymate-<owner label>` (shared, retained on destroy), tenant `<id>` with `apiGatewayHealthUrlPath=/actuator/health`, registered services, tenant IP whitelist allow-all (the gateway's egress IP is ephemeral), producer service-account credentials stored in Secret Manager `env/<id>/producer-creds` for the box, PolyId 2FA disabled, email domain `<emailDomain>` (portal domain mapping + PolyId email domain), feature toggles `poma.mobileApp.timeRecording=true`, `poma.mobileApp.unifiedTimeRecording=<mode>`, `portal.onPrem.deephealthcheckIgnores` merged with `onprem-poly-time-connect`. On destroy DeployMate deletes the PolyPortal, POMA and PolyId tenants.

CT URLs: myPOLYPOINT web `https://ct-poma-webapp.dev.k8s.polypoint-dev.com`, portal ops `https://ct-portal-webapp.dev.k8s.polypoint-dev.com`, Keycloak `https://ct-keycloak.dev.k8s.polypoint-dev.com`, PolyId `https://ct-polyid.dev.k8s.polypoint-dev.com`. Tenant services on CT appear as `apigw-<id>` in the `ct` namespace once the gateway dialled in. `GET /{id}/tenant-health` mirrors the portal monitor (vpn, ping, health, deephealthcheck, ratelimiter); poly-time-connect's deep-health entry is a known permanent DOWN and is ignored.

## 6. Seeded test data (stack `deploymate-customer`)

Layers in order: config globaleinstellungen, licence (`SCHLUESSEL`), base org + taxonomy (blueprint hospital with weighted Stationen), people (`peopleCount`, default 40, deterministic with `randomSeed`), people deepening, `time-recording-modes`, shift definitions + palette, billing and planning definitions, periodic credit, login users (Keycloak + POLYUSER, cloud-capable tracks only), IDM users, PolyTimeConnect interface user `eclink`, roster, shift schedule (REST, `includeRest`).

`time-recording-modes`: EVEN-indexed employments get `MITARBEITER_DETAIL.AUTO_ZEITSTEMPEL='F'` (TIMESTAMPS: must stamp, clock-in button in myPOLYPOINT), ODD-indexed keep `'T'` (BLOCKS: auto-stamp, editable credited blocks); everyone gets `BADGE='DM<employee-id>'` and `PINCODE='1234'` (api-pp's `checkInEnabled` gate). Login users share one password (`loginPassword` in the manifest; `SEED_LOGIN_PASSWORD` default) and carry PEP + myPOLYPOINT default roles; `polyuser` is the uppercase username.

Manifest (`GET /{id}/test-data` → `manifest`): `schema, stack, randomSeed, marker (DMSEED), keycloakRealm (POLYP01), loginPassword, people[{personalnummer, firstName, lastName, displayName, gender, email, kuerzel, birthDate, station, timeRecording, pincode, login}], loginUsers[{username, polyuser, password, firstName, lastName, email, clientRoles}], interfaceUsers[], orgUnits[], shifts[], roster{…span…}, licenses[], definitions[{category, names}], layers[], notes[]`. Re-seed (`POST /{id}/reseed`) deletes marker-tagged rows and recreates them; manual data on seeded rows is lost.

Dump envs (`dbDump`): keys today `lt-gt-sup-20260217` (support test data, 25.0.13 schema, fresh Keycloak realm with test users) and `stgag-de-ch-20261005` (`PRESERVE_IDENTITIES`: the dump's Keycloak users kept in `KEYCLOAK_SOURCE`, `LOGIN.LOGINTYPE=Password`, pep reveal for the password). No seed, no licence config, `test-data` answers `available=false`.

## 7. PEP automation hand-off (pep-verify)

A fresh box has no interactive session and PEP is not initialised until `component-deploymate-finalize.yml` ran (`pep-auto-init.yml` writes `HKLM\SOFTWARE\POLYPOINT\Config\IDM` in both registry views, sets AutoAdminLogon for `pp-01`, reboots once). Synthesise an inventory for the pep-verify CLI:

```
$PEP_ANSIBLE_ROOT/inventories/deploymate/<id>/hosts
  [applicationservers]
  <id>-host.deploymate.polypoint.dev
  [applicationservers:vars]
  ansible_user=pp-01
  ansible_password="<password from the rdp reveal, read from the credentials file>"
```

PEP's IDM login form is UIA-readable (`edit auto=username`, `edit auto=password`, `button auto=kc-login`); the first "cloud features unavailable" warning is benign. api-pp on the same box is the faster oracle for reads: `http://<id>-host.deploymate.polypoint.dev:9090/pp-api-personnel-planning` with a service token from the env's Keycloak (`https://<id>-host…:8383`, realm `POLYP01`).

## 8. Operating facts

- Quotas: per owner 2 envs in flight (DONE excluded), global 10, derived from GCP vCPU headroom; admins override per user.
- Cost ledger: CHF/day 3.50 (SMALL), 8.50 (DEFAULT), 18.00 (LARGE); nightly rollup, weekly summary on Monday 08:00.
- Lifecycle crons (Europe/Zurich): auto-stop 19:00, auto-start 07:00 (weekdays for normal envs; opt-out per env), TTL reminder 09:00, scheduled destroy every 5 min, orphan-tenant sweep 04:45 (observe only).
- TTL: default 7 days, extend 1–14 days per call, hard cap created+30 days; long-lived envs (ROLE_long_lived) are never reaped.
- Logs: provision lines kept 30 days, audit events 365 days.
- Notifications: Webex bot, routes per event configurable (admin).
- DeployMate's own health: `GET /actuator/health` (anonymous), `GET /api/v1/status`.
