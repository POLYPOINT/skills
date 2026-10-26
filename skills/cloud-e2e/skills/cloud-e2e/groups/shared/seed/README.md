# Group shared — preparation (runner)

Nothing is seeded on a shared tenant. The runner prepares access and consent only (`SH-seed.md`), logs each step in `results/<run>/shared/seed-log.md`, and writes nothing into the shared tenants before the families run.

| Step                                                    | Doc          | Who                                                   | Est.                            |
| ------------------------------------------------------- | ------------ | ----------------------------------------------------- | ------------------------------- |
| SH1 consents, gates, cred files, per-family run configs | `SH-seed.md` | runner (+ user for the decisions OQ-22, OQ-28, OQ-33) | 30–60 min (waiting for answers) |
