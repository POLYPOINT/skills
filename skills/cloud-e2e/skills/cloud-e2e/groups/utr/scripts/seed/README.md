# Phase 1 runbook — seed a DeployMate `customer-roster` environment for the UTR E2E

Replayable recipe for one environment (the bundle under test). **Execution order** (letters are stable ids, not the order):
a → b → c → j → n → o → p → c2 (one G4b batch for every definition change of c/j/n/o/p) → k → d → e → l → m → q → f → s → g
→ h; r only with explicit approval, during family X. Phase 1 is the orchestrator's (box-side DML, PEP definitions and paints). Steps j–r were added after the 2026-10-15 root-cause investigation of the first
run; they are derived from read-only analysis and are **unverified until their first execution** — run each step's verification
and record the outcome (and any deviation) in `results/<run>/seed-log.md`. With `--compare <second env>` run it again, identically, on
the second environment (ids may differ, dates/times/codes must not). Distilled from the first run (2026-10-14), where it was
done by hand on two boxes and produced identical PEP numbers on both.

Paths below are relative to the skill folder; `<id>` = DeployMate env id = CT tenant id; `R` = run date (Europe/Zurich);
`<run>` = results folder name. Employee ids (`MA_ID`) come from step (a); on a 40-people `customer-roster` seed with
`randomSeed 42` they were 480..519 on both boxes of the first run, but treat them as env-specific.

## 0. Prerequisites (Phase 0 done)

| Need                                                                                                                         | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Check                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Credentials file `~/.config/deploymate/<id>.credentials.json` (0600; keys `rdp.*`, `db.username/password/host/port/service`) | deploymate skill `dm-api.sh reveal <id> db` / `rdp`, assembled by the orchestrator                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | never print it                                                                                       |
| Seed manifest `~/.config/deploymate/<id>.test-data.json` (`manifest.loginPassword`, `manifest.roster.startDate/endDate`)     | `dm-api.sh test-data <id> > …` (0600)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `jq .manifest.roster`                                                                                |
| sqlplus wrapper on the box                                                                                                   | `scripts/sql.sh <id> --install` (copies `scripts/dm-sql.ps1` to `D:/TempPOLYPOINT/liquibase`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `scripts/sql.sh <id> "select 1 from dual;"`                                                          |
| Tunnels (optional; allowlisted IPs reach 9090/8383/1521 directly)                                                            | `scripts/tunnels.sh <id> - 1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | prints the local ports                                                                               |
| pep-driver deployed on the box (**first time per box**), agent running, PEP running and logged in as the seed planner        | one command, also after every box restart (stop/start, DM-213 repair): `PE_COLD_START=1 PE_USER=<E1 login> scripts/pep/pe-ready.sh <id>` — runs `pep.sh <id> deploy` when the box has no agent token (~3 min, once per box), `agent-start`, launches pepwin once (never while a login window is open), polls up to 90 s for the IDM form (`window*="Anmeldung"`) and submits it once, confirms the first-run "Optionen" dialog, opens the plan sheet. Exit 4 "DEPLOY NEEDED" / "COLD START NEEDED", 5 = two PEP login windows (close one, rerun), 3 = login failed (never retry). `scripts/pep.sh` exports `PEP_ANSIBLE_ROOT` (default `~/ansible`: the ansible repo with the synthesised inventory `inventories/deploymate/<id>/hosts`, env-setup.md §2); pep-driver's `cli/pep` called directly needs it too. User = E1's login (a seed user is in group "PEP - Leitbediener"); passwords are typed with `type`, never `settext` (its readback error echoes the text) | `scripts/pep.sh <id> windows` lists `TfrmPEPMain`                                                    |
| Seed flows on the box                                                                                                        | `scripts/pep.sh <id> push-seed-flows` (copies `groups/utr/scripts/seed/flows/*.py` into the pep-driver checkout when missing, then `pep push-flow`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `scripts/pep.sh <id> flows` lists `create_stamp`, `stampeditor_commit`, `add_zeitsumme`, `add_block` |
| myPP harness                                                                                                                 | Playwright under `~/.config/deploymate` (deploymate skill)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `node scripts/harness/mypp.mjs <id> <E1 login> - <tmp>` logs in                                      |

PEP helper coordinates (roster cells, Blöcke rows, buttons): [§ PEP coordinates](#pep-coordinates) — verify with a screenshot first.

## Dates (relative to the run date R)

- Roster window = `manifest.roster.startDate..endDate` (audit A4): the seed plans weekdays from seed date −7 to +6, rotating
  Früh 111 → Mittel 113 → Spät 112 → Nacht 141, weekends off. Nothing exists before it (the "M-1 month" of data-plan.md is empty).
- myPP writes only the last 7 past days (`onPrem.timeRecodingMaxAllowedPastDays` = 7): R−7..R−1.
- **Prepared (read) days P0..P3** = the first four roster weekdays. P0 should be older than R−7 (a read-only past day); P1..P3
  sit inside the write window but are never written by the scenarios. First run: R = 2026-10-14, P0..P3 = 10-06..10-09.
- **Write days** = the last two past weekdays (R−1, R−2 when they are weekdays; first run 10-12/10-13). Planning-less write day
  for W-05 = a weekend day in the window that carries no stamps — NOT the Saturday after a Friday night shift (its out-stamp is
  dated Saturday, see write-days.sql `ST_CARRY`); first run: Sunday 10-11 for E1, not Saturday 10-10.
- **Oldest UI-writable day** = R−6 while KD-3 is open (the flag value 7 grants only 6 past days in the FE).
- **Seed date = run date** (DeployMate seeds on the day of creation, so a same-day run has the roster window R−7..R+6 with
  only five past weekdays): "P0..P3 = the first four roster weekdays" then collides with the write days and P0 cannot be older
  than R−7. Rule: **paint P0/P1 on the two weekdays before the roster start** (PEP painting, § PEP coordinates "Painting"; such
  days carry P2 preview blocks, no seed ZS) and keep P2/P3 on the first roster weekdays; **P3 ≥ R−6** (C-04 and L-02 write on
  E3 P3). Put `roster_start` (`manifest.roster.startDate`) and `painted_days` into `run-config.json`: `gen-prompts.py` refuses a
  prepared day before the roster start that is not painted, a prepared day equal to a write token and P3 < R−6. Run a1801
  (seeded and run 10-16): P0 10-07, P1 10-08 (painted), P2 10-09, P3 10-12; WD1/WD2 10-14/10-15. Seeding at least three days
  before the run avoids it; a DeployMate `seedDate` / `rosterStart` create parameter would remove it (DM ticket candidate).
- **WE1 = R−6** when R is a Friday: WE1 is then the oldest UI-writable day and leaves the window on R+1 — run O's WE1 scenario
  (O-03) on R, or re-pick the day on R′ (`gen-prompts.py` prints a note).
- **Fixture-day protection**: a fixture day (P0..P3, `KOMBI_DAY`, `CARVE_DAY`, X-02/X-03 targets) must not follow a night or Pikett window of the same employee that any family writes stamps on; and no family writes stamps on such a night. On-prem pairs a lone IN with the next morning's stamp and re-interprets D+1, rebuilding its blocks from stamps (new ids) and dropping what has no stamp source — master-1822 lost the 10-14 carve twice through writes on E1's 10-13 night (W-01/W-07b, P-01b; N-W-3).
- **Run date shift**: these rules are evaluated against R; a run that continues on a later day re-derives the R-relative days (groups/utr/references/runbook.md "Day map and date shift"); the data days above never move.

## Steps

### (a) Audit the seed → `results/<run>/employees.md`

```
scripts/sql.sh <id> -f scripts/seed/common/audit.sql > results/<run>/audit-<id>.txt
```

Expect on a fresh 40-people seed: A1 40 rows (`dmseed-<kuerzel>`, KC yes, AUTO alternating F/T, BG mostly 100 with a few
30–90, RED 2, LOHNART M, TAGESSOLL 30240 = 8:24); A2 groups "PEP - Leitbediener" (default) and "DMSEED:Planner" with all 40 users;
A3 empty; A4 400 plannings 111/112/113/141 over 14 days; A6 palettes with presences only (111/112/113/141) per Pflege node;
A7 only 770 Piketteinsatz (PIKETTZUSATZ T), no TYP I; A8 145 "DMSEED Ferien" present but unusable (see defects); A9 closing
dates 1999-12-01 (= open); A10 STEMPEL 0, BLOCK 0, ZEITSUMME one `A/A` row (8:00) per planning.

Pick the employees from A1 (one team for E1–E4 so one plan sheet covers them; logins are `lower(KUERZEL)`, never the manifest's
`loginUsers`). First-run picks (all node "Chirurgie A" except E5/E6 "Chirurgie B"):

| Role  | Rule                                                                            | First run              |
| ----- | ------------------------------------------------------------------------------- | ---------------------- |
| E1    | must-stamp (F), BG 100                                                          | 480 dmseed-lhug        |
| E2    | must-stamp, BG 100 (on-call)                                                    | 484 dmseed-cmül        |
| E3    | auto-stamp (T), BG 100                                                          | 481 dmseed-awüt        |
| E4    | must-stamp, BG < 100                                                            | 482 dmseed-ksta (70 %) |
| E5    | must-stamp, BG 100 (mobile / classic)                                           | 486 dmseed-rsta        |
| E6    | must-stamp, BG 100 (read-only target, R-11 needs a period setup — not done yet) | 488 dmseed-osch        |
| spare | auto-stamp                                                                      | 487 dmseed-jeug        |

`employees.md` template:

```
# Employees — <run>, <id>, seeded <manifest lastSeededAt>
| Role | Login | MA_ID (= employment_id) | POLYUSER_ID | Mode (AUTO / unified mode) | BG | Node | myPP login OK |
|---|---|---|---|---|---|---|---|
| E1 | dmseed-… | … | … | F / TIMESTAMPS | 100 | … | yes/no (step b) |
Roster window: <start>..<end>; P0..P3 = …; write days = …; planner role id = <A2 ROLE_ID of DMSEED:Planner>
```

### (b) Mobile-app rights on the seed planner role

```
scripts/sql.sh <id> -f scripts/seed/common/rights.sql -D role_id=<ROLE_ID of "DMSEED:Planner" from A2>
```

Idempotent (inserts only missing rows), then `IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('PERMISSION_ROLE', …, 2471, …)` refreshes
api-pp's role cache (the boxes lack the PSC trigger; without it the old rights stay cached up to 7 days). Expect 13 rows listed
(functions 1030/306/307/1033/1032/1031/1040; operation ids in the file header). Log the ids (`created/<agent>.jsonl`, kind
`POLYUSRROLE_DETAIL`).
Verify per login through the cloud (one login per user, sequentially):

```
node scripts/harness/mypp.mjs <id> <login> groups/utr/scripts/harness/api-probe.mjs results/<run>/runs/rights-<login>
```

Expect legacy `/permissions` all true (`license`, `time_stamp_*`, `on_call_*`, `block_*`) and unified `/permissions`
`can_add_timestamps` + `can_add_retroactive_timestamps` true; `time_recording_mode` TIMESTAMPS for AUTO F, BLOCKS for T
(`can_add_blocks` follows the mode). Record "myPP login OK" in employees.md.

### (c) Definitions through PEP (no flow yet: drive with pep-verify, PEP-SUPERUSER-GUIDE "Dienst")

1. Palette of the team's Pflege node (A6, e.g. "Pflege Chirurgie"): `scripts/pep.sh <id> def Dienst` → node picker
   `TfrmKnotenwahl` (no lock) → node → Weiter → `TfrmDienstMain`. Absenzen tab: move **25** Ferien Monatslohn, **57**
   Geschäftlich abwesend/Homeoffice, **60** Weiterbildung intern into the palette. Do not use 145 (defects).
2. Pikett definition at the root node ("Firmenname"): Pikett tab → "+" → Typ Pikett, PA-Code **150**, Bezeichnung
   **"UTR Pikett"**, Sollzeit 0:00, Gutschrift GLAZ, Zulagenprofil default, Zeitraster Block 1 Pikett-Zeit **18:00–07:00 (day 2)**
   (`groups/utr/scripts/pep/pe-newblock.sh <id> 18 00 07 00 --day2 --no-ok`, check the screenshot, OK), no autostamps, valid from the
   first day of the run month. Click sequence: [§ Dienst wizard](#dienst-wizard-steps-c-n-o). Then add **150** and the existing **770** Piketteinsatz
   (PIKETTZUSATZ T, already usable for mobile on-call recording) to the team palette.
3. Verify: audit A6 shows `25/A 57/A 60/A 150/I … 770/P` on the palette node; A7 shows `150 UTR Pikett I` with DETAILS 1
   (DIENST_DETAIL at node 1: GLEITZEIT_START1 64800, GLEITZEIT_ENDE1 111600, DATUMSWECHSEL T). Log kinds `DIENST`, `DIENSTPALETTE`.
   150 has a Gleitzeit window only and **no BLOCKZEIT**: PEP writes no planned-layer block for it, so it is the **windowless**
   Pikett (O-03 path 3, W-04). The windowed Pikett with a planned block (O-01, O-02) is **151**, step (n).
   SQL alternative for the palette rows only (not verified: PEP caches palettes, restart PEP afterwards): insert
   `DIENSTPALETTE (KNOTEN_ID, PA_CODE, AUTO_PLANBAR 'F', SHORTCUT 0, POSITION n, NAME null, PALETTE_GUELTIG_AB <valid from>,
PALETTE_GUELTIG_BIS 2999-12-31)` — the shape PEP wrote. The Pikett DIENST/DIENST_DETAIL carries an internal zip column: create it in PEP.

### (c2) Gate G4b — make api-pp load the new definitions

The boxes lack the `TIUD_*_PSC` triggers and api-pp caches shift definitions and palettes (Ehcache, 7-day TTI) — a definition
created in PEP after api-pp started stays unknown (first run: api-pp 404 "Shift definition with id 150 not found"; unified `/days`
404 for every day planned with 150, and on the PR bundle every block write of the palette's group 500 — N-O-1 / N-W-1).
In the execution order (after p) run ONE batch for every change of c, j, n, o, p:

```
scripts/sql.sh <id> -f scripts/seed/common/psc-batch.sql -D team_node=<team palette node> -D emp_ids=<employees whose PA_PIKETT step n.2 set>
```

(SHIFT_DEFINITION for 111–145, 150, 151, 770, 9102, 9103; SHIFT_DEFINITION_POLICY for every detail of 111–141, 150, 151, 9102, 9103;
SHIFT_DEFINITION_PALETTE for node 1 and the team node; DEFAULT_SETTING; EMPLOYMENT per id; ALLOWANCE_PROFILE, ALLOWANCE_TYPE;
ORGANIZATION_STRUCTURE — edit the code lists in the file if the run changed other codes). For a single later change:

```
scripts/sql.sh <id> "exec IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION', '150', null, null, null, null);
exec IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION', '770', null, null, null, null);
exec IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION_PALETTE', null, <team palette node id>, null, null, null);
COMMIT;"
```

(one SHIFT_DEFINITION line per created or changed definition — 25/57/60 too if their definitions were edited, not only moved
into the palette; one SHIFT_DEFINITION_PALETTE line per changed palette node; rights → `PERMISSION_ROLE`, done by rights.sql).
Verify with a unified `/days` read of an employee planned with the definition:
`DAYS=<days> EXPECT_DEF=150 node scripts/harness/mypp.mjs <id> <E2 login> groups/utr/scripts/harness/days-check.mjs results/<run>/gates/g4b`
→ `script.ok` true, and `available-shift-definitions` 200 for a team member (the W/MO writes depend on it). 150 and 151 are
planned only in step (s): run the `/days` checks there (family O repeats them in its Step 0 and stops with a blocker otherwise). Log the enqueue as kind `PSC-ENQUEUE` in `created/<agent>.jsonl`.

### (d) Prepared days (PEP Stempeleditor + flows), then (e) the seed-ZEITSUMME fix on the same day

Open the team's plan sheet: `scripts/pep.sh <id> menupath Datei "Planblatt bearbeiten"` → `TfrmKnotenwahlSperr` → node →
Weiter (this takes an edit lock on the node: close the sheet when done). Switch to the "Ist-Zeit Tag" view (Ctrl+0) so the
cells show PEP's credited value. Per stamped day:

```
groups/utr/scripts/pep/pe-open.sh <id> <row_y> <day_of_month>                       # Stempeleditor of the cell
scripts/pep.sh <id> flow create_stamp --param zeit=06:58
scripts/pep.sh <id> flow create_stamp --param zeit=16:05                 # next-day out-stamp: add --param datum=dd.mm.yyyy (~65 s)
scripts/pep.sh <id> flow stampeditor_commit                              # Übernehmen; confirms "Trotzdem planen"
scripts/pep.sh <id> --out <dir>/before-del.png screenshot 'class=TfrmPEPMain > class=TStampEditor'   # find the seed ZS row
groups/utr/scripts/pep/pe-del-zs.sh <id> <row_y of the seed 8:00 row>               # 526 after a commit, 538 night shift, 466 no stamps
scripts/pep.sh <id> flow stampeditor_commit
scripts/sql.sh <id> -f groups/utr/scripts/seed/verify.sql -D emp_ids=<MA_ID> -D from_day=<day> -D to_day=<day>
```

(`pe-del-zs.sh` row y values confirmed in run a1801 with the TStampEditor at its default origin 421,133; Löschen 1421,475.)
Other flows: `add_zeitsumme --param dauer=1:00 --param pa_code=-1 --param gutschrift=GLAZ` (−9 Fixer Saldo: `dauer=0:30
pa_code=-9`, account GLAZ by default), `add_block --param beginn=17:00 --param ende=18:00 --param pa_code=57 --param
kommentar="E2E R-06 ad-hoc"`, `stampeditor_commit --param button=OK` (save + close). Overpaint (absence over a planned day):
see [§ PEP coordinates](#pep-coordinates) "Painting". Re-interpretation: `groups/utr/scripts/pep/pe-reinterp.sh <id>`.

The realized plan (first run; PEP "Ist-Zeit Tag" after the fix = the oracle value):

| Emp | Day (first run)            | Planned      | Action (in order)                                                        | Rows created (verify.sql V1)                                       | PEP Ist                     | Scenario                  |
| --- | -------------------------- | ------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------- | ------------------------- |
| E1  | P0 (10-06, read-only past) | 111 Früh     | stamps 06:58 / 16:05, commit, delete seed ZS, commit                     | 2 MS + 2 AS stamps, block M 06:58–16:05 + paid pause b 09:30–09:45 | **9:07**                    | R-01                      |
| E1  | P1 (10-07)                 | 113 Mittel   | stamps 09:58 / 19:05, commit, delete seed ZS                             | pause 16:00–16:15                                                  | **9:07**                    | R-01 (in window)          |
| E1  | P2 (10-08)                 | 112 Spät     | delete seed ZS, ZS −1 1:00 GLAZ, ZS −9 0:30, commit                      | ZEITSUMME M/P ×2                                                   | **1:30**                    | R-10 / U22                |
| E1  | P3 (10-09)                 | 141 Nacht    | stamps 21:58 / 06:35 `datum`=P3+1, commit, delete seed ZS                | block 79080–110100, pause 03:00–03:30                              | **8:37**                    | R-08                      |
| E3  | P2 (10-08)                 | 141 Nacht    | add_block 17:00–18:00 PA 57 (+ kommentar), commit; seed ZS **kept**      | block m/A, no PLANUNG_ID                                           | **9:00** (8:00 seed + 1:00) | R-06                      |
| E4  | P1 (10-07)                 | 141 Nacht    | stamps 21:58 / 06:35 (+1), commit, delete seed ZS                        | pause 03:00–03:30                                                  | **8:37** (Soll 5:53)        | R-07                      |
| E2  | P1 (10-07)                 | 113 → **25** | paint 25 Ferien Monatslohn over the day (no stamps → no overplan dialog) | PLANUNG PA 25, ZEITSUMME A/A 30240                                 | **8:24**                    | R-03                      |
| E2  | P2 (10-08)                 | 112 Spät     | stamps 13:28 / 22:35, commit, delete seed ZS, Neu interpretieren         | interp. status R                                                   | **9:07**                    | R-04 (carve not achieved) |

Month totals of the run month in the PEP roster after these steps (first run, sanity reference only — the untouched days still
carry seed ZS rows): E1 Ist 76:21 / Soll 184:48; E3 81:00 / 184:48; E4 80:37 / 129:26; E2 81:31 / 184:48.

**(e) Seed-ZEITSUMME fix.** The seed writes one planned-credit ZEITSUMME per presence planning (`ZSTYPE A`, 28800 s, on a
presence Dienst; `DIENSTTYPE` is `A` on a fresh seed and becomes `P` after a PEP interpretation run). PEP never writes such a
row itself, and once the day is stamped both PEP and the cloud count it twice (first run: 17:07 in PEP / 1027 min in myPP =
8:00 + 9:07). Re-running interpretation (Tools → Interpretation) does not remove it. Fix = delete it in the Stempeleditor
(`pe-del-zs.sh`, commit) on every prepared presence day with stamps or manual Zeitsummen (E1 P0..P3, E4 P1, E2 P2). Keep it on
the auto-stamp day (E3: PEP generates no blocks for auto-stamp employees on past days, the seed row is their only credit).
Side effect: the day's `INTERPRETATION_STATUS` becomes `E`. Check: verify.sql **V2** lists only E3's day. Step (l) extends this
fix to every other presence planning of the must-stamp employees (SQL + reinterpretation).
Auto-stamp nuance (first run, MO-03 on the spare): for an **auto-stamp** employee the planned-credit row is legitimate product
behaviour — api-pp regenerates it after every block add/delete through myPP (new ZEITSUMME id, `DIENSTTYPE` A→P, same 8:00).
The seed defect is only that the row is also written for **must-stamp** employees, where it double counts once the day is
stamped. So: delete it on must-stamp prepared days, keep it on auto-stamp days, and expect new ids on auto-stamp write days.
SQL alternative (faster, NOT verified against PEP's numbers):
`delete from ECBERN.ZEITSUMME where ZEITSUMME_ID = <V2 ZS_ID>; commit;` — caveat: bypasses PEP's recalculation (Ist, saldo,
interpretation status), so open the day in the Stempeleditor afterwards, run `pe-reinterp.sh`, and compare the roster Ist with
the table above before trusting it. Unprepared days (all other employees, the write days) keep their seed rows: scenarios
that write there see the double count until the fix is applied to that day too.

### (f) Write-surface check

```
scripts/sql.sh <id> -f groups/utr/scripts/seed/write-days.sql -D emp_ids=<E1..E6 + spare> -D from_day=<R−7> -D to_day=<R−1>
```

Record per employee which write days are planned (PLAN), cross midnight (NIGHT `N`) and would endanger a fixture (RISK `NIGHT>FIX`: never write stamps there — copy NIGHT days and fixture days into `run-config.json` for `gen-prompts.py`), still carry a seed ZS (SEED_ZS 1 = double count once stamped), have
carry-over stamps (ST_CARRY) or are planning-less (`-`). First run: write days 10-12/10-13 planned for everyone (seed ZS
present), 10-10/10-11 weekend, 10-10 of E1 carries the night shift's out-stamp. No Pikett (150/151) planned yet: step (s)
paints E2's Pikett plannings (the O family only checks them).
Then verify.sql V3 (odd-stamp guard) over the whole window: expect no rows.

### (g) G5 fixtures (cloud view of every employee)

One call per login, the login written out literally (never a shell loop over a login list: zsh does not word-split an unquoted
variable, the whole list becomes one malformed username = a failed PolyID attempt; G-orch-9):

```
FROM=<roster start> TO=<roster end> DAY=<R−1> node scripts/harness/mypp.mjs <id> 'dmseed-<E1 kuerzel>' groups/utr/scripts/harness/baseline.mjs \
  results/<run>/fixtures/<id>/dmseed-<E1 kuerzel>
FROM=<roster start> TO=<roster end> DAY=<R−1> node scripts/harness/mypp.mjs <id> 'dmseed-<E2 kuerzel>' groups/utr/scripts/harness/baseline.mjs \
  results/<run>/fixtures/<id>/dmseed-<E2 kuerzel>
… (E3..E6, ES, ER the same way)
```

Sequential per environment, at most ONE retry per login. Each folder gets `api/*.json`, `api-index.jsonl`,
`baseline-summary.json` (status per endpoint and per-day credited/planned of the unified `/days`). Compare every prepared
day's unified `time_amounts.credited` with the PEP Ist ("Ist-Zeit Tag") of the table in (d) before any scenario starts —
this per-day comparison is the Phase 1 acceptance step, judged **per bundle class** (env-facts.md):

- `pre-1801`: credited = PEP Ist on every prepared day except E1 P2, where the cloud drops the −9 Fixer Saldo correction
  (credited 1:00 instead of PEP's 1:30, product defect **KD-1**, scenarios.md; R-12) — first run 7 of 8 matched.
- `1801`: a day matches when credited = PEP Ist, **or** credited = 2 × the day's real (non-preview) block span + its other credits
  (the spId-0 GLAZ projection = **F1**, expected for the class; run a1801: 18:14 vs 9:07, Kombi 19:30 vs 8:15, carve 18:00 vs
  9:00, E3 auto block 18:00 vs 9:00). Record such days as `F1 (expected)`; "7 of 8 matched" is not reachable on 1801.
- Anything else is a finding candidate, or a seed defect not fixed on that day: stop and investigate before Phase 2. Compare with the SQL oracle too: unified credited of a day = Σ `ZEITANRECHNUNG.ZEIT` with `AN_ZEITKONTO = 1`
  (oracles.md §5) — it equals PEP Ist and is faster to read than the plan sheet.
  Write the result to `results/<run>/pep-oracle.md` — the workers' oracle (the family briefs read it): one row per prepared day
  (role, MA_ID, day, Dienst, PEP Ist-Zeit Tag, cloud credited, match) and one row per employee for the run month (PEP roster Ist,
  Soll, GLAZ-Saldo at month end, read in the plan sheet / Zeitkonto). The api-gw roster-cell fixtures of gates.md G5 need the service
  client (`oracles.md` §1); when it is unavailable, these cloud fixtures plus `verify.sql` are the baseline.

### (h) Created-objects log

Every object created or deleted in Phase 1 (and by workers later) gets one JSON line in `results/<run>/created/<agent>.jsonl`:

```
{"env":"<id>","step":"d","kind":"STEMPEL","ids":[510,511],"auto":{"STEMPEL":[512,513],"BLOCK":[306,307]},"employee":480,"date":"2026-10-06","how":"create_stamp 06:58 + 16:05, stampeditor_commit","agent":"seed"}
```

`kind` ∈ `POLYUSRROLE_DETAIL`, `DIENST`, `DIENSTPALETTE`, `PSC-ENQUEUE`, `PLANUNG-OVERPLAN`, `PLANUNG-PIKETT`, `STEMPEL`, `BLOCK`, `ZEITSUMME`,
`ZEITSUMME-DELETED`; `auto` = rows PEP generated (pause stamps/blocks); ids from verify.sql V1 right after the step.
Fixture inventory: `verify.sql` V4 lists carves, no-account Kombi legs, standby blocks and manual Zeitsummen by employee/day/PA/time — save it at the end of Phase 1 and diff it after every writing family (a missing row = a lost fixture).
Cleanup: a DeployMate reseed / teardown deletes STEMPEL, BLOCK, ZEITSUMME and plannings of the seeded people
(`DELETEMITARBEITER`) and the marker-scoped definitions; DIENST 150, the palette additions and the role rows carry no
`DMSEED` marker and stay — remove them by hand if the environment is reused for something else.

## (i) Known seed defects and workarounds

| Defect                                                                                                                           | Effect                                                                                                                                                                                                                                                                                 | Workaround                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static planned-credit ZEITSUMME per presence planning                                                                            | double count on every stamped day, in PEP and in the cloud                                                                                                                                                                                                                             | step (e) on prepared days; mention it for write days; DM ticket candidate (use INSERTPLANTAG or no ZS for presence)                                                                             |
| Manifest login drift                                                                                                             | `manifest.loginUsers` (dmseed-ssch, …) does not match the DB seed except the first user                                                                                                                                                                                                | logins = `lower(POLYUSER.KUERZEL)` from audit A1                                                                                                                                                |
| Umlaut logins (dmseed-awüt, -cmül …)                                                                                             | PolyID pages declare no charset: the e-mail and the username are submitted as windows-1252 → blank page / unknown user                                                                                                                                                                 | the harness sends an ASCII e-mail (ü → ue) and re-encodes PolyID form bodies as UTF-8; prefer ASCII kürzel when choosing employees                                                              |
| 145 "DMSEED Ferien"                                                                                                              | in no palette and not usable for painting                                                                                                                                                                                                                                              | use 25 Ferien Monatslohn (step c)                                                                                                                                                               |
| Seed Dienste 111–141 (and 145) unknown to PEP — root cause of the next two rows                                                  | the seed writes DIENSTPALETTE / DIENST_DETAIL only at the Gruppe nodes (DM-122), never at the root `KNOTEN_ID = 1`; PEP's global Dienst list (`DIENST_ICONCACHE`) lacks them → empty plan cells on seeded days, "Dienst nicht planbar: 113" crash dialog, the dialogs reject the codes | step (j) R0; DeployMate bug ticket (emit root rows + icon-cache check)                                                                                                                          |
| PEP rejects presence PA codes in the Block and Zeitsumme dialogs                                                                 | 111/112/113/141/700/710/−1/−3 → "Der PA-Code ist nicht gültig!" in Neuer Block; 111–141 in Neue Zeitsumme                                                                                                                                                                              | after step (j) retry; until then ad-hoc block with absence code 57; manual Zeitsumme with system code −1 (Ungeplante Präsenz)                                                                   |
| Carve (R-04) refused in the first run                                                                                            | the parent block's PA 112 was unknown to PEP (row above); an inner stamp pair becomes a pause by design                                                                                                                                                                                | step (q) after (j); fallback the api-pp subblock write                                                                                                                                          |
| `HIERARCHIE.STAMM` NULL on every seeded node                                                                                     | api-pp `node.path` null → the classic day card crashes (`path.split`), C-01 UI                                                                                                                                                                                                         | step (k) `STAMMRECHNEN(1)` + ORGANIZATION_STRUCTURE PSC                                                                                                                                         |
| `PLANUNG.SOLLZEIT` unreduced for BG < 100 (rows inserted without P2 Modifypacode; BASIS/FAKTOR NULL)                             | month Geplant 8:00 instead of Sollzeit × BG (R-07, M-02)                                                                                                                                                                                                                               | step (m)                                                                                                                                                                                        |
| `MITARBEITER_DEFAULTS.PIKETTCODE` = 750 (no such Dienst) at the root, NULL at the team node; `MITARBEITER_DETAIL.PA_PIKETT` NULL | a stamp pair in a Pikett window becomes a PA −1 block linked to the Pikett → triggers KD-4 (O-01, O-04)                                                                                                                                                                                | step (n): Pikett-Einsatz PA 770                                                                                                                                                                 |
| Zulagenprofil slots NULL on every seeded `DIENST_DETAIL`; seed Lohnarten 10120/10121 credit no time account                      | blocks get `ZULAGEN_PROFIL` NULL, no CODEART 'C' row anywhere, `benefits` [] (R-09)                                                                                                                                                                                                    | step (p)                                                                                                                                                                                        |
| No Kombischicht, no windowed Pikett, no CODEART 'S' row                                                                          | R-02, O-02, X-02 not evaluable                                                                                                                                                                                                                                                         | steps (o), (n), (r)                                                                                                                                                                             |
| Auto-stamp employees get no generated blocks for past days                                                                       | E3's past days show only the seed ZS                                                                                                                                                                                                                                                   | R-05 reads the planned credit; W-02/W-03 write blocks themselves                                                                                                                                |
| PolyID brute-force detection                                                                                                     | a few failed logins lock the caller IP per OIDC provider (`account_locked`), no expiry                                                                                                                                                                                                 | never probe guessed usernames; the harness submits the password at most twice; unlock in the PolyID ops frontend (provider → Brute-force detection → applied policies → delete) or ask an admin |
| Paint sometimes ignored                                                                                                          | the first `drag_paint` after arming the palette did nothing (both boxes)                                                                                                                                                                                                               | check with SQL, repeat once                                                                                                                                                                     |
| Plan sheet lock                                                                                                                  | an open Planblatt holds an edit lock (SPERRUNG) on the node                                                                                                                                                                                                                            | close the sheet after the step                                                                                                                                                                  |
| Fixer Saldo (−9) not shown by the cloud (not a seed defect)                                                                      | E1 P2 credits 1:00 in myPP vs 1:30 in PEP                                                                                                                                                                                                                                              | product defect KD-1 (scenarios.md); keep the day                                                                                                                                                |
| `DIENST_ICONCACHE` not rebuilt by `UPDATE DIENST SET TITEL = TITEL`                                                              | R0 rows present but PEP still does not know 111–141                                                                                                                                                                                                                                    | re-save each definition in PEP (step j.2)                                                                                                                                                       |
| `MITARBEITER_DEFAULTS.PIKETTCODE` ignored for seeded employees                                                                   | Einsatz pair → PA −1 block (KD-4 trigger)                                                                                                                                                                                                                                              | `MITARBEITER_DETAIL.PA_PIKETT` + EMPLOYMENT enqueue (step n.2)                                                                                                                                  |
| PEP deferred repaint                                                                                                             | the next paint gesture also repaints the previously selected cell                                                                                                                                                                                                                      | one cell per gesture, close/reopen the sheet, SQL neighbour diff ("Painting")                                                                                                                   |
| Re-interpretation of D+1 after a stamp write on a night (PTC) or a replan                                                        | fixture blocks renumbered, a carve / manual block without stamps dropped (N-W-3)                                                                                                                                                                                                       | fixture-day protection (§ Dates); re-apply step q; identify fixtures by employee/day/PA/time, never by id                                                                                       |
| PEP and the pep-driver agent down after a box restart                                                                            | `pe-ready.sh` exit 4 "COLD START NEEDED", no `TfrmPEPMain`                                                                                                                                                                                                                             | cold start (§ 0): `PE_COLD_START=1 PE_USER=<login> scripts/pep/pe-ready.sh <id>`                                                                                                                |
| `settext` echoes text on readback errors                                                                                         | a password typed with `settext` can land in the transcript                                                                                                                                                                                                                             | use `type` for secrets                                                                                                                                                                          |
| pep-driver never deployed on a fresh box                                                                                         | `pep.sh <id> windows` → "no agent token on the box"                                                                                                                                                                                                                                    | `pe-ready.sh` cold start deploys once (§ 0)                                                                                                                                                     |
| PEP cold start launched a second PEP                                                                                             | with PEP down, the pinned taskbar icon starts pepwin; a second exec → two `TfrmKeycloakLogin` windows, `window*="Anmeldung"` ambiguous                                                                                                                                                 | `pe-ready.sh` clicks the taskbar only when PEP runs and counts login windows first (exit 5 on two: close one with `pep.sh <id> click 'window*="Anmeldung"[1] > button="Close"'`)                |
| IDM form not rendered after a fixed wait; first-run "Optionen" (`TPEPOptions`) dialog                                            | the old cold start typed nothing and exited 4                                                                                                                                                                                                                                          | `pe-ready.sh` polls up to 90 s, submits once, confirms Optionen                                                                                                                                 |
| Definitions re-save fails after the R0 SQL                                                                                       | "Es existiert keine Dienstdefinition mit dem PA-Code 111!" — PEP loads definitions at login                                                                                                                                                                                            | step (j): restart PEP between the SQL and the re-save                                                                                                                                           |
| `BLOCKZEIT_ENDE1` NULL on 151                                                                                                    | PEP writes only the start of the day-2 Blockzeit                                                                                                                                                                                                                                       | step (n.1) UPDATE before the PSC batch                                                                                                                                                          |

## Steps (j)–(s) — data gaps of the first run (j–r added 2026-10-15, s after run a1801)

Common rules: box-side DML is the orchestrator's (hard rule); log every row in `created/seed.jsonl` (new kinds `ROOT-ROW`,
`STAMM`, `DEFAULT-SETTING`, `SOLLZEIT`, `ZULAGE`, `ZEITANRECHNUNG-S`, `DIENST_DETAIL-FIX`, `PLANUNG-PIKETT`); in the execution
order the G4b lines of j, n, o and p run as ONE batch in step (c2) (`psc-batch.sql`) — the per-step lists below say what it covers; `<team node>` = the Pflege palette node of E1–E4 (A6, first
run 457), `<E2 node>` = E2's category node (first run 458). The **G4b gate** of each step = its `ENQUEUE_PERSISTENCE_STATE_CHANGE`
lines + COMMIT (api-pp `PersistenceType`: `SHIFT_DEFINITION (pa)`, SHIFT_DEFINITION_POLICY `(dienst_detail_id, knoten_id)`,
SHIFT_DEFINITION_PALETTE `(null, node)`, ORGANIZATION_STRUCTURE, DEFAULT_SETTING, EMPLOYMENT `(employment id)`, ALLOWANCE_PROFILE,
ALLOWANCE_TYPE; there is **no** type for plannings, Zeitsummen or ZEITANRECHNUNG — those are read live) followed by the step's read
check. Restarting api-pp flushes every cache at once (deploymate skill troubleshooting) if an enqueue does not take. A bundle with
APIPP-1884 (pp-services ≥ 0.0.1800) reloads a missing shift definition on a cache miss, but a **changed** definition still needs G4b.
Helper for SHIFT_DEFINITION_POLICY (all details of the listed codes):

```
BEGIN FOR d IN (SELECT DIENST_DETAIL_ID, KNOTEN_ID FROM ECBERN.DIENST_DETAIL WHERE PA_CODE IN (<codes>)) LOOP
  IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION_POLICY', d.DIENST_DETAIL_ID, d.KNOTEN_ID, null, null, null);
END LOOP; COMMIT; END;
/
```

### (j) R0 — make the seed Dienste PEP-plannable (prerequisite of W-06, R-04 and every PEP paint of 111–141)

Cause: the seed writes `DIENSTPALETTE` and `DIENST_DETAIL` for 111/112/113/141 only at the Gruppe nodes; PEP's global Dienst list
(`DIENST_ICONCACHE.INFO`) contains a code iff it has a root (`KNOTEN_ID = 1`) palette row (and an icon), so PEP does not know them
(empty plan cells on seeded days, "Dienst nicht planbar: 113 (uPlbOperation.pas, line 801)", Block/Zeitsumme dialogs reject the
codes). 145 has a root detail but no root palette row. Only rows are **added**; the Gruppe rows (needed by the interpreter, DM-122)
stay.

1. Root rows, with the paid pauses (one `sql.sh` call; copy source = the team node; idempotent):
   ```
   scripts/sql.sh <id> -f scripts/seed/common/r0-root-rows.sql -D team_node=<team node>
   ```
   It copies each source detail's `DIENST_BEZAHLTE_PAUSE` rows to the new root detail in the same block and prints `ROOT|`,
   `PAUSE|`, `PAL1|` rows (run a1801: details 1460–1463, pauses 1260–1263). If `SEQID_DIENST_DETAIL` is not the sequence name on
   the box, look it up (`SELECT SEQUENCE_NAME FROM ALL_SEQUENCES WHERE SEQUENCE_OWNER='ECBERN' AND SEQUENCE_NAME LIKE '%DIENST%'`).
   Then **restart PEP** (close pepwin, `PE_COLD_START=1 PE_USER=<login> scripts/pep/pe-ready.sh <id>`): PEP loads its definition
   set at login, so before the restart opening 111 in Definitionen › Dienst fails with "Es existiert keine Dienstdefinition mit
   dem PA-Code 111!" (`TfEuErrDialog`; run a1801).
2. PEP caches: the SQL no-op `UPDATE ECBERN.DIENST SET TITEL = TITEL …` does **not** rebuild `DIENST_ICONCACHE` (no trigger fires
   for it; verified 2026-10-15). Instead re-save each definition unchanged in PEP: Definitionen › Dienst (root node) › double-click
   the code → `TfrmEditDienstGlobal` → OK, for 111, 112, 113, 141 and 145; then OK on `TfrmDienstMain`. PEP writes its default
   144-byte icon and bumps the cache version. For 145 that final OK opens **`TfrmGuthabProfilErg`** ("Guthabenprofil: Ergänzen des
   Feldes 'Mitarbeiter-ML-SL'"): set the Auswahl from "Bitte wählen" to **"für Monats- und Stundenlohn"** (MITARB_ML_SL 2, as on
   the other boxes), OK — PEP then writes the forced GUTHABENPROFIL row. Then **restart PEP again** (same cold-start command).
   Order: SQL → restart → re-save → restart.
3. G4b: `SHIFT_DEFINITION` for 111, 112, 113, 141, 145; the SHIFT_DEFINITION_POLICY helper for `111,112,113,141`;
   `SHIFT_DEFINITION_PALETTE` for node 1 and `<team node>`; COMMIT.
4. Verify (this is also the falsification test of the root-cause inference): `SELECT DBMS_LOB.INSTR(INFO,'pacode="113"') FROM
ECBERN.DIENST_ICONCACHE` > 0 (same for 111/112/141); the plan sheet now paints the seeded plannings (screenshot); painting 113
   on a free cell raises no "Dienst nicht planbar" (undo it); `available-shift-definitions` 200 for a team member; `days-check.mjs`
   with `EXPECT_DEF=111` on a seeded day → `script.ok` true. If the icon cache contains the codes but PEP still refuses them, stop
   and report — the inference is wrong. Alternative without SQL: create fresh presence definitions in PEP's Dienstdefinition editor
   (PEP writes root + group rows itself), then use those instead of 111–141 in W-06.

### (k) Org-structure path (`HIERARCHIE.STAMM`) — C-01

The seed inserts HIERARCHIE rows without `STAMMRECHNEN`; all seeded nodes have `STAMM` NULL (baseline nodes are fine) → api-pp
`node.path` null → classic card crash. No trigger fills it.

```
scripts/sql.sh <id> "exec ECBERN.STAMMRECHNEN(1);
COMMIT;
exec IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('ORGANIZATION_STRUCTURE', null, null, null, null, null);
COMMIT;"
```

Verify: `SELECT COUNT(*) FROM ECBERN.HIERARCHIE WHERE STAMM IS NULL` → 0 (or only nodes outside the tree); `SELECT KNOTEN_ID, STAMM
FROM ECBERN.HIERARCHIE WHERE KNOTEN_ID = <E1 node>` shows "… / … / … / <node name>". **Gate** (`node.path`): the C family's first
classic read (`GET /api/mobile/time-recording/v1/days?day=`, after the LEGACY switch) must show `shift.node.path` non-null — else
C-01 UI is BLOCKED "step (k) not effective". Hard-reload myPP after the enqueue.

### (l) Remove the seed planned-credit ZEITSUMME from the must-stamp employees (C-02, M-01 absolute values)

Step (e) fixes the prepared days through PEP. PEP never writes a `ZSTYPE A` Zeitsumme for a presence planning of a must-stamp
employee, but the seed does on every planning (first run: 48:00 of E1's PEP month Ist 76:21). Remove it on every remaining
presence planning of the must-stamp test employees (E1, E2, E4, E5, E6, ER; never the auto-stamp E3 / ES, where the row is the
legitimate credit api-pp regenerates); absence Zeitsummen (`DIENST.TYP = 'A'`, e.g. E2's 25 Ferien day) stay:

```
scripts/sql.sh <id> "DELETE FROM ECBERN.ZEITSUMME z WHERE z.ZSTYPE = 'A'
  AND z.PA_CODE IN (SELECT PA_CODE FROM ECBERN.DIENST WHERE TYP = 'P')
  AND z.MITARBEITER_ID IN (<must-stamp ids>)
  AND z.DATUM BETWEEN DATE '<roster start>' AND DATE '<roster end>';
COMMIT;"
```

Then rebuild ZEITANRECHNUNG — **never re-interpret a day that carries fixtures** (P0..P3, the Kombi, the carve, the R-06 ad-hoc
block, any P2-painted prepared day: interpretation rebuilds blocks from stamps and drops what has no stamp source, N-W-3):
PEP Tools → Interpretation in bulk only over a date range that contains no fixture day of any employee of the chosen node
(run a1801: 13.10–22.10 for "Pflege Chirurgie", 09.10–22.10 for the ER node), and `pe-open.sh` + `pe-reinterp.sh` per day for
the remaining non-fixture days inside the fixture range (run a1801: 7 days of 482/484/486/488). Running (l) before (d) would avoid
the conflict (unverified). Interpretation dialog facts: Umfang… is a node picker only (no per-employee choice) and cancelling it
disabled the whole dialog (close and reopen it); the TECDateEdit date fields refuse `type` / `settext` (the internal value stays
invalid → modal "Datum … nicht gültig" loop) — what works: click the field, `scripts/pep.sh <id> keys {HOME}`, then
`scripts/pep.sh <id> keys 13102026` (ddmmyyyy). A pep-driver flow `interpret_range` is a candidate. Side effect of the bulk interpretation on the unit: other employees' seed ZS flip `DIENSTTYPE`
A→P (harmless, note it in the gate). Afterwards today / future plannings of the must-stamp employees carry PEP's planned
pre-credit in ZEITANRECHNUNG (CODEART P) — shown as 0:00 by pre-1801 bundles (KD-7). No G4b type exists (journal read live). Verify: verify.sql V2 → only auto-stamp rows; the SQL
oracle (oracles.md §5) gives 0:00 GLAZ on an untouched must-stamp planning day and the stamped credit on stamped days; PEP Ist of
one untouched day 0:00; unified `/days` of that day credited 0:00. Consequence for the briefs: must-stamp write days no longer carry
the 8:00 seed credit (expected credited after a write = what was added).

### (m) BG-reduced `PLANUNG.SOLLZEIT` for E4 (R-07, M-02)

E4 (BG < 100, `TEILZEIT_STUNDENREDUKTION = 2`, Dienst `STUNDENREDUKTION = 'T'`, `SOLLZEIT_AUS_KALENDER = 'F'`) should have
`SOLLZEIT` = DIENST Sollzeit × BG (8:00 × 0.70 = 5:36 = 20160 s); the seed wrote 28800 with BASIS/FAKTOR NULL. After step (j):

1. P2 path (proof + factor format): in PEP repaint ONE untouched E4 presence day that no scenario reads (a future roster day) with
   the same Dienst (delete + repaint). Read it: `SELECT PLANUNG_ID, SOLLZEIT, SOLLZEIT_BASIS, SOLLZEIT_FAKTOR, SOLLZEIT_AUS_KALENDER
FROM ECBERN.PLANUNG WHERE MITARBEITER_ID = <E4> AND DATUM = DATE '<day>'` → expect 20160 / 28800 / <factor>. If SOLLZEIT stays
   28800, stop: the BG configuration is not what the investigation read — R-07/M-02 BLOCKED with the row as evidence.
2. Align the other E4 plannings of the window (including the stamped prepared day; repainting it could disturb its stamps):
   ```
   UPDATE ECBERN.PLANUNG SET SOLLZEIT_BASIS = SOLLZEIT, SOLLZEIT = ROUND(SOLLZEIT * <BG>/100), SOLLZEIT_FAKTOR = <factor of 1.>
    WHERE MITARBEITER_ID = <E4> AND DATUM BETWEEN DATE '<roster start>' AND DATE '<roster end>' AND SOLLZEIT_BASIS IS NULL
      AND PA_CODE IN (SELECT PA_CODE FROM ECBERN.DIENST WHERE TYP = 'P');
   COMMIT;
   ```
   (or repaint every untouched day in PEP, the real path). E4's seed ZS rows are gone after step (l).
3. G4b: none applicable (`plannedWorkTime` is read from PLANUNG through JPA; no PersistenceType for plannings). Gate = unified
   `GET /reports/month` for E4: every planning row `planned` 5:36, `summary.planned` = n × 5:36 (first run 10 → 56:00). If a row
   stays 8:00, open that day in the PEP Stempeleditor and `pe-reinterp.sh`, then re-read.
4. Optional (rule 4 / E4b): a must-stamp vs auto-stamp BG pair — an auto-stamp part-timer shows no reduction for presence shifts
   (BG doc "Problematik").

### (n) Windowed Pikett 151 + Pikett-Einsatz PA code 770 (O-01, O-02, O-04)

1. PEP › Definitionen › Dienst at the root node, Pikett tab, "+": Typ Pikett, PA **151** "UTR Pikett Block", Sollzeit 0:00,
   Gutschrift GLAZ, Zeitraster Block 1 with **Gleitzeit and Blockzeit** 18:00–07:00 (Tag 2)
   (`groups/utr/scripts/pep/pe-newblock.sh <id> 18 00 07 00 --day2 --autosync --no-ok`, check, OK; then the autostamp row › Detail… →
   `TBlockIntervalEdit` → tick "Gleit- und Blockzeiten synchronisieren" → OK — [§ Dienst wizard](#dienst-wizard-steps-c-n-o)), valid
   from the first day of the run month; add 151 to the `<team node>` palette. Expected rows: `DIENST_DETAIL` 151 with
   `BLOCKZEIT_START1 = 64800`, `BLOCKZEIT_ENDE1 = 111600`, `BLOCK1_PA_CODE = 151`. Keep 150 as the windowless Pikett.
   **PEP leaves `BLOCKZEIT_ENDE1` NULL** even with the 18:00–07:00 (day 2) block and Gleit/Block sync (run a1801, m2 and the PR
   env). Fix it before the PSC batch (c2) and log it (kind `DIENST_DETAIL-FIX`):
   `UPDATE ECBERN.DIENST_DETAIL SET BLOCKZEIT_ENDE1 = 111600 WHERE PA_CODE = 151 AND BLOCKZEIT_START1 = 64800 AND BLOCKZEIT_ENDE1 IS NULL; COMMIT;`
   **Autostamps 18:00–07:00 (+1) with Gleit/Block sync** on the block: P2 builds the standby (planned-layer) block only when the
   definition block has autostamps (`PACKAGE_DIENSTPLANUNG` ≈ l.589). Then a 151 planning gets BLOCK PA 151 64800–111600 and two AS
   stamps (18:00 on the day, 07:00 next day — one legit pair across midnight: baseline `ACTIVE|` 1 on both days) and the standby
   credits **13:00** GLAZ = O-02's oracle (not 0:00).
2. Pikett-Einsatz PA code (PREREQ doc: the on-call recording uses a non-plannable presence PA code, set globally): PEP ›
   Definitionen › Standardeinstellungen, root node and `<E2 node>`: "Pikett-Einsatz-PA-Code" = **770** (Piketteinsatz,
   `PIKETTZUSATZ T`). SQL equivalent: `UPDATE ECBERN.MITARBEITER_DEFAULTS SET PIKETTCODE = 770 WHERE KNOTEN_ID IN (1, <E2 node>);`
   (insert the node row if it is missing). **The default applies only to NEW employees**: the seeded test employees also need
   `UPDATE ECBERN.MITARBEITER_DETAIL SET PA_PIKETT = 770 WHERE PA_PIKETT IS NULL AND MITARBEITER_ID IN (<test employees of the node>);`
   COMMIT, plus one `('EMPLOYMENT', '<id>', null, null, null, null)` enqueue per employee (the `TIUD_MITARBEITER_DETAIL_PSC` trigger is
   missing on DeployMate boxes). Without it an Einsatz stamp pair in a Pikett window is written with PA −1 (the KD-4 trigger shape).
   Log the old values (root 750, node NULL, PA_PIKETT NULL on the first run).
3. G4b: `SHIFT_DEFINITION` 151; the SHIFT_DEFINITION_POLICY helper for `151`; `SHIFT_DEFINITION_PALETTE` `<team node>`;
   `('DEFAULT_SETTING', null, null, null, null, null)`; `('EMPLOYMENT', '<id>', null, null, null, null)` per employee whose PA_PIKETT was set.
   Read check: `available-shift-definitions` 200; after family O painted 151, `days-check.mjs EXPECT_DEF=151` → `script.ok` true.
4. Gate SQL right after the first 151 planning exists (family O Step 0): `SELECT BLOCK_ID, PACODE, BLOCKART, PLANUNG_ID, STARTTIME,
ENDTIME FROM ECBERN.BLOCK WHERE PLANUNG_ID = <151 planning>` → a block 64800–111600 with PACODE 151 (the standby mirror). None →
   O-02 BLOCKED per scenarios.md (Pikett type cannot carry planned blocks on this version; NEON question).
5. Oracle step after the first stamp pair on a Pikett day (O-01 / O-04): the pair's `BLOCK.PACODE` = 770 expected; −1 with a
   `PLANUNG_ID` = the KD-4 trigger even with the code configured — report it for the KD-4 ticket.

### (o) Kombischicht 9102 + leg 9103 (R-02)

1. PEP Dienstdefinition editor (Definitionen ▸ Dienste, like 150; [§ Dienst wizard](#dienst-wizard-steps-c-n-o)): **9103 "UTR
   Kombi-Leg ohne ZK"** typ P, "nicht planbar", credit account "ohne Zeitkonto" (`AN_ZEITKONTO -1`: on the Zeitanrechnung page the
   Gutschrift combo's **blank** entry); **9102 "UTR Kombi"** typ P, Sollzeit 8:15, Zeitraster 3 blocks 07:00–11:00 / 11:00–14:00 /
   14:00–18:15 (`groups/utr/scripts/pep/pe-newblock.sh <id> 07 00 11 00 --no-ok` — clear the prefilled Pause row of block 1 with `settext ""`
   on its two edits, OK — then `pe-newblock.sh <id> 11 00 14 00` and `… 14 00 18 15`), Block 2 › Detail… ("Block 2 - Allgemein",
   `TBlockIntervalEdit`) PA code **9103**, block PA codes 9102 / 9103 / 9102, Blockwechseldauer 0, GLAZ, Korrekturen page
   "Stempel generieren gemäss" = **"Ende/Beginn Blockzeit"** (the planning procedure credits each block with the Anrechnung of its
   own block PA, `PACKAGE_DIENSTPLANUNG`). Add both to the `<team node>` palette (PEP writes root + group rows itself). SQL
   alternative: DIENST + DIENST_DETAIL at nodes 1 and `<team node>` + DIENSTPALETTE at both — prefer PEP.
2. G4b: `SHIFT_DEFINITION` 9102 and 9103; the SHIFT_DEFINITION_POLICY helper for `9102,9103`; `SHIFT_DEFINITION_PALETTE` 1 and
   `<team node>`.
3. Kombi day: a free past weekday of a must-stamp employee of E1's team that no other scenario reads — E1's P0..P3 and the write
   days are taken, so first choice **E2 `P0`** (record the choice in `employees.md` as `KOMBI_EMP` / `KOMBI_DAY`). Paint 9102 over
   the seed planning (no stamps → no overplan dialog), then `create_stamp` 07:00 and 18:15, `stampeditor_commit`; delete the seed ZS
   of the day if step (l) did not already.
4. Verify: `SELECT PACODE, AN_ZEITKONTO, STARTTIME, ENDTIME FROM ECBERN.BLOCK WHERE MITARBEITER_ID = <emp> AND DATUM = DATE '<day>'`
   → the 11:00–14:00 block with `AN_ZEITKONTO = -1`; PEP Ist 8:15 (span 11:15); SQL oracle Σ GLAZ = 8:15. Add the row to
   `pep-oracle.md`. Cost ≈ 1–1.5 h manual (no pep-driver "create Dienst" flow yet).

### (p) Allowances: Zulagenprofil slots + a time-crediting Lohnart (R-09)

1. Profile slots on the seed details (all nodes):
   `UPDATE ECBERN.DIENST_DETAIL SET MONATSLOHN_ZULAGENPROFIL = 1, STUNDENLOHN_ZULAGENPROFIL = 1, MOD_MONATSLOHN_ZULAGENPROFIL = 1,
MOD_STUNDENLOHN_ZULAGENPROFIL = 1 WHERE PA_CODE IN (111,112,113,141); COMMIT;` (log the old NULLs).
2. A Zulage that credits a separate time account: copy profile 1's night `ZULAGENABSCHNITT` rows (Lohnart 10120, 20:00–24:00 =
   72000–86400 and 00:00–06:00 = 0–21600, day categories 1–5) with `CCODE` **10080** "Zeitgutschrift Nacht 10%" (→ Zeitkonto 214),
   valid from 2000-01-01 (`DESC ECBERN.ZULAGENABSCHNITT` first for the key column / sequence). Fallback (mutates a seed Lohnart, log
   and restore the old values): `UPDATE ECBERN.LOHNART_DETAIL SET ZEITKONTO_ID = 214, FAKTOR = 0.1 WHERE CCODE = 10120`.
3. G4b: the SHIFT_DEFINITION_POLICY helper for `111,112,113,141`; `SHIFT_DEFINITION` 111..141; `SHIFT_DEFINITION_PALETTE`
   `<team node>`; `('ALLOWANCE_PROFILE', null, null, null, null, null)`; `('ALLOWANCE_TYPE', null, null, null, null, null)`.
4. Reinterpret E1's stamped night day (P3, 141, 21:58 / 06:35): `pe-open.sh` + `pe-reinterp.sh` — the blocks must be re-created to
   pick up `ZULAGEN_PROFIL = 1`. verify.sql V1: same stamps, blocks re-created, PEP Ist unchanged (8:37).
5. Verify: `SELECT CODE, AN_ZEITKONTO, ZEIT FROM ECBERN.ZEITANRECHNUNG WHERE MITARBEITER_ID = <E1> AND ZA_DATUM = DATE '<P3>' AND
CODEART = 'C'` → 10080 / 214 / ≈ 0:51 (10 % of the night overlap net of the pause); unified `/days` of P3: a `benefits[]` entry,
   credited unchanged. Record the amount in `pep-oracle.md` (R-09's oracle). **Status 2026-10-16**: on both boxes the
   re-interpretation set `BLOCK.ZULAGEN_PROFIL = 1` but wrote no CODEART 'C' row → verification fails, R-09 BLOCKED pending the
   NEON answer ("which step computes Zulagen on this build?"); keep the step, record the outcome.

### (q) Carved absence sub-block (R-04), after step (j)

On `CARVE_EMP` / `CARVE_DAY` (default E2's stamped prepared day P2, 112 Spät, stamps 13:28 / 22:35; record the choice in
`employees.md`). Day rule (fixture-day protection): the previous day of that employee must not be a night or Pikett window any
family writes stamps on — master-1822 carved E1 10-14 after E1's 10-13 night and lost the carve twice (N-W-3). (a) PEP
Stempeleditor (`pe-open.sh`), select the presence block, **Neu… ▸ Absenz…** ("Neue Absenz", `TStampEditorBlock`): Beginn / Ende one
hour inside the block (e.g. 15:00–16:00 in a Spät, 10:00–11:00 in a Früh), PA-Code **57**, Kommentar "E2E R-04 carve", Gutschrift
GLAZ → OK → Übernehmen → "Planungskonflikt" (`TRegelverstossForm`) → Trotzdem planen → Abbrechen if Übernehmen is greyed
(verified 2026-10-16; "Neu ▸ Block" with 57 is not the path). (b) If PEP still refuses: one api-pp write
`POST /pp-api-personnel-planning/api/v2/write/timerecording/counted-adjustment/subblock?roster-cell-id=<PE id>&shift-block-id=<presence
block>&shift-definition-id=57&start-time=<D>T15:00&end-time=<D>T16:00` with a service token of client
`polypoint-p4-api-personnelplanning` (oracles.md §1; the classifier may refuse reading that secret — ask the operator for a permission
rule, never persist it). On the PR bundle this write runs through the PR's counted-layer code: say so in the A/B notes. Verify:
`BLOCK.MAINBLOCK_ID` = the presence block, `PACODE = 57`, `BLOCKART i`; two journal records (presence, absence 1:00); the new PEP Ist goes to
`pep-oracle.md` as R-04's oracle. No G4b (57 is in the palette since step c). Neither way works → R-04 BLOCKED with both outcomes;
NEON question "how does a planner carve an absence sub-block in the P2 Stempeleditor?".

### (r) Optional, reversible: one `ZEITANRECHNUNG` row with `CODEART 'S'` (X-02) — only with explicit approval

Nothing on-prem writes 'S' (production writer unknown — NEON question), so the row is synthetic:

```
scripts/sql.sh <id> "BEGIN ECBERN.ADDZEITANRECHNUNG(<PE id of E4's prepared day>, <its planning's KNOTEN_ID>, <E4>, DATE '<day>', 10120,
  'S', 'F', -1, -1, 0, 1800, 'e2e X-02'); COMMIT; END;
/"
```

Read `/days` and `/reports/month` of E4 on both envs (master 200; candidate 500 = F2), then delete it:
`DELETE FROM ECBERN.ZEITANRECHNUNG WHERE KOMMENTAR = 'e2e X-02'; COMMIT;` and re-read 200. No G4b (journal read live). Log both
in `created/X.jsonl` (`kind ZEITANRECHNUNG-S`, `cleaned true`).

### (s) E2's Pikett plannings for family O (orchestrator; after f, before g)

Workers never paint (run a1801: a Sonnet worker driving `pe-paint.sh` was the riskiest step of the run). Write the day map first
(`python3 -I scripts/gen-prompts.py results/<run>/run-config.json --print-day-map`, O's E2 rows), then paint one cell per gesture
with `pe-paint.sh` ([§ PEP coordinates](#pep-coordinates) "Painting"; PEP lock, `pe-ready.sh`; Pikett definitions under the palette
radio "Pikett", hover and read the tooltip first):

| E2 day (day map) | Planning                                                                                                      | For                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `WE1`            | Pikett **150** only                                                                                           | O-03                         |
| `WE2`            | Pikett **151** only (its autostamps build the standby mirror block 18:00–07:00 + one AS pair across midnight) | O-02, O-01                   |
| `WD1`            | 25 Ferien Monatslohn over the presence planning, then Pikett 150                                              | O-04                         |
| `WD2`            | Pikett 150 next to the presence planning                                                                      | O-05, W-04, P-04, C-05, C-07 |
| `TODAY`          | Pikett 150                                                                                                    | O-06, W-10                   |

Pick E2's days (per-employee override `families.O.days.E2` in `run-config.json`) so that none of them is a 141 night planning:
PEP may refuse a Pikett overlapping a Nacht (run a1801: TODAY was E2's 141 night). Then: G4b read checks as E2 —
`DAYS=<WE1>,<WD2>,<TODAY> EXPECT_DEF=150 node scripts/harness/mypp.mjs <id> '<E2 login>' groups/utr/scripts/harness/days-check.mjs results/<run>/gates/g4b-150`
and the same with `DAYS=<WE2> EXPECT_DEF=151` → `script.ok` true; gate (n.4) on the 151 planning (standby mirror block). Log each
planning in `created/seed.jsonl` (kind `PLANUNG-PIKETT`, `cleaned: false`; they stay for P-04 / C-05 / C-07). When the run
continues on a later day R′, paint the Pikett for the new TODAY in the daily pre-flight (groups/utr/references/runbook.md "Day map and date shift").

## PEP coordinates

The `scripts/pep/pe-*.sh` helpers and the paint commands use screen coordinates for **PEP at 1920×1080, default roster layout,
one team plan sheet open, month view, no zoom; Stempeleditor at its default 1078×766 size**. Measured 2026-10-14, identical on
two boxes. **Verify with a screenshot first** (`scripts/pep.sh <id> --out <file> screenshot`) and override via environment.

| What                                                         | Value                                                                | Override                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------- |
| Roster cell x of day-of-month d                              | `215 + (d−1)·25`                                                     | `PE_X0`, `PE_DX`                   |
| Roster row y of the n-th employee of the sheet (n = 0 first) | default view `259 + n·25`; "Ist-Zeit Tag" view (Ctrl+0) `259 + n·41` | argument                           |
| Palette radio "Ganz"                                         | `class=TfrmPEPMain > radio="Ganz"` (≈ 104,99)                        | —                                  |
| First absence icon (25 after step c)                         | ≈ 192,135 — read the tooltip before painting                         | argument                           |
| Blöcke grid: row x / Löschen button                          | 491 / 1421,475                                                       | `PE_ROW_X`, `PE_DEL_X`, `PE_DEL_Y` |
| "Neu interpretieren" (Stempeluhr tab)                        | fraction 0.93 / 0.464 of `TStampEditor`                              | `PE_REINT_FX`, `PE_REINT_FY`       |
| Flow-internal fractions ("Neu…", "Stempeln", popup items)    | defaults in `groups/utr/scripts/seed/flows/*.py`                     | `--param neu_fx=…` etc.            |

Helpers: `pe-open.sh <id> <row_y> <day>` (cancel an open Stempeleditor, open the cell), `pe-del-zs.sh <id> <row_y>` (Blöcke tab:
select row, Löschen → Ja; confirm screenshot to `$PE_OUT`), `pe-reinterp.sh <id>` (Neu interpretieren → OK → commit),
`pe-shots.sh <id> <outdir> <label:row_y:day> …` (Blöcke-tab screenshot per prepared day, the PEP evidence of the oracle table).

Painting (first run: icon 192,135, cell 362,358). Helper: `NEIGHBOURS=<ids> PE_OUT=<dir> scripts/pep/pe-paint.sh <id> <emp> <day> <pa> <radio_y> <slot_x> <slot_y> <row_y>` implements the rule below (exit 0 ok, 3 dialog, 4 unexpected change, 5 neighbour changed). **One cell per gesture**: PEP repaints the previously selected cell with the
newly armed Dienst on the next gesture (deferred repaint). Before painting save a SQL snapshot of the plannings around the target
(test employees of the sheet, target ±2 days); paint one cell; check the target by SQL and repeat the drag only if nothing changed;
close and reopen the plan sheet (Datei › Planblatt bearbeiten › node › Weiter); snapshot again and diff — the only allowed change is
the target cell, anything else → stop, no repaint, report. A dialog during the paint → screenshot, do not auto-confirm. Disarm with
the palette radio, not `keys {ESC}` (PEP minimised itself once). Pikett definitions sit under the palette radio "Pikett"; hover a slot
and read its tooltip before arming.

```
scripts/pep.sh <id> click 'class=TfrmPEPMain > radio="Ganz"'
scripts/pep.sh <id> clickxy <icon_x> <icon_y>                    # arm; screenshot to confirm the tooltip
scripts/pep.sh <id> flow drag_paint --param x=<cell_x> --param y=<cell_y> --param wiggle=6
scripts/pep.sh <id> dialogs                                       # TfrmPlanOptionen only when the day has stamps: verify, OK
```

An armed palette turns clicks inside the Stempeleditor timeline into blocks: disarm before opening a Stempeleditor.

## Dienst wizard (steps c, n, o)

Click sequence of PEP's definition wizard as driven in run a1801 (1920×1080; coordinates are that run's — screenshot first).
Control auto-ids change with every wizard instance: find edits by `pep.sh <id> tree '<dialog>' --depth 12` + their rect, never
by a remembered id.

1. `scripts/pep.sh <id> def Dienst` → node picker `TfrmKnotenwahl` → the **root node** ("Firmenname") for a new definition, the
   team node for palette changes → Weiter → `TfrmDienstMain` ("Dienst- und Dienstpalettendefinitionen"; tabs Präsenz ≈536,366,
   Absenzen ≈596,366, Pikett ≈646,366; "+" ≈616,333 opens the wizard `Tf_def` "Dienstdefinition").
2. Pages, each left with `button="Weiter"` (`class=TfrmPEPMain >> class=Tf_def`): **Global** (PA code = the `TIntEdit`,
   Bezeichnung = the first `TEdit`; checkbox "nicht planbar" for 9103) → **Zeitanrechnung** (Sollzeit = a `TTimeEdit` pair, hour
   and minute; Gutschrift combo: GLAZ, or the blank entry = "ohne Zeitkonto" for 9103) → **Planungsregeln** → **Zeitraster /
   Stempel** → **Korrekturen** (9102: "Stempel generieren gemäss" = "Ende/Beginn Blockzeit") → `button="OK"` finishes the wizard.
3. Zeitraster blocks: `groups/utr/scripts/pep/pe-newblock.sh <id> <bh> <bm> <eh> <em> [--day2] [--autosync] [--no-ok]` — Neu… › Block… opens
   `TBlockIntervalNew`. A **Präsenz** block dialog has Zeitblock + Pause rows and no sync box; a **Pikett** block dialog has the
   "Autostempel sync." box and a day-2 toggle right of the Ende field (run a1801: 1050,510); the dialog differs between the two.
   Pikett 151: after the block, the autostamp row › Detail… (≈1312,378) opens `TBlockIntervalEdit` → tick "Gleit- und Blockzeiten
   synchronisieren" → OK. Kombi 9102: Block 2 › Detail… → `TBlockIntervalEdit` "Block 2 - Allgemein" → PA code 9103 → OK.
4. Back in `TfrmDienstMain`: OK commits (re-saving 145 opens `TfrmGuthabProfilErg`, step j.2). Palette: open `def Dienst` on the
   team node, select the definition in its tab and add it to the palette, OK; verify with audit A6 / `DIENSTPALETTE`.
   A pep-driver flow `create_dienst` would replace this; until then expect 1–1.5 h for c + n + o by hand.

## Flows (`groups/utr/scripts/seed/flows/`)

`create_stamp`, `stampeditor_commit`, `add_zeitsumme`, `add_block` were written and live-verified during the first run in the
pep-driver checkout (uncommitted there) and are copied here so the skill is self-contained; they import pep-driver's
`flows/_base.py` and must run inside pep-driver (`pep.sh <id> push-seed-flows`). They supersede the provisional
`create_block` / `create_zeitsumme` selectors. **Contribute them to pep-driver** (then `push-seed-flows` finds identical files
and only pushes). Compared against a pep-driver checkout on 2026-10-22: the four files differ from pep-driver's copies only in
their docstrings (the box name), so `push-seed-flows` prints "pep-driver has a different version, kept it" and pushes
pep-driver's copy — expected (run a1801: all four worked that way). Make them identical upstream to silence it.
