# Angular Conventions (POLYPOINT saas)

## Tech Stack

| Concern          | Choice                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Framework        | Angular 21 (zoneless, standalone, signals)                                                                  |
| Monorepo         | Nx                                                                                                          |
| Package manager  | Bun                                                                                                         |
| State management | NgRx Signal Store                                                                                           |
| UI components    | Angular Material (M3) + PDX component libraries                                                             |
| PDX buttons      | `@pdx/pp-button` — `PPButtonComponent`, `PPIconButtonComponent`, `PPFloatingActionButtonComponent`          |
| PDX input        | `@pdx/pp-input` — `PPInputComponent`, `PPTextareaComponent`                                                 |
| PDX checkbox     | `@pdx/pp-checkbox` — `PPCheckboxComponent` (with `CheckboxState` enum, `PPCheckboxChangeEvent`)             |
| PDX radio        | `@pdx/pp-radio` — `PPRadioGroupComponent`, `PPRadioButtonComponent` (with `PPRadioOption` interface)        |
| PDX select       | `@pdx/pp-select` — `PPSelectComponent`, `PPMultiselectComponent` (with `PPMenuItem`, `PPSelectChangeEvent`) |
| PDX menu         | `@pdx/pp-menu` — `PPMenuComponent`, `PPMenuMultiselectComponent` (with `PPMenuItem`, `PPMenuSelectEvent`)   |
| PDX tab          | `@pdx/pp-tab` — `PPTabGroupComponent`, `PPTabComponent`, `PPTabContentDirective`                            |
| PDX icons        | `@pdx/pp-icons` — Icon webfont, use `<i class="pp-icon pp-icon-<name>">`                                    |
| PDX theme        | `@pdx/pp-theme` — Design tokens, Akkurat font, `--pp-*` CSS variables                                       |
| Forms            | Angular Signal Forms (`@angular/forms/signals`)                                                             |
| Styling          | TailwindCSS v4 + SCSS (BEM)                                                                                 |
| Date/time        | Temporal API (native, no polyfill)                                                                          |
| Unit testing     | Vitest                                                                                                      |
| Build            | esbuild + Vite                                                                                              |
| TypeScript       | Strict mode                                                                                                 |

## File Structure

```
apps/pep/src/app/<feature-name>/
├── <feature-name>.component.ts
├── <feature-name>.component.html
├── <feature-name>.component.scss
├── <feature-name>.component.spec.ts
├── <feature-name>.store.ts
├── <feature-name>.store.spec.ts
├── <feature-name>.service.ts
├── <feature-name>.service.spec.ts
└── <child-name>/
    ├── <child-name>.component.ts
    ├── <child-name>.component.html
    ├── <child-name>.component.scss
    └── <child-name>.component.spec.ts
```

## Component Pattern

```typescript
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { SomeStore } from "./some.store";

@Component({
  selector: "app-feature-name",
  imports: [
    /* Material modules, child components */
  ],
  providers: [SomeStore],
  templateUrl: "./feature-name.component.html",
  styleUrl: "./feature-name.component.scss",
  host: { "data-testid": "feature-name" },
})
export class FeatureNameComponent {
  readonly someId = input.required<string>();
  readonly selected = output<Item>();

  private readonly store = inject(SomeStore);

  private readonly filter = signal("");

  protected readonly isLoading = this.store.isLoading;
  protected readonly items = this.store.items;
  protected readonly filteredItems = computed(() => {
    const term = this.filter().toLowerCase();
    return (
      this.items()?.filter((i) => i.name.toLowerCase().includes(term)) ?? []
    );
  });

  constructor() {
    effect(() => {
      const id = this.someId();
      if (id != null) {
        this.store.loadItems({ id });
      }
    });
  }
}
```

## Signal Forms Pattern

```typescript
import { Component, signal } from "@angular/core";
import { form, FormField, required, minLength } from "@angular/forms/signals";
import { PPInputComponent } from "@pdx/pp-input";

interface FilterData {
  lastName: string;
  firstName: string;
  personnelNumber: string;
}

@Component({
  selector: "app-employee-filter",
  imports: [FormField, PPInputComponent],
  template: `
    <pp-input label="Last Name" [formField]="filterForm.lastName" />

    <pp-input label="First Name" [formField]="filterForm.firstName" />

    @if (filterForm.lastName().touched() && filterForm.lastName().invalid()) {
      <ul>
        @for (error of filterForm.lastName().errors(); track error) {
          <li>{{ error.message }}</li>
        }
      </ul>
    }
  `,
})
export class EmployeeFilterComponent {
  private readonly filterModel = signal<FilterData>({
    lastName: "",
    firstName: "",
    personnelNumber: "",
  });

  protected readonly filterForm = form(this.filterModel, (schema) => {
    required(schema.lastName, { message: "Last name is required" });
    minLength(schema.lastName, 2, { message: "At least 2 characters" });
  });
}
```

## Store Pattern

```typescript
import { inject } from "@angular/core";
import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { catchError, EMPTY, pipe, switchMap, tap } from "rxjs";
import { SomeService } from "./some.service";

type SomeState = {
  isLoading: boolean;
  error: string | null;
  items: Item[] | null;
};

const initialState: SomeState = {
  isLoading: false,
  error: null,
  items: null,
};

export const SomeStore = signalStore(
  withState(initialState),
  withMethods((store, service = inject(SomeService)) => ({
    loadItems: rxMethod<{ id: string }>(
      pipe(
        tap(() =>
          patchState(store, { isLoading: true, items: null, error: null }),
        ),
        switchMap(({ id }) =>
          service.getItems(id).pipe(
            tap((items) => patchState(store, { isLoading: false, items })),
            catchError((error: Error) => {
              patchState(store, { isLoading: false, error: error.message });
              return EMPTY;
            }),
          ),
        ),
      ),
    ),
  })),
);
```

## Service Pattern

```typescript
import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { AppConfigService } from "../shared/app-config.service";

@Injectable({ providedIn: "root" })
export class SomeService {
  private readonly appConfig = inject(AppConfigService);
  private readonly http = inject(HttpClient);

  getItems(id: string): Observable<Item[]> {
    // TODO: Replace mock with real endpoint
    // return this.http.get<Item[]>(`${this.appConfig.apiBaseUrl}rest/ui/items/${id}`)
    return of(MOCK_ITEMS);
  }
}

const MOCK_ITEMS: Item[] = [
  { id: "1", name: "Item 1" },
  { id: "2", name: "Item 2" },
];
```

## Test Pattern (Vitest)

```typescript
import { TestBed } from "@angular/core/testing";
import { of, throwError } from "rxjs";
import { SomeService } from "./some.service";
import { SomeStore } from "./some.store";

describe("SomeStore", () => {
  let store: InstanceType<typeof SomeStore>;
  let mockService: { getItems: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockService = { getItems: vi.fn() };

    TestBed.configureTestingModule({
      providers: [SomeStore, { provide: SomeService, useValue: mockService }],
    });

    store = TestBed.inject(SomeStore);
  });

  it("should have correct initial state", () => {
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.items()).toBeNull();
  });

  it("should load items successfully", () => {
    const mockItems = [{ id: "1", name: "Test" }];
    mockService.getItems.mockReturnValue(of(mockItems));

    store.loadItems({ id: "1" });

    expect(store.items()).toEqual(mockItems);
    expect(store.isLoading()).toBe(false);
  });

  it("should handle errors", () => {
    mockService.getItems.mockReturnValue(
      throwError(() => new Error("Server error")),
    );

    store.loadItems({ id: "1" });

    expect(store.error()).toBe("Server error");
    expect(store.isLoading()).toBe(false);
  });
});
```

## Styling Rules

### BEM SCSS for structure

```scss
:host {
  display: block;
}

.filter {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;

  &__input {
    min-width: 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
}
```

- BEM blocks named after domain concept (`.filter`, `.employee-list`), not the component
- `:host { display: block; }` on every component

### Tailwind for utilities

```html
<div class="filter__input truncate pl-4 text-left">{{ node.name }}</div>
```

Mix BEM (structure) and Tailwind (decoration) in the same element.

### pp-theme colors

Use `--pp-*` CSS variables for all colors. Never use `--mat-sys-*` tokens or hardcoded hex values.

```scss
// Correct
background: var(--pp-primary-990);
color: var(--pp-neutral-200);
border-color: var(--pp-neutral-variant-940);

// Wrong
background: var(--mat-sys-surface-container);
color: #717479;
```

| Variable prefix             | Usage                       |
| --------------------------- | --------------------------- |
| `--pp-primary-*` (50-990)   | Brand teal, primary actions |
| `--pp-secondary-*`          | Secondary UI elements       |
| `--pp-tertiary-*`           | Muted teal-gray accents     |
| `--pp-neutral-*`            | Text, borders, backgrounds  |
| `--pp-neutral-variant-*`    | Subtle variant grays        |
| `--pp-error-*`              | Error states                |
| `--pp-success-*`            | Success states              |
| `--pp-info-*`               | Informational               |
| `--pp-warning-*`            | Warning states              |
| `--pp-black` / `--pp-white` | Pure black and white        |

Scale: 50 (darkest) to 990 (lightest). 500 is the base value.

## Route Pattern

```typescript
{
  path: 'feature-name/:id',
  loadComponent: () => import('./feature-name/feature-name.component').then((c) => c.FeatureNameComponent),
},
```

## PDX Component Usage

### pp-button

```typescript
import { PPButtonComponent, PPIconButtonComponent } from '@pdx/pp-button'

@Component({
  imports: [PPButtonComponent, PPIconButtonComponent],
  template: `
    <pp-button variant="filled" (click)="save()">Save</pp-button>
    <pp-button variant="outlined" (click)="cancel()">Cancel</pp-button>
    <pp-button variant="text" size="sm" (click)="reset()">Reset</pp-button>
    <pp-icon-button (click)="delete()">
      <i class="pp-icon pp-icon-delete"></i>
    </pp-icon-button>
  `,
})
```

Variants: `filled`, `outlined`, `text`, `tonal`. Sizes: `sm`, `md`, `lg`.

### pp-input

```typescript
import { PPInputComponent, PPTextareaComponent } from '@pdx/pp-input'

@Component({
  imports: [PPInputComponent, PPTextareaComponent],
  template: `
    <pp-input label="Email" inputType="email" [formField]="form.email" />
    <pp-input label="Search" leadingIcon="pp-icon-search" size="sm" />
    <pp-textarea label="Notes" [formField]="form.notes" [autoGrowth]="true" />
  `,
})
```

`PPInputComponent` replaces `mat-form-field` + `matInput` for text fields. Supported input types: `text`, `email`, `password`, `tel`, `url`. For unsupported types (e.g. `month`, `date`), fall back to `mat-form-field` + `matInput`. `PPTextareaComponent` replaces `mat-form-field` + `<textarea matInput>`. Both implement `ControlValueAccessor` for Signal Forms. Inputs: `label` (required), `inputType`, `size` (`sm`/`lg`), `leadingIcon`, `trailingIcon`, `helperText`, `tooltip`, `required`, `optional`, `invalid`, `disabled`, `readonly`, `fullWidth`, `value`. Output: `inputChange` / `textareaChange`.

### pp-checkbox

```typescript
import { PPCheckboxComponent } from '@pdx/pp-checkbox'

@Component({
  imports: [PPCheckboxComponent],
  template: `
    <pp-checkbox [formField]="form.active">Active</pp-checkbox>
  `,
})
```

Supports `indeterminate`, `error`, and `disabled` states via `CheckboxState` enum (`Selected`, `Unselected`, `Indeterminate`). Implements `ControlValueAccessor` for Signal Forms integration. Inputs: `label`, `error`, `disabled`, `state`. Outputs: `checkboxChange`, `indeterminateChange` (both emit `PPCheckboxChangeEvent`).

### pp-radio

```typescript
import {
  PPRadioGroupComponent,
  PPRadioButtonComponent,
  PPRadioOption,
} from "@pdx/pp-radio";

@Component({
  imports: [PPRadioGroupComponent],
  template: `
    <pp-radio-group [formField]="form.status" [options]="statusOptions" />
  `,
})
export class SomeComponent {
  protected readonly statusOptions: PPRadioOption[] = [
    { id: "active", label: "Active", value: "active" },
    { id: "inactive", label: "Inactive", value: "inactive" },
  ];
}
```

`PPRadioGroupComponent` accepts an `options: PPRadioOption[]` input and renders radio buttons automatically. Use individual `PPRadioButtonComponent` elements when custom layout is needed. Both implement `ControlValueAccessor`. Value type: `string | number`. `PPRadioOption` interface: `{ id: string, label: string, value: string | number, disabled?: boolean, ariaLabel?: string | null }`.

### pp-select

```typescript
import { PPSelectComponent, PPMultiselectComponent } from "@pdx/pp-select";
import { PPMenuItem } from "@pdx/pp-menu";

@Component({
  imports: [PPSelectComponent, PPMultiselectComponent],
  template: `
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
  `,
})
export class SomeComponent {
  protected readonly departmentControl = new FormControl<string>("");
  protected readonly skillsControl = new FormControl<string[]>([]);

  protected readonly departmentOptions: PPMenuItem[] = [
    { id: "1", label: "Engineering" },
    { id: "2", label: "Design" },
  ];
  protected readonly skillOptions: PPMenuItem[] = [
    { id: "ts", label: "TypeScript" },
    { id: "angular", label: "Angular" },
  ];
}
```

`PPSelectComponent` is a single-selection dropdown. `PPMultiselectComponent` is multi-selection (displays comma-separated labels with ellipsis). Both implement `ControlValueAccessor`. Options via `PPMenuItem[]` (`{ id: string | number, label: string, supportingText?: string }`). Sizes: `'large'` (default, 2.5rem), `'small'` (2rem). Inputs: `label` (required), `options`, `value`/`values`, `isDisabled`, `isError`, `size`, `icon`, `supportingText`, `ariaLabel`. Output: `selectionChange` emits `PPSelectChangeEvent` / `PPMultiselectChangeEvent`.

### pp-menu

```typescript
import { PPMenuComponent, PPMenuMultiselectComponent, PPMenuItem } from '@pdx/pp-menu'

@Component({
  imports: [PPMenuComponent],
  template: `
    <pp-menu
      [items]="menuItems"
      [selectedId]="selectedId"
      [isOpen]="isOpen"
      [ariaLabel]="'Choose action'"
      (itemSelect)="onSelect($event.id)"
    />
  `,
})
```

`PPMenuComponent` is a standalone single-select dropdown listbox. `PPMenuMultiselectComponent` is a multi-select variant with leading checkboxes. Both are presentational — open/close state is managed by the parent. Used internally by `@pdx/pp-select` and as the context menu for `@pdx/pp-tree`. Can also be composed directly for custom dropdown UIs. Items via `PPMenuItem[]`. Sizes: `'large'`, `'small'`. Supports fixed positioning via `triggerElement` ModelSignal for use cases where the menu is placed outside the trigger's DOM subtree.

### pp-tree

```typescript
import { PPTreeComponent, TreeData } from '@pdx/pp-tree'
import { PPMenuComponent, PPMenuItem } from '@pdx/pp-menu'

@Component({
  imports: [PPTreeComponent, PPMenuComponent],
  template: `
    <pp-tree
      [data]="treeData"
      [(selectedId)]="selectedNodeId"
      [showAddButton]="true"
      [moreMenu]="contextMenu"
      (selectNode)="onSelect($event)"
      (addNode)="onAdd($event)"
    />
    <pp-menu #contextMenu [items]="menuItems()" (itemSelect)="onMenuAction($event)" />
  `,
})
```

`PPTreeComponent` displays hierarchical data with selection, expansion, drag-and-drop reordering, sorting, and context menus. Data via `TreeData[]` (`{ id: string, label: string, icon?: string, children?: TreeData[], isDisabled?: boolean, isExpanded?: boolean, hideAddButton?: boolean }`). The `moreMenu` input accepts a `PPMenuComponent` reference — the tree node toggles `isOpen` and sets `triggerElement` automatically; items and event handling are owned by the consumer. Peer deps: `@angular/core`, `@pdx/pp-menu`, `@pdx/pp-theme`.

### pp-tab

```typescript
import {
  PPTabGroupComponent,
  PPTabComponent,
  PPTabContentDirective,
} from "@pdx/pp-tab";

@Component({
  imports: [PPTabGroupComponent, PPTabComponent, PPTabContentDirective],
  template: `
    <pp-tab-group [(selectedIndex)]="activeTab">
      <pp-tab label="Overview" icon="pp-icon-dashboard">
        <ng-template ppTabContent>
          <p>Overview content</p>
        </ng-template>
      </pp-tab>
      <pp-tab label="Settings" icon="pp-icon-settings_gears">
        <ng-template ppTabContent>
          <p>Settings content</p>
        </ng-template>
      </pp-tab>
    </pp-tab-group>
  `,
})
export class SomeComponent {
  protected activeTab = 0;
}
```

`PPTabGroupComponent` manages tab selection, sliding indicator animation, keyboard navigation (Arrow keys, Home/End), and optional content panels. `PPTabComponent` inputs: `label`, `icon` (optional, e.g. `'pp-icon-dashboard'`), `disabled`. Use `ppTabContent` directive on `<ng-template>` for tab-managed content panels, or omit it and use `[(selectedIndex)]` two-way binding for consumer-managed content via `@switch`. `fullWidth` input stretches tabs equally.

### pp-icons

```html
<i class="pp-icon pp-icon-calendar"></i>
<i class="pp-icon pp-icon-delete"></i>
<i class="pp-icon pp-icon-edit"></i>
```

Import SCSS: `@use '@pdx/pp-icons/icons'`.

## General Rules

- Single quotes, no semicolons (enforced by Prettier)
- `null` over `undefined` for intentional "no value"
- Temporal API for all date/time: `Temporal.PlainDate.from(...)`, `Temporal.Now.plainDateISO()`
- `data-testid` attributes on host elements
- `protected` for template-bound members, `private` for internal
- Prefer `@pdx/pp-button` over `MatButtonModule` for all buttons
- Prefer `@pdx/pp-input` over `MatFormFieldModule` + `MatInputModule` for text inputs and textareas (fall back to Material for unsupported input types like `month`)
- Prefer `@pdx/pp-checkbox` over `MatCheckboxModule` for all checkboxes
- Prefer `@pdx/pp-radio` over `MatRadioModule` for all radio buttons
- Prefer `@pdx/pp-select` over `MatSelectModule` for all selects/dropdowns
- Prefer `@pdx/pp-menu` over `MatMenuModule` for all menus
- Prefer `@pdx/pp-tab` over `MatTabsModule` for all tabs
- Use `@pdx/pp-icons` for all icons (not Material Icons)
