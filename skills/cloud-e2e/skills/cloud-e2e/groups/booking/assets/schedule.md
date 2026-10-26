# Group booking — schedule (lanes, order, windows)

Env DM-X. 29 scenarios, ≈ 609 worker-minutes, group seed ≈ 90 min. Pace rule: up to 3 workers (≥ 3 disjoint lanes). Wall clock ≈ 6 h for one runner (`env-plan.md` §7.2: Day 1).

## Order

| Step | What                                                                             | Worker | Notes                                                                                           |
| ---- | -------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| 0    | R2 group seed P2 → P3a → P3b → P5 → P9 (+ P6 / P7 optional) and gates BKG-G1..G4 | runner | `seed/README.md`                                                                                |
| 1    | **AV** part 1 (lanes L1 HPA → L2 HPB → L6 HPC / PM, ≈ 200 min)                   | W1     | sequential inside the family; BKG-07 part 1 on R                                                |
| 1    | **BD** (L4 HPE / HPF) then **FH** (L3 HPD; BKG-13 last, needs BD's bookings)     | W2     | SP used by FH and BD in separate profiles is fine, but this order keeps one SP worker at a time |
| 1    | **RR** then **IP** (L5 ER / HPG / HPH, SP2)                                      | W3     | BKG-22 waits ≥ 15 min inside                                                                    |
| 2    | **X25 part 1** (preparation, flags still ON)                                     | W3     | after RR / IP and FH, before the W-X-WRITE-OFF slot                                             |
| W    | **X10** in W-X-SERIES-OFF (Day 1 15:30–15:55)                                    | 1      | pauses booking AV only (AV must be idle: plan it after AV part 1 or between AV lanes)           |
| W    | **X25 part 2** in W-X-WRITE-OFF state 2 (Day 1 16:00–17:30, after swap SWP-14)   | 1      | pauses swap B–E, booking FH / BD / RR / IP, partner PAPI                                        |
| 3    | **NT** (BKG-27, BKG-28)                                                          | 1      | after FH, BD, RR, IP (and before the steward deletes the run partner)                           |
| 4    | **AV part 2** (BKG-07 part 2) on R+1                                             | 1      | regenerate the prompt with `--run-date <R+1>`                                                   |

## Windows owned by this group

| Window                       | Class                  | Scenario               | Change                                                                                                                | Est.                 | Pauses                                            |
| ---------------------------- | ---------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------- |
| W-X-SERIES-OFF               | INTERNAL               | BKG-10                 | `poma.flows.availabilitySeries` → false → true                                                                        | 25 min               | booking AV                                        |
| W-X-WRITE-OFF (state 2 of 2) | FLAG, shared with swap | BKG-25                 | `writeShiftsOnPrem` false (from swap), `writeResourceReplacementShiftsToPep` false, `simulatePEP` true → all restored | 90 min (both states) | swap B–E, booking FH / BD / RR / IP, partner PAPI |
| J-X-JOBS                     | JOBS                   | BKG-26 (fallback only) | `AvailabilityConflictChecker` with `tenantIds=<DM-X>`                                                                 | 10 min               | other job triggers on DM-X                        |

**W-X-WRITE-OFF hand-over.** The swap runner requests the window and runs SWP-14 first. When X25 part 1 is done, the booking runner writes "booking next" into the window doc's `reason`; swap's X14 then leaves `writeShiftsOnPrem` OFF (`handover.json`) and X25 part 2 continues in the same window, restores all three flags and the booking runner releases. If booking is not ready, swap restores and releases; booking requests the window again later (FIFO) and sets all three flags itself.

Restore rule: set the baseline value back (never delete an override), prove it with a fresh `config/features` read.

## Parallel with other groups on DM-X

- swap, partner, hp, ts use other people. SP / SP2 see other planners' objects: filter by own ids.
- BKG-27 reads the steward's run partner; tell the steward when NT is reported (last booking reader).
