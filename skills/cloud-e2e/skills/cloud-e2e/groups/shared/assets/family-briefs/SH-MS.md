# Family SH-MS — Microsoft ADFS / Entra logins (AUT-12, AUT-13) · tenant with a registered Microsoft app

|                           |                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scenarios (in this order) | AUT-12, AUT-13                                                                                                                                                                                                                       |
| Tenant                    | `{{TENANT}}` on stage `{{STAGE}}`, provider id `{{MS_PROVIDER_ID}}`, user domain `{{MS_DOMAIN}}`; PEP user `{{MSUSER_LOGIN}}` (e-mail = the Microsoft test account); control user `{{MSCTRL_LOGIN}}` (password from `{{CRED_FILE}}`) |
| Window                    | **W-SH-MSTENANT** (SHARED, ≈ 75 min, owners' consent): launched only when `windows/ct~W-SH-MSTENANT` is `active`                                                                                                                     |
| Gate                      | AUT-G4 in `env-facts.md` (tenant named, redirect URI `…/api/accept-login/{{MS_PROVIDER_ID}}` registered in Azure); missing → BLOCKED "no Microsoft test tenant", change nothing                                                      |
| Attended                  | the operator changes the provider type in PolyID ops (Basic Data tab; Provider URI / Client Id / Client Secret from the secret store) and signs in to Microsoft in the headed window; you drive the flows and record                 |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/SH-MS` (Microsoft SSO cookie kept between runs) · `{{RUN_DIR}}/SH-MS/<scenario>/` · `created/SH-MS.jsonl`                                                                                       |
| Read first                | the group part above; scenarios.md AUT-12, AUT-13                                                                                                                                                                                    |

Provider reads: `node {{SKILL_DIR}}/scripts/harness/polyid-admin.mjs {{PIDOPS_PROFILE}} <out> {{TENANT}} provider-read --stage {{STAGE}}` (client secret redacted). Never write a provider yourself.

## AUT-12 — Microsoft ADFS and Entra login in the browser

1. `provider-read` → `provider-before.json` (type, URI, client id; this is the restore target).
2. Log `WAITING FOR OPERATOR: provider type "Microsoft ADFS & API-Gateway Password Validation"`; poll `provider-read` every 30 s (≤ 10 min) until the type changed → `provider-adfs-pwd.json`.
3. Fresh context (`polyid-flow.mjs {{TENANT}} - <script> <out> --app mypp --stage {{STAGE}} --headed`): onboard `{{MSUSER_LOGIN}}@{{MS_DOMAIN}}` → the login form shows the password fields **and** `#login-with-microsoft-button` (shot `02-login-with-ms.png`).
4. Click "Sign in with Microsoft" → Microsoft / ADFS host (the operator signs in, or the saved account continues) → `https://ct-polyid-login…/api/accept-login/{{MS_PROVIDER_ID}}` → Hydra → myPP `/tabs/`; `current-user/sync` returns the PEP user of the Microsoft e-mail. `polyid.chain()` → `03-chain.json` (hosts and parameter names only).
5. `WAITING FOR OPERATOR: provider type "Microsoft ADFS"` → (poll as step 2) → fresh login: after the on-board e-mail the browser goes straight to Microsoft (no PolyID password form) → `/tabs/` (shot `04-adfs.png`).
6. `WAITING FOR OPERATOR: provider type "Microsoft Entra"` (v2 settings) → same as step 5 → `/tabs/` (shot `05-entra.png`). **Leave Entra (or ADFS) active for AUT-13.**

Expect: every login lands in myPP. `AADSTS50011` (redirect URI) = environment blocker → BLOCKED; a PolyID error after the callback (`ExternalOAuthTokenExchangeException`, `/ui/error`) = FAIL.

## AUT-13 — Microsoft login on the myPOLYPOINT app path

Pre: AUT-12 step 5 or 6 type still active.

1. `polyid-flow.mjs {{TENANT}} - <script> <out> --app inapp --stage {{STAGE}} --headed`: `#provider-email-input` = `{{MSUSER_LOGIN}}@{{MS_DOMAIN}}`; capture `GET …/api/providers?email=` → `externalOAuthConfig.authorizeUrl` present (record the host only) → `providers.json`.
2. The app opens the external browser (Playwright popup / new page); the Microsoft sign-in continues (saved account or the operator).
3. The callback `…/api/auth/external-oauth-provider/auth-callback` answers 301 to `mypolypoint://auth-callback` (the desktop navigation fails — expected); meanwhile the app polls `POST /api/auth/external-oauth-provider/auth-status` (401 until done, then 200 or `CONSENT`) → `auth-status-statuses.json`.
4. The app shows `/tabs/home` (or consent first) → shot `04-home.png`.

Expect: logged in through the poll. The app never starts polling → BLOCKED "deep link not simulable" (manual on a device).

## Restore (both scenarios done or one failed)

7. `WAITING FOR OPERATOR: restore the provider from provider-before.json` → poll `provider-read` until it equals `provider-before.json` (type, URI, client id) → `provider-after.json`.
8. One password login of `{{MSCTRL_LOGIN}}` (`polyid-flow.mjs … --cred-file {{CRED_FILE}}`, 1 submission) works — skip when the original type has no password form, and say so.

## Cleanup checklist

- `provider-after.json` = `provider-before.json` (the runner copies it into the window doc).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
