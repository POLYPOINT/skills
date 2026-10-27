# Family A — Gates and entry rules (SWP-01, SWP-02, SWP-04, SWP-05) · team U on D1, reads of T1 / T10 / SP

|                           |                                                                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | SWP-01 (gate: the runner starts the other lanes only after it), SWP-02, SWP-04, SWP-05                                                                                                                                                  |
| Actors                    | reads: T1 `{{T1_LOGIN}}` ({{T1_ID}}), T10 `{{T10_LOGIN}}` ({{T10_ID}}), SP `{{SP_LOGIN}}`; writes: U1 `{{U1_LOGIN}}` ({{U1_ID}}), U2 `{{U2_LOGIN}}` ({{U2_ID}}), U3 `{{U3_LOGIN}}` ({{U3_ID}}); U4 `{{U4_LOGIN}}` ({{U4_ID}}) read-only |
| Days                      | U4: `{{PM1}}` (past), `{{TODAY}}`, `{{D1}}`, `{{D2}}`, `{{D3}}`, `{{D4}}` · U1, U2, U3: `{{D1}}` · T1: `{{D1}}` (read only)                                                                                                             |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/A` · `{{RUN_DIR}}/A/<id>/` · `created/A.jsonl`                                                                                                                                                     |
| Read first                | the group brief above; `{{GROUP_DIR}}/references/scenarios.md` sections SWP-01, 02, 04, 05; `{{RUN_DIR}}/swap-allocation.md`                                                                                                            |
| PEP                       | none (DB reads only)                                                                                                                                                                                                                    |
| Windows                   | none; pause per the group brief when W-X-TRADES-OFF or W-X-CATEGORIES-OFF is draining / active                                                                                                                                          |

## SWP-01 — Swap preconditions gate (API)

1. T1 (`--app mypp`, script `A-SWP-01-t1.mjs`): log in, open `/tabs/home`; from `api-index.jsonl` save the responses of `GET /api/capabilities/v1/capabilities` → `capabilities.json` and `config/features?appGroup=…` → `features.json`. Then `ps = await pickShift(api, '{{D1}}', {def: 111})`, `shiftDetail(api, ps)` → `planned-shift-detail.json`.
2. T10 (`A-SWP-01-t10.mjs`): log in, open `/tabs/home` and `/tabs/profile/main`; find the response that carries the permissions block (`grep -l submit_shift_trade {{RUN_DIR}}/A/SWP-01/t10/api/*.json`) → `permissions-hpx.json`. Do the same for T1 → `permissions-t1.json`.
3. SP (`--app poma`, `A-SWP-01-sp.mjs`): log in; record the landing URL; side menu "Diensttausch"; save `spList(api, {state: 'SUBMITTED'})` → `sp-past-and-current.json`.
4. DB: one query over every allocated cell of `swap-allocation.md`:
   `{{SKILL_DIR}}/scripts/sql.sh {{TENANT}} "SELECT MITARBEITER_ID||' '||TO_CHAR(DATUM,'YYYY-MM-DD')||' '||PA_CODE||' '||DIENSTPOSITION||' #'||PLANUNG_ID FROM ECBERN.PLANUNG WHERE MITARBEITER_ID IN (<all T and U ids>) AND DATUM IN (DATE '{{D1}}', DATE '{{D2}}', DATE '{{D3}}', DATE '{{D4}}', DATE '{{D5}}', DATE '{{W1}}', DATE '{{W2}}', DATE '{{HA}}', DATE '{{HB}}', DATE '{{HC}}', DATE '{{HD}}', DATE '{{TODAY}}') ORDER BY 1;"` → `oracle-planung.txt`; diff it against the allocation table → `oracle-diff.md`.

Expect: capabilities contain `GET_SHIFT_TRADE_CANDIDATES`, `GET_SHIFT_TRADE_CANDIDATES_EXTENDED_SEARCH`, `GET_SHIFT_TRADE_CANDIDATES_WITH_TARGET_EMPLOYMENT_IDS`; features `shiftTrades: true`, `shiftTradesWithCategories: true`; T1's D1 planning `available_for_shift_trade: true`, `shift_kind: PRESENCE`; T1 `shift_trade.submit_shift_trade: true`; T10 `submit_shift_trade: false` **present** (a missing block defaults to true in myPP = FAIL of the kit); SP lands on `/shift-planner/…` and the list call answers 200; every allocated cell as planned. Any miss → FAIL with the exact field, and tell the runner in `blockers` which lanes it blocks (missing capability / definition / right = all lanes; a wrong cell = the scenario that owns it).

## SWP-02 — Trade-button rules on the planned-shift detail (U4, read-only)

For each day of U4: `{{PM1}}`, `{{TODAY}}`, `{{D1}}`, `{{D2}}`, `{{D3}}`, `{{D4}}`: `/tabs/calendar` → the day → the planned-shift tile → detail; screenshot `NN-detail-<day>.png`; save `planned-shift-detail-<day>.json` (`shiftDetail(api, await pickShift(api, day))` if the UI capture is missing).
Expect: `{{PM1}}` no "Diensttausch" button; `{{TODAY}}` no button + info "Diensttausche sind nur am nächsten Tag möglich"; `{{D1}}` (111) button present; `{{D2}}` (on-call `{{PIKETT_DEF}}`) no button, `shift_kind: ON_CALL` — if `{{PIKETT_DEF}}` is `none` skip this check and name it in notes and `blockers` ("no on-call Dienst on DM-X"); `{{D3}}` (141) no button, `available_for_shift_trade: false`; `{{D4}}` (`{{ABS_DEF}}`) button present. Oracle = footer `#primaryButton` with text "Diensttausch" present/absent + the response fields of the same planning.

## SWP-04 — FAB entry and pre-page (U4, read-only, no swap created)

1. `/tabs/calendar` → month view → select `{{PM1}}` → FAB → `.shift-swap-button` "Diensttausch" → pre-page "Welchen Dienst möchten Sie tauschen?": record the selected day; past and today disabled. 2. Back; select `{{D1}}` → FAB → pre-page selected day = `{{D1}}`, the 111 card selectable. 3. In the pre-page select `{{D3}}` → the 141 card is disabled (PPCLOUD-13978). 4. Week view → FAB → pre-page selected day = tomorrow. 5. Select the `{{D1}}` card → "Weiter" → step "Wunsch" shows "Folgenden Dienst tauschen" with U4's 111; URL `/flows/shift-swap/<sp>/<rc>/request` with the ids of `pickShift(api,'{{D1}}')`; back out with `#backButton` (nothing created).
   Expect: as listed; the FAB entry is visible in every case (no date condition). Oracle: `aria-disabled` / disabled class of days and cards, selected day header, URL ids.

## SWP-05 — Day locks: owner blocked, locked candidate hidden (U1, U2, U3 on `{{D1}}`; U4 control)

1. U1: shortcut swap on `{{D1}}` (111) inviting U2 → `oppId` (`created/A.jsonl`). 2. U2: notification center → the invitation → detail-view → "Bestätigen" (or `answer(api, oppId, 'YES')`); `locks(api,'{{D1}}')` as U2 → true. 3. U1: detail of `{{D1}}` → "Diensttausch" → modal "Tausch blockiert" (screenshot); FAB pre-page → `{{D1}}` dot greyed + banner "Dieses Datum ist derzeit nicht verfügbar."; `locks(api,'{{D1}}')` → true → `locks-u1.json`. 4. U1: `candidates(api, ps)` for the D1 planning → error body name `USER_IS_LOCKED` → `candidates-u1-locked.json`. 5. U3: `candidates(api, <U3 D1 113>)` → U2 **not** in the list, U4 in the list → `candidates-u3-before.json` (UI: start the stepper to "Vorschläge" once, screenshot, back out). 6. U1: detail-manage → "Tausch löschen" (`#secondaryButton`) → `DELETE opportunities/{id}`; U3 repeats step 5 → U2 listed again → `candidates-u3-after.json`; U2 `locks` → false.
   Expect: as listed. (The compensation-day lock of a flexible swap is SWP-17.)

## Cleanup checklist

- No OPEN / SUBMITTED swap of U1..U4 left (`openTrades` as U1 and U3 empty for `{{D1}}`); every created opportunity id with its final state in `created/A.jsonl`.
- Nothing painted, no flag changed.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
