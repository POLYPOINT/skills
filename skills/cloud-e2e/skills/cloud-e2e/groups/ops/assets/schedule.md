# Group ops — schedule (lanes, order, windows)

Env DM-Y + CT portal. 25 scenarios, ≈ 436 worker-minutes, group seed ≈ 30 min. Pace rule: up to 3 workers (≥ 3 disjoint lanes). Wall clock ≈ 3.5 h for one runner (`env-plan.md` §7.2: Day 2, after hp / ts on the same runner; LIFE during W-Y-MSG).

## Order

| Step | What                                                                                                                                                                 | Workers | Notes                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| 0    | R2 seed O1 → O2 + gates OPS-G1..G4                                                                                                                                   | runner  | `seed/README.md`                                                                                   |
| 1    | **LIFE** (OPS-02 → 06, CT portal only) — may start right before / during **W-Y-MSG** (Day 2 08:00–09:20); count it under `activeWorkers.ct`                          | 1       | the only ops family besides X13 that runs during W-Y-MSG                                           |
| W1   | **X13** inside W-Y-MSG: part 1 (403 path, Send Messages OFF) → the runner tells the steward → steward switches ON → part 2 (one SMS; operator checks the sms-logger) | 1       | parallel with auth PWD parts                                                                       |
| 2    | After W-Y-MSG: lanes **TEN** (OPS-09 takes the PEP lock), **MON**, then **MISC** after LIFE                                                                          | 3       | MISC's OPS-23 needs the operator (suite report + master password)                                  |
| W2   | **X08** in W-Y-HEALTH (Day 2 ≈ 11:00, 20 min)                                                                                                                        | 1       | pauses ops TEN / MON / MISC: run it between their scenarios (the runner holds new launches)        |
| W3   | **X18** in J-Y-JOBS + S-CT-JOBS (Day 2 ≈ 13:00, 30 min)                                                                                                              | 1       | not concurrent with planner PSP-18 / 19 (same tenant-job slot)                                     |
| W4   | **X16** in S-CT-LOGLEVEL (Day 2 ≈ 13:40, ≤ 5 min at TRACE)                                                                                                           | 1       | CT pods only (`activeWorkers.ct`)                                                                  |
| W5   | **X19** in T-Y-TENANTFORM (any free slot outside W-Y-MSG / W-Y-HEALTH, 20 min)                                                                                       | 1       |                                                                                                    |
| 3    | summary, cleanup check (leftovers from `created/*.jsonl`), release claims                                                                                            | runner  | if LIFE ended before OPS-06, launch a re-check worker (`assets/recheck-brief.md`) with OPS-06 only |

## Windows owned by this group

| Window                             | Class | Scenario            | Change                                                                  | Est.       | Pauses                                       | Requested by     |
| ---------------------------------- | ----- | ------------------- | ----------------------------------------------------------------------- | ---------- | -------------------------------------------- | ---------------- |
| W-Y-HEALTH                         | FLAG  | OPS-08 (X08)        | `portal.onPrem.deephealthcheckIgnores` → `poly-time-connect` → restored | 20 min     | ops TEN / MON / MISC (tenant-health readers) | ops runner       |
| W-Y-MSG (shared with auth, manual) | HARD  | OPS-13 part 2 (X13) | Send Messages ON → OFF (steward)                                        | 90–150 min | every Y group except ops LIFE / X16          | steward          |
| J-Y-JOBS (shared with planner)     | JOBS  | OPS-18 (X18)        | `ResyncEmployeesWithNoEmploymentsJob` `tenantIds=<DM-Y>`                | 30 min     | other job triggers on DM-Y                   | ops runner       |
| S-CT-JOBS                          | STAGE | OPS-18 (X18)        | Tier A jobs on CT                                                       | 30 min     | —                                            | steward, user OK |
| S-CT-LOGLEVEL                      | STAGE | OPS-16 (X16)        | poma-core logger TRACE → restored on all pods                           | ≤ 5 min    | —                                            | steward, user OK |
| T-Y-TENANTFORM                     | FLAG  | OPS-19 step 4 (X19) | one unchanged "Save Tenant"                                             | 20 min     | none (FIFO keeps W-Y-MSG / W-Y-HEALTH out)   | ops runner       |

Restore rules: X08 sets the recorded value back (delete only if there was no tenant override) and proves it with a health read; X16 proves the level on every pod; X13 never touches Send Messages (steward). Every restore proof goes into the window doc before the release.

## Windows of other groups that pause ops

| Window                     | Owner   | Pauses                                                                                                                                                           |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W-Y-LOCKOUT, W-Y-TENANT2FA | auth    | ops families whose first step is a fresh login: TEN, MON, MISC, X08, X13, X18, X19 (LIFE / X16 log in with the ops profile, not a PolyID password login of DM-Y) |
| W-Y-SOLLPLAN               | planner | nothing in ops                                                                                                                                                   |
| UTR-P, W-Y-TRMODE          | utr     | nothing in ops                                                                                                                                                   |
