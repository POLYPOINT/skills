# Family PWD — Forgot / reset password in the messaging window (AUT-06, AUT-07, AUT-08) · PWU

|                           |                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | AUT-06, AUT-07, AUT-08                                                                                                                                                                                                    |
| Actors                    | PWU `{{PWU_LOGIN}}` ({{PWU_ID}}), e-mail = the team mailbox `{{AUTH_MAILBOX}}` (seed A5); portal ops profile `{{PORTAL_PROFILE}}` (flag + tenant read)                                                                    |
| Window                    | **W-Y-MSG** (HARD, steward-granted): both parts run only while `windows/{{ENV}}~W-Y-MSG` is `active`. Part 1 = AUT-06 while Send Messages is **OFF**; then the steward switches Send Messages ON; part 2 = AUT-07, AUT-08 |
| Attended                  | part 2: the operator reads `{{AUTH_MAILBOX}}` and writes each link into `<outdir>/.mail-link` (0600); never a link in notes or shots                                                                                      |
| PEP                       | AUT-08 step 1 (UsrAdmin) under the PEP lock; no pep-driver flow exists for it — if the operator does it over RDP, they take the lock themselves (`holder "<name>/manual"`)                                                |
| Budget                    | ≤ 2 password submissions per run; new passwords live only in memory inside one script run                                                                                                                                 |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/PWD` · `{{RUN_DIR}}/PWD/<scenario>/` · `created/PWD.jsonl`                                                                                                                           |
| Read first                | the group part above; scenarios.md AUT-06..08                                                                                                                                                                             |

**PENDING convention.** Part 1 reports AUT-07 and AUT-08 as `PENDING` (nothing done); part 2 reads part 1's report and reports AUT-07 and AUT-08. The password-reset flag set in AUT-06 stays ON for part 2; AUT-08's last step sets it back.

Send Messages check (both parts, before every send): `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "tenant read {{TENANT}}" <out>` → `send_messages`. Part 1 needs `false` (else stop: BLOCKED "Send Messages already ON"); part 2 needs `true` — poll every 60 s up to 30 min, then BLOCKED "Send Messages not switched ON". You never toggle it.

## Part 1

### AUT-06 — Forgot password: flag gating, request page, app path, invalid link (no mailbox)

1. `GET https://ct-polyid-login.dev.k8s.polypoint-dev.com/api/providers?email={{PWU_LOGIN}}@{{TENANT}}.ch` → `showResetPasswordButton: false` → `providers-off.json`; `polyid-flow.mjs {{TENANT}} "{{PWU_LOGIN}}" <script> <out> --app mypp --fresh`: onboard → no "Passwort vergessen?" link (shot `01-no-link.png`; no password submitted).
2. `portal-ops.mjs {{PORTAL_PROFILE}} "flag set {{TENANT}} polyid.flows.allowPasswordResetForNonADUsers true" <out>`; poll `/api/providers?email=…` every 30 s until `showResetPasswordButton: true` (≤ 6 min) → `providers-on.json`.
3. Fresh context, onboard → the link "Passwort vergessen?" is present → click → `/ui/reset-password?…` shows `#email_or_username`; type `e2e-no-such-user` → `#submit-button` → `#confirmation-message` = "E-Mail gesendet!" (no user enumeration). Shot `03-sent.png`.
4. Repeat step 3 with PWU's username **only after re-checking `send_messages` = false** (with Send Messages OFF nothing is sent): the same page.
5. App path: `polyid-flow.mjs … --app inapp --fresh`: `#provider-email-input` = `{{PWU_LOGIN}}@{{TENANT}}.ch` → in-app login form → "Passwort vergessen?" → `/auth/forgot-password` → username `e2e-no-such-user` → submit → success message, back to the login after ≈ 10 s; record the status of `POST /api/auth/reset-password` only. Shot `05-app-forgot.png`.
6. Open `https://ct-polyid-login.dev.k8s.polypoint-dev.com/ui/password-management?change_password_token=e2e-garbage&language=de` → `#new_password`, `#confirm_password`; type the same random strong password (in memory) twice → submit → "Beim Aktualisieren des Passworts ist ein Fehler aufgetreten". Shot `06-garbage-token.png`.
7. Keep the flag ON (part 2 follows).

Expect: link only with the flag; the same confirmation for unknown and known users; app path 2xx (expected 204); a garbage token gives the generic error.

## Part 2 (Send Messages ON, operator present)

### AUT-07 — Forgot password: e-mail round trip, policy, single-use link

One script run `polyid-flow.mjs {{TENANT}} "{{PWU_LOGIN}}" {{RUN_DIR}}/scripts/PWD-AUT-07.mjs {{RUN_DIR}}/PWD/AUT-07 --app mypp --fresh --headed` (≤ 2 submissions):

1. Onboard → "Passwort vergessen?" → PWU's username → "E-Mail gesendet!" (shot `01-sent.png`). Note the time; tell the operator in the log line `WAITING FOR MAIL LINK in <outdir>/.mail-link`.
2. Poll for `<outdir>/.mail-link` (every 10 s, ≤ 10 min). The operator records subject + sender (`no-reply@polypoint.ch`) in `notes.md` themselves; read the link, open it, **delete the file**.
3. `/ui/password-management`: (a) two different passwords → client error `#errorPasswordNotMatch`; (b) a 3-character password twice → an on-prem policy message (`invalidPasswordMinLength…`, record the text); (c) a generated strong password (memory only) twice → `/ui/password-updated-confirmed`. Shots `03a/03b/03c` (no link visible).
4. Open the same link again (kept in memory from step 2) → submit another strong password → "Das Token wird bereits verwendet" or "Das Token ist nicht mehr gültig" (record which). Shot `04-reused.png`. Drop the link from memory.
5. New context in the same script: `polyid.password('SEED')` (manifest password) → `BadCredentials`; then fill `#password` with the new password from step 3c → `/tabs/` (shot `05-login.png`). Then the new password is dropped (never written).
   Restore: report in `blockers` "runner: set PWU's password back to the manifest password in the box Keycloak (realm POLYP01)".

Expect: mail received; policy enforced; link single-use; old password refused; new password works.

### AUT-08 — Reset password from UsrAdmin ("Mail senden mit Link für neues Passwort")

1. PEP step (lock `{{PEP_LOCK_DOC}}`): pep-verify UsrAdmin as the box's Leitbediener → open the user PWU → the e-mail field shows `{{AUTH_MAILBOX}}` → click "Mail senden mit Link für neues Passwort" → confirm; shot. No pep-driver flow exists for this: if you cannot drive it with element-level pep-verify commands within 10 min, release the lock and report BLOCKED "UsrAdmin flow missing (operator over RDP)"; the operator may then do step 1 under their own lock and write `step1-done` into `<outdir>/.operator` — continue with step 2 when that file exists (≤ 15 min).
2. Wait for `<outdir>/.mail-link` (≤ 10 min): the operator notes subject + the first body line (expected the **set-password** template; the subject may equal AUT-07's).
3. `/ui/password-management` → a new strong password (memory) → `/ui/password-updated-confirmed` (shot `03-confirmed.png`).
4. Fresh login with that password (same script run) → `/tabs/` (shot `04-login.png`).
5. Set the flag back: `portal-ops.mjs {{PORTAL_PROFILE}} "flag set {{TENANT}} polyid.flows.allowPasswordResetForNonADUsers false" <out>` (the baseline value; do not delete the override); poll `/api/providers?email=…` until `showResetPasswordButton: false`.
   Restore: `blockers` "runner: PWU password → manifest, PWU e-mail → manifest (box Keycloak and UsrAdmin); steward: Send Messages OFF".

Expect: mail with the set-password template; the password is set (`POST /api/v1/users/password` behind the page); login works.

## Cleanup checklist

- Flag `polyid.flows.allowPasswordResetForNonADUsers` = false (read back) — or still ON only if part 2 never ran (say so).
- No `.mail-link` / `.operator` file left; no password, link or token in any file.
- `created/PWD.jsonl`: PWU password changed twice (restore by the runner), flag set / reset.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
