# Family M — Month report (M-01..M-04) · READ-ONLY

|                           |                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | M-01, M-04, M-03, M-02                                                                                                                                                                            |
| Employees                 | E1 `{{E1_LOGIN}}` ({{E1_ID}}), E4 `{{E4_LOGIN}}` ({{E4_ID}}), E2 `{{E2_LOGIN}}` ({{E2_ID}}) (M-03 flex only)                                                                                      |
| Window                    | month `{{MONTH}}` (the roster window lies inside it; a customer-roster seed has no earlier months)                                                                                                |
| Writes                    | none                                                                                                                                                                                              |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/M` · `{{RUN_DIR}}/M/<id>/`                                                                                                                                   |
| Read first                | the common part; scenarios.md section M; `{{RUN_DIR}}/pep-oracle.md` (month section: PEP roster Ist / Soll / GLAZ-Saldo per employee); the R family's captures under `{{RUN_DIR}}/R/` (day cards) |
| Bundle                    | `{{BUNDLE}}` (class `{{BUNDLE_CLASS}}`): scenarios.md "Bundle-aware expectations"                                                                                                                 |
| Scheduling                | may run in parallel with R and W (reads only); if family W is still writing E1 (its days are in the W day map), capture M after W finished or note the W writes in `notes.md`                     |

## Realized data and the oracle

| Id   | Employee / range                          | Expected (oracle)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | First run (example)                                                                                                                                   |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-01 | E1, `{{MONTH}}`                           | every unified month row `credited` = the day card of that day (R captures or a fresh `/days`) = Σ GLAZ `ZEITANRECHNUNG` of the day; `summary.credited` = Σ rows = PEP roster month Ist; row and summary `planned` = Σ `PLANUNG.SOLLZEIT` (SQL, oracles.md §5) — never PEP Soll (a Kombi day plans its own SOLLZEIT, e.g. 8:15); day-level planned/balance not asserted. Until KD-1 is fixed: PEP Ist − 0:30 per −9 day → KNOWN-FAIL KD-1. **pre-1801** additionally KD-7: every planning day whose Σ GLAZ is only PEP's planned pre-credit (CODEART P — today, future, un-stamped painted days) reads 0:00 in card and row → `summary.credited` = PEP Ist − 0:30 × (−9 days) − Σ those pre-credits → **KNOWN-FAIL KD-1 + KD-7** when Δ equals exactly that. **1801**: stamped days doubled → KNOWN-FAIL F1 (+ KD-1) | first run 480: 75:51 vs PEP 76:21 (KD-1), planned 80:00; master-1822 480: 45:06 vs 85:36 = −0:30 KD-1 − 40:00 KD-7 (5 pre-credit days), planned 96:15 |
| M-04 | E1, `{{MONTH}}`                           | mixed prepared days (P0..P3) and other days: no 500, every row = its card, no double count; seed-only days 8:00 once (may not exist when all days were repainted); pre-1801: today / future pre-credit rows 0:00 → KNOWN-FAIL KD-7                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 480: no 500, seed days 8:00; master-1822: no seed-only days, pre-credit rows 0:00 (KD-7)                                                              |
| M-03 | E1, E4, E2 at the last day of `{{MONTH}}` | classic `GET /api/mobile/time-recording/v1/month-flex-time?date=<last day>` `flex_time_balance` = PEP GLAZ-Saldo of that day (rounded half away from zero). E4 (BG ≠ 100): until KD-5 is fixed Δ = weekdays since the GLAZ KONTOSTAND checkpoint × frac(TAGESSOLL × BG) → KNOWN-FAIL KD-5 when Δ matches exactly                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 480 −6139:39 = PEP; 484 −6134:29 = PEP; 482 −4270:35 vs PEP −4273:03 = 740 × 0.2 min = 2:28 (KD-5)                                                    |
| M-02 | E4, `{{MONTH}}`                           | after Phase 1 step (m): every planning row `planned` = Sollzeit × BG (8:00 × 0.70 = 5:36) = Σ `PLANUNG.SOLLZEIT` of that day; `summary.planned` = n × 5:36; not PEP Soll. BLOCKED only if step (m) was not done (`env-facts.md` / `seed-log.md`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | first run (before step m existed): 80:00 unreduced → BLOCKED; expected after step m: 56:00 (10 plannings)                                             |

## Steps

1. Script `{{RUN_DIR}}/scripts/M-month.mjs`:
   ```js
   import { save, summary, readDay, UTR, CTR } from '{{GROUP_DIR}}/scripts/harness/utr-lib.mjs';
   export default async ({ api, page, shot, log, out }) => {
     const M = process.env.MONTH;
     const [y, m] = M.split('-').map(Number);
     const last = `${M}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
     const d0 = await api.goto(
       `/tabs/unified-time-recording?date=${process.env.DAY}`,
       '/unified-time-recording/v1/days',
     );
     const emp = d0?.body?.[0]?.employment_id;
     const um = await api.get(`${UTR}/reports/month?employment-id=${emp}&start=${M}-01&end=${last}`);
     save(out, 'month-unified.json', um);
     const cm = await api.get(`${CTR}/reports/month?employment-id=${emp}&start=${M}-01&end=${last}`);
     save(out, 'month-classic.json', cm);
     const fx = await api.get(`${CTR}/month-flex-time?date=${last}`);
     save(out, 'month-flex-time.json', fx);
     const days = await api.get(`${UTR}/days?from=${process.env.FROM}&to=${process.env.TO}`);
     save(out, 'days-range.json', days);
     await page
       .locator('.month-report-button')
       .first()
       .click()
       .catch(() => {});
     await page.waitForTimeout(2500);
     await shot('month-report');
     log('statuses', um.status, cm.status, fx.status, days.status);
     return { emp, unified: um.status, classic: cm.status, flex: fx.status, days: days.status };
   };
   ```
2. Run per employee:
   ```
   cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/M MONTH={{MONTH}} DAY={{P0}} FROM=<roster start> TO={{R}} \
     node {{SKILL_DIR}}/scripts/harness/mypp.mjs {{TENANT}} {{E1_LOGIN}} scripts/M-month.mjs M/M-01
   ```
   E4 → `M/M-02`, E2 → `M/M-03-e2` (flex only). M-04 and M-03 for E1 reuse `M/M-01`.
3. Build a per-day table in `M/M-01/notes.md`: date | month row credited | `/days` credited | Σ GLAZ ZEITANRECHNUNG (SQL) | PEP Ist (pep-oracle.md) | row planned | Σ PLANUNG.SOLLZEIT | match. Then Σ rows vs `summary.credited` vs PEP month Ist, and `summary.planned` vs Σ SOLLZEIT. SQL (read-only): `{{SKILL_DIR}}/scripts/sql.sh {{TENANT}} "<oracles.md §5 queries with the employee and the month>"` → `M/<id>/oracle-month.txt`.
4. M-03: convert `flex_time_balance` to ±H:mm and compare with the PEP GLAZ-Saldo of `pep-oracle.md`; keep the raw seconds in notes.

## Report notes

- Build the KD-7 list explicitly (per day: `oracle-day.sh` `ZA|` lines, or for the month): per day Σ GLAZ split by `CODEART` (`SELECT TO_CHAR(ZA_DATUM,'MM-DD')||' '||CODEART||' '||SUM(ZEIT)/60 FROM ECBERN.ZEITANRECHNUNG WHERE MITARBEITER_ID=<emp> AND AN_ZEITKONTO=1 AND ZA_DATUM BETWEEN … GROUP BY ZA_DATUM, CODEART ORDER BY 1;`) and the day's real (non-preview) BLOCK count: a KD-7 day = only CODEART P and no real block.
- A row that differs from its card is a FAIL (name the day). A month total that differs from PEP only by the −9 amount is **KNOWN-FAIL KD-1** (`findings_confirmed: ["KD-1"]`, notes start with `KNOWN-FAIL KD-1 <ticket>`), not a new finding. Same for E4's flex drift (KD-5).
- Never judge `planned` against PEP "Soll", and never the day-level `time_amounts.planned` / balance against the row (the day view has no planned total; on days whose seed ZS was removed the day-level planned layer is empty by design).
- F1 shows up first in the month: a candidate whose stamped days count twice (rows ≈ 2 × PEP Ist on stamped days) → `findings_confirmed: ["F1"]`.
- Classic month (`month-classic.json`) has no Zeitsummen path by design (stamp credit + absences + unplanned/on-call): record its credited total in notes; it is judged in the C family (C-02) against the classic oracle, not here.

## Cleanup

Nothing to clean.

## Compare overlay (optional)

Run `M-month.mjs` with `{{COMPARE_TENANT}}` into `M/<id>/compare/` (same roles, same month); `diff` = month credited and planned of both tenants plus the first day whose row differs (first run: "candidate 102:42 vs 75:51, every stamped day doubled").
