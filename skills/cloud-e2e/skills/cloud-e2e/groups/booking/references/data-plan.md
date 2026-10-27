# Group booking — data plan (group seed R2, people, days, concurrency)

Source: `areas/booking/data-plan.md` (A-booking, 2026-10-22) with the S1 reconciliations: P1 (flags) = steward baseline, P4 (INTERNER_POOL on the day Dienste) = steward definitions kit, P8 (own partner `e2e-bkg-<run>`) **dropped** — BKG-27 reads the steward's run partner; the pool-manager role and the planner rights come from the steward role kit (`E2E:PM-ALL`, `E2E:SP-ALL`); `poma.internalPool.sendEmailConfirmation` is **OFF** (messaging safety; the mail path is group `manual` BKG-31). Facts from code (cloud master 89d7e960e0) and the DeployMate data-loader source unless marked "guess".

## 1. Environment

DM-X (shared with swap, partner, hp, ts), master pin, on-prem 26.99.0 → every endpoint class incl. `GetPlannedShiftTimeRange` 26.3.3 (started-shift check). The gateway mock cannot replace the box: it serves none of the booking writes. Cloud-write mode is the baseline (`writeShiftsOnPrem`, `writeResourceReplacementShiftsToPep`, `onPrem.events` ON); BKG-25 runs PEP-pull mode inside W-X-WRITE-OFF.

## 2. People (partition P1 = Pflege Medizin, 13; optional HPM on Paediatrie)

| Token          | Role                                                                                  | Needs                                                                                                            | Used by                                                |
| -------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| SP             | shift planner, lanes FH / BD (+ reads in AV)                                          | kit `E2E:SP-ALL` (1061 `book_pool_employee` — not in `DMSEED:Planner`; without it the planner app hides Find HP) | BKG-01 (read), 03 step 4, 08 (read), 11–20, 25, 26, 33 |
| SP2            | shift planner, lane RR / IP (keeps "Anfragen verwalten" / "Nur meine Anfragen" apart) | kit `E2E:SP-ALL`                                                                                                 | BKG-21–25                                              |
| PM             | pool manager                                                                          | kit `E2E:PM-ALL` (1060)                                                                                          | P3b, BKG-08                                            |
| HPA            | one-offs, week series, 2-day split                                                    | pool A                                                                                                           | BKG-01–04, 07, 09, 10                                  |
| HPB            | series matrix                                                                         | pool A                                                                                                           | BKG-05, 06, 33                                         |
| HPC            | pool A only (joins B in BKG-08); booked-day guard of BKG-03                           | pool A                                                                                                           | BKG-03 step 4, 08                                      |
| HPD            | Find HP bookings                                                                      | pool A                                                                                                           | BKG-11–15, 25                                          |
| HPE, HPF       | BADI                                                                                  | pool A (HPE also pool B)                                                                                         | BKG-16–20, 26, 25 step 7 (HPF)                         |
| HPG, HPH       | RR candidates and IPO pool members                                                    | pool IPO                                                                                                         | BKG-21–25                                              |
| ER             | replaced employee of the RRs                                                          | presence on RR_DAY, RR_DAY2, RR_DAY3                                                                             | BKG-21, 22, 25                                         |
| HPN            | HP in **no** pool                                                                     | —                                                                                                                | BKG-09                                                 |
| HPM (optional) | HP with two employments                                                               | second employment (P7)                                                                                           | BKG-17 step 7                                          |

Logins from `POLYUSER.KUERZEL`, ASCII only. Every seed login is a planner over all nodes: Find HP, BADI and RR / IPO candidate lists show other groups' pool members and objects — assert by own ids, invite only E2E-BKG pools.

## 3. Days (P5 paint plan; seed roster = seed date −7 … +6, weekdays, one rotating shift)

| Token                                    | Employee | Content                                                                         | How                                                  |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| HPA_PRES                                 | HPA      | presence (seeded day shift, ≥ R+1)                                              | seed                                                 |
| HPA_ABS                                  | HPA      | absence `{{ABS_DEF}}`                                                           | paint                                                |
| HPA_FREE1..3                             | HPA      | no planning                                                                     | weekend or > seed + 6                                |
| W2                                       | HPA      | week 2–3 weeks ahead: Tue presence, Thu absence, rest free (token = its Monday) | paint 2 cells                                        |
| TODAY, R1                                | HPA      | BKG-07 (TODAY .. TODAY + 21 free except the cells above)                        | —                                                    |
| HPB_MON, HPB_MON2                        | HPB      | first Monday ≥ seed + 7; HPB_MON + 21 d; HPB has no plannings from seed + 7 on  | nothing                                              |
| HPC_FREE1..3                             | HPC      | free                                                                            | nothing                                              |
| HPD_PRES, HPD_ABS, HPD_FREE1..5, HPD_FAR | HPD      | presence (seed), absence (paint), free, R + 100                                 | seed + paint                                         |
| HPE_FREE1, HPE_CONF, HPE_NIGHT           | HPE      | free; free conflict day; night `{{NIGHT_DEF}}` on HPE_CONF − 1                  | paint the night                                      |
| HPF_FREE1..4                             | HPF      | free                                                                            | nothing                                              |
| RR_DAY, RR_DAY2, RR_DAY3                 | ER       | presence Dienst (the shift to replace)                                          | seed (RR_DAY, RR_DAY2 ≤ seed + 6) or paint (RR_DAY3) |
| RR_DAY\*, IPO_DAY, IPO_DAY2, IPO_DAY3    | HPG, HPH | free on all six days (pairwise different)                                       | nothing                                              |

The runner writes the realised dates to `results/<run>/booking/day-tokens.md` and the run config. Booked / painted days are never shared between scenarios.

## 4. Group seed (R2, runner) — what the env lacks and who adds it

| Need                                                                      | Provided by             | Step                                                                                                                   |
| ------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| pool manager role, book right                                             | steward role kit        | **P2** membership: SP, SP2 → `E2E:SP-ALL`; PM → `E2E:PM-ALL` (core `scripts/seed/common/kit-member.sql`) + gate BKG-G1 |
| POMA user rows of every actor                                             | first login             | **P3a** one harness login per actor (myPP for HPs, planner app for SP / SP2 / PM)                                      |
| pools `E2E-BKG-A` {HPA..HPF}, `E2E-BKG-B` {HPE}, `E2E-BKG-IPO` {HPG, HPH} | PM in the planner app   | **P3b** `/pool-manager/manage-pools/add`; record pool ids (noise: N-20 "added to pool" NC rows) + gate BKG-G3          |
| "available for internal pool" day Dienste, POMA shift types               | steward definitions kit | gate BKG-G2 (no group step)                                                                                            |
| paint plan §3                                                             | runner                  | **P5** `pp-plan.sh` (PEP fallback under the lock)                                                                      |
| ≥ 11 bookings / ≥ 11 BADI cells for paging                                | runner                  | **P6** (optional, after BD) extra one-offs + bookings of HPD / HPE, or the paging checks record "not testable"         |
| multi-employment HP                                                       | runner, PEP             | **P7** optional; else BKG-17 step 7 BLOCKED-data                                                                       |
| oracles                                                                   | runner                  | **P9** `sql.sh --install` done by the steward; `api-pp.sh avail` (gate BKG-G4); RR ids (`scripts/rr-ids.sql`)          |
| run partner with tenant access, logging ON                                | steward (S-CT-REG)      | read only (BKG-27)                                                                                                     |
| tenant flags                                                              | steward baseline        | none here (windows only)                                                                                               |

Never used: any test-data endpoint, GAT, untargeted jobs. Cleanup: the DeployMate destroy removes pools, availabilities, opportunities, NC rows; reused env → restore memberships and flags.

## 5. Concurrency

| State                                                                                    | Scope                | Scenarios                                    | Rule                                                                  |
| ---------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| `availabilitySeries` = false                                                             | tenant               | BKG-10                                       | W-X-SERIES-OFF (INTERNAL: pauses booking AV only); restore true       |
| `writeShiftsOnPrem`, `writeResourceReplacementShiftsToPep` = false, `simulatePEP` = true | tenant               | BKG-25                                       | W-X-WRITE-OFF state 2 (after swap SWP-14); restore all three          |
| pool memberships                                                                         | tenant               | P3b, BKG-08 (pool B)                         | P3b before fan-out; BKG-08 owns pool B changes                        |
| PEP plannings                                                                            | box                  | P5, bookings / RR / IPO writes, BKG-26 paint | each scenario owns its (person, day); PEP UI under `locks/<env>~pep`  |
| `AvailabilityConflictChecker` job                                                        | tenant (`tenantIds`) | BKG-26 fallback                              | J-X-JOBS, always `tenantIds=<DM-X>`, through `portal-ops.mjs job run` |
| run partner                                                                              | stage                | BKG-27                                       | read only                                                             |

**Lanes (same tenant).** L1 AV-A (HPA, HPN, HPC for BKG-03 step 4): BKG-01 → 02 → 04 → 03 → 09 → 07 (part 1 R, part 2 R+1) · L2 AV-B (HPB): BKG-05 → 06 → 33 · L6 POOL (HPC, PM): BKG-08 · L3 FH (HPD, SP): BKG-11 → 12 → 14 → 15 → 13 (13 after BD for paging) · L4 BD (HPE, HPF, SP): BKG-16 → 17 → 18 → 19 → 20 → 26 · L5 RR / IP (ER, HPG, HPH, SP2): BKG-21 → 22 → 23 → 24 · after fan-out (read-only): BKG-27, 28 · windows: BKG-10, then BKG-25 (part 1 prepares before the window).

SP is used by L3 and L4 at the same time (separate profiles; each acts only on its own HPs' availabilities and assignments). HP actors: one worker per HP at a time.

**Interference from other groups (filters, not errors).** Other groups' NC rows for the same users do not exist (disjoint people) but SP NC rows of other planners' objects may: filter NC by `object_id` and `created_date`. Other groups' pools appear in Find HP / BADI pool lists: always filter by the E2E-BKG pools.
