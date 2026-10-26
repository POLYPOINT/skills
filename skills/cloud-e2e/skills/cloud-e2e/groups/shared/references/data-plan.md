# Group shared — data plan (consents, users, windows)

No DeployMate env and no seeded data: every family works on a tenant that belongs to someone else, with existing users, and changes only what its scenario names inside its window. Sources: `areas/partner/data-plan.md` §1, §3 P-PTN-10, §5 (PW lane); `areas/auth/data-plan.md` §5 (Microsoft tenant); `areas/hp-notif/data-plan.md` (HPN-24 / 26); `areas/swap/scenarios.md` SWP-20; `synthesis/env-plan.md` §3.2 (W-SH-\*), §5.

## 1. Tenants, owners, consents (gate SH-G1)

| Family   | Tenant / stage                               | Owner to ask                                                 | What the consent covers                                                                                                         |
| -------- | -------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| SH-PW    | `ct-zinc-master` / CT                        | ct-zinc-master owners                                        | reset and re-link of `antbe`'s partner link (W-SH-ANTBE, ≈ 60 min); nobody else uses the mock with antbe meanwhile              |
| SH-TEAMS | `ct-zinc-master` / CT                        | ct-zinc-master owners (read-only: an announcement is enough) | PolyID ops reads of the Teams config and link state                                                                             |
| SH-MS    | `<MS_TENANT>` / CT or Preview                | that tenant's owners and the user (OQ-22)                    | provider type changes ADFS+password → ADFS → Entra → original (W-SH-MSTENANT, ≈ 75 min); every login to that tenant is affected |
| SH-BEE   | `beekeeper-integration-tenant-test` / CT     | the user decides the token source (OQ-28)                    | use of a partner client of that tenant; no change on the tenant                                                                 |
| SH-OLD   | `pre-dev-main24` (Preview) or CT-zinc-main24 | EO / box owners (OQ-33)                                      | one swap created and deleted by two HPs                                                                                         |

Record each consent (who, when, scope) in `results/<run>/shared/env-facts.md` and in the window doc's `reason`.

## 2. Users

| Token          | Tenant                            | Source of the login                                                         | Password                                                                    |
| -------------- | --------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ANTBE          | ct-zinc-master                    | the embedding mock's hard-coded user "Beat Antonietti" (`code_challenge_3`) | typed by the operator inside the iframe                                     |
| MSUSER         | `<MS_TENANT>`                     | the PEP user whose e-mail equals the Microsoft test account (AUT-G4)        | Microsoft sign-in by the operator (saved account in the profile afterwards) |
| MSCTRL         | `<MS_TENANT>`                     | a control password user named by the owners                                 | runner's 0600 cred file (`--cred-file`)                                     |
| OLDHP1, OLDHP2 | the < 26 box                      | two HPs of one personnel category named by the owners                       | runner's 0600 cred file                                                     |
| BEEHP          | beekeeper-integration-tenant-test | reached through the approved partner token                                  | none (token entry by the runner)                                            |

Cred files live outside `results/`, mode 0600, one per tenant (`{"tenant", "users": [{"login", "email", "password"}]}`); they are never printed, copied or attached.

## 3. Gates (runner, before the families)

SH-G1 consents; P-PTN-10 (one partner-sessions call for challenge 3 / ct-zinc-master → 200; the answer's token is discarded); AUT-G4 (Microsoft tenant named, provider id, redirect URI registered, PEP user with the Microsoft e-mail); SH-G3 (< 26 box: version read, non-production host, VPN if Preview, cred file); SH-G4 (Beekeeper decision + prepared token-entry profile).

## 4. Concurrency

| State                                    | Scope                        | Rule                                                                      |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| antbe's partner link                     | user on a shared tenant      | W-SH-ANTBE; SH-PW strictly sequential (PTN-10 → 11 → 18)                  |
| Provider type of `<MS_TENANT>`           | that tenant, other teams too | W-SH-MSTENANT; restore to `provider-before.json`                          |
| The embedding mock (CT gateway mock pod) | CT-wide, in memory           | read and drive only; never restart it, never call its test-data endpoints |
| MS Teams domain → provider mapping       | CT stage                     | never touched                                                             |
| The < 26 box                             | shared customer-like box     | one swap, deleted at the end; no definition, version or setting change    |

## 5. Cleanup

antbe linked or reset as agreed; `<MS_TENANT>` provider restored and proven; the SWP-20 swap deleted; HPN-24 / HPN-26 changed nothing.
