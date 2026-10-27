# Env steward — provision, seed, operate, consolidate

The steward owns every DeployMate env of the run and the run dashboard. Owner-only DeployMate calls (create, retry, reseed, destroy, SSH keys, auto-stop, LEGACY / UNIFIED, shares) cannot be delegated; a deputy with portal ops ADMIN and PolyID ops covers PolyID unlocks. Facts: `env-plan.md` (envs, windows, partition, schedule), `env-setup.md` (DeployMate, gates), `coordination.md` (store). Paths are relative to this skill folder; `<dm>` = the deploymate skill's `scripts/dm-api.sh`.

## S0 — provision (Day 0, one wave)

1. Capture the DeployMate session once (`dm-login-capture.mjs`, the human signs in) and check `<dm> me` (quota: 2 envs **in flight** per owner; DONE does not count).
2. Payload per env (`env-setup.md` §2a): the on-prem version is decided with the user at session setup (default latest main; any commit can be built, as a build pin or `prSources`); `track master`, `stage CT`, the **same** `masterBuildPins {PP_SERVICES: "0.0.N"}` on every env (≥ 0.0.1829 = bundle class 1801, UTR's version gate) or the same `prSources`, `seedConfig {preset: "customer-roster", peopleCount: 50, includePalette: true, includeLoginUsers: true, includeRest: false}`, `timeRecordingMode UNIFIED`, `machineSize DEFAULT`, `ttlDays 7`, `ipAllowlist ["<steward IP>/32"]` (the API adds **no** office VPN range), `sshPublicKeys [steward key]`. Ids per `env-plan.md` (e.g. `e2e-x-<run>`, `e2e-y-<run>`, ≤ 15 chars, `^[a-z][a-z0-9-]{0,14}$`). Seed on Day 0 afternoon (seed date = Day 1 − 1, `env-plan.md` §6.1).
3. `<dm> create` both (one wave), `<dm> wait <id>` (p50 ≈ 47 min, p90 ≈ 77 min; + ≈ 80 min with a PR pin), then `<dm> auto-stop <id> off` (the 19:00 stop rotates the IP and kills PEP).
4. **DM-213 repair** on every env (deploymate skill §6a): copy the two scripts, the steward runs the SYS upgrade in **their own terminal** (`read -s`, EZConnect `…@127.0.0.1:1521/POLYP01 as sysdba`), waits for `UPGRADE_EXIT 0`, then re-runs the P4 jobs. Verify `<dm> services <id>` (five P4 routes) and `<dm> health <id>` (ping / health / vpn UP).
5. Own access: `scripts/dm-join.sh <id>` (reveals into `~/.config/deploymate/<id>.credentials.json` 0600, test-data, PEP inventory, probes); `scripts/sql.sh <id> --install`; `scripts/tunnels.sh <id> - <digit>` (one digit per env); PEP cold start `PE_COLD_START=1 PE_USER=<seed planner login> scripts/pep/pe-ready.sh <id>` (deploys pep-driver the first time per box). Gate G3 = `scripts/pep.sh <id> windows` lists `TfrmPEPMain`.

## S0b — gates, partition, dashboard, registry

1. **G0** per env: `<dm> get <id>` → DONE, RUNNING, `autoStopEnabled` false. **G1**: bundle version (`/pp-api-gateway/api/v1/polypoint-versions/current`), pin / resolved `artifactVersion`, bundle class, tenant capabilities (`env-setup.md` §3). Record them in `results/<run>/env-facts.md` and `envs/<id>`.
2. **Partition before any login** (`env-plan.md` §6.2 step 1, §6.3, §6.4): `scripts/sql.sh <id> -f scripts/seed/common/audit.sql`; logins = `lower(POLYUSER.KUERZEL)`, ASCII kürzel only (umlauts break the PolyID form); assign whole Gruppen to groups from each `groups/<key>/group.json` `partition[]` (people, `one_gruppe`, `same_category`, `exclusive_nodes`, `preferred`). The shape check fails (e.g. no Gruppe gives swap 8 same-category people) → `env-plan.md` §7.3 (a third env or the group's own fallback). Write `envs/<id>.partitions {gruppe: group}`; no gate may log in an actor before its group claimed it (auth's NEWU stays never-logged-in).
3. **Dashboard** (once per run): copy `assets/dashboard.html` to the scratchpad as `cloud-e2e-dashboard-<run>.html`, set its `<title>` to `E2E <run>` (2–4 words), publish:
   ```
   Artifact publish: file_path=<scratchpad>/cloud-e2e-dashboard-<run>.html, icon="dashboard",
     description="Live progress of the cloud E2E run <run>: environments, groups, claims, locks, windows and results",
     capabilities=<the db rules + assets of coordination.md §2>
   ```
   Then seed with ArtifactData batches (≤ 50 writes each): `run/meta` (run, status, stage, pin, bundle_class, coordination, envs, `groups[{key, title, env, families[[id, name]]}]` from every planned `group.json`), `envs/<id>`, `schedule/<env>` (the planned window slots of `env-plan.md` §7.2), and one `scenarios/<group>~<id>` row per scenario of every planned group from `groups/<key>/assets/scenarios.json` (`group`, `family`, `id`, `title`, `status: "pending"`).
4. Give the user the link and ask them to share the dashboard with each runner at **Contributor** (claude.ai share menu; Claude cannot do it).

## add-runner

`steward add-runner <run> --name <n> --sub <polyid sub> --ssh-pub <file> --env X [--level OPERATOR|VIEWER]`:

1. `<dm> share <id> <sub> OPERATOR` (VIEWER for read-only groups such as hp or ops reads: test-data only, no reveal).
2. `<dm> ssh-keys-add <id> <file>` — appends to the env's list (≤ 5 per env: steward + 4 runners; `env-plan.md` §3.3 #49).
3. `envs/<id>.allowlist` / `ssh` += the runner name (the runner adds their own `/32` in `dm-join.sh`; budget ≈ 9 per env, an office NAT counts once).
4. Remind the user to share the dashboard with that person at Contributor.

## S1 — common seed (per env, before any group seed)

Order of `env-plan.md` §6.2. Log every step in `kits/<env>.log` (`{step, ok, time, value}`) and in `results/<run>/kits-<env>.md`.

1. Partition (S0b step 2, done).
2. `scripts/sql.sh <id> -f scripts/seed/common/rights.sql -D role_id=<DMSEED:Planner role id>` (mobile-app rights + `PERMISSION_ROLE` enqueue).
3. R0 root rows: `scripts/sql.sh <id> -f scripts/seed/common/r0-root-rows.sql …`, PEP restart / re-save, `HIERARCHIE.STAMM` + `ORGANIZATION_STRUCTURE` fix (`groups/utr/scripts/seed/README.md` steps j, k: the steward runs them, UTR verifies).
4. Definitions kit: `scripts/seed/common/definitions-kit.sql` with the env-role variables of `scripts/seed/common/README.md` (DM-X: DIENSTTAUSCH, DIENST_TEILEN, INTERNER_POOL on 111/112/113, swappable palette absence, POMA shift types; DM-Y: POMA shift types). Then **one** G4b batch: `scripts/psc-enqueue.sh <id> --batch <file>` (`shift-definition`, `policy-of`, `palette` lines) and the read gate (`available_for_shift_trade`, roster shift types, internal-pool roster).
5. Role kit: `scripts/seed/common/role-kit.sql` through **sqlplus only** (`sql.sh`; the role trigger skips thin JDBC sessions), then `psc-enqueue.sh <id> permission-role <role> [app]` per role and `keycloak-role-mapping` (arguments unverified). **Gate G-ROLES**: one kit member per group logs in, decoded roles match (`harness/e2e-lib.mjs` `roles(api)`); this also settles OQ-17 (do plain seed logins carry `ROLE_SHIFT_PLANNER`?). Fallback: UsrAdmin via pep-verify under the PEP lock. `scripts/seed/common/verify-kits.sql` records the kit state.
6. **Flag baseline**: `python3 -I scripts/flags-baseline.py --env <X|Y>` (exit 1 = two sources disagree: stop and fix the group package); set every `set` flag with `portal-ops.mjs … flag set` (`--commands <tenant>` prints the calls), wait ≥ 5 min, read the flags into a JSON and run `--compare` (**G-FLAGS**, exit 3 = mismatch). Store the `hash` in `envs/<id>.flags_hash`. The `check` lines (time-recording UNIFIED, Send Messages OFF, PolyID 2FA DISABLED) are verified by reading, never by setting.
7. DM-X only, stage objects, each with the user's explicit OK (STAGE class, `env-plan.md` §3.2): the run partner `e2e-ptn-<run>` (S-CT-REG; tenant access to DM-X, logging ON after the last edit, **never edited** afterwards; gate G-PTN-1), the provider gate P-PTN-3, the GLN (S-CT-GLN) after 00:00 of every run day. Write `stage/*`.
8. Service-token check (api-pp `direct-shift-planning` verified once per env before `pp-plan.sh` is used: `references/harness.md`), then `envs/<id>.kits = "ok"` and `run/meta.status = "running"`.

## S2 — operate

- **Daily pre-flight per env at 07:45**: G0 (auto-stop off, RUNNING), `<dm> services` / `health`, PEP up (`pe-ready.sh`; cold start after any restart), allowlist union (`<dm> refresh-ip <id> --union` after the steward's own IP change — never without `--union` on a shared env), GLN set for the day, stale runners (`coordination.md` §5).
- **Owner-only calls on request** (queue them in `envs/<id>.owner_only_queue`): `<dm> time-recording <id> LEGACY|UNIFIED` inside W-Y-TRMODE (UTR C part 2; HTTP 500 → retry up to 3 times, 1 min apart; UNIFIED needs up to ~6 min to reach `config/features`), SSH keys, extend.
- **PolyID unlocks** (`polyid-admin.mjs … unlock --subject <one exact subject>`, CT / Preview only, never Staging); log each in `run/meta.notes` and tell the runner to re-run the blocked scenarios.
- **Windows**: grant HARD windows (W-Y-MSG), request STAGE windows (S-CT-GWMOCK, S-CT-JOBS, S-CT-LOGLEVEL, S-CT-GLN, S-CT-REG; the user's OK is standing since 2026-10-27, no announcement: CT regression is our team's scope); keep `schedule/<env>` current.
- G4b refreshes for runners whose classifier refused DML on shared rows.

## S5 — consolidate

1. `ArtifactData list` of `scenarios`, `groups`, `findings` (page with `query.cursor`, or `out_dir`) → `results/<run>/consolidated/{matrix.json, matrix-<group>.md}` (pass / fail / known-fail / blocked per group and family, per env).
2. **One report artifact per run**: run meta (envs, pin, bundle class, flags hash, kits log), one section per group (matrix, KNOWN-FAIL table, new findings with screenshots by their dashboard asset URL, blocked list), cross-group findings (`suspected-defects` ids confirmed / not reproduced), cleanup status, decisions needed. Large evidence stays on the runners' machines; the report names runner and path. UTR solo keeps updating its own investigation report (`groups/utr/references/runbook.md` Phase 3).
3. Cleanup check: every `groups/<key>.summary` reports its cleanup; run partner deleted after its last reader (S-CT-REG); GLN; flags back to baseline (`flags-baseline.py --compare`); time-recording UNIFIED; Send Messages OFF; kits stay until destroy; claims and locks released (`status <run>`).
4. `run/meta.status = "done"`. TTL, stop or destroy (`<dm> destroy <id>`) only on the user's explicit word; never reseed during a run.

## Solo steward path (`run … --solo`)

One env, no shares, no add-runner; S0 / S0b as above for that one env (the dashboard may keep v0.5.0 rows for `utr`); S1 only what the group's `group.json` `seed[]` marks `who: steward` (for `utr`: steps a, b, j, k run as today); then the runner loop. For `utr` follow `groups/utr/references/runbook.md` Phase 0 → 3.
