# PEP domain model — meaning &amp; data model (ground truth from the P2 Delphi source)

What each PEP concept **is**, its fields, the DB tables/columns behind it, how the
concepts relate, and the business rules — written so a Claude skill (or an
engineer, or a shift planner) can reason about PEP like a lifelong super-user.

This is the **semantics** companion to the two automation docs:

- `PEP-UI-MAP.md` — live-verified UI selectors ("how to drive PEP").
- `P2-SOURCE-NOTES.md` — which forms/grids are accessible, the single-window
  (`ChildEngine`) model, the generic `TfrmDefinitionList`/`TfrmDefinitionEditor`
  pattern reused by ~30 "Definitionen" dialogs. Referenced below as
  "SOURCE-NOTES §N".

**Provenance.** Everything here is derived from the P2 Delphi checkout at
`/Users/yh/dev/polypoint/P2/` — forms/logic under `delphi/pep/`, shared units
under `delphi/{interfaces,rest,vclcontrols,util}/`, and the Oracle schema DDL at
`shared/db/ecbern/create/main_ecbern.sql` (~39k lines, one `CREATE TABLE` per
`-- TABLE:` marker) plus stored procs/functions under `shared/db/ecbern/procs/`.
Citations are `file:line`. Delphi sources are ISO-8859/CRLF — `grep` needs `-a`
or it treats them as binary and finds nothing. Claims that could not be
confirmed from source are flagged **(inferred)** / **(unconfirmed)**.

---

## The big picture — one day, top to bottom

Everything in PEP hangs off two axes: an **org node** (`HIERARCHIE.knoten_id`,
§8) and a **Dienst** (shift definition, keyed by `pa_code`, §1). A planned day
for one employee flows like this:

```
Hierarchy node (knoten_id) + Dienst (pa_code)
        │
        ├─ Demand side:  BEDARFSPROFIL / _AUSNAHME / BEDARFSPROFILGESAMT   (§12.4)
        │                 → legacy Bedarf/Bestand/Deckung  OR  CPP/smartPEP matcher
        │
        └─ Planned side: PLANUNGSEINHEIT (employee+day)                    (§12.2)
                              └─ PLANUNG (employee + Dienst + dienstteil + sollzeit)
                                     │   (Anbindung='Fehlzeit' if absence-derived, §10)
                                     ▼
                                  BLOCK  (PLANUNG_ID + STEMPEL_IN/OUT/DURATION_ID)
                                     │                         ▲
                                     ▼                         │ recorded punches
                          ZEITSUMME / ZEITANRECHNUNG ◄──── STEMPEL              (§4, §12.3)
                                     │   (+ Zulagen→Lohnart credits, §5/§6)
                                     ▼
             Stempeleditor "Zeitanrechnungen": Grundzeit | Istzeit | Geplant | Saldo
                                     │
                                     ▼
                          Guthaben accounts (Anspruch − Bezug = Saldo, §7)

Cloud/api-pp mirror: TRosterCellComplete{ PlannedLayer, RecordedLayer,
                     CoveredLayer, CountedLayer } per (employment, day) — §12.3
```

**Ten things that are surprising or easy to get wrong** (details in-section):

1. **A "Dienst" is three cooperating rows**, not one: a global `DIENST`
   (PK `pa_code`), one per-node `DIENSTPALETTE` instance (local name/shortcut/
   colour overrides), and one or more date-versioned `DIENST_DETAIL` rows that
   carry almost all the actual behaviour. Nodes without their own `DIENST_DETAIL`
   inherit from the parent node up the tree (§1.1).
2. **"Dienststufe" is NOT a split-shift stage.** The up-to-3-way split-shift
   structure is `Block1/2/3` on `DIENST_DETAIL` (with `blockwechseldauer` gaps).
   A "Dienststufe" is a task/cost-centre (`charge`) allocation _inside_ a block
   (§1.3–1.4).
3. **There is no "Präsenzart" / "PA-Code" master table.** `pa_code` is a shared
   identifier space = the `DIENST` PK; Präsenz/Absenz/Pikett is just
   `DIENST.typ ∈ {'P','A','I'}`. The Stempeleditor "U" (Ungeplante Präsenz) is a
   hardcoded sentinel `-1`, not a DB row (§4).
4. _*The "Zulage*" Pascal files actually implement Lohnart._* The real
   Zulagenprofil editor is the bespoke `fzupr*`/`uzupr`/`uzuab` family, not the
   generic Definitionen pattern (§5.3).
5. **Zulagen→Lohnart is a per-day DB pipeline** (`Zulagen.sql`): time-of-day
   `ZULAGENABSCHNITT` windows accumulate seconds onto a Lohnart `ccode`, an
   employee-scoped redirection engine (`LOHNART_KATEGORIE`, UI name
   "Zulagenvariante") can re-route codes, then `LOHNART_DETAIL` turns seconds
   into credited time (`faktor × value`, clamped, rounded, age-gated) written to
   `ZEITANRECHNUNG` (§5.6, §6).
6. **A Zulagenprofil is assigned per Dienst in 4 slots** (Monatslohn/Stundenlohn
   × normal/modified), not per employee. The _Wechselschicht_ allowance engine
   (`WS_ZULAGEN_PROFIL`) is the one assigned per employee (§5.4–5.5).
7. **`LOHNART_GRENZE` is not a per-Lohnart cap** — it has no `ccode` column; it's
   the coloured threshold-band config for a **Zeitkonto** balance display (§6.4).
8. **Two Guthaben systems coexist.** "Definitionen → Guthabenprofil" edits the
   new-style `DEF_GUTHABEN`; the legacy `GUTHABENPROFIL` (PK = `pa_code`, an
   extension row on a Dienst) is still used as a runtime fallback. Vocabulary
   everywhere: **Anspruch** (entitlement) − **Bezug** (taken) + **Übertrag**
   (carry-over) = **Saldo** (§7).
9. **"GLAZ" and "ohne Zeitkonto" are Zeitkonto reporting buckets, not
   accrual switches.** GLAZ = the conventionally-named flexitime bucket;
   "ohne Zeitkonto" = the `an_zeitkonto = -1` fallback bucket (§7).
10. **One org tree, not several views.** `HIERARCHIETYP` classifies node _kinds_
    (S/Z/G/K), not parallel hierarchies. Level count is per-tenant (rows in
    `EBENE`), not a hard-coded 6. Ancestor/descendant queries use materialized
    `stamm` (breadcrumb) + `generationen` (Dewey path) keys (§8).

---

## 1. Dienst (Dienstdefinition)

A **Dienst** is a named, reusable shift template — "Frühdienst," "Nachtdienst A,"
"Ferien" (as an absence-Dienst), "Pikett Nacht" — that a planner drags onto an
employee's day in the Planblatt. It bundles everything the system needs to
interpret that day once planned: when it runs, how much paid time it counts,
what breaks apply, what allowance profile pays for it, and what colour/icon
shows on the roster. Under the hood "a Dienst" is really three cooperating
things: one **global definition** (`DIENST`), one or more **per-hierarchy-node
local instances** (`DIENSTPALETTE`), and one or more **time-versioned detail
records** (`DIENST_DETAIL`) that carry almost all of the actual behaviour.

### 1.1 Identity, and global vs. Dienstpalette

`DIENST` (`main_ecbern.sql:930-955`) is the single global row per shift code:

| Column                     | Type             | Meaning                                                                                                                                                                                                         |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pa_code`                  | NUMBER PK        | the shift's code (`XPKDIENST`, `main_ecbern.sql:9211`) — there is **no** separate `DIENST_ID`                                                                                                                   |
| `system`                   | CHAR 'T'/'F'     | built-in/protected definition (`TDienst.System`, `intfDstDet.pas:100`)                                                                                                                                          |
| `titel`                    | VARCHAR2(80)     | global name ("globale Bezeichnung")                                                                                                                                                                             |
| `typ`                      | CHAR 'P'/'A'/'I' | **P**räsenz / **A**bsenz / **I** = Pikett (on-call) — matches the 3 tab captions `tsPraesenz1`/`tsAbsenz1`/`tsPikett1` (`f_dsthpt.dfm:109,123,138`) and `GetDienstIntGrenzen.sql:84`                            |
| `bild`                     | BLOB             | in schema but no read/write reference found — **(unconfirmed/likely legacy)**, distinct from `icon_ganz`/`icon_halb`                                                                                            |
| `planbar`                  | CHAR             | inverse of the "nicht planbar" checkbox (`fDienstGlobalSettings.dfm:319-327`, `.pas:760`)                                                                                                                       |
| `Guthaben`                 | CHAR             | "Dienst mit Guthabenkonto" — whether bookings of this Dienst affect a Guthaben account (`fDienstGlobalSettings.dfm:398-405`)                                                                                    |
| `dgruppen_id`              | NUMBER FK        | → `DIENSTGRUPPE` (§2), combo `cbDienstGruppe` (`fDienstGlobalSettings.dfm:189-196`)                                                                                                                             |
| `Export_Code`              | VARCHAR2(20)     | external-system code, separate from the "Zuordnungscodes" grid `sgCodes` (`fDienstGlobalSettings.dfm:18-89`)                                                                                                    |
| `global_gueltig_ab`/`_bis` | DATE             | global validity window (§1.2)                                                                                                                                                                                   |
| `icon_ganz`/`icon_halb`    | BLOB             | full-day / half-day icon bitmaps                                                                                                                                                                                |
| `icon_color_fg`/`_bg`      | NUMBER           | foreground/background `TColor` ints for palette rendering                                                                                                                                                       |
| `freiertag`                | CHAR             | "zählt als freier Sonntag" (`fDienstGlobalSettings.dfm:440-447`)                                                                                                                                                |
| `planungswunsch`           | CHAR             | "Planungswunsch" flag                                                                                                                                                                                           |
| `pomaschichttyp`           | NUMBER           | **POMA-specific** shift classification — closed enum _kein/Früh/Tag/Spät/Nachtdienst_ (`fDienstGlobalSettings.dfm:496-509`); **not** the `DIENST_SCHICHTTYP` table (§2), used only for pool-app (POMA) matching |
| `PPBVAusfallKategorie`     | NUMBER           | absence category for a Swiss reporting statute (Urlaub/Arbeitsunfähigkeit/sonstige, `fGlobal.pas:1126-1128`)                                                                                                    |

**Runtime schema is wider than this base create-script.** `udstdet.pas:5081-5091`
reads extra `DIENST` columns added by later migrations not in `main_ecbern.sql`:
`always_visible`, `FEHLZEIT`, `Pikett_Regeln`, `pikettzusatz`, `diensttausch`,
`ressourcenersatz`, `interner_pool`, `POMAAVAILABILITYHANDLING`,
`DATUM_MIGRATION` — backing the checkboxes "immer sichtbar," "Fehlzeit,"
"Planungsregeln für Pikettdienste einhalten," "Piketteinsatz (mobile App),"
"Diensttausch," "Ressourcenersatz," "Interner Pool," "Planung mit Verfügbarkeit"
(`fDienstGlobalSettings.dfm:422-573`, `.pas:776-912`).

**Global Dienst vs. Dienstpalette — the exact mechanism.** A Dienst is defined
once globally (`DIENST`, PK `pa_code`), then _made available_ at one or more
hierarchy nodes via `DIENSTPALETTE`, whose PK is the pair `(knoten_id, pa_code)`
(`XPKDIENSTPALETTE`, `main_ecbern.sql:9439`). Each `DIENSTPALETTE` row carries
**local overrides**: `name` (the "lokale Bezeichnung"), `shortcut`, `position`,
`auto_planbar`, `palette_gueltig_ab/bis` (`main_ecbern.sql:1378-1388`) —
matching `IDienstPaletteInfo.LocalName/ShortCut/Position/AutoPlanbar/…`
(`intfDstDet.pas:109-141`). This is the `fEditDienstPalette`/`fDienstPaletteSettings`
chain from SOURCE-NOTES §3: `edLokaleBezeichnung` is disabled (shows
`fDienst.GlobalName`) until the `sbLokaleBezeichnungAendern` toggle is pressed
(`fDienstPaletteSettings.pas:98-123,167-175`). `TfrmEditDienstPalette`
(`fEditDienstPalette.dfm`) embeds that settings frame plus a `VSTDetails` tree
listing every `DIENST_DETAIL` version for this node with columns "Gültigkeit von
/ bis / unbegrenzt / Details" (`fEditDienstPalette.dfm:168-195`) — one dialog
edits both the node's palette row and its date-versioned detail records.

At the root/Spital node (`cMainNodeId`) the same UI is driven by
`TfrmEditDienstGlobal` (`fEditDienstGlobal.pas`), which keeps
`DIENST.global_gueltig_ab/bis` synced to the first/last `DIENST_DETAIL` version
and propagates date changes down to the node's `DIENSTPALETTE.palette_gueltig_ab/bis`
(`fEditDienstGlobal.pas:118-186`). Adding a shift to a node's palette the first
time is `AddDienstToPalette.sql:1-56` (requires a group-rank node, `rang=98`;
auto-assigns the next `position`).

### 1.2 Validity &amp; versioning

- **`DIENST.global_gueltig_ab/_bis`** — the shift's overall lifetime.
- **`DIENSTPALETTE.palette_gueltig_ab/_bis`** — per-node availability window.
- **`DIENST_DETAIL`** is the true versioned-behaviour table: surrogate PK
  `dienst_detail_id`, logical key `(pa_code, knoten_id, gueltig_ab)`, with
  `gueltig_bis` maintained by `SyncDienstDetailLookup.sql:11-16` (each row's
  `gueltig_bis` = day before the next row's `gueltig_ab`). **Every node can have
  its own detail history**; a node with none inherits from its parent —
  `FindDienstDetail.sql:22-45` / `getdienstdetail.sql:1-52` walk
  `HIERARCHIE.VATER_ID` upward until a `DIENST_DETAIL` valid at the requested
  date is found ("define once at the root, override only where needed").
- **Change tracking**: `DIENSTPALETTE_VERSION` (PK `knoten_id`,
  `main_ecbern.sql:1398`) holds one version counter per node, bumped by
  `IncreaseDienstPaletteVersion.sql` via triggers on any insert/update/delete of
  `DIENSTPALETTE`/`DIENST_DETAIL` — a cache-invalidation stamp for anything (PEP,
  api-pp) that caches "what shifts + rules apply at node X."

### 1.3 Times, blocks, and Dienststufen

**Correction to a common misconception: "Dienststufe" is NOT a split-shift
stage.** The up-to-3-way split-shift structure is called a **Block**
(`Block1`/`Block2`/`Block3`), stored directly on `DIENST_DETAIL`. "Dienststufe"
is a finer concept: a **task/cost-centre allocation** placed _within_ a block,
backed by the legacy-named table `charge`/`charge_detail` (`uDienststufenEditor.pas:42-58`,
list caption `rs_sAufgabeDefinition` = "Aufgabe Definition"). See §1.4.

**Blocks (the real multi-interval mechanism).** `DIENST_DETAIL`
(`main_ecbern.sql:989-1213`) has three parallel column groups, suffix 1/2/3:
`gleitzeit_start/ende` (flextime bounds), `blockzeit_start/ende` (core-time
bounds), `erster/zweiter_autostempel` (expected in/out stamp times),
`erster/zweiter_korrekturstempel`, `pause_start/ende/dauer/stempeln`,
`erster/zweiter_pausenstempel`, and `blockN_pa_code`. Between blocks,
`blockwechseldauer1_2` and `blockwechseldauer2_3` give the gap duration — the
literal "split shift with a gap in the middle" (morning + evening block with
hours off between). `IDienstDetailItem.GetAnzahlDienstBlocks`/`GetDienstBlockItem`
(`intfDstDet.pas:342,364`) and `IDienstBlockItem` (`intfDstDet.pas:184-282`:
`Blockzeit`, `Gleitzeit`, `Autostempel`, `Korrekturstempel`, `PausenBereich`,
`BlockWechselDauer`, `BlockSollzeit`) address blocks by index. The visual editor
is `TDienstZeitRasterForm` (`fDienstZeitRasterForm.pas/.dfm`), the "Zeitraster /
Stempel" tab of the Dienstdefinition dialog (`f_dstdef.dfm:1134-1152`), drawing
each block on an interval grid (`igGrid: TIntervalGrid`).

**Ganz/Links/Rechts at the block level too:** `TDienstBlockAssignOptions = set
of (baWithoutDienststufe, baLeftHalf, baRightHalf)` (`intfDstDet.pas:18`) — a
block can be assigned/copied as its left or right half (the same G/L/R
vocabulary as the Planblatt palette radios, see §1.11).

### 1.4 Dienststufen (task/charge sub-intervals within a block)

Within a block, `TDienstZeitRasterForm` carves out **Dienststufe intervals** —
coloured bars ("cDienststufeBar," `fDienstZeitRasterForm.pas:631,742,1183`)
representing a task/charge allocation, via `IDienstBlockItem.DienststufeIntervallList`
(`intfDstDet.pas:206,257-258`) and `IDienstDienststufeIntervalItem`
(`intfDienststufen.pas:190-196`). DB: `CHARGE_INTERVAL_DIENST`
(`main_ecbern.sql:674-690`):

| Column                           | Type      | Meaning                                                                               |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| `dienst_detail_id`               | NUMBER FK | → `DIENST_DETAIL` (which node/date-version)                                           |
| `BLOCK_NR`                       | NUMBER(1) | which of the up-to-3 blocks                                                           |
| `CHARGE_ID`                      | NUMBER FK | → the "Dienststufe"/"Aufgabe" (`charge`) definition (`uDienststufen.pas:178,275,292`) |
| `STARTTIME`/`ENDTIME`/`DURATION` | NUMBER    | sub-interval bounds within the block                                                  |
| `SYNC_STARTTIME`/`SYNC_ENDTIME`  | CHAR T/F  | whether the sub-interval tracks the block's own start/end                             |

`IDienststufeDetailItem.Kostenstellen: IKostenStelleList` and `IsLEPActive`
(`intfDienststufen.pas:204-211`) tie a Dienststufe to cost centres and to LEP
(nursing-service documentation) — i.e. "of this 8-hour Präsenz-Dienst,
09:00–11:00 is charged to cost-centre X / counted as LEP task Y." A
cost-allocation concept layered _inside_ a Dienst's blocks, not the Dienst's
timing structure. (This is the same `charge` mechanism the Stempeleditor
surfaces as the "Aufgabe" column — §11.)

### 1.5 Sollzeit (paid time) vs. gross time

`DIENST_DETAIL.Sollzeit` (`main_ecbern.sql:1020`, seconds) is the **paid target
time** counted toward the employee's Ist/Soll balance — distinct from the gross
span implied by block boundaries (which includes unpaid breaks). Two percentage
knobs (`sollzeit_behalten` "keep this % of Sollzeit," `Dienstsollzeit_setzen`
"set this % as new Sollzeit," `main_ecbern.sql:1016-1019`) govern override
behaviour across a re-plan — exact algorithm not traced **(inferred)**.
`Sollzeit_aus_Kalender` (`main_ecbern.sql:1161`) instead pulls Sollzeit from the
employee's calendar day-target ("Tagessoll," §9) — the branch in `DienstDauer.sql:54-61`
(`DECODE(sollzeit_aus_kalender,'F',sollzeit, ...md.tagessoll)`), further scaled
by a part-time factor (`FnTeilzeitReduktionsFaktor`).

### 1.6 Pausen (breaks): paid vs unpaid

Two layers:

1. **Default per-block pause** — `DIENST_DETAIL.pause_start/ende/dauer/stempeln{1,2,3}`
   (whether the break must be stamped) — the implicitly-unpaid break window baked
   into each block, plus `pausenprofil{1,2,3}` FKs to a separate **Pausenprofil**
   definition (graduated break minutes by shift length).
2. **Paid-break exceptions** — `DIENST_BEZAHLTE_PAUSE` (`main_ecbern.sql:968-976`:
   `dienst_bezahlte_pause_id`, `dienst_detail_id`, `block_nr`, `beginn`/`ende`
   seconds). A list of sub-intervals within a block that count as **paid** despite
   being a break — an override on top of the default (unpaid) windows.
   `IDienstBezahltePause`/`…List` (`intfDstDet.pas:144-180`).

### 1.7 Dienstkürzel, icon, and colour

No dedicated short-code field exists distinct from the name; a Dienst's
on-screen identity is its **Titel** (global) or **lokale Bezeichnung**
(`DIENSTPALETTE.name`), plus its **icon** (`icon_ganz`/`icon_halb`) and **colour**
(`icon_color_fg`/`_bg`). The `hkShortCut: THotKey` field ("Tastaturkürzel,"
`fDienstGlobalSettings.dfm:197-207`, `DIENSTPALETTE.shortcut`) is a literal
keyboard hot-key, not a text abbreviation.

Because the palette icon lists are owner-drawn, PEP keeps a **composite icon
cache**: `DIENST_ICONCACHE` (`main_ecbern.sql:1228-1236`) has `icons_ganz`/`icons_halb`
(single packed sprite-sheet bitmaps for _all_ Dienste), an `info` CLOB with an
XML index mapping each Dienst to its position in the sheet
(`cbildbox.pas:506-530`), and a `version_id`. `trigger_dienst_iconcache.sql`
stamps a fresh `version_id` on every change; clients compare their cached
version and only re-download when stale (`cbildbox.pas:237-268`) — sprite-sheet +
cache-bust.

### 1.8 Category/classification links (full definitions in §2)

- `DIENST.dgruppen_id` → `DIENSTGRUPPE.id`
- `DIENST_DETAIL.Kategorie_ID` → `DIENST_KATEGORIE.ID`
- `DIENST_DETAIL.dienst_schichttyp_id` → `DIENST_SCHICHTTYP.dienst_schichttyp_id`
- `DIENST.pomaschichttyp` — closed hard-coded POMA enum, **not** FK'd to `DIENST_SCHICHTTYP`.

### 1.9 Zulagen (allowances) — attachment point (mechanics in §5)

`DIENST_DETAIL` carries **four** allowance-profile FKs:
`monatslohn_zulagenprofil` / `stundenlohn_zulagenprofil` (base profile for
monthly- vs. hourly-paid staff) and `mod_monatslohn_zulagenprofil` /
`mod_stundenlohn_zulagenprofil` (used when the shift was "überplant"/modified)
— `main_ecbern.sql:1002-1005`; UI at `f_dstdef.dfm:707-774`. Selection logic:
`IDienstDetailItem.GetZulagenProfilId(pLohnStatus, pZulagenprofilModifiziert)`
(`intfDstDet.pas:457`).

### 1.10 Planning attributes ("counts toward Bedarf" etc.)

- `DIENST.planbar` — coarse "plannable at all."
- `DIENST_DETAIL.stellenplan_wirksam` / `Entlastung_Stellenplan` — affects
  Stellenplan (staffing-establishment) accounting (`f_dstdef.dfm:574-589`,
  `intfDstDet.pas:443`; consumed by `Fstrech.pas:368-411`).
- `DIENST_DETAIL.ZAEHLT_ALS_BESTAND` — "counts as headcount/Bestand"
  (`main_ecbern.sql:1212`, `f_dstdef.pas:199-200`).
- `DIENST_DETAIL.indikator_relevant`, `tacs_relevant` — feeds overtime-indicator
  and TACS calculations respectively.
- **`PP_DIENST_PARAMETER`** (`main_ecbern.sql:6164-6181`): FK to a Planblatt-Profil
  (`pp_id`), `pa_code`, and six T/F flags (`planung`, `bedarf/bestand/deckung_einzeln`,
  `bedarf/bestand/deckung_total`). **Per-Planblatt-profile report config** —
  whether a Dienst is broken out individually or only folded into the total row
  of the print-out (`uDefinitionPlanblattPrint.pas:469`). Not a Dienst attribute.
- **`DIENSTAUSWAHL_DETAIL`** (`main_ecbern.sql:1302`, PK `(pa_code, sp_nummer)`):
  membership of a Dienst in a saved "selective plan" (`SELEKTIVER_PLAN`) display
  filter (`selPlan.pas:469`). A display-filter table, not shift semantics.

### 1.11 Night/on-call (Pikett) at the data level

- `DIENST.typ = 'I'` marks a Dienst as fundamentally Pikett (on-call) — one of
  the three icon-list tabs on `TfrmDienstMain` (`f_dsthpt.dfm:109-155`).
- `DIENST_DETAIL.pikett_praesenz` — whether Pikett time also counts as Präsenz.
- `DIENST.pikettzusatz` ("Piketteinsatz (mobile App)") — marks a **Präsenz** Dienst
  as usable as a mobile on-call marker; mutually exclusive with `planbar`
  (`fDienstGlobalSettings.pas:445-446`).
- `DIENST.PikettRegeln` — only enabled for `typ='I'`; gates on-call planning rules.
- **The "Ganz | Links | Rechts | Pikett" palette radios (`PEP-UI-MAP.md`) are NOT
  a Dienst property** — they set the `dienstposition`/`TDienstPos` value
  ('G'/'L'/'R'/'P') of a **planning entry** (§12). **G**anz = whole shift,
  **L**inks/**R**echts = left/right half of a splittable Dienst (gated by
  `DIENST_DETAIL.dienst_teilen`), **P**ikett = on-call marker. Confirmed by
  `GetDienstIntGrenzen.sql:84-99` and `fnZeitNachDienstdefinition.sql:38-91`.
- **`PIKETTAUSLASTUNG_DIENSTE`** (`main_ecbern.sql:4314-4319`): `pa_profil_id`,
  `pa_code`, `is_einsatzcode` (T/F). Tells the utilization engine
  (`CalcPikettAuslastung.sql`) which codes are the **on-call shift itself**
  (`is_einsatzcode='F'`) vs. an **Einsatzcode** (an actual callout, `'T'`) for a
  given profile — used for weighted on-call utilization minutes.

### 1.12 Wochentag (day-of-week) applicability — not found

No field on `DIENST`/`DIENST_DETAIL`/`DIENSTPALETTE`, and no control on any
Dienst editor, restricts a Dienst to specific weekdays (`grep -a wochentag` over
`pep/*.pas` only hits generic calendar/report utilities). **A Dienst has no
built-in weekday restriction**; weekday constraints, if any, live in separate
"Planungsregeln" definitions (out of scope). Flagged checked-but-not-found.

---

## 2. Dienstgruppe, Dienstkategorie, Dienst-Schichttyp

At the data level **Dienstgruppe** and **Dienst-Schichttyp** are both simple
binary night-shift classifiers used for allowance/rotation-compliance
calculations — not general-purpose display groupings. **Dienstkategorie** is the
one that mirrors the Präsenz/Absenz/Pikett split and drives reporting roll-ups.
All three are thin, node-scoped code tables going through the generic
`TfrmDefinitionList`/`TfrmDefinitionEditor` pattern (SOURCE-NOTES §1) with a tiny
custom detail frame each.

### Dienstgruppe — `DIENSTGRUPPE` (`main_ecbern.sql:1315-1322`)

`id` PK, `titel` (30), `code` (32), `knoten_id`, and **`typ` CHAR 'A'/'N'**:
**A** = "Übrige" (other), **N** = "Nachtdienstgruppe" (night-shift group) —
radios `rbNachtdienstGruppe`/`rbUebrige` (`frDefDienstGruppe.dfm:17-34`,
`.pas:59-69`). Editor `TDienstGruppeEditor` (`EdDienstGruppe.pas:38-58`,
`fTableName := 'dienstgruppe'`). `DIENST.dgruppen_id` tags each Dienst
"night-group" or "other" for downstream night-work/rotation math.

### Dienstkategorie — `DIENST_KATEGORIE` (`main_ecbern.sql:1245-1252`)

`ID` PK, `name` (80), `code` (32), `knoten_id`, and **`typ` CHAR 'P'/'A'/'I'**
(radios `rbPraesenz`/`rbAbsenz`/`rbPikett`, `frDefDienstKategorie.dfm:17-42`) —
mirrors `DIENST.typ`. Editor `TDienstKategorieEditor` (`EdDienstKategorie.pas:38-58`).
`DIENST_DETAIL.Kategorie_ID` links a node/date-versioned detail (not the global
Dienst) to one category — so a Dienst can be re-categorized per node/date. Used
for statistics roll-ups (`P_Dienstkategorie.sql`, summing planned time per
employee/category) and surfaced as "Dienstkategorie für Auswertungen:"
(`f_dstdef.dfm:790-805`). Lets admins bucket distinct Dienste ("Frühdienst
Station A/B") under one reporting category, independent of Gruppe/Schichttyp.

### Dienst-Schichttyp — `DIENST_SCHICHTTYP` (`main_ecbern.sql:1274-1281`)

`dienst_schichttyp_id` PK, `titel` (30), `code` (32), `knoten_id`, and **`typ`
'A'/'N'** (again "Übrige"/"Nachtdienstschichttyp," `frDefDienstSchichtTyp.dfm:19-36`).
Editor `TDienstSchichtTypEditor` (`EdDienstSchichtTyp.pas:36-57`), right-checked
under `PS_ABRECHNUNG_DIENSTSCHICHTTYP` (billing function group). `DIENST_DETAIL.dienst_schichttyp_id`
links a detail version; surfaced on the "Schicht-Wechselschicht-Berechnung"
group ("Dienstschichttyp:", with "aus Sollplan bestimmen," `f_dstdef.dfm:836-866`).

So Dienstgruppe and Schichttyp are structurally identical `A`/`N` night-flag
tables (Gruppe hangs off global `DIENST`, Schichttyp off per-node `DIENST_DETAIL`),
both feeding the matrix below.

### Dienstgruppen-Schicht-Matrix — `DIENSTGRUPPENSCHICHTMATRIX` (`main_ecbern.sql:1346-1354`)

`id`, `dienstgruppen_id` → `DIENSTGRUPPE`, `schicht_ccode` (scopes the row to one
Wechselschichtprofil), `sign` CHAR(2) (`=`,`>`,`<`,`>=`,`<=`), `value` NUMBER,
`dienst_schichttyp_id` → `DIENST_SCHICHTTYP`. This is **embedded inside the
Wechselschichtprofil editor** `TfrmWsProfilEingabe` (`fwsprof.pas`): the group
box `gbDienstGruppenSchichtMatrix` hosts a `tdgsmStringGrid` parented into it
(`fwsprof.pas:449`), form checked under `PS_ABRECHNUNG_WECHSELSCHICHTPROFIL`;
sibling tabs are captioned "Nachtarbeit"/"Schichtarbeit." It's the rule table a
Wechselschichtprofil uses to decide, per (Dienstgruppe × Schichttyp) combination

- a `sign`/`value` comparison, whether a rota pattern qualifies for
  night-work/shift-work compliance/allowance treatment (Swiss Arbeitsgesetz-style).
  Exact evaluation of `schicht_ccode`/`sign`/`value` **(inferred** from embedding
  context, not traced into `TwsProfilHandler`**)**.

---

## 3. Blockkategorie

A **Blockkategorie** is an optional, user-defined tag stamped onto a Block or
Zeitsumme (e.g. "Notfall," "Elektiv") purely for grouping/reporting — a secondary
classification on top of a block, not the block's identity (that's the PA-Code,
§4).

**Table `BLOCKKATEGORIE_DEF`** (`main_ecbern.sql:547-563`):

| Column           | Type          | Notes                                                                                                                                                                                                                                            |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BLOCKKATDEF_ID` | NUMBER        | PK                                                                                                                                                                                                                                               |
| `DIENSTTYPE`     | CHAR(1)       | baseline `CHECK` allows `('A','M')`, but the runtime (`uDefinitionBlockkat.pas:126-132`) reads `'A'`→Absenz, `'I'`→Pikett, else→Präsenz — a **discrepancy** where a later migration altered the constraint; treat runtime P/A/I as authoritative |
| `KURZBEZ`        | VARCHAR2(15)  | short code (combo label)                                                                                                                                                                                                                         |
| `BEZEICHNUNG`    | VARCHAR2(256) | long title                                                                                                                                                                                                                                       |
| `AKTIV`          | CHAR(1) T/F   | soft-delete — `DbDelete` sets `'F'` (`uDefinitionBlockkat.pas:65-88`); never hard-deleted                                                                                                                                                        |
| `COLOR`          | NUMBER        | `TColor` int for legend/print                                                                                                                                                                                                                    |
| `KNOTEN_ID`      | NUMBER        | org scope                                                                                                                                                                                                                                        |

Domain object `IBlockkatItem` (`intfBlockkateg.pas:7-25`) mirrors the table;
`TDefBlockkat` (`uDefinitionBlockkat.pas:9-32`) has a `DienstArt: TCodeArt`
restricting which of Präsenz/Absenz/Pikett it applies to (radios in
`frDefBlockkat.pas:12-18`), edited under **Definitionen → Blockkategorie**.

**Usage on blocks**: `BLOCK.BLOCKKAT_ID` (`main_ecbern.sql:526`) and
`ZEITSUMME.blockkat_id` (`main_ecbern.sql:8388`) are nullable FKs. In the
Stempeleditor block-edit dialog (`fStampEditorBlock.pas`), the `cbBlockkategorie`
combo is populated from `dstAssDatMod.qBlockkategorie` and assigned
independently of the PA-Code (`edBlockPaCode`) — confirming Blockkategorie and
PA-Code are two orthogonal columns on the same Block row.

---

## 4. PA-Codes / Präsenzarten

There is **no single "PA-Code"/"Präsenzart" master table.** `pa_code` is a
shared numeric identifier space that dozens of tables reference; the
Stempeleditor's "PA-Code" column is a rendering over that space, backed mainly by
one real definitions table (`DIENST`) plus a few hardcoded sentinels.

**No dedicated table**: `TEMP_PA_CODES` (`main_ecbern.sql:7545-7552`) is just an
Oracle `GLOBAL TEMPORARY` scratch table. A full scan of `-- TABLE:` markers finds
no `PACODE`/`PRAESENZART`/`AKTIVITAET` definitions table.

**`DIENST` is the de-facto master** (`main_ecbern.sql:927-960`) — and
**`pa_code` _is_ its primary key**. The `typ` column (`CHECK IN ('P','A','I')`)
is the fundamental 3-way split reused everywhere (`BLOCK.DIENSTTYPE`,
`ZEITSUMME.diensttype`, `DIENST_KATEGORIE.typ` share the same domain), modeled as
`TCodeArt = (caUnbekannt, caPraesenz, caAbsenz, caPikett, caZulage,
caJahreszeitmodell)` (`pepTypes.pas:89`), converted via `CodeArtToStr`/`StrToCodeArt`
(`pepConvert.pas:534-540,1398-1412`): `caPraesenz→'P'`, `caAbsenz→'A'`,
`caPikett→'I'` (note: Pikett is stored `'I'`, a historical quirk),
`caZulage→'C'`, `caJahreszeitmodell→'J'`. (`ZEITANRECHNUNG.Codeart` also allows
`'S'`, with no matching `TCodeArt` — likely legacy.)

So **Präsenz** (typ `P`, e.g. `111`/"Dienst A"), **Absenz** (typ `A`, e.g.
`501`/Ferien), **Pikett** (typ `I`) are all just `DIENST` rows distinguished by
`typ` — one unified table. Per-node overrides live in `DIENST_DETAIL`;
`GetDienstArt(paCode)` resolves a code's `TCodeArt` from `DIENST_DETAIL.DienstArt`
for the date/node (`uBlock.pas:436-447`).

**The same `pa_code` is the join key for a code's other facets**:
`GUTHABENPROFIL.pa_code`, `DEF_GUTHABEN.pa_code` attach balance behaviour;
`FERIENANSPRUCH(pa_code, fa_alter, Ferientage)` attaches age-based vacation-day
entitlement. This is why `501` ("Ferien") is simultaneously a `DIENST` row
(typ `A`), a `GUTHABENPROFIL`, and a `FERIENANSPRUCH` entry — one code, several
tables each contributing a facet. `frGuthabenConvPACodes.pas` treats
`FGuthabenProfil.PACode` (line 139) as a plain integer from this space.

**Hardcoded negative sentinels** (no DB row) in `pepTypes.pas:24-27`:

| Constant                     | Value | Meaning                                                                                                                                                                  |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cIntCodeUngeplantePraesenz` | -1    | Ungeplante Präsenz — **the live "U"** (`rs_sCodeUngeplantePraesenz='U'`, `Strres.pas:1241`), rendered by `GetBlockPACode`/`GetBlockTitle` (`fStampEditor.pas:9880-9919`) |
| `cIntCodeSollzeitergaenzung` | -5    | Sollzeitergänzung (target-time top-up)                                                                                                                                   |
| `cIntFixSaldoCode`           | -9    | Saldo-Festschreiben (frozen-balance correction; canton-specific)                                                                                                         |
| `cPauseBlockPACode`          | -10   | Pause sub-block                                                                                                                                                          |

**`FEHLZEIT` carries its own `PaCode`** (`main_ecbern.sql:1660`), separate from
`DfIdFehlzeitTyp`: two independent axes — `DfIdFehlzeitTyp` is the absence
_reason_ ("Grund," via the generic "Df" framework, `delphi/rap/iiDf.pas`),
`PaCode` is _how it's counted/rendered_ (which `DIENST(typ='A')` governs its
Blocks). "Why" and "how counted" are deliberately decoupled.

**Bottom line**: the "PA-Code" column is a union of (a) one shared `DIENST`-keyed
space covering P/A/I uniformly (reused as the join key into
`GUTHABENPROFIL`/`DEF_GUTHABEN`/`FERIENANSPRUCH`), and (b) a few hardcoded
negative sentinels. `TPACodeList.GetName` (`stampEditorUtils.pas:456-500`)
literally does `SELECT NVL(dp.name, d.titel) FROM dienst d, dienstpalette dp
WHERE d.pa_code = :pa_code …` — the shared lookup that makes the union invisible.

---

## 5. Zulagen / Zulagenprofil

A **Zulage** is a pay/time supplement (night/Sunday/holiday bonus, on-call
inconvenience allowance, travel-time comp). It is not a standalone table — it is
realized as a **Lohnart** (§6) credited via a **Zulagenprofil** (`ZULAGENPROFIL`),
a bundle of time-of-day/day-type trigger rules (`ZULAGENABSCHNITT`) plus flat
supplements (`ZULAGENPROFIL_DETAIL`). A Zulagenprofil is assigned **per Dienst**
(§5.4). A parallel Wechselschicht engine (`WS_ZULAGEN_PROFIL`) is assigned per
employee.

### 5.1 Core tables

**`ZULAGENPROFIL`** (`main_ecbern.sql:8589-8595`): `id` PK, `titel`, `system`
(T/F), `knoten_id` (default -2 = global).

**`ZULAGENPROFIL_DETAIL`** (`main_ecbern.sql:8605-8617`, PK `(zulagenprofil_id,
gueltig_ab)`) — one date-effective row per profile:

- `spezial_dauer`/`spezial_ccode`/`spezial_art` (D/E) — **Wegzeitentschädigung**
  (travel-time comp): a flat duration to `spezial_ccode`, once per Dienst (`D`)
  or per Einsatz/check-in (`E`) (`Getccodewegzeitvalue`, `Zulagen.sql:172-268`).
- `zeitsummen_ccode` — a flat Zeitsumme credited straight to this code
  (`Getccodetimesumvalue`, `Zulagen.sql:131-170`).
- `Zeiterg_Dauer`/`ZeitErg_CCode`/`Zeiterg_Art` — **Zeitergänzung**: rounds
  worked time up to ¼/½/1h and credits _only the rounding remainder_
  (`Getccodezeitergvalue`, `Zulagen.sql:1474-1577`).

**`ZULAGENABSCHNITT`** (`main_ecbern.sql:8571-8579`) — a time-of-day window on a
day-category where a Lohnart applies. PK `(zulagenprofil_id, gueltig_ab,
datumskategorie_id, beginn, ende, ccode)`:

- `datumskategorie_id` → `DATUMSKATEGORIE` (day-type: weekday groups,
  Sonntag/Feiertag)
- `beginn`/`ende` — seconds-since-midnight window (e.g. 22:00–06:00 night)
- `ccode` — the Lohnart applied during overlap
- `freizeitausgleich_ccode` — alternate Lohnart for comp-time instead of cash

A profile holds many Abschnitt rows (different Lohnart per weekday-type ×
time-window), edited via a time-slice grid, one tab per `DATUMSKATEGORIE`
(`uzuab.pas:415-518`).

### 5.2 Editor architecture &amp; naming trap

The **Zulagenprofil editor is bespoke**, NOT the generic Definitionen pattern:
`Tfrmzuprdet`/`Tfrmzuprmod`/`Tfrmzuprans` (`fzuprdet.pas`/`fzuprmod.pas`/
`fzuprans.pas`), helpers `uzupr.pas`/`uzuab.pas`, datamodule `dmzupr.dfm`.

**Naming trap** (confirmed): the files named "Zulage*" actually implement the
**Lohnart** domain, not a Zulage entity — `intfZulage.pas:22-88` declares
`ILohnart`/`ILohnartDetail`/`ILohnartKontoAnrechnung`; `EdZulage.pas:11,41` is
`TLohnartEditor` (`fTableName := 'lohnart_profil'`); `EdZulagenVariante.pas`
(`fTableName := 'lohnart_kategorie'`) — "Zulagenvariante" is the UI name for
`LOHNART_KATEGORIE` (§6.3). So the `EdZulage*`/`intfZulage*`/`frDefZulagenVariante`/
`fZulagenVarianteItem` files are Lohnart editors historically named "Zulage*".

### 5.3 Assignment: per Dienst, 4 slots

A Zulagenprofil is assigned on the **Dienst-Detail** record, 4 independent slots
(`f_dstdef.pas:365-375`, combos `cbMonatslohnZP`/`cbStdLohnZP`/`cbMLZPmod`/
`cbSLZPmod`): one for **Monatslohn** (salaried) vs **Stundenlohn** (hourly)
employees, each with a **"…mod"** variant for individually-modified shift
instances. Resolution: `TDienstDetailItem.GetZulagenProfilId(pPaCode, pDatum,
pKnotenId, pLohnStatus, pZulagenprofilModifiziert)` (`udstdet.pas:2857,3865-3876`).
By contrast the Lohnart-Kategorie ("Zulagenvariante," §6.3) redirection is
assigned per employee via `MITARBEITER_DETAIL.ccode_kategorie` (`main_ecbern.sql:3527`).

### 5.4 `WS_ZULAGEN_PROFIL` — WS = Wechselschicht (confirmed)

Confirmed from `fSelect_WS_Zulagen_Profil.dfm:4` (`Caption =
'Schicht-Wechselschicht: Zulagendefinition wählen'`). A separate rotating-shift
allowance engine, parallel to `ZULAGENPROFIL`:

- **`WS_DEF_ZULAGEN_PROFIL`** header (`main_ecbern.sql:7762-7766`): `WS_PROFIL_id`,
  `WS_Bezeichnung`, `WS_Aliascode`.
- **`WS_ZULAGEN_PROFIL`** rule rows (`main_ecbern.sql:7809-7829`): `titel`,
  `prioritaet`, `dauer`/`dauer_art` (W=Woche/T=Tag/S=Schicht), `nachtzeit`,
  `schicht_pruefung`(`_vormonat`/`_2PERIODEN`), `nachtschicht_sequenz_pruefung`,
  `stempelzeiten_verwenden`. Matches `TWSZulageDefinition` (`WSProfil.pas:8-51`).
- Assigned **per employee** via `MITARBEITER_DETAIL.ws_profil_id` (`main_ecbern.sql:3585`).
- `WS_RESULTATE` (`main_ecbern.sql:7787-7800`) stores computed per-day results,
  kept separate from `ZEITANRECHNUNG`.

**`ZUrlaub_WS_Zulagen_Profil`** (`main_ecbern.sql:8716-8723`) links a
Zusatzurlaub scenario to a `WS_Zulagen_Profil_Id`, tagged `IsWechselSchicht`/
`IsSchicht` — whether working under that profile counts as rotating-shift or
plain shift work for extra-vacation entitlement.

### 5.5 The Zulagen → Lohnart computation chain (per-day "Abrechnung")

Driven from `procs/Zulagen.sql`, working against a `TEMP_CCODEVALUES` scratch
table keyed `(sessionid, ccode)`:

1. **`Getccodevalues`** (`Zulagen.sql:39-123`) — for a time interval, finds
   overlapping `ZULAGENABSCHNITT` rows (matching profile + `datumskategorie_id`,
   latest `gueltig_ab` ≤ day) and accumulates _overlap seconds_ onto `ccode` (or
   `freizeitausgleich_ccode` if comp-time requested) via `Addccodevalue`.
2. Flat additions: `Getccodetimesumvalue` + `Getccodewegzeitvalue` (§5.1).
3. **`TreatLohnartKategorie`** (`Zulagen.sql:408-1151`) — the redirection engine
   (= "Zulagenvariante"/`LOHNART_KATEGORIE_DETAIL`, §6.3): re-keys accumulated
   values from `ursprung_ccode` to `ziel_ccode` when a condition holds; logs to
   `REPORTLOHNARTUMLEITUNG` (`reportProcs.sql:62-75`).
4. **`Getzulagenzeitanrechnung`** (`Zulagen.sql:1154-1471`) — for each remaining
   `ccode`, applies its `LOHNART_DETAIL` recipe: `ZEIT = FAKTOR × value`, clamped
   `[MINIMUM, MAXIMUM]`, optionally rounded up (`Aufrunden`), age-band gated
   (`AB_ALTER`/`BIS_ALTER` + `WECHSEL_AB/BIS` anchor). Result → **`ZEITANRECHNUNG`**,
   credited to `LOHNART_DETAIL.ZEITKONTO_ID`.
5. Eligibility: **`CheckMitarbZulageBerechtigung.sql`** reads the latest
   `MITARBEITER_DETAIL` — `INKONVENIENZBERECHTIGUNG='T'` (eligible at all) and
   `INKONVENIENZ_SALDOWIRKSAM='T'` (affects GLAZ balance). Ineligible employees
   have `GLAZ_ZULAGE='T'` bookings stripped (`Clearglazzulage`, `Zulagen.sql:361-405`).
6. **`GetCodeKontoZulagenZeiten.sql`** sums, for a code/Zeitkonto/period, the net
   `ZEITANRECHNUNG.ZEIT` (credit `AN_ZEITKONTO`, debit `AB_ZEITKONTO`, `-1` = null
   account) plus `GRUNDZEIT` — account-balance rollups.

### 5.6 Surfacing in the Stempeleditor

Zeitanrechnungen grid column constants (`fStampEditor.pas:111-120`): `Titel(0),
Code(1), Aufgabe(2), Kategorie(3), Grundzeit(4), Istzeit/"Istzeit, Zuschläge"(5),
Geplant(6), Saldo(7)` (+ Mehrzeit/Mehrzeit_Dienstlich). A row is a Zulage line
when `ZAItem.CodeArt in [caZulage, caJahreszeitmodell]` (`ZEITANRECHNUNG.CODEART
IN ('C','J')`): **Code** shows the Lohnart alphacode (`uLohnArtProf.pas:71-82`),
**Kategorie** the Kostenstelle, **Grundzeit**/**Istzeit** map to
`ZEITANRECHNUNG.GRUNDZEIT`/`.ZEIT`.

### 5.7 Reporting tables

- **`REPORTZULAGENEINTRAG`** (`main_ecbern.sql:6579-6594`): printed-sheet row
  family (`BlattNr`/`ZeilenNr`, shared with `REPORTSTEMPELEINTRAG`/`REPORTZEILE`/
  `REPORTDIENSTEINTRAG`); populated Delphi-side from `dmReport.dfm` **(no proc
  writer found)**.
- **`REPORTZEITSUMMENZULAGE`** (`main_ecbern.sql:6561-6569`): written by
  `saveZeitsummenZulage`(`'S'`)/`saveAbweichung`(`'A'`)/`saveLPHSTransfer`(`'L'`)
  (`reportProcs.sql:17-60`).

---

## 6. Lohnarten (wage types / payroll)

A **Lohnart** is a payroll wage-type code — a payslip line item (base salary,
overtime, night bonus). `LOHNART_PROFIL` is the master list; `LOHNART_DETAIL`
holds the date-effective rate recipe; `LOHNART_KATEGORIE`/`_DETAIL` (UI name
"Zulagenvariante") is a redirection engine.

### 6.1 `LOHNART_PROFIL` / `LOHNART_DETAIL`

**`LOHNART_PROFIL`** (`main_ecbern.sql:3058-3072`): `ccode` PK, `titel`,
`alphacode`, `system` (T/F), `Schichtcode` (T/F, gated by
`PEPOptions.EnableWechselschicht`), `Jahreszeitcode` (T/F seasonal), `knoten_id`
(default -2), `virtualfield_offset` (calculated-field slot), `PPBVAusfall` (T/F).

**`LOHNART_DETAIL`** (`main_ecbern.sql:2954-2965`, PK `(ccode, id, gueltig_ab)` —
`id` distinct from `ccode` means **one Lohnart can carry several parallel
Konto-Anrechnung rules per date**, per `ILohnartDetail.KontoAnrechnungCount`,
`frDefLohnart.pas:132-146`):

| Column                                      | Meaning                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `faktor`                                    | rate, e.g. `1.25` for a +25% surcharge; **positive = Zuschlag, negative = Abzug** (`fLohnartBonus.pas:86-89`) |
| `minimum`/`maximum`                         | clamp bounds (seconds)                                                                                        |
| `Aufrunden`                                 | 0 none, 1 ¼h, 2 ½h, 3 1h (`fLohnartBonus.pas:94-99`; applied `Zulagen.sql:1360-1382`)                         |
| `zeitkonto_id`                              | time-account credited (debited if `faktor<0`)                                                                 |
| `AB_ALTER`/`BIS_ALTER` + `WECHSEL_AB`/`BIS` | age-band gating + anchor date (birthday / start-end of month / year, `TWechsl`, `intfZulage.pas:31`)          |

### 6.2 `LOHNART_KATEGORIE` / `_DETAIL` — "Zulagenvariante" redirection engine

**`LOHNART_KATEGORIE`** (`main_ecbern.sql:3019-3024`): `id`, `titel`, `code`,
`knoten_id` — a named ruleset, assigned per employee via
`MITARBEITER_DETAIL.ccode_kategorie`.

**`LOHNART_KATEGORIE_DETAIL`** (`main_ecbern.sql:3037-3048`, PK `(kategorie_id,
ursprung_ccode, ziel_ccode, WERT, ZAEHL_CCODE)`): "if `ursprung_ccode` meets a
condition, redirect to `ziel_ccode`":

| Column                | Meaning                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KRITERIUMID`         | condition family (`fZulagenVarianteItem.dfm:189-197`): 0 keine, 1 Datum Sollplan-Sicherung, 2 Wert des Ursprungscodes, 3 EAN-Code, 4 gestaffelte Lohnart, 5 Markierungen, 6 gestaffelte Lohnart mit Zähl-Lohnart, 7 gearbeitete Wochenenden im Kalenderhalbjahr |
| `ARTID`               | sub-kind (Diff-Wochen zum 1./Vormonat/Planungsdatum, Dauer-Stunden, Text, Anzahl, Markierungen)                                                                                                                                                                 |
| `OPERANDID`           | operator `<,>,=,<=,>=,<>`                                                                                                                                                                                                                                       |
| `WERT`                | comparison value (string, parsed per ARTID)                                                                                                                                                                                                                     |
| `TEILZEIT_ALTERNATIV` | T/F invert threshold for part-time                                                                                                                                                                                                                              |
| `ZAEHL_CCODE`         | counting Lohnart for tiered thresholds (Kriterium 6)                                                                                                                                                                                                            |

Evaluated by **`TreatLohnartKategorie`** (`Zulagen.sql:408-1151`) per
employee/day: dispatches on `KRITERIUMID` (`fBedDatumSollplanSicherung`,
`fBedWertUrsprungscode`, `fMarkierungVorhanden`, `fBedGestaffelteLohnartNeu`
counting on-call shifts in a rolling window with part-time-proportional
thresholds, `fGearbeiteteWochenendenHalbjahr`, …). When true, moves the value
origin→target and logs to **`REPORTLOHNARTUMLEITUNG`** (`main_ecbern.sql:6462-6469`:
`SESSIONID, MITARBEITERID, DATUM, LOHNARTKATID, URSPRUNGSCODE, ZIELCODE`). Live
mechanism (changelog 2021–2026).

### 6.3 `LOHNART_GRENZE` — naming trap: NOT a per-Lohnart cap

`LOHNART_GRENZE` (`main_ecbern.sql:2989-2995`: `id, zeitkonto_id, UNTEN, OBEN,
FARBE`) has **no `ccode` column** — it's edited via the **Zeitkonto** definition
dialog (`TZeitkontoGrenze`/`IZeitkontoGrenze`, `uDefZeitkonto.pas:9-63`, reads
`lohnart_grenze where zeitkonto_id = :id order by unten`). It defines **coloured
threshold bands for a Zeitkonto's balance** (`UNTEN`/`OBEN`/`FARBE`), consumed by
`uPlbFieldBgColor.pas:256` to colour-code the Saldo display. A UI display feature
under a legacy table name. (`fLohnartLimite.pas` is a _different_ concept —
`IAbweichungLimite`, a Lohnart-keyed max-working-time limit in the **Abweichung**
domain, `LimitenTyp`/`PeriodenTyp`.) `tabelle_lohnart_grenze.SQL` is only the
sequence-nextval helper.

### 6.4 Payroll-export tables

- **`REPORTDIENSTEINTRAG`** (`main_ecbern.sql:6432-6438`): print/export sheet row
  from a Dienst (`sessionid, BlattNr, ZeilenNr, position, pacode`); Delphi-populated.
- **`ZUrlaub_Lohnart`** (`main_ecbern.sql:8627-8631`, PK `(ZUrlaub_ProfilId, ccode,
ListTyp)`): links a Zusatzurlaub scenario to Lohnart codes; `ListTyp` = an
  include/exclude discriminator **(unconfirmed exact values)**.
- **`GetLohnartenChange.sql`**: detects whether `MITARBEITER_DETAIL.LOHNART` (the
  `'M'`/`'S'` Monatslohn/Stundenlohn pay-basis flag, not a `ccode`) changes inside
  a period — a mid-period pay-basis change forcing a payroll-period split.
- **Export contract**: no dedicated Lohnart export XSD/WSDL exists under
  `shared/schnittstellen/` (only `Export_Personalstammdaten`/`Export_Dienstplanung`/
  `tacs`); `Personaldaten_Query.sql:35` surfaces `md.lohnart AS lohnbasis` (the
  M/S flag), not computed amounts. Computed Zulagen/Lohnart values leave PEP via
  the `REPORT*` tables (print/payroll interface not in this schema tree).

---

## 7. Guthabenprofil

A **Guthabenprofil** ("credit profile") defines the _rules_ for how a
balance/entitlement account (vacation days, overtime hours, GLAZ/flexitime)
accrues, carries over, and expires — separate from the _instance_ for a given
employee. Canonical vocabulary everywhere: **Anspruch** (entitlement) −
**Bezug** (taken) + **Übertrag** (carry-over) = **Saldo** (balance).

**Two parallel systems coexist** (from the trigger/FK graph + a source comment):

|                       | Old style                                                    | New style ("n-Guthaben")                           |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| Profile/definition    | `GUTHABENPROFIL` (PK `pa_code`, hard FK to `DIENST.pa_code`) | `DEF_GUTHABEN` (own `id`) + `_DETAIL` + `_REGELN`  |
| Per-employee instance | `GUTHABEN`, `GUTHABEN_AKTIVE_PER`/`_PASSIVE_PER`             | `MITARBEITER_GUTHABEN`, `_KORR`, `GUTHABEN_SALDO`  |
| Default per node      | `MITARBEITER_DEF_OLDSTYLEG(knoten_id, pa_code)`              | `MITARBEITER_DEF_GUTHABEN(knoten_id, guthaben_id)` |

"Definitionen → Guthabenprofil" edits **`DEF_GUTHABEN`** (`EdGuthabenProfil.pas:88`,
`fTableName := 'def_guthaben'`). The transition is still live: `fnGuthabenUebertragStd.sql:52-59`
("keine neue Guthaben, alte Guthaben benutzen") falls back to the legacy
`GUTHABEN` table with old `GUTHABENPROFIL` carry-over limits when no
`MITARBEITER_GUTHABEN` row exists.

### 7.1 `DEF_GUTHABEN` — the account/pot definition (`main_ecbern.sql:816-829`)

| Column               | Type         | Meaning                                                                                                                               |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | NUMBER PK    | own sequence                                                                                                                          |
| `code`, `titel`      |              | e.g. "Ferien", "GLAZ", "Überzeit" — **no fixed enum of account kinds**; each `DEF_GUTHABEN` row _is_ a distinct account type          |
| `typ`                | VARCHAR2(50) | in DDL but never read — **(vestigial)**                                                                                               |
| `pa_code`            | NUMBER       | the Dienst/absence-code whose bookings draw down this account                                                                         |
| `datumsbezug`        | CHAR `J`/`M` | resets **J**ährlich / **M**onatlich (`TGuthabenDatumsbezug`, `pepTypes.pas:487`)                                                      |
| `einheit_gh_wert`    | CHAR `S`/`T` | tracked in **S**tunden / **T**age                                                                                                     |
| `mitarb_ml_sl`       | SMALLINT     | restrict to Monatslohn/Stundenlohn/either                                                                                             |
| `employment_type_id` | NUMBER       | restrict to one employment type (`-1`/`-2` = none/any); mutually exclusive with lohnstatus-specific (`uGuthabenProfil.pas:1343-1348`) |

### 7.2 `_DETAIL` / `_REGELN` — the versioned accrual formula

**`DEF_GUTHABEN_DETAIL`** (`main_ecbern.sql:848-889`, PK `def_guthaben_id,gueltig_ab`)
— date-versioned settings: `guthaben_formel` (accrual formula, below),
carry-over/expiry limits (`uebertrag_warnung_limite(_tage)`/`_frist`,
`uebertrag_verfall_limite(_tage)`/`_frist`, `verfalluebertrag` T/F = "no
carry-over, expires at year end"), `rundungsart`, pro-rata mode
(`ANSPRUCHREDUZIEREN` 0/1/2), seniority min-vacation checks, priority-profile
chaining (`vorrangige_profile`). **`DEF_GUTHABEN_REGELN`** (`main_ecbern.sql:898-910`,
PK adds `variante,altersabschnitt`) — the **age-bracket entitlement table**: one
row per age/seniority bracket giving `guthaben_wert`/`guthaben_anzahl`.

Enums (`intfGuthabenProfil.pas:17-28`), verified against `fnGuthabenAnspruchStd.sql:88-152`:

| DB                         | Pascal                    | Meaning                                                                          |
| -------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `guthaben_formel='A'`      | `gfAltersregeln`          | age-bracket table drives entitlement                                             |
| `='F'`                     | `gfIndividuell`           | fixed value from `MITARBEITER_GUTHABEN.fixer_anspruch` (not "Feiertag")          |
| `='V'`                     | `gfAnspruchBasisVorjahr`  | function of prior year                                                           |
| `'K'`/`'I'`                | `gfGemaessImport`/…       | allowed by CHECK but **no branch found (legacy/import)**                         |
| `REGELN.variante 'A'/'D'`  | `avAlter`/`avDienstalter` | **A**lter vs **D**ienstalter (seniority)                                         |
| `wechsel_anspruch E/T/M/J` | `TWechselAnspruch`        | when age-entitlement changes: Einmalig / Geburtstag / Anfang Monat / Anfang Jahr |
| `ANSPRUCHREDUZIEREN 0/1/2` | `TAnspruchReduzieren`     | 0 tageweise, 1 monatsweise, 2 nicht                                              |
| `guthaben_eh_regel S/T/W`  | `TEinheitGuthabenWert`    | Stunden/Tage/**W**ochen (age-rule unit can be weeks)                             |

### 7.3 Employee side

- **`MITARBEITER_GUTHABEN`** (`main_ecbern.sql:3684-3704`, PK `mg_id`) — one row per
  employee × `DEF_GUTHABEN` × validity; `initialsaldo(_tage)` (opening balance),
  `fixer_anspruch(_tage)`, `wiederholung`, migration bookkeeping.
- **`MITARBEITER_GUTHABEN_KORR`** (`main_ecbern.sql:3717-3731`) — manual corrections
  vs one `mg_id`: `korrektur_absolut(_tage)` or `korrektur_relativ` (±%) + `kommentar`.
- **`MITARBEITER_DEF_GUTHABEN`** (`main_ecbern.sql:3443`) — default `DEF_GUTHABEN`
  per node so new employees inherit; `MITARBEITER_DEF_OLDSTYLEG` is the old twin.
- **`GUTHABEN_SALDO`** (`main_ecbern.sql:2028-2036`) — point-in-time balance
  snapshots per `(mitarbeiter_id, pa_code, def_guthaben_id)`.
- **`GUTHABEN_AKTIVE_PER`/`_PASSIVE_PER`** — active = session `GLOBAL TEMPORARY`
  working table (employment-degree segments mid-calc); passive = persisted
  suspension periods during which an old-style account doesn't accrue.

### 7.4 Conversion / import / BI (brief)

`GUTHABEN_COMBINATION`/`_CONVERSION`/`_CONVERSION_LOG` back the "Convert" action
(`EdGuthabenProfil.pas:70-81` → `TGuthabenConversionForm`) migrating old pa_code
accounts into new `DEF_GUTHABEN` profiles; `conversiontype 'S'`=ctAll (sum all
sources) vs ctLast (`intfGuthabenConversion.pas:10`). `GUTHABEN_IMPORT`/
`JAHRESGUTHABEN_IMPORT` = flat staging for opening balances; `GUTHABEN_MIGRIERT`
= archival copy of old `GUTHABEN`. `BI_PEP_GUTHABEN_MONAT` (`main_ecbern.sql:364-390`)
= monthly reporting extract (`Zeit_/Tage_ Anspruch/Bezug/Uebertrag/Saldo` — the
canonical four-part vocabulary); `_TEMP_IV`/`_TEMP_MG` = its staging tables.

### 7.5 GLAZ vs. "ohne Zeitkonto" — a Zeitkonto bucket, not an accrual switch

A standalone table `ZEITKONTO` (`main_ecbern.sql:8245-8260`: `id, titel, system,
gemaess_vorgabewert, teilzeitarbeit`) is a **display/reporting bucket** for
Saldokontrolle/Zeitausweis reports, colour-banded via `ZEITKONTO_DEFAULTS`
(`unten/oben/farbe`). Dienst/Lohnart entries tag a bucket via an `an_zeitkonto`
FK (e.g. `ZEITSUMME.an_zeitkonto`, `main_ecbern.sql:8361`). `Strres.pas:1778-1779`
pins the pair: `rs_NullAnkonto = 'ohne Zeitkonto'` and `rs_GLAZ = 'GLAZ'` are
sibling values of one selector; `f_avrhaupt.pas:1336-1339` nails the sentinel —
"kein Zeitkonto zugeordnet … einfach unter 'ohne Zeitkonto', d.h. mit
an_zeitkonto = -1". So **GLAZ = the conventionally-named flexitime bucket**;
**"ohne Zeitkonto" (`an_zeitkonto = -1`) = the fallback bucket** for
Dienst/Lohnart codes never assigned one. This is a reporting/grouping axis, NOT
the on/off switch for whether an employee accrues a balance. The closest thing to
a "tracking off" switch is structural: `DIENST.Guthaben` (T/F) flags whether a
Dienst contributes to Guthaben, and an employee with no
`MITARBEITER_GUTHABEN`/`MITARBEITER_DEF_GUTHABEN` row has no tracked balance
**(inferred** — no "Guthaben disabled" flag on `MITARBEITER_DETAIL`**)**.

### 7.6 Accrual algorithm shape (from procs)

Production pipeline (roster/Stempeleditor): **`fnGuthabenAnspruchStd`**
(entitlement for an interval, branching on `guthaben_formel`, applying
`MITARBEITER_GUTHABEN_KORR` relative/absolute corrections, then `rundungsart`) +
**`fnGuthabenUebertragStd`** (carry-over, legacy fallback, capped by
`pkg_nguthaben.CalcUebertragLimitiertStd`) + **`fnGuthabenVerfallUebertrag`**
(walks `DEF_GUTHABEN_DETAIL` backwards to the last carry-over/expiry cutoff;
no-carry-over profiles expire at year/month start, `fnGuthabenVerfallUebertrag.sql:1-56`)
→ **Saldo = Anspruch − Bezug (+ carried-over)**, where Bezug = actual Dienst
bookings against the account's `pa_code` (`GetSumDienstInSekunden`,
`FnGuthabenSaldo.sql:76-84`). `pkg_guthabenDeLu` supplies average-Beschäftigungsgrad
math for a Luxembourg customization (gated by
`GLOBALEINSTELLUNGEN(GUTHABEN, NEUEGHMITDURCHSCHNITTBG)`).

---

## 8. Hierarchie / Hierarchiedefinitionen

PEP plans against **one** org tree per installation — Space → department →
team-style nodes — **not** several parallel views. What _is_ configurable per
tenant is how many levels the tree has and what each level is called/typed.

### 8.1 Core tables

**`HIERARCHIE`** (`main_ecbern.sql:2105-2119`) — one row per node:

| Column                                                     | Meaning                                                                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `knoten_id`                                                | PK, also FK to a general `KNOTEN` table (`typ='H'` = hierarchy node)                                                                                                                          |
| `vater_id`                                                 | parent node id (self-referencing)                                                                                                                                                             |
| `ebene`                                                    | FK to **`EBENE.id`** — which configured level (`HIERARCHIEPLUS` view joins `h1.EBENE = e1.ID`, `views/HierarchieViews.sql:20`)                                                                |
| `titel`, `titel_lang`, `zusatz_titel(_lang)`, `abkuerzung` | display names                                                                                                                                                                                 |
| `reihenfolge`                                              | sibling sort order (repaired by `FixHierarchieReihenfolge`)                                                                                                                                   |
| `stamm`                                                    | **materialized breadcrumb**, e.g. "PP / Yannicks Space / IT & HR / Internal IT / IT Team 1" — `StammRechnen.sql:1-35` walks `vater_id` via `CONNECT BY` (matches the PEP-UI-MAP path exactly) |
| `generationen`                                             | **materialized Dewey path** of zero-padded sibling positions (e.g. `01-03-02-05`), `GenerationenRechnen.sql:14-26`, for prefix (`LIKE …                                                       |     | '%'`) ancestor/descendant matching without recursive `CONNECT BY` |
| `ebene_index`                                              | contiguous depth = `LENGTH(generationen)/3`                                                                                                                                                   |
| `vater_id_klg`                                             | `NVL(vater_id,-1)` mirror (not a distinct concept)                                                                                                                                            |

**`EBENE`** (`main_ecbern.sql:1410-1415`: `id, name, hierarchieTyp, rang`) is the
**per-tenant catalogue of configured levels** (one row per level, e.g. "Space",
"Bereich", "Gruppe", with a numeric `rang` and a `hierarchieTyp` FK).
**`HIERARCHIETYP`** (`main_ecbern.sql:2154-2157`: `id, typ VARCHAR2(1)`) is **not**
a "hierarchy view" selector — it's a lookup of **node-level kinds**
(`intfNodes.pas:20-23`): `cEbenenTypHauptknoten='S'` (root/Stamm),
`cEbenenTypZwischenknoten='Z'`, `cEbenenTypGruppe='G'` (leaf/team),
`cEbenenTypKategorie='K'`. `THEbene.Typ`/`GetHEbeneByType` (`HierarchFlex.pas:20-52`)
reads it the same way. The `TfFlexHierDef` editor is a single `TVirtualStringTree`
(`fDefFlexHierarchie.dfm:23`) with one popup — **one tree, not several tabs**.

**How many levels?** Not a hard-coded 6. `TNodeRank = TEbenenRang = 0..103`
(`intfNodes.pas:34-37`); the real count = rows in `EBENE`. `Hierarchie6Stufen.sql`
is a **one-time migration** (`IF num = 5 THEN` inserts a 6th 'Betrieb' level for
tenants that had 5), not an architectural constant. Reserved sentinel _ranks_
(query markers, not depths): `cRankHauptknoten=1`, `cRankGruppe=98` (lowest/team,
used by `PlanblattAufrufen`'s min/max selectable rank per SOURCE-NOTES §4),
`cRankKategorie=99`, `cRankAll=cRankMitarbeiter=100`. `GetHierarchieKnotenId.sql:5`
documents one real convention: "Ebene: 1=Spital, 2=Bereich, sonst: Abteilung".

**`HIERARCHIE_VERSION`** (`main_ecbern.sql:2143-2145`, single-row `version_id`) is
an **optimistic-concurrency stamp for the whole tree** — bumped by triggers on
`HIERARCHIE`/`KNOTEN`(typ='H')/`KATEGORIE`/`GRUPPE` (`IncreaseHierarchieVersion.sql:14-47`);
any structural edit invalidates the whole cached tree (`EHierarchieConcurrencyError`,
`HierarchFlex.pas:14`).

### 8.2 Pascal domain model

`TECTreeNode` (`HierarchFlex.pas:60-115`): `father: TECTreeNode`, `id`, `level`
(contiguous depth = `father.level+1`), `rang` (raw `EBENE` rank), `reihenfolge`,
display fields, `kategoriename`/`kategorieTypID`/`ResourceType` (Kategorie nodes
only), `Sons: TObjList` (children), Abschluss/lock-date fields
(`dteSaveAbschlussML/SL`, `bSaveLockLastMonth`, `dteSollplanLast`). **No
`gueltig_ab/bis` on the node** — lifecycle is tracked via the single
`HIERARCHIE_VERSION` stamp. `THierarchieController`/`IHierarchieController`
(`uHierarchieController.pas:80+`) wraps the graph, holding `FFoldingRank`/
`FMaxVisibleRank` to restrict shown/selectable levels (the min/max-selectable-rank
mechanism from SOURCE-NOTES §4). `oldStyleHierarFlex.pas` is explicitly legacy
(`TECHierarchieFlex = class(TCustomTreeView)`, header says use `VirtualStringTree`
instead).

### 8.3 Attachment &amp; integration

Employees attach to a node via `MITARBEITER_DEFAULTS.knoten_id`/`MITARBEITER_DETAIL`
(own `knoten_id` FK); Dienstpaletten attach at the Dienst/Gruppe level the same
way (§1) — both plain FK-to-`HIERARCHIE.knoten_id`, no separate join table.
`FindHierarchieKnoten.sql` resolves a node by external import/export codes (the
hook for mapping an external HR hierarchy onto PEP's tree).

---

## 9. Tagessollraster und Zeitraum

**Tagessollraster** = a reusable named template of daily target hours (Soll) that
repeats over N weeks (e.g. "Woche 1: Mo 8.4h …; Woche 2: Mo 0h …").
**Zeitraum** = a simple named date-range definition (e.g. a reporting/payroll
period), optionally scoped to one hierarchy node.

### 9.1 Tables

- **`TAGESSOLLRASTER`** (`main_ecbern.sql:7381-7386`): `id`, `titel`, `code`,
  `anzahlwochen` (number of weeks in the repeating cycle; single week = 1).
- **`TAGESSOLLRASTER_DETAIL`** (`main_ecbern.sql:7410-7414`, PK `(id, posnr)`):
  `posnr` = day-position across the whole cycle (1‥`anzahlwochen*7`),
  `Sollzeit_Tagessoll` = target seconds for that day. Editor confirms multi-week
  (`rgAnzWochen` → `for w := 1 to AnzahlWochen`, `frDefSollRaster.pas:102,147-149`).
- **`ZEITRAUM`** (`main_ecbern.sql:8320-8329`): `zeitraum_id`, `code`, `title`,
  `knoten_id` (nullable), `zeitraum_von`/`_bis` (fixed DATE range, **not**
  recurring), `Darstellung_ZA` (T/F — appears in Zeitausweis displays,
  `intfDefZeitraum.pas:13,20-22`). No FK links Tagessollraster and Zeitraum —
  independent dimensions.

### 9.2 Editors

Both use the generic `TBaseDefinitionEditor`/`TfrmDefinitionList`+`TfrmDefinitionEditor`
pattern (SOURCE-NOTES §1):

- **Zeitraum**: `EdDefintionZeitraum.pas` → `TDefZeitraumEditor` (`fTableName :=
'ZEITRAUM'`), frame `TframeDefinitionZeitraum` (`frDefZeitraum.pas`), interface
  `IDefZeitraum` (`intfDefZeitraum.pas`).
- **Tagessollraster**: a dedicated editor _does_ exist (just not named literally
  "Tagessollraster"): `EdSollraster.pas` → `TSollrasterEditor` (`fTableName :=
'tagessollraster'`), frame `TframeDefinitionSollraster` (`frDefSollRaster.pas`),
  interface `ISollRaster` (`EdSollraster.pas:43,66-90`).

### 9.3 Caching: `pkg_tagessoll_cache`

A **session-scoped, in-memory PL/SQL memoization layer** (not a persisted/shared
cache). Wraps six expensive Tagessoll entry points
(`GetSummeTagessoll_Tag*_Cached`, `SollWerktage_Cached`, `TagessollFuerDatum_Cached`,
`SummeTagessollFuerIntervall_Cached`, `pkg_tagessoll_cache.sql:1-85`), each backed
by a PL/SQL associative array keyed on a string of all call parameters
(`TABLE OF INTEGER INDEX BY VARCHAR2(4000)`), plus a small `t_cal_cache` for
calendar/rounding keyed `(kalender_id, datum_typ, datum)`. Capped at 50,000
entries, evicted by **wholesale clear** (no LRU). Gated by
`GLOBALEINSTELLUNGEN(SOLLZEIT, DBCACHE)`, fail-safe OFF. Exists purely to avoid
recomputing the same day/BG/calendar Sollzeit across a roster render or long
report interval.

### 9.4 Relationship to Guthaben/Saldo

An employee's Tagessollraster attaches via `MITARBEITER_DETAIL.tagessollraster_id`/
`_refdate` and `MITARBEITER_DEFAULTS.tagessollraster_id`. The resulting daily
target (`tagessoll`) feeds the Guthaben entitlement math (§7):
`fnGuthabenAnspruchStd.sql:46,54` joins `mitarbeiter_soll_reduziert.tagessoll_ma`
and `mitarbeiter_detail.tagessoll` to pro-rate reductions and convert day-based
corrections to hours. Tagessollraster (via Kalender + reduced-Soll tables) is the
upstream source of the "Tagessoll" that Guthaben consumes; otherwise independent
of Zeitraum.

---

## 10. Fehlzeitmanagement

A **Fehlzeit** is a recorded absence (illness, accident, vacation, maternity) for
an employee over a date range, with rules governing how much it reduces
required/counted work time and whether it may coexist with planned
vacation/night-work/on-call.

**`FEHLZEIT`** (`main_ecbern.sql:1651-1683`): `FehlzeitId` PK;
`mitarbeiter_global_id` (defined at the cross-employment "global employee" level);
`DfIdFehlzeitTyp` (reason/category, §4); `VonDatum`/`BisDatum`; `PaCode`
(counting code, §4); `StatusArztZeugnis` (medical-certificate workflow —
`TStatusArztZeugnis = (sAZNone, sAZNichtErforderlich, sAZPendent, sAZVorhanden,
sAZEingefordert, sAZBeiVersicherung)`, `intfFehlZeit.pas:9-19`);
`Arbeitsfaehigkeitsfaktor`/`Leistungsfaehigkeitsfaktor` (work-capacity % for
graduated return-to-work); `Faktor_auf_BG_anwenden` + `ReferenzBG`;
`MaxStundenProTag`/`MaxStundenProWoche` (caps); `FerienErlaubt`/`NachtArbeitErlaubt`/
`PikettErlaubt` (T/F: still plannable during this absence);
`KeineAutoStempelKorrekturen`; `BlockZeitReduktion` (`bzrNichtReduzieren`/
`bzrVorneReduzieren`/`bzrHintenReduzieren` — trim a straddling block at its edges);
`ArbeitszeitReduktionPruefen` (`sRPNichtPruefen`/`sRPTagesgenau`/`sRPWochengenau`);
`ZeitAusPlanungBis` (date until which already-planned time still counts).

**`FEHLZEITANSTELLUNG`** (`main_ecbern.sql:1687-1701`, key `FehlzeitId`+`AnstellungId`)
repeats the factor/limit fields as **per-employment overrides** — one global
person can hold several concurrent employments, so a single Fehlzeit can affect
each employment's counting differently.

**Forms**: `FdfFehlZeiten.pas` (`TFrmDfFehlzeiten`) — grid/list per employee;
`FdfFehlZeit.pas` (`TFrmDfFehlZeit`) — create/edit dialog (type-picker, date
range, capacity fields, Ferien/Nachtarbeit/Pikett/GanzeTage-erlaubt checkboxes,
nested `tvAnstellungen` grid); `FdfFehlZeitAnstellung.pas` — per-employment
override editor; `FFehlzeitDialog.pas` — lighter runtime prompt while planning
around an existing Fehlzeit (left/right/no block-time reduction, "use as
default"); `fFehlzeitPlanungAssistent.pas` — the absence-planning **wizard** (PA-Code
combo, date range, icon-position radios, "Überplanen" pre-plan ahead) — persists
the `FEHLZEIT` _and_ drops blocks onto the roster in one step (`// PP-1177`).

**Correction workflow** (`intfFehlzeitKorrektur.pas`): `IFehlzeitKorrektur`
reconciles, per Fehlzeit+day, `Sollzeit`/`Istzeit`/`PlanIstzeit`/`FehlzeitZeit`/
`TagesSollzeit`, derives `DiffSollIst`, and writes a `ManuelleZeitKorrektur` back
to a `ZEITANRECHNUNG` row — how partial/graduated-capacity absences get trued up
against stamped time.

**`ecLiz.pas` is NOT domain model** — it's the Polypoint license manager
(`TPolypointLizenz`, `ecLiz.pas:26-100`); one flag pair is `fFehlzeitKeyLoaded`/
`fFehlzeitActive`, gating whether Fehlzeitmanagement is licensed.

**Surfacing in the Stempeleditor**: `ZEITSUMME.Anbindung` is constrained to
`('Fehlzeit','FehlzeitKorrektur')` (`CHECK_ZEITSUMME_FEHLZEIT`, `main_ecbern.sql:8355`),
`IdInAnbindung` → `FehlzeitId`. An absence day appears in the Blöcke/Zeitsummen
grid as an ordinary row whose PA-Code is the Fehlzeit's `PaCode` and whose
title/colour come from the matching `DIENST(typ='A')` — same rendering machinery
as §4, no separate absence display path.

---

## 11. Tätigkeitsprofil

A **Tätigkeitsprofil** defines which clinical/patient-care activities
("Leistungen") staff in an org unit may log through the **TACS** module
(Tätigkeitserfassung — activity/task time recording, distinct from shift
planning), and how patient context is derived.

**Menu → editor**: Definitionen → Tätigkeitsprofil is `miTaetigkeitsprofil`
(`fPEPMain.pas:169,362`), visible only when `Lizenz.TacsActive`. Its handler
(`fPEPMain.pas:3579-3592`) opens `TTEProfilEditor` (`EdDefinitionTEProfil.pas:13-94`)
— a plain instance of the generic Definitionen editor pattern (edits a richer
record than the barest ones).

**`TE_PROFIL`** (`main_ecbern.sql:7460-7476`): `TE_PROFIL_ID`, `TE_CODE`,
`TE_BEZEICHNUNG`, `TE_KNOTEN_ID`; `TE_PATIENTEN_NACH_BELOE`/`_MIT_TERMIN`/
`_NACH_FALLOE` (T/F — how patient context is derived: by bed occupancy, by a
scheduled appointment/"Termin", or by case/"Fall"); `TE_TERMINFILTER_ANZAHL_TAGE`
(how many days of appointments to offer); `TE_TIMEOUT_AUSSTEMPEL` +
`TE_LSID_AUSSTEMPEL` (auto-clock-out timeout + which task it logs against);
`PFPROFTACSPA` (the pa_code the profile posts default time against — tying back
into §4). **`TE_PROFIL_LS`** (`main_ecbern.sql:7496-7506`, `TE_PROFIL_ID`+`LSID`)
selects which "Ls" (Leistung = task/service type) are enabled — `Ls` is defined
through the same generic "Df"-style framework as `FZATyp` (§10), under
`delphi/rap/iiLs.pas`.

**Per-employee gate**: `MITARBEITER_DETAIL.taetigkeitserfassung` (T/F, per
validity period). `DisableOldTaetigkeitserfassung.sql` closes an employee's
`='T'` row from a cutover date (header calls it "tacs 1" — a first-gen engine
being retired in favour of TACS 2, cf. `PF_TACS2_*` rights, `polyRightTypes.pas:444-449`).

**Runtime capture UI**: `fTaetigkeitenAusTerminen.pas` — a two-level tree
(`cLevelTermin`/`cLevelTaetigkeit`) turning scheduled appointments
(`IActivityAnker`) into logged activity rows (`IActivityRow`) — where an actual
Tätigkeit instance gets recorded, vs the profile's static definition.

**Is "Aufgabe" the same as "Tätigkeit"? No.** The Zeitanrechnungen "Aufgabe"
column comes from `ZAItem.Aufgaben`, a list of **Charge** entries
(`fStampEditor.pas:11202-11214`) — the `CHARGE`/`CHARGE_DETAIL`/`CHARGE_INTERVAL_*`
sub-interval tagging from §1.4 (internally even called "Dienststufe"), opened via
`miAufgabeClick` → `TChargeIntervalEdit`, gated by `Lizenz.ChargeActive`
(independent of `Lizenz.TacsActive`). So **Tätigkeitsprofil/TACS/Ls =
patient-care activity recording tied to appointments**; **"Aufgabe" in the grid =
Charge/Dienststufe sub-block tagging** — two unrelated systems that both gloss as
"task," sharing no table or code path.

---

## 12. Planning model

How a "planned shift" is stored, how it relates to what's actually clocked
(Stempel), and how required staffing (Bedarf) is matched against actual staffing
to produce coverage (Deckung). This section is the connective tissue: Dienst,
Hierarchie and PA-codes/Blocks all reappear here in the context of one
employee's one day.

### 12.1 In-memory objects behind the roster grid

Per SOURCE-NOTES §2 the roster's `TMultiSelectionGrid`s never populate `Cells[]`;
everything painted comes from an object graph rooted in two interface families
(both `pep/`):

- **`IPlanGridRow`** (`intfPlbMonthDisplay.pas:108-120`) — one visual grid row:
  `GetCellInfo(dte)`→`TPlanCellInfo` (border/readonly/weekend flags),
  `GetKalenderEintrag(dte)`, and the load-bearing `Segment: IPlanSegment`.
  `IPlanGridRowList`/`IPlanGridSection` group rows into foldable sections
  (a team/category).
- **`IPlanSegment`** (`intfPlbContent.pas:403-475`) — one resource's assignment
  context for the whole range: `Segid`, `Name`, `MitarbeiterGlobalID`, `GruppenID`,
  `Resourcentyp: TECResourceType` (`cRTPersonal/cRTBett/cRTOperationssaal/
cRTGeraet/cRTAncestor`, `pepTypes.pas:11`), `SegmentType: TPlansegmentType`
  (`ptStammZuordnung`/`ptNebenZuordnung`/`ptSpringerZuordnung` = home/secondary/
  float), `Indikator`/`IndikatorEnde` (entry/exit events), `Planbar`,
  `PlanungswunschList`. `Segid` is the resource identity, **not** a DB assignment
  row.
- **`IPlanMonthSegment`** (`intfPlbContent.pas:369-389`) — the segment sliced to
  one month: `monthsegid`, `planMonthAb`/`_Bis`. Field names match the
  `PLANMONTHSEGMENT` `GLOBAL TEMPORARY` table (`main_ecbern.sql:4546-4561`) — a
  session-scoped materialization, not permanent storage.
- **`IPlanMonthSegment.Data[Name]: IPlanData`** — a keyed bag of per-day element
  arrays, one bucket per _data source_ (`intfPlbContent.pas:33-45`): `MARKIERUNG,
PLANRECHT, PLANUNG, SPRINGER, SQL, SOLLPLAN, ANSTELLUNG, WUNSCHPLAN,
ZUSTARZTZEUG, FEHLZEIT, MARKIERUNGMOBILE, TACSVISUM, POMA_OPPORTUNITY_TRACKING`.
  `IPlanData.Elements` = `array[0..63] of IInterfaceList` (per-day buckets of
  `IPlanElement`).
- **`IPlanElement`** (`intfPlbContent.pas:59-69`) base (`Von`/`Bis`). The
  `'PLANUNG'` bucket holds **`IPlanElementPlanung`**: `PACodes[dpos: TDienstPos]`,
  `Zaehler[dpos]`, where `TDienstPos = (cGANZ, cPIKETT, cLINKS, cRECHTS, cDpUNDEF)`
  (`pepTypes.pas:66`) maps 1:1 to the palette radios and the DB
  `dienstteil`/`dienstposition CHAR(1) IN ('G','L','R','P')`. Sibling element
  types cover the other sources (`…Planungswunsch`, `…Fehlzeit`, `…Springer`,
  `…Label`, `…Planrecht`, …).
- Non-employee rows too: `IPlanMonthDisplay.GetBedarfDienstByRow(row):
IPlanDienstBestand` / `GetBedarfItemByRow(row): IBedarfItemDescriptor`
  (`intfPlbMonthDisplay.pas:203-204`) — Bedarf/Bestand/Deckung summary rows live
  in the same grid, different accessor.

**Planned vs recorded at this layer**: everything above (`PLANUNG`/`SOLLPLAN`/
`FEHLZEIT`/`WUNSCHPLAN` sources) is the **planned/Soll side**. There is **no
recorded/Ist data source in this object graph** — actual clock data is fetched
separately when a day is opened in the Stempeleditor (§12.3). The roster paints
the plan; recorded time is a drill-down.

### 12.2 The planned layer (persistent storage)

| Table                                           | Grain                                                              | Key columns                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`PLANUNG`** (`main_ecbern.sql:4655-4693`)     | one Dienst-position for one employee on one date                   | `planung_id`, `knoten_id`, `mitarbeiter_id`, `pa_code`, `datum`, `dienstposition`/`dienstteil` (G/L/R/P), `sollzeit`, `sollzeit_basis/_faktor/_aus_kalender`, `an_zeitkonto`/`ab_zeitkonto`, `zaehler` (0.5/1), `block1/2/3_pa_code`, `pa_code_stempel`, `Anbindung`/`IdInAnbindung` (set when synthesized _from_ an absence), `PLANUNGSEINHEIT` FK |
| **`PLANUNGSEINHEIT`** (`main_ecbern.sql:4756`+) | one employee's one day (grouping wrapper)                          | `id`, `mitarbeiter_id`, `datum`, day flags `dienstaenderung`, `freizeitausgleich`, `interpretationslevel`, `stempelabweichung`, `freiwilliger_tausch`, `lza_prozent`                                                                                                                                                                                |
| **`PLAN`** (`main_ecbern.sql:4400-4444`)        | a named report/print config ("Planblatt"), **not** assignment data | boolean toggles `Istplan`/`Sollplan`/`Differenzplan`/`Stempelabweichungen`/`Dienstaenderungen`/`Bedarf`/`Bestand`/`Deckung`/…                                                                                                                                                                                                                       |

**Correction to a common misconception**: neither `DIENSTAUSWAHL_DETAIL` nor
`PLAN_DIENSTAUSWAHL_DETAIL` stores "employee assigned Dienst on date":
`DIENSTAUSWAHL_DETAIL` (`main_ecbern.sql:1302`) is `(pa_code, sp_nummer)` (a
Stellenplan lookup); `PLAN_DIENSTAUSWAHL_DETAIL` (`main_ecbern.sql:4468-4485`) is
`(pa_code, id, Planung, Bedarf/Bestand/Deckung_einzeln, …_Total)` — all `CHAR(1)`
display/report-config flags. **The real assignment row is `PLANUNG`, grouped by
`PLANUNGSEINHEIT`** (one row per employee+day), filtered at display time by
`knoten_id` + date range. There is no `plan_id` FK on `PLANUNG` — "which
Planblatt" is a node-scoped view, not a foreign key **(inferred)**.

Naming cross-reference: `dmPlTag.pas` (`TdmPlanTag`, "Datenmodul für
Planbuffer") owns one day's read queries (`qryReadPlanung`,
`qryReadStammHierarchie`, `qryReadSpringer`, …); `dmPlbOperation.pas`
(`TdmPlanOperation`) owns the write procs (`spcInsPlanTag`/`spcClearPlanTag`/
`spcModifyDPos`/`spcModifyPACode`) plus `qryUpdateBlockPlanungsID`/
`qryUpdateStempelPlanungsID` (PEP actively (re)links `BLOCK`/`STEMPEL` rows back
to their `PLANUNG`). `DAMABREC.PAS` buffers `[Stempel, Zeitsumme,
PlanungsEinheit, Planung, Detail, StammZuordnung, Springer]` per employee-month —
independent confirmation of the three domains (planned / recorded / derived).

**Downstream generation**: absences and manual planning both funnel into the
`PLANUNG` grain via `pkg_dienstplanung.sql`. `InsertFehlzeitAbsenzPlanung`/
`InsertFehlzeitPraesenzPlanung` (`:1507,1650`) `INSERT INTO PLANUNG (…, 'Fehlzeit',
inFehlzeitId)` — an absence is a synthetic `PLANUNG` row distinguished only by
`Anbindung='Fehlzeit'`. `InsertBlockComplete` then derives `BLOCK` rows,
`InsertZeitSumme…`/`Zeitanrechnung` derive the `ZEITSUMME`/`ZEITANRECHNUNG`
rollups. (This package is planned-layer _generation_, not demand/coverage
matching.)

### 12.3 Planned vs. recorded (Stempel) layers

**DB.** `STEMPEL` (`main_ecbern.sql:7287-7323`) is the raw-punch table:
`mitarbeiter_id`, `datum`/`zeit`, `Stempelart CHAR(2) IN ('ES','AS','PS','MS',
'AZ','MZ','PZ')` (decode **unconfirmed**), `planung_id`/`planung_id_hint` (soft
link back to the plan), `anrechnung_datum`/`_zeit` (credited time, can differ
from the raw punch). **`BLOCK`** (`main_ecbern.sql:490-528`) is the concrete join
between layers: the _same row_ carries `PLANUNG_ID` (nullable FK to the planned
assignment) **and** `STEMPEL_IN_ID`/`STEMPEL_OUT_ID`/`STEMPEL_DURATION_ID`
(nullable FKs to punches), plus `MITARBEITER_ID`, `PACODE`, `DATUM`,
`STARTTIME`/`ENDTIME`/`DURATION`, `DIENSTPOSITION` (G/L/R/P), `DIENSTTYPE`
(P/A/I), `BLOCKART`/`BLOCKTYPE` (A/M, plausibly Auto/Manual — **unconfirmed**).
`ZEITSUMME` (`main_ecbern.sql:8350-8390`) and `ZEITANRECHNUNG`
(`main_ecbern.sql:8179-8201`: `Grundzeit`, `Zeit`, `Mehrzeit`, `Mehrzeit_Dienstlich`)
are the derived "how much counts, against which Zeitkonto" rollups, also carrying
`planung_id`/`Anbindung='Fehlzeit'` links.

**UI confirmation.** The Zeitanrechnungen grid is `vtZA`, a `TVirtualStringTree`
with a static `'Geplant'` column (`fStampEditor.dfm:1377`) whose `OnGetText`
resolves to `data.ZAItem.StrSollzeit` (`fStampEditor.pas:11259-11260`) — the
"Geplant" figure literally _is_ the row's target/Soll duration, on the same row
as `StrZeit` (recorded/actual) and `StrSaldo` (rolled-up difference). Concrete
answer to why Ist/Geplant/Saldo show side by side: the view-model row wraps a
`ZEITANRECHNUNG`-family record joined back to its `PLANUNG.sollzeit`.

**Cloud/api-pp contract** (`rest/uAPIPersonnelPlanningModel.pas`) names the same
split and adds two more layers. `TRosterCellComplete` (`:601-663`) = one
employment + one day:

| Property                        | What it is                                                         |
| ------------------------------- | ------------------------------------------------------------------ |
| `PlannedLayer`                  | target/planned `ShiftBlocks` + `TimeAmountJournalEntries`          |
| `RecordedLayer`                 | actual clocked blocks/entries + `LayerLocked`/`LayerSigned`        |
| `CoveredLayer` (+`…TimePoints`) | reconciled/interpreted view (`InterpretationHints` per time point) |
| `CountedLayer`                  | final credited/counted time rolling into balances                  |

`TShiftBlock` (`:368-424`) carries `StartTimeStampId`/`EndTimeStampId` — the JSON
mirror of `BLOCK.STEMPEL_IN_ID`/`_OUT_ID`. `TFlexTimeAmountBalance` (`:743-771`)
gives the four amounts as a per-day summary (`PlannedLayerTimeAmount`/
`RecordedLayerTimeAmount`/`CoveredLayerTimeAmount`/`CountedLayerTimeAmount`/
`FlexTimeBalance`) — the cloud-era source for Grundzeit/Ist/Geplant/Saldo.
`TShiftPlanning` (`:426-448`, `EmploymentIdentifier`/`NodeId`/
`ShiftDefinitionPolicyIdentifier`/`SchedulePosition`) is the REST counterpart of
one `PLANUNG` row.

**Write path** confirms the duality operationally: `TPPAPIStempelshiftDTO.ToJson`
(`rest/uStempelPPAPI.pas:247-276`) posts `shift-definition-id`, `employment-id`,
`node-id`, `position`, `partial-planning-option` (`COMBINE`/`REPLACE`), and
`target-time-replacement-option` (`KEEP_PLANNED`/`KEEP_SHIFT_DEFINITION`/`NONE`) —
re-planning must say whether previously-planned/recorded target time is kept or
overwritten; the planned/recorded distinction is a first-class write parameter.
The report layer independently encodes it: `TSelPlanPlanType = (sptIstplan,
sptSollplan)` (`intfSelPlan.pas:12`), also `PLAN.Istplan`/`Sollplan`/`Differenzplan`.

### 12.4 Demand &amp; coverage

**Bedarfsprofil** — required headcount per **node + Dienst + day-in-rotation**.
`BEDARFSPROFIL` (`main_ecbern.sql:181-193`): `knoten_id`, `pa_code`, `gueltig_ab`,
`tag` (1-8; 8 = Feiertag), `woche` (1-4, week-in-rotation), `bedarf` (optimal),
`BedarfMin` (minimum). In-memory `IBedarfDefinitionItem`
(`intfBedarfDefinition.pas:24-73`): `PACode`/`CategoryId`(=`knoten_id`)/`Validity`/
`AnfangZyklus`/`BedarfMinimal[]`/`BedarfOptimal[]`. Edited via `fBedarfDefinition.pas`
(per-Dienst weekly curve + Feiertage).

**Bedarfs-Ausnahme** — single-date override: `BEDARFSPROFIL_AUSNAHME`
(`main_ecbern.sql:203-213`: `knoten_id, pa_code, gueltig_am, bedarf, BedarfMin`),
edited singly (`fBedarfAusnahme.pas`) or as a list (`fBedarfAusnahmen.pas`).

**Bedarfgesamt** — node-level _total_ demand, no per-Dienst breakdown.
`BEDARFSPROFILGESAMT` (`main_ecbern.sql:221-232`, same tag/woche shape, no
`pa_code`); `IBedarfgesamtDefinitionItem` has no `PACode`/`CategoryId`.

**Gesamtbestand vs. Bedarfgesamt** — the required/actual pair of one combined
total row. `ITotalBestandItem` (`intfBedarf.pas:93-109`) carries per-day
`Bedarf`/`Bestand`/`Deckung`. `TBedarfBufferMonat.ReadGesamtbedarf`
(`dbbedarf.pas:1213-1254`) fills the _required_ side; `Bestand` (actual headcount)
is filled from the live roster; `ReadGesamtdeckung` computes `Deckung = Bestand −
Bedarf`. So **Bedarfgesamt = required-total, Gesamtbestand = actual-total** — two
sides of the same row. (Caveat: "Gesamtbestand" is also reused as an unrelated
display-toggle flag in `uDefinitionPlanblatt.pas` — don't conflate.)

**Coverage ("Deckung") — three parallel systems, not one:**

1. **Legacy Bedarf/Bestand/Deckung** — the `BEDARFSPROFIL`-driven model above,
   shown via `frLegacyDemand.pas` as toggleable rows colour-coded green/red/blue,
   computed client-side from the roster's own `FRosterContent.BedarfBuffer` (the
   §12.1 object graph), not from a service.
2. **CPP / smartPEP demand-staffing matcher** (cloud-era successor; "CPP" not
   spelled out, contextually "Cloud Personnel Planning" given
   `uAPICloudPersonnelPlanningModel.pas` + `uRestClient_CPP.pas` — **inferred**).
   `TCPPStaffingDemandMatcher.Coverage(from,to)` (`uCPPDemandStaffingMatcher.pas:98-208`)
   takes the roster node/content, a `TDateRangeStaffing` (actual headcount from
   the _same_ `IPlanSegment` graph, deduplicating Springer-covered cells), and a
   `TDemandRequirementsInRangeList` fetched over REST (demand here is **not**
   `BEDARFSPROFIL`). Per demand-profile × date it sums matching staffing and
   classifies via `CoverageForStaffingExt` (`uAPICloudPersonnelPlanningModel.pas:696-725`)
   into `TDemandCoverage = UNDEFINED/BELOW_MIN/BELOW_OPT/OPTIMUM/ABOVE_OPT/ABOVE_MAX`
   against Min/OptLow/OptHigh/Max thresholds — the closest thing to "Optimale
   Deckung." The two systems are mutually exclusive per node
   (`intfDemandAreaController.pas:23-24`: `LEGACY` "schliesst smartPEP-Bedarf aus"
   vs `CPP` "schliesst klassischen Bedarf aus"), sharing one host panel.
3. **PPR 2.0 nursing-ratio monitor** — `fBedarfsanzeigeMonitor.pas`
   ("Bedarfsanzeige-Monitor PPR 2.0") is a third, independent live display that
   does **not** read `BEDARFSPROFIL`; it calls an external REST staff-requirement
   API for SOLL/IST columns, implementing the "Pflege-Personalregelung"
   nursing-staffing-ratio standard (PPR expansion **inferred**).

**Belastung / Belegung vs. Bedarf** — staffing-_load_ siblings, distinct from
demand:

- **Belastung** ("workload/strain") = imported clinical acuity with its own
  `Sollwert`, per group + shift-type F/S/N, imported from an external "Somatik"
  system (`IBelastungSomatikImporter`, `intfBelastungImport.pas:11`) into
  `BELASTUNG_SOMATIK_IMPORT` (`main_ecbern.sql:242-247`).
- **Belegung** ("occupancy") = actual patient/bed occupancy count, **no target**,
  per group + Tag(06-22)/Nacht(22-06) einsatz, in `OCCUPANCY_IMPORT`
  (`main_ecbern.sql:4164-4170`). Correction labels (`rs_BestandPatient` = "patient
  headcount") show it tracks ward occupancy, an _input_ to workload calc, not a
  staffing figure. A PPR 2.0 variant (`OCCUPANCY_PPR20_IMPORT`) feeds the monitor
  above.
- All three have daily manual-correction dialogs (`fKorrekturTagesbelastung`/
  `-belegung`/`-belegungPPR20.pas`) that delete+reinsert a day's imported value
  when the automated import is wrong/late.

---

## Appendix: the load-bearing tables at a glance

| Concept                    | Definition table(s)                                                                                          | Instance/booking table(s)                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Dienst (§1)                | `DIENST` (PK `pa_code`), `DIENST_DETAIL`, `DIENSTPALETTE`, `DIENST_BEZAHLTE_PAUSE`, `CHARGE_INTERVAL_DIENST` | `PLANUNG` (§12)                                                                 |
| Dienst classification (§2) | `DIENSTGRUPPE`, `DIENST_KATEGORIE`, `DIENST_SCHICHTTYP`, `DIENSTGRUPPENSCHICHTMATRIX`                        | —                                                                               |
| Blockkategorie (§3)        | `BLOCKKATEGORIE_DEF`                                                                                         | `BLOCK.BLOCKKAT_ID`, `ZEITSUMME.blockkat_id`                                    |
| PA-Codes (§4)              | _(none — `DIENST.pa_code` + sentinels)_                                                                      | —                                                                               |
| Zulagen (§5)               | `ZULAGENPROFIL`, `ZULAGENPROFIL_DETAIL`, `ZULAGENABSCHNITT`, `WS_(DEF_)ZULAGEN_PROFIL`                       | `ZEITANRECHNUNG` (CODEART C/J), `REPORTZULAGENEINTRAG`                          |
| Lohnarten (§6)             | `LOHNART_PROFIL`, `LOHNART_DETAIL`, `LOHNART_KATEGORIE(_DETAIL)`, `LOHNART_GRENZE`(→Zeitkonto)               | `ZEITANRECHNUNG`, `REPORTLOHNARTUMLEITUNG`                                      |
| Guthaben (§7)              | `DEF_GUTHABEN(_DETAIL/_REGELN)` (new), `GUTHABENPROFIL` (old)                                                | `MITARBEITER_GUTHABEN(_KORR)`, `GUTHABEN_SALDO`, `GUTHABEN`                     |
| Hierarchie (§8)            | `HIERARCHIE`, `EBENE`, `HIERARCHIETYP`, `HIERARCHIE_VERSION`                                                 | — (nodes referenced by `knoten_id` everywhere)                                  |
| Tagessoll/Zeitraum (§9)    | `TAGESSOLLRASTER(_DETAIL)`, `ZEITRAUM`                                                                       | via `MITARBEITER_DETAIL.tagessollraster_id`                                     |
| Fehlzeit (§10)             | _(reasons via "Df" `FZATyp`)_                                                                                | `FEHLZEIT`, `FEHLZEITANSTELLUNG`                                                |
| Tätigkeit/TACS (§11)       | `TE_PROFIL`, `TE_PROFIL_LS`, `Ls` (Df)                                                                       | activity rows via `fTaetigkeitenAusTerminen`                                    |
| Planning (§12)             | `PLAN` (print config), `BEDARFSPROFIL(_AUSNAHME)`, `BEDARFSPROFILGESAMT`                                     | `PLANUNGSEINHEIT`, `PLANUNG`, `BLOCK`, `STEMPEL`, `ZEITSUMME`, `ZEITANRECHNUNG` |
