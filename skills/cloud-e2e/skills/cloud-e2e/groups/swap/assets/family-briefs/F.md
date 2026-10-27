# Family F — Channels, mobile path, legacy routes, expiry (SWP-33, 35, 36, 30, 31) · after families B, D

|                           |                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | SWP-33, SWP-35, SWP-36, SWP-30, SWP-31                                                                                                                                                                                                                                                                                                   |
| Actors                    | T1 `{{T1_LOGIN}}`, T2 `{{T2_LOGIN}}`, T3 `{{T3_LOGIN}}` ({{T3_ID}}), T4 `{{T4_LOGIN}}` ({{T4_ID}}), T5 `{{T5_LOGIN}}` ({{T5_ID}}), T7 `{{T7_LOGIN}}` ({{T7_ID}}), T8 `{{T8_LOGIN}}` ({{T8_ID}}), U2 `{{U2_LOGIN}}` ({{U2_ID}}), U3 `{{U3_LOGIN}}` ({{U3_ID}}), SP `{{SP_LOGIN}}`; portal ops = the runner's profile `{{PORTAL_PROFILE}}` |
| Days / cells              | `{{W2}}`: T3 111, T4 112, T5 112 (33); T8 111, T7 112 (35) · `{{TODAY}}`: U2 112, U3 112 (36)                                                                                                                                                                                                                                            |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/F` · `{{RUN_DIR}}/F/<id>/` · `created/F.jsonl`                                                                                                                                                                                                                                                      |
| Read first                | the group brief; scenarios.md sections SWP-30, 31, 33, 35, 36; `created/B.jsonl` (opportunity ids of SWP-06..16)                                                                                                                                                                                                                         |
| PEP                       | none                                                                                                                                                                                                                                                                                                                                     |
| Run partner               | `{{PARTNER_NAME}}` (id `{{PARTNER_ID}}`): **read only** — never save, edit or toggle it (a save switches logging off and deletes every logged event)                                                                                                                                                                                     |
| Windows                   | none of its own; paused by W-X-TRADES-OFF, W-X-CATEGORIES-OFF                                                                                                                                                                                                                                                                            |

Start only after families B and D are reported (SWP-30/31 read their notifications and partner events).

## SWP-33 — Legacy trade pages reachable from MS Teams links (`{{W2}}`)

1. T3: shortcut swap on `{{W2}}` inviting T4 and T5; T5 answers YES (T4 silent). 2. T4: `api.goto('/flows/calendar/opportunity-shift-trade-details/<oppId>')`; screenshot; save the page's API responses. 3. T3: `api.goto('/flows/shift-marketplace/trade/<oppId>')`; screenshot. 4. Do not press the pages' primary actions (the swap is not throw-away). 5. Cleanup: T3 "Tausch löschen".
   Expect: both pages render the swap (or redirect to the new routes) with no error dialog and no 4xx/5xx; record the behaviour (input for SW-K5). A broken page (error, blank, 404) → **KNOWN-FAIL SW-K5** with an `issueShot`.

## SWP-35 — Mobile in-app path incl. capabilities on login (PPCLOUD-14262) (`{{W2}}`: T8 → T7)

1. `mypp-inapp.mjs {{TENANT}} {{T8_LOGIN}} <script> <outdir>` with a **fresh** in-app profile (`MYPP_PROFILES={{RUN_DIR}}/.profiles/F-inapp`): on-board e-mail form, login, consent, tutorial. 2. Save the capabilities request issued after the login transition (timestamp after the token response) → `capabilities.json`. 3. Calendar → `{{W2}}` → "Diensttausch" (real pointer clicks) → step "Wunsch" leaves the loading state, roster definitions listed (`shift-definition/roster` called). 4. Choose `{{ABS_DEF}}` → 5 steps (flexible available); back. 5. Choose 112 → candidates → T7 → "Bestätigen" → create 200. 6. Cleanup: "Tausch löschen".
   Expect: capabilities loaded once after login; step 1 not stuck; flows as on web.

## SWP-36 — Expiry of an unanswered swap (optional, long-running) (`{{TODAY}}`: U2 → U3)

Check first: `plan-day.sh` U2 / U3 `{{TODAY}}` = 112 and the shift starts ≥ 2 h after now and before the next job tick (00:20, 06:20, 12:20, 18:20 server time); otherwise BLOCKED-data "no suitable TODAY shift" and skip.

1. U2: shortcut swap by API (the UI hides today; the API accepts a future start) inviting U3; leave it unanswered. 2. After the shift start **and** the next tick: U2 `openTrade` / `cancelledTrades`, SP `spRow(api, oppId, {state: 'EXPIRED'})` (filter "Abgelaufen"), U3's detail-view.
   Expect: state EXPIRED, SP list "Abgelaufen", candidate detail "Abgelaufene Tauschanfrage"; a partner `OpportunityExpired` event appears in SWP-31's log (record). If the worker would have to wait more than 4 h, report SWP-36 `BLOCKED` "expiry tick outside the run window" with the oppId; the runner re-checks later.

## SWP-30 — Notification center records and tap navigation (reads)

Recipients and expected rows from `created/B.jsonl` (SWP-06, 08, 09, 11, 12, 16): T1 (responses, approval, rejection), T2 (invitation, approval), T3 (invitation, non-selection, rejection), T6 / T8 (invitation, cancellation). For T1, T2, T3: bell → notification center; filter type "Diensttausch"; for each row of those opportunities record type, text, timestamp, read state → `nc-<who>.json`; tap one invitation (T2) → `/flows/shift-swap/detail-view/{id}`; tap one response (T1) → `/flows/shift-swap/detail-manage/{id}`; tap an approval → week view; "Alle gelesen" → unread counter 0.
Expect: one record per lifecycle event to the recipients listed above; navigation targets as listed.

## SWP-31 — Partner events of the swap lifecycle (PolyPortal, run partner read only)

1. `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "partner logs {{PARTNER_ID}}" {{RUN_DIR}}/F/SWP-31` (usage line: `references/harness.md`) → all pages → `partner-log.json`; one screenshot of the Debug tab. 2. Match by opportunity id and subclass against the opportunities of `created/B.jsonl` → `partner-match.json` (expected vs found).
   Expect: one event per lifecycle notification (invitation, response, submission, approval, rejection, cancellation; `ShiftTradeCancellation` on decline-cancel). `v1/ShiftTradeNonselection` is never logged (SD-30): record its absence, not a FAIL. Partner logging off or the partner missing → BLOCKED "run partner not ready" (tell the runner; never switch logging on yourself).

## Cleanup checklist

- No OPEN swap of T3, T8, U2 (SWP-36 may stay until it expires: note it).
- Nothing changed on the run partner (no write call to `/admin/integration-partners` in your logs).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
