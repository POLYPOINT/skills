---
name: pdx
description: This skill should be used when applying the PDX (POLYPOINT Design Experience) design system to Angular code — installing or using `@pdx/*` libraries, replacing Angular Material components with PDX equivalents, applying PDX design tokens or typography, building forms with `pp-form`, or auditing existing UI for PDX consistency. Triggers on phrases like "apply PDX styles", "use PDX libs", "use POLYPOINT components", "make it POLYPOINT-styled", "replace mat-button with pp-button", or "audit Material usage".
metadata:
  version: '1.12.0'
---

# PDX — POLYPOINT Design Experience

Apply the PDX design system to Angular frontends. PDX provides reusable Angular component libraries (`@pdx/*`), design tokens, icons, and layout guidelines that ensure a consistent POLYPOINT look and feel.

## Core Principle

**When a PDX component exists, always use it instead of Angular Material or custom implementations.** Only fall back to Angular Material (with PDX theme applied) for components that do not yet have a PDX equivalent.

## Report library gaps — never work around them silently

When the `pp-*` component chosen for a use case doesn't support the behavior needed and a workaround is required (CSS that fights the component's internals, DOM queries into its markup, re-implementing a missing input/output, wrapper code that patches sizing or focus behavior), apply the workaround **and report it to the user**: name the component, the behavior it lacks, the workaround used, and whether that behavior should be implemented in the library instead. The user decides whether to file it as a PDX improvement — a workaround that goes unreported silently becomes permanent.

## Label rule

PDX form controls (`pp-button`, `pp-checkbox`, `pp-radio-button`, `pp-input`, `pp-textarea`, `pp-select`, `pp-multiselect`, `pp-slide-toggle`, `pp-datepicker`, `pp-timepicker`, `pp-autocomplete`) take their visible text via a `label` input — **they do not project content**. `<pp-checkbox>Text</pp-checkbox>` and `<pp-button>Save</pp-button>` render with an empty label — the projected text is silently dropped. Always pass `label="..."` (or bind it: `[label]="'save' | translate"`), use a self-closing tag, and never wrap content. Add `id="..."` on `pp-checkbox` / `pp-radio-button` for `for`/`htmlFor` linkage. Exceptions: icon-only buttons (`pp-icon-button`, `pp-floating-action-button`) have no `label` input — identify them via `ariaLabel` instead; `pp-chip` falls back to `ng-content` when `label` is unset; `pp-button-toggle` takes its label via content projection (segmented-control children); `pp-badge` takes its text via content projection only (no `label` input); `pp-link` has a `label` input that falls back to displaying the `url` when unset; `pp-dialog` and `pp-tab` use content projection for **bodies**, not labels.

## Required / mandatory fields

Mark mandatory form fields with the **`required` input** — it renders the label asterisk (`*`) for you; never hardcode `*` into a label string. Available on `pp-input`, `pp-textarea`, `pp-autocomplete`, `pp-datepicker`, and `pp-timepicker`. It is **purely visual** — wire the actual validator (`Validators.required` / a Signal Forms `validate()` rule) on the bound control yourself. `pp-select`, `pp-multiselect`, `pp-checkbox`, `pp-radio-group`, and `pp-slide-toggle` have **no** `required` input (and no asterisk mechanism) — for a mandatory select, enforce via the validator and surface the error state (`isError` + `supportingText`).

## Row alignment with floating-label fields

Floating-label fields (`pp-input`, `pp-textarea`, `pp-select`, `pp-multiselect`, `pp-autocomplete`, `pp-datepicker`, `pp-timepicker`) reserve **top-only** space for the floated label whenever `label` is non-empty (`labelSpace` default `'auto'`; `0.5rem`, `pp-textarea` `0.75rem`). Siblings that reserve nothing — `pp-button`, `pp-icon-button`, `pp-chip`, static text — sit visibly higher in a plain flex row. This is intrinsic to floating labels (Angular Material hands the same problem to the consumer). Because the reservation is top-only, the fix is always the same — **apply it automatically whenever a floating-label field shares a row with a non-reserving sibling**:

- **Default: `align-items: flex-end`** on the row — bottom edges line up.

  ```html
  <div class="search-row">
    <pp-input label="Search" leadingIcon="pp-icon-search" size="sm" />
    <pp-button label="New" variant="filled" (click)="create()" />
  </div>
  ```

  ```scss
  .search-row {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
  }
  ```

- **Toolbars: `align-items: baseline`** — aligns the field's text baseline with the button label's baseline.
- **Escape hatch: `labelSpace="never"`** on the field — drops the reservation entirely. Only for fields without a label, or when the floated label may overflow into empty space above.

Caveats: `helperText` / `supportingText` extends the field **below** the control, so `flex-end` would align the sibling with the helper text — keep helper text off fields in mixed rows. For rows containing _only_ fields where some are label-less, set `labelSpace="always"` on the label-less ones instead (see [references/component-inventory.md](references/component-inventory.md)).

## Layout pitfalls (read before building forms)

PDX form primitives have hard sizing constraints that can clip or wrap content. Before composing a multi-column form or a many-button action bar, check the **Layout pitfalls** section under `@pdx/pp-form` in [references/component-inventory.md](references/component-inventory.md):

- `pp-form-block` has `min-width: 14.375rem` (230 px). Two blocks side by side need ≥ 508 px or the second wraps.
- `pp-form-actions` is a responsive `auto-fit` grid of `9.375rem` (150 px) tracks with `1rem` gap. Buttons wrap onto new rows when the container is narrower than `n × 150 px + gaps`. Alignment via `--left` / `--center` / `--right` / `--full-width` modifiers (default right). Exactly three projected buttons switch to a split layout automatically (first left, remaining two right). For other tightly-controlled multi-button bars, build a custom flex action bar instead.
- No nested `<header>` inside `pp-form` — `pp-form-section` already renders one. Two `<header>` descendants on the page = duplicate banner landmarks = axe violation. Use `<div>` for visual section headers inside the form.

Width control for `pp-input` / `pp-textarea` is **context-aware**: use `[fullWidth]="true"` only inside a `pp-form-block` / column layout that should fill its column. For standalone inputs (toolbars, narrow filters, inline search), pick `size="sm"` or `size="lg"` instead.

## Available PDX Libraries

| Package                      | What it provides                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pdx/pp-theme`              | Colors, typography (AkkuratStd), spacing tokens, Material 3 theme, TailwindCSS integration                                                                                   |
| `@pdx/pp-icons`              | SVG icon webfont (`pp-icon pp-icon-*`)                                                                                                                                       |
| `@pdx/pp-button`             | `PPButtonComponent`, `PPIconButtonComponent`, `PPFloatingActionButtonComponent`                                                                                              |
| `@pdx/pp-input`              | `PPInputComponent`, `PPTextareaComponent`                                                                                                                                    |
| `@pdx/pp-form`               | `PPFormComponent`, `PPFormSectionComponent`, `PPFormStackComponent`, `PPFormBlockComponent`, `PPFormTextblockComponent`, `PPFormActionsComponent` (structural form scaffold) |
| `@pdx/pp-checkbox`           | `PPCheckboxComponent` (boolean form value, separate `indeterminate` model, ControlValueAccessor)                                                                             |
| `@pdx/pp-radio`              | `PPRadioButtonComponent`, `PPRadioGroupComponent`                                                                                                                            |
| `@pdx/pp-chip`               | `PPChipComponent`, `PPChipListComponent`                                                                                                                                     |
| `@pdx/pp-dialog`             | `PPDialogComponent` (shell for MatDialog)                                                                                                                                    |
| `@pdx/pp-select`             | `PPSelectComponent`, `PPMultiselectComponent` (single/multi dropdown)                                                                                                        |
| `@pdx/pp-menu`               | `PPMenuComponent`, `PPMenuMultiselectComponent` (standalone dropdown menus)                                                                                                  |
| `@pdx/pp-list`               | `PPListComponent` (listbox with `default`/`single`/`singleRadio`/`multi` variants)                                                                                           |
| `@pdx/pp-tab`                | `PPTabGroupComponent`, `PPTabComponent`, `PPTabContentDirective`                                                                                                             |
| `@pdx/pp-expansion-panel`    | `PPExpansionPanelComponent`, `PPExpansionPanelItemComponent` (collapsible sections, optional accordion)                                                                      |
| `@pdx/pp-tree`               | `PPTreeComponent` (hierarchical data, drag-and-drop, sorting)                                                                                                                |
| `@pdx/pp-sidenav`            | `PPSidenavComponent` + item/group/sub-item (app-shell side navigation)                                                                                                       |
| `@pdx/pp-top-navigation`     | `PPTopNavigationComponent` (app-shell top navigation with dropdown submenus)                                                                                                 |
| `@pdx/pp-button-toggle`      | `PPButtonToggleComponent`, `PPButtonToggleGroupComponent` (segmented control / view-mode toggle)                                                                             |
| `@pdx/pp-slide-toggle`       | `PPSlideToggleComponent` (on/off switch with optional label, ControlValueAccessor)                                                                                           |
| `@pdx/pp-slider`             | `PPSliderComponent`, `PPRangeSliderComponent` (numeric value / interval sliders with value labels above the handles, optional synced `pp-select` inputs, CVA)                |
| `@pdx/pp-paginator`          | `PPPaginatorComponent` (page navigation + page-size selector)                                                                                                                |
| `@pdx/pp-datepicker`         | `PPDatepickerComponent` (single / range / month-year date picker, CDK overlay)                                                                                               |
| `@pdx/pp-toolbar`            | `PPToolbarComponent` (app-shell desktop toolbar — station-select + logout), `PPToolbarMobileComponent` (mobile page header — back + title + actions + notifications)         |
| `@pdx/pp-autocomplete`       | `PPAutocompleteComponent` (free-text combobox with filtered suggestions)                                                                                                     |
| `@pdx/pp-timepicker`         | `PPTimepickerComponent` (24h HH:mm time picker — desktop overlay / mobile bottom-sheet)                                                                                      |
| `@pdx/pp-tooltip`            | `PPTooltipComponent` (minimal / basic / extended tooltip)                                                                                                                    |
| `@pdx/pp-inline-message`     | `PPInlineMessageComponent` (persistent inline status message — info / success / warning / error)                                                                             |
| `@pdx/pp-progress-indicator` | `PPProgressIndicatorComponent` (linear / circular, determinate / indeterminate)                                                                                              |
| `@pdx/pp-table`              | `PPTableComponent` (+ column / row sub-components — sortable, paginated, expandable data table)                                                                              |
| `@pdx/pp-link`               | `PPLinkComponent` (styled text link with optional leading icon and trailing arrow)                                                                                           |
| `@pdx/pp-badge`              | `PPBadgeComponent` (status/label pill, 11 colors), `PPNotificationBadgeComponent` (count bubble / dot, caps at 999+)                                                         |
| `@pdx/pp-snackbar`           | `PPSnackbarService` + `provideSnackbar` (queued transient notifications with undo / action buttons — replaces `MatSnackBar`)                                                 |

## Component Replacement Rules

Replace Angular Material components with PDX equivalents:

| Instead of                                           | Use                                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `mat-button`, `mat-raised-button`, `mat-flat-button` | `PPButtonComponent`                                                                       |
| `mat-icon-button`                                    | `PPIconButtonComponent`                                                                   |
| `mat-fab`, `mat-mini-fab`                            | `PPFloatingActionButtonComponent`                                                         |
| `mat-form-field` + `matInput`                        | `PPInputComponent`                                                                        |
| `mat-form-field` + `<textarea matInput>`             | `PPTextareaComponent`                                                                     |
| `mat-checkbox`                                       | `PPCheckboxComponent`                                                                     |
| `mat-radio-button` / `mat-radio-group`               | `PPRadioButtonComponent` / `PPRadioGroupComponent`                                        |
| `mat-chip` / `mat-chip-set`                          | `PPChipComponent` / `PPChipListComponent`                                                 |
| Custom dialog templates                              | `PPDialogComponent` (still opened via `MatDialog` service)                                |
| `mat-tree`                                           | `PPTreeComponent`                                                                         |
| `mat-select`                                         | `PPSelectComponent`                                                                       |
| `mat-select` (multiple)                              | `PPMultiselectComponent`                                                                  |
| `mat-menu`                                           | `PPMenuComponent` / `PPMenuMultiselectComponent`                                          |
| `mat-tab-group` + `mat-tab`                          | `PPTabGroupComponent` + `PPTabComponent`                                                  |
| `mat-selection-list` / `mat-list`                    | `PPListComponent`                                                                         |
| `mat-expansion-panel`                                | `PPExpansionPanelComponent` + `PPExpansionPanelItemComponent`                             |
| Custom form layout divs / ad-hoc Flex/Grid shells    | `PPFormComponent` (+ section / stack / block / textblock / actions)                       |
| `mat-icon`, FontAwesome                              | `<span class="pp-icon pp-icon-*">`                                                        |
| `mat-button-toggle` / `mat-button-toggle-group`      | `PPButtonToggleComponent` / `PPButtonToggleGroupComponent`                                |
| `mat-slide-toggle`                                   | `PPSlideToggleComponent`                                                                  |
| `mat-slider` (single / `<input matSliderThumb>` ×2)  | `PPSliderComponent` / `PPRangeSliderComponent` (`@pdx/pp-slider`)                         |
| `mat-paginator`                                      | `PPPaginatorComponent`                                                                    |
| `mat-datepicker` / `mat-date-range-picker`           | `PPDatepickerComponent` (`type="single" \| "range" \| "month-year"`)                      |
| `mat-autocomplete`                                   | `PPAutocompleteComponent`                                                                 |
| `mat-tooltip`                                        | `PPTooltipComponent`                                                                      |
| `mat-progress-bar`, `mat-progress-spinner`           | `PPProgressIndicatorComponent`                                                            |
| `mat-table`                                          | `PPTableComponent` (+ column / row sub-components)                                        |
| `<input type="time">` / custom time inputs           | `PPTimepickerComponent`                                                                   |
| Custom inline alert / banner markup                  | `PPInlineMessageComponent`                                                                |
| `MatSnackBar` / `mat-snackbar`                       | `PPSnackbarService` (`@pdx/pp-snackbar`, opened via service — see component-inventory.md) |
| Plain `<a>` styled as a link / custom link styles    | `PPLinkComponent`                                                                         |
| Custom status pills / count bubbles                  | `PPBadgeComponent` / `PPNotificationBadgeComponent`                                       |

**No PDX replacement yet** — use Angular Material with pp-theme: sort, `mat-toolbar` (generic container use only).

## Navigation (app-shell only — not a drop-in replacement)

`@pdx/pp-sidenav`, `@pdx/pp-top-navigation`, and `@pdx/pp-toolbar` (both `PPToolbarComponent` and `PPToolbarMobileComponent`) are **design decisions**, not generic Material swaps. Apply them only when:

1. **A navigation concern is actually present.** The user (or the design) explicitly calls for app-level navigation: a top bar that switches between sections of the app, or a side menu of app areas with nested sub-items. Screenshots showing a bar along the top or a column on the left do **not** automatically imply nav — they may be page headers, inspector panes, filter drawers, etc.
2. **You are working at the app-shell level.** The component owning the `<router-outlet>` (or a top-level shell component that hosts the outlet). Feature components routed _into_ the shell do not own navigation.
3. **Existing app-shell markup is being introduced or redesigned.** If the app already has a shell without these, do not swap it out unless asked.

When these conditions are not met, **do not reach for `pp-sidenav`, `pp-top-navigation`, or `pp-toolbar`.** Specifically:

- A drawer (filters, inspector, document outline) that isn't app-shell navigation → use `pp-sidenav` with `variant="panel-only"` (single-panel sub-navigation, no rail or emblem). The `'app-shell'` variant is still off-limits here.
- `mat-toolbar` used as a page header, dialog header, or action bar → keep `mat-toolbar`. `pp-toolbar` / `pp-toolbar-mobile` are **shell chrome**, not generic page headers.
- A static in-page menu or tab-like switcher inside one feature → use `pp-tab-group`, `pp-menu`, or plain buttons.
- Feature components routed _into_ the app shell (e.g. converted legacy forms, dialog bodies) → never own navigation, even if the legacy source had a top toolbar or a left tree.

When the conditions **are** met, use the full component family: `PPSidenavComponent` with `PPSidenavItemComponent` + `PPSidenavGroupComponent` + `PPSidenavSubItemComponent`; `PPTopNavigationComponent` with a `PPTopNavItem[]` array; `PPToolbarComponent` (station-select + logout) for the desktop shell, and `PPToolbarMobileComponent` (back + title + actions + notifications) for the mobile shell — render one or the other based on the host's breakpoint logic, never both. See [component-inventory.md](references/component-inventory.md) for APIs.

## Workflow

### Step 1: Verify theme setup

Ensure the project imports PDX theme and icons globally. Consult **[references/theme-setup.md](references/theme-setup.md)** for installation and configuration details.

### Step 2: Audit existing components

Scan the target code for Angular Material component usage. For each one, check the replacement table above. Replace every component that has a PDX equivalent.

### Step 3: Apply styling rules

Follow PDX design guidelines for all styling decisions. Key rules:

- **Units:** `rem` only, never `px` (except `1px` borders)
- **Colors:** Design tokens only (`$pp-primary`, `$pp-secondary-*`, `$pp-error`, etc.) — never raw hex/RGB
- **Typography:** AkkuratStd, use the defined type scale — no custom font sizes
- **Spacing:** Use the token scale: `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`
- **Corner radius:** `full` for controls, `0.5rem` for cards/containers, `1rem` for dialogs (desktop)
- **Shadows:** Only for floating elements (FAB, modals, dropdowns). Use surface color and borders for separation.
- **Icons:** `@pdx/pp-icons` only — no other icon libraries
- **Page layout:** Max-width `75rem`, start-aligned. Background `$pp-secondary-980`, cards `$pp-secondary-990` with `1px` border `$pp-secondary-900`. (Scale tops at `990` — lightest. Use `var(--pp-secondary-990)` etc. in CSS, `$pp-secondary-990` in SCSS.)

For the complete guidelines, consult **[references/design-guidelines.md](references/design-guidelines.md)**.

### Step 4: Check component APIs

For detailed component inputs, outputs, models, and usage examples, consult **[references/component-inventory.md](references/component-inventory.md)**.

### Step 5: Consult Figma for visual details

When Figma MCP tools are available, fetch component documentation from the PDX Figma file:

- **File key:** `ivVuByHDDqZe9QjPIuuuMC`
- Use `get_design_context` or `get_screenshot` for specific component pages
- Each component page in Figma includes its own documentation section covering variants, states, structure, and interactions

### Step 6: Validate

- Confirm all PDX-available components are used instead of Angular Material
- Confirm no `px` units (except `1px` borders)
- Confirm no raw color values
- Confirm icon usage is `pp-icon` only
- Run lint and tests if available

## Important Notes

- **Libraries are under active development.** The component inventory in this skill is a snapshot. Before relying on a specific component API, verify against the actual PDX source repo.
- **PDX source repo:** `Shared Components / pdx` on Azure DevOps. Each component lives under `libs/<package>/src/lib/...`. Component inputs are declared with `input()` / `model()` in the `*.component.ts`; templates show how `icon` / class inputs are consumed. Color tokens are emitted from `libs/pp-theme/css/color/colors.css` (CSS custom properties `--pp-*`) and `libs/pp-theme/scss/color/colors.scss` (SCSS variables `$pp-*`).
- **Dark mode:** `@pdx/pp-theme` does not currently ship a dark-mode color scheme. There are no `[data-theme="dark"]` selectors or `prefers-color-scheme` media queries in the theme. If a project needs dark mode, expect to define alternate tokens locally.

## Reference Files

- **[references/design-guidelines.md](references/design-guidelines.md)** — Complete visual and structural standards: units, spacing, typography, colors, corner radius, shadows, elevation, inputs, buttons, dialogs, forms, chips, tables, page layout, responsive breakpoints, z-index, transitions, icons, accessibility, do's and don'ts.
- **[references/component-inventory.md](references/component-inventory.md)** — Full API reference for all PDX libraries: component inputs/outputs, models, usage examples, peer dependencies, and the component replacement map.
- **[references/theme-setup.md](references/theme-setup.md)** — Installation, global style imports, color token usage (SCSS/CSS/Tailwind), typography setup, icon usage, component integration, forms, dialogs, and page layout patterns.
