# Group planner — schedule (lanes, order, windows)

Env DM-Y. 21 runnable scenarios (+ PSP-14 merged), ≈ 390 worker-minutes, group seed ≈ 3 h (mostly PEP). Pace rule: 2 workers plus a PEP-serialised tail. Wall clock ≈ 7 h (+ one night if the job trigger is refused). Recommended plan (`env-plan.md` §7.2): runner R3, Day 1 on DM-Y.

## Order

| Step | What                                                                                                                               | Worker | Notes                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| 0a   | R1–R4 membership moves (SQL), gates PSP-G1 / PSP-G2                                                                                | runner | Day 1 08:00–09:30 while UTR runs its Phase 1                                        |
| 0b   | D1–D3 own Dienste + R5 (PEP), one G4b batch, gate PSP-GD                                                                           | runner | **after UTR's Phase 1 PEP part** (Day 1 10:30–12:30): the PEP desktop is shared     |
| 0c   | F1–F11 cloud fixtures, gates PSP-G3 / PSP-G4                                                                                       | runner | F8 GAT as SPA only                                                                  |
| 1    | L1: **NAV** → **POOL** (PSP-19 needs J-Y-JOBS) → **METRICS**                                                                       | W1     | PSP-07 c after PSP-19 inside POOL                                                   |
| 1    | L2: **PERM** → **SP** → **ADMIN**                                                                                                  | W2     | ADMIN records PSP-16's restore value                                                |
| 2    | PEP tail: **CONF** (PSP-17, PSP-18 in J-Y-JOBS, PSP-16 in W-Y-CONFRULE ≈ 14:00) → **WISH** → **PEPSET** (PSP-20, then PSP-21 last) | 1      | PEP holds short; PSP-21 only in W-Y-SOLLPLAN after utr finished (Day 2 14:30–15:20) |

## Windows owned by this group

| Window       | Class                         | Scenario       | Change                                                                                                        | Est.   | Pauses                                    | Slot                                                                 |
| ------------ | ----------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------- | -------------------------------------------------------------------- |
| W-Y-CONFRULE | INTERNAL                      | PSP-16         | tenant extra rule `ALWAYS_CONFLICT_TEST_RULE` added → removed                                                 | 15 min | planner PERM / CONF (find-HP reads)       | Day 1 ≈ 14:00                                                        |
| W-Y-SOLLPLAN | FLAG (HARD vs utr)            | PSP-21         | PEP option "Es muss ein Sollplan gesichert sein" on → recorded value                                          | 50 min | utr (all families), auth UM, planner WISH | after utr is done (Day 2 14:30)                                      |
| J-Y-JOBS     | JOBS (shared with ops OPS-18) | PSP-18, PSP-19 | `AvailabilityConflictChecker`, `EmploymentExpiration` (maybe `ResyncUserEmployments`) with `tenantIds=<DM-Y>` | 30 min | other job triggers on DM-Y                | Day 1 16:00–17:30 (or the overnight cron: read on Day 2 after 08:00) |

Restore proofs: PSP-16 `restore-proof.json` (config GET = recorded value), PSP-21 `restore-proof.json` (option value + a roster read). The runner writes them into the window doc and releases.

## Parallel with other groups on DM-Y

- utr owns Pflege Chirurgie + Paediatrie and is the heaviest PEP user: planner D-steps after UTR's Phase 1 PEP part; PSP-21 after utr finished.
- auth and ops borrow TA read-only: planner never changes TA's rights or language at the end of a scenario (NAV restores DE).
- W-Y-MSG (auth / ops, HARD) pauses every DM-Y group: planner workers finish their current scenario and wait.
