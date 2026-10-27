# Group hp — scenario catalogue (HPN, 17 scenarios)

Converted from `areas/hp-notif/scenarios.md` (A-hp-notif, 2026-10-23; code base cloud master 89d7e960e0) with the S1 reconciliations of 2026-10-23:

- environment = **DM-X** tenant only (no SSH, no PEP, VIEWER share is enough); UI flags = steward baseline;
- HPN-05 and HPN-21 use the group's **own** swap N5 → N5c (no dependency on SWP-08 / SWP-16 / PSP-22; the wish section is asserted as its empty state);
- moved out: timesheet HPN-17..20 → group `ts`; HPN-24, HPN-26 → group `shared`; HPN-22, 23, 25, 27 → group `manual`;
- harness names: `app.mjs --app mypp` (was `mypp.mjs`), `portal-ops.mjs flag` (was `portal-flag.mjs`); window E-SYS → **W-X-SYSMSG**.

Families: HP (HPN-01..07) · NC (08..12) · LG (13, 14) · SY (16, 15) · PV (21). Worker-facing steps: `assets/family-briefs/<F>.md`; known deviations: `known-deviations.md` (HPN-K2, K3, K4, K6).

## Conventions used by every scenario

- **Environment**: DeployMate env DM-X (`customer-roster`, master pin, on-prem 26.99.0 → every capability incl. `GET_ANNUAL_PLAN`, `GET_TEAM_ROSTER_FOR_WEEK`, `TIMESHEET`), tenant id `<env>`, shared with swap, booking, partner, ts. The embedding / Teams / device scenarios (HPN-22..27) are groups `shared` and `manual`.
- **URLs (CT)**: myPP `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app` (`{{APP}}`), webapp root `{{MYPP}}` = `https://ct-poma-webapp.dev.k8s.polypoint-dev.com`, poma-api `{{API}}` = `https://ct-poma-api.dev.k8s.polypoint-dev.com`, portal ops `https://ct-portal-webapp.dev.k8s.polypoint-dev.com`, PolyID ops `https://ct-polyid-login.dev.k8s.polypoint-dev.com/ops/`.
- **Harness**: `scripts/harness/app.mjs <env> <login> <script.mjs> <outdir> --app mypp` (desktop 1280 px), in-app mobile path `mypp-inapp.mjs` (390 px, cordova shim). **Routing rule** of `api.goto(path)`: a path starting with `/tabs/` is prefixed with `{{APP}}`, every other path with the webapp root — so non-tab app routes must be passed with the SPA prefix, e.g. `api.goto('/health-professional-app/flows/profile/notification-center', 'notifications')`, `api.goto('/health-professional-app/app/debug')` (`app.mjs` `api.goto`). The worker script may attach its own `page.on('request')` (headers), `page.route()` (fault injection), `ctx.grantPermissions(['clipboard-read','clipboard-write'], {origin: MYPP})` and `ctx.addInitScript()` — no harness change needed for those. Feature flags: `portal-ops.mjs <profile> "flag read|set|delete <env> <code> [value]" <outdir>` (the runner's portal-ops session) — only inside the group's window; wait for propagation (≈ 3 min portal cache + 60 s poma: `waitFlag()` of `e2e-lib.mjs`) and verify through a fresh myPP `config/features?appGroup=…` response. Never call any `/test/**` endpoint.
- **Actors** (logical; the group seed maps them to `dmseed-<kuerzel>` logins, `data-plan.md` §2): `{{N1}}` notification-center HP (owns all its NC rows), `{{N2}}` sender HP (only calls the public notification API), `{{N3}}` navigation HP (dashboard, calendar, language, profile, sweep, team plan), `{{N5}}` privacy-audit HP with its **own** swap N5 → N5c (group seed; S1 reconciliation: no dependency on the swap group). `{{OPS}}` = the runner's portal-ops session (profile `PORTAL_PROFILE`).
- **Days / months**: `TODAY`, `W0` = current ISO week, `M0` = current month (`yyyy-MM`), `M-1`, `M+1`, `M+2`; the seed roster covers seed date −7 … +6 days (weekdays) — scenarios that need "shifts in the next 7 days" run within that window.
- **API evidence**: the harness records every `/api/` response as `api/NNN-*.json`. HP base `/api/mobile/health-professional/v1` (`dashboard`, `calendar/roster`, `calendar/day-view`, `calendar/month-view`, `annual-plan/{year}`, `notifications?current-page&sort-direction&page-size=20[&notification-types]`, `notifications/all-unread` → `{number}`, `PUT notifications/read {notification_ids}`, `PUT notifications/all-read`, `notification-preferences`, `team-roster/*`, `time-accounts`), capabilities `GET /api/capabilities/v1/capabilities`, timesheet `GET /api/mobile/timesheet/v1/reports?employment-id&month&mock`, public notification API `POST /api/v2/notification`, error beacon `POST …/errors`.
- **Oracles** (never "looks fine"): API response fields named per scenario; browser storage (Capacitor Preferences on web = `localStorage['CapacitorStorage.<key>']`, keys `lang`, `debug_messages`, `incident_message_dismissed_hash` per `A/shared/storage-key.enum.ts`; the timesheet switch `timesheet_mock` is an ngx-webstorage entry, match by key suffix); request bodies / query params; final URL after a tap; DOM facts (element present/absent, text); for HPN-19 the api-pp document and DB sums. Screenshots are evidence only.
- **Selectors** (no data-test attributes; harness locale de-CH): header `#header-title`, bell `.header-container-notification`, unread badge `.header-container-notification-badge`, failure badge `.header-container-notification-attention-badge`, retry banner = `pp-info-message` inside the header with "Einige Anfragen dauern länger als erwartet. Bitte haben Sie Geduld."; NC sort `.notification-center-container-list-filters-sort` ("Eingangsdatum"), filter `#open-filter-modal` ("Filter (n)"), link "Alle gelesen", card `pp-notification-center-card`, unread dot `.notification-center-card-container-read-status-icon`, disabled `.disabled-card`, thread links "Verlauf anzeigen" / "Weniger anzeigen", back-to-top `pp-scroll-to-top-button`; profile entries by text ("Push-Nachrichten", "Sprache auswählen", "Debug", "Zeitkonten", "Ferien- und Weiterbildungstage", "Planungspräferenzen", "Planungsvereinbarungen", "Qualifikationen", "Einführung", "Nutzungsbedingungen", "Datenschutz", "Feedback zur App geben"), logout `#logout-menu-entry`; calendar "Heute" `.pp-today-btn`, view switch `pp-tri-state-view-selector` / `pp-month-week-view-toggle` ("Woche", "Monat", "Jahr"), week slider arrows `.prev-week-btn` / right arrow `ion-col:last-child .next-week-btn`, week label `.swiper-main-container`, filter `pp-calendar-filter` ("Mehr"), segments "Mein Plan" / "Teamplan"; month roster `.month-label`, toggle "Meine Verfügbarkeiten anzeigen", chips `.employment-chip`; marketplace segments "Wunsch" / "Diensttausch", sections "Meine Tauschanfragen", "Auf Annahme wartend", "Abgesagt", "Eingereichte Wünsche", "Abgelehnte Wünsche", "Bestätigte Wünsche"; system message toggle `.conflict-container-header-toggle` ("Systemmeldung"), dismiss `[aria-label="Systemmeldung ausblenden"]`; maintenance banner text "myPOLYPOINT Wartungshinweis"; timesheet toggle `.timesheet-source-toggle` ("API-GW"), banner `.timesheet-info-banner`, sections `pp-timesheet-account-section`, `pp-benefits-overview-section`, filter `pp-timesheet-day-filter` ("Alle Tage" / "Nur mit Zulagen"), empty states `.timesheet-no-planning` (button "Zum aktuellen Monat"), `.timesheet-no-allowance-days`; footer `#primaryButton` / `#secondaryButton` / `#backButton`.
- **Evidence naming**: `NN-<step>.png`, `<endpoint>.json`, `oracle-<what>.json|txt`, `notes.md`; every non-PASS gets an outlined issue screenshot (`e2e-lib.mjs issueShot`) or `jsonShot`.
- **Messaging safety**: no scenario sends SMS or e-mail. Generic notifications (HPN-08/10/11) fan out to push only for registered devices (DeployMate web users have none), to MS Teams only with `poma.msTeams.notifications` (OFF on the env) and to partners subscribed to the tenant (partner area). HPN-27 (device) is manual.

## Known deviations

HPN-K2, HPN-K3, HPN-K4, HPN-K6 with their signatures: `known-deviations.md` (this folder). HPN-K1 and HPN-K5 belong to group `ts`.

---

## Family HP — HP app navigation (myPOLYPOINT web)

### HPN-01 Page sweep of the HP app (automated "General Testing")

> Data prerequisite: steward flag baseline (`data-plan.md` §3); `{{N3}}` with seed plannings in `W0`.
> Pre: none. Read-only.
> Steps: 1. As `{{N3}}` in `app.mjs --app mypp` (desktop): visit in order `/tabs/home/main`, `/tabs/calendar` (then switch "Woche", "Monat", "Jahr"), the day view of `TODAY` (tap a day in the month roster), `/tabs/shiftmarketplace` (both segments if shown), `/tabs/unified-time-recording` and its `month-report?month={{M0}}` child, `/tabs/profile/main` and every profile entry that is visible (open, wait, back), `/health-professional-app/flows/profile/notification-center`, `/health-professional-app/flows/profile/notification-preferences`. 2. On every page wait until no `pp-loading-spinner` is visible (max 10 s), take a screenshot, collect: page errors and console errors (harness log), API responses with status ≥ 400 since the page was entered, visible texts matching `/\b[A-Z][A-Z0-9_]+(\.[A-Z0-9_]+){1,}\b/` (raw translation keys), `#header-title` text. 3. Repeat steps 1–2 with `mypp-inapp.mjs` (390 px) for Home, Kalender, Tausch, Profil, Benachrichtigungen; check the tab bar is at the bottom and "Zwischenspeicher leeren" appears only when `poma.mobileApp.debugPage` is on.
> Expect: every page renders a header title; no page error, no console error, no API ≥ 400 except the allow-list (`notifications/all-unread` transient retries, 404 of `annual-plan` only if the capability is missing); no raw key visible; no spinner after 10 s; unknown routes end on `/tabs/home` (`A/app.routes.ts:97`).
> Oracle: `sweep.json` = per page `{route, finalUrl, title, pageErrors[], consoleErrors[], apiErrors[{url,status}], rawKeys[], spinnerTimeout}` built from `harness.log` + `api-index.jsonl`; PASS when every list is empty.
> Evidence: one screenshot per page, `sweep.json`, issue shots for each finding.
> Source: 11661705279#1; MYPP-HOME-01, MYPP-CAL-01..05, MYPP-MKT-01, MYPP-PROF-01; gaps G-13, G-26.

### HPN-02 Dashboard sections, limits and tap routing

> Data prerequisite: `{{N3}}` has plannings on ≥ 3 of the next 7 days (seed window), ≥ 1 open opportunity or swap invitation (from booking/swap data, else the section shows its empty state), ≥ 1 own open swap (else empty state). Flags `showAppointments`, `opportunities`, `shiftTrades` as in the baseline.
> Pre: none. Read-only.
> Steps: 1. `api.goto('/tabs/home/main', 'dashboard')`; save `dashboard.json`. 2. Read the sections: "Nächste Dienste", "Nächste Termine" (only with `showAppointments`), "Verfügbare Anfragen" (only with `opportunities`), "Meine Tauschanfragen" (only with `shiftTrades` and PEP right `submit_shift_trade`). 3. Tap the first shift tile → URL `…/calendar/planned-shift/<sp>/<rc>` (or `absence`/`on-call`); go back with the header arrow, then again with footer `#backButton`; both return to `/tabs/home/main`. 4. Tap the first entry of "Verfügbare Anfragen" → `…/calendar/opportunity-details/<id>` (RR/IPO) or `/flows/shift-swap/detail-view/<id>` (swap invitation); back. 5. Tap the first own swap → `/flows/shift-swap/detail-manage/<id>`; back. 6. Pull to refresh (or reload) → a second `dashboard` call.
> Expect: `dashboard.json` `planned_shifts` cover at most 3 distinct dates, all within `TODAY` … `TODAY+7`, sorted; `opportunities` ≤ 3; `shift_trades` ≤ 3 sorted by shift start; `appointments` ≤ 5, none ended; the UI shows exactly those items; empty lists show "Keine anstehenden Dienste" / "Keine Termine" / "Keine Anfragen" / "Es gibt keine offenen Tauschanfragen"; section visibility matches the flags in the captured `config/features` response and the PEP rights in the profile. Observation (G-29): if `planned_shifts` is empty while `calendar/roster` for the same week has shifts, record it (errors are swallowed in `DashboardService.java:80-82`).
> Oracle: `dashboard.json` counts/dates vs DOM tiles; final URL per tap; `config/features` values.
> Evidence: 01-dashboard.png, one screenshot per tapped detail, dashboard.json, features.json.
> Source: 11467358227#1, #2, #3, #4; MYPP-HOME-01; G-29.

### HPN-03 Language switch, persistence and Accept-Language

> Data prerequisite: none (`{{N3}}`). Own browser profile (language is stored per profile).
> Pre: UI in German.
> Steps: 1. In the script register `page.on('request')` and store the `accept-language` header of every `{{API}}` request. 2. `api.goto('/tabs/profile/main')` → tap "Sprache auswählen" → the modal lists the languages of the app config; pick "Français". 3. Check visible texts: tab labels (MENU.ITEMS: "Accueil"… — read from `fr.json` at run time, do not hard-code), profile item "Sprache auswählen" now French, `#header-title`. 4. Navigate to `/tabs/calendar` and `/tabs/home/main`; record the `accept-language` of the next calls. 5. Reload the page (same profile) → still French. 6. Repeat 2–4 for "English", "Italiano", "Nederlands" (only if listed), then back to "Deutsch".
> Expect: after each switch the UI texts are in the chosen language, no raw keys; every following API request carries `Accept-Language: <code>`; `localStorage['CapacitorStorage.lang']` = the code; after reload the language is kept; the language list equals the configured list (`app-configuration.service.ts:273`). Web: no `PUT …/devices/*` (device language is native only, `device-api.service.ts:97-100`).
> Oracle: `accept-language.json` (header per request after each switch), localStorage value, DOM texts vs `assets/i18n/<lang>.json` keys `MENU.ITEMS.*`, `PROFILE.SELECT_LANGUAGE`.
> Evidence: one screenshot per language, accept-language.json, storage.json.
> Source: 11467358227#5; MYPP-SYS-06; G-15.

### HPN-04 Calendar: week view, month roster, year view, day and shift view, "Mein Team", heat map entry

> Data prerequisite: `{{N3}}` with plannings in `W0` (presence; an absence and an on-call day if the seed has them), flags baseline (`newCalendarMonthlyView` ON = default, `showMyTeam` ON, `opportunities`, `shiftTrades`, `availabilities`, `schedulingRequestV1`), capability `GET_ANNUAL_PLAN` in `capabilities.json`; `{{N3}}` in a pool for the heat-map FAB (optional).
> Pre: none. Read-only.
> Steps: 1. `api.goto('/tabs/calendar', 'calendar/roster')`; save `capabilities.json` (from login) and the roster response. 2. Week view: tap the right arrow twice and the left arrow once → each triggers a roster call for the shown week; tap the week label `.swiper-main-container` → week-selector modal → pick the week after next → roster call for that week; tap "Heute" → back to `W0`. 3. Filter `pp-calendar-filter` ("Mehr"): list the options; select "Geplante Dienste", confirm → only shift tiles remain; select "Alle anzeigen" again. 4. Tap a shift tile → URL `…/calendar/shift-view/<date>/<rc>` (PPCLOUD-14228); on that page (or the planned-shift detail reached from the dashboard) check "Mein Team" lists colleagues of the same shift (`showMyTeam`) and the team-plan button (only with `teamPlan`); back. 5. Switch to "Monat" → month roster: scroll down one month, tap `.month-label` → picker → choose `M+2` → section of `M+2` visible; "Mehr" → toggle "Meine Verfügbarkeiten anzeigen", confirm; tap a day with a shift → `…/calendar/day-view/<date>`; the day view lists the tiles of that day (`calendar/day-view` response). 6. Switch to "Jahr" → year grid of the current year (`annual-plan/<year>` response 200), open "Mehr" (year filter), check the legend. 7. Open the FAB on the calendar: list its entries (Verfügbarkeit erfassen, Heatmap, Diensttausch, Wunsch — per flags/rights); tap "Heatmap" → `/flows/heat-map/main` renders the pools of `{{N3}}` (`competition-info` 200) or the empty state; back. Do not create anything.
> Expect: view switch is tri-state "Woche / Monat / Jahr" because the capability is active (`calendar-main-view.component.ts:82-87`); each navigation loads the expected range; filter options match the flags (`calendar-display-filter.component.ts:84-107`); tile → shift view; day tap in month roster → day view; year view loads; all responses 200.
> Oracle: request ranges (`from`/`to` query params of `calendar/roster`) per navigation; final URLs; option list vs features; `annual-plan` status and year; `day-view` items vs DOM tiles.
> Evidence: screenshots per view, roster-\*.json, day-view.json, annual-plan.json, capabilities.json.
> Source: 11467358227#6, #7, #8, #9, #10, #11, #12, #13; MYPP-CAL-01, -03, -04, -05, -06, -08; G-13, G-14.

### HPN-05 Shift marketplace tabs and lists (read-only, own swap N5 → N5c)

> Data prerequisite (S1 reconciliation): the group's **own** swap N5 → N5c (group seed H2: shortcut creation through the swap API, needs the steward's definitions kit). Actor N5 (owner lists) and N5c (candidate lists). The wish section is asserted as its **empty state** (planning wishes run on DM-Y, group planner). No dependency on the swap or planner groups.
> Pre: none. Read-only (no cancel, no delete).
> Steps: 1. `api.goto('/tabs/shiftmarketplace')` as N5; capture `shift-trades/open-shift-trades`, `cancelled-shift-trades?limit=10`, scheduling-request list calls. 2. Segments: both "Wunsch" and "Diensttausch" when `shiftTrades` ∧ SR v1/v2, else a single list; bottom tab title "Wunsch| Tausch" / "Tausch" / "Wunsch". 3. "Diensttausch": sections "Meine Tauschanfragen" (the own swap), "Auf Annahme wartend", "Abgesagt"; tap the own swap → `/flows/shift-swap/detail-manage/<id>`; back. As N5c: the invitation → `/flows/shift-swap/detail-view/<id>`; back. 4. "Wunsch" (v1): sections "Eingereichte Wünsche", "Abgelehnte Wünsche", "Bestätigte Wünsche" show their empty-state texts. 5. Deep link `api.goto('/tabs/shiftmarketplace?tab=shift-trade')` → swap segment preselected.
> Expect: section contents = the API lists (ids match); "Abgesagt" ≤ 10; wish list request covers now … now+18 months (`scheduling-request-list.component.ts:141`); empty sections show their placeholder texts.
> Oracle: ids in API lists vs DOM rows; request date range; final URLs.
> Evidence: screenshots per segment, list JSONs.
> Source: 11467358227#14, #15, #16, #17, #18, #19; MYPP-MKT-01, MYPP-WISH-01.

### HPN-06 Profile menu gating and on-prem profile pages

> Data prerequisite: flags baseline (`timeAccounts` ON, `shiftCredit` ON, `planningPreferences` / `planningAgreements` / `skillProfile` OFF on DeployMate, `debugPage` ON, `teamPlan` ON); `{{N3}}`.
> Pre: none. Read-only (no feedback is sent, no preference saved).
> Steps: 1. `api.goto('/tabs/profile/main')`; list the visible entries in order. 2. Compare with the flags in `config/features` (profile rules `profile-main-page.component.html:8-160`): "Push-Nachrichten" always, "Sprache auswählen" always, "Einführung" iff `teamPlan`, "Debug" iff `debugPage`, "Ferien- und Weiterbildungstage" iff `shiftCredit`, "Zeitkonten" iff `timeAccounts`, "Planungspräferenzen"/"Planungsvereinbarungen"/"Qualifikationen" iff their flags, "Nutzungsbedingungen", "Datenschutz", "Feedback zur App geben" always, "Ausloggen" `#logout-menu-entry` visible (APP mode). 3. Open "Zeitkonten" → `time-accounts` 200; the accounts shown (e.g. GLAZ) equal the response. 4. Open "Ferien- und Weiterbildungstage": record the call (on-prem ≥ 25.4.0 → smartPEP `…/cpp/api/v1/shift-credits/employments/<id>/at-date/<day>`) and the result. 5. Tap "Nutzungsbedingungen" and "Datenschutz" → a new tab/page opens `…/ui/legal-conditions?legal-condition-scope=POMA&legal-condition-type=…&tenant-id=<env>&language=de` (close it). 6. Open "Feedback zur App geben" → the two options are shown; do **not** submit (real e-mail, G-25).
> Expect: menu = flags; time accounts render the response; legal links carry tenant and language; on DeployMate the balances page fails or shows an error because the tenant is not registered in smartPEP → **KNOWN-FAIL HPN-K6** (record status and message, no finding).
> Oracle: entries vs features; `time-accounts.json` vs DOM; legal URL query params; balances call status.
> Evidence: profile.png, page screenshots, features.json, time-accounts.json, balances call JSON.
> Source: gaps G-16, G-25; MYPP-PROF-01, -02, -03, -07.

### HPN-07 Teamplan: week grid, category filter, consent

> Data prerequisite: flag `poma.mobileApp.teamPlan` ON, `teamPlanAutoConsent` OFF; capability `GET_TEAM_ROSTER_FOR_WEEK`; the conflict checker active for `<env>` (team-roster data comes from it; gate: `team-roster/assignments` 200 with ≥ 1 group); `{{N3}}` and ≥ 2 colleagues in the same Gruppe with plannings in `W0`; `{{N3}}` has not consented yet.
> Pre: none. Writes only `{{N3}}`'s own consent.
> Steps: 1. `api.goto('/tabs/calendar')` → segment "Teamplan". 2. Initial consent modal "Team Plan freigeben" appears (consent missing) → confirm for the listed employment → `PUT …/team-roster/consent?employmentId=` 2xx. 3. The week grid streams (`team-roster/stream`, NDJSON/SSE): rows grouped by "Personalkategorie", one row per colleague, the shifts of `W0`; colleagues who did not consent are flagged by the info "Es gibt Personen in Ihrem Team, die den Teamplan noch nicht freigegeben haben" (if any). 4. "Mehr" → "Personalkategorie" → select one category → only its rows remain; "Alle anzeigen". 5. Next week / "Heute". 6. Profile → "Einführung" opens `/team-roster-tutorial`; finish it → `POST …/team-roster/view-details/completed-flows`. 7. Revoke the consent in the Teamplan "Mehr" menu (toggle "Teamplan anzeigen für Planblatt", `A/flows/calendar/components/team-roster-navigation/team-roster-navigation.component.html`) → `DELETE …/team-roster/consent` → the team plan shows the "Funktion deaktiviert" info; consent again to leave the state as found.
> Expect: grid rows = colleagues of the Gruppe from the stream; category filter narrows; consent calls succeed and drive the UI.
> Oracle: stream body (row count, employee ids, shift codes per day) vs DOM; consent responses; DB cross-check of one colleague-day via `scripts/oracle-day.sh <env> <MA_ID> <day>` (PA code = shift shown).
> Evidence: screenshots, stream.ndjson, consent JSONs, oracle file.
> Source: gaps G-09; MYPP-TEAM-01, -02, -03.

## Family NC — notification center mechanics (per-event content: BKG-27/28, SWP-30/31)

### HPN-08 Seed generic notifications through the public API v2 (N-25)

> Data prerequisite: `{{N1}}` has logged in to myPP once (POMA user exists: `current-user/sync`); `{{N2}}` any other HP of the tenant; the tenant subject of `{{N1}}` = claim `tenant_subject` of `{{N1}}`'s PolyID access token (`A/shared/services/polyid/login-auth/login-auth-polyid.service.ts:115`; decode the captured bearer in memory like pool-sp helper H-2, keep only the claim value; `current-user/sync` returns no body).
> Pre: as `{{N1}}` open `/health-professional-app/flows/profile/notification-center`, record the `GET …/notifications?current-page=0&page-size=20&sort-direction=DESC` total and `all-unread` before; if the list is empty, the text "Keine Benachrichtigung, bitte prüfen Sie die Filter." is shown (screenshot `00-empty-nc.png`).
> Steps: 1. As `{{N2}}` (any page loaded so the bearer is captured): send 26 requests `api.call('POST', '/api/v2/notification', body)` with `tenant_id=<env>`, `recipients_tenant_subject=[<N1 subject>]`, `notification_type={resource, action:"CREATE"}`, `state`, `navigation_target`, `resource_id`, `notification_data` with `title`/`content`/`type_title` in `de-CH` and `en-US`, prefixed `HPN-<run>-<n>`: (a) 3 × resource `SHIFT_TRADE` with the **same** `resource_id` R-T (thread); (b) one each of `BOOKING`, `RESOURCE_REPLACEMENT`, `INTERNAL_POOLS_OPPORTUNITY`, `SCHEDULING_REQUEST`, `POOL_USER_ADDITION`, `POOL_USER_REMOVAL`, `AVAILABILITY` with distinct resource ids, target `NOTIFICATION_CENTER`; (c) one with target `WEEK_VIEW`, one `DEFAULT_VIEW` (resource `AVAILABILITY`), one `SCHEDULING_REQUEST_V2_DETAIL` (resource `SCHEDULING_REQUEST_V2`), one `CACHE_MANAGEMENT` (resource `AVAILABILITY`); (d) one with `state:"DELETED"`; (e) one whose `content.de-CH` is the probe text `<b>fett</b><img src="x" alt="hpn-probe">`; (f) 10 `AVAILABILITY` fillers with distinct resource ids (26 saved rows → 2 pages); (g) one `NOTIFICATION_API_REQUEST` probe, expected **not** to be saved (the API schema says this resource "does not support notification center save" — group edit 2026-10-23: the area recipe used it for the fillers). Helper: `notificationBodies()` in `../scripts/hp-lib.mjs`. Space the calls ≥ 200 ms apart. 2. As `{{N1}}`: read the NC list (all pages) and `all-unread`.
> Expect: every POST answers 200 with an empty unresolved list (`PublicApiNotificationResponseDTO`); after ≤ 60 s (Pub/Sub, after commit) `{{N1}}` has +26 rows, each with `type` = resource (`INTERNAL_POOL_OPPORTUNITY` for the IPO resource in the mobile DTO), `object_id` = resource id, `translated_title.de` = the sent text, `state` as sent, `read_date` null; `all-unread.number` = before + 26 (the DELETED row counts as unread unless the backend excludes it — record).
> Oracle: POST responses; NC JSON diff by `object_id`; `all-unread` before/after.
> Evidence: requests.json (bodies without tokens), nc-before.json, nc-after.json, unread.json.
> Source: 13975879681#0; N-25, MYPP-NOTIF-08; G-11. Note: uses an HP token on the public API (allowed by `PomaApiSecurityConfiguration.java:52-112`, core `isStandardPoma()`); see G-12.

### HPN-09 Notification-center list: badge, sort, filter, threads, infinite scroll, deleted row, text-only content

> Data prerequisite: HPN-08 done (≥ 26 rows for `{{N1}}`, all unread). Flags baseline (availabilities, internalPools, opportunities, shiftTrades, SR v1 ON; SR v2 and roster snapshot OFF).
> Pre: `{{N1}}` has not opened the NC since HPN-08.
> Steps: 1. `api.goto('/tabs/home/main')` → badge `.header-container-notification-badge` text; capture `all-unread`. 2. Tap the bell → `/flows/profile/notification-center`; first page request has `page-size=20`, `sort-direction=DESC`. 3. Scroll to the bottom → a second request with `current-page=1`; the list grows; tap `pp-scroll-to-top-button` → `scrollTop` of the content returns to 0. 4. Tap "Eingangsdatum" → request with `sort-direction=ASC`; the first card is now the oldest; tap again → DESC. 5. Tap "Filter" (`#open-filter-modal`) → list the options; compare with `notification-preferences` (`enabled_by_tenant`) + "Pool-Zuweisung"/"Pool-Entfernung" (internal pools) + "Verfügbarkeit" (availabilities); select "Diensttausch" + "Pool-Buchung", confirm → request `notification-types=SHIFT_TRADE,BOOKING`; label "Filter (2)"; only those cards. 6. Clear the filter (all options deselected) → full list again, label "Filter" without count. (The empty-list text "Keine Benachrichtigung, bitte prüfen Sie die Filter." is checked in HPN-08 Pre on the still empty NC.) 7. Find the R-T card → "Verlauf anzeigen" → 3 timeline entries with `dd.MM.yy | HH:mm` dates → "Weniger anzeigen". 8. The DELETED card has `.disabled-card` and state "Gelöscht"; tapping it does not navigate (URL unchanged) — it is marked read. 9. The probe card shows the literal text `<b>fett</b><img src="x" alt="hpn-probe">`: no `img[alt="hpn-probe"]` element exists in the DOM; its content span has `mouseflow-hidden` and `data-private`.
> Expect: badge = `all-unread.number`; paging, sort, filter and thread behave as listed; filter options = tenant-enabled flows (no "Wunsch V2", no "Roster" types); probe rendered as text (PPCLOUD-14148).
> Oracle: request query params per action; card order by `created_date`; DOM counts vs JSON; DOM query for the probe element.
> Evidence: screenshots per step, nc-page0.json, nc-page1.json, nc-filtered.json, prefs.json.
> Source: 13975879681#1, #2, #3, #5, #6; MYPP-NOTIF-01; G-10.

### HPN-10 Notification-center read state and tap routing (incl. dead targets)

> Data prerequisite: HPN-09 done (rows still unread except the DELETED one).
> Pre: note `all-unread.number` = U.
> Steps: 1. In the NC tap the `NOTIFICATION_CENTER`-target card of `BOOKING` → `PUT …/notifications/read` with its `notification_id`; URL stays (or returns to) the NC; its blue dot is gone after the reload of the list. 2. Tap the `WEEK_VIEW` card → URL `/tabs/calendar…`; back. 3. Tap the `DEFAULT_VIEW` card → `/tabs/home…`; on the dashboard the badge shows U − 3 after the next `all-unread` poll (≤ 60 s) or on re-entry. 4. Tap the `SCHEDULING_REQUEST_V2_DETAIL` card and the `CACHE_MANAGEMENT` card → record the final URL and any error dialog (expected by code: route contains `undefined` / lands on `/tabs/home` via the wildcard → **KNOWN-FAIL HPN-K4** if so). 5. Tap "Alle gelesen" → `PUT …/notifications/all-read`; all dots disappear; badge disappears (`all-unread.number` = 0). 6. Per-event routes (booking → booking detail, invitation → opportunity detail, swap → swap detail) are **not** repeated here (BKG-28, SWP-30).
> Expect: read calls 2xx; dots and badge follow `read_date` / `all-unread`; routes as listed.
> Oracle: PUT request bodies; `read_date` set in the next NC response; `all-unread` values; final URLs.
> Evidence: screenshots, read-_.json, unread-_.json.
> Source: 13975879681#1, #4; MYPP-NOTIF-01, -04; k1b dead #9; G-10, G-11.

### HPN-11 Notification preferences ("Push-Nachrichten")

> Data prerequisite: flags baseline; `{{N1}}`; `{{N2}}` for one more generic notification.
> Pre: none.
> Steps: 1. As `{{N1}}`: Profile → "Push-Nachrichten" → capture `GET …/notification-preferences`. 2. The page lists exactly the types with `enabled_by_tenant=true` (titles from the response); types of disabled flows (SR v2, roster snapshot) are absent. 3. Switch "Diensttausch" (SHIFT_TRADE_OPPORTUNITY) off → `PUT …/notification-preferences` with that type `enabled_by_user=false`. 4. Reload the page → still off. 5. As `{{N2}}` send one `SHIFT_TRADE` generic notification to `{{N1}}` (HPN-08 body shape). 6. As `{{N1}}`: the NC contains the new row (preference does not block the NC entry, `SendToNotificationCenter.java:32-54`). 7. Switch "Diensttausch" on again (restore).
> Expect: list = tenant-enabled types; PUT persisted; NC row still created while the preference is off.
> Oracle: preferences GET/PUT bodies; NC JSON row by resource id.
> Evidence: prefs-before.json, prefs-after.json, nc-row.json, screenshots.
> Source: gaps G-08; MYPP-NOTIF-02; N-25.

### HPN-12 Unread-counter failure: "?" badge and info panel (fault injection)

> Data prerequisite: `{{N1}}`.
> Pre: none. Client-side only.
> Steps: 1. In the script `page.route('**/notifications/all-unread', r => r.fulfill({status: 500, body: '{}'}))`. 2. `api.goto('/tabs/home/main')`; wait ≥ 65 s (one poll). 3. Header: `.header-container-notification-attention-badge` visible, no numeric badge. 4. Open the NC → info panel "Anzahl Benachrichtigungen" / "Die Anzahl der neuen Benachrichtigungen kann momentan nicht anzeigt werden." 5. No error dialog appeared (`mobile-common-error.interceptor.ts:53-64`). 6. `page.unroute`; wait for the next poll → numeric badge back, panel gone after re-entry.
> Expect: as listed.
> Oracle: DOM presence per step; absence of the dialog (`ion-modal` with the custom dialog); the debug log (Preferences `debug_messages`) contains a GENERAL_ERROR entry for `/all-unread`.
> Evidence: screenshots, storage-debug.json.
> Source: gaps G-10; MYPP-NOTIF-01.

## Family LG — logging and debug

### HPN-13 Debug page: entry, log list, filter, copy, token refresh

> Data prerequisite: flag `poma.mobileApp.debugPage` ON (baseline); `general.logs.myppMobileApp` default; `{{N3}}`.
> Pre: browse Home, Kalender, Benachrichtigungen first (generates logs; the logger flushes to storage periodically).
> Steps: 1. `ctx.grantPermissions(['clipboard-read','clipboard-write'], {origin: MYPP})`. 2. Profile → "Debug" → URL `/app/debug`; header "Debug"; text "Konfigurierte Log-Stufe: DEBUG". 3. Cards show date/time, "Correlation ID", "Type: HTTP_REQUEST|HTTP_RESPONSE|…", "Level"; pairs of request/response with the same correlation id for the visited endpoints (e.g. `…/dashboard`). 4. Read `localStorage['CapacitorStorage.debug_messages']` → array A (≤ logSize entries, newest first). 5. Tap "Copy" → toast "Logs copied to clipboard"; `navigator.clipboard.readText()` → JSON array C; C equals A as displayed (same length and order, same `message`/`correlationId`/`type`). 6. Type `dashboard` into "Filter Logs..." → only matching cards; "Copy" again → C' contains only matching entries (copy uses the filtered list). 7. Tap a card → alert with the full message → "OK". 8. "TEST token refresh" → toast "Token refresh OK". 9. Direct route check: `api.goto('/health-professional-app/app/debug')` works without the menu (route has no guard) — record.
> Expect: as listed; privacy observation (G-18): note whether response bodies with personal data (names) appear in A — record, no verdict impact.
> Oracle: storage array vs clipboard JSON (deep compare after JSON parse); toast texts.
> Evidence: screenshots, storage-debug.json, clipboard.json, clipboard-filtered.json.
> Source: 13223624825#1, #2; MYPP-LOG-01; G-18, G-21.

### HPN-14 Error dialog: copy logs and error details

> Data prerequisite: `{{N3}}`.
> Pre: clipboard permission as HPN-13.
> Steps: 1. `api.goto('/health-professional-app/flows/calendar/booking-details/00000000-0000-0000-0000-000000000000')`; capture the `assignments/<uuid>` response (expected 404, guess). 2. The global error dialog appears with the title from the error code (or "Fehler…" default), buttons "OK" (or "Weitere Informationen" when the response has technical details) and "Copy". 3. Tap "Copy" → clipboard JSON contains an entry with `level` ERROR, `type` HTTP_REQUEST or GENERAL_ERROR and the failed URL. 4. If "Weitere Informationen" is shown: tap it → details dialog "Fehlerdetails" (or the error name) with the technical details and "Copy"; tap "Copy" again; "OK". 5. Open the debug page → the same error entries are listed with one correlation id.
> Expect: one dialog (not stacked), copy works from both dialogs, entries present in storage.
> Oracle: response status/body; clipboard JSON entries; storage entries.
> Evidence: dialog screenshots, error-response.json, clipboard.json.
> Source: 13223624825#3; MYPP-LOG-01.

## Family SY — system banners and client resilience

### HPN-15 System (incident) message banner: live update, dismiss, re-show, language fallback, removal (PPCLOUD-14625)

> Data prerequisite: `{{OPS}}` portal session (`portal-ops.mjs flag`, string features `general.incidents.incidentmsg.de|fr|en|it|nl`); window W-X-SYSMSG (SOFT: the banner is shown to every user of the tenant); `{{N3}}` with a fresh browser profile.
> Pre: all five texts empty (read them first, restore at the end).
> Steps: 1. Worker in window W-X-SYSMSG: `portal-ops.mjs … "flag set <env> general.incidents.incidentmsg.de \"HPN-<run> Wartung heute 18:00\""`. 2. `{{N3}}` already on `/tabs/home/main`: navigate between tabs every ≥ 60 s (navigation refresh, throttle 60 s) until a `config/features?appGroup=general.incidents` response contains the text (max 8 min: portal cache + 5-min poll). 3. Banner `.conflict-container-header-toggle` "Systemmeldung" visible on Home, Kalender, Tausch, Profil, Zeiterfassung; collapsed by default; tap → text shown. 4. Dismiss (`aria-label="Systemmeldung ausblenden"`) → banner gone; `localStorage['CapacitorStorage.incident_message_dismissed_hash']` set; reload → still hidden. 5. Set `incidentmsg.fr` = "HPN-<run> maintenance ce soir" → after the next refresh the banner is back (hash of all languages changed) and still shows the **German** text. 6. Clear `.de` (`flag delete`) → banner text now the French one (fallback order: current language, then de, en, fr, it, nl). 7. Switch the UI to "Italiano" (HPN-03 steps) → still the French text (no it/de/en). 8. Clear `.fr` (`flag delete`) → banner disappears and the stored hash is removed. 9. Optional: a fresh login of `{{N2}}` shows the tenant system message on the PolyID login form (PID-LOGIN-06) — screenshot only.
> Expect: as listed; live update without reload; no error dialog when the poll fails.
> Oracle: `config/features` responses (text values) with timestamps; DOM banner state; localStorage value per step.
> Evidence: screenshots per step, features-_.json, storage-_.json, portal-ops logs.
> Source: gaps G-05; MYPP-SYS-01, PID-LOGIN-06; PPCLOUD-14625.

### HPN-16 Slow-request banner and maintenance banner (client fault injection, PPCLOUD-14304)

> Data prerequisite: `{{N3}}`.
> Pre: none. Client-side only; one error report is written by the backend (`POST …/errors`).
> Steps: 1. Slow request: `let n=0; page.route('**/health-professional/v1/dashboard', r => (n++ < 2) ? r.fulfill({status: 503, body: '{}'}) : r.continue())`. 2. `api.goto('/tabs/home/main')`: first retry → progress bar only; second retry → header shows "Einige Anfragen dauern länger als erwartet. Bitte haben Sie Geduld."; a `POST …/errors` request with body `error_code: "SLOW_REQUEST_BANNER_SHOWN"`, `status_code: "503"`, `failed_url` = the dashboard URL, `app_path` = `/tabs/home/main`; then the third call passes, the banner disappears, the dashboard renders. 3. Negative: route `**/notifications/all-unread` → 503 for 2 polls → no banner (background poll excluded). Unroute. 4. Maintenance: `page.route('**/health-professional/v1/dashboard', r => r.fulfill({status: 200, headers: {'X-Maintenance-Mode': 'true', 'Access-Control-Expose-Headers': 'X-Maintenance-Mode', 'Access-Control-Allow-Origin': MYPP}, contentType: 'text/html', body: '<html>maintenance</html>'}))`; reload Home → banner "myPOLYPOINT Wartungshinweis" with its text; no error dialog. 5. Unroute → the app's "is it over?" retry succeeds → banner disappears (record the time).
> Expect: as listed.
> Oracle: captured `POST …/errors` request body + 2xx response; DOM banner states; absence of error dialogs.
> Evidence: screenshots, errors-request.json, timing notes.
> Source: gaps G-06, G-07; MYPP-SYS-02, MYPP-SYS-04; PPCLOUD-14304.

## Family PV — privacy

### HPN-21 MouseFlow / LogRocket masking audit (no MouseFlow needed)

> Data prerequisite (S1 reconciliation): `{{N5}}` with its **own** open swap N5 → N5c (group seed H2) and the notifications it produced; `showMyTeam` and `teamPlan` ON. Pages that need a pool membership or an opportunity (heat map, opportunity / booking detail, invitation) are skipped with a note when N5 has none — no dependency on the booking or swap groups. Flags `poma.webApp.mouseflow` / `development` stay OFF (switching them on would send real sessions to MouseFlow).
> Pre: none. Read-only.
> Steps: 1. As `{{N5}}` open: Home, week view, month roster incl. "Mehr" (employment chips), day view, shift view + "Mein Team", Teamplan, opportunity detail, booking detail (if any), swap detail-manage + detail-view, swap creation steps up to "Vorschläge" (cancel before submit), NC with an expanded thread, month report / timesheet (if W-X-TIMESHEET is active), Zeitkonten. 2. Build the sensitive-string set S from the captured API JSON of these pages: colleague / candidate / team-member names (`first_name`, `last_name`, `display_name`), employment display names, pool names, shift-planner comments, notification contents. 3. On each page evaluate in the DOM: every visible text node that contains a string of S must have an ancestor with class `mouseflow-hidden` (or be inside `input`/`textarea`); record also whether the ancestor carries `data-private`. 4. Inject `.mouseflow-hidden{background:red!important}` and take a screenshot per page (the Confluence method).
> Expect: no unmasked occurrence. Known from code → **KNOWN-FAIL HPN-K2** (month-roster employment chips); HPN-K3 only if an invitation page can be opened.
> Oracle: `masking.json` = per page the list of unmasked occurrences `{text-hash, selector path, string class}` (no clear-text names in the report: hash or first letter only).
> Evidence: red-highlight screenshots, masking.json.
> Source: 14112522266#1; MYPP-LOG-02; G-17.
