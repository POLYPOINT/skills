# Troubleshooting — symptom → cause → fix

Generic entries; group signatures are in each group package (UTR: `groups/utr/references/troubleshooting.md`, KNOWN-FAIL signatures in every group's `references/known-deviations.md`).

## Environment and box

- P4 routes missing after DONE, api-pp exits on its Liquibase startup check, tenant health DOWN → **DM-213**: deploymate skill §6a: `dm-repair-dm213.sh <id>` (upgrade with the owner's revealed DB login, job re-run, health wait; no human step).
- `412` and empty day plans on one tenant → stored version below the endpoint minimum: gate G1 (portal version reload), then re-run.
- `500 UNKOWN_ON_PREM_VERSION` → version unparsable (e.g. `ERROR_LOADING`): fix the stored version, wait ≤ 3 min.
- api-pp 404 "Shift definition with id N not found" (as `/days` 404 / 500, writes 500 / 409) → gate G4b not done for N: `scripts/psc-enqueue.sh <env> shift-definition N` (+ `palette`, `policy-of`), then the read gate; not a finding until it persists after the refresh.
- api-pp `PlanningRuleBookNotFoundException` ("Planungsregelwerk mit ID 1 nicht gefunden") on `read/shift_trades` or `direct-shift-planning` → seed gap 2: `scripts/sql.sh <env> -f scripts/seed/common/rulebook.sql` (steward S1 step 3).
- Swap candidates empty or "Diensttausch" not offered on 111 / 112 / 113, `verify-kits.sql` POMA shift type `MISSING` → seed gap 1: `definitions-kit.sql` was skipped (steward S1 step 4).
- `POST shift-trades` 500 (`PlannedShiftDetailDTO.getEnd()` null), or the single-shift view of a seeded day has no "Diensttausch" → seed gap 3: seed plannings carry no BLOCK rows; use PEP-painted days (`pe-paint.sh` reports their BLOCK rows), not seed plannings.
- myPP / HP reads show nothing from the 1st of next month on, while api-pp with the service token returns the plannings → seed gap 4: no Sollplan for that month and Gruppe (`ZEITBEGRENZTSOLLPLANSICHERN = T`); the group owning that Gruppe saves it in PEP (Bearbeiten › "Sollplan sichern"), unless a scenario needs the month unsaved (`scripts/seed/common/README.md` "Seed gaps" #4).
- `api-pp.sh avail` answers `{}` although the user has availabilities → the employment id (`MA_ID`) was passed: availability reads take the employee id (`EMP_ID`, audit A1). A month read with a wrong id stays cached empty: restart api-pp or read another month.
- `pp-plan.sh` / api-pp `direct-shift-planning` 500 with `ORA-12899 … PLANUNGSEINHEIT.LCUSER (34 > 30)` in the api-pp log → product defect on DeployMate boxes (service client id longer than the audit column): paint with `pe-paint.sh` under the PEP lock.
- `sql.sh` exit 124 "timed out" → box or tunnel hangs; check the effect of a DML before re-running it.
- SSH / `tunnels.sh` timeout → IP not allowlisted: `dm-api.sh refresh-ip <id> --union` (operator: union is automatic, `/32` only; 400 `operator_cidr_not_single_host` = a range was sent). Allowlist full (≈ 10 entries) → the steward removes a stale entry.
- Env stopped in the morning, IP changed → auto-stop was on: `dm-api.sh auto-stop <id> off` (owner), `start`, PEP cold start.

## PEP

- `pe-ready.sh` exit 4 "COLD START NEEDED" (agent down or no `TfrmPEPMain`) or "DEPLOY NEEDED" (no agent token) → the steward: `PE_COLD_START=1 PE_USER=<login> scripts/pep/pe-ready.sh <id>`; exit 5 = two PEP login windows → close one, rerun; exit 3 = IDM login failed → stop, check the user, never retry blindly.
- PEP agent unreachable from a runner's machine → `dm-join.sh` wrote no inventory (no OPERATOR share / no RDP reveal) or `PEP_ANSIBLE_ROOT` differs; re-run `dm-join.sh <id>`.
- `pe-paint.sh` exit 5 (neighbour changed) → stop, both snapshots into `blockers`; never repaint blindly.
- `pe-paint.sh` exit 6 (painted, but a dialog is left after the reopen) → the close click missed the sheet tab or the node click missed: close the dialog (screenshot first), read the close box of the sheet tab and the node from a screenshot, set `PE_CLOSE_X/Y` / `PE_NODE_X/Y` (the tab close box moves with the node name: ≈ 71 for "Geburtshilfe", 95 for "Pflege Paediatrie", 89 default), then the next cell.
- A paint lands on the previously painted cell (deferred repaint) → an old `pe-paint.sh` without the plain click on the target first; repaint that cell with the current script and check both by SQL.

## Coordination

- Claim batch refused → another group holds an id of your batch (partition conflict): delete what your batch created, read the conflicting claim, ask the steward (`envs/<id>.partitions`).
- `gen-prompts.py --claims` refuses → an employee or login of the run config is not claimed by your group: claim it (R1) or fix the config.
- PEP lock held > 30 min → the holder's runner is stuck or gone: tell the steward (takeover only after `expiresAt`, `coordination.md` §3.2).
- A window stays `draining` → a runner did not report its paused family finished (`activeWorkers`): ask that runner; a lost runner → stale-runner procedure (`coordination.md` §5).
- ArtifactData write refused "exists" on a row / runner doc → you wrote without `if_version`: `get` it, write again with the version. Refused on `run` / `envs` / `kits` / `stage` / `schedule` → steward collections (write `admin`).
- ArtifactData write refused for a runner on every collection → the dashboard is not shared with them at Contributor (claude.ai share menu, steward), or the plan does not let members write (dry run failed → mode `gcs` / `degraded`, `coordination.md` §7).
- Dashboard shows "Live data unavailable" → opened outside claude.ai or without access; the data is intact (`ArtifactData list`).

## Identity and messaging

- Logins fail after bad attempts (USER_OR_IP_LOCKED) → PolyID lockout of the caller IP: the steward reads and unlocks one exact subject (`polyid-admin.mjs … unlock`; CT / Preview only; Staging: tell the user, manual). Then re-run the blocked scenarios (re-check brief).
- `flags-baseline.py` exit 1 → two groups (or a group and the env plan) want different baseline values for one flag: fix the group package before seeding; never pick one silently.
- G-FLAGS mismatch after setting the baseline → propagation (wait 5 min, re-read) or a stale tenant form save reverted it (T-Y-TENANTFORM): set again, re-read.
- `portal-ops.mjs partner create` HTTP 400 → `name` must be a language map (`{"de": …, "en": …, "fr": …, "it": …}`), not a string. `partner logging on` exit 5 "logging needs at least one subscription" → the partner has no subscription (portal-events: 400 "At least one filter must be provided"): create it with one (e.g. `PLANNED_SHIFTS`); logging cannot be switched on without.
