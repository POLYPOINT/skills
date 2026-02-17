# Component Mapping Reference

## Layout

| Delphi VCL | Angular | Notes |
|---|---|---|
| `TForm` (f*.pas) | Routed standalone component | One component per form, lazy-loaded route |
| `TFrame` (fr*.pas) | Child component | Reusable, data via `input()` |
| `TPanel` | `<div>` with Tailwind | Layout container |
| `TGroupBox` | `<mat-expansion-panel>` or `<fieldset>` | Context-dependent |
| `TPageControl` + `TTabSheet` | `<mat-tab-group>` + `<mat-tab>` | Material M3 tabs |
| `TRzSplitter` | CSS grid or flexbox | No splitter component needed |
| `TShape` | Tailwind border/divider utilities | |

## Inputs (Signal Forms)

| Delphi VCL | Angular | Notes |
|---|---|---|
| `TEdit` | `<mat-form-field>` + `<input matInput [formField]="form.field">` | Signal Forms |
| `TMemo` | `<mat-form-field>` + `<textarea matInput [formField]="form.field">` | |
| `TComboBox` | `<mat-form-field>` + `<mat-select [formField]="form.field">` | |
| `TCheckBox` | `<mat-checkbox [formField]="form.field">` | |
| `TRadioButton` | `<mat-radio-group>` + `<mat-radio-button>` | |
| `TECMonthEdit` | `<mat-form-field>` + `<input matInput [matDatepicker] [formField]="form.date">` | Temporal API |
| `TPEPDateNavigator` | Custom date nav component | Temporal.PlainDate |
| Form data model | `signal<FormData>({...})` + `form(model, schema)` | |
| Filter on change | `computed()` derived from `form.field().value()` | |
| Validation | Schema validators: `required()`, `min()`, `pattern()`, `email()` | |

## Data Display

| Delphi VCL | Angular | Notes |
|---|---|---|
| `TDBGrid` | `<table mat-table>` with `matSort` | Column defs per field |
| `TVirtualStringTree` | `<mat-tree>` | Flat or nested |
| `TListBox` | `<mat-selection-list>` | |
| `TLabel` | `<span>` or `<p>` with Tailwind | |
| `TStatusBar` | Tailwind-styled footer | |

## Actions

| Delphi VCL | Angular | Notes |
|---|---|---|
| `TButton` / `TBitBtn` | `<button mat-raised-button>` or `mat-flat-button` | Context-dependent |
| `TButtonPanel` (OK/Cancel) | `<mat-dialog-actions>` if dialog, form footer otherwise | |
| `TListPanel` (CRUD) | Toolbar with `<button mat-icon-button>` | Insert/Edit/Delete |
| `TPopupMenu` | `<mat-menu>` | |

## Data Layer

| Delphi | Angular | Notes |
|---|---|---|
| `TDataSource` + `TOraQuery` | Service with `HttpClient` | REST call returning Observable |
| `Dataset.Filter` / `Filtered` | `computed()` signal filtering | Client-side filter |
| `FieldByName('X').AsString` | Typed interface property | `employee.lastName` |
| `DataModule` (dm*.pas) | `@Injectable({ providedIn: 'root' })` | |

## Events to Reactivity

| Delphi | Angular | Notes |
|---|---|---|
| `OnClick` | `(click)="method()"` | |
| `OnChange` / `OnExit` | Signal Forms `form.field().value()` or `(input)` | Debounce where needed |
| `OnDblClick` | `(dblclick)="method()"` | |
| `FormCreate` | `constructor()` or `effect()` | |
| `FormShow` | Route activation / `effect()` with inputs | |
| `FormDestroy` | `DestroyRef` / `takeUntilDestroyed` | |
| `FormCloseQuery` | `canDeactivate` guard or dialog confirm | |
| `SyncButtons` / `SyncLabels` | `computed()` signals | Derived state, no manual sync |
| `Apply*Filter` | `computed()` filtering on source signal | |

## State

| Delphi | Angular | Notes |
|---|---|---|
| Private fields (`FUserID`) | `signal()` for local state | |
| Interface calls (business logic) | NgRx Signal Store with `rxMethod` | |
| Properties (Get/Set) | `input()` / `output()` / `model()` | |
| `TDataSource.DataSet.Open` | Store method triggers service call | |

## Naming Transform

1. Drop prefix: `f` (forms), `fr` (frames), `dm` (data modules)
2. Convert to kebab-case: `EditMitarbeiter` -> `edit-mitarbeiter`
3. Translate German to English: `edit-mitarbeiter` -> `edit-employee`
4. Component class: `EditEmployeeComponent`
5. Store class: `EditEmployeeStore`
6. Service class: `EditEmployeeService`
7. Property names: camelCase English (`nachname` -> `lastName`)

## Domain Glossary (German to English)

| German | English |
|---|---|
| Mitarbeiter | Employee |
| Benutzer | User |
| Guthaben | Credit / Balance |
| Anstellung | Employment |
| Personalnummer | Personnel Number |
| Nachname | Last Name |
| Vorname | First Name |
| Kuerzel | Code / Abbreviation |
| Stamm | Base Unit |
| Dienst | Shift / Service |
| Bedarf | Demand |
| Ausnahme | Exception |
| Behandlungsauftrag | Treatment Order |
| Hierarchie | Hierarchy |
| Abteilung | Department |
| Schicht | Shift |
| Planung | Planning |
| Einsatz | Assignment |
| Abwesenheit | Absence |
| Feiertag | Holiday |
| Zeitraum | Period |
| Monat | Month |
| Auswahl | Selection |
| Einstellungen | Settings |
| Berechtigung | Permission |
| Vertrag | Contract |
| Kostenstelle | Cost Center |
| Standort | Location |
| Bemerkung | Remark / Note |
| Bezeichnung | Description / Label |
| Gueltig / Gueltigkeit | Valid / Validity |

If a German term is not in this glossary, **flag it and ask the user** for the correct English translation before proceeding.
