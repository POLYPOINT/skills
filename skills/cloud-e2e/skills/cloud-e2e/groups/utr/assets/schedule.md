# UTR schedule — slots, order, exclusive phases

Extracted from `references/runbook.md` Phase 2 (v0.5.0, unchanged rules); `group.json` `schedule` holds the same plan as data.

| Step | Family                                          | Who / slot                                            | Precondition                                                                                             | Window                                                        |
| ---- | ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 0    | X (X-01..X-05, incl. gate G4b / X-05)           | the utr runner itself, first                          | Phase 1 done                                                                                             | —                                                             |
| 1    | slot A: **O → W → M**                           | worker, N = 2                                         | O: Pikett plannings of seed step s + G4b + 151 mirror gate; M after W on E1                              | —                                                             |
| 1    | slot B: **R → MO → L → C part 1**               | worker, N = 2                                         | L after R and after W on E3; C part 1 runs with the tenant in UNIFIED                                    | —                                                             |
| 2    | **P alone**                                     | worker, after R, O, W, L, MO                          | the operator's headed portal-ops login right before launch (P-03 first, ≈ 1.5 h session)                 | `UTR-P` (INTERNAL: rights, closing dates, past-days override) |
| 3    | **C part 2 alone, last**                        | worker (resume the C worker or a fresh part-2 prompt) | the LEGACY switch is owner-only: the steward runs `dm-api.sh time-recording <id> LEGACY`, then `UNIFIED` | `W-Y-TRMODE` (INTERNAL on DM-Y)                               |
| 4    | RE (if an environment fix invalidated verdicts) | worker, alone on those employees                      | the fix verified                                                                                         | —                                                             |

Rules:

- Never co-schedule two families that share an employee on the same days (R reads P0..P3 only, so it may run beside W).
- O must finish before P (P-04) and C part 2 (C-05 / C-07a reuse E2's Pikett).
- Pace rule: keep 2 workers running whenever two families are schedulable; launch the next one in the same turn a worker hands back. Slot B never waits (R and MO are independent); if slot B is free before W ends, the runner runs X meanwhile.
- A run that continues on a later day R′: recompute the R-relative tokens, check every pending absolute write day ≥ R′−6, P-03 uses day −1 / −2 of the day P runs, MO-02 / O-06 / W-10 need a planning on R′ (paint the Pikett for E2's new TODAY), daily pre-flight, regenerate the pending prompts with `--run-date R′`.
- Multi-group run on DM-Y: utr must be finished before planner's `W-Y-SOLLPLAN` (HARD against utr); no other DM-Y group records time, so `UTR-P` and `W-Y-TRMODE` pause only utr families.
