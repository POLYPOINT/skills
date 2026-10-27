# Family TS — Timesheet in window W-X-TIMESHEET (HPN-17, 18, 19, 20) · N4 (N4B optional)

|                           |                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | Step 0 (flag ON), HPN-17, HPN-18 (steps 1–4), HPN-19, HPN-20, Step 9 (flag OFF), HPN-18 step 5                                                       |
| Actors                    | N4 `{{N4_LOGIN}}` ({{N4_ID}}); N4X employment id {{N4X_ID}} (no login); optional N4B `{{N4B_LOGIN}}` ({{N4B_ID}}); portal ops = `{{PORTAL_PROFILE}}` |
| Months                    | M0 `{{MONTH}}`, M−1 `{{MM1}}`, M+1 `{{MP1}}` (Sollplan saved), M+2 `{{MP2}}` (no Sollplan), beyond look-ahead `{{MP13}}`                             |
| Days (DB check)           | `{{GD1}}`, `{{GD2}}`, `{{GD3}}` (N4's planned days of M0 / M−1)                                                                                      |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/TS` (fresh: no timesheet toggle entry in storage) · `{{RUN_DIR}}/TS/<id>/`                                      |
| Read first                | the group brief; scenarios.md HPN-17..20; `known-deviations.md` HPN-K1, HPN-K5; seed log (T1 version gate `{{VERSION_GATE}}`, T2 Sollplan)           |
| Window                    | **W-X-TIMESHEET** must be `active` before Step 0; re-read it before Step 9                                                                           |

## Step 0 — before and after the flag

1. N4 (flag OFF): `month-report?month={{MONTH}}` → the month table `pp-month-report-table`, no timesheet call (screenshot `00-before.png`).
2. `flag read` → `flag-before.json` (expected false); `"flag set {{TENANT}} poma.flows.timesheet true"`; N4 script `waitFlag(api, 'poma.flows.timesheet', true, 8)` → `features-on.json`.

## HPN-17 — Timesheet gate and default (mock) path

1. `month-report?month={{MONTH}}` → `pp-timesheet` replaces the table; request `GET /api/mobile/timesheet/v1/reports?employment-id={{N4_ID}}&month={{MONTH}}&mock=true` → `timesheet-M0-mock.json`. 2. Record `envelope.month`, `employmentId`, `isPublished`, `formatted` (example: `2026-08`, `4711`, `true`, `false`, or a per-employment mock). 3. UI: `.timesheet-info-banner` "Prüfen Sie Ihre erfassten Arbeitsstunden und Zulagen im <Monat> <Jahr>." for M0; one `pp-timesheet-account-section` per `accounts[]` (first expanded, titles = `sectionTitle`); `pp-benefits-overview-section`; filter "Alle Tage" / "Nur mit Zulagen"; day rows = `days[]`. 4. "Nur mit Zulagen" → only days with allowance rows; none → `.timesheet-no-allowance-days` + button back to "Alle Tage". 5. Month selector → `{{MP1}}` → no banner (future); content (the example is published). 6. Toggle "API-GW" twice (back to on) → requests carry `mock=false` then `mock=true`; the storage entry ending in `timesheet_mock` follows → `storage.json`.
   Expect: gate as listed; the cloud relays the api-gw document unchanged; UI counts = JSON counts.

## HPN-18 — Timesheet API negatives and error rendering (steps 1–4 now, step 5 after Step 9)

1. `api.call('GET', '/api/mobile/timesheet/v1/reports?employment-id={{N4X_ID}}&month={{MONTH}}&mock=true')` → 403 (employment ownership). 2. `…&month=2026-13` with own employment → 400. 3. `…&month={{MONTH}}` without `employment-id` → 400. 4. `page.route('**/timesheet/v1/reports**', r => r.fulfill({status: 416, body: '{}'}))` → `month-report?month={{MM1}}` → record what is shown (empty content state, no dialog → **KNOWN-FAIL HPN-K5**); repeat with 500 → global error dialog + empty content (record). Unroute.
   Expect: 403 / 400 / 400; UI behaviour recorded (step 5 below).

## HPN-19 — Timesheet real api-pp path (version-gated)

`{{VERSION_GATE}}` = fail → run steps 1 and 4 once to show the drift: example document or 403 + dialog → **KNOWN-FAIL HPN-K1**; anything else odd → BLOCKED "version gate" (no further steps).
Pre: toggle "API-GW" **off** (storage `timesheet_mock` false). 1. `month-report?month={{MONTH}}` → `mock=false`; `envelope.employmentId` = N4's employment, `envelope.month` = `{{MONTH}}`. 2. Banner for M0, accounts from the response, day rows only for assigned days. 3. `{{MM1}}` → content (empty figures allowed). 4. `{{MP2}}` (no Sollplan) → 416 → `.timesheet-no-planning` "Noch keine Planung für <Monat> <Jahr>", **no** error dialog; "Zum aktuellen Monat" → URL `month={{MONTH}}`. 5. `{{MP1}}` (Sollplan saved) → 200, `envelope.isPublished=true`, content without banner, future figures (PPCLOUD-14472). 6. `{{MP13}}` → 416 → no-planning state (record the configured look-ahead). 7. DB: for `{{GD1}}`, `{{GD2}}`, `{{GD3}}`: `sql.sh {{TENANT}} "SELECT TO_CHAR(ZA_DATUM,'YYYY-MM-DD')||' min='||SUM(ZEIT)/60 FROM ECBERN.ZEITANRECHNUNG WHERE MITARBEITER_ID={{N4_ID}} AND ZA_DATUM = DATE '<day>' AND AN_ZEITKONTO = 1 GROUP BY ZA_DATUM;"` (Σ GLAZ credit of the day, the query of the UTR oracle) vs the day row "Angerechnet" (seconds → H:mm; mapping to confirm on the first run).
Expect: as listed.

## HPN-20 — Inactive-employment snackbar (optional)

Only if seed T3 gave N4B two employments (A ends before M0, B continues); else BLOCKED-data "no multi-employment HP". As N4B: 1. `month-report?month={{MM1}}`, select employment A. 2. Switch to `{{MONTH}}` → tabs fall back to B; snackbar "<A>: keine Anstellung ab <Monat> <Jahr>" / "Sie sehen deshalb den Zeitausweis <B>…"; request for B. 3. "Schliessen" → gone; another month change → not shown again unless the fallback repeats.
Expect: as listed; no 403 for A's employment in M0.

## Step 9 — restore, then HPN-18 step 5

1. `"flag set {{TENANT}} poma.flows.timesheet false"` (never delete the override); `waitFlag(…, false, 8)`; `month-report?month={{MONTH}}` shows the table again; save `restore-proof.json` (flag read + fresh features).
2. HPN-18 step 5: direct `api.call` to the reports endpoint → the feature-disabled status (record code and body of `@EnabledByFeature`).

## Cleanup checklist

- Flag false proven by `restore-proof.json`; no route left active; the API-GW toggle back to on in your profile.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
