# Family UM — Customer-portal user management, second employment (AUT-16, AUT-20) · TA, BLKU, EMPU

|                           |                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | AUT-16, AUT-20                                                                                                                                                    |
| Actors                    | TA `{{TA_LOGIN}}` (borrowed tenant admin: acts only on BLKU), BLKU `{{BLKU_LOGIN}}`, EMPU `{{EMPU_LOGIN}}` ({{EMPU_ID}}); PolyID ops profile `{{PIDOPS_PROFILE}}` |
| Budget                    | BLKU: 4 submissions over AUT-16 in runs of ≤ 2; EMPU: 2 (AUT-20)                                                                                                  |
| PEP                       | AUT-20 steps 2 and 4 under the PEP lock (Definitionen – Personal → new / delete employment; no pep-driver flow exists: exploratory pep-verify, ≤ 15 min per step) |
| Window-sensitive          | fresh logins: check `windows/` before each run (LOGIN / HARD window → stop, BLOCKED "paused by window <id>"); W-Y-SOLLPLAN pauses this family                     |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/UM` (BLKU's running session: `{{RUN_DIR}}/.profiles/UM-blku-p1`) · `{{RUN_DIR}}/UM/<scenario>/` · `created/UM.jsonl`         |
| Read first                | the group part above; scenarios.md AUT-16, AUT-20; known-deviations.md AUT-S7                                                                                     |

TA's customer portal: `node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} "{{TA_LOGIN}}" <script> <out> --app customer-portal` (`/portal/user-management`; the harness records `/api/private/business/portal/**`).

## AUT-16 — Customer-portal user management: search, revoke sessions, block, unblock, reset 2FA

0. `polyid-admin … user-2fa "{{BLKU_LOGIN}}" TOTP`; one fresh BLKU login with enrolment (`polyid-flow.mjs … --app mypp --fresh`: SEED → enrol with `polyid.totp`), `user-read` → `otp_verified: true`. Then log BLKU in once more into the persistent profile `UM-blku-p1` (`polyid-flow.mjs … --profile {{RUN_DIR}}/.profiles/UM-blku-p1`, SEED + TOTP in the same run) — this is the "running session".
1. TA: `/portal/user-management` → search username `{{BLKU_LOGIN}}` → one row (capture `GET …/health/usermanagement/users?username=` → `search-ok.json`). With TA's bearer: `username` **and** `email` together → 400 (`search-400.json`); an unknown username → 404 (`search-404.json`).
2. TA: "Revoke sessions" for BLKU → `POST …/users/revoke-sessions` 2xx → `revoke.json`.
3. Reopen myPP with `UM-blku-p1` (no login) → Home → Kalender; record the API statuses → `p1-statuses.json`. Product intent: logged out. Still 200 → **KNOWN-FAIL AUT-S7** (jsonShot of a 200).
4. TA: change state to BLOCKED with reason `E2E {{RUN}}` → `POST …/users/change-state` 2xx; `user-read` → `state BLOCKED`, `state_changer` = TA → `state-blocked.json`.
5. BLKU fresh login (SEED) → `errors=UserNotActive`, "Benutzer nicht aktiv" (shot). Reopen `UM-blku-p1` → record the API statuses (AUT-S7 again).
6. TA: state ACTIVE. BLKU fresh login → TOTP (no QR) → `/tabs/` (run with the step-5 attempt: ≤ 2 submissions; the success follows the refused login).
7. TA: "Reset 2FA" → `POST …/users/reset-2fa` 2xx; `user-read` → `otp_verified: false`; BLKU fresh login → enrolment page again (masked shot; stop there).
8. `polyid-admin … audit --since <scenario start>` → entries for the state changes, the OTP reset and the session revoke → `audit.json`.
9. Restore: `user-2fa "{{BLKU_LOGIN}}" DEFAULT`, `reset-otp "{{BLKU_LOGIN}}"`, state ACTIVE (read back).

Expect: search 200 / 400 / 404; BLOCKED refuses the login; ACTIVE restores it; reset forces re-enrolment; actions audited; steps 3 / 5 per AUT-S7 (record).

## AUT-20 — Second employment appears in myPOLYPOINT after re-login

1. myPP as EMPU (`app.mjs … "{{EMPU_LOGIN}}" <script> <out> --app mypp`): `GET /api/mobile/health-professional/v1/pep-employments/valid-on-date?date={{TODAY}}` → exactly 1 employment → `employments-before.json`.
2. PEP (lock `{{PEP_LOCK_DOC}}`, `pe-ready.sh` → READY): Definitionen – Personal → EMPU → "register new employment" (duplicate icon) → another Personalkategorie, end date 31.12.2099 → OK; shot. Box oracle (read-only): the employment rows of EMPU's person → `oracle-employments.txt` (2 rows). Release the lock. Cannot be driven within 15 min → release, BLOCKED "PEP employment flow" (no workaround in SQL).
3. myPP: logout, fresh login → `current-user/sync` 200 → `valid-on-date` lists 2 employments; the employment selector (profile) shows both. Shot `03-selector.png` → `employments-after.json`. Still 1 → record "api-pp cache?" and ask the runner in `blockers` for the employee PSC enqueue (seed A9); do not run DML yourself.
4. Cleanup (PEP lock): delete **only the new employment** ("Mitarbeiter löschen" on that row) → re-login → 1 employment (`employments-cleanup.json`).

Expect: the second employment shows after re-login, and only after re-login.

## Cleanup checklist

- BLKU ACTIVE, override DEFAULT, OTP reset; EMPU back to one employment (or listed `cleaned: false` with the reason).
- PEP lock released.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
