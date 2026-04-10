---
name: playwright-e2e
description: Use when the user wants to create Playwright end-to-end tests, write E2E tests, add browser tests, or create integration tests with Playwright. Uses Chrome browser exploration to discover real selectors and follows Page Object Model patterns.
argument-hint: "<test description>"
disable-model-invocation: true
compatibility: Designed for Claude Code. Requires Chrome browser MCP tools (mcp__claude-in-chrome__*) for UI exploration. Project must have Playwright installed.
metadata:
  version: "1.0.0"
---

# Playwright E2E Test Creator

Create robust Playwright E2E tests by exploring the live UI in Chrome, discovering real selectors, and following Page Object Model patterns.

**Usage:** `/playwright-e2e <test description>`

The argument is a free-form description of the test to create (e.g., `User can create a new booking and see it in the list`, `Login fails with invalid credentials and shows error message`).

## Hard Rules

- **Every invocation MUST end by asking the user whether to run the tests.** No exceptions. Do not present final output without this question.
- Never hardcode environment URLs in tests or POMs.
- Always check existing POMs before creating new ones.
- Never skip Chrome exploration — real selector discovery produces more resilient tests than guessing.

## Workflow

### Phase 0: Project Discovery

Automatically scan the project before any user interaction.

1. Parse `$ARGUMENTS` as the test description.
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

### Phase 1: Clarification

Resolve ambiguities before investing time in exploration.

1. Analyze the test description together with project context from Phase 0.
2. Ask the user **3-5 focused questions**, selected based on what is unclear:
   - What is the URL/route for the feature being tested?
   - Does the test require authentication? If so, what role/credentials?
   - Which environment URL should be used for Chrome exploration? (list the base URLs found in config as options)
   - Should the test cover only the happy path, or also error/edge-case scenarios?
   - Are there data prerequisites (test users, seeded data, specific application state)?
   - Is this a new feature or does it modify existing tested behavior?
3. **Wait for answers before proceeding.**

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

### Phase 3: Chrome Exploration

Navigate the actual UI to discover real selectors and verify the test description matches reality.

#### 3a. Navigate to the target page

1. Call `mcp__claude-in-chrome__tabs_context_mcp` to check current browser state.
2. Call `mcp__claude-in-chrome__tabs_create_mcp` to open a new tab.
3. Call `mcp__claude-in-chrome__navigate` to go to the target URL (environment URL from Phase 1).
4. If the page redirects to a login screen:
   - Inform the user: "The page requires authentication. Please either log in manually in the Chrome tab and tell me when ready, or provide credentials for me to fill the login form."
   - **Wait for user guidance.**
   - If credentials provided, use `mcp__claude-in-chrome__form_input` and `mcp__claude-in-chrome__computer` to log in.

#### 3b. Map the page structure

1. Use `mcp__claude-in-chrome__read_page` to capture DOM structure.
2. Use `mcp__claude-in-chrome__find` to locate elements described in the test (buttons, forms, inputs, tables, modals).
3. Use `mcp__claude-in-chrome__javascript_tool` to extract selector attributes:
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
4. Build a **selector map** for each element the test will interact with. Selector preference order:
   - `data-testid` (most resilient)
   - `getByRole` with accessible name (semantic)
   - `getByLabel` (form elements)
   - `getByText` (buttons, links)
   - CSS selector (last resort — most brittle)

#### 3c. Walk through the user flow

1. Step through each action using `mcp__claude-in-chrome__computer` (click) and `mcp__claude-in-chrome__form_input` (type).
2. After each action, call `mcp__claude-in-chrome__read_page` to observe state changes (new elements, modals, navigation, success/error messages).
3. Call `mcp__claude-in-chrome__read_console_messages` to check for console errors during the flow.
4. Optionally call `mcp__claude-in-chrome__gif_creator` to record the flow as a GIF for reference.

#### 3d. Handle inconsistencies

If the UI does not match the user's description:
- Report the discrepancy with specifics, e.g.: "Your description says to click 'Submit Order' but the button is labeled 'Place Order'. The form also has a required 'Delivery Date' field not mentioned in your description."
- **Ask the user for guidance.** Should the test use actual UI labels? Are extra fields in scope?
- **Wait for user response before proceeding.**

### Phase 4: Test Plan

Present a concrete plan for approval before writing code.

```markdown
## Test Plan: <test description>

### Test file
- Location: `tests/<feature>.spec.ts`
- Extends existing: yes/no (which file)

### Page Object Models
- Reuse: <list of existing POMs to import>
- Create: <list of new POMs with file paths>
  - <NewPage>.page.ts — covers <route>, methods: <list>

### Test cases
1. `should <happy path description>`
   - Navigate to <url>
   - <action> → <expected result>
   - Assert: <assertion>

2. `should <edge case>` (if applicable)
   ...

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
