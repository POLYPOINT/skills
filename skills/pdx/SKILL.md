---
name: pdx
description: This skill should be used when the user asks to "apply PDX styles", "use PDX libs", "use PDX styling", "make it look like POLYPOINT", "apply POLYPOINT styling", "use POLYPOINT libs", "use POLYPOINT components", "apply pdx", or mentions the POLYPOINT Design Experience design system. Guides usage of @pdx/* Angular component libraries and design tokens to produce UI consistent with the PDX design system.
metadata:
  version: "1.1.0"
---

# PDX — POLYPOINT Design Experience

Apply the PDX design system to Angular frontends. PDX provides reusable Angular component libraries (`@pdx/*`), design tokens, icons, and layout guidelines that ensure a consistent POLYPOINT look and feel.

## Core Principle

**When a PDX component exists, always use it instead of Angular Material or custom implementations.** Only fall back to Angular Material (with PDX theme applied) for components that do not yet have a PDX equivalent.

## Available PDX Libraries

| Package            | What it provides                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `@pdx/pp-theme`    | Colors, typography (AkkuratStd), spacing tokens, Material 3 theme, TailwindCSS integration |
| `@pdx/pp-icons`    | SVG icon webfont (`pp-icon pp-icon-*`)                                                     |
| `@pdx/pp-button`   | `PPButtonComponent`, `PPIconButtonComponent`, `PPFloatingActionButtonComponent`            |
| `@pdx/pp-input`    | `PPInputComponent`, `PPTextareaComponent`                                                  |
| `@pdx/pp-checkbox` | `PPCheckboxComponent` (three-state, ControlValueAccessor)                                  |
| `@pdx/pp-radio`    | `PPRadioButtonComponent`, `PPRadioGroupComponent`                                          |
| `@pdx/pp-chip`     | `PPChipComponent`, `PPChipListComponent`                                                   |
| `@pdx/pp-dialog`   | `PPDialogComponent` (shell for MatDialog)                                                  |
| `@pdx/pp-select`   | `PPSelectComponent`, `PPMultiselectComponent` (single/multi dropdown)                      |
| `@pdx/pp-menu`     | `PPMenuComponent`, `PPMenuMultiselectComponent` (standalone dropdown menus)                |
| `@pdx/pp-tab`      | `PPTabGroupComponent`, `PPTabComponent`, `PPTabContentDirective`                           |
| `@pdx/pp-tree`     | `PPTreeComponent` (hierarchical data, drag-and-drop, sorting)                              |

## Component Replacement Rules

Replace Angular Material components with PDX equivalents:

| Instead of                                           | Use                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `mat-button`, `mat-raised-button`, `mat-flat-button` | `PPButtonComponent`                                        |
| `mat-icon-button`                                    | `PPIconButtonComponent`                                    |
| `mat-fab`, `mat-mini-fab`                            | `PPFloatingActionButtonComponent`                          |
| `mat-form-field` + `matInput`                        | `PPInputComponent`                                         |
| `mat-form-field` + `<textarea matInput>`             | `PPTextareaComponent`                                      |
| `mat-checkbox`                                       | `PPCheckboxComponent`                                      |
| `mat-radio-button` / `mat-radio-group`               | `PPRadioButtonComponent` / `PPRadioGroupComponent`         |
| `mat-chip` / `mat-chip-set`                          | `PPChipComponent` / `PPChipListComponent`                  |
| Custom dialog templates                              | `PPDialogComponent` (still opened via `MatDialog` service) |
| `mat-tree`                                           | `PPTreeComponent`                                          |
| `mat-select`                                         | `PPSelectComponent`                                        |
| `mat-select` (multiple)                              | `PPMultiselectComponent`                                   |
| `mat-menu`                                           | `PPMenuComponent` / `PPMenuMultiselectComponent`           |
| `mat-tab-group` + `mat-tab`                          | `PPTabGroupComponent` + `PPTabComponent`                   |
| `mat-icon`, FontAwesome                              | `<span class="pp-icon pp-icon-*">`                         |

**No PDX replacement yet** — use Angular Material with pp-theme: autocomplete, datepicker, slide-toggle, progress bar/spinner, snackbar, tooltip, table, paginator, sort, sidenav, toolbar, expansion panel.

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
- **Page layout:** Max-width `75rem`, start-aligned. Background `secondary-shade990`, cards `secondary-shade1000` with `1px` border `secondary-shade900`

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

- **Libraries are under active development.** The component inventory in this skill is a snapshot. Before relying on a specific component API, verify against the actual PDX source repo to confirm inputs, outputs, and available features are up to date.
- **PDX source repo:** Available on Azure DevOps (`Shared Components / pdx`). Clone or browse via `az repos` CLI if the latest component source is needed.

## Reference Files

- **[references/design-guidelines.md](references/design-guidelines.md)** — Complete visual and structural standards: units, spacing, typography, colors, corner radius, shadows, elevation, inputs, buttons, dialogs, forms, chips, tables, page layout, responsive breakpoints, z-index, transitions, icons, accessibility, do's and don'ts.
- **[references/component-inventory.md](references/component-inventory.md)** — Full API reference for all PDX libraries: component inputs/outputs, models, usage examples, peer dependencies, and the component replacement map.
- **[references/theme-setup.md](references/theme-setup.md)** — Installation, global style imports, color token usage (SCSS/CSS/Tailwind), typography setup, icon usage, component integration, forms, dialogs, and page layout patterns.
