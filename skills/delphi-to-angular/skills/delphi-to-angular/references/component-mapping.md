# Component Mapping Reference

For PDX component recipes (full usage patterns, layout pitfalls, icon names, width-control rule), see [pdx-recipes.md](pdx-recipes.md). This file is the Delphi → Angular mapping table only.

## Layout

| Delphi VCL                                    | Angular                                                                                                           | Notes                                                                                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top-level `TForm` (f\*.pas)                   | Routed standalone component, body wrapped in `<pp-form>`                                                          | Use when the form is a navigable feature/screen. Add a lazy-loaded route and use the canonical `<pp-form>` scaffold — see angular-conventions.md. |
| Modal `TForm` from `ShowModal` / `CreateForm` | Angular dialog component opened via `MatDialog` / project dialog wrapper                                          | Do not add a route for modal-only forms. Generate a dialog component and wire it from the parent action that opened the Delphi form.              |
| `TFrame` (fr\*.pas)                           | Child component                                                                                                   | Reusable, data via `input()`. Typically lives inside a `<pp-form-section>` or `<pp-form-block>`                                                   |
| `TPanel`                                      | `<pp-form-block>` inside a form, otherwise `<div>` with Tailwind                                                  | Plain `<div>` only for non-form layout                                                                                                            |
| `TGroupBox`                                   | `<pp-expansion-panel-item>` inside a `<pp-expansion-panel>`; or `<fieldset>` for static, always-visible groupings | Use `<fieldset>` only when the group never collapses. Do **not** use `<mat-expansion-panel>` — see angular-conventions.md pp-expansion-panel.     |
| `TPageControl` + `TTabSheet`                  | `<pp-tab-group>` + `<pp-tab>`                                                                                     | Use `@pdx/pp-tab` `PPTabGroupComponent` + `PPTabComponent`. Two-way bind `[(selectedIndex)]`. Use `ppTabContent` directive for tab panels         |
| `TRzSplitter`                                 | CSS grid or flexbox                                                                                               | No splitter component needed                                                                                                                      |
| `TShape`                                      | Tailwind border/divider utilities                                                                                 |                                                                                                                                                   |

## Inputs (Signal Forms)

| Delphi VCL                | Angular                                                                                                                                    | Notes                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEdit`                   | `<pp-input label="Label" [formField]="form.field" />` (add `[fullWidth]="true"` inside a `pp-form-block`)                                  | Use `@pdx/pp-input` `PPInputComponent`. Signal Forms. Width is context-aware — see pdx-recipes.md. For unsupported types (e.g. `month`), fall back to `mat-form-field` + `matInput`         |
| `TEdit` `ReadOnly = True` | `<pp-input label="Label" [readonly]="true" [value]="store.fieldName()" />`                                                                 | `[readonly]` is a property binding, not an attribute. Tests assert via `nativeInput.readOnly` (DOM property), not `[readonly]` attribute selectors                                          |
| `TMemo`                   | `<pp-textarea label="Label" [formField]="form.field" />`                                                                                   | Use `@pdx/pp-input` `PPTextareaComponent`. Signal Forms                                                                                                                                     |
| `TComboBox`               | `<pp-select label="Label" [options]="options" [formControl]="control" />`                                                                  | Use `@pdx/pp-select` `PPSelectComponent`. Options via `PPMenuItem[]`. For multi-select: `PPMultiselectComponent`. Uses `[formControl]` — see Signal Forms Pattern in angular-conventions.md |
| `TCheckBox`               | `<pp-checkbox id="field" label="Field Label" [formField]="form.field" />`                                                                  | Use `@pdx/pp-checkbox` `PPCheckboxComponent`. Supports `indeterminate`, `error`, and `disabled` states                                                                                      |
| `TRadioButton`            | `<pp-radio-group [formField]="form.field" [options]="options" />` or individual `<pp-radio-button id="opt1" label="Option A" value="a" />` | Use `@pdx/pp-radio` `PPRadioGroupComponent` / `PPRadioButtonComponent`. Options via `PPRadioOption[]`. Implements `ControlValueAccessor`                                                    |
| `TECMonthEdit`            | `<mat-form-field>` + `<input matInput type="month" [formField]="form.month">`                                                              | No PDX month picker yet. Store the input value as `YYYY-MM`, convert to `Temporal.PlainYearMonth` at the boundary.                                                                          |
| `TPEPDateNavigator`       | Custom date nav component                                                                                                                  | Temporal.PlainDate                                                                                                                                                                          |
| Form data model           | `signal<FormData>({...})` + `form(model, schema)`                                                                                          |                                                                                                                                                                                             |
| Filter on change          | `computed()` derived from `form.field().value()`                                                                                           |                                                                                                                                                                                             |
| Validation                | `validate(schema.field, ctx => ...)` + `requiredError({...})` for required fields, `{ kind, message }` for custom errors                   | No named validators (`required()`, `minLength()`, etc.) in `@angular/forms/signals` — use the `validate()` callback. See angular-conventions.md § Signal Forms Pattern.                     |

## Data Display

| Delphi VCL           | Angular                                                                                   | Notes                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TDBGrid`            | `<table mat-table>` with `matSort`                                                        | Column defs per field                                                                                                                                                           |
| `TVirtualStringTree` | `<pp-tree [data]="treeData" (selectNode)="onSelect($event)" />`                           | Use `@pdx/pp-tree` `PPTreeComponent`. Data via `TreeData[]`. Supports drag-and-drop, sorting, context menu via `PPMenuComponent`                                                |
| `TListBox`           | `<pp-list [items]="items" [variant]="ListVariant.Multi" [(selectedIds)]="selectedIds" />` | Use `@pdx/pp-list` `PPListComponent`. Variants: `Default` (read-only), `Single`, `SingleRadio`, `Multi`. Choose based on the Delphi multi-select flag. Items as `PPListItem[]`. |
| `TLabel`             | `<span>` or `<p>` with Tailwind                                                           |                                                                                                                                                                                 |
| `TStatusBar`         | Tailwind-styled footer                                                                    |                                                                                                                                                                                 |

## Actions

| Delphi VCL                                                   | Angular                                                                                                                                | Notes                                                                                                                                                                                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TButton` / `TBitBtn`                                        | `<pp-button label="Save" variant="filled" />` (or `variant="outlined"` / `"text"` / `"tonal"`)                                         | Use `@pdx/pp-button` `PPButtonComponent`. `label` is required (`input.required<string>()`). Variants: `filled`, `outlined`, `text`, `tonal`. Sizes: `sm`, `md`, `lg`                                |
| `TButtonPanel` (OK/Cancel)                                   | `<pp-form-actions>` with `<pp-button>` children in a form body; `<mat-dialog-actions>` with `<pp-button>` inside a `PPDialogComponent` | Use `@pdx/pp-form` `PPFormActionsComponent` as the default. `alignment` defaults to `'right'`.                                                                                                      |
| `TListPanel` (CRUD)                                          | Toolbar with `<pp-icon-button>`                                                                                                        | Use `@pdx/pp-button` `PPIconButtonComponent` for Insert/Edit/Delete                                                                                                                                 |
| `TListPanel` (right-side action panel — opens other dialogs) | `<aside>` next to the form body with `<pp-button>` children, **not** inside `<pp-form-actions>`                                        | These buttons (Assignments, Planning Parameters, Credit, etc.) are sibling navigation, not form actions. Reserve `<pp-form-actions>` for OK/Cancel/Save/Next. See pdx-recipes.md right-rail recipe. |
| Floating action                                              | `<pp-fab>`                                                                                                                             | Use `@pdx/pp-button` `PPFloatingActionButtonComponent`                                                                                                                                              |
| `TPopupMenu`                                                 | `<pp-menu [items]="items" (itemSelect)="onSelect($event)" />`                                                                          | Use `@pdx/pp-menu` `PPMenuComponent`. For multi-select: `PPMenuMultiselectComponent`. Items via `PPMenuItem[]`                                                                                      |

### Icons

Use `@pdx/pp-icons` for all icons via `<span class="pp-icon pp-icon-<name>"></span>`. Icon names use **underscores** (`pp-icon-delete_trash`, `pp-icon-add`, `pp-icon-angle_right`) — never guess hyphenated names. The SCSS is global-only (`@use '@pdx/pp-icons/icons'` in the app's root `styles.scss`); never import it from a component SCSS file. See [pdx-recipes.md](pdx-recipes.md) for the correction table and scope rule.

### Shell-level components

`@pdx/pp-sidenav` and `@pdx/pp-top-navigation` are app-shell components, **not** per-form primitives. A converted Delphi form is a feature routed _into_ the saas app's existing shell — it never introduces or replaces navigation.

Do not emit `<pp-sidenav>` or `<pp-top-navigation>` markup from any conversion, even if the Delphi source has a `TMainMenu`, `TTreeView` used as a navigation tree, or a toolbar at the top of the form. Flag such elements in the conversion plan as "shell-level — leave to app-shell team" and move on.

Apply `pp-sidenav` / `pp-top-navigation` only in a separate, explicit task that asks for app-shell navigation work. Do not infer the need from screenshots or from a design that happens to show a bar / column — those may be page headers, filter panels, or inspector panes that stay as plain layout or `mat-sidenav`.

## Data Layer

| Delphi                        | Angular                               | Notes                          |
| ----------------------------- | ------------------------------------- | ------------------------------ |
| `TDataSource` + `TOraQuery`   | Service with `HttpClient`             | REST call returning Observable |
| `Dataset.Filter` / `Filtered` | `computed()` signal filtering         | Client-side filter             |
| `FieldByName('X').AsString`   | Typed interface property              | `employee.lastName`            |
| `DataModule` (dm\*.pas)       | `@Injectable({ providedIn: 'root' })` |                                |

## Events to Reactivity

| Delphi                       | Angular                                          | Notes                         |
| ---------------------------- | ------------------------------------------------ | ----------------------------- |
| `OnClick`                    | `(click)="method()"`                             |                               |
| `OnChange` / `OnExit`        | Signal Forms `form.field().value()` or `(input)` | Debounce where needed         |
| `OnDblClick`                 | `(dblclick)="method()"`                          |                               |
| `FormCreate`                 | `constructor()` or `effect()`                    |                               |
| `FormShow`                   | Route activation / `effect()` with inputs        |                               |
| `FormDestroy`                | `DestroyRef` / `takeUntilDestroyed`              |                               |
| `FormCloseQuery`             | `canDeactivate` guard or dialog confirm          |                               |
| `SyncButtons` / `SyncLabels` | `computed()` signals                             | Derived state, no manual sync |
| `Apply*Filter`               | `computed()` filtering on source signal          |                               |

## State

| Delphi                           | Angular                            | Notes |
| -------------------------------- | ---------------------------------- | ----- |
| Private fields (`FUserID`)       | `signal()` for local state         |       |
| Interface calls (business logic) | NgRx Signal Store with `rxMethod`  |       |
| Properties (Get/Set)             | `input()` / `output()` / `model()` |       |
| `TDataSource.DataSet.Open`       | Store method triggers service call |       |

## Naming Transform

1. Drop prefix: `f` (forms), `fr` (frames), `dm` (data modules)
2. Convert to kebab-case: `EditMitarbeiter` -> `edit-mitarbeiter`
3. Translate German to English: `edit-mitarbeiter` -> `edit-employee`
4. Component class: `EditEmployeeComponent`
5. Store class: `EditEmployeeStore`
6. Service class: `EditEmployeeService`
7. Property names: camelCase English (`nachname` -> `lastName`)

## Domain Glossary (German to English)

| German                | English             |
| --------------------- | ------------------- |
| Mitarbeiter           | Employee            |
| Benutzer              | User                |
| Guthaben              | Credit / Balance    |
| Anstellung            | Employment          |
| Personalnummer        | Personnel Number    |
| Nachname              | Last Name           |
| Vorname               | First Name          |
| Kuerzel               | Code / Abbreviation |
| Stamm                 | Base Unit           |
| Dienst                | Shift / Service     |
| Bedarf                | Demand              |
| Ausnahme              | Exception           |
| Behandlungsauftrag    | Treatment Order     |
| Hierarchie            | Hierarchy           |
| Abteilung             | Department          |
| Schicht               | Shift               |
| Planung               | Planning            |
| Einsatz               | Assignment          |
| Abwesenheit           | Absence             |
| Feiertag              | Holiday             |
| Zeitraum              | Period              |
| Monat                 | Month               |
| Auswahl               | Selection           |
| Einstellungen         | Settings            |
| Berechtigung          | Permission          |
| Vertrag               | Contract            |
| Kostenstelle          | Cost Center         |
| Standort              | Location            |
| Bemerkung             | Remark / Note       |
| Bezeichnung           | Description / Label |
| Gueltig / Gueltigkeit | Valid / Validity    |
| Knoten                | Node                |
| Ebene                 | Level               |
| Rang                  | Rank                |
| Spital                | Hospital / Company  |
| Betrieb               | Division            |
| Bereich               | Area                |
| Gruppe                | Group               |
| Kategorie             | Category            |
| Zwischenknoten        | Intermediate Node   |
| Hauptknoten           | Root Node           |
| Reihenfolge           | Sort Order          |
| Zusatztitel           | Additional Title    |
| Personalart           | Personnel Type      |
| Kategorienamen        | Category Names      |
| Sperren               | Lock                |
| Entsperren            | Unlock              |

If a German term is not in this glossary, **flag it and ask the user** for the correct English translation before proceeding. Some domain terms (e.g. `Spital`) carry context the user may want to keep in the English name — confirm rather than translate blindly.
