# Family POOL — Pool management (PSP-04, 05, 06, 07, 19) · PLANALL; HP6 employment end

|                           |                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scenarios (in this order) | PSP-04, PSP-05, PSP-06, PSP-07 (a, b), PSP-19, then PSP-07 variant c                                                                                                                                                     |
| Actors                    | PLANALL `{{PLANALL_LOGIN}}` (`--app poma`); HP1 `{{HP1_LOGIN}}`, HP2 `{{HP2_LOGIN}}`, HP4 `{{HP4_LOGIN}}`, HP5 `{{HP5_LOGIN}}`, HP6 `{{HP6_LOGIN}}` ({{HP6_ID}}), HP9 `{{HP9_LOGIN}}` (objects only, no HP login needed) |
| Days                      | `{{RM1}}` (HP6 employment end, PSP-19)                                                                                                                                                                                   |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/POOL` · `{{RUN_DIR}}/POOL/<id>/` · `created/POOL.jsonl`                                                                                                                             |
| Read first                | the group brief; scenarios.md PSP-04..07, PSP-19                                                                                                                                                                         |
| PEP                       | PSP-19 employment end + restore (pep-verify exploratory under `{{PEP_LOCK_DOC}}`)                                                                                                                                        |
| Windows / jobs            | PSP-19 job steps only inside **J-Y-JOBS** (read `windows/{{ENV}}~J-Y-JOBS`)                                                                                                                                              |

## PSP-04 — Pool-manager dashboard tiles and links (before PSP-19)

1. `/pool-manager/dashboard`; capture `GET /api/private/tenant/pools`, `…/pools-with-unresolved-users`, `GET /api/private/users?page-size=3…`. 2. Rows of the "Pools" and "Mitarbeitende" tiles. 3. "Alle anzeigen" (Pools) → `/pool-manager/manage-pools/edit`, tab "Pool bearbeiten", menu "Pool Management" active. 4. Back; "Alle anzeigen" (Mitarbeitende) → `/pool-manager/manage-pools/hp`. 5. Back; `#add-pools-btn` → `/pool-manager/manage-pools/add`. 6. No section "Pools mit Mitarbeitende mit abgelaufenen Beschäftigungsverhältnissen".
   Expect: ≤ 3 rows per tile = min(3, API total); links as listed; unresolved `pools` = [].

## PSP-05 — Create a pool (happy path and validation)

1. `/pool-manager/manage-pools/add`; `#save-pool-btn` disabled. 2. Name `PSP-NEW-{{RUN}}` in `#pool-name`, Enter → no request. 3. `#pool-category` → the P-A Station `{{GA_STATION}}` in the tree dialog. 4. `#hp-pool-node` → same Station; select HP1 and HP2. 5. Save; capture `POST /api/private/tenant/pools-with-users` → 201, lands on `/pool-manager/manage-pools/edit` with the new pool. 6. Variant (only if seed F4 made HP5's e-mail invalid, else note "F4 not run"): new pool `PSP-BADMAIL-{{RUN}}` with HP5 → message `POOL_PROVIDER.ERRORS.INVALID_EMAIL` naming HP5, save disabled; cancel. 7. Expand the new pool; `GET …/pools/{id}/users` → HP1, HP2 with `pep_employment_id` not null.
   Expect: as listed. Cleanup: delete `PSP-NEW-{{RUN}}` (`DELETE /api/private/tenant/pools/{id}`); log it.

## PSP-06 — Manage pools: filter, sort, paging, expand, edit, delete

1. `/pool-manager/manage-pools/edit`; capture `tenant/pools?page-size=10&current-page=0`. 2. Page 2; page size 20. 3. `#pool-filter-input` = `PSP-LIST-0` → request with `name-filter`. 4. Pool column header twice (sort). 5. Expand P-A → HP1–HP4. 6. Edit `PSP-LIST-01` → rename `PSP-LIST-01-RENAMED`, add HP3 (P-A Station), `#save-pool-btn-update`. 7. Delete `PSP-LIST-02`: wrong name → `#delete-confirmation-dialog-ok` disabled → `#delete-confirmation-dialog-cancel` (still listed); again with the exact name → `DELETE …/pools/{id}` 200, gone.
   Expect: `total_pools` ≥ 12, page 2 = remainder; filter matches; sort toggles; edit 200 with the new name and 1 member; cancel keeps the pool; delete removes it.

## PSP-07 — Manage health professionals: filter, edit pools, special employments

a. `/pool-manager/manage-pools/hp` → the G-A Station in the category tree → `#health-professional-list-select` → HP4 → edit page `/pool-manager/manage-pools/hp/<subject>` (only the pool section editable) → add `PSP-LIST-03`, `#saveHealthProfessionalBtn` (`PUT /api/private/organization/available-health-professionals/{subject}`); `pools/{PSP-LIST-03}/users` lists HP4; remove it again (confirmation) → not listed.
b. HP9 (only if seed F5 gave a second employment, else "F5 not run"): adding a pool asks which employment → the second → the stored affiliation carries it.
c. **After PSP-19:** HP6 (no current employment): adding a pool is possible (PPCLOUD-14554); the affiliation is `UNRESOLVED` or the chosen employment, never null (PPCLOUD-14312).
Expect: PUT 200 each time; affiliations as listed (`user_pool_affiliations` of `GET …/available-health-professionals/{subject}`).

## PSP-19 — Expired employment makes a pool member unresolved; the pool manager fixes it

1. PEP lock → pep-verify exploratory: end HP6's employment at `{{RM1}}` ("Austritt" in the Personalstamm; screenshots before / after; record the old end date) → release; `{{SKILL_DIR}}/scripts/psc-enqueue.sh {{TENANT}} employment {{HP6_ID}}`. No PEP path found → BLOCKED "employment end needs a pep-driver flow (OQ-20)".
2. Inside J-Y-JOBS: `portal-ops.mjs {{PORTAL_PROFILE}} "job run poma-core EmploymentExpiration --tenant {{TENANT}}" <out>`; if HP6's cloud employment did not change, also `ResyncUserEmployments` (same form). Window not granted within 30 min → report PSP-19 `BLOCKED` "job window not granted" (the runner re-runs steps 3–5 the next morning after the 03:00 cron).
3. PLANALL `/pool-manager/dashboard`; capture `pools-with-unresolved-users` → P-B listed in the unresolved section with edit / delete; HP6 affiliation `UNRESOLVED` (never null).
4. Edit P-B from the section: HP6 flagged → remove HP6 → save. 5. Reload → section gone.
5. Restore: HP6's employment end back to the recorded value (PEP, lock) + PSC; P-B membership of HP6 back (PLANALL edit).
   Expect: as listed. Variant: with a second valid employment the job re-assigns automatically and P-B never shows up (record if it happens).

## Cleanup checklist

- `PSP-NEW-*` deleted; `PSP-LIST-01-RENAMED` / `PSP-LIST-02` changes logged; HP6 employment and P-B membership restored; PEP lock released.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
