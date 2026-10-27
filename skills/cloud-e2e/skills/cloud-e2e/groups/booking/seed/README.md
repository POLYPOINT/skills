# Group booking — group seed (R2), runner

Run after R1 (claims: the 13 Medizin people of `group.json` roles, optional HPM, the Medizin plan-sheet node, the pool names `E2E-BKG-A`, `E2E-BKG-B`, `E2E-BKG-IPO` as `pool-…` claims) and after the steward's kits are logged OK in `kits/<env>` (role kit with `E2E:SP-ALL` / `E2E:PM-ALL`, definitions kit with internal-pool day Dienste and POMA shift types, G4b, flag baseline, `pp-plan.sh` verification, run partner). Log every step in `results/<run>/booking/seed-log.md`, every object in `results/<run>/booking/created/seed.jsonl`.

| Step                                           | Doc                                                                | Who                            | PEP               | Est.   |
| ---------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ | ----------------- | ------ |
| P2 kit membership (SP, SP2, PM)                | `P2-P3-roles-pools.md` + core `scripts/seed/common/kit-member.sql` | runner (sqlplus)               | no                | 10 min |
| P3a one login per actor                        | `P2-P3-roles-pools.md`                                             | runner                         | no                | 15 min |
| P3b pools                                      | `P2-P3-roles-pools.md`                                             | runner (PM in the planner app) | no                | 15 min |
| P5 paints                                      | `P5-paints.md` + `paint-plan.tsv`                                  | runner                         | fallback          | 20 min |
| P9 oracles + gate BKG-G4                       | `P6-P7-P9-extras.md`                                               | runner                         | no                | 10 min |
| P6 paging fixtures (optional, after family BD) | `P6-P7-P9-extras.md`                                               | runner                         | no                | 15 min |
| P7 second employment HPM (optional)            | `P6-P7-P9-extras.md`                                               | runner                         | yes (exploratory) | 30 min |

Removed against the area plan: P1 flags (steward baseline), P4 internal-pool flag on Dienste (definitions kit), P8 own partner (the steward's run partner is read instead). Never: definitions, `DMSEED:Planner` role rows, flags, GAT, test-data endpoints, jobs.
