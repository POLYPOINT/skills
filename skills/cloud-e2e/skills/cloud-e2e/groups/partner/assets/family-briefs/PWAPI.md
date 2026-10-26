# Family PWAPI — Partner session negatives (PTN-21) · API only, no link side effects

|                           |                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Scenarios (in this order) | PTN-21                                                                                 |
| Actors                    | none (raw anonymous calls; an unlinked challenge never creates a link without a login) |
| Profiles / results        | `{{RUN_DIR}}/PWAPI/PTN-21/`                                                            |
| Read first                | the group part above; scenarios.md PTN-21                                              |

The embedded-login family itself (PTN-10, 11, 18) runs in group `shared` on `ct-zinc-master`; here only the error answers of the partner-session endpoint are checked, against your own tenant.

## PTN-21 — Partner session negatives via the polyid-login API

Raw calls with `node {{SKILL_DIR}}/scripts/harness/partner-api.mjs partner-embedding-mock {{RUN_DIR}}/PWAPI/PTN-21/<case> session <body.json>` (`POST https://ct-polyid-login.dev.k8s.polypoint-dev.com/api/auth/partner-sessions`, no secret, no token in the request). Write each body to `{{RUN_DIR}}/PWAPI/PTN-21/<case>-body.json` first; body fields `partner_id`, `code_challenge`, `customer_id`, `tenant_id`:

| Case | Body                                                                                                                                                                                       | Expected                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| a    | `{"partner_id": "does-not-exist-{{RUN_TAG}}", "code_challenge": "code_challenge_e2e", "customer_id": "e2e", "tenant_id": "{{TENANT}}"}`                                                    | 404 `NoPartnerFoundException`          |
| b    | `{"partner_id": "partner-embedding-mock", "code_challenge": "code_challenge_e2e", "customer_id": "e2e", "tenant_id": "{{TENANT}}"}` (the mock partner has no UI_EMBEDDING on `{{TENANT}}`) | 403 `InsufficientPermissionsException` |
| c    | `{"partner_id": "partner-embedding-mock", "customer_id": "e2e", "tenant_id": "{{TENANT}}"}` (no `code_challenge`)                                                                          | 400                                    |

Save one table `partner-sessions-neg.json` (case, status, error name). Any 200 (a token in the answer) → FAIL; the harness discards the token, record only that one came back. Never use the challenges of the real mock users (`code_challenge_3`, `code_challenge_4`) and never a `tenant_id` of a shared tenant.

## Cleanup checklist

- Nothing created.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
