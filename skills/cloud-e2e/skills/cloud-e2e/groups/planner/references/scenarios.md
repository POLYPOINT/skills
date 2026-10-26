# Group planner — scenario catalogue (PSP, 21 runnable + PSP-14 merged)

Converted from `areas/pool-sp/scenarios.md` (A-pool-sp, 2026-10-22) with the S1 reconciliations of 2026-10-23:

- environment = **DM-Y** (shared with utr, auth, ops); flags = steward baseline; the planner / pool-manager / tenant-admin groups and the POMA shift types come from the steward kits — this group moves only its own claimed actors (`data-plan.md`);
- **PSP-14 merged into SWP-15** (group swap); F9 dropped;
- moved out to group `manual`: PSP-23 (smartPEP planning wish v2), PSP-24 (PEP entry points);
- the orchestrator's PEP / job steps are worker steps now: paints with `pp-plan.sh` (PEP fallback under the db lock), jobs through `portal-ops.mjs job run … --tenant <env>` inside J-Y-JOBS, PSP-21 inside W-Y-SOLLPLAN after utr;
- harness names: `app.mjs --app poma|mypp` (was `mypp.mjs` + extension H-1), `roles(api)` (was H-2), `--downloads` (was H-3).

Families: NAV (PSP-01..03) · POOL (04–07, 19) · METRICS (08) · PERM (09–11) · SP (12, 13; 14 merged) · ADMIN (15) · CONF (17, 18, 16) · PEPSET (20, 21) · WISH (22). Worker-facing steps: `assets/family-briefs/<F>.md`; known deviations: `known-deviations.md`.

Conventions used by every scenario:

- **Environment.** DeployMate env DM-Y (`customer-roster`, master pin, 50 people; shared with utr, auth, ops), cloud tenant = env id `<env>`. Planner web app `https://ct-poma-webapp.dev.k8s.polypoint-dev.com`, poma-api `https://ct-poma-api.dev.k8s.polypoint-dev.com`. PEP on the box through pep-verify under the db lock `locks/<env>~pep`. Nothing in this catalogue calls a test-data endpoint, `POST /api/private/gat/clean` or `POST /api/private/gat/shift-trades` (stage-wide / all-HP side effects).
- **Actors** (logical names; tokens in the briefs: PLAN-ALL = `PLANALL`, SP-A = `SPA`, PM-A = `PMA`, SEED-SP = `SEEDSP`; mapped to seed logins in the group seed, `data-plan.md` §2): `PLAN-ALL` (kit `E2E:PLANALL`: 1050 / 1060 / 1061 / 1070 on all nodes → POOL_MANAGER + SHIFT_PLANNER), `SP-A` (kit `E2E:SP-GA`: 1050 / 1061 / 1070 on Gruppe G-A only), `PM-A` (kit `E2E:PM-GA`: 1060 on G-A only), `TA` (kit `E2E:TA`: myPOLYPOINT 2610 / 200015 → TENANT_ADMIN; borrowed read-only by auth and ops), `SEED-SP` (an untouched seed login, only `DMSEED:Planner` = 1050 + 1070 on all nodes), HPs `HP1..HP9` (HP1–HP4, HP7–HP9 in G-A, HP5–HP6 in G-B). Pools `P-A` (a Station of G-A; HP1, HP2, HP3, HP4) and `P-B` (Station of G-B; HP5, HP6).
- **Days** (tokens, Europe/Zurich, run date R): `D1` = first weekday ≥ R+7 (bookings, find-HP); `D2` = first weekday ≥ R+9 with no plan for HP3 on D2−1 and D2 (night → early); `D3` = first weekday ≥ R+5 with no plan for HP4 (cleanup); `M1` = the calendar month after R (Sollplan gate); `DW` = first weekday ≥ R+14 in an open planning period (wishes). All lie within today + 3 months (`poma.onPrem.conflictCheckingMonths` default 3).
- **UI.** Planner web through `scripts/harness/app.mjs <env> <login> <script> <outdir> --app poma` (login predicate accepts `/pool-manager/`, `/shift-planner/`, `/tenant-admin/`, `/invalid-user`); routes are passed to `api.goto()` without the `/tabs/` prefix, so they resolve against the webapp root. myPP steps (HP) use `--app mypp` with `/tabs/…` routes. `--downloads` captures the CSV of PSP-08. No `data-test` attributes exist: the ids named below are real element ids, the rest is visible text (German UI, `de-CH`).
- **API evidence.** The harness records every `/api/` response under `api/NNN-*.json`. Direct calls use `api.call()` with the captured bearer (never printed or saved). Token roles: `roles(api)` of `e2e-lib.mjs` decodes the JWT in memory and returns only the role names (`roles.json`).
- **Oracle.** Back-end responses (`/api/private/...`, `/api/mobile/health-professional/v1/...`), Oracle rows on the box (`scripts/sql.sh`, `scripts/plan-day.sh`, `../scripts/planner-checks.sql`; read-only unless a step says otherwise), notification-center rows (`GET /api/mobile/health-professional/v1/notifications`). Screenshots are evidence, never the oracle.
- **Evidence naming**: `NN-<step>.png`, `<endpoint>.json`, `oracle-<what>.json|txt`, `notes.md`; every FAIL gets an outlined issue shot (`e2e-lib.mjs` `issueShot`).
- **Bundle classes.** `master` (26.99 nightly, every capability incl. `DIENST.INTERNER_POOL`) and `main-26` (26.0.x: no `INTERNER_POOL` column, migration `feature-26-3`). Expectations that differ are stated per class.
- **Ownership.** Each scenario lists the actors and days it owns; never run two scenarios that write the same actor / day at once. Tenant-wide effects run in their windows: W-Y-CONFRULE (PSP-16), W-Y-SOLLPLAN (PSP-21), J-Y-JOBS (PSP-18, PSP-19).

## Gates (runner, group seed, before any scenario)

- **PSP-G1 roles in the token.** Log in once as every actor; save the decoded role list. Expected: PLAN-ALL ⊇ {ROLE_POOL_MANAGER, ROLE_SHIFT_PLANNER}, SP-A has ROLE_SHIFT_PLANNER and not ROLE_POOL_MANAGER, PM-A has ROLE_POOL_MANAGER and not ROLE_SHIFT_PLANNER, TA has ROLE_TENANT_ADMIN. Record what SEED-SP carries (open question: guess HP only). A missing role → BLOCKED for every scenario of that actor, reason "role not in token" (fix: group seed R-steps / steward role kit).
- **PSP-G2 allowed nodes.** As SP-A and PM-A: `GET /api/private/organization/readable-nodes` returns only the G-A subtree; as PLAN-ALL the whole tree. Otherwise the restricted actor is still in an all-node group (group seed: SPA / PMA must leave `DMSEED:Planner`).
- **PSP-G3 fixtures.** P-A and P-B exist with their members (`GET /api/private/tenant/pools/{id}/users` as PLAN-ALL); HP1–HP4 have an availability on D1 (any shift type their Dienst maps to).
- **PSP-G4 POMA shift types.** `GET /api/private/shift-definition/roster?group-node-id=<G-A>&from=D2&to=D2&include-presences=true&shift-type-filter=USE_IN_PLANNING` as PLAN-ALL lists at least one definition with POMA type EARLY and one NIGHT (PSP-17 needs both; else BLOCKED "no EARLY / NIGHT Dienst"; the definitions kit sets them).

---

### PSP-01 Role landing, menus and profile menu per role (desktop)

> Data prerequisite: group seed actors (R1–R4) and gate PSP-G1. Read-only.
> Pre: viewport 1280×900; fresh harness profile per actor.
> Steps: 1. Log in as PLAN-ALL at the webapp root; record the landing URL. 2. Read the side menu: elements `#dashboard-menu-item`, `#pool-management-menu-item`, `#pool-metrics` and their texts. 3. Open `/shift-planner/dashboard`; read the menu (`#dashboard-menu-item`, `#find-health-professional-menu-item`, `#manage-shift-bookings-menu-item`, `#manage-opportunities-menu-item`, `#shift-swap-marketplace`). 4. Click the user name in the header (`.user-container`): the panel shows name, e-mail, "Sprache", "Ausloggen". 5. Repeat 1–2 as SP-A, PM-A, TA (TA menu: `#dashboard-menu-item`, `#manage-conflicts-rules-menu-item`). 6. Breadcrumb: the active label reads "Übersicht".
> Expect: landing PLAN-ALL and PM-A `/pool-manager/dashboard`, SP-A `/shift-planner/dashboard`, TA `/tenant-admin/dashboard` (root order PM → SP → TA → HP). Menus: PM = Übersicht / Pool Management / Pool-Metriken; SP-A = Übersicht / Mitarbeitende finden / Geplante Dienste verwalten / Anfragen verwalten / Diensttausch; TA = Übersicht / Konfliktregeln konfigurieren. Profile panel with the four entries. No console errors (`harness.log` PAGEERROR / CONSOLE lines).
> Oracle: landing URL per actor; menu element ids present / absent; `roles.json`; `GET /api/private/users/current` 200 for each.
> Evidence: 01-landing-<actor>.png, 02-menu-<actor>.png, 03-profile-panel.png, roles-<actor>.json, users-current-<actor>.json.
> Source: 11462934676#1, 11466571777#1, 11526537222#3; POMA-SHELL-01, POMA-SHELL-03; `redirectEmptyRoute.guard.ts:24-38`, `menu.service.ts:162-198`.

### PSP-02 Small-screen navigation (< 960 px)

> Data prerequisite: none beyond PSP-G1. Read-only.
> Pre: viewport 800×900 (also run 390×844 once), as SP-A and PM-A.
> Steps: 1. Open the dashboard; check the desktop nav (`.pdx-menu-item-desktop`) is hidden and `#menu-button` is visible. 2. Click `#menu-button`; the mobile list (`.pdx-menu-item-mobile`) shows the same items as PSP-01. 3. Click "Anfragen verwalten" (SP-A) / "Pool Management" (PM-A): the route changes and the drawer closes. 4. Tap the user icon in the header: the profile panel opens with "Sprache" (the user name text is hidden).
> Expect: as described; the language selector is in the header profile panel, not in the drawer.
> Oracle: element visibility (`isVisible()`), route after the click, drawer state (`mat-sidenav` `opened`).
> Evidence: 01-closed.png, 02-drawer-open.png, 03-after-nav.png, 04-profile-panel.png.
> Source: 11462934676#2, 11466571777#2, 11462934676#6 (small-screen part, corrected); `container.component.ts:31`, `pdx-sidenav.component.scss:18-28`.

### PSP-03 Localization: switch, persistence, query parameter

> Data prerequisite: none. Read-only (user-level language preference only).
> Pre: as SP-A, PM-A, TA; start language DE.
> Steps: 1. Profile panel → "Sprache" → list the offered languages (`.language-panel-option`). 2. Choose Français. 3. Read `#dashboard-menu-item` text and two page titles; scan the DOM text for untranslated keys (regex `\b[A-Z_]{3,}\.[A-Z_.]{3,}\b`). 4. Navigate to two other pages (SP: Anfragen verwalten, Diensttausch; PM: Pool Management, Pool-Metriken; TA: Konfliktregeln) and repeat the scan. 5. Reload the page: language still FR. 6. Open `/shift-planner/dashboard?lang=it` (SP-A): Italian. 7. Restore DE.
> Expect: texts match `polypoint-poma-frontend/src/assets/i18n/<lang>.json` (DE "Übersicht", FR "Aperçu", IT "Panoramica", EN "Dashboard"); the selected language is ticked; no raw keys; the choice survives navigation and reload.
> Oracle: DOM texts vs the i18n files of the deployed build (`/assets/i18n/<lang>.json` fetched from the webapp); raw-key scan count = 0.
> Evidence: 01-languages.png, 02-fr-<page>.png …, i18n-fr.json, rawkeys.txt.
> Source: 11462934676#6, 11466571777#6, 11526537222#2; POMA-SHELL-07 (PPCLOUD-13933).

### PSP-04 Pool-manager dashboard tiles and links

> Data prerequisite: P-A, P-B and the list pools `PSP-LIST-01..11` (group seed F2); no member with an expired employment (PSP-19 not yet run).
> Pre: as PLAN-ALL.
> Steps: 1. Open `/pool-manager/dashboard`; capture `GET /api/private/tenant/pools`, `…/pools-with-unresolved-users`, `GET /api/private/users?page-size=3…`. 2. Count the rows of the "Pools" and "Mitarbeitende" tiles. 3. Click "Alle anzeigen" of Pools → URL `/pool-manager/manage-pools/edit`, tab "Pool bearbeiten" active, menu "Pool Management" active. 4. Back; "Alle anzeigen" of Mitarbeitende → `/pool-manager/manage-pools/hp`. 5. Back; click `#add-pools-btn` → `/pool-manager/manage-pools/add`. 6. Check that the unresolved section (title "Pools mit Mitarbeitende mit abgelaufenen Beschäftigungsverhältnissen") is absent.
> Expect: ≤ 3 rows per tile, equal to min(3, API total); links as above; no unresolved section when the API list is empty.
> Oracle: API totals vs rendered rows; URLs; `pools-with-unresolved-users` `pools` = [].
> Evidence: 01-dashboard.png, pools.json, unresolved.json, 02..04 link shots.
> Source: 11466571777#3–#5, 11485380609#3; POMA-POOL-01.

### PSP-05 Create a pool (happy path and validation)

> Data prerequisite: none beyond P-A's Station; the malformed-e-mail variant (step 7) needs group seed F4 (HP5's on-prem e-mail set to `psp-invalid@@example`), else that step is BLOCKED.
> Pre: as PLAN-ALL; pool name `PSP-NEW-<run>`.
> Steps: 1. `/pool-manager/manage-pools/add`. 2. `#save-pool-btn` is disabled. 3. Type the name in `#pool-name`, press Enter: no request is sent. 4. Open `#pool-category`, pick the P-A Station in the tree dialog. 5. Open `#hp-pool-node`, pick the same Station; in the HP table select HP1 and HP2. 6. Save; capture `POST /api/private/tenant/pools-with-users`. 7. (variant) New pool `PSP-BADMAIL-<run>` with HP5 selected: the message `POOL_PROVIDER.ERRORS.INVALID_EMAIL` naming HP5 shows and save stays disabled; cancel. 8. Open the new pool's row (expand) and `GET /api/private/tenant/pools/{id}/users`.
> Expect: step 2 disabled; step 3 no POST; step 6 → 201 and the browser lands on `/pool-manager/manage-pools/edit` with the new pool listed; members = HP1, HP2 with their employment assignment (`pep_employment_id` not null); step 7 blocked.
> Oracle: `pools-with-users` 201 body (`id`, `name`, `associated_node_id` = the Station); `pools/{id}/users` 2 rows; no POST in step 3 / 7 (api index).
> Evidence: 01-empty-form.png, 02-filled.png, pools-with-users.json, pool-users.json, 03-badmail.png.
> Cleanup: delete `PSP-NEW-<run>` via the list (PSP-06 may reuse it) or `DELETE /api/private/tenant/pools/{id}`; log it in `created_data`.
> Source: 11466571777#7, #12; POMA-POOL-02 (PPCLOUD-14431, PR 10544, `pool-management.component.html:36-40`).

### PSP-06 Manage pools: filter, sort, paging, expand, edit, delete

> Data prerequisite: `PSP-LIST-01..11` (group seed F2, 11 pools on a G-A Station, no members) + P-A.
> Pre: as PLAN-ALL, page size 10.
> Steps: 1. `/pool-manager/manage-pools/edit`; capture `GET /api/private/tenant/pools?page-size=10&current-page=0`. 2. Page 2 via the paginator; then page size selector 20. 3. Type `PSP-LIST-0` into `#pool-filter-input`: request with `name-filter`. 4. Click the pool column header twice (sort). 5. Expand P-A: the member list shows HP1–HP4. 6. Edit `PSP-LIST-01`: rename to `PSP-LIST-01-RENAMED`, add HP3 from the P-A Station, `#save-pool-btn-update`. 7. Delete `PSP-LIST-02`: in the dialog type a wrong name (OK `#delete-confirmation-dialog-ok` disabled), click `#delete-confirmation-dialog-cancel` (pool still listed); delete again with the exact name.
> Expect: totals consistent (`total_pools` ≥ 12, page 2 shows the remainder); filter → only matching names; sort toggles order; edit → 200 and the list shows the new name with 1 member; cancel keeps the pool; exact name → `DELETE …/pools/{id}` 200 and the pool is gone from the next GET.
> Oracle: `tenant/pools` responses before / after; `pools-with-users` 200 body; `DELETE` status; the deleted id absent.
> Evidence: 01-list.png, pools-p0.json, pools-p1.json, pools-filter.json, 02-expand.png, 03-edit.png, 04-delete-dialog.png, pools-after.json.
> Cleanup: none needed (fixtures are throwaway; rename back not required); log the rename and the delete.
> Source: 11466571777#8–#11, 11485380609#4–#5; POMA-POOL-03.

### PSP-07 Manage health professionals: filter, edit pools, special employments

> Data prerequisite: P-A, P-B. Variant b needs HP9 with two employments (group seed F5); variant c needs HP6 without a current employment, which PSP-19 produces (run c after PSP-19, else BLOCKED).
> Pre: as PLAN-ALL.
> Steps: 1. `/pool-manager/manage-pools/hp`. 2. Pick the G-A Station in the category tree; the autocomplete `#health-professional-list-select` appears; choose HP4. 3. Edit page `/pool-manager/manage-pools/hp/<subject>`: only the pool section is editable. 4. Add pool `PSP-LIST-03`, save `#saveHealthProfessionalBtn`; capture `PUT /api/private/organization/available-health-professionals/{subject}`. 5. Remove it again (confirmation), save. 6. (b) HP9: adding a pool asks which employment; choose the second; save. 7. (c) HP6: adding a pool is possible although no employment is current (PPCLOUD-14554).
> Expect: PUT 200 each time; `GET /api/private/tenant/pools/{PSP-LIST-03}/users` lists HP4 after step 4 and not after step 5; (b) the stored affiliation carries the second employment id; (c) save succeeds and the affiliation is "unresolved" or the chosen employment, never null (PPCLOUD-14312).
> Oracle: PUT bodies + status; pool-users lists; for (b)/(c) the `user_pool_affiliations` of `GET /api/private/organization/available-health-professionals/{subject}`.
> Evidence: 01-filter.png, 02-edit.png, put-_.json, pool-users-_.json.
> Source: 11466571777#13–#14, 11485380609#6; POMA-POOL-04 (PPCLOUD-14554, -14448, -14312).

### PSP-08 Pool metrics: tabs, filters, paging, CSV, 12-month limit

> Data prerequisite: at least one booking in P-A in the last or next month (group seed F6 booking on D1) and the availability audit rows of HP1–HP4 (created with their availabilities). IPO rows only if the booking area ran IPOs on this tenant (else that tab may be empty: not a FAIL).
> Pre: as PLAN-ALL.
> Steps: 1. `/pool-manager/pool-metrics`; tabs "Buchungen", "Interne Pool Anfragen", "Verfügbarkeiten". 2. Per tab: set `#metrics-from-date` = R−30, `#metrics-end-date` = R+60; capture the paged request (`internal-pool-metrics/assignments|opportunities`, `availabilities-audit-log` with `page-size` / `current-page`). 3. Filter pools (`#pool-filter`) = P-A and shift type; compare. 4. Click "Download CSV"; save the file (Playwright download). 5. Limit: as PLAN-ALL call `GET /api/private/internal-pool-metrics/assignments?from=<R−395>&to=<R>&page-size=10&current-page=0` (13 months) and the same with `from=<R−365>` (12 months); same for `availabilities-audit-log`. 6. In the UI set a 13-month range: an error dialog appears.
> Expect: table rows = API rows of the page, paginator total = API total; CSV = header + one line per row of the unpaged API answer (`…/csv`), booking of F6 present; step 5: 13 months → **416** with error code `EXCEEDED_MONTH_TIMESPAN`, 12 months → 200.
> Oracle: API JSON vs table vs CSV line count; status codes and error body.
> Evidence: 01..03 tab shots, metrics-\*.json, bookings.csv, limit-13m.json, limit-12m.json, 04-limit-dialog.png.
> Source: 11466571777#15, 11525521495#3; POMA-METRICS-01..03; `InternalPoolMetricsApiController.java:114-118`.

### PSP-09 Node-restricted pool manager sees only its nodes and pools

> Data prerequisite: group seed R2 (PM-A in group `PSP:PM-A`, node selection G-A, not in `DMSEED:Planner`), gate PSP-G2, P-A + P-B.
> Pre: as PM-A, then as PLAN-ALL for the comparison.
> Steps: 1. As PM-A open `/pool-manager/manage-pools/add`; open `#pool-category`: read the tree; capture `GET /api/private/organization/readable-nodes`. 2. Open the HP tab tree: same nodes. 3. Pool list `/pool-manager/manage-pools/edit`: capture `GET /api/private/tenant/pools`. 4. Direct call as PM-A: `GET /api/private/tenant/pools/{P-B id}` and `GET /api/private/tenant/pools/{P-B id}/users`. 5. Oracle query on the box: the node selection of PM-A's group (`POLYUSER` → `POLYUSER_POLYUSRGRP` → `POLYUSRGRP.POLYKNOTENAUSWAHLID_SICHTBAR` → `POLYKNOTENAUSWAHL_DETAIL.KNOTEN_ID`) and the subtree below it (`HIERARCHIE`). 6. As PLAN-ALL repeat step 3. 7. (optional, PEP lock) pep-verify as PM-A: Datei → Planblatt bearbeiten, read the group list.
> Expect: the tree and the readable-nodes answer contain exactly the G-A subtree; PM-A's pool list contains P-A and the `PSP-LIST-*` pools, never P-B; PLAN-ALL's contains both; step 4 answers 403 / 404 or an empty list (record which; a 200 with P-B's data is a FAIL).
> Oracle: readable-nodes node ids = DB node selection subtree; pool ids per actor; step 4 status.
> Evidence: readable-nodes-pma.json, readable-nodes-planall.json, pools-pma.json, pools-planall.json, oracle-nodes.txt, 01-tree.png.
> Source: 11525521495#1, #2, #6; POMA-POOL-02/03; `NodeService.java:134-143`, `PoolRepository.java:22-30`.

### PSP-10 Node-restricted shift planner: find-HP and bookings limited to accessible pools

> Data prerequisite: group seed R1 (SP-A, G-A only), PSP-G2, P-A + P-B, availabilities of HP1–HP4 (G-A) and HP5 (G-B) on D1, bookings F6 (HP1 in P-A) and F7 (HP5 in P-B) on D1.
> Pre: as SP-A, then PLAN-ALL.
> Steps: 1. As SP-A `/shift-planner/health-professionals?date=D1`; pick the roster (`#search-filters-roster-filter`) and the Dienst (`#shift-definition-type-field`); read the pool options of `#pool-multiselect-filter`; capture `GET /api/private/tenant/consumable-pools` and `GET /api/private/tenant/consumable-pools/availabilities?date=D1&shift-type=…`. 2. `/shift-planner/manage-shift-bookings/internal-pool`: read the options of `#manage-bookings-pool-filter`; capture `GET /api/private/assignments`. 3. Filter by date (`#manage-bookings-date-filter` = D1), shift type, pool P-A. 4. As PLAN-ALL repeat 1–2.
> Expect: SP-A: pool options and `consumable-pools` = P-A (+ `PSP-LIST-*`), no P-B; available users only from P-A (HP5 absent); bookings list contains F6, not F7; PLAN-ALL sees both pools and both bookings. Filters narrow the list consistently with the request parameters.
> Oracle: pool ids in `consumable-pools`; `data[].pools[].id` of the availabilities answer; `assignments` `data[].pool_id`.
> Evidence: consumable-pools-spa.json, availabilities-spa.json, assignments-spa.json, …-planall.json, 01-find-hp.png, 02-bookings.png.
> Source: 11525521495#4, #5, 11484037225#9–#11, #13; POMA-FINDHP-01, POMA-BOOK-01; `AssignmentService.java:69-85`.

### PSP-11 Rights matrix and direct-URL guards (PPCLOUD-14334)

> Data prerequisite: PSP-G1 (incl. what SEED-SP carries). Read-only.
> Pre: actors SEED-SP (1050 + 1070 only), SP-A (no 1060), PM-A (no 1061 / 1070 / 1050).
> Steps: 1. As SEED-SP (only if PSP-G1 shows ROLE_SHIFT_PLANNER; else record "HP-only" and skip to 3): read the menu; open by URL `/shift-planner/health-professionals`, `/shift-planner/manage-shift-bookings/internal-pool`, `/pool-manager/manage-pools/add`. 2. Same user: `/shift-planner/manage-opportunities` and `/shift-planner/shift-swap-marketplace` (allowed by 1050 / 1070). 3. As SP-A: open `/pool-manager/manage-pools/add` and `/pool-manager/pool-metrics`; dashboard: the "Nächste gebuchte Dienste" tile. 4. As PM-A: open `/shift-planner/dashboard`, `/shift-planner/health-professionals`, `/shift-planner/shift-swap-marketplace`. 5. API: as SP-A `GET /api/private/tenant/pools` and `POST /api/private/tenant/pools-with-users` with an empty pool body; as PM-A `GET /api/private/assignments`.
> Expect: menu items exactly as the rights allow (SEED-SP: Übersicht, Anfragen verwalten, Diensttausch); each forbidden URL redirects to the actor's role dashboard (`/shift-planner/dashboard` or `/pool-manager/dashboard`) or to `/invalid-user` when the role is missing; SP-A sees no upcoming-bookings tile (needs manage pools: record as observation G-14); API: SP-A → 403 on pool endpoints (role check), PM-A → 403 on assignments (no SP role).
> Oracle: final URL after each direct navigation; menu ids; API status codes.
> Evidence: nav-<actor>-<route>.png, api-<actor>-<call>.json, notes.md (matrix table).
> Source: gap G-03, G-14; POMA-SHELL-03, `FE/service/route-access.service.ts:14-57`, `FE/flows/guards/manage-pools-access.guard.ts:7-21`.

### PSP-12 Shift-planner dashboard tiles, links and info button

> Data prerequisite: booking F6 (upcoming, P-A) and ≥ 1 OPEN opportunity visible to the actor: group seed F8 (GAT `POST /api/private/gat/resource-replacements` called **as SP-A**, so only P-A pools are used) or a real RR / IPO of the booking area in P-A.
> Pre: as PLAN-ALL (has manage pools + book → both tiles), then SP-A.
> Steps: 1. `/shift-planner/dashboard` as PLAN-ALL; capture `GET /api/private/assignments?…` and `GET /api/private/opportunities?page-size=3&current-page=0&opportunity-state=OPEN&sort-direction=ASC&expand=applications`. 2. Tile "Nächste gebuchte Dienste": ≤ 3 rows (date `DD.MM.YYYY` + HP name); "Alle anzeigen" → `/shift-planner/manage-shift-bookings` (menu "Geplante Dienste verwalten" active). 3. Tile "Publizierte Anfragen": ≤ 3 OPEN requests; the info icon of row 1 → RR / IPO detail route by type; "Alle anzeigen" → `/shift-planner/manage-opportunities`. 4. `#find-hp-btn` → `/shift-planner/health-professionals`. 5. As SP-A: the bookings tile is absent (no manage pools).
> Expect: as described; rows match the first entries of the API answers; empty lists show "Keine anstehenden Dienste" / "Keine verfügbaren Anfragen" without "Alle anzeigen".
> Oracle: API answers vs rows; target URLs; tile presence per actor.
> Evidence: 01-dashboard-planall.png, assignments.json, opportunities.json, 02..04 link shots, 05-dashboard-spa.png.
> Source: 11462934676#3–#5, 11484037225#3–#8; POMA-SP-01; `dashboard.component.ts:67-123`.

### PSP-13 Manage requests: filters, "only mine", click routing

> Data prerequisite: as PSP-12 (F8 opportunities created by SP-A across several days D+3..D+10; at least one RR and, if available, one IPO).
> Pre: as SP-A, then PLAN-ALL.
> Steps: 1. `/shift-planner/manage-opportunities` as SP-A: defaults Status "Offen", toggle "Nur meine Anfragen" on; capture `GET /api/private/opportunities` (params `opportunity-state=OPEN`, `only-mine=true`). 2. Date range (`#opportunities-date-range-filter`) covering two GAT days: every returned `shift_requests[0].start` inside. 3. Status (`#opportunities-state-filter`) → another state; sorting (`#opportunities-sorting-filter`) ASC / DESC: order of start dates flips. 4. Roster (`#opportunities-planning-roster-filter`) = a G-A roster (`node-id` param). 5. Click an RR row → `/shift-planner/manage-opportunities/resource-replacement/details/<id>`; an IPO in PENDING/DRAFT → pending page, other IPO → IPO details. 6. As PLAN-ALL with "Nur meine Anfragen" on: SP-A's requests are absent; toggle off: present.
> Expect: each response honours its parameters; routing as stated (`opportunities-list.component.ts:95-107`). Guess to verify: GAT rows carry SP-A as creator; if `only-mine=true` returns nothing for SP-A, record it and continue with the toggle off (note, not FAIL).
> Oracle: request query strings + response fields (`state`, `shift_requests[].start`, node, `type`).
> Evidence: opp-default.json, opp-range.json, opp-state.json, opp-sort-asc.json, opp-sort-desc.json, opp-roster.json, 01..05 shots.
> Source: 11462934676#7–#8, 11484037225#18–#19; POMA-OPP-01 (PPCLOUD-12073).

### PSP-14 Shift-swap list and detail, read-only — merged into SWP-15 (group swap)

> S1 reconciliation: same list, filters, reset and modal states as SWP-15; the swap group runs it (SWP-15 step 6, read-only modal). No planner prompt, no planner verdict; the dashboard row shows "merged → SWP-15". Area step F9 (a swap made only for PSP-14) is dropped.

### PSP-15 Tenant-admin pages load (read)

> Data prerequisite: group seed R4 (TA), PSP-G1; pools exist.
> Pre: as TA.
> Steps: 1. `/tenant-admin/dashboard`; capture `GET /api/private/tenant-admin/pools?page-size=100&current-page=0`. 2. Count the list rows and the paginator (10 per page). 3. Type `PSP-LIST` into `#tenant-admin-pool-filter-select`: only matching pools. 4. Click a pool row: no detail view opens (expected today). 5. Menu "Konfliktregeln konfigurieren" → `/tenant-admin/manage-conflicts-rules`; capture `GET …/conflict-checker/admin/config/<env>` and `GET …/conflict-checker/admin/rules`; the header shows the tenant id; chips of `#tenant-group-rules` = configured groups.
> Expect: list = all `pools` of the API (P-A, P-B, `PSP-LIST-*`, other areas' pools), paged by 10, filter matches substrings; both pages load without console errors; rule chips = `rule_groups` of the config answer (default BOOKING_RULES + AVAILABILITY_RULES once the tenant was seen by the conflict checker).
> Oracle: API vs list; config JSON vs chips.
> Evidence: 01-dashboard.png, tenant-admin-pools.json, 02-filter.png, 03-rules.png, cc-config.json, cc-rules.json.
> Source: 11526537222#1, #3; POMA-ADMIN-01..03.

### PSP-16 Tenant-admin conflict rule reaches "Mitarbeitende finden"

> Data prerequisite: TA, PLAN-ALL, availabilities of HP1–HP4 on D1. **Exclusive**: the extra rule hits every find-HP search of the tenant.
> Pre: record the current config (PSP-15 step 5) as the restore value.
> Steps: 1. As TA add the extra rule `ALWAYS_CONFLICT_TEST_RULE` in `#tenant-extra-rules`; click `#save-conflict-rules`; capture `PUT …/conflict-checker/admin/config/<env>` (no UI message is expected). 2. Reload the page: the chip is still there. 3. As PLAN-ALL find-HP for D1 (P-A): capture `GET /api/private/tenant/consumable-pools/availabilities`. 4. Remove the chip, save, reload; repeat step 3.
> Expect: PUT 200; after step 1 every `data[]` user has a `conflicts[]` entry with `rule` `ALWAYS_CONFLICT_TEST_RULE`, `severity` HINT, and the result list shows "Testkonflikt-Regel"; after step 4 no such entry.
> Oracle: PUT status + GET config after reload; `conflicts[]` of the availabilities answer before / after.
> Evidence: put-config.json, config-after.json, availabilities-with-rule.json, availabilities-without-rule.json, 01-hint.png.
> Restore: the recorded config (rule groups + extra rules), proven by a final GET.
> Source: gap G-04; POMA-ADMIN-03/04, POMA-CONF-02/03; `CC/rule/AlwaysConflictTestRule.java`, `conflict-messages_de.properties:7`.

### PSP-17 PEP night shift raises the cloud warning for an early booking

> Data prerequisite: gate PSP-G4 (EARLY + NIGHT Dienste in G-A's palette), HP3 availability for the EARLY type on D2 (group seed F10), conflict checker enabled for the tenant (PSP-15 config not empty). PEP lock.
> Pre: HP3 has no plan on D2−1 and D2.
> Steps: 1. As PLAN-ALL find-HP D2, EARLY Dienst, pool P-A: HP3 listed; capture the availabilities answer (baseline: no `NO_EARLY_SHIFT_AFTER_NIGHT_SHIFT`). 2. Paint the NIGHT Dienst for HP3 on D2−1: `pp-plan.sh <env> <HP3> <D2−1> <NIGHT> FULL` (fallback `pe-paint.sh` under the PEP lock). 3. Wait for the event to reach the cloud cache: poll step 1 every 60 s for ≤ 10 min. 4. (optional, POMA ops ADMIN) `/ops/conflict-checker` Debug tab: HP3's cached shifts include D2−1. 5. Delete the painted shift (`pp-plan.sh … DELETE`); poll until the warning is gone (≤ 10 min).
> Expect: after step 3 HP3's `conflicts[]` holds `rule` `NO_EARLY_SHIFT_AFTER_NIGHT_SHIFT`, `severity` WARNING, `date` D2−1; the UI shows the warning on HP3's row; after step 5 it is gone. If it never appears: BLOCKED "conflict cache not fed on DM tenant" when the ops Debug tab shows no shifts for HP3 at all, FAIL when other shifts of HP3 are cached but not this one.
> Oracle: `conflicts[]` of the availabilities answer; PEP planning row (`PLANUNG` for HP3, D2−1) via `sql.sh`; ops Debug JSON if available.
> Evidence: avail-baseline.json, avail-with-night.json, avail-after-delete.json, oracle-planung.txt, 01-warning.png.
> Source: gap G-05; POMA-CONF-01/03/05 (PPCLOUD-14521); `CC/rule/NoEarlyAfterNightShiftAvailabilityRule.java`.

### PSP-18 Nightly cleanup deletes an availability blocked by a PEP presence

> Data prerequisite: HP4 availability on D3 (group seed F11, as HP4 in myPP); conflict checker enabled. PEP lock for step 2. Job trigger: inside J-Y-JOBS, `portal-ops.mjs … job run poma-core AvailabilityConflictChecker --tenant <env>` (portal ops Monitor → Job Management, OQ-21) **or** the scenario spans one night (cron 01:00) and is evaluated the next morning.
> Pre: as HP4 `GET /api/mobile/health-professional/v1/availabilities…` shows the D3 availability.
> Steps: 1. Paint a presence Dienst for HP4 on D3 (`pp-plan.sh`; fallback PEP under the lock). 2. Trigger the job (or wait until after 01:00). 3. As HP4 read the availabilities of D3; open myPP calendar D3 (`/tabs/…` calendar route) and the notification center. 4. As PLAN-ALL `/pool-manager/pool-metrics` tab "Verfügbarkeiten" for D3 (or `GET /api/private/availabilities-audit-log?from=…&to=…`). 5. Remove the painted presence (`pp-plan.sh … DELETE`).
> Expect: the D3 availability is gone; the audit log has a row for HP4 / D3 with action DELETED (the job writes events + audit log); HP4 is not offered by find-HP for D3.
> Oracle: availabilities GET before / after; audit-log row; PEP `PLANUNG` row for HP4 on D3.
> Evidence: avail-before.json, avail-after.json, audit-log.json, 01-calendar.png, job-trigger.txt.
> Source: gap G-06; POMA-CONF-04 (PPCLOUD-14501, -12150); `CORE/job/AvailabilityConflictCheckerCronJob.java:54,59`.

### PSP-19 Expired employment makes a pool member unresolved; the pool manager fixes it

> Data prerequisite: HP6 member of P-B with exactly one employment; job `EmploymentExpiration` trigger as in PSP-18 (inside J-Y-JOBS, `--tenant <env>`, cron 03:00 otherwise) and, if the cloud copy of employments is not refreshed by it, `ResyncUserEmployments` for the tenant (guess: verify which job reads the changed end date). The employment end is set by the worker in PEP under the lock (pep-verify exploratory, "Austritt").
> Pre: PM dashboard shows no unresolved section (PSP-04).
> Steps: 1. End HP6's employment at R−1 (PEP "Austritt", pep-verify exploratory under the PEP lock; record the old value) and enqueue the PSC event (`psc-enqueue.sh <env> employment <HP6>`). 2. Trigger the job(s) (or wait one night). 3. As PLAN-ALL open `/pool-manager/dashboard`; capture `GET /api/private/tenant/pools-with-unresolved-users`. 4. Edit P-B from the section: HP6 is flagged; remove HP6 (or, if HP6 got a new employment, choose it); save. 5. Reload the dashboard.
> Expect: after step 3 P-B is listed in "Pools mit Mitarbeitende mit abgelaufenen Beschäftigungsverhältnissen" with edit / delete; HP6's affiliation is `UNRESOLVED` (never null, PPCLOUD-14312); after step 5 the section is gone. Variant: with a second, still valid employment the job re-assigns it automatically and P-B never shows up (commit `ae0be506df`).
> Oracle: `pools-with-unresolved-users` before / after; the affiliation of HP6 in `GET /api/private/tenant/pools/{P-B}/users`.
> Evidence: unresolved-before.json, unresolved-after-job.json, unresolved-after-fix.json, 01-section.png, 02-edit.png.
> Cleanup: restore HP6's employment end date (logged) + PSC; P-B membership back.
> Source: 11466571777#3; gap G-07; POMA-POOL-01/03; `EmploymentExpirationCronJob.java:51`, `EmploymentExpirationCronJobTask.java:41-110`.

### PSP-20 "Available for internal pool" flag filters the internal-pool shift picker (PPCLOUD-13957)

> Data prerequisite: group seed D1: two PSP Dienste in G-A's palette, `PSP-IP-JA` (`DIENST.INTERNER_POOL = 'T'`, `RESSOURCENERSATZ = 'F'`) and `PSP-IP-NEIN` (`INTERNER_POOL = 'F'`, `RESSOURCENERSATZ = 'T'`), PSC `SHIFT_DEFINITION` enqueued. UI part (step 4) needs `poma.onPrem.writeShiftsOnPrem` on: it is ON in the DM-Y baseline.
> Pre: as SP-A.
> Steps: 1. `GET /api/private/shift-definition/roster?group-node-id=<G-A>&from=D1&to=D1&include-icons=true&include-presences=true&include-absences=true&shift-type-filter=USE_IN_PLANNING&available-for-internal-pool=true`. 2. The same without `available-for-internal-pool`. 3. Oracle: `SELECT PA_CODE, INTERNER_POOL, RESSOURCENERSATZ FROM ECBERN.DIENST WHERE …` for both. 4. (UI) create a minimal IPO as PEP does: `POST /api/v2/internal-pool-opportunity` (body as captured from the booking area's run) → open the returned `…/pending-internal-pool-opportunity?opportunity-id=` URL; open the Dienst select (`#shift-definition-type-field`).
> Expect: master bundle: step 1 lists `PSP-IP-JA` and not `PSP-IP-NEIN`; step 2 lists both; the picker in step 4 offers `PSP-IP-JA` only. main-26 bundle (no `INTERNER_POOL` column, api-gw sends null): the RR flag decides (fallback `ShiftDefinitionService.java:257-265`), so step 1 lists `PSP-IP-NEIN` and not `PSP-IP-JA`: expected on that class, not a FAIL.
> Oracle: definition ids in both answers vs the DB flags.
> Evidence: roster-defs-ip.json, roster-defs-all.json, oracle-dienst.txt, 01-picker.png.
> Cleanup: cancel the pending IPO (`DELETE /api/private/opportunities/{id}`) if created.
> Source: gap G-08; 11484627032#3 (corrected); POMA-OPP-07; `ShiftDefinitionService.java:162-190`, `PPS:liquibase/pp-migrations/.../feature-26-3/files/202607071505-ecbern-field-internal-pool.sql`.

### PSP-21 Sollplan gate, "immer sichtbar" and "alle Monate sichtbar" as seen in myPOLYPOINT

> Data prerequisite: group seed D2: Dienst `PSP-IMMER` (`DIENST.ALWAYS_VISIBLE = 'T'`) in G-A's palette + PSC; HP8 (normal myPOLYPOINT role), HP9 (role with "alle Monate sichtbar", group seed R5). Window **W-Y-SOLLPLAN** (after utr has finished on DM-Y): the PEP option is global and hides unsaved months for every employee of every group. PEP lock throughout (one PEP-owning worker).
> Pre: note the current value of the PEP option (Grundeinstellungen → Planung / Stempel → "Es muss ein Sollplan gesichert sein") and whether M1 has a saved Sollplan.
> Steps: 1. Paint for HP8 and HP9 in month M1: day a = a normal seed Dienst, day b = `PSP-IMMER`. 2. Switch the option on (pep-verify `menupath`/`clickin`; no flow exists: exploratory, screenshots); wait for propagation (PSC `PERIOD_CLOSING` is not the right event: guess, re-read after ≤ 5 min). 3. As HP8 and HP9 read `GET /api/mobile/health-professional/v1/calendar/roster?…M1…` (or `month-view`). 4. In PEP "Bearbeiten → Sollplan sichern [M1]"; repeat 3. 5. "Bearbeiten → Sollplan überschreiben [M1]"; repeat 3. 6. Switch the option off; remove the paints.
> Expect: with the option on and M1 unsaved: HP8 sees day b only, HP9 sees a and b; after saving: HP8 sees a and b; after overwrite: as in step 3 (guess: verify the undo semantics). With the option off: everybody sees everything. The api-gw roster cell carries `sollplanSavedOrDisabled` false / true accordingly (DB / api-gw read).
> Oracle: myPP roster answers per HP and step; PEP option value (DB `GLOBALEINSTELLUNGEN` row, identify at run time: guess); planning rows.
> Evidence: roster-hp8-<step>.json, roster-hp9-<step>.json, pep-<step>.png, oracle-option.txt.
> Restore: option back to its recorded value, M1 Sollplan state back, paints removed; prove with one roster read of another area's HP.
> Source: 11770986525#1–#4, 12122652851#1; gap G-09; `GetMonthReport.java:120-124`, `PPS:…/RosterConverterService.java:134-163`.

### PSP-22 Planning wish (v1): node-level definitions, create, PEP decision, notification, delete

> Data prerequisite: group seed D3: Dienst `PSP-WUNSCH-JA` with `DIENST.PLANUNGSWUNSCH = 'T'` and `DIENST_DETAIL.PLANUNGSWUNSCH = 'T'` (+ `PW_ROLLE_ID` as PEP writes it) on G-A's node for a validity covering DW; Dienst `PSP-WUNSCH-NODE-NEIN` with `DIENST.PLANUNGSWUNSCH = 'T'` but `DIENST_DETAIL.PLANUNGSWUNSCH = 'F'`; both in G-A's palette; PSC `SHIFT_DEFINITION` + `SHIFT_DEFINITION_POLICY` enqueued; HP7 has right 1031 (the steward's `rights.sql` grants it to `DMSEED:Planner`); flag `poma.flows.schedulingRequestV1` on (default). PEP lock for step 6 (worker).
> Pre: as HP7 in myPP (harness, `/tabs/…`).
> Steps: 1. `/tabs/shiftmarketplace` → FAB / "Planungswunsch" → add-scheduling-request; pick DW; capture `GET /api/mobile/health-professional/v1/scheduling-requests/shift-definitions?…`. 2. Create a wish for `PSP-WUNSCH-JA` on DW; capture `POST …/scheduling-requests`. 3. Create the same wish again via `api.call` → error. 4. Calendar DW (`GET …/calendar/roster`): `scheduling_requests[]` with state REQUESTED. 5. Oracle on the box: the wish row exists (api-gw `GET /api/v1/scheduling-requests` impersonated as HP7, or the DB table, identified at run time). 6. Accept the wish in PEP under the lock (plan sheet of G-A; pep-verify exploratory, no flow). 7. As HP7 poll `GET /api/mobile/health-professional/v1/notifications?notification-types=SCHEDULING_REQUEST` (≤ 5 min) and the calendar. 8. Second wish on DW+1, then delete it in myPP (detail → delete); capture `DELETE …/scheduling-requests/{id}`.
> Expect: step 1 lists `PSP-WUNSCH-JA`, not `PSP-WUNSCH-NODE-NEIN`; step 2 → 201; step 3 → error `SCHEDULING_REQUEST_ALREADY_EXISTS`; step 4 REQUESTED; step 7 one notification-center row of type SCHEDULING*REQUEST (`SHIFT_PLANNER_ACCEPTED_SCHEDULING_REQUEST`) and state accepted; step 8 → 204, the wish is gone from the calendar and from PEP. Push is not asserted (no device); if step 7 never shows a row: BLOCKED "inbound scheduling-request event not delivered to DM tenant" when the PEP decision is stored, else FAIL.
> Oracle: definitions list; POST / DELETE status and error code; calendar answer; notification-center row; PEP / api-gw wish state.
> Evidence: defs.json, post.json, dup.json, calendar-*.json, oracle-wish-\_.txt, nc.json, pep-accept.png, 01..04 shots.
> Cleanup: delete remaining wishes of HP7 (myPP or PEP).
> Source: gap G-01; MYPP-WISH-01, notifications N-22..N-24; `PPS:…/mapper/ShiftDefinitionConverter.java:168-190`, `CORE/rest/controller/SchedulingRequestController.java`.
