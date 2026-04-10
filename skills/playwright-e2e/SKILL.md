---
name: playwright-e2e
description: Use when the user wants to create Playwright end-to-end tests from an annotated codegen recording. The user records a flow with `npx playwright codegen`, gives the test a descriptive name, adds `// assert that` comments, and this skill enriches it with resilient selectors via Chrome exploration and generates Page Object Model tests.
argument-hint: "<path to annotated codegen file>"
disable-model-invocation: true
compatibility: Designed for Claude Code. Requires Chrome browser MCP tools (mcp__claude-in-chrome__*) for selector enrichment. Project must have Playwright installed.
metadata:
  version: "2.0.0"
---

# Playwright E2E Test Creator

Create robust Playwright E2E tests from annotated codegen recordings. Chrome exploration enriches selectors, and the output follows Page Object Model patterns.

**Usage:** `/playwright-e2e <path to annotated codegen file>`

### How it works

1. **Record** the user flow with Playwright codegen:
   ```bash
   npx playwright codegen <url>
   ```
2. **Annotate** the saved file:
   - Rename the test from the default `test('test', ...)` to a descriptive name that captures the overall test intent (e.g., `test('User logs in and creates a new booking', ...)`)
   - Add `// assert that <description>` comments inline at each point where an assertion should occur
3. **Invoke** the skill with the path to the annotated file.

### Example annotated codegen file

```typescript
import { test, expect } from '@playwright/test';

test('User logs in and creates a new booking', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // assert that User is redirected to the dashboard
  await page.goto('http://localhost:3000/bookings/new');
  await page.getByLabel('Name').fill('Team Meeting');
  await page.getByLabel('Date').fill('2025-06-15');
  await page.getByRole('button', { name: 'Create Booking' }).click();
  // assert that Success message is visible
  // assert that New booking appears in the bookings list
});
```

## Hard Rules

- **Every invocation MUST end by asking the user whether to run the tests.** No exceptions. Do not present final output without this question.
- Never hardcode environment URLs in tests or POMs.
- Always check existing POMs before creating new ones.
- Never skip Chrome exploration — real selector discovery produces more resilient tests than guessing.
- The annotated codegen file is the source of truth for the flow. Chrome exploration enriches selectors and page context but does not change the flow unless a discrepancy is found and confirmed with the user.
- Never use raw codegen selectors in the final test — always replace with selectors discovered during Chrome exploration.

## Workflow

### Phase 0: Project Discovery

Automatically scan the project before any user interaction.

1. Parse `$ARGUMENTS` as the path to the annotated codegen file.
2. Search for Playwright configuration:
   - Look for `playwright.config.ts`, `playwright.config.js`
   - Check `package.json` for `@playwright/test` dependency
3. **If Playwright is not installed**, inform the user and stop:
   > "This project does not have Playwright configured. Run `npm init playwright@latest` to set it up, then re-invoke this skill."
4. Read the Playwright config and extract:
   - `baseURL` configuration (how environments are parameterized)
   - Test directory location (`testDir`)
   - Project definitions (browsers, viewports)
   - Global setup/teardown files
   - Custom fixtures
5. Index existing **Page Object Models** — glob for:
   - `**/*.page.ts`, `**/*.po.ts`
   - `**/pages/*.ts`, `**/page-objects/*.ts`
   - Record: file path, class name, which page/URL it covers, public methods
6. Index existing **test files** — glob for `**/*.spec.ts`, `**/*.test.ts` in the test directory. Record: file path, `test.describe` names, individual `test()` names.

### Phase 1: Parse Annotated Codegen

Extract the test specification from the annotated codegen file.

1. Read the file provided in `$ARGUMENTS`.
2. Parse the test name from the `test('...', ...)` call as the test description / overall flow intent.
3. Parse all `// assert that` comments, preserving their position relative to the surrounding codegen actions. Each `// assert that` comment maps to a specific point in the flow where the assertion should fire.
4. Extract the sequence of user actions: navigations (`goto`), clicks, fills, selects, etc.
5. Extract all URLs visited during the flow.
6. **Validate**:
   - The test must have a descriptive name (not the default `'test'`). If the name is still the codegen default, ask the user to rename it.
   - The file must contain at least one `// assert that` comment. If missing, ask the user to add them.
   > "The codegen file needs a descriptive test name (not the default 'test') and at least one `// assert that` comment. See the usage section above for the expected format."
7. Only ask clarifying questions if something is genuinely ambiguous:
   - A URL in the codegen is not covered by any `baseURL` in the Playwright config.
   - The flow includes a login page but no credentials are apparent and no `storageState` is configured.
   - An `// assert that` comment is vague enough that multiple interpretations exist (e.g., `// assert that the data is correct`).
   - Do NOT ask mandatory clarification questions — the codegen file IS the specification.

### Phase 2: Similarity Search

Avoid duplicating existing tests. Find reusable code.

1. Search existing test files for overlapping coverage:
   - URL/route overlap with the target feature
   - Keyword matching against `test.describe` and `test()` names
   - Tests interacting with the same page/component
2. Search existing POMs for pages/components that overlap.
3. **If similar tests are found**, present them:
   ```
   Found existing tests that may overlap:
   1. tests/booking.spec.ts — "should create a new booking" (line 15)
   2. tests/booking.spec.ts — "should validate required fields" (line 42)

   Found existing POMs that can be reused:
   1. pages/booking.page.ts — BookingPage (covers /bookings route)

   Do any of these tests already cover your use case?
   Should I extend an existing test file or create a new one?
   Which existing POMs should I reuse?
   ```
4. **Wait for user response.** If existing tests suffice, stop. Otherwise, note which POMs to reuse and proceed.

### Phase 3: Context Enrichment (Chrome Exploration)

Replay the codegen flow in Chrome to enrich selectors and deepen page understanding. The flow steps come from the codegen file — Chrome exploration validates and enriches, it does not discover the flow.

#### 3a. Open the browser and navigate

1. Call `mcp__claude-in-chrome__tabs_context_mcp` to check current browser state.
2. Call `mcp__claude-in-chrome__tabs_create_mcp` to open a new tab.
3. Call `mcp__claude-in-chrome__navigate` to go to the first URL from the codegen file.
4. If the page redirects to a login screen:
   - Inform the user: "The page requires authentication. Please either log in manually in the Chrome tab and tell me when ready, or provide credentials for me to fill the login form."
   - **Wait for user guidance.**
   - If credentials provided, use `mcp__claude-in-chrome__form_input` and `mcp__claude-in-chrome__computer` to log in.

#### 3b. Replay the flow and enrich at each step

Walk through each action from the codegen file in order. At each page or state change:

1. Use `mcp__claude-in-chrome__read_page` to capture the accessibility tree.
2. Use `mcp__claude-in-chrome__javascript_tool` to extract selector attributes:
   ```javascript
   // Extract all testid and aria attributes for selector mapping
   const elements = document.querySelectorAll('[data-testid], [aria-label], [role]');
   return Array.from(elements).map(el => ({
     tag: el.tagName,
     testId: el.getAttribute('data-testid'),
     ariaLabel: el.getAttribute('aria-label'),
     role: el.getAttribute('role'),
     text: el.textContent?.trim().substring(0, 50),
     type: el.getAttribute('type')
   }));
   ```
3. Use `mcp__claude-in-chrome__read_network_requests` to identify API calls backing the page (useful for assertions like "API returned 200" or understanding data flow).
4. Use `mcp__claude-in-chrome__read_console_messages` to catch any console errors during the flow.
5. Step through the action using `mcp__claude-in-chrome__computer` (click) and `mcp__claude-in-chrome__form_input` (type), then observe the result with `mcp__claude-in-chrome__read_page`.
6. Optionally call `mcp__claude-in-chrome__gif_creator` to record the flow as a GIF for reference.

#### 3c. Build the selector map

For each element the codegen interacts with, find the best available selector. Preference order:
   - `data-testid` (most resilient)
   - `getByRole` with accessible name (semantic)
   - `getByLabel` (form elements)
   - `getByText` (buttons, links)
   - CSS selector (last resort — most brittle)

Map each raw codegen selector to the improved selector found during exploration.

#### 3d. Handle discrepancies

If the live UI does not match the codegen file (e.g., a button label changed, a page no longer exists, an element is missing):
- Report the discrepancy with specifics, e.g.: "The codegen clicks a button labeled 'Submit Order' but the current page has 'Place Order' instead. The form also has a new required 'Delivery Date' field not present in the codegen."
- **Ask the user for guidance.** Should the test use the current UI state? Should the codegen be re-recorded?
- **Wait for user response before proceeding.**

### Phase 4: Test Plan

Present a concrete plan for approval before writing code. Each `// assert that` comment from the codegen file maps to a concrete assertion.

```markdown
## Test Plan: <FLOW description>

### Test file
- Location: `tests/<feature>.spec.ts`
- Extends existing: yes/no (which file)

### Page Object Models
- Reuse: <list of existing POMs to import>
- Create: <list of new POMs with file paths>
  - <NewPage>.page.ts — covers <route>, methods: <list>

### Flow → test mapping
| Codegen action | Enriched selector | Notes |
|----------------|-------------------|-------|
| `page.getByLabel('Email').fill(...)` | `getByRole('textbox', { name: 'Email' })` | data-testid not available |
| `page.getByRole('button', { name: 'Sign in' }).click()` | `getByTestId('login-submit')` | testid found |

### Assertions (from `// assert that` comments)
1. `// assert that User is redirected to the dashboard`
   - After: Sign in button click
   - Assert: `await expect(page).toHaveURL('/dashboard');`

2. `// assert that Success message is visible`
   - After: Create Booking button click
   - Assert: `await expect(bookingPage.successMessage).toBeVisible();`

3. `// assert that New booking appears in the bookings list`
   - After: Success message
   - Assert: `await expect(bookingPage.bookingRows).toContainText('Team Meeting');`

### Selectors discovered
| Element | Selector | Type |
|---------|----------|------|
| Submit button | `data-testid="submit-btn"` | testid |
| Email input | `getByLabel('Email')` | label |

### Environment parameterization
- Base URL: from `playwright.config.ts` baseURL
- Environment-specific: <notes>

### Data prerequisites
- <any test data setup needed>
```

**Wait for user approval before writing code.**

### Phase 5: Generate

#### 5a. Create or update Page Object Models

- Follow the patterns in [references/page-object-pattern.md](references/page-object-pattern.md).
- Place new POMs in the project's established POM directory (discovered in Phase 0).
- For existing POMs: add new methods/locators only — do NOT modify existing methods.
- Every POM must use relative URLs (no hardcoded base URL).

#### 5b. Create the test file

- Follow the patterns in [references/playwright-conventions.md](references/playwright-conventions.md).
- Follow the principles in [references/test-best-practices.md](references/test-best-practices.md).
- Use `test.describe` for grouping related tests.
- Parameterize base URL via Playwright config — never hardcode URLs.
- Use `test.beforeEach` for shared navigation/setup.
- Each `test()` must be independent and isolated.
- Use descriptive test names that read as specifications.
- Follow the AAA pattern: Arrange → Act → Assert.

**After generating all files, you MUST proceed to Phase 6. Do not stop here.**

### Phase 6: Run Tests (MANDATORY — do NOT skip this phase)

**This phase is required after every test creation or edit. You MUST execute it.**

1. Present the generated/modified files to the user.
2. **Ask the user: "Would you like me to run the tests now?"** — You MUST ask this question. Do not end the workflow without asking.
3. If the user says **yes**:
   - Run `npx playwright test <test-file> --reporter=list`
   - If tests fail: diagnose using error output. Use Chrome tools to re-inspect if needed. Fix and re-run.
   - Present pass/fail results to the user.
4. If the user says **no**: acknowledge and end.

**IMPORTANT:** Never finish the skill without completing this phase. If you created or modified any test file, you MUST ask the user whether to run tests before ending.

## Important Notes

- This skill creates tests, not Playwright project scaffolding. The project must already have `@playwright/test` installed.
- Never hardcode environment URLs in tests or POMs. Always use `baseURL` from Playwright config with relative `page.goto()` paths.
- Always check existing POMs before creating new ones. Reuse over duplication.
- The Chrome exploration phase is essential — do not skip it. Real selector discovery produces far more resilient tests than guessing from source code.
- When authentication is needed, always ask the user — never assume credentials.
- **Always ask the user whether to run tests after creating or modifying test files.** This is the final required step of every invocation.

## Reference Files

- **[references/playwright-conventions.md](references/playwright-conventions.md)** — Test file structure, assertions, waiting strategies, environment parameterization, auth patterns
- **[references/page-object-pattern.md](references/page-object-pattern.md)** — POM class structure, selector strategy, method naming, composition, anti-patterns
- **[references/test-best-practices.md](references/test-best-practices.md)** — DRY, KISS, AAA, test isolation, naming, selector resilience, general testing principles
