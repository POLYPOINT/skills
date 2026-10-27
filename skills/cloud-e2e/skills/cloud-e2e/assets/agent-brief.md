# Worker brief — generic part (every group)

**For the runner (this part above the `---` line is not sent).** A worker's prompt = generated header + the part of this file below the `---` line (its `{{GROUP_BRIEF}}` slot filled with `groups/<key>/assets/group-brief.md`) + `groups/<key>/assets/family-briefs/<F>.md`, every placeholder filled by `python3 -I scripts/gen-prompts.py results/<run>/<group>/run-config.json --group <key> [--solo] [--claims claims.json]`. Launch with the Agent tool: `subagent_type: "general-purpose"`, `model: "sonnet"` (`"opus"` only with `--worker-model opus`), description `<GROUP> E2E family <F>`. Never paste credentials, tokens or connect strings into a prompt: the scripts read them from disk. Check that no `{{` is left before launching (the generator refuses it anyway).

Layouts:

- **slot** (default): this generic brief + the group brief in the slot. A group brief holds only what is specific to its group: actors, URLs, oracles, selectors, evidence naming, never-do list (skill-design.md 4.3).
- **standalone**: a group brief that carries `<!-- BRIEF LAYOUT: standalone` replaces this brief (group `utr`: its v0.5.0 brief, unchanged). Outside `--solo` the engine appends the generic "Hard rules" section and the "Multi-group run" addendum below (between its markers) to it.
- A group brief may keep runner notes above a `<!-- BEGIN WORKER BRIEF -->` line or, without that marker, above its first `---` line; only the text after it is sent (a group brief without runner notes has no `---` line).

| Placeholder                                   | Meaning                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `{{RUN}}` / `{{RUN_DIR}}`                     | run name / this group's results folder (`results/<run>/<group>`; `results/<run>` in solo mode)                                  |
| `{{SKILL_DIR}}` / `{{GROUP_DIR}}`             | absolute path of the cloud-e2e skill folder / of `groups/<key>`                                                                 |
| `{{GROUP}}` / `{{GROUP_TITLE}}`               | group key / title from `group.json`                                                                                             |
| `{{FAMILY}}` / `{{AGENT_NAME}}`               | family id / `worker-<F>`                                                                                                        |
| `{{TENANT}}` = `{{ENV}}` / `{{ENV_ROLE}}`     | DeployMate env id (= CT tenant id) of the environment under test / X or Y (`references/env-plan.md`)                            |
| `{{RUNNER}}` / `{{DASHBOARD_URL}}`            | runner name (`runners/<name>`) / the run dashboard artifact (coordination store)                                                |
| `{{PEP_LOCK_DOC}}` / `{{PEP_LOCK_STEPS}}`     | the env's PEP lock and its acquire / renew / release steps for the run's coordination mode (`references/coordination.md` §3)    |
| `{{WINDOWS}}`                                 | the windows of this env that pause this family, that it runs inside or that exempt it (`group.json` windows, merged by id)      |
| `{{COORD_MODE}}`                              | `artifact-db` (default), `gcs`, `degraded`, `local-file`                                                                        |
| `{{BUNDLE}}` / `{{BUNDLE_CLASS}}`             | pp-services build of the run / bundle class (`pre-1801`, `1801`)                                                                |
| `{{R}}`, `{{TODAY}}`, `{{MONTH}}`, day tokens | run date and the group's `DAY_TOKENS` (rules.json), from the run config; `{{<ROLE>_<TOKEN>}}` = per-employee day of this family |
| `{{<ROLE>_LOGIN}}` / `{{<ROLE>_ID}}`          | login (`dmseed-<kuerzel>`, ASCII) / MITARBEITER_ID of a claimed actor (rules `ROLES`)                                           |
| group tokens                                  | `rules.json` `PLACEHOLDERS` (e.g. `{{PARTNER_ID}}`, `{{GLN}}`), values from `config` of the run config                          |

---

You are running part of the cloud end-to-end test run **{{RUN}}**, group **{{GROUP}}** ({{GROUP_TITLE}}). You own family **{{FAMILY}}** and nothing else: execute the scenarios of your family brief, in its order, on **the environment under test `{{TENANT}}`**, and report in the JSON schema at the end. Do not improvise scenarios, do not touch actors, days, pools or objects your brief does not name, do not change tenant configuration unless your family brief makes you the owner of a window.

## Verdict boundary

Per scenario: **PASS** = observed equals the expected value and the oracle; **FAIL** = a mismatch, with evidence; **BLOCKED** = could not be executed or evaluated (gate failure, missing data prerequisite, paused by a window, build without the feature, a refused command) — a verdict, not a failure of yours. Oracles in the order the family brief names them (DB rows through `sql.sh`, api-pp / api-gw reads, notification-center rows, PEP reads), then the expectation in `{{GROUP_DIR}}/references/scenarios.md`.
Bundle under test: **`{{BUNDLE}}`, class `{{BUNDLE_CLASS}}`**. Before calling a mismatch new, look it up in `{{GROUP_DIR}}/references/known-deviations.md`: a matching signature is **KNOWN-FAIL <id>** (verdict `FAIL`, `findings_confirmed: ["<id>"]`, notes start with `KNOWN-FAIL <id> <ticket>`); a different signature, or a FAIL where the table says PASS, is new (`N-{{FAMILY}}-<n>`; the runner renumbers it). A listed deviation that does not show → PASS with "<id> not reproduced" in notes.

## Read first

1. Your family brief (below this common part).
2. The group part right below.
3. `{{GROUP_DIR}}/references/scenarios.md` — only the sections of your scenario ids — and `{{GROUP_DIR}}/references/known-deviations.md`.
4. `{{RUN_DIR}}/env-facts.md`, `{{RUN_DIR}}/claims.json` (your actors) and what your family brief names.

## Group part

{{GROUP_BRIEF}}

## Tooling (all installed — do not rebuild, do not install)

CLI contracts: `{{SKILL_DIR}}/references/harness.md`; usage lines in each script header.

- **Browser harness**: `node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app mypp|poma|customer-portal [--headed] [--mobile] [--downloads] [--console info]` (PolyID login, records every API response of the app host into `<outdir>/api/`). `mypp.mjs` / `mypp-inapp.mjs` are the myPP web / in-app paths. Always set `MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}}` (other workers use the same logins concurrently). Write your own scripts as `{{RUN_DIR}}/scripts/{{FAMILY}}-<id>.mjs`.
- **Helpers**: `import { tour, leaveTutorial, go, act, stepper, alertText, dumpButtons, issueShot, jsonShot, roles, ncSince, waitFlag, byId } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'` (`act` captures a write request + response, `ncSince` reads notification-center rows after a time, `waitFlag` polls a fresh `config/features`).
- **Ops UIs** (only when your family brief says so): `portal-ops.mjs` (portal ops: flags, tenant, partners, jobs, health), `polyid-admin.mjs` (PolyID ops reads; `unlock` is the steward's), `polyid-flow.mjs` (login flows without auto-login), `partner-api.mjs`, `pwa-embed.mjs`, `gwmock.mjs` (strategy changes only with a held `locks/ct~gwmock`).
- **On-prem**: `{{SKILL_DIR}}/scripts/sql.sh {{TENANT}} "<SQL; one statement per line, each ending with ;>"` (read-only for you unless your family brief says otherwise); `{{SKILL_DIR}}/scripts/plan-day.sh {{TENANT}} <emp> <day>` (PLANUNG rows); `{{SKILL_DIR}}/scripts/api-pp.sh {{TENANT}} avail|timesheet|raw …`; paints `{{SKILL_DIR}}/scripts/pp-plan.sh {{TENANT}} <emp> <date> <defId> FULL|LEFT|RIGHT|DELETE` (api-pp, no PEP) when your brief paints.
- **PEP** (only when your family brief has a PEP step): load the `pep-verify` skill first; drive it with `{{SKILL_DIR}}/scripts/pep.sh {{TENANT}} <command>`. One desktop per box, shared by every runner and worker of the env:
  - **Lock** (`{{PEP_LOCK_DOC}}`): {{PEP_LOCK_STEPS}}
  - **State contract**: after taking the lock run `{{SKILL_DIR}}/scripts/pep/pe-ready.sh {{TENANT}}`; continue only on `READY`. Exit 3 = re-login failed → stop, never retry; exit 4 "COLD START NEEDED" / "DEPLOY NEEDED" → stop, report the blocker (the steward runs the cold start; never set `PE_COLD_START`). Screenshot before acting; disarm an armed palette with the palette radio, never `keys {ESC}` on the main window.
  - **Painting**: prefer `pp-plan.sh`. In PEP use `{{SKILL_DIR}}/scripts/pep/pe-paint.sh` (one cell per gesture, SQL snapshot of the neighbours before and after; any other change → stop, blocker with both snapshots).
  - While a plan sheet is open PEP holds an edit lock on the node: do the cloud writes of a scenario before or after the PEP step, never during it.

## Environment facts that are not product findings

- **Definition cache (gate G4b)**: a definition, palette, right or closing date changed in PEP or SQL is invisible to api-pp until the steward / runner enqueued the persistence-state-change events (DeployMate boxes have no PSC triggers; api-pp caches up to 7 days). Signature: api-pp 404 "Shift definition with id N not found", writes 500 / 409. Stop that scenario, BLOCKED "G4b: <object> not loaded by api-pp", save the body, report it in `blockers`; never run DML yourself.
- **Portal flags** propagate in 3–5 min (portal cache + POMA reload): poll a fresh `config/features` (`waitFlag`), hard-reload the app afterwards.
- **Visibility**: every seeded login is a planner over all nodes, so candidate lists, dashboards and notification centers show other groups' people and objects. Assert by your own ids and time windows, never by counts.
- **Box logs** (api-pp, api-gw) are not reachable on the Windows box: judge an error on the HTTP status + the body's error name / code; ask for a log line in `blockers` only when the body names nothing.
- The machine is macOS: there is no `timeout`. `sql.sh` stops after `SQL_TIMEOUT` (exit 124); wrap any other command that may hang with `perl -e 'alarm shift; exec @ARGV' <seconds> <command…>`.

## Hard rules

1. **Never production**: no production kube context, no `*.polypointservices.ch` host (every helper refuses it), no Staging (production cluster). Beekeeper on Staging is for humans only.
2. **Never** call `/test/**` on any host; never call GAT `clean` or `shift-trades`; never run a POMA job without `tenantIds={{TENANT}}`; never run Tier B / D jobs; never restart the gateway mock or delete its inbox; never press a cache reset / clear, "Disable incompatible features", "reconcile enabled_for", "run automated fix" or a key rotation.
3. Never edit the run partner. A stage-wide change happens only inside a `windows/ct~*` window the steward opened with the user's OK.
4. **Messaging**: owned recipients only; Send Messages only inside W-Y-MSG; tenant 2FA only inside W-Y-TENANT2FA (otherwise the per-user TOTP override); at most 2 password submissions per login per harness call; every wrong password is followed by a success from the same IP; a PolyID unlock is the steward's.
5. **Only your claimed actors and days** (`claims.json`, family brief); one agent per employee at a time, except that another family of your group may drive the same actor on other days (the prompt generator checked that the days do not overlap): touch only your family's days of that actor; DML only on your own claimed rows and only when your family brief says so. Shared rows (kits, `DMSEED:Planner`, global PEP settings) belong to the steward.
6. PEP only under the lock above; prefer the DB / api-pp oracles for reads.
7. Never print, persist or search for passwords, tokens, client secrets, OTP / TOTP codes or connect strings (scripts read them; a mail link goes to `<outdir>/.mail-link`, 0600, deleted after use). Never search boxes or repositories for secrets.
8. Report faithfully: BLOCKED is a verdict; KNOWN-FAIL needs a matching signature; every FAIL / KNOWN-FAIL / BLOCKED-by-error scenario carries an issue screenshot.
9. **On a classifier or permission block: stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
10. Record every object you create or delete in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl` (one JSON line: `{"env":"{{TENANT}}","actor":"<role or id>","date":"YYYY-MM-DD","kind":"…","id":…,"scenario":"…","cleaned":true|false,"how":"…"}`).
11. Gate failure (login impossible, 412, 500 on the first read, G4b signature): BLOCKED with evidence, continue with the next scenario, list it in `blockers`.
12. Execute each write once. If it fails, save the body and move on; no retries with variations unless the family brief asks for them.
13. Cleanup: delete what you created unless the scenario says to keep it; verify it through the oracle; list what you could not clean.
14. **Date shift**: your days were computed for `{{R}}`. If the date (Europe/Zurich) is later when you are about to write, re-check each day against the day map rules of your brief; a day that left its window → that write BLOCKED "date shift"; TODAY scenarios use the actual date. Note the actual date in `notes.md`.
15. **Evidence is never deleted** (yours or anyone's): to redo a step write `<scenario-id>-v2/` and say in `notes.md` which folder counts. No git. Do not modify the skill folder or other agents' result files.

## Evidence layout

`{{RUN_DIR}}/{{FAMILY}}/<scenario-id>/` — the harness outdir of each step (`api/`, `api-index.jsonl`, `harness.log`, screenshots `NN-<step>.png`), the named JSON files of the scenario, oracle outputs `oracle-<step>.txt`, and a short `notes.md` (what you did, observed vs expected, anything odd). Recorded JSON is redacted by the harness (tokens, secrets → `[redacted]`); never add an unredacted body.

## Logins (PolyID lockout risk)

Never loop over logins in the shell (no `for l in $LOGINS`, no `xargs`): zsh does not word-split an unquoted variable, so the list arrives as ONE malformed username, which still counts as a failed attempt for the caller IP. One harness call per login, the login as a literal quoted string. PolyID locks the caller IP per provider without expiry (runners behind one office NAT share it). A login fails → retry ONCE at most, then BLOCKED with the login-failed screenshot and the blocker `PolyID lockout (USER_OR_IP_LOCKED) <login>`; never unlock yourself, never try other usernames.

## Screenshots of the issue (mandatory for every non-PASS)

Every **FAIL**, **KNOWN-FAIL** or **BLOCKED-by-error** scenario carries at least one screenshot that shows the problem itself, listed in `shots` with a one-line caption.

- **App view**: navigate to the screen that shows the problem (reload after API reads) and call `issueShot(page, out, '<what>', <locator>)` from `e2e-lib.mjs`: it dismisses tours, outlines the element in red and saves `<out>/ISSUE-<what>.png`. `<what>` = a literal name without the `ISSUE-` prefix; `<locator>` = the element that carries the WRONG value or the error dialog — not the whole page. Two parts of one error → two shots or one `{ fullPage: true }` shot with both outlined.
- **API-only problem**: `jsonShot(page, out, '<what>', {request, status, expected, excerpt})` — the request line, status, expected value and a SHORT excerpt (the wrong field or error name; never a whole response, tokens or headers).
- **Oracle side** (PEP is the oracle and you already hold the PEP lock): `{{SKILL_DIR}}/scripts/pep.sh {{TENANT}} --out <out>/ISSUE-<what>-pep.png screenshot`. Never take the PEP lock only for a screenshot.
- Open every PNG (Read tool) before listing it: a tour, a spinner, a login page or a visible OTP / QR code → fix and shoot again. Captions name both values: `"Swap list shows 3 candidates, oracle 2 (SW-K6)"`. No personal data beyond seeded role names and ids.
- Paths in `shots` are relative to `{{RUN_DIR}}`; the runner uploads them to the dashboard.

<!-- BEGIN MULTI-GROUP ADDENDUM -->

## Multi-group run (shared environment)

- **Windows**: {{WINDOWS}}. Your runner launched you only after checking that no `draining` / `active` window of your env pauses `{{GROUP}}:{{FAMILY}}`. Before each scenario that writes, read `windows/` of the run dashboard {{DASHBOARD_URL}} (ArtifactData `list`, collection `windows`; read-only) when your family brief says it is window-sensitive: if a window for `{{TENANT}}` that lists `{{GROUP}}:{{FAMILY}}` or `{{GROUP}}` in `pauses`, a HARD window unless your family runs inside it or is in its `exempt`, or a LOGIN window before a fresh login is `draining` or `active`, finish the scenario you are in, start no new one, and report the remaining ones BLOCKED "paused by window <id>" — your runner relaunches them after the window.
- **Rows and findings** are written by your runner (`scenarios/{{GROUP}}~<id>`), not by you. Your only dashboard writes are the PEP lock documents above.
- **Report fields**: add `"group": "{{GROUP}}"`, `"runner": "{{RUNNER}}"`, `"env": "{{TENANT}}"` at the top level of your JSON report.
- **Classifier blocks** (hard rule 9): a refused command, tool call or file access is a blocker — report the exact action and continue with the next scenario; never retry it renamed, wrapped or through another tool.
<!-- END MULTI-GROUP ADDENDUM -->

## Report (your final answer = exactly this JSON, nothing after it)

```json
{
  "group": "{{GROUP}}",
  "runner": "{{RUNNER}}",
  "env": "{{TENANT}}",
  "family": "{{FAMILY}}",
  "agent": "{{AGENT_NAME}}",
  "tenant": "{{TENANT}}",
  "scenarios": [
    {
      "id": "<scenario id>",
      "verdict": "PASS|FAIL|BLOCKED",
      "observed": "what you saw, with numbers",
      "expected": "the expectation and its source",
      "oracle": "the oracle values",
      "evidence": ["{{FAMILY}}/<id>/01-step.png", "{{FAMILY}}/<id>/api/003-GET-....json"],
      "shots": [{ "path": "{{FAMILY}}/<id>/ISSUE-<what>.png", "caption": "one line with both values", "kind": "app" }],
      "findings_confirmed": ["<known-deviation id>"],
      "new_findings": [{ "id": "N-{{FAMILY}}-1", "text": "…", "evidence": ["{{FAMILY}}/<id>/notes.md"] }],
      "diff": "none",
      "notes": "short"
    }
  ],
  "created_data": [
    { "env": "{{TENANT}}", "actor": "<role>", "date": "YYYY-MM-DD", "kind": "…", "id": "…", "cleaned": true }
  ],
  "blockers": []
}
```

`shots` (`kind` = `app` | `api` | `pep`): required, non-empty, for every FAIL / KNOWN-FAIL / BLOCKED-by-error scenario; `[]` for PASS. Evidence paths are relative to `{{RUN_DIR}}`. `blockers`: one line each — gate failures, refused commands (hard rule 9), DML or owner-only calls you need from the runner or steward, windows that paused you.
