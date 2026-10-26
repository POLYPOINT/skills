# Group brief — hp

Runner notes (the part above the `---` line is not needed by workers): fill `{{GROUP_BRIEF}}` with the part below. Values come from `employees.md` (H1, incl. `N1_SUBJECT`), the seed log (own swap id) and `kits/<env>`. HPN-15 runs only when W-X-SYSMSG is `active`.

---

## Group hp — what every worker of this group needs

You test the myPOLYPOINT **HP app** (navigation, notification center, logging, banners, privacy) on DeployMate env **`{{TENANT}}`** (role {{ENV_ROLE}}, shared with swap, booking, partner, ts). This group needs no SSH and no PEP: everything runs through the browser harness and the poma APIs.

### Actors (claimed by this group)

| Token | Login (MITARBEITER_ID)       | Role                                                            |
| ----- | ---------------------------- | --------------------------------------------------------------- |
| N1    | `{{N1_LOGIN}}` ({{N1_ID}})   | notification-center recipient (tenant subject `{{N1_SUBJECT}}`) |
| N2    | `{{N2_LOGIN}}` ({{N2_ID}})   | sender of generic notifications (public API v2)                 |
| N3    | `{{N3_LOGIN}}` ({{N3_ID}})   | navigation HP (Geburtshilfe `{{HP_NODE}}`, planned this week)   |
| N3C   | `{{N3C_LOGIN}}` ({{N3C_ID}}) | Teamplan colleague — never log in as N3C                        |
| N5    | `{{N5_LOGIN}}` ({{N5_ID}})   | owner of the group's own swap (seed H2) on `{{N5_DAY}}`         |
| N5C   | `{{N5C_LOGIN}}` ({{N5C_ID}}) | candidate of that swap                                          |

The seed log names the own swap's opportunity id. Other groups' people (swap T* / U*, booking HP*, partner PH*, ts N4\*) are never used.

### Apps and harness

- myPP `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app`; poma-api `https://ct-poma-api.dev.k8s.polypoint-dev.com`; portal ops (HPN-15 only) through the runner's profile `{{PORTAL_PROFILE}}`.
- ```
  cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}} \
    node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app mypp
  ```
  In-app mobile path (HPN-01 step 3): `mypp-inapp.mjs` with the same arguments. Exact flags: `{{SKILL_DIR}}/references/harness.md`.
- **Routing rule of `api.goto(path)`**: a path starting with `/tabs/` is prefixed with the app base, every other path with the webapp root — non-tab app routes need the SPA prefix, e.g. `api.goto('/health-professional-app/flows/profile/notification-center', 'notifications')`, `api.goto('/health-professional-app/app/debug')`.
- Scripts `{{RUN_DIR}}/scripts/{{FAMILY}}-<scenario>.mjs`, contract `export default async ({page, ctx, api, shot, log, out, env, login}) => {...}`. The script may add `page.on('request')` (headers), `page.route()` (fault injection; always `unroute` at the end), `ctx.grantPermissions(['clipboard-read','clipboard-write'], {origin: 'https://ct-poma-webapp.dev.k8s.polypoint-dev.com'})`, `ctx.addInitScript()`.
- Helpers: `import { act, alertText, stepper, issueShot, jsonShot, waitFlag, ncSince } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'` and `import { HP, tokenClaim, notificationBodies, sendNotifications, ncPage, ncAll, unread, rawKeys, waitNoSpinner, maskAudit } from '{{GROUP_DIR}}/scripts/hp-lib.mjs'`.

### Oracles

API response fields named per scenario; browser storage (Capacitor Preferences on web = `localStorage['CapacitorStorage.<key>']`, keys `lang`, `debug_messages`, `incident_message_dismissed_hash`; the timesheet switch is an ngx-webstorage entry, match by key suffix); request bodies / query params; final URL after a tap; DOM facts. Screenshots are evidence only. Selectors: `{{GROUP_DIR}}/references/scenarios.md` "Conventions" (header `#header-title`, bell `.header-container-notification`, badge `.header-container-notification-badge`, attention badge `.header-container-notification-attention-badge`, NC card `pp-notification-center-card`, filter `#open-filter-modal`, sort `.notification-center-container-list-filters-sort`, system message `.conflict-container-header-toggle`, dismiss `[aria-label="Systemmeldung ausblenden"]`, logout `#logout-menu-entry`).

### Logins

Own profile folder per worker; one worker per actor at a time (lanes N3 and N1 are disjoint; N5 / N5C only in HPN-05 and HPN-21, one after the other). ≤ 2 password submissions per login per harness call; a failed login → retry once, then BLOCKED `PolyID lockout (USER_OR_IP_LOCKED) <login>` with the screenshot. Never unlock PolyID yourself.

### Windows

Your family's windows: {{WINDOWS}}. W-X-SYSMSG (HPN-15) and ts's W-X-TIMESHEET pause hp families: read `windows/{{ENV}}~<id>` on the dashboard database ({{DASHBOARD_URL}}) before you start a scenario; a `draining` / `active` window that lists your family → finish the current scenario, start no new scenario and report the remaining ones BLOCKED "paused by window <id>" (common part "Multi-group run"; the runner relaunches them). HPN-15's flag changes go through `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "flag set|delete {{TENANT}} general.incidents.incidentmsg.<lang> [text]" <outdir>` (usage: harness.md) and end with every text deleted (`restore-proof.json`).

### Evidence and report

- `{{RUN_DIR}}/{{FAMILY}}/<scenario>/`: `NN-<step>.png`, `<endpoint>.json`, `oracle-*.json`, `storage-*.json`, `notes.md`; created objects one JSON line each in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl`.
- Every FAIL / KNOWN-FAIL / BLOCKED-by-error row carries an outlined issue screenshot (`issueShot`, or `jsonShot` for API-only results).
- KNOWN-FAIL only with a matching signature of `{{GROUP_DIR}}/references/known-deviations.md` (HPN-K2, K3, K4, K6); new findings `N-HP-<n>`.
- No clear-text names of colleagues in reports (masking audit: hash + first letter).

### Never

- Never send SMS or e-mail; never submit the feedback form (real e-mail); never switch `poma.webApp.mouseflow` / `development` on.
- Never call any test-data endpoint (paths with `/test/`), GAT, or a POMA job; never press a cache reset or "Zwischenspeicher leeren" for another user.
- Never change tenant flags except the incident texts inside W-X-SYSMSG; never touch other groups' people or the run partner.
- Never print, copy or save credentials or tokens (`tokenClaim` returns one claim value in memory).
- **Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
