# Family SP — Shift-planner dashboard and request lists (PSP-12, PSP-13) · PLANALL, SPA; read-only

|                           |                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Scenarios (in this order) | PSP-12, PSP-13 (the read-only swap list and modal of the area are merged into SWP-15, group swap: no step here)                            |
| Actors                    | PLANALL `{{PLANALL_LOGIN}}`, SPA `{{SPA_LOGIN}}` (`--app poma`)                                                                            |
| Data                      | seed F6 booking (HP1, P-A, `{{D1}}`); seed F8 GAT resource replacements created **by SPA** on several days D+3..D+10 (ids in the seed log) |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/SP` · `{{RUN_DIR}}/SP/<id>/`                                                                          |
| Read first                | the group brief; scenarios.md PSP-12, PSP-13; `known-deviations.md` SD-28                                                                  |
| PEP / windows             | none                                                                                                                                       |

## PSP-12 — Shift-planner dashboard tiles, links and info button

1. PLANALL `/shift-planner/dashboard`; capture `GET /api/private/assignments?…` and `GET /api/private/opportunities?page-size=3&current-page=0&opportunity-state=OPEN&sort-direction=ASC&expand=applications`. 2. Tile "Nächste gebuchte Dienste": ≤ 3 rows (`DD.MM.YYYY` + HP name); "Alle anzeigen" → `/shift-planner/manage-shift-bookings` (menu "Geplante Dienste verwalten" active). 3. Tile "Publizierte Anfragen": ≤ 3 OPEN requests; info icon of row 1 → RR / IPO detail route by type; "Alle anzeigen" → `/shift-planner/manage-opportunities`. 4. `#find-hp-btn` → `/shift-planner/health-professionals`. 5. SPA: the bookings tile is absent (no manage pools; SD-28 observation).
   Expect: rows = the first entries of the API answers; empty lists show "Keine anstehenden Dienste" / "Keine verfügbaren Anfragen" without "Alle anzeigen". No F8 opportunity at all → tile 3 checks the empty state only; note it.

## PSP-13 — Manage requests: filters, "only mine", click routing

1. SPA `/shift-planner/manage-opportunities`: defaults Status "Offen", "Nur meine Anfragen" on; capture `GET /api/private/opportunities` (`opportunity-state=OPEN`, `only-mine=true`). 2. `#opportunities-date-range-filter` covering two F8 days → every `shift_requests[0].start` inside. 3. `#opportunities-state-filter` → another state; `#opportunities-sorting-filter` ASC / DESC → start order flips. 4. `#opportunities-planning-roster-filter` = a G-A roster (`node-id`). 5. Click an RR row → `/shift-planner/manage-opportunities/resource-replacement/details/<id>`; an IPO in PENDING / DRAFT → pending page, other IPO → IPO details (if any IPO exists). 6. PLANALL with "Nur meine Anfragen" on: SPA's requests absent; off: present.
   Expect: each response honours its parameters; routing as stated. If `only-mine=true` returns nothing for SPA (GAT creator guess), record it and continue with the toggle off (note, not FAIL).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
