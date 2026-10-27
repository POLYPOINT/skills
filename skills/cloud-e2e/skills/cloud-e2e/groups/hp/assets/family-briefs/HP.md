# Family HP — HP app navigation (HPN-01, 02, 03, 04, 06, 07, 05) · N3; N5 / N5C read-only

|                           |                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | HPN-01, HPN-02, HPN-03, HPN-04, HPN-06, HPN-07, HPN-05                                                        |
| Actors                    | N3 `{{N3_LOGIN}}` ({{N3_ID}}) for 01–04, 06, 07; N5 `{{N5_LOGIN}}` and N5C `{{N5C_LOGIN}}` for 05 (read-only) |
| Days                      | W0 (current week), `{{TODAY}}`, `{{MONTH}}`; N5 / N5C swap on `{{N5_DAY}}`                                    |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/HP` · `{{RUN_DIR}}/HP/<id>/`                                             |
| Read first                | the group brief; scenarios.md family HP; `known-deviations.md` HPN-K6, SD-37, SD-66                           |
| Writes                    | N3's language (profile only, restored) and N3's team-plan consent (restored); nothing else                    |
| Windows                   | paused by W-X-SYSMSG (hp) and W-X-TIMESHEET (ts: HPN-01 visits the month report)                              |

## HPN-01 — Page sweep of the HP app (web + in-app)

1. N3 desktop: visit in order `/tabs/home/main`, `/tabs/calendar` (then "Woche", "Monat", "Jahr"), the day view of `{{TODAY}}` (tap a day in the month roster), `/tabs/shiftmarketplace` (both segments), `/tabs/unified-time-recording` and `month-report?month={{MONTH}}`, `/tabs/profile/main` and every visible profile entry (open, wait, back), `/health-professional-app/flows/profile/notification-center`, `/health-professional-app/flows/profile/notification-preferences`. 2. Per page: `waitNoSpinner(page, 10000)`, screenshot, page / console errors (harness log), API responses ≥ 400 since entering (`api-index.jsonl`), `rawKeys(page)`, `#header-title` text. 3. In-app (`mypp-inapp.mjs`, 390 px): Home, Kalender, Tausch, Profil, Benachrichtigungen; tab bar at the bottom; "Zwischenspeicher leeren" only when `debugPage` is on (it is).
   Expect: every page has a header title; no page / console error; no API ≥ 400 except transient `notifications/all-unread` retries; no raw key; no spinner after 10 s; unknown routes end on `/tabs/home`. Record whether `/flows/profile/feature-flags` is reachable (SD-66, observation; change nothing there). Evidence `sweep.json` (per page `{route, finalUrl, title, pageErrors, consoleErrors, apiErrors, rawKeys, spinnerTimeout}`).

## HPN-02 — Dashboard sections, limits and tap routing

1. `api.goto('/tabs/home/main', 'dashboard')` → `dashboard.json`; `features.json`. 2. Sections: "Nächste Dienste", "Nächste Termine" (only with `showAppointments`), "Verfügbare Anfragen" (`opportunities`), "Meine Tauschanfragen" (`shiftTrades` + right `submit_shift_trade`). 3. First shift tile → `…/calendar/planned-shift/<sp>/<rc>` (or absence / on-call); back with the header arrow, again with `#backButton` → `/tabs/home/main`. 4. First "Verfügbare Anfragen" entry (if any) → opportunity or swap detail; back. 5. First own swap (none for N3: empty state). 6. Reload → second `dashboard` call.
   Expect: `planned_shifts` ≤ 3 distinct dates within `{{TODAY}}`…+7, sorted; `opportunities` ≤ 3; `shift_trades` ≤ 3; `appointments` ≤ 5; UI = JSON; empty lists show "Keine anstehenden Dienste" / "Keine Termine" / "Keine Anfragen" / "Es gibt keine offenen Tauschanfragen"; visibility = flags. `planned_shifts` empty while `calendar/roster` has shifts → record (SD-37).

## HPN-03 — Language switch, persistence and Accept-Language

1. `page.on('request')` → store `accept-language` of every poma-api request. 2. Profile → "Sprache auswählen" → list the languages → "Français". 3. Texts: tab labels from `fr.json` (read at run time), profile entry, `#header-title`. 4. `/tabs/calendar`, `/tabs/home/main` → `accept-language: fr…`. 5. Reload → still French. 6. Repeat 2–4 for "English", "Italiano", "Nederlands" (if listed), then **back to "Deutsch"**.
   Expect: UI in the chosen language, no raw keys; every following request carries the code; `localStorage['CapacitorStorage.lang']` = the code; kept after reload; list = configured languages; no `PUT …/devices/*` on web.

## HPN-04 — Calendar: week, month roster, year, day and shift view, "Mein Team", heat-map entry

1. `api.goto('/tabs/calendar', 'calendar/roster')`; save `capabilities.json` and the roster response. 2. Week view: right arrow twice, left once → one roster call each; `.swiper-main-container` → week selector → the week after next; "Heute" (`.pp-today-btn`) → W0. 3. Filter "Mehr" (`pp-calendar-filter`): list options; "Geplante Dienste" → only shift tiles; "Alle anzeigen". 4. Shift tile → `…/calendar/shift-view/<date>/<rc>`; "Mein Team" lists colleagues (`showMyTeam`), team-plan button (`teamPlan`); back. 5. "Monat": scroll one month; `.month-label` → picker → M+2; "Mehr" → "Meine Verfügbarkeiten anzeigen"; tap a day with a shift → `…/calendar/day-view/<date>` (tiles = `calendar/day-view`). 6. "Jahr" → `annual-plan/<year>` 200, "Mehr", legend. 7. Calendar FAB: list the entries; "Heatmap" → `/flows/heat-map/main` (N3 is in no pool: empty state expected); back. Create nothing.
   Expect: tri-state "Woche / Monat / Jahr" (capability present); each navigation loads its range (`from` / `to`); filter options = flags; all responses 200.

## HPN-06 — Profile menu gating and on-prem profile pages

1. `/tabs/profile/main`; list the entries in order. 2. Compare with `config/features`: "Push-Nachrichten", "Sprache auswählen" always; "Einführung" iff `teamPlan`; "Debug" iff `debugPage`; "Ferien- und Weiterbildungstage" iff `shiftCredit`; "Zeitkonten" iff `timeAccounts`; "Planungspräferenzen" / "Planungsvereinbarungen" / "Qualifikationen" iff their flags (off on DeployMate); "Nutzungsbedingungen", "Datenschutz", "Feedback zur App geben" always; `#logout-menu-entry` visible. 3. "Zeitkonten" → `time-accounts` 200; accounts shown = response. 4. "Ferien- und Weiterbildungstage": record the call (smartPEP `…/cpp/api/v1/shift-credits/…`) and the result. 5. "Nutzungsbedingungen", "Datenschutz" → new page `…/ui/legal-conditions?legal-condition-scope=POMA&legal-condition-type=…&tenant-id={{TENANT}}&language=de` (close). 6. "Feedback zur App geben" → two options shown; **do not submit**.
   Expect: menu = flags; time accounts render the response; legal links carry tenant and language; balances fail on DeployMate → **KNOWN-FAIL HPN-K6** (record status and message).

## HPN-07 — Teamplan: week grid, category filter, consent

Gate HPN-G2 (team-roster assignments 200 with ≥ 1 group; seed log) — not PASS → BLOCKED "conflict checker not active for the tenant (team-roster data)".

1. `/tabs/calendar` → segment "Teamplan". 2. Consent modal "Team Plan freigeben" → confirm → `PUT …/team-roster/consent?employmentId=` 2xx. 3. The week grid streams (`team-roster/stream`): rows grouped by "Personalkategorie", one row per colleague (N1, N2, N3C …), W0 shifts; non-consented colleagues flagged by "Es gibt Personen in Ihrem Team, die den Teamplan noch nicht freigegeben haben". 4. "Mehr" → "Personalkategorie" → one category → only its rows; "Alle anzeigen". 5. Next week / "Heute". 6. Profile → "Einführung" → `/team-roster-tutorial`; finish → `POST …/team-roster/view-details/completed-flows`. 7. Revoke the consent (team-plan "Mehr", toggle "Teamplan anzeigen für Planblatt") → `DELETE …/team-roster/consent` → "Funktion deaktiviert"; **consent again** (state as found = consented after this scenario is fine; note it).
   Expect: grid = colleagues of the Gruppe from the stream; filter narrows; consent calls drive the UI. Oracle: stream body (row count, employee ids, codes per day) vs DOM.

## HPN-05 — Shift marketplace tabs and lists (own swap N5 → N5C, read-only)

Gate HPN-G3 (own swap OPEN; seed log has the opportunity id). As N5: 1. `api.goto('/tabs/shiftmarketplace')`; capture `shift-trades/open-shift-trades`, `cancelled-shift-trades?limit=10`, the scheduling-request list calls. 2. Segments "Wunsch" and "Diensttausch"; bottom tab title "Wunsch| Tausch". 3. "Diensttausch": "Meine Tauschanfragen" contains the own swap → tap → `/flows/shift-swap/detail-manage/<id>`; back; "Auf Annahme wartend" / "Abgesagt" empty states (or their API rows). 4. "Wunsch" (v1): "Eingereichte Wünsche", "Abgelehnte Wünsche", "Bestätigte Wünsche" show empty-state texts; wish request range now … now+18 months. 5. `api.goto('/tabs/shiftmarketplace?tab=shift-trade')` → swap segment preselected. As N5C: the invitation under the candidate lists → `/flows/shift-swap/detail-view/<id>`; back (do not answer).
Expect: DOM rows = API ids; placeholders on empty sections; routes as listed. Do not cancel the swap (PV reads it next).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
