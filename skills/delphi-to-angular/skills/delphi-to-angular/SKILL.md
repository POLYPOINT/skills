---
name: delphi-to-angular
description: Use when converting Delphi VCL views (.dfm/.pas) from the P2 codebase to Angular components. Handles forms, frames, data modules, grids, trees, tabs, and dialogs. Produces Angular components plus any needed store, service, mocks, routes, and tests matching the POLYPOINT saas repo stack. Extracts business rules from Delphi code, Oracle procedures, and DB constraints into rule cards that are enforced in the MSW handlers handed off to the backend team.
argument-hint: '[analyze|generate] [path/to/file.dfm] [screenshot-path] [path/to/PolylangSoluling.ntp]'
disable-model-invocation: true
compatibility: Designed for Claude Code. Uses argument-hint and disable-model-invocation Claude Code extensions.
metadata:
  version: '1.16.0'
---

# Delphi-to-Angular Conversion

Converts Delphi VCL views from the P2 codebase into Angular components for the POLYPOINT saas app.

## Usage

```
/delphi-to-angular analyze /path/to/P2/delphi/pep/fEditMitarbeiter.dfm
/delphi-to-angular analyze /path/to/P2/delphi/pep/fEditMitarbeiter.dfm /path/to/screenshot.png
/delphi-to-angular analyze /path/to/P2/delphi/pep/fEditMitarbeiter.dfm /path/to/P2/delphi/language/soluling/PolylangSoluling.ntp
/delphi-to-angular generate
```

Any argument ending in `.ntp` is treated as the Soluling translation project file, regardless of its position. If omitted, the skill probes the default path `<p2-repo>/delphi/language/soluling/PolylangSoluling.ntp` and, failing that, asks the user.

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
- **Read string-resource units.** Any unit in the `uses` clause that looks like a strings container (`strres`, `str*`, `*Strings`, `*Const`, etc.) holds `resourcestring` constants the form/frame references in code (snackbars, dialog titles, validation messages). Read those `.pas` files so every German string the form can produce is in scope for the Soluling file located in Step 2.6 (the lookup itself happens in generate Step 2.5).
- **Resolve every server-side routine.** For each `StoredProcName = 'X'` in a DFM and each `BEGIN X(:…); END;` in the PAS, open `<p2-repo>/shared/db/<schema>/procs/X.sql`. For each table the form writes, open its Liquibase `TABLE_*.xml`, `INDEX_*.xml`, and `CONSTRAINT_*.xml` in the saas repo. This is where derivations, unique keys, and cascades live — none of them appear in the DFM or PAS.

### Step 2.5: Reuse pass

Before designing new helpers, search the workspace for existing utilities:

- `libs/shared/` (or wherever the workspace keeps shared libs) for builders, translation services, a11y helpers, snack-duration constants, date/Temporal helpers, etc.
- The most-similar existing feature in the app (e.g. an already-converted hierarchy or detail dialog) for tree helpers, lock services, or domain-specific utilities.

Reuse before generating. The point is **zero duplication of cross-feature utilities**.

### Step 2.6: Locate the Soluling translation file

The P2 Delphi apps all share a single Soluling translation project: `<p2-repo>/delphi/language/soluling/PolylangSoluling.ntp`. This file is the authoritative source for every German UI string and its existing translations across all locales (`de-CH`, `en`, `fr`, …). The Angular conversion reuses those translations rather than re-translating from scratch.

1. **Resolve the path.** Use the first source available, in this order:
   1. Any `$ARGUMENTS` value ending in `.ntp`.
   2. The default `<p2-repo>/delphi/language/soluling/PolylangSoluling.ntp` derived from the input DFM path (walk up to the `p2` repo root).
   3. **Ask the user** for the path if neither of the above resolves to an existing file. Do not proceed to Step 3 without it.
2. **Read the file.** `PolylangSoluling.ntp` is a Soluling project file (XML-like text). Each translatable string appears with a stable key/ID, a source value (typically German), and translated values per locale. Skim once to learn the key shape and the set of locales present — this is the shape you will look up against in the Generate phase.
3. **Note the file path** so the Generate phase can re-read it without re-asking.

### Step 2.7: Detect runtime-generated UI (fields that exist in no DFM)

Some forms render fields that appear in **no** `.dfm`/`.pas` at all — they are built at runtime from database definitions and are often license-gated; skipping this check has dropped entire field groups from past conversions. Check every form for the signals listed in [references/delphi-patterns.md](references/delphi-patterns.md) § Runtime-generated UI:

- `frFeldItems` in the `uses` clause, a `TFeldItemsFrame` field, or `.Anbindung :=` assignments
- a `TTabSheet` with no child controls in the DFM (something populates it at runtime)
- SQL touching `FELDITEMTYP` / `FELDITEMS`, `GetDfId` calls, or `TDfEd` controls
- `Lizenz.*Active` checks in the PAS (license-gated UI that a demo system may not show)

When detected, enumerate the concrete fields from the Liquibase seed `DATA_FELDITEMTYP.csv` (filter by the form's `ANBINDUNG`, note `BEZEICHNUNG`, `DATENTYP`, `AUSWAHLWERTE`, `REQUIRED_KEY`) and carry them into the **Runtime-generated / license-gated fields** section of the conversion plan. Do not proceed to Step 3 with an empty tab left unexplained.

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
- **`OnDblClick` handlers** — list each one separately. Double-click does not exist in the web app (undiscoverable, no touch support, invisible to screen readers); each handler's action must be re-homed to an explicit affordance (row action button, kebab/context menu entry, or selection + toolbar action). See component-mapping.md § Events.
- **Validation logic** — empty-checks before save, `raise` / `ECMessage` guards, `iChecker.DoCheck` chains. These identify the mandatory fields (→ `[required]` asterisk) and the `validate()` rules; validation fires only after the first save attempt (see angular-conventions.md § Signal Forms). **Message-bearing checks are a minority of the rules** — Step 4.5 covers the silent ones (derived columns, unique keys, triggers, WHERE-clause eligibility). Do not treat this bullet as the rule inventory.
- Private fields (`F` prefix = state, `i` prefix = interface)
- `Sync*` methods — these become `computed()` signals
- Filter methods (`Apply*Filter`) — these become signal-based filtering
- Public API: properties, setup methods
- Interface dependencies for the data contract

### Step 4.5: Business-rule extraction

The DFM/PAS sweep in Steps 3–4 finds rules that **produce a message**. It is structurally blind to rules enforced by an Oracle procedure, a unique index, a trigger, a derived column, or a WHERE clause — which in P2 is most of them. Skipping this step is how a rule reaches neither the Angular app (it is not UI) nor the backend team (the MSW handler stays plain CRUD). Full method, greps, worked example, and tooling caveats: [references/business-logic-extraction.md](references/business-logic-extraction.md).

**Set `export LC_ALL=C` first.** P2 sources are ISO-8859-1; under a UTF-8 locale grep silently skips most of the tree (measured: 592 vs 1,708 matching files).

Run sweep 0 first (exclude rules already externalized to the cloud API — `ls rest/*.pas`, `grep -rn 'PPAPI'`; don't re-port those), then all seven sweeps below. Record the result of each — including "none found", so the reviewer knows the sweep ran:

1. **Reported rules** — grep `Strres.pas` (or the form's strings unit) for rule verbs (`darf`, `muss`, `kann nicht`, `nicht erlaubt`, `bereits`, `ueberschneid`, `ungueltig`), then grep each `rs_*` id back to its enforcement site. Note the `ECMessage` button set: `[mbOK]` is a hard stop, `[mbYes,mbNo]` is user-overridable — that distinction is part of the rule.
2. **Server-side logic** — `grep -rn "StoredProcName" --include='*.dfm' --include='*.pas'`, `grep -rnE "BEGIN +[A-Z0-9_]+\(:"`, and inline Oracle functions in DFM SQL. **For every routine found, open `<p2-repo>/shared/db/<schema>/procs/<NAME>.sql` and read it.** These have no Delphi source; a form-only sweep sees nothing at all.
3. **DB constraints** — for every table the feature writes, open the Liquibase `INDEX_*.xml` (`unique="true"`) and `CONSTRAINT_*.xml` change-sets. A unique key on a _start_ date with an unconstrained end date means the end date is derived — find the procedure that derives it.
4. **Triggers** — `grep -rn -i '\btrigger\b' --include='*.pas'` (German comments naming the trigger). **431 of 602 ECBERN triggers short-circuit for `JDBC Thin Client`** — they do not fire for the Java backend, so every rule they carry must be re-homed explicitly.
5. **Embedded + dynamic SQL** — DFM `SQL.Strings` and `SQL.Text :=` / `MacroByName`. Classify each predicate: validity resolution, status-code filter, eligibility, derivation, ordering. Re-join DFM `' +` line continuations before matching.
6. **Sentinels, config, and permissions** — `cInfiniteDate` (= 2999-12-31, **not** NULL), `-1` = "rule disabled", `PEPOptions.` / `objSpital.` / `IPEPConflictSettings.ReadFor(nodeId)` (which rules are active is per-tenant DB data), `RightManager.HasRight*`, `LizenzChecker`, `SPERRUNG` locking, `DbIncreaseVersionId`.
7. **Existing spec** — `ls tests/PolyTest.Tests.*.pas` for DUnit units covering this domain; port their cases before the implementation.

Then, for each rule found, **classify** it with the decision tree in the reference doc and write a **rule card** in the format defined there (`@backend-rule` … `@confidence`). Assign ids `<FEATURE>-001`, `-002`, … in discovery order; ids are permanent.

**Representability gate.** Before finishing, check each backend-invariant card against the data model about to be designed: can the wire model and the mock store express the rule's `@scope` tuple? If the model collapses a dimension the rule ranges over (a singular field where the rule needs a list, a store keyed on a subset of the scope tuple), that is a **model defect, not a documentation problem** — raise it as a `-000` card and fix the model. A rule whose scope the model cannot represent cannot be documented, mocked, or tested; it can only be lost.

Do not proceed to Step 5 with an unresolved `model-blocked` card that has no `-000` counterpart.

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

### Double-click replacements

For each `OnDblClick` handler found in the PAS, state the explicit affordance that replaces it (never a `(dblclick)` binding):

1. <Delphi control>.OnDblClick (<action>) -> <row kebab menu entry | inline action icon-button | selection + toolbar button>
2. ...

### Runtime-generated / license-gated fields

For each field discovered in Step 2.7 (user-defined FELDITEMTYP fields, license-gated controls), list: label, control type derived from `DATENTYP`, picklist values, license keys from `REQUIRED_KEY` / `Lizenz.*` checks, and the conversion decision (first-class form field | generic user-defined-fields UI | out of scope — confirm with the user). If Step 2.7 found nothing, state "none detected" so the reviewer knows the check ran:

1. <label> (<control type>, license key <id|none>) -> <decision>
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

### Backend contract / business rules

Rules extracted in Step 4.5. This section is the handoff to the Java backend team — the MSW handler generated in Generate Step 2.6 carries these annotations verbatim, and the backend team transcribes them into OpenAPI + Java weeks later.

**Model representability**

- Scope tuples the wire model must support: <e.g. `(paCode, nodeId, validFrom)` — a LIST of validity windows per shift per node, not a single `validity` field>
- Model changes required before any rule can be stated: <or "none">

**Rules to enforce in the mock handler** (`@mock implemented`)

| Id     | Statement (one line) | Kind      | Error      | Delphi evidence  |
| ------ | -------------------- | --------- | ---------- | ---------------- |
| XX-001 | ...                  | invariant | 409 `CODE` | `<file>:<lines>` |

**Rules carried but not enforceable in the mock** (`@mock documented-only` / `model-blocked`)

| Id     | Statement | Why not enforceable | Delphi evidence  |
| ------ | --------- | ------------------- | ---------------- |
| XX-004 | ...       | ...                 | `<file>:<lines>` |

**Rules the frontend also checks** (immediate feedback only — never authoritative)

| Id  | Field(s) | Validator | Backend remains the gate |
| --- | -------- | --------- | ------------------------ |

**Error contract**

| Rule id | Status | `code` | `field` | i18n key |
| ------- | ------ | ------ | ------- | -------- |

Never let the store infer meaning from the status alone. A 409 on save can mean duplicate, over-length, a stale lock, or a referential failure — the frontend must branch on `code`.

**Sentinels and conventions crossing the wire**

- Open-ended date: <`cInfiniteDate` 2999-12-31 vs `null` — state the decision and where it is normalised>
- Disabled-rule sentinel, status codes, persisted enum ordinals that must not be reordered.

**Rules needing user confirmation** (`@confidence inferred | assumed`)

- XX-00N: <question>

**Server-side artefacts with no Angular counterpart** — Oracle procedures, JDBC-bypassed triggers, cache-version bumps, locks. List each with its Delphi path so the backend team can see them.

### Form model (if applicable)

- <formName>: signal<{ <field>: <type>, ... }>
  - Mandatory fields: <fields derived from PAS empty-checks — get `[required]` asterisk + gated validator>
  - Validation: <validate() rules — all gated on the `submitted` signal, errors appear only after the first save attempt>
  - Drives: <what computed signals depend on it>

### Route

- /<route-path> (lazy loaded)

### Translations (Soluling)

- Soluling source: <resolved .ntp path>
- Locales present in .ntp: <de-CH, en, fr, …>

Strings found in Soluling — will be written to every locale JSON during generate:

- `<feature.key>` <- "<German source>" (from <DFM component | strres constant>)
- ...

Strings NOT found in Soluling — will be intentionally skipped so the human translator catches them in Transifex:

- "<German source>" (from <DFM component | strres constant>) — no matching .ntp entry
- ...

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

### Step 2.5: Populate translation keys from Soluling

For every user-visible string the new components introduce, add a translation key under a feature namespace (`hierarchy.title`, `hierarchy.add_child`). Values for each locale come from the Soluling project file located in the analyze phase — **not** from re-translation.

1. **Discover the workspace's i18n folder once.** Commonly under `apps/<app>/public/assets/i18n/` (Nx) or `src/assets/i18n/` (CLI). Search for an `i18n` directory containing locale JSON files (`find . -type d -name i18n`).
2. **List every locale file present** (`de-CH.json`, `en.json`, `fr.json`, etc.).
3. **Open `PolylangSoluling.ntp`** at the path resolved in analyze Step 2.6. For each German source string the generated components or strres-derived constants need, look it up by source value (and, where applicable, by Delphi component / resourcestring name) to find the matching Soluling entry.
4. **For each Soluling match:** write the Angular feature key into **every** locale JSON file, using the Soluling translation for that locale. If the .ntp has `de-CH` and `fr` but the app also ships `en`, copy the values for the locales that exist in both, and skip the locales the .ntp does not provide.
5. **For each German string with no Soluling match:** do **not** write any locale entry for that key — not even an English placeholder, not even the German source. Leaving the key absent across all locale files is intentional: the next Transifex sync flags it as a new missing string so the human translator authors it once. Track these in the post-generate summary so the developer knows what to expect in Transifex.
6. **Keys in locale JSON files are flat** — `{ "hierarchy.title": "…" }`, not `{ "hierarchy": { "title": "…" } }`. Match the project's existing casing (snake vs kebab, feature-prefixed or not) and reuse shared namespaces like `common.save` / `common.cancel` rather than minting feature-local duplicates.

Do not hardcode any user-visible string in templates or TypeScript — `TranslatePipe` for templates, `TranslateService.instant(...)` for snackbars / dynamic labels. The component templates still reference keys (`'hierarchy.title' | translate`) whether or not the locale file has a value yet — `ngx-translate` falls back to the key itself when a value is missing, which is exactly the signal the human translator needs.

### Step 2.6: Generate mock API, fixtures, and rule enforcement

The MSW handler is not a stub — **it is the specification the Java backend team reads.** The OpenAPI spec and the Java service are hand-written from the mock and its fixtures weeks later, by someone who did not write the mock. Anything absent from the handler is absent from the backend.

If the generated feature has service-backed data, search the workspace for an existing MSW setup (`mock-api`, `msw/handlers`, `setupWorker`).

- **If MSW exists**, mirror the existing handler pattern: handler file per feature, in-memory store seeded with realistic fixtures, registered in the existing index file. Realistic data: 10+ tree nodes, 4+ list items, real-looking domain names.
- **If MSW is not present**, generate a builder in the workspace's shared test-data lib (`libs/shared/test-data/` or similar — discover the location), exported and shared by the service mock and every spec. No inline duplication.

Then apply the four rule-carrying requirements below. First find the workspace's best rule-carrying handlers and mirror them: grep the handlers directory for conflict responses (`grep -rln "status: 409\|code:" <handlers-dir>`) and pick the ones that enforce a domain rule and return a coded body — not the plain-CRUD ones. Rule kinds to look for in an exemplar: a temporal "at most one per period" rule **with its cascade**, system-row immutability with `409 {code:'IN_USE'}`, lock and child-reference conflicts (see the reference doc for the exemplars found at the time of writing). Full annotation format and rationale: [references/business-logic-extraction.md](references/business-logic-extraction.md).

1. **File-level JSDoc.** Every handler opens with which Delphi form and which DB table it stands in for — it is the first thing the backend team reads.

2. **One `@backend-rule` block per rule from the conversion plan**, immediately above the code that implements it (or above the store/type it concerns, when `documented-only`). Use all rule-card fields from the reference doc's format (`@backend-rule <id> <title>`, `@statement`, `@scope`, `@kind`, `@layer`, `@delphi`, `@p2-behaviour`, `@error`, `@i18n`, `@mock`, `@openapi`, `@test`, `@confidence`, and `@question` on inferred/assumed cards). Rules the mock cannot execute still get a block, with `@mock documented-only: <reason>` or `@mock model-blocked: <reason + blocking id>`. **Never omit a rule because the mock cannot enforce it** — an unwritten rule and a nonexistent rule are indistinguishable in a handler file, and that indistinguishability is the entire failure mode this step exists to prevent.

3. **Implement every rule marked `@mock implemented`**, returning the typed `RuleViolation` conflict body defined in the reference doc (`{ code, ruleId, field?, message }` — `code` is a stable enum like `'DUPLICATE_VALID_FROM'`, `ruleId` joins handler ↔ spec ↔ i18n ↔ the eventual Java guard, `message` is English for logs and never rendered). The Angular store must branch on `code`, never on the bare status, and the resulting error path must be wired into the UI now: the app needs it anyway the moment the real backend enforces the rule, and inferring meaning from a bare 409 is a live bug (an over-length title rejected by the DB rendered to the user as "title already in use").

4. **Generate `<feature>.handlers.spec.ts` with one test slot per rule id.** `@mock implemented` rules get a real `it('<ID> <statement>', ...)` derived from `@test` — plain vitest, no custom tooling. `documented-only` and `model-blocked` rules get `it.todo('<ID> <statement>')` so the rule occupies a named, visible slot in every test run. Keep the handler and the spec in step when adding or removing a rule — PR review is the gate, deliberately: the handler plus its spec IS the handoff artifact, and a bespoke sync script was tried and retired because the ceremony cost more than the drift it prevented. Do not generate a separate rules document — everything the backend team needs lives in the handler they already read.

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
- **Convention check pass.** Visibility modifiers on every member (including `input()` / `output()`), named constants over magic literals, no dead injections, comments explain WHY not WHAT, smart-vs-dumb component check (no child both `inject()`s a store and exposes an `input()` for the same data), no `(dblclick)` bindings (every Delphi double-click action re-homed to an explicit affordance), form validators gated on the `submitted` signal, mandatory fields carry `[required]`.

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
- **PDX library gaps:** every workaround applied around a `pp-*` component's behavior (CSS fighting internals, DOM queries into component markup, re-implemented inputs/outputs, sizing/focus patches) — name the component, the missing behavior, the workaround, and whether the behavior should be implemented in the library instead, so the user can decide to file a PDX improvement. See pdx-recipes.md § Report PDX library gaps.
- **Soluling outcome:** translation keys populated from `PolylangSoluling.ntp` (by locale) vs. keys intentionally left absent across all locale files so the human translator authors them in Transifex. List each absent key with its German source so the developer can sanity-check before the next Transifex push.
- **Business rules carried to the backend:** count of rules enforced in the mock, count carried as `documented-only` / `model-blocked` (with reasons), and every rule whose `@confidence` is `inferred` or `assumed` — list these as explicit questions for the user, since a wrong rule in an executable mock propagates faster than a wrong comment.

---

## Supporting Files

### Reference Files

- **[references/component-mapping.md](references/component-mapping.md)** — Delphi VCL → Angular component mapping tables and German-English domain glossary. Load during analyze phase.
- **[references/delphi-patterns.md](references/delphi-patterns.md)** — P2 Delphi codebase structure, file naming, DFM/PAS anatomy, `inherited` keyword, base-class reading, ShowModal tracing, runtime-generated UI (FeldItems / license gating). Load during analyze phase.
- **[references/business-logic-extraction.md](references/business-logic-extraction.md)** — where P2 hides business logic (18 location classes), the seven-sweep extraction pass, tooling caveats (encoding, DFM line continuation), the frontend/backend classification tree, the rule-card format, and the MSW `@backend-rule` annotation + error contract. Load during analyze Step 4.5 and generate Step 2.6.
- **[references/angular-conventions.md](references/angular-conventions.md)** — Angular patterns (component, store, signal forms incl. validation-after-first-submit and required-asterisk rules, i18n, testing, a11y, smart-vs-dumb components, optimistic UI, locking, mat-tree, post-generate lint passes). Load during generate phase.
- **[references/pdx-recipes.md](references/pdx-recipes.md)** — PDX component recipes, icon naming, layout pitfalls, width-control rule, two-column layout, right-rail aside, row-actions (double-click replacement), snackbar. Load during generate phase.

### Example Files

- **[examples/sample-conversion.md](examples/sample-conversion.md)** — Complete worked example converting fChooseMonthRange to choose-month-range.
