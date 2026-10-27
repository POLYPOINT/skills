# Group auth — seed steps A1 … A8 (runner)

Paths relative to the cloud-e2e skill folder; `<env>` = DM-Y env id; results in `results/<run>/auth/`.

## A1 — actors, kit moves, gate AUT-G2

1. Pick the actors inside the claimed partition (Geriatrie + Notfall + IPS) by the rules of `../references/data-plan.md` §2 (ASCII kürzel, one employment for EMPU, NEWU never logged in — check `polyid-admin.mjs … user-read <NEWU>` → exit 2 after A2). Write `results/<run>/auth/auth-allocation.md` (token, login, MITARBEITER_ID, Station).
2. Plain-HP actors into the kit group (one call, own claimed ids only):
   ```
   scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<HPA,LOCKU,PWU,OTPU,T2FU,OFFU,BLKU,NEWU,EMPU[,IMPBLK,DISU]> -D kit="E2E:HP-PLAIN" -D leave="DMSEED:Planner"
   ```
   Log the `BEFORE|` / `AFTER|` lines (restore record). SEEDSP and NOHP stay in `DMSEED:Planner`.
3. **AUT-G2**: every actor except NEWU logs in once (`node scripts/harness/app.mjs <env> "<login>" <script> <out> --app mypp`, one call per login, ≤ 1 password submission); the script saves `roles(api)` (names only) and, in memory, the tenant-subject claim value → `auth-allocation.md`. Expected: HPA (and every plain HP) `ROLE_HEALTH_PROFESSIONAL` without `ROLE_SHIFT_PLANNER`; SEEDSP both; TA `ROLE_TENANT_ADMIN` (TA logs in with `--app customer-portal`). A plain HP still showing `ROLE_SHIFT_PLANNER` → the seed trap of `scripts/seed/common/README.md`: move it again with `-D leave="PEP - Leitbediener"`, log in once more. NOHP is checked after A3.

## A2 — ops sessions, gate AUT-G1

1. Headed sign-ins (personal accounts, ≈ 1.5 h): `node scripts/harness/polyid-admin.mjs <pidops-profile> <out> <env> login` and `node scripts/harness/portal-ops.mjs <portal-profile> login <out>`.
2. **AUT-G1**: `polyid-admin.mjs … provider-read` → provider id (→ run config `PROVIDER_ID`), type `API_GATEWAY_VALIDATION`, `twoFactorType` DISABLED, domain `<env>.ch`; `applied-policies` → no locked subject; `portal-ops.mjs <portal-profile> "tenant read <env>" <out>` → `send_messages` false. Record in `env-facts.md`. Also read and record any provider-specific security policy thresholds (OQ-38).

## A3 — NOHP without the HP client role

Box Keycloak admin console through the tunnel (`scripts/tunnels.sh <env> - <digit>` → `https://localhost:<digit>8383`, realm `POLYP01`): user `dmseed-<kürzel of NOHP>` → Role mapping → client `polypoint-poolmanagement` → remove `ROLE_HEALTH_PROFESSIONAL`. Then NOHP logs in once (`app.mjs … --app poma`) and `roles(api)` shows no `ROLE_HEALTH_PROFESSIONAL` (nothing re-syncs it from PEP — a guess this check settles). Restore: add the role back.

## A5 — PWU e-mail → the team mailbox

Box Keycloak admin → user PWU → e-mail = the team mailbox (run config `AUTH_MAILBOX`, verified). For AUT-08 also check the UsrAdmin e-mail of PWU (pep-verify read under the PEP lock, or the operator over RDP holding the lock); set it if it differs. Restore: the manifest e-mail in both places.

## A6 — retired (AUT-11 dropped, decision 2026-10-27, review F-01)

Not run. No actor gets a mobile number and no `MOBILE_OR_EMAIL` override is set: the 2FA code would fall back to the seeded e-mail.

## A8 — optional DISU / NOEMP

- DISU: a claimed spare seed login → Keycloak "Enabled" off. Restore: on.
- NOEMP: a new Keycloak user without a POLYUSER / employee link, password typed by the runner in the admin console and kept in the runner's own 0600 cred file outside `results/` (`--cred-file` of the harness). Delete it in cleanup.
  Both optional: skip → AUT-04 step 6 is reported "not run (A8 skipped)". In the run config NOEMP then gets `{"login": "none", "id": 0}` (it needs no claim); DISU stays a claimed, unchanged spare.

## Run config values

`PIDOPS_PROFILE`, `PORTAL_PROFILE`, `PROVIDER_ID`, `AUTH_MAILBOX`, `SMS_LOGGER_URL` (or `none`), employees for every role (TA = the kit actor's login, `id` from `kits/<env>`), then `python3 -I scripts/gen-prompts.py results/<run>/auth/run-config.json --group auth --claims results/<run>/auth/claims.json`.
