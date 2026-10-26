# Family ADMIN — Tenant admin pages (PSP-15) · TA, read-only

|                           |                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Scenarios (in this order) | PSP-15                                                                                |
| Actors                    | TA `{{TA_LOGIN}}` (`--app poma`; borrowed read-only by auth and ops — change nothing) |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/ADMIN` · `{{RUN_DIR}}/ADMIN/PSP-15/`             |
| Read first                | the group brief; scenarios.md PSP-15; `known-deviations.md` SD-55                     |
| PEP / windows             | none (runs before W-Y-CONFRULE: its config read is PSP-16's restore value)            |

## PSP-15 — Tenant-admin pages load (read)

1. `/tenant-admin/dashboard`; capture `GET /api/private/tenant-admin/pools?page-size=100&current-page=0` (SD-55: record the params). 2. List rows and paginator (10 per page). 3. `#tenant-admin-pool-filter-select` = `PSP-LIST` → only matching pools. 4. Click a pool row → no detail view (expected today). 5. Menu "Konfliktregeln konfigurieren" → `/tenant-admin/manage-conflicts-rules`; capture `GET …/conflict-checker/admin/config/{{TENANT}}` → `cc-config.json` (**PSP-16's restore value**) and `GET …/conflict-checker/admin/rules` → `cc-rules.json`; header shows the tenant id; chips of `#tenant-group-rules` = configured groups.
   Expect: list = all `pools` of the API (P-A, P-B, `PSP-LIST-*`, other groups' pools), paged by 10, substring filter; both pages without console errors; chips = `rule_groups` (default BOOKING_RULES + AVAILABILITY_RULES once the tenant was seen by the conflict checker). An empty config (conflict checker not enabled for the tenant, OQ-19) → note it and tell the runner: PSP-16 / PSP-17 need it (the steward enables, never disables).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
