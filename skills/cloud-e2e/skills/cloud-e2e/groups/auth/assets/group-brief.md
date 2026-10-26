# Group brief — auth

Runner notes (the part above the `---` line is not sent to workers): fills the `{{GROUP_BRIEF}}` slot of `assets/agent-brief.md`. Values come from `auth-allocation.md` (seed A1), `env-facts.md` (gates AUT-G1..G3) and `kits/<env>`. Families LOCK, PWD, X10 are window families: launch each part only when its window doc is `active` (LOCK part 2 runs later, outside the window). PWD part 2 starts after the steward switched Send Messages ON (the runner tells the steward when part 1 and ops X13 part 1 reported). Attended families (PWD part 2, 2FA for AUT-11, IMP) need the operator at the machine: tell them before the launch. Renew the PolyID ops profile `{{PIDOPS_PROFILE}}` (≈ 1.5 h) before LOCK, 2FA, X10, UM.

---

## Group auth — what every worker of this group needs

You test the login and identity flows of myPOLYPOINT, the planner app and the customer portal (PolyID) on DeployMate env **`{{TENANT}}`** (role {{ENV_ROLE}}, shared with the groups utr, planner and ops). Every password submission counts towards the PolyID brute-force lock, which is shared by everyone behind the same office NAT and **never expires**. Your family brief names your scenarios and actors; this part gives the facts they share.

### Actors (claimed by this group; use no other person)

| Token        | Login                                | State / use                                                                                                                          |
| ------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| HPA          | `{{HPA_LOGIN}}`                      | plain HP (kit `E2E:HP-PLAIN`, no planner role)                                                                                       |
| SEEDSP       | `{{SEEDSP_LOGIN}}`                   | seed planner (`DMSEED:Planner`: HP + shift planner)                                                                                  |
| NOHP         | `{{NOHP_LOGIN}}`                     | seed planner whose client role `ROLE_HEALTH_PROFESSIONAL` was removed (seed A3)                                                      |
| LOCKU        | `{{LOCKU_LOGIN}}`                    | lockout victim (family LOCK only)                                                                                                    |
| PWU          | `{{PWU_LOGIN}}`                      | password-reset user, e-mail = the team mailbox `{{AUTH_MAILBOX}}` (seed A5)                                                          |
| OTPU         | `{{OTPU_LOGIN}}`                     | per-user TOTP                                                                                                                        |
| T2FU, OFFU   | `{{T2FU_LOGIN}}`, `{{OFFU_LOGIN}}`   | tenant-wide TOTP (X10)                                                                                                               |
| SMSU         | `{{SMSU_LOGIN}}`                     | SMS code, mobile = the sms-logger test number (seed A6)                                                                              |
| BLKU         | `{{BLKU_LOGIN}}`                     | customer-portal managed user                                                                                                         |
| NEWU         | `{{NEWU_LOGIN}}`                     | never logged in before AUT-18                                                                                                        |
| EMPU         | `{{EMPU_LOGIN}}` ({{EMPU_ID}})       | one employment (AUT-20)                                                                                                              |
| IMPBLK, DISU | `{{IMPBLK_LOGIN}}`, `{{DISU_LOGIN}}` | optional                                                                                                                             |
| TA           | `{{TA_LOGIN}}`                       | tenant admin of the steward's role kit — **borrowed read-only**; you only read incidents and act on BLKU through the customer portal |

E-mail form `<login>@{{TENANT}}.ch`. MITARBEITER_IDs and tenant subjects (claim values) are in `{{RUN_DIR}}/auth-allocation.md`.

### Hosts

myPP `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app`; planner app `…/shift-planner/dashboard`; poma-api `https://ct-poma-api.dev.k8s.polypoint-dev.com`; PolyID login `https://ct-polyid-login.dev.k8s.polypoint-dev.com` (`/ui/…` pages, `/api/providers?email=`); Hydra `https://ct-polyid.dev.k8s.polypoint-dev.com`; customer portal `{{PORTAL_HOST}}/portal/…`; PolyID provider id of the tenant `{{PROVIDER_ID}}`.

### Harness (exact flags: `{{SKILL_DIR}}/references/harness.md`; always `cd {{RUN_DIR}}`, `MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}}`)

```
node {{SKILL_DIR}}/scripts/harness/polyid-flow.mjs {{TENANT}} <login|-> <script.mjs> <outdir> --app mypp|poma|portal|inapp [--fresh|--profile <dir>] [--headed] [--max-password-submits N --allow-wrong <login>] [--grant-clipboard]
node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app mypp|poma|customer-portal     # auto-login (a login is only a precondition)
node {{SKILL_DIR}}/scripts/harness/polyid-admin.mjs {{PIDOPS_PROFILE}} <outdir> {{TENANT}} <cmd> [args]
node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "tenant read {{TENANT}}" <outdir>                        # Send Messages state
node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "flag read|set {{TENANT}} <code> [value]" <outdir>
```

- `polyid-flow.mjs` drives the PolyID pages **without auto-login** (fresh context by default) and gives the script `polyid.open([app])`, `polyid.onboard([email])`, `polyid.password('SEED'|'WRONG')`, `polyid.errors()`, `polyid.readOtpSecret()`, `polyid.totp(secret)`, `polyid.submitOtp(code)`, `polyid.consent('accept'|'reject')`, `polyid.chain()`, `polyid.state()`. It never writes login / 2FA / password request bodies and masks OTP / QR elements in `shot()`.
- `polyid-admin.mjs` commands: `provider-read`, `user-read <login>`, `user-2fa <login> DEFAULT|DISABLED|TOTP|MOBILE_OR_EMAIL`, `reset-otp <login>`, `user-state <login> ACTIVE|BLOCKED --reason <text>`, `revoke-sessions <login>`, `audit --since <ISO>`, `applied-policies`; `provider-2fa … --window W-Y-TENANT2FA` only in X10. **`unlock` is the steward's — never call it.** Exit 3 = `LOGIN_NEEDED` → stop, blocker "PolyID ops session expired".
- Helpers: `import { roles, issueShot, jsonShot, act, alertText } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'` (`roles(api)` = role names of the current bearer, decoded in memory).

### Password budget (hard rule 4, PolyID lock: user 13 / IP 18 failures per provider, no expiry)

- At most **2 password submissions per harness call** (the default). Plan each scenario in runs of ≤ 2 submissions. More only in LOCK part 1 (`--max-password-submits 15 --allow-wrong {{LOCKU_LOGIN}}`, inside W-Y-LOCKOUT).
- `password('WRONG')` needs `--allow-wrong <that login>`. **Every wrong password is followed by a successful login from this machine** in the same or the next harness call (it clears the IP counter). `result.json` `wrongWithoutSuccess: true` → do that success now.
- Never loop over logins in the shell; one harness call per login, the login as a literal quoted string. A login fails unexpectedly → retry once, then BLOCKED `PolyID lockout (USER_OR_IP_LOCKED) <login>`; never unlock, never try other users.
- New passwords (reset flows) are generated **in memory inside one script run**, used there, and never written; the runner restores the manifest password in the box Keycloak afterwards.

### Secrets

TOTP secrets, OTP / SMS codes, set-password links and passwords are never written to files, notes, rows or screenshots; record only "secret present / changed: true". A mail link reaches you only through `<outdir>/.mail-link` (0600, written by the operator): read it, open it, delete the file. JWTs are decoded in memory; save role lists and claim **names** only.

### Messaging (owned recipients only)

Send Messages on the portal tenant is OFF outside W-Y-MSG; inside W-Y-MSG only the steward switches it (you verify it with `portal-ops.mjs … "tenant read {{TENANT}}"`, field `send_messages`). Mails only to `{{AUTH_MAILBOX}}`, SMS only to the sms-logger test number; never to a seeded `…@{{TENANT}}.ch` address. Per-user 2FA overrides are yours; the tenant-wide 2FA only in X10.

### Oracles (screenshots are evidence, never the oracle)

| What              | How                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PolyID page state | URL path, `errors=` / `warnings=` query parameters, `.login-error` / `.login-warning` texts, element ids (`#form-onboard`, `#form-login`, `#email_or_username`, `#password`, `#form-otp`, `#otp_secret`, `#form-2fa`, `#code`, `#resend-code`, `#impersonation-form`, `#confirmation-message`) — `polyid.errors()` / `polyid.chain()` |
| PolyID admin      | `polyid-admin.mjs user-read` (`state`, `otp_verified`, `twoFactorType`, `password_strength_level`, `tenant_subject`), `applied-policies`, `audit`                                                                                                                                                                                     |
| Customer portal   | `GET /api/private/business/portal/incidents`, `GET /api/private/business/portal/health/usermanagement/users?…` (TA session, `app.mjs … --app customer-portal`)                                                                                                                                                                        |
| myPP              | `GET /api/mobile/health-professional/v1/current-user/sync`, `…/pep-employments/valid-on-date?date=`                                                                                                                                                                                                                                   |
| Box               | `plan-day.sh` / `sql.sh` read-only (AUT-20 employment rows)                                                                                                                                                                                                                                                                           |

### Evidence and report

- Folder `{{RUN_DIR}}/{{FAMILY}}/<scenario>/`: `NN-<step>.png` (masked), `<endpoint>.json`, `user-<actor>.json` (no secret fields), `chain.json`, `applied-policies*.json`, `incidents.json`, `notes.md` (timings, texts).
- Every state change of an actor (2FA override, OTP reset, state, sessions, password, employment) one JSON line in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl` with its restore.
- KNOWN-FAIL only with a matching signature of `{{GROUP_DIR}}/references/known-deviations.md` (AUT-S1..AUT-S10); new findings `N-AUTH-<n>`.

### Never

- Never call a path containing `/test/` (PolyID `test/token`, `test/clear` included); never a GAT endpoint; never a POMA job; never a cache reset.
- Never unlock in PolyID (steward only); never change the tenant provider outside X10; never toggle Send Messages yourself; never change the password-reset flag outside AUT-06 / AUT-07.
- Never log in NEWU outside AUT-18; never touch actors of another group (planner, utr, ops, the TA except the BLKU actions) or another tenant.
- Never print, copy or save passwords, OTP / TOTP secrets or codes, set-password links, tokens or connect strings.
- **Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
