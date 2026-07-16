# PEP UI map — learned live via pep-driver (ground truth)

Built by driving PEP on **ct-zinc-master** through pep-driver and cross-checked
against the P2 Delphi source (see `P2-SOURCE-NOTES.md`). This is the practical
"how to automate PEP" reference. Selectors below are verified live.

## The one thing to internalise: what is readable vs opaque

PEP is a **single top-level window** (`TfrmPEPMain`). Its "sub-windows" (roster,
Stempeleditor) are Delphi forms **reparented as child windows** of the main form
(ChildEngine) — so they never appear in a top-level window list; find them under
`TfrmPEPMain` or via `pep dialogs`.

| Kind                       | Examples                                                                                       | UIA?                                                                     | How to drive/read                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Standard VCL controls**  | menus, `TBitBtn` buttons, `TRzRadioButton`, `TComboBox`, `TEdit`, toolbars, tabs, panel titles | ✅ exposed                                                               | element selectors (`click`/`read`/`set_text`)                                                               |
| **Owner-drawn data grids** | roster `TMultiSelectionGrid` (×6), Stempeleditor `TIntervalGrid`/`TMonthPlanGrid`              | ❌ opaque — 100% custom paint, `Cells[]` never populated, no IAccessible | **read** via `screenshot` (visual) or **api-pp** (values); **click** via `clickin`/`clickxy` (rect-derived) |
| **Virtual trees**          | org pickers' `TVirtualStringTree` (`pnlKompassName/Plan`, Knotenwahl, Hierarchie)              | ❌ nodes opaque (scrollbars only)                                        | **read** via `screenshot`; **select** via `clickin` at the row's rect-fraction (verified)                   |
| **DevExpress grids**       | the ~30 generic Definitionen list dialogs (`TcxGrid`)                                          | ⚠️ likely readable (DevExpress ships a UIA bridge) — _unverified live_   | try `grid`/`tree`; fall back to screenshot                                                                  |

Consequence: **automate navigation & actions through elements; read grid/tree
DATA through screenshots (visual) + api-pp (values).** There is no REST/COM/
scripting backdoor inside PEP's GUI (P2 confirmed) — api-pp is the data oracle.

## Stable selectors (verified live)

Main window: `class=TfrmPEPMain` (title `[LEHDI PEP - Leitbediener] …`, proc `pepwin.exe`).

Menu bar items (top level): `class=TfrmPEPMain > menuitem="Datei"` etc.
Menus: **Datei, Bearbeiten, Ansicht, Definitionen, Tools, Extras, ?**

Popup menu items — **gotcha**: the popup is a `#32768` child of `TfrmPEPMain`, and
every item ALSO appears in the MenuBar hierarchy → each resolves **twice** →
always take index `[0]`. Prefer the `menupath` command which handles this.

Palette (left): radios `class=TfrmPEPMain > radio="Ganz|Links|Rechts|Pikett"`;
tabs `panel="Dienste|Sequenzen"`; date `panel*="Juli"` (current plan date, readable).

Key dialogs (all children of `TfrmPEPMain`, seen via `pep dialogs`):

| Dialog class                                                             | What                                                                                     | Opened by                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------- |
| `TfrmKnotenwahlSperr`                                                    | Planblatt **locking** picker (⚠ has "Sperrung" radios — Abbrechen, don't Weiter blindly) | Datei → Planblatt bearbeiten |
| `TfFlexHierDef`                                                          | **Hierarchiedefinitionen** (org tree editor)                                             | Definitionen → Hierarchie    |
| `TfrmKnotenwahl`                                                         | Dienst/Palette node picker ("Änderung von Dienst- und Palettendefinitionen")             | Definitionen → Dienst        |
| `TfrmDienstMain` → `TfrmEditDienstPalette` → `TfrmDienstPaletteSettings` | Dienstpalette editor (74.2 rename path: lokale Bezeichnung + green enable button)        | (from the Dienst picker)     |
| `TfrmDefinitionList` / `TfrmDefinitionEditor`                            | generic pair reused by ~30 Definitionen dialogs (DevExpress `TcxGrid`)                   | most Definitionen items      |
| `TStampEditor`                                                           | **Stempeleditor** — the per-day time-recording oracle                                    | double-click a roster cell   |

Dialog buttons are standard `TBitBtn`: `button="Weiter|Abbrechen|OK|Schliessen|Übernehmen"`.
⚠ In `TStampEditor`, **Übernehmen/OK persist immediately** — use **Abbrechen** for read-only inspection.

## Definitionen menu catalogue (read live)

Grundeinstellungen · Konfiguration POLYPOINT-Server · **Hierarchie** · Kalender ·
Tagessollraster · Zeitraum · **Dienst** · Dienstgruppe · Dienstkategorie ·
Blockkategorie · Guthabenprofil · Fehlzeitmanagement▸ · Personal (Ctrl+B) ·
Personal-Attribute▸ · Gerät · Raum · Planung▸ · Abrechnung▸ · Auswertungen▸ ·
Zeiterfassung▸ · Tätigkeitsprofil

## Org hierarchy (read from the pickers)

`PP → {Akutsomatik, Psychiatrie, Rehabilitation, Langzeit/Alter und Pflege,
Sozialmed. Institution, RAP, DIS, DOC, Berechtigungen, AMS, Maisonneuve,
Yannicks Space, Rodri space, Adolf Empresa, Raphael Space, …}`.
Test team lives at `Yannicks Space → IT & HR → Internal IT → IT Team 1`
(status bar of the Stempeleditor confirms this path).

## Stempeleditor anatomy (`TStampEditor`)

- Header: employee, `Gruppe/Kat.`, date nav arrows.
- Tabs: **Blöcke und Aufgaben** | Stempeluhr | Markierungen | Logbuch.
- **Blöcke/Aufgaben/Zeitsummen** grid: Titel, PA-Code, Beginn, Ende, Dauer, Blockkategorie, Kommentar.
- **Zeitanrechnungen** grid: Titel, Code, Aufgabe, Kategorie, Grundzeit, Istzeit/Zuschläge, Geplant, Saldo (GLAZ roll-up).
- Insert via `ToolBar "toolbarInsert"` SplitButton (Neu → Block/Zeitsumme); right-side Neu/Bearbeiten/Löschen.
- Grids are `TIntervalGrid`/`TMonthPlanGrid` → **read via screenshot**; edit via the dialogs the toolbar opens.

## Command patterns that work

```bash
P="python3 ~/dev/polypoint/pep-driver/cli/pep --tenant ct-zinc-master"

$P agent-start                       # launch agent into the RDP session (schtasks /it, no double-click)
$P menupath Definitionen Hierarchie  # atomic menu nav (handles #32768 + [0])
$P def Dienst                        # open a Definitionen dialog + report its class
$P dialogs                           # list open modal dialogs (child windows of PEP)
$P clickin '…>class=TVirtualStringTree' --fx 0.2 --fy 0.39   # select an opaque tree node by rect
$P clickxy 548 358 --double          # open a roster cell → Stempeleditor
$P screenshot --out day.png          # read a grid visually (crisp, Windows-side)
$P close                             # close topmost dialog via Abbrechen/Schliessen/…
```

Read grid **values** through api-pp (see the `api-pp-direct-query-poco-bruno`
memory), not the GUI. Use PEP for actions the api can't do and for visual
confirmation.
