# P5 — paint plan (group booking)

Input: `paint-plan.tsv` (39 rows) resolved with `employees.md` / `day-tokens.md` and the placeholders `ABS_DEF`, `DAY_DEF`, `NIGHT_DEF` (definitions-kit log in `kits/<env>`).

1. Pick the dates (rules in `rules.json` DAY_RULES): seeded tokens (HPA_PRES, HPD_PRES, RR_DAY, RR_DAY2) = weekdays ≥ R+1 inside the seeded window where the person has a seed presence; painted tokens and free tokens after the seeded window (seed + 7 … R + 89) or on weekends; HPE_NIGHT = HPE_CONF − 1; W2 = a Monday 2–3 weeks ahead; HPB_MON = first Monday ≥ seed + 7, HPB_MON2 = HPB_MON + 21 d; HPG / HPH: RR_DAY*, IPO_DAY* pairwise different. Write `day-tokens.md` and the run config.
2. Read the state of every row once (`scripts/plan-day.sh <env> <emp> <day>` or one `sql.sh` query over all ids and dates) → `seed-paint-before.txt`.
3. Rows `seed`: the seed presence must be there (else choose another date). Rows `ABS` / `DAY` / `NIGHT`: `scripts/pp-plan.sh <env> <MITARBEITER_ID> <day> <PA code> FULL`. Rows `DELETE`: the day must be free; if a planning sits there, choose another free date (only delete a planning on a day that is the person's own claimed cell and not a seeded fixture another token needs).
4. `pp-plan.sh` unverified / failing → PEP UI under `locks/<env>~pep` with `pe-ready.sh` + `pe-paint.sh` (one cell per gesture, neighbour diff), release after ≤ 20 min.
5. Re-read → `seed-paint-after.txt`; log every write in `created/seed.jsonl`.
