# R — rights for the planner actors (group planner)

The groups, roles and node selections exist (steward role kit). This step moves only the claimed actors, with the core script `scripts/seed/common/kit-member.sql` (sqlplus only: the role trigger skips JDBC thin sessions; the script refuses unclaimed / non-seed users and enqueues `PERMISSION_GROUP_MAPPING`).

| Step    | User    | Move                                                                                 | Why                                               |
| ------- | ------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| R1      | PLANALL | into `E2E:PLANALL` (1050 / 1060 / 1061 / 1070, all nodes); stays in `DMSEED:Planner` | POOL_MANAGER + SHIFT_PLANNER over all nodes       |
| R1 / R3 | SPA     | into `E2E:SP-GA` (node selection G-A); **leaves** `DMSEED:Planner`                   | an all-node seed membership would widen its nodes |
| R2 / R3 | PMA     | into `E2E:PM-GA` (node selection G-A); **leaves** `DMSEED:Planner`                   | same                                              |
| R4      | TA      | done by the steward (`E2E:TA`, out of `DMSEED:Planner`)                              | kit actor borrowed by auth / ops: verify only     |

```
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<PLANALL MA_ID> -D kit="E2E:PLANALL" -D leave=-
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<SPA MA_ID>     -D kit="E2E:SP-GA"   -D leave="DMSEED:Planner"
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<PMA MA_ID>     -D kit="E2E:PM-GA"   -D leave="DMSEED:Planner"
```

Log the `BEFORE|…` / `AFTER|…` lines in `created/seed.jsonl` (restore record); every actor logs in again before its gate.

**Gates (after ≤ 3 min, one login each with `app.mjs … --app poma`, save `roles(api)`):**

- **PSP-G1** roles: PLANALL ⊇ {ROLE_POOL_MANAGER, ROLE_SHIFT_PLANNER}; SPA ROLE_SHIFT_PLANNER without ROLE_POOL_MANAGER; PMA ROLE_POOL_MANAGER without ROLE_SHIFT_PLANNER; TA ROLE_TENANT_ADMIN; SEEDSP recorded (OQ-17, also the steward's G-ROLES).
- **PSP-G2** `GET /api/private/organization/readable-nodes`: SPA and PMA only the G-A subtree (`planner-checks.sql` C1b), PLANALL the whole tree.
- SPA / PMA still see all nodes (PSP-G2) → seed trap "PEP - Leitbediener" (every seed login is a member; its LEITBEDIENER role can grant all permissions): move again with `-D leave="DMSEED:Planner|PEP - Leitbediener"`, re-login, re-check.
- A miss after one retry → the move through UsrAdmin in a pep-verify session under the PEP lock (fallback of `env-plan.md` §6.2) and re-check; still missing → BLOCKED for that actor's scenarios ("role not in token"), tell the steward.

## R5 — HP9 "alle Monate sichtbar" (PSP-21)

No kit provides it: create an own role `PSP:AlleMonate` (myPOLYPOINT application, the option "alle Monate sichtbar" of page 11770986525) in UsrAdmin through a pep-verify exploratory session under `locks/<env>~pep`, assign it to HP9 only, screenshots of every dialog; log the role id. Enqueue `PERMISSION_ROLE` for it (`scripts/psc-enqueue.sh <env> permission-role <role id> 2610`) and the Keycloak mapping (`scripts/psc-enqueue.sh <env> keycloak-role-mapping <role id>`, arguments unverified: G-ROLES) and re-login HP9 (`--app mypp`). No UsrAdmin path → PSP-21's HP9 part is BLOCKED (note in the seed log); HP8's part still runs.
