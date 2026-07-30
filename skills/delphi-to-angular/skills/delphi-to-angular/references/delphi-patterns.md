# Delphi P2 Codebase Patterns

## Repository Structure

Main modules: `delphi/pep/` (PEP) and `delphi/rap/` (RAP)

## File Naming

| Prefix | Type        | File pair       | Example                     |
| ------ | ----------- | --------------- | --------------------------- |
| `f`    | Form        | `.dfm` + `.pas` | `fEditMitarbeiter.dfm/.pas` |
| `fr`   | Frame       | `.dfm` + `.pas` | `frMitarbGuthaben.dfm/.pas` |
| `dm`   | Data Module | `.dfm` + `.pas` | `dmPepDB.dfm/.pas`          |
| `intf` | Interface   | `.pas` only     | `intfPersonaldaten.pas`     |

- `.dfm` = visual design (component tree, properties, layout, embedded SQL)
- `.pas` = code-behind (event handlers, business logic, state)

## DFM Anatomy

```
object fEditMitarb: TfEditMitarb         <- form name : class name
  ClientHeight = 566                      <- form dimensions
  ClientWidth = 792
  Caption = 'Edit Employee'
  Position = poOwnerFormCenter            <- centering

  object ButtonPanel1: TButtonPanel       <- nested child component
    VisibleButtons = [bbOk, bbCancel]

  object dbMitarbeiter: TDBGrid           <- data grid
    DataSource = dsMitarbeiter            <- link to data source
    Columns = <                           <- column definitions
      item
        FieldName = 'NACHNAME'
        Width = 120
      end>

  object qryMitarbeiter: TOraQuery        <- Oracle query
    SQL.Strings = (
      'SELECT m.nachname, m.vorname'      <- embedded SQL
      'FROM mitarbeiter m'
      'WHERE m.ID > 0')

  object dsMitarbeiter: TDataSource       <- bridges query to grid
    DataSet = qryMitarbeiter
```

Key things to extract from DFM:

- **Component tree**: nesting = parent/child layout
- **TDataSource.DataSet**: links a data-aware control to a query
- **TOraQuery.SQL.Strings**: the SQL that fetches data
- **TDBGrid.Columns**: field names, widths, visibility
- **TPageControl/TTabSheet**: tab structure
- **Align properties**: `alClient`, `alTop`, `alLeft`, `alRight` determine layout flow

## PAS Anatomy

```pascal
type
  TfEditMitarb = class(TDBParForm)       <- class declaration, base class
    ButtonPanel1: TButtonPanel;            <- published: match DFM names exactly
    dbMitarbeiter: TDBGrid;
    edNachname: TEdit;
    dsMitarbeiter: TDataSource;
    qryMitarbeiter: TOraQuery;

    procedure FormCreate(Sender: TObject);        <- lifecycle events
    procedure FormShow(Sender: TObject);
    procedure FormDestroy(Sender: TObject);
    procedure edNachnameChange(Sender: TObject);  <- field events
    procedure dbMitarbeiterDblClick(Sender: TObject);
  private
    FUserID: Integer;                      <- F prefix = private state
    iUsrEmpMapping: IUserEmployeeMapping;  <- i prefix = interface ref
    procedure ApplyMaFilter;               <- filter logic
    procedure SyncButtons;                 <- UI state sync
    procedure SyncLabels;
    procedure SyncSelection;
  public
    procedure SetupUser(...);              <- public API
    property SelectedID: Integer read GetSelectedID;
  end;
```

Key things to extract from PAS:

- **Published controls**: match 1:1 with DFM component names
- **F-prefixed fields**: become `signal()` in Angular
- **i-prefixed fields**: interface dependencies, inform the service/store design
- **Sync\* methods**: become `computed()` — they derive UI state from data
- **Apply\*Filter methods**: become `computed()` signal filtering
- **Event handlers**: map to template events or reactive patterns

## Common Base Classes

| Class         | Purpose                                    |
| ------------- | ------------------------------------------ |
| `TDBParForm`  | Base for all modal dialog forms            |
| `TPolyFrame`  | Base for frames, includes High-DPI scaling |
| `TDataModule` | Base for data access modules               |

## HiDPI image-list triad — drop on conversion

Polypoint Delphi forms ship per-DPI `TImageList` components in groups of three, e.g.:

```
ilHierarch         ← 96 dpi (1×)
ilHierarch_144dpi  ← 144 dpi (1.5×)
ilHierarch_192dpi  ← 192 dpi (2×)
```

VCL has no DPI-aware glyph scaling; the codebase compensates by maintaining three pre-rendered bitmap sheets per icon set. **Discard the entire triad on conversion** — `@pdx/pp-icons` is a webfont and scales with `font-size`, so per-DPI assets have no equivalent. Map each image-list entry to its semantic icon name (look up the symbol in `@pdx/pp-icons` — see the icon correction table in [pdx-recipes.md](pdx-recipes.md)) and ignore the rest.

Image lists are often hosted on a runtime DataModule (e.g. `dmHierarchieImg`) that exists only to bundle the bitmaps. When the entire DM is image-list metadata, the DM has no Angular counterpart at all — record that in the conversion plan so a reader doesn't go hunting for a service that shouldn't exist.

### Always read the base class

Many forms inherit from a domain-specific base (e.g. `TfKnotenGen`, `TfMitarbBase`). The base class typically defines:

- Common fields (title, name, export codes).
- Common tabs (Description, Export/Import, Additional Info).
- Common validation (duplicate-title check, concurrency).

When the parent form derives from anything other than `TForm` / `TDBParForm` / `TFrame` / `TDataModule`, **read the base PAS file before designing the conversion**. Otherwise the conversion ends up missing fields, tabs, or validation that the base contributed.

In Angular, base-class behaviour usually maps to **a single component with conditional sections per rank/role**, not separate components per subclass.

## DFM `inherited` keyword

When a form's DFM starts with:

```
inherited fMitarbDetail: TfMitarbDetail
  ClientWidth = 920
  ...
```

the `inherited` keyword means: **properties from the parent DFM are merged with this DFM, not shadowed.** A field declared in the parent DFM is still present in the child unless the child explicitly redefines it. When converting, treat the merged set as the source of truth — read both the parent DFM and the inheriting DFM, and combine the field list.

## ShowModal tracing — discover sub-dialogs early

The `ShowModal` call (or `Application.CreateForm` followed by `Show`) is how a Delphi form opens another form modally. Each `ShowModal` target becomes a separate Angular dialog component in the conversion plan.

During analyze, grep the PAS for every `ShowModal` and `CreateForm` and trace what each one opens. Example:

```
fDefFlexHierarchie.pas
├── ShowDefinition → fSpital / fGrp / fKatDef / fZwiEbene  (rank-dependent)
├── peHinzufuegenClick → fNode  (new node input)
├── KategorienDefinieren → fDefKatTyp  (category names)
└── PEPNavBtnPrintClick → fHierarchListe  (print)
```

List every traced sub-dialog under a **Connected dialogs** section in the conversion plan, with a one-line role per dialog. Each becomes its own Angular dialog component opened via `MatDialog.open(..., { width: '36rem', /* … */ })`.

## Two data-flow patterns — pick the right one

Polypoint forms come in two shapes. Identify which one before designing the Angular conversion.

### Pattern A — dataset-bound (DB-aware controls)

`TDataSource` placed on the DFM, `TOraQuery` (or similar) feeding it, `TDBGrid` / `TDBEdit` / `TDBLookupComboBox` reading fields directly. This is the classic VCL pattern and the embedded SQL inside `TOraQuery.SQL.Strings` is the data-access layer.

Angular shape: feature service exposes typed `Observable<T>` / DTOs from a REST endpoint; component consumes via `toSignal()` or a signal store. The embedded SQL is **not** ported — flag it as a backend task.

### Pattern B — controller-mediated (no DB-aware controls)

The DFM has **no** `TDataSource` and **no** `TDB*` controls. The form holds a controller interface field (e.g. `IOrgTreeClient`, `IUserEmployeeMapping`) and passes domain objects in and out through method calls. DataModules (`dm*.pas`) are constructed at runtime via `TSingleDmFactory` rather than being placed on the form's DFM.

This is the canonical Polypoint pattern in modern PEP code (e.g. `fDefFlexHierarchie`, `fHierarchListe`). When you see no `TDataSource = ...` properties on any control, you're in Pattern B.

Angular shape:

```
component
  ↳ injects feature store (signalStore)
    ↳ store.rxMethod (loadX, saveX)
      ↳ injects typed service
        ↳ HttpClient → REST endpoint → DTO
template reads store.items() / store.selected() / store.busy()
```

No `[formField]` on bound controls, no `(input)` → patch-store; instead, controls call store methods on `(click)` / `(change)` and the template reflects derived state.

### How to tell them apart

| Signal in the DFM/PAS               | Pattern |
| ----------------------------------- | ------- |
| `TDataSource` placed on the form    | A       |
| Any `TDB*` control                  | A       |
| `TOraQuery.SQL.Strings = (...)`     | A       |
| Controller interface field (`IFoo`) | B       |
| `TSingleDmFactory` / runtime DM     | B       |
| Controls bind via method calls only | B       |

## Runtime-generated UI — fields that exist in no DFM

Some forms render controls that appear **nowhere** in any `.dfm` or `.pas` — they are built at runtime from database definitions. Reading every DFM/PAS/frame/base class still misses them. This has caused real conversion gaps: entire groups of license-gated, DB-defined fields were silently dropped because they only materialize at runtime.

### The canonical mechanism: `TFeldItemsFrame` ("weitere Angaben")

User-defined fields are a two-table EAV in the database:

- **`DISDBA.FELDITEMTYP`** — field _definitions_: `BEZEICHNUNG` (label), `DATENTYP` (`fdtString`, `fdtList`, `fdtNumber`, `fdtBoolean`, `fdtDate`), `AUSWAHLWERTE` (`;`-separated picklist values), `ANBINDUNG` (what entity the field attaches to, e.g. `KNOTEN`, `PERSONAL`), `REIHENFOLGE` (order), `AKTIV`, and `REQUIRED_KEY` (license gating — see below).
- **`DISDBA.FELDITEMS`** — field _values_, keyed by (`FELDITEMTYPID`, `ANBINDUNG`, `IDANBINDUNG`), value in `WERTSTRING` / `WERTNUMBER` / `WERTBOOLEAN` / `WERTDATE`.

`TFeldItemsFrame` (`rap/frFeldItems.pas`, query builder in `rap/uFelder.pas`) reads the definitions for one `Anbindung` and renders a control per active row. The host form just embeds the frame into an otherwise **empty tab**:

```pascal
FeldItemsFrame := TFeldItemsFrame.Create(self);
FeldItemsFrame.Parent := tsWeitereAngaben;   // tab is EMPTY in the DFM
FeldItemsFrame.Anbindung := at_Knoten;
```

### Detection signals — check every form for these

| Signal                                                                                         | Where     |
| ---------------------------------------------------------------------------------------------- | --------- |
| `frFeldItems` in the `uses` clause                                                             | PAS       |
| `TFeldItemsFrame` field or `.Anbindung :=` assignment                                          | PAS       |
| A `TTabSheet` with **no child controls** in the DFM (e.g. `tsWeitereAngaben`)                  | DFM       |
| SQL touching `FELDITEMTYP` / `FELDITEMS`, or calls to `GetDfId` / `GetPersonalKnotenFeldItems` | PAS / SQL |
| `TDfEd` controls (single user-defined-field editors)                                           | DFM       |

An empty tab in a DFM is never decorative — something populates it at runtime. Find what.

### Enumerating the concrete fields

The field definitions are seed data, not code. In the saas repo they live in Liquibase:

```
pp-services/liquibase/pp-initial-data/src/main/resources/db/{oracle,postgres}/DISDBA/csv/09-data/DATA_FELDITEMTYP.csv
```

Filter rows by the form's `ANBINDUNG` (e.g. `KNOTEN`). **Each active row is a real form field the conversion must account for**: `BEZEICHNUNG` is the German label, `DATENTYP` picks the control (`fdtList` → select, `fdtString` → text input, `fdtBoolean` → toggle, `fdtDate` → datepicker), `AUSWAHLWERTE` supplies the options, `REIHENFOLGE` the order. List them in the conversion plan's **Runtime-generated / license-gated fields** section — with a per-field decision (convert as first-class field vs. generic user-defined-fields UI vs. explicitly out of scope, confirmed with the user).

### License gating lives in data too

`FELDITEMTYP.REQUIRED_KEY` holds a comma-separated list of license key ids matched against the installed `SCHLUESSEL` table (`uFelder.pas`); the field renders only when one of the keys is licensed. Elsewhere, PAS code gates UI via `Lizenz.*Active` checks (`ecLiz.pas`, `TestLizenz(<key id>)`). Either way, **a licensed-off feature is invisible at runtime and near-invisible in the DFM** — grep the PAS for `Lizenz.` and check `REQUIRED_KEY` on every FELDITEMTYP row so licensed fields make it into the plan with their gating condition documented, not silently dropped because the demo system didn't show them.

## Data Flow Pattern

```
TEdit.OnChange
  -> ApplyFilter() builds filter string
    -> Dataset.Filter = '...'
    -> Dataset.Filtered = true
      -> TDBGrid auto-refreshes
        -> SyncButtons() enables/disables actions
```

In Angular this becomes:

```
form.field().value() changes (signal)
  -> computed() filters source array
    -> mat-table re-renders (signal binding)
      -> computed() derives button disabled states
```

## Lifecycle

| Delphi Event     | When                                          | Angular Equivalent                                                                      |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `FormCreate`     | Component instantiated, runs once             | `constructor()` or field initializers — **not** `effect()`                              |
| `FormShow`       | Component made visible (potentially repeated) | `effect(() => store.load(this.id()))` reacting to `input()` signals or route activation |
| User interaction | Events fire                                   | Template events + signal updates                                                        |
| `FormCloseQuery` | Before close, validate                        | `canDeactivate` guard                                                                   |
| `FormDestroy`    | Cleanup                                       | `DestroyRef` / `takeUntilDestroyed`                                                     |

## File Encoding

Delphi files use **ANSI** encoding and **CRLF** line endings. When reading them, be aware of encoding-related characters (e.g., umlauts may appear garbled). The content is still parseable.
