# Family METRICS — Pool metrics (PSP-08) · PLANALL, read-only

|                           |                                                                               |
| ------------------------- | ----------------------------------------------------------------------------- |
| Scenarios (in this order) | PSP-08                                                                        |
| Actors                    | PLANALL `{{PLANALL_LOGIN}}` (`--app poma --downloads`)                        |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/METRICS` · `{{RUN_DIR}}/METRICS/PSP-08/` |
| Read first                | the group brief; scenarios.md PSP-08; seed F6 booking (P-A, `{{D1}}`)         |
| PEP / windows             | none                                                                          |

## PSP-08 — Pool metrics: tabs, filters, paging, CSV, 12-month limit

1. `/pool-manager/pool-metrics`: tabs "Buchungen", "Interne Pool Anfragen", "Verfügbarkeiten". 2. Per tab: `#metrics-from-date` = R−30, `#metrics-end-date` = R+60 (R = `{{TODAY}}`); capture the paged request (`internal-pool-metrics/assignments|opportunities`, `availabilities-audit-log`, `page-size` / `current-page`). 3. `#pool-filter` = P-A and a shift type; compare. 4. "Download CSV" → save the file (`bookings.csv`). 5. API limit as PLANALL: `GET /api/private/internal-pool-metrics/assignments?from=<R−395>&to=<R>&page-size=10&current-page=0` and the same with `from=<R−365>`; the same pair for `availabilities-audit-log`. 6. UI: a 13-month range → error dialog.
   Expect: table rows = API rows of the page; paginator total = API total; CSV = header + one line per row of the unpaged answer (`…/csv`) incl. the F6 booking; 13 months → **416** `EXCEEDED_MONTH_TIMESPAN`, 12 months → 200. An empty IPO tab is not a FAIL (no IPOs on DM-Y).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
