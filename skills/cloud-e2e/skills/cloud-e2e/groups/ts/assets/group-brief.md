# Group brief — ts

Runner notes (the part above the `---` line is not needed by workers): fill `{{GROUP_BRIEF}}` with the part below. Values come from `employees.md`, the seed log (T1 version gate, T2 Sollplan save) and `kits/<env>`. The TS worker is launched only when W-X-TIMESHEET is `active`.

---

## Group ts — what every worker of this group needs

You test the myPOLYPOINT **timesheet** (Zeitausweis, not UTR) on DeployMate env **`{{TENANT}}`** (role {{ENV_ROLE}}). The flag `poma.flows.timesheet` replaces the month report for every HP of the tenant: it is ON only inside **W-X-TIMESHEET**, and you switch it yourself.

### Actors (claimed by this group)

| Token          | Login (MITARBEITER_ID)       | Role                                                                          |
| -------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| N4             | `{{N4_LOGIN}}` ({{N4_ID}})   | timesheet HP, one employment, Gruppe `{{N4_NODE}}`                            |
| N4X            | `{{N4X_LOGIN}}` ({{N4X_ID}}) | its employment id is the "foreign employment" of HPN-18 — never log in as N4X |
| N4B (optional) | `{{N4B_LOGIN}}` ({{N4B_ID}}) | HP with two employments (seed T3) for HPN-20                                  |

Months: M0 = `{{MONTH}}`, M−1 = `{{MM1}}`, M+1 = `{{MP1}}` (Sollplan saved), M+2 = `{{MP2}}` (no Sollplan), beyond look-ahead = `{{MP13}}`. Version gate (seed T1): `{{VERSION_GATE}}`.

### Apps and harness

- myPP `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app`; timesheet API `GET /api/mobile/timesheet/v1/reports?employment-id&month&mock`.
- ```
  cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}} \
    node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} {{N4_LOGIN}} <script.mjs|-> <outdir> --app mypp
  ```
  Month report route: `api.goto('/tabs/unified-time-recording/month-report?month=<YYYY-MM>')`. Fault injection with `page.route()` / `page.unroute()` inside the script.
- Helpers: `import { act, alertText, stepper, issueShot, jsonShot, waitFlag } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'`.
- Flag: `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "flag read|set {{TENANT}} poma.flows.timesheet [true|false]" <outdir>` (usage: harness.md); propagation with `waitFlag(api, 'poma.flows.timesheet', <value>, 8)` in a myPP script (fresh `config/features`).
- DB oracle (HPN-19 step 7): `{{SKILL_DIR}}/scripts/sql.sh {{TENANT}} "SELECT …"` read-only (Σ GLAZ `ZEITANRECHNUNG` of a day: see the brief).

### Selectors

Timesheet `pp-timesheet` (replaces `pp-month-report-table`), toggle `.timesheet-source-toggle` ("API-GW"), banner `.timesheet-info-banner`, sections `pp-timesheet-account-section`, `pp-benefits-overview-section`, filter `pp-timesheet-day-filter` ("Alle Tage" / "Nur mit Zulagen"), empty states `.timesheet-no-planning` (button "Zum aktuellen Monat"), `.timesheet-no-allowance-days`. The toggle state is the localStorage entry whose key ends in `timesheet_mock`.

### Window

W-X-TIMESHEET (FLAG, ≈ 90 min): read `windows/{{ENV}}~W-X-TIMESHEET` on the dashboard database ({{DASHBOARD_URL}}) before the first flag change; continue only while `active` for group ts. It pauses hp's HP family. Restore = flag **false** again (set the baseline value, never delete the override) + `restore-proof.json`; the runner releases.

### Evidence and report

- `{{RUN_DIR}}/TS/<scenario>/`: `NN-<step>.png`, `timesheet-<month>.json`, `storage.json`, `notes.md`.
- Every FAIL / KNOWN-FAIL / BLOCKED-by-error row carries an outlined issue screenshot (`issueShot`, or `jsonShot` for API-only results).
- KNOWN-FAIL only with a matching signature of `{{GROUP_DIR}}/references/known-deviations.md` (HPN-K1, HPN-K5); new findings `N-TS-<n>`.

### Never

- Never leave `poma.flows.timesheet` ON after your scenarios; never change any other flag.
- Never log in as N4X or anybody outside the table; never touch other groups' people.
- Never call any test-data endpoint (paths with `/test/`), GAT, or a POMA job; no DML.
- Never print, copy or save credentials or tokens.
- **Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
