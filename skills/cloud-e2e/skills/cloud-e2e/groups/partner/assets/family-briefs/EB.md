# Family EB — "Externer Anbieter" tab (PTN-16) · SPX with 1062, SPN without

|                           |                                                                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | PTN-16                                                                                                                                                                                                      |
| Actors                    | SPX `{{SPX_LOGIN}}` ({{SPX_ID}}) (1062 via kit `E2E:EXTPOOL`), SPN `{{SPN_LOGIN}}` ({{SPN_ID}}) (seed planner without 1062)                                                                                 |
| Data                      | booking-partner records of `{{TENANT}}` (gate PTN-G5 in `{{RUN_DIR}}/env-facts.md`): none → the list part (steps 1–4) is BLOCKED-data "no booking-partner records", the permission part (step 5) still runs |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/EB` · `{{RUN_DIR}}/EB/PTN-16/`                                                                                                                                         |
| Read first                | the group part above; scenarios.md PTN-16; known-deviations.md PF-4                                                                                                                                         |

Read-only: never press the sync / "mark synced" action (it exists only when the page runs inside PEP, and it would change records).

## PTN-16 — "Externer Anbieter" tab: list, columns, sort, synchronised toggle, paging, permission

1. As SPX (`app.mjs {{TENANT}} {{SPX_LOGIN}} <script> <out> --app poma`): `/shift-planner/manage-shift-bookings/external-bookings` → tab "Externer Anbieter"; capture `GET /api/private/external-bookings?page-size=10&current-page=0&state=UNSYNCED…` → `list-1.json`; shot `01-tab.png`.
2. Columns: creation date, date, location, health professional, pool, information (no sync column outside PEP). Sort by two columns (heart icons) → record the request parameters `sort-by`, `sort-direction` → `list-sort.json`.
3. Tick "Zeige bereits synchronisierte Buchungen" → the request parameter `state` changes, synced rows appear → `list-synced.json`.
4. Paging: page 2, then another page size → `list-page.json`.
5. As SPN: the tab "Externer Anbieter" is **absent** (shot); then open `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/external-bookings/manage-shift-bookings` directly (shot `05-spn-direct.png`) and call `api.get('/api/private/external-bookings?page-size=10&current-page=0')` with SPN's session → status → `spn-api.json`.

Expect: 1–4 as described (sorting exists); 5 → tab hidden for SPN; **intended**: the direct route and the API deny SPN. Today the route renders the list and the API answers 200 → **KNOWN-FAIL PF-4** (`findings_confirmed: ["PF-4"]`, issueShot of the rendered list + jsonShot of the 200).

## Cleanup checklist

- Nothing created; record "read-only" in `created_data` (empty list).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
