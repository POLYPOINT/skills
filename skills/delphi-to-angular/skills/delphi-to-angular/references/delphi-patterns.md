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

| Delphi Event     | When                          | Angular Equivalent                    |
| ---------------- | ----------------------------- | ------------------------------------- |
| `FormCreate`     | Component instantiated        | `constructor()` or field initializers |
| `FormShow`       | Component visible, data loads | `effect()` reacting to inputs         |
| User interaction | Events fire                   | Template events + signal updates      |
| `FormCloseQuery` | Before close, validate        | `canDeactivate` guard                 |
| `FormDestroy`    | Cleanup                       | `DestroyRef` / `takeUntilDestroyed`   |

## File Encoding

Delphi files use **ANSI** encoding and **CRLF** line endings. When reading them, be aware of encoding-related characters (e.g., umlauts may appear garbled). The content is still parseable.
