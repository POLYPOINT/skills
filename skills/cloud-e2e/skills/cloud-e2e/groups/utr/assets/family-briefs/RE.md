# Family RE — re-check after an environment fix (template)

Use when verdicts of earlier families were caused by an environment problem that has since been fixed (typical: gate G4b — api-pp had not loaded a definition created in PEP; a PolyID lock; a stopped P4 service). The orchestrator fills the table from the earlier reports; the worker repeats exactly those steps, on `{{TENANT}}` only, and reports the new verdicts.

|                    |                                                                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fix                | `{{FIX}}` — what was fixed, when (UTC), how it was verified (e.g. "`IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION','150',…)` + palette event at 07:40Z; days-check.mjs EXPECT_DEF=150 ok") |
| Scenarios          | the rows of the table below, in order                                                                                                                                                                 |
| Employees / days   | exactly those of the original scenarios (column "Employee / day"); nobody else                                                                                                                        |
| Profiles / results | `MYPP_PROFILES={{RUN_DIR}}/.profiles/RE` · `{{RUN_DIR}}/RE/<scenario>/` · `created/RE.jsonl`                                                                                                          |
| Read first         | the common part; `{{RUN_DIR}}/new-findings.md` (the findings named in the table); the original family briefs' steps for these ids; their reports/summaries                                            |

| Scenario | Employee / day     | Repeat (same steps and bodies as the original family brief) | Previous result | Expected if the environment was the only cause |
| -------- | ------------------ | ----------------------------------------------------------- | --------------- | ---------------------------------------------- |
| `{{ID}}` | `{{En}}` `{{DAY}}` | `{{STEPS}}`                                                 | `{{PREVIOUS}}`  | `{{EXPECTED}}`                                 |

First run (example, 2026-10-15, after the G4b cache refresh for definition 150; candidate bundle only):

| Scenario                    | Employee / day    | Repeat                                                                                | Previous                                             | Expected                                                                                             |
| --------------------------- | ----------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| W-02 block CRUD             | E3 WD1            | POST /shifts 17:00–18:00, PUT 18:30, DELETE (W brief)                                 | 500 `LEGACY_TIME_RECORDING_OPERATION_FAILED` (N-W-1) | 200/200/200; credited 8:00 → 9:00; check F1 (extra GLAZ credit)                                      |
| W-03 break edit/delete      | E3 WD2            | base block 07:00–16:00, break POST 12:00–12:30, PUT 12:45, DELETE break, DELETE block | untestable                                           | all 200                                                                                              |
| W-07 validations            | E3 WD2            | overlap, 17:00–17:00, beyond day+2, reversed                                          | 500 generic                                          | the four specific 400 codes                                                                          |
| W-09 absence block          | E3 WD1            | POST /shifts with definition 25 and 57                                                | 500 (definition lookup)                              | rejected, nothing created (500 `OPERATION_FAILED` generic is the documented status; W-11 records it) |
| L-02 legacy round trip      | E3 P3             | legacy POST/PUT/DELETE /blocks (L brief)                                              | 409 (definition lookup)                              | 200/200/200, N-L-3 noted                                                                             |
| MO-01 picker                | E5 TODAY (in-app) | GET scheduling-requests/shift-definitions?day=TODAY                                   | 404 "definition 150" (N-MO-1)                        | 200                                                                                                  |
| MO-05 in-app add-block      | ES WD1            | add block 17:00–18:00, verify, delete (MO brief)                                      | 500 (N-MO-2)                                         | 200, credited 9:00                                                                                   |
| available-shift-definitions | E3 WD1            | GET available-shift-definitions                                                       | 404                                                  | 200 with the palette's presence definitions                                                          |

Second example (master-1822, 2026-10-16, single version): after the orchestrator re-applied the lost carve (seed step q via Neu… › Absenz…; N-W-3), R-04 re-run on `{{CARVE_EMP}}` `{{CARVE_DAY}}` → PASS on the API (`sub_blocks` 57 1:00, credited 9:00 = PEP Ist; UI gap N-RE-1); W-06 on a must-stamp employee (E6, day planning) → `POST /shifts` 403, stamp pair survives the replan with a re-derived block — basis of the W-06 rewrite. Re-checks of fixture days identify the fixture by (employee, day, PA, time window): its ids change after every re-interpretation.

## Steps

1. Gate first: `DAYS=<the days of the table> EXPECT_DEF=<definition of the fix, if any> node {{SKILL_DIR}}/scripts/harness/mypp.mjs {{TENANT}} <login> {{GROUP_DIR}}/scripts/harness/days-check.mjs RE/gate` per employee involved. `script.ok` false → stop, report `blockers` (the fix did not take).
2. For each row, in order: `oracle-day.sh` before → the original steps, each write ONCE → `oracle-day.sh` after → save request/response bodies under `RE/<scenario>/`. A persisting error: save the body (and ask the orchestrator for the api-gw/api-pp log line at that UTC time via `blockers` — you cannot read box logs) and move on.
3. Clean everything you created (DB: no new BLOCK rows; active stamps `POSITION <> -1` back to the start value).

## Report

The common JSON with, per scenario: `verdict` = the new verdict on `{{TENANT}}`, `notes` starting with `previous: <verdict> (<finding>)`, `findings_confirmed` / `new_findings`. Close with one extra top-level field `"conclusion"`: which earlier findings were environment artefacts (now passing) and which remain product findings (first run: the question was whether N-W-1 / N-MO-1 / N-MO-2 are artefacts of the missing cache refresh — the classic block write C-04 already passed on the candidate after the refresh; robustness note either way: before the refresh the candidate failed on every block write of the palette's group, master only on days planned with the unresolved definition).

## Compare overlay (optional)

Normally not used (the re-check targets the environment that had the problem). If the fix was applied to both environments, repeat on `{{COMPARE_TENANT}}` into `RE/<scenario>/compare/`.
