# Group brief — planner

Runner notes (the part above the `---` line is not needed by workers): fill `{{GROUP_BRIEF}}` with the part below. Values come from `employees.md` / `day-tokens.md` (R1/R2), the seed log (pool ids, own Dienste) and `kits/<env>`. PSP-21 runs only inside W-Y-SOLLPLAN after utr finished.

---

## Group planner — what every worker of this group needs

You test the POMA **planner web app** (pool manager, shift planner, tenant admin) and the PEP settings it reflects on DeployMate env **`{{TENANT}}`** (role {{ENV_ROLE}}, shared with utr, auth, ops). UTR owns Pflege Chirurgie and Paediatrie on this env, auth owns Geriatrie / Notfall / IPS: never touch their people.

### Actors (claimed by this group)

| Token                    | Login (MITARBEITER_ID)                                                                                                                                                                                           | Role                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| PLANALL                  | `{{PLANALL_LOGIN}}` ({{PLANALL_ID}})                                                                                                                                                                             | pool manager + shift planner on all nodes (kit `E2E:PLANALL`)                                         |
| SPA                      | `{{SPA_LOGIN}}` ({{SPA_ID}})                                                                                                                                                                                     | shift planner on G-A only (kit `E2E:SP-GA`, not in `DMSEED:Planner`)                                  |
| PMA                      | `{{PMA_LOGIN}}` ({{PMA_ID}})                                                                                                                                                                                     | pool manager on G-A only (kit `E2E:PM-GA`, not in `DMSEED:Planner`)                                   |
| TA                       | `{{TA_LOGIN}}` ({{TA_ID}})                                                                                                                                                                                       | tenant admin (steward kit actor; auth and ops borrow it read-only — never change its rights or state) |
| SEEDSP                   | `{{SEEDSP_LOGIN}}` ({{SEEDSP_ID}})                                                                                                                                                                               | untouched seed login                                                                                  |
| HP1..HP4, HP7..HP9 (G-A) | `{{HP1_LOGIN}}` ({{HP1_ID}}), `{{HP2_LOGIN}}` ({{HP2_ID}}), `{{HP3_LOGIN}}` ({{HP3_ID}}), `{{HP4_LOGIN}}` ({{HP4_ID}}), `{{HP7_LOGIN}}` ({{HP7_ID}}), `{{HP8_LOGIN}}` ({{HP8_ID}}), `{{HP9_LOGIN}}` ({{HP9_ID}}) | health professionals                                                                                  |
| HP5, HP6 (G-B)           | `{{HP5_LOGIN}}` ({{HP5_ID}}), `{{HP6_LOGIN}}` ({{HP6_ID}})                                                                                                                                                       | health professionals                                                                                  |

Nodes: G-A `{{GA_NAME}}` (`{{GA_NODE}}`), Station of P-A `{{GA_STATION}}`; G-B `{{GB_NODE}}`, Station of P-B `{{GB_STATION}}`. Pools: P-A `{{POOL_PA}}`, P-B `{{POOL_PB}}`, `PSP-LIST-01..11`. Dienste: EARLY `{{DEF_EARLY}}`, NIGHT `{{DEF_NIGHT}}` (kit); own `PSP-IP-JA` `{{DEF_IP_JA}}`, `PSP-IP-NEIN` `{{DEF_IP_NEIN}}`, `PSP-IMMER` `{{DEF_IMMER}}`, `PSP-WUNSCH-JA` `{{DEF_WUNSCH_JA}}`, `PSP-WUNSCH-NODE-NEIN` `{{DEF_WUNSCH_NEIN}}`. Line `{{BUNDLE_LINE}}`. Month M1 = `{{M1}}`.

### Apps and harness

- Planner web app `https://ct-poma-webapp.dev.k8s.polypoint-dev.com` (`/pool-manager/…`, `/shift-planner/…`, `/tenant-admin/…`; landing order PM → SP → TA → HP; `result.json` `landing` of a `--app poma` call is the landing oracle); myPP `…/health-professional-app`; poma-api `https://ct-poma-api.dev.k8s.polypoint-dev.com`.
- One harness call per actor step:
  ```
  cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}} \
    node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app poma    # planners, TA
    node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app mypp    # HPs
  ```
  `--downloads` for the CSV of PSP-08; viewport per scenario in the script (`page.setViewportSize`). Exact flags: `{{SKILL_DIR}}/references/harness.md`.
- Scripts `{{RUN_DIR}}/scripts/{{FAMILY}}-<scenario>-<actor>.mjs`, contract `export default async ({page, ctx, api, shot, log, out, env, login}) => {...}`; helpers `import { act, alertText, dialogText, stepper, issueShot, jsonShot, roles, ncSince, byId } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'` (`dialogText` reads Material dialogs / snackbars). `roles(api)` returns the role names of the captured bearer (never save the token).

### Oracles

| What             | How                                                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Back-end answers | the captured `/api/private/...` and `/api/mobile/health-professional/v1/...` responses named in the brief                                                                                                                                                              |
| DB               | `{{SKILL_DIR}}/scripts/sql.sh {{TENANT}} -f {{GROUP_DIR}}/scripts/planner-checks.sql -D login=<login> -D ga_node={{GA_NODE}}` (node selection, subtree, own Dienste flags, palette); `{{SKILL_DIR}}/scripts/plan-day.sh {{TENANT}} <MITARBEITER_ID> <day>` (plannings) |
| Notifications    | `ncSince(api, sinceIso, {type, objectId})` as the HP                                                                                                                                                                                                                   |

### PEP, paints, jobs

- Paints: `{{SKILL_DIR}}/scripts/pp-plan.sh {{TENANT}} <MITARBEITER_ID> <YYYY-MM-DD> <PA code> FULL|DELETE` on your own cells; PEP UI (pep-verify) only for steps without an API path (employment end, Sollplan option, accepting a wish) — db lock `{{PEP_LOCK_DOC}}` first (create-if-absent, renew ≤ 10 min, delete with its pinned version; taken → poll 60 s, max 30 min, then BLOCKED), `scripts/pep/pe-ready.sh {{TENANT}}`, screenshots before and after every PEP action, release. UTR is the heaviest PEP user on this env: keep holds short.
- Jobs only inside J-Y-JOBS: `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "job run poma-core <JobName> --tenant {{TENANT}}" <outdir>` (usage: harness.md). Never a job without `--tenant`.

### Windows

Your family's windows: {{WINDOWS}}. Before a window step read `windows/{{ENV}}~<id>` on the dashboard database ({{DASHBOARD_URL}}); continue only while `active` for group planner (poll 60 s, max 30 min, then BLOCKED "window not granted" for that scenario). A window of another family that starts `draining` / `active` and pauses yours: finish the current scenario, start no new scenario and report the remaining ones BLOCKED "paused by window <id>" (common part "Multi-group run"; the runner relaunches them).

### Logins

Own profile folder per worker. **Group exception to common hard rule 5** (planner logins only): PLANALL, SPA, PMA and TA may be driven by two workers at once in separate profiles (each acts on its scenario's own objects, by id); every HP by one worker at a time. The (person, day) cells the families write (rules.json `WRITES`) are checked by `gen-prompts.py`, which refuses two concurrent families on the same cell. ≤ 2 password submissions per login per harness call; a failed login → retry once, then BLOCKED `PolyID lockout (USER_OR_IP_LOCKED) <login>` with the screenshot. Never unlock PolyID yourself.

### Evidence and report

- `{{RUN_DIR}}/{{FAMILY}}/<scenario>/` (`NN-<step>.png`, `<endpoint>.json`, `oracle-*.txt`, `roles-<actor>.json`, `notes.md`); created objects (pool ids, bookings, opportunities, wishes, paints) one JSON line each in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl`.
- Every FAIL / KNOWN-FAIL / BLOCKED-by-error row carries an outlined issue screenshot (`issueShot`, or `jsonShot` for API-only results).
- KNOWN-FAIL only with a matching signature of `{{GROUP_DIR}}/references/known-deviations.md`; new findings `N-PLANNER-<n>`.
- Lists show other groups' objects (all-node planners): assert by your ids, never by counts.

### Never

- Never touch utr's Stationen (Pflege Chirurgie, Paediatrie) or auth's people, other tenants, seed Dienste (never flip a flag on 111–141), `DMSEED:Planner` role rows, TA's rights.
- Never call any test-data endpoint (paths with `/test/`), GAT `clean` or GAT `shift-trades` (GAT `resource-replacements` / `opportunity-with-internal-pools` only as SPA in seed F8); never "Disable" the conflict checker in POMA ops; never press a cache reset.
- Never change the PEP Sollplan option or the conflict-checker rule outside their windows.
- Never print, copy or save credentials, tokens or connect strings.
- **Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
