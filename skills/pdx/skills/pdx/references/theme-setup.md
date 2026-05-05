# PDX Theme Setup & Integration

How to install and configure PDX libraries in an Angular project.

---

## Prerequisites

- Angular 21+ with standalone components
- Angular Material 21+ and Angular CDK 21+
- SCSS support enabled in the project
- `.npmrc` configured for the private `@pdx` registry (see below)

---

## Private Registry Configuration

`@pdx/*` packages are hosted on a private Azure DevOps npm registry. Before installing, ensure the project (or user home) has an `.npmrc` with:

```ini
registry=https://registry.npmjs.org/

@pdx:registry=https://pkgs.dev.azure.com/polypoint/_packaging/polypoint/npm/registry/
```

The user must also authenticate against the Azure DevOps feed (e.g. via `vsts-npm-auth` or a PAT token in `.npmrc`). Without this, `npm install` or `bun install` of any `@pdx/*` package will fail.

---

## Bun Configuration

When using Bun as the package manager, add all `@pdx/*` packages to `trustedDependencies` and `minimumReleaseAgeExcludes` in `package.json` to avoid installation issues with the private registry:

```json
{
  "trustedDependencies": [
    "@pdx/pp-theme",
    "@pdx/pp-icons",
    "@pdx/pp-button",
    "@pdx/pp-input",
    "@pdx/pp-form",
    "@pdx/pp-checkbox",
    "@pdx/pp-radio",
    "@pdx/pp-chip",
    "@pdx/pp-dialog",
    "@pdx/pp-tree",
    "@pdx/pp-select",
    "@pdx/pp-menu",
    "@pdx/pp-list",
    "@pdx/pp-tab",
    "@pdx/pp-expansion-panel",
    "@pdx/pp-sidenav",
    "@pdx/pp-top-navigation"
  ],
  "minimumReleaseAgeExcludes": [
    "@pdx/pp-theme",
    "@pdx/pp-icons",
    "@pdx/pp-button",
    "@pdx/pp-input",
    "@pdx/pp-form",
    "@pdx/pp-checkbox",
    "@pdx/pp-radio",
    "@pdx/pp-chip",
    "@pdx/pp-dialog",
    "@pdx/pp-tree",
    "@pdx/pp-select",
    "@pdx/pp-menu",
    "@pdx/pp-list",
    "@pdx/pp-tab",
    "@pdx/pp-expansion-panel",
    "@pdx/pp-sidenav",
    "@pdx/pp-top-navigation"
  ]
}
```

---

## Installation

Install the theme and icon packages first, then component libraries as needed:

```bash
npm install @pdx/pp-theme @pdx/pp-icons
npm install @pdx/pp-button @pdx/pp-input @pdx/pp-form @pdx/pp-checkbox @pdx/pp-radio @pdx/pp-chip @pdx/pp-dialog @pdx/pp-tree @pdx/pp-select @pdx/pp-menu @pdx/pp-list @pdx/pp-tab @pdx/pp-expansion-panel @pdx/pp-sidenav @pdx/pp-top-navigation
```

All component libraries have `@pdx/pp-theme` as a peer dependency. Additional peers:

- `@pdx/pp-dialog` requires `@pdx/pp-button`
- `@pdx/pp-select` requires `@pdx/pp-menu`
- `@pdx/pp-menu` requires `@pdx/pp-checkbox`
- `@pdx/pp-form` requires `@pdx/pp-radio` and `@pdx/pp-menu`
- `@pdx/pp-list` requires `@pdx/pp-checkbox` and `@pdx/pp-radio`
- `@pdx/pp-top-navigation` requires `@pdx/pp-menu`
- `@pdx/pp-sidenav` requires `@angular/material` and `@pdx/pp-icons`

---

## Theme Configuration

### 1. Import Global Styles

In the project's main stylesheet (e.g. `styles.scss`):

```scss
/* PDX theme: colors, typography, Material 3 theme, TailwindCSS */
@use '@pdx/pp-theme/scss/index';

/* PDX icons */
@use '@pdx/pp-icons/icons';
```

Or using CSS imports (e.g. in `styles.css` or `angular.json` styles array):

```css
@import '@pdx/pp-theme/css/index.css';
@import '@pdx/pp-icons/icons.css';
```

### 2. Import Component-Specific Global Styles

Some components provide global styles for overlays and backdrops. Import these in the main stylesheet:

```scss
/* Dialog overlay and backdrop styles */
@use '@pdx/pp-dialog/styles';

/* Input global styles */
@use '@pdx/pp-input/styles';

/* Sidenav tooltip overrides (required until a native PDX tooltip exists) */
@use '@pdx/pp-sidenav/styles';
```

### 3. Configure angular.json (Alternative)

Instead of SCSS imports, styles can be added to the `angular.json` styles array:

```json
{
  "styles": ["@pdx/pp-theme/css/index.css", "@pdx/pp-icons/icons.css", "src/styles.scss"]
}
```

---

## Using Color Tokens

### In SCSS

```scss
@use '@pdx/pp-theme/scss/color/colors' as *;

.my-element {
  color: $pp-primary;
  background: $pp-secondary-980;
  border-color: $pp-secondary-900;
}

.error-text {
  color: $pp-error;
}

.success-badge {
  background: $pp-success;
}
```

### In CSS (Custom Properties)

```css
.my-element {
  color: var(--color-pp-primary-500);
  background: var(--color-pp-secondary-980);
}
```

### With TailwindCSS

```html
<div class="text-pp-primary-500 bg-pp-secondary-980 border-pp-secondary-900">Content</div>
```

---

## Using Typography

The AkkuratStd font is loaded automatically by the theme. Apply it globally:

```scss
body {
  font-family: 'AkkuratStd', sans-serif;
}
```

Or use the utility class:

```html
<body class="font-akkurat"></body>
```

Typography scale is provided through the theme. Use semantic HTML elements (`h1`-`h6`, `p`, `label`) which are styled automatically.

---

## Using Icons

PDX icons use a webfont with CSS classes:

```html
<span class="pp-icon pp-icon-add"></span>
<span class="pp-icon pp-icon-edit_filled"></span>
<span class="pp-icon pp-icon-delete_trash"></span>
<span class="pp-icon pp-icon-search"></span>
<span class="pp-icon pp-icon-close"></span>
```

Pattern: `pp-icon pp-icon-<icon-name>`. Icon names use **underscores**, not hyphens — see the correction table in [component-inventory.md](component-inventory.md).

For icon-only buttons, always provide an `aria-label`:

```html
<pp-icon-button icon="pp-icon pp-icon-edit_filled" ariaLabel="Edit item" />
```

---

## Using Components

All PDX components are standalone. Import them directly in component imports:

```typescript
import { Component } from '@angular/core';
import { PPButtonComponent } from '@pdx/pp-button';
import { PPInputComponent } from '@pdx/pp-input';
import { PPCheckboxComponent } from '@pdx/pp-checkbox';

@Component({
  standalone: true,
  imports: [PPButtonComponent, PPInputComponent, PPCheckboxComponent],
  template: `
    <pp-input label="Name" [required]="true" />
    <pp-checkbox id="terms" label="Accept terms" />
    <pp-button label="Submit" variant="filled" buttonType="submit" />
  `,
})
export class MyFormComponent {}
```

### Forms Integration

Form components implement `ControlValueAccessor`. In POLYPOINT Angular apps, prefer Signal Forms with `[formField]` for PDX controls where supported. Use `[formControl]` for `pp-select` / `pp-multiselect` and when integrating with existing reactive forms.

```typescript
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { PPInputComponent } from '@pdx/pp-input';
import { PPCheckboxComponent } from '@pdx/pp-checkbox';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, PPInputComponent, PPCheckboxComponent],
  template: `
    <form [formGroup]="form">
      <pp-input label="Email" formControlName="email" inputType="email" />
      <pp-checkbox id="newsletter" label="Subscribe" formControlName="subscribe" />
    </form>
  `,
})
export class MyFormComponent {
  public readonly form = new FormGroup({
    email: new FormControl(''),
    subscribe: new FormControl(false),
  });
}
```

### Dialogs

Open dialogs using Angular Material's `MatDialog` service, but wrap content in `PPDialogComponent`:

```typescript
import { inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { PPDialogComponent } from '@pdx/pp-dialog';

// In the parent component:
const dialog = inject(MatDialog);
dialog.open(ConfirmDialogComponent);

// ConfirmDialogComponent template:
@Component({
  standalone: true,
  imports: [PPDialogComponent],
  template: `
    <pp-dialog title="Confirm" confirmButtonTitle="Delete" (confirm)="onConfirm()" (dismiss)="onDismiss()">
      <p>Are you sure?</p>
    </pp-dialog>
  `,
})
export class ConfirmDialogComponent {
  private readonly dialogRef = inject(MatDialogRef);

  protected onConfirm(): void {
    this.dialogRef.close(true);
  }

  protected onDismiss(): void {
    this.dialogRef.close(false);
  }
}
```

---

## Page Layout Pattern

Standard PDX page layout:

```scss
:host {
  display: block;
  background: $pp-secondary-990;
  padding: 1.5rem;
}

.content-card {
  background: $pp-secondary-1000;
  border: 1px solid $pp-secondary-900;
  border-radius: 0.5rem;
  padding: 1.5rem;
  max-width: 75rem;
}
```

---

## Figma Reference

For detailed component documentation, states, variants, and visual examples:

[PDX — POLYPOINT Design Experience](https://www.figma.com/design/ivVuByHDDqZe9QjPIuuuMC/00-PDX--Polypoint-Design-Experience--)

Each component page in Figma includes its own documentation section. When the Figma MCP tools are available, use `get_design_context` with the Figma file key `ivVuByHDDqZe9QjPIuuuMC` to fetch component details and screenshots.
