# Family PEPSET — PEP Dienst and global settings as seen in the cloud (PSP-20, PSP-21) · SPA, HP8, HP9

|                           |                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | PSP-20, PSP-21 (last, in its window)                                                                                                                                             |
| Actors                    | SPA `{{SPA_LOGIN}}` (`--app poma`); HP8 `{{HP8_LOGIN}}` ({{HP8_ID}}), HP9 `{{HP9_LOGIN}}` ({{HP9_ID}}) (`--app mypp`)                                                            |
| Days                      | `{{D1}}` (PSP-20 reads) · `{{M1A}}`, `{{M1B}}` in month `{{M1}}` (PSP-21 paints of HP8 / HP9)                                                                                    |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/PEPSET` · `{{RUN_DIR}}/PEPSET/<id>/` · `created/PEPSET.jsonl`                                                                               |
| Read first                | the group brief; scenarios.md PSP-20, PSP-21; `known-deviations.md` (main-26 note)                                                                                               |
| PEP                       | PSP-21 throughout (one lock hold per PEP action, `{{PEP_LOCK_DOC}}`; the option switch and the Sollplan save are exploratory pep-verify steps: no pep-driver flow exists, OQ-20) |
| Windows                   | PSP-21 only inside **W-Y-SOLLPLAN** (granted after utr has finished on this env); read `windows/{{ENV}}~W-Y-SOLLPLAN` before step 2 and before step 6                            |

## PSP-20 — "Available for internal pool" filters the internal-pool shift picker (PPCLOUD-13957)

Pre: gate PSP-GD PASS (own Dienste loaded by api-pp).

1. SPA: `GET /api/private/shift-definition/roster?group-node-id={{GA_NODE}}&from={{D1}}&to={{D1}}&include-icons=true&include-presences=true&include-absences=true&shift-type-filter=USE_IN_PLANNING&available-for-internal-pool=true` → `roster-defs-ip.json`. 2. Same without `available-for-internal-pool` → `roster-defs-all.json`. 3. DB: `planner-checks.sql` C2a (C2b on main-26) → `oracle-dienst.txt`. 4. UI: `POST /api/v2/internal-pool-opportunity` `{"date": "{{D1}}", "roster_id": "{{GA_NODE}}"}` (writeShiftsOnPrem is ON in the DM-Y baseline) → open the returned pending URL → open `#shift-definition-type-field` (screenshot). 5. Cleanup: `DELETE /api/private/opportunities/{id}`.
   Expect (`{{BUNDLE_LINE}}` = master): step 1 lists `{{DEF_IP_JA}}` and not `{{DEF_IP_NEIN}}`; step 2 both; picker offers `PSP-IP-JA` only. main-26: the RR flag decides → step 1 lists `PSP-IP-NEIN`, not `PSP-IP-JA` (expected on that line, not a FAIL).

## PSP-21 — Sollplan gate, "immer sichtbar" and "alle Monate sichtbar" in myPOLYPOINT (W-Y-SOLLPLAN)

Pre: R5 done (HP9 has the "alle Monate sichtbar" role); note the current option value (PEP Grundeinstellungen → Planung / Stempel → "Es muss ein Sollplan gesichert sein") and whether `{{M1}}` has a saved Sollplan for G-A → `oracle-option.txt` (screenshot; DB row if found, guess `GLOBALEINSTELLUNGEN`).

1. Paint for HP8 and HP9: `{{M1A}}` = a normal seed day Dienst, `{{M1B}}` = `{{DEF_IMMER}}` (`pp-plan.sh`). 2. Window active → PEP lock → switch the option **on** (pep-verify `menupath` / `clickin`; screenshots) → release; wait ≤ 5 min. 3. HP8 and HP9: `GET /api/mobile/health-professional/v1/calendar/roster?from=<first of {{M1}}>&to=<last of {{M1}}>` (or `month-view`) → `roster-hp8-on.json`, `roster-hp9-on.json`. 4. PEP lock → "Bearbeiten → Sollplan sichern [{{M1}}]" → release; repeat 3 (`…-saved.json`). 5. PEP lock → "Bearbeiten → Sollplan überschreiben [{{M1}}]" → release; repeat 3 (`…-overwritten.json`). 6. **Restore (always):** PEP lock → option back to the recorded value; the `{{M1}}` Sollplan state back as recorded (if possible; else log what stays); remove the two paints of each HP. 7. Restore proof: one roster read of HP8 shows both days again → `restore-proof.json`.
   Expect: option on + `{{M1}}` unsaved: HP8 sees `{{M1B}}` only, HP9 sees both; after saving HP8 sees both; after overwrite as in step 3 (guess: verify the undo semantics); option off: everybody sees everything. No PEP path for a step → BLOCKED "needs a pep-driver flow (OQ-20)" for PSP-21, restore what you changed.

## Cleanup checklist

- Option and Sollplan state restored (`restore-proof.json`); paints removed; IPO of PSP-20 cancelled; PEP lock released.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
