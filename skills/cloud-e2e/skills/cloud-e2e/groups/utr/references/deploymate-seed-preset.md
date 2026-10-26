# DeployMate seed preset `utr-time-recording`: proposal

Agent C, UTR time-recording E2E effort, 2026-10-14. Read-only investigation. Nothing was changed in DeployMate.

Path roots used below:

- `DM/` = DeployMate clone `scratchpad/deploy-mate-src/deploy-mate` (HEAD `2c9a149`)
- `DL/` = `DM/tools/data-loader`
- `KT/` = `DM/deploy-mate-api/src/main/kotlin/ch/polypoint/deploymate`
- `PLAY` = `DM/deploy-mate-api/src/main/resources/ansible/plays/component-deploymate-seed.yml`
- `PPS/` = on-prem monorepo checkout `~/dev/polypoint/pp-services` (used for api-pp and DB facts; it may not match the 26.99 env build exactly)

> **Corrections learned after this spec (2026-10-15/16, master-1822; the skill seeds itself, this spec is reference only)**: a Pikett that should carry a standby block needs autostamps on its definition block (P2 builds the block only then; standby credits GLAZ); `PA_PIKETT` must be set on `MITARBEITER_DETAIL` of seeded employees (`MITARBEITER_DEFAULTS.PIKETTCODE` applies to new employees only) and needs an EMPLOYMENT PSC event; root palette / detail rows alone do not make PEP know a definition — PEP's icon cache must be rebuilt by re-saving the definition in PEP; a carved absence is lost when its day is re-interpreted (keep fixture days away from written nights); X-03 (dangling allowance profile) stays a transient run-time step, as below.

---

## 0. Summary

- The seed engine is a **Python loader** (`DL/`). It is built from YAML layers and Python recipes, writes to Oracle (plus Keycloak and REST sinks) in **one transaction per run**, and is run on the env VM by an Ansible play. Kotlin only chooses the stack file and passes env vars. A new preset needs four things: a stack YAML, new layer YAMLs and recipes, a `Scenario` entry in `SeedScenarioCatalog.kt`, and a mirror entry in the SPA `types.ts`.
- **Why `time-recording-modes`, `people-deepening` and `shift-schedule` show 0 rows:**
  - The first two **contain only UPDATE steps**. The engine records no output rows for UPDATE steps, so the count is 0 even though they ran. The live DB confirms they ran: AUTO_ZEITSTEMPEL alternates and the BG values are spread out.
  - `shift-schedule` is a **REST layer that is switched off**. `INCLUDE_REST=false`, and the play never sets `APIPP_URL` or `KC_PP_SECRET`.
  - In addition, the manifest is built from an offline dry-run, not from live counts.
- **The hard part is interpretation, not the rows.** For any day before today, PEP marks the day for re-interpretation (`BRAUCHTNACHINTERPRETATION` returns `'T'` for `dat < TRUNC(SYSDATE)`). The Delphi engine (PEP client or PolyTimeConnect) turns STEMPEL into BLOCK, ZEITSUMME and ZEITANRECHNUNG. Raw STEMPEL inserts would therefore stay uninterpreted. Stamps should go in through **PolyTimeConnect (`POST /time-stamp-by-id`)**, which is the same path myPP uses (api-pp `TimeConnectLegacyService`).
- **Recommendation, in phases:**
  - **Phase A**, Oracle only, inside the existing seed transaction: definitions, archetypes, rights, policies, closing date and plannings. Cheap, deterministic, version-independent. About 7 to 9 dev days.
  - **Phase B**, a second loader run after commit and the PTC restart: stamps via PTC, plus the PEP-only artefacts. For the artefacts there are two candidates:
    - api-pp v2 counted-adjustment endpoints. These are version-dependent, which is bad for A/B runs.
    - "Golden-day fixtures": rows written once by PEP on a reference env, then replayed by SQL with relative dates.
  - About 6 to 10 extra dev days.
- A **DB dump or Materialized-Environment template** is not suitable as the main vehicle. Its dates are frozen, and the E2E needs M-2/M-1/M0 relative to the run date. Re-seed is also refused on dump envs. It is still a fallback for the definitions-only part.

---

## 1. How the seed engine works

1. **Trigger (Kotlin).** Install time is `InstallingSolutionStateHandler` (last step of INSTALLING_SOLUTION). Re-seed is `POST /environments/{id}/reseed`:
   - `KT/web/EnvironmentController.kt:194-208` handles the request. `KT/web/EnvironmentService.kt:903-940` accepts DONE envs only, refuses dump envs (`:919-925`), merges and canonicalizes the optional `seedConfig` override, and sets the state to `RE_SEEDING`.
   - `KT/provisioning/fsm/ReSeedingStateHandler.kt:52-80` then runs only `component-deploymate-seed.yml` with `seedExtraVars + reseedForce()` (`seed_force=true`, `seed_teardown=true`). It is best-effort: on failure it returns to DONE without stamping `lastSeededAt` (`:70`).
2. **Preset to stack.** `KT/domain/SeedScenarioCatalog.kt:44-60` has exactly one `Scenario("customer-roster", …, stack="stacks/deploymate-customer.yml")`. `canonicalize` (`:75-92`) sends unknown presets to the default. `KT/provisioning/fsm/SeedExtraVars.kt:64-90` turns this into play vars: `seed_stack`, `seed_preset`, `seed_count`, `include_*`, the marker and the license vars. The SPA mirrors the catalog in `DM/deploy-mate-spa/src/lib/types.ts:296,319-332`.
3. **Play (`PLAY`).** It runs on the Windows VM in a venv and maps play vars to `SEED_*`/`INCLUDE_*` env vars (`:150-168`). Then:
   - It resolves per-env ids live, failing loudly where needed: `resolve-kategorietyp`, `resolve-dienst-zeitkonto`, `resolve-credit-zeitkonto`, `resolve-login-groups`, `resolve-ebene-betrieb` (`:250-303`).
   - It extends and preflights KALENDER (`:308-370`).
   - On re-seed only, it runs the scoped teardown (`:411-421`).
   - It runs `seed.py apply -s {{ _seed_stack }} --live` (`:423-433`) and writes the sentinel (`:460-469`).
   - It restarts the PolyTimeConnect nomad alloc (`:471-503`), because PTC's `eclink` login only exists after the seed commits.
   - The roster anchor is `SEED_ROSTER_START = now − 7 d` on the control-node clock (`:88-91`).
4. **Loader (`DL/`).** `seed.py apply` → `loader/engine.py`:
   - The stack's layer list is ordered topologically by `depends_on`, with alphabetical tie-break (`loader/dag.py:11-44`).
   - Each layer runs its `seed:` steps (`engine.py:113-137`): `recipe:` (Python plugin returning row dicts), `rows:`, `foreach+row`, `call_proc` (with OUT capture, e.g. `ECBERN.CreateResource`), and `update` / `delete` / `preflight` steps.
   - Layer outputs feed later layers via `layer('id').TABLE` Jinja lookups (`loader/output_store.py`).
5. **Rows and ids.**
   - Recipes return `SeqValue(sequence, key)` / `SeqRef(key)` instead of literal ids. In live mode the Oracle sink resolves these with `SELECT seq.nextval` (`DL/README.md:183-199`). Sequences used include `PLANEINHEITSEQUENCE`, `SEQID_PLANUNG`, `SEQID_ZEITSUMME` and `SEQID_DIENST_DETAIL` (`loader/recipes/roster.py:51-54`, `shift_definitions.py:44-45`).
   - Caller-assigned keys such as `DIENST.PA_CODE` use `ADOPT_ON_KEY`: an existing row is adopted, not inserted (`shift_definitions.py:199-245`, DM-183).
   - Triggers fire on purpose: the session program name is `polypoint-seed`, not JDBC (`DL/README.md:121-125`).
6. **Sinks and the transaction.**
   - `OracleSink` commits **once** in `close()` and only on a clean run (`loader/sinks/oracle.py:13-18,99-122`). Any layer failure rolls back the whole run (`engine.py:49-68`).
   - `RestSink` makes one POST per layer, with a Keycloak client_credentials token (`loader/sinks/rest.py:1-20`, `engine.py:139-155`).
   - `KeycloakAdminSink` creates the SSO users.
7. **Teardown and re-seed.** The teardown is marker-scoped (`DMSEED:` org, `DMSEED-` personnel number, `dmseed-` logins) and runs in one transaction (`loader/teardown.py:1-37`). Phase B calls `ECBERN.DELETEMITARBEITER` per seeded employment. In `PPS/liquibase/pp-baseline/.../PROCEDURE_DELETEMITARBEITER.sql:59-172` that procedure deletes STEMPEL, BLOCK, ZEITSUMME, ZEITANRECHNUNG, PLANUNG, PLANUNGSEINHEIT, STEMPEL_MUTATION, KONTOSTAND and more. **Time-recording rows on seeded people are therefore already torn down for free.** Seeded DIENST rows go through the `DMSEED:DIENST:` export-code marker (phase E).
8. **Validation and manifest.**
   - `seed.py manifest` (`DL/seed.py:111-142`) dry-runs the stack offline and turns the result into JSON (`loader/manifest.py:319-349`; schema 2: people, logins, org units, shifts, roster, licences, definitions, per-layer row counts).
   - `GET /environments/{id}/test-data` serves that JSON. The pod recomputes it with `seedManifestEnv` (`SeedExtraVars.kt:116-124`), which re-derives `SEED_ROSTER_START` from `lastSeededAt − 7 d`.
   - Live validation is otherwise the play's stderr tail plus the per-layer row summary (`seed.py:101-105`). There is no post-seed assertion against the DB.

**Why three layers show 0 rows** (`time-recording-modes`, `people-deepening`, `shift-schedule`):

| Layer                                                               | Implemented?                                                                    | Why 0                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `time-recording-modes` (`DL/layers/time-recording-modes.yml:32-73`) | Yes. AUTO_ZEITSTEMPEL even/odd, BADGE/PIN on MITARBEITER_GLOBAL and MITARBEITER | UPDATE-only. `engine.py:121-125` records no rows for `update` steps, and the count is `sum(len(rows_by_table))` (`manifest.py:341-344`, `seed.py:103`). The live DB shows the effect (env-facts: alternating AUTO_ZEITSTEMPEL). `INCLUDE_TIME_RECORDING_MODES` is not set by the play and defaults to true (`:30`). |
| `people-deepening` (`DL/layers/people-deepening.yml:24-37`)         | Yes. Random BG from a pool, GUELTIG_BIS=2999-12-31                              | UPDATE-only, same reason. The live BG spread (482=70, 483=40, …) proves it ran.                                                                                                                                                                                                                                     |
| `shift-schedule` (`DL/layers/shift-schedule.yml:19,34`)             | Yes, as a REST layer (`POST /api/v2/shift-planning-batch`)                      | `when: inputs.include_rest and env.APIPP_URL` is false: `includeRest=false` in the catalog (`SeedScenarioCatalog.kt:58`), and the play never sets `APIPP_URL`/`KC_PP_SECRET` (`PLAY:132-184`). The roster comes from the Oracle `roster` layer instead.                                                             |

**Extension point for a new preset:**

1. `DL/stacks/deploymate-utr.yml`: the `deploymate-customer` layer list plus the new `utr-*` layers. Stack-level `inputs:` override layer inputs (`engine.py:83-86`), but **not** `depends_on`. Ordering must therefore come from the new layers' own `depends_on`.
2. `DL/layers/utr-*.yml` and `DL/loader/recipes/utr_*.py`. Recipes register with `@register("builtin:…")` (`loader/recipes/__init__.py`). Add tests in `DL/tests/`.
3. `KT/domain/SeedScenarioCatalog.kt`: add `Scenario("utr-time-recording", "UTR time recording (E2E)", "stacks/deploymate-utr.yml", 40, includePalette=true, includeLoginUsers=true, includeRest=false)`. Update `SeedScenarioCatalogTest.kt:106-107`, which asserts that the catalog has exactly one scenario.
4. `DM/deploy-mate-spa/src/lib/types.ts:296,327`: add the mirror entry.
5. `PLAY`: add an anchor-date var, new resolvers, and the Phase B task (see §2.0).
6. `manifest.py`: add a `timeRecording` section (archetype → login/employment, day layout).

---

## 2. Layer-by-layer spec for preset `utr-time-recording`

### 2.0 Cross-cutting design decisions

**D1. Archetypes reuse the first 6 `people-small` employments. They are not new people.**

- The login chain (`login-users-kc`/`-oracle`, `users-idm`) is hard-wired to `layer('people-small')` (`DL/layers/login-users-kc.yml:24-25`, `login-users-oracle.yml:14-16`). `manifest.py:156-159` pairs login _i_ with person _i_. Adding separate UTR people would mean generalizing four layers.
- Instead, `utr-archetypes` (depends on `people-deepening`, `time-recording-modes`, `roster`) re-shapes indices 0..5 with UPDATEs.
- The base `roster` must **skip** them. This needs a small recipe change: a `roster.exclude_first: 6` input read by `_build_cells` (`DL/loader/recipes/roster.py:150-208`).
- Each archetype keeps its faker name, Station and `dmseed-<kuerzel>` login. The manifest publishes the mapping E1..E6 → personalnummer, login and employment marker.

**D2. Today-relative dates are computed once and passed in.**

- New env var `SEED_ANCHOR_DATE` (YYYY-MM-DD). Compute it in Kotlin (`LocalDate.now(ZoneId.of("Europe/Zurich"))`), pass it as play var `seed_anchor_date`, and persist it on the Environment (e.g. `seedConfig.anchorDate` or a new column).
- `seedManifestEnv` then returns exactly the same dates. The current roster anchor uses the control-node clock in UTC (`PLAY:90`) and the manifest re-derives from `lastSeededAt` in UTC (`SeedExtraVars.kt:120-123`). That can be off by one day around midnight in Zurich.
- A pure recipe `builtin:utr-calendar` (no clock, no RNG) derives:
  - `T` = anchor
  - `M0` = month of T
  - `M-1`, `M-2`
  - `closing` = last day of M-2
  - `prepared week` D1..D7 = the first Monday of M-1 and the six days after. The first Monday is always ≤ day 7, so D7 ≤ day 13.
  - `writable` = T−1..T−5
- Jinja has no date arithmetic (`DL/loader/jinja_env.py:91-94`), so this has to be a recipe. The recipe also handles edge cases:
  - If T is day 1–5 of a month, T−5 falls in M-1. That is allowed: it is after the prepared week and after `closing`.
  - The writable days must stay inside the 7-day past window used by unified TR (DM-122, `PLAY:79-87`).
- Re-seed recomputes everything, so `POST /reseed` refreshes the data set to the new "today". This is the main advantage over a dump.

**D3. Two phases, separated by a commit.**

- Phase A layers write Oracle in the normal transaction.
- Phase B (stamps and PEP artefacts) needs PTC or api-pp to **see** the Phase A rows. With one transaction committed at `close()`, REST or PTC calls inside the same run would read uncommitted data, and PTC's `eclink` login only works after commit and restart (`PLAY:471-482`).
- Phase B is therefore a second stack `stacks/deploymate-utr-recorded.yml`, run by a new play task **after** the PTC restart. Because it is a new process, it cannot use `layer('…')` outputs from Phase A. It re-resolves ids by marker (personalnummer `DMSEED-…` → MITARBEITER.id → PLANUNGSEINHEIT.id by date). That needs a new `lookup` step type, or a recipe with sink query access; `OracleSink.query_rows` already exists (`oracle.py:362`).

**D4. Pa-code range.**

- The demo image ships its own catalog (env-facts: 5..95 absences, 770 Piketteinsatz, 145 Ferien). New DIENST rows use a reserved range such as **9101–9109** with `ADOPT_ON_KEY` and the `DMSEED:DIENST:<pa>` export code. The existing teardown phases E1/E2 then cover them.
- `DIENST_DETAIL` and `DIENSTPALETTE` must fan out over **every seeded Gruppe node**, not the root. The interpreter reads the detail at the palette node (DM-122, `shift_definitions.py:247-262`). Reuse `_detail_knoten`.

### 2.1 Layer table (Phase A, Oracle, one transaction)

| #   | Layer id (new)    | depends_on                                                              | Target tables / columns                                                                                                                                                                                                                             | Source of truth / notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `utr-calendar`    | –                                                                       | none (pure recipe, outputs the date map to the output store as a pseudo-table `utr:calendar`)                                                                                                                                                       | D2. Output rows are counted, so the manifest shows them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A2  | `utr-rights`      | `users-idm`                                                             | `ECBERN.POLYUSRROLE_DETAIL` on the `DMSEED:Planner` role (`users_idm.py:166-190` shape: `app_id=2471, subid=-1, wert='T'`), then `call_proc IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('PERMISSION_ROLE', <role id>, null, null, 2471, null)`           | Mobile-app rights read by api-pp `PermissionDetailSetter` (`PPS/personnel-planning/server/.../permission/PermissionDetailSetter.java:45-49,179-203`). **The operation ids as api-pp reads them are 1 READ, 2 MODIFY, 3 DELETE, 4 CREATE, 5 PRINT, 6 EXECUTE** (`PPS/p4-libs/polypoint-p4-user-permission/.../PermissionTypeIdConverter.java:17-51`). This **contradicts** DM's own research table (`DM/tools/data-loader-v2/research/user-admin.md:367`: 2 Drucken, 3 Ändern, 4 Löschen, 5 Erstellen) and the `users_idm.py:65` comment. The existing planner role's `(fid, 5)` "Erstellen" grants are PRINT for api-pp, which is worth a separate DM bug. The grant rows are listed below this table; they are the set Agent A applied by hand on both boxes and verified (env-facts "Phase 1 facts"). The enqueue call is needed because the env boxes lack the `TIUD_POLYUSRROLE_DETAIL_PSC` trigger; without it api-pp's role cache keeps the old rights for up to 7 days (env-facts). Teardown: phase F already deletes role details of the marked role. |
| A3  | `utr-definitions` | `shift-definitions`, `billing-defs`, `base-org`                         | `DIENST` + `DIENST_DETAIL` (+ `DIENST_BEZAHLTE_PAUSE`) + `DIENSTPALETTE` per Gruppe; `LOHNART_PROFIL`/`LOHNART_DETAIL`/`ZULAGENABSCHNITT`                                                                                                           | The shift set is listed in §2.2. Reuse `_DD_REQUIRED_DEFAULTS` (`shift_definitions.py:64-76`, bare-image NOT-NULLs) and the live-resolved `SEED_DIENST_ZEITKONTO_ID` / `SEED_CREDIT_ZEITKONTO_ID`. New resolver `resolve-zeitgutschrift-zeitkonto` (env-facts: id 214 "Zeitgutschrift"; the data plan says 950; resolve by name or the lowest non-GLAZ positive system id, failing loudly).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| A4  | `utr-archetypes`  | `people-deepening`, `time-recording-modes`, `roster`, `utr-definitions` | UPDATE `MITARBEITER_DETAIL` (`AUTO_ZEITSTEMPEL`, `BESCHAEFTIGUNGSGRAD`, `TEILZEIT_STUNDENREDUKTION`, `PA_PIKETT`, `ZE_ID`, `GUELTIG_BIS`), UPDATE `MITARBEITER_GLOBAL.BADGE/PINCODE` (already set)                                                  | Column names from `PPS/.../employment/EmploymentPolicyEntity.java:22-165` (table `mitarbeiter_detail`). The archetype matrix is in §2.3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A5  | `utr-closing`     | `base-org`, `utr-calendar`                                              | UPDATE `SYSTEM_KATEGORIE_VARIABELN.ML_ABSCHLUSS_DATUM` / `SL_ABSCHLUSS_DATUM` = **first day of M-2** for every seeded Kategorie node                                                                                                                | Semantics per `DL/loader/recipes/hospital_tree.py:284-301`: the stored date `1999-12-01` means "closed until 1999-12-31". Applying it to all seeded Stationen is harmless, because the base roster starts at T−7, which is after M-2. The rows are already teardown-scoped (phase D0, `teardown.py:117-121`). Check that SL ("Stundenlöhner") uses the same month semantics or a weekly one (data plan §1: "SM + weekly SH").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| A6  | `utr-plannings`   | `utr-archetypes`, `utr-definitions`, `utr-calendar`                     | Preferred: `call_proc ECBERN.INSERTPLANTAG` per (employee, day, pa_code) (`PPS/liquibase/pp-baseline/.../PROCEDURE_INSERTPLANTAG.sql:1-22`). Fallback: `roster`-style raw `PLANUNGSEINHEIT/PLANUNG/ZEITSUMME/ZEITANRECHNUNG` (`roster.py:211-335`). | The day layout is in §2.4. INSERTPLANTAG does the block splitting (Kombi legs, night carry-over, per-block Zeitkonto) that the raw recipe fakes with one ZEITSUMME of `sollzeit`. Its 22-argument signature (detail date/node per block, `chNachinterpretieren` IN OUT, `newDienstZaehler` IN OUT) needs a `call_proc` with several OUT/IN-OUT binds. The current `call_proc` captures a single OUT (`engine.py:244-258`), so this is a small engine extension. Absences (Ferien) are planned with the Ferien pa_code; FEHLZEIT rows are not needed for R-03 (journal-only absence).                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**A2 rights to grant** (api-pp operation ids):

| Function id | Operations                   | Meaning                                                                                                                     |
| ----------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1030        | 6 EXECUTE                    | use mobile app                                                                                                              |
| 306         | 6 EXECUTE                    | allow time stamps                                                                                                           |
| 1033        | 2 MODIFY, 3 DELETE, 4 CREATE | stamps = "Stempel nacherfassen" → `time_stamp_retroactive` (`PPS/api-gateway/.../SelfServicePermissionReadService.java:21`) |
| 307         | 2, 3, 4                      | blocks                                                                                                                      |
| 1032        | 3 DELETE, 4 CREATE           | on-call presences = "Piketteinsätze erfassen" → `on_call_add`                                                               |
| 1031        | 3, 4                         | scheduling requests                                                                                                         |
| 1040        | 1 READ                       | as granted by Agent A                                                                                                       |

### 2.2 Shift definitions (A3)

| pa          | Title (marker-prefixed)                  | DIENST                                                                                                                                                | DIENST_DETAIL essentials                                                                                                                                 | For                                                                                                                                                                                                                                     |
| ----------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9101        | `DMSEED UTR Tag`                         | typ P, planbar T                                                                                                                                      | blockzeit 07:30–16:24, pause 12:00–12:30, sollzeit 8:24, an_zeitkonto=credit (GLAZ 1), ab -1, `STUNDENREDUKTION='T'` (already the default)               | R-01, R-07, W-\*                                                                                                                                                                                                                        |
| 9102        | `DMSEED UTR Kombi`                       | typ P, planbar T                                                                                                                                      | 3 blocks: `BLOCKZEIT_START/ENDE1..3` = 07:00–11:00, 11:00–14:00, 14:00–18:15; `BLOCK1/3_PA_CODE`=9102, **`BLOCK2_PA_CODE`=9103**; `BLOCKWECHSELDAUER*`=0 | R-02                                                                                                                                                                                                                                    |
| 9103        | `DMSEED UTR Kombi-Leg ohne ZK`           | typ P, planbar F                                                                                                                                      | `AN_ZEITKONTO=-1` ("ohne Zeitkonto", `PEP-DOMAIN-MODEL.md` §7.5)                                                                                         | Kombi middle leg (**inferred** mechanism, see OQ-3)                                                                                                                                                                                     |
| 9104        | `DMSEED UTR Nacht`                       | typ P                                                                                                                                                 | 22:00–30:30 (seconds > 86400), `DATUMSWECHSEL='T'` (pattern of pa 141, `shift_definitions.py:120-126`)                                                   | R-08                                                                                                                                                                                                                                    |
| 9105        | `DMSEED UTR Pikett`                      | **typ I**, `PIKETT_REGELN='T'`                                                                                                                        | window 18:00–31:00, DATUMSWECHSEL T                                                                                                                      | O-01, O-02, O-04, O-05                                                                                                                                                                                                                  |
| 9106        | `DMSEED UTR Pikett WE/FT`                | typ I                                                                                                                                                 | **no** blockzeit/autostempel columns (empty planned layer)                                                                                               | O-03                                                                                                                                                                                                                                    |
| 9107        | `DMSEED UTR Einsatz`                     | typ P, **`PIKETTZUSATZ='T'`, `PLANBAR='F'`** (mutually exclusive, `PEP-DOMAIN-MODEL.md` §1.11)                                                        | detail with credit account                                                                                                                               | `useForOnCallTimeRecording` = `DIENST.PIKETTZUSATZ` (`PPS/.../shiftdefinition/ShiftDefinitionEntity.java:40`); employees get `MITARBEITER_DETAIL.PA_PIKETT=9107` (= `onCallResponseRecordingId`, `EmploymentPolicyEntity.java:112-113`) |
| (reuse)     | 145 Ferien                               | already seeded by `periodic-credit` (`DL/layers/periodic-credit.yml:31`) or the demo's 25                                                             | –                                                                                                                                                        | R-03, O-04                                                                                                                                                                                                                              |
| (reuse/new) | Arzt (carved absence)                    | demo absence if present, else 9108 typ A                                                                                                              | –                                                                                                                                                        | R-04                                                                                                                                                                                                                                    |
| Lohnart     | `DMSEED:UTR Sonntag Zeitgutschrift` 10 % | `LOHNART_PROFIL` + `LOHNART_DETAIL.ZEITKONTO_ID = <Zeitgutschrift>` + `ZULAGENABSCHNITT` on Normalprofil 1, `DATUMSKATEGORIE 5` (Sunday), 00:00–24:00 | pattern `DL/loader/recipes/billing_defs.py:1-60` (existing Sonntagszulage uses zeitkonto −1, a pure pay code)                                            | R-09, allowance pipeline audit (data plan §6.5)                                                                                                                                                                                         |

### 2.3 Archetypes (A4 on people-small indices 0..5)

| Id            | idx | AUTO_ZEITSTEMPEL          | BG     | TEILZEIT_STUNDENREDUKTION                                | PA_PIKETT | Detail interval                   | Extra                                                                                                                                                                                      |
| ------------- | --- | ------------------------- | ------ | -------------------------------------------------------- | --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1 must-stamp | 0   | F                         | 100    | keep                                                     | 9107      | 2024-01-01..2999-12-31            | badge/PIN already set                                                                                                                                                                      |
| E2 on-call    | 1   | **F** (overrides odd → T) | 100    | keep                                                     | 9107      | same                              |                                                                                                                                                                                            |
| E3 auto-stamp | 2   | **T**                     | 100    | keep                                                     | –         | same                              |                                                                                                                                                                                            |
| E4 part-time  | 3   | F                         | **80** | **2** (env-facts shows 2 seeded for all; set explicitly) | –         | same                              | second employment E4b with rule 4 (APIPP-1755) is **out of scope v1**                                                                                                                      |
| E5 mobile     | 4   | F                         | 100    | keep                                                     | 9107      | same                              | reserved for MO/C families                                                                                                                                                                 |
| E6 read-only  | 5   | F                         | 100    | keep                                                     | –         | **GUELTIG_BIS = last day of M-3** | See OQ-6. Allowed periods are built from `MITARBEITER_DETAIL` policies (`PPS/.../selfservice/LegacyMyShiftsService.java:177-200`), so no policy covering M-1/M0 means no `allowedPeriods`. |

- `ZE_ID`: set to 1 ("Standard", env-facts) for E1..E6. MITARBEITER_DEFAULTS already carries `ze_id=1` (`hospital_tree.py:349-357`). Whether ZE_PROFIL matters to UTR at all is OQ-7.
- Because a mobile clock-in needs `checkInEnabled = allowedPeriods ∧ badge ∧ PIN` (`LegacyMyShiftsService.java:194`), and badge and PIN are already armed by `time-recording-modes`, nothing more is needed for E5.

### 2.4 Plannings (A6) and recorded data (Phase B)

Day layout. "Plan" rows are Phase A (A6). "Rec" rows are Phase B.

| Day         | E1                                                                                                                           | E2                                                                                                                      | E3                                           | E4                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------- |
| D1 Mon      | Plan 9101 · Rec stamps 07:28/16:30                                                                                           | Plan 9101 · Rec stamps                                                                                                  | Plan 9101 (auto, no stamps needed)           | Plan 9101 · Rec stamps |
| D2 Tue      | Plan 9102 · Rec stamps 07:00/18:15                                                                                           | Plan Ferien                                                                                                             | Plan 9101 · Rec **ad-hoc block 17:00–18:00** | Plan 9101 · Rec stamps |
| D3 Wed      | Plan 9104 · Rec stamps 21:58 (D3) / 06:35 (D4)                                                                               | Plan 9101 · Rec stamps + **carved Arzt 10:00–11:00**                                                                    | –                                            | –                      |
| D4 Thu      | Plan 9101 · Rec Zulage-triggering stamps (R-09 wants a Sunday; move to D7 for E1 or make the Zulage weekday-based, see OQ-8) | Plan 9105 · Rec Einsatz stamps 22:00/23:30 with code 9107                                                               | –                                            | –                      |
| D5 Fri      | free · Rec **manual Zeitsumme 1:00**                                                                                         | Plan 9105 · Rec **standby block** mirroring the window                                                                  | –                                            | –                      |
| D6 Sat      | Rec **Fixer Saldo +0:30** (system def −9)                                                                                    | Plan 9106 · Rec Einsatz 20:00–21:00                                                                                     | –                                            | –                      |
| D7 Sun      | –                                                                                                                            | Plan Ferien + 9105 (two PLANUNG on one PLANUNGSEINHEIT; DIENSTPOSITION 'P' for the Pikett, `PEP-DOMAIN-MODEL.md` §1.11) | –                                            | –                      |
| M0 T−1      | **nothing** (W-05)                                                                                                           | –                                                                                                                       | –                                            | –                      |
| M0 T−2..T−5 | Plan 9101                                                                                                                    | T−2: Ferien + 9105, no stamps (O-04); T−3: 9105 + **2 paired stamps** (O-05)                                            | T−2..T−4 Plan 9101 (auto)                    | –                      |
| E5          | M0 T−2..T−3: Plan 9101                                                                                                       |                                                                                                                         |                                              |                        |

**Phase B, how each "Rec" artefact is written:**

| Artefact                                           | Path (preferred → fallback)                                                                                                                                                                                                                                                                                                                                                                                                          | Notes / open questions                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stamps (incl. cross-midnight, Einsatz code)        | **PolyTimeConnect REST `POST /time-stamp-by-id`** body `{employmentId, dateTime, code?, comment?}` (`PPS/personnel-planning/server/.../timeconnect/api/APIPolyTimeConnectClient.java:52-58`, DTO `TimeConnectStamp.java`). This is exactly what api-pp's self-service stamp create does (`TimeConnectLegacyService.java:36-48`). PTC runs the Delphi interpretation, so STEMPEL, BLOCK, ZEITSUMME and ZEITANRECHNUNG are consistent. | **OQ-1**: does PTC accept past `dateTime` without a retroactive check under the `eclink` interface identity, and does it re-interpret the day? Note global setting `ROSTER/RETROAKTIV_STEMPEL` (`PPS/.../SaasGlobalSettingsMapper.java:102`). PTC is a nomad job on the VM (`solution_poly_time_connect`, default on ≥ 26.0, `KT/domain/SolutionCatalog.kt:47`); its local URL/port goes in a new play var. |
| Raw `INSERT INTO STEMPEL`                          | **Not recommended.** For any past day `BRAUCHTNACHINTERPRETATION` returns 'T' (`PPS/.../FUNCTION_BRAUCHTNACHINTERPRETATION.sql`: `IF dat < TRUNC(SYSDATE) THEN RETURN 'T'`). Interpretation happens only in Delphi (PEP / PTC: `uiStempelCollector`, `GETPLANEINHEITSTAMPS`, `hospital_tree.py:316-326`). Raw stamps would stay uninterpreted (no BLOCK, `STEMPEL.PLANUNGSEINHEIT` NULL, invisible in UTR).                          | Stempelart codes from the same function: ES = Stempeluhr, MS = manual, AS = Autostempel, PS = Pausenstempel.                                                                                                                                                                                                                                                                                                |
| Ad-hoc block, carved Arzt sub-block, standby block | (a) api-pp v2 `POST /api/v2/write/timerecording/counted-adjustment/shiftblock` and `/subblock` (`PPS/.../api/v2/controller/CountedLayerAdjustmentWriteController.java:33-57,228`), needing `roster-cell-id` = PLANUNGSEINHEIT.id. (b) **golden-day fixture replay** (§3.2).                                                                                                                                                          | (a) is **version-dependent**: it is the api-pp code that PR 12910 changes. On an A/B pair (ENV-M vs ENV-P) the prepared data would be written by two different implementations. Use (a) only for single-env regression runs.                                                                                                                                                                                |
| Manual Zeitsumme 1:00                              | (a) `POST …/counted-adjustment/timeamount/shift-definition` (`:294`). (b) fixture. (c) raw `ZEITSUMME` + `ZEITANRECHNUNG` rows (roster recipe shape, `roster.py:283-335`), since a manual Zeitsumme on a free day needs no interpretation.                                                                                                                                                                                           | OQ-4: which ZSTYPE/CODEART PEP writes for a manual entry (PPCLOUD-14074 5b "UNKNOWN typing"). Capture from a PEP-made row first.                                                                                                                                                                                                                                                                            |
| Fixer Saldo +0:30                                  | (a) `POST …/timeamount/balance-correction` (`:364-394`, restricted to system def −9). (c) raw ZEITANRECHNUNG/ZEITSUMME with code −9.                                                                                                                                                                                                                                                                                                 | Same capture-first rule as the manual Zeitsumme.                                                                                                                                                                                                                                                                                                                                                            |
| Closing date                                       | A5 (Oracle). No Phase B needed.                                                                                                                                                                                                                                                                                                                                                                                                      |                                                                                                                                                                                                                                                                                                                                                                                                             |

Phase B also needs a new engine feature: **per-item REST calls** (a `rest_foreach` step with query params, multiple calls per layer, response capture). `RestSink.post_rest` does one call per layer today (`engine.py:139-153`). It also needs a **PTC sink** (plain HTTP on localhost, no Keycloak), or RestSink with `auth: none`. For api-pp, the play must provide `APIPP_URL` and the `polypoint-p4-api-personnelplanning` client secret (`KC_PP_SECRET`, `engine.py:391-399`). Neither is set today (OQ-5).

### 2.5 Manifest and validation

- Add manifest schema 3, section `timeRecording`:
  - `anchorDate`, `closingDate`, `preparedWeek` (D1..D7 ISO dates), `writableDays`
  - `archetypes[]`: id E1..E6, login, personalnummer, mode, BG, pikettCode
  - `shifts[]`: pa 9101..9107 with windows
  - `scenarios[]`: scenario id → (archetype, date)
- The manifest is derived offline, so these values must come from the same `SEED_ANCHOR_DATE` (D2).
- Add a **post-seed verification task** in the play: `seed.py verify -s deploymate-utr` with read-only SQL. A row-count manifest is not proof that interpretation happened. Checks:
  - BLOCK rows exist for every stamped day
  - `STEMPEL.PLANUNGSEINHEIT` is non-null
  - closing date = M-2
  - the 9101..9107 DIENST rows exist with their details at every seeded Gruppe node
  - E6 has no detail interval covering M-1
  - the rights rows exist
- Fail the re-seed best-effort, as today (`ReSeedingStateHandler.kt:72-80`).

---

## 3. Effort, risks, alternatives

### 3.1 Effort (one DM developer who knows the loader; includes live validation on one env)

| Item                                                                                                                             | Days                 |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A1 calendar recipe + `SEED_ANCHOR_DATE` plumbing (Kotlin extra var, persisted anchor, play, `seedManifestEnv`)                   | 1.5                  |
| A2 rights                                                                                                                        | 0.5                  |
| A3 definitions (7 DIENST + details/palette fan-out + Lohnart/Zulage + Zeitgutschrift resolver)                                   | 2.5                  |
| A4 archetypes + roster `exclude_first`                                                                                           | 1                    |
| A5 closing date                                                                                                                  | 0.5                  |
| A6 plannings via INSERTPLANTAG (multi-OUT `call_proc` engine extension) or raw fallback                                          | 2–3                  |
| Catalog / SPA / tests / manifest v3                                                                                              | 1.5                  |
| **Phase A subtotal**                                                                                                             | **≈ 9.5–10.5**       |
| Phase B engine: second stack run after commit + PTC restart, `lookup` step, `rest_foreach`, PTC sink                             | 3–4                  |
| Phase B stamps via PTC (incl. cross-midnight, Einsatz code) + verify task                                                        | 2                    |
| Phase B PEP artefacts: api-pp endpoints + secret plumbing (2 d) **or** golden-day fixtures (capture tool + replay recipe, 3–4 d) | 2–4                  |
| **Phase B subtotal**                                                                                                             | **≈ 7–10**           |
| **Total**                                                                                                                        | **≈ 16–20 dev days** |

### 3.2 Risks

1. **Interpretation of past days** (highest). PTC acceptance of retroactive stamps is unproven (OQ-1). If PTC refuses, the only faithful stamp path left is the PEP client (pep-driver UI automation), which does not belong in DeployMate. Mitigation: do a spike first, one curl from the VM to PTC `POST /time-stamp-by-id` with a T−20 dateTime, then check BLOCK/STEMPEL.
2. **Version dependence in A/B runs.** Anything written through api-pp v2 on ENV-P is written by the code under test. Prefer PTC (P2 is identical on both envs, env-facts) and SQL for prepared data. Use api-pp endpoints only when the run is not an A/B comparison.
3. **INSERTPLANTAG vs raw rows (confirmed problem).** Raw roster rows write one static ZEITSUMME = sollzeit per planning (`roster.py:283-307`). Agent A saw the effect on ENV-M: after stamping, 10-06/10-07 credit 1027 min = seeded planned ZEITSUMME 480 + interpreted stamps 547. That is a **double count caused by the seed** (env-facts "Baselines"). The static rows are also wrong for Kombi (−1 leg) and Nacht (date change).
   - The UTR preset must not use the raw `roster` recipe for days that will carry stamps. Use INSERTPLANTAG, or write PLANUNGSEINHEIT + PLANUNG only and leave ZEITSUMME/ZEITANRECHNUNG to the interpreter.
   - This is also a **bug in the existing `customer-roster` stack** for any myPP clock-in on a seeded day. Worth a separate DM ticket.
   - INSERTPLANTAG has 22 arguments and IN OUT flags and may expect a PEP session context (`LCDATE`/user columns): validate live.
4. **Kombi −1 leg mechanism** (OQ-3) is inferred from `BLOCKn_PA_CODE` plus "ohne Zeitkonto = `an_zeitkonto = -1`". Confirm against a real Kombi row in the demo dump (`SELECT … FROM DIENST_DETAIL WHERE block2_pa_code <> pa_code`).
5. **E6 read-only** (OQ-6): ending the detail interval at M-3 while STAMMPLUS stays open may make PEP/api-pp throw (`KeinDetail`, `hospital_tree.py:316-326`) instead of showing read-only days. Validate R-11 behaviour.
6. **Gruppe co-location** of DIENST_DETAIL/DIENSTPALETTE. Missing rows at a Gruppe give −21 errors and invisible stamps (DM-122). Reuse the existing fan-out.
7. **SHIFT_CONTROL (X-02) and E4b (rule 4)** are not covered. Both need product input (data plan §3) and stay BLOCKED or out of scope.
8. **Manifest drift and umlaut logins.**
   - Agent A found that the manifest `loginUsers` match the live Keycloak/DB logins only for `dmseed-lhug` (env-facts "Logins"). The offline-recomputed manifest has diverged from what the live run wrote. So the archetype → login mapping must be **captured live**: written by the seed run (e.g. a JSON next to the sentinel, fetched by the FSM), not recomputed offline.
   - Seeded logins with umlauts (`dmseed-cmül`, `dmseed-awüt`) break the PolyID login form (windows-1252 submit). The archetype layer should pick indices with ASCII-only kürzel, or the faker recipe should transliterate kürzel/usernames.
9. **Teardown completeness.** DELETEMITARBEITER covers STEMPEL, BLOCK and ZEITSUMME. Possible leftovers are APIPPDBA-side rows (journal/AQ messages created by api-pp writes) and the new LOHNART/ZULAGENABSCHNITT rows (covered by phase G only if they carry the `DMSEED:` marker). Check with a re-seed twice in a row.

### 3.3 What can be a dump or template instead

DeployMate supports Oracle Data Pump dumps (`KT/domain/DbDumpCatalog.kt:27-80`, `GET /api/v1/db-dumps`, LOADING_DB_DUMP `KT/provisioning/fsm/LoadingDbDumpStateHandler.kt`). It also supports Materialized-Environment templates and clones (CHANGELOG 1.36.0, DM-207). Limits:

- A dump **replaces** the seed: the seed is skipped (`InstallingSolutionStateHandler.kt:175-179`) and re-seed is refused with 409 (`EnvironmentService.kt:919-925`). It cannot be combined with a date-relative layer unless DM adds a "post-dump layer" mode.
- Dates are **frozen**. M-1/M0/T−n move every day, so a dump is outdated after about a week. That breaks the writable window (W, O-04/O-05) and the closing date, and shifting all date columns by SQL is not safe (KONTOSTAND, GUTHABEN, ZEITRAUM, Sollplan).
- Clones are fast (about 15 min) but are equally frozen and have to be refreshed monthly.

So:

| Layer                                                                              | Dump/template feasible?                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A2 rights, A3 definitions, A4 archetypes (no dates except E6)                      | Yes. Date-independent, so a "UTR definitions" dump or template would work. But Phase A is cheap, so this saves little.                                                                                                                                                                                                                                                                                                                                            |
| A5 closing, A6 plannings, Phase B recorded days                                    | No. Date-relative.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Phase B PEP artefacts (ad-hoc block, Arzt, Fixer Saldo, manual Zeitsumme, standby) | **Hybrid "golden-day fixtures"**: prepare the D1..D7 week once in PEP (pep-verify) on a reference env and export the PEP-written rows (PLANUNGSEINHEIT, PLANUNG, BLOCK, STEMPEL, ZEITSUMME, ZEITANRECHNUNG of the 4 employees) as YAML templates with relative day offsets and symbolic ids. A recipe replays them with `SeqValue`. Interpreted by PEP, version-independent, date-relative. Cost: schema-drift sensitivity; recapture when the P2 schema changes. |

---

## 4. Draft Jira ticket (project DM)

**Title:** Seed preset `utr-time-recording`: today-relative time-recording data set for the Unified Time Recording E2E

**Type:** Story · **Labels:** testdata, seeder, utr · **Links:** APIPP-1801 / PR 12910 (first consumer), DM-122, DM-159, DM-183

**Description**

The Unified Time Recording E2E (cloud team, skill `utr-e2e`) needs an env pre-loaded with time-recording data:

- six employee archetypes
- dedicated shift definitions (Kombi with an "ohne Zeitkonto" leg, night, Pikett with and without window, an Einsatz usable for on-call recording, a Sunday allowance crediting a second Zeitkonto)
- one fully prepared week in the previous month (stamps incl. cross-midnight, carved absence, ad-hoc block, manual Zeitsumme, Fixer Saldo, Pikett with Einsatz stamps, standby block)
- a closing date two months back
- writable days in the last five days

Today this is prepared by hand through PEP (about half a day per env pair, error-prone). The data has to be **relative to the seed date**, so a dump is not a fit, and `POST /environments/{id}/reseed` should refresh it.

Proposal (details: `deploymate-seed-proposal.md`):

1. New scenario `utr-time-recording` in `SeedScenarioCatalog` + SPA mirror → stack `stacks/deploymate-utr.yml` = customer stack + `utr-*` layers.
2. New `SEED_ANCHOR_DATE` (Europe/Zurich date computed by the FSM, persisted, reused by `seedManifestEnv`) + recipe `builtin:utr-calendar`.
3. Phase A (Oracle, same transaction):
   - `utr-rights` (mobile-app functions 1030/306/1033/307/1032 on the DMSEED planner role, using api-pp's operation ids 2 MODIFY / 3 DELETE / 4 CREATE, plus the `PERMISSION_ROLE` persistence-state enqueue)
   - `utr-definitions` (pa 9101–9107 + Lohnart/Zulagenabschnitt, fanned out to the seeded Gruppe nodes)
   - `utr-archetypes` (UPDATEs on people-small idx 0–5; `roster` gets `exclude_first`)
   - `utr-closing` (SYSTEM_KATEGORIE_VARIABELN = first day of M-2)
   - `utr-plannings` (INSERTPLANTAG via a multi-OUT `call_proc`)
4. Phase B (second loader run after commit + PTC restart):
   - stamps via PolyTimeConnect `POST /time-stamp-by-id`
   - PEP-only artefacts via golden-day fixtures (or api-pp v2 counted-adjustment endpoints for non-A/B runs)
   - needs `lookup` and `rest_foreach` step types and a PTC sink
5. Manifest schema 3 `timeRecording` section + read-only `seed.py verify` task.

Spike first (time-box 1 d): from the env VM, POST one past-dated stamp (T−20) to PTC for a seeded must-stamp employee. Check that STEMPEL, BLOCK and ZEITSUMME are written and that `GET /api/v1/legacy-time-recording/{emp}/days` shows the recorded block. If PTC refuses retroactive stamps, Phase B falls back to fixtures entirely.

**Acceptance criteria**

1. Creating an env with `seedConfig.preset = "utr-time-recording"` (cloud-capable track, PTC solution on) reaches DONE with the seed sentinel written. `GET /environments/{id}/test-data` returns schema 3 with `timeRecording.anchorDate` equal to the seed date (Europe/Zurich) and the archetype → login mapping for E1..E6.
2. For each archetype, `GET /api/v1/legacy-time-recording/{employment}/days?from=<M-1 start>&to=<T>` (as that user) shows the expected config:
   - E1/E2/E4/E5: `allowed_periods` cover M-1..M0 and `check_in_enabled=true`
   - E3: `allowed_auto_timestamp_periods` only
   - E6: no allowed period in M-1/M0
3. `GET /api/v1/legacy-time-recording/permissions` as E1 returns `time_stamp_retroactive=true` and `on_call_add=true`.
4. `GET /api/v1/shift-definitions/roster?...&shift-type-filter=USE_FOR_ON_CALL_RECORDING` returns the UTR Einsatz definition for the seeded group nodes.
5. `GET /api/v1/time-recording/closing-dates` returns monthly/weekly locking date = last day of M-2 for the seeded categories.
6. The prepared week D1..D7 (first Monday of M-1 + 6 days) contains the plannings and recorded data of the proposal's §2.4 table. Each stamped day has interpreted BLOCK rows linked to its stamps (`BLOCK.STEMPEL_IN_ID`/`OUT_ID`, `STEMPEL.PLANUNGSEINHEIT` not null), and the night stamp's out-time lies on D+1.
7. The writable days T−1..T−5 match the proposal (E1: nothing on T−1, UTR Tag on T−2..T−5; E3 auto T−2..T−4; E2 Pikett T−2/T−3 as specified; E5 T−2..T−3).
8. `POST /environments/{id}/reseed` on such an env (a) tears down all of it with no FK errors, (b) recreates it relative to the new seed date, and (c) gives identical results when run twice on the same day.
9. `customer-roster` envs are unchanged: identical dry-run emit for the existing stack, and the existing tests stay green (`SeedScenarioCatalogTest` updated for two scenarios).
10. The post-seed `seed.py verify` task fails the seed (best-effort, audit entry, no `lastSeededAt` stamp) when any check in item 6 is not met.

**Out of scope:** SHIFT_CONTROL allocations (X-02), second employment with reduction rule 4 (E4b), dangling allowance profile (X-03, set transiently at run time).

**Related bug candidates found on the way** (separate DM tickets):

- (a) `roster` layer static ZEITSUMME double-counts once a seeded day is stamped (1027 = 480 + 547 min on 2026-10-06/07)
- (b) `users-idm` planner rights use operation 5 as "Erstellen", but api-pp reads 5 as PRINT and 4 as CREATE
- (c) the offline manifest `loginUsers` do not match the live Keycloak logins (only 1 of 40 matched)
- (d) seeded logins with umlauts break the PolyID form submit

---

## 5. Open questions (to resolve before or during implementation)

| #    | Question                                                                                                                                                                                                                         | Who / how                                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| OQ-1 | Does PTC `POST /time-stamp-by-id` accept past `dateTime` (T−20…T−40) for an `eclink` interface session, and does it re-interpret the day (BLOCK/ZEITSUMME) immediately? Does `RETROAKTIV_STEMPEL` matter?                        | 1-day spike on a DM env; NEON for PTC semantics         |
| OQ-2 | Can INSERTPLANTAG run outside a PEP session (session/user context columns, `chNachinterpretieren` handling), and is a subsequent interpretation (PTC or PEP) needed for past planned days without stamps (E3 auto days, Ferien)? | NEON / live test                                        |
| OQ-3 | Is the "Kombi leg ohne Zeitkonto" modelled through `BLOCK2_PA_CODE` → a DIENST whose detail has `AN_ZEITKONTO=-1`, or through another column?                                                                                    | Query a real Kombi definition in the demo or STGAG dump |
| OQ-4 | Exact row shape PEP writes for manual Zeitsumme and Fixer Saldo (ZSTYPE, CODEART, CODE −9, an/ab_zeitkonto)                                                                                                                      | Capture once with pep-verify on a reference env         |
| OQ-5 | Where does the play get the api-pp client secret (`polypoint-p4-api-personnelplanning`) and the local api-pp and PTC URLs on the VM?                                                                                             | DM team (vault / keycloak-configurer vars)              |
| OQ-6 | Is "employment detail ends at M-3" the right way to produce E6 (no allowed period) without breaking day reads? Alternative: a separate closing date on E6's category.                                                            | Product / cloud team, live test of R-11                 |
| OQ-7 | Does `ZE_PROFIL` (MITARBEITER_DETAIL.ZE_ID) affect UTR at all, or is AUTO_ZEITSTEMPEL plus the detail interval enough?                                                                                                           | NEON                                                    |
| OQ-8 | R-09 needs Sunday work with the Zulage, but D4 is a Thursday. Move the allowance day to D7 for E1, or define the Zulage on weekdays?                                                                                             | utr-e2e owner                                           |
| OQ-9 | SL (hourly-wage) closing semantics: monthly like ML, or weekly (data plan: "SM + weekly SH")?                                                                                                                                    | NEON                                                    |
