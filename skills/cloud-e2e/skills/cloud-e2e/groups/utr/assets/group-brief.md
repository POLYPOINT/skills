# UTR group brief — the UTR worker brief (standalone layout)

**For the runner (this part above the worker-brief marker is not sent).** This file is UTR's complete worker brief, moved from utr-e2e v0.5.0 `assets/agent-brief.md` with path-only edits and the PEP lock line replaced by the coordination protocol. It uses the **standalone layout** (marker below): `scripts/gen-prompts.py` takes it **instead of** the generic `assets/agent-brief.md`, so a solo UTR prompt is the v0.5.0 prompt. In a multi-group run the engine appends the generic "Hard rules" (cloud-E2E rules 1–15, incl. "on a classifier block stop and report, never retry renamed") and the "Multi-group run" addendum of `assets/agent-brief.md` (windows, rows, report fields `group` / `runner` / `env`). A solo prompt carries v0.5.0's own classifier rule (header guardrail "Permission classifier denials"). A worker's prompt = header + the part of this file below the marker + `{{GROUP_DIR}}/assets/family-briefs/<FAMILY>.md`, every placeholder filled by `python3 -I scripts/gen-prompts.py results/<run>/run-config.json --group utr [--solo]` (values from `env-facts.md`, `employees.md`, `day-tokens.md`). Launch with the Agent tool: `subagent_type: "general-purpose"`, `model: "sonnet"` (only a validation run started with `--worker-model opus` passes `model: "opus"`), description `UTR E2E family <F>`. Never paste credentials, tokens or connect strings: the scripts read them from disk. Check before launching that no `{{` is left in the prompt.

| Placeholder                                              | Meaning                                                                                                                                                                                                                                                                      | First run (example only, 2026-10-14)                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `{{RUN}}` / `{{RUN_DIR}}`                                | run name / absolute results folder `results/<run>`                                                                                                                                                                                                                           | `pr12910-vs-master`                                                           |
| `{{SKILL_DIR}}` / `{{GROUP_DIR}}`                        | absolute path of the cloud-e2e skill folder / of `groups/utr` inside it                                                                                                                                                                                                      | —                                                                             |
| `{{TENANT}}`                                             | DeployMate env id = CT tenant id of **the environment under test**                                                                                                                                                                                                           | `utr-p-1801` (example)                                                        |
| `{{COMPARE_TENANT}}`                                     | second environment of a `--compare` run, else `none`                                                                                                                                                                                                                         | `utr-m-1801` (example)                                                        |
| `{{BUNDLE}}` / `{{BUNDLE_CLASS}}`                        | pp-services version of the environment under test / `pre-1801` or `1801` (scenarios.md "Bundle class")                                                                                                                                                                       | `0.0.1822` / `pre-1801` (master-1822)                                         |
| `{{PEP_LOCK_DOC}}` / `{{PEP_LOCK_STEPS}}`                | the PEP lock of the box (`locks/<env>~pep` in the run dashboard db) / the acquire-renew-release steps of the run's coordination mode (`references/coordination.md` §3); generated, never typed                                                                               | `locks/utr-a1801~pep`                                                         |
| `{{FAMILY}}` / `{{AGENT_NAME}}`                          | family id / `worker-<F>`                                                                                                                                                                                                                                                     | `W` / `worker-W`                                                              |
| `{{R}}`                                                  | run date (Europe/Zurich) the prompt was generated for                                                                                                                                                                                                                        | 2026-10-14 (Wed)                                                              |
| `{{P0}}`..`{{P3}}`                                       | prepared READ days = first four roster weekdays (seed README § Dates) — **absolute** data days, never move with R, never written                                                                                                                                             | 10-06..10-09 = R−8..R−5                                                       |
| `{{WE1}}`, `{{WE2}}`                                     | Saturday / Sunday inside the write window R−7..R−1 (unplanned on a fresh seed)                                                                                                                                                                                               | 10-10 Sat, 10-11 Sun = R−4, R−3                                               |
| `{{WD1}}`, `{{WD2}}`                                     | default: WD2 = the last weekday before R, WD1 = the weekday before WD2; the orchestrator may override them per family / employee (`day-tokens.md`, rules in SKILL.md "Day map and date shift": no fixture day, fixture-day protection, the planning type the scenario needs) | 10-12 Mon, 10-13 Tue = R−2, R−1                                               |
| `{{TODAY}}`                                              | R                                                                                                                                                                                                                                                                            | 10-14                                                                         |
| `{{<ROLE>_<TOKEN>}}` (e.g. `{{E3_WD2}}`, `{{E2_TODAY}}`) | the day of that token **for that employee in this family**: the per-employee override of the day map (config `families.<F>.days.<ROLE>`), else the family value. Briefs use these on every employee-specific line, so no worker remaps dates                                 | run a1801 W: `{{E3_WD2}}` = 10-13 while `{{WD2}}` = 10-15                     |
| oldest UI-writable day                                   | R−6 while KD-3 is open (flag value 7 grants 6 past days), R−7 once fixed — derived, no placeholder                                                                                                                                                                           | 10-08                                                                         |
| `{{MONTH}}`                                              | the run month `YYYY-MM`                                                                                                                                                                                                                                                      | 2026-10                                                                       |
| `{{En_LOGIN}}` / `{{En_ID}}`                             | myPP login (`dmseed-<kuerzel>`) / MITARBEITER_ID = employment id of role En (table below)                                                                                                                                                                                    | see table                                                                     |
| `{{En_ROW_Y}}`                                           | y of En's row in the PEP plan sheet (default view `259 + n·25`, seed README § PEP coordinates)                                                                                                                                                                               | E3 284, E2 359                                                                |
| `{{TEAM_NODE}}`                                          | the team's plan-sheet / palette node (name and id)                                                                                                                                                                                                                           | "Pflege Chirurgie" 457                                                        |
| `{{PLANNER_ROLE_ID}}`, `{{E1_NODE}}`, `{{ER_NODE}}`      | P family only: seed planner role (audit A2), E1's category node, ER's isolated category node                                                                                                                                                                                 | 1081, 458, 472                                                                |
| `{{PORTAL_PROFILE}}`, `{{PORTAL_ORG}}`                   | P family only (P-03): the operator's portal-ops browser profile folder (Phase 0 portal session) and the DeployMate organization slug in portal ops                                                                                                                           | `<scratchpad>/portal-profile`, `deploymate-<org uuid>`                        |
| `{{KOMBI_EMP}}` / `{{KOMBI_DAY}}`                        | R family (R-02; W lists them as days never to write): employee role and day of the Kombi 9102 (Phase 1 step o)                                                                                                                                                               | E2 / P0                                                                       |
| `{{CARVE_EMP}}` / `{{CARVE_DAY}}`                        | R family (R-04; W and RE as protected / re-check day): employee role and day of the carved absence (Phase 1 step q); a prepared day whose previous day is no night any family writes                                                                                         | E2 / P2 (master-1822 used E1 10-14 after a written night: lost twice — avoid) |
| `{{E6_WD}}`                                              | W family only (W-06b): a write-window weekday of E6 with a day planning, not E6's R-11 evidence day                                                                                                                                                                          | master-1822 RE: 10-12                                                         |

Roles `ES` and `ER` use the same `{{ES_LOGIN}}`/`{{ES_ID}}` and `{{ER_LOGIN}}`/`{{ER_ID}}` pattern.

The orchestrator derives every token from `scripts/seed/README.md` § Dates and SKILL.md "Day map and date shift" and regenerates the prompts when the date changes; workers never compute dates themselves, except the "Date shift" rule below (and P-03's day −1 / −2, which are by definition relative to the day P-03 runs).

| Role | Rule (seed README step a)                                        | First run (example)    |
| ---- | ---------------------------------------------------------------- | ---------------------- |
| E1   | must-stamp (`AUTO_ZEITSTEMPEL F`, unified TIMESTAMPS), BG 100    | 480 dmseed-lhug        |
| E2   | must-stamp, BG 100, on-call (Pikett plannings)                   | 484 dmseed-cmül        |
| E3   | auto-stamp (`T`, unified BLOCKS), BG 100                         | 481 dmseed-awüt        |
| E4   | must-stamp, BG < 100                                             | 482 dmseed-ksta (70 %) |
| E5   | must-stamp, BG 100 (mobile, classic)                             | 486 dmseed-rsta        |
| E6   | must-stamp, BG 100 (read-only target)                            | 488 dmseed-osch        |
| ES   | spare auto-stamp (BLOCKS) — MO-05, write fallback                | 487 dmseed-jeug        |
| ER   | read-only stand-in on an isolated category node (P family, R-11) | 510 dmseed-mhof        |

<!-- BRIEF LAYOUT: standalone (replaces assets/agent-brief.md for this group; scripts/gen-prompts.py) -->
<!-- BEGIN WORKER BRIEF -->

You are running part of the myPOLYPOINT time-recording end-to-end test (UTR E2E) of run **{{RUN}}**. You own family **{{FAMILY}}** and nothing else: execute the scenarios of your family brief, in its order, on **the environment under test `{{TENANT}}`**, and report in the JSON schema at the end. Do not improvise scenarios, do not touch other employees or days, do not change tenant configuration unless your family brief explicitly makes you the configuration owner.

## Verdict boundary

The run verifies one on-prem bundle against its oracles. Per scenario: **PASS** = observed equals the expected value and the oracle; **FAIL** = a mismatch, with evidence; **BLOCKED** = could not be executed or evaluated (gate failure, missing data prerequisite, build without the feature) — a verdict, not a failure of yours. **PENDING** exists only in family C part 1 (an item that part 2 finishes; family brief "PENDING convention"). Oracles, in this order: PEP's "Ist-Zeit Tag" of that day (values in the family brief, taken from Phase 1 or read in PEP), the DB rows (`oracle-day.sh`), the expectation in `{{GROUP_DIR}}/references/scenarios.md`. A second environment (`--compare`) only fills the `diff` field and never decides a verdict.
Bundle under test: **`{{BUNDLE}}`, class `{{BUNDLE_CLASS}}`**. Before calling a mismatch new, look up your scenario in scenarios.md "Known product defects" and "Bundle-aware expectations" for `{{BUNDLE_CLASS}}`: a matching signature is **KNOWN-FAIL <id>** (verdict `FAIL`, `findings_confirmed: ["<id>"]`, notes start with `KNOWN-FAIL <id> <ticket>`); a different signature, or a FAIL where the table says PASS, is new (`N-{{FAMILY}}-<n>`). A listed defect that does not show → PASS with "<id> not reproduced" in notes.

## Read first

1. Your family brief (below this common part).
2. `{{GROUP_DIR}}/references/scenarios.md` — only the sections of your scenario ids (each has a "Data prerequisite / status on customer-roster seed" note where relevant).
3. `{{RUN_DIR}}/env-facts.md`, `{{RUN_DIR}}/employees.md`, and what your family brief names (e.g. `write-days.md`, `verify-seed.md`, `new-findings.md`).

## Tooling (all working — do not rebuild, do not install)

**myPP harness** (Playwright Chromium, persistent profile, PolyID login, records every `/api/` response):

```
cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}} \
  node {{SKILL_DIR}}/scripts/harness/mypp.mjs {{TENANT}} <login> <script.mjs|-> <outdir> [--headed] [--mobile]
```

- ALWAYS set `MYPP_PROFILES` to your own folder: other workers use the same logins concurrently and a shared Chromium profile would clash.
- The first run per tenant+login performs the PolyID login (e-mail step, IDM step, consent, tour) itself; the password comes from the DeployMate manifest at runtime and is submitted at most twice. If a login fails, retry ONCE at most, then mark the scenarios BLOCKED: PolyID's brute-force detection locks the caller IP per provider **without expiry**. Never unlock it yourself (no `polyid-unlock.mjs`, no PolyID ops frontend): report `PolyID lockout (USER_OR_IP_LOCKED) <login>` with the login-failed screenshot in `blockers`; the orchestrator unlocks and re-runs. Never try other usernames.
- Script contract: `export default async ({page, api, shot, log, env, envId, login, MYPP, APP, out}) => {...}` (`env` = tenant id). `api.goto('/tabs/unified-time-recording?date=YYYY-MM-DD', '/unified-time-recording/v1/days')` navigates (SPA base added, tour dismissed) and returns the matched response `{status, url, body}`; `api.get(path)` / `api.call(method, path, body)` call the poma API with the captured bearer; `api.wait(frag)` waits for a response; `shot('name')` saves `<outdir>/NN-name.png`; every API response lands in `<outdir>/api/NNN-METHOD-path.json` + `api-index.jsonl`. Write your own scripts as `{{RUN_DIR}}/scripts/{{FAMILY}}-<id>.mjs`.
- Helpers: `import { day, readDay, summary, save, setTime, act, expand, comment, alertText, oracle, go, classicDay, stepper, UTR, CTR, LTR } from '{{GROUP_DIR}}/scripts/harness/utr-lib.mjs'` — `day(ctx, d)` opens the unified day view, `summary(plan)` gives shifts/blocks/breaks/stamps/time_credits/amounts as H:mm, `act(page, METHOD, urlFragment, () => click)` captures the write request+response, `oracle(env, emp, d)` returns the DB rows.
- Ready scripts (env-driven, verified on the CT build of 2026-10-14): `{{GROUP_DIR}}/scripts/harness/ui-stamp-crud.mjs` (stamp add/edit/add/delete, W-01 recipe), `ui-add-block.mjs`, `ui-edit-row.mjs` (edit/delete a block, break or stamp row), `days-check.mjs` (status + definition ids per day), `baseline.mjs`, `api-probe.mjs`. Usage lines are in each file header.
- **Navigation retry**: after `api.goto` the SPA sometimes lands on `/tabs/home/main` (fresh login, tutorial), and the first navigation of a fresh profile may issue no `/days` request at all. In your own scripts open day views with `dayx(ctx, d)` from utr-lib (retries `day()` until the URL and the day selector show the day view, then expands; `ctx.dayViewOk` false = not reached — write nothing). The ready `ui-*.mjs` scripts use it and throw before any write when the day view is not reached (re-run them then); `days-check.mjs` retries a navigation without response once.
- **Night-shift cards**: the add-block form of a planning that crosses midnight defaults "Datum bis" to the next day → a 17:00–18:00 block becomes 25 h → 400 `…_BLOCK_TOO_LONG`. Prefer a day planning; `ui-add-block.mjs` has `EDATE_PREV=1` (end date one day back) and an end-day guard that aborts the POST in the browser (nothing sent, `result.guard`) when the request's `end` is on another local day than `END_DAY` (default DAY, DAY+1 with `EDATE_NEXT`).
- In-app mobile path (cordova shim + Android UA, the app's own login forms): `node {{SKILL_DIR}}/scripts/harness/mypp-inapp.mjs {{TENANT}} <login> <script|-> <outdir>` — same contract; `--mobile` on `mypp.mjs` only sets UA/viewport/touch.

**Endpoints** (base `/api/mobile`): unified `unified-time-recording/v1/{days?from&to, permissions?date&employment-id, reports/month?employment-id&start&end, available-shift-definitions?date&include-icons=false&include-absences=false, allowed-on-call-shifts?date&employment-id}`; classic `time-recording/v1/{days?day=, reports/month?employment-id&start&end, month-flex-time?date=}`; legacy `legacy-time-recording/v1/{permissions, month-flex-time?date&employmentId, reports/month?..., <emp>/shifts/<planning id>}`; capabilities `/api/capabilities/v1/capabilities`. There is NO mobile closing-dates endpoint and NO legacy `/days` endpoint (404 = harness path error, not a finding).

**Unified write bodies** (what the FE sends; ids are strings except `roster_cell_id`; times ISO UTC with `.000Z`; take `roster_cell_id` and `shifts[].shift_planning_id` from the GET `/days` of that day):

| Write             | Request                                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stamp             | `POST /timestamps` `{employment_id, shift_planning_id, date, time, note}` · `PUT /timestamps/{id}` same body · `DELETE /timestamps/{id}?date=&employmentId=`                                              |
| block             | `POST /shifts` `{employment_id, shift_definition_id, shift_planning_id, roster_cell_id, date, start, end, note}` · `PUT /shifts/{block_id}` · `DELETE /shifts/{block_id}?date=&employmentId=`             |
| break             | `POST /shifts/{block_id}/breaks` `{employment_id, roster_cell_id, date, start, end, note}` · `PUT /shifts/{block_id}/breaks/{break_block_id}` · `DELETE …?date=&employmentId=`                            |
| on-call (Einsatz) | `POST /on-call-shifts` `{employment_id, shift_definition_id, shift_planning_id, roster_cell_id, date, start, end, note}` · `PUT /on-call-shifts/{id}` · `DELETE /on-call-shifts/{id}?date=&employmentId=` |

Every unified write answers the refetched `UnifiedDayPlan` of the day: save it.

**DB oracle** (read-only for you unless your family brief says otherwise):

```
{{GROUP_DIR}}/scripts/oracle-day.sh {{TENANT}} <MA_ID> <YYYY-MM-DD>       # ST|/BL|/PL|/PE|/ZS| rows for the day and day+1, ZA| Σ ZEITANRECHNUNG minutes per CODEART/account (acct=1 = GLAZ = credited oracle), ACTIVE| stamp count
{{SKILL_DIR}}/scripts/sql.sh {{TENANT}} "<SQL; one statement per line, each ending with ;>"
```

Schema `ECBERN` (PLANUNG, PLANUNGSEINHEIT, STEMPEL, BLOCK, ZEITSUMME, DIENST, DIENSTPALETTE, MITARBEITER). **Active stamps = `POSITION <> -1 OR POSITION IS NULL`**: a stamp deleted through myPP keeps its row with `POSITION = -1` (`GELOESCHT` stays null); an update is delete + add (new id, old row −1). Times in STEMPEL/BLOCK are seconds after midnight (END > 86400 = next day).

**PEP** (only when your family brief has a PEP step): load the `pep-verify` skill first; drive it with `{{SKILL_DIR}}/scripts/pep.sh {{TENANT}} <command>` and the helpers `{{SKILL_DIR}}/scripts/pep/pe-ready.sh`, `{{GROUP_DIR}}/scripts/pep/pe-{open,del-zs,reinterp,shots}.sh`. One RDP session per box, shared by all workers:

- **Lock** (`{{PEP_LOCK_DOC}}`): {{PEP_LOCK_STEPS}}
- **State contract**: after taking the lock run `scripts/pep/pe-ready.sh {{TENANT}}` — it acknowledges "Session abgelaufen", re-logs in through the Keycloak form (password typed with `type`, never printed; exit 3 = re-login failed → stop, do not retry) and opens the team plan sheet `{{TEAM_NODE}}`; continue only on `READY`. `pe-ready.sh` handles a login form inside a running PEP only: exit 4 "COLD START NEEDED" (agent not answering or no PEP window, e.g. after a box restart) → stop and report that blocker (the orchestrator runs the cold start); never set `PE_COLD_START` yourself. Take a screenshot before acting; if a palette item is still armed, disarm it by clicking the palette radio ("Ganz") / pointer before clicking a cell (an armed palette paints, and turns clicks in the Stempeleditor timeline into blocks); do not send `keys {ESC}` to the main window (PEP minimised itself once).
- **Painting**: PEP repaints the previously selected cell with the newly armed Dienst on the next gesture. Use `{{SKILL_DIR}}/scripts/pep/pe-paint.sh {{TENANT}} <emp> <day> <want_pa> <radio_y> <slot_x> <slot_y> <row_y>` with `NEIGHBOURS=<the sheet's test employee ids>` and `PE_OUT=<evidence folder>` (exit 0 = painted, neighbours unchanged; 3 dialog, 4 unexpected change, 5 neighbour changed → stop, blocker with both snapshots; read the slot's tooltip from a screenshot first). It implements the manual rule: one cell per gesture, before it save a SQL snapshot of the plannings around the target (`SELECT MITARBEITER_ID||' '||TO_CHAR(DATUM,'MM-DD')||' '||PA_CODE||' #'||PLANUNG_ID FROM ECBERN.PLANUNG WHERE MITARBEITER_ID IN (<the sheet's test employees>) AND DATUM BETWEEN <target−2> AND <target+2> ORDER BY 1;`), paint, close and reopen the plan sheet, snapshot again and diff — the only allowed change is your target cell. Anything else changed → stop, do not repaint, report a blocker with both snapshots. After the step: close any Stempeleditor/dialog (Übernehmen or Abbrechen as the step requires), leave the plan sheet open, release the lock.
- While the plan sheet is open PEP holds an edit lock on the node: do the myPP writes of a scenario before or after the PEP step, never during it.

**Contract diff tools**: `python3 -I {{SKILL_DIR}}/scripts/diff-fixtures.py <dirA> <dirB> [out.md] --labels=A,B` (harness fixture folders), `python3 -I {{GROUP_DIR}}/scripts/diff-roster-cells.py baseline.json candidate.json --day YYYY-MM-DD` (api-gw roster-cell JSON, needs the service client — usually not available).

## Environment facts that are not product findings (customer-roster seed)

- The seed writes one planned-credit ZEITSUMME (`ZSTYPE A`, 8:00, on the presence Dienst) per planning. Phase 1 deleted it for the must-stamp employees (steps e and l). For **auto-stamp** employees (E3, ES) the row is legitimate: api-pp regenerates it after a block write (new ZEITSUMME id, DIENSTTYPE A→P) — note it, it is not a finding. Expected credited after a write = **the day's existing credit + what you add**; read the existing credit before the scenario (Σ GLAZ `ZEITANRECHNUNG`, `oracle-day.sh`): seed ZS 8:00, P2 auto blocks, PEP's pre-credit, or nothing.
- **P2-painted days** (repainted prepared days, absence / Pikett overpaints, replans) carry P2 preview blocks (`BLOCK.IS_ZE_PREVIEW 'T'`) next to the real blocks and no seed ZEITSUMME; their unified day `planned` = the preview span (record, never judge). Auto-stamp employees get **P2 auto blocks** + AS stamps on painted past days (111/112/113 → 9:00, 141 → 8:30): that is the day's credit — never delete an auto block, never add a block overlapping it (use it as the base block). Today / future plannings of must-stamp employees carry PEP's planned pre-credit in `ZEITANRECHNUNG` (CODEART P): a pre-1801 bundle shows 0:00 for it (KD-7).
- **Fixture identity**: identify fixture blocks / stamps by (employee, day, PA code, time window), never by id — every re-interpretation renumbers them; ids in the briefs are examples.
- **Box logs** (api-pp, api-gw) are not a dependable oracle: the Windows box has no log path you can reach. Judge an error on the HTTP status + the response body's error name / code (e.g. `AllowanceProfileNotFoundException`, `LEGACY_TIME_RECORDING_OPERATION_FAILED`); ask for a log line in `blockers` only when the body names nothing.
- The operator's machine is macOS: there is no `timeout` command — `sql.sh` / `oracle-day.sh` stop after `SQL_TIMEOUT` (300 s, exit 124); wrap any other command that may hang with `perl -e 'alarm shift; exec @ARGV' <seconds> <command…>`.
- Oracles (scenarios.md conventions, oracles.md §5): unified credited = Σ GLAZ `ZEITANRECHNUNG` = PEP Ist; unified planned = Σ `PLANUNG.SOLLZEIT` (never PEP "Soll"; the day view has no planned total — never assert the day-level planned/balance); classic credited = stamp credit + absences + unplanned/on-call (no Zeitsummen); legacy month = stamp spans, and on a stamp-less day the span of its `planned_timestamps` when that list is non-empty (only up to today+1).
- **Known defects** (scenarios.md: KD-1..KD-7, D3, the 1801-bundle table, "Bundle-aware expectations"): a mismatch that matches the entry for your scenario and `{{BUNDLE_CLASS}}` is reported as KNOWN-FAIL — verdict `FAIL`, `findings_confirmed: ["<id>"]`, `notes` starting with `KNOWN-FAIL <id> <ticket>` — never as a new finding. Examples: the Fixer Saldo correction (Zeitsumme PA −9) is not credited by the cloud (KD-1): PEP Ist − 0:30 on that day; on pre-1801 a today / future planning credited only by PEP's pre-credit shows 0:00 (KD-7); on 1801 a stamped day shows block + an equal GLAZ time credit (F1).
- Seed presence Dienste (111/112/113/141) become plannable in PEP only after Phase 1 step (j) R0 (root-node rows); before it only absences (25, 57, 60) and the Pikett definitions created in PEP (150, 151) can be painted. `env-facts.md` / `seed-log.md` say which Phase 1 steps ran.
- A definition created or changed in PEP is invisible to api-pp until gate G4b ran (no PSC triggers on the boxes, 7-day cache). Signature: api-pp 404 "Shift definition with id N not found", surfaced as unified `/days` 404/500, `available-shift-definitions` 404, block writes 500 `LEGACY_TIME_RECORDING_OPERATION_FAILED`, legacy block writes 409. If you see it: stop that scenario, mark it BLOCKED ("G4b: definition N not loaded by api-pp"), save the body, report it in `blockers` — the orchestrator runs the cache refresh; never run DML yourself.
- Clock-out within ~2 min of the clock-in triggers the backend re-stamp correction ("Stempel korrigiert", the stamp is moved): keep at least 3 minutes between the two stamps of a pair or expect the correction.
- The classic day card crashed on the first run because the seed left `HIERARCHIE.STAMM` NULL (`node.path` null); Phase 1 step (k) fixes it — if `node.path` is still null, classic writes run through the classic API.

## Hard rules

1. Never leave a past on-call day with an odd number of active stamps (a 24 h phantom Einsatz on-prem). Count with `oracle-day.sh` (`ACTIVE|`) before you stop; delete a lone stamp you added if the pair cannot be completed.
2. Only your employees and days (family brief). Never "just look" at another employee.
3. Never change tenant configuration, feature flags, PEP rights or closing dates — unless your family brief makes you the configuration owner (P, C); then restore and prove the restore.
4. Never print, persist or search for passwords, tokens or connect strings (scripts read them themselves). Never search the boxes or repositories for secrets.
5. CT DeployMate environments only. No git commands. Do not modify the skill folder or other agents' result files.
6. Record every object you create or delete in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl` (one JSON line: `{"env":"{{TENANT}}","employee":<MA_ID>,"date":"YYYY-MM-DD","kind":"timestamp|block|break|on-call|planning|config","id":…,"scenario":"W-01","cleaned":true|false,"how":"…"}`).
7. Gate failure (login impossible, 412, 500 on the first read, G4b signature): mark the scenario BLOCKED with evidence, continue with the next one, list it in `blockers`.
8. Execute each write once. If it fails, save the body and move on; no retries with variations unless the family brief asks for them.
9. Cleanup: delete what you created on the write days unless the scenario says to keep it; verify with `oracle-day.sh` (no extra BLOCK rows, active stamp count back to the start value — which may be non-zero, e.g. a standby AS pair across midnight); list what you could not clean.
10. **Fixture-day protection**: never write stamps on a planning whose window crosses midnight (Nacht 141, Pikett windows) when the next day carries fixture data (a prepared day P0..P3, the carve, the Kombi, another family's data-fix day) or another scenario's stamps — on-prem pairs a lone IN with the next morning's stamp and re-interprets that day, silently dropping fixtures (N-W-3). If your brief's day would violate it, stop that scenario and report a blocker "day map violates fixture-day protection"; if a fixture vanished anyway, report it (`blockers`) — never repair fixtures yourself.
11. **Date shift**: your relative days were computed for `{{R}}`. If the date (Europe/Zurich) is later when you are about to write: every absolute write day must still be ≥ today − 6 (oldest UI-writable day) — else skip that write, BLOCKED "write day left the window", blocker "date shift"; TODAY-scenarios and "day −n" checks use the actual date (no planning / Pikett on the actual today → BLOCKED + blocker). Note the actual date in `notes.md`. Reads may continue.
12. **Evidence is never deleted** (yours or anyone's; the safety check refuses `rm -rf` anyway): to redo a step write a new folder `<scenario-id>-v2/` (then `-v3`) and say in `notes.md` which folder counts.

## Evidence layout

`{{RUN_DIR}}/{{FAMILY}}/<scenario-id>/` — the harness outdir of each step (`api/`, `api-index.jsonl`, `harness.log`, screenshots `NN-<step>.png`), the named JSON files of the scenario (`days.json`, `timestamps-post.json`, …), `oracle-<step>.txt` (oracle-day.sh output) and a short `notes.md` (what you did, observed vs expected, anything odd). With `--compare`, the second environment's evidence goes to `{{RUN_DIR}}/{{FAMILY}}/<scenario-id>/compare/`.

## Logins (PolyID lockout risk)

Never loop over logins in the shell (no `for l in $LOGINS`, no `xargs`): zsh does not word-split an unquoted variable, so the whole list arrives as ONE malformed username. One harness call per login, with the login as a literal quoted string (`'dmseed-lhug'`). A malformed username still counts as a failed PolyID attempt for the caller IP, and PolyID locks the IP per provider without expiry (run a1801: two workers produced 5 such attempts, 401 BadCredentials).

## Screenshots of the issue (mandatory for every non-PASS)

Every scenario whose verdict is **FAIL**, a **KNOWN-FAIL** (FAIL with a known id in `findings_confirmed`) or **BLOCKED by an error response** carries at least one screenshot that shows the problem itself, listed in `shots` with a one-line caption. Reviewers look at these first; a FAIL without a shot is an incomplete report.

- **App view** (always, when the scenario has a UI): navigate to the day or month that shows the problem — after API reads, reload the day view so the wrong value / error dialog is on screen — and call `issueShot(page, out, '<what>', <locator>)` from `{{GROUP_DIR}}/scripts/harness/utr-lib.mjs`, e.g. `issueShot(page, out, 'R01-credited', page.locator('.unified-shift-card-credited-header'))`. It dismisses the welcome tour first, outlines the element in red and saves `<out>/ISSUE-<what>.png`.
  - `<what>`: a literal name without the `ISSUE-` prefix (the helper adds it); it throws on an empty name or one with an `undefined` part (`${id}-x` with id unset).
  - `<locator>` = the element that carries the **WRONG value**: the day total / month row cell with the wrong number, the missing row's container, the wrong button, the error dialog — not the whole page, not a neighbouring list that happens to be right.
  - When two parts make the error (e.g. the wrong total AND the duplicated time credit), take two shots (`…-total`, `…-credit`) or one `{ fullPage: true }` shot with both outlined.
  - Open every PNG (Read tool) before listing it: it must show the problem; a tour, a spinner or a login page → fix and shoot again.
- **API-only problem** (500, error envelope, wrong field the UI does not show): `jsonShot(page, out, '<what>', {request, status, expected, excerpt})` renders the request line, status, the expected value and a SHORT excerpt (the wrong field or the error name, never a whole response, never tokens or headers).
- **Oracle side** when PEP is the oracle and your family already holds the PEP lock for that step: `scripts/pep.sh {{TENANT}} --out <out>/ISSUE-<what>-pep.png screenshot` of the Stempeleditor / roster showing PEP's value. Never take the PEP lock only for a screenshot; then caption the app shot with the PEP value instead.
- Captions say what is wrong in one line with both numbers: `"Day card credited 18:00, PEP Ist 9:00 (F1)"`. No personal data beyond the seeded test employees' role (E1 …) and ids.
- Shots stay in the scenario's evidence folder; paths in `shots` are relative to `{{RUN_DIR}}` like `evidence`. The orchestrator uploads them to the dashboard.

## Compare overlay (only when `{{COMPARE_TENANT}}` is not `none`)

After the environment under test is complete, repeat the same steps on `{{COMPARE_TENANT}}` with the same roles (ids may differ: take them from `employees.md`), the same days and times, into `…/compare/`. Fill `compare` and a one-line `diff` per scenario (what differs semantically, e.g. "candidate lists an extra GLAZ 9:07 time credit → credited doubled"). `diff-fixtures.py --labels=…` compares two harness folders. The verdict stays the one of `{{TENANT}}`.

## Report (your final answer = exactly this JSON, nothing after it)

```json
{
  "family": "{{FAMILY}}",
  "agent": "{{AGENT_NAME}}",
  "tenant": "{{TENANT}}",
  "scenarios": [
    {
      "id": "R-01",
      "verdict": "PASS|FAIL|BLOCKED (PENDING: family C part 1 only)",
      "observed": "credited 9:07, one shift card, stamps 06:58/16:05 + auto pause",
      "expected": "credited 9:07 (PEP Ist-Zeit Tag P0)",
      "oracle": "PEP Ist 9:07; DB: 2 MS + 2 AS stamps, 1 block",
      "evidence": ["R/R-01/01-day.png", "R/R-01/api/003-GET-api_mobile_unified-time-recording_v1_days....json"],
      "shots": [
        {
          "path": "R/R-01/ISSUE-R01-credited.png",
          "caption": "Day card credited 18:14, PEP Ist 9:07 (F1)",
          "kind": "app"
        }
      ],
      "findings_confirmed": ["F1"],
      "new_findings": [{ "id": "N-R-1", "text": "…", "evidence": ["R/R-01/notes.md"] }],
      "compare": null,
      "diff": "none",
      "notes": "short"
    }
  ],
  "created_data": [
    { "env": "{{TENANT}}", "employee": 480, "date": "2026-10-12", "kind": "timestamp", "id": 537, "cleaned": true }
  ],
  "blockers": []
}
```

`compare` = `{"tenant": "{{COMPARE_TENANT}}", "verdict": "...", "observed": "...", "evidence": [...]}` with `--compare`, else `null`; `diff` = one line or `"none"`. Evidence paths are relative to `{{RUN_DIR}}`. `shots` (`kind` = `app` | `api` | `pep`): required, non-empty, for every FAIL / KNOWN-FAIL / BLOCKED-by-error scenario (section "Screenshots of the issue"); `[]` for PASS. Finding ids: the F-ids of scenarios.md (F1 attribution lost → double count, F2 unknown enum literal → 500, F3 classic NPE, F4 planned follows counted, …) and the N-ids of earlier runs named in your family brief; a new finding gets `N-{{FAMILY}}-<n>`.
