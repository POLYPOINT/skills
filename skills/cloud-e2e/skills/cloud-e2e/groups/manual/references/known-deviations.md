# Group manual — known deviations (KNOWN-FAIL signatures for the human sessions)

A tester's observation that matches a signature below is recorded by the runner as KNOWN-FAIL: verdict `FAIL`, `notes` starting with `KNOWN-FAIL <id>`. A different problem is new (`N-MANUAL-<n>`). Ids keep the owning group's prefix so the consolidation can merge them with the automated evidence; SD-nn = `synthesis/suspected-defects.md` (report only).

| Id                     | Deviation                                                                                  | Signature (what the tester sees)                                                                                                                              | Scenario         | Automated twin             | SD    |
| ---------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------- | ----- |
| SW-K5                  | MS Teams cards of the swap lifecycle open the legacy trade pages                           | the invitation / response card opens `/flows/calendar/opportunity-shift-trade-details/<id>` or `/flows/shift-marketplace/trade/<id>` (legacy page, or broken) | SWP-32           | swap SWP-33 (route check)  | SD-22 |
| N-11 / N-12 Teams      | Teams targets differ from push targets for booking / RR events                             | selection card opens WEEK_VIEW, rejection card opens OPPORTUNITY_DETAIL                                                                                       | BKG-29           | booking BKG-28 (NC routes) | SD-22 |
| SD-39                  | The native `login-callback` deep link targets `/polyid/login-callback`, which has no route | after a native login callback the app lands on a blank / home page                                                                                            | HPN-27 (if seen) | —                          | SD-39 |
| PPCLOUD-14322 (part 2) | Logout inside Teams fails                                                                  | the Ory page "Logout failed because query parameter state is set but id_token_hint is missing"                                                                | AUT-15           | auth AUT-14 (browser)      | —     |

## Observations (record, never a verdict)

| Topic                                                                | What to record                                              | Scenario |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | -------- |
| Teams first-login bug PPCLOUD-12262 (04/2025)                        | whether "allow myPOLYPOINT outside Teams" appears and works | HPN-25   |
| Push language after an app-language change                           | language of the next push                                   | HPN-27   |
| `schedulingRequestV2` value on preview-smartpep                      | the value                                                   | PSP-23   |
| Which green-day / BADI behaviour PEP shows for a read-only Planblatt | the behaviour                                               | BKG-32   |
