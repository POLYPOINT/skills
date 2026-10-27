# Family SY — System banners and client resilience (HPN-16, then HPN-15 in W-X-SYSMSG) · N3

|                           |                                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | HPN-16, HPN-15                                                                                                                                                 |
| Actors                    | N3 `{{N3_LOGIN}}` ({{N3_ID}}) (fresh profile for HPN-15); portal ops = `{{PORTAL_PROFILE}}`; optional N2 `{{N2_LOGIN}}` (HPN-15 step 9)                        |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/SY` (HPN-15: `{{RUN_DIR}}/.profiles/SY-fresh`) · `{{RUN_DIR}}/SY/<id>/`                                                   |
| Read first                | the group brief; scenarios.md HPN-15, HPN-16                                                                                                                   |
| Window                    | HPN-15 only while **W-X-SYSMSG** (SOFT) is `active` (`windows/{{ENV}}~W-X-SYSMSG`; poll 60 s, max 30 min, else BLOCKED "window not granted")                   |
| Flag commands             | `portal-ops.mjs {{PORTAL_PROFILE}} "flag read\|set\|delete {{TENANT}} general.incidents.incidentmsg.<de\|fr\|en\|it\|nl> [text]" <outdir>` (usage: harness.md) |

## HPN-16 — Slow-request banner and maintenance banner (client fault injection, PPCLOUD-14304)

1. `let n = 0; page.route('**/health-professional/v1/dashboard', r => (n++ < 2) ? r.fulfill({status: 503, body: '{}'}) : r.continue())`. 2. `api.goto('/tabs/home/main')`: first retry → progress bar only; second retry → header shows "Einige Anfragen dauern länger als erwartet. Bitte haben Sie Geduld."; a `POST …/errors` request with `error_code: "SLOW_REQUEST_BANNER_SHOWN"`, `status_code: "503"`, `failed_url` = the dashboard URL, `app_path` = `/tabs/home/main`; third call passes, banner gone, dashboard renders. 3. Negative: `**/notifications/all-unread` → 503 for 2 polls → no banner. Unroute. 4. Maintenance: `page.route('**/health-professional/v1/dashboard', r => r.fulfill({status: 200, headers: {'X-Maintenance-Mode': 'true', 'Access-Control-Expose-Headers': 'X-Maintenance-Mode', 'Access-Control-Allow-Origin': 'https://ct-poma-webapp.dev.k8s.polypoint-dev.com'}, contentType: 'text/html', body: '<html>maintenance</html>'}))`; reload Home → banner "myPOLYPOINT Wartungshinweis"; no error dialog. 5. Unroute → the app's retry succeeds → banner gone (record the time).
   Expect: as listed; `errors` request body + 2xx saved.

## HPN-15 — System (incident) message banner (PPCLOUD-14625)

Pre: window active; `flag read` of all five `incidentmsg.<lang>` → empty (gate HPN-G4); N3 fresh profile on `/tabs/home/main`.

1. `"flag set {{TENANT}} general.incidents.incidentmsg.de \"HPN-{{RUN}} Wartung heute 18:00\""`. 2. N3: navigate between tabs every ≥ 60 s until a `config/features?appGroup=general.incidents` response contains the text (max 8 min; `waitFlag` may help). 3. `.conflict-container-header-toggle` "Systemmeldung" visible on Home, Kalender, Tausch, Profil, Zeiterfassung; collapsed by default; tap → text. 4. Dismiss (`[aria-label="Systemmeldung ausblenden"]`) → gone; `localStorage['CapacitorStorage.incident_message_dismissed_hash']` set; reload → still hidden. 5. Set `incidentmsg.fr` = "HPN-{{RUN}} maintenance ce soir" → after the next refresh the banner is back and still shows the **German** text. 6. `flag delete` `.de` → banner shows the French text. 7. UI → "Italiano" → still the French text. 8. `flag delete` `.fr` → banner gone, stored hash removed. 9. Optional: a fresh login of N2 shows the tenant system message on the PolyID login form — screenshot only. 10. **Restore proof (always):** `flag read` of all five → empty → `restore-proof.json`; N3 back to "Deutsch".
   Expect: as listed; live update without reload; no error dialog when a poll fails.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
