# Group partner — schedule (lanes, order, windows)

Env DM-X + CT stage registries. 18 scenarios, ≈ 405 worker-minutes, group seed ≈ 1 h. Pace rule: up to 3 workers (3 disjoint lanes). Wall clock ≈ 4 h for one runner (`env-plan.md` §7.2: Day 2, 08:00–14:00, after the booking group on the same runner).

## Before the first launch

| Check                                                                            | Where                                   | Missing →                      |
| -------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------ |
| `stage/run-partner` present, gate G-PTN-1 OK                                     | dashboard db (steward)                  | PAPI, PE BLOCKED "run partner" |
| `stage/provider-gate` OK and `stage/gln` for **today**                           | dashboard db (steward; GLN after 00:00) | EW, X20 BLOCKED-data           |
| Seed P-PTN-6 … P-PTN-11 logged, gates PTN-G1..G3 (+ G5 result) in `env-facts.md` | `results/<run>/partner/`                | the dependent families BLOCKED |
| Portal ops ADMIN profile signed in (≈ 1.5 h), POMA ops profile for PA / PE       | runner                                  | re-login before PA, PE, PAPI   |

## Order

| Step | What                                                                                     | Workers | Notes                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | R2 group seed P-PTN-6 → P-PTN-7 → P-PTN-9 → (P-PTN-9b) → P-PTN-11 + gates                | runner  | `seed/README.md`                                                                                                                       |
| 1    | Lanes in parallel: **L1** = PA → PWAPI → EB, **L2** = PAPI → PE, **L3** = EW             | 3       | disjoint actors and days; PE only after PAPI reported PTN-07 (PTN-08 reads its opportunity); PE takes the PEP lock ≈ 15 min for PTN-09 |
| W    | **X20** in S-CT-GWMOCK (Day 2 ≈ 11:00–11:30)                                             | 1       | after EW; the steward requests the window with the user's OK and announces it to every CT team; the worker holds `locks/ct~gwmock`     |
| 2    | runner: unregister the external HPs `E2E PTN <tag> A`, `B`, `C`; summary; release claims | runner  | then tell the steward that partner PE / PAPI are done (run partner may be deleted after swap F and booking NT)                         |

## Windows touching this group

| Window                      | Owner                                   | Class | Effect on partner                                                                    |
| --------------------------- | --------------------------------------- | ----- | ------------------------------------------------------------------------------------ |
| S-CT-GWMOCK                 | partner (X20), requested by the steward | STAGE | pauses partner EW; changes every CT team's external-workforce behaviour for ≤ 30 min |
| W-X-TRADES-OFF              | swap (SWP-03)                           | FLAG  | pauses PAPI and PE (`shiftTrades` OFF breaks PTN-07 / PTN-08)                        |
| W-X-CATEGORIES-OFF          | swap (SWP-07)                           | FLAG  | pauses PAPI (candidate rules of PTN-07)                                              |
| W-X-WRITE-OFF               | swap + booking (SWP-14, BKG-25)         | FLAG  | pauses PAPI (PTN-07 approval and PTN-19 write PEP)                                   |
| L-X-PEP (`locks/<env>~pep`) | any                                     | LOCK  | PE (PTN-09) and the optional P-PTN-9b paint wait for it                              |

## Critical path and slack

PAPI → PE is the longest lane (≈ 190 min). If S-CT-GWMOCK cannot be granted on the day, X20 is reported BLOCKED "window not granted" — no other scenario depends on it.
