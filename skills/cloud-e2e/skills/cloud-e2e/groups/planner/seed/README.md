# Group planner — group seed (R2), runner

Run after R1 (claims: the 13 Medizin people incl. TA, HP5 / HP6 of Geburtshilfe, the G-A / G-B plan-sheet nodes, prefix `PSP`) and after the steward's kits are logged OK in `kits/<env>` (role kit with `E2E:PLANALL`, `E2E:SP-GA`, `E2E:PM-GA`, `E2E:TA` + TA's membership, definitions kit with POMA shift types, G4b, flag baseline, gate G-ROLES). Log every step in `results/<run>/planner/seed-log.md`, every object in `results/<run>/planner/created/seed.jsonl`.

| Step                                     | Doc                                                       | PEP                         | Est.   |
| ---------------------------------------- | --------------------------------------------------------- | --------------------------- | ------ |
| R1–R4 membership, gates PSP-G1 / G2      | `R-rights.md` + core `scripts/seed/common/kit-member.sql` | no                          | 20 min |
| R5 HP9 role "alle Monate sichtbar"       | `R-rights.md`                                             | yes (UsrAdmin, exploratory) | 20 min |
| D1–D3 own Dienste, G4b, gate PSP-GD      | `D-definitions.md` + `../scripts/planner-checks.sql`      | yes                         | 90 min |
| F1–F11 cloud fixtures, gates PSP-G3 / G4 | `F-fixtures.md`                                           | no (F4 / F5 optional: PEP)  | 40 min |

Order R → G1 / G2 → D (after UTR's Phase 1 PEP part) → F → G3 / G4 / GD. Never: seed Dienste, `DMSEED:Planner` role rows, TA's rights, flags, GAT `clean` / `shift-trades`, test-data endpoints, untargeted jobs.
