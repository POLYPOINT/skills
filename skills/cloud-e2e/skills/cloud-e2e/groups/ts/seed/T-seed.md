# Group ts — group seed (R2), runner

Run after R1 (claims: N4, N4X, optional N4B on Pflege Geriatrie; the node is shared with swap's U1..U4, the people are not). Log in `results/<run>/ts/seed-log.md`, objects in `results/<run>/ts/created/seed.jsonl`.

## T1 — capability and version gate (gate TS-G1)

1. N4 login (`app.mjs <env> <N4 login> - <outdir> --app mypp`, profile `results/<run>/ts/.profiles/seed`): capabilities contain `TIMESHEET`; N4 has plannings in the current month and one employment (`employments` response); `debugPage` ON (the "Debug" profile entry exists).
2. Version probe (read-only; the endpoint answers the feature-disabled status while the flag is OFF — then run the probe as the first step inside W-X-TIMESHEET instead): `api.call('GET', '/api/mobile/timesheet/v1/reports?employment-id=<N4>&month=<M0>&mock=false')` → `envelope.employmentId` = N4's employment → `VERSION_GATE = pass`; the example `4711` / `2026-08` → `fail`. Optionally confirm read-only in pp-services with `git merge-base --is-ancestor <commit> <pinned build commit>` for the api-gw `mock` switch and APIPP-1808.
3. Write `VERSION_GATE`, the months (`MM1`, `MP1`, `MP2`, `MP13`) and N4's DB-check days (`GD1..GD3`: three planned days of M0 / M−1 up to today) into the run config.

## T2 — Sollplan saved for M+1, not for M+2 (gate TS-G2)

1. PEP lock `locks/<env>~pep` (create-if-absent, renew ≤ 10 min) → `scripts/pep/pe-ready.sh <env>` → plan sheet of N4's Gruppe (`N4_NODE`).
2. Plain-click one cell of M+1 (the menu item is greyed until a cell is selected and saves the month of that cell), then "Bearbeiten → Sollplan sichern [M+1]…" → "Wollen Sie die aktuellen Plandaten als Sollplan … sichern?" → Ja (done this way on `e2e-pilot-av` 2026-11-02; no pep-driver flow exists, OQ-20); screenshots before / after; do **not** save M+2. Release the lock.
3. Verify by the DB (read-only): `SELECT SICHERUNGS_ID, GRUPPEN_ID, TO_CHAR(DATUM,'YYYY-MM-DD'), SOLLPLAN FROM ECBERN.PLANSICHERUNG WHERE GRUPPEN_ID = <N4_NODE> ORDER BY DATUM;` → one row with SOLLPLAN `T` for the 1st of M+1, none for M+2 (also listed by `verify-kits.sql`); inside the window HPN-19 steps 4 / 5 confirm it. No PEP path → TS-G2 FAIL: HPN-19 steps 4–5 BLOCKED, the rest runs.
4. The save stays after the run; log it. The option "Es muss ein Sollplan gesichert sein" is **on** on DeployMate boxes (seed `ZEITBEGRENZTSOLLPLANSICHERN = T`), so the save makes M+1 of the Geriatrie Gruppe visible to its HPs (swap's U1..U4 included); M+2 stays hidden there.

## T3 — optional second employment for N4B (HPN-20)

PEP (lock, exploratory): N4B gets a second employment B continuing past M0 and the first employment A ends before M0 (Personal → Anstellung), PSC enqueue (`scripts/psc-enqueue.sh <env> employment <N4B id>`), re-login N4B. Not done → HPN-20 BLOCKED-data. Restore only if the env is reused.
