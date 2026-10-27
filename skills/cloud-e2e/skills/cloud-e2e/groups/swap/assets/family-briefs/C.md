# Family C — Flexible swap with compensation (SWP-17, SWP-18, SWP-19) · writes on T1, T2, T3, T5, T6 on D4 / D5

|                           |                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | SWP-17, SWP-18, SWP-19                                                                                                                                                       |
| Actors                    | T1 `{{T1_LOGIN}}` ({{T1_ID}}), T2 `{{T2_LOGIN}}` ({{T2_ID}}), T3 `{{T3_LOGIN}}` ({{T3_ID}}), T5 `{{T5_LOGIN}}` ({{T5_ID}}), T6 `{{T6_LOGIN}}` ({{T6_ID}}), SP `{{SP_LOGIN}}` |
| Days                      | main `{{D4}}`, compensation `{{D5}}`                                                                                                                                         |
| Cells                     | SWP-17/18: `{{D4}}` T1 111, T2 `{{ABS_DEF}}`, T3 `{{ABS_DEF}}`; `{{D5}}` T1 —, T2 112, T3 — · SWP-19: `{{D4}}` T5 `{{ABS_DEF}}`, T6 112; `{{D5}}` T5 111, T6 —               |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/C` · `{{RUN_DIR}}/C/<id>/` · `created/C.jsonl`                                                                                          |
| Read first                | the group brief; scenarios.md sections SWP-17, 18, 19; `swap-allocation.md`                                                                                                  |
| PEP                       | none                                                                                                                                                                         |
| Windows                   | none of its own; paused by W-X-TRADES-OFF, W-X-CATEGORIES-OFF, W-X-WRITE-OFF                                                                                                 |

Check first: `plan-day.sh` of the cells above. A cell that differs (e.g. no absence painted) → BLOCKED-data for the scenario that needs it ("S5 cell missing: <who> <day>"), the runner repaints and relaunches.

## SWP-17 — Flexible creation with compensation (UI, T1 owner)

0. Lock day for the greyed-date check: as T1 `locks(api, '{{D1}}', '{{W2}}')`; pick a day where T1 is locked (another family's open swap). None locked → skip the greyed-date part of step 3, note "no lock day available" (not a FAIL).
1. T1: `{{D4}}` detail → "Diensttausch" → "Wunsch": pick the absence `{{ABS_DEF}}` → stepper shows 5 steps. 2. "Vorschläge": select T2 and T3 → "Weiter". 3. "Angebot": calendar; the lock day (step 0) greyed + banner "Dieses Datum ist derzeit nicht verfügbar."; select `{{D5}}` → banner "Einige passende Personen" (a preliminary "Vermutlich …" may show first); capture `tradable-shifts-for-compensation-from-conflict-checker` and `tradable-shifts-for-compensation`. 4. "Auswahl": only T2 offerable for `{{D5}}` ("Sie übernehmen dafür den Dienst"); select T2. 5. "Übersicht": rows "Tausch" (`{{D4}}`) and "Angebot" (`{{D5}}`) → "Bestätigen"; capture `POST shift-trades` (`compensation_shift` present; main candidates reduced to T2) → oppId. 6. T1 marketplace: the swap with a compensation row. 7. `locks` T1 on `{{D4}}` and `{{D5}}` → both true. 8. T2 notified; T3 **not** invited (intersection rule): no invitation row for T3.
   Expect: as listed. **Leave the swap OPEN for SWP-18.**

## SWP-18 — Flexible swap approved: main and compensation written

Before: `plan-day.sh` T1 / T2 on `{{D4}}` and `{{D5}}`.

1. T2: detail-view shows "Tausch" ("Sie übernehmen den Einsatz") and "Angebot" ("Sie erhalten den folgenden Einsatz von …") → "Bestätigen". 2. T1: detail-manage → tick T2 → "Bestätigen" (submission). 3. SP: "Diensttausch" → the row → "Bestätigen" (write mode); there is no "In PEP ansehen" button outside PEP (expected). Capture `check-conflicts-and-write`. 4. After: `{{D4}}` T1 = `{{ABS_DEF}}`, T2 = 111; `{{D5}}` T1 = 112, T2 = — (T1's former `{{D5}}` entry). 5. Approval notifications T1 / T2.
   Expect: both swaps applied. A compensation write failure answers `SHIFT_TRADE_COMPENSATION_TO_PEP_FAILED`: FAIL with the partial state (`plan-day.sh` of all four cells).

## SWP-19 — Planned absence → presence (flexible from the absence side, T5 owner)

1. T5: `{{D4}}` absence detail → "Diensttausch" → "Wunsch" lists **only presences** (no absence definitions; save `shift-definition-roster.json`). 2. Pick 112 → 5 steps; candidates: T6; "Angebot" `{{D5}}` (T5's 111 is offered to T6); "Bestätigen"; capture create → oppId. 3. Cleanup: "Tausch löschen".
   Expect: definition list all `shift_kind: PRESENCE`; 5 steps; create 200.

## Cleanup checklist

- No OPEN / SUBMITTED swap of T1, T5 (`openTrades`).
- SWP-18 changed four cells: list them in `created_data`.
- Every opportunity id with its final state in `created/C.jsonl`.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
