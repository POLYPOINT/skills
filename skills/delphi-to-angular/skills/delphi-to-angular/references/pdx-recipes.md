# PDX Component Recipes

Recipes for using `@pdx/*` components inside generated Angular features. This file is self-contained — everything you need to convert a Delphi form is here. If the `pdx` skill is also installed (it provides full PDX component APIs, design tokens, and layout guidelines), invoke it for the canonical reference; otherwise, treat this file as the source of truth.

## Label rule (applies to every PDX control)

PDX form controls (`pp-button`, `pp-icon-button`, `pp-checkbox`, `pp-radio-button`, `pp-input`, `pp-textarea`, `pp-select`, `pp-multiselect`) take their visible text via a **`label` input** — they do **not** project content.

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

Always pass `label="..."` (or `[label]="..."` when binding) and use a self-closing tag. Add `id="..."` on `pp-checkbox` / `pp-radio-button` for `for`/`htmlFor` linkage. Exceptions: `pp-chip` falls back to `ng-content` when `label` is unset; `pp-dialog` and `pp-tab` use content projection for **bodies**, not labels.

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
@use "@pdx/pp-icons/icons";
```

Never import it from a per-component SCSS file. The compiled CSS contains every icon class plus `@font-face` declarations — well over the typical 8KB component-style budget.

## pp-button / pp-icon-button

```html
<pp-button label="Save" variant="filled" (click)="save()" />
<pp-button label="Cancel" variant="outlined" (click)="cancel()" />
<pp-button label="Reset" variant="text" size="sm" (click)="reset()" />
<pp-button label="New" icon="pp-icon-add" variant="filled" (click)="create()" />
<pp-icon-button
  icon="pp-icon pp-icon-delete_trash"
  ariaLabel="Delete"
  (click)="delete()"
/>
```

Variants: `filled`, `outlined`, `text`, `tonal`. Sizes: `sm`, `md`, `lg`.

## pp-input / pp-textarea

```html
<pp-input label="Email" inputType="email" [formField]="form.email" />
<pp-input label="Search" leadingIcon="pp-icon-search" size="sm" />
<pp-textarea label="Notes" [formField]="form.notes" [autoGrowth]="true" />
```

`PPInputComponent` replaces `mat-form-field` + `matInput` for text fields. Supported input types: `text`, `email`, `password`, `tel`, `url`. For unsupported types (e.g. `month`, `date`), fall back to `mat-form-field` + `matInput`. Both `pp-input` and `pp-textarea` implement `ControlValueAccessor` — bind via `[formField]` for Signal Forms.

### Width control — context-aware

Inputs render at their **natural width** by default. Pick the width strategy from the surrounding container:

- **Inside a `pp-form-block` / column layout that should fill its column** — set `[fullWidth]="true"` so the input stretches:
  ```html
  <pp-form-block>
    <pp-input
      label="First name"
      [formField]="editForm.firstName"
      [fullWidth]="true"
    />
  </pp-form-block>
  ```
- **Standalone, in a toolbar / narrow filter / inline search** — leave `fullWidth` off and pick `size="sm"` (default) or `size="lg"`:
  ```html
  <pp-input label="Search" leadingIcon="pp-icon-search" size="sm" />
  ```

Don't blanket-apply `fullWidth` everywhere — a full-width input inside a narrow toolbar visually overflows; a natural-width input inside a 30 rem form-block looks broken. Same rule applies to `pp-textarea`.

### Read-only fields

For Delphi `ReadOnly = True` text fields, pass `[readonly]="true"`:

```html
<pp-input
  label="Personnel number"
  [readonly]="true"
  [value]="store.personnelNumber()"
/>
```

The binding is a property, not an attribute. In tests, assert via `nativeInput.readOnly` (DOM property), not `[readonly]` attribute selectors.

## pp-checkbox

```html
<pp-checkbox id="active" label="Active" [formField]="form.active" />
```

Three-state via `CheckboxState` enum (`Selected`, `Unselected`, `Indeterminate`). Implements `ControlValueAccessor` for Signal Forms.

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
<pp-select
  label="Department"
  [options]="departmentOptions"
  [formControl]="departmentControl"
/>
<pp-multiselect
  label="Skills"
  [options]="skillOptions"
  [formControl]="skillsControl"
/>
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

## pp-menu

```typescript
import {
  PPMenuComponent,
  PPMenuMultiselectComponent,
  PPMenuItem,
} from "@pdx/pp-menu";
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

## pp-tab

```typescript
import {
  PPTabGroupComponent,
  PPTabComponent,
  PPTabContentDirective,
} from "@pdx/pp-tab";
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

## pp-tree

```typescript
import { PPTreeComponent, TreeData } from "@pdx/pp-tree";
import { PPMenuComponent, PPMenuItem } from "@pdx/pp-menu";
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
<pp-menu
  #contextMenu
  [items]="menuItems()"
  (itemSelect)="onMenuAction($event)"
/>
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
} from "@pdx/pp-form";
import { PPButtonComponent } from "@pdx/pp-button";
import { PPInputComponent } from "@pdx/pp-input";
```

```html
<div class="w-full max-w-201">
  <pp-form>
    <pp-form-stack>
      <pp-form-section
        [title]="'profile.title' | translate"
        [description]="'profile.description' | translate"
      >
        <pp-form-block>
          <pp-form-stack layout="horizontal">
            <pp-input
              [label]="'profile.first_name' | translate"
              [formField]="editForm.firstName"
              [fullWidth]="true"
            />
            <pp-input
              [label]="'profile.last_name' | translate"
              [formField]="editForm.lastName"
              [fullWidth]="true"
            />
          </pp-form-stack>
        </pp-form-block>
      </pp-form-section>

      <pp-form-actions alignment="right">
        <pp-button
          [label]="'cancel' | translate"
          variant="outlined"
          (click)="cancel()"
        />
        <pp-button
          [label]="'save' | translate"
          variant="filled"
          buttonType="submit"
          (click)="save()"
        />
      </pp-form-actions>
    </pp-form-stack>
  </pp-form>
</div>
```

### Structural rules

- **`<pp-form>`** — outermost wrapper, one per component. It renders an internal `<form>` element, so `<pp-button buttonType="submit">` triggers native form submission. Don't nest `<pp-form>` inside another `<form>` or `<pp-form>`.
- **Width-constrained parent.** `<pp-form>` inherits its parent's width and has no intrinsic max-width. Wrap it in `<div class="w-full max-w-201">` (matches the PDX story templates) or it stretches to fill the viewport.
- **`<pp-form-stack>`** — direct child of `<pp-form>`. Wraps section(s) **and** `<pp-form-actions>` together so spacing between them is governed by the stack. Use `layout="horizontal"` for side-by-side, omit or `"vertical"` for stacking (default).
- **`<pp-form-section>`** — one per semantic region. `title` is required; `description` is optional. Set `singleColumn` only when fields shouldn't flow into multiple columns.
- **`<pp-form-block>`** — groups related fields inside a section. One block per logical cluster.
- **`<pp-form-textblock>`** — inline title/description pair for sub-groupings.
- **`<pp-form-actions>`** — footer row for form-level buttons. Right-aligned by default.

Dialog bodies (opened via `MatDialog` → `PPDialogComponent`) use the same primitives inside the dialog's content projection; `<pp-form-actions>` becomes `<mat-dialog-actions>` in that context.

### Two-column layout recipe

Two side-by-side fields share a row → `pp-form-stack layout="horizontal"` with two `pp-form-block` children. Tall stack of fields → vertical `pp-form-stack` of `pp-form-block`s.

```html
<pp-form-section
  [title]="'employment.title' | translate"
  [description]="'employment.description' | translate"
>
  <pp-form-stack layout="horizontal">
    <pp-form-stack>
      <!-- left column -->
      <pp-form-block>
        <pp-input
          [label]="'first_name' | translate"
          [formField]="form.firstName"
          [fullWidth]="true"
        />
      </pp-form-block>
      <pp-form-block>
        <pp-input
          [label]="'last_name' | translate"
          [formField]="form.lastName"
          [fullWidth]="true"
        />
      </pp-form-block>
    </pp-form-stack>
    <pp-form-stack>
      <!-- right column -->
      <pp-form-block>
        <pp-input
          [label]="'employee_id' | translate"
          [formField]="form.employeeId"
          [fullWidth]="true"
        />
      </pp-form-block>
    </pp-form-stack>
  </pp-form-stack>

  <!-- full-width below the columns -->
  <pp-form-block>
    <pp-textarea
      [label]="'notes' | translate"
      [formField]="form.notes"
      [fullWidth]="true"
      [autoGrowth]="true"
    />
  </pp-form-block>
</pp-form-section>
```

### Layout pitfalls

The PDX form primitives have a few hard-coded sizing constraints that can clip or wrap content unexpectedly. Detect them up front rather than fighting CSS at the end.

- **`pp-form-block` has `min-width: 14.375rem` (230 px).** Two blocks side by side inside a `pp-form-stack layout="horizontal"` need at least **508 px** of available width to render in one row (`230 + 48 gap + 230`). When the surrounding column is narrower (e.g. tabs share space with a 12 rem photo column on the right), the second block wraps under the first. Inspect the available width along the layout chain (`max-width` + `grid-template-columns` + nested stacks). If the room is `< 508 px`, either stack the blocks vertically (drop `layout="horizontal"`), or apply a scoped `min-width: 0` override so the block can shrink below its built-in floor.
- **`pp-form-actions` is a hard 2-column grid** (`grid-template-columns: repeat(2, 9.375rem)`). Adding a third button inside `pp-form-actions` silently wraps it onto a new row. For >2 actions, generate a custom flex action bar (e.g. a `<div>` with `display: flex` and a spacer between secondary and primary buttons) instead of forcing everything through `pp-form-actions`. Reserve `pp-form-actions` for the canonical Cancel + Save / OK pair.
- **No nested `<header>` inside `pp-form`.** `pp-form-section` already renders a `<header>` for its title block. Adding another `<header>` descendant for a section banner produces two banner landmarks on the page — an axe / a11y violation. Use `<div class="…__header">` with appropriate styling for any visual section header inside a PDX form.

### Right-side button rail → `<aside>`, not `pp-form-actions`

Many Delphi forms use a `TListPanel` on the right edge containing buttons that **open other dialogs** (Assignments, Planning Parameters, Credit, etc.). These are not form actions in the OK/Cancel sense — they are sibling navigation. Don't dump them into `<pp-form-actions>`.

```html
<div class="employee-detail">
  <pp-form>
    <!-- form sections -->
  </pp-form>

  <aside class="employee-detail__rail">
    <pp-button
      [label]="'assignments' | translate"
      variant="outlined"
      (click)="openAssignments()"
    />
    <pp-button
      [label]="'planning_parameters' | translate"
      variant="outlined"
      (click)="openPlanningParameters()"
    />
    <pp-button
      [label]="'credit' | translate"
      variant="outlined"
      (click)="openCredit()"
    />
  </aside>
</div>
```

Reserve `<pp-form-actions>` for OK / Cancel / Save / Next; use `<aside>` for the right-side action rail.

## Shell-level components — never from a conversion

`@pdx/pp-sidenav` and `@pdx/pp-top-navigation` are app-shell components, never emitted from a Delphi conversion. See [component-mapping.md § Shell-level components](component-mapping.md#shell-level-components) for the full rule.

## General rules summary

- Prefer `@pdx/pp-button` over `MatButtonModule` for all buttons.
- Prefer `@pdx/pp-input` over `MatFormFieldModule` + `MatInputModule` for text inputs and textareas (fall back to Material for unsupported input types like `month`).
- Prefer `@pdx/pp-checkbox` over `MatCheckboxModule`.
- Prefer `@pdx/pp-radio` over `MatRadioModule`.
- Prefer `@pdx/pp-select` over `MatSelectModule`.
- Prefer `@pdx/pp-menu` over `MatMenuModule`.
- Prefer `@pdx/pp-tab` over `MatTabsModule`.
- Prefer `@pdx/pp-list` over `MatListModule` / `MatSelectionList`.
- Prefer `@pdx/pp-expansion-panel` over `MatExpansionModule`.
- Wrap every converted `TForm` body in `<pp-form>` with the structural primitives.
- Use `@pdx/pp-icons` for all icons (not Material Icons or FontAwesome).
- **PDX controls take label text via a `label` input, not content projection.** Always self-closing tag with `label="..."`.
