# Family NAV — Invalid-user pages (AUT-01, AUT-02) · HPA, NOHP

|                           |                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | AUT-01, AUT-02                                                                                  |
| Actors                    | HPA `{{HPA_LOGIN}}` (plain HP), NOHP `{{NOHP_LOGIN}}` (no `ROLE_HEALTH_PROFESSIONAL`, seed A3)  |
| Budget                    | ≤ 1 password submission per actor (auto-login harness)                                          |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/NAV` · `{{RUN_DIR}}/NAV/<scenario>/` · `created/NAV.jsonl` |
| Read first                | the group part above; scenarios.md AUT-01, AUT-02                                               |

Read-only family.

## AUT-01 — Invalid user page: health professional opens the shift-planner app

1. `node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} "{{HPA_LOGIN}}" {{RUN_DIR}}/scripts/NAV-AUT-01.mjs {{RUN_DIR}}/NAV/AUT-01 --app mypp` (myPP login = precondition). In the script save `roles(api)` → `roles.json` (expect no `ROLE_SHIFT_PLANNER`).
2. `api.goto('/shift-planner/dashboard')`; wait ≤ 30 s until the path ends with `/invalid-user`. Record whether a PolyID password form appeared (expected none: the Hydra login is remembered).
3. Read `h1.invalid-user-title` and count `.invalid-user-option`; `#logout-button` and `#go-to-health-professional-button` present; `#go-to-shift-planner-button` / `#go-to-pool-manager-button` absent. Shot `01-invalid-user.png`.
4. Click `#go-to-health-professional-button` → record the final URL (`/health-professional…`) and whether a login was required.
5. `api.call('GET', '/api/private/opportunities')` with HPA's bearer → status → `opportunities-status.json`.

Expect: path `/invalid-user`; title "Fehlen der korrekten Berechtigungen"; 3 options, option 3 "Bei myPOLYPOINT anmelden"; no second password prompt; step 5 refused (401 / 403 — a 200 with planner data is a FAIL).

## AUT-02 — Invalid user page in myPOLYPOINT: user without the HP role

Pre: `env-facts.md` AUT-G2 shows NOHP without `ROLE_HEALTH_PROFESSIONAL`; otherwise BLOCKED "A3 not applied" (do not log in).

1. `app.mjs {{TENANT}} "{{NOHP_LOGIN}}" {{RUN_DIR}}/scripts/NAV-AUT-02.mjs {{RUN_DIR}}/NAV/AUT-02 --app mypp` (fresh profile folder `NAV-nohp`); `…/health-professional-app/polyid/invalid-user` counts as logged in. Record the landing URL; save `roles.json`.
2. Read the `h2` text and the buttons: `#logout-btn` present, `#access-shift-planner-btn` present (SP role), `#access-pool-manager-btn` only if the roles contain `ROLE_POOL_MANAGER`. Shot `01-mypp-invalid-user.png`.
3. Click `#access-shift-planner-btn` → `/shift-planner/…` dashboard without a password prompt. Shot `02-planner-landing.png`.
4. Back to the myPP root → `#logout-btn` → record the final URL and that the logout request carried `id_token_hint` (request parameter names only).

Expect: path `/polyid/invalid-user`; title "Ihrem Benutzerkonto fehlen die korrekten Berechtigungen"; text "Bitte melden Sie sich ab …"; "Zugriff als Dienstplaner" opens the planner app.

## Cleanup checklist

- Nothing changed; both actors logged out (AUT-02) or left logged in (AUT-01, harmless).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
