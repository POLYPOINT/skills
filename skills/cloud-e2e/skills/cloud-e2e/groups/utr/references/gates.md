# UTR gates — version / capability thresholds, create payloads, gates G0–G5, cleanup

_Moved unchanged from utr-e2e v0.5.0 `references/env-setup.md` §1 (thresholds), §2a, §3 and §6 (path-only edits). Its generic sections (§1 topology, §2 DeployMate facts — corrected —, §4 api-pp / api-gw access, §5 myPP access) are the core `references/env-setup.md`; section numbers are kept so the UTR files citing "env-setup.md §n" find them here (§2a, §3, §6) or in the core file (§1, §2, §4, §5)._

## 1. Thresholds (from §1 Topology)

- Thresholds that matter: `UNIFIED_TIME_RECORDING` ≥ 26.0.2 (counted block/break writes), `LEGACY_IN_OUT_TIME_STAMP_ID` ≥ 26.0.4, `TIME_AMOUNT_TYPE` ≥ 25.0.11, `BENEFITS` / `CREDITED_TIME_FOR_TIME_STAMPS` / `PLANNED_TIME_FOR_*` ≥ 25.0.0, `GET_PLANNED_SHIFT_TIME_RANGE` ≥ 26.3.3, `TIMESHEET` ≥ 26.4.0. A version newer than every known implementation (e.g. 27.0.0) gets the newest implementation and all capabilities; an unparsable version → HTTP 500 `UNKOWN_ON_PREM_VERSION`; a version below an endpoint's minimum → HTTP 412 and empty day plans.

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

G4 Data audit and creation: data-plan.md and `groups/utr/scripts/seed/README.md`. With `--compare`, the same data on the compare env; record the ids (employment ids, planning ids, shift definition ids) in the env facts file.

G4b api-pp definition cache: after creating or changing definitions / palettes in PEP (or rights / closing dates in SQL), enqueue the persistence-state-change events on the box (`SHIFT_DEFINITION` per definition, `SHIFT_DEFINITION_PALETTE` per palette node, `PERMISSION_ROLE`, `PERIOD_CLOSING`) and COMMIT — DeployMate boxes have no `TIUD_*_PSC` triggers and api-pp caches these for up to 7 days. Verify with `groups/utr/scripts/harness/days-check.mjs` (`EXPECT_DEF=<id>`) on an employee planned with the definition. Commands: SKILL.md Phase 1 "Gate G4b", seed README step (c2); scenario X-05.

G5 Baseline fixtures: for every test employment and the three months (M-2, M-1, M0) capture on the environment under test (and the compare env), before any write: api-gw `GET /api/v1/roster-cells?from&to` (impersonated as the employee), `GET /api/v1/legacy-time-recording/{emp}/days?from&to`, `GET /api/v1/daily-time-report?employment-id&from-day&to-day`, `GET /api/v1/time-recording/closing-dates`; store under `fixtures/<env>/<employment>-<month>.json`. Run `groups/utr/scripts/diff-roster-cells.py` (one capture: its own signature lines; with `--compare`: each pair): on a 1801 bundle the F1/F2 signatures are expected and confirm the static analysis before any UI test.

## 6. Cleanup after the run

Delete created stamps/blocks on writable days (agents report `created_data`), restore flags (`mobileApp.unifiedTimeRecording` ON, past-days flag: the P-03 tenant override deleted), restore PEP rights toggled by P-01a/P-01b/P-04, the optional X-02 CODEART 'S' row deleted (seed step r), keep the prepared M-1/M-2 data (it is the reusable baseline). Archive `fixtures/` and `results/` next to the report.
