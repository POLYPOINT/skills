# Family PERM — Node restrictions and rights guards (PSP-09, 10, 11) · PMA, SPA, PLANALL, SEEDSP; read-only

|                           |                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | PSP-09, PSP-10, PSP-11                                                                                              |
| Actors                    | PMA `{{PMA_LOGIN}}`, SPA `{{SPA_LOGIN}}`, PLANALL `{{PLANALL_LOGIN}}`, SEEDSP `{{SEEDSP_LOGIN}}` (all `--app poma`) |
| Days                      | `{{D1}}` (availabilities of HP1–HP5, bookings F6 HP1 / P-A and F7 HP5 / P-B)                                        |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/PERM` · `{{RUN_DIR}}/PERM/<id>/`                                               |
| Read first                | the group brief; scenarios.md PSP-09..11; `known-deviations.md` SD-07, SD-64, SD-28, SD-54; gates PSP-G1 / PSP-G2   |
| PEP                       | optional PSP-09 step 7 only (under `{{PEP_LOCK_DOC}}`)                                                              |
| Windows                   | paused by W-Y-CONFRULE (find-HP hints)                                                                              |

## PSP-09 — Node-restricted pool manager sees only its nodes and pools

1. PMA: `/pool-manager/manage-pools/add` → open `#pool-category`, read the tree; capture `GET /api/private/organization/readable-nodes` → `readable-nodes-pma.json`. 2. HP tab tree: same nodes. 3. `/pool-manager/manage-pools/edit`: capture `tenant/pools` → `pools-pma.json`. 4. Direct: `GET /api/private/tenant/pools/{{POOL_PB}}` and `…/{{POOL_PB}}/users`. 5. DB: `sql.sh {{TENANT}} -f {{GROUP_DIR}}/scripts/planner-checks.sql -D login={{PMA_LOGIN}} -D ga_node={{GA_NODE}}` (C1 node selection, C1b subtree) → `oracle-nodes.txt`. 6. PLANALL: repeat step 3 → `pools-planall.json`. 7. Optional (PEP lock): pep-verify as PMA, Datei → Planblatt bearbeiten, read the group list.
   Expect: tree and readable-nodes = exactly the G-A subtree (= C1b); PMA's pools = P-A + `PSP-LIST-*`, never P-B; PLANALL's both; step 4 → 403 / 404 / empty (record which; 200 with P-B's data = FAIL). Record pool visibility vs node selection (SD-54 observation).

## PSP-10 — Node-restricted shift planner: find-HP and bookings limited to accessible pools

1. SPA: `/shift-planner/health-professionals?date={{D1}}` → roster `#search-filters-roster-filter`, Dienst `#shift-definition-type-field`; read the options of `#pool-multiselect-filter`; capture `GET /api/private/tenant/consumable-pools` and `consumable-pools/availabilities?date={{D1}}&shift-type=…`. 2. `/shift-planner/manage-shift-bookings/internal-pool`: options of `#manage-bookings-pool-filter`; capture `GET /api/private/assignments`. 3. Filters `#manage-bookings-date-filter` = `{{D1}}`, shift type, pool P-A. 4. PLANALL: repeat 1–2.
   Expect: SPA pool options and `consumable-pools` = P-A (+ `PSP-LIST-*`), no P-B; available users only from P-A (HP5 absent); bookings contain F6, not F7; PLANALL sees both pools and both bookings; filters narrow consistently with the request params.

## PSP-11 — Rights matrix and direct-URL guards (PPCLOUD-14334)

1. SEEDSP (only if PSP-G1 shows ROLE_SHIFT_PLANNER; else record "HP-only" and go to 3): menu; open by URL `/shift-planner/health-professionals`, `/shift-planner/manage-shift-bookings/internal-pool`, `/pool-manager/manage-pools/add`. 2. Same user: `/shift-planner/manage-opportunities`, `/shift-planner/shift-swap-marketplace`. 3. SPA: `/pool-manager/manage-pools/add`, `/pool-manager/pool-metrics`; dashboard tile "Nächste gebuchte Dienste" (SD-28: expected absent — observation). 4. PMA: `/shift-planner/dashboard`, `/shift-planner/health-professionals`, `/shift-planner/shift-swap-marketplace`. 5. API: SPA `GET /api/private/tenant/pools` and `POST /api/private/tenant/pools-with-users` with an empty pool body; PMA `GET /api/private/assignments`. Save `roles(api)` of each actor.
   Expect: menus exactly as the rights allow (SEEDSP: Übersicht, Anfragen verwalten, Diensttausch); every forbidden URL redirects to the actor's role dashboard or `/invalid-user`; API: SPA 403 on pool endpoints, PMA 403 on assignments. Write the matrix (actor × route / call → result) into `notes.md`. A 200 where the matrix says forbidden → check SD-07 / SD-64 signatures, else new finding.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
