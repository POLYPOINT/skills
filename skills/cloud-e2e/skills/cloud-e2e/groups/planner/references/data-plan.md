# Group planner — data plan (group seed R2, actors, days, concurrency)

Source: `areas/pool-sp/data-plan.md` (A-pool-sp, 2026-10-22) with the S1 reconciliations: the PEP groups / roles / node selections for PLAN-ALL, SP-A, PM-A and TA come from the **steward role kit** (`E2E:PLANALL`, `E2E:SP-GA`, `E2E:PM-GA` with node selection = Medizin, `E2E:TA` incl. the `ROLE_TENANT_ADMIN` Keycloak mapping row); the POMA shift types EARLY / NIGHT (gate PSP-G4) come from the **definitions kit**; this group moves only its claimed actors and creates only `PSP-*` objects (pools, own Dienste, one role for HP9). **F9 is dropped** (PSP-14 merged into SWP-15, group swap). `sendEmailConfirmation` OFF. Facts from code (cloud master 89d7e960e0, pp-services origin/master) unless marked "guess".

## 1. What the env gives

| Need                                                                                                                                                | Provided by                                                                                                    | Check                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Gruppe G-A with ≥ 12 people, G-B with ≥ 2                                                                                                           | DM-Y partition P1 = Pflege Medizin (13), P2 = Geburtshilfe (shared with ops' CPU: people claims are exclusive) | R1 claims                                             |
| PLAN-ALL (1050 / 1060 / 1061 / 1070 all nodes), SP-A (1050 / 1061 / 1070 on G-A), PM-A (1060 on G-A), TA (myPOLYPOINT 2610 / 200015 → TENANT_ADMIN) | steward role kit; TA's membership done by the steward                                                          | gates PSP-G1, PSP-G2                                  |
| POMA shift types EARLY / NIGHT on the seed Dienste                                                                                                  | steward definitions kit (DM-Y: shift types only)                                                               | gate PSP-G4                                           |
| Own Dienste with INTERNER_POOL / ALWAYS_VISIBLE / PLANUNGSWUNSCH                                                                                    | **this group** (D1–D3, PEP lock; never flip a seed Dienst)                                                     | gate PSP-GD                                           |
| "alle Monate sichtbar" myPOLYPOINT role for HP9                                                                                                     | **this group** (R5, own `PSP:` role)                                                                           | PSP-21 pre-check                                      |
| Pools, availabilities, bookings, opportunities                                                                                                      | **this group** (F1–F11)                                                                                        | gates PSP-G3                                          |
| Conflict-checker tenant config + shift cache                                                                                                        | unknown on DeployMate (OQ-19); the steward enables the tenant in POMA ops if needed (never disables)           | PSP-15 config read; PSP-17 blocks with a clear reason |
| Job trigger                                                                                                                                         | portal ops Monitor → Job Management (`portal-ops.mjs job run … --tenant <DM-Y>`, OQ-21) or the overnight cron  | J-Y-JOBS                                              |

Cloud roles of plain seed users are unverified (OQ-17): gate PSP-G1 decides and records SEEDSP's roles.

## 2. Actors (11 of G-A + 2 of G-B; logins from `POLYUSER.KUERZEL`, ASCII only)

| Token    | Seed person       | Kit / rights                                                   | In `DMSEED:Planner`? | Expected cloud roles            | Used by                                    |
| -------- | ----------------- | -------------------------------------------------------------- | -------------------- | ------------------------------- | ------------------------------------------ |
| PLANALL  | G-A               | `E2E:PLANALL`                                                  | yes (harmless)       | POOL_MANAGER, SHIFT_PLANNER, HP | 01, 04–08, 09 (compare), 10, 12, 13, 16–19 |
| SPA      | G-A               | `E2E:SP-GA` (node G-A)                                         | **no** (S3 move)     | SHIFT_PLANNER, HP               | 01–03, 10–13, 20                           |
| PMA      | G-A               | `E2E:PM-GA` (node G-A)                                         | **no**               | POOL_MANAGER, HP                | 01–03, 09, 11                              |
| TA       | G-A               | `E2E:TA` (steward kit actor; auth and ops borrow it read-only) | no                   | TENANT_ADMIN, HP                | 01, 03, 15, 16                             |
| SEEDSP   | G-A               | untouched                                                      | yes                  | as the seed gives (G1)          | 11                                         |
| HP1, HP2 | G-A, same Station | seed                                                           | yes                  | HP                              | pools, find-HP, bookings                   |
| HP3      | G-A               | seed                                                           | yes                  | HP                              | 10, 17                                     |
| HP4      | G-A               | seed                                                           | yes                  | HP                              | 07, 10, 18                                 |
| HP7      | G-A               | seed (+1031 from `rights.sql` on `DMSEED:Planner`)             | yes                  | HP                              | 22                                         |
| HP8      | G-A               | seed                                                           | yes                  | HP                              | 21                                         |
| HP9      | G-A               | seed + `PSP:AlleMonate` (R5); optional second employment (F5)  | yes                  | HP                              | 07 (b), 21                                 |
| HP5      | G-B               | seed                                                           | yes                  | HP                              | 05 (variant), 10                           |
| HP6      | G-B               | seed, one employment                                           | yes                  | HP                              | 07 (c), 19                                 |

Pools: `P-A` on a Station of G-A (`{{GA_STATION}}`) with HP1–HP4; `P-B` on `{{GB_STATION}}` with HP5, HP6; `PSP-LIST-01..11` on a G-A Station without members. All pool names carry the `PSP-` prefix (claims `prefix-PSP`).

## 3. Days

| Token        | Rule                                                                      | Owner                                                         |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| D1           | first weekday ≥ R+7                                                       | HP1–HP5 availabilities; bookings F6 (HP1, P-A), F7 (HP5, P-B) |
| D2, D2M1     | first weekday ≥ R+9 with no planning of HP3 on D2−1 and D2; D2M1 = D2 − 1 | HP3 (PSP-17)                                                  |
| D3           | first weekday ≥ R+5 with no planning of HP4                               | HP4 (PSP-18)                                                  |
| DW, DW1      | first weekday ≥ R+14 in an open planning period; DW + 1                   | HP7 (PSP-22)                                                  |
| M1, M1A, M1B | the calendar month after R; two weekdays of it                            | HP8, HP9 (PSP-21)                                             |
| RM1          | R − 1                                                                     | HP6 employment end (PSP-19)                                   |

All within today + 3 months (`conflictCheckingMonths` 3).

## 4. Group seed (R2, runner) — order R → gates G1/G2 → D (PEP) → F → gates G3/G4/GD

**R — rights** (`seed/R-rights.md`): R1–R3 kit membership moves (PLANALL → `E2E:PLANALL`; SPA → `E2E:SP-GA`, PMA → `E2E:PM-GA`, both leave `DMSEED:Planner`); TA is the steward's; R5 HP9 role `PSP:AlleMonate` with "alle Monate sichtbar" in UsrAdmin (pep-verify exploratory, PEP lock); enqueues; gates PSP-G1 / PSP-G2.

**D — own Dienste** (`seed/D-definitions.md`, PEP lock): D1 `PSP-IP-JA` (`INTERNER_POOL 'T'`, `RESSOURCENERSATZ 'F'`), `PSP-IP-NEIN` (`'F'` / `'T'`); D2 `PSP-IMMER` (`ALWAYS_VISIBLE 'T'`); D3 `PSP-WUNSCH-JA` (`DIENST.PLANUNGSWUNSCH 'T'` and the G-A `DIENST_DETAIL.PLANUNGSWUNSCH 'T'` covering DW), `PSP-WUNSCH-NODE-NEIN` (only `DIENST.PLANUNGSWUNSCH 'T'`); all in G-A's palette; then **one** G4b batch (`SHIFT_DEFINITION` per Dienst, `SHIFT_DEFINITION_POLICY` per detail, `SHIFT_DEFINITION_PALETTE` for G-A) via `psc-enqueue.sh`; gate PSP-GD (`scripts/planner-checks.sql` + API reads).

**F — cloud fixtures** (`seed/F-fixtures.md`): F1 pools P-A / P-B; F2 `PSP-LIST-01..11`; F3 first logins of HP1–HP9 + availabilities on D1 for HP1–HP5; F4 optional invalid e-mail of HP5 (PEP Personalstamm, restore after); F5 optional second employment of HP9; F6 / F7 bookings on D1; F8 GAT `resource-replacements` (and `opportunity-with-internal-pools` if needed) **as SPA only**; F10 HP3 EARLY availability on D2; F11 HP4 availability on D3. Gates PSP-G3, PSP-G4.

Estimated 2–3 h, mostly PEP (D, R5).

## 5. Concurrency

**Ownership.** Gruppen G-A and G-B (every paint and palette entry), the people of §2, the `PSP-*` pools, Dienste and role. Days: D1 (HP1–HP5), D2M1 / D2 (HP3), D3 (HP4), DW / DW1 (HP7), M1A / M1B (HP8, HP9), RM1 (HP6 employment).

**What other groups notice (shared reads).** All-node planners of other groups on DM-Y (auth's SEED-SP, the TA borrowers) see the `PSP-*` pools, F8 GAT requests and F6 / F7 bookings: their assertions filter by own ids. TA is used read-only by auth and ops: never change TA's rights or state.

**Windows (DM-Y).**

- W-Y-CONFRULE (PSP-16, INTERNAL, ≈ 15 min): every find-HP / BADI search of the tenant gets the test HINT; on DM-Y only planner searches. Restore the recorded config.
- W-Y-SOLLPLAN (PSP-21, ≈ 50 min): the global PEP option hides unsaved months in every myPP roster → **only after utr has finished on DM-Y**; restore and prove with one roster read of another group's HP (read-only).
- J-Y-JOBS (PSP-18, PSP-19; shared with ops OPS-18): one tenant job at a time, always `tenantIds=<DM-Y>`.

**PEP lock** (`locks/<env>~pep`, one desktop): D-steps, R5, F4 / F5, PSP-17 / 18 paints (`pp-plan.sh` preferred), PSP-19 employment end, PSP-21, PSP-22 accept, optional PSP-09 step 7. UTR is the heaviest PEP user on DM-Y: plan the D-steps after UTR's Phase 1 PEP part (`env-plan.md` §7.2: 10:30–12:30).

**Never.** GAT `clean` / `shift-trades`; POMA ops "Disable" of the conflict checker (drops the tenant's shift cache); jobs without `tenantIds`; any test-data endpoint; flipping a seed Dienst.
