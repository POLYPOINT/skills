# Group brief — shared

Runner notes (the part above the `---` line is not sent to workers): fills the `{{GROUP_BRIEF}}` slot of `assets/agent-brief.md`. **One run config per family**: `tenant` = that family's shared tenant (SH-PW / SH-TEAMS `ct-zinc-master`, SH-MS the Microsoft tenant the user named, SH-BEE `beekeeper-integration-tenant-test`, SH-OLD the < 26 box), `STAGE` = `ct` or `preview`, generated with `--families <F>` (same `--out` folder; the prompt files differ by name). These tenants are not ours: get the owners' consent first (gate SH-G1), request the SHARED window docs (`windows/ct~W-SH-ANTBE`, `windows/ct~W-SH-MSTENANT`) with the consent in `reason`, and announce them. SH-PW and SH-MS are attended (the operator types passwords and signs in to Microsoft); tell the operator before the launch. Credentials for shared-tenant users live only in the runner's 0600 cred file outside `results/` (`CRED_FILE`).

---

## Group shared — what every worker of this group needs

You run scenarios on **shared tenants that belong to other people** (CT `ct-zinc-master`, a CT / Preview tenant with a registered Microsoft app, the CT Beekeeper test tenant, a Preview / CT box below on-prem 26). Your environment under test is **`{{TENANT}}`** on stage **`{{STAGE}}`**. You change only what your family brief names, inside its window, and restore it.

### Rules that matter most on shared tenants

- **Owners' consent** (gate SH-G1 in `{{RUN_DIR}}/env-facts.md`) and, for SH-PW / SH-MS, an **active SHARED window doc**. Missing → report every scenario BLOCKED "no consent" / "window not active" and change nothing.
- **Read before write, restore after write**: record the state you will change (provider read, user link state), change it, restore it, prove the restore with a second read.
- **Never production or Staging**: the harness refuses `*.polypointservices.ch` and any host with "prod" or "staging"; Staging (Beekeeper real app) is for humans only. A < 26 box whose page points at a production host → BLOCKED, never work around it.
- **Never edit a shared registry object**: the PolyID partner `partner-embedding-mock`, the portal partner of the same id, the MS Teams domain mapping, another team's provider settings beyond the window's provider type.
- **Passwords**: shared test users' passwords are typed by the operator in a headed window, or read by the harness from `{{CRED_FILE}}` (`--cred-file`). Never ask for them, never print or save them. At most 2 password submissions per login per harness call.

### Harness (exact flags: `{{SKILL_DIR}}/references/harness.md`; `cd {{RUN_DIR}}`, `MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}}`)

```
node {{SKILL_DIR}}/scripts/harness/pwa-embed.mjs <outdir> <script.mjs|-> [--stage {{STAGE}}] [--headed] [--profile <dir>]            # SH-PW
node {{SKILL_DIR}}/scripts/harness/polyid-admin.mjs {{PIDOPS_PROFILE}} <outdir> {{TENANT}} <cmd> --stage {{STAGE}}                       # provider / user reads, link resets
node {{SKILL_DIR}}/scripts/harness/polyid-flow.mjs {{TENANT}} <login|-> <script.mjs> <outdir> --app mypp|inapp --stage {{STAGE}} [--headed] [--cred-file {{CRED_FILE}}]
node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app mypp --stage {{STAGE}} [--cred-file {{CRED_FILE}}]
node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "flag read {{TENANT}} <code>" <outdir>
```

- `pwa-embed.mjs` opens the CT embedding mock (`…/partner-pwa-embedding-mock/`) in a fresh context, captures every `POST <polyid-login>/api/auth/partner-sessions` (request fields, status, outcome, decoded claims — never the token) into `partner-sessions.json`, records the embedded myPP's poma-api responses and gives the script `frame()`, `myppFrame()`, `sessions()`, `claims(token)`.
- `polyid-admin.mjs` commands used here: `provider-read`, `user-read <login>`, `reset-partner-link <login>` (SH-PW, inside W-SH-ANTBE), `audit --since <ISO>`. Never `unlock`, never `provider-2fa`.
- Helpers: `import { issueShot, jsonShot, roles } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'`.

### Evidence and report

- Folder `{{RUN_DIR}}/{{FAMILY}}/<scenario>/`: `NN-<step>.png` (secrets masked), `<endpoint>.json`, `partner-sessions*.json`, `provider-before.json` / `-after.json`, `routes.json`, `notes.md` (consent reference, window times).
- Every change on a shared tenant (link reset, provider type, swap) one JSON line in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl` with its restore and the proof file.
- KNOWN-FAIL only with a matching signature of `{{GROUP_DIR}}/references/known-deviations.md` (PF-5, SW-K… are listed there); new findings `N-SHARED-<n>`.

### Never

- Never call a path containing `/test/` (portal-api, polyid-login, event-handler, the gateway mock); never the embedding mock's "Notification simulator"; never restart the gateway mock.
- Never add or change an MS Teams domain mapping; never touch Staging; never a POMA job or cache reset.
- Never use another tester's user than the ones your family brief names; never another tenant than `{{TENANT}}`.
- Never print, copy or save passwords, tokens, client secrets or OTP codes; the operator types what the harness cannot read from the cred file.
- **Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
