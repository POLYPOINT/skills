# Family L — Legacy API stack (L-01, L-02) · API only

|                           |                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | L-01, L-02                                                                                                              |
| Employees                 | E1 `{{E1_LOGIN}}` ({{E1_ID}}) reads; E3 `{{E3_LOGIN}}` ({{E3_ID}}) reads + one block round trip on `{{P3}}`             |
| Writes                    | L-02 only: one legacy block on E3 `{{P3}}`, deleted again                                                               |
| Scheduling                | after R (R-05 reads E3 `{{P3}}`) and after W on E3                                                                      |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/L` · `{{RUN_DIR}}/L/<id>/` · `created/L.jsonl`                                     |
| Read first                | the common part; scenarios.md section L; `{{RUN_DIR}}/pep-oracle.md`; the C/M captures if present (classic month, flex) |

## L-01 — legacy reads: no 500, month = stamp spans (F3)

Scope: the current myPP FE never calls the legacy API (kept for old app versions); L-01 is a no-500 + compare-parity check. The legacy month is a **stamp report by construction**, not a PEP-Ist report.
Planning ids: `shifts[].shift_planning_id` of E1's unified `/days` for `{{P0}}..{{P3}}` (first run 1282..1285).

```
cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/L LDAYS={{P0}},{{P1}},{{P2}},{{P3}} LPLAN=<4 planning ids> MONTH={{MONTH}} \
  node {{SKILL_DIR}}/scripts/harness/mypp.mjs {{TENANT}} {{E1_LOGIN}} {{SKILL_DIR}}/scripts/harness/legacy-reads.mjs L/L-01/e1
```

and for E3 with `LDAYS={{P2}}` and its planning id → `L/L-01/e3`.

Expected and oracle:
| Check | Expected | First run (example) |
|---|---|---|
| every call | HTTP 200 (a 500 = F3 signature: save the body) | all 200 on both bundles → F3 refuted |
| legacy `reports/month` per day `accounted` | with `time_stamp_add` true (legacy `/permissions`): Σ stamp spans (corrected from/to) + on-call block spans of the day; without it: Σ GLAZ `ZEITANRECHNUNG` (past days). A shift **without stamps** falls back to Σ `planned_timestamps` spans of its legacy shift read (`getDurationsFromShift`, only up to today+1): 0:00 only when `planned_timestamps` is empty; P2-painted days fill it from the preview blocks, auto-stamp days with their AS stamps. Never compared with PEP Ist; judge each day with this rule from the `<emp>/shifts/<planning>` read | first run 480: 9:07 / 9:07 / 0:00 / 8:37; master-1822 480: 9:07 / 9:07 / **9:00** (Zeitsummen-only Spät, preview 13:30–22:30) / 8:37 |
| legacy month vs classic month (`classic-reports-month-*`) | recorded side by side (different definitions: classic credits stamp `creditedDuration` + absences + unplanned) | equal on stamped days |
| legacy `month-flex-time` vs classic flex vs PEP GLAZ-Saldo | equal | −6139:39 everywhere |
| `<emp>/shifts/<planning>` `planned_timestamps` | `[]` or the planned / preview times (ids null) — never the recorded stamps; recorded stamps there = F4 (N-L-1) → KNOWN-FAIL F4 on 1801, new on pre-1801 | first run candidate: recorded stamps (N-L-1); master-1822: planned times (OK) |
| E3 `{{P2}}` (ad-hoc absence block + the day's credit) legacy accounted | stamp spans incl. the AS stamps of P2 auto blocks (the PA 57 block is no stamp); 0:00 when the day has no stamps and no `planned_timestamps` | first run 0:00 (seed ZS only); master-1822 8:30 (AS 22:00 → 06:30) |
| with `--compare` | identical values on both envs | — |

Verdict: FAIL when a call is not 200, a value differs from the stamp-span oracle, or (with `--compare`) the two envs differ; a difference to PEP Ist alone is never a FAIL. Write `L/L-01/notes.md` with one line per day (legacy accounted | Σ stamp spans | classic credited | PEP Ist for information).

## L-02 — legacy block round trip (E3 `{{P3}}`)

Your own script (`{{RUN_DIR}}/scripts/L-02.mjs`) with `LTR`, `UTR`, `save`, `oracle` from utr-lib; each write ONCE:

1. Read before: `GET /api/mobile/legacy-time-recording/v1/{{E3_ID}}/shifts/<sp>` (sp = the planning id of `{{P3}}` from `/days`), `GET /days?from={{P3}}&to={{P3}}`, `GET /api/mobile/legacy-time-recording/v1/reports/month?employment-id={{E3_ID}}&start={{P3}}&end={{P3}}`, `oracle(env, {{E3_ID}}, '{{P3}}')`.
2. Times must not overlap a block the day already has (`oracle-day.sh`): on a P2-painted Früh day with the auto block 07:00–16:00 local use `17:00:00Z`–`19:00:00Z` and PUT end `19:30:00Z` instead of the values below; never touch the auto blocks. `POST /api/mobile/legacy-time-recording/v1/{{E3_ID}}/blocks` `{"start":"{{P3}}T07:00:00Z","end":"{{P3}}T09:00:00Z","shift_planning_id":"<sp>","note":"e2e L-02 legacy block"}` → expect 200; re-read (step 1 set).
3. Find the block: in the legacy shift read-back (`blocks[]`) or, if absent there (N-L-3), in the DB `BL|` rows (`BLOCK_ID`). Its legacy ids are `"<BLOCK_ID>:FROM_ID"` / `"<BLOCK_ID>:TO_ID"`.
4. `PUT /api/mobile/legacy-time-recording/v1/{{E3_ID}}/blocks` `{"from_block_id":"<id>:FROM_ID","to_block_id":"<id>:TO_ID","start":"{{P3}}T07:00:00Z","end":"{{P3}}T09:30:00Z","shift_planning_id":"<sp>","note":"e2e L-02 legacy block updated","block_type":"A"}` → 200; re-read.
5. `DELETE /api/mobile/legacy-time-recording/v1/{{E3_ID}}/blocks/<url-encoded "<id>:FROM_ID">` → 200; re-read; DB: no BLOCK left.
   Expected: 200/200/200, the block visible in unified `/days` after POST/PUT and gone after DELETE. Known (master too): the block is persisted with `PLANUNG_ID` NULL and the legacy read-back never shows it (N-L-3) → record, verdict on the round trip itself. Failure signature 409 `LEGACY_TIME_RECORDING_GENERIC_MESSAGE` with an api-pp "Shift definition … not found" cause = G4b → BLOCKED + blocker. No partner service account is used (the scenario's partner variant is optional; this is the HP-session variant).

## Cleanup

L-02 block deleted (DB check), logged in `created/L.jsonl`; P2 auto blocks of `{{P3}}` untouched (`PLANUNGSEINHEIT` status A → E stays: legit). Side effect to mention: the seed ZEITSUMME of `{{P3}}` is regenerated for the auto-stamp employee (new id) — legitimate.

## Compare overlay (optional)

Run `legacy-reads.mjs` and L-02 on `{{COMPARE_TENANT}}` into `L/<id>/compare/`; `python3 -I {{SKILL_DIR}}/scripts/diff-fixtures.py L/L-01/e1 L/L-01/compare/e1 --labels={{TENANT}},{{COMPARE_TENANT}}`; `diff` = the first differing field (first run: "candidate fills planned_timestamps with recorded stamps (N-L-1)").
