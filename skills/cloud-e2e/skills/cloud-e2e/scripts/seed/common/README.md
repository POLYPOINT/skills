# Common seed — SQL runbook of the env steward (S1) and the kit-membership moves of the group runners (R2)

Box-side SQL every group of an env relies on (synthesis `env-plan.md` §6.2). Paths are relative to the skill folder; `<env>` =
DeployMate env id = CT tenant id. Everything runs through `scripts/sql.sh` (SSH + **sqlplus** on the box): never a JDBC thin
client — the role trigger and the PSC triggers skip thin sessions, and the kit files refuse them. Nothing here is a credential;
`sql.sh` reads the revealed DB login from `$DM_CONFIG_DIR/<env>.credentials.json`.

## Who runs what

| file                  | who                                                         | when                                                                                         | parameters (`-D name=value`, all mandatory)                    | idempotent                       |
| --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| `audit.sql`           | steward                                                     | S1 step 1 (partition first, before any login)                                                | —                                                              | read-only                        |
| `rights.sql`          | steward                                                     | S1 step 2                                                                                    | `role_id` = POLYUSRROLEID of group `DMSEED:Planner` (audit A2) | yes (moved unchanged from UTR)   |
| `r0-root-rows.sql`    | steward                                                     | S1 step 3, then PEP restart → re-save 111/112/113/141/145 → restart (UTR seed README step j) | `team_node` = a Pflege palette node (audit A6)                 | yes (guards unverified)          |
| `stamm-fix.sql`       | steward                                                     | S1 step 3 (UTR step k)                                                                       | —                                                              | yes                              |
| `definitions-kit.sql` | steward                                                     | S1 step 4, before any group seed; then restart PEP                                           | `env_role`, `nodes`, `abs_codes`, `swap_abs`                   | yes                              |
| `role-kit.sql`        | steward                                                     | S1 step 5                                                                                    | `env_role`, `ga_node`                                          | yes                              |
| `kit-member.sql`      | steward (TA on Y) · group runners (own claimed actors only) | after `role-kit.sql`; R2 of each group                                                       | `ma_ids`, `kit`, `leave`                                       | yes                              |
| `verify-kits.sql`     | steward; anyone (read-only)                                 | after S1 step 5, every daily pre-flight                                                      | `env_role`                                                     | read-only                        |
| `psc-batch.sql`       | UTR group seed (step c2)                                    | after UTR's own definition steps                                                             | `team_node`, `emp_ids`                                         | yes (moved unchanged; UTR codes) |

The kits carry their own G4b lines (persistence-state-change enqueues at the end, after the COMMIT); `scripts/psc-enqueue.sh`
covers any later single change.

## S1 order per env (steward)

```
scripts/sql.sh <env> --install                                         # once per box (dm-sql.ps1)
scripts/sql.sh <env> -f scripts/seed/common/audit.sql > results/<run>/audit-<env>.txt
#   → partition (envs/<env>.partitions) and the claim plan BEFORE any login; logins = lower(POLYUSER.KUERZEL), ASCII only
scripts/sql.sh <env> -f scripts/seed/common/rights.sql -D role_id=<DMSEED:Planner role id>
scripts/sql.sh <env> -f scripts/seed/common/r0-root-rows.sql -D team_node=<Pflege palette node>
#   → restart PEP, re-save 111/112/113/141/145 in Definitionen › Dienst, restart PEP (UTR seed README step j, under the PEP lock)
scripts/sql.sh <env> -f scripts/seed/common/stamm-fix.sql
# DM-X
scripts/sql.sh <env> -f scripts/seed/common/definitions-kit.sql -D env_role=X -D nodes=<n1,n2,…> -D abs_codes=25,57,60 -D swap_abs=<one of them>
scripts/sql.sh <env> -f scripts/seed/common/role-kit.sql -D env_role=X -D ga_node=-
# DM-Y
scripts/sql.sh <env> -f scripts/seed/common/definitions-kit.sql -D env_role=Y -D nodes=- -D abs_codes=- -D swap_abs=-
scripts/sql.sh <env> -f scripts/seed/common/role-kit.sql -D env_role=Y -D ga_node=<planner G-A Gruppe node>
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<TA MA_ID> -D kit="E2E:TA" -D leave="DMSEED:Planner"
# both
PE_COLD_START=1 PE_USER=<seed planner login> scripts/pep/pe-ready.sh <env>   # PEP reloads definitions (PEP lock held)
scripts/sql.sh <env> -f scripts/seed/common/verify-kits.sql -D env_role=X|Y | grep '^CHECK|'
```

Log every step (step, ok, time, verification value) in the coordination doc `kits/<env>` (coordination.md).

### Parameters of `definitions-kit.sql`

| name        | DM-X                                                                                                                                                     | DM-Y |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `env_role`  | `X`                                                                                                                                                      | `Y`  |
| `nodes`     | the Gruppe palette nodes of the X groups that paint absences (audit A6: swap's Chirurgie + Geriatrie, booking's Medizin, hp's Geburtshilfe / Paediatrie) | `-`  |
| `abs_codes` | absence codes for those palettes (UTR's `25,57,60`; never `145`, a seed defect)                                                                          | `-`  |
| `swap_abs`  | the ONE swappable absence (one of `abs_codes`)                                                                                                           | `-`  |

Effect: POMA shift types 111 EARLY (1) / 113 NORMAL (2) / 112 LATE (3) / 141 NIGHT (4) on both envs (api-pp
`PomaShiftTypeConverter` = enum ordinal); on X `DIENSTTAUSCH 'T'` on 111/112/113 and `swap_abs` (141 stays `F`), `DIENST_TEILEN 'T'`
on every detail of 111/112/113, `INTERNER_POOL 'T'` on 111/112/113 (column of pp-services ≥ feature-26-3; reported when absent),
palette rows for `abs_codes` on `nodes`. G4b: `SHIFT_DEFINITION` (111–141, 145, the absences), `SHIFT_DEFINITION_POLICY` (details of
111–141), `SHIFT_DEFINITION_PALETTE` (node 1 + `nodes`) — this also refreshes the R0 rows.

### Kit groups of `role-kit.sql`

| env | group           | app  | rights (function:operation, 6 = EXECUTE)                              | node selection              | cloud role (mapping)         | used by                                        |
| --- | --------------- | ---- | --------------------------------------------------------------------- | --------------------------- | ---------------------------- | ---------------------------------------------- |
| X   | `E2E:SP-ALL`    | 2471 | 1050, 1061, 1070                                                      | all (`E2E:Alle Knoten`, −2) | ROLE_SHIFT_PLANNER           | swap SP, booking SP / SP2                      |
| X   | `E2E:PM-ALL`    | 2471 | 1060                                                                  | all                         | ROLE_POOL_MANAGER            | booking PM                                     |
| X   | `E2E:EXTPOOL`   | 2471 | 1065, 1062                                                            | all                         | —                            | partner SPX                                    |
| X   | `E2E:HP-NOSWAP` | 2610 | copy of the seed logins' myPOLYPOINT role without 200005 (and 200015) | all                         | —                            | swap T10 = HPX                                 |
| Y   | `E2E:PLANALL`   | 2471 | 1050, 1060, 1061, 1070                                                | all                         | SHIFT_PLANNER + POOL_MANAGER | planner PLAN-ALL                               |
| Y   | `E2E:SP-GA`     | 2471 | 1050, 1061, 1070                                                      | `E2E:G-A` = `ga_node`       | ROLE_SHIFT_PLANNER           | planner SP-A                                   |
| Y   | `E2E:PM-GA`     | 2471 | 1060                                                                  | `E2E:G-A`                   | ROLE_POOL_MANAGER            | planner PM-A                                   |
| Y   | `E2E:TA`        | 2610 | 200015, 200010 + mapping `ROLE_TENANT_ADMIN`                          | all                         | ROLE_TENANT_ADMIN            | TA (kit actor; auth, ops borrow it read-only)  |
| Y   | `E2E:HP-PLAIN`  | 2471 | the 13 mobile-app rows of `rights.sql`                                | all                         | —                            | auth plain-HP actors (out of `DMSEED:Planner`) |

The role trigger `TIUD_POLYUSRROLE_DETAIL` mints the Keycloak mapping rows of 1050 / 1060 / 1061; the kit inserts them only
when still missing after the rights insert (never collides). `ROLE_TENANT_ADMIN` has no trigger branch: the kit inserts it with
the domain the box already uses for that role, else `MY-POLYPOINT`.

## Membership moves (`kit-member.sql`, group runners)

Only **claimed** employees of the group (`claims/<env>~emp-<MA_ID>`, hard rule 5); only seed logins (`DMSEED-*`) are accepted.

```
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<MA_ID[,MA_ID…]> -D kit="E2E:<KIT>" -D leave="<group|group>|-"
```

- The `BEFORE|…` / `AFTER|…` lines are the restore record: log them in the group's `created_data`.
- Each app the user still belongs to keeps exactly one default group (the joined kit group when none is left, else
  `DMSEED:Planner`).
- G4b: `PERMISSION_GROUP_MAPPING (user, app)` after the COMMIT; the actor **logs in again** before its gate.
- **Seed trap — "PEP - Leitbediener".** Every seed login is also a member of `PEP - Leitbediener` (default group; LEITBEDIENER
  role; UTR first run, audit A2). api-pp grants all permissions to an administrator login where the call accepts one
  (`PermissionService`), so an actor that must _lack_ a right can still show it. When a "lacks right X" gate fails (HPX still
  `submit_shift_trade: true`; SP-A sees all nodes; a plain HP lands on the planner app), move it again with
  `-D leave="DMSEED:Planner|PEP - Leitbediener"`; HPX also leaves the seed myPOLYPOINT group named by `verify-kits.sql` K9.
  `verify-kits.sql` prints a `CHECK|WARN|… member … is still in …` line for every such membership.
- Restore (cleanup when the env is reused): the same call with `kit` = the group left before and `leave` = the kit group.

## Gates after the kits

| gate              | check                                                                                                                                                                                                                                                                                                                                                                                | blocks                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | -------- | ---------------------- |
| CHECK lines       | `verify-kits.sql -D env_role=X                                                                                                                                                                                                                                                                                                                                                       | Y`: no `CHECK                             | MISSING` | every group of the env |
| G4b (definitions) | as a swap HP: `GET /api/mobile/health-professional/v1/calendar/planned-shift-detail` of a 111 planning → `available_for_shift_trade: true`; as a planner: `GET /api/private/shift-definition/roster?…` lists EARLY / NIGHT shift types and `…&available-for-internal-pool=true` is non-empty                                                                                         | swap, booking IP, planner D1, hp own swap |
| G-ROLES           | one member per kit group logs in once (`app.mjs <env> <login> <script> <out> --app poma`), the script returns `roles(api)` (`e2e-lib.mjs`): SP kits → `ROLE_SHIFT_PLANNER`, PM kits → `ROLE_POOL_MANAGER`, TA → `ROLE_TENANT_ADMIN`, plain HP → no planner role; landing (`result.landing`) matches. Also tells whether plain seed logins already carry `ROLE_SHIFT_PLANNER` (OQ-17) | booking, planner, partner, auth           |

If G-ROLES fails although the CHECK lines are OK: enqueue the mapping again (`scripts/psc-enqueue.sh <env> keycloak-role-mapping
<role id>`), wait ≤ 3 min, re-login once; still failing → assign the role through UsrAdmin with pep-verify (PEP lock) and record
the outcome; never retry the SQL in a loop.

## Never

- Edit the `DMSEED:Planner` role rows (UTR family P owns them, inside UTR-P) or any seed role / group other than memberships of
  your own claimed actors.
- Flip a seed Dienst outside the definitions kit, or reseed during a run (kills every group's ids).
- Run any kit file from a JDBC tool (thin sessions skip the triggers).

## Troubleshooting

| message                                     | meaning / action                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `ORA-20001 kit SQL runs through sqlplus`    | you used a JDBC client: use `scripts/sql.sh`                                         |
| `ORA-20002 … must be …`                     | parameter missing or malformed: pass every `-D`, use `-` for "none"                  |
| `ORA-20003 seed Dienst 111 missing`         | not a customer-roster seed (or reseeded): stop, tell the steward                     |
| `ORA-20004/20005 … is not a Dienst`         | the absence code does not exist on this image: pick codes from audit A8              |
| `ORA-20010 selection … exists without node` | `E2E:G-A` was created for another node: fix by hand, never change it during a run    |
| `ORA-20011 group … exists with role …`      | a manual edit or a name clash: fix by hand                                           |
| `sql.sh: placeholder &x is not defined`     | pass `-D x=…` (sql.sh refuses to send a script with an undefined placeholder)        |
| `sql.sh: timed out` (exit 124)              | check the effect with `verify-kits.sql` before re-running (the files are idempotent) |
