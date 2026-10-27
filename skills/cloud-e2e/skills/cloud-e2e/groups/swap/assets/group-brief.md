# Group brief — swap

Runner notes (the part above the `---` line is not needed by workers): fill `{{GROUP_BRIEF}}` with the part below. Values come from `swap-allocation.md` (S1/S8), `kits/<env>` and `stage/run-partner`. A worker of a window family (X03, X07, X14) is launched only when its window doc is `active`.

---

## Group swap — what every worker of this group needs

You test the myPOLYPOINT **shift swap** on DeployMate env **`{{TENANT}}`** (role {{ENV_ROLE}}, shared with the groups booking, partner, hp and ts). Your family brief below names your scenarios, actors and days; this part gives the facts they share.

### Actors (claimed by this group; use no other person)

| Token  | Login (MITARBEITER_ID)                                                                                                                                                                                                         | Role                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| T1..T8 | `{{T1_LOGIN}}` ({{T1_ID}}), `{{T2_LOGIN}}` ({{T2_ID}}), `{{T3_LOGIN}}` ({{T3_ID}}), `{{T4_LOGIN}}` ({{T4_ID}}), `{{T5_LOGIN}}` ({{T5_ID}}), `{{T6_LOGIN}}` ({{T6_ID}}), `{{T7_LOGIN}}` ({{T7_ID}}), `{{T8_LOGIN}}` ({{T8_ID}}) | HPs of team T, plan sheet `{{T_NODE}}`, one personnel category                              |
| T9     | `{{T9_LOGIN}}` ({{T9_ID}})                                                                                                                                                                                                     | team T, other personnel category                                                            |
| T10    | `{{T10_LOGIN}}` ({{T10_ID}})                                                                                                                                                                                                   | HPX: kit group `E2E:HP-NOSWAP`, no right "Diensttausch einreichen"                          |
| U1..U4 | `{{U1_LOGIN}}` ({{U1_ID}}), `{{U2_LOGIN}}` ({{U2_ID}}), `{{U3_LOGIN}}` ({{U3_ID}}), `{{U4_LOGIN}}` ({{U4_ID}})                                                                                                                 | HPs of team U, plan sheet `{{U_NODE}}`                                                      |
| SP     | `{{SP_LOGIN}}` ({{SP_ID}})                                                                                                                                                                                                     | shift planner (kit group `E2E:SP-ALL`: 1050, 1061, 1070 on all nodes), planner web app only |

Definitions: 111 Früh, 112 Spät, 113 Mittel (swappable, splittable), 141 Nacht (not swappable), `{{ABS_DEF}}` = the swappable absence, `{{PIKETT_DEF}}` = on-call Dienst of team U (`none` = not available), `{{DEF_D}}` = fourth swappable presence (`none` = not available). The real cells per (person, day) and their PLANUNG ids are in `{{RUN_DIR}}/swap-allocation.md` (identify a planning by person, day, PA code and position — ids change on every repaint).

### Apps and harness

- myPP web: `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app`; planner web app: `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/shift-planner/...`; poma-api `https://ct-poma-api.dev.k8s.polypoint-dev.com`.
- One harness call per actor step:
  ```
  cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}} \
    node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app mypp     # HPs
    node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} {{SP_LOGIN}} <script.mjs|-> <outdir> --app poma  # SP
  ```
  In-app mobile path (SWP-35 only): `mypp-inapp.mjs` with the same arguments. Exact flags: `{{SKILL_DIR}}/references/harness.md`.
- Scripts: `{{RUN_DIR}}/scripts/{{FAMILY}}-<scenario>-<actor>.mjs`, contract `export default async ({page, ctx, api, shot, log, out, env, login}) => {...}`. Helpers: `import { act, alertText, stepper, issueShot, jsonShot, ncSince, byId } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'` and the swap API helpers `import { HP, SPT, plannedShifts, pickShift, shiftDetail, candidates, candidateOf, createSwap, openTrades, openTrade, cancelledTrades, answer, submit, cancelSwap, locks, requestIdOf, spList, spRow, spDecide, spApply, swapNotifications } from '{{GROUP_DIR}}/scripts/swap-lib.mjs'`.
- **Shortcut creation** (every scenario that is not about the creation UI): as the owner, `ps = await pickShift(api, day, {position, def})`, `detail = await shiftDetail(api, ps)`, `c = await candidates(api, ps)`, `chosen = [candidateOf(c.list, <candidate MITARBEITER_ID>)]`, `res = await createSwap(api, {detail, chosen})` → `res.oppId`. A candidate missing from `c.list` is itself a result: save `candidates.json` and stop that scenario (BLOCKED-data or FAIL per its brief), never pick someone else.
- Answers / submit / cancel through the UI when the scenario is about that UI; otherwise `answer()`, `submit()` (request id from `openTrade()` + `requestIdOf()`), `cancelSwap()`.

### Oracles (never "looks fine")

| What             | How                                                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| PEP plannings    | `{{SKILL_DIR}}/scripts/plan-day.sh {{TENANT}} <MITARBEITER_ID> <YYYY-MM-DD>` → PLANUNG rows with `PA_CODE`, `DIENSTPOSITION` (GANZ/LINKS/RECHTS), `DIENSTTEIL`, `PLANUNG_ID`; save as `oracle-<who>-<day>-<before                      | after>.txt` |
| Cloud swap state | owner `openTrade(api, oppId)` (`opportunity.state`, `shift_trade_requests[].status`, applications); `cancelledTrades(api)`; SP `spRow(api, oppId, {state})` — always by **your** opportunity id (the SP sees every swap of the tenant) |
| Locks            | `locks(api, day)` as that user → `{day: is_locked}`                                                                                                                                                                                    |
| Notifications    | `swapNotifications(api, oppId, sinceIso)` as the recipient (rows of your opportunity created after the step); `nodeBasedApprovers` is ON, so every holder of 1070 gets SUBMISSION rows: filter by id + time, never count all rows      |

### Selectors and texts

Use the selector list of `{{GROUP_DIR}}/references/scenarios.md` "Conventions" (footer `#primaryButton` / `#secondaryButton` / `#backButton`; "Diensttausch"; stepper "Wunsch", "Vorschläge", "Angebot", "Auswahl", "Übersicht"; "Tausch löschen"; SP `#shift-swap-request-accept-button`, `#shift-swap-request-cancel-button`, `#shift-swap-request-close-button`). Locale de-CH.

### Logins

- Each worker uses its own profile folder (`MYPP_PROFILES` above). **Group exception to common hard rule 5** (group design: three lanes on disjoint (person, day) cells, `data-plan.md` §2.3, enforced by `gen-prompts.py`, which refuses concurrent families that write the same (person, day); locks are per user and day): a T / U login may be driven by two workers of this group at the same time, but only on **different days** and only for the cells your family owns; SP acts only on your own opportunity ids. Never two harness calls for the same login inside your own worker at once; never a person of another group.
- At most 2 password submissions per login per harness call; a failed login → retry once, then BLOCKED `PolyID lockout (USER_OR_IP_LOCKED) <login>` with the login-failed screenshot. Never unlock PolyID yourself (steward only).

### PEP and paints

- Prefer `{{SKILL_DIR}}/scripts/pp-plan.sh {{TENANT}} <MITARBEITER_ID> <YYYY-MM-DD> <PA code> FULL|LEFT|RIGHT|DELETE` (api-pp `direct-shift-planning`, no PEP desktop). After every write: `plan-day.sh` and compare with what you wanted.
- PEP UI only when the brief says so or `pp-plan.sh` is marked unverified in `kits/{{ENV}}`: take the db lock `{{PEP_LOCK_DOC}}` first (create-if-absent, renew every ≤ 10 min, delete with its pinned version afterwards; lock taken → poll 60 s, max 30 min, then BLOCKED), run `scripts/pep/pe-ready.sh {{TENANT}}`, paint one cell with `scripts/pep/pe-paint.sh`, release. Half cells cannot be painted in the PEP UI by the toolchain today.

### Windows

Your family's windows: {{WINDOWS}}. Before a step that needs a window, read `windows/{{ENV}}~<id>` on the dashboard database ({{DASHBOARD_URL}}): continue only while it is `active` for group swap. A window of another family that starts `draining` / `active` and pauses yours: finish the current scenario, start no new scenario and report the remaining ones BLOCKED "paused by window <id>" (common part "Multi-group run"; the runner relaunches them). Families X03 / X07 / X14 change the flag themselves, restore it and save the restore proof (fresh `config/features` read + `portal-ops.mjs … flag read`) as the last step; the runner releases the window.

### Evidence and report

- Folder `{{RUN_DIR}}/{{FAMILY}}/<scenario>/`: `NN-<step>-<actor>.png`, `<endpoint>.json`, `oracle-*.txt`, `notes.md`; created objects (opportunity ids, repaints) one JSON line each in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl`.
- Every FAIL / KNOWN-FAIL / BLOCKED-by-error row has an outlined issue screenshot (`issueShot` on the wrong element, or `jsonShot` for API-only results).
- KNOWN-FAIL only with a matching signature of `{{GROUP_DIR}}/references/known-deviations.md` (SW-K1..SW-K7); new findings `N-SWAP-<n>`.
- End every scenario with no OPEN / SUBMITTED swap of your own (owner `cancelSwap` or SP reject) and list approved swaps / repaints in `created_data`.

### Never

- Never touch people, days or objects of another group (booking HPA..HPH / ER / HPN, partner PH* / SPX, hp N*, ts N4\*), never another tenant.
- Never call any test-data endpoint (paths with `/test/`), GAT `clean` or GAT `shift-trades`; never run a POMA job; never press a cache reset.
- Never change a tenant flag outside your own active window; never edit, save or toggle the run partner `{{PARTNER_NAME}}`.
- No DML except through `pp-plan.sh` on your own cells; never change definitions, palettes or rights (steward kits).
- Never print, copy or save credentials, tokens or connect strings; the scripts read them.
- **Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
