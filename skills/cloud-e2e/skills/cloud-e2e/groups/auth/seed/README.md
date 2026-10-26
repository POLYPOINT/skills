# Group auth — group seed (R2), runner

Run after R1 (claims written for every actor of `group.json` roles with `emp-` and `login-` kinds, NEWU included) and after the steward logged OK in `kits/<env>` (role kit incl. `E2E:HP-PLAIN` and `E2E:TA`, G-ROLES without touching any auth actor, flag baseline incl. `polyid.flows.allowPasswordResetForNonADUsers = false`). Everything here touches only this group's claimed actors. Log every step in `results/<run>/auth/seed-log.md`, every change in `results/<run>/auth/created/seed.jsonl` (with its restore).

| Step                               | Doc                                                | Who                                               | PEP   | Est.   |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------- | ----- | ------ |
| A1 actors, kit moves, gate AUT-G2  | `A-seed.md` + `scripts/seed/common/kit-member.sql` | runner (SSH, sqlplus)                             | no    | 25 min |
| A2 ops sessions, gate AUT-G1       | `A-seed.md`                                        | runner (headed)                                   | no    | 10 min |
| A3 NOHP role mapping               | `A-seed.md`                                        | runner, box Keycloak admin (tunnel)               | no    | 10 min |
| A5 PWU e-mail → team mailbox       | `A-seed.md`                                        | runner, box Keycloak admin (+ UsrAdmin, PEP lock) | short | 10 min |
| A6 SMSU mobile → sms-logger number | `A-seed.md`                                        | runner, after AUT-G3                              | no    | 10 min |
| A8 optional DISU / NOEMP           | `A-seed.md`                                        | runner, box Keycloak admin                        | no    | 15 min |

Never in this seed: the tenant provider, Send Messages, flags (steward / windows), another group's actors, any login of NEWU, any test-data endpoint, GAT, jobs. Box Keycloak admin credentials come from the runner's own DeployMate reveal and are typed by the runner in the headed admin console — never into a prompt, file or row.

Optional actors (partner ERX; auth IMPBLK, DISU) are claimed and listed in the run config like every other role: `gen-prompts.py` needs every role of `rules.json` (and `--claims` refuses an unclaimed one). When a person is short, give the role a claimed spare and let the scenario step that needs it report BLOCKED-data.
