# S3 — kit membership moves (group swap)

The kit groups and their rights exist already (steward role kit, `kits/<env>`). This step only moves this group's claimed users, with the core script `scripts/seed/common/kit-member.sql` (sqlplus through `scripts/sql.sh` only: the role trigger skips JDBC thin sessions; the script refuses unclaimed / non-seed users and enqueues `PERMISSION_GROUP_MAPPING` itself).

| User | Move                                                                                                                                                                                                                                                                       | Why                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| T10  | into `E2E:HP-NOSWAP` (myPOLYPOINT app 2610: the seed myPOLYPOINT role without 200005), out of the seed group(s) that grant 200005 (`verify-kits.sql` K9 lines in `kits/<env>`); stays in `DMSEED:Planner` (its app-2471 mobile rights incl. 1030 licence keep myPP usable) | HPX: no right 200005 "Diensttausch einreichen" (SWP-01, SWP-03) |
| SP   | into `E2E:SP-ALL`, stays in `DMSEED:Planner`                                                                                                                                                                                                                               | 1061 + 1050 + 1070 on all nodes; cloud role SHIFT_PLANNER       |

```
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<T10 MA_ID> -D kit="E2E:HP-NOSWAP" -D leave="<K9 group names, |-separated>"
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<SP MA_ID>  -D kit="E2E:SP-ALL"    -D leave=-
```

Log the `BEFORE|…` / `AFTER|…` lines in `created/seed.jsonl` (restore record). Then:

1. Log T10 and SP in again (`app.mjs … -` for T10 with `--app mypp`, for SP with `--app poma`): a fresh token carries the new roles.
2. Verify: T10's permissions block shows `shift_trade.submit_shift_trade: false` (present); SP's `result.json` `landing` is `/shift-planner/…` and its decoded roles (`roles(api)` of `e2e-lib.mjs`, names only) contain `ROLE_SHIFT_PLANNER`.
3. T10 still shows `submit_shift_trade: true` → seed trap "PEP - Leitbediener" (every seed login is a member; its LEITBEDIENER role can grant all permissions): move again with `-D leave="<K9 groups>|PEP - Leitbediener"`, re-login, re-check. If K9 names `DMSEED:Planner` itself, do **not** leave it (the DM-X role kit has no `E2E:HP-PLAIN`: T10 would lose the mobile rights incl. the 1030 licence) — tell the steward (role-kit decision) and keep SWP-03 part A BLOCKED "HPX still holds 200005" until fixed. After any move check that T10 still logs in to myPP.
4. Still wrong after one retry → the move in UsrAdmin through a pep-verify session under the PEP lock (fallback of `env-plan.md` §6.2), log it, re-check; else BLOCKED for SWP-03 part A (tell the steward).

Restore (only if the env is reused): the same call with `kit` = the group left and `leave` = the kit group.
