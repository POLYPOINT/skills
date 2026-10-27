# Group ops — group seed (R2), runner

Run after R1 (claims: CPU's employee and login; the prefix `e2e-ops-<tag>`). No SQL, no PEP flow, no DeployMate change. Log every step in `results/<run>/ops/seed-log.md`.

| Step                                                                  | Doc         | Who                      | Est.   |
| --------------------------------------------------------------------- | ----------- | ------------------------ | ------ |
| O1 ops sessions, tenant facts, names, CPU (OPS-G1..G4)                | `O-seed.md` | runner (headed sign-ins) | 20 min |
| O2 browser engines, suite copy for the operator, single-role profiles | `O-seed.md` | runner / operator        | 10 min |

Never: master flags, jobs, cache resets, key rotation, test-data endpoints, another organisation's objects, DM-Y changes beyond the listed scenario steps.
