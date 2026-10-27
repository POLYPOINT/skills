# P2 / P3 — kit membership, first logins, pools (group booking)

## P2 — kit membership (core `scripts/seed/common/kit-member.sql`; sqlplus only, it enqueues `PERMISSION_GROUP_MAPPING`)

| User | Kit group                                  | Leaves  | Why                                                                                                |
| ---- | ------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------- |
| SP   | `E2E:SP-ALL` (1050, 1061, 1070, all nodes) | nothing | 1061 `book_pool_employee` is not in `DMSEED:Planner`; without it the planner app hides Find HP     |
| SP2  | `E2E:SP-ALL`                               | nothing | RR / IP lane, own opportunity lists                                                                |
| PM   | `E2E:PM-ALL` (1060)                        | nothing | ROLE_POOL_MANAGER (the trigger mints it only for 1060); PM then lands on `/pool-manager/dashboard` |

```
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<SP MA_ID>,<SP2 MA_ID> -D kit="E2E:SP-ALL" -D leave=-
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<PM MA_ID>             -D kit="E2E:PM-ALL" -D leave=-
```

Log the `BEFORE|…` / `AFTER|…` lines in `created/seed.jsonl` (restore record).

**Gate BKG-G1** (after ≤ 3 min, one login each with `app.mjs … --app poma`): SP / SP2 permissions carry `pool.book_pool_employee` and `resource_replacement.start_resource_replacement` = true (Find HP and "Anfragen verwalten" in the menu); decoded roles (`roles(api)`, names only) contain `ROLE_SHIFT_PLANNER`; PM's `result.json` `landing` is `/pool-manager/dashboard` with `ROLE_POOL_MANAGER`. Not reflected after one retry → UsrAdmin through a pep-verify session under the PEP lock (fallback of `env-plan.md` §6.2), then re-check; still not → BLOCKED for FH / BD / RR / IP (tell the steward: role kit).

## P3a — one login per actor

HPA, HPB, HPC, HPD, HPE, HPF, HPG, HPH, ER, HPN (and HPM if claimed) with `app.mjs <env> <login> - <outdir> --app mypp`; SP, SP2, PM with `--app poma`. Profile folder `results/<run>/booking/.profiles/seed`. This creates the POMA user rows (`current-user/sync`) needed for pools and notifications. ≤ 2 password submissions per login.

## P3b — pools (PM in the planner app)

1. PM: `/pool-manager/manage-pools/add` → name `E2E-BKG-A`, category = the Medizin Station(s), members HPA, HPB, HPC, HPD, HPE, HPF → save; capture `POST /api/private/tenant/pools-with-users` → pool id.
2. `E2E-BKG-B` with HPE only.
3. `E2E-BKG-IPO` with HPG, HPH.
4. **Gate BKG-G3:** `GET /api/private/tenant/pools/{id}/users` for each → members as listed (`pep_employment_id` not null). Write the ids into the run config placeholders `POOL_A`, `POOL_B`, `POOL_IPO` and claim the pool names (`claims/<env>~pool-E2E-BKG-A` …).

Expected noise: "added to pool" NC rows (N-20) for the members — notification assertions filter by object id and time.
