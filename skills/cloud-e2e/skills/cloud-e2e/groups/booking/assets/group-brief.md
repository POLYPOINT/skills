# Group brief — booking

Runner notes (the part above the `---` line is not needed by workers): fill `{{GROUP_BRIEF}}` with the part below. Values come from `employees.md` / `day-tokens.md` (R1/R2), `kits/<env>` and `stage/run-partner`. Window families X10 / X25 part 2 are launched only when their window doc is `active`.

---

## Group booking — what every worker of this group needs

You test availabilities, Find HP, BADI, resource replacement (RR) and internal pool opportunities (IPO) on DeployMate env **`{{TENANT}}`** (role {{ENV_ROLE}}, shared with swap, partner, hp, ts). The tenant runs in **cloud-write mode** (`writeShiftsOnPrem`, `writeResourceReplacementShiftsToPep` ON): bookings, RR and IPO selections write PEP plannings at once.

### Actors (claimed by this group; use no other person)

| Token          | Login (MITARBEITER_ID)                                                                   | Role                                                     |
| -------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| SP             | `{{SP_LOGIN}}` ({{SP_ID}})                                                               | shift planner (kit `E2E:SP-ALL`), lanes AV reads, FH, BD |
| SP2            | `{{SP2_LOGIN}}` ({{SP2_ID}})                                                             | shift planner (kit `E2E:SP-ALL`), lane RR / IP           |
| PM             | `{{PM_LOGIN}}` ({{PM_ID}})                                                               | pool manager (kit `E2E:PM-ALL`)                          |
| HPA, HPB, HPC  | `{{HPA_LOGIN}}` ({{HPA_ID}}), `{{HPB_LOGIN}}` ({{HPB_ID}}), `{{HPC_LOGIN}}` ({{HPC_ID}}) | availability HPs (pool A)                                |
| HPD            | `{{HPD_LOGIN}}` ({{HPD_ID}})                                                             | Find HP bookings (pool A)                                |
| HPE, HPF       | `{{HPE_LOGIN}}` ({{HPE_ID}}), `{{HPF_LOGIN}}` ({{HPF_ID}})                               | BADI (pool A; HPE also pool B)                           |
| HPG, HPH       | `{{HPG_LOGIN}}` ({{HPG_ID}}), `{{HPH_LOGIN}}` ({{HPH_ID}})                               | RR candidates, IPO pool members                          |
| ER             | `{{ER_LOGIN}}` ({{ER_ID}})                                                               | replaced employee of the RRs                             |
| HPN            | `{{HPN_LOGIN}}` ({{HPN_ID}})                                                             | HP in no pool                                            |
| HPM (optional) | `{{HPM_LOGIN}}` ({{HPM_ID}})                                                             | HP with two employments (only if P7 ran)                 |

Pools: `E2E-BKG-A` = `{{POOL_A}}`, `E2E-BKG-B` = `{{POOL_B}}`, `E2E-BKG-IPO` = `{{POOL_IPO}}`. Planblatt Pflege Medizin = `{{GROUP_NAME}}` (node `{{GROUP_NODE}}`). Absence for RR = `{{ABS_DEF}}`, day Dienst = `{{DAY_DEF}}`, night = `{{NIGHT_DEF}}`. Every seed login is a planner over all nodes: lists show other groups' people and pools — assert by **your** ids, always select the E2E-BKG pools.

### Apps and harness

- myPP `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app`; planner web app and BADI `https://ct-poma-webapp.dev.k8s.polypoint-dev.com` (`/shift-planner/…`, `/pool-manager/…`, `/badi`); poma-api `https://ct-poma-api.dev.k8s.polypoint-dev.com`.
- One harness call per actor step:
  ```
  cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}} \
    node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app mypp          # HPs
    node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <SP|SP2|PM login> <script.mjs|-> <outdir> --app poma  # planners
  ```
  BADI direct URL: `api.goto('/badi?group-node-id={{GROUP_NODE}}&range-start=<Monday>&cell-width=60&number-of-cells-displayed=14&employee-column-width=220')`. Exact flags (`--console info`, `--downloads`): `{{SKILL_DIR}}/references/harness.md`.
- Scripts: `{{RUN_DIR}}/scripts/{{FAMILY}}-<scenario>-<actor>.mjs`, contract `export default async ({page, ctx, api, shot, log, out, env, login}) => {...}`. Helpers: `import { act, alertText, dialogText, stepper, issueShot, jsonShot, waitFlag, byId } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'` (`dialogText` reads the planner app's Material dialogs / snackbars) and `import { HP, PRIV, createAvailability, createSeries, editSeries, deleteAvailability, deleteIteration, dayView, rosterRange, availabilityDates, ncRows, findHp, assignments, cancelAssignment, opportunity, cancelOpportunity, rrBodyFrom, createRR, createIPO, oppIdFromUrl } from '{{GROUP_DIR}}/scripts/booking-lib.mjs'`.
- Create through the UI when the scenario is about that UI; set-up steps ("step 0") may use the API helpers. Capture every write with `act()` (request + response).

### Oracles (never "looks fine")

| What                          | How                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| PEP plannings                 | `{{SKILL_DIR}}/scripts/plan-day.sh {{TENANT}} <MITARBEITER_ID> <YYYY-MM-DD>` → PLANUNG rows (PA code, position, id); before and after every booking / cancel / selection: `oracle-pl-<who>-<day>-<before | after>.txt` |
| On-prem availability (api-pp) | `{{SKILL_DIR}}/scripts/api-pp.sh {{TENANT}} avail <MITARBEITER_ID> <from> <to>` → `oracle-avail-<who>.json` (dates ≤ today + 3 months only)                                                              |
| myPP state                    | `dayView(api, day)` (`availabilities[]`, bookings), `availabilityDates(api, from, to)`                                                                                                                   |
| Planner state                 | captured `consumable-pools/availabilities` (Find HP), `assignments` (bookings, status), `opportunity(api, id)` (RR / IPO state, applications)                                                            |
| Notification centre           | `ncRows(api, {objectId, sinceIso, typeRe})` as the recipient; per-event table in `{{GROUP_DIR}}/references/scenarios.md` "Notification oracle per event"                                                 |
| Partner channel               | steward's run partner `{{PARTNER_NAME}}` (id `{{PARTNER_ID}}`), read only, family NT                                                                                                                     |

### Selectors and texts

Stable ids: planner `#find-hp-btn`, `#search-clear-filters`, `#shift-definition-type-field`, `#manage-bookings-date-filter`, `#manage-bookings-pool-filter`, `#manage-bookings-shift-type-filter`, `#manage-bookings-sort-by`, `#shift-booking-clear-filter`, `#absence-type-field`, `#comment-text-area-field`, `#filter-services`, `#sorting-criteria-field`, `#opportunity-select-hp-display`; myPP `#header-title`, `#primaryButton` / `#secondaryButton`. Otherwise the visible German texts quoted in the briefs ("Verfügbarkeit erfassen", "Verfügbarkeit senden", "Buchen", "Bestätigen", "Zusagen", "Ja, aber", "Anfrage annullieren", "Erinnerung senden"). Locale de-CH.

### Logins

Own profile folder per worker. **Group exception to common hard rule 5** (planner logins only): SP may be driven by two workers at once (family AV and family FH or BD), each in its own profile and only on its own HPs' availabilities and assignments (by id); every HP, ER and PM is driven by one worker at a time. ≤ 2 password submissions per login per harness call; a failed login → retry once, then BLOCKED `PolyID lockout (USER_OR_IP_LOCKED) <login>` with the screenshot. Never unlock PolyID yourself.

### PEP and paints

`pp-plan.sh {{TENANT}} <MITARBEITER_ID> <YYYY-MM-DD> <PA code> FULL|DELETE` (api-pp direct planning) for the paint of BKG-26 and any restore; PEP UI only as fallback: db lock `{{PEP_LOCK_DOC}}` first (create-if-absent, renew ≤ 10 min, delete with its pinned version; taken → poll 60 s, max 30 min, then BLOCKED), `scripts/pep/pe-ready.sh`, `scripts/pep/pe-paint.sh`, release.

### Windows and jobs

Your family's windows: {{WINDOWS}}. Read `windows/{{ENV}}~<id>` on the dashboard database ({{DASHBOARD_URL}}) before a window step: continue only while `active` for group booking. A window of another family that starts `draining` / `active` and pauses yours: finish the current scenario, start no new scenario and report the remaining ones BLOCKED "paused by window <id>" (common part "Multi-group run"; the runner relaunches them). Window families set their flags with `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "flag set {{TENANT}} <code> <value>" <outdir>` (usage: harness.md), restore by **setting the baseline value back** (never delete the override) and save `restore-proof.json` (flag read + fresh `config/features` via `waitFlag`). Jobs only inside J-X-JOBS and only `portal-ops.mjs … "job run poma-core AvailabilityConflictChecker --tenant {{TENANT}}"`.

### Evidence and report

- `{{RUN_DIR}}/{{FAMILY}}/<scenario>/`: `NN-<step>.png`, `<endpoint>.json`, `oracle-*.txt|json`, `nc-<who>.json`, `notes.md`; created objects (availability, assignment, opportunity, pool ids) one JSON line each in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl`.
- Every FAIL / KNOWN-FAIL / BLOCKED-by-error row carries an outlined issue screenshot (`issueShot`, or `jsonShot` for API-only results).
- KNOWN-FAIL only with a matching signature of `{{GROUP_DIR}}/references/known-deviations.md`; new findings `N-BOOKING-<n>`.
- NC and partner assertions filter by object id and `created_date` ≥ the scenario start (other planners' notifications exist).

### Never

- Never touch people, days or objects of another group (swap T* / U*, partner PH* / SPX, hp N*, ts N4*), other tenants, or pools other than E2E-BKG-*.
- Never call any test-data endpoint (paths with `/test/`), GAT endpoints, or a POMA job without `tenantIds` / outside J-X-JOBS; never press a cache reset.
- Never change a flag outside your own active window; never edit, save or toggle the run partner.
- No DML; paints only through `pp-plan.sh` / PEP on your own cells.
- Never print, copy or save credentials, tokens or connect strings.
- **Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
