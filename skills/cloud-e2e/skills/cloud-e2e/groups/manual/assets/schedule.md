# Group manual — schedule (sessions)

17 scenarios, ≈ 605 human minutes, about half a day for 2–3 testers (`env-plan.md` §7.2: Day 2 afternoon; AUT-19 in the morning window).

| Session             | Scenarios                         | Est.    | When                                                   | Depends on                                        |
| ------------------- | --------------------------------- | ------- | ------------------------------------------------------ | ------------------------------------------------- |
| pep-rdp (DM-Y part) | AUT-19                            | 60 min  | Day 2 08:00–09:20, last item of **W-Y-MSG** (ON phase) | steward's window, team mailbox, DM-Y PEP lock     |
| teams               | HPN-25 → SWP-32 → BKG-29 → AUT-15 | 165 min | Day 2 afternoon                                        | shared HPN-26 GO; ct-zinc-master owners           |
| phone               | SWP-34, BKG-30, HPN-27            | 95 min  | Day 2 14:00–17:00 (DM-X)                               | a free DM-X HP login; the runner as second actor  |
| pep-rdp (DM-X part) | BKG-32, PTN-22                    | 80 min  | Day 2 14:00–17:00 under `locks/<DM-X>~pep`             | booking-partner records for PTN-22 (else BLOCKED) |
| pep-rdp (DM-Y part) | PSP-24                            | 20 min  | Day 2 afternoon under `locks/<DM-Y>~pep`               | after the planner group's PEP work                |
| mail                | BKG-31                            | 20 min  | any                                                    | owners' consent                                   |
| staging             | HPN-22, HPN-23                    | 75 min  | any                                                    | Staging access (humans only)                      |
| smartpep            | PSP-23                            | 30 min  | any                                                    | preview-smartpep access                           |
| externals           | PTN-23, PTN-24                    | 60 min  | PTN-23 before the run partner is deleted               | GCP access; provider consent                      |

Rows: the runner writes `scenarios/manual~<id>` as each tester reports; `manual/<session>` holds the checklist state. Sessions that cannot happen (no tester, no device, no consent) are reported BLOCKED with the reason — never PASS.
