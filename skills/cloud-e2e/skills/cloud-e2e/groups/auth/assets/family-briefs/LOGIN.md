# Family LOGIN — First login, onboarding errors, password form (AUT-18, AUT-03, AUT-04) · NEWU, HPA, optional DISU / NOEMP

|                           |                                                                                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | AUT-18, AUT-03, AUT-04                                                                                                                                                                                                     |
| Actors                    | NEWU `{{NEWU_LOGIN}}` (never logged in), HPA `{{HPA_LOGIN}}`, optional DISU `{{DISU_LOGIN}}` and NOEMP `{{NOEMP_LOGIN}}` (seed A8)                                                                                         |
| Budget                    | AUT-18: 3 submissions in 2 runs; AUT-03: none; AUT-04: 3 in 2 runs (one WRONG, then success); optional step: 1 per actor                                                                                                   |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/LOGIN` · `{{RUN_DIR}}/LOGIN/<scenario>/` · `created/LOGIN.jsonl`                                                                                                                      |
| Window-sensitive          | every scenario starts with a fresh login: before each, read `windows/` (dashboard {{DASHBOARD_URL}}); a `draining` / `active` LOGIN or HARD window on `{{TENANT}}` → stop, report the rest BLOCKED "paused by window <id>" |
| Read first                | the group part above; scenarios.md AUT-03, AUT-04, AUT-18; known-deviations.md AUT-S4, AUT-S5                                                                                                                              |

Runs as the first family of the group (NEWU must be untouched). Login-flow pattern: `node {{SKILL_DIR}}/scripts/harness/polyid-flow.mjs {{TENANT}} "<login>" {{RUN_DIR}}/scripts/LOGIN-<id>-<n>.mjs {{RUN_DIR}}/LOGIN/<id>/run<n> --app mypp --fresh`.

## AUT-18 — First login of a never-logged-in user

Pre: `polyid-admin.mjs {{PIDOPS_PROFILE}} <out> {{TENANT}} user-read "{{NEWU_LOGIN}}"` → exit 2 (not found). Exists → BLOCKED "NEWU already logged in" (report who touched it, if the audit tells).
Run 1 (2 submissions):

1. `polyid.open()`, `polyid.onboard()`, `polyid.password('SEED')` → consent page: POLYPOINT terms + data-privacy checkbox (a tenant checkbox only if the tenant has own texts). Open the footer links "terms of use" / "data privacy" (`/ui/legal-conditions?legal-condition-type=…`): each 200 with title and text (save statuses `legal-*.status`). Shot `01-consent.png`.
2. `polyid.consent('reject')` → record the final URL (`02-rejected.png`). Open the myPP root again: full login required (no remembered session).
3. `polyid.onboard()`, `polyid.password('SEED')` → consent → tick the required checkboxes → `polyid.consent('accept')` ("Zustimmen") → `/tabs/…`; `current-user/sync` 200 → `sync.json`; `GET /api/mobile/health-professional/v1/pep-employments/valid-on-date?date={{TODAY}}` lists NEWU's employment(s) → `employments.json`. Shot `03-landing.png`.
   Run 2 (1 submission):
4. `polyid-admin … user-read "{{NEWU_LOGIN}}"` → exists, `state ACTIVE`, `password_strength_level` present → `user-NEWU.json`.
5. Logout, fresh login → no consent page.

Expect: as stated (consent rejection keeps the user logged out; acceptance lands in myPP; the PolyID user exists afterwards; no consent on the second login).

## AUT-03 — Onboarding errors and tenant discovery (no password)

`polyid-flow.mjs {{TENANT}} - <script> <out> --app mypp --fresh` (no password submitted).

1. myPP root → `#form-onboard` (shot).
2. `#email` = `nobody` (no `@`) → `#submit-button` → record what blocks it: client-side `#errorEmail`, or `errors=` / `.login-error` after a redirect.
3. `#email` = `e2e-unknown@no-such-tenant.invalid` → submit → "Ihre Organisation konnte nicht gefunden werden. Bitte überprüfen Sie, ob Ihre E-Mail korrekt ist." and the hint `#way-forward-hint` ("…sales@polypoint.ch"). Shot.
4. Language `fr` (selector, or reload with `language=fr`) → repeat step 3 → "Votre organisation est introuvable. Veuillez vérifier que votre adresse électronique est correcte."
5. `#email` = `{{HPA_LOGIN}}@{{TENANT}}.ch` → `#form-login` with `#email_or_username` and `#password`; record whether the username is prefilled (expected not, PPCLOUD-13400) and whether "Passwort vergessen?" shows (expected not: flag baseline false). Do **not** submit a password.
6. Anonymous `GET https://ct-polyid-login.dev.k8s.polypoint-dev.com/api/providers?email={{HPA_LOGIN}}@{{TENANT}}.ch` → 200, one provider, `active: true`, `showResetPasswordButton: false` → `providers-ok.json`; `…?email=nobody` → 400 → `providers-400.json`.

Expect: as stated per step; no 5xx page, no `/ui/error`.

## AUT-04 — Password form: wrong password, expired login session, success

Run 1 (`--allow-wrong "{{HPA_LOGIN}}"`, 2 submissions):

1. Onboard `{{HPA_LOGIN}}@{{TENANT}}.ch`, `polyid.password('WRONG')` → `errors=BadCredentials`, text "Anmeldefehler: Bitte überprüfen Sie Benutzername/Passwort …", no warning box. Shot `01-bad-credentials.png`.
2. `ctx.clearCookies({name: 'login_challenge'})` (polyid-login domain), then `polyid.password('SEED')` → `errors=LoginChallengeExpired`, "Ihre Sitzung ist abgelaufen. Bitte starten Sie den Anmeldevorgang von vorne." (the credential check is never reached). Shot `02-session-expired.png`.
   Run 2 (immediately after run 1, 1 submission — the success that clears the IP counter):
3. myPP root again, onboard, `polyid.password('SEED')` → `/tabs/…` (accept a consent / "allow" modal if shown); `current-user/sync` 200. Shot `03-landing.png`.
4. `polyid-admin … user-read "{{HPA_LOGIN}}"` → `state ACTIVE`, record `password_strength_level` → `user-HPA.json`; `polyid-admin … applied-policies` → no row for HPA, no (or 0-attempt) row for this machine's IP → `applied-policies.json`.
5. Logout (Profile → "Ausloggen").
6. Optional (only if `auth-allocation.md` lists DISU / NOEMP from seed A8): one SEED submission each in its own run; record the page text. DISU: product intent = a readable "deactivated" message; a raw `AccountDisabled` = **KNOWN-FAIL AUT-S4**. NOEMP: a template error instead of the PEP-data message = **KNOWN-FAIL AUT-S5**. Each followed by a HPA success run if the attempt counted as a failure.

Expect: steps 1–4 as stated; step 6 per AUT-S4 / AUT-S5 (record, optional).

## Cleanup checklist

- HPA logged out; no wrong password without a following success (`result.json` `wrongWithoutSuccess` false in the last run).
- NEWU's consent and PolyID user stay (irreversible for the env): `created_data` with `cleaned: false`.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
