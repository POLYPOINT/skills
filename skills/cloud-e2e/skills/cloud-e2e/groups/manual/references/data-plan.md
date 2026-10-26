# Group manual — data plan (testers, devices, accounts, consents)

Human sessions use existing tenants and their users; nothing is seeded for them. The runner prepares people, devices, accounts and consents (`../seed/README.md`) and records the results as rows.

## 1. Sessions and what each needs

| Session   | Testers | Devices / access                                                                                         | Accounts                                                                                                | Consent / window                                                                      |
| --------- | ------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| teams     | 1       | Teams desktop (+ mobile for one layout check)                                                            | Azure dev tenant `wr7g0` users from the team's secret store (OQ-27: is the tenant alive?)               | ct-zinc-master owners (link resets, `poma.msTeams.notifications`); shared HPN-26 = GO |
| phone     | 1       | physical phone (Android preferred), the store / TestFlight Testing app; an older build for HPN-27 step 4 | one DM-X seed HP login free at that time (a spare claimed by `manual`, or an actor of a finished group) | —                                                                                     |
| pep-rdp   | 1       | RDP client, own OPERATOR reveal of DM-X and DM-Y                                                         | seed planner logins of the env (free at that time); the team mailbox for AUT-19 (OQ-24)                 | `locks/<env>~pep` per block; AUT-19 inside W-Y-MSG (ON phase)                         |
| mail      | 1       | mail client                                                                                              | an SP and an HP of ct-zinc-master with owned mailboxes                                                  | ct-zinc-master owners (`sendEmailConfirmation` ON for the session)                    |
| staging   | 1       | Staging access, Beekeeper app / web                                                                      | `aermo` on `preview-hive-test`, Beekeeper test tenant `andras2.dev.beekeeper.io` (secret store)         | Staging owner (`beekeeperFullPwa` for HPN-23) — **no agent on Staging**               |
| smartpep  | 1       | browser                                                                                                  | an HP of `preview-smartpep`                                                                             | Preview owners                                                                        |
| externals | 1       | GCP access (Pub/Sub subscription of the run partner), provider accounts                                  | the provider's own accounts                                                                             | the run partner still exists (steward); provider consent                              |

Passwords, mailbox links and codes stay with the testers (password manager / their own terminal); never in a row, note, screenshot or prompt.

## 2. Timing (`env-plan.md` §7.2, Day 2 afternoon)

- teams after the shared group's HPN-26 GO; phone and pep-rdp (BKG-32, PTN-22) on DM-X 14:00–17:00 under the PEP lock; PSP-24 on DM-Y; AUT-19 as the last item of W-Y-MSG (Day 2 morning); staging, smartpep, externals whenever the testers are available.
- PTN-23 before the steward deletes the run partner (after the last automated reader).

## 3. Concurrency

| State                               | Rule                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| PEP desktop of DM-X / DM-Y          | the runner holds `locks/<env>~pep` for the tester (`holder "<tester>/manual"`); no RDP while a pep-driver agent holds the lock |
| Teams links of the `wr7g0` users    | announced to the ct-zinc-master owners; restored as agreed                                                                     |
| Booking mail flag on ct-zinc-master | owners set it ON for the session and back afterwards                                                                           |
| Send Messages on DM-Y (AUT-19)      | only in the ON phase of the steward's W-Y-MSG                                                                                  |
| Staging                             | humans only                                                                                                                    |

## 4. Cleanup

The checklists end with their cleanup (cancel swaps / bookings / RR / IPO created by the session, delete AUT-19's employee and user, restore flags and links as agreed). The runner lists open items in `groups/manual.summary`.
