# Group swap — group seed (R2), runner

Run after R1 (claims written: the 15 people of `group.json` roles + the plan-sheet nodes of P1 and P2 + the 2 spare Chirurgie people) and after the steward's S1 kits are logged OK in `kits/<env>` (definitions kit, role kit, G4b batch, flag baseline, `pp-plan.sh` verification). Everything here touches only this group's claimed rows. Log every step (time, ok, verification value) in `results/<run>/swap/seed-log.md` and every created / changed object in `results/<run>/swap/created/seed.jsonl`.

| Step                             | Doc                                                            | Who                   | PEP                        | Est.                                  |
| -------------------------------- | -------------------------------------------------------------- | --------------------- | -------------------------- | ------------------------------------- |
| S1 pick people and days          | `S1-pick.md`                                                   | runner                | no                         | 15 min                                |
| S3 kit membership (T10, SP)      | `S3-membership.md` + core `scripts/seed/common/kit-member.sql` | runner (SSH, sqlplus) | no                         | 10 min                                |
| S5 absences / on-call, S6 halves | `S5-S6-paints.md` + `paint-plan.tsv`                           | runner                | fallback only (full cells) | 30 min (`pp-plan.sh`) / 120 min (PEP) |
| S7 conflict candidate            | `S7-conflict.md`                                               | runner                | fallback                   | 15 min                                |
| S8 verify, logins, gates         | `S8-verify-gates.md`                                           | runner                | no                         | 20 min                                |

Never in this seed: definitions, palettes, `DMSEED:Planner` role rows, flags (all steward); GAT; any test-data endpoint; jobs.
