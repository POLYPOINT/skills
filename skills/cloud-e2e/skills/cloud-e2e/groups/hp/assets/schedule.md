# Group hp — schedule (lanes, order, windows)

Env DM-X (tenant only). 17 scenarios, ≈ 380 worker-minutes, group seed ≈ 30 min. Pace rule: 2 workers (2 disjoint lanes). Wall clock ≈ 4 h. Recommended plan (`env-plan.md` §7.2): runner R4, Day 1 on DM-X.

## Order

| Step | What                                                                                             | Worker                 | Notes                                                                    |
| ---- | ------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------ |
| 0    | H1 logins + N1 subject, H2 own swap N5 → N5C, H3 gates                                           | runner                 | Day 1 08:00–08:30                                                        |
| 1    | L1: **HP** (HPN-01..04, 06, 07, then 05) → **LG** → **SY** (HPN-16; HPN-15 waits for its window) | W1                     | N3 lane; HPN-05 as N5 / N5C at the end of HP                             |
| 1    | L2: **NC** (HPN-08 → 12) → **PV** (HPN-21, after HP reported)                                    | W2                     | N1 / N2 lane, then N5                                                    |
| W    | **HPN-15** in W-X-SYSMSG (Day 1 12:30–13:10)                                                     | W1 (or a fresh worker) | SOFT: pauses hp HP / NC / LG / PV and ts TS; restore = all texts deleted |

## Windows owned by this group

| Window     | Class | Scenario | Change                                                   | Est.   | Pauses                                               |
| ---------- | ----- | -------- | -------------------------------------------------------- | ------ | ---------------------------------------------------- |
| W-X-SYSMSG | SOFT  | HPN-15   | `general.incidents.incidentmsg.de` / `.fr` set → deleted | 40 min | hp HP / NC / LG / PV, ts TS (myPP layout assertions) |

## Windows of others that pause hp

- **W-X-TIMESHEET** (group ts, Day 2 09:30–11:00): pauses hp HP (HPN-01 visits the month report; with the flag ON the page is the timesheet). Run HPN-01 outside it.
- **W-X-TRADES-OFF** (group swap, Day 2 08:00): pauses hp HP and PV (HPN-02, HPN-05, HPN-21 read swap sections).

## Parallel with other groups on DM-X

hp uses its own 6 people; the baseline UI flags (team plan, debug page …) add UI for every HP of DM-X but change no write path. Partner readers filter generic-notification events by their own ids.
