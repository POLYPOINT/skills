# Manual session — mail (BKG-31)

|         |                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Testers | 1 person who can read the owned mailboxes of an SP and an HP                                                                        |
| Where   | CT `ct-zinc-master` (DeployMate users have synthetic `@<env>.ch` mailboxes; `sendEmailConfirmation` is OFF on every DeployMate env) |
| Consent | ct-zinc-master owners: `poma.internalPool.sendEmailConfirmation` ON for the session (record the value before and set it back)       |
| Time    | ≈ 20 min                                                                                                                            |
| Record  | PASS / FAIL / BLOCKED; screenshots of the two mails (personal data cropped) → the runner writes `scenarios/manual~BKG-31`           |

## BKG-31 — Booking confirmation e-mail to SP and HP

1. On ct-zinc-master, an SP and an HP whose mailboxes the tester owns: book the HP via Find HP once **with** a comment and once **without** (fix `f0749ab666`).
2. Check both mailboxes.
   Expect: one e-mail to the SP and one to the HP per booking, in the recipient's language, with correct booking data.

## After the session

- Cancel both bookings; set `sendEmailConfirmation` back to its recorded value (owners).
