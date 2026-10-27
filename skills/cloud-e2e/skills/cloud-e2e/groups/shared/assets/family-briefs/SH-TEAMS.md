# Family SH-TEAMS — MS Teams pre-flight on ct-zinc-master (HPN-26) · read-only

|                           |                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Scenarios (in this order) | HPN-26                                                                                  |
| Tenant                    | `{{TENANT}}` (= `ct-zinc-master`, stage `{{STAGE}}`) — **read-only**: no reset, no save |
| Sessions                  | PolyID ops `{{PIDOPS_PROFILE}}`, portal ops `{{PORTAL_PROFILE}}`                        |
| Profiles / results        | `{{RUN_DIR}}/SH-TEAMS/HPN-26/`                                                          |
| Read first                | the group part above; scenarios.md HPN-26                                               |

## HPN-26 — MS Teams pre-flight: provider config, users' link state, notification flag → GO / NO-GO

1. `node {{SKILL_DIR}}/scripts/harness/polyid-admin.mjs {{PIDOPS_PROFILE}} {{RUN_DIR}}/SH-TEAMS/HPN-26/provider {{TENANT}} provider-read --stage {{STAGE}}` → record only: Teams "Enabled", "Enforce MS Teams only", whether App / Tenant / Client id are present (values not saved) → `teams-config.json`.
2. Per user `engsa`, `schre`, `shasm`, `schbea`, `chial`: `polyid-admin.mjs … user-read <user>` → "MS Teams — Linked: YES / NO" (`ms_teams_linked`) → `teams-links.json` (user, linked; nothing else). A user not found → record "absent".
3. `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "flag read {{TENANT}} poma.msTeams.notifications" {{RUN_DIR}}/SH-TEAMS/HPN-26/flag` → value.
4. Write `teams-preflight.md`: **GO** for the manual Teams session when Teams is enabled, ≥ 1 HP (`engsa`, `schre`, `shasm`) is linked or resettable and the flag value is known; else **NO-GO** with the reason. Screenshots only with secrets masked (ids and secrets never visible).

Expect: values recorded; GO / NO-GO. HPN-26 passes when every read succeeded (the verdict is about the pre-flight, not about the GO).

## Cleanup checklist

- Nothing changed (read-only).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
