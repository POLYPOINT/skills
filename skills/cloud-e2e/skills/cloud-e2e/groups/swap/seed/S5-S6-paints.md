# S5 / S6 — paint the allocation (absences, on-call, repaints, halves)

Input: `paint-plan.tsv` (106 rows: person token, day token, position, definition, owning scenario), resolved with `swap-allocation.md` (ids, dates, `ABS_DEF`, `PIKETT_DEF`, `DEF_D`).

1. Read the current state of every (person, day) of the plan once: `scripts/plan-day.sh <env> <emp> <day>` (or one `sql.sh` query over all ids and dates, the form of family brief A, SWP-01 step 4) → `seed-paint-before.txt`. Skip rows whose cell already matches (seeded D-days often do).
2. Write each remaining row with the api-pp direct planning (D9; verified once per env by the steward, `kits/<env>` says so):
   ```
   scripts/pp-plan.sh <env> <MITARBEITER_ID> <YYYY-MM-DD> <PA code> FULL|LEFT|RIGHT|ON_CALL   # paint / replace (ON_CALL for the PIK row)
   scripts/pp-plan.sh <env> <MITARBEITER_ID> <YYYY-MM-DD> - DELETE                     # "—" cells (usage line of pp-plan.sh for the exact DELETE form)
   ```
   Order inside one day: FULL rows first, then LEFT before RIGHT. After every half write run `plan-day.sh`: if the RIGHT write replaced the LEFT half (one row left), stop S6, note "pp-plan replaces the other half" in `seed-log.md` and tell the swap runner — family E is then BLOCKED (no other half-paint path exists today).
3. `pp-plan.sh` not verified or failing → full cells only through PEP: take `locks/<env>~pep` (create-if-absent, ≤ 20 min, renew), `scripts/pep/pe-ready.sh <env>`, one `scripts/pep/pe-paint.sh` per cell (`NEIGHBOURS=<the sheet's claimed ids>`), release after each batch of ≤ 20 min. Half cells have no PEP path → family E BLOCKED.
4. `PIK` rows with `PIKETT_DEF = none` and `DEF_D` rows with `DEF_D = none` are skipped (SWP-02's on-call check and SWP-26 #37/#38 are then not run).
5. A painted absence or presence on a day of another group's claimed person: impossible by construction (only claimed T / U ids); if the plan resolves to an unclaimed id, stop and fix the allocation.
6. Re-read all cells → `seed-paint-after.txt`; record the PLANUNG ids of every painted cell in `swap-allocation.md` (identify cells by person, day, PA code, position; ids change on repaint). Log each write in `created/seed.jsonl` (`{"step":"S5|S6","emp":..,"day":..,"def":..,"pos":..,"planung_id":..}`).

Inbound-event side effect: every paint also emits a planned-shift event to poma-core (if the box emits them, G-SWP-EVT); no swap exists yet, so nothing is cancelled.
