# Group partner — group seed (R2), runner

Run after R1 (claims written: PH1–PH5 on Notfallzentrum, SPX, SPN, optional ERX on Intensivpflege, the two Gruppe nodes, the prefix `e2e-ptn-<tag>`) and after the steward logged OK in `kits/<env>` (role kit with `E2E:EXTPOOL`, definitions kit + G4b, flag baseline, `pp-plan.sh` verification) and in `stage/*` (run partner, provider gate, today's GLN). Everything here touches only this group's claimed rows. Log every step (time, ok, verification value) in `results/<run>/partner/seed-log.md`, every created or changed object in `results/<run>/partner/created/seed.jsonl`.

| Step                                                   | Doc                                                | Who                   | PEP        | Est.   |
| ------------------------------------------------------ | -------------------------------------------------- | --------------------- | ---------- | ------ |
| P-PTN-6 SPX into `E2E:EXTPOOL`                         | `P-seed.md` + `scripts/seed/common/kit-member.sql` | runner (SSH, sqlplus) | no         | 5 min  |
| P-PTN-7 logins, tenant subjects, gates PTN-G1 / PTN-G2 | `P-seed.md`                                        | runner                | no         | 15 min |
| P-PTN-9 days, PTN-G3                                   | `P-seed.md`                                        | runner                | no         | 15 min |
| P-PTN-9b optional ERX presence on `RRX_DAY`            | `P-seed.md`                                        | runner                | fallback   | 10 min |
| P-PTN-11 oracles, PEP coordinates, PTN-G5              | `P-seed.md` + `../scripts/ext-planning.sql`        | runner                | short lock | 15 min |

Never in this seed: flags, the run partner, the GLN, the provider (steward); definitions, palettes, role rows (kits); GAT; jobs; any test-data endpoint; another group's people.

Optional actors (partner ERX; auth IMPBLK, DISU) are claimed and listed in the run config like every other role: `gen-prompts.py` needs every role of `rules.json` (and `--claims` refuses an unclaimed one). When a person is short, give the role a claimed spare and let the scenario step that needs it report BLOCKED-data.
