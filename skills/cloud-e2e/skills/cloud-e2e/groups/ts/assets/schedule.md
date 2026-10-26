# Group ts — schedule

Env DM-X. 4 scenarios, ≈ 90 worker-minutes, 1 worker. Wall clock ≈ 2.5 h including T1 / T2. Recommended plan (`env-plan.md` §7.2): runner R4, Day 2 on DM-X (after hp).

| Step | What                                                                            | Who      | When                                  |
| ---- | ------------------------------------------------------------------------------- | -------- | ------------------------------------- |
| 0    | T1 version probe (capability + `mock=false` identity), T3 optional              | runner   | Day 2 08:00                           |
| 1    | T2 Sollplan save for M+1 on N4's Gruppe node (PEP lock, exploratory pep-verify) | runner   | Day 2 08:00–09:20 (PEP lock ≈ 20 min) |
| W    | **TS** family in **W-X-TIMESHEET** (flag ON → HPN-17, 18, 19, 20 → flag OFF)    | 1 worker | Day 2 09:30–11:00                     |

## Window owned by this group

| Window        | Class | Scenarios  | Change                                      | Est.                           | Pauses                                             |
| ------------- | ----- | ---------- | ------------------------------------------- | ------------------------------ | -------------------------------------------------- |
| W-X-TIMESHEET | FLAG  | HPN-17..20 | `poma.flows.timesheet` false → true → false | 90 min (incl. 2 × propagation) | hp HP (HPN-01 route sweep visits the month report) |

**Never on a tenant with utr** (the flag replaces the UTR month table): ts is on DM-X, utr on DM-Y. Not during hp's W-X-SYSMSG either (layout of myPP screens).
