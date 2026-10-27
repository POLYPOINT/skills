# Family IMP — Support impersonation in the browser (AUT-17) · operator's ops-realm account, targets HPA / SEEDSP, TA (read)

|                           |                                                                                                                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | AUT-17                                                                                                                                                                                                                                                                                                    |
| Actors                    | OPS-IMP = the operator's own ops-realm account (SUPPORT / OPERATIONS / ADMIN), typed by the operator in the headed window; targets HPA `{{HPA_LOGIN}}`, SEEDSP `{{SEEDSP_LOGIN}}` (tenant subjects in `auth-allocation.md`); optional IMPBLK `{{IMPBLK_LOGIN}}`; TA `{{TA_LOGIN}}` (incidents, read-only) |
| Attended                  | the operator signs in on the Keycloak polyid-realm page ("Username or email" / "Sign In"); you never see or store that password                                                                                                                                                                           |
| Ticket key                | `PPTX-999999` is typed as text only — no Jira issue is ever opened or read                                                                                                                                                                                                                                |
| Profiles / results        | `{{RUN_DIR}}/IMP/AUT-17/` · `created/IMP.jsonl`                                                                                                                                                                                                                                                           |
| Read first                | the group part above; scenarios.md AUT-17; known-deviations.md AUT-S9, AUT-S10                                                                                                                                                                                                                            |

One headed run: `node {{SKILL_DIR}}/scripts/harness/polyid-flow.mjs {{TENANT}} - {{RUN_DIR}}/scripts/IMP-AUT-17.mjs {{RUN_DIR}}/IMP/AUT-17 --app mypp --fresh --headed` (no seed password is submitted).

## AUT-17 — Support impersonation (myPOLYPOINT and POMA web)

1. On-board form: `#email` = `polypoint-impersonation` → `/ui/impersonation/login-form` (`#impersonation-form`). Shot `01-form.png`.
2. Validation: `#ticket_key` = `ABC-1`, `#tenant_id` = `{{TENANT}}`, `#tenant_subject` = HPA's subject → submit → ticket-key error (`InvalidPptxTicketKey`; record the text). Shot `02-bad-key.png`.
3. `#ticket_key` = `PPTX-999999`, same tenant and subject → submit → the Keycloak polyid-realm page; log `WAITING FOR OPERATOR: ops-realm sign-in`; wait ≤ 5 min for the landing on myPP `/tabs/`; `current-user/sync` returns HPA (compare the username with `auth-allocation.md`). Shot `03-landing.png`.
4. Token observation: decode the bearer in memory; record whether a claim **named** `impersonation` or `impersonator` exists → `claims-names.json`. None = **KNOWN-FAIL AUT-S9** (observation, verdict PASS unless something else fails; put "AUT-S9 observed" in notes).
5. Second impersonation in the same browser context: POMA web `/shift-planner/dashboard` → on-board `polypoint-impersonation` → `PPTX-999999`, `{{TENANT}}`, SEEDSP's subject → record whether the Keycloak page was skipped (SSO); expect `/shift-planner/dashboard` as SEEDSP. Shot `05-poma.png`.
6. Optional (only if `auth-allocation.md` lists IMPBLK): `polyid-admin … user-state "{{IMPBLK_LOGIN}}" BLOCKED --reason "E2E {{RUN}}"` → impersonate IMPBLK → `errors=UserNotActive` (the incident is written anyway) → `user-state … ACTIVE` (read back).
7. TA (`app.mjs {{TENANT}} "{{TA_LOGIN}}" <script> <out> --app customer-portal`): `/portal/incidents` (capture the API) → 2 (3) incidents `SUPPORT_USER_IMPERSONATION`, WARNING, OPEN, text "Polypoint support user: <ops user> is impersonating <subject> in {{TENANT}} associated ticket: PPTX-999999" → `incidents.json`. Record whether the TA UI offers any resolve action (none = AUT-S10, observation).
8. Logout of the impersonated sessions (LOGOUT steps 2–3 checks: `id_token_hint` present).
9. Negative role: only if the runner names an ops-realm account without SUPPORT / OPERATIONS / ADMIN — it must be refused ("… is not allowed to impersonate users"); otherwise notes "not tested (no such account)".

Expect: key format check; impersonated landing in both apps; incidents with the stated content.

## Cleanup checklist

- IMPBLK ACTIVE (if used); impersonated sessions logged out; incidents stay (harmless).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
