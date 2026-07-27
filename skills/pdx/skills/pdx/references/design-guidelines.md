# PDX Frontend Design Guidelines

These guidelines define the visual and structural standards for all frontend work. They ensure consistency across the product and reduce ambiguity during implementation.

Use all components from the **PDX (POLYPOINT Design Experience)** design system. When in doubt, refer to PDX as the source of truth for component behavior and appearance. Each component page in Figma includes its own documentation section covering variants, states, structure, and interactions.

> **Figma source:** [PDX — POLYPOINT Design Experience](https://www.figma.com/design/ivVuByHDDqZe9QjPIuuuMC/00-PDX--Polypoint-Design-Experience--)

---

## Units

Use `rem` everywhere. Never use `px` in component or layout styles.

Base font size is `1rem` (16px equivalent at default browser settings). Common conversions for reference:

| Value | rem      |
| ----- | -------- |
| 2px   | 0.125rem |
| 4px   | 0.25rem  |
| 8px   | 0.5rem   |
| 10px  | 0.625rem |
| 12px  | 0.75rem  |
| 14px  | 0.875rem |
| 16px  | 1rem     |
| 20px  | 1.25rem  |
| 24px  | 1.5rem   |
| 32px  | 2rem     |
| 36px  | 2.25rem  |
| 40px  | 2.5rem   |

> **Note on borders:** A `1px` border may be acceptable as the only exception, since sub-pixel rendering of `0.0625rem` can produce inconsistent results across browsers. If your team prefers strict rem-only, use `0.0625rem` and test across target browsers.

---

## Spacing

Use consistent spacing tokens derived from a base scale: `0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`. Use whitespace intentionally to group related items and separate unrelated ones. Equal spacing between sibling items within the same section. Spacing is defined in the design system and should not be adjusted on a per-component basis.

---

## Typography

The typeface is **AkkuratStd**. The type scale follows Material 3 naming and maps to HTML elements as follows:

| HTML element  | Material 3 style | Figma variable name      | Weight  | Size     | Line height |
| ------------- | ---------------- | ------------------------ | ------- | -------- | ----------- |
| `h1`          | headline-large   | Headline/Headline Large  | Bold    | 2.25rem  | 2.75rem     |
| `h2`          | headline-medium  | Headline/Headline Medium | Bold    | 1.5rem   | 2rem        |
| `h3`          | headline-small   | Headline/Headline Small  | Bold    | 1.25rem  | 1.75rem     |
| `h4`          | title-large      | Title/Title Large        | Bold    | 1rem     | 1.375rem    |
| `h5`          | title-medium     | Title/Title Medium       | Bold    | 0.875rem | 1.25rem     |
| `h6`          | title-small      | Title/Title Small        | Bold    | 0.75rem  | 1.125rem    |
| `p` (large)   | body-large       | Body/Body Large          | Regular | 1rem     | 1.375rem    |
| `p`           | body-medium      | Body/Body Medium         | Regular | 0.875rem | 1.25rem     |
| `p` (small)   | body-small       | Body/Body Small          | Regular | 0.75rem  | 1rem        |
| `p` (x-small) | body-extra-small | Body/Body Extra Small    | Regular | 0.625rem | 0.75rem     |
| `label`       | label-large      | Label/Label Large        | Regular | 0.75rem  | 1rem        |

Do not introduce custom font sizes outside the scale unless explicitly approved. Always use the Figma variable name or Material 3 style token when referencing a type style.

---

## Color System

PDX defines a structured color system. Always use design tokens — never raw hex or RGB values in component styles.

**Main colors:** Primary, Secondary, Tertiary (+ SystemcolorUI). Each palette emits an unsuffixed base token plus discrete shade keys: `50, 100, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 920, 940, 950, 960, 980, 990` (`50` darkest → `990` lightest). There is **no** `1000` shade — `990` is the lightest. SCSS variables: `$pp-<palette>` (base) + `$pp-<palette>-<shade>`. CSS custom properties: `--pp-<palette>` + `--pp-<palette>-<shade>` for the raw tokens; the Tailwind theme layer additionally exposes a `--color-pp-<palette>` alias for each (what `text-pp-*` / `bg-pp-*` resolve to).

**Status colors:** Error, Success, Info, Warning, Disabled.

**Accent colors:** Orange, Purple, DarkBlue, Blue, LightBlue, Linth green, Green, Yellow.

**Color roles in use:**

- **Maincolors** — for primary UI elements and branding
- **Surface** — for background surfaces (Surface Primary, Surface Secondary)
- **Shades** — surface shade variants for layering (Surface Primary shade097, etc.)
- **Status Colors** — for feedback and state indication
- **Surface Status** — background surfaces for status contexts (Surface Error, Surface Warning, etc.)
- **Accent Colors** — for categorization, tags, or visual differentiation
- **Surface Accent** — background surfaces for accent contexts

Prefer semantic tokens (e.g. `primary`, `error`, `mint`) over raw palette tokens (e.g. `blue-500`) to support theming. Ensure sufficient contrast ratios: at minimum WCAG AA (4.5:1 for normal text, 3:1 for large text and UI components).

---

## Corner Radius

Corner radius is defined systematically and follows the function and form of each element. There are four radius categories:

| Radius       | Usage                                                                               |
| ------------ | ----------------------------------------------------------------------------------- |
| `full` (50%) | Badges, round buttons, button toggles, chips, inputs, selects, slide toggles        |
| `1rem`       | Modals, dialogs — desktop only. Smaller content areas with clear visual separation. |
| `0.5rem`     | Cards, date pickers, inline messages, snackbars, tables, tooltips                   |
| `0.125rem`   | Checkboxes                                                                          |

> Principle: Compact interactive controls use `full` radius to be clearly identifiable as controls. Containers and content surfaces use `0.5rem`. Overlays that break out of the layout use `1rem` (desktop).

---

## Shadows & Elevation

Shadows are a **semantic signal for elevation**, not a decorative tool. A shadow means: this element sits visually above the rest of the layout. PDX defines 5 elevation levels (visible in the Elevation section of the Color-Styles page).

**Allowed use cases:**

- Floating action buttons (FAB)
- Floating overlays, modals, and popovers
- Dropdowns that break out of the normal document flow

**Not allowed:**

- Decoration or visual flair
- Separating normal containers
- Replacing spacing, color, or structural hierarchy

**Alternative to shadows:** Elements that previously relied on shadows for separation should now use surface color, contrast, and borders instead.

- Page background: `$pp-secondary-980` (light gray)
- Element surface: `$pp-secondary-990` (lightest, near-white) — or `$pp-white` for pure white
- Border: `1px` solid `$pp-secondary-900`

> Principle: Differentiate through surface, contrast, and borders — not through elevation.

---

## Inputs & Selects

- Max height: `2.5rem`
- Always use a visible stroke (border). No background fill, except in the disabled state.
- Corner radius: `full`
- **Floating label:** The label sits inside the field as a placeholder when empty. On focus or when filled, the label floats above the input at a smaller size. This is a single unified style — there are no variant options.
- Two sizes: **Large (LG)** for standard desktop forms, **Small (SM)** for compact/dense contexts like table cells and filters.
- Structure: label, input area, optional leading icon, optional supporting/validation text, optional required indicator (`*`), optional field status icon or tooltip.
- States: Default, Hovered, Focused, Error, Disabled, Read-only.
- The label should clearly describe the expected input.

### Select-specific rules

- Use `PPSelectComponent` (`@pdx/pp-select`) for single-selection dropdowns and `PPMultiselectComponent` for multi-selection. These replace `mat-select`.
- **Floating label:** When no value is selected, the label sits centered inside the trigger. When a value is selected, the label floats to the top at a smaller size — same behavior as text inputs.
- **Multiselect display:** Selected values are shown as a comma-separated string with ellipsis overflow. The dropdown stays open during selection to allow toggling multiple items.
- **Supporting text:** Optional helper text appears below the trigger. When `isError` is true, both the border and supporting text render in the error color.
- **Leading icon:** Optional, applied to the trigger and passed through to each dropdown item.
- Options use the `PPMenuItem` interface: `{ id, label, supportingText?, disabled?, icon?, hasDivider? }`. The `supportingText` field provides secondary text on each dropdown option.
- For form-integrated dropdowns (with label, floating label, ControlValueAccessor), use `pp-select` — not `pp-menu` directly. `pp-select` composes `pp-menu` internally.
- `pp-menu` is a standalone component in its own right — use it anywhere `mat-menu` would be used: action menus, context menus, three-dot overflow menus (e.g. the `moreMenu` slot in `pp-tree`), or any custom dropdown that is not a form field.

---

## Textareas

Textareas should fill the available width **when the layout calls for it** — for example inside dialogs or narrow content panels where the textarea is the primary input. In wider page layouts or multi-column forms, size the textarea to match the expected content length rather than stretching it edge-to-edge.

---

## Sliders

Use `PPSliderComponent` / `PPRangeSliderComponent` (`@pdx/pp-slider`) for bounded numeric values and intervals. These replace `mat-slider`.

- Use sliders **only for small predefined ranges** — a large or unbounded numeric entry stays an input or select.
- The current value renders permanently above the handle (no hover tooltip); an optional unit line sits below it.
- When precise entry matters, enable the synced `pp-select` via `maxLabelSelect` / `minLabelSelect` instead of adding a separate input.
- Every handle needs an accessible name (`ariaLabel` or `ariaLabelledby`).

---

## Tabs

Use `PPTabGroupComponent` + `PPTabComponent` (`@pdx/pp-tab`) for all tabbed navigation. These replace `mat-tab-group` + `mat-tab`.

- Text size: `1rem`
- Selected tab text color: `$pp-primary` (mint/teal)
- Unselected tab text color: `$pp-secondary-300`
- Disabled tab text color: `$pp-secondary`
- Active indicator: 2px bar in `$pp-primary` that slides beneath the active tab with a smooth transition
- Tabs support optional leading icons (e.g. `pp-icon-dashboard`)
- Use `fullWidth` when tabs should stretch to fill the container equally
- Two content strategies:
  - **Tab-managed:** Use `ppTabContent` directive on `<ng-template>` inside each tab — the group renders the active panel automatically
  - **Consumer-managed:** Omit `ppTabContent` and use two-way `[(selectedIndex)]` binding with `@switch` for custom content rendering
- Keyboard navigation: Arrow keys to move between tabs, Home/End to jump to first/last, Enter/Space to activate
- States: Enabled, Hovered, Focused, Pressed, Disabled

---

## Menus & Dropdowns

- Use `PPMenuComponent` (`@pdx/pp-menu`) as the PDX replacement for `mat-menu`. Suitable for action menus, context menus, three-dot overflow menus, and any dropdown list that is not a form select field.
- Use `PPMenuMultiselectComponent` for multi-select dropdown lists with leading checkboxes.
- `pp-menu` is presentational — the parent must control `[isOpen]` and handle closing (outside click, Escape, selection). This makes it composable in different trigger patterns (icon button, three-dot button, custom trigger).
- For form-integrated dropdowns (label, floating label, validation, `ControlValueAccessor`), use `pp-select` instead — it wraps `pp-menu` with full form field behavior.
- Menu items follow the `PPMenuItem` interface: `{ id, label, supportingText?, disabled?, icon?, hasDivider? }`
- Two sizes: `'large'` (default) and `'small'` for compact contexts
- Items can display an optional leading icon

---

## Buttons

PDX buttons come in four variants with specific visual weight:

| Variant      | Purpose                                                       |
| ------------ | ------------------------------------------------------------- |
| **Filled**   | Most important action in a view. Visually the most prominent. |
| **Outlined** | Secondary actions. Less visual weight than filled.            |
| **Text**     | Lowest visual emphasis. For less prominent actions.           |
| **Tonal**    | Alternative emphasis. For special or thematic contexts.       |

**Sizes:** SM (compact layouts, toolbars), MD (forms, dialogs, standard UI), LG (desktop, prominent actions, spacious layouts).

**Structure:** Optional leading icon, text label, optional trailing icon. The label describes the action and should be short, clear, and action-oriented (e.g. "Save", "Delete", "Confirm").

**Rules:**

- Minimum width for action buttons: `9.375rem`
- Spacing between adjacent buttons: `0.5rem`
- Use only one primary (filled) button per view to highlight the most important action.
- If there is only one button in an action bar, use the **filled** style.
- Use clear, action-oriented labels. Avoid long button labels.

**States:** Enabled, Hovered, Focused, Pressed, Disabled. All states must provide consistent visual feedback.

**Interactions:** Click triggers the action. Hover provides visual feedback. Focus via keyboard shows a visible focus state. Enter or Space triggers the action.

---

## Dialogs

Dialogs are modal windows that appear above the application content. They interrupt the current workflow and should only be used when an action or confirmation is required.

**When to use:** Confirmation prompts, forms with a few fields, hints/warnings, selection decisions. Do not use dialogs for longer content or complex workflows — use a dedicated page instead.

**Structure:**

- **Header:** Dialog title + close (X) button in the top-right corner of the title bar. Every dialog must have a close button.
- **Content:** Explanatory text, optional components (forms, hints, lists). The content area is scrollable for longer content.
- **Actions:** Primary action (e.g. "OK", "Save") + optional secondary action (e.g. "Cancel").

**Behavior:**

- Opened by a user action (button click, menu entry).
- Background is covered by a semi-transparent dark overlay (30% black).
- Focus is trapped within the dialog. Background content cannot be interacted with.
- Closing: via action button, close icon, clicking outside (overlay), or pressing Escape.

**Responsiveness:**

| Property       | Desktop    | Mobile    |
| -------------- | ---------- | --------- |
| Position       | Centered   | Centered  |
| Min width      | `36.25rem` | `20rem`   |
| Max width      | `64rem`    | `22.5rem` |
| Corner radius  | `1rem`     | `0.25rem` |
| Content scroll | Yes        | Yes       |

**Action buttons in dialogs** must be full-width so they scale with the dialog container.

**Input layout inside dialogs:**

- Inputs that accept 48 characters or fewer may be placed two per row.
- Inputs that accept more than 48 characters must be placed on their own row (full width).
- The first input in a dialog must not have its top border clipped by the dialog's content overflow. Ensure sufficient top padding or offset.

**Dialog pattern for tables:**

- Do not place form inputs and action buttons above a table.
- Place an "Add" button above the table.
- Each table row gets inline icon buttons (edit, delete) where applicable.
- Clicking edit or add opens a **separate form dialog** for the inputs.
- The bottom action bar of a table dialog has only a "Close" button (filled style).

---

## Forms

Forms are not a single component but a flexible composition of multiple elements arranged within a structured layout. They are built from reusable input fields combined with clear structure and consistent interaction patterns.

**Structure:** A form can include a title, description text, tabs, input fields, dropdowns, checkboxes, toggles, chips, buttons, and more. The structure depends on the specific use case.

**Layout:**

- Forms are based on a flexible grid system.
- They can be structured in one, two, or multiple columns, and extended to 3-4 columns if needed.
- The layout depends on the content and available space.
- Fields should be consistently aligned and logically grouped.

**Form sections:**

- Sections are optional and can visually separate groups of fields (e.g. with a border or container).
- Sections can have 1, 2, or 3 columns.
- They help introduce clarity in more complex forms.
- Optionally, a button can be placed below a section (e.g. "Add another section") to dynamically extend the content.

**Placement:** Forms can appear directly within page content, inside a dialog or modal, or within a table or other container.

**Spacing:** Use consistent spacing between fields and groups. Ensure clear separation between sections. Maintain sufficient vertical spacing for readability. Group related fields more closely than unrelated ones (visual hierarchy).

**Guidelines:**

- Group fields logically and cluster related content.
- Use sections when needed, especially for longer forms.
- Avoid unnecessary fields — reduce complexity.
- Use a single column for simple forms, multiple columns for denser content.
- Apply consistent spacing and clear alignment.
- Use consistent patterns across the application.

> **Layout pitfalls:** before building a multi-column or many-button form, see the **Layout pitfalls** section under `@pdx/pp-form` in [component-inventory.md](component-inventory.md) — `pp-form-block` has a 230 px min-width (so two side-by-side blocks need ≥ 508 px), `pp-form-actions` is a responsive `auto-fit` grid of 150 px tracks (so adjacent buttons wrap at narrow widths and tightly-controlled bars need a custom flex layout), and nested `<header>` elements inside `pp-form` produce duplicate-banner a11y violations.

---

## Chips

Chips represent small pieces of information, attributes, or selections. They help users quickly identify, filter, or remove items.

**Variants:**

- **Leading icon + remove icon** — when the chip represents a recognizable item or category
- **Remove icon only** — for filters, tags, or selected values
- **Leading icon only** — for representing items/statuses without interaction
- **Plain text** — for passive information or non-removable attributes

**Structure:** Label, optional leading icon, optional remove icon (action). Labels should be short and clearly describe the represented item.

**States:** Enabled, Hovered, Focused, Pressed, Disabled.

**Interactions:** Click remove icon to remove the chip. Focus via keyboard shows a visible focus state. Enter or Space triggers the chip action when focused.

---

## Tables

- Use `fixed` table layout to prevent horizontal scrollbars.
- When text is truncated with an ellipsis, always provide a tooltip showing the full text. This applies to both column headers and data cells.

---

## Page Layout

- Main content area should have a max-width of `75rem`, aligned to the start of the page (not centered).
- This is the **default** pattern for standard content pages. Other layouts (dashboards, full-bleed views, split panes, data-heavy screens) may deviate when the content requires it. Document exceptions when they arise.
- Page background: `$pp-secondary-980`
- Content cards and panels: `$pp-secondary-990` with `1px` border in `$pp-secondary-900`

---

## Responsive Breakpoints

PDX defines layout breakpoints for responsive behavior (visible in the Examples page of the Figma file).

| Name        | Range       |
| ----------- | ----------- |
| Compact     | < 600px     |
| Medium      | 600-904px   |
| Expanded    | 905-1239px  |
| Large       | 1240-1439px |
| Extra large | >= 1440px   |

Design mobile-first where applicable. Components should adapt gracefully: dialog inputs that sit two per row on desktop should stack on narrow viewports.

---

## Z-Index Scale

Use a defined z-index scale to avoid conflicts and magic numbers:

| Layer             | z-index |
| ----------------- | ------- |
| Base content      | 0       |
| Sticky headers    | 100     |
| Dropdowns         | 200     |
| Modals / Overlays | 300     |
| Tooltips          | 400     |
| Toast / Snackbar  | 500     |

Never use arbitrary z-index values. If a new layer is needed, extend the scale.

---

## Transitions & Motion

- Use subtle transitions for interactive state changes (hover, focus, expand/collapse): `150ms-200ms` ease-out.
- Avoid decorative animations that do not support comprehension or feedback.
- Respect `prefers-reduced-motion`. Disable non-essential animations when the user has this preference enabled.

---

## Icons

- Use the icon set provided by PDX (`@pdx/pp-icons`). Do not introduce icons from other libraries without approval.
- Minimum touch target for icon-only buttons: `2.5rem x 2.5rem`.

---

## Accessibility

- All interactive elements must be keyboard-navigable.
- Use semantic HTML elements (`button`, `a`, `input`, `dialog`, etc.) rather than styled `div`s with click handlers.
- Provide visible focus indicators on all focusable elements. Do not remove default focus outlines without replacing them.
- Icons used as the sole interactive element (e.g. icon-only buttons) must have an accessible label (`aria-label` or `sr-only` text).
- Ensure form inputs are associated with labels (`<label for="...">` or `aria-labelledby`).
- All button, input, and chip states (Enabled, Hovered, Focused, Pressed, Disabled) must be visually distinguishable and perceivable.

---

## Do's and Don'ts (Quick Reference)

**Do:**

- Use PDX components and tokens for everything.
- Use whitespace and borders to create hierarchy.
- Keep interactive elements large enough for comfortable use (`2.5rem` minimum height).
- Provide tooltips for truncated content.
- Use one primary (filled) button per view.
- Use clear, short, action-oriented button labels.
- Group related form fields logically.
- Refer to the PDX Figma documentation page for each component before implementing.

**Don't:**

- Use `px` in styles (with the narrow border exception noted above).
- Use shadows for decoration.
- Use raw color values instead of tokens.
- Place form controls above tables inside dialogs.
- Remove focus indicators.
- Introduce custom font sizes, icon sets, or colors outside PDX.
- Use dialogs for complex or long-form workflows.
