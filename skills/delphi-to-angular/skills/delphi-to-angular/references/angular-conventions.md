# Angular Conventions (POLYPOINT saas)

PDX component recipes (buttons, inputs, form scaffold, layout pitfalls, icons, etc.) live in [pdx-recipes.md](pdx-recipes.md). This file covers Angular patterns: component structure, signal store, signal forms, i18n, testing, accessibility, and the post-generate quality passes.

## Tech Stack

| Concern          | Choice                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Framework        | Angular 21 (zoneless, standalone, signals)                                                              |
| Monorepo         | Nx                                                                                                      |
| Package manager  | Bun                                                                                                     |
| State management | NgRx Signal Store                                                                                       |
| UI components    | PDX component libraries (`@pdx/*`) + Angular Material (M3) for components without a PDX equivalent      |
| Forms            | Angular Signal Forms (`@angular/forms/signals`); `pp-select` / `pp-multiselect` use `[formControl]`     |
| i18n             | `@ngx-translate/core` — `TranslatePipe`, `TranslateService`, locale JSON files in the app's i18n folder |
| Styling          | TailwindCSS v4 + SCSS (BEM)                                                                             |
| Date/time        | `Temporal` (exposed as a **global** — do not import)                                                    |
| Unit testing     | Vitest                                                                                                  |
| E2E testing      | Playwright                                                                                              |
| A11y testing     | `vitest-axe` + a shared `formatA11yViolations` helper from the workspace's testing lib                  |
| API mocking      | MSW where the workspace has it; otherwise builders in the workspace's shared test-data lib              |
| Build            | esbuild + Vite                                                                                          |
| TypeScript       | Strict mode                                                                                             |

## File Structure

Layout below assumes the typical Nx-style `apps/<app>/src/app/` root. Verify the actual feature root by inspecting an existing feature in the workspace.

```
<app-feature-root>/<feature-name>/
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
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { TranslatePipe } from "@ngx-translate/core";
import { SomeStore } from "./some.store";

@Component({
  selector: "app-feature-name",
  imports: [
    TranslatePipe,
    /* PDX components, Material modules, child components */
  ],
  providers: [SomeStore],
  templateUrl: "./feature-name.component.html",
  styleUrl: "./feature-name.component.scss",
  host: { "data-testid": "feature-name" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureNameComponent {
  public readonly someId = input.required<string>();
  public readonly selected = output<Item>();

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
      this.store.loadItems({ id: this.someId() });
    });
  }
}
```

Required pieces:

- **`changeDetection: ChangeDetectionStrategy.OnPush`** on every component.
- **`host: { 'data-testid': 'feature-name' }`** on every component (gives e2e tests a stable, locale-resilient root selector).
- **Explicit visibility modifiers** on every class member, including `input()` / `output()`. Use `public` for template- or consumer-facing members, `protected` for template-only members, `private` for internals. Never omit the modifier — a missing modifier is ambiguous.

## Smart vs dumb components

The parent owns the store. Children take a slice via `input()` and emit changes via `output()`.

- **Don't** `inject(FeatureStore)` from a child component that also receives the same data via `input()`. That creates two sources of truth — the input updates lag the store and effects are needed to paper over the gap.
- **Do** lift store access to the parent and pass typed slices down. If a child needs to mutate, expose an `output()` and let the parent call the typed store method.
- **Exception:** purely-routed child pages that own their own state may inject the store directly — they're parents in their own right, not children of another component.

```typescript
// Parent — owns the store
export class FeatureParentComponent {
  protected readonly store = inject(FeatureStore);
}
```

```html
<app-personal-info
  [data]="store.personalInfo()"
  (save)="store.savePersonalInfo($event)"
/>
```

```typescript
// Child — takes input, emits output, no store
export class PersonalInfoComponent {
  public readonly data = input.required<PersonalInfo>();
  public readonly save = output<PersonalInfo>();
}
```

The post-generate convention check flags any child component that both `inject()`s a store and exposes an `input()` for the same data shape.

## Signal Forms Pattern

**Bind PDX inputs with `[formField]` — except `pp-select` / `pp-multiselect`, which use `[formControl]` (legacy reactive forms).** All PDX components implement `ControlValueAccessor`, and `[formField]` bridges to CVA automatically. Mix both APIs in one component when needed.

```typescript
import { Component, signal } from "@angular/core";
import {
  form,
  FormField,
  requiredError,
  validate,
} from "@angular/forms/signals";
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
    <pp-input
      [label]="'employee.last_name' | translate"
      [formField]="filterForm.lastName"
      [fullWidth]="true"
    />
    <pp-input
      [label]="'employee.first_name' | translate"
      [formField]="filterForm.firstName"
      [fullWidth]="true"
    />

    @if (filterForm.lastName().touched() && filterForm.lastName().invalid()) {
      <ul>
        @for (error of filterForm.lastName().errors(); track error.kind) {
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
    validate(schema.lastName, (ctx) => {
      const value = ctx.value();
      if (!value?.trim()) {
        return requiredError({ message: "Last name is required" });
      }
      if (value.length < 2) {
        return { kind: "minLength", message: "At least 2 characters" };
      }
      return null;
    });
  });
}
```

Key points:

- Validators are written with **`validate(schema.field, ctx => ...)`** — there is no named `required()`, `minLength()`, `maxLength()`, etc. in `@angular/forms/signals`.
- Use **`requiredError({ message })`** for required-field errors.
- Custom errors take the shape **`{ kind: string, message: string }`** (not `{ name }`).
- Track errors in templates by **`error.kind`**, not `error.name`.
- Form-level validity is **`form().invalid()`** — call the form signal first, then `.invalid()`.
- The `maxlength` HTML attribute is **forbidden** on `[formField]` inputs. Use a `validate()` rule instead.

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

### Optimistic UI mutations

When the user can't tolerate waiting for a server round-trip (tree edits, list reordering, drag-and-drop), follow the snapshot → optimistic update → API call → reconcile / rollback pattern:

```typescript
addNode: rxMethod<AddNodePayload>(
  pipe(
    switchMap((payload) => {
      const snapshot = store.hierarchy();
      const tempNodeId = nextTempId();
      const optimistic = addChildToTree(snapshot, payload, tempNodeId);
      patchState(store, { hierarchy: optimistic });

      return lockService.withLock(payload.parentId, () =>
        service.addNode(payload).pipe(
          tap((serverNode) => {
            patchState(store, { hierarchy: replaceTempId(store.hierarchy(), tempNodeId, serverNode) });
          }),
          catchError((error: Error) => {
            patchState(store, { hierarchy: snapshot, error: error.message });
            return EMPTY;
          }),
        ),
      );
    }),
  ),
),
```

This pattern needs immutable tree helpers — `addChildToTree`, `removeNodeFromTree`, `swapSiblings`, `updateNodeInTree`. Generate them as a sibling file (`<feature>.tree.utils.ts`) when the data shape is hierarchical.

### Implicit locking

When concurrent users edit the same record, locking should be transparent — no "Lock" / "Unlock" UI, just visual indicators of someone else's lock:

```typescript
// LockService API:
withLock<T>(resourceId: number, action: () => Observable<T>): Observable<T>

// Every store mutation that touches a lockable resource wraps the API call in withLock:
lockService.withLock(parentId, () => service.addNode(payload))
```

- Lock acquired before the API call, released on completion or error via `finalize()`.
- Other users see lock icons via SSE in real-time.
- Heartbeat (10 s) + TTL (30 s) auto-releases on disconnect/crash.
- `navigator.sendBeacon` on `beforeunload` for best-effort release.
- `visibilitychange` pauses heartbeat when the tab is hidden.

The Delphi codebase typically has explicit Lock/Unlock buttons with a `TPolyRecordLock` field — convert these to implicit locking, **not** to a UI element.

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

For mock data large enough to demo the feature, prefer the **MSW + test-data builder** pattern below over inlining `MOCK_ITEMS` arrays.

## i18n & ngx-translate

All user-visible text must go through `TranslatePipe` (template) or `TranslateService.instant()` (TypeScript). **Never hardcode strings** — not German, not English.

```typescript
import { TranslatePipe, TranslateService } from "@ngx-translate/core";

@Component({
  imports: [TranslatePipe /* ... */],
})
export class FeatureComponent {
  private readonly translate = inject(TranslateService);

  protected showSavedToast(): void {
    this.snackBar.open(
      this.translate.instant("common.saved"),
      this.translate.instant("common.dismiss"),
    );
  }
}
```

```html
<h2>{{ 'hierarchy.title' | translate }}</h2>
<pp-button [label]="'save' | translate" variant="filled" />
<pp-form-section [title]="'profile.title' | translate" />
```

### Locale files (generic discovery)

Translation files live in an `i18n` folder somewhere under the app — commonly `apps/<app>/public/assets/i18n/` (Nx) or `src/assets/i18n/` (CLI). The set of locales (`de-CH`, `en`, `fr`, …) is **project-specific** — discover the folder once and add the new translation key to **every** locale file present:

```bash
# Search for an i18n directory containing locale JSON files
find . -type d -name i18n
```

For each generated feature, add the new keys to **all** locale files found. Use English as the placeholder for any locale you can't translate confidently and flag those as TODO in the conversion summary.

### Key naming

**Match the project's existing key-naming convention** — flat vs nested, snake vs kebab, feature-prefixed or not. Inspect a few existing keys before deciding. If the project already has a shared `common` / `shared` namespace for OK / Cancel / Save, reuse it instead of inventing a new one. If no convention is clear, ask the user. Avoid German keys — if the Delphi term has no agreed English translation, raise it during the analyze phase.

### Locale resolution

Use the workspace's existing translation service to resolve the active language. Don't hardcode `'de-CH'` as a fallback — that's a smell in a multi-language app.

### Testing translated components

Tests bootstrapped with `TranslateModule.forRoot()` resolve a key to itself (no JSON loaded). Assert against the **translation key**, not the translated text:

```typescript
expect(screen.getByText("hierarchy.no_qualifications")).toBeVisible();
// NOT: expect(screen.getByText('Keine Qualifikationen')).toBeVisible();
```

## API Mocking — MSW or shared test-data builders

Search the workspace for an existing MSW setup (look for `mock-api`, `msw/handlers`, `setupWorker`, etc.):

- **If MSW handlers exist anywhere in the workspace**, mirror their pattern: handler files per feature, in-memory `Map`/store seeded once with `getOrInit(id)` for fallback, `http.get/put/post/delete` from `msw`, `HttpResponse.json(...)` / `new HttpResponse(null, { status: 204 })`. Register handlers in the existing index file.
- **If MSW is not present**, generate fixtures via builders in the workspace's shared test-data lib (search `libs/shared/`, `libs/testing/`, or similar for an existing builder pattern). One builder per feature, exported and shared by the service mock and every spec — no inline duplication.

In either case: **mock data should be realistic and large enough to demo the full feature.** Trees with 10+ nodes across all levels, lists with 4+ items, real-looking domain names. A 2-item mock makes regressions invisible.

## Mat-tree with `childrenAccessor`

When `pp-tree` doesn't expose the feature you need (custom node templates, lazy children loading, deep nesting), drop to Material's `mat-tree` with the `childrenAccessor` API:

```html
<mat-tree #tree [dataSource]="treeData()" [childrenAccessor]="childrenAccessor">
  <mat-tree-node *matTreeNodeDef="let node" matTreeNodePadding>
    <button
      matTreeNodeToggle
      type="button"
      [style.visibility]="node.children.length > 0 ? 'visible' : 'hidden'"
      [attr.aria-label]="(tree.isExpanded(node) ? 'collapse' : 'expand') | translate"
    >
      @if (tree.isExpanded(node)) {
      <i class="pp-icon pp-icon-angle_down"></i>
      } @else {
      <i class="pp-icon pp-icon-angle_right"></i>
      }
    </button>
    <app-tree-node [node]="node" />
  </mat-tree-node>
</mat-tree>
```

```typescript
protected readonly childrenAccessor = (node: TreeNode): TreeNode[] => node.children;
```

Key rules:

- Use `childrenAccessor` (flat rendering), **not** the nested-tree variant with `matTreeNodeOutlet`. Nested rendering is harder to keep in sync with signal data.
- Use `matTreeNodePadding` for indentation.
- Use the `matTreeNodeToggle` directive on the expand/collapse button.
- Auto-expand on load via `effect()` calling `tree.expand(node)` for each node in the desired set.
- Do **not** wrap `matTreeNodeOutlet` in `@if` — children silently won't render.

## Accessibility

`angular-eslint/template` rules break the build when violated. Common ones:

- `click-events-have-key-events` — every `(click)` needs `(keydown.enter)` or `(keydown.space)`.
- `interactive-supports-focus` — clickable elements need `tabindex="0"`.
- `role-has-required-aria` — `role="treeitem"` needs `aria-selected`, `role="checkbox"` needs `aria-checked`, etc.

Pattern for clickable divs masquerading as widgets:

```html
<div
  tabindex="0"
  role="treeitem"
  [attr.aria-selected]="isSelected()"
  (click)="onSelect()"
  (keydown.enter)="onEdit()"
  (keydown.space)="onSelect()"
></div>
```

For real interactive elements, prefer `<button type="button">` over `<div role="button">` — buttons handle keyboard, focus, and a11y for free.

## Testing patterns

### Vitest spec template (for a translated component)

```typescript
import { TestBed } from "@angular/core/testing";
import { provideTranslateService, TranslateModule } from "@ngx-translate/core";
import { axe } from "vitest-axe";
// Resolve the import path from the workspace's shared testing lib (search libs/shared/testing/ or equivalent).
import { formatA11yViolations } from "<workspace-shared-testing>";
import { SomeComponent } from "./some.component";

describe("SomeComponent", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SomeComponent, TranslateModule.forRoot()],
      providers: [provideTranslateService()],
    });
  });

  it("renders", async () => {
    const fixture = TestBed.createComponent(SomeComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it("has no a11y violations", async () => {
    const fixture = TestBed.createComponent(SomeComponent);
    await fixture.whenStable();
    const results = await axe(fixture.nativeElement);
    expect(results.violations, formatA11yViolations(results)).toHaveLength(0);
  }, 15000);
});
```

The `formatA11yViolations` import comes from the workspace's shared testing lib — search `libs/shared/testing/` (or similar) and use whatever helper it exports.

### Test patterns — what to do and what to avoid

| Wrong                                  | Correct                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `fixture.detectChanges()`              | `await fixture.whenStable()`                           |
| `it('...', (done) => { ... done() })`  | `it('...', async () => { await firstValueFrom(...) })` |
| `expect(x!.prop)` (non-null assertion) | `expect(x?.prop)` or `if (x) { expect(x.prop) }`       |

Prefer reading the component's own form model (`fixture.componentInstance['formModel']()`) over scraping the DOM with `querySelectorAll('input').map(i => i.value)`.

### Resilient e2e selectors

Generated tests must survive locale changes. The e2e runner often serves English by default, so any selector that matches a German label or translated string fails non-deterministically.

- **Always emit `data-testid`** on every interactive surface that tests will touch:
  - tabs (`tab-personal`, `tab-address`)
  - action buttons (`btn-cancel`, `btn-ok`, `btn-photo`)
  - every form input (`address-last-name`, `address-postal-code`)
  - the host element (already enforced via `host: { 'data-testid': 'feature-name' }`)
- **Selector rules:**
  - `getByTestId(...)` first.
  - `getByText` / `getByRole({ name })` only for content that is **not** i18n-driven (data values from mock seeds — employee name, postal code, abbreviation).
  - **Never** query by translation key, translated label, or aria-label that comes from a translation.
  - PDX inputs bind `[value]` as a property, not an attribute → use `getByTestId('field').locator('input')` + `toHaveValue(...)`.
  - For `pp-list` items: pp-list automatically renders `id="pp-list-item-<id>"` and `[attr.data-id]`. Use those for stable per-row targeting (no need for custom testids per row).
  - Readonly check: PDX `pp-input` may not propagate `readonly` to the native input as an HTML attribute; assert via `nativeInput.readOnly` (DOM property), not the `[readonly]` attribute selector.

```typescript
test("saves personal info", async ({ page }) => {
  // If the project uses cookie-based mock auth in e2e, set the expected cookie here.
  // Inspect an existing e2e spec for the cookie name / value / domain.
  // await page.context().addCookies([{ name: '<auth-cookie>', value: '<mock-token>', domain: 'localhost', path: '/' }]);
  await page.goto("/#/employee/1");
  await expect(page.getByTestId("employee-detail")).toBeVisible({
    timeout: 10000,
  });

  await page.getByTestId("address-last-name").locator("input").fill("Müller");
  await page.getByTestId("btn-save").click();

  await expect(page.getByTestId("btn-save")).toBeDisabled();
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

- BEM blocks named after the domain concept (`.filter`, `.employee-list`), not the component.
- `:host { display: block; }` on every component.
- Mix BEM (structure) and Tailwind (decoration) on the same element: `<div class="filter__input truncate pl-4 text-left">{{ node.name }}</div>`.
- **SCSS budget:** under 8 KB (error) / under 4 KB (warning) per component. Never `@use` a large package's stylesheet from a component — use Tailwind utilities for decoration.
- **Never** `@use '@pdx/pp-icons/icons'` in a component — that import is global-only (see [pdx-recipes.md](pdx-recipes.md)).

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

Scale: 50 (darkest) to 990 (lightest). 500 is the base.

## Route Pattern

```typescript
{
  path: 'feature-name/:id',
  loadComponent: () => import('./feature-name/feature-name.component').then((c) => c.FeatureNameComponent),
},
```

Add the route to the existing routes file (typically `app.routes.ts` — verify in the target workspace). Lazy-load every feature.

## Dialogs

Open via `MatDialog` with explicit dimensions:

```typescript
this.dialog.open(SomeDialogComponent, {
  width: "36rem", // standard dialog
  // width: '48rem',       // wide dialog (grids/tables)
  // height: '80vh',       // tall dialog (scrollable content)
  data: { id, mode: "edit" },
});
```

Wrap the dialog body in `<pp-dialog>` (see [pdx-recipes.md](pdx-recipes.md)). Use `<mat-dialog-actions>` (not `<pp-form-actions>`) inside `<pp-dialog>` — the dialog shell owns its footer.

## General Rules

- **Semicolons everywhere** (Prettier enforces them — there is no semicolon-free style in this project).
- Single quotes.
- `null` over `undefined` for intentional "no value". Reserve `undefined` for language/framework semantics (`Array.find()` no match, uninitialized variables).
- **`Temporal` is exposed as a global. Do not import it.** Use `Temporal.PlainDate.from(...)`, `Temporal.Now.plainDateISO()` directly.
- **Visibility modifiers on every class member**, including `input()` / `output()`. `public` for outward-facing, `protected` for template-only, `private` for internals.
- **No `@use '@pdx/pp-icons/icons'` in component SCSS** — it's a global-only import.
- **Named constants over magic literals.** Don't write `?? '1'` or `?? 'personal'`; declare a `const DEFAULT_EMPLOYEE_ID = 1` or look up the canonical default in the workspace.
- **Comments explain WHY, never WHAT.** Strip `// Sync store -> local signals` style comments. Keep cross-references to the Delphi source and workaround justifications.
- **No dead code.** Don't `inject(Service)` if the service isn't used yet — emit a `// TODO: inject Service when wiring …` comment instead.

## Reuse pass — search before generating

Before writing a new helper, search the workspace's shared libraries for an existing one. Common candidates:

- **Test-data builders** — search `libs/shared/test-data/` (or similar) for `build<Feature>(...)` builders. Reuse before adding a new one.
- **Translation / locale resolution** — search `libs/shared/translations/` (or similar) for the canonical service. Use `service.language()` rather than hardcoding `'de-CH'`.
- **A11y test helpers** — search `libs/shared/testing/` (or similar) for `formatA11yViolations` or equivalent.
- **Snack-bar duration constants** — search for `SNACK_DURATION_*` constants. Reuse if found; flag for promotion to a shared lib if duplicated across features.
- **Date / Temporal helpers** — `parseIsoPlainDate`, `formatPlainDate`, etc. Extract to `libs/shared/` once a second feature needs the same one.

The aim: zero duplication of cross-feature utilities. The reuse pass runs **before** generating new code, not after.

## Post-generate quality passes

After generating components, services, and stores, run two passes before declaring done.

### Signal-store / reactivity lint pass

Scan generated code for these anti-patterns and rewrite them:

- **Mirror signal + sync effect.** `signal('') + effect(() => mirror.set(store.x()))` is a delayed copy. Either bind the template directly to `store.x()`, or use `computed()`.
- **Two-way constant maps.** `TAB_INDEX_BY_ID: Record<…> = {…}` paired with `TAB_ID_BY_INDEX: …[] = […]` — keep one source of truth, derive the other.
- **`computed()` with zero signal deps.** `computed(() => GENDER_OPTIONS.map(...))` where the body reads only constants is just a cached field — and the cache hides locale changes from `translate.instant()` calls. Demote to a `readonly` field, or read a real signal inside.
- **State writes inside `effect()` without `untracked()`.** When an effect calls `signal.set(...)` or `FormControl.setValue(...)`, wrap in `untracked(() => ...)` to keep the writer out of dependency tracking.
- **Granular dirty flags when only the union is consumed.** If no one outside the store reads `isPersonalInfoDirty` / `isAddressDirty` separately, default to a single `isDirty` derived from a current-vs-loaded comparison.
- **Store exposing raw objects when only a label is consumed.** Move formatting into the store as a single computed (`internalIdsLabel: string`) instead of computing it in every consumer.

### Convention check pass

- **Every class member has a visibility modifier**, including `input()` / `output()`.
- **Named constants over magic literals** (`?? '1'`, `?? 'personal'`, `'' as null sentinel`).
- **No dead injections** — every `inject()` is actually used. If something is parked for later wiring, comment as `// TODO: …` instead.
- **Comments explain WHY**, not WHAT. Strip narrating comments; keep Delphi-cross-reference comments and workaround justifications.
- **Smart-vs-dumb component check** — no child component has both `inject(FeatureStore)` and an `input()` for the same data shape. If it does, lift store access to the parent and pass a slice via `input()`.

## Validation

After generation, read `package.json` for the project's validation script (e.g. `bun run check:strict`, `bun run check`, `npm run validate`). Run it once and address any failures before reporting done. The script typically runs format, lint, test, build, and e2e in one shot.
