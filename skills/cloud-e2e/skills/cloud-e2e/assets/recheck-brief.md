# Re-check after an environment fix (template, every group)

Generic form of UTR's `family-briefs/RE.md`. Use it when verdicts of earlier families were caused by an environment problem that has since been fixed (typical: gate G4b — api-pp had not loaded a definition, palette, right or closing date; a PolyID lock; a stopped P4 service; a flag that had not propagated). The runner fills the table from the earlier reports and launches it like a family brief: header + generic common part + this file, the placeholders below written by the runner (they are not generated). The worker repeats exactly those steps, on `{{TENANT}}` only, and reports the new verdicts. Group `utr` keeps its own `groups/utr/assets/family-briefs/RE.md`.

|                    |                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Fix                | `{{FIX}}` — what was fixed, when (UTC), how it was verified (e.g. "`psc-enqueue.sh <env> shift-definition 150` at 07:40Z; read gate ok") |
| Scenarios          | the rows of the table below, in order                                                                                                    |
| Actors / days      | exactly those of the original scenarios (column "Actor / day"); nobody else, all claimed by group `{{GROUP}}`                            |
| Profiles / results | `MYPP_PROFILES={{RUN_DIR}}/.profiles/RE` · `{{RUN_DIR}}/RE/<scenario>/` · `created/RE.jsonl`                                             |
| Read first         | the common part; the original family briefs' steps for these ids; their reports; the findings named in the table                         |

| Scenario | Actor / day           | Repeat (same steps and bodies as the original family brief) | Previous result | Expected if the environment was the only cause |
| -------- | --------------------- | ----------------------------------------------------------- | --------------- | ---------------------------------------------- |
| `{{ID}}` | `{{ACTOR}}` `{{DAY}}` | `{{STEPS}}`                                                 | `{{PREVIOUS}}`  | `{{EXPECTED}}`                                 |

## Steps

1. Gate first: the read check that proves the fix took (the runner names it in the Fix row, e.g. a `/days` read with the definition, a fresh `config/features` read, one login). Fails → stop, report `blockers` (the fix did not take).
2. For each row, in order: oracle before → the original steps, each write ONCE → oracle after → save request / response bodies under `RE/<scenario>/`. A persisting error: save the body and move on (ask the runner for a log line via `blockers`; you cannot read box logs).
3. Clean everything you created and verify it through the oracle.
4. Windows and locks as in the common part: a PEP step only under the PEP lock; stop if a window pauses `{{GROUP}}:RE`.

## Report

The common JSON with, per scenario: `verdict` = the new verdict on `{{TENANT}}`, `notes` starting with `previous: <verdict> (<finding>)`, `findings_confirmed` / `new_findings`, issue screenshots for every non-PASS. Close with one extra top-level field `"conclusion"`: which earlier findings were environment artefacts (now passing) and which remain product findings.
