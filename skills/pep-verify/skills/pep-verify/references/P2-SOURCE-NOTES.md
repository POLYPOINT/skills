# PEP Delphi source notes — ground truth for UI automation

Source explored: `/Users/yh/dev/polypoint/P2/delphi/` (checkout as of 2026-07-15).
All files are ISO-8859 text with CRLF — `grep` needs `-a` or it silently treats
them as binary and reports nothing.

## TL;DR

- **PEP is ONE top-level window.** `TfrmPEPMain` ("POLYPOINT | PEP -- POLYPOINT
  AG, Bern") is the only real top-level HWND during normal use. The tabbed
  "children" you see (Planblatt/Monatsplan, Jahresplan, PlanningBoard, POMA
  dashboards, ...) are **not separate windows** — `ChildEngine` reparents them
  (`BorderStyle := bsNone; Parent := ChildParent`) into a panel inside the main
  form. `window*="..."` selectors that expect a second top-level window for the
  roster (e.g. a "Stempeleditor" window) will not find one — see [§0](#0-the-single-window-model-childengine).
  **Modal dialogs are the exception**: anything opened with `.ShowModal` (node
  pickers, Dienst editor, Definitionen list/detail dialogs, ...) _is_ a genuine
  separate top-level window.
- **The roster grid is fully owner-drawn, zero accessible text, no IAccessible/UIA
  support.** `TfrmPlbMonth` (`fPlbMonth.dfm/.pas`) hosts 6 `TMultiSelectionGrid`
  controls (`TStringGrid` subclass, `vclcontrols/cMultiSelGrid.pas:86`). All 6
  have `DefaultDrawing = False` and an `OnDrawCell` handler; `grep -c
"\.Cells\["` across `fPlbMonth.pas` returns **0** — the grid's native
  `TStringGrid.Cells[]` text store is never populated, all text is
  `Canvas.TextOut`/`TextRect` painted by hand from an internal data model
  (`IPlanGridRow`/`IPlanSegment`). No `IAccessible`/MSAA/UIA code exists in
  `cMultiSelGrid.pas` or `fPlbMonth.pas`.
- **Not every grid in PEP is like that.** The ~30 generic "Definitionen" list
  dialogs (`TfrmDefinitionList`, `FDefList.dfm:189`) use a **DevExpress
  `TcxGrid`/`TcxGridTableView`**, data-bound to a real dataset. DevExpress ships
  its own `IAccessible`/UIA-legacy-provider bridge
  (`3rdpart/devExpress/ExpressLibrary/Sources/cxAccessibility.pas`), so these
  dialogs are the best-case target for automation — matches pep-driver's own
  README note that `class=TcxGrid` is the well-behaved grid case.
- **No embedded REST/automation server, no COM automation, no scripting hook
  inside PEP's GUI process.** Everything under `delphi/rest/` is PEP acting as
  an HTTP **client** (Indy `TIdHTTP`) to backends (PPAPI/api-pp, Keycloak, POMA,
  Gateway, PlanningBoard, SmartPEP...). The one real embedded HTTP server in the
  P2 tree (`interfaces/PolyTimeConnect`, Horse-based) is a **separate Windows
  service** for time-clock terminal integration — unrelated to driving the GUI.
- **Some "menu items" are Chromium, not VCL.** PlanningBoard (Webplanblatt),
  POMA dashboards, SkillCatalog etc. embed a CEF browser (`TfrChromium`,
  `FPlanningBoard.pas:105-115`) inside a `PolyChild` panel — UIA will see an
  opaque render-widget window there, not a VCL control tree.

---

## 0. The single-window model (ChildEngine)

`rap/ChildEngImpl.pas` implements `TChildEngine` (`ChildEngImpl.pas:90`), shared
by PEP and RAP. When a "child" screen is opened (Planblatt, Jahresplan,
PlanningBoard, SkillCatalog, POMA dashboards, ...), the engine does this
repeatedly (`ChildEngImpl.pas:1267-1269`, `1371-1373`, `1478-1480`,
`1773-1775`, `1889-1891`):

```pascal
PolyChild.BorderStyle := bsNone;
PolyChild.Parent := ChildParent;   // ChildParent = frmPEPMain.pnlClient
```

i.e. the child form is stripped of its own window chrome and reparented as a
child window inside `pnlClient` on `frmPEPMain` (`fPEPMain.dfm:77-86`). The
active child is switched via the tab strip `tbChildSelector: TRzTabControl`
(`fPEPMain.dfm:31-75`), whose tab caption is set from content, e.g.
`TfrmPlbMonth.TabCaption := StringReplace(fContent.Title, '&','&&',[])`
(`fPlbMonth.pas:11756`) — the tab shows the plan/group name (e.g. "IT Team
1"), **not** the form's design-time `Caption` (`TfrmPlbMonth.Caption =
'Planblatt'`, `fPlbMonth.dfm:4` — it is _never_ set to "Stempeleditor"
anywhere in the source).

`TRzTabControl` (Raize Components, `3rdpart/raize/source/RzTabs.pas`) paints
its own tabs (`DrawTabs`/`DrawTab`/`DrawTabFace`, `RzTabs.pas:1057-1059,5215+`)
— no IAccessible support found, so the active-tab label is likely not directly
UIA-readable either; treat it the same as the roster grid (see §2).

**Implications for UI automation**

- `MAIN_WINDOW_SELECTOR = 'window*="PEP"'` (pep-driver's `_base.py`) is correct
  — there is only one top-level window to match.
- A selector like `window*="Stempeleditor"` (pep-driver's
  `STEMPELEDITOR_SELECTOR`, `agent/flows/_base.py:36`) is very likely **wrong
  as written** — no window is ever titled that. What that flow calls "the
  Stempeleditor" is `TfrmPlbMonth`, embedded as a descendant panel of the one
  PEP window. Fix direction: match by **class name** (`class="TfrmPlbMonth"`)
  as a descendant of the main window, not by a second top-level window title.
  Worth an empirical check in a probe session — pywinauto's UIA backend can
  sometimes still see reparented-but-real HWNDs as a distinct "window" element
  in the raw tree even though it's not top-level, which may be why the existing
  flow appeared to work; but treating it as _the_ top-level window is fragile.
- Anything opened via `.ShowModal` (almost everything under Definitionen, the
  hierarchy/node pickers, Dienst editors) **is** a real separate top-level
  window and `window*="..."` selectors are the right tool there.

---

## 1. Main form & menu map (`TfrmPEPMain`)

`pep/fPEPMain.dfm` (895 lines) + `pep/fPEPMain.pas` (7306 lines, ~240
`TfrmPEPMain.*` procedures). Menu tree `mMainMenu: TMainMenu`
(`fPEPMain.dfm:87-824`), one `TMenuItem` per top-level entry:

| Top menu                            | GroupIndex | Populated in .dfm?                             |
| ----------------------------------- | ---------- | ---------------------------------------------- |
| **Datei** (`miDatei`)               | (none)     | yes, ~45 static items (`fPEPMain.dfm:90-292`)  |
| **Bearbeiten** (`miBearbeiten`)     | 1          | **empty** in fPEPMain.dfm                      |
| **Ansicht** (`miAnsicht`)           | 3          | **empty** in fPEPMain.dfm                      |
| **Definitionen** (`miDefinitionen`) | 7          | yes, ~90 static items (`fPEPMain.dfm:301-656`) |
| **Tools** (`miTools`)               | 9          | yes (`fPEPMain.dfm:657-739`)                   |
| **Extras** (`miExtras`)             | 11         | yes, several `Visible=False` dev-only items    |
| Fenster / `&?`                      | 13 / 15    | mostly hidden/help                             |

**Bearbeiten and Ansicht are contributed by the active child's own menu** via
matching `GroupIndex`. E.g. `fPlbMonth.dfm:3565` declares its own
`mergedMainMenu: TMainMenu` with `miEdit` (`GroupIndex = 1` → merges under
"Bearbeiten": Ausschneiden/Kopieren/Einfügen/Löschen/Dienste tauschen/Sollplan
sichern.../Sollplan überschreiben.../In Zwischenablage exportieren...) and
`miAnsicht` (`GroupIndex = 3` → "Aktualisieren"). This is set via `Menu =
mergedMainMenu` on `TfrmPlbMonth` (`fPlbMonth.dfm:13`) — standard VCL
group-index menu merging. **Practical effect: the actual item set under
Bearbeiten/Ansicht depends on which child tab is active** — inspect the active
child's own `.dfm` for its real contents, not just fPEPMain's.

### Datei → target form/dialog (handler → helper → what opens)

| Menu item                  | OnClick → helper                                                   | Opens                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Planblatt bearbeiten...    | `miOpenPlanClick` (`:3783`) → `PlanblattAufrufen` (`:3874`)        | `TfrmKnotenwahlSperr` (tree, locks node) → `TfrmPlbMonth` (embedded, `ChildEngine.Open(PEPMPlb)` → `OpenNewMPlb`, `:4042`) |
| Webplanblatt bearbeiten... | `miPlanningBoardClick` → `PlanningBoardExecute` (`:3923`)          | `TfrmKnotenwahl` (no lock) → `TPlanningBoard` (embedded, CEF-hosted, see §5)                                               |
| Jahresplan bearbeiten...   | `miJahresplanbearbeitenClick` → `JahresplanAufrufen` (`:4078`)     | year-plan variant, same family as Planblatt                                                                                |
| Suchen...                  | `miMitarbeiterSuchenClick` → `MitarbeiterSuchenAufrufen` (`:4135`) | employee search dialog                                                                                                     |
| Liste öffnen...            | `miListenClick`                                                    | `TFrmLstOutUb` (report/list picker)                                                                                        |
| Personal...                | `miMitarbBearbeitenClick` → `MitarbeiterAufrufen` (`:2782`)        | employee master-data editor                                                                                                |
| Gerät.../Raum...           | `miGeraetBearbeitenClick`/`miRaumClick` (`:2805`/`:2824`)          | resource (device/room) editors, same `TfrmKnotenwahl`-driven pattern                                                       |
| REST-Tests... (hidden)     | `miRESTTestClick` (`:7013`)                                        | `TfrmRESTTest` — dev-only, tests PEP's _outbound_ REST calls; not a driving hook                                           |
| Cookies... (hidden)        | `miCookieViewerClick` (`:6904`)                                    | `TfrmChromiumCookieViewer` — confirms an embedded Chromium instance exists app-wide                                        |

### Definitionen → the dominant pattern

Almost every "Definitionen" leaf item (Dienstgruppe, Dienstkategorie,
Blockkategorie, Guthabenprofil, Pausenprofil, Lohnarten [exception, see below],
Zeitkonto, Höchstarbeitszeitberechnung, Mehrzeitprofil, Schichttyp,
Wechselschichtprofil, Zusatzurlaub, Saldokontrolle-Profil, Zeitausweisprofil,
Sollstellen-adjacent editors, Pikettauslastungs-Profile, Terminals'
Zeiterfassungsprofile, Tätigkeitsprofil, Personalbemessung-Profil, Rollen,
Vorgesetzten-Rollen, LPHS-Profile, Zeitraum, Tagessollraster, Planungsregeln,
Begründungen, Markierung, Sequenz, Aufgaben, ...) follows one pattern
(confirmed by sampling ~40 handlers in `fPEPMain.pas`):

```pascal
iEditor := TXxxEditor.Create;   // TXxxEditor : TBaseDefinitionEditor (uDefEdit.pas:23), impl. IDefinitionEditor
iEditor.ShowList;
```

`TBaseDefinitionEditor.ShowList` (`uDefEdit.pas:932`) creates and shows
**`TfrmDefinitionList`** (`pep/FDefList.dfm`) — the generic master list dialog.
Its grid is:

```
gridDefinitions: TcxGrid            (FDefList.dfm:189)
  viewDefinitions: TcxGridTableView (FDefList.dfm:198)
```

a **DevExpress ExpressQuantumGrid**, data-bound to the definition table (code,
title, color, node, type columns declared per-instance). "New"/"Modify" on a
selected row opens **`TfrmDefinitionEditor`** (`pep/FDefEditor.pas/.dfm`,
`TDBParForm` subclass) — the generic detail form, with real `TEdit`/`TLabel`
controls for Code/Title/Node/Type (`FDefEditor.dfm:64-201`) plus a
per-definition-type embedded detail frame (e.g.
`frameDefinitionPlanblattTabs` for Planblatt, wired via
`frmDefinitionEditor.DetailEditor := ...`, `EdDefinitionPlanblatt.pas:87`).

**Named exceptions that do NOT go through TfrmDefinitionList:**

| Menu item                                    | Opens directly                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Dienst...                                    | `TfrmDienstMain` (`f_dsthpt.pas`, see §3 — has its own icon-palette UI, not a cxGrid list) |
| Hierarchie...                                | see §4                                                                                     |
| Personal...                                  | employee master-data form (own UI)                                                         |
| Stundenlohnperiode festlegen...              | `TfrmStundenLoehnerPeriode.ShowModal`                                                      |
| Stellenplan: Sollstellen...                  | `TfrmKnotenwahl` → `TStellenForm.ShowModal`                                                |
| Stellenplan: Entlastung...                   | `TfrmStellenEntlastung.ShowModal`                                                          |
| Terminals...                                 | `TfrmDefZeiterfassung.ShowModal`                                                           |
| Fehlzeiten...                                | `TFrmDfFehlzeiten.ShowModal`                                                               |
| Vorgabewerte.../Bedarfsprofil.../Adjazenz... | `TfrmKnotenwahl` only (pure hierarchy navigation, no separate editor form)                 |

**Implications for UI automation**: the `TfrmDefinitionList` /
`TfrmDefinitionEditor` pair is the single highest-leverage target in all of
PEP — one selector pattern (`window*="..." > class=TcxGrid`, then
`window*="..." > edit[...]"`) plausibly drives ~30 distinct Definitionen
dialogs. Verify DevExpress's cxGrid accessibility is actually active at
runtime (it's compiled in, but some builds only wire it up for `msaa`/legacy
IAccessible, which UIA reaches via the OS's UIA-to-MSAA bridge — should just
work with pywinauto's `uia` backend, but confirm empirically per pep-driver's
own probe workflow).

---

## 2. Planblatt / roster (`TfrmPlbMonth`, `fPlbMonth.dfm`/`.pas`)

Huge form: 4694-line `.dfm`, 14382-line `.pas`. Six grid instances, all
`TMultiSelectionGrid` (`fPlbMonth.dfm`):

| Grid                                    | Location                        | Role                                                                                                                       |
| --------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GridResources` / `GridResourcesHeader` | `pnlResources` (left, `Left=0`) | employee/resource name column (rows), `RowCount=100`, one name per row group                                               |
| `GridMain` / `GridMainHeader`           | `pnlMain` (center)              | day-by-day plan cells; `GridMainHeader` `ColCount=31` = days of month                                                      |
| `GridSaldo` / `GridSaldoHeader`         | `pnlSaldo` (right, `Left=721`)  | per-employee summary columns (Ist/Soll/Differenz/GLAZ-Saldo — see §6), scrollable, synced row-for-row with `GridResources` |

All six share: `DefaultDrawing = False`, `FixedCols/FixedRows = 0`,
`OwnerDrawOutsideCells = True`, and an `OnDrawCell` handler
(`GridMainDrawCell` `:5368`, `GridMainHeaderDrawCell` `:5455`,
`GridResourcesDrawCell` `:5928`, `GridResourcesHeaderDrawCell` `:6201`,
`GridSaldoDrawCell` `:6471`, `GridSaldoHeaderDrawCell` `:6610`).

### Owner-draw verdict: **YES, fully owner-drawn, zero accessible text**

Evidence:

1. `TMultiSelectionGrid = class(TStringGrid)` (`vclcontrols/cMultiSelGrid.pas:86`)
   overrides `DrawCell`/`Paint` (`:120,127`) — the base `TStringGrid`'s normal
   cell-string painting is fully bypassed.
2. `DefaultDrawing = False` on every instance in the `.dfm` — VCL's own grid
   line/background/text drawing is switched off; 100% custom paint.
3. **`grep -a -c '\.Cells\[' fPlbMonth.pas` → `0`.** The underlying
   `TStringGrid.Cells[]` string store (which is what Win32 accessibility
   helpers would normally read) is never written. All visible text — employee
   names, day-cell contents, Saldo figures — is painted directly onto
   `TCanvas` (`P.Canvas.Font...`/`TextOut`/`TextRect`) inside
   `DrawResource`/`DrawResourceSectionTitle` (`fPlbMonth.pas:3760` and around)
   from an internal object graph (`IPlanGridRow`, `IPlanSegment`,
   `TPlanPaintInfo` record), not from any grid cell property.
4. No `IAccessible`/`WM_GETOBJECT`/UIA code anywhere in `cMultiSelGrid.pas` or
   `fPlbMonth.pas` (repo-wide grep for those tokens only hits DevExpress's own
   `cxAccessibility.pas` and unrelated `Accessible`-scope comments in
   third-party JCL sources — nothing in PEP's own grid code).

**Implications for UI automation**: UIA will see each `TMultiSelectionGrid` as
a single opaque `Pane`/`Custom` element with no cell/row/column children and no
`Value`/`Text`/`Grid` pattern support — matches pep-driver's own documented
"grid returns `method: texts`" fallback note. There is no programmatic API on
the control to pull cell text either. Realistic levers, worst-to-best: (a)
keyboard-navigate + read the focused-cell hint if wired
(`OnUpdateHint`/`TUpdateHintEvent` is a published property,
`cMultiSelGrid.pas:100`, but per-instance wiring needs checking); (b) OCR a
screenshot (`pep screenshot` already exists); (c) best option — read the same
data api-pp/PPAPI exposes instead of scraping the grid at all (see the
`reference_api-pp-direct-query-poco-bruno` memory note).

---

## 3. Definitionen: Dienst / Dienstpalette editor (the 74.2 rename path)

Full chain, confirmed by reading the handler bodies end-to-end:

```
Definitionen → Dienst...
  miDiensteClick            (fPEPMain.pas:2545)
  → DienstDefinitionenAufrufen (fPEPMain.pas:2562)
      → TfrmKnotenwahl.ShowModal            (node/tree picker, see §4)
      → TfrmDienstMain.Create; .Setup(...); .ShowModal   (f_dsthpt.pas/.dfm — "Hauptformular der Dienst- und Dienstpalettendefinition")
          [3 TDienstPalette icon-lists: Präsenz / Absenz / Pikett, on a TPageControl]
          → double-click / "Bearbeiten" on a shift icon:
            TfrmDienstMain.dpNavigator1ModifyClick   (f_dsthpt.pas:1673)
            → TfrmEditDienstPalette.Create; .Setup(dienstHandler,...); .ShowModal
                (fEditDienstPalette.pas/.dfm — embeds TfrmDienstPaletteSettings, line ~803)
                → TfrmDienstPaletteSettings   (fDienstPaletteSettings.pas/.dfm)
                    edLokaleBezeichnung: TEdit           <- the "lokale Bezeichnung" field
                    sbLokaleBezeichnungAendern: TSpeedButton (toggle, GroupIndex=1, AllowAllUp=True)
```

`fDienstPaletteSettings.dfm:46-153`: `lbLokaleBezeichnung` label ("lokale
Bezeichnung:"), `edLokaleBezeichnung: TEdit` (`MaxLength=80`), and
`sbLokaleBezeichnungAendern: TSpeedButton` — a toggle button (the "green
button" from the RDP-driving reference note) next to the edit. Behavior
(`fDienstPaletteSettings.pas:98-123,167-175`):

```pascal
edLokaleBezeichnung.Enabled := bCanModifyDienst and sbLokaleBezeichnungAendern.Down;
// click handler (:167): if toggled off, reset text to fDienst.GlobalName; either way, EnableDisableControls
```

The edit is **disabled by default** (showing the shift's global name); the
speed-button is a toggle (`Down` = "override enabled" = the green look) — its
click handler flips `Down` then calls `EnableDisableControls`, which is what
actually sets `.Enabled := True`. Automating this field: click
`sbLokaleBezeichnungAendern` first (assert `Down`/checked), _then_ type into
`edLokaleBezeichnung` — matches pep-driver's noted "Dienstpalette _lokale
Bezeichnung_ green-enable-button" flow trap in `rename_dienst_palette.py`.
Both are plain `TEdit`/`TSpeedButton` — UIA reads/toggles them fine (unlike
the palette list itself, next).

### `TDienstPalette` (the shift icon list in `TfrmDienstMain`)

`TDienstPalette = class(TListBox)` (`vclcontrols` counterpart is actually
`pep/dstplt.pas:34`), `Style := lbOwnerDrawFixed` (`dstplt.pas:500`), overrides
`DrawItem` (`:101-102`). **No `Items.Add`/`Items.Insert` calls anywhere in the
unit** — like the roster grid, the underlying `TStrings` (which is what a
native Win32 `LISTBOX` control's `LB_GETTEXT` would read) is never populated;
all icon+text painting comes from an internal `ItemList: TList` of `TImgItem`
records via `DrawItem`. Net effect: even though this is a genuine Win32
`ListBox` window class (unlike the fully custom-painted roster grid), reading
item text through the native listbox API will return **empty strings** — so
for automation purposes it behaves the same as the roster grid: no accessible
text, drive it via icon position/index + the "Bearbeiten" navigator button
(`dpNavigator1ModifyClick`) rather than by item text.

**Implications for UI automation**: the rename/edit field itself
(`edLokaleBezeichnung`) is a normal, fully-accessible `TEdit`; getting _to_ it
requires clicking through a non-accessible icon list, so index- or
position-based clicking (or the existing `TIconNavigator` buttons, which are
plain `TSpeedButton`s) is the way in.

---

## 4. Org hierarchy / plan tree picker

"Datei → Planblatt bearbeiten..." and most other node-scoped Definitionen
items open one of two forms declared in `pep/F_hiwahl.pas` /
`pep/f_hiwahlSperr.pas`:

- **`TfrmKnotenwahl`** (`F_hiwahl.pas:16`) — plain node picker.
- **`TfrmKnotenwahlSperr`** (`f_hiwahlSperr.dfm/.pas`) — subclass used
  specifically by `PlanblattAufrufen` (`fPEPMain.pas:3884`) because opening a
  roster for editing also needs to acquire a lock (`GetSelectedLockModule`,
  `ResourceGroup`).

Both host the tree in a **`TVirtualStringTree`** named `sgHierarchie`
(`F_hiwahl.dfm:132-147`), driven by **`THierarchieController`**
(`uHierarchieController.pas:80`, implements `IHierarchieController`), which
wraps the domain model **`TECTreeNode`** (`pep/HierarchFlex.pas:60`) — a
classic parent/children tree object with a `rang: TNodeRank` field
(`cRankHauptknoten` = root/"Space", `cRankKategorie` = department/category
level, `cRankGruppe` = lowest selectable rank = team/"Gruppe" — the exact rank
a caller wants is passed as `AMinSelectableRank`/`AMaxSelectableRank` into
`.Setup(...)`, e.g. `PlanblattAufrufen` passes `cRankGruppe, cRankGruppe` to
force team-level-only selection). `fPlbMonth.dfm` additionally embeds two small
"Kompass" navigation trees (`vStrTreeKompassResource`,
`vStrTreeKompassPlan`, both `TVirtualStringTree`, `fPlbMonth.dfm:814,905`) for
in-roster quick navigation.

**This tree control is a different story than the grids.** VirtualTreeView
(vendored at `3rdpart/virtualtreeview/`) ships real, non-trivial accessibility
support: `VirtualTrees.Accessibility.pas` implements
`TVirtualTreeAccessibility = class(TInterfacedObject, IDispatch, IAccessible)`
and a per-item `TVirtualTreeItemAccessibility`
(`VirtualTrees.Accessibility.pas:15,56`), with `accNavigate` and friends, plus
a whole `VirtualTrees.AccessibilityFactory.pas` for wiring it up. Legacy
`IAccessible` (MSAA) is exactly what UIA's built-in MSAA-to-UIA bridge
consumes, so **the hierarchy tree pickers should be far more automatable than
the roster grid or the Dienstpalette list** — node text and structure are
plausibly readable via UIA out of the box. This should be the first thing to
confirm empirically in a probe session (`sgHierarchie` and the two "Kompass"
trees).

**Implications for UI automation**: prefer selector-based tree navigation
(`tree > treeitem*="IT Team 1"`, already pep-driver's convention) for these
pickers — the underlying control was built with accessibility in mind, unlike
the plan grid. `cbFoldLevel: TComboBox` (`F_hiwahl.dfm:113-122`, "Aufklappen
bis...") is a plain VCL combo and fine too.

---

## 5. Automation / REST / IPC hooks

Checked `delphi/rest/` (~90 units) and `delphi/interfaces/` (13 subsystem
folders: AQUA, DICOM, DeduplicationService, HCIndex, LEP_WAUU, Nanda_Import,
Pflegeplanung, PolyIF, **PolyTimeConnect**, RIS_HL7, TipManagement, chop,
planie, polySoap, reportServer, tarmed, vetPharm).

- **`delphi/rest/` is 100% PEP-as-HTTP-client.** `uRestClient_PPAPI.pas`,
  `uRestClient_Keycloak.pas`, `uRestClient_POMA.pas`, `uRestClient_Gateway.pas`,
  `uRestClient_PlanningBoard`/`intfPlanningBoard.pas`, `uSmartPEP.pas`,
  `uStaffRequirement_PPAPI.pas`, `uRosterSnapshotPPAPI.pas`,
  `uStempelPPAPI.pas`, etc. — all wrap outbound calls to backend services
  (api-pp/PPAPI, Keycloak, POMA, api-gw, PlanningBoard webapp, SmartPEP).
  `uRESTService.pas:20` (`TRestService = class(TInterfacedObject,
IRestService)`) is a thin `TIdHTTP`-based client, not a server. **No
  `TIdHTTPServer`/`TIdTCPServer`/`TWebModule`/COM automation object
  (`TAutoObject`) exists anywhere under `pep/`, `rest/`, `interfaces/`,
  `util/`.** There is also no command-line-argument handling in `pepwin.dpr`
  or `fPEPMain.pas` (`ParamStr`/`ParamCount` are unused there) — no CLI hook
  for scripted navigation either.
- **`interfaces/PolyTimeConnect/`** is a genuine, separate executable
  (`PolyTimeConnect.dpr`) that _does_ run an embedded HTTP server — built on
  the **Horse** framework (`THorse.Listen(FPort, FHost)`,
  `uPolyTimeConnector.pas:250`) and can `RunAsService`
  (`PolyTimeConnect.dpr:33,45-46`). This is the actual "poly-time-connect"
  component: a Windows service that talks to physical Stempeluhr/time-clock
  terminals and forwards stamps into the backend (api-pp). It runs completely
  independently of `pepwin.exe`'s GUI process and exposes nothing that would
  let you drive PEP's window tree — it's a backend-integration service, not an
  automation channel.
- **`DdeClientConv: TDdeClientConv`** exists on `frmPEPMain`
  (`ServiceApplication = 'stampMigration'`, `fPEPMain.dfm:829-833`) — a DDE
  _client_ conversation, declared but not referenced anywhere else in
  `fPEPMain.pas` that I found; looks like a vestigial/legacy migration hook,
  not a server other tools could connect to.
- **CEF (embedded Chromium) is real and used for several "modern" screens.**
  `TPlanningBoard = class(TPolyChild, IChromiumLifecycleAware)`
  (`FPlanningBoard.pas:15`) creates `FChromium: TfrChromium` at runtime
  (`:105`, `Parent := self; Align := alClient`). Same family covers POMA
  dashboards and SkillCatalog (both routed through `ChildEngine.Open(...)`
  like PlanningBoard). For these specific screens, UIA will only ever see an
  opaque Chromium render-widget pane — if driving them matters, look at
  whether CEF's own accessibility/remote-debugging can be turned on
  (`--remote-debugging-port` / CEF `EnableAccessibility`) rather than trying
  UIA on the render surface.
- **Also present but irrelevant to GUI automation**: a second, unrelated
  Delphi project `pepserver.dpr` ("PEP Server" / `fPEPServer.pas`, a
  batch/report-style process) and a hidden dev-only `TfrmRESTTest` dialog
  (`miRESTTestClick`, `fPEPMain.pas:7013`, menu item `Visible=False`) for
  testing PEP's own outbound REST calls — neither is a way to control the GUI.

**Bottom line for §5**: there is no supported automation/scripting/IPC surface
in PEP's GUI process. UI-tree automation (pywinauto/UIA) or driving the same
backend PEP talks to (api-pp/PPAPI directly, bypassing the GUI — already
pep-driver's documented fallback per the `api-pp-direct-query-poco-bruno`
playbook) are the only two real options.

---

## 6. Detail panel & status bar (right-side Saldo section)

Caveat up front: I could not find literal label text "Pers.-Nr." / "Ist-Zeit"
/ "Differenz Ist/Plan" / "GLAZ Saldo" anywhere in `fPEPMain.dfm` or
`fPlbMonth.dfm` as static `TLabel` captions — `fPEPMain.dfm` itself has **no**
per-employee detail panel at all (it's a thin menu/tab shell, see §0/§1). The
best-evidenced match for "a right-side panel showing per-employee Ist/Soll/
Differenz/Saldo figures" is the **`pnlSaldo`** panel on `TfrmPlbMonth`
(`fPlbMonth.dfm:603-689`, positioned at `Left=721`, i.e. physically to the
right of the day-grid), containing `GridSaldo`/`GridSaldoHeader` — **the same
`TMultiSelectionGrid` family as the roster grid**, not separate
`TLabel`/`TEdit` controls.

Column content there is data-driven, not hardcoded: `GridSaldoHeaderDrawCell`
(`fPlbMonth.pas:6610`) pulls each column from `fDisplay.SaldoColumns[ACol]`
(`IPlanMonthDisplayColumnList`, `intfPlbMonthDisplay.pas:180,250,398`), each
backed by an `IDefPlanblattFeld` ("Planblatt-Feld") definition
(`intfPlbMonthDisplay.pas:174,177`) — i.e. **which columns appear (Ist-Zeit,
Differenz, GLAZ-Saldo, ...) is admin-configurable** via "Definitionen →
Planung → Planblatt..." (`miDefPlanblattClick`, `fPEPMain.pas:3176` →
`TDefPlanblattEditor` → the generic `TfrmDefinitionList`/`TfrmDefinitionEditor`
pair from §1). So the Saldo section's _set of fields_ is defined through an
accessible (`TcxGrid`-based) config dialog, but the _rendering_ of those field
values in the roster is done by the same owner-drawn, `Cells[]`-empty grid
mechanism as §2 — no accessible per-cell text at runtime.

**Implications for UI automation**: treat the Saldo panel exactly like the
main roster grid (§2) — no live text via UIA/MSAA. If a specific employee's
Ist/Soll/Differenz/Saldo value is needed, prefer reading it from api-pp/PPAPI
(same underlying data, already a documented oracle path) over trying to OCR or
otherwise scrape `GridSaldo`.

---

## Appendix: form-class quick reference

| Form class                  | File                              | Purpose                                                                 |
| --------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `TfrmPEPMain`               | `fPEPMain.dfm/.pas`               | the one top-level window                                                |
| `TfrmPlbMonth`              | `fPlbMonth.dfm/.pas`              | month roster/"Planblatt" (embedded child, not top-level)                |
| `TPlanningBoard`            | `FPlanningBoard.dfm/.pas`         | CEF-embedded web roster ("Webplanblatt")                                |
| `TfrmKnotenwahl`            | `F_hiwahl.dfm/.pas`               | generic org-hierarchy node picker (no lock)                             |
| `TfrmKnotenwahlSperr`       | `f_hiwahlSperr.dfm/.pas`          | node picker + module lock (used to open a roster)                       |
| `TfrmDienstMain`            | `f_dsthpt.dfm/.pas`               | Dienst-/Dienstpalettendefinitionen main dialog (icon palettes)          |
| `TfrmEditDienstPalette`     | `fEditDienstPalette.dfm/.pas`     | single-shift edit dialog, embeds the settings frame below               |
| `TfrmDienstPaletteSettings` | `fDienstPaletteSettings.dfm/.pas` | the "lokale Bezeichnung" field + green toggle button                    |
| `TfrmDefinitionList`        | `FDefList.dfm/.pas`               | generic master list for ~30 Definitionen dialogs (DevExpress `TcxGrid`) |
| `TfrmDefinitionEditor`      | `FDefEditor.dfm/.pas`             | generic detail editor paired with the above (plain `TEdit`/`TLabel`)    |
| `TfrmRESTTest`              | (hidden dev dialog)               | test PEP's outbound REST calls — not an automation hook                 |
| `TfrmChromiumCookieViewer`  | (hidden dev dialog)               | inspect the embedded CEF instance's cookies                             |

## Appendix: key vendored components

| Class                        | File                                              | Automation-relevant behavior                                                                                             |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `TMultiSelectionGrid`        | `vclcontrols/cMultiSelGrid.pas:86`                | `TStringGrid` subclass, fully owner-drawn, `Cells[]` never populated → no accessible text                                |
| `TDienstPalette`             | `pep/dstplt.pas:34`                               | `TListBox` subclass, `lbOwnerDrawFixed`, `Items` never populated → no accessible text despite being a real Win32 listbox |
| `TcxGrid`/`TcxGridTableView` | DevExpress (`3rdpart/devExpress/...`)             | data-bound, ships `IAccessible`/UIA-legacy bridge (`cxAccessibility.pas`) — likely the best-case PEP grid for automation |
| `TVirtualStringTree`         | `3rdpart/virtualtreeview/Source/VirtualTrees.pas` | ships real `IAccessible` support (`VirtualTrees.Accessibility.pas`) — used for all hierarchy/node-picker trees           |
| `TRzTabControl`              | `3rdpart/raize/source/RzTabs.pas`                 | owner-painted tab strip (`DrawTabs`), no accessibility support found — the ChildEngine tab bar                           |
| `TfrChromium`                | CEF4Delphi (`3rdpart/CEF4Delphi`)                 | embeds Chromium for PlanningBoard/POMA/SkillCatalog screens — opaque to UIA                                              |
