# Angular Conventions (POLYPOINT saas)

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Angular 21 (zoneless, standalone, signals) |
| Monorepo | Nx |
| Package manager | Bun |
| State management | NgRx Signal Store |
| UI components | Angular Material (M3) |
| Forms | Angular Signal Forms (`@angular/forms/signals`) |
| Styling | TailwindCSS v4 + SCSS (BEM) |
| Design tokens | pp-theme (`--pp-*` CSS variables) |
| Date/time | Temporal API (native, no polyfill) |
| Unit testing | Vitest |
| Build | esbuild + Vite |
| TypeScript | Strict mode |

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
import { Component, computed, effect, inject, input, output, signal } from '@angular/core'
import { SomeStore } from './some.store'

@Component({
  selector: 'app-feature-name',
  imports: [/* Material modules, child components */],
  providers: [SomeStore],
  templateUrl: './feature-name.component.html',
  styleUrl: './feature-name.component.scss',
  host: { 'data-testid': 'feature-name' },
})
export class FeatureNameComponent {
  readonly someId = input.required<string>()
  readonly selected = output<Item>()

  private readonly store = inject(SomeStore)

  private readonly filter = signal('')

  protected readonly isLoading = this.store.isLoading
  protected readonly items = this.store.items
  protected readonly filteredItems = computed(() => {
    const term = this.filter().toLowerCase()
    return this.items()?.filter((i) => i.name.toLowerCase().includes(term)) ?? []
  })

  constructor() {
    effect(() => {
      const id = this.someId()
      if (id != null) {
        this.store.loadItems({ id })
      }
    })
  }
}
```

## Signal Forms Pattern

```typescript
import { Component, signal } from '@angular/core'
import { form, FormField, required, minLength } from '@angular/forms/signals'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'

interface FilterData {
  lastName: string
  firstName: string
  personnelNumber: string
}

@Component({
  selector: 'app-employee-filter',
  imports: [FormField, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field>
      <mat-label>Last Name</mat-label>
      <input matInput [formField]="filterForm.lastName" />
    </mat-form-field>

    <mat-form-field>
      <mat-label>First Name</mat-label>
      <input matInput [formField]="filterForm.firstName" />
    </mat-form-field>

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
    lastName: '',
    firstName: '',
    personnelNumber: '',
  })

  protected readonly filterForm = form(this.filterModel, (schema) => {
    required(schema.lastName, { message: 'Last name is required' })
    minLength(schema.lastName, 2, { message: 'At least 2 characters' })
  })
}
```

## Store Pattern

```typescript
import { inject } from '@angular/core'
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals'
import { rxMethod } from '@ngrx/signals/rxjs-interop'
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs'
import { SomeService } from './some.service'

type SomeState = {
  isLoading: boolean
  error: string | null
  items: Item[] | null
}

const initialState: SomeState = {
  isLoading: false,
  error: null,
  items: null,
}

export const SomeStore = signalStore(
  withState(initialState),
  withMethods((store, service = inject(SomeService)) => ({
    loadItems: rxMethod<{ id: string }>(
      pipe(
        tap(() => patchState(store, { isLoading: true, items: null, error: null })),
        switchMap(({ id }) =>
          service.getItems(id).pipe(
            tap((items) => patchState(store, { isLoading: false, items })),
            catchError((error: Error) => {
              patchState(store, { isLoading: false, error: error.message })
              return EMPTY
            }),
          ),
        ),
      ),
    ),
  })),
)
```

## Service Pattern

```typescript
import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable, of } from 'rxjs'
import { AppConfigService } from '../shared/app-config.service'

@Injectable({ providedIn: 'root' })
export class SomeService {
  private readonly appConfig = inject(AppConfigService)
  private readonly http = inject(HttpClient)

  getItems(id: string): Observable<Item[]> {
    // TODO: Replace mock with real endpoint
    // return this.http.get<Item[]>(`${this.appConfig.apiBaseUrl}rest/ui/items/${id}`)
    return of(MOCK_ITEMS)
  }
}

const MOCK_ITEMS: Item[] = [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' },
]
```

## Test Pattern (Vitest)

```typescript
import { TestBed } from '@angular/core/testing'
import { of, throwError } from 'rxjs'
import { SomeService } from './some.service'
import { SomeStore } from './some.store'

describe('SomeStore', () => {
  let store: InstanceType<typeof SomeStore>
  let mockService: { getItems: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockService = { getItems: vi.fn() }

    TestBed.configureTestingModule({
      providers: [SomeStore, { provide: SomeService, useValue: mockService }],
    })

    store = TestBed.inject(SomeStore)
  })

  it('should have correct initial state', () => {
    expect(store.isLoading()).toBe(false)
    expect(store.error()).toBeNull()
    expect(store.items()).toBeNull()
  })

  it('should load items successfully', () => {
    const mockItems = [{ id: '1', name: 'Test' }]
    mockService.getItems.mockReturnValue(of(mockItems))

    store.loadItems({ id: '1' })

    expect(store.items()).toEqual(mockItems)
    expect(store.isLoading()).toBe(false)
  })

  it('should handle errors', () => {
    mockService.getItems.mockReturnValue(throwError(() => new Error('Server error')))

    store.loadItems({ id: '1' })

    expect(store.error()).toBe('Server error')
    expect(store.isLoading()).toBe(false)
  })
})
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
<div class="filter__input truncate pl-4 text-left">
  {{ node.name }}
</div>
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

| Variable prefix | Usage |
|---|---|
| `--pp-primary-*` (50-990) | Brand teal, primary actions |
| `--pp-secondary-*` | Secondary UI elements |
| `--pp-tertiary-*` | Muted teal-gray accents |
| `--pp-neutral-*` | Text, borders, backgrounds |
| `--pp-neutral-variant-*` | Subtle variant grays |
| `--pp-error-*` | Error states |
| `--pp-success-*` | Success states |
| `--pp-info-*` | Informational |
| `--pp-warning-*` | Warning states |
| `--pp-black` / `--pp-white` | Pure black and white |

Scale: 50 (darkest) to 990 (lightest). 500 is the base value.

## Route Pattern

```typescript
{
  path: 'feature-name/:id',
  loadComponent: () => import('./feature-name/feature-name.component').then((c) => c.FeatureNameComponent),
},
```

## General Rules

- Single quotes, no semicolons (enforced by Prettier)
- `null` over `undefined` for intentional "no value"
- Temporal API for all date/time: `Temporal.PlainDate.from(...)`, `Temporal.Now.plainDateISO()`
- `data-testid` attributes on host elements
- `protected` for template-bound members, `private` for internal
