# PDX Component Library Inventory

All libraries live in the PDX monorepo at `/libs/`. The repo uses Nx, Angular 21, standalone components, signals, and Vitest.

Every component library depends on `@pdx/pp-theme` as a peer dependency.

---

## @pdx/pp-theme (v1.1.0)

Foundational design system theme. Provides colors, typography, spacing, and design tokens. Integrates AkkuratStd font, TailwindCSS, and Angular Material into a unified system.

### Entry Points

**CSS (recommended for most projects):**

```css
@import "@pdx/pp-theme/css/index.css";
```

**Individual imports:**

```css
@import "@pdx/pp-theme/css/font/fonts.css";
@import "@pdx/pp-theme/css/tailwind/tailwind.css";
@import "@pdx/pp-theme/css/angular-material/material.css";
```

**SCSS:**

```scss
@use "@pdx/pp-theme/scss/index";
/* Or individual: */
@use "@pdx/pp-theme/scss/font/fonts";
@use "@pdx/pp-theme/scss/color/colors";
@use "@pdx/pp-theme/scss/angular-material/material";
```

**TypeScript color data:**

```typescript
import { ... } from '@pdx/pp-theme';
```

### Color Tokens

**SCSS variables:** `$pp-primary`, `$pp-secondary-500`, `$pp-error`, `$pp-success`, etc.

**CSS variables:** `--color-pp-primary-500`, `--color-pp-secondary-980`, etc.

**TailwindCSS utilities:** `text-pp-primary-500`, `bg-pp-secondary-980`, etc.

**Core palettes:** primary, secondary, tertiary, neutral-variant, error, success, info, warning.

**Extended palettes:** orange, purple, dark-blue, blue, light-blue, light-green, green, yellow.

**Shade scale:** 0-990 per palette.

### Typography

AkkuratStd family: Light (300), Regular (400), Bold (700). CSS class: `.font-akkurat`.

### Angular Material Integration

Material 3 theme configuration with primary and tertiary palettes mapped to PDX colors. Density: 0. Typography: AkkuratStd.

---

## @pdx/pp-icons (v6.5.2)

SVG icon set packaged as a webfont. No Angular dependencies.

### Usage

```scss
@use "@pdx/pp-icons/icons";
```

```css
@import "@pdx/pp-icons/icons.css";
```

```html
<span class="pp-icon pp-icon-add"></span>
<span class="pp-icon pp-icon-edit"></span>
<span class="pp-icon pp-icon-delete"></span>
```

CSS class pattern: `pp-icon pp-icon-<icon-name>`

---

## @pdx/pp-button (v1.2.0)

Buttons for all user interaction needs: standard buttons, icon buttons, and floating action buttons (FAB).

### Components

#### PPButtonComponent

```typescript
import { PPButtonComponent } from "@pdx/pp-button";
```

```html
<pp-button label="Save" variant="filled" size="md" />
<pp-button label="Cancel" variant="outlined" />
<pp-button label="Delete" variant="text" icon="pp-icon pp-icon-delete" />
<pp-button
  label="Submit"
  variant="filled"
  [fullWidth]="true"
  buttonType="submit"
/>
<pp-button label="Warning" variant="tonal" />
```

| Input        | Type                                          | Default    | Description                    |
| ------------ | --------------------------------------------- | ---------- | ------------------------------ |
| `label`      | `string`                                      | required   | Button text                    |
| `variant`    | `'filled' \| 'outlined' \| 'text' \| 'tonal'` | `'filled'` | Visual style                   |
| `size`       | `'sm' \| 'md' \| 'lg'`                        | `'md'`     | Button size                    |
| `icon`       | `string`                                      | —          | Icon class name (leading icon) |
| `disabled`   | `boolean`                                     | `false`    | Disabled state                 |
| `fullWidth`  | `boolean`                                     | `false`    | Full-width button              |
| `buttonType` | `'button' \| 'submit' \| 'reset'`             | `'button'` | HTML button type               |
| `ariaLabel`  | `string`                                      | —          | Accessibility label            |

#### PPIconButtonComponent

```typescript
import { PPIconButtonComponent } from "@pdx/pp-button";
```

Compact icon-only button for toolbars and inline actions. Always provide `ariaLabel`.

#### PPFloatingActionButtonComponent

```typescript
import { PPFloatingActionButtonComponent } from "@pdx/pp-button";
```

Prominent FAB for primary screen actions. Supports fixed positioning.

### Peer Dependencies

`@angular/common`, `@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-input (v1.4.0)

Text inputs and textareas with validation, helper text, tooltips, and forms integration.

### Components

#### PPInputComponent

```typescript
import { PPInputComponent } from "@pdx/pp-input";
```

```html
<pp-input label="Email" inputType="email" size="lg" [required]="true" />
<pp-input label="Search" leadingIcon="pp-icon pp-icon-search" size="sm" />
<pp-input label="Name" variant="filled" helperText="Enter your full name" />
<pp-input label="Password" inputType="password" [invalid]="hasError" />
```

| Input          | Type                                                | Default      | Description               |
| -------------- | --------------------------------------------------- | ------------ | ------------------------- |
| `label`        | `string`                                            | required     | Field label               |
| `inputType`    | `'text' \| 'email' \| 'password' \| 'tel' \| 'url'` | `'text'`     | HTML input type           |
| `size`         | `'sm' \| 'lg'`                                      | `'sm'`       | Field size                |
| `variant`      | `'filled' \| 'unfilled'`                            | `'unfilled'` | Label behavior            |
| `leadingIcon`  | `string`                                            | —            | Icon before field         |
| `trailingIcon` | `boolean`                                           | —            | Show trailing icon        |
| `helperText`   | `string`                                            | —            | Guidance text below field |
| `tooltip`      | `string`                                            | —            | Hover hint text           |
| `required`     | `boolean`                                           | `false`      | Shows required marker     |
| `optional`     | `boolean`                                           | `false`      | Shows "(optional)"        |
| `invalid`      | `boolean`                                           | `false`      | Error state               |
| `disabled`     | `boolean`                                           | `false`      | Disabled state            |
| `readonly`     | `boolean`                                           | `false`      | Read-only state           |
| `fullWidth`    | `boolean`                                           | `false`      | Full-width field          |
| `value`        | `string`                                            | —            | Current value             |
| `ariaLabel`    | `string`                                            | —            | Accessibility label       |

**Output:** `inputChange` emits the new value.

**Forms:** Implements `ControlValueAccessor` for reactive forms.

#### PPTextareaComponent

```typescript
import { PPTextareaComponent } from "@pdx/pp-input";
```

Same inputs as PPInputComponent, plus `autoGrowth: boolean` for auto-expanding height.

**Output:** `textareaChange` emits the new value.

### Global Styles

```scss
@use "@pdx/pp-input/styles";
```

### Peer Dependencies

`@angular/common`, `@angular/core`, `@angular/forms`, `@angular/material` (MatTooltip), `@pdx/pp-theme`

---

## @pdx/pp-checkbox (v1.1.0)

Accessible checkbox with three states, error display, and forms integration.

### Components

#### PPCheckboxComponent

```typescript
import { PPCheckboxComponent, CheckboxState } from "@pdx/pp-checkbox";
```

```html
<pp-checkbox id="terms" label="Accept terms" />
<pp-checkbox
  id="all"
  label="Select all"
  [state]="CheckboxState.Indeterminate"
/>
<pp-checkbox id="err" label="Required field" [error]="true" />
```

| Input       | Type            | Default      | Description         |
| ----------- | --------------- | ------------ | ------------------- |
| `id`        | `string`        | —            | Unique identifier   |
| `label`     | `string`        | —            | Display label       |
| `state`     | `CheckboxState` | `Unselected` | Current state       |
| `error`     | `boolean`       | `false`      | Error state         |
| `disabled`  | `boolean`       | `false`      | Disabled state      |
| `ariaLabel` | `string`        | —            | Accessibility label |

**Outputs:**

- `checkboxChange` — emits `PPCheckboxChangeEvent`
- `indeterminateChange` — emits `PPCheckboxChangeEvent`

### Models

```typescript
enum CheckboxState {
  Selected,
  Unselected,
  Indeterminate,
}

interface PPCheckboxChangeEvent {
  id: string;
  state: CheckboxState;
  checked: boolean;
}
```

**Forms:** Implements `ControlValueAccessor`. Supports both `boolean` and `CheckboxState` values.

### Peer Dependencies

`@angular/core`, `@angular/material` (MatCheckboxModule), `@angular/forms`, `@pdx/pp-theme`

---

## @pdx/pp-radio (v1.1.0)

Radio buttons for single-choice selections. Standalone or grouped.

### Components

#### PPRadioButtonComponent

```typescript
import { PPRadioButtonComponent } from "@pdx/pp-radio";
```

```html
<pp-radio-button id="opt1" label="Option A" value="a" />
```

| Input       | Type               | Default | Description         |
| ----------- | ------------------ | ------- | ------------------- |
| `id`        | `string`           | —       | Unique identifier   |
| `label`     | `string`           | —       | Display label       |
| `value`     | `string \| number` | —       | Associated value    |
| `disabled`  | `boolean`          | `false` | Disabled state      |
| `ariaLabel` | `string`           | —       | Accessibility label |

**Output:** `radioChange` emits the value.

#### PPRadioGroupComponent

```typescript
import { PPRadioGroupComponent, PPRadioOption } from "@pdx/pp-radio";
```

```html
<pp-radio-group
  [options]="options"
  [value]="selected"
  (valueChange)="onSelect($event)"
/>
```

| Input       | Type               | Default | Description       |
| ----------- | ------------------ | ------- | ----------------- |
| `options`   | `PPRadioOption[]`  | —       | Available options |
| `value`     | `string \| number` | —       | Selected value    |
| `disabled`  | `boolean`          | `false` | Disable all       |
| `ariaLabel` | `string`           | —       | Group label       |

**Output:** `valueChange` emits `MatRadioChange`.

### Models

```typescript
interface PPRadioOption {
  id: string;
  label: string;
  value: string | number;
  disabled?: boolean;
  checked?: boolean;
  ariaLabel?: string;
}
```

**Forms:** Implements `ControlValueAccessor`.

### Peer Dependencies

`@angular/core`, `@angular/material` (MatRadioModule), `@angular/forms`, `@pdx/pp-theme`

---

## @pdx/pp-chip (v1.2.0)

Compact chips for filters, tags, and selections.

### Components

#### PPChipComponent

```typescript
import { PPChipComponent } from "@pdx/pp-chip";
```

```html
<pp-chip
  id="tag1"
  label="Angular"
  [removable]="true"
  (removed)="onRemove($event)"
/>
<pp-chip id="cat1" label="Frontend" leadingIcon="pp-icon pp-icon-code" />
<pp-chip id="info" label="Read-only" [removable]="false" />
```

| Input             | Type      | Default | Description                              |
| ----------------- | --------- | ------- | ---------------------------------------- |
| `id`              | `string`  | —       | Unique identifier                        |
| `label`           | `string`  | —       | Display text (or use content projection) |
| `leadingIcon`     | `string`  | —       | Icon class name                          |
| `removable`       | `boolean` | `true`  | Show remove button                       |
| `disabled`        | `boolean` | `false` | Disabled state                           |
| `ariaLabel`       | `string`  | —       | Accessibility label                      |
| `removeAriaLabel` | `string`  | —       | Remove button label                      |

**Output:** `removed` emits `PPChipRemoveEvent`.

#### PPChipListComponent

```typescript
import { PPChipListComponent } from "@pdx/pp-chip";
```

Container for managing multiple chips.

### Models

```typescript
interface PPChipRemoveEvent { id: string; label: string }
interface PPChipItemModel { ... }
```

### Peer Dependencies

`@angular/common`, `@angular/core`, `@angular/forms`, `@pdx/pp-theme`

---

## @pdx/pp-dialog (v1.1.1)

Responsive dialog shell for wrapping custom content. Works with Angular Material's `MatDialog` service.

### Components

#### PPDialogComponent

```typescript
import { PPDialogComponent } from "@pdx/pp-dialog";
```

```html
<pp-dialog
  title="Confirm Delete"
  confirmButtonTitle="Delete"
  dismissButtonTitle="Cancel"
  (confirm)="onConfirm()"
  (dismiss)="onDismiss()"
>
  <p>Are you sure you want to delete this item?</p>
</pp-dialog>
```

| Input                | Type      | Default    | Description        |
| -------------------- | --------- | ---------- | ------------------ |
| `title`              | `string`  | `''`       | Header text        |
| `showCloseButton`    | `boolean` | `true`     | Show X button      |
| `showDismissButton`  | `boolean` | `true`     | Show Cancel button |
| `dismissButtonTitle` | `string`  | `'Cancel'` | Cancel label       |
| `showConfirmButton`  | `boolean` | `true`     | Show Submit button |
| `confirmButtonTitle` | `string`  | `'Ok'`     | Submit label       |
| `confirmDisabled`    | `boolean` | `false`    | Disable submit     |

**Outputs:**

- `dismiss` — emitted on X or Cancel click
- `confirm` — emitted on Submit click

**Content projection:** Place custom body content between the `<pp-dialog>` tags.

### Usage Pattern

Open with `MatDialog`:

```typescript
this.dialog.open(MyDialogComponent, { ... })
```

Inside `MyDialogComponent` template, wrap content in `<pp-dialog>`.

### Global Styles

```scss
@use "@pdx/pp-dialog/styles";
```

Provides overlay and backdrop styling.

### Peer Dependencies

`@angular/cdk`, `@angular/core`, `@pdx/pp-button`, `@pdx/pp-theme`

---

## @pdx/pp-tree (v1.2.1)

Flexible tree component for hierarchical data. Supports selection, expansion, drag-and-drop, sorting, and custom node templates.

### Components

#### PPTreeComponent

```typescript
import { PPTreeComponent, TreeData } from "@pdx/pp-tree";
```

```html
<pp-tree
  [data]="treeData"
  [selectedId]="selectedNodeId"
  [showDragButton]="true"
  [showAddButton]="true"
  (selectNode)="onSelect($event)"
  (moveNode)="onMove($event)"
  (treeChange)="onTreeUpdate($event)"
/>
```

| Input            | Type         | Default  | Description                     |
| ---------------- | ------------ | -------- | ------------------------------- |
| `data`           | `TreeData[]` | required | Hierarchical data               |
| `selectedId`     | `string`     | —        | Currently selected node         |
| `folderMode`     | `boolean`    | —        | Folder/document icons           |
| `showDragButton` | `boolean`    | —        | Show drag handles               |
| `showAddButton`  | `boolean`    | —        | Show add child buttons          |
| `showSortButton` | `boolean`    | —        | Show sort up/down buttons       |
| `moreMenu`       | `MatMenu`    | —        | Context menu reference          |
| `ariaLabel*`     | `string`     | —        | Various ARIA labels for buttons |

**Outputs:**

- `selectNode` — emits `TreeData`
- `expandNode` — emits node id
- `collapseNode` — emits node id
- `addNode` — emits node id
- `moveNode` — emits `NodeMoveEvent`
- `sortNode` — emits `NodeSortEvent`
- `treeChange` — emits updated full tree

### Models

```typescript
interface TreeData {
  id: string;
  label: string;
  icon?: string;
  children?: TreeData[];
  isDisabled?: boolean;
  isExpanded?: boolean;
}

interface NodeMoveEvent {
  nodeId: string;
  targetId: string;
  position: "before" | "after" | "inside";
}

interface NodeSortEvent {
  nodeId: string;
  direction: "up" | "down";
}
```

### Peer Dependencies

`@angular/core`, `@angular/material` (menu, drag support), `@pdx/pp-theme`

---

## Component Replacement Map

When a PDX component exists, always use it instead of Angular Material or custom implementations.

| Need            | PDX Component                     | Replaces                                                        |
| --------------- | --------------------------------- | --------------------------------------------------------------- |
| Standard button | `PPButtonComponent`               | `mat-button`, `mat-raised-button`, `mat-flat-button`            |
| Icon button     | `PPIconButtonComponent`           | `mat-icon-button`                                               |
| FAB             | `PPFloatingActionButtonComponent` | `mat-fab`, `mat-mini-fab`                                       |
| Text input      | `PPInputComponent`                | `mat-form-field` + `matInput`                                   |
| Textarea        | `PPTextareaComponent`             | `mat-form-field` + `matInput` + `<textarea>`                    |
| Checkbox        | `PPCheckboxComponent`             | `mat-checkbox`                                                  |
| Radio button    | `PPRadioButtonComponent`          | `mat-radio-button`                                              |
| Radio group     | `PPRadioGroupComponent`           | `mat-radio-group`                                               |
| Chip            | `PPChipComponent`                 | `mat-chip`                                                      |
| Chip list       | `PPChipListComponent`             | `mat-chip-listbox`, `mat-chip-set`                              |
| Dialog          | `PPDialogComponent`               | Custom dialog templates (still use `MatDialog` service to open) |
| Tree            | `PPTreeComponent`                 | `mat-tree`, custom tree implementations                         |
| Icons           | `pp-icon pp-icon-*`               | `mat-icon`, FontAwesome, other icon libraries                   |

**Components without a PDX replacement yet** — use Angular Material with PDX theme applied:

- Select / Autocomplete (`mat-select`, `mat-autocomplete`)
- Date picker (`mat-datepicker`)
- Slide toggle (`mat-slide-toggle`)
- Progress bar / spinner (`mat-progress-bar`, `mat-progress-spinner`)
- Snackbar (`mat-snackbar`)
- Tooltip (`mat-tooltip`)
- Table (`mat-table`)
- Paginator (`mat-paginator`)
- Sort (`mat-sort`)
- Menu (`mat-menu`)
- Sidenav (`mat-sidenav`)
- Toolbar (`mat-toolbar`)
- Tabs (`mat-tab-group`) — follow PDX tab styling guidelines
- Expansion panel (`mat-expansion-panel`)
