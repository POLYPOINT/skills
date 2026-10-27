# Group partner — seed steps P-PTN-6 … P-PTN-11 (runner)

Paths relative to the cloud-e2e skill folder; `<env>` = DM-X env id; `<run>` = run name; results in `results/<run>/partner/`.

## P-PTN-6 — SPX into the kit group `E2E:EXTPOOL`

```
scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<SPX MA_ID> -D kit="E2E:EXTPOOL" -D leave=-
```

SPX keeps `DMSEED:Planner` (1050 RR start, 1070 trade approval). Log the `BEFORE|` / `AFTER|` lines in `created/seed.jsonl` (restore record). The script enqueues `PERMISSION_GROUP_MAPPING`; SPX logs in again in P-PTN-7.

## P-PTN-7 — logins, tenant subjects, gates

1. One login per actor, one harness call each (never a shell loop over logins):
   - `node scripts/harness/app.mjs <env> <PHn login> - results/<run>/partner/seed/login-PHn --app mypp` for PH1..PH5;
   - `… <SPX login> <script> … --app poma` and `… <SPN login> <script> … --app poma`, the script saving `roles(api)` (role names only) and the planner permissions response (`external_pool.book_external_pool_employee`, `pool.import_external_bookings`).
2. Tenant subjects: inside each myPP login script decode the bearer in memory and write only the subject claim value to `partner-allocation.md` (or take the subjects from the run partner's v2 full-sync users list in PTN-04 — but PAPI needs them before, so record them here).
3. **PTN-G1**: SPX both permissions true, SPN both false; SPX opens `/partner-simulator` (no redirect) and BADI shows "Externe Pools". SPX still false → move again with `-D leave="PEP - Leitbediener"` only if the kit README's seed-trap note applies, else tell the steward (G-ROLES).
4. **PTN-G2**: every login `loggedIn: true`; record in `env-facts.md`.

## P-PTN-9 — days and trade eligibility

1. Seeded roster window from `envs/<env>.roster`. Pick (rules in `../rules.json` DAY_RULES):
   - `ST_DAY`: a weekday ≥ R+2 where PH1 has a 111/112/113 planning (`scripts/plan-day.sh <env> <PH1> <day>`);
   - `SR_DAY` ≥ R+3 where PH4 has "(no rows)";
   - `CM_DAY` (current month, ≥ R+2) and `NM_DAY` (next month) where PH5 has "(no rows)";
   - `XD1`..`XD8` eight consecutive weekdays ≥ R+7 after the roster end; `XD7N` = day after `XD7`; `XD9` / `XD10` = `XD8` + 1 / + 2.
2. **PTN-G3**: myPP as PH1 → `calendar/day-view?date=<ST_DAY>` → ids of PH1's shift; `GET /api/mobile/health-professional/v1/calendar/shift-trade-candidates?…` (or the partner endpoint with the run partner's HP token) lists PH2 and PH3. If not: pick another `ST_DAY`; if no day works, make PH2 / PH3 free on `ST_DAY` with `scripts/pp-plan.sh <env> <PH2|PH3> <ST_DAY> <their PA code> DELETE` (own claimed cells only; log them) and re-check. Still empty → PTN-07 BLOCKED-data.
3. Write the tokens into `results/<run>/partner/run-config.json` (`days`) and into `partner-allocation.md`.

## P-PTN-9b — optional ERX presence on `RRX_DAY` (PTN-19)

`RRX_DAY` ≥ R+3 with ERX and PH5 "(no rows)"; paint ERX with `scripts/pp-plan.sh <env> <ERX> <RRX_DAY> 111 FULL` when `kits/<env>` marks pp-plan verified, else `scripts/pep/pe-paint.sh` under `locks/<env>~pep`. Verify with `plan-day.sh`; write "P-PTN-9b ok" into `partner-allocation.md` (PTN-19 checks it). Skip → PTN-19 BLOCKED-data.

## P-PTN-11 — oracles, PEP coordinates, booking-partner records

1. `scripts/sql.sh <env> -f groups/partner/scripts/ext-planning.sql -D node=- -D day_from=<XD1> -D day_to=<XD10>` → expect no rows (no external employee planned yet); keep the output as `seed/ext-planning-baseline.txt`.
2. Under the PEP lock (≤ 10 min): `pep/pe-ready.sh <env>`, open the plan sheet of Notfallzentrum, screenshot; record in `partner-allocation.md` the values `pe-paint.sh` needs for PH5 (`<radio_y> <slot_x> <slot_y> <row_y>`) and the PA code of a Dienst that is **not** "always visible" (111 by default; check `DIENST` flags read-only if unsure). Release the lock.
3. **PTN-G5**: as SPX `GET /api/private/external-bookings?page-size=10&current-page=0` → `total`. < 11 → write "PTN-G5 fail: no booking-partner records" into `env-facts.md` (PTN-16 list part BLOCKED-data; no BOOKING_PARTNER client is known on CT, OQ-29).
4. Fill the run config `config` values: `PARTNER_ID`, `GLN`, `PROVIDER_CODE` (from `stage/*`), `RUN_TAG`, `PH_NODE`, `SPX_NODE`, `PORTAL_PROFILE`, `POMA_OPS_PROFILE` — then `python3 -I scripts/gen-prompts.py results/<run>/partner/run-config.json --group partner --claims results/<run>/partner/claims.json`.
