# PEP super-user guide — operating PEP through pep-driver

The **operational** layer: what each PEP screen is, its window class, how to reach
it, what it contains, and how to do real planner work. Pairs with:

- `PEP-DOMAIN-MODEL.md` — the DB/source data model (the "why").
- `PEP-UI-MAP.md` — selector language + readability rules.
- `P2-SOURCE-NOTES.md` — automation internals.

All observations below are **verified live on ct-zinc-master** (demo DB, tenant
"POLYPOINT AG", test teams under `Yannicks Space → IT & HR → Internal IT → IT Team 1`).

## Mental model (one day, top to bottom)

A **Dienst** (shift) assigned to an employee on a day = a `PLANUNG` row (grouped
per employee+day as a `PLANUNGSEINHEIT`). The Dienst's `DIENST_DETAIL` defines its
time blocks (Soll/Gleit/Block/Auto-stempel windows + paid/unpaid Pausen) and its
**Zeitanrechnung** (how time credits a **Zeitkonto**, e.g. GLAZ). **Zulagen**
(time-of-day allowance windows) accumulate onto **Lohnarten** (wage types) via the
per-day `Zulagen.sql` pipeline, gated by profiles. Recorded stamps (Stempeleditor)
overlay the plan; the day rolls up to **Zeitanrechnungen** (Ist / Geplant / Saldo).
Cloud/api-pp expose this as the 4-layer `TRosterCellComplete{Planned, Recorded,
Covered, Counted}`. See `PEP-DOMAIN-MODEL.md` for the table-level detail.

## Screens & how to reach them (verified window classes)

| Screen                                          | Class                                                 | Reach it with                                    |
| ----------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Main window / roster                            | `TfrmPEPMain` (roster = embedded `TfrmPlbMonth`)      | —                                                |
| **Stempeleditor** (per-day TR)                  | `TStampEditor`                                        | double-click a roster cell                       |
| Org-node picker (locking)                       | `TfrmKnotenwahlSperr`                                 | `menupath Datei "Planblatt bearbeiten"`          |
| Dienst/palette node picker                      | `TfrmKnotenwahl`                                      | `def Dienst`                                     |
| **Dienst editor** (available + palette)         | `TfrmDienstMain`                                      | pick node → Weiter                               |
| **Dienst definition** (per-Dienst)              | `TfrmEditDienstGlobal`                                | double-click a Dienst row                        |
| **Dienst period detail** (times/Zeitanrechnung) | _(nested)_                                            | select a Gültigkeit row → Detail                 |
| Palette local-name editor                       | `TfrmEditDienstPalette` → `TfrmDienstPaletteSettings` | (rename path)                                    |
| **Hierarchiedefinitionen**                      | `TfFlexHierDef`                                       | `menupath Definitionen Hierarchie`               |
| **Zulagenprofil**                               | `Tfrmzuprans`                                         | `menupath Definitionen Abrechnung Zulagenprofil` |
| **Lohnarten** / generic list                    | `TfrmDefinitionList` (+ `TfrmDefinitionEditor`)       | `menupath Definitionen Abrechnung Lohnarten`     |
| generic definition detail                       | `TfrmDefinitionEditor`                                | double-click a list row                          |

**Menu structure** — `Datei · Bearbeiten · Ansicht · Definitionen · Tools · Extras · ?`

- **Definitionen**: Grundeinstellungen · Konfiguration POLYPOINT-Server · **Hierarchie** ·
  Kalender · Tagessollraster · Zeitraum · **Dienst** · Dienstgruppe · Dienstkategorie ·
  Blockkategorie · Guthabenprofil · Fehlzeitmanagement▸ · Personal (Ctrl+B) ·
  Personal-Attribute▸ · Gerät · Raum · Planung▸ · **Abrechnung**▸ · Auswertungen▸ ·
  Zeiterfassung▸ · Tätigkeitsprofil
- **Definitionen → Abrechnung▸**: **Lohnarten** · **Zulagenprofil** · **Zulagenvarianten**
  (= `LOHNART_KATEGORIE` redirection engine) · **Zeitkonto** · Abweichung ·
  Schicht-Wechselschicht-Definitionen▸ · Stundenlohnperiode festlegen · Saldokontrolle-Profil (D)
- **Datei**: Planblatt bearbeiten (Ctrl+O) · Jahresplan bearbeiten (Ctrl+J) · Suchen ·
  Liste öffnen · Schnellkorrektur · Monatsabrechnung · Abschlussdatum festlegen ·
  Interpretationslevels · Saldokontrolle · Logbuch · …

## Dienst (shift definition) — the core, three depths

1. **`TfrmDienstMain`** ("Dienst- und Dienstpalettendefinitionen"): left = _Verfügbare
   Dienste_ at the node (tabs **Präsenzen / Absenzen / Pikett** — these are
   `DIENST.typ` P/A/I), right = the node's _activated palette_; middle arrows move
   Dienste in/out; "Inaktive Dienste ausblenden". Example Dienste: `A 111 Dienst A`,
   `B 112`, … `Z1 110 Test zeiterfassung`, each with `ab <validity date>`.
2. **`TfrmEditDienstGlobal`** ("Dienst A – Dienstdefinition"): **Typ** (Präsenz/…),
   **PA-Code** (111 — this IS the Dienst's key), **Bezeichnung**, **Dienstgruppe**,
   **Tastaturkürzel**; **Verfügbar für** (Planungsvorschlag / Planungswunsch /
   Diensttausch / Ressourcenersatz-Interner Pool / Fehlzeit / Piketteinsatz-mobile);
   **Weitere Optionen** (Planungsregeln für Pikett einhalten / zählt als freier Sonntag /
   immer sichtbar); **Schichttyp** (e.g. Nachtdienst); **Zuordnungscodes/Exportcode**;
   a **Gültigkeit** table (date-versioned `DIENST_DETAIL` rows, each showing the day's
   time windows e.g. `07:30–12:00, 12:30–16:24`).
3. **Period detail** (select Gültigkeit → Detail) — tabs:
   - **Zeitanrechnung**: **Sollzeit** (08:24), **Zeitkonto Gutschrift = GLAZ** /
     Belastung, voraussichtl. Zulagezeit, anrechnen auf Zeitkonto; Beschäftigungsgrad
     reduction; "Zeit auf Null setzen" (Sa/So, Feiertage); Dienst teilen; Überplanen
     behaviour; **Zulagenprofil** (4 slots: Monatslöhner/Stundenlöhner × normal/modifiziert);
     **Stellenplan** (wirksam/Entlastung); Dienstkategorie für Auswertungen;
     Dienstschichttyp; **Tätigkeitserfassung**.
   - **Zeitraster / Stempel**: the block time model — per **Block** (1–3): **Sollzeit**,
     **Gleitzeit**, **Blockzeit**, **Korrekturstempel**, **Autostempel** windows +
     **Pause** (Pausenzeit unpaid, Pausenstempel with Unterbruch) + **Zusätzliche
     bezahlte Pausen**; plus **Totale**. (e.g. Dienst A: Soll 06:00–18:00, Gleit
     07:30–16:24, Pausenzeit 11:00–13:30, bezahlte Pause 09:30–09:45; Sollzeit total 08:24.)
   - also: **Planungsregeln**, **Korrekturen**, **Planungswunsch** tabs.

## Abrechnung master data (payroll/allowances)

- **Zulagenprofil** (`Tfrmzuprans`): bundles Zulagen; live rows `1 Normalprofil`,
  `2 Überzeitzuschlag`, `11 Nachtprofil`. Assigned **per Dienst** (Zeitanrechnung tab).
- **Zulagenvarianten** = `LOHNART_KATEGORIE`, the per-employee code-redirection engine.
- **Lohnarten** (`TfrmDefinitionList`): wage types — live rows `11 Sonn-/Feiertagszulage`,
  `21 Nachtzulage`, `22 Zeitgutschrift 10%`, `23 Zeitgutschrift 20%`, `30 ÜZ-Zuschlag 25%`,
  `31 Abweichung Übertrag→Überzeit`. Detail (`TfrmDefinitionEditor`): Code/Bezeichnung/Typ/
  Knoten/validity + "ohne Zeitzuschläge" vs "generiert folgende Zeitzuschläge/-abzüge"
  (grid Typ/Zeitkonto/Faktor/Details) + "nicht im Zeitausweis sichtbar". This is the
  Zulagen→Lohnart→Zeitkonto mapping.
- **Zeitkonto**: the balance buckets (GLAZ etc.); "ohne Zeitkonto" = the `-1` fallback.

## Hierarchie (`TfFlexHierDef`)

One org tree; `HIERARCHIETYP` classifies node kinds. Live root `PP` → Akutsomatik,
Psychiatrie, Rehabilitation, …, **Yannicks Space**, Rodri space, … Under Ärzte:
Chirurgie/Orthopädie/Urologie/Medizin/Gynäkologie/Anästhesie → CA/OA/AA roles.
Side actions: Neu / Detail / Drucken / Kategorienamen / Aktualisieren /
Struktur neu berechnen / Schliessen. "Aufklappen bis…" combo expands to a level.

## Planning gestures (the daily work)

- **Assign a shift**: select a Dienst in the **palette** (top A–Z buttons + icon row;
  the radios **Ganz / Links / Rechts / Pikett** = full-day / morning / afternoon /
  on-call), then click (or drag) the employee's day cell. Or type the Dienst's Kürzel.
  Palette tabs: **Dienste / Sequenzen**.
- **Right-click a cell** → context menu: clipboard (Ausschneiden/Kopieren/Einfügen/
  Löschen), **Fehlzeit**, **Planungswunsch** (Ctrl+W), **Manuelle Stempeländerung**
  (Ctrl+M), **Ressourcenersatz** (Ctrl+R), Mutationen aus myPOLYPOINT, Status Arztzeugnis,
  plus cell-display modes (Tag/Woche × Soll/Ist/Diff-Zeit), **anpassen…** (Alt+Enter).
- **Double-click a cell** → **Stempeleditor** (`TStampEditor`): tabs Blöcke und
  Aufgaben / Stempeluhr / Markierungen / Logbuch; the **Blöcke/Aufgaben/Zeitsummen**
  grid (Titel/PA-Code/Beginn/Ende/Dauer/Blockkategorie/Kommentar) and **Zeitanrechnungen**
  grid (Titel/Code/Aufgabe/Kategorie/Grundzeit/Istzeit-Zuschläge/Geplant/Saldo, GLAZ
  roll-up). Insert via `toolbarInsert` SplitButton (Neu → Block / Zeitsumme).
  ⚠ **Übernehmen / OK persist immediately** — use **Abbrechen** for read-only.
- Date navigation: header arrows (`≪ ◀ <date> ▶ ≫`); the detail panel (right) shows
  Pers.-Nr., Ist-Zeit, Differenz Ist/Plan, GLAZ Saldo for the focused employee/day.

## Reading data — the golden rule

**Every PEP data control is opaque to UIA** (owner-drawn `TMultiSelectionGrid`,
virtual `TVirtualStringTree`, and even `TDBGrid`/DevExpress `TcxGrid` return no cell
text). So: **read grids/trees with `pep screenshot` (visual) or via api-pp (values);
never expect `read`/`grid` to return their content.** Interact with them via
`pep clickin`/`clickxy` (rect-derived) — e.g. clicking a tree node, double-clicking a
roster cell. TcxGrid lists add a "Zum Filtern hier Text eingeben" filter row you can
type into to narrow, then screenshot. Standard controls (buttons, radios, edits,
combos, menus, tabs) ARE element-addressable and drive normally.

## Handy recipes

```bash
P="python3 ~/dev/polypoint/pep-driver/cli/pep --tenant ct-zinc-master"
$P def Dienst && $P click 'class=TfrmPEPMain > class=TfrmKnotenwahl > button="Weiter"'  # Dienst editor
$P menupath Definitionen Abrechnung Lohnarten && $P screenshot --out /tmp/lohnarten.png
$P clickxy <x> <y> --double     # open Stempeleditor for a roster cell (coords from a screenshot)
$P dialogs                      # what's open (incl. nested), topmost = last
$P close                        # Abbrechen/Schliessen the topmost dialog
```
