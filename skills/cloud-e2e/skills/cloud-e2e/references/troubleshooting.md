# Troubleshooting — symptom → cause → fix

Generic entries; group signatures are in each group package (UTR: `groups/utr/references/troubleshooting.md`, KNOWN-FAIL signatures in every group's `references/known-deviations.md`).

## Environment and box

- P4 routes missing after DONE, api-pp exits on its Liquibase startup check, tenant health DOWN → **DM-213**: deploymate skill §6a (the steward's SYS step in their own terminal, then the job re-run).
- `412` and empty day plans on one tenant → stored version below the endpoint minimum: gate G1 (portal version reload), then re-run.
- `500 UNKOWN_ON_PREM_VERSION` → version unparsable (e.g. `ERROR_LOADING`): fix the stored version, wait ≤ 3 min.
- api-pp 404 "Shift definition with id N not found" (as `/days` 404 / 500, writes 500 / 409) → gate G4b not done for N: `scripts/psc-enqueue.sh <env> shift-definition N` (+ `palette`, `policy-of`), then the read gate; not a finding until it persists after the refresh.
- `sql.sh` exit 124 "timed out" → box or tunnel hangs; check the effect of a DML before re-running it.
- SSH / `tunnels.sh` timeout → IP not allowlisted: `dm-api.sh refresh-ip <id> --union` (operator: union is automatic, `/32` only; 400 `operator_cidr_not_single_host` = a range was sent). Allowlist full (≈ 10 entries) → the steward removes a stale entry.
- Env stopped in the morning, IP changed → auto-stop was on: `dm-api.sh auto-stop <id> off` (owner), `start`, PEP cold start.

## PEP

- `pe-ready.sh` exit 4 "COLD START NEEDED" (agent down or no `TfrmPEPMain`) or "DEPLOY NEEDED" (no agent token) → the steward: `PE_COLD_START=1 PE_USER=<login> scripts/pep/pe-ready.sh <id>`; exit 5 = two PEP login windows → close one, rerun; exit 3 = IDM login failed → stop, check the user, never retry blindly.
- PEP agent unreachable from a runner's machine → `dm-join.sh` wrote no inventory (no OPERATOR share / no RDP reveal) or `PEP_ANSIBLE_ROOT` differs; re-run `dm-join.sh <id>`.
- `pe-paint.sh` exit 5 (neighbour changed) → stop, both snapshots into `blockers`; never repaint blindly.

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
