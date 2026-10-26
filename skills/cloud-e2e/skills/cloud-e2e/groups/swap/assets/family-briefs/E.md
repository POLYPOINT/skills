# Family E — Half-shift swap matrix and effects (SWP-26, 27, 28, 29) · writes on T1..T8, U1..U4 on HA..HD

|                           |                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | SWP-26, SWP-27, SWP-28, SWP-29                                                                                                                                                                                                                                                                                                                                                                        |
| Actors                    | T1 `{{T1_LOGIN}}` ({{T1_ID}}), T2 `{{T2_LOGIN}}` ({{T2_ID}}), T3 `{{T3_LOGIN}}` ({{T3_ID}}), T4 `{{T4_LOGIN}}` ({{T4_ID}}), T5 `{{T5_LOGIN}}` ({{T5_ID}}), T6 `{{T6_LOGIN}}` ({{T6_ID}}), T7 `{{T7_LOGIN}}` ({{T7_ID}}), T8 `{{T8_LOGIN}}` ({{T8_ID}}), U1 `{{U1_LOGIN}}` ({{U1_ID}}), U2 `{{U2_LOGIN}}` ({{U2_ID}}), U3 `{{U3_LOGIN}}` ({{U3_ID}}), U4 `{{U4_LOGIN}}` ({{U4_ID}}), SP `{{SP_LOGIN}}` |
| Days                      | `{{HA}}` (direct matrix), `{{HB}}` (4-halves), `{{HC}}` (effects, SWP-28 main, SWP-29), `{{HD}}` (SWP-28 compensation)                                                                                                                                                                                                                                                                                |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/E` · `{{RUN_DIR}}/E/<id>/` · `created/E.jsonl`                                                                                                                                                                                                                                                                                                                   |
| Read first                | the group brief; scenarios.md section E; `known-deviations.md` SW-K1, SW-K2, SW-K6; `swap-allocation.md` (gate G-SWP-HALF)                                                                                                                                                                                                                                                                            |
| PEP                       | SWP-29 conflict planning only (`{{CONFLICT_RECIPE}}`, `pp-plan.sh`; PEP fallback under `{{PEP_LOCK_DOC}}`)                                                                                                                                                                                                                                                                                            |
| Windows                   | none of its own; paused by W-X-TRADES-OFF, W-X-CATEGORIES-OFF, W-X-WRITE-OFF (SP approvals in SWP-27/29)                                                                                                                                                                                                                                                                                              |
| Bundle note               | half-shift behaviour changed with PR 12177 (2026-09-25, FULL split on approval) and APIPP-1876 (2026-10-13). Write the pinned pp-services build (`envs/{{ENV}}`) into every report                                                                                                                                                                                                                    |

**Gate first:** `plan-day.sh` for every cell of the four days (table below) → `oracle-halves-start.txt`. G-SWP-HALF not PASS or a cell missing → the cases that need it BLOCKED "half cell missing: <who> <day>" (the toolchain cannot paint halves in the PEP UI; the runner repaints with `pp-plan.sh`).

Candidates call for an offered planning: as the requester, `ps = await pickShift(api, day, {position})` → `candidates(api, ps)` (direct) or `candidates(api, ps, {targetEmploymentIds: [<candidate MITARBEITER_ID>]})` (flexible rows). Record per case: is the candidate in the list, with which `shift.shift_position` and `shift.shift_definition_id`.

## SWP-26 — Half-shift candidate matrix (direct + flexible offer), API

`{{HA}}` cells: requesters T1 L:111, T2 R:111, T3 F:111, T4 L:111 + R:112; candidates T5 L:112, T6 R:112, T7 F:113, T8 L:113 + R:112.

| Case (matrix id) | Requester offers            | Candidate                      | Current v26 (PASS reference)               | If observed = reference but differs from the page expectation |
| ---------------- | --------------------------- | ------------------------------ | ------------------------------------------ | ------------------------------------------------------------- |
| #1               | T1 LEFT 111                 | T5 LEFT                        | offered                                    | —                                                             |
| #2               | T1 LEFT                     | T6 RIGHT                       | not offered                                | —                                                             |
| #3               | T1 LEFT                     | T7 FULL                        | offered (expectation: not offered)         | KNOWN-FAIL SW-K1                                              |
| #4               | T1 LEFT                     | T8 L+R                         | offered, LEFT only                         | —                                                             |
| #5               | T4 LEFT 111 (T4 holds L+R)  | T8 L+R                         | page: PARTIALLY — record offered or hidden | hidden → KNOWN-FAIL SW-K6                                     |
| #6               | T2 RIGHT 111                | T5 LEFT                        | not offered                                | —                                                             |
| #7               | T2 RIGHT                    | T6 RIGHT                       | offered                                    | —                                                             |
| #8               | T2 RIGHT                    | T7 FULL                        | offered (expectation: not offered)         | KNOWN-FAIL SW-K1                                              |
| #9               | T2 RIGHT                    | T8 L+R                         | offered, RIGHT only                        | —                                                             |
| #10              | T4 RIGHT 112 (T4 holds L+R) | T8 L+R (its RIGHT is also 112) | page: PARTIALLY — record offered or hidden | hidden → KNOWN-FAIL SW-K6                                     |
| #11              | T3 FULL 111                 | T5 LEFT                        | offered (expectation: not offered)         | KNOWN-FAIL SW-K1                                              |
| #12              | T3 FULL                     | T6 RIGHT                       | offered (expectation: not offered)         | KNOWN-FAIL SW-K1                                              |
| #13              | T3 FULL                     | T7 FULL                        | offered                                    | —                                                             |
| #14              | T3 FULL                     | T8 L+R                         | not offered                                | —                                                             |

Flexible rows #15–#28 (matrix table in `{{GROUP_DIR}}/references/scenarios.md` SWP-26): repeat the calls of #1–#14 with `targetEmploymentIds` = the candidate; record offered / not offered. Where the page says "compensation FULL | HALF" (#15, #18, #19, #21, #23, #24, #27) record the compensation granularity only in SWP-28 (SW-K2). Rows #17, #22, #25, #26 offered → KNOWN-FAIL SW-K1.

`{{HB}}` 4-halves (letters: A = 111, B = 112, C = 113, D = `{{DEF_D}}`); requester T1 A|B (LEFT 111, RIGHT 112):

| Cases     | Candidate (LEFT\|RIGHT) | Trade LEFT (odd id)   | Trade RIGHT (even id)                        |
| --------- | ----------------------- | --------------------- | -------------------------------------------- |
| #29 / #30 | T2 C\|A                 | offered               | NO candidates → KNOWN-FAIL SW-K6             |
| #31 / #32 | T3 B\|A                 | NO candidates → SW-K6 | NO candidates → SW-K6                        |
| #33 / #34 | T4 B\|C                 | NO candidates → SW-K6 | offered                                      |
| #35 / #36 | T5 C\|B                 | offered               | NO candidates → SW-K6                        |
| #37 / #38 | T6 C\|D                 | offered               | offered (skip both if `{{DEF_D}}` is `none`) |

One UI pass for #1 and #3 (T1 → stepper → "Vorschläge", screenshots). Verdict: PASS when every case equals the reference column; the reference itself differing from the page → KNOWN-FAIL with the id above (`findings_confirmed` lists each id once); any other difference = new finding `N-SWAP-<n>`. Evidence: `candidates-<case>.json`, `matrix-result.md` (case → observed → verdict).

## SWP-27 — Half-shift approval effects in PEP (`{{HC}}`)

H7: T1 L:111 ↔ T2 L:112 · H8: T3 L:111 → T4 F:112 · H9: T5 L:111 → T6 L:113 + R:112. Per pair: `plan-day.sh` before (both) → shortcut swap of the requester's LEFT with the candidate → candidate YES → requester submits → SP "Bestätigen" (or `spDecide(api, oppId, reqId, 'APPROVE')`) → `plan-day.sh` after (both).
Expect: H7 only the LEFT plannings exchanged, other halves untouched; H8 T4's FULL split into LEFT (to T3) + RIGHT (kept) — current behaviour, **KNOWN-FAIL SW-K1** against the page expectation (which would not offer it); H9 only T6's LEFT used, T6's RIGHT untouched. Oracle: `PA_CODE`, `DIENSTPOSITION`, `DIENSTTEIL`, count before/after. Evidence `oracle-planung-H7..H9-before/after.txt`.

## SWP-28 — Half-shift flexible compensation granularity (U3 owner, `{{HC}}` main, `{{HD}}` compensation)

Cells: `{{HC}}` U3 L:111, U4 `{{ABS_DEF}}`; `{{HD}}` U4 F:112. U3: `{{HC}}` LEFT detail → "Diensttausch" → pick the absence → candidates U4 → "Angebot" `{{HD}}` → record which U4 shifts are offered (FULL and/or half) in `tradable-shifts-for-compensation*` and on screen; back out without creating.
Expect (findings page, TBD): only half presences when a half is on either side; a FULL offered → **KNOWN-FAIL SW-K2**. Also record the matrix rows #23 / #24 (RIGHT offers) once if a RIGHT cell exists; otherwise note "not covered".

## SWP-29 — Half swap declined or conflict-cancelled leaves the halves intact (`{{HC}}`)

H12: T7 L:111 → T8 F:112: swap → YES → submit → SP "Ablehnen" → `plan-day.sh`. H13: U1 L:111 → U2 L:112: swap → YES → submit → add the conflict for U2 (`{{CONFLICT_RECIPE}}`) → SP "Bestätigen" → dialog → cancel → `plan-day.sh`; then delete the conflict planning.
Expect: both pairs identical to before (no split FULL, no extra halves, same `PLANUNG_ID`s). Recipe `none` → H13 BLOCKED-data, H12 still decides.

## Cleanup checklist

- No OPEN / SUBMITTED swap of your requesters (T1..T7, U1, U3).
- SWP-27 changed H7..H9 cells: list them in `created_data`; conflict planning of SWP-29 deleted.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
