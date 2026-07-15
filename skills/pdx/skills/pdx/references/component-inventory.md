# PDX Component Library Inventory

All libraries live in the PDX monorepo at `/libs/`. The repo uses Nx, Angular 21, standalone components, signals, and Vitest.

Most component libraries declare `@pdx/pp-theme` as a peer dependency; a few (e.g. `pp-button-toggle`, `pp-slide-toggle`) omit it from `package.json`. The exact peer dependencies are listed per library below.

---

## @pdx/pp-theme (v1.1.1)

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

**CSS variables:** `--pp-primary` (base), `--pp-primary-500`, `--pp-secondary-980`, etc. — the raw color custom properties use the **`--pp-`** prefix. The Tailwind theme layer additionally maps each one to a **`--color-pp-`** alias (e.g. `--color-pp-primary: var(--pp-primary)`); that alias is what the `text-pp-*` / `bg-pp-*` utilities resolve to. In hand-written CSS, `--pp-*` is always available; `--color-pp-*` is available wherever the Tailwind theme layer is loaded (it is in the recommended `css/index.css` entry).

**TailwindCSS utilities:** `text-pp-primary`, `bg-pp-secondary-980`, `border-pp-secondary-900`, etc.

**Core palettes:** primary, secondary, tertiary, neutral-variant, error, success, info, warning.

**Extended palettes:** orange, purple, dark-blue, blue, light-blue, linth-green, green, yellow.

**Shade scale (per palette):** discrete keys `50, 100, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 920, 940, 950, 960, 980, 990` plus an unsuffixed base. `50` is darkest, `990` is lightest. There is **no** `1000` shade. Source of truth: `libs/pp-theme/css/color/colors.css` and `libs/pp-theme/scss/color/colors.scss` in the PDX repo.

### Typography

AkkuratStd family: Light (300), Regular (400), Bold (700). CSS class: `.font-akkurat`.

### Angular Material Integration

Material 3 theme configuration with primary and tertiary palettes mapped to PDX colors. Density: 0. Typography: AkkuratStd.

---

## @pdx/pp-icons (v6.5.5)

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

## @pdx/pp-button (v1.3.2)

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
| `isFab`      | `boolean`                                                      | `false`         | When `true`, renders the icon button with floating-action-button styling (adds the `--fab` modifier).                                                        |
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
<pp-floating-action-button icon="pp-icon-edit_filled" ariaLabel="Edit" position="top-right" />
```

Prominent FAB for primary screen actions. Selector is the full **`pp-floating-action-button`** — there is no short `pp-fab` alias.

| Input       | Type                                                                         | Default          | Description                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `icon`      | `string`                                                                     | `'pp-icon-add'`  | Icon modifier class.                                                                                                        |
| `position`  | `'relative' \| 'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Anchor in the surrounding container. `'relative'` flows inline; the four corner values switch to `position: fixed` styling. |
| `disabled`  | `boolean`                                                                    | `false`          | Disabled state.                                                                                                             |
| `ariaLabel` | `string`                                                                     | —                | Accessibility label — required because the button is icon-only.                                                             |

### Peer Dependencies

`@angular/common`, `@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-input (v2.4.1)

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
| `role`                    | `string \| undefined`                               | `undefined`                                  | Forwarded `role` on the input — for composing `pp-input` as a combobox/listbox trigger                                                                                                                                                              |
| `ariaExpanded`            | `boolean \| undefined`                              | `undefined`                                  | Forwarded `aria-expanded`                                                                                                                                                                                                                           |
| `ariaControls`            | `string \| undefined`                               | `undefined`                                  | Forwarded `aria-controls`                                                                                                                                                                                                                           |
| `ariaActivedescendant`    | `string \| undefined`                               | `undefined`                                  | Forwarded `aria-activedescendant`                                                                                                                                                                                                                   |
| `ariaAutocomplete`        | `string \| undefined`                               | `undefined`                                  | Forwarded `aria-autocomplete`                                                                                                                                                                                                                       |
| `ariaHaspopup`            | `string \| undefined`                               | `undefined`                                  | Forwarded `aria-haspopup`                                                                                                                                                                                                                           |

**Outputs:**

- `inputChange` — emits the new value
- `inputKeydown` — emits the `KeyboardEvent` on keydown (for composing the input as a combobox trigger)
- `inputBlur` — emits `void` on blur

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

## @pdx/pp-form (v1.3.1)

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

Groups related form fields into a visually cohesive block.

| Input     | Type                 | Default | Description                                                                        |
| --------- | -------------------- | ------- | ---------------------------------------------------------------------------------- |
| `spacing` | `PPFormBlockSpacing` | `'sm'`  | Vertical spacing between the block's fields (`PPFormBlockSpacing = 'sm' \| 'lg'`). |

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

| Input       | Type                                            | Default   | Description                         |
| ----------- | ----------------------------------------------- | --------- | ----------------------------------- |
| `alignment` | `'left' \| 'center' \| 'right' \| 'full-width'` | `'right'` | Horizontal alignment of the buttons |

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

- **`pp-form-block` has `min-width: 14.375rem` (230 px).** Two blocks side by side inside a `pp-form-stack layout="horizontal"` need at least **508 px** of available width to render in one row (`230 + 48 gap + 230`). When the surrounding column is narrower (e.g. tabs share space with a 12 rem photo column on the right), the second block wraps under the first. Inspect the available width along the layout chain (`max-width` + `grid-template-columns` + nested stacks). If the room is `< 508 px`, either stack the blocks vertically (drop `layout="horizontal"`), or override the floor per-scope by setting the `--pp-form-block-min` custom property (e.g. `--pp-form-block-min: 0`) on the block.
- **`pp-form-actions` is a responsive `auto-fit` grid** (`grid-template-columns: repeat(auto-fit, 9.375rem); gap: 1rem;`). Each track is 150 px wide; buttons fit per row only while the container is wide enough (`n × 150 px + (n − 1) × 16 px`), and wrap onto new rows otherwise. The `alignment` input maps to `--left` / `--center` / `--right` / `--full-width` modifiers controlling `justify-content` (default `right`); `'full-width'` stretches the buttons to fill the row. Exactly three projected buttons switch to a split layout automatically (first button left, remaining two grouped right) regardless of `alignment`. For other tightly-controlled multi-button bars, build a custom flex action bar instead. Reserve `pp-form-actions` for the canonical Cancel + Save / OK pair (or the native three-button split).
- **No nested `<header>` inside `pp-form`.** `pp-form-section` already renders a `<header>` for its title block. Adding another `<header>` descendant for a section banner produces two banner landmarks on the page — an axe / a11y violation. Use `<div class="…__header">` with appropriate styling for any visual section header inside a PDX form.

### Peer Dependencies

`@angular/core`, `@pdx/pp-theme`, `@pdx/pp-radio`, `@pdx/pp-menu`

---

## @pdx/pp-checkbox (v2.0.0)

Checkbox with label, error, disabled and indeterminate states, and forms integration.

> **Breaking change in v2.0.0:** the form value is now a plain **`boolean`**. The tri-state `CheckboxState` enum and the `state` input are **removed**. Bind `[checked]` / `[(checked)]` instead of `[state]`; the indeterminate visual is a separate `indeterminate` model and is never part of the form value. `PPCheckboxChangeEvent` no longer carries `state`. This matches `mat-checkbox` semantics. Existing code on the 1.x enum API needs migrating — see the table below.

### Components

#### PPCheckboxComponent

```typescript
import { PPCheckboxComponent } from '@pdx/pp-checkbox';
```

```html
<pp-checkbox id="terms" label="Accept terms" [(checked)]="accepted" />
<pp-checkbox id="all" label="Select all" [checked]="allSelected()" [indeterminate]="someSelected()" />
<pp-checkbox id="err" label="Required field" [error]="true" />
```

| Input            | Type                               | Default  | Description                                                                                                                                                                                      |
| ---------------- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`             | `string`                           | `''`     | Unique identifier                                                                                                                                                                                |
| `label`          | `string`                           | `''`     | Display label                                                                                                                                                                                    |
| `checked`        | `ModelSignal<boolean>`             | `false`  | Checked state. Two-way `[(checked)]`. Inside a form, the form control's value takes precedence.                                                                                                  |
| `indeterminate`  | `ModelSignal<boolean>`             | `false`  | Indeterminate **visual** state — independent of `checked`, never part of the form value. Cleared automatically when the user clicks; the new value is emitted through `indeterminateChange`.     |
| `error`          | `boolean`                          | `false`  | Error state                                                                                                                                                                                      |
| `disabled`       | `boolean`                          | `false`  | Disabled state (form control's disabled state takes precedence inside a form)                                                                                                                    |
| `ariaLabel`      | `string \| undefined`              | —        | Accessibility label                                                                                                                                                                              |
| `labelWrap`      | `'wrap' \| 'nowrap' \| 'truncate'` | `'wrap'` | Long-label behaviour. `'wrap'` flows onto multiple lines. `'nowrap'` keeps a single line and overflows the parent. `'truncate'` clips with an ellipsis and exposes the full label via a tooltip. |
| `ariaLabelledby` | `string \| null`                   | `null`   | ID of the element labelling this checkbox                                                                                                                                                        |
| `tabIndex`       | `number \| null`                   | `null`   | Tab index for keyboard navigation                                                                                                                                                                |

**Outputs:**

- `checkboxChange` — emits `PPCheckboxChangeEvent` when the user toggles the checkbox
- `indeterminateChange` — emits `boolean` (via the `indeterminate` model) when the indeterminate state clears

### Models

```typescript
interface PPCheckboxChangeEvent {
  id: string;
  checked: boolean;
}
```

**Forms:** Implements `ControlValueAccessor`; the form value is a plain **`boolean`**. `null` / `undefined` written by the forms API are treated as unchecked.

### Migrating legacy (v1.x) usage

| v1.x                                               | v2.x                               |
| -------------------------------------------------- | ---------------------------------- |
| `[state]="CheckboxState.Selected"`                 | `[checked]="true"`                 |
| `[state]="CheckboxState.Indeterminate"`            | `[indeterminate]="true"`           |
| `import { CheckboxState } from '@pdx/pp-checkbox'` | Remove — the enum no longer exists |
| `event.state === CheckboxState.Selected`           | `event.checked`                    |
| Form value `CheckboxState`                         | Form value `boolean`               |

### Peer Dependencies

`@angular/core`, `@angular/material` (MatCheckboxModule), `@angular/forms`, `@pdx/pp-theme`

---

## @pdx/pp-radio (v1.4.1)

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

**Output:** `radioChange` emits the selected value (`string | number`).

#### PPRadioGroupComponent

```typescript
import { PPRadioGroupComponent, PPRadioOption } from '@pdx/pp-radio';
```

```html
<pp-radio-group [options]="options" [value]="selected" (valueChange)="onSelect($event)" />
```

| Input       | Type               | Default | Description                                    |
| ----------- | ------------------ | ------- | ---------------------------------------------- |
| `options`   | `PPRadioOption[]`  | `[]`    | Available options                              |
| `value`     | `string \| number` | `''`    | Selected value                                 |
| `disabled`  | `boolean`          | `false` | Disable all                                    |
| `ariaLabel` | `string \| null`   | `null`  | Group label                                    |
| `label`     | `string \| null`   | `null`  | Optional group label rendered above the radios |

**Output:** `valueChange` emits `MatRadioChange`.

### Models

```typescript
interface PPRadioOption {
  id: string;
  label: string;
  value: string | number;
  disabled?: boolean;
  ariaLabel?: string | null;
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

Container that lays out and manages multiple chips. Implements `ControlValueAccessor`.

| Input         | Type                         | Default        | Description                                   |
| ------------- | ---------------------------- | -------------- | --------------------------------------------- |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction of the chips.                |
| `equalWidth`  | `boolean`                    | `false`        | When `true`, all chips render at equal width. |
| `disabled`    | `boolean`                    | `false`        | Disables the whole list.                      |
| `ariaLabel`   | `string \| null`             | `null`         | Accessible label for the list.                |

**Output:** `chipRemoved` emits `PPChipRemoveEvent` when a chip's remove button is activated.

### Models

```typescript
interface PPChipRemoveEvent {
  id: string;
  label: string;
}

interface PPChipItem {
  id: string;
  label: string;
  leadingIcon: string | null;
}
```

### Peer Dependencies

`@angular/common`, `@angular/core`, `@angular/forms`, `@pdx/pp-theme`

---

## @pdx/pp-dialog (v1.1.4)

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
@use '@pdx/pp-dialog/styles' as pp-dialog;
```

Provides overlay and backdrop styling. The `as pp-dialog` alias is **required** to avoid a namespace collision with other `styles` modules (e.g. `@pdx/pp-input/styles`).

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

#### PPTreeNodeComponent

Renders an individual tree node (selector `pp-tree-node`). Exported from `@pdx/pp-tree`, it is instantiated internally by `pp-tree` for each node — you normally drive the tree through `pp-tree` and its `TreeData` input rather than rendering nodes directly.

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

const DROP_POSITIONS = { BEFORE: 'before', AFTER: 'after', INSIDE: 'inside' } as const;
type DropPosition = (typeof DROP_POSITIONS)[keyof typeof DROP_POSITIONS];

const SORT_DIRECTIONS = { UP: 'up', DOWN: 'down' } as const;
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

## @pdx/pp-select (v1.3.0)

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

| Input            | Type                                                   | Default     | Description                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `label`          | `string` _(required)_                                  | —           | Floating label text                                                                                                                                                                                                                                                |
| `options`        | `PPMenuItem[]`                                         | `[]`        | List of options to display                                                                                                                                                                                                                                         |
| `value`          | `string \| number`                                     | `''`        | ID of the currently selected option                                                                                                                                                                                                                                |
| `isDisabled`     | `boolean`                                              | `false`     | Disables the trigger and prevents dropdown from opening                                                                                                                                                                                                            |
| `isError`        | `boolean`                                              | `false`     | Error state styling for border and supporting text                                                                                                                                                                                                                 |
| `size`           | `'large' \| 'small'`                                   | `'large'`   | `large`: 2.5rem height, `small`: 2rem height                                                                                                                                                                                                                       |
| `icon`           | `string`                                               | `''`        | Leading icon CSS class (e.g. `'pp-icon-global_world'`)                                                                                                                                                                                                             |
| `supportingText` | `string`                                               | `''`        | Helper text below the trigger                                                                                                                                                                                                                                      |
| `ariaLabel`      | `string \| undefined`                                  | `undefined` | Accessible label (falls back to `label`)                                                                                                                                                                                                                           |
| `labelSpace`     | `PPSelectLabelSpace` (`'auto' \| 'always' \| 'never'`) | `'auto'`    | Reserves 8px above the trigger for the floating-label notch — same semantics as on `pp-input`. `'auto'` reserves when `label` is non-empty; `'always'` keeps label-less selects aligned with labeled fields in the same row; `'never'` opts out (legacy overflow). |

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
| `labelSpace`     | `PPSelectLabelSpace`            | `'auto'`    | Same semantics as on `pp-select` (see above)            |

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
  readonly icon?: string; // optional leading icon modifier class for the item
  readonly hasDivider?: boolean; // render a divider before this item
}
```

Change event types and the label-space type are exported from `@pdx/pp-select`:

```typescript
interface PPSelectChangeEvent {
  readonly id: string | number;
}

interface PPMultiselectChangeEvent {
  readonly ids: readonly (string | number)[];
}

type PPSelectLabelSpace = 'auto' | 'always' | 'never';
```

### Peer Dependencies

`@angular/core`, `@angular/forms`, `@pdx/pp-menu`, `@pdx/pp-theme`

---

## @pdx/pp-menu (v1.4.0)

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

**Outputs:**

- `itemSelect` — emits `PPMenuSelectEvent` (`{ id: string | number }`)
- `escapeKey` — emits `void` when `Escape` is pressed (the parent owns closing the menu)

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

**Outputs:**

- `selectionChange` — emits `PPMenuMultiselectChangeEvent` (`{ ids: readonly (string | number)[] }`)
- `escapeKey` — emits `void` when `Escape` is pressed (the parent owns closing the menu)

**Note:** `pp-menu-multiselect` does **not** act on the per-item `disabled`, `icon`, or `hasDivider` fields of `PPMenuItem` — it renders and toggles every item, and applies its component-level `icon` input to all rows. Those three fields are only honored by the single-select `pp-menu` (where `disabled` mutes the item and blocks click/Enter/Space).

### Models

```typescript
interface PPMenuItem {
  readonly id: string | number;
  readonly label: string;
  readonly supportingText?: string;
  readonly disabled?: boolean; // muted style; the menu skips disabled items in keyboard nav and never emits itemSelect for them
  readonly icon?: string; // optional leading icon modifier class for the item
  readonly hasDivider?: boolean; // render a divider before this item
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

## @pdx/pp-list (v2.2.0)

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

## @pdx/pp-tab (v1.2.0)

Secondary tab navigation component with icons, notification badges, two sizes, disabled states, content panels, keyboard navigation, and full accessibility.

### Components

#### PPTabGroupComponent

```typescript
import { PPTabGroupComponent, PPTabComponent, PPTabContentDirective, PPTabSize, PP_TAB_SIZE } from '@pdx/pp-tab';
```

```html
<pp-tab-group [(selectedIndex)]="activeTab" size="sm">
  <pp-tab label="Overview" icon="pp-icon-dashboard" [notificationCount]="3">
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

| Input           | Type        | Default | Description                                                                                                                                                |
| --------------- | ----------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectedIndex` | `number`    | `0`     | Index of the active tab. Supports two-way binding `[()]`.                                                                                                  |
| `size`          | `PPTabSize` | `'md'`  | Tab height for the whole group — `'sm'` (3rem / 48px) or `'md'` (3.625rem / 58px). Propagated to every child tab; a child's own `size` input overrides it. |
| `fullWidth`     | `boolean`   | `false` | When true, tabs stretch to fill the full width equally.                                                                                                    |

**Output:** `selectedIndexChange` emits the new index (via two-way binding).

**Overflow behavior:** when the tabs don't fit the container, the group renders scroll-arrow buttons and 2rem gradient edge-fades (`linear-gradient` overlays, toggled by scroll position) on the cut-off side — no consumer wiring needed.

#### PPTabComponent

```html
<pp-tab label="Tab 1" />
<pp-tab label="Dashboard" icon="pp-icon-dashboard" />
<pp-tab label="Inbox" [notificationCount]="12" />
<pp-tab label="Disabled" [disabled]="true" />
```

| Input               | Type                | Default | Description                                                                                                                   |
| ------------------- | ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `label`             | `string`            | `''`    | Text label displayed in the tab                                                                                               |
| `icon`              | `string \| null`    | `null`  | Icon class name (e.g. `'pp-icon-dashboard'`) — renders as a **leading icon before the label**; the label always stays visible |
| `size`              | `PPTabSize \| null` | `null`  | Per-tab size override; falls back to the group's `size`, then `'md'`                                                          |
| `notificationCount` | `number \| null`    | `null`  | Renders a `pp-notification-badge` next to the label; hidden when `null` or `0`                                                |
| `disabled`          | `boolean`           | `false` | Disables the tab when true                                                                                                    |

```typescript
const PP_TAB_SIZE = { SM: 'sm', MD: 'md' } as const;
type PPTabSize = (typeof PP_TAB_SIZE)[keyof typeof PP_TAB_SIZE]; // 'sm' | 'md'
```

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

### Height stabilization in dialogs

The tab group renders **only the active panel** into one shared `.pp-tab-group__body`, so a container sized by its content — typically a `MatDialog` — shrinks when the user switches to a shorter tab and grows back on return. There is no built-in height-stabilization input; the consumer-side fix is a **grow-only `min-height` pin** on the body:

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

Call it after the initial render (`afterNextRender(() => this.stabilizeTabHeight())`) and after every tab switch, once the newly selected panel has rendered:

```typescript
protected onTabChange(): void {
  requestAnimationFrame(() => this.stabilizeTabHeight());
}
```

Only apply this when the surrounding container derives its height from the tab content (dialogs, popovers). Routed full-page tab groups don't need it. Grow-only matters: clamping to the first panel's height would clip taller tabs, and resetting on switch reintroduces the jump.

### Design Tokens

- **Text (unselected/enabled):** `$pp-secondary-300`
- **Text (selected/hover):** `$pp-primary`
- **Text (disabled):** `$pp-secondary-700`
- **Focus ring:** `$pp-primary-300` outline
- **Indicator (selected):** `$pp-primary`
- **Divider:** `$pp-secondary-800`

### Peer Dependencies

`@angular/common`, `@angular/core`, `@pdx/pp-badge` (for `notificationCount`), `@pdx/pp-theme`

---

## @pdx/pp-expansion-panel (v1.0.4)

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

## @pdx/pp-sidenav (v1.1.1)

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
  PPSidenavSectionComponent,
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

**`PPSidenavSectionComponent`** (`pp-sidenav-section`) — a labelled grouping inside the subnav panel.

| Input     | Type      | Default  | Description                        |
| --------- | --------- | -------- | ---------------------------------- |
| `label`   | `string`  | required | Section label                      |
| `divider` | `boolean` | `false`  | Render a divider above the section |

### Global styles

```scss
@use '@pdx/pp-sidenav/styles';
```

Overrides Angular Material tooltip defaults for the design system (pp-sidenav uses Angular Material tooltips internally).

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

## @pdx/pp-toolbar (v1.0.1)

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

## @pdx/pp-button-toggle (v1.0.1)

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

`@angular/core`

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

`@angular/common`, `@angular/core`, `@angular/forms`

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

## @pdx/pp-datepicker (v2.0.0)

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

### Also exported

Besides the types above, `@pdx/pp-datepicker` exports `PPDatepickerValue` (`Date | PPDateRange | null`), the locale helpers `SUPPORTED_LOCALES`, `DEFAULT_SUPPORTED_LOCALE`, `LOCALE_ALIAS_MAP`, and the `resolveLocale` function used to normalise an arbitrary BCP-47 tag to a supported locale.

### Keyboard

Arrow keys move by day/week. `PageUp` / `PageDown` shift by month. `Home` / `End` jump to the start/end of the week. `Enter` / `Space` commit. `Escape` closes the panel. Out-of-range cells (per `min` / `max`) are disabled and skipped.

### Range mode

Range selection requires two clicks: the first anchors the start, the second closes and emits the normalised range. Closing the panel before the second click clears any partial selection (so the form-control value never goes out of sync with the visible trigger).

### Peer Dependencies

`@angular/cdk`, `@angular/core`, `@angular/forms`, `@pdx/pp-theme`

---

## @pdx/pp-autocomplete (v1.1.1)

Free-text combobox with filtered suggestions. The form value is always the input string; selecting an item writes its display value into the field, and `selectionChange` emits the matched item in parallel. Built on top of `@pdx/pp-input`.

### Components

#### PPAutocompleteComponent

```typescript
import { PPAutocompleteComponent, AutocompleteItem } from '@pdx/pp-autocomplete';
```

```html
<pp-autocomplete label="Search" [items]="items" [formControl]="query" (selectionChange)="onSelect($event)" />
```

| Input        | Type                                                 | Default                               | Description                                                                                                                                           |
| ------------ | ---------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`      | `string`                                             | `''`                                  | Field text; two-way via `[(value)]`. A full, case-insensitive match marks that item as the selection.                                                 |
| `items`      | `AutocompleteItem[]`                                 | `[]`                                  | Items to filter and offer as suggestions.                                                                                                             |
| `label`      | `string`                                             | required                              | Floating label (also drives `aria-label`).                                                                                                            |
| `helperText` | `string`                                             | `''`                                  | Helper text below the field.                                                                                                                          |
| `size`       | `'sm' \| 'lg'`                                       | `'lg'`                                | Field size — matches `pp-input`.                                                                                                                      |
| `fullWidth`  | `boolean`                                            | `false`                               | Stretch field + dropdown to the host width; the dropdown panel matches the input width.                                                               |
| `disabled`   | `boolean`                                            | `false`                               | Disables the field and panel.                                                                                                                         |
| `readonly`   | `boolean`                                            | `false`                               | Renders the field readonly.                                                                                                                           |
| `required`   | `boolean`                                            | `false`                               | Forwarded to the inner `pp-input`, which renders the label asterisk and the native `required` attribute. Purely visual — wire the validator yourself. |
| `invalid`    | `boolean`                                            | `false`                               | Error visual state.                                                                                                                                   |
| `displayFn`  | `(item: AutocompleteItem) => string`                 | `(i) => i.label`                      | Maps an item to the text shown when it is selected.                                                                                                   |
| `filterFn`   | `(query: string, item: AutocompleteItem) => boolean` | case-insensitive substring on `label` | Predicate used to filter items against the query.                                                                                                     |

**Outputs:**

- `valueChange` — emits the field text on every change (also the `[(value)]` channel)
- `selectionChange` — emits the matched `AutocompleteItem` (or `null` when nothing matches)
- `openChange` — emits `boolean` when the dropdown opens/closes

**Forms:** `value` is a `model()` and the component implements `ControlValueAccessor` — bind via `[(value)]`, `[formControl]` / `formControlName`, or `ngModel` (do not combine `[(value)]` with a form binding).

### Models

```typescript
interface AutocompleteItem {
  id: string | number;
  label: string;
  icon?: string; // pp-icon modifier class; shown in the dropdown row
}
```

### Peer Dependencies

`@angular/cdk`, `@angular/core`, `@angular/forms`, `@pdx/pp-input`, `@pdx/pp-theme`

---

## @pdx/pp-timepicker (v1.1.2)

24h `HH:mm` time picker with a responsive surface. The trigger is a masked native input with a floating label; on desktop (`>= 768px`) it opens a CDK overlay with hour/minute columns, and on mobile it opens an Angular Material `MatBottomSheet` with OK/Cancel actions. Signal-based `model()` two-way binding + `ControlValueAccessor`.

### Components

#### PPTimepickerComponent

```typescript
import { PPTimepickerComponent, PPTimepickerChangeEvent } from '@pdx/pp-timepicker';
```

```html
<pp-timepicker label="Start time" [(value)]="time" />
<pp-timepicker label="End time" [formControl]="endCtrl" [required]="true" />
```

| Input           | Type             | Default        | Description                                       |
| --------------- | ---------------- | -------------- | ------------------------------------------------- |
| `label`         | `string`         | required       | Floating label.                                   |
| `value`         | `string \| null` | `null`         | Committed `HH:mm` value; two-way via `[(value)]`. |
| `size`          | `'sm' \| 'lg'`   | `'lg'`         | Trigger size.                                     |
| `disabled`      | `boolean`        | `false`        | Disabled state.                                   |
| `readonly`      | `boolean`        | `false`        | Read-only trigger.                                |
| `invalid`       | `boolean`        | `false`        | Error visual state.                               |
| `required`      | `boolean`        | `false`        | Shows the required marker.                        |
| `optional`      | `boolean`        | `false`        | Shows the optional hint.                          |
| `optionalLabel` | `string`         | `'(optional)'` | Text of the optional hint.                        |
| `helperText`    | `string`         | `''`           | Helper text below the trigger.                    |
| `okLabel`       | `string`         | `'OK'`         | Mobile bottom-sheet confirm label.                |
| `cancelLabel`   | `string`         | `'Cancel'`     | Mobile bottom-sheet cancel label.                 |
| `hourLabel`     | `string`         | `'Hour'`       | Accessible label for the hour column/field.       |
| `minuteLabel`   | `string`         | `'Minute'`     | Accessible label for the minute column/field.     |

**Output:** `timeChange` emits `PPTimepickerChangeEvent` (`{ value: string | null }`).

**Forms:** implements `ControlValueAccessor`; `value` is a `model()` (`[(value)]`).

### Models

```typescript
interface PPTimepickerChangeEvent {
  value: string | null; // committed time in HH:mm 24h format, or null when cleared
}
```

### Global styles

```scss
@use '@pdx/pp-timepicker/styles' as pp-timepicker;
```

Required in the app's root `styles.scss` for the mobile bottom-sheet's rounded corners and surface; the desktop overlay is self-contained.

### Peer Dependencies

`@angular/cdk`, `@angular/common`, `@angular/core`, `@angular/forms`, `@angular/material` (bottom-sheet host), `@pdx/pp-button`, `@pdx/pp-theme`

**Notes:** the mobile bottom-sheet relies on Angular animations — consumer apps must provide them (`provideAnimationsAsync()`), otherwise the sheet never finishes dismissing. On viewports `< 768px` the trigger input is always read-only (editing happens inside the bottom sheet).

---

## @pdx/pp-tooltip (v1.0.1)

Contextual tooltip in three variants: `minimal` (text only, hover), `basic` (title + text, hover), and `extended` (title, text, close button, multistep walkthrough, click-triggered).

### Components

#### PPTooltipComponent

```typescript
import { PPTooltipComponent } from '@pdx/pp-tooltip';
```

```html
<pp-tooltip text="Saves your changes" variant="minimal">
  <pp-icon-button icon="pp-icon-information" ariaLabel="Help" />
</pp-tooltip>
```

| Input                     | Type                                 | Default     | Description                                            |
| ------------------------- | ------------------------------------ | ----------- | ------------------------------------------------------ |
| `variant`                 | `'minimal' \| 'basic' \| 'extended'` | `'minimal'` | `'minimal'` / `'basic'` / `'extended'`.                |
| `title`                   | `string \| null`                     | `null`      | Title (used by `basic` / `extended`).                  |
| `text`                    | `string \| string[] \| null`         | `null`      | Body text; an array supplies the steps for `extended`. |
| `isOpen`                  | `boolean`                            | `false`     | Open state; two-way via `[(isOpen)]`.                  |
| `previousStepButtonLabel` | `string`                             | `'Back'`    | `extended` walkthrough back-button label.              |
| `nextStepButtonLabel`     | `string`                             | `'Next'`    | `extended` walkthrough next-button label.              |

No outputs — state is communicated through the `isOpen` `model()` two-way binding.

**Custom content:** rich title/body can be projected via named templates referenced by the component — `#ppTooltipTitle` and `#ppTooltipText` (`contentChild` queries), not standard content-projection slots.

### Peer Dependencies

`@angular/common`, `@angular/core`, `@pdx/pp-button`

---

## @pdx/pp-inline-message (v1.0.0)

Contextual, persistent inline message (info / success / warning / error) tied to a specific element. Unlike a snackbar it stays visible while relevant, and has an always-collapsible body toggled from the header.

### Components

#### PPInlineMessageComponent

```typescript
import {
  PPInlineMessageComponent,
  InlineMessageStatus,
  InlineMessageSize,
  INLINE_MESSAGE_STATUS_ICONS,
} from '@pdx/pp-inline-message';
```

```html
<pp-inline-message status="warning" title="Unsaved changes">
  <p>Your changes have not been saved yet.</p>
</pp-inline-message>
```

| Input       | Type                  | Default  | Description                                    |
| ----------- | --------------------- | -------- | ---------------------------------------------- |
| `title`     | `string`              | required | Header title.                                  |
| `status`    | `InlineMessageStatus` | `'info'` | Semantic status — drives color + leading icon. |
| `size`      | `InlineMessageSize`   | `'lg'`   | `'lg'` / `'sm'`.                               |
| `expanded`  | `boolean`             | `false`  | Whether the projected body is expanded.        |
| `ariaLabel` | `string \| null`      | `null`   | Accessible label for the message region.       |

**Outputs:** `opened` and `closed` (both `void`) fire when the body expands/collapses. A public `toggle()` method toggles the state programmatically.

**Content:** projected content (`<ng-content>`) is the collapsible body, rendered only when expanded. Small viewports (`<= 47.99rem`) adapt automatically via `BreakpointObserver`.

### Models

```typescript
type InlineMessageStatus = 'info' | 'success' | 'warning' | 'error';
type InlineMessageSize = 'lg' | 'sm';

const INLINE_MESSAGE_STATUS_ICONS: Record<InlineMessageStatus, string> = {
  info: 'pp-icon-information',
  success: 'pp-icon-check_circle',
  warning: 'pp-icon-attention_triangle',
  error: 'pp-icon-cross_circle',
};
```

### Peer Dependencies

`@angular/cdk` (id generation + `BreakpointObserver`), `@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-progress-indicator (v1.0.0)

Displays the progress of a task. Supports `linear` (bar) and `circular` (ring) variants in `determinate` and `indeterminate` modes.

### Components

#### PPProgressIndicatorComponent

```typescript
import {
  PPProgressIndicatorComponent,
  PPProgressIndicatorVariant,
  PPProgressIndicatorType,
  PPProgressIndicatorCircularSize,
} from '@pdx/pp-progress-indicator';
```

```html
<pp-progress-indicator variant="linear" progressType="determinate" [value]="65" ariaLabel="Upload" />
<pp-progress-indicator variant="circular" progressType="indeterminate" circularSize="md" ariaLabel="Loading" />
```

| Input          | Type                              | Default         | Description                                                      |
| -------------- | --------------------------------- | --------------- | ---------------------------------------------------------------- |
| `variant`      | `PPProgressIndicatorVariant`      | `'linear'`      | `'linear'` or `'circular'`.                                      |
| `progressType` | `PPProgressIndicatorType`         | `'determinate'` | `'determinate'` or `'indeterminate'`.                            |
| `value`        | `number`                          | `0`             | Progress `0`–`100` (clamped). Only meaningful for `determinate`. |
| `circularSize` | `PPProgressIndicatorCircularSize` | `'md'`          | `'sm'` / `'md'` / `'lg'`. Only affects the `circular` variant.   |
| `ariaLabel`    | `string \| null`                  | `null`          | Accessible label.                                                |

No outputs. Standalone, OnPush, zoneless-safe.

### Models

```typescript
// Each is exported as a const object plus a derived union type:
const PP_PROGRESS_INDICATOR_VARIANT = { LINEAR: 'linear', CIRCULAR: 'circular' } as const;
type PPProgressIndicatorVariant = (typeof PP_PROGRESS_INDICATOR_VARIANT)[keyof typeof PP_PROGRESS_INDICATOR_VARIANT];

const PP_PROGRESS_INDICATOR_TYPE = { DETERMINATE: 'determinate', INDETERMINATE: 'indeterminate' } as const;
type PPProgressIndicatorType = (typeof PP_PROGRESS_INDICATOR_TYPE)[keyof typeof PP_PROGRESS_INDICATOR_TYPE];

const PP_PROGRESS_INDICATOR_CIRCULAR_SIZE = { SM: 'sm', MD: 'md', LG: 'lg' } as const;
type PPProgressIndicatorCircularSize =
  (typeof PP_PROGRESS_INDICATOR_CIRCULAR_SIZE)[keyof typeof PP_PROGRESS_INDICATOR_CIRCULAR_SIZE];
```

### Peer Dependencies

`@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-table (v1.1.1)

Tabular interface for structured data: pagination, sorting, row expansion, grouped multi-level headers, and interactive cells (checkbox, slide toggle, button, chip, menu) declared as a Signal-driven `PPTable` data model. The table is assembled from a family of structural components.

> **Legacy note:** older table configs used `checkbox.state: WritableSignal<CheckboxState>`. The current config uses separate `checked` / `indeterminate` boolean signals, following the `pp-checkbox` boolean form value — migrate any `state`-based config you encounter.

### Components

#### PPTableComponent

```typescript
import { PPTableComponent } from '@pdx/pp-table';
```

```html
<pp-table [data]="tableData()" [pagination]="true" layout="auto" />
```

| Input        | Type              | Default  | Description                                    |
| ------------ | ----------------- | -------- | ---------------------------------------------- |
| `data`       | `PPTable \| null` | `null`   | The table model (heading columns + body rows). |
| `pagination` | `boolean`         | `true`   | Whether the built-in `pp-paginator` is shown.  |
| `layout`     | `PPTableLayout`   | `'auto'` | `'auto'` or `'fixed'` table layout.            |
| `scrollable` | `boolean`         | `false`  | Enables horizontal scrolling for wide tables.  |

The component owns pagination, sorting, and row reorder/duplicate/delete internally.

**Height-bounded scrolling:** the host is a flex column and `.pp-table-content` flexes to fill it — constrain the height of `<pp-table>` (or its container) and the body region scrolls vertically on its own. The old `::ng-deep .pp-table-content { overflow-y: auto; max-height: … }` consumer hack is no longer needed; remove it when found.

#### Structural & column components

Also exported and composed under `pp-table`: `PPTableHeadingComponent` (`pp-table-heading`), `PPTableHeadingColumnComponent` (`pp-table-heading-column`, CVA — sortable header cell), `PPTableGroupedColumnsComponent` / `PPTableGroupedColumnComponent` (multi-level headers), `PPTableBodyComponent` (`pp-table-body`), `PPTableRowComponent` (`pp-table-row`), `PPTableColumnComponent` (`pp-table-column` — renders text / checkbox / slide-toggle / button / chip per the `PPTableColumn` model), `PPTableExpandableColumnComponent` / `PPTableExpandableRowComponent` (CVA, two-way `[(expanded)]`), and `PPTableMenuColumnComponent` (`pp-table-menu-column` — row-action menu).

**`PPTableMenuColumnComponent`** has an `ariaLabel: InputSignal<string>` (default `'Row actions'`) applied to both the trigger button and the inner `pp-menu`. Note: the data-driven `[data]` API does not forward a per-row aria-label — `PPTableColumn.menu` only carries `items` + `onSelect`, so rows rendered through `[data]` use the default; override only by composing `pp-table-menu-column` directly.

### Models

```typescript
interface PPTable {
  heading: { columns: PPTableHeadingColumn[] };
  body: { rows: PPTableRow[] };
}

interface PPTableRow {
  columns: PPTableColumn[];
  expandableRow?: { columns: PPTableColumn[]; expanded: boolean };
}

interface PPTableHeadingColumn {
  title: string;
  description?: string;
  sortable?: boolean;
  sortBy?: PPTableColumnSortBy; // 'headline' | 'text'
  width?: PPTableColumnWidth; // 'flexible' | 'fixed' | 'content' | 'minimum'
  overflow?: PPTableColumnOverflow; // 'truncate' | 'wrap' | 'no-wrap'
}

// PPTableColumn carries the cell content; one of: text/headline, checkbox, slideToggle,
// button, chip, rating, status, or menu. Interactive cell state is held in WritableSignals.
// Interactive cell configs (v1.1.x shapes):
interface PPTableColumn {
  // …text / headline / chip / status / rating fields…
  button?: {
    label: string;
    variant?: 'filled' | 'outlined' | 'text' | 'tonal';
    size?: 'sm' | 'md' | 'lg';
    icon?: string;
    disabled?: WritableSignal<boolean>;
    ariaLabel?: string; // accessible name — required for icon-only buttons
    onClick?: (event: MouseEvent) => void;
  };
  checkbox?: {
    label?: string;
    checked?: WritableSignal<boolean>; // replaces the legacy state: WritableSignal<CheckboxState>
    indeterminate?: WritableSignal<boolean>;
    disabled?: WritableSignal<boolean>;
    ariaLabel?: string;
  };
  slideToggle?: {
    label?: string | null;
    checked: WritableSignal<boolean>;
    disabled?: WritableSignal<boolean>;
    size?: 'sm' | 'lg';
    ariaLabel?: string;
  };
  menu?: {
    items: PPMenuItem[];
    onSelect: (event: PPMenuSelectEvent) => void;
  };
}

type PPTableLayout = 'auto' | 'fixed';
```

### Peer Dependencies

`@angular/common`, `@angular/core`, `@angular/forms`, `@pdx/pp-button`, `@pdx/pp-checkbox` (`^2.0.0`), `@pdx/pp-chip`, `@pdx/pp-menu`, `@pdx/pp-paginator`, `@pdx/pp-slide-toggle`

---

## @pdx/pp-link (v1.0.0)

Styled text link rendering a native `<a>`, with optional leading icon and trailing arrow.

### Components

#### PPLinkComponent

```typescript
import { PPLinkComponent } from '@pdx/pp-link';
```

```html
<pp-link url="https://polypoint.ch" label="Visit Polypoint" />
<pp-link url="https://polypoint.ch" label="Polypoint Website" leadingIcon="pp-icon-polypoint" [trailingIcon]="true" />
```

| Input          | Type             | Default  | Description                                                                                     |
| -------------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `url`          | `string`         | required | Destination URL. The input is `url`, **not** `href`.                                            |
| `label`        | `string \| null` | `null`   | Link text — falls back to displaying the `url` when unset.                                      |
| `ariaLabel`    | `string \| null` | `null`   | Accessible name — falls back to `label ?? url`.                                                 |
| `leadingIcon`  | `string \| null` | `null`   | CSS icon class shown before the label (e.g. `pp-icon-polypoint`).                               |
| `trailingIcon` | `boolean`        | `true`   | Show the trailing arrow (`pp-icon-arrow_right_arrow_next`). Accepts `booleanAttribute` strings. |
| `disabled`     | `boolean`        | `false`  | Removes `href`, sets `tabindex="-1"` and `aria-disabled="true"`.                                |

No outputs — it is a plain anchor. There is no `size` input.

### Peer Dependencies

`@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-badge (v1.0.0)

Compact, non-interactive badges. `pp-badge` is a status/label pill; `pp-notification-badge` is an error-colored count bubble or dot.

### Components

#### PPBadgeComponent

```typescript
import { PPBadgeComponent, BadgeColor, BadgeAppearance } from '@pdx/pp-badge';
```

```html
<pp-badge color="success" appearance="status" icon="pp-icon-check_circle">Active</pp-badge>
<pp-badge color="purple" appearance="label">Category</pp-badge>
```

| Input        | Type              | Default     | Description                                                            |
| ------------ | ----------------- | ----------- | ---------------------------------------------------------------------- |
| `color`      | `BadgeColor`      | `'neutral'` | Palette — background `$pp-<color>-960`, text/border `$pp-<color>-300`. |
| `appearance` | `BadgeAppearance` | `'status'`  | `'status'` (1px border) or `'label'` (borderless).                     |
| `icon`       | `string \| null`  | `null`      | Optional leading icon class.                                           |
| `ariaLabel`  | `string \| null`  | `null`      | When the projected text isn't descriptive enough.                      |

**Text is projected via `ng-content`** — there is no `label` input (exception to the PDX label rule).

#### PPNotificationBadgeComponent

```html
<pp-notification-badge [count]="3" ariaLabel="3 unread notifications" />
<pp-notification-badge ariaLabel="New activity" />
```

| Input       | Type             | Default | Description                                                                                                  |
| ----------- | ---------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `count`     | `number \| null` | `null`  | Numeric bubble when a number (`0` renders as `0`); bare **dot** when `null`. Counts above 999 render `999+`. |
| `ariaLabel` | `string \| null` | `null`  | When set, the host becomes a `role="status"` live region and the raw number is `aria-hidden`.                |

### Models

```typescript
type BadgeColor =
  | 'neutral' // maps to the secondary palette
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'purple'
  | 'dark-blue'
  | 'green'
  | 'orange'
  | 'blue'
  | 'yellow';

type BadgeAppearance = 'status' | 'label';
```

### Peer Dependencies

`@angular/core`, `@pdx/pp-theme`

---

## @pdx/pp-snackbar (v1.0.0)

Transient, queued notification (snackbar / toast) — **the PDX replacement for Angular Material's `MatSnackBar`**. Service-driven: snackbars are opened via `PPSnackbarService` (rendered through a CDK overlay); do not place `<pp-snackbar>` in templates.

### Setup

```typescript
// app.config.ts
import { provideSnackbar } from '@pdx/pp-snackbar';

providers: [provideSnackbar({ autoDismissDelay: 3000 })]; // defaults are optional
```

### Usage

```typescript
import { inject } from '@angular/core';
import { PPSnackbarService } from '@pdx/pp-snackbar';

private readonly snackbar = inject(PPSnackbarService);

const ref = this.snackbar.open({ message: this.translate.instant('common.item_deleted'), undoable: true });
ref.onUndo().subscribe(() => { /* restore */ });
ref.afterDismissed().subscribe((reason) => {
  if (reason === 'timeout' || reason === 'dismiss') { /* finalize */ }
});
```

### Service API

- `open(config: PPSnackbarConfig): PPSnackbarRef` — merges the provided config over the `provideSnackbar` defaults, enqueues, shows when idle (FIFO — one snackbar visible at a time).
- `dismiss(ref?, reason?)` — dismisses the active (or given) snackbar.

`PPSnackbarRef`: `dismiss(reason?)`, `afterDismissed(): Observable<PPSnackbarDismissReason>`, `onAction()`, `onSecondaryAction()`, `onUndo()` (all `Observable<void>`).

### Config (`PPSnackbarConfig` — fields mirror component inputs)

| Field                                                           | Type                                                       | Default                       | Description                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------- | -------------------------------------------------------- |
| `message`                                                       | `string`                                                   | `''` (required)               | Main content.                                            |
| `title`                                                         | `string \| null`                                           | `null`                        | Optional title line.                                     |
| `status`                                                        | `'neutral' \| 'info' \| 'success' \| 'warning' \| 'error'` | `'neutral'`                   | Semantic status — drives color + leading icon.           |
| `variant`                                                       | `'filled' \| 'outlined'`                                   | `'filled'`                    | Visual style.                                            |
| `withLeadingIcon`                                               | `boolean`                                                  | `true`                        | Show the status icon.                                    |
| `undoable`                                                      | `boolean`                                                  | `true`                        | Show the undo button.                                    |
| `dismissable`                                                   | `boolean`                                                  | `true`                        | Show the close button.                                   |
| `autoDismiss` / `autoDismissDelay`                              | `boolean` / `number`                                       | `true` / `5000`               | Auto-dismiss after N ms (dismiss reason `'timeout'`).    |
| `primaryActionButtonLabel` / `secondaryActionButtonLabel`       | `string \| null`                                           | `null`                        | Optional action buttons (filled / outlined `pp-button`). |
| `dismissAriaLabel` / `undoAriaLabel` / `…ActionButtonAriaLabel` | `string`                                                   | `'Dismiss'` / `'Undo'` / `''` | Accessible names — pass translated values.               |

`PPSnackbarDismissReason`: `'timeout' | 'action' | 'undo' | 'dismiss' | 'manual'`.

**Positioning:** desktop → top-right; mobile (`< 480px`) → bottom-center, near-full width. **Animations:** consumer apps must provide `provideAnimationsAsync()`.

### Exports

`PPSnackbarComponent`, `PPSnackbarService`, `PPSnackbarConfig`, `PPSnackbarRef`, `provideSnackbar`, `PP_SNACKBAR_DEFAULTS`, `PP_SNACKBAR_DATA`, `PPSnackbarStatus`, `PPSnackbarVariant`, `PPSnackbarDismissReason`.

### Peer Dependencies

`@angular/core`, `@angular/cdk`, `@pdx/pp-button`, `rxjs`

---

## Component Replacement Map

When a PDX component exists, always use it instead of Angular Material or custom implementations.

| Need                | PDX Component                                                        | Replaces                                                        |
| ------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Standard button     | `PPButtonComponent`                                                  | `mat-button`, `mat-raised-button`, `mat-flat-button`            |
| Icon button         | `PPIconButtonComponent`                                              | `mat-icon-button`                                               |
| FAB                 | `PPFloatingActionButtonComponent`                                    | `mat-fab`, `mat-mini-fab`                                       |
| Text input          | `PPInputComponent`                                                   | `mat-form-field` + `matInput`                                   |
| Textarea            | `PPTextareaComponent`                                                | `mat-form-field` + `matInput` + `<textarea>`                    |
| Checkbox            | `PPCheckboxComponent`                                                | `mat-checkbox`                                                  |
| Radio button        | `PPRadioButtonComponent`                                             | `mat-radio-button`                                              |
| Radio group         | `PPRadioGroupComponent`                                              | `mat-radio-group`                                               |
| Chip                | `PPChipComponent`                                                    | `mat-chip`                                                      |
| Chip list           | `PPChipListComponent`                                                | `mat-chip-listbox`, `mat-chip-set`                              |
| Dialog              | `PPDialogComponent`                                                  | Custom dialog templates (still use `MatDialog` service to open) |
| Tree                | `PPTreeComponent`                                                    | `mat-tree`, custom tree implementations                         |
| Select              | `PPSelectComponent`                                                  | `mat-select`                                                    |
| Multiselect         | `PPMultiselectComponent`                                             | `mat-select` (multiple)                                         |
| Menu                | `PPMenuComponent`                                                    | `mat-menu`                                                      |
| Menu multiselect    | `PPMenuMultiselectComponent`                                         | `mat-menu` (multi-select)                                       |
| Tab group           | `PPTabGroupComponent`                                                | `mat-tab-group`                                                 |
| Tab                 | `PPTabComponent`                                                     | `mat-tab`                                                       |
| List                | `PPListComponent`                                                    | `mat-selection-list`, `mat-list`                                |
| Expansion panel     | `PPExpansionPanelComponent` + `PPExpansionPanelItemComponent`        | `mat-expansion-panel`                                           |
| Form scaffold       | `PPFormComponent` (+ section / stack / block / textblock / actions)  | Custom form layout divs / ad-hoc Flex/Grid shells               |
| Icons               | `pp-icon pp-icon-*`                                                  | `mat-icon`, FontAwesome, other icon libraries                   |
| Button toggle       | `PPButtonToggleComponent` + `PPButtonToggleGroupComponent`           | `mat-button-toggle`, `mat-button-toggle-group`                  |
| Slide toggle        | `PPSlideToggleComponent`                                             | `mat-slide-toggle`                                              |
| Paginator           | `PPPaginatorComponent`                                               | `mat-paginator`                                                 |
| Date picker         | `PPDatepickerComponent` (`type="single" \| "range" \| "month-year"`) | `mat-datepicker`, `mat-date-range-picker`                       |
| Time picker         | `PPTimepickerComponent`                                              | custom time inputs / `<input type="time">`                      |
| Autocomplete        | `PPAutocompleteComponent`                                            | `mat-autocomplete`                                              |
| Progress indicator  | `PPProgressIndicatorComponent`                                       | `mat-progress-bar`, `mat-progress-spinner`                      |
| Table               | `PPTableComponent` (+ column / row sub-components)                   | `mat-table`                                                     |
| Tooltip             | `PPTooltipComponent`                                                 | `mat-tooltip`                                                   |
| Inline message      | `PPInlineMessageComponent`                                           | custom inline alert / banner markup                             |
| Snackbar / toast    | `PPSnackbarService` (`@pdx/pp-snackbar`)                             | `MatSnackBar` / `mat-snackbar`                                  |
| Text link           | `PPLinkComponent`                                                    | plain `<a>` with custom link styles                             |
| Status / label pill | `PPBadgeComponent`                                                   | custom pill / tag markup                                        |
| Notification count  | `PPNotificationBadgeComponent`                                       | `matBadge`, custom count bubbles                                |

`pp-sidenav`, `pp-top-navigation`, and `pp-toolbar` / `pp-toolbar-mobile` are **not** in this drop-in table. They are app-shell design decisions — use them only when introducing or redesigning global navigation / shell chrome. See the "Navigation (app-shell only)" section in [../SKILL.md](../SKILL.md) for the applicability rules.

**Components without a PDX replacement yet** — use Angular Material with PDX theme applied:

- Sort (`mat-sort`)
- Toolbar (`mat-toolbar`) — as a generic container, page header, dialog header, etc. (not as app-shell top navigation — for that, see `pp-top-navigation` above)
