# Family B — Direct swap lifecycle, core regression (SWP-06, 08, 11, 09, 10, 12, 13, 15, 16) · writes on T1..T9, U1..U4 on D1..D5

|                           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | SWP-06, SWP-08, SWP-11, SWP-09, SWP-10, SWP-12, SWP-13, SWP-15, SWP-16                                                                                                                                                                                                                                                                                                                                                                                                            |
| Actors                    | T1 `{{T1_LOGIN}}` ({{T1_ID}}), T2 `{{T2_LOGIN}}` ({{T2_ID}}), T3 `{{T3_LOGIN}}` ({{T3_ID}}), T4 `{{T4_LOGIN}}` ({{T4_ID}}), T5 `{{T5_LOGIN}}` ({{T5_ID}}), T6 `{{T6_LOGIN}}` ({{T6_ID}}), T7 `{{T7_LOGIN}}` ({{T7_ID}}), T8 `{{T8_LOGIN}}` ({{T8_ID}}), T9 `{{T9_LOGIN}}` ({{T9_ID}}), T10 `{{T10_LOGIN}}` (read: must not appear), U1 `{{U1_LOGIN}}` ({{U1_ID}}), U2 `{{U2_LOGIN}}` ({{U2_ID}}), U3 `{{U3_LOGIN}}` ({{U3_ID}}), U4 `{{U4_LOGIN}}` ({{U4_ID}}), SP `{{SP_LOGIN}}` |
| Days                      | `{{D1}}` (SWP-06), `{{D2}}` (08/11, 09, 10), `{{D3}}` (12, 13), `{{D4}}` (16), `{{D5}}` (15) — only the cells of `data-plan.md` §2.3 for these scenarios                                                                                                                                                                                                                                                                                                                          |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/B` · `{{RUN_DIR}}/B/<id>/` · `created/B.jsonl`                                                                                                                                                                                                                                                                                                                                                                                               |
| Read first                | the group brief; scenarios.md sections SWP-06, 08–13, 15, 16; `{{RUN_DIR}}/swap-allocation.md`                                                                                                                                                                                                                                                                                                                                                                                    |
| PEP                       | SWP-13 only: the conflict planning (`{{CONFLICT_RECIPE}}`) via `pp-plan.sh`, PEP UI only as fallback under `{{PEP_LOCK_DOC}}`                                                                                                                                                                                                                                                                                                                                                     |
| Windows                   | none of its own; paused by W-X-TRADES-OFF, W-X-CATEGORIES-OFF and W-X-WRITE-OFF (finish the running scenario, report the rest BLOCKED "paused by window <id>")                                                                                                                                                                                                                                                                                                                    |

Write mode: `writeShiftsOnPrem` is ON (baseline), so an SP approval writes PEP at once. Before every SP approval save `oracle-<who>-<day>-before.txt` (`plan-day.sh`) for both employees.

## SWP-06 — Direct swap creation from the shift detail (UI)

Cells `{{D1}}`: T1 111 (owner), T2 112, T3 113, T4 112 (+ conflict), T9 112 (other category), T10 112 (must not appear).

1. T1, **fresh profile** (or `localStorage.clear()` first): dashboard or calendar → `{{D1}}` → tile → detail → "Diensttausch" → step "Wunsch"; save `shift-definition-roster.json` (`shift-definition/roster`). 2. Nothing selected, `#primaryButton` disabled. 3. Open the selector: list = roster definitions with `available_for_shift_trade` (presences and absences) without 111; pick 112 → "Weiter" enabled; stepper shows 3 steps. 4. "Weiter" → "Vorschläge": `#primaryButton` disabled; save `candidates.json` (`calendar/shift-trade-candidates`). 5. Listed: T2 (T3 only if 113 had been chosen); T10 **not** listed; T4 (conflict) hidden. 6. "Alle Filter" → toggle "Mitarbeitende mit Konflikten anzeigen" on → T4 shown; off → hidden; on again; note `localStorage` key ending in `show_shift_swap_candidates_conflicts`. 7. "Personalkategorie" filter: add T9's category → T9 listed (save the categories request). 8. Select T2 (checkbox aria-label "<Name> am <Datum> auswählen") → "Weiter" → "Übersicht" ("Ich möchte am …", "Tausch") → "Bestätigen"; capture `POST shift-trades` with `act()` → `create-request.json` / `create-response.json` → page "Tauschanfrage gesendet"; oppId from `openTrades(api)`. 9. `/tabs/shiftmarketplace?tab=shift-trade` → "Meine Tauschanfragen" contains it. 10. New harness call for T1 (same profile) → start another swap to "Vorschläge" → the toggle is still on (persisted); back out. 11. T2: notification center → the invitation (`swapNotifications`) → tap → `/flows/shift-swap/detail-view/{id}` "Offene Tauschanfrage". 12. T1 `locks(api,'{{D1}}')` → true.
   Expect: as listed; create 200; owner list state OPEN. No conflict candidate could be built (S7 recipe `none`) → step 6 not run: name it in notes and `blockers`, judge the rest.
   Cleanup: T1 "Tausch löschen" at the end of SWP-06 (D1 is not reused by B).

## SWP-08 — Candidates answer, owner selects and submits (`{{D2}}`: T1 111, T2 112, T3 112)

1. T1: shortcut swap on `{{D2}}` inviting **T2 and T3** → oppId. 2. T1: marketplace → "Meine Tauschanfragen" → detail-manage: T2 and T3 cards with chip "Ausstehend", checkboxes disabled, "Bestätigen" disabled (screenshot). 3. T2: notification center → tap → detail-view (events calendar, "Bestätigen", "Ablehnen") → "Bestätigen" → "Zusage gesendet"; capture `POST opportunities/{id}/application` `{response: YES}`. 4. T3: same → YES. 5. T1: two response notifications; detail-manage: chips "Zugesagt", checkboxes enabled, "Bestätigen" still disabled; tick T2 → enabled → "Bestätigen"; capture `submission`. 6. T1 marketplace: the swap under "Auf Annahme wartend". 7. T3: non-selection notification (`SHIFT_TRADE_NONSELECTION`); `locks` T3 `{{D2}}` false, T2 true. 8. SP: "Diensttausch" (landing "Offene Anfragen") → the row T1 ↔ T2 `{{D2}}` present; `spRow(api, oppId, {state:'SUBMITTED'})`.
   Expect: owner state SUBMITTED, T2 request SUBMITTED. **Leave this swap SUBMITTED for SWP-11.**

## SWP-11 — SP approves a direct swap, PEP written (core)

Data: the SUBMITTED swap of SWP-08. Before: T1 `{{D2}}` = 111, T2 = 112 (`plan-day.sh`).

1. SP: "Diensttausch" → the row → "Detailansicht" (description "Folgende Mitarbeitende möchten neu …"), no conflict banner → `#shift-swap-request-accept-button` "Bestätigen"; capture `PUT …/check-conflicts-and-write` → `state: SUCCESS`. 2. SP list filter "Zugesagt" → present. 3. After: T1 `{{D2}}` = 112, T2 = 111, same `DIENSTPOSITION`, no extra planning. 4. T1 + T2: approval notification (`SHIFT_TRADE_APPROVAL`); T1 calendar `{{D2}}` tile shows 112; detail text "Der Tausch wurde genehmigt." 5. `locks` T1 / T2 `{{D2}}` false.
   Expect: as listed. A CONFLICT answer here = FAIL (no conflict was planned) with the dialog screenshot.

## SWP-09 — Single candidate declines → swap cancelled (`{{D2}}`: T5 111 → T6 112)

1. T5: shortcut swap inviting T6 only. 2. T6: notification → detail-view → "Ablehnen" (main click) → "Angebot abgelehnt"; capture `application` `{response: NO}`. 3. T5: rejection notification; marketplace "Abgesagt"; detail "Der Tausch wurde abgesagt."; `cancelledTrades` contains the id. 4. `locks` T5 / T6 false. 5. T5 starts a new swap on `{{D2}}`: step "Wunsch" opens; back out.
   Expect: swap CANCELLED at once, requests DENIED.

## SWP-10 — Decline with comment while another candidate is pending (`{{D2}}`: T7 111 → T8 112, T4 112)

1. T7: shortcut swap inviting T8 and T4. 2. T8: detail-view → open the "Ablehnen" menu → "Ablehnen mit Kommentar" → dialog → "SWP-10 Kommentar" → send; capture `application` `{response: NO, message}`. 3. T7 detail-manage: T8 card "Abgelehnt" with the comment, T4 "Ausstehend"; swap still under "Meine Tauschanfragen"; `openTrade` state OPEN. 4. T4 does nothing. 5. Cleanup: T7 "Tausch löschen".
   Expect: swap stays OPEN until the cleanup; comment visible to T7; T7 has a response notification.

## SWP-12 — SP declines without and with comment (`{{D3}}`: S-A U1 111 → U2 112, S-B T1 111 → T3 112)

1. Prepare both by shortcut: create → candidate YES → owner `submit` (request id via `openTrade` + `requestIdOf`). 2. SP: S-A → "Detailansicht" → "Ablehnen" with empty comment; capture `{operation: REJECT, status_message: null}`. 3. SP: S-B → type "SWP-12 Ablehnungsgrund" into "Kommentar (optional)" → `#shift-swap-request-accept-button` disabled (screenshot) → "Ablehnen"; capture `status_message`. 4. SP list "Abgelehnt": S-A "Abgelehnt", S-B "Abgelehnt mit Kommentar"; open S-B → comment read-only. 5. T1: rejection notification; marketplace "Abgesagt"; detail-manage "Kommentar Dienstplaner: SWP-12 Ablehnungsgrund"; T3 notified too. 6. `plan-day.sh` of U1, U2, T1, T3 on `{{D3}}` unchanged; locks released.
   Expect: as listed.

## SWP-13 — SP approval with new conflicts: dialog accept / dialog cancel (`{{D3}}`: S-C T5 111 → T6 112, S-D T7 111 → T8 112)

1. Prepare S-C and S-D to SUBMITTED (shortcut + YES + submit). 2. **After** submission add the conflict for T6 and T8 on `{{D3}}` with `{{CONFLICT_RECIPE}}` (`pp-plan.sh`; PEP fallback under the db lock); `plan-day.sh` before/after. Recipe `none` or no conflict reported → BLOCKED-data, release everything (SP rejects both) and continue. 3. SP: S-C → "Bestätigen" → `check-conflicts-and-write` answers `state: CONFLICT` → dialog lists the conflicts with names (screenshot) → accept → `apply-and-write` 200; T5/T6 swapped (`plan-day.sh`). 4. SP: S-D → "Bestätigen" → dialog → cancel → the UI sends REJECT (capture). 5. T7/T8 `{{D3}}`: the same `PLANUNG_ID`s and count as before (no created-but-unapplied planning). 6. T7: S-D under "Abgesagt"; T5: approval notification. 7. Remove the conflict plannings you added (`pp-plan.sh … DELETE`) and log them.
   Expect: CONFLICT → SUCCESS for S-C; S-D rejected without leftovers.

## SWP-15 — SP marketplace list, filters, read-only modal (absorbs PSP-14) (`{{D5}}`: S-F U3 111 → U4 112)

1. Prepare S-F to SUBMITTED (shortcut + YES + submit). 2. SP opens "Diensttausch": landing "Offene Anfragen" (`#shift-marketplace-status-filter`); capture `past-and-current?opportunity-state=SUBMITTED` and `…/participants`; S-F listed. 3. Status "Alle" → rows of all states incl. the SWP-11 and SWP-12 ids; "Zugesagt", "Abgelehnt", "Abgelaufen" each filter correctly (save one JSON per state). 4. "Mitarbeitende" (`#shift-marketplace-hp-filter`) = U3 → only U3's swaps (`hp-id`); = U1 → S-F absent. 5. "Filter zurücksetzen" (`#shift-marketplace-clear-filters`) → status "Alle", request without `opportunity-state`. 6. Paging if > 10 rows. 7. Modal: open S-F → "Detailansicht" with both HPs and shifts; "Ablehnen" and "Bestätigen" enabled; type a comment → "Bestätigen" disabled; clear; close (`#shift-swap-request-close-button` or Escape) → no `check-conflicts-and-write` in `api-index.jsonl`; `spRow` still SUBMITTED. 8. Cleanup: SP rejects S-F.
   Expect: as listed; record the list order key (newest first expected, PPCLOUD-14282).

## SWP-16 — Owner cancels an open swap (`{{D4}}`: T7 111 → T8 112, T4 112)

1. T7: shortcut swap inviting T8 and T4. 2. T8 YES (detail-view "Bestätigen"); T4 no answer. 3. T7: detail-manage → `#secondaryButton` "Tausch löschen"; capture `DELETE opportunities/{id}`. 4. T8: cancellation notification; detail "Der Tausch wurde abgesagt." 5. T4: **no** cancellation notification. 6. T7: no notification (own action). 7. `locks` T7 / T8 false; T7 "Abgesagt" contains it (last 10).
   Expect: as listed.

## Cleanup checklist

- No OPEN / SUBMITTED swap of your actors (`openTrades` as T1, T5, T7, U1, U3 and SP `spList({state:'SUBMITTED'})` filtered by your ids).
- Approved swaps (SWP-11 on `{{D2}}`, SWP-13 S-C on `{{D3}}`) changed the roster: list them in `created_data` (the runner restores only if the env is reused). Conflict plannings of SWP-13 deleted.
- Every opportunity id with its final state in `created/B.jsonl`.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
