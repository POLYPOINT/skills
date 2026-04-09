---
name: playwright-api
description: Use when the user wants to generate Playwright API-level corner case tests. Accepts an existing E2E test file or a free-form description, discovers API endpoints, then systematically generates corner case tests using APIRequestContext. No browser interaction.
argument-hint: "<test-file-path or description>"
disable-model-invocation: true
compatibility: Designed for Claude Code. Project must have Playwright installed. No browser MCP tools required.
metadata:
  version: "1.0.0"
---

# Playwright API Corner Case Test Generator

Generate comprehensive API corner case tests using Playwright's `APIRequestContext`. Systematically discover endpoints, then produce tests from a structured corner case catalog.

**Usage:** `/playwright-api <test-file-path or description>`

The argument is either:
- A **path to an existing Playwright E2E test** — the skill reads it, runs it to capture network traffic, analyzes which APIs it exercises, and generates corner case tests for those endpoints.
- A **free-form description** of the API endpoints to test (e.g., `Corner cases for the booking CRUD API`, `Test edge cases on POST /api/users`).

## Hard Rules

- **Every invocation MUST end by asking the user whether to run the tests.** No exceptions.
- Never hardcode base URLs in tests or API helpers.
- Always check existing API tests and helpers before creating new ones.
- Never mock API responses — tests hit real endpoints.
- Always present the discovered API map for user confirmation before generating corner cases.
- Always present the corner case list for user selection before generating test code.
- Never guess at API schemas — discover from code, specs, traces, or ask the user.

## Workflow

### Phase 0: Project Discovery

Automatically scan the project before any user interaction.

1. Parse `$ARGUMENTS` to determine input type:
   - If the argument is a file path that exists on disk and ends in `.spec.ts` or `.test.ts` → **test file mode** (Branch A).
   - Otherwise → **description mode** (Branch B).
2. Search for Playwright configuration:
   - Look for `playwright.config.ts`, `playwright.config.js`
   - Check `package.json` for `@playwright/test` dependency
3. **If Playwright is not installed**, inform the user and stop:
   > "This project does not have Playwright configured. Run `npm init playwright@latest` to set it up, then re-invoke this skill."
4. Read the Playwright config and extract:
   - `baseURL` configuration
   - Test directory location (`testDir`)
   - `globalSetup` / `storageState` (for auth pattern detection)
   - Custom fixtures
5. Scan for existing **API tests and helpers**:
   - Glob: `**/*.api.spec.ts`, `**/*.api.test.ts`
   - Glob: `**/api-helpers/**`, `**/helpers/*.api.ts`
   - Record: file path, describe block names, test names, helper class names
6. Scan for **API route definitions** in source code:
   - Glob: `**/routes/**`, `**/controllers/**`, `**/*.controller.ts`, `**/*.routes.ts`
   - Look for Express routers, NestJS controllers, FastAPI routes, or similar
7. Scan for **API specifications**:
   - Glob: `**/openapi.*`, `**/swagger.*`, `**/*.openapi.yaml`, `**/*.openapi.json`
8. Scan for **DTOs and type definitions**:
   - Glob: `**/dto/**`, `**/schemas/**`, `**/models/**`, `**/types/**`
9. Detect **auth pattern**: check for `storageState` in config, `globalSetup` files, `extraHTTPHeaders`, Bearer token patterns in existing tests.

### Phase 1: Input Analysis

#### Branch A — Test file

1. Read the E2E test file.
2. Read all imported Page Object Models, helpers, and fixtures.
3. Summarize what user flow the E2E test exercises.
4. Extract API-related patterns from the code:
   - `waitForResponse` / `waitForRequest` calls → endpoint URLs and methods
   - `page.route()` / `page.on('request')` → intercepted endpoints
   - URL string literals matching API patterns (`/api/`, `/v1/`, etc.)
   - `fetch()` calls in evaluated scripts
5. Present the initial summary:
   > "This E2E test exercises the booking creation flow. I found these API calls in the code: POST /api/bookings, GET /api/bookings/{id}. I'll run the test next to discover any additional endpoints."

#### Branch B — Description

1. Analyze the description together with project context from Phase 0.
2. Ask the user **3-5 focused questions**, selected based on what is unclear:
   - Which specific API endpoints are involved? (list any you know)
   - What HTTP methods and resource types? (REST CRUD, RPC, GraphQL?)
   - What authentication is required?
   - Are there request/response schemas, DTOs, or type definitions available?
   - What does "success" look like for the happy path?
3. **Wait for answers before proceeding.**

### Phase 2: API Discovery

**Both branches: ask about API specifications first.**

> "Do you have an API specification (OpenAPI/Swagger, Postman collection, or similar) for these endpoints? If so, where is it?"

If the user provides a spec, read and parse it to extract:
- Endpoints (method + path)
- Request schemas (required/optional fields, types, constraints like maxLength, enum, pattern)
- Response schemas per status code
- Authentication requirements

This spec becomes the **primary source of truth** for corner case generation — it reveals constraints that code analysis alone may miss.

#### Branch A — Test file (trace-based discovery)

1. Run the E2E test with trace capture:
   ```
   npx playwright test <file> --trace on --reporter=list
   ```
2. If the test **passes**: parse the trace to extract all HTTP requests:
   - HTTP method and URL path
   - Request headers and body shape
   - Response status code and body shape
   - Build the API endpoint map
3. If the test **fails or cannot run**: inform the user and fall back to the code-only analysis from Phase 1.
4. Merge code-analysis endpoints with trace-discovered endpoints.
5. Cross-reference with the API spec (if provided) to fill in schema details, constraints, and additional endpoints not exercised by the E2E test.

#### Branch B — Description (code-based discovery)

1. Search source code for route definitions matching the described endpoints.
2. Read DTOs/interfaces for request/response shapes.
3. Cross-reference with the API spec (if provided) for complete schema details.

#### Both branches converge

Present the **API Endpoint Map** to the user:

```
## Discovered API Endpoints

| # | Method | Path              | Request Body         | Success Status | Key Constraints       |
|---|--------|-------------------|----------------------|----------------|-----------------------|
| 1 | POST   | /api/bookings     | { name*, date* }     | 201            | name: maxLen 100      |
| 2 | GET    | /api/bookings/:id | —                    | 200            | id: positive integer  |
| 3 | GET    | /api/bookings     | —                    | 200            | paginated, filterable |

* = required field
Auth: Bearer token via storageState
Base URL: from playwright.config.ts

Is this complete? Any endpoints to add or remove?
```

**Wait for user confirmation before proceeding.**

### Phase 3: Corner Case Analysis

1. Load [references/corner-case-catalog.md](references/corner-case-catalog.md).
2. For each confirmed endpoint, walk through every category in the catalog:
   - Check the **Applies to** tag — skip categories that don't match.
   - Generate concrete test case ideas using the endpoint's actual fields and types.
3. If an API spec was provided, use its constraints to generate **more targeted** corner cases:
   - Field has `maxLength: 100` → test lengths 100 (valid), 101 (invalid), and 0 (empty).
   - Field is an enum → test a value not in the enum.
   - Field has a regex pattern → test a string that violates the pattern.
   - Field has min/max range → test at boundaries and beyond.
4. Present the full list grouped by endpoint with category tags:

```
## Corner Cases for POST /api/bookings

### Validation — Required Fields
1. Empty request body → expect 400
2. Missing "name" → expect 400
3. Missing "date" → expect 400
4. Null for "name" → expect 400

### Validation — Boundary Values
5. Name at max length (100 chars) → expect 201
6. Name exceeding max length (101 chars) → expect 400
7. Empty string for "name" → expect 400

### Auth Edge Cases
8. No auth token → expect 401
9. Expired token → expect 401
...

## Corner Cases for GET /api/bookings/:id

### Resource Not Found
10. Non-existent ID → expect 404
11. Non-numeric ID → expect 400
...

Select which corner cases to implement (e.g., "all", "1-9", "skip auth cases"):
```

**Wait for user selection.**

### Phase 4: Similarity Search

Avoid duplicating existing tests. Find reusable code.

1. Search existing API test files for overlapping endpoint coverage:
   - URL/route overlap with discovered endpoints
   - Keyword matching against `test.describe` and `test()` names
2. Search existing API helpers for reusable client classes.
3. **If overlap is found**, present it:
   ```
   Found existing API tests that may overlap:
   1. tests/api/bookings.api.spec.ts — "should validate required fields" (line 15)

   Found existing API helpers that can be reused:
   1. tests/api/helpers/bookings.api.ts — BookingsApi

   Should I extend the existing test file or create a new one?
   Which existing helpers should I reuse?
   ```
4. **Wait for user response.** Note which helpers to reuse and proceed.

### Phase 5: Test Plan

Present a concrete plan for approval before writing code.

```markdown
## Test Plan: <description>

### Files
- Test file: `tests/api/<feature>.api.spec.ts`
- API helper: `tests/api/helpers/<resource>.api.ts` (new / reuse existing)
- Fixtures: `tests/api/fixtures.ts` (new / reuse existing)

### API Helper
- `<ResourceApi>` class wrapping <endpoints>
- Methods: create(), getById(), list(), update(), delete()

### Test Cases (grouped by category)
**describe('POST /api/bookings — validation')**
1. `should return 400 when body is empty` — POST {} → 400
2. `should return 400 when name is missing` — POST { date } → 400
...

**describe('POST /api/bookings — auth edge cases')**
8. `should return 401 without auth token` — POST (no auth) → 401
...

### Auth Strategy
- <detected pattern from Phase 0>

### Data Prerequisites
- <any setup/teardown needed>

### Environment
- Base URL: from playwright.config.ts
```

**Wait for user approval before writing code.**

### Phase 6: Generate

#### 6a. Create or update API helpers

- Follow the patterns in [references/api-helper-pattern.md](references/api-helper-pattern.md).
- Place new helpers in the project's established helper directory (discovered in Phase 0) or `tests/api/helpers/`.
- For existing helpers: add new methods only — do NOT modify existing methods.
- Create or update the fixtures file to wire helpers into tests.

#### 6b. Create the test file

- Follow the patterns in [references/api-test-conventions.md](references/api-test-conventions.md).
- Use `test.describe` to group tests by corner case category.
- Each `test()` must be independent and isolated.
- Use descriptive test names that read as specifications.
- Follow the AAA pattern: Arrange → Act → Assert.
- For corner cases that require intentionally invalid data (wrong types, malformed JSON), bypass the API helper and use `request` directly — helpers enforce correct types.
- Use API helpers for setup/teardown (creating prerequisite data).

**After generating all files, you MUST proceed to Phase 7. Do not stop here.**

### Phase 7: Run Tests (MANDATORY — do NOT skip this phase)

**This phase is required after every test creation or edit. You MUST execute it.**

1. Present the generated/modified files to the user.
2. **Ask the user: "Would you like me to run the tests now?"** — You MUST ask this question. Do not end the workflow without asking.
3. If the user says **yes**:
   - Run `npx playwright test <test-file> --reporter=list`
   - If tests fail: diagnose using error output, fix, and re-run.
   - Present pass/fail results to the user.
4. If the user says **no**: acknowledge and end.

**IMPORTANT:** Never finish the skill without completing this phase. If you created or modified any test file, you MUST ask the user whether to run tests before ending.

## Important Notes

- This skill creates API tests, not Playwright project scaffolding. The project must already have `@playwright/test` installed.
- Never hardcode environment URLs. Always use `baseURL` from Playwright config with relative URL paths.
- Always check existing API helpers before creating new ones. Reuse over duplication.
- API tests use `APIRequestContext` — no browser, no page objects, no selectors.
- When authentication is needed, detect the project's existing auth pattern and follow it.
- **Always ask the user whether to run tests after creating or modifying test files.** This is the final required step of every invocation.

## Reference Files

- **[references/api-test-conventions.md](references/api-test-conventions.md)** — APIRequestContext usage, test file structure, assertions, auth patterns, environment parameterization, general testing principles
- **[references/api-helper-pattern.md](references/api-helper-pattern.md)** — API helper class structure, method naming, fixture integration, composition, anti-patterns
- **[references/corner-case-catalog.md](references/corner-case-catalog.md)** — Systematic catalog of 13 corner case categories with reusable example patterns
