# Family LOCK — Brute-force lockout, incident and steward unlock (AUT-05) · LOCKU, control HPA, TA (read)

|                           |                                                                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | AUT-05                                                                                                                                                                                                                                             |
| Actors                    | LOCKU `{{LOCKU_LOGIN}}` (dedicated victim), control HPA `{{HPA_LOGIN}}`, TA `{{TA_LOGIN}}` (customer-portal incidents, read-only)                                                                                                                  |
| Window                    | Part 1: **W-Y-LOCKOUT** (LOGIN, ≈ 10 min freeze): you are launched only when `windows/{{ENV}}~W-Y-LOCKOUT` is `active`; nobody else starts a fresh PolyID login on `{{TENANT}}` meanwhile. Part 2 runs ≥ 31 min after the lock, outside the window |
| Budget                    | Part 1: `--max-password-submits 15 --allow-wrong "{{LOCKU_LOGIN}}"` for LOCKU (approved by the runner through this brief), then 1 HPA success; part 2: 1 LOCKU submission before and 1 after the steward's unlock                                  |
| Unlock                    | **steward only** (`polyid-admin.mjs … unlock --subject {{LOCKU_LOGIN}}`); you ask for it in `blockers` / your report — never call `unlock`                                                                                                         |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/LOCK` · `{{RUN_DIR}}/LOCK/AUT-05/` · `created/LOCK.jsonl`                                                                                                                                                     |
| Read first                | the group part above; scenarios.md AUT-05; known-deviations.md AUT-S1, AUT-S2, AUT-S3                                                                                                                                                              |

**PENDING convention.** Part 1 reports AUT-05 with verdict `PENDING` and the part-1 observations in `observed` / `notes` (lock reached at failure n, texts, incident, applied policies); part 2 reads them and reports the final verdict of AUT-05 (all steps).

## Part 1 — lockout (inside W-Y-LOCKOUT)

Pre: `polyid-admin.mjs {{PIDOPS_PROFILE}} {{RUN_DIR}}/LOCK/AUT-05/pre {{TENANT}} applied-policies` → no row for LOCKU and fewer than 3 attempts for this machine's IP (else stop: BLOCKED "IP counter not clean" — the steward reads it). Re-read the window doc right before step 1.

1. `polyid-flow.mjs {{TENANT}} "{{LOCKU_LOGIN}}" {{RUN_DIR}}/scripts/LOCK-AUT-05-a.mjs {{RUN_DIR}}/LOCK/AUT-05/a --app mypp --fresh --max-password-submits 15 --allow-wrong "{{LOCKU_LOGIN}}"`. In the script: onboard `{{LOCKU_LOGIN}}@{{TENANT}}.ch`; `polyid.password('WRONG')` 9 times; after each `polyid.errors()` = `BadCredentials`, no warning; record the elapsed time per attempt (≥ 2 s each).
2. WRONG 10, 11, 12: warning "Warnung: Es wurden viele falsche Loginversuche festgestellt. Sie haben noch 3 / 2 / 1 Versuche …" (`warnings=` parameter). Shot each (`02-warn-10.png` …).
3. WRONG 13: the page shows "Ihr Konto wurde gesperrt. Bitte kontaktieren Sie Ihren Administrator." under the bad-credentials message. Shot `03-locked.png`. Note the time TL.
4. `polyid.password('SEED')` (correct): still refused. Product intent: the lock text of step 3. Today the code redirects with `errors=account_locked`, rendered as the **"deactivated"** text "Ihr Benutzerkonto ist zurzeit deaktiviert …" → **KNOWN-FAIL AUT-S1** (issueShot on the message).
5. One more WRONG: record HTTP status, URL and page. Not the login form (JSON 423 / error page) → **KNOWN-FAIL AUT-S3** (issueShot).
6. Immediately, a separate run: `polyid-flow.mjs {{TENANT}} "{{HPA_LOGIN}}" <script> {{RUN_DIR}}/LOCK/AUT-05/control --app mypp --fresh` with one SEED submission → success (proves the IP is not locked; the success clears the IP counter). Re-check: the window may be released by the runner after this step.
7. `polyid-admin … applied-policies` → LOCKU locked, attempts ≥ 13, `unlockAt` ≈ last attempt + 30 min; the IP subject absent or below 18 → `applied-policies-locked.json`.
8. TA (`app.mjs {{TENANT}} "{{TA_LOGIN}}" <script> <out> --app customer-portal`): `/portal/incidents`, capture `GET /api/private/business/portal/incidents` → an incident "Brute force attack", CRITICAL, tenant `{{TENANT}}`, text "<LOCKU> has been locked because …", created around TL → `incidents.json`.
   Report AUT-05 `PENDING` with TL in `notes`; `blockers`: "part 2 at TL + 31 min; then steward unlock of {{LOCKU_LOGIN}}".

## Part 2 — expiry check and unlock (outside the window, ≥ 31 min after TL)

Read the part-1 report / evidence first (`{{RUN_DIR}}/LOCK/AUT-05/`). 9. ≥ 31 min after TL and before the unlock: one SEED submission for LOCKU in a fresh run → still `account_locked` (locks never expire in the code) → **KNOWN-FAIL AUT-S2**; a successful login = "AUT-S2 not reproduced". Follow with one HPA success run if LOCKU's attempt failed. 10. Wait for the steward's unlock: poll `polyid-admin … applied-policies` every 60 s, at most 30 min, until LOCKU's row is gone (`applied-policies-after-unlock.json`); not gone → BLOCKED "steward unlock pending" for this step. Then LOCKU logs in with SEED (fresh run) → success.

Expect (product intent): lock exactly at failure 13 with warnings at 10–12; the correct password refused while locked with the lock text; incident present; unlock restores the login. Final verdict = FAIL with `findings_confirmed` for every AUT-S1 / S2 / S3 signature seen, PASS otherwise.

## Cleanup checklist

- LOCKU unlocked (by the steward) and logged in once; `applied-policies` empty for LOCKU and this IP.
- The incident stays (harmless; ops OPS-21 filters by its own prefix).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
