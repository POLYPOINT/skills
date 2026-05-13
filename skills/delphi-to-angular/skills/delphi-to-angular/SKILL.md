---
name: delphi-to-angular
description: Use when converting Delphi VCL views (.dfm/.pas) from the P2 codebase to Angular components. Handles forms, frames, data modules, grids, trees, tabs, and dialogs. Produces Angular components plus any needed store, service, mocks, routes, and tests matching the POLYPOINT saas repo stack.
argument-hint: '[analyze|generate] [path/to/file.dfm] [screenshot-path]'
disable-model-invocation: true
compatibility: Designed for Claude Code. Uses argument-hint and disable-model-invocation Claude Code extensions.
metadata:
  version: '1.9.1'
---

# Delphi-to-Angular Conversion

Converts Delphi VCL views from the P2 codebase into Angular components for the POLYPOINT saas app.

## Usage

```
/delphi-to-angular analyze /path/to/P2/delphi/pep/fEditMitarbeiter.dfm
/delphi-to-angular analyze /path/to/P2/delphi/pep/fEditMitarbeiter.dfm /path/to/screenshot.png
/delphi-to-angular generate
```

## Phase Routing

If `$ARGUMENTS[0]` is **`analyze`** — run the Analyze Phase below.
If `$ARGUMENTS[0]` is **`generate`** — run the Generate Phase below.
Otherwise, show usage examples above and stop.

---

## Analyze Phase

**Input:** `$ARGUMENTS[1]` is the full path to the Delphi `.dfm` file. The `.pas` file is derived from the same path with a `.pas` extension. Optional `$ARGUMENTS[2]` is a screenshot path.

### Step 1: Read Delphi source files

1. Read `$ARGUMENTS[1]` (the `.dfm` file)
2. Read the same path with `.pas` extension
3. If screenshot path provided, read it for visual reference
4. For Delphi patterns and file structure, see [references/delphi-patterns.md](references/delphi-patterns.md)

### Step 2: Follow references

From the PAS `uses` clause, resolve referenced files from the same directory as the input file:

- Read any frames referenced (`fr*.pas` + `.dfm`)
- Read any interface files (`intf*.pas`) to understand data contracts
- Read any data modules (`dm*.pas` + `.dfm`) for SQL queries
- **Read the base class.** If the form derives from a domain-specific base (`TfKnotenGen`, `TfMitarbBase`, etc. — anything beyond `TForm` / `TDBParForm` / `TFrame` / `TDataModule`), open the base PAS + DFM. Base classes typically contribute fields, tabs, and validation that the child silently inherits. See [references/delphi-patterns.md](references/delphi-patterns.md) for `inherited` DFM merging and base-class reading.
- **Trace every `ShowModal` and `CreateForm` call** in the PAS. Each one opens a sub-dialog that needs its own Angular dialog component. List the targets up front so the conversion plan accounts for them.

### Step 2.5: Reuse pass

Before designing new helpers, search the workspace for existing utilities:

- `libs/shared/` (or wherever the workspace keeps shared libs) for builders, translation services, a11y helpers, snack-duration constants, date/Temporal helpers, etc.
- The most-similar existing feature in the app (e.g. an already-converted hierarchy or detail dialog) for tree helpers, lock services, or domain-specific utilities.

Reuse before generating. The point is **zero duplication of cross-feature utilities**.

### Step 3: Parse DFM structure

Extract from the DFM file:

- Component tree (parent/child nesting)
- Component types and key properties (dimensions, captions, alignment, visibility)
- Data bindings: which `TDataSource` links to which `TOraQuery`
- Embedded SQL from `TOraQuery.SQL.Strings`
- Column definitions from `TDBGrid.Columns`
- Tab structure from `TPageControl` + `TTabSheet`

### Step 4: Parse PAS logic

Extract from the PAS file:

- Event handlers and their logic (OnClick, OnChange, OnCreate, etc.)
- Private fields (`F` prefix = state, `i` prefix = interface)
- `Sync*` methods — these become `computed()` signals
- Filter methods (`Apply*Filter`) — these become signal-based filtering
- Public API: properties, setup methods
- Interface dependencies for the data contract

### Step 5: Build conversion plan

For each mapping decision, consult [references/component-mapping.md](references/component-mapping.md).

Translate all German identifiers to English using the domain glossary in component-mapping.md. **Flag any German terms not in the glossary** and ask the user to confirm the translation before proceeding.

Present the conversion plan in this format:

```markdown
## Conversion Plan: <delphi-name> -> <angular-name>

### Components to generate

1. <ComponentName> (<routed|child|dialog>, <purpose>)
   - Mapped from: <Delphi class> (<base class>)
   - Layout: <Delphi layout> -> <Angular layout approach>
   - Contains: <child components, PDX components>

2. <ChildComponentName> (child, <purpose>)
   ...

### Connected dialogs

For each `ShowModal` / `CreateForm` target traced from the PAS, list the resulting Angular dialog component:

1. <DialogComponentName> — opens from <event/button>, <purpose>
2. ...

### Reused utilities

List anything found in the reuse-pass that the generated code will import (test-data builders, translation service, lock service, tree helpers, etc.) so the plan doesn't re-invent them.

### Store

- <StoreName> (signalStore)
  - State: { <property>: <type>, ... }
  - Methods: <method1>, <method2>, ...
  - Optimistic UI: <yes/no — list mutations that need snapshot/rollback>
  - Locking: <yes/no — list resources wrapped in withLock>

### Service

- <ServiceName>
  - <method>(params) -> mocked via MSW / test-data builder, TODO: <HTTP method> <endpoint path>
  - ...

### Form model (if applicable)

- <formName>: signal<{ <field>: <type>, ... }>
  - Validation: <validate() rules>
  - Drives: <what computed signals depend on it>

### Route

- /<route-path> (lazy loaded)

### Translation decisions needed

- "<German term>" -> "<proposed English>"?
- (List any term not in the glossary — wait for user confirmation before generating.)
```

**Wait for user approval before proceeding to generate.**

---

## Generate Phase

**Precondition:** The analyze phase was run in this session and the user approved the conversion plan. If not, ask the user to run analyze first.

### Target location

All files go under the workspace's main app feature directory — typically `apps/<app>/src/app/<feature-name>/`. Verify the exact path by inspecting an existing feature in the same workspace.

For Angular conventions, code patterns, and styling rules, see [references/angular-conventions.md](references/angular-conventions.md). For PDX component recipes (buttons, inputs, form scaffold, layout pitfalls, icons), see [references/pdx-recipes.md](references/pdx-recipes.md).

### Step 1: Create feature directory

```bash
mkdir -p <app-feature-root>/<feature-name>
```

And subdirectories for any child components.

### Step 2: Generate files in dependency order

Generate the files required by the approved conversion plan, following the patterns in [references/angular-conventions.md](references/angular-conventions.md). Component files, component specs, SCSS placeholders, and translation keys are mandatory for generated UI. Store, service, mocks, route, and e2e files are generated only when the plan calls for async data, routed navigation, backend interaction, or routed feature coverage.

Apply the **smart-vs-dumb component rule**: the parent owns the store when a store exists; children take a slice via `input()` and emit via `output()`. A child must not both `inject(FeatureStore)` and receive an `input()` for the same data.

1. **TypeScript interfaces** — for the data model (from Delphi field types and interface contracts).
2. **Service** (`<feature>.service.ts`) — only when backend/data access is needed; `@Injectable({ providedIn: 'root' })`, with TODO endpoint comments.
3. **Service spec** (`<feature>.service.spec.ts`) — only when a service is generated; Vitest, mock HttpClient.
4. **Store** (`<feature>.store.ts`) — only when shared/async feature state is needed; `signalStore(withState(...), withMethods(...))`, `rxMethod` for async. Apply optimistic UI / locking patterns where the Delphi source needs them (see angular-conventions.md).
5. **Store spec** (`<feature>.store.spec.ts`) — only when a store is generated; Vitest, mock service or builder.
6. **Tree / immutable helpers** if applicable (`<feature>.tree.utils.ts`) — pure functions for `addChildToTree`, `removeNodeFromTree`, etc.
7. **Child components** (dumb) — bottom-up, each with .ts, .html, .scss, .spec.ts. `data-testid` on every interactive surface.
8. **Parent component** (`<feature>.component.ts`, `.html`, `.scss`) — imports children, wires store, owns `data-testid` host attribute.
9. **Parent spec** (`<feature>.component.spec.ts`) — Vitest. Include the axe a11y assertion (see angular-conventions.md).

### Step 2.5: Generate translation keys

For every user-visible string the new components introduce, add a translation key under a feature namespace (`hierarchy.title`, `hierarchy.add_child`).

1. Discover the workspace's i18n folder once. The folder is commonly under `apps/<app>/public/assets/i18n/` in Nx layouts and `src/assets/i18n/` in classic Angular CLI layouts — search for an `i18n` directory containing locale JSON files (`find . -type d -name i18n`, or grep for an existing translation key).
2. List every locale file present (`de-CH.json`, `en.json`, `fr.json`, etc.).
3. Add the new key to **every** locale file. Use English as the placeholder for any locale you can't translate confidently and note those as TODO in the final summary.

Do not hardcode any user-visible string in templates or TypeScript — `TranslatePipe` for templates, `TranslateService.instant(...)` for snackbars / dynamic labels.

### Step 2.6: Generate mock API / fixtures

If the generated feature has service-backed data, search the workspace for an existing MSW setup (`mock-api`, `msw/handlers`, `setupWorker`).

- **If MSW exists**, mirror the existing handler pattern: handler file per feature, in-memory store seeded with realistic fixtures, registered in the existing index file. Realistic data: 10+ tree nodes, 4+ list items, real-looking domain names.
- **If MSW is not present**, generate a builder in the workspace's shared test-data lib (`libs/shared/test-data/` or similar — discover the location), exported and shared by the service mock and every spec. No inline duplication.

### Step 3: Add route

For routed features only, add a lazy-loaded route to the workspace's main routes file (typically `app.routes.ts` — find it by inspecting an existing routed feature):

```typescript
{
  path: '<feature-path>',
  loadComponent: () => import('./<feature-name>/<feature-name>.component').then((c) => c.<ComponentName>),
},
```

### Step 4: Generate e2e + a11y tests

For every routed feature, generate a paired e2e spec at the workspace's e2e app (typically `apps/<app>-e2e/src/<feature>.spec.ts` — find it by inspecting an existing e2e spec). Dialog-only child components do not need their own e2e spec unless the approved plan explicitly asks for one. At minimum:

- route loads and the host testid is visible
- every top-level testid renders
- no console errors on initial load
- if the project uses cookie-based mock auth in e2e, set the cookie the e2e harness expects — inspect existing e2e specs in the workspace for the cookie name, value, and domain.

Selectors must be locale-resilient: `getByTestId(...)` first; never query by translation key, translated label, or aria-label that comes from a translation.

For every component spec, include the axe a11y assertion (see the spec template in angular-conventions.md). Project policy is zero a11y violations.

### Step 5: Post-generate quality passes

Run two lint passes over the generated code before reporting done. Both are documented in [references/angular-conventions.md](references/angular-conventions.md).

- **Signal-store / reactivity lint pass.** Catch mirror-signal+effect copies, dep-less `computed()`, missing `untracked()` around state writes inside `effect()`, granular dirty flags no one reads, and stores exposing raw objects when only a label is consumed.
- **Convention check pass.** Visibility modifiers on every member (including `input()` / `output()`), named constants over magic literals, no dead injections, comments explain WHY not WHAT, smart-vs-dumb component check (no child both `inject()`s a store and exposes an `input()` for the same data).

### Step 6: Validate

Read `package.json` for the project's validation script and run it. Common names:

- `bun run check:strict`
- `bun run check`
- `npm run validate`

Fix any failures (format, lint, test, build, e2e) before presenting the result. If no validation script is defined, fall back to `bun run lint && bun run test`.

### Step 7: Present result

List all generated files with a one-line description of each. Highlight:

- Decisions made during generation (translation choices, optimistic UI scope, locking applied).
- TODO items that need backend work (HTTP endpoints, real auth).
- Locales that received the English placeholder rather than a real translation.

---

## Supporting Files

### Reference Files

- **[references/component-mapping.md](references/component-mapping.md)** — Delphi VCL → Angular component mapping tables and German-English domain glossary. Load during analyze phase.
- **[references/delphi-patterns.md](references/delphi-patterns.md)** — P2 Delphi codebase structure, file naming, DFM/PAS anatomy, `inherited` keyword, base-class reading, ShowModal tracing. Load during analyze phase.
- **[references/angular-conventions.md](references/angular-conventions.md)** — Angular patterns (component, store, signal forms, i18n, testing, a11y, smart-vs-dumb components, optimistic UI, locking, mat-tree, post-generate lint passes). Load during generate phase.
- **[references/pdx-recipes.md](references/pdx-recipes.md)** — PDX component recipes, icon naming, layout pitfalls, width-control rule, two-column layout, right-rail aside. Load during generate phase.

### Example Files

- **[examples/sample-conversion.md](examples/sample-conversion.md)** — Complete worked example converting fChooseMonthRange to choose-month-range.
