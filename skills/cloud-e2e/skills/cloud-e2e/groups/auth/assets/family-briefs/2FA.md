# Family 2FA — Per-user TOTP and SMS codes (AUT-09, AUT-11) · OTPU, SMSU

|                           |                                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | AUT-09, AUT-11                                                                                                                                                                                 |
| Actors                    | OTPU `{{OTPU_LOGIN}}`, SMSU `{{SMSU_LOGIN}}` (mobile = the sms-logger test number, seed A6); PolyID ops profile `{{PIDOPS_PROFILE}}`                                                           |
| Scope                     | **per-user overrides only** — never the tenant provider (tenant 2FA is family X10)                                                                                                             |
| Attended                  | AUT-11: the operator reads the sms-logger page `{{SMS_LOGGER_URL}}` (the harness never opens it) and types each code into the headed window                                                    |
| Budget                    | ≤ 2 password submissions per run (AUT-09: 2 runs; AUT-11: 2 runs + optional 1)                                                                                                                 |
| Window-sensitive          | fresh logins: before each run read `windows/` (dashboard {{DASHBOARD_URL}}); a `draining` / `active` LOGIN or HARD window on `{{TENANT}}` → stop, BLOCKED "paused by window <id>" for the rest |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/2FA` · `{{RUN_DIR}}/2FA/<scenario>/` · `created/2FA.jsonl`                                                                                                |
| Read first                | the group part above; scenarios.md AUT-09, AUT-11                                                                                                                                              |

Admin calls: `node {{SKILL_DIR}}/scripts/harness/polyid-admin.mjs {{PIDOPS_PROFILE}} {{RUN_DIR}}/2FA/<scenario>/admin-<n> {{TENANT}} <cmd>`. TOTP secrets and codes live only in the memory of one script run (`polyid.readOtpSecret()`, `polyid.totp()`); record only `secretChanged: true|false`.

## AUT-09 — TOTP via per-user override: enrol on the web, verify, reset, re-enrol in the app

1. `user-2fa "{{OTPU_LOGIN}}" TOTP` → read back `user-read`: `twoFactorType: TOTP`, `otp_verified: false` → `user-1.json`.
2. Run A (web, `polyid-flow.mjs {{TENANT}} "{{OTPU_LOGIN}}" <script> <out> --app mypp --fresh`, 2 submissions): onboard + SEED → `#form-otp` with QR and copy link; `polyid.readOtpSecret()` (memory). Masked shot `02-otp.png`.
3. `polyid.submitOtp('000000')` (or any code ≠ the current one) → "Code ist nicht gültig."; read the secret again and record only whether it changed (`secretChanged`).
4. `polyid.submitOtp(polyid.totp(<current secret>))` → `/tabs/`. (After the run: `user-read` → `otp_verified: true` → `user-4.json`.)
5. Same run, new context: logout → fresh login (SEED) → OTP page **without** QR / `#otp_secret` → code from the secret held since step 4 → success. End of run A (the secret is gone with the process).
6. `reset-otp "{{OTPU_LOGIN}}"`; `user-read` → `otp_verified: false` → `user-6.json`.
7. Run B (app, `polyid-flow.mjs … --app inapp --fresh --grant-clipboard`, 2 submissions): `#provider-email-input` → `#name-input` / `#password-input` (SEED) → `/auth/2fa` shows `.otp-setup-container` with QR and "copy secret" → click `.copy-secret-btn-container`, read the clipboard in memory → TOTP → `/tabs/home` (or the team-roster tutorial). Masked shot `07-app-enrol.png`.
8. Same run: in-app logout, login again (SEED) with a TOTP code → success, no QR.
9. Restore: `user-2fa "{{OTPU_LOGIN}}" DEFAULT`, `reset-otp "{{OTPU_LOGIN}}"`; `user-read` → `twoFactorType` null / Default, `otp_verified: false` → `user-9.json`.
10. `audit --since <scenario start>` → the override changes and OTP resets with the ops user as actor → `audit.json`.

Expect: as stated; codes accepted within the 30-s window.

## AUT-11 — SMS one-time code (MOBILE_OR_EMAIL) through the CT sms-logger

Pre: `env-facts.md` AUT-G3 = owned test number + live host confirmed, and `auth-allocation.md` says seed A6 done; else BLOCKED "AUT-G3 / A6" (no login). At most 3 SMS in this scenario; at most 5 code verifications per 10 min.

1. `user-2fa "{{SMSU_LOGIN}}" MOBILE_OR_EMAIL` (read back).
2. Run A (`polyid-flow.mjs {{TENANT}} "{{SMSU_LOGIN}}" <script> <out> --app mypp --fresh --headed`): onboard + SEED → `/ui/2fa-form` (`#form-2fa`, `#code`) — shot `02-2fa-form.png`; log the line `WAITING FOR OPERATOR: SMS 1`. Submit `000000` yourself first → "Code ist nicht gültig.". Then wait (≤ 5 min) until the operator has typed the real code in the headed window and the app reaches `/tabs/` → record the timestamps. The operator notes in `notes.md`: SMS arrival time, recipient = the test number, text pattern ("Please use this code for security verification: **\*\***") — never the digits.
3. Run B (new login, SEED): on the 2FA page wait until `#resend-code` is enabled (≥ 30 s), click it; log `WAITING FOR OPERATOR: old code, then new code`. The operator first types the **old** code → refused (record the text), then the new one → success.
4. Optional run C (3rd SMS): new login, wait > 3 min, the operator types the code → "TwoFactorAuthCodeTimeout" text.
5. Restore: `user-2fa "{{SMSU_LOGIN}}" DEFAULT` (read back).

Expect: SMS delivered to the logger within 60 s; wrong code refused; resend replaces the code; restore done.

## Cleanup checklist

- OTPU and SMSU: override DEFAULT, OTP reset (`user-read` saved).
- No secret, code or QR anywhere in the evidence (open every PNG once).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
