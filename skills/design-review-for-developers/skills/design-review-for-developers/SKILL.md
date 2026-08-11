---
name: design-review-for-developers
description: Performs a short, structured design review of design system components from a developer's perspective. Use whenever a developer wants a single component or small component group (button, input, card, dialog, etc.) checked against its Figma source — covering visual fidelity, states, accessibility, and implementation consistency. Not for full page or layout reviews.
metadata:
  version: '1.1.0'
---

# Design Review for Developers

Perform a short, focused review of a design system component implementation against its Figma source. Keep it tight — this is a component-level check, not a page review. Respond in the user's language.

## Scope

- Single component or small group of related components.
- Compare the implementation (code, screenshot, or rendered output) against the Figma design.
- Skip page-level concerns (grid, overall layout, content hierarchy across a screen).
- **A Figma link is required.** Always use the Figma MCP tool to fetch source values (spacing, tokens, typography, colors, icons). Do not guess. If no Figma link is provided, ask for one before starting the review.

## Review Dimensions

### 1. Visual Fidelity to Figma

- Do spacing, padding, and sizes match the Figma component?
- Do font size, weight, and line-height match?
- Do colors match (use design tokens, not hardcoded values)?
- Do icons match in size, color, and stroke?

### 2. Component States

- Are all states implemented: default, hover, focus, active, disabled, error/invalid, loading (where applicable)?
- Does each state visually match Figma?

### 3. Accessibility

- Are focus states clearly visible and keyboard-reachable?
- Are ARIA attributes correct (`aria-label`, `aria-describedby`, `role`, etc.)?
- Are labels or alt texts present for non-text content?
- Is the click/tap target large enough for comfortable use? WCAG 2.5.5 (Level AAA) is a common reference point (44×44 px). Where the design system defines its own minimum touch target, apply that value.

### 4. Implementation Consistency

- Are design tokens / variables used instead of magic numbers or hex codes?
- Are spacings and sizes consistent with neighboring components in the design system?
- Are interactive elements clearly identifiable as such?

## Output Format

### Summary

1–2 sentences. Overall verdict.

### Issues

List only what needs fixing. Prioritize: 🔴 critical → 🟡 should-fix → 🟢 nice-to-have.

### Suggestions

Short, actionable. Reference the dimension and, where possible, the exact token/value to use.

### Scorecard

| Dimension       | Rating     | Comment |
| --------------- | ---------- | ------- |
| Visual Fidelity | ⭐⭐⭐⭐⭐ | ...     |
| States          | ⭐⭐⭐⭐⭐ | ...     |
| Accessibility   | ⭐⭐⭐⭐⭐ | ...     |
| Implementation  | ⭐⭐⭐⭐⭐ | ...     |

## Notes

- Always fetch source values via the Figma MCP tool — never approximate from a screenshot alone.
- Ask once if unclear: which component, which framework (e.g. Angular), which design system?
- Keep the review short. A developer wants a quick checklist, not an essay.
- Where possible, point to the exact line, prop, or token to change.

---

## PDX (POLYPOINT) specifics

When the design system under review is **PDX (POLYPOINT Design Experience)**, apply the points
below in addition to the generic checklist. Every value here is taken from the PDX design
guidelines and component documentation — treat the PDX source repo (`Shared Components / pdx`)
and the `pdx` skill as the source of truth, and verify against them when in doubt.

### Companion skill — use it as the authority

The `pdx` skill ships the authoritative references; consult them rather than restating values here:

- **`pdx` skill — `references/design-guidelines.md`** — units, spacing, typography, color tokens,
  corner radius, shadows/elevation, inputs, buttons, dialogs, forms, tables, z-index, breakpoints,
  motion, accessibility.
- **`pdx` skill — `references/component-inventory.md`** — per-component inputs, outputs, models,
  and the Angular Material → PDX replacement map.

### Figma source

- **PDX Figma file key:** `ivVuByHDDqZe9QjPIuuuMC`
  (`https://www.figma.com/design/ivVuByHDDqZe9QjPIuuuMC/`).
- Each component page in the PDX Figma file has its own documentation section covering variants,
  states, structure, and interactions — review against that page, not a generic guess.

### Design tokens (what to check for in the implementation)

- **Colors:** design tokens only, never raw hex/RGB. SCSS `$pp-<palette>` / `$pp-<palette>-<shade>`;
  raw CSS custom properties `--pp-<palette>` / `--pp-<palette>-<shade>` (the Tailwind theme layer
  also exposes a `--color-pp-` alias for each, which is what `text-pp-*` / `bg-pp-*` resolve to);
  Tailwind utilities `text-pp-*`, `bg-pp-*`, `border-pp-*`. The shade scale is discrete
  (`50` darkest → `990` lightest); there is **no** `1000` shade.
- **Disabled states:** disabled text and icons must use the dedicated Disabled token —
  `$pp-disabled-500` / `--pp-disabled-500`. Flag disabled styling built with `opacity` or
  Secondary shades — a legacy (pre-PDX-107) pattern; PDX requires AA contrast even for
  disabled text, which those approaches miss.
- **Units:** `rem` everywhere; a `1px` border is the only accepted `px` exception.
- **Icons:** `@pdx/pp-icons` only, rendered as `<span class="pp-icon pp-icon-<name>">`. Icon names
  use **underscores**, not hyphens (e.g. `pp-icon-delete_trash`, `pp-icon-angle_right`). A guessed
  hyphenated name renders an empty box.
- **Typography:** AkkuratStd, using the documented Material 3 type scale — no custom font sizes.

### Corner radius (verify the component uses the right category)

- `full` — badges, round buttons, button toggles, chips, inputs, selects, slide toggles.
- `0.5rem` — cards, date pickers, inline messages, snackbars, tables, tooltips.
- `1rem` — modals/dialogs (desktop only).
- `0.125rem` — checkboxes.

### Accessibility — PDX values

- **Icon-only buttons:** minimum touch target `2.5rem × 2.5rem` (≈40 px) — PDX's documented minimum (this is the design-system minimum referred to in the generic checklist above).
- Minimum interactive control height: `2.5rem`.
- Color contrast: at minimum WCAG AA — `4.5:1` for normal text, `3:1` for large text and UI
  components.
- Icon-only controls must carry an accessible label (`ariaLabel` on PDX components such as
  `pp-icon-button` / `pp-floating-action-button`).

### Implementation consistency — prefer PDX components

- A PDX component should be used wherever one exists (e.g. `pp-button`, `pp-input`, `pp-select`,
  `pp-dialog`) instead of Angular Material or a custom build. Flag any Material component that has a
  PDX equivalent — the `pdx` skill's replacement map lists the current set.
