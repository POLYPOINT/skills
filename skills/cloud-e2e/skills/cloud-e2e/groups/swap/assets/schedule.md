# Group swap — schedule (lanes, order, windows)

Env DM-X. 33 scenarios, ≈ 1095 worker-minutes, group seed ≈ 90 min (`pp-plan.sh`) or ≈ 180 min (PEP paints). Pace rule: up to 3 workers (≥ 3 disjoint lanes). Wall clock ≈ 9 h over 1.5 days for one runner (`env-plan.md` §7.2: Day 1 and Day 2 morning).

## Order

| Step | What                                                                                       | Workers | Notes                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 0    | R2 group seed S1 → S3 → S5/S6 → S7 → S8 + gates                                            | runner  | `seed/README.md`                                                                                                                  |
| 1    | Family **A** (starts with SWP-01)                                                          | 1       | the other lanes start when SWP-01 is PASS (it checks capabilities, flags, rights and every allocated cell)                        |
| 2    | Lanes in parallel: **L1** = B → D, **L2** = A (rest) → C, **L3** = E                       | 3       | disjoint (person, day) cells; D only when G-SWP-EVT = PASS (else D is BLOCKED and L1 ends after B)                                |
| 3    | Family **F**                                                                               | 1       | after B and D are reported (reads their notifications and partner events); SWP-36 needs a TODAY shift before the next expiry tick |
| W    | **X03**, **X07** (Day 2, 08:00–09:20) and **X14** (Day 1, 16:00–17:30 with booking BKG-25) | 1 each  | launched only when the window doc is `active`; every other swap worker finishes its running scenario and waits                    |

## Windows owned by this group

| Window                       | Class                     | Scenario | Change                                                | Est.                 | Pauses                                            | Slot (`env-plan.md` §7.2) |
| ---------------------------- | ------------------------- | -------- | ----------------------------------------------------- | -------------------- | ------------------------------------------------- | ------------------------- |
| W-X-TRADES-OFF               | FLAG                      | SWP-03   | `poma.flows.shiftTrades` → false → true               | 45 min               | swap A–F, partner PAPI / PE, hp HP / PV           | Day 2 08:00               |
| W-X-CATEGORIES-OFF           | FLAG                      | SWP-07   | `poma.flows.shiftTradesWithCategories` → false → true | 35 min               | swap A–F, partner PAPI                            | Day 2 after TRADES-OFF    |
| W-X-WRITE-OFF (state 1 of 2) | FLAG, shared with booking | SWP-14   | `poma.onPrem.writeShiftsOnPrem` → false               | 90 min (both states) | swap B–E, booking FH / BD / RR / IP, partner PAPI | Day 1 16:00               |

**W-X-WRITE-OFF hand-over.** One window, two states. The swap runner requests it; X14 step 0 runs before. When SWP-14 is done: if the booking runner has written "booking next" into the window doc's `reason`, X14 leaves `writeShiftsOnPrem` OFF (`handover.json`) and booking's X25 sets its two extra flags, runs BKG-25 and restores all three; the booking runner writes the restore proof and releases. Otherwise X14 restores and the swap runner releases; booking requests the window again later.

Restore rule for every swap window: **set the baseline value back** (`flag set … true`), never delete the override (the steward set the baseline explicitly; `shiftTradesWithCategories` defaults to false), and prove it with a fresh `config/features` read.

## Parallel with other groups on DM-X

- booking, partner, hp, ts use other people and other cells; their windows pause swap families as listed in their `group.json` (`W-X-WRITE-OFF` only).
- SWP-31 reads the steward's run partner; the steward deletes it only after the last reader (swap F, booking NT, partner) reported.

## Critical path and slack

Swap is the critical path of DM-X. If it slips, SWP-26..29 (family E) move to the next morning without effect on other groups; SWP-36 is optional.
