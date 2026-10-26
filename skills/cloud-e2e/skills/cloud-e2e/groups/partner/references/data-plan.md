# Group partner — data plan (group seed R2, allocation, concurrency)

Source: `areas/partner/data-plan.md` (A-partner, 2026-10-23) with the S1 reconciliations: the run partner, the provider gate and the tenant GLN are **steward stage objects** (`references/steward.md` S1 step 7, `env-plan.md` §3.2 S-CT-REG / S-CT-GLN); the flags are the **steward baseline** (`env-plan.md` §6.5); SPX's rights come from the **role kit** `E2E:EXTPOOL` (`scripts/seed/common/README.md`). This group seeds only its own claimed people and days.

## 1. What the env and the steward give before this group starts

| Need                                                                                                                                                                                                                                                  | Provided by                                                                        | Check                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 5 people of one Gruppe, 3 of them with one personnel category (PH1–PH5)                                                                                                                                                                               | DM-X partition P1 = Notfallzentrum (5, 3 TS / 2 BL)                                | P-PTN-7 (category of PH1–PH3)                                             |
| 4 people of a second Gruppe (SPX, SPN, ERX, 1 spare)                                                                                                                                                                                                  | partition P2 = Intensivpflege (4)                                                  | P-PTN-7                                                                   |
| Run partner `e2e-ptn-<run>`: tenant access to DM-X with USERS, PLANNED_SHIFTS, SHIFT_REQUESTS, NOTIFICATIONS, API_GATEWAY, POMA_SHIFT_TRADE_API, POMA_OPPORTUNITY_API, POMA_SHIFT_REQUEST_API (no UI_EMBEDDING), Debug logging ON after its last edit | steward (S-CT-REG, user OK), `stage/run-partner`                                   | gate G-PTN-1 (steward); this group reads the doc                          |
| External-workforce provider of the stage simulator + `providerCode` mapper; gateway-mock strategies SUCCESS                                                                                                                                           | CT stage (exists per Confluence 13304725524), verified by the steward              | gate P-PTN-3, `stage/provider-gate`                                       |
| Tenant GLN of DM-X (`allowed_master_gln` = a run-unique 13-digit value, `allowed_child_glns` = [])                                                                                                                                                    | steward, after 00:00 of every run day (the nightly HubSpot job may clear all GLNs) | gate P-PTN-4, `stage/gln`; without it PTN-12..15, 17, 20 are BLOCKED-data |
| Rights 1065 + 1062                                                                                                                                                                                                                                    | role kit `E2E:EXTPOOL` (steward)                                                   | gate PTN-G1 after the move                                                |
| Flags `partnerSimulator`, `externalAvailabilities`, `schedulingRequestV1`, `shiftTrades`, `opportunities`, `writeShiftsOnPrem`, `writeResourceReplacementShiftsToPep`, `onPrem.events` ON; messaging OFF                                              | steward flag baseline, gate G-FLAGS                                                | PTN-G1 (simulator opens, BADI shows "Externe Pools")                      |
| Swappable Dienste 111/112/113 (PTN-07)                                                                                                                                                                                                                | steward definitions kit (DM-X) + G4b                                               | PTN-G3                                                                    |
| Booking-partner records (≥ 11, run-unique `external_booking_id`)                                                                                                                                                                                      | **nobody**: no BOOKING_PARTNER test client is known on CT (OQ-29)                  | PTN-G5 → PTN-16 list part BLOCKED-data when absent                        |
| PWA prerequisites (`partner-embedding-mock` with UI_EMBEDDING)                                                                                                                                                                                        | `ct-zinc-master` — group `shared`, not here                                        | —                                                                         |

## 2. People and days

### 2.1 People (P-PTN-7 writes `{{RUN_DIR}}/partner-allocation.md`: token, login, MITARBEITER_ID, Station, personnel category, tenant subject)

| Token          | Role                               | Constraint                                                                                               |
| -------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| PH1            | trade owner                        | seed presence 111/112/113 on `ST_DAY`                                                                    |
| PH2, PH3       | trade candidates                   | same personnel category as PH1, listed by `shift-trade-candidates` for PH1's `ST_DAY` shift (PTN-G3)     |
| PH4            | scheduling-request HP              | no planning on `SR_DAY`                                                                                  |
| PH5            | planned-shift events, RR candidate | seed plannings in R..R+6 (Testing-tab shift sync, PTN-02 publish); free on `CM_DAY`, `NM_DAY`, `RRX_DAY` |
| SPX            | external-pool planner              | moved into `E2E:EXTPOOL`, keeps `DMSEED:Planner` (1050 RR start, 1070 trade approval)                    |
| SPN            | planner without 1062 / 1065        | stays a plain seed login                                                                                 |
| ERX (optional) | replaced employee of PTN-19        | painted presence on `RRX_DAY` (P-PTN-9b)                                                                 |

ASCII kürzel only; logins from `POLYUSER.KUERZEL`, never from the manifest. Tenant subjects: the `sub` / tenant-subject claim recorded in memory by the login script (claim value only) or the full-sync users list.

### 2.2 Days

| Token         | Rule                                                                                                                   | Used by                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `ST_DAY`      | seed presence day of PH1, ≥ R+2, inside the seeded roster                                                              | PTN-03, 05, 07             |
| `SR_DAY`      | ≥ R+3, PH4 free                                                                                                        | PTN-05, 06                 |
| `CM_DAY`      | future day of the current month, ≥ R+2, PH5 free (if the month ends within 2 days, run PE after the month change)      | PTN-09                     |
| `NM_DAY`      | weekday of the next month, PH5 free, no Sollplan saved for that month                                                  | PTN-09                     |
| `RRX_DAY`     | ≥ R+3, ERX painted presence, PH5 free                                                                                  | PTN-19                     |
| `XD1`..`XD8`  | eight consecutive weekdays ≥ R+7 and after the seeded roster end (no clash with seed data, outside the 48 h lead time) | EW, X20                    |
| `XD7N`        | the calendar day after `XD7`                                                                                           | PTN-14                     |
| `XD9`, `XD10` | `XD8` + 1, + 2                                                                                                         | PTN-20                     |
| `LEAD_DAY`    | R + 1                                                                                                                  | PTN-14 (lead-time refusal) |

## 3. Group seed (runner; details `../seed/P-seed.md`)

| Step     | What                                                                                                                                                                                                            | PEP        | Est.   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| P-PTN-6  | SPX → `E2E:EXTPOOL` with `scripts/seed/common/kit-member.sql` (`leave=-`); SPX logs in again                                                                                                                    | no         | 5 min  |
| P-PTN-7  | one login per actor (POMA user rows); tenant subjects; gates PTN-G1, PTN-G2                                                                                                                                     | no         | 15 min |
| P-PTN-9  | pick the days (rules above, written to the run config); PTN-G3 (candidates of PH1's shift); PH4 / PH5 free days checked with `plan-day.sh`                                                                      | no         | 15 min |
| P-PTN-9b | optional ERX presence on `RRX_DAY`: `pp-plan.sh` when `kits/<env>` marks it verified, else `pe-paint.sh` under the PEP lock                                                                                     | fallback   | 10 min |
| P-PTN-11 | oracles: `plan-day.sh` / `ext-planning.sql` dry read; PEP palette coordinates of the PTN-09 Dienst and PH5's row (screenshot under the PEP lock) into `partner-allocation.md`; PTN-G5 (booking-partner records) | short lock | 15 min |

Not in this seed: flags, the run partner, the GLN, the provider (all steward), definitions and role rows (kits), GAT, jobs, any test-data endpoint.

## 4. Concurrency

| State                                                   | Scope                                                        | Scenarios                                                                                        | Rule                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Run partner `e2e-ptn-<run>`                             | stage registry                                               | read by PAPI, PE (and swap SWP-31, booking BKG-27)                                               | never edited; the steward deletes it after the last reader                                                            |
| Throw-away partners `e2e-ptn-x-<tag>`, `-l-`, `-g-`     | stage registry                                               | PTN-01, 02, 05                                                                                   | unique ids, tenant access only to DM-X, each deleted by its scenario                                                  |
| External HPs / availabilities of the simulator provider | stage registry (visible to every tenant with a matching GLN) | EW, X20                                                                                          | run-unique names, e-mails and GLN; EW is the only writer; unregistered after X20                                      |
| Gateway-mock strategies                                 | CT-wide, one pod                                             | X20 only                                                                                         | S-CT-GWMOCK (STAGE, ≤ 30 min, steward + user OK + announcement), `locks/ct~gwmock`, restore SUCCESS and verify by GET |
| Gateway-mock received-bookings inbox                    | CT-wide                                                      | EW, X20 (read)                                                                                   | read-only, filtered by transaction id; never deleted                                                                  |
| PEP plannings                                           | box                                                          | PTN-07 (PH1 / PH2 on `ST_DAY`), PTN-09 (PH5), PTN-19 (ERX), virtual external plannings (EW, X20) | each family owns its people and days; PEP UI only under `locks/<env>~pep`                                             |
| Conflict-checker "Partner" publish                      | tenant + subject                                             | PTN-02, 09                                                                                       | scoped to DM-X and PH5; reaches only partners with access to DM-X                                                     |
| Swap / booking windows                                  | tenant flags                                                 | W-X-TRADES-OFF, W-X-CATEGORIES-OFF, W-X-WRITE-OFF pause PAPI (and PE for TRADES-OFF)             | the runner checks `windows/` before every launch                                                                      |

Interference to expect (filters, not errors): other groups' events in the run partner's log; booking's pools in BADI internal mode (EW uses external mode only); other teams' external HPs in the simulator ("Registered on the server, not in your catalog").

## 5. Cleanup

1. X20 restores the strategies (SUCCESS / SUCCESS by GET) before the window is released.
2. The runner unregisters `E2E PTN <tag> A|B|C` in the simulator after X20; verify `GET /api/external-workforce/v1/health-professionals` no longer lists them.
3. Throw-away partners: deleted by their scenarios; any leftover (aborted scenario) is deleted by the runner with `portal-ops.mjs "partner delete <id>"`.
4. The run partner: the steward deletes it after swap F, booking NT and partner PE reported (S-CT-REG).
5. Tenant GLN: goes with the DeployMate destroy (steward); if the env is kept, the steward sets it back to NULL.
6. The `XD8` booking (PT720H) and the approved PTN-07 trade stay until destroy (listed in `created_data`).
