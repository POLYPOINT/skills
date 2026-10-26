# Family P — Permissions and locking (P-01a, P-01b, P-02..P-04) + R-11 + W-08 · EXCLUSIVE, configuration owner

|                                         |                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order)               | P-03 (first: the portal session is fresh), P-01b stamp pair (right ON), P-01a + P-01b (right OFF), P-04, P-02 + W-08, R-11                                                                                                                                                                                                                                                                      |
| Exclusive                               | no other worker runs while you do; you ARE allowed to change rights and closing dates through SQL on `{{TENANT}}` — and MUST restore every change and prove the restore with the same read that proved the change                                                                                                                                                                               |
| Employees                               | E1 `{{E1_LOGIN}}` ({{E1_ID}}), E2 `{{E2_LOGIN}}` ({{E2_ID}}) (P-04, needs O's Pikett on `{{E2_WD2}}`), ER `{{ER_LOGIN}}` ({{ER_ID}}, R-11), E5 `{{E5_LOGIN}}` ({{E5_ID}}, control read only)                                                                                                                                                                                                    |
| Portal (P-03)                           | profile `{{PORTAL_PROFILE}}`, org slug `{{PORTAL_ORG}}` (env-facts.md). The operator signs in (headed `login`) IMMEDIATELY before the orchestrator launches you: the session lasts about 1.5 h (run a1801: login 12:46Z, LOGIN_NEEDED 14:19Z), so P-03 runs FIRST. Exit 3 `LOGIN_NEEDED` → P-03 BLOCKED + blocker "portal session expired"; continue with P-01b. Profile missing → P-03 BLOCKED |
| Days                                    | E1 `{{E1_WD1}}` (P-01, P-03 baseline, W-08), E2 `{{E2_WD2}}` (P-04), ER `{{ER_WD1}}` (R-11) — this family's days from the day map (E1's a **day** planning — P-01b's pair on a night before the carve day destroyed the carve in master-1822, fixture-day protection); P-03's day −1 / −2 / today are relative to the date P-03 actually runs (compute them then, Europe/Zurich, and note them) |
| Configuration facts (fill from Phase 1) | planner role `{{PLANNER_ROLE_ID}}` (audit A2 "DMSEED:Planner"; first run 1081, shared by ALL seed users), E1's category node `{{E1_NODE}}` (first run 458, shared with E2–E4), ER's isolated node `{{ER_NODE}}` (first run 472, only ER + two unused people)                                                                                                                                    |
| Profiles / results                      | `MYPP_PROFILES={{RUN_DIR}}/.profiles/P` · `{{RUN_DIR}}/P/<id>/` (R-11 → `R/R-11/`, W-08 → `W/W-08/`) · every change and revert with timestamps in `created/P.jsonl` (`kind: "config"`)                                                                                                                                                                                                          |
| Read first                              | the common part; scenarios.md P-01a, P-01b, P-02..P-04, R-11, W-08 and "Known product defects" (KD-2, KD-3); `{{SKILL_DIR}}/scripts/seed/common/rights.sql` (function/operation ids)                                                                                                                                                                                                            |

If your permission classifier refuses a DML statement, stop and report the exact statement in `blockers`: the orchestrator runs it. Never improvise other configuration changes.

Rights checks use `{{GROUP_DIR}}/scripts/harness/api-probe.mjs` (unified + legacy `/permissions`) with `DATE=<day>`:

```
cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/P DATE={{E1_WD1}} \
  node {{SKILL_DIR}}/scripts/harness/mypp.mjs {{TENANT}} {{E1_LOGIN}} {{GROUP_DIR}}/scripts/harness/api-probe.mjs P/P-01a/before
```

api-pp caches roles and closing dates (no PSC triggers on the boxes): every change below is followed by its `ENQUEUE_PERSISTENCE_STATE_CHANGE` + COMMIT; re-read after ≤ 3 min.

## P-03 — past-days window flag (CT portal ops, operator session) — FIRST

Run it first, right after the orchestrator's launch (the operator's portal login happened minutes before; as E1). Tool: `{{SKILL_DIR}}/scripts/harness/portal-flag.mjs` (headless, reuses `{{PORTAL_PROFILE}}`; never a login of your own — exit 3 "LOGIN_NEEDED" → BLOCKED + blocker "portal session expired, operator must re-run the login action"). Invocation: `cd {{RUN_DIR}} && PORTAL_ORG={{PORTAL_ORG}} node {{SKILL_DIR}}/scripts/harness/portal-flag.mjs {{PORTAL_PROFILE}} P/P-03/portal-<step> {{TENANT}} <read|set|delete> [1]`.
Where it lives (for screenshots and notes): Portal ops → Organizations → "DeployMate / <organization id>" → tenant `{{TENANT}}` → section **Features** → lower table (non-boolean features), row `poma.onPrem.timeRecodingMaxAllowedPastDays` (INTEGER): value field + save icon (PUT tenant override, confirm dialog) / delete icon (remove the override). Overrides are only listed under Tenant Analytics.

1. `read` → `portal-read/` (fresh tenant: value 7, no override). Baseline myPP (fresh profile `.profiles/P-03-base`): `{{E1_WD1}}` writable; save the app's `config/features` response.
2. `set 1` → `portal-set/`; log in `created/P.jsonl` (`kind: "config"`, `code`, `before: "no override (master 7)"`, `after: "1"`).
3. Propagation (portal allFeatures cache ≈ 3 min + poma features reload 60 s; first run 3–5 min): every 60 s a NEW profile folder (`.profiles/P-03-try<n>`) → day view → read `config/features` until it shows 1 (max 10 min, then BLOCKED).
4. Checks with the retroactive right ON (day −n = the date P-03 runs − n; read-only, they may be fixture days): day −2: message `ADD_EDIT_NOT_ALLOWED_PAST` with days = 1, no write buttons; day −1: writable (value 1 grants one past day); today (the date P-03 runs): writable; unified `/permissions` and `/days` `day.permissions` unchanged (client-side gate). Screenshots of all three days.
5. Restore = `delete` → `portal-restore/` (remove the override; never "set 7"); poll as in 3 until `config/features` shows 7; `{{E1_WD1}}` writable again. Log the restore (`cleaned: true`).
   Verdict: PASS when step 4 holds. Until KD-3 is fixed, day −1 is blocked as well (value N grants only N−1 past days) → **KNOWN-FAIL KD-3** (`findings_confirmed: ["KD-3"]`), everything else must hold.

## P-01a / P-01b — retroactive stamping right OFF (function 1033, ops 2/3/4)

The retroactive gate is FE-only by design; the only documented server check is DELETE → 403. And the SPA loads `/permissions` only when the day view is entered **through the tab bar**: a deep link / reload with `?date=` never requests it (KD-2). So P-01a uses the tab bar; the deep-link variant is recorded as KNOWN-FAIL KD-2. 0. P-01b setup, right still ON: `oracle-day.sh {{TENANT}} {{E1_ID}} {{E1_WD1}}` → `ACTIVE|` 0; add a stamp pair on `{{E1_WD1}}` through the API (`api.call('POST', UTR + '/timestamps', {employment_id, shift_planning_id:<sp>, date:'{{E1_WD1}}', time:'{{E1_WD1}}T12:00:00.000Z', note:'e2e P-01b in'})`, then 12:30 Z `…out`, ≥ 3 min apart — times inside the day's planned window, the values fit a Früh/Spät/Mittel); log the ids. Delete by id later; never leave a lone IN (the forced POST of step 5 is a lone IN until cleanup — do the cleanup right after it).

1. Log the rows: `scripts/sql.sh {{TENANT}} "SELECT POLYUSRROLE_DETAILID||' F='||FUNKTIONSID||' OP='||OPERATION FROM ECBERN.POLYUSRROLE_DETAIL WHERE POLYUSRROLEID={{PLANNER_ROLE_ID}} AND APP_ID=2471 AND FUNKTIONSID IN (1032,1033) ORDER BY 1;"` → `P/P-01a/rows-before.txt`.
2. OFF: `DELETE FROM ECBERN.POLYUSRROLE_DETAIL WHERE POLYUSRROLEID={{PLANNER_ROLE_ID}} AND APP_ID=2471 AND FUNKTIONSID=1033;` `COMMIT;` `exec IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('PERMISSION_ROLE', '{{PLANNER_ROLE_ID}}', null, null, 2471, null);` `COMMIT;` (one `sql.sh` call, one statement per line).
3. **P-01a** (≤ 3 min after step 2, fresh profile folder `.profiles/P-01a`): api-probe `DATE={{E1_WD1}}` → unified `/permissions` `can_add_retroactive_timestamps` false. Then your own script: `page.goto(APP + '/tabs/home')`, click `ion-tab-button` with the text "Zeit-erfassung" (the time-recording tab), walk back with `.day-selector-arrow-btn` (first = previous day) to `{{E1_WD1}}` — `api-index.jsonl` must contain the SPA's own `GET …/permissions?date=…&employment-id=…`. On `{{E1_WD1}}`: no stamp button, the P-01b stamps without EDIT/DELETE actions, the stamp editor (if reachable) fixed to today; `{{E1_TODAY}}`: still stampable. Screenshots. PASS when all hold.
4. **P-01a deep-link variant** (fresh profile `.profiles/P-01a-deeplink`): `api.goto('/tabs/unified-time-recording?date={{E1_WD1}}', '/unified-time-recording/v1/days')`, wait 12 s; record whether `api-index.jsonl` contains an SPA `/permissions` call and whether "Stempeln" is offered. Until KD-2 is fixed: no call + button offered → note `KNOWN-FAIL KD-2 <ticket>` in P-01a's notes (P-01a's verdict stays the tab-bar result); if the call appears, KD-2 is fixed — say so.
5. **P-01b**: `DELETE /timestamps/<one of the step-0 ids>?date={{E1_WD1}}&employmentId={{E1_ID}}` → expected **403**, stamp unchanged (`oracle-day.sh`). Informational: one forced `POST /timestamps` on `{{E1_WD1}}` (13:00 Z, note `e2e P-01b forced`) → record the status (first run: accepted — FE-only gate by design, not a FAIL). PASS = DELETE 403 and nothing deleted.
6. Restore: `scripts/sql.sh {{TENANT}} -f {{SKILL_DIR}}/scripts/seed/common/rights.sql -D role_id={{PLANNER_ROLE_ID}}` (idempotent, re-inserts the missing rows with new ids and enqueues the refresh). Verify `can_add_retroactive_timestamps` true again; log old and new row ids.
7. Cleanup (right ON again): delete every stamp of `{{E1_WD1}}` you created (step 0 pair + the forced one) → `ACTIVE|` 0 (hard rule 1: never leave an odd count).

## P-04 — `on_call_add` governs Einsatz edits (function 1032, ops 3/4)

Precondition: E2 has the Pikett on `{{E2_WD2}}` (family O) — else BLOCKED. Same pattern as P-01a steps 1–2 and 6 with `FUNKTIONSID=1032`. Verify as E2 on `{{E2_WD2}}` (tab-bar entry; `api-probe.mjs` saves it as `result.dayPermissions`): **`/days` `day.permissions.can_add_on_call` false** (the unified `/permissions` endpoint has no `can_add_on_call` field), legacy `on_call_add` false; the on-call card shows no `.unified-on-call-card-add-btn` and existing assignments have no edit/delete. Restore with rights.sql; verify true again.

## P-02 — period closing + W-08 — write in a closed period (E1)

`LOCK_LAST_MONAT='T'` on the seed: a closing date anywhere in a month locks that whole month (api-pp locking date = last day of the closing-date month), so on a customer-roster seed (all data in `{{MONTH}}`) closing `{{P0}}` closes the whole run month including `{{E1_TODAY}}` for every employee of `{{E1_NODE}}` — acceptable in this exclusive phase, say so in notes.

1. Read and log: `SELECT KATEGORIE_ID||' ML='||TO_CHAR(ML_ABSCHLUSS_DATUM,'YYYY-MM-DD')||' SL='||TO_CHAR(SL_ABSCHLUSS_DATUM,'YYYY-MM-DD')||' LLM='||LOCK_LAST_MONAT FROM ECBERN.SYSTEM_KATEGORIE_VARIABELN WHERE KATEGORIE_ID IN ({{E1_NODE}},{{ER_NODE}});` (fresh seed: 1999-12-01 = open).
2. Close: `UPDATE ECBERN.SYSTEM_KATEGORIE_VARIABELN SET ML_ABSCHLUSS_DATUM = DATE '{{P0}}', SL_ABSCHLUSS_DATUM = DATE '{{P0}}' WHERE KATEGORIE_ID = {{E1_NODE}};` `COMMIT;` `exec IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('PERIOD_CLOSING', null, null, null, null, null);` `COMMIT;` — wait ≤ 3 min.
3. P-02 checks as E1: `/days` `{{P0}}` → `permissions.is_period_closed` true, message `ADD_EDIT_NOT_ALLOWED_CLOSED_PERIOD`, no buttons; month report `{{MONTH}}` rows `.locked` with `.icon-lock` (screenshots, `days.json`, `month.json`).
4. W-08 (as E1, the write that must be refused): replay `POST /api/mobile/unified-time-recording/v1/timestamps` `{employment_id:"{{E1_ID}}", shift_planning_id:<sp of {{E1_WD1}}>, date:"{{E1_WD1}}", time:"{{E1_WD1}}T12:00:00.000Z", note:"e2e W-08"}` through `api.call` → expected **403 `ACCESS_FORBIDDEN_TO_USER`** (the cloud's read-only pre-check, before PEP) and `oracle-day.sh` unchanged. Optional: the classic `POST /api/mobile/time-recording/v1/employments/{{E1_ID}}/time-stamps` `{"timestamps":[{"time":"{{E1_WD1}}T12:00:00.000Z","shift_planning_id":"<sp>","note":"e2e W-08 classic"}]}` → expected **409 `LEGACY_TIME_RECORDING_GENERIC_MESSAGE`** (PTC errorCode −12). No named locking exception is documented or expected. If a write unexpectedly succeeds: delete the stamp at once (after the restore if the delete is refused too) and FAIL.
5. Restore the logged values (`UPDATE … = DATE '<logged value>'`, COMMIT, enqueue `PERIOD_CLOSING`, COMMIT); verify `is_period_closed` false on `{{P0}}` and that E1 `{{E1_WD1}}` is writable again (`allowed_actions` contains ADD_TIMESTAMP).

## R-11 — read-only employee (stand-in ER on its isolated node)

Why a stand-in: E6's node is shared with the write employees (first run: E6 488 shared node 459 with E5), and ending E6's MITARBEITER_DETAIL makes `/days` fail instead of read-only (references/scenarios.md R-11 note).

1. Log ER's node values (step 1 of P-02 already did).
2. Lock: `UPDATE ECBERN.SYSTEM_KATEGORIE_VARIABELN SET ML_ABSCHLUSS_DATUM = DATE '{{MONTH}}-01', SL_ABSCHLUSS_DATUM = DATE '{{MONTH}}-01' WHERE KATEGORIE_ID = {{ER_NODE}};` `COMMIT;` enqueue `PERIOD_CLOSING`, `COMMIT;`.
3. First myPP login of ER (harness, one retry max), then `api-probe.mjs DATE={{ER_WD1}}` → `R/R-11/`: unified `/permissions?date={{ER_WD1}}&employment-id={{ER_ID}}` `is_read_only` true; `/days` `{{ER_WD1}}` `allowed_actions` [] and `permissions.is_period_closed` true; day view without stamp/add buttons and without the NO_TIMESTAMPS warning. Control: E5 `/permissions` `is_read_only` false.
4. Restore the logged values + enqueue; verify ER `is_read_only` false. Note in `notes.md`: the read-only state is produced by a period lock (flavour "period closed + read-only"), not by "no allowed period".

## Report

Add a `restored` array to your JSON: `[{"change":"role {{PLANNER_ROLE_ID}} fn 1033 removed","before":"rows …","after":"rows … (new ids)","verified":"can_add_retroactive_timestamps true"}, …]` — one entry per change.

## Cleanup checklist

Rights rows back (rights.sql lists 13 rows), both nodes' closing dates back to the logged values, every enqueue done, the P-03 portal override deleted (config/features back to 7), `created/P.jsonl` complete, no stamp written by P-01b or W-08 left (`ACTIVE|` 0 on `{{E1_WD1}}`).

## Compare overlay (optional)

Apply the identical change/verify/restore cycle on `{{COMPARE_TENANT}}` (its own role id and node ids from its `employees.md` entry) after `{{TENANT}}` is restored; `diff` = permission flags and status codes of both.
