# Family 2FA — Per-user TOTP codes (AUT-09) · OTPU

|                           |                                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | AUT-09                                                                                                                                                                                         |
| Actors                    | OTPU `{{OTPU_LOGIN}}`; PolyID ops profile `{{PIDOPS_PROFILE}}`                                                                                                                                 |
| Scope                     | **per-user overrides only** — never the tenant provider (tenant 2FA is family X10); never a `MOBILE_OR_EMAIL` override (AUT-11 dropped, decision 2026-10-27, review F-01)                      |
| Budget                    | ≤ 2 password submissions per run (AUT-09: 2 runs)                                                                                                                                              |
| Window-sensitive          | fresh logins: before each run read `windows/` (dashboard {{DASHBOARD_URL}}); a `draining` / `active` LOGIN or HARD window on `{{TENANT}}` → stop, BLOCKED "paused by window <id>" for the rest |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/2FA` · `{{RUN_DIR}}/2FA/<scenario>/` · `created/2FA.jsonl`                                                                                                |
| Read first                | the group part above; scenarios.md AUT-09                                                                                                                                                      |

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

## Cleanup checklist

- OTPU: override DEFAULT, OTP reset (`user-read` saved).
- No secret, code or QR anywhere in the evidence (open every PNG once).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
