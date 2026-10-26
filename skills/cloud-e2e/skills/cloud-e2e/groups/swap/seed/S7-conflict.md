# S7 — conflict candidate (group swap)

Goal: T4 appears as a candidate of T1 on D1 **with** a WARNING or FORBIDDEN conflict (SWP-06 step 6), and a recipe that SWP-13 / SWP-29 can repeat after submission. The on-prem conflict rules of a DeployMate box are unknown (guess list below); try in order, stop at the first that works.

| Try | Change (T4, D1, always on T4's own cell)                                                                       | How                                     |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | a second planning of T4 overlapping the incoming 111 shift (e.g. 113 as a RIGHT half next to the existing 112) | `pp-plan.sh <env> <T4> <D1> 113 RIGHT`  |
| 2   | a night 141 on D1−1 (rest-time rule before an early shift), only if D1−1 is not another scenario's cell of T4  | `pp-plan.sh <env> <T4> <D1−1> 141 FULL` |
| 3   | an absence of T4 on D1 in addition to the presence (if PEP allows both)                                        | `pp-plan.sh … <ABS_DEF> LEFT`           |

Verify after each try (≤ 2 min for the event): as T1 (`app.mjs --app mypp`), `candidates(api, <T1 D1 111 planning>)` from `swap-lib.mjs` → T4's entry has non-empty `partner_conflicts` or `request_conflicts` with severity WARNING / FORBIDDEN → save `s7-candidates.json`. Not listed at all = the change made T4 non-matching: undo it and try the next.

Result:

- Works → write the recipe as one line into the run config placeholder `CONFLICT_RECIPE` (e.g. "pp-plan.sh <emp> <day> 113 RIGHT next to the candidate's 112") and into `seed-log.md`; keep T4's D1 state (SWP-06 needs it).
- Nothing works → `CONFLICT_RECIPE = none`; undo every try (`plan-day.sh` back to the allocation); SWP-06 step 6 and the conflict halves of SWP-13 / SWP-29 become BLOCKED-data (their briefs handle `none`).
