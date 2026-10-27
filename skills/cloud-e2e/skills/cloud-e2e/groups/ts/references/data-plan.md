# Group ts — data plan (version gate, group seed, concurrency)

Source: `areas/hp-notif/data-plan.md` §1.2, §4 (T1–T3), §5 (window E-TS) with the S1 reconciliations: ts is its own group because `poma.flows.timesheet` replaces the UTR month table for every HP of the tenant (`month-report.component.html:6-29`) — ts runs on **DM-X**, utr on DM-Y; window E-TS → **W-X-TIMESHEET**; the Sollplan save T2 is this group's seed step (no coordination with planner PSP-21, which runs on DM-Y).

## 1. Version gate (HPN-19 only; seed T1, gate TS-G1)

1. `GET /api/capabilities/v1/capabilities` lists `TIMESHEET` (on-prem 26.99 ≥ 26.4.0).
2. The box's pp-services build must contain (a) the api-gw change that switches the source with `mock` (cloud commit `89d7e960e0` "api-gw dropped formatted"; not in pp-services `origin/master` of 2026-10-15) and (b) APIPP-1808 (api-pp 416 `TIMESHEET_TARGET_PLAN_MISSING` / `…_BEYOND_LOOK_AHEAD`, branch `origin/feature/APIPP-1808-timesheet-accounts-credits`). Probe (read-only, inside the window or with the flag OFF via the API): as N4 with the debug toggle off, `GET /api/mobile/timesheet/v1/reports?employment-id=<N4>&month=<M0>&mock=false` must return `envelope.employmentId` = N4's employment (not the example `4711`).
3. Gate failed → HPN-19 = KNOWN-FAIL HPN-K1 (runs and shows the drift) or BLOCKED "version gate"; HPN-17 / HPN-18 still run (mock path). A pinned build with both changes needs its own env (`env-plan.md` §7.3 case 2, OQ-39).

## 2. Actors (partition P1 = Pflege Geriatrie, shared Gruppe with swap's U1..U4; people claims are exclusive)

| Token          | Role                                                              | Needs                                                                                                         | Used by             |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| N4             | timesheet HP                                                      | one employment; plannings in the current month (seed window); its Gruppe node gets the M+1 Sollplan save (T2) | HPN-17, 18, 19      |
| N4X            | foreign employment holder                                         | any claimed Geriatrie person; never logged in; only its employment id is used                                 | HPN-18 step 1 (403) |
| N4B (optional) | HP with two employments: A ends before the run month, B continues | T3 PEP data fix                                                                                               | HPN-20              |

## 3. Group seed (R2, runner)

| Step          | What                                                                                                                                                                                                                                                                | PEP            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| T1            | capability + version probe → `VERSION_GATE` pass / fail (gate TS-G1)                                                                                                                                                                                                | no             |
| T2            | Sollplan **saved** for M+1 on N4's Gruppe node (`N4_NODE`), **not** saved for M+2: PEP "Bearbeiten → Sollplan sichern [M+1]" (exploratory pep-verify under `locks/<env>~pep`; no pep-driver flow yet, OQ-20); verify with HPN-19 steps 4 / 5 or the DB (gate TS-G2) | yes (≈ 20 min) |
| T3 (optional) | N4B: second employment + end date of the first (PEP Personal → Anstellung, PSC enqueue); else HPN-20 BLOCKED-data                                                                                                                                                   | yes            |

On DM-X the PEP option "Es muss ein Sollplan gesichert sein" is off, so the M+1 save changes no roster visibility for swap / booking / partner / hp.

## 4. Concurrency

| Scenario    | State                                 | Effect                                                                | Rule                                                                                                          |
| ----------- | ------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| HPN-17..20  | `poma.flows.timesheet` ON             | replaces the month report with the timesheet for **every HP of DM-X** | W-X-TIMESHEET (FLAG, ≈ 90 min incl. 2 × propagation): pauses hp HP (HPN-01 sweep); never on a tenant with utr |
| T2          | Sollplan of M+1 on the Geriatrie node | none on DM-X (option off)                                             | PEP lock only                                                                                                 |
| HPN-17 / 19 | the browser-local API-GW toggle       | per profile                                                           | own profile                                                                                                   |

No stage-wide state, no job, no test-data endpoint, no GAT.
