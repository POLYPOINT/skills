# PDX Component Recipes

Recipes for using `@pdx/*` components inside generated Angular features. This file is self-contained: everything you need to convert a Delphi form to PDX-styled Angular is documented here, with no dependency on any other skill.

## Label rule (applies to every PDX control)

PDX form controls (`pp-button`, `pp-checkbox`, `pp-radio-button`, `pp-input`, `pp-textarea`, `pp-select`, `pp-multiselect`, `pp-slide-toggle`) take their visible text via a **`label` input** — they do **not** project content. Icon-only buttons (`pp-icon-button`, `pp-floating-action-button`) have no `label` input at all; identify them via `ariaLabel` instead.

```html
<!-- Wrong — content is silently dropped, label is empty -->
<pp-button variant="filled">Save</pp-button>
<pp-checkbox>Active</pp-checkbox>

<!-- Correct — label input, self-closing -->
<pp-button label="Save" variant="filled" />
<pp-checkbox id="active" label="Active" [formField]="form.active" />

<!-- With translate pipe — bind the label -->
<pp-button [label]="'save' | translate" variant="filled" />
```

Always pass `label="..."` (or `[label]="..."` when binding) and use a self-closing tag. Add `id="..."` on `pp-checkbox` / `pp-radio-button` for `for`/`htmlFor` linkage. Exceptions: `pp-chip` falls back to `ng-content` when `label` is unset; `pp-button-toggle` takes its label via content projection (segmented-control children); `pp-dialog` and `pp-tab` use content projection for **bodies**, not labels.

## Icon usage

### Correct names (underscores, not hyphens)

Icon names use **underscores**, not hyphens. Always look up the actual name in `node_modules/@pdx/pp-icons/icons.css` (or `icons.json`) before using one — guessed hyphenated names render an empty box.

| Common guess (wrong)    | Actual name            |
| ----------------------- | ---------------------- |
| `pp-icon-delete`        | `pp-icon-delete_trash` |
| `pp-icon-edit`          | `pp-icon-edit_filled`  |
| `pp-icon-plus`          | `pp-icon-add`          |
| `pp-icon-chevron-right` | `pp-icon-angle_right`  |
| `pp-icon-chevron-down`  | `pp-icon-angle_down`   |
| `pp-icon-chevron-up`    | `pp-icon-angle_up`     |
| `pp-icon-chevron-left`  | `pp-icon-angle_left`   |

`pp-icon-search` and `pp-icon-refresh` happen to match common guesses, but assume nothing — verify each name.

```html
<span class="pp-icon pp-icon-add"></span>
<span class="pp-icon pp-icon-edit_filled"></span>
<span class="pp-icon pp-icon-delete_trash"></span>
```

### SCSS scope — global only

Import the icon stylesheet **once globally** (typically in the app's root `styles.scss`):

```scss
// styles.scss — global only
@use '@pdx/pp-icons/icons';
```

Never import it from a per-component SCSS file. The compiled CSS contains every icon class plus `@font-face` declarations — well over the typical 8KB component-style budget.

## pp-button / pp-icon-button

```html
<pp-button label="Save" variant="filled" (click)="save()" />
<pp-button label="Cancel" variant="outlined" (click)="cancel()" />
<pp-button label="Reset" variant="text" size="sm" (click)="reset()" />
<pp-button label="New" icon="pp-icon-add" variant="filled" (click)="create()" />
<pp-icon-button icon="pp-icon-delete_trash" ariaLabel="Delete" (click)="delete()" />
```

Variants: `filled`, `outlined`, `text`, `tonal`. Sizes: `sm`, `md`, `lg`.

The `icon` input takes the **modifier class only** (e.g. `"pp-icon-add"`); `pp-button`, `pp-icon-button`, `pp-tab`, and `pp-sidenav-item` auto-prepend `pp-icon` internally. For bare HTML icon usage (a `<span class="...">`), pass the full string `class="pp-icon pp-icon-add"` — outside a component, nothing prepends the base class.

## pp-input / pp-textarea

```html
<pp-input label="Email" inputType="email" [formField]="form.email" />
<pp-input label="Search" leadingIcon="pp-icon-search" size="sm" />
<pp-textarea label="Notes" [formField]="form.notes" [autoGrowth]="true" />
<pp-input
  [label]="'category.code' | translate"
  [formField]="form.code"
  [required]="true"
  [helperText]="form.code().errors()[0]?.message ?? ''"
  [fullWidth]="true"
/>
```

`PPInputComponent` replaces `mat-form-field` + `matInput` for text fields. Supported input types: `text`, `email`, `password`, `tel`, `url`. Date, month, and time values are **not** pp-input territory — use `pp-datepicker` (incl. `type="month-year"`) and `pp-timepicker`. For genuinely unsupported types (e.g. `number`, `color`), fall back to `mat-form-field` + `matInput`. Both `pp-input` and `pp-textarea` implement `ControlValueAccessor` — bind via `[formField]` for Signal Forms.

### Mandatory fields & validation display

- **`[required]="true"` renders the label asterisk** (`*`) — never concatenate `*` into a label string. Available on `pp-input`, `pp-textarea`, `pp-autocomplete`, `pp-datepicker`, `pp-timepicker`. Purely visual — the Signal Forms `validate()` rule still enforces. Not available on `pp-select` / `pp-multiselect` / `pp-checkbox` / `pp-radio-group` / `pp-slide-toggle`.
- **Error messages go through `[helperText]`** (`form.field().errors()[0]?.message ?? ''`). Do not bind `[invalid]` / `[error]` manually — `[formField]` writes `field.invalid()` into the control's `invalid` input automatically. On `pp-select` / `pp-multiselect`, use `supportingText` + `isError` instead.
- **Errors appear only after the first save attempt** — gate every validator on a `submitted` signal. Full pattern in [angular-conventions.md § Signal Forms Pattern](angular-conventions.md).

### Width control — context-aware

Inputs render at their **natural width** by default. Pick the width strategy from the surrounding container:

- **Inside a `pp-form-block` / column layout that should fill its column** — set `[fullWidth]="true"` so the input stretches:
  ```html
  <pp-form-block>
    <pp-input label="First name" [formField]="editForm.firstName" [fullWidth]="true" />
  </pp-form-block>
  ```
- **Standalone, in a toolbar / narrow filter / inline search** — leave `fullWidth` off and pick `size="sm"` (default) or `size="lg"`:
  ```html
  <pp-input label="Search" leadingIcon="pp-icon-search" size="sm" />
  ```

Don't blanket-apply `fullWidth` everywhere — a full-width input inside a narrow toolbar visually overflows; a natural-width input inside a 30 rem form-block looks broken. Same rule applies to `pp-textarea`.

### Mixed labeled / label-less rows — `labelSpace`

`pp-input` and `pp-textarea` reserve 8px above the field for the floating-label notch only when `label` is non-empty. In a row that mixes labeled and label-less inputs aligned with `align-items: center`, the label-less fields sit higher than the labeled ones. Pass `labelSpace="always"` on the label-less inputs in such a row to keep them vertically aligned. Use `labelSpace="never"` only for tight legacy layouts that already account for the overflow; the default `'auto'` is correct everywhere else. `pp-select` and `pp-multiselect` have the same `labelSpace` input (`@pdx/pp-select` ≥ 1.3) for rows mixing inputs and selects.

### Read-only fields

For Delphi `ReadOnly = True` text fields, pass `[readonly]="true"`:

```html
<pp-input label="Personnel number" [readonly]="true" [value]="store.personnelNumber()" />
```

The binding is a property, not an attribute. In tests, assert via `nativeInput.readOnly` (DOM property), not `[readonly]` attribute selectors.

## pp-checkbox

```html
<pp-checkbox id="active" label="Active" [formField]="form.active" />
<pp-checkbox id="all" label="Select all" [checked]="allSelected()" [indeterminate]="someSelected()" />
```

**The form value is a plain `boolean`** (`@pdx/pp-checkbox` 2.x). Implements `ControlValueAccessor` for Signal Forms — model the Delphi checkbox field as `boolean`. The indeterminate visual is a separate `[(indeterminate)]` model, never part of the form value; use it only for "select all" style parent checkboxes.

**Check the installed major before generating** (`@pdx/pp-checkbox` in the workspace's `package.json`). On 1.x the API is different: the form value is the tri-state `CheckboxState` enum bound via `[state]`, and change events carry `event.state`. Match whichever major the workspace pins — never mix the two APIs. When migrating 1.x code to 2.x: `[state]="CheckboxState.Selected"` → `[checked]="true"`, `event.state === CheckboxState.Selected` → `event.checked`, model fields retype from `CheckboxState` to `boolean`, and `toCheckbox`/`fromCheckbox` converter helpers get deleted.

For long labels in narrow columns, set `labelWrap`: `'wrap'` (default, flows onto a second line), `'nowrap'` (single line — overflows the parent), or `'truncate'` (clips with ellipsis and shows the full label in a tooltip on hover/focus). Use `'truncate'` when the surrounding column has a hard width and overflow would break layout. Same behaviour is available on `pp-radio-button`.

## pp-radio

```typescript
import { PPRadioGroupComponent, PPRadioOption } from "@pdx/pp-radio";

protected readonly statusOptions: PPRadioOption[] = [
  { id: "active", label: "Active", value: "active" },
  { id: "inactive", label: "Inactive", value: "inactive" },
];
```

```html
<pp-radio-group [formField]="form.status" [options]="statusOptions" />
```

`PPRadioOption` shape: `{ id: string, label: string, value: string | number, disabled?: boolean, ariaLabel?: string | null }`.

For standalone `<pp-radio-button>` instances with long labels, the same `labelWrap` input applies — see the pp-checkbox section above.

## pp-select / pp-multiselect

```typescript
import { PPSelectComponent, PPMultiselectComponent } from "@pdx/pp-select";
import { PPMenuItem } from "@pdx/pp-menu";

protected readonly departmentControl = new FormControl<string>("");

protected readonly departmentOptions: PPMenuItem[] = [
  { id: "1", label: "Engineering" },
  { id: "2", label: "Design" },
];
```

```html
<pp-select label="Department" [options]="departmentOptions" [formControl]="departmentControl" />
<pp-multiselect label="Skills" [options]="skillOptions" [formControl]="skillsControl" />
```

`pp-select` and `pp-multiselect` use **`[formControl]`** (legacy reactive forms), not `[formField]`. Mix Signal Forms (`form()` + `[formField]`) with a separate `FormControl` for any select in the same component. Sizes: `'large'` (default, 2.5rem), `'small'` (2rem).

## pp-list

```typescript
import { PPListComponent, PPListItem, PPListSelectEvent, ListVariant } from "@pdx/pp-list";

protected readonly options: PPListItem[] = [
  { id: 1, label: "Surgery", supportingText: "Floor 3" },
  { id: 2, label: "Radiology" },
];
protected readonly selectedIds = signal<(string | number)[]>([]);
```

```html
<pp-list
  [items]="options"
  [variant]="ListVariant.Multi"
  [(selectedIds)]="selectedIds"
  ariaLabel="Choose departments"
  (itemSelect)="onToggle($event)"
/>
```

Variants: `Default` (read-only), `Single` (replace-on-click), `SingleRadio` (radio indicator), `Multi` (checkbox toggle). `selectedIds` is a `ModelSignal<(string | number)[]>` — even when ids are integers, the array type is `(string | number)[]`. Cast or compare numerically when consumers expect plain numbers.

`pp-list` items render with `id="pp-list-item-<id>"` and `[attr.data-id]` automatically — use `data-id` for stable e2e selectors instead of adding custom testids per row.

Item leading slot accepts either a CSS icon class (`leading: 'pp-icon-home'`) **or** an image URL / base64 data URI (`leadingSrc: 'https://…/avatar.png'`). When both are set, `leadingSrc` wins — use it for avatar lists (e.g. employee pickers) and fall back to `leading` for category-icon lists.

## pp-menu

```typescript
import { PPMenuComponent, PPMenuMultiselectComponent, PPMenuItem } from '@pdx/pp-menu';
```

```html
<pp-menu
  [items]="menuItems"
  [selectedId]="selectedId"
  [isOpen]="isOpen"
  ariaLabel="Choose action"
  (itemSelect)="onSelect($event.id)"
/>
```

`pp-menu` is a presentational dropdown listbox. Open/close state is owned by the parent. Used internally by `pp-select` and as the context menu for `pp-tree`.

## Row actions — the double-click replacement

Delphi grids and trees rely on `OnDblClick` (usually "open/edit the row"). **Never carry that over as a `(dblclick)` binding** — double-click is undiscoverable on the web, unusable on touch devices, and invisible to screen readers. Re-home every double-click action to an explicit affordance:

**(a) Trailing kebab menu per `pp-table` row** (the default for converted `TDBGrid`s) — the last cell of each row carries a `menu` config:

```typescript
private buildRow(category: Category, menuItems: PPMenuItem[]): PPTableRow {
  return {
    columns: [
      { text: category.name },
      // …data cells…
      { menu: { items: menuItems, onSelect: (event) => this.onRowMenuSelect(event, category) } },
    ],
  };
}

private buildRowMenuItems(): PPMenuItem[] {
  return [
    { id: ROW_MENU_EDIT, label: this.translate.instant('common.edit'), icon: 'pp-icon-edit_filled' },
    { id: ROW_MENU_DELETE, label: this.translate.instant('common.delete'), icon: 'pp-icon-delete_trash' },
  ];
}
```

**(b) Dedicated inline action button** — when one action (typically edit) is primary, give it its own fixed-width button cell right before the kebab; the kebab keeps the secondary actions:

```typescript
{
  button: {
    label: '',
    ariaLabel: this.translate.instant('common.edit'),
    icon: 'pp-icon-edit_filled', // modifier class only — pp-button prepends `pp-icon`
    variant: 'text',
    size: 'sm',
    onClick: () => this.edit(row),
  },
  width: 'fixed',
},
```

**(c) `pp-icon-button` action cells** in hand-rolled `<table>`s or dialog lists — one `pp-icon-button` per action with `ariaLabel` + `(click)`.

**(d) Tree nodes** — use `pp-tree`'s `[moreMenu]` context menu (see the pp-tree recipe below); the Delphi tree double-click action becomes a menu entry.

Selection-based fallback: single-click selects the row/node, and a toolbar button acts on the selection. Use this when the action bar already exists (e.g. converted `TListPanel` CRUD toolbars).

## pp-tab

```typescript
import { PPTabGroupComponent, PPTabComponent, PPTabContentDirective } from '@pdx/pp-tab';
```

```html
<pp-tab-group [(selectedIndex)]="activeTab">
  <pp-tab [label]="'overview' | translate" icon="pp-icon-dashboard">
    <ng-template ppTabContent>
      <p>Overview content</p>
    </ng-template>
  </pp-tab>
  <pp-tab [label]="'settings' | translate" icon="pp-icon-settings_gears">
    <ng-template ppTabContent>
      <p>Settings content</p>
    </ng-template>
  </pp-tab>
</pp-tab-group>
```

For consumer-managed content (no `ppTabContent` directive), use `[(selectedIndex)]` and a `@switch` block.

`size` (`'sm'` 48px / `'md'` 58px, default `'md'`) sets the tab height on the group (per-tab override available), and `[notificationCount]` per tab renders a `pp-notification-badge` next to the label (hidden when `null`/`0`). Both require `@pdx/pp-tab` ≥ 1.2 with `@pdx/pp-badge` installed — check the workspace's `package.json` before using them. The `icon` renders as a **leading icon next to the visible label** — older installed versions hid the label when an icon was set; don't rely on that. When tabs overflow their container, the group shows scroll arrows and gradient edge-fades automatically.

### Tabs inside dialogs — stabilize the height

A Delphi `TPageControl` has a fixed pixel height, so its dialog never resizes on tab switches. `pp-tab-group` renders **only the active panel** into one shared `.pp-tab-group__body`, so a converted dialog sized by its content shrinks when the user switches to a shorter tab — a jarring jump the Delphi original never had. Fix it with a **grow-only `min-height` pin** on the tab body (there is no built-in input for this):

```typescript
private readonly host = inject(ElementRef<HTMLElement>);
private maxTabBodyHeight = 0;

/**
 * Pin the shared tab body's min-height to the tallest panel seen so the
 * dialog doesn't shrink when switching to a shorter tab. Grow-only: it
 * settles on the max height and never collapses on tab switches.
 */
private stabilizeTabHeight(): void {
  const body = this.host.nativeElement.querySelector<HTMLElement>('.pp-tab-group__body');
  if (body && body.offsetHeight > this.maxTabBodyHeight) {
    this.maxTabBodyHeight = body.offsetHeight;
    body.style.minHeight = `${this.maxTabBodyHeight}px`;
  }
}
```

Call it after the initial render (`afterNextRender(() => this.stabilizeTabHeight())`) and after every tab switch once the new panel has rendered — e.g. `(selectedIndexChange)` → `requestAnimationFrame(() => this.stabilizeTabHeight())`. Only needed when the container's height derives from the tab content (dialogs); routed full-page tab groups don't need it. Don't replace this with a hardcoded height — the Delphi pixel height doesn't translate, and grow-only keeps taller tabs unclipped.

## pp-tree

```typescript
import { PPTreeComponent, TreeData } from '@pdx/pp-tree';
import { PPMenuComponent, PPMenuItem } from '@pdx/pp-menu';
```

```html
<pp-tree
  [data]="treeData()"
  [(selectedId)]="selectedNodeId"
  [showAddButton]="true"
  [moreMenu]="contextMenu"
  (selectNode)="onSelect($event)"
  (addNode)="onAdd($event)"
/>
<pp-menu #contextMenu [items]="menuItems()" (itemSelect)="onMenuAction($event)" />
```

`PPTreeComponent` displays hierarchical data with selection, expansion, drag-and-drop reordering, sorting, and context menus. Data via `TreeData[]`. The `moreMenu` input accepts a `PPMenuComponent` reference — the tree node toggles `isOpen` and sets `triggerElement` automatically.

When `pp-tree` doesn't expose a feature you need (custom node templates, lazy loading via `childrenAccessor`, etc.), see the `mat-tree` recipe in [angular-conventions.md](angular-conventions.md).

## pp-expansion-panel

```html
<pp-expansion-panel [accordion]="true">
  <pp-expansion-panel-item
    title="Contract"
    description="Validity and role"
    leadingIcon="pp-icon-document"
    [expanded]="true"
  >
    <!-- pp-form-block, pp-input, etc. -->
  </pp-expansion-panel-item>
  <pp-expansion-panel-item title="Permissions">
    <!-- content -->
  </pp-expansion-panel-item>
</pp-expansion-panel>
```

Use when converting a Delphi `TGroupBox` that collapses or when a section of the form should be optional/progressive. Set `[accordion]="true"` for single-open behaviour. Variants: `desktop` (title + description horizontal), `mobile` (stacked). Prefer this over `<mat-expansion-panel>`.

## pp-slide-toggle

```typescript
import { PPSlideToggleComponent } from '@pdx/pp-slide-toggle';
```

```html
<pp-slide-toggle id="notifications" [label]="'notifications' | translate" [formField]="form.notifications" />
<pp-slide-toggle [label]="'auto_save' | translate" labelPosition="before" size="sm" [(checked)]="autoSave" />
```

On/off switch for binary settings. Implements `ControlValueAccessor` — bind via `[formField]` for Signal Forms, `[formControl]` / `formControlName` for reactive forms, or two-way `[(checked)]` for non-form usage. Sizes: `'lg'` (default, 52×32) and `'sm'` (34×20). `labelPosition` can be `'before'` (left) or `'after'` (right, default).

**Do not blanket-replace `TCheckBox`.** Many Delphi checkboxes are opt-in choices (terms acceptance, multi-select filters) — those stay as `pp-checkbox`. Use `pp-slide-toggle` only when the semantics are "this setting is on/off" (notifications enabled, dark mode, auto-save).

## pp-button-toggle / pp-button-toggle-group

```typescript
import {
  PPButtonToggleGroupComponent,
  PPButtonToggleComponent,
  PPButtonToggleSelectEvent,
} from '@pdx/pp-button-toggle';
```

```html
<pp-button-toggle-group
  [(selectedValue)]="viewMode"
  [ariaLabel]="'view_mode' | translate"
  (selectionChange)="onViewModeChange($event)"
>
  <pp-button-toggle value="day" size="large">{{ 'day' | translate }}</pp-button-toggle>
  <pp-button-toggle value="week" size="large">{{ 'week' | translate }}</pp-button-toggle>
  <pp-button-toggle value="month" size="large">{{ 'month' | translate }}</pp-button-toggle>
</pp-button-toggle-group>
```

Segmented control for mutually-exclusive _visual_ choices: view-mode pickers, density toggles, on-screen segmented filters. Sizes: `'small'` (32 px) and `'large'` (40 px, default). Two-way bind `[(selectedValue)]` or listen to `selectionChange` (`{ value: string }`). Keyboard: ArrowLeft / ArrowRight cycle focus across children.

**Not a `ControlValueAccessor`.** Wire to a signal/state directly. For form-integrated single-choice (radio semantics), prefer `pp-radio-group`. Maps from Delphi `TRadioGroup` styled as toggle buttons or a `TSpeedButton` group with `GroupIndex`.

**Children take label via content projection**, not a `label` input — `<pp-button-toggle value="day">Day</pp-button-toggle>`. This is the exception to the PDX label rule.

## pp-paginator

```typescript
import { PPPaginatorComponent, PPPaginatorPageEvent } from '@pdx/pp-paginator';
```

```html
<pp-paginator
  [length]="store.totalItems()"
  [(pageIndex)]="store.pageIndex"
  [(pageSize)]="store.pageSize"
  [ariaLabel]="'pagination' | translate"
  [previousPageLabel]="'pagination.previous' | translate"
  [nextPageLabel]="'pagination.next' | translate"
  [pageSizeLabel]="'pagination.items_per_page' | translate"
  [pageLabel]="'pagination.page' | translate"
  (page)="onPage($event)"
/>
```

```typescript
protected onPage(event: PPPaginatorPageEvent): void {
  this.store.loadPage(event.pageIndex, event.pageSize);
}
```

Pair with a data table for paged conversions — note `@pdx/pp-table` (`PPTableComponent`) already embeds a paginator, so a standalone `pp-paginator` is mainly for paging non-`pp-table` lists. **`pageIndex` is zero-based** (Material convention) — visible page labels in the UI are 1-based. **Page-size options are hard-coded** to `[10, 25, 50, 100]` in v1.0.1; not configurable. Pass translation keys for every ARIA label so screen readers respect the user's locale.

Use `[hidePageSize]="true"` when the page size is fixed by product requirements and the dropdown adds noise.

## pp-datepicker

```typescript
import { PPDatepickerComponent, PPDateRange } from '@pdx/pp-datepicker';
```

```html
<!-- single date — replaces TDateTimePicker / TPEPDateEdit -->
<pp-datepicker
  [label]="'employee.birthday' | translate"
  [formControl]="birthdayCtrl"
  [required]="true"
  locale="de-CH"
/>

<!-- range — replaces a pair of date edits that bracket a period -->
<pp-datepicker type="range" [label]="'period.range' | translate" [formControl]="rangeCtrl" locale="de-CH" />

<!-- month + year — replaces TECMonthEdit -->
<pp-datepicker type="month-year" [label]="'wage.month' | translate" [formControl]="monthCtrl" locale="de-CH" />
```

Use `@pdx/pp-datepicker` `PPDatepickerComponent` for every Delphi date control. The component is a `ControlValueAccessor`, so wire it with `[formControl]` (or `[formField]` via your Signal Forms bridge) and commit `Date` values. Convert to `Temporal.PlainDate` / `Temporal.PlainYearMonth` at the store/service boundary — keep the form-control on `Date` so the picker round-trips cleanly.

Three modes:

- `type="single"` (default) — commits a single `Date`. Use for any Delphi `TDateTimePicker` / `TPEPDateEdit` / `TDBDateEdit`.
- `type="range"` — commits a `PPDateRange` (`{ start, end }`). Use when the Delphi form has two adjacent date edits bracketing a period and the form treats them as a unit.
- `type="month-year"` — user picks **only a month + year, no day** (the panel skips the day grid and walks them through month → year). Committed value is a `Date` anchored to day 1 of the picked month at 00:00 — the anchor day is an implementation detail to keep the value typed as `Date`; the user never sees or selects a day. Direct replacement for `TECMonthEdit`.

Pass a translated `label`. Set `locale` to the active app locale (`'de-CH' \| 'en' \| 'fr' \| 'it' \| 'nl'` are canonical; arbitrary BCP-47 tags are normalised internally). Apply `[min]` / `[max]` whenever the Delphi source enforces bounds (e.g. validity windows on contracts, absence periods that cannot cross fiscal-year edges). Use `[required]` to mirror `Validators.required` visually — the validator on the bound control still does the enforcement.

Custom date-navigator widgets (`TPEPDateNavigator` with prev/next month buttons + a month label) stay as a small custom component built from `pp-icon-button` + `pp-datepicker`; the picker covers the "pick any date" branch while the icon buttons handle the stepper.

## pp-dialog

```typescript
import { PPDialogComponent } from '@pdx/pp-dialog';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
```

```html
<pp-dialog
  [title]="'category_names.title' | translate"
  [confirmButtonTitle]="'common.save' | translate"
  [showDismissButton]="true"
  (confirm)="onConfirm()"
  (dismiss)="onDismiss()"
>
  <!-- dialog body — pp-form, pp-input, pp-list, table, etc. -->
</pp-dialog>
```

Open the dialog component via Angular Material's `MatDialog` service; wrap the body in `<pp-dialog>`. The header (`title`, close X, optional `[showDismissButton]`) and footer buttons (`confirmButtonTitle`, dismiss) are owned by `pp-dialog` — don't re-create them with `mat-dialog-title` / `mat-dialog-actions`. Bind `(confirm)` and `(dismiss)` to handlers that call `dialogRef.close(value)`.

Use `<mat-dialog-actions>` only for legacy dialogs that still use Material's title/footer pattern; new conversions should use `<pp-dialog>`'s own header/footer. When in doubt, search the workspace for existing `<pp-dialog>` usages and follow their pattern.

## pp-snackbar

Delphi status messages, "saved" confirmations, and non-blocking `ShowMessage` feedback become snackbars. `@pdx/pp-snackbar` is the PDX replacement for `MatSnackBar` — **check whether the workspace has it installed** (`@pdx/pp-snackbar` in `package.json`). If it does, use it; if not, follow the workspace's existing `MatSnackBar` pattern and flag the pp-snackbar migration in the conversion summary.

```typescript
// app.config.ts (once per app)
import { provideSnackbar } from '@pdx/pp-snackbar';
providers: [provideSnackbar()];
```

```typescript
import { PPSnackbarService } from '@pdx/pp-snackbar';

private readonly snackbar = inject(PPSnackbarService);

protected showSaved(): void {
  this.snackbar.open({
    message: this.translate.instant('common.saved'),
    status: 'success',
    undoable: false,
    dismissAriaLabel: this.translate.instant('common.dismiss'),
  });
}
```

Opened via the service only (CDK overlay, FIFO queue — one visible at a time); never place `<pp-snackbar>` in a template. `status`: `'neutral' | 'info' | 'success' | 'warning' | 'error'`. Auto-dismisses after 5 s by default (`autoDismiss` / `autoDismissDelay`). For destructive actions, keep `undoable: true` and subscribe to `ref.onUndo()`. Requires `provideAnimationsAsync()` in the app. Pass translated values for `dismissAriaLabel` / `undoAriaLabel` and any action-button labels.

## pp-form scaffold

Every converted `TForm` body wraps in `<pp-form>`. Use the structural primitives (`PPFormSectionComponent`, `PPFormStackComponent`, `PPFormBlockComponent`, `PPFormTextblockComponent`, `PPFormActionsComponent`) instead of ad-hoc divs + Tailwind for form layout.

```typescript
import {
  PPFormComponent,
  PPFormSectionComponent,
  PPFormStackComponent,
  PPFormBlockComponent,
  PPFormTextblockComponent,
  PPFormActionsComponent,
} from '@pdx/pp-form';
import { PPButtonComponent } from '@pdx/pp-button';
import { PPInputComponent } from '@pdx/pp-input';
```

```html
<div class="w-full max-w-[75rem]">
  <pp-form>
    <pp-form-stack>
      <pp-form-section [title]="'profile.title' | translate" [description]="'profile.description' | translate">
        <pp-form-block>
          <pp-form-stack layout="horizontal">
            <pp-input [label]="'profile.first_name' | translate" [formField]="editForm.firstName" [fullWidth]="true" />
            <pp-input [label]="'profile.last_name' | translate" [formField]="editForm.lastName" [fullWidth]="true" />
          </pp-form-stack>
        </pp-form-block>
      </pp-form-section>

      <pp-form-actions alignment="right">
        <pp-button [label]="'cancel' | translate" variant="outlined" (click)="cancel()" />
        <pp-button [label]="'save' | translate" variant="filled" buttonType="submit" (click)="save()" />
      </pp-form-actions>
    </pp-form-stack>
  </pp-form>
</div>
```

### Structural rules

- **`<pp-form>`** — outermost wrapper, one per component. It renders an internal `<form>` element, so `<pp-button buttonType="submit">` triggers native form submission. Don't nest `<pp-form>` inside another `<form>` or `<pp-form>`.
- **Width-constrained parent.** `<pp-form>` inherits its parent's width and has no intrinsic max-width. Wrap it in `<div class="w-full max-w-[75rem]">` (or whatever content max-width the workspace already uses for routed pages) or the form stretches to fill the viewport.
- **`<pp-form-stack>`** — direct child of `<pp-form>`. Wraps section(s) **and** `<pp-form-actions>` together so spacing between them is governed by the stack. Use `layout="horizontal"` for side-by-side, omit or `"vertical"` for stacking (default).
- **`<pp-form-section>`** — one per semantic region. `title` is required; `description` is optional. Set `singleColumn` only when fields shouldn't flow into multiple columns.
- **`<pp-form-block>`** — groups related fields inside a section. One block per logical cluster.
- **`<pp-form-textblock>`** — inline title/description pair for sub-groupings.
- **`<pp-form-actions>`** — footer row for form-level buttons. Right-aligned by default.

Dialog bodies (opened via `MatDialog` → `PPDialogComponent`) use the same form primitives inside the dialog's content projection. The dialog's confirm/dismiss buttons are owned by `<pp-dialog>` itself (see the `pp-dialog` recipe above) — don't add a separate `<pp-form-actions>` or `<mat-dialog-actions>` row inside the dialog body.

### Two-column layout recipe

Two side-by-side fields share a row → `pp-form-stack layout="horizontal"` with two `pp-form-block` children. Tall stack of fields → vertical `pp-form-stack` of `pp-form-block`s.

```html
<pp-form-section [title]="'employment.title' | translate" [description]="'employment.description' | translate">
  <pp-form-stack layout="horizontal">
    <pp-form-stack>
      <!-- left column -->
      <pp-form-block>
        <pp-input [label]="'first_name' | translate" [formField]="form.firstName" [fullWidth]="true" />
      </pp-form-block>
      <pp-form-block>
        <pp-input [label]="'last_name' | translate" [formField]="form.lastName" [fullWidth]="true" />
      </pp-form-block>
    </pp-form-stack>
    <pp-form-stack>
      <!-- right column -->
      <pp-form-block>
        <pp-input [label]="'employee_id' | translate" [formField]="form.employeeId" [fullWidth]="true" />
      </pp-form-block>
    </pp-form-stack>
  </pp-form-stack>

  <!-- full-width below the columns -->
  <pp-form-block>
    <pp-textarea [label]="'notes' | translate" [formField]="form.notes" [fullWidth]="true" [autoGrowth]="true" />
  </pp-form-block>
</pp-form-section>
```

### Layout pitfalls

The PDX form primitives have a few hard-coded sizing constraints that can clip or wrap content unexpectedly. Detect them up front rather than fighting CSS at the end.

- **`pp-form-block` has `min-width: 14.375rem` (230 px).** Two blocks side by side inside a `pp-form-stack layout="horizontal"` need at least **508 px** of available width to render in one row (`230 + 48 gap + 230`). When the surrounding column is narrower (e.g. tabs share space with a 12 rem photo column on the right), the second block wraps under the first. Inspect the available width along the layout chain (`max-width` + `grid-template-columns` + nested stacks). If the room is `< 508 px`, either stack the blocks vertically (drop `layout="horizontal"`), or override the floor per-scope by setting the `--pp-form-block-min` custom property (e.g. `--pp-form-block-min: 0`) on a parent.
- **`pp-form-actions` is a responsive `auto-fit` grid** (`grid-template-columns: repeat(auto-fit, 9.375rem); gap: 1rem`). Each track is 150 px wide; buttons fit per row only while the container is wider than `n × 150 px + (n − 1) × 16 px`, and wrap onto new rows otherwise. The `alignment` input maps to `--left` / `--center` / `--right` / `--full-width` modifiers controlling `justify-content` (default `right`). Exactly three projected buttons switch to a split layout automatically (first button left, remaining two grouped right) regardless of `alignment`. For other tightly-controlled multi-button bars, build a custom flex action bar instead. Reserve `pp-form-actions` for the canonical Cancel + Save / OK pair (or the native three-button split).
- **No nested `<header>` inside `pp-form`.** `pp-form-section` already renders a `<header>` for its title block. Adding another `<header>` descendant for a section banner produces two banner landmarks on the page — an axe / a11y violation. Use `<div class="…__header">` with appropriate styling for any visual section header inside a PDX form.

### Right-side button rail → `<aside>`, not `pp-form-actions`

Many Delphi forms use a `TListPanel` on the right edge containing buttons that **open other dialogs** (Assignments, Planning Parameters, Credit, etc.). These are not form actions in the OK/Cancel sense — they are sibling navigation. Don't dump them into `<pp-form-actions>`.

```html
<div class="employee-detail">
  <pp-form>
    <!-- form sections -->
  </pp-form>

  <aside class="employee-detail__rail">
    <pp-button [label]="'assignments' | translate" variant="outlined" (click)="openAssignments()" />
    <pp-button [label]="'planning_parameters' | translate" variant="outlined" (click)="openPlanningParameters()" />
    <pp-button [label]="'credit' | translate" variant="outlined" (click)="openCredit()" />
  </aside>
</div>
```

Reserve `<pp-form-actions>` for OK / Cancel / Save / Next; use `<aside>` for the right-side action rail.

## Shell-level components — never from a conversion

`@pdx/pp-sidenav` and `@pdx/pp-top-navigation` are app-shell components, never emitted from a Delphi conversion. See [component-mapping.md § Shell-level components](component-mapping.md#shell-level-components) for the full rule.

## General rules summary

- Prefer `@pdx/pp-button` over `MatButtonModule` for all buttons.
- Prefer `@pdx/pp-input` over `MatFormFieldModule` + `MatInputModule` for text inputs and textareas (dates/months/times go to `pp-datepicker` / `pp-timepicker`; fall back to Material only for genuinely unsupported types like `number`).
- Prefer `@pdx/pp-checkbox` over `MatCheckboxModule`.
- Prefer `@pdx/pp-radio` over `MatRadioModule`.
- Prefer `@pdx/pp-select` over `MatSelectModule`.
- Prefer `@pdx/pp-menu` over `MatMenuModule`.
- Prefer `@pdx/pp-tab` over `MatTabsModule`.
- Prefer `@pdx/pp-list` over `MatListModule` / `MatSelectionList`.
- Prefer `@pdx/pp-expansion-panel` over `MatExpansionModule`.
- Prefer `@pdx/pp-slide-toggle` over `MatSlideToggleModule` for on/off settings — but keep `pp-checkbox` for opt-in checkboxes.
- Prefer `@pdx/pp-paginator` over `MatPaginatorModule` for paged tables and lists.
- For segmented-control / view-mode toggles, use `@pdx/pp-button-toggle` + `pp-button-toggle-group` (not for form radios — those use `pp-radio-group`). Children of `pp-button-toggle-group` take their label via content projection, not a `label` input.
- Wrap every converted `TForm` body in `<pp-form>` with the structural primitives.
- Use `@pdx/pp-icons` for all icons (not Material Icons or FontAwesome).
- **PDX controls take label text via a `label` input, not content projection.** Always self-closing tag with `label="..."`. (Exceptions: `pp-chip`, `pp-button-toggle`, `pp-dialog` body, `pp-tab` body — all use content projection.)
