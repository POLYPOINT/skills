# Group auth — data plan (group seed R2, actors, recipients, concurrency)

Source: `areas/auth/data-plan.md` (A-auth, 2026-10-23) with the S1 reconciliations: TA comes from the steward's role kit (`E2E:TA`), plain-HP actors move into the kit group `E2E:HP-PLAIN`, the Microsoft cases moved to group `shared`, AUT-15 / AUT-19 to `manual`, the windows are the env-plan ones (W-Y-LOCKOUT, W-Y-TENANT2FA, W-Y-MSG). This group changes only its own claimed actors.

## 1. What a DeployMate env gives, and what the group needs

| Need                                                                                                                                       | Provided?                                                            | How this group gets it                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ≈ 13 seed login users (on-prem Keycloak `dmseed-<kürzel>`, realm `POLYP01`, one manifest password, client role `ROLE_HEALTH_PROFESSIONAL`) | yes (every seeded person)                                            | partition P1 = Geriatrie + Notfall + IPS on DM-Y (16 people)                                                                                                             |
| A seed planner                                                                                                                             | yes (`DMSEED:Planner`)                                               | SEEDSP, NOHP stay in it                                                                                                                                                  |
| Plain HPs without the planner role                                                                                                         | no (every seed login is a planner)                                   | seed A1: move into `E2E:HP-PLAIN` (`kit-member.sql`, `leave="DMSEED:Planner"`); the seed-trap move out of "PEP - Leitbediener" only if AUT-G2 still shows a planner role |
| A user without the HP role                                                                                                                 | no                                                                   | seed A3 (box Keycloak role mapping)                                                                                                                                      |
| Tenant admin (`ROLE_TENANT_ADMIN`)                                                                                                         | steward kit `E2E:TA` (actor TA, planner partition)                   | borrowed read-only                                                                                                                                                       |
| PolyID provider `API_GATEWAY_VALIDATION`, 2FA DISABLED                                                                                     | yes (DeployMate)                                                     | gate AUT-G1 reads it                                                                                                                                                     |
| Portal tenant Send Messages OFF                                                                                                            | yes (portal default)                                                 | W-Y-MSG: steward switches ON / OFF                                                                                                                                       |
| Real mailbox / mobile number                                                                                                               | no (seeded e-mails `first.last@<id>.ch` may exist in the real world) | seed A5 / A6 point single actors at owned recipients (§4)                                                                                                                |
| A never-logged-in user                                                                                                                     | yes, until someone logs in                                           | NEWU, untouched by every gate (also by G-ROLES)                                                                                                                          |
| PEP / UsrAdmin access                                                                                                                      | yes (box, pep-verify)                                                | AUT-08, AUT-20 (PEP lock); flows for UsrAdmin "Mail senden …" and "new employment" are missing (OQ-20)                                                                   |
| Ops identities                                                                                                                             | no (personal accounts of the CT polyid realm)                        | the runner's headed PolyID ops and portal ops sessions; OPS-IMP = the operator's own ops-realm account                                                                   |

## 2. Actors (seed A1 writes `{{RUN_DIR}}/auth-allocation.md`: token, login, MITARBEITER_ID, Station, tenant subject, kit move)

| Token                      | Rights / state                                                        | Used by                                         | Writes / side effects (restored in cleanup)                            |
| -------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| HPA                        | plain HP                                                              | AUT-01, 03, 04, 05 (control), 14, 17 (target)   | ≤ 1 wrong password (AUT-04), always followed by a success              |
| SEEDSP                     | `DMSEED:Planner` (SP + HP)                                            | AUT-14, 17 (target)                             | none                                                                   |
| NOHP                       | `DMSEED:Planner`, client role `ROLE_HEALTH_PROFESSIONAL` removed (A3) | AUT-02                                          | Keycloak role mapping                                                  |
| LOCKU                      | plain HP                                                              | AUT-05 only                                     | locked, then unlocked by the steward                                   |
| PWU                        | plain HP, e-mail → team mailbox (A5)                                  | AUT-06, 07, 08                                  | password changed twice (runner restores the manifest password), e-mail |
| OTPU                       | plain HP                                                              | AUT-09                                          | per-user 2FA override, OTP                                             |
| T2FU                       | plain HP, override Default, never enrolled                            | AUT-10                                          | OTP                                                                    |
| OFFU                       | plain HP with a running myPP session                                  | AUT-10                                          | OTP                                                                    |
| SMSU                       | plain HP, on-prem mobile = sms-logger test number (A6)                | AUT-11                                          | override MOBILE_OR_EMAIL, mobile number                                |
| BLKU                       | plain HP                                                              | AUT-16                                          | state BLOCKED → ACTIVE, OTP, sessions                                  |
| NEWU                       | plain HP, never logged in                                             | AUT-18                                          | consent + PolyID user (irreversible for the env)                       |
| EMPU                       | plain HP, exactly one employment                                      | AUT-20                                          | second employment created and deleted in PEP                           |
| IMPBLK (optional)          | plain HP                                                              | AUT-17 step 6                                   | BLOCKED → ACTIVE                                                       |
| DISU, NOEMP (optional, A8) | Keycloak-disabled seed login; Keycloak user without a PEP employee    | AUT-04 step 6                                   | created / disabled by the runner, removed in cleanup                   |
| TA                         | `ROLE_TENANT_ADMIN` (kit)                                             | AUT-05, 10, 16, 17 (incidents, user management) | only the AUT-16 actions on BLKU                                        |

Rules: ASCII kürzel only; logins from `POLYUSER.KUERZEL`; actors are claimed with `emp-` **and** `login-` claims (NEWU's login claim keeps every gate away from it).

## 3. Group seed (runner; details `../seed/A-seed.md`)

| Step | What                                                                                                                                                          | Est.   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A1   | claims done → kit moves into `E2E:HP-PLAIN` → gate AUT-G2 (one login each, not NEWU)                                                                          | 25 min |
| A2   | PolyID ops + portal ops headed sign-in; provider id; gate AUT-G1                                                                                              | 10 min |
| A3   | NOHP: remove `polypoint-poolmanagement/ROLE_HEALTH_PROFESSIONAL` in the box Keycloak (tunnel 8383, realm `POLYP01`)                                           | 10 min |
| A5   | PWU: e-mail = `{{AUTH_MAILBOX}}` in the box Keycloak (and in UsrAdmin for AUT-08, under the PEP lock)                                                         | 10 min |
| A6   | SMSU: on-prem mobile number = the sms-logger test number (only after AUT-G3)                                                                                  | 10 min |
| A8   | optional DISU (Keycloak "Enabled" off) / NOEMP (Keycloak user without POLYUSER link)                                                                          | 15 min |
| A9   | (AUT-20, on request) employee PSC enqueue if the new employment does not show after re-login — check the PSC types on the box first; `scripts/psc-enqueue.sh` | 5 min  |

The password-reset flag is set and reset by AUT-06 / AUT-08 themselves (baseline value `false`, set explicitly by the steward).

## 4. Owned recipients (hard rule 4)

- `{{AUTH_MAILBOX}}`: a team-owned mailbox the operator can read; only PWU points at it (A5). Never a seeded address, never a personal address of someone not running the test.
- The sms-logger test number: the number the "Test Send Messages" panel pre-fills; only SMSU gets it, and only after the operator confirmed it is POLYPOINT-owned (AUT-G3). The sms-logger page is read by the operator (the harness host guard refuses non-`ct-*` hosts).
- Send Messages ON opens the on-prem → cloud SMS / e-mail relay for **every** on-prem sender of the tenant: only inside W-Y-MSG, switched by the steward, verified OFF before and after.
- Messaging silently drops > 30 sends per IP per 30 s; this group sends ≤ 3 SMS (AUT-11) and ≤ 3 mails (AUT-07 / 08) per run.

## 5. Concurrency

| State                                                                                 | Scope                                                                                | Scenarios                                       | Rule                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| PolyID brute-force counters (user + caller IP per provider, no expiry)                | tenant provider; the IP counter is shared by every runner behind the same office NAT | AUT-05 (13–15 failures), AUT-04 (1), AUT-07 (1) | W-Y-LOCKOUT (LOGIN) for AUT-05; every wrong password followed by a success from the same IP; unlock = steward |
| Provider `twoFactorType`                                                              | tenant, all users                                                                    | AUT-10                                          | W-Y-TENANT2FA (LOGIN): no fresh login of any Y group; running sessions unaffected                             |
| Portal tenant Send Messages                                                           | tenant, every on-prem sender                                                         | AUT-07, 08 (+ OPS-13 B, AUT-19)                 | W-Y-MSG (HARD), steward switches                                                                              |
| Flag `polyid.flows.allowPasswordResetForNonADUsers`                                   | login page link only                                                                 | AUT-06 → AUT-08                                 | not exclusive; never ON while Send Messages is ON except inside PWD part 2                                    |
| Per-user 2FA override, OTP, state, sessions                                           | one actor                                                                            | AUT-09, 11, 16, 17                              | one scenario per actor at a time                                                                              |
| Box Keycloak user attributes (e-mail, mobile, role mapping, enabled)                  | one actor                                                                            | A3, A5, A6, A8                                  | runner only; restored in cleanup                                                                              |
| PEP (UsrAdmin, Definitionen – Personal)                                               | box PEP desktop                                                                      | AUT-08, AUT-20                                  | `locks/<env>~pep`; edits only on PWU / EMPU                                                                   |
| Portal incidents (Brute force attack, 2FA config missing, SUPPORT_USER_IMPERSONATION) | tenant                                                                               | AUT-05, 10, 17                                  | harmless; ops OPS-21 filters by its own prefix                                                                |

Parallel-safe with every other group (own actors, no tenant change): NAV, LOGIN, 2FA (AUT-09, 11), LOGOUT, UM, IMP — always subject to the LOGIN / HARD windows of DM-Y.

Within the group: AUT-18 first (NEWU); LOGOUT part 1 early (its part-2 profile needs ≥ 65 min); LOCK part 2 ≥ 31 min after part 1; PWD part 1 before the steward switches Send Messages ON.

## 6. Cleanup (runner, end of the group; log every item in `created/auth.jsonl`)

- every actor `state ACTIVE`, 2FA override DEFAULT, OTP reset; LOCKU unlocked (steward);
- PWU password = manifest password, e-mail = manifest (box Keycloak; UsrAdmin if changed);
- SMSU mobile removed; NOHP role restored; DISU enabled / NOEMP deleted;
- flag `polyid.flows.allowPasswordResetForNonADUsers` = false (read back); Send Messages OFF (steward, read back);
- `polyid-admin.mjs … applied-policies` empty for the provider;
- EMPU one employment; kit memberships restored only if the env is reused.
