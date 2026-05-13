# PDX Component Library Inventory

All libraries live in the PDX monorepo at `/libs/`. The repo uses Nx, Angular 21, standalone components, signals, and Vitest.

Every component library depends on `@pdx/pp-theme` as a peer dependency.

---

## @pdx/pp-theme (v1.1.0)

Foundational design system theme. Provides colors, typography, spacing, and design tokens. Integrates AkkuratStd font, TailwindCSS, and Angular Material into a unified system.

### Entry Points

**CSS (recommended for most projects):**

```css
@import '@pdx/pp-theme/css/index.css';
```

**Individual imports:**

```css
@import '@pdx/pp-theme/css/font/fonts.css';
@import '@pdx/pp-theme/css/tailwind/tailwind.css';
@import '@pdx/pp-theme/css/angular-material/material.css';
```

**SCSS:**

```scss
@use '@pdx/pp-theme/scss/index';
/* Or individual: */
@use '@pdx/pp-theme/scss/font/fonts';
@use '@pdx/pp-theme/scss/color/colors';
@use '@pdx/pp-theme/scss/angular-material/material';
```

**TypeScript color data:**

```typescript
import { ... } from '@pdx/pp-theme';
```

### Color Tokens

**SCSS variables:** `$pp-primary` (base), `$pp-primary-500`, `$pp-secondary-980`, `$pp-error`, `$pp-success`, etc.

**CSS variables:** `--pp-primary` (base), `--pp-primary-500`, `--pp-secondary-980`, etc. The prefix is **`--pp-`**, not `--color-pp-`.

**TailwindCSS utilities:** `text-pp-primary`, `bg-pp-secondary-980`, `border-pp-secondary-900`, etc.

**Core palettes:** primary, secondary, tertiary, neutral-variant, error, success, info, warning.

**Extended palettes:** orange, purple, dark-blue, blue, light-blue, light-green, green, yellow.

**Shade scale (per palette):** discrete keys `50, 100, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 920, 940, 950, 960, 980, 990` plus an unsuffixed base. `50` is darkest, `990` is lightest. There is **no** `1000` shade. Source of truth: `libs/pp-theme/css/color/colors.css` and `libs/pp-theme/scss/color/colors.scss` in the PDX repo.

### Typography

AkkuratStd family: Light (300), Regular (400), Bold (700). CSS class: `.font-akkurat`.

### Angular Material Integration

Material 3 theme configuration with primary and tertiary palettes mapped to PDX colors. Density: 0. Typography: AkkuratStd.

---

## @pdx/pp-icons (v6.5.2)

SVG icon set packaged as a webfont. No Angular dependencies.

### Usage

```scss
@use '@pdx/pp-icons/icons';
```

```css
@import '@pdx/pp-icons/icons.css';
```

```html
<span class="pp-icon pp-icon-add"></span>
<span class="pp-icon pp-icon-edit_filled"></span>
<span class="pp-icon pp-icon-delete_trash"></span>
```

CSS class pattern: `pp-icon pp-icon-<icon-name>`

### Naming convention

Icon names use **underscores**, not hyphens. Always look up the actual name in the generated `icons.css` (or `icons.json`) before using one — guessed hyphenated names (e.g. `pp-icon-delete`, `pp-icon-chevron-right`) silently render an empty box.

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

### Two ways to render an icon — and the prop convention

There are two contexts to render a PDX icon:

1. **Bare HTML / your own template span:** use the **full class string** — both classes are needed for the webfont (`pp-icon`) and the glyph (`pp-icon-<name>`):

   ```html
   <span class="pp-icon pp-icon-add" aria-hidden="true"></span>
   ```

2. **PDX component prop** — `icon`, `leadingIcon`, or `trailingIcon` on `pp-button`, `pp-icon-button`, `pp-floating-action-button`, `pp-tab`, `pp-sidenav-item`, `pp-input`, `pp-chip`, `pp-select`, `pp-multiselect`, `pp-menu`, `pp-list` (`leading` / `trailing`), `pp-expansion-panel-item`, etc.: pass the **modifier class only**. The component renders the `pp-icon` base class internally:

   ```html
   <pp-button label="New" icon="pp-icon-add" />
   <pp-icon-button icon="pp-icon-edit_filled" ariaLabel="Edit" />
   <pp-input label="Search" leadingIcon="pp-icon-search" />
   ```

Passing the full `"pp-icon pp-icon-add"` to a component prop double-applies the base class; passing only `"pp-icon-add"` to a bare `<span>` renders nothing because the webfont's `font-family` lives on the `pp-icon` class.

### SCSS scope

Import the icon stylesheet **once globally** (typically in the app's root `styles.scss`):

```scss
// styles.scss — global only
@use '@pdx/pp-icons/icons';
```

Never import it from a per-component SCSS file. The compiled CSS contains every icon class plus `@font-face` declarations — well over the typical 8KB component-style budget.

---

## @pdx/pp-button (v1.3.0)

Buttons for all user interaction needs: standard buttons, icon buttons, and floating action buttons (FAB).

### Components

#### PPButtonComponent

```typescript
import { PPButtonComponent } from '@pdx/pp-button';
```

```html
<pp-button label="Save" variant="filled" size="md" />
<pp-button label="Cancel" variant="outlined" />
<pp-button label="Delete" variant="text" icon="pp-icon-delete_trash" />
<pp-button label="Submit" variant="filled" [fullWidth]="true" buttonType="submit" />
<pp-button label="Warning" variant="tonal" />
```

| Input        | Type                                          | Default    | Description                                                                                                                               |
| ------------ | --------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | `string`                                      | required   | Button text                                                                                                                               |
| `variant`    | `'filled' \| 'outlined' \| 'text' \| 'tonal'` | `'filled'` | Visual style                                                                                                                              |
| `size`       | `'sm' \| 'md' \| 'lg'`                        | `'md'`     | Button size                                                                                                                               |
| `icon`       | `string`                                      | —          | Icon modifier class only — e.g. `"pp-icon-add"`. The component auto-prepends `pp-icon`; do **not** pass the full `"pp-icon pp-icon-add"`. |
| `disabled`   | `boolean`                                     | `false`    | Disabled state                                                                                                                            |
| `fullWidth`  | `boolean`                                     | `false`    | Full-width button                                                                                                                         |
| `buttonType` | `'button' \| 'submit' \| 'reset'`             | `'button'` | HTML button type                                                                                                                          |
| `ariaLabel`  | `string`                                      | —          | Accessibility label                                                                                                                       |

#### PPIconButtonComponent

```typescript
import { PPIconButtonComponent } from '@pdx/pp-button';
```

```html
<pp-icon-button icon="pp-icon-edit_filled" ariaLabel="Edit item" (click)="edit()" />
<pp-icon-button icon="pp-icon-delete_trash" ariaLabel="Delete" variant="plain" (click)="remove()" />
<pp-icon-button icon="pp-icon-arrow_back" ariaLabel="Back" variant="plain-dark" size="sm" />
```

Compact icon-only button for toolbars and inline actions. **No `label` input** — identify the button via `ariaLabel`.

| Input        | Type                                                           | Default         | Description                                                                                                                                                  |
| ------------ | -------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `icon`       | `string`                                                       | `'pp-icon-add'` | Icon modifier class only — e.g. `"pp-icon-edit_filled"`. Component auto-prepends `pp-icon`; do **not** pass the full `"pp-icon pp-icon-X"`.                  |
| `variant`    | `'filled' \| 'plain' \| 'plain-dark' \| 'outlined' \| 'tonal'` | `'filled'`      | Visual style. `'plain'` has no background (use for in-toolbar actions); `'plain-dark'` is the dark-on-light variant intended for the mobile toolbar surface. |
| `size`       | `'sm' \| 'lg'`                                                 | `'lg'`          | Button size (icon-button uses two sizes, not three).                                                                                                         |
| `disabled`   | `boolean`                                                      | `false`         | Disabled state                                                                                                                                               |
| `buttonType` | `'button' \| 'submit' \| 'reset'`                              | `'button'`      | HTML button type                                                                                                                                             |
| `ariaLabel`  | `string`                                                       | —               | Accessibility label — required for screen-reader identification on icon-only buttons.                                                                        |

#### PPFloatingActionButtonComponent

```typescript
import { PPFloatingActionButtonComponent } from '@pdx/pp-button';
```

```html
<pp-floating-action-button icon="pp-icon-add" ariaLabel="Add item" />
<pp-floating-action-button icon="pp-icon-edit_filled" ariaLabel="Edit" position="top-right" size="sm" />
```

Prominent FAB for primary screen actions. Selector is the full **`pp-floating-action-button`** — there is no short `pp-fab` alias.

| Input       | Type                                                                         | Default          | Description                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `icon`      | `string`                                                                     | `'pp-icon-add'`  | Icon modifier class.                                                                                                        |
| `position`  | `'relative' \| 'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Anchor in the surrounding container. `'relative'` flows inline; the four corner values switch to `position: fixed` styling. |
| `size`      | `'sm' \| 'lg'`                                                               | `'lg'`           | FAB size.                                                                                                                   |
| `disabled`  | `boolean`                                                                    | `false`          | Disabled state.                                                                                                             |
| `ariaLabel` | `string`                                                                     | —                | Accessibility label — required because the button is icon-only.                                                             |

### Peer Dependencies

`@angular/common`, `@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-input (v2.1.0)

Text inputs and textareas with validation, helper text, tooltips, and forms integration.

### Width control

Inputs render at their **natural width** by default. Pick the width strategy from the surrounding container:

- **Inside a `pp-form-block` / column layout that should fill its column** — set `[fullWidth]="true"` so the input stretches to the block width.
- **Standalone, in a toolbar / narrow filter / inline search** — leave `fullWidth` off and pick `size="sm"` (default) or `size="lg"` for the intrinsic width that fits the container.

Don't blanket-apply `fullWidth` everywhere — a full-width input inside a narrow toolbar visually overflows; a natural-width input inside a 30 rem form-block looks broken. Same rule applies to `pp-textarea`.

### Components

#### PPInputComponent

```typescript
import { PPInputComponent } from '@pdx/pp-input';
```

```html
<pp-input label="Email" inputType="email" size="lg" [required]="true" />
<pp-input label="Search" leadingIcon="pp-icon-search" size="sm" />
<pp-input label="Name" helperText="Enter your full name" />
<pp-input label="Password" inputType="password" [invalid]="hasError" />
```

| Input                     | Type                                                | Default                                      | Description                                                                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`                   | `string`                                            | required                                     | Field label                                                                                                                                                                                                                                         |
| `inputType`               | `'text' \| 'email' \| 'password' \| 'tel' \| 'url'` | `'text'`                                     | HTML input type                                                                                                                                                                                                                                     |
| `size`                    | `'sm' \| 'lg'`                                      | `'sm'`                                       | Field size                                                                                                                                                                                                                                          |
| `leadingIcon`             | `string \| undefined`                               | `undefined`                                  | Icon before field                                                                                                                                                                                                                                   |
| `trailingIcon`            | `boolean`                                           | `false`                                      | Show trailing icon                                                                                                                                                                                                                                  |
| `helperText`              | `string \| undefined`                               | `undefined`                                  | Guidance text below field                                                                                                                                                                                                                           |
| `tooltip`                 | `string \| undefined`                               | `undefined`                                  | Hover hint text                                                                                                                                                                                                                                     |
| `required`                | `boolean`                                           | `false`                                      | Shows required marker                                                                                                                                                                                                                               |
| `optional`                | `boolean`                                           | `false`                                      | Shows "(optional)"                                                                                                                                                                                                                                  |
| `invalid`                 | `boolean`                                           | `false`                                      | Error state                                                                                                                                                                                                                                         |
| `disabled`                | `boolean`                                           | `false`                                      | Disabled state                                                                                                                                                                                                                                      |
| `readonly`                | `boolean`                                           | `false`                                      | Read-only state                                                                                                                                                                                                                                     |
| `fullWidth`               | `boolean`                                           | `false`                                      | Full-width field                                                                                                                                                                                                                                    |
| `value`                   | `string`                                            | `''`                                         | Current value                                                                                                                                                                                                                                       |
| `id`                      | `string \| undefined`                               | `undefined`                                  | Unique identifier for the element                                                                                                                                                                                                                   |
| `ariaLabel`               | `string \| undefined`                               | `undefined`                                  | Accessibility label                                                                                                                                                                                                                                 |
| `ariaLabelTrailingButton` | `string \| undefined`                               | `'Trailing button for resetting the input.'` | Accessible name for trailing reset                                                                                                                                                                                                                  |
| `labelSpace`              | `'auto' \| 'always' \| 'never'`                     | `'auto'`                                     | Reserves 8px above the field for the floating-label notch. `'auto'` reserves when `label` is non-empty; use `'always'` for label-less inputs that share a row with labeled inputs (keeps vertical alignment); `'never'` opts out (legacy overflow). |

**Output:** `inputChange` emits the new value.

**Forms:** Implements `ControlValueAccessor` for reactive forms.

#### PPTextareaComponent

```typescript
import { PPTextareaComponent } from '@pdx/pp-input';
```

```html
<pp-textarea label="Comments" [autoGrowth]="true" helperText="Tell us what you think" />
```

| Input        | Type                            | Default     | Description                                                                                                                                                |
| ------------ | ------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | `string`                        | required    | Field label                                                                                                                                                |
| `autoGrowth` | `boolean`                       | `false`     | Auto-expanding height                                                                                                                                      |
| `resizable`  | `boolean`                       | `false`     | User-resizable textarea                                                                                                                                    |
| `helperText` | `string \| undefined`           | `undefined` | Guidance text below field                                                                                                                                  |
| `tooltip`    | `string \| undefined`           | `undefined` | Hover hint text                                                                                                                                            |
| `required`   | `boolean`                       | `false`     | Shows required marker                                                                                                                                      |
| `optional`   | `boolean`                       | `false`     | Shows "(optional)"                                                                                                                                         |
| `invalid`    | `boolean`                       | `false`     | Error state                                                                                                                                                |
| `disabled`   | `boolean`                       | `false`     | Disabled state                                                                                                                                             |
| `readonly`   | `boolean`                       | `false`     | Read-only state                                                                                                                                            |
| `fullWidth`  | `boolean`                       | `false`     | Full-width field                                                                                                                                           |
| `value`      | `string`                        | `''`        | Current value                                                                                                                                              |
| `id`         | `string \| undefined`           | `undefined` | Unique identifier for element                                                                                                                              |
| `ariaLabel`  | `string \| undefined`           | `undefined` | Accessibility label                                                                                                                                        |
| `labelSpace` | `'auto' \| 'always' \| 'never'` | `'auto'`    | Same semantics as on `pp-input` — reserves the floating-label notch space. Use `'always'` to align a label-less textarea with neighbouring labeled fields. |

**Output:** `textareaChange` emits the new value.

**Forms:** Implements `ControlValueAccessor` for reactive forms.

### Global Styles

```scss
@use '@pdx/pp-input/styles';
```

### Peer Dependencies

`@angular/common`, `@angular/core`, `@angular/forms`, `@angular/material` (MatTooltip), `@pdx/pp-theme`

---

## @pdx/pp-form (v1.2.0)

Structural primitives for assembling form layouts. These components orchestrate layout, grouping, and typography for forms — they do **not** render controls themselves. Compose with `@pdx/pp-input`, `@pdx/pp-checkbox`, etc. for the actual inputs.

### Components

#### PPFormComponent

```typescript
import { PPFormComponent } from '@pdx/pp-form';
```

Root container. Ensures unified spacing and styling across its children.

```html
<pp-form>
  <!-- sections, blocks, actions -->
</pp-form>
```

No inputs.

Structural rules:

- **Renders an internal `<form>` element.** The component template is `<form class="pp-form"><ng-content/></form>`. Two consequences:
  - `<pp-button buttonType="submit">` inside `<pp-form>` will trigger native form submission — wire `(submit)` on the surrounding logic accordingly (typically by handling the click on the submit button, since `<pp-form>` doesn't expose a submit output).
  - Do **not** nest `<pp-form>` inside another `<form>` element or another `<pp-form>` — nested forms are invalid HTML.
- **Width-inherits from its parent.** `pp-form` has no intrinsic width; wrap it in a container with a defined width. Real consumer apps use stock Tailwind utilities (`max-w-3xl`, `max-w-[75rem]`) to clamp it to the page-content width. Without a width constraint, the form stretches to fill the viewport.
- One `<pp-form>` per component.

#### PPFormSectionComponent

```typescript
import { PPFormSectionComponent } from '@pdx/pp-form';
```

Semantic region with a header. Supports single- or multi-column layouts.

```html
<pp-form-section
  title="Personal Information"
  description="Please provide your basic contact details."
  [singleColumn]="false"
>
  <!-- pp-form-block -->
</pp-form-section>
```

| Input          | Type             | Default  | Description                                       |
| -------------- | ---------------- | -------- | ------------------------------------------------- |
| `title`        | `string`         | required | Section heading                                   |
| `description`  | `string \| null` | `null`   | Text below the heading                            |
| `singleColumn` | `boolean`        | `false`  | Force single-column layout (default is multi-col) |

#### PPFormStackComponent

```typescript
import { PPFormStackComponent } from '@pdx/pp-form';
```

Arranges children vertically or horizontally.

```html
<pp-form-stack layout="horizontal">
  <!-- stacked children -->
</pp-form-stack>
```

| Input    | Type                         | Default      | Description       |
| -------- | ---------------------------- | ------------ | ----------------- |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | Stack orientation |

#### PPFormBlockComponent

```typescript
import { PPFormBlockComponent } from '@pdx/pp-form';
```

Groups related form fields into a visually cohesive block. No inputs.

```html
<pp-form-block>
  <!-- pp-input, pp-checkbox, etc. -->
</pp-form-block>
```

#### PPFormTextblockComponent

```typescript
import { PPFormTextblockComponent } from '@pdx/pp-form';
```

Standardized title + description text.

```html
<pp-form-textblock title="Account Settings" description="Manage your account preferences." size="lg" />
```

| Input         | Type             | Default  | Description                                   |
| ------------- | ---------------- | -------- | --------------------------------------------- |
| `title`       | `string`         | required | Heading                                       |
| `description` | `string \| null` | `null`   | Supporting text                               |
| `size`        | `'sm' \| 'lg'`   | `'sm'`   | `'lg'` for section headers, `'sm'` for blocks |

#### PPFormActionsComponent

```typescript
import { PPFormActionsComponent } from '@pdx/pp-form';
```

Row for form-level buttons (e.g. Cancel / Save). Use `<pp-button>` children.

```html
<pp-form-actions alignment="right">
  <pp-button label="Cancel" variant="outlined" />
  <pp-button label="Save" variant="filled" />
</pp-form-actions>
```

| Input       | Type                            | Default   | Description                         |
| ----------- | ------------------------------- | --------- | ----------------------------------- |
| `alignment` | `'left' \| 'center' \| 'right'` | `'right'` | Horizontal alignment of the buttons |

### Canonical composition

```html
<div class="w-full max-w-[75rem]">
  <pp-form>
    <pp-form-stack>
      <pp-form-section title="Profile" description="Your contact details.">
        <pp-form-block>
          <pp-form-stack layout="horizontal">
            <pp-input label="First name" [formField]="form.firstName" />
            <pp-input label="Last name" [formField]="form.lastName" />
          </pp-form-stack>
        </pp-form-block>
      </pp-form-section>
      <pp-form-actions alignment="right">
        <pp-button label="Cancel" variant="outlined" />
        <pp-button label="Save" variant="filled" buttonType="submit" />
      </pp-form-actions>
    </pp-form-stack>
  </pp-form>
</div>
```

### Layout pitfalls

The PDX form primitives have a few hard-coded sizing constraints that can clip or wrap content unexpectedly. Detect them up front rather than fighting CSS at the end.

- **`pp-form-block` has `min-width: 14.375rem` (230 px).** Two blocks side by side inside a `pp-form-stack layout="horizontal"` need at least **508 px** of available width to render in one row (`230 + 48 gap + 230`). When the surrounding column is narrower (e.g. tabs share space with a 12 rem photo column on the right), the second block wraps under the first. Inspect the available width along the layout chain (`max-width` + `grid-template-columns` + nested stacks). If the room is `< 508 px`, either stack the blocks vertically (drop `layout="horizontal"`), or apply a scoped `min-width: 0` override so the block can shrink below its built-in floor.
- **`pp-form-actions` is a responsive `auto-fit` grid** (`grid-template-columns: repeat(auto-fit, 9.375rem); gap: 0.75rem;`). Each track is 150 px wide; buttons fit per row only while the container is wide enough (`n × 150 px + (n − 1) × 12 px`), and wrap onto new rows otherwise. The `alignment` input maps to `--left` / `--center` / `--right` modifiers controlling `justify-content` (default `right`). For tightly-controlled multi-button bars (e.g. one secondary action floated left, primary on the right with a spacer), build a custom flex action bar instead. Reserve `pp-form-actions` for the canonical Cancel + Save / OK pair.
- **No nested `<header>` inside `pp-form`.** `pp-form-section` already renders a `<header>` for its title block. Adding another `<header>` descendant for a section banner produces two banner landmarks on the page — an axe / a11y violation. Use `<div class="…__header">` with appropriate styling for any visual section header inside a PDX form.

### Peer Dependencies

`@angular/common`, `@angular/core`, `@pdx/pp-theme`, `@pdx/pp-radio`, `@pdx/pp-menu`

---

## @pdx/pp-checkbox (v1.2.0)

Accessible checkbox with three states, error display, and forms integration.

### Components

#### PPCheckboxComponent

```typescript
import { PPCheckboxComponent, CheckboxState } from '@pdx/pp-checkbox';
```

```html
<pp-checkbox id="terms" label="Accept terms" />
<pp-checkbox id="all" label="Select all" [state]="CheckboxState.Indeterminate" />
<pp-checkbox id="err" label="Required field" [error]="true" />
```

| Input       | Type                               | Default      | Description                                                                                                                                                                                      |
| ----------- | ---------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`        | `string`                           | `''`         | Unique identifier                                                                                                                                                                                |
| `label`     | `string`                           | `''`         | Display label                                                                                                                                                                                    |
| `state`     | `CheckboxState`                    | `Unselected` | Current state                                                                                                                                                                                    |
| `error`     | `boolean`                          | `false`      | Error state                                                                                                                                                                                      |
| `disabled`  | `boolean`                          | `false`      | Disabled state                                                                                                                                                                                   |
| `ariaLabel` | `string \| null`                   | `null`       | Accessibility label                                                                                                                                                                              |
| `labelWrap` | `'wrap' \| 'nowrap' \| 'truncate'` | `'wrap'`     | Long-label behaviour. `'wrap'` flows onto multiple lines. `'nowrap'` keeps a single line and overflows the parent. `'truncate'` clips with an ellipsis and exposes the full label via a tooltip. |

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

## @pdx/pp-radio (v1.3.0)

Radio buttons for single-choice selections. Standalone or grouped.

### Components

#### PPRadioButtonComponent

```typescript
import { PPRadioButtonComponent } from '@pdx/pp-radio';
```

```html
<pp-radio-button id="opt1" label="Option A" value="a" />
```

| Input             | Type                               | Default  | Description                                                                                                                                                                          |
| ----------------- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | `string`                           | `''`     | Unique identifier — set per radio for `for`/`htmlFor` linkage                                                                                                                        |
| `label`           | `string`                           | `''`     | Display label                                                                                                                                                                        |
| `value`           | `string \| number`                 | `''`     | Associated value                                                                                                                                                                     |
| `disabled`        | `boolean`                          | `false`  | Disabled state                                                                                                                                                                       |
| `checked`         | `boolean`                          | `false`  | Checked state — only for standalone use; ignored inside a `pp-radio-group`                                                                                                           |
| `ariaLabel`       | `string \| null`                   | `null`   | Accessibility label                                                                                                                                                                  |
| `ariaLabelledby`  | `string \| null`                   | `null`   | ID of the element labelling this radio button                                                                                                                                        |
| `ariaDescribedby` | `string \| null`                   | `null`   | ID of the element describing this radio button                                                                                                                                       |
| `tabIndex`        | `number \| null`                   | `null`   | Tab index for keyboard navigation                                                                                                                                                    |
| `labelWrap`       | `'wrap' \| 'nowrap' \| 'truncate'` | `'wrap'` | Long-label behaviour. Same semantics as `pp-checkbox` — `'wrap'` flows, `'nowrap'` overflows on one line, `'truncate'` clips with ellipsis and exposes the full label via a tooltip. |

**Output:** `radioChange` emits the value.

#### PPRadioGroupComponent

```typescript
import { PPRadioGroupComponent, PPRadioOption } from '@pdx/pp-radio';
```

```html
<pp-radio-group [options]="options" [value]="selected" (valueChange)="onSelect($event)" />
```

| Input       | Type               | Default | Description       |
| ----------- | ------------------ | ------- | ----------------- |
| `options`   | `PPRadioOption[]`  | `[]`    | Available options |
| `value`     | `string \| number` | `''`    | Selected value    |
| `disabled`  | `boolean`          | `false` | Disable all       |
| `ariaLabel` | `string \| null`   | `null`  | Group label       |

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

## @pdx/pp-chip (v1.2.1)

Compact chips for filters, tags, and selections.

### Components

#### PPChipComponent

```typescript
import { PPChipComponent } from '@pdx/pp-chip';
```

```html
<pp-chip id="tag1" label="Angular" [removable]="true" (removed)="onRemove($event)" />
<pp-chip id="cat1" label="Frontend" leadingIcon="pp-icon-code" />
<pp-chip id="info" label="Read-only" [removable]="false" />
```

| Input             | Type             | Default | Description                              |
| ----------------- | ---------------- | ------- | ---------------------------------------- |
| `id`              | `string`         | `''`    | Unique identifier                        |
| `label`           | `string`         | `''`    | Display text (or use content projection) |
| `leadingIcon`     | `string \| null` | `null`  | Icon class name                          |
| `removable`       | `boolean`        | `true`  | Show remove button                       |
| `disabled`        | `boolean`        | `false` | Disabled state                           |
| `ariaLabel`       | `string \| null` | `null`  | Accessibility label                      |
| `removeAriaLabel` | `string \| null` | `null`  | Remove button label                      |

**Output:** `removed` emits `PPChipRemoveEvent`.

#### PPChipListComponent

```typescript
import { PPChipListComponent } from '@pdx/pp-chip';
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

## @pdx/pp-dialog (v1.1.2)

Responsive dialog shell for wrapping custom content. Works with Angular Material's `MatDialog` service.

### Components

#### PPDialogComponent

```typescript
import { PPDialogComponent } from '@pdx/pp-dialog';
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
@use '@pdx/pp-dialog/styles';
```

Provides overlay and backdrop styling.

### Peer Dependencies

`@angular/cdk`, `@angular/core`, `@pdx/pp-button`, `@pdx/pp-theme`

---

## @pdx/pp-tree (v2.0.1)

Flexible tree component for hierarchical data. Supports selection, expansion, drag-and-drop, sorting, and context menus via `PPMenuComponent`.

### Components

#### PPTreeComponent

```typescript
import { PPTreeComponent, TreeData } from '@pdx/pp-tree';
import { PPMenuComponent, PPMenuItem } from '@pdx/pp-menu';
```

```html
<pp-tree
  [data]="treeData"
  [(selectedId)]="selectedNodeId"
  [showDragButton]="true"
  [showAddButton]="true"
  [moreMenu]="contextMenu"
  (selectNode)="onSelect($event)"
  (moveNode)="onMove($event)"
  (treeChange)="onTreeUpdate($event)"
/>

<pp-menu #contextMenu [items]="menuItems()" (itemSelect)="onMenuAction($event)" />
```

| Input            | Type                      | Default  | Description                                                                                                                                                                                        |
| ---------------- | ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`           | `TreeData[]`              | required | Hierarchical data                                                                                                                                                                                  |
| `selectedId`     | `string \| null`          | `null`   | Currently selected node (ModelSignal, supports two-way `[()]`)                                                                                                                                     |
| `folderMode`     | `boolean`                 | `false`  | Folder/document icons                                                                                                                                                                              |
| `showDragButton` | `boolean`                 | `false`  | Show drag handles                                                                                                                                                                                  |
| `showAddButton`  | `boolean`                 | `false`  | Show add child buttons (respects per-node `hideAddButton`)                                                                                                                                         |
| `showSortButton` | `boolean`                 | `false`  | Show sort up/down buttons                                                                                                                                                                          |
| `moreMenu`       | `PPMenuComponent \| null` | `null`   | Reference to a `PPMenuComponent` instance for the "more actions" context menu. The tree node toggles `isOpen` and sets `triggerElement` automatically; items and events are owned by the consumer. |
| `ariaLabel*`     | `string \| null`          | `null`   | Various ARIA labels for buttons (drag, add, more, sort up/down, expand, collapse)                                                                                                                  |

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
  hideAddButton?: boolean;
}

interface NodeMoveEvent {
  nodeId: string;
  targetId: string;
  position: 'before' | 'after' | 'inside';
}

interface NodeSortEvent {
  nodeId: string;
  direction: 'up' | 'down';
}

const DROP_POSITIONS = { before: 'before', after: 'after', inside: 'inside' } as const;
type DropPosition = (typeof DROP_POSITIONS)[keyof typeof DROP_POSITIONS];

const SORT_DIRECTIONS = { up: 'up', down: 'down' } as const;
type SortDirection = (typeof SORT_DIRECTIONS)[keyof typeof SORT_DIRECTIONS];
```

### Tree update utilities

The tree emits `NodeMoveEvent` and `NodeSortEvent` but does not mutate `data` itself. Use these pure helpers to compute the new tree:

```typescript
import { moveNodeInTree, sortNodeInTree } from '@pdx/pp-tree';

protected onMove(event: NodeMoveEvent): void {
  this.treeData.set(moveNodeInTree(this.treeData(), event));
}

protected onSort(event: NodeSortEvent): void {
  this.treeData.set(sortNodeInTree(this.treeData(), event));
}
```

Both functions take `readonly TreeData[]` and return a new `TreeData[]` — safe for signal updates.

### Peer Dependencies

`@angular/core`, `@pdx/pp-menu`, `@pdx/pp-theme`

---

## @pdx/pp-select (v1.1.0)

Accessible dropdown fields for single and multiple selection. Floating label animation, optional leading icons, error/disabled states, supporting text, and full Angular forms integration via `ControlValueAccessor`.

### Components

#### PPSelectComponent

```typescript
import { PPSelectComponent } from '@pdx/pp-select';
```

```html
<pp-select label="Country" [options]="countryOptions" [value]="selectedId" (selectionChange)="onSelect($event.id)" />
```

Reactive form integration:

```html
<pp-select label="Country" [options]="countryOptions" [formControl]="countryControl" />
```

| Input            | Type                  | Default     | Description                                             |
| ---------------- | --------------------- | ----------- | ------------------------------------------------------- |
| `label`          | `string` _(required)_ | —           | Floating label text                                     |
| `options`        | `PPMenuItem[]`        | `[]`        | List of options to display                              |
| `value`          | `string \| number`    | `''`        | ID of the currently selected option                     |
| `isDisabled`     | `boolean`             | `false`     | Disables the trigger and prevents dropdown from opening |
| `isError`        | `boolean`             | `false`     | Error state styling for border and supporting text      |
| `size`           | `'large' \| 'small'`  | `'large'`   | `large`: 2.5rem height, `small`: 2rem height            |
| `icon`           | `string`              | `''`        | Leading icon CSS class (e.g. `'pp-icon-global_world'`)  |
| `supportingText` | `string`              | `''`        | Helper text below the trigger                           |
| `ariaLabel`      | `string \| undefined` | `undefined` | Accessible label (falls back to `label`)                |

**Output:** `selectionChange` emits `PPSelectChangeEvent` (`{ id: string | number }`).

**Forms:** Implements `ControlValueAccessor` for reactive forms.

#### PPMultiselectComponent

```typescript
import { PPMultiselectComponent } from '@pdx/pp-select';
```

```html
<pp-multiselect
  label="Countries"
  [options]="countryOptions"
  [values]="selectedIds"
  (selectionChange)="onSelect($event.ids)"
/>
```

Reactive form integration:

```html
<pp-multiselect label="Countries" [options]="countryOptions" [formControl]="countriesControl" />
```

| Input            | Type                            | Default     | Description                                             |
| ---------------- | ------------------------------- | ----------- | ------------------------------------------------------- |
| `label`          | `string` _(required)_           | —           | Floating label text                                     |
| `options`        | `PPMenuItem[]`                  | `[]`        | List of options to display                              |
| `values`         | `readonly (string \| number)[]` | `[]`        | IDs of the currently selected options                   |
| `isDisabled`     | `boolean`                       | `false`     | Disables the trigger and prevents dropdown from opening |
| `isError`        | `boolean`                       | `false`     | Error state styling for border and supporting text      |
| `size`           | `'large' \| 'small'`            | `'large'`   | `large`: 2.5rem height, `small`: 2rem height            |
| `icon`           | `string`                        | `''`        | Leading icon CSS class                                  |
| `supportingText` | `string`                        | `''`        | Helper text below the trigger                           |
| `ariaLabel`      | `string \| undefined`           | `undefined` | Accessible label (falls back to `label`)                |

**Output:** `selectionChange` emits `PPMultiselectChangeEvent` (`{ ids: readonly (string | number)[] }`).

**Forms:** Implements `ControlValueAccessor` for reactive forms. Value type: `(string | number)[]`.

### Models

`PPMenuItem` is defined in and must be imported from `@pdx/pp-menu`:

```typescript
import { PPMenuItem } from '@pdx/pp-menu';

interface PPMenuItem {
  readonly id: string | number;
  readonly label: string;
  readonly supportingText?: string;
  readonly disabled?: boolean; // muted style; the menu skips disabled items in keyboard nav and never emits itemSelect for them
}
```

Change event types are exported from `@pdx/pp-select`:

```typescript
interface PPSelectChangeEvent {
  readonly id: string | number;
}

interface PPMultiselectChangeEvent {
  readonly ids: readonly (string | number)[];
}
```

### Peer Dependencies

`@angular/core`, `@angular/forms`, `@pdx/pp-menu`, `@pdx/pp-theme`

---

## @pdx/pp-menu (v1.2.0)

Standalone dropdown menu components for single and multiple selection. Used internally by `@pdx/pp-select` and as the context menu for `@pdx/pp-tree`. Can also be used directly for custom dropdown implementations.

### Components

#### PPMenuComponent

```typescript
import { PPMenuComponent, PPMenuItem } from '@pdx/pp-menu';
```

```html
<pp-menu
  [items]="items"
  [selectedId]="selectedId"
  [isOpen]="isOpen"
  [ariaLabel]="'Choose an option'"
  (itemSelect)="onItemSelect($event)"
/>
```

| Input            | Type                  | Default     | Description                                                                                                                                                    |
| ---------------- | --------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`          | `PPMenuItem[]`        | `[]`        | List of options to display                                                                                                                                     |
| `selectedId`     | `string \| number`    | `''`        | ID of the currently selected item                                                                                                                              |
| `isOpen`         | `boolean`             | `false`     | Whether the dropdown is visible (ModelSignal — supports two-way `[()]` or direct `.set()`)                                                                     |
| `triggerElement` | `HTMLElement \| null` | `null`      | When set, the menu uses `position: fixed` anchored to this element's coordinates. Used by `pp-tree` to position the menu near the "more" button. (ModelSignal) |
| `ariaLabel`      | `string \| undefined` | `undefined` | Accessible label for the listbox                                                                                                                               |
| `size`           | `'large' \| 'small'`  | `'large'`   | Visual size variant                                                                                                                                            |
| `icon`           | `string`              | `''`        | Icon class for each menu item (optional)                                                                                                                       |

**Output:** `itemSelect` emits `PPMenuSelectEvent` (`{ id: string | number }`).

#### PPMenuMultiselectComponent

```typescript
import { PPMenuMultiselectComponent } from '@pdx/pp-menu';
```

```html
<pp-menu-multiselect
  [items]="items"
  [selectedIds]="selectedIds"
  [isOpen]="isOpen"
  [ariaLabel]="'Choose options'"
  (selectionChange)="onSelectionChange($event.ids)"
/>
```

| Input         | Type                            | Default     | Description                              |
| ------------- | ------------------------------- | ----------- | ---------------------------------------- |
| `items`       | `PPMenuItem[]`                  | `[]`        | List of options to display               |
| `selectedIds` | `readonly (string \| number)[]` | `[]`        | Array of IDs of currently selected items |
| `isOpen`      | `boolean`                       | `false`     | Whether the dropdown is visible          |
| `ariaLabel`   | `string \| undefined`           | `undefined` | Accessible label for the listbox         |
| `size`        | `'large' \| 'small'`            | `'large'`   | Visual size variant                      |
| `icon`        | `string`                        | `''`        | Icon class for each menu item (optional) |

**Output:** `selectionChange` emits `PPMenuMultiselectChangeEvent` (`{ ids: readonly (string | number)[] }`).

### Models

```typescript
interface PPMenuItem {
  readonly id: string | number;
  readonly label: string;
  readonly supportingText?: string;
  readonly disabled?: boolean; // muted style; the menu skips disabled items in keyboard nav and never emits itemSelect for them
}

interface PPMenuSelectEvent {
  readonly id: string | number;
}

interface PPMenuMultiselectChangeEvent {
  readonly ids: readonly (string | number)[];
}
```

### Peer Dependencies

`@angular/core`, `@pdx/pp-checkbox`, `@pdx/pp-theme`

---

## @pdx/pp-list (v2.1.0)

Accessible listbox with four selection variants, keyboard navigation, leading/trailing icons, overline + supporting text per item. Use when you need an in-page list (not a dropdown — use `pp-select`/`pp-menu` for those).

### Components

#### PPListComponent

```typescript
import { PPListComponent, PPListItem, PPListSelectEvent, ListVariant, ListSize } from '@pdx/pp-list';
```

```html
<pp-list
  [items]="listItems"
  [variant]="ListVariant.Single"
  [(selectedIds)]="selectedIds"
  [ariaLabel]="'Choose an option'"
  (itemSelect)="onSelect($event)"
/>
```

| Input          | Type                                | Default               | Description                                           |
| -------------- | ----------------------------------- | --------------------- | ----------------------------------------------------- |
| `items`        | `PPListItem[]`                      | `[]`                  | Items to render (each needs a unique `id` + `label`). |
| `variant`      | `ListVariant`                       | `ListVariant.Default` | Selection behavior + trailing indicator style.        |
| `selectedIds`  | `ModelSignal<(string \| number)[]>` | `[]`                  | Selected item ids (see note below).                   |
| `size`         | `ListSize`                          | `ListSize.Large`      | Item density. `'small'` for compact contexts.         |
| `ariaLabel`    | `string \| undefined`               | `undefined`           | ARIA label for the `role="listbox"` root.             |
| `withDividers` | `boolean`                           | `true`                | Show bottom-border dividers between items.            |

**Output:** `itemSelect` emits `PPListSelectEvent` on click / Enter / Space.

`selectedIds` is a `ModelSignal` — bind with `[selectedIds]` or `[(selectedIds)]`, or mutate directly via `componentRef.selectedIds.set([...])` since it's also a `WritableSignal`.

### Models

```typescript
interface PPListItem {
  readonly id: string | number;
  readonly label: string;
  readonly overline?: string;
  readonly supportingText?: string;
  readonly disabled?: boolean;
  readonly leading?: string; // CSS icon class, e.g. 'pp-icon-home'. Mutually exclusive with `leadingSrc`.
  readonly leadingSrc?: string; // Image URL or base64 data URI for the leading slot. Takes precedence over `leading` when both are set.
  readonly trailing?: string; // e.g. 'pp-icon-angle_right'
  readonly checkLabel?: string; // only meaningful in the 'multi' variant
}

interface PPListSelectEvent {
  readonly id: string | number;
  readonly item: PPListItem;
  /**
   * Selection state after the event. Always `false` in the `default` variant
   * (which does not track selection). `true` in `single` / `singleRadio`.
   * Reflects the toggled state in `multi`.
   */
  readonly selected: boolean;
}

enum ListVariant {
  Default = 'default',
  Single = 'single',
  SingleRadio = 'singleRadio',
  Multi = 'multi',
}

enum ListSize {
  Large = 'large',
  Small = 'small',
}
```

### Variants

| Variant       | Behaviour                                                     | Trailing indicator          |
| ------------- | ------------------------------------------------------------- | --------------------------- |
| `default`     | Read-only; emits `itemSelect` but never mutates `selectedIds` | None                        |
| `single`      | Single-select; replaces the current selection                 | Check icon on selected item |
| `singleRadio` | Single-select; replaces the current selection                 | Radio button on every item  |
| `multi`       | Multi-select; toggles items in `selectedIds`                  | Checkbox on every item      |

### Keyboard

`ArrowDown` / `ArrowUp` wrap, skip disabled. `Enter` / `Space` activate the focused item.

### Peer Dependencies

`@angular/core`, `@pdx/pp-checkbox`, `@pdx/pp-radio`, `@pdx/pp-theme`

---

## @pdx/pp-tab (v1.1.0)

Secondary tab navigation component with icons, disabled states, content panels, keyboard navigation, and full accessibility.

### Components

#### PPTabGroupComponent

```typescript
import { PPTabGroupComponent, PPTabComponent, PPTabContentDirective } from '@pdx/pp-tab';
```

```html
<pp-tab-group [(selectedIndex)]="activeTab">
  <pp-tab label="Overview" icon="pp-icon-dashboard">
    <ng-template ppTabContent>
      <p>Overview content goes here.</p>
    </ng-template>
  </pp-tab>
  <pp-tab label="Settings" icon="pp-icon-settings_gears">
    <ng-template ppTabContent>
      <p>Settings content goes here.</p>
    </ng-template>
  </pp-tab>
</pp-tab-group>
```

| Input           | Type      | Default | Description                                               |
| --------------- | --------- | ------- | --------------------------------------------------------- |
| `selectedIndex` | `number`  | `0`     | Index of the active tab. Supports two-way binding `[()]`. |
| `fullWidth`     | `boolean` | `false` | When true, tabs stretch to fill the full width equally.   |

**Output:** `selectedIndexChange` emits the new index (via two-way binding).

#### PPTabComponent

```html
<pp-tab label="Tab 1" />
<pp-tab label="Dashboard" icon="pp-icon-dashboard" />
<pp-tab label="Disabled" [disabled]="true" />
```

| Input      | Type             | Default | Description                                  |
| ---------- | ---------------- | ------- | -------------------------------------------- |
| `label`    | `string`         | `''`    | Text label displayed in the tab              |
| `icon`     | `string \| null` | `null`  | Icon class name (e.g. `'pp-icon-dashboard'`) |
| `disabled` | `boolean`        | `false` | Disables the tab when true                   |

#### PPTabContentDirective

```html
<pp-tab label="Details">
  <ng-template ppTabContent>
    <p>Panel content rendered by the tab group.</p>
  </ng-template>
</pp-tab>
```

Structural directive for marking tab panel content. When provided, the tab group renders the active tab's content below the tab bar.

Consumer-managed content (without `ppTabContent`):

```html
<pp-tab-group [(selectedIndex)]="activeTab">
  <pp-tab label="Tab 1" />
  <pp-tab label="Tab 2" />
</pp-tab-group>

@switch (activeTab) { @case (0) {
<div>Content 1</div>
} @case (1) {
<div>Content 2</div>
} }
```

### Design Tokens

- **Text (unselected):** `$pp-secondary-300`
- **Text (selected/hover):** `$pp-primary`
- **Text (disabled):** `$pp-secondary-700`
- **Indicator (selected):** `$pp-primary`
- **Divider:** `$pp-secondary-800`

### Peer Dependencies

`@angular/common`, `@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-expansion-panel (v1.0.2)

Collapsible content sections with desktop/mobile layout variants and optional accordion mode (only one item open at a time).

### Components

#### PPExpansionPanelComponent

```typescript
import { PPExpansionPanelComponent, PPExpansionPanelItemComponent, PanelVariant } from '@pdx/pp-expansion-panel';
```

Container that groups items and coordinates layout + accordion.

```html
<pp-expansion-panel variant="desktop" [accordion]="false">
  <pp-expansion-panel-item title="Section 1" description="First section">
    <p>Content for section 1</p>
  </pp-expansion-panel-item>
</pp-expansion-panel>
```

| Input       | Type                    | Default     | Description                                                                    |
| ----------- | ----------------------- | ----------- | ------------------------------------------------------------------------------ |
| `variant`   | `'desktop' \| 'mobile'` | `'desktop'` | Desktop = title/description horizontal. Mobile = stacked vertical.             |
| `accordion` | `boolean`               | `false`     | When `true`, opening an item automatically collapses the previously open item. |

#### PPExpansionPanelItemComponent

A single collapsible section with clickable header.

```html
<pp-expansion-panel-item
  title="Favorites"
  description="Your saved items"
  leadingIcon="pp-icon-heart_outline"
  [expanded]="true"
  (opened)="onOpened()"
  (closed)="onClosed()"
>
  <p>Favorite items here</p>
</pp-expansion-panel-item>
```

| Input         | Type             | Default | Description                                                                                                        |
| ------------- | ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `id`          | `string`         | auto    | Stable id (`pp-expansion-panel-item-<n>` if omitted). Provide an explicit value for e2e selectors or deep linking. |
| `title`       | `string`         | `''`    | Header title                                                                                                       |
| `description` | `string`         | `''`    | Optional description shown next to the title                                                                       |
| `leadingIcon` | `string \| null` | `null`  | Icon class (e.g. `'pp-icon-heart_outline'`)                                                                        |
| `expanded`    | `boolean`        | `false` | Initially expanded                                                                                                 |
| `disabled`    | `boolean`        | `false` | Disabled (not tabbable)                                                                                            |

**Outputs:** `opened`, `closed` (both `OutputEmitterRef<void>`).

### Peer Dependencies

`@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-sidenav (v1.1.0)

Two-panel side navigation: a Level 1 icon rail plus an expandable Level 2+ subnavigation panel. **App-shell level** in the default `'app-shell'` variant — owned by the root layout that holds the router outlet, not by feature components routed into that outlet.

The `'panel-only'` variant (added in v1.1.0) renders only the right-hand panel (no rail, no emblem, no toggle, no slide animation) and projects Level 2+ content directly. Use it as the PDX replacement for non-navigation drawers — filter panels, inspector panes, document outlines, etc. — that were previously built with `mat-sidenav`. The applicability rules in the SKILL's "Navigation (app-shell only)" section still apply: `'app-shell'` is for global app navigation, `'panel-only'` is for in-feature drawers.

### Components

```typescript
import {
  PPSidenavComponent,
  PPSidenavItemComponent,
  PPSidenavItemIconDirective,
  PPSidenavGroupComponent,
  PPSidenavSubItemComponent,
} from '@pdx/pp-sidenav';
```

```html
<pp-sidenav [(collapsed)]="isCollapsed" sectionTitle="Settings">
  <pp-sidenav-item icon="pp-icon-home" label="Dashboard" [selected]="true" (itemSelect)="onNav('dashboard')">
    <pp-sidenav-group label="Preferences" [expanded]="true">
      <pp-sidenav-sub-item label="General" [selected]="true" />
      <pp-sidenav-sub-item label="Notifications" />
    </pp-sidenav-group>
  </pp-sidenav-item>
  <pp-sidenav-item icon="pp-icon-user_group" label="Accounts" (itemSelect)="onNav('accounts')" />
</pp-sidenav>
```

**`PPSidenavComponent`**

| Input             | Type                          | Default       | Description                                                                                                                                                                                                        |
| ----------------- | ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `collapsed`       | `boolean`                     | `false`       | Whether the subnav panel is hidden (icon rail only). Two-way `[(collapsed)]`.                                                                                                                                      |
| `sectionTitle`    | `string \| null`              | `null`        | Title at the top of the subnav panel. Falls back to the selected item label.                                                                                                                                       |
| `variant`         | `'app-shell' \| 'panel-only'` | `'app-shell'` | `'app-shell'` renders the icon rail + collapsible panel and projects Level 2+ content from the selected `pp-sidenav-item`. `'panel-only'` renders only the panel and projects Level 2+ content directly (no rail). |
| `showPanelHeader` | `boolean`                     | `true`        | Whether the panel header (`activeSectionTitle`) renders. Set `false` in `panel-only` mode when the surrounding feature already provides a page heading.                                                            |
| `autoExpand`      | `boolean`                     | `true`        | Whether the panel auto-expands on hover/click of a collapsed rail item (and collapses again on mouse-leave). Only meaningful in `'app-shell'` mode — `'panel-only'` ignores the flag because there is no rail.     |

**`PPSidenavItemComponent`** (Level 1 icon item)

| Input            | Type             | Default           | Description                                                                                                                      |
| ---------------- | ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `icon`           | `string \| null` | `null`            | CSS icon class (e.g. `'pp-icon-home'`). When `null`, initials from `label` are shown. `pp-icon` base auto-added for `pp-icon-*`. |
| `label`          | `string`         | required          | Tooltip text and accessibility label.                                                                                            |
| `selected`       | `boolean`        | `false`           | Currently active item                                                                                                            |
| `disabled`       | `boolean`        | `false`           | Disabled                                                                                                                         |
| `badge`          | `number \| null` | `null`            | Notification badge count. `null` hides it.                                                                                       |
| `badgeAriaLabel` | `string`         | `'Notifications'` | Accessible suffix for the badge element.                                                                                         |

**Output:** `itemSelect` (`OutputEmitterRef<void>`).

**`PPSidenavItemIconDirective`** (`[ppSidenavItemIcon]`) — structural directive projecting custom icon content (SVG, etc.) into a `pp-sidenav-item`. Replaces both the CSS-class icon and the initials fallback.

**`PPSidenavGroupComponent`**

| Input      | Type      | Default  | Description                       |
| ---------- | --------- | -------- | --------------------------------- |
| `label`    | `string`  | required | Group label                       |
| `expanded` | `boolean` | `false`  | Children visible. Two-way `[()]`. |
| `selected` | `boolean` | `false`  | Active group                      |
| `disabled` | `boolean` | `false`  | Disabled                          |

**Outputs:** `expandedChange`, `groupToggle`.

**`PPSidenavSubItemComponent`**

| Input      | Type      | Default  | Description     |
| ---------- | --------- | -------- | --------------- |
| `label`    | `string`  | required | Display label   |
| `selected` | `boolean` | `false`  | Active sub-item |
| `disabled` | `boolean` | `false`  | Disabled        |

**Output:** `itemSelect` (`OutputEmitterRef<void>`).

### Global styles

```scss
@use '@pdx/pp-sidenav/styles';
```

Overrides Angular Material tooltip defaults for the design system. Required until a native PDX tooltip is available.

### Peer Dependencies

`@angular/common`, `@angular/core`, `@angular/material`, `@pdx/pp-theme`, `@pdx/pp-icons`

---

## @pdx/pp-top-navigation (v2.0.0)

Global navigation bar with optional dropdown submenus (rendered via `pp-menu`). **App-shell level** — same scope note as `pp-sidenav` above.

### Components

```typescript
import { PPTopNavigationComponent, PPTopNavItem, PPTopNavSelectEvent } from '@pdx/pp-top-navigation';
```

```html
<pp-top-navigation [items]="navItems" [(selectedId)]="selectedId" (itemSelect)="onItemSelect($event)" />
```

| Input        | Type                                    | Default | Description                                                                |
| ------------ | --------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `items`      | `PPTopNavItem[]`                        | `[]`    | Top-level nav items. Items with `children` render dropdown submenus.       |
| `selectedId` | `ModelSignal<string \| number \| null>` | `null`  | Two-way `[(selectedId)]` — id of currently selected item (top or submenu). |

**Output:** `itemSelect` emits `PPTopNavSelectEvent` whenever a top-level item or submenu entry is activated.

### Models

```typescript
interface PPTopNavItem {
  readonly id: string | number;
  readonly label: string;
  readonly disabled?: boolean;
  readonly icon?: string;
  readonly children?: PPTopNavItem[];
}

interface PPTopNavSelectEvent {
  readonly id: string | number;
  readonly item: PPTopNavItem;
  readonly parentItem?: PPTopNavItem;
}
```

### Keyboard

`Enter`/`Space` activate or open dropdown. `ArrowLeft`/`ArrowRight` move focus across top-level items (skips disabled). `ArrowDown` focuses first submenu entry. `Escape` closes the open dropdown.

### Outside-click dismissal

A `document:click` host listener always closes any open dropdown when a click lands outside. No opt-out.

### Peer Dependencies

`@angular/core`, `@pdx/pp-menu`

---

## @pdx/pp-toolbar (v1.0.0)

Two app-shell toolbar components. Both are **purely presentational** — state in, events out; the host wires auth / navigation logic. Both are designed to render as a **sticky horizontal bar pinned to the top of the viewport**, staying visible while page content scrolls underneath.

- `PPToolbarComponent` — sticky desktop/global toolbar with a station-select dropdown (powered by `pp-menu`) and a logout button. Collapses to icon-only logout on viewports `< 600 px`. **The station select is a context switcher, _not_ breadcrumb navigation** — picking a station swaps the active organizational context, it does not change route hierarchy.
- `PPToolbarMobileComponent` — mobile page-level "app bar": optional back button + page title + trailing action icons + optional notifications badge, with an optional safe-area spacer for the iOS notch / Android status bar (`showStatusBar`). Every interactive surface meets a 44×44 px touch target.

Same scope rule as `pp-sidenav` / `pp-top-navigation`: these are **app-shell** components. Feature components routed _into_ the shell do not emit them.

### When to use

Reach for `pp-toolbar` (desktop) when the design calls for a persistent global bar with workspace/context switching and a global action (typically logout). Typical uses: application headers, context / workspace selection, navigation between organizational units, global actions such as logout or settings.

Reach for `pp-toolbar-mobile` when the design calls for a compact touch-optimised page header that stays accessible while scrolling. Typical uses: mobile page headers, detail-page headers with a back button, navigation between views, contextual page actions, notification or status surfaces.

Both prioritise visibility-while-scrolling and quick access to the most important actions; if the design doesn't need either property, prefer a plain page header (e.g. a `mat-toolbar` styled element) instead.

### Components

#### PPToolbarComponent

```typescript
import { PPToolbarComponent, PPToolbarStation, PPToolbarStationSelectEvent } from '@pdx/pp-toolbar';
```

```html
<pp-toolbar
  [stations]="stations"
  [(activeStationId)]="activeStationId"
  [logoutLabel]="'shell.logout' | translate"
  (stationSelect)="onStationSelect($event)"
  (logout)="onLogout()"
/>
```

| Input             | Type                                    | Default    | Description                                                                                                                             |
| ----------------- | --------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `stations`        | `PPToolbarStation[]`                    | `[]`       | Stations the user can switch between. The toolbar auto-selects the first entry if `activeStationId` is `null` or no longer in the list. |
| `activeStationId` | `ModelSignal<string \| number \| null>` | `null`     | Two-way bound id of the active station. Drives the trigger label and the highlighted menu item.                                         |
| `logoutLabel`     | `string`                                | `'Logout'` | Visible label next to the logout icon. Hidden on narrow viewports so the button collapses to icon-only.                                 |
| `ariaLabel`       | `string \| null`                        | `null`     | Accessible label applied to the `<header role="banner">` landmark.                                                                      |

**Outputs:**

- `stationSelect` — emits `PPToolbarStationSelectEvent` (`{ id, station }`) whenever a station is activated, even if it was already the active one.
- `logout` — emits `void` on the logout click; the host terminates the session.

#### PPToolbarMobileComponent

```typescript
import { PPToolbarMobileComponent, PPToolbarMobileAction, PPToolbarMobileActionTapEvent } from '@pdx/pp-toolbar';
```

```html
<pp-toolbar-mobile
  [title]="pageTitle()"
  [showBackButton]="true"
  [actions]="actions"
  [notificationsCount]="unread()"
  (backTap)="onBack()"
  (actionTap)="onAction($event)"
  (notificationsTap)="onNotifications()"
/>
```

| Input                    | Type                      | Default           | Description                                                                                                                                                       |
| ------------------------ | ------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                  | `string`                  | `''`              | Page title in the bar centre. Truncates with ellipsis when it overflows.                                                                                          |
| `showBackButton`         | `boolean`                 | `false`           | Renders a leading back-arrow icon button.                                                                                                                         |
| `backAriaLabel`          | `string`                  | `'Back'`          | Accessible label for the back button (icon-only).                                                                                                                 |
| `showStatusBar`          | `boolean`                 | `false`           | Reserves `env(safe-area-inset-top)` so the toolbar clears the iOS notch / Android status bar in a PWA. Visually empty.                                            |
| `actions`                | `PPToolbarMobileAction[]` | `[]`              | Trailing icon actions. `actions[0]` renders at the **right-most** position; subsequent entries extend leftward. Disabled entries are visible but non-interactive. |
| `notificationsCount`     | `number`                  | `0`               | Unread count. `> 0` renders a notifications icon with a numeric badge; `0` omits the icon entirely. Values above `notificationsBadgeMax` render as `'<max>+'`.    |
| `notificationsAriaLabel` | `string`                  | `'Notifications'` | Accessible label for the notifications button.                                                                                                                    |
| `notificationsBadgeMax`  | `number`                  | `99`              | Upper bound for the displayed badge count (overflows render as e.g. `'99+'`).                                                                                     |
| `ariaLabel`              | `string \| null`          | `null`            | Accessible label for the `<header role="banner">` landmark.                                                                                                       |

**Outputs:**

- `backTap` — emits when the back button is tapped.
- `actionTap` — emits `PPToolbarMobileActionTapEvent` (`{ id, action }`) when the user taps a non-disabled action.
- `notificationsTap` — emits when the notifications icon is tapped.

### Models

```typescript
interface PPToolbarStation {
  readonly id: string | number;
  readonly label: string;
  readonly disabled?: boolean; // visible but non-activatable
}

interface PPToolbarStationSelectEvent {
  readonly id: string | number;
  readonly station: PPToolbarStation;
}

interface PPToolbarMobileAction {
  readonly id: string | number;
  readonly icon: string; // pp-icon modifier class, e.g. 'pp-icon-search'
  readonly ariaLabel: string; // required — actions are icon-only
  readonly disabled?: boolean;
  readonly active?: boolean; // toggled-on visual (e.g. filter applied)
}

interface PPToolbarMobileActionTapEvent {
  readonly id: string | number;
  readonly action: PPToolbarMobileAction;
}
```

### States

`pp-toolbar` (desktop, station-select driven):

- **Closed** — the station dropdown is hidden (default).
- **Open** — the dropdown is visible; the currently selected station is highlighted.
- **Selected** — the active item is visually highlighted in both the trigger label and the open dropdown.

`pp-toolbar-mobile` (interactive icon buttons inherit standard button states):

- **Default**, **Hover**, **Focused**, **Pressed**, **Disabled** — standard `pp-icon-button` states apply to the back button, action icons, and the notifications icon.
- Per-element accents: a notifications badge can be active (count > 0) or inactive (count = 0, icon omitted entirely); individual action icons can be rendered in their "active" state via `PPToolbarMobileAction.active = true` (e.g. filter applied).

### Interactions

`pp-toolbar` (desktop):

- Click the select trigger → opens the dropdown.
- Click a dropdown item → changes the active station / context and emits `stationSelect`.
- Click outside the toolbar → closes the dropdown.
- Click the logout action → emits `logout` (the host terminates the session).
- Scroll the page → the toolbar stays pinned at the top.

`pp-toolbar-mobile`:

- Tap the navigation icon (back button) → emits `backTap`; the host navigates back or closes the current view.
- Tap an action icon → emits `actionTap` with `{ id, action }`; the host triggers the contextual action.
- Tap the notifications icon → emits `notificationsTap`; the host opens related content.
- Scroll the page → the toolbar stays pinned at the top.

### Mobile design guidelines

When composing screens around `pp-toolbar-mobile`, follow the Figma design guidance to keep the bar usable on small viewports:

- Keep the toolbar compact and focused — prioritise only the most important actions.
- Use clear, recognisable icons and maintain consistent icon placement across screens.
- Avoid overcrowding the trailing-action slot; if a screen needs more than a few actions, demote secondary actions into a `pp-menu` opened from a single overflow icon.
- Use notification badges sparingly — they should signal genuinely new / unread content, not steady-state counts.
- Keep page titles short and readable (the title truncates with ellipsis when it overflows the available width).

### Responsive note

`pp-toolbar` and `pp-toolbar-mobile` are **siblings, not composables**: render one or the other based on the host's breakpoint / route logic. They never appear together on the same screen.

### Peer Dependencies

`@angular/core`, `@pdx/pp-button`, `@pdx/pp-menu`, `@pdx/pp-theme`

---

## @pdx/pp-button-toggle (v1.0.0)

Segmented control for mutually-exclusive choices rendered as connected toggle buttons (e.g. view-mode picker, density toggle, on-screen filter). Use `pp-radio-group` instead for traditional form radios.

### Components

#### PPButtonToggleGroupComponent

```typescript
import {
  PPButtonToggleGroupComponent,
  PPButtonToggleComponent,
  PPButtonToggleSelectEvent,
} from '@pdx/pp-button-toggle';
```

```html
<pp-button-toggle-group [(selectedValue)]="viewMode" ariaLabel="View mode" (selectionChange)="onViewModeChange($event)">
  <pp-button-toggle value="day" size="large">Day</pp-button-toggle>
  <pp-button-toggle value="week" size="large">Week</pp-button-toggle>
  <pp-button-toggle value="month" size="large">Month</pp-button-toggle>
</pp-button-toggle-group>
```

| Input            | Type             | Default | Description                                                            |
| ---------------- | ---------------- | ------- | ---------------------------------------------------------------------- |
| `selectedValue`  | `string \| null` | `null`  | Currently selected child value. ModelSignal — supports two-way `[()]`. |
| `ariaLabel`      | `string \| null` | `null`  | Accessible label for the group (`role="group"`).                       |
| `ariaLabelledby` | `string \| null` | `null`  | ID of the element labelling the group.                                 |

**Output:** `selectionChange` emits `PPButtonToggleSelectEvent` (`{ value: string }`).

**Keyboard:** ArrowLeft / ArrowRight cycle focus across children with circular wrapping. Disabled toggles are skipped.

#### PPButtonToggleComponent

```html
<pp-button-toggle value="grid" size="small" [(isActive)]="gridActive">Grid</pp-button-toggle>
```

| Input      | Type                 | Default   | Description                                                                                                                       |
| ---------- | -------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `value`    | `string`             | `''`      | The value emitted by the parent group when this toggle is selected. Required when used inside `pp-button-toggle-group`.           |
| `isActive` | `boolean`            | `false`   | Active state. ModelSignal — supports two-way `[()]`. Inside a group, the parent owns this; standalone, manage it on the consumer. |
| `disabled` | `boolean`            | `false`   | Disabled state.                                                                                                                   |
| `size`     | `'small' \| 'large'` | `'large'` | Visual size. Figma labels these "sm" (32 px height) and "md" (40 px height).                                                      |

**Output:** `toggleChange` emits the new boolean active state. Standalone only — inside a group, selection is delegated to `selectionChange` on the parent.

**Content:** The button label is projected as content (`<pp-button-toggle>Grid</pp-button-toggle>`). Unlike most PDX form controls, this one does **not** take a `label` input.

### Models

```typescript
interface PPButtonToggleSelectEvent {
  readonly value: string;
}
```

**Forms:** Not a `ControlValueAccessor`. Wire to a signal/state directly, or to `[(selectedValue)]` on the group.

### Peer Dependencies

`@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-slide-toggle (v1.2.0)

On/off switch for binary settings (e.g. notifications enabled, dark mode, auto-save). Replaces `mat-slide-toggle`. Use `pp-checkbox` instead for opt-in checkboxes (terms acceptance, multi-select filters).

### Components

#### PPSlideToggleComponent

```typescript
import { PPSlideToggleComponent, PPSlideToggleChangeEvent } from '@pdx/pp-slide-toggle';
```

```html
<pp-slide-toggle id="notifications" label="Notifications" [(checked)]="notificationsOn" />
<pp-slide-toggle label="Auto-save" labelPosition="before" size="sm" [formControl]="autoSaveControl" />
```

| Input            | Type                  | Default                    | Description                                                             |
| ---------------- | --------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `id`             | `string`              | `'pp-slide-toggle-<rand>'` | Unique identifier.                                                      |
| `label`          | `string \| null`      | `null`                     | Visible label text.                                                     |
| `labelPosition`  | `'before' \| 'after'` | `'after'`                  | Whether the label sits before (left of) or after (right of) the switch. |
| `size`           | `'sm' \| 'lg'`        | `'lg'`                     | Visual size. Figma: `lg` is 52×32, `sm` is 34×20.                       |
| `checked`        | `boolean`             | `false`                    | On/off state. ModelSignal — supports two-way `[()]`.                    |
| `disabled`       | `boolean`             | `false`                    | Disabled state. ModelSignal — supports two-way `[()]`.                  |
| `ariaLabel`      | `string \| null`      | `null`                     | Accessibility label.                                                    |
| `ariaLabelledby` | `string \| null`      | `null`                     | ID of the element labelling the toggle.                                 |

**Output:** `slideToggleChange` emits `PPSlideToggleChangeEvent` (`{ id: string, checked: boolean }`).

**Forms:** Implements `ControlValueAccessor` — bind via `[formField]` (Signal Forms) or `[formControl]` / `formControlName` (reactive forms).

### Models

```typescript
interface PPSlideToggleChangeEvent {
  id: string;
  checked: boolean;
}
```

### Peer Dependencies

`@angular/common`, `@angular/core`, `@angular/forms`, `@pdx/pp-theme`

---

## @pdx/pp-paginator (v1.0.1)

Page navigation with previous/next buttons, numeric page list (with overflow ellipses), and a page-size dropdown. Pair with `mat-table` for paged tables. Replaces `mat-paginator`.

### Components

#### PPPaginatorComponent

```typescript
import { PPPaginatorComponent, PPPaginatorPageEvent } from '@pdx/pp-paginator';
```

```html
<pp-paginator
  [length]="totalItems()"
  [(pageIndex)]="pageIndex"
  [(pageSize)]="pageSize"
  ariaLabel="Employees pagination"
  (page)="onPage($event)"
/>
```

| Input               | Type      | Default            | Description                                                           |
| ------------------- | --------- | ------------------ | --------------------------------------------------------------------- |
| `length`            | `number`  | `0`                | Total number of items across all pages.                               |
| `pageIndex`         | `number`  | `0`                | Zero-based current page index. ModelSignal — supports two-way `[()]`. |
| `pageSize`          | `number`  | `10`               | Items per page. ModelSignal — supports two-way `[()]`.                |
| `disabled`          | `boolean` | `false`            | Disable all controls.                                                 |
| `hidePageSize`      | `boolean` | `false`            | Hide the page-size dropdown.                                          |
| `ariaLabel`         | `string`  | `'Pagination'`     | ARIA label for the paginator container.                               |
| `pageSizeLabel`     | `string`  | `'Items per page'` | Label next to the page-size dropdown.                                 |
| `previousPageLabel` | `string`  | `'Previous page'`  | ARIA label on the previous-page button.                               |
| `nextPageLabel`     | `string`  | `'Next page'`      | ARIA label on the next-page button.                                   |
| `pageLabel`         | `string`  | `'Page'`           | ARIA-label prefix on numeric page buttons (e.g. `"Page 3"`).          |

**Output:** `page` emits `PPPaginatorPageEvent` whenever the user changes page or page-size.

**Page-size options:** Hard-coded internally to `[10, 25, 50, 100]`. Not configurable in v1.0.1.

**Visible page labels are 1-based** — the dropdown / numeric buttons show `Page 1, Page 2, …` even though the public `pageIndex` is zero-based, matching Angular Material's convention.

**Figma variants:** The design has two visual layouts — **Pages** (full numeric page list, ~404 px wide) and **Page Selector** (compact dropdown, ~194 px wide). The component renders both adaptively; consumers don't pick between them.

### Models

```typescript
interface PPPaginatorPageEvent {
  readonly length: number;
  readonly pageIndex: number;
  readonly previousPageIndex: number;
  readonly pageSize: number;
}
```

**Forms:** Not a `ControlValueAccessor`. Bind `pageIndex` / `pageSize` via two-way model bindings or react to the `page` event in a signal-store / service.

### Peer Dependencies

`@angular/core`, `@pdx/pp-menu`, `@pdx/pp-theme`

---

## @pdx/pp-datepicker (v1.0.0)

Signal-based, zoneless-safe date picker with three selection modes — `single` (one calendar day), `range` (a start/end pair), and `month-year` (a month + year combo with **no day selection** — the panel skips the day grid and walks the user through month → year). The calendar overlay is rendered via `@angular/cdk/overlay` with focus trapping, scroll repositioning, and click-outside / `Escape` to close. Weekday/month labels come from `Intl.DateTimeFormat` — no third-party date library required.

### Components

#### PPDatepickerComponent

```typescript
import { PPDatepickerComponent, PPDateRange, PPDatepickerChangeEvent, PPDatepickerType } from '@pdx/pp-datepicker';
```

```html
<!-- single -->
<pp-datepicker label="Date" [(value)]="selected" />

<!-- range -->
<pp-datepicker type="range" label="Date Range" [(value)]="range" />

<!-- month-year -->
<pp-datepicker type="month-year" label="Period" [(value)]="period" />

<!-- with form integration -->
<pp-datepicker label="Birthday" [formControl]="birthdayCtrl" [required]="true" min="1900-01-01" />
```

| Input            | Type                                  | Default    | Description                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`           | `'single' \| 'range' \| 'month-year'` | `'single'` | Selection type. `single` picks one calendar day → `Date`. `range` picks a start + end day → `PPDateRange`. `month-year` picks **only a month + year, no day** → `Date` anchored to day 1 of the picked month at 00:00 (anchor day is an implementation detail; the user never sees or selects a day). |
| `label`          | `string`                              | `'Date'`   | Floating label rendered inside the trigger outline.                                                                                                                                                                                                                                                   |
| `disabled`       | `boolean`                             | `false`    | Disables the trigger.                                                                                                                                                                                                                                                                                 |
| `readonly`       | `boolean`                             | `false`    | Trigger is focusable but cannot open the overlay.                                                                                                                                                                                                                                                     |
| `invalid`        | `boolean`                             | `false`    | Renders the trigger in error styling.                                                                                                                                                                                                                                                                 |
| `required`       | `boolean`                             | `false`    | Decorates the label with a required asterisk. Purely visual — wire `Validators.required` on the bound control to enforce.                                                                                                                                                                             |
| `optional`       | `boolean`                             | `false`    | Decorates the label with a "(optional)" hint. `required` wins if both are set.                                                                                                                                                                                                                        |
| `helperText`     | `string`                              | `''`       | Helper text rendered below the trigger.                                                                                                                                                                                                                                                               |
| `min`            | `Date \| null`                        | `null`     | Inclusive lower bound. Earlier dates render disabled.                                                                                                                                                                                                                                                 |
| `max`            | `Date \| null`                        | `null`     | Inclusive upper bound. Later dates render disabled.                                                                                                                                                                                                                                                   |
| `firstDayOfWeek` | `PPDayOfWeek` (`0`-`6`)               | `1`        | First day of the week (`0` = Sunday … `6` = Saturday). Default Monday.                                                                                                                                                                                                                                |
| `locale`         | `PPSupportedLocale \| string`         | `'en'`     | Locale for weekday/month/header labels. Canonical: `'de-CH' \| 'en' \| 'fr' \| 'it' \| 'nl'`. Arbitrary BCP-47 tags (`'de-DE'`, `'en-US'`, …) are normalised internally.                                                                                                                              |
| `todayLabel`     | `string`                              | `'Today'`  | Label of the "today" shortcut button in day mode.                                                                                                                                                                                                                                                     |
| `value`          | `Date \| PPDateRange \| null`         | `null`     | `ModelSignal` — two-way bound selection. Shape varies by `type`.                                                                                                                                                                                                                                      |

**Outputs:**

- `dateChange` — emits `PPDatepickerChangeEvent` whenever the user commits a new value.
- `opened` — emits when the calendar overlay opens.
- `closed` — emits when the calendar overlay closes.

**Forms:** Implements `ControlValueAccessor`, so `[(ngModel)]` and `formControlName` work out of the box.

### Models

```typescript
type PPDatepickerType = 'single' | 'range' | 'month-year';
type PPDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type PPSupportedLocale = 'de-CH' | 'en' | 'fr' | 'it' | 'nl';
type PPLocaleInput = PPSupportedLocale | (string & {});

interface PPDateRange {
  readonly start: Date | null;
  readonly end: Date | null;
}

interface PPDatepickerChangeEvent {
  readonly value: Date | PPDateRange | null;
}
```

### Keyboard

Arrow keys move by day/week. `PageUp` / `PageDown` shift by month. `Home` / `End` jump to the start/end of the week. `Enter` / `Space` commit. `Escape` closes the panel. Out-of-range cells (per `min` / `max`) are disabled and skipped.

### Range mode

Range selection requires two clicks: the first anchors the start, the second closes and emits the normalised range. Closing the panel before the second click clears any partial selection (so the form-control value never goes out of sync with the visible trigger).

### Peer Dependencies

`@angular/cdk`, `@angular/common`, `@angular/core`, `@angular/forms`, `@pdx/pp-theme`

---

## Component Replacement Map

When a PDX component exists, always use it instead of Angular Material or custom implementations.

| Need             | PDX Component                                                        | Replaces                                                        |
| ---------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Standard button  | `PPButtonComponent`                                                  | `mat-button`, `mat-raised-button`, `mat-flat-button`            |
| Icon button      | `PPIconButtonComponent`                                              | `mat-icon-button`                                               |
| FAB              | `PPFloatingActionButtonComponent`                                    | `mat-fab`, `mat-mini-fab`                                       |
| Text input       | `PPInputComponent`                                                   | `mat-form-field` + `matInput`                                   |
| Textarea         | `PPTextareaComponent`                                                | `mat-form-field` + `matInput` + `<textarea>`                    |
| Checkbox         | `PPCheckboxComponent`                                                | `mat-checkbox`                                                  |
| Radio button     | `PPRadioButtonComponent`                                             | `mat-radio-button`                                              |
| Radio group      | `PPRadioGroupComponent`                                              | `mat-radio-group`                                               |
| Chip             | `PPChipComponent`                                                    | `mat-chip`                                                      |
| Chip list        | `PPChipListComponent`                                                | `mat-chip-listbox`, `mat-chip-set`                              |
| Dialog           | `PPDialogComponent`                                                  | Custom dialog templates (still use `MatDialog` service to open) |
| Tree             | `PPTreeComponent`                                                    | `mat-tree`, custom tree implementations                         |
| Select           | `PPSelectComponent`                                                  | `mat-select`                                                    |
| Multiselect      | `PPMultiselectComponent`                                             | `mat-select` (multiple)                                         |
| Menu             | `PPMenuComponent`                                                    | `mat-menu`                                                      |
| Menu multiselect | `PPMenuMultiselectComponent`                                         | `mat-menu` (multi-select)                                       |
| Tab group        | `PPTabGroupComponent`                                                | `mat-tab-group`                                                 |
| Tab              | `PPTabComponent`                                                     | `mat-tab`                                                       |
| List             | `PPListComponent`                                                    | `mat-selection-list`, `mat-list`                                |
| Expansion panel  | `PPExpansionPanelComponent` + `PPExpansionPanelItemComponent`        | `mat-expansion-panel`                                           |
| Form scaffold    | `PPFormComponent` (+ section / stack / block / textblock / actions)  | Custom form layout divs / ad-hoc Flex/Grid shells               |
| Icons            | `pp-icon pp-icon-*`                                                  | `mat-icon`, FontAwesome, other icon libraries                   |
| Button toggle    | `PPButtonToggleComponent` + `PPButtonToggleGroupComponent`           | `mat-button-toggle`, `mat-button-toggle-group`                  |
| Slide toggle     | `PPSlideToggleComponent`                                             | `mat-slide-toggle`                                              |
| Paginator        | `PPPaginatorComponent`                                               | `mat-paginator`                                                 |
| Date picker      | `PPDatepickerComponent` (`type="single" \| "range" \| "month-year"`) | `mat-datepicker`, `mat-date-range-picker`                       |

`pp-sidenav`, `pp-top-navigation`, and `pp-toolbar` / `pp-toolbar-mobile` are **not** in this drop-in table. They are app-shell design decisions — use them only when introducing or redesigning global navigation / shell chrome. See the "Navigation (app-shell only)" section in [../SKILL.md](../SKILL.md) for the applicability rules.

**Components without a PDX replacement yet** — use Angular Material with PDX theme applied:

- Autocomplete (`mat-autocomplete`)
- Progress bar / spinner (`mat-progress-bar`, `mat-progress-spinner`)
- Snackbar (`mat-snackbar`)
- Tooltip (`mat-tooltip`)
- Table (`mat-table`)
- Sort (`mat-sort`)
- Toolbar (`mat-toolbar`) — as a generic container, page header, dialog header, etc. (not as app-shell top navigation — for that, see `pp-top-navigation` above)
