# Family PV — Privacy: masking audit (HPN-21) · N5, read-only

|                           |                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Scenarios (in this order) | HPN-21                                                                              |
| Actors                    | N5 `{{N5_LOGIN}}` ({{N5_ID}}) — owner of the group's own swap with N5C as candidate |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/PV` · `{{RUN_DIR}}/PV/HPN-21/`                 |
| Read first                | the group brief; scenarios.md HPN-21; `known-deviations.md` HPN-K2, HPN-K3          |
| Start                     | after family HP reported (HPN-05 uses N5 too)                                       |
| Windows                   | paused by W-X-SYSMSG (layout) — the masking screenshots must not show the banner    |

Flags `poma.webApp.mouseflow` / `development` stay **OFF** (never switch them on: real sessions would go to MouseFlow). The audit works on the static classes.

## HPN-21 — MouseFlow / LogRocket masking audit

1. As N5 open: Home, week view, month roster incl. "Mehr" (employment chips), day view, shift view + "Mein Team", Teamplan, swap detail-manage of the own swap, the creation steps of a new swap up to "Vorschläge" (cancel before submit), the NC with an expanded thread (if any), Zeitkonten. Pages that need a pool or an opportunity (heat map, opportunity / booking detail, invitation page) → skip with "not covered: N5 has none".
2. Build the sensitive-string set S from the captured API JSON of these pages: colleague / candidate / team-member names (`first_name`, `last_name`, `display_name`), employment display names, pool names, comments, notification contents — in memory only.
3. Per page `maskAudit(page, S)` → list of unmasked occurrences `{hash, first, path, cls, dataPrivate}`.
4. Inject `.mouseflow-hidden{background:red!important}` (`page.addStyleTag`) and screenshot each page (the Confluence method).
   Expect: no unmasked occurrence; the month-roster employment chips → **KNOWN-FAIL HPN-K2** (signature in known-deviations); HPN-K3 only if an invitation page was opened. Evidence `masking.json` (per page the occurrences — hashes, never clear-text names), red-highlight screenshots.

## Cleanup checklist

- The own swap N5 → N5C is cancelled after this scenario (N5 "Tausch löschen" or `DELETE /api/mobile/health-professional/v1/opportunities/<id>`); the swap started in step 1 was never submitted.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
