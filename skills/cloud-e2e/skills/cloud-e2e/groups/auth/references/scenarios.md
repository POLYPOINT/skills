# Group auth — scenario catalogue (AUT, 16 scenarios)

Converted from `areas/auth/scenarios.md` (A-auth, 2026-10-23; code base cloud master 89d7e960e0, pp-services origin/master 2026-10-15) with the S1 reconciliations of 2026-10-23:

- environment = **DM-Y** (shared with utr, planner, ops); the tenant provider is DeployMate's (`API_GATEWAY_VALIDATION`, 2FA DISABLED), the portal tenant has Send Messages OFF;
- the tenant admin `TA` is the steward's role-kit actor (`E2E:TA`), borrowed read-only (AUT-16 acts only on BLKU); plain-HP actors move into the kit group `E2E:HP-PLAIN` (out of `DMSEED:Planner`, otherwise the planner role changes their landing page);
- **AUT-09 uses the per-user TOTP override** and is not exclusive; only AUT-10 switches the tenant-wide 2FA, inside **W-Y-TENANT2FA** (LOGIN class, window family X10);
- AUT-05 runs inside **W-Y-LOCKOUT** (LOGIN class, family LOCK, two parts: the lock burst in the window, the expiry check ≥ 31 min later); the unlock is the **steward's**;
- AUT-06 → AUT-07 → AUT-08 run inside the HARD window **W-Y-MSG** (shared with ops OPS-13 part B and manual AUT-19); the steward switches Send Messages ON after the OFF-phase items (AUT-06, OPS-13 part A) and OFF after the last mail; workers only verify the state;
- new passwords exist only in the memory of one script run; the runner restores PWU's manifest password and e-mail in the box Keycloak;
- moved out: AUT-12, AUT-13 (Microsoft, need a tenant with a registered Azure app) → group `shared`; AUT-15 (Teams logout) → `manual` (Teams session); AUT-19 (new user from UsrAdmin) → `manual` (PEP-RDP session, inside W-Y-MSG);
- harness names: `app.mjs --app mypp|poma|customer-portal` (was `mypp.mjs` + H-1), `polyid-flow.mjs` (H-AUTH-1), `polyid-admin.mjs` (H-AUTH-2; `applied-policies` replaces `polyid-unlock.mjs read`; `unlock` is steward-only), `portal-ops.mjs flag read|set` and `tenant read` (was `portal-flag.mjs`).

Families (worker steps: `../assets/family-briefs/<F>.md`; this file is the reference text): **NAV** AUT-01, 02 · **LOGIN** AUT-18, 03, 04 · **LOCK** AUT-05 (W-Y-LOCKOUT, parts 1/2) · **PWD** AUT-06, 07, 08 (W-Y-MSG, parts 1/2) · **2FA** AUT-09, 11 · **X10** AUT-10 (W-Y-TENANT2FA) · **LOGOUT** AUT-14 (parts 1/2) · **UM** AUT-16, 20 · **IMP** AUT-17. Data, recipients and concurrency: `data-plan.md`. Suspicions: `known-deviations.md` (AUT-S1..S10 = area S1..S10). Dashboard rows: `../assets/scenarios.json`.

| Moved out                                                     | Now in                                     | Why                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| AUT-12, AUT-13 (Microsoft ADFS / Entra, browser and app path) | `shared` (family SH-MS)                    | the Azure redirect URI contains the provider id: a DeployMate tenant is not registered; W-SH-MSTENANT |
| AUT-15 (logout inside MS Teams)                               | `manual` (Teams session)                   | real Teams client                                                                                     |
| AUT-19 (new user from PEP / UsrAdmin, set-password mail)      | `manual` (PEP-RDP session, inside W-Y-MSG) | no pep-verify flow for new employee / user (OQ-20)                                                    |

## Conventions used by every scenario

- **Environment.** DM-Y cloud tenant `{{TENANT}}`, users `<login>@{{TENANT}}.ch`. CT hosts: myPP `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app`, planner app `…/shift-planner`, poma-api `https://ct-poma-api.dev.k8s.polypoint-dev.com`, PolyID login and PolyID ops `https://ct-polyid-login.dev.k8s.polypoint-dev.com` (`/ops/`), Hydra `https://ct-polyid.dev.k8s.polypoint-dev.com`, portal `https://ct-portal-webapp.dev.k8s.polypoint-dev.com` (`/ops` PolyPortal ops, `/portal` customer portal).
- **Actors** (seed logins mapped in seed A1; tokens of `rules.json`): HPA (plain HP), SEEDSP (seed planner), NOHP (no health-professional client role), LOCKU, PWU, OTPU, T2FU, OFFU, SMSU, BLKU, NEWU, EMPU, optional IMPBLK / DISU / NOEMP, TA (borrowed), OPS (the runner's PolyID / portal ops sessions), OPS-IMP (the operator's ops-realm account for impersonation, typed by the operator).
- **Secrets.** Seed passwords come from the DeployMate manifest through the harness; wrong passwords are random strings in memory. TOTP secrets, OTP / SMS codes and set-password links are never written to files, logs, notes, rows or screenshots (shots mask `.otp-img`, `.qr_code`, `#otp_secret`, `.copy-secret-container`, `.otp-setup-container`); record only "secret present / changed". JWTs are decoded in memory; only role lists and claim **names** are saved.
- **Password budget.** Every submission counts towards the PolyID lock (user 13 / IP 18 per provider, no expiry). At most 2 submissions per harness call; more only in AUT-05 inside its window. Every wrong password is followed by a success from the same IP.
- **Messaging.** CT sends real SMS and e-mail. Only owned recipients: the team mailbox `{{AUTH_MAILBOX}}` and the sms-logger test number. Nothing is ever sent to a seeded `…@{{TENANT}}.ch` address.
- **Gates** (runner, before the families): **AUT-G1** PolyID ops session + `provider-read` (type `API_GATEWAY_VALIDATION`, `twoFactorType DISABLED`, domain `{{TENANT}}.ch`), `applied-policies` without a locked subject, portal tenant Send Messages OFF; **AUT-G2** every actor except NEWU logged in once (≤ 1 submission), role lists (HPA HP without SP, SEEDSP both, NOHP without HP, TA tenant admin), `user-read` ACTIVE, NEWU absent; **AUT-G3** (before AUT-07 / 08 / 11) the operator confirms the team mailbox and the POLYPOINT-owned sms-logger number and its live host.
- **Oracles.** PolyID page state (URL path, `errors=` / `warnings=`, `.login-error` / `.login-warning`, element ids of `polyid-login` templates); PolyID admin (`user-read`, `applied-policies`, `audit`); customer-portal API (`/api/private/business/portal/incidents`, `…/health/usermanagement/users`); myPP (`current-user/sync`, `pep-employments/valid-on-date`); box DB for PEP data. Screenshots are evidence, never the oracle.
- **Expected values.** `PASS`, or `SUSPECT-FAIL AUT-S<n>` where the code suggests a defect; a matching signature is reported as `KNOWN-FAIL AUT-S<n>`, a suspicion that does not reproduce as PASS with "AUT-S<n> not reproduced".
- **Ownership.** Each scenario owns its actors. "Exclusive" in the text below = the named window: no other worker on `{{TENANT}}` starts a fresh PolyID login (LOGIN) or anything at all (HARD).

---

### AUT-01 Invalid user page: health professional opens the shift-planner app

> Data prerequisite: actor `HPA` (seed login with the HP role only), gate AUT-G2. Read-only.
> Pre: profile `auth-HPA` (persistent); harness `app.mjs --app mypp` with H-1 planner landing (accepts `/invalid-user`).
> Steps:
>
> 1. `node app.mjs {{TENANT}} <HPA> aut01.mjs out/AUT-01` logs in to myPP (precondition). Decode the captured bearer in memory and save the role list (`roles.json`).
> 2. `api.goto('/shift-planner/dashboard')` (root-relative). Wait up to 30 s until the URL path ends in `/invalid-user`. Record whether a PolyID password form appeared: expected none, because the Hydra login is remembered for 1 h.
> 3. Read `h1.invalid-user-title` and count `.invalid-user-option`; check that `#logout-button` and `#go-to-health-professional-button` are present and that `#go-to-shift-planner-button` / `#go-to-pool-manager-button` are absent. Shot.
> 4. Click `#go-to-health-professional-button`; the browser opens `/health-professional`. Record the final URL and whether a login was required.
> 5. Direct API with HPA's bearer: `api.call('GET', '/api/private/opportunities')`. Record the status.
>    Expect: path `/invalid-user`; title "Fehlen der korrekten Berechtigungen"; 3 options; Option 3 "Bei myPOLYPOINT anmelden"; no second password prompt; step 5 is refused (401/403; a 200 carrying planner data is a FAIL).
>    Oracle: URL path, element presence, role list (no `ROLE_SHIFT_PLANNER`), step-5 status.
>    Evidence: 01-invalid-user.png, roles.json, opportunities-status.json, notes.md.
>    Source: 11466604545#1; POMA-SHELL-01; `polypoint-poma-frontend/src/app/flows/guards/flows-parent.guard.ts:18-24`, `shared/invalid-user/invalid-user.component.html`.

### AUT-02 Invalid user page in myPOLYPOINT: user without the health-professional role

> Data prerequisite: actor `NOHP`, a seed planner whose on-prem client role `ROLE_HEALTH_PROFESSIONAL` was removed in seed A3 (`data-plan.md`; guess on the mechanism). BLOCKED when A3 was skipped or gate AUT-G2 shows the role.
> Pre: fresh profile `auth-NOHP`.
> Steps:
>
> 1. `node app.mjs {{TENANT}} <NOHP> aut02.mjs out/AUT-02`. The harness counts `…/health-professional-app/polyid/invalid-user` as logged in. Record the landing URL; save `roles.json`.
> 2. Read the `h2` text and the buttons: `#logout-btn` present, `#access-shift-planner-btn` present (SP role), `#access-pool-manager-btn` present only if the role list has `ROLE_POOL_MANAGER`. Shot.
> 3. Click `#access-shift-planner-btn`; expect `/shift-planner/…` (dashboard) without a password prompt. Shot.
> 4. Back to myPP root, then `#logout-btn`. Record the final URL (logout chain checks as in AUT-14, step 3).
>    Expect: path `/polyid/invalid-user`; title "Ihrem Benutzerkonto fehlen die korrekten Berechtigungen"; text "Bitte melden Sie sich ab …"; the button "Zugriff als Dienstplaner" opens the planner app.
>    Oracle: URL, elements, role list.
>    Evidence: 01-mypp-invalid-user.png, 02-planner-landing.png, roles.json.
>    Source: gap (MYPP-AUTH-09), extends 11466604545#1; `polypoint-mypolypoint-app/src/app/shared/auth.guard.ts:99-109`, `flows/polyid/invalid-user/invalid-user.component.html`.

### AUT-18 First login of a never-logged-in user: consent reject / accept, PolyID user, legal links

> Data prerequisite: actor `NEWU`, never logged in by any area (gate AUT-G2 shows no PolyID user). Budget 3 password submissions.
> Pre: `polyid-flow.mjs {{TENANT}} <NEWU> aut18.mjs out/AUT-18 --app mypp --fresh`.
> Steps:
>
> 1. Onboard + password → consent page (`consent.ftl`): POLYPOINT terms and the data-privacy checkbox (a tenant checkbox only if the tenant has own texts). Open the footer links "terms of use" / "data privacy" (`/ui/legal-conditions?legal-condition-type=…`): each answers 200 with a title and text. Shot.
> 2. Click the reject button. Record the final URL. Then open the myPP root: full login again (no remembered session).
> 3. Onboard + password → consent → tick the required checkboxes → "Zustimmen" → `/tabs/`. `current-user/sync` 200; `GET …/pep-employments/valid-on-date?date=<today>` lists NEWU's employment(s) (compare with the manifest).
> 4. `polyid-admin user-read <NEWU>`: user exists, `state ACTIVE`, `password_strength_level` present.
> 5. Logout, then log in again: no consent page.
>    Expect: as stated.
>    Oracle: page states, legal-page statuses, sync + employments JSON, admin user row.
>    Evidence: 01-consent.png, legal-\*.status, 02-rejected.png, 03-landing.png, sync.json, employments.json, user-NEWU.json.
>    Source: 12369657898#3 (substitute), gaps G14, G17 (PID-LOGIN-04, PID-LEGAL-01, MYPP-INIT-04); `PL/rest/ConsentController.java:65-176`, `PL/rest/WebController.java:130-186`.

### AUT-03 Onboarding errors and tenant discovery (no password)

> Data prerequisite: none beyond the env. Read-only, no password submitted.
> Pre: `polyid-flow.mjs {{TENANT}} - aut03.mjs out/AUT-03 --app mypp --fresh`.
> Steps:
>
> 1. Open the myPP root; the PolyID on-board form `#form-onboard` appears. Shot.
> 2. Type `nobody` (no `@`) into `#email` and click `#submit-button`. Record what blocks it: client-side `#errorEmail`, or a server error after redirect (`errors=` param, `.login-error` text).
> 3. Type `e2e-unknown@no-such-tenant.invalid` and submit. Expect the error "Ihre Organisation konnte nicht gefunden werden. Bitte überprüfen Sie, ob Ihre E-Mail korrekt ist." and the way-forward hint `#way-forward-hint` ("…sales@polypoint.ch"). Shot.
> 4. Switch the language selector to `fr` (or reload with `language=fr`) and repeat step 3. Expect "Votre organisation est introuvable. Veuillez vérifier que votre adresse électronique est correcte."
> 5. Type `<HPA>@{{TENANT}}.ch` and submit. Expect the login form `#form-login` with `#email_or_username` and `#password`. Record whether the username is prefilled (expected not, PPCLOUD-13400) and whether "Passwort vergessen?" is shown (expected not: flag off by default).
> 6. App API (anonymous): `GET https://ct-polyid-login.dev.k8s.polypoint-dev.com/api/providers?email=<HPA>@{{TENANT}}.ch` should return 200 with one provider (`active: true`, `showResetPasswordButton: false`); `GET …/api/providers?email=nobody` should return 400.
>    Expect: as stated per step; no 5xx page, no `/ui/error`.
>    Oracle: page texts / URLs, providers JSON.
>    Evidence: 01..05 shots, providers-ok.json, providers-400.json.
>    Source: gaps G4, G20, G21 (PID-LOGIN-02, PID-LOGIN-05, MYPP-AUTH-01); `PL/service/OrganizationSelectionService.java:93-153,243-263`, `PL/rest/ProvidersApiController.java:49-110`.

### AUT-04 Password form: wrong password, expired login session, successful login

> Data prerequisite: actor `HPA`. Budget `--max-password-submits 3` (one wrong). Optional step 6 needs seed A8 (actors `DISU` = on-prem disabled Keycloak user, `NOEMP` = Keycloak user without a PEP employee); skip it when A8 was not done.
> Pre: `polyid-flow.mjs {{TENANT}} <HPA> aut04.mjs out/AUT-04 --app mypp --fresh`.
> Steps:
>
> 1. Onboard `<HPA>@{{TENANT}}.ch`, then `password(WRONG)`. Expect `errors=BadCredentials` in the URL and the text "Anmeldefehler: Bitte überprüfen Sie Benutzername/Passwort …"; no warning box. Shot.
> 2. Delete the cookie `login_challenge` (`ctx.clearCookies({name:'login_challenge'})`, domain of polyid-login), then submit the **correct** password. Expect `errors=LoginChallengeExpired` and "Ihre Sitzung ist abgelaufen. Bitte starten Sie den Anmeldevorgang von vorne." The credential check is never reached.
> 3. Open the myPP root again (new challenge), onboard, submit the correct password. Expect landing on `/tabs/…` (consent / "allow" modal accepted if shown) and `current-user/sync` 200.
> 4. `polyid-admin user-read {{TENANT}} <HPA>`: `state ACTIVE`, `password_strength_level` present (record it). `polyid-admin applied-policies`: no row for `<HPA>`, and no row or attempts 0 for this machine's IP (a successful login clears both).
> 5. Logout (profile → "Ausloggen").
> 6. _(optional, A8)_ `DISU`: correct password once, record the shown text (product intent: a readable "deactivated" message; AUT-S4 suspicion: raw `AccountDisabled`). `NOEMP`: correct password once, record the page (AUT-S5 suspicion: template error instead of the PEP-data message).
>    Expect: steps 1–4 as stated; step 6 per AUT-S4/AUT-S5.
>    Oracle: URL params + texts, admin user row, applied policies.
>    Evidence: 01-bad-credentials.png, 02-session-expired.png, 03-landing.png, user-HPA.json, applied-policies.json, optional 06-\*.png.
>    Source: gaps G3, G6, G16 (PID-LOGIN-03, PID-PWD-03); `PL/rest/LoginWebappController.java:181-189,368-447`, `PT/login-errors.ftl`.

### AUT-05 Brute-force lockout, incident and ops unlock

> Data prerequisite: actor `LOCKU` (dedicated, never used elsewhere), control actor `HPA`, gate AUT-G1. Budget `--max-password-submits 15 --allow-wrong <LOCKU>`, approved in the family brief (LOCK part 1). **Exclusive**: no other PolyID password login on `{{TENANT}}` during steps 1–6 (about 4 min). Unlock is done by the steward only.
> Pre: `polyid-admin.mjs <profile> <out> {{TENANT}} applied-policies` shows no row for `<LOCKU>`, and fewer than 3 attempts for this machine's IP. `polyid-flow.mjs {{TENANT}} <LOCKU> aut05.mjs out/AUT-05 --app mypp --fresh`.
> Steps:
>
> 1. Onboard `<LOCKU>@{{TENANT}}.ch`; submit WRONG passwords 1–9. After each, expect `errors=BadCredentials` and no warning. Record the elapsed time; each failure takes at least 2 s.
> 2. Wrong passwords 10, 11, 12: expect a warning "Warnung: Es wurden viele falsche Loginversuche festgestellt. Sie haben noch 3 / 2 / 1 Versuche …" (`warnings=` param). Shot each.
> 3. Wrong password 13: the `errors` param carries `BadCredentials` plus the translated lock text, so the page shows "Ihr Konto wurde gesperrt. Bitte kontaktieren Sie Ihren Administrator." under the bad-credentials message (`UIFeedback.addToQueryMap` puts the translation, not the code). Shot.
> 4. Submit the **correct** password for `<LOCKU>`. Expect it to stay refused: a correct password does not lift the lock. This path redirects with the code `errors=account_locked`, which the template renders as the **"deactivated"** text "Ihr Benutzerkonto ist zurzeit deaktiviert …" (AUT-S1, `login-errors.ftl:28-29`). Product intent is the lock text of step 3. Record the text; issue shot if it is the deactivated text.
> 5. Submit one more WRONG password. Record the HTTP status, URL and page. AUT-S3 suspicion: JSON 423 / error page instead of the login form. Issue shot if not the login form.
> 6. Immediately, in a fresh context, log in as `HPA` with the correct password. Expect success. This proves the IP is not locked, and the success clears the IP counter.
> 7. `polyid-admin.mjs … applied-policies`. Expect `<LOCKU>` locked, attempts ≥ 13, `unlockAt` = last attempt + 30 min; the IP subject absent or below 18.
> 8. `TA` in the customer portal (`/portal/incidents`, capture `GET /api/private/business/portal/incidents`) or `OPS` on `/ops/incidents`: an incident of type "Brute force attack", severity CRITICAL, tenant `{{TENANT}}`, text "<LOCKU> has been locked because …", created during step 3.
> 9. _(AUT-S2, piggy-back)_ At the end of the run, ≥ 31 min after step 3 and before step 10, `<LOCKU>` submits the correct password once more. Expect still `account_locked` (code: locks never expire); a successful login means AUT-S2 is not reproduced.
> 10. Steward (never the worker): `polyid-admin.mjs … unlock --subject <LOCKU>` → exit 0 (re-read: gone). `<LOCKU>` logs in with the correct password → success.
>     Expect: lock exactly at failure 13 with warnings at 10–12; the correct password is refused while locked; incident present; unlock restores the login. Known suspicions AUT-S1, AUT-S2, AUT-S3.
>     Oracle: URL `errors` / `warnings`, applied-policies JSON before/after, incident JSON, final login.
>     Evidence: 01..15 shots, applied-policies-locked.json, applied-policies-after-unlock.json, incidents.json, notes.md (timings).
>     Source: gaps G1, G26 (PID-LOCK-01, PID-LOCK-02); `PL/service/bruteforce/*`, `PL/rest/LoginWebappController.java:368-428`, `PL/service/IncidentService.java:110-125`.

### AUT-06 Forgot password: flag gating, request page, app path, invalid link (no mailbox)

> Data prerequisite: actor `PWU`. Gate AUT-G1 must show **Send Messages = off** for `{{TENANT}}`; otherwise step 4 is skipped (it would mail a synthetic address). Never run at the same time as AUT-07 / AUT-08.
> Pre: `polyid-flow.mjs {{TENANT}} <PWU> aut06.mjs out/AUT-06 --app mypp --fresh`; `PORTAL_ORG`, portal profile (operator session).
> Steps:
>
> 1. `GET …/api/providers?email=<PWU>@{{TENANT}}.ch` returns `showResetPasswordButton: false`. Onboard and look at the login form: no "Passwort vergessen?" link. Shot.
> 2. Config owner: `portal-ops.mjs <profile> "flag set {{TENANT}} polyid.flows.allowPasswordResetForNonADUsers true" <out>`. Poll `/api/providers?email=…` every 30 s until `showResetPasswordButton: true` (≤ 6 min, portal cache + 60 s reload).
> 3. Fresh context, onboard: the link "Passwort vergessen?" is present. Click it; `/ui/reset-password?…` shows `#email_or_username`. Type `e2e-no-such-user`, then `#submit-button`. Expect the page `#confirmation-message` = "E-Mail gesendet!" (no user enumeration). Shot.
> 4. _(Send Messages off only)_ Repeat with `<PWU>`'s username. Same page.
> 5. App path: `polyid-flow.mjs --app inapp`. Type `#provider-email-input` = `<PWU>@{{TENANT}}.ch` → in-app login form → "Passwort vergessen?" → `/auth/forgot-password` → username `e2e-no-such-user` → submit. Expect a success message and the return to the login after about 10 s. Capture the status of `POST /api/auth/reset-password` (record the status only).
> 6. Open `https://ct-polyid-login.dev.k8s.polypoint-dev.com/ui/password-management?change_password_token=e2e-garbage&language=de`. The page shows `#new_password` and `#confirm_password`. Type the same random strong password twice and submit. Expect the error "Beim Aktualisieren des Passworts ist ein Fehler aufgetreten". Shot.
> 7. Restore: keep the flag when AUT-07 follows in the same session, else set it back to the baseline `false` (`portal-ops.mjs … flag set … false`) and wait until `showResetPasswordButton: false`.
>    Expect: link visible only with the flag; the same confirmation for unknown and known users; app path answers 2xx (expected 204); a garbage token gives the generic error.
>    Oracle: providers JSON before/after, page texts, app status.
>    Evidence: providers-off.json, providers-on.json, 01-no-link.png, 03-sent.png, 05-app-forgot.png, 06-garbage-token.png, portal-ops flag logs.
>    Source: 12874383402#2 (corrected), gap G21 (PID-PWD-01, MYPP-AUTH-03); `PL/service/LoginService.java:337-345`, `PT/login.ftl:137-140`, `PL/rest/PasswordManagementController.java:120-242`.

### AUT-07 Forgot password: e-mail round trip, password policy, single-use link (operator mailbox)

> Data prerequisite: seed A5 (PWU's e-mail in the box Keycloak = `{{AUTH_MAILBOX}}`), the flag on (AUT-06 step 2), gate AUT-G3. **Exclusive window "messaging"** shared with AUT-08: tenant **Send Messages = on** (portal ops → tenant details → toggle "Send Messages"), switched on by the steward (W-Y-MSG requester) after AUT-06 and OPS-13 part A, and off right after the last mail. No other area runs on `{{TENANT}}` in this window: on-prem senders could otherwise mail synthetic addresses. Budget 3 password submissions.
> Pre: `polyid-flow.mjs {{TENANT}} <PWU> aut07.mjs out/AUT-07 --app mypp --fresh --headed` (the operator can paste the link into the same window). The new password is generated at runtime and kept only in the memory of the script run (the runner restores the manifest password in the box Keycloak).
> Steps:
>
> 1. Onboard → "Passwort vergessen?" → `<PWU>` username → "E-Mail gesendet!". Note the time.
> 2. Operator: the mail arrives in `{{AUTH_MAILBOX}}` within 5 min. The operator records subject + sender (`no-reply@polypoint.ch`) in notes, never the link. They open the link in the harness window, or put it into `out/AUT-07/.mail-link` (0600; the worker reads it, opens it and deletes the file).
> 3. `/ui/password-management`: (a) type two different passwords; expect the client-side error `#errorPasswordNotMatch`. (b) Type a 3-character password twice and submit; expect an on-prem policy message (`invalidPasswordMinLength…`); record the text. (c) Type the generated strong password twice; expect `/ui/password-updated-confirmed`. Shot each (no link visible in shots).
> 4. Open the same link again and submit another strong password. Expect "Das Token wird bereits verwendet" or "Das Token ist nicht mehr gültig" (record which).
> 5. Fresh context: `<PWU>` with the **manifest** password (1 attempt) → `BadCredentials`. Then the new password → landing `/tabs/`.
> 6. Restore: a second reset round trip sets the manifest password again. Or the runner sets it in the box Keycloak admin (`:8383`, realm `POLYP01`) and verifies one login with it. Restore PWU's e-mail (step A5 undo). The steward switches Send Messages off when AUT-08, OPS-13 part B and AUT-19 are done.
>    Expect: mail received; policy enforced; link single-use; old password refused; new password works.
>    Oracle: mail arrival (operator), page states, login outcomes. Optional and not tried: a portal "Recording" session (`/ops/recording`, PORT-REC-01) during step 1 shows polyid-login → api-gw `PUT /api/v1/password-reset/{user}` 2xx and the api-gw → portal-api messaging call.
>    Evidence: 01-sent.png, 03a/03b/03c shots, 04-reused.png, 05-login.png, notes.md (subject, times).
>    Source: 12874383402#1, #3, #4, #5 (corrected); PID-PWD-01, PID-PWD-02; `AGW/identityadministration/user/ResetPasswordService.java:62-110`, `AGW/portal/PolyportalService.java:120-160`, `PL/rest/PasswordManagementController.java:120-180`.

### AUT-08 Reset password from UsrAdmin ("Mail senden mit Link für neues Passwort")

> Data prerequisite: actor `PWU` again (after AUT-07) or `UAU`; e-mail = `{{AUTH_MAILBOX}}` (step A5); the exclusive window "messaging" (Send Messages on); the box's ID-administration service and RabbitMQ healthy (portal tenant deep health). PEP lock `the env's PEP lock`. pep-verify needs a UsrAdmin flow "user → Mail senden …" (open question, `data-plan.md`). Without it the operator clicks the button over RDP under the PEP lock.
> Pre: pep-verify preflight on `{{TENANT}}`; `polyid-flow.mjs … --headed` ready for the link.
> Steps:
>
> 1. Holding `the env's PEP lock`, pep-verify: start UsrAdmin as the box's Leitbediener, open the user `<PWU>` (double-click), check that the e-mail field shows `{{AUTH_MAILBOX}}`, click "Mail senden mit Link für neues Passwort", confirm. Shot. Release the lock.
> 2. Operator: the mail arrives within 5 min. Record the subject and the first body line. Expected: the **set-password** template, whose body differs from the AUT-07 mail; the subject may be the same (`set_password_email_subject`). Paste the link as in AUT-07.
> 3. `/ui/password-management` → strong password → `/ui/password-updated-confirmed`.
> 4. Fresh login with the new password → `/tabs/`.
> 5. Restore the manifest password and the e-mail. The steward switches Send Messages off and verifies it.
>    Expect: mail received with the set-password template; the password is set through `POST /api/v1/users/password`; login works.
>    Oracle: mail arrival and template marker (operator), page states, login.
>    Evidence: 01-usradmin.png, 03-confirmed.png, 04-login.png, notes.md.
>    Source: 13218742315#1–#3; 12369657898#2 (substitute); `AGW/event/identityadministration/ResetPasswordMessageHandler.java:29-37`, `AGW/portal/PolyportalService.java:130-133`, `PL/rest/PasswordManagementController.java:158-169`.

### AUT-09 TOTP via per-user override: enrol on the web, verify, reset, re-enrol in the app

> Data prerequisite: actor `OTPU` (dedicated); gate AUT-G1 (tenant `twoFactorType DISABLED`). Per-user change only: no tenant mutation. Budget 4 password submissions (spread over 4 harness runs).
> Pre: `polyid-admin.mjs` session; `polyid-flow.mjs {{TENANT}} <OTPU> … --fresh` per login.
> Steps:
>
> 1. `polyid-admin user-2fa {{TENANT}} <OTPU> TOTP` (UI equivalent: PolyID ops → Tenants → `{{TENANT}}` → Users → search `<OTPU>` → expand → Two Factor Auth → Two Factor Type = "Time-based one-time password (preferred)"). Read back `twoFactorType: TOTP`, `otp_verified: false`.
> 2. Web login: onboard + password. The OTP page `#form-otp` shows the QR and the copy link. Read `#otp_secret` in memory (never logged). Masked shot.
> 3. Submit `000000` (or any code that differs from the current one). Expect "Code ist nicht gültig." The page now carries a **different** secret: compare hashes in memory and record only `secretChanged: true|false`.
> 4. Compute the TOTP code (RFC 6238, SHA1, 6 digits, 30 s; base32 secret of the page now shown) and submit. Expect landing on `/tabs/`. `user-read`: `otp_verified: true`.
> 5. Logout. Fresh login: the OTP page has **no** QR and no `#otp_secret`. Submit a code computed from the secret held in memory since step 4. Expect success.
> 6. `polyid-admin reset-otp {{TENANT}} <OTPU>`; `user-read`: `otp_verified: false`. Drop the old secret from memory.
> 7. App path: `polyid-flow.mjs --app inapp --grant-clipboard`. Type `#provider-email-input` → `#name-input` / `#password-input` → `/auth/2fa` shows `.otp-setup-container` with the QR and "copy secret". Click `.copy-secret-btn-container`, read the clipboard in memory, compute the TOTP code and submit it. Expect `/tabs/home` (or the team-roster tutorial). Masked shot.
> 8. In-app logout and login again with a TOTP code: success, without a QR.
> 9. Restore: `user-2fa <OTPU> DEFAULT`, `reset-otp <OTPU>`. Read back `twoFactorType` null/Default and `otp_verified: false`.
> 10. `polyid-admin audit {{TENANT}} --since <start>` lists the 2FA override changes and the OTP resets (actor = the ops user).
>     Expect: as stated; the TOTP code is accepted within the 30-s window.
>     Oracle: admin user rows after steps 1, 4, 6, 9; page states; audit entries.
>     Evidence: masked shots, user-\*.json (no secret fields), audit.json, notes.md.
>     Source: 13223362757#2–#6 (per-user variant), 11993579561#3; PID-2FA-02, PID-2FA-03, PID-OPS-04; `PL/service/twofactor/TwoFactorOTPStrategy.java:70-153`, `OF/pages/provider/users-form/users-form.component.html:160-183`.

### AUT-11 SMS one-time code (MOBILE_OR_EMAIL) through the CT sms-logger

> Data prerequisite: actor `SMSU` whose on-prem `mobile_number` is the sms-logger test number (seed A6, guess on the attribute; owner confirmed in gate AUT-G3). Per-user override only. At most 3 SMS per run and at most 5 code verifications per 10 min per user (`TwoFactorAuthService.java:79-83`). BLOCKED → manual-only when gate AUT-G3 fails; substitute AUT-09.
> Pre: `polyid-flow.mjs {{TENANT}} <SMSU> aut11.mjs out/AUT-11 --fresh`; the sms-logger page in a second tab.
> Steps:
>
> 1. `polyid-admin user-2fa {{TENANT}} <SMSU> MOBILE_OR_EMAIL`.
> 2. Onboard + password → `/ui/2fa-form` (`#form-2fa`, `#code`). Within 60 s the sms-logger shows a new message for the test number. Its text follows `PR/sms/messages/messages_<lang>.properties` key 1, e.g. "Please use this code for security verification: NNNNNN". Read the 6 digits in memory.
> 3. Submit a wrong code → "Code ist nicht gültig." Then the real code → `/tabs/`.
> 4. New login: on the 2FA page wait until `#resend-code` is enabled (≥ 30 s), click it, read the new SMS. Submit the **old** code: refused (the code was replaced on resend). Submit the new one: success.
> 5. _(optional, 3 min)_ New login; wait > 3 min; submit the code → "TwoFactorAuthCodeTimeout" text.
> 6. Restore: `user-2fa <SMSU> DEFAULT`.
>    Expect: SMS delivered to the logger; codes behave as stated.
>    Oracle: sms-logger entry (time, recipient = test number, 6-digit code), page states.
>    Evidence: 02-2fa-form.png, sms-logger-entries.txt (codes replaced by `******`), 03-04 shots.
>    Source: 11993579561#1; gap G11 (PID-2FA-01); `PL/service/twofactor/TwoFactorPolyIdStrategy.java:57-66`, `PL/domain/model/TwoFactorAuthCode.java:59-67`.

### AUT-10 Tenant-wide TOTP: enforcement, running sessions, "2FA config missing" incident

> Data prerequisite: actors `T2FU` (override Default, never enrolled), `OFFU` (persistent profile logged in **before** the switch), `TA`. **Exclusive window "tenant 2FA"** (about 15 min): no other PolyID login on `{{TENANT}}`, because every fresh login would be forced into enrolment. Run it after the other areas' logins of the day, or alone. Budget: 1 + 1 submissions.
> Pre: `OFFU` logged in via `app.mjs --app mypp` (profile `auth-OFFU`) at least 5 min before; gate AUT-G1.
> Steps:
>
> 1. Window owner (X10 worker): `polyid-admin.mjs … provider-2fa TOTP --window W-Y-TENANT2FA` (UI: PolyID ops → `{{TENANT}}` → Security → "Two Factor Authentication" = "Time-based one-time password (preferred)" → Update Provider). Read back `capabilities.twoFactorType: TOTP`.
> 2. `T2FU` fresh login → OTP enrolment page → TOTP code (as AUT-09 step 4) → `/tabs/`. `user-read T2FU`: `otp_verified: true`.
> 3. `OFFU`: reopen myPP with `auth-OFFU` (no login). The app works: the home calls and `current-user/sync` answer 200, and no 2FA page appears (11993579561#2).
> 4. `OFFU` logout, then a fresh login. Expect the enrolment page (record; do not enrol).
> 5. Window owner: `provider-2fa DISABLED --window W-Y-TENANT2FA`; read back.
> 6. `TA` opens `/portal/incidents` (capture the incidents API). Expect a new incident "2FA config missing", INFO, tenant `{{TENANT}}`, text "User <ops user> changed two factor authentication configuration, and now is missing for tenant {{TENANT}}".
> 7. `T2FU` fresh login: no 2FA page. Expected, since a Default override follows the tenant.
> 8. Cleanup: `reset-otp T2FU`, `reset-otp OFFU`.
>    Expect: as stated.
>    Oracle: provider read-backs, user rows, incident JSON, page states.
>    Evidence: provider-totp.json, provider-disabled.json, user-T2FU.json, 03-offu-still-in.png, 04-offu-enrol.png, incidents.json.
>    Source: 13223362757#1, #7 (corrected), 11993579561#2; gap G12 (PID-2FA-03); `PL/rest/admin/ProvidersApiController.java:250-264`, `PL/service/IncidentService.java:130-145`.

### AUT-14 Logout: id_token_hint, on-prem logout, new login required (web; part B after a token refresh)

> Data prerequisite: actors `HPA` (myPP), `SEEDSP` (POMA web). Read-only. Part B needs a profile logged in ≥ 65 min earlier (start it at the beginning of the run).
> Pre: profiles `auth-logout-HPA`, `auth-logout-SP`, `auth-logout-HPA-b`. The script records every request to `ct-polyid…/oauth2/sessions/logout` and `ct-polyid-login…/api/logout` (parameter **names** and the presence of `id_token_hint`, values redacted).
> Steps:
>
> 1. `app.mjs --app mypp {{TENANT}} <HPA>` (profile `auth-logout-HPA`). Open Profile and click "Ausloggen" (visible text).
> 2. The end-session request to Hydra carries `id_token_hint` (present) and `post_logout_redirect_uri` / `state`.
> 3. The chain passes `…/api/logout?logout_challenge=…` and ends on the client's post-logout URL. Record the final host + path. No page shows "Logout failed because query parameter state is set but id_token_hint is missing", and there is no `/ui/error`.
> 4. Open the myPP root again: the PolyID on-board form `#form-onboard` appears (no silent login).
> 5. `SEEDSP` on POMA web `/shift-planner/dashboard` (H-1) → header user menu (`.user-container`) → "Ausloggen" → steps 2–4 for the planner app.
> 6. **Part B (end of the run).** `HPA` logged in into `auth-logout-HPA-b` at the run start. Now reopen the myPP root with that profile. The app renews its tokens silently: record the status of the token request(s) to Hydra `/oauth2/token`. Then do "Ausloggen" → steps 2–3 again (PPCLOUD-14322 part 1: the id_token survives the refresh).
>    Expect: `id_token_hint` present in all three logouts; clean end page; a new login required.
>    Oracle: recorded request parameters, final URL, page text, on-board form after the logout.
>    Evidence: logout-chain-mypp.json, logout-chain-poma.json, logout-chain-refresh.json, 03-end-page.png, 04-onboard.png.
>    Source: gaps G5, G6, G23 (PID-LOGOUT-01, MYPP-AUTH-08; PPCLOUD-14322, PPCLOUD-14253); `polyid-user-manager.ts:115,336-346`, `PL/service/LogoutService.java:34-74`.

### AUT-16 Customer-portal user management: search rules, revoke sessions, block, unblock, reset 2FA

> Data prerequisite: actors `TA` (steward role kit `E2E:TA`: `ROLE_TENANT_ADMIN`) and `BLKU` (dedicated). For the reset-2FA step `BLKU` gets a TOTP override and enrols in step 0. Budget for `BLKU`: 4 submissions over the scenario.
> Pre: `BLKU` logged in to myPP in profile `auth-BLKU-P1` (kept open as the "running session"). `polyid-flow.mjs {{TENANT}} <TA> aut16.mjs out/AUT-16 --app portal`.
> Steps: 0. `polyid-admin user-2fa <BLKU> TOTP`; one fresh `BLKU` login with enrolment (as AUT-09 step 4); `user-read`: `otp_verified: true`. Re-login `auth-BLKU-P1` afterwards if needed.
>
> 1. `TA` opens `/portal/user-management`, searches username `<BLKU>`, gets one row (capture `GET /api/private/business/portal/health/usermanagement/users?username=`). With TA's bearer: both `username` and `email` → 400; an unknown username → 404.
> 2. "Revoke sessions" for `BLKU` (capture `POST …/users/revoke-sessions` 2xx).
> 3. Reopen myPP in `auth-BLKU-P1` and navigate Home → Kalender. Record whether the API calls still answer 200. Product intent: logged out. AUT-S7 suspicion: still logged in until the refresh token expires.
> 4. `TA`: change state to BLOCKED with a reason (`POST …/users/change-state` 2xx). `polyid-admin user-read`: `state BLOCKED`, `state_changer` = TA's user.
> 5. `BLKU` fresh login with the correct password → `errors=UserNotActive`, "Benutzer nicht aktiv". Also reopen `auth-BLKU-P1` and record the API statuses.
> 6. `TA`: state ACTIVE. `BLKU` fresh login → TOTP (no QR) → `/tabs/`.
> 7. `TA`: "Reset 2FA" (`POST …/users/reset-2fa` 2xx). `user-read`: `otp_verified: false`. `BLKU` fresh login → enrolment page again (masked shot; stop there).
> 8. `polyid-admin audit {{TENANT}} --since <start>`: entries for the state changes, the OTP reset and the session revoke.
> 9. Restore: `user-2fa <BLKU> DEFAULT`, `reset-otp <BLKU>`, state ACTIVE.
>    Expect: search rules 200/400/404; BLOCKED refuses the login; ACTIVE restores it; reset forces re-enrolment; actions audited. Step 3/5 per AUT-S7 (record).
>    Oracle: portal API statuses, admin user rows, myPP API statuses of the running session, audit entries.
>    Evidence: search-_.json, revoke.json, state-_.json, user-\*.json, p1-statuses.json, audit.json, shots.
>    Source: gaps G8, G9, G10 (PORT-CUST-05, PID-LOCK-03, PID-OPS-04); `polypoint-portal-core/.../CustomerUserManagementService.java:89-171`, `PL/rest/admin/HydraApiController.java:236-240`.

### AUT-20 Second employment appears in myPOLYPOINT after re-login

> Data prerequisite: actor `EMPU` (dedicated, one employment), PEP lock `the env's PEP lock`. pep-verify needs a flow "Definitionen – Personal → new employment" (open question). Without it the operator does step 2 over RDP under the PEP lock. Guess: api-pp may cache employees, so run the G4b-style enqueue for the employee if the new employment does not show (`data-plan.md` A9).
> Pre: `app.mjs --app mypp {{TENANT}} <EMPU>` profile `auth-EMPU`.
> Steps:
>
> 1. myPP: capture `GET /api/mobile/health-professional/v1/pep-employments/valid-on-date?date=<today>`; expect exactly 1 employment.
> 2. PEP (pep-verify, holding the lock): Definitionen – Personal → EMPU → "register new employment" (duplicate icon) → another Personalkategorie, end date 31.12.2099 → OK. Box DB oracle: 2 employment rows for EMPU's person.
> 3. myPP: logout and fresh login → `current-user/sync` 200 → `valid-on-date` lists 2 employments; the employment selector (profile) shows both. Shot.
> 4. Cleanup: PEP deletes **only the new employment** ("Mitarbeiter löschen" on that row) → re-login → 1 employment.
>    Expect: the second employment shows after re-login, and only after re-login.
>    Oracle: employments JSON before/after, box DB rows.
>    Evidence: employments-before.json, oracle-employments.txt, employments-after.json, 03-selector.png.
>    Source: 12369657898#4 (recipe), #5; MYPP-INIT-04; `MA/shared/services/api/employment-api.service.ts:12-25`.

### AUT-17 Support impersonation in the browser (myPOLYPOINT and POMA web)

> Data prerequisite: `OPS-IMP`, an ops-realm account with SUPPORT, OPERATIONS or ADMIN: the operator signs in headed, (never an account taken from Confluence). Targets `HPA` and `SEEDSP`; their `tenant_subject` comes from `polyid-admin user-read`. `TA` reads the incidents. A dummy ticket key `PPTX-999999` is typed as text only; no PPTX issue is ever opened. Optional refusal case: actor `IMPBLK` set to BLOCKED by `polyid-admin user-state` and restored afterwards.
> Pre: `polyid-flow.mjs {{TENANT}} - aut17.mjs out/AUT-17 --app mypp --fresh --headed`.
> Steps:
>
> 1. On the on-board form type `polypoint-impersonation` into `#email` → `/ui/impersonation/login-form` (`#impersonation-form`). Shot.
> 2. Validation: `#ticket_key` = `ABC-1`, valid `#tenant_id` = `{{TENANT}}`, `#tenant_subject` = HPA's subject → submit. Expect a ticket-key error (`InvalidPptxTicketKey`); record the text.
> 3. `#ticket_key` = `PPTX-999999`, same tenant and subject → submit. The Keycloak polyid-realm page appears ("Username or email" / "Sign In"); `OPS-IMP` signs in. Expect landing on myPP `/tabs/`; `current-user/sync` returns HPA (compare the username with the manifest). Shot of the home page.
> 4. Token observation (AUT-S9): decode the bearer in memory and record whether a claim named `impersonation` or `impersonator` exists. The code sets none on this path.
> 5. Second impersonation in the same browser context: open POMA web `/shift-planner/dashboard` → on-board `polypoint-impersonation` → `PPTX-999999`, `{{TENANT}}`, SEEDSP's subject. Record whether the Keycloak page was skipped (SSO, 13458407446#4). Expect landing on `/shift-planner/dashboard` as SEEDSP.
> 6. _(optional)_ Target `IMPBLK` (BLOCKED) → `errors=UserNotActive`. The incident is written anyway.
> 7. `TA`: `/portal/incidents` (capture the API). Expect 2 (3) incidents of type `SUPPORT_USER_IMPERSONATION`, WARNING, OPEN, text "Polypoint support user: <ops user> is impersonating <subject> in {{TENANT}} associated ticket: PPTX-999999". Record whether the TA UI offers any resolve action (AUT-S10: expected none).
> 8. Logout of the impersonated sessions (AUT-14 step 2–3 checks).
> 9. Negative role (13458407446#1): only if an ops-realm account without the three roles exists. It must be refused ("… is not allowed to impersonate users"). Otherwise note "not tested (no such account)".
>    Expect: format check, impersonated landing for both apps, incidents with the stated content.
>    Oracle: page states, sync identity, incident JSON, claim names.
>    Evidence: 01-form.png, 02-bad-key.png, 03-landing.png, 05-poma.png, incidents.json, claims-names.json, notes.md.
>    Source: 13458407446#1–#4; PID-IMP-01; `PL/rest/ImpersonationWebappController.java:159-520`, `PL/service/ImpersonationRules.java:14-24`, `PL/service/IncidentService.java:66-91`.
