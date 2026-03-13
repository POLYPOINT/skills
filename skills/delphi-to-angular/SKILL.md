---
name: delphi-to-angular
description: Use when converting Delphi VCL views (.dfm/.pas) from the P2 codebase to Angular components. Handles forms, frames, data modules, grids, trees, tabs, and dialogs. Produces full Angular features (component + store + service + tests) matching the POLYPOINT saas repo stack.
argument-hint: "[analyze|generate] [path/to/file.dfm] [screenshot-path]"
disable-model-invocation: true
compatibility: Designed for Claude Code. Uses argument-hint and disable-model-invocation Claude Code extensions.
metadata:
  version: "1.1.0"
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
   - Contains: <child components, material components>

2. <ChildComponentName> (child, <purpose>)
   ...

### Store
- <StoreName> (signalStore)
  - State: { <property>: <type>, ... }
  - Methods: <method1>, <method2>, ...

### Service
- <ServiceName>
  - <method>(params) -> mocked, TODO: <HTTP method> <endpoint path>
  - ...

### Form model (if applicable)
- <formName>: signal<{ <field>: <type>, ... }>
  - Validation: <rules>
  - Drives: <what computed signals depend on it>

### Route
- /<route-path> (lazy loaded)

### Translation decisions needed
- "<German term>" -> "<proposed English>"?
```

**Wait for user approval before proceeding to generate.**

---

## Generate Phase

**Precondition:** The analyze phase was run in this session and the user approved the conversion plan. If not, ask the user to run analyze first.

### Target location

All files go into: `apps/pep/src/app/<feature-name>/`

For Angular conventions, code patterns, and styling rules, see [references/angular-conventions.md](references/angular-conventions.md).

### Step 1: Create feature directory

```bash
mkdir -p apps/pep/src/app/<feature-name>
```

And subdirectories for any child components.

### Step 2: Generate files in dependency order

Generate each file following the patterns in [references/angular-conventions.md](references/angular-conventions.md):

1. **TypeScript interfaces** — for the data model (from Delphi field types and interface contracts)
2. **Service** (`<feature>.service.ts`) — `@Injectable({ providedIn: 'root' })`, mock data with TODO endpoint comments
3. **Service spec** (`<feature>.service.spec.ts`) — Vitest, mock HttpClient
4. **Store** (`<feature>.store.ts`) — `signalStore(withState(...), withMethods(...))`, `rxMethod` for async
5. **Store spec** (`<feature>.store.spec.ts`) — Vitest, mock service
6. **Child components** (if any) — bottom-up, each with .ts, .html, .scss, .spec.ts
7. **Parent component** (`<feature>.component.ts`, `.html`, `.scss`) — imports children, wires store
8. **Parent spec** (`<feature>.component.spec.ts`) — Vitest

### Step 3: Add route

Add a lazy-loaded route to `apps/pep/src/app/app.routes.ts`:

```typescript
{
  path: '<feature-path>',
  loadComponent: () => import('./<feature-name>/<feature-name>.component').then((c) => c.<ComponentName>),
},
```

### Step 4: Validate

```bash
bun run lint
bun run test
```

Fix any lint errors or test failures before presenting the result.

### Step 5: Present result

List all generated files with a one-line description of each. Highlight any decisions made during generation and any TODO items that need backend work.

---

## Supporting Files

### Reference Files

- **[references/component-mapping.md](references/component-mapping.md)** — Delphi VCL to Angular component mapping tables and German-English domain glossary. Load during analyze phase.
- **[references/angular-conventions.md](references/angular-conventions.md)** — saas repo code conventions, complete code patterns for components, stores, services, tests, and styling. Load during generate phase.
- **[references/delphi-patterns.md](references/delphi-patterns.md)** — P2 Delphi codebase structure, file naming, DFM/PAS anatomy. Load during analyze phase.

### Example Files

- **[examples/sample-conversion.md](examples/sample-conversion.md)** — Complete worked example converting fChooseMonthRange to choose-month-range.
