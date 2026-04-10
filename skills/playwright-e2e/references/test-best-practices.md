# E2E Test Best Practices

## Core Principles

### DRY — Don't Repeat Yourself

- Extract repeated navigation and setup into `test.beforeEach`
- Reuse Page Object Models instead of duplicating selectors across tests
- Use shared fixtures for common test data (e.g., test users, standard form data)
- When two tests share identical setup, factor it into a helper — but only after the duplication actually exists (see KISS)

### KISS — Keep It Simple, Stupid

- One behavior per test — if a test name needs "and", split it into two tests
- Minimal setup — only arrange what this specific test needs
- Avoid over-abstracting: three similar lines of inline code beat a premature utility function
- No conditional logic in tests (`if`/`else` in test bodies is a code smell — write separate tests)
- Prefer clarity over brevity: a 10-line test that reads top-to-bottom beats a 3-line test that calls a magic helper

### AAA Pattern — Arrange, Act, Assert

Structure every test in three distinct sections:

```typescript
test('should show error for invalid email', async ({ page }) => {
  // Arrange — set up preconditions
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  // Act — perform the action under test
  await loginPage.fillEmail('not-an-email');
  await loginPage.submit();

  // Assert — verify the expected outcome
  await expect(loginPage.emailError).toBeVisible();
  await expect(loginPage.emailError).toHaveText('Please enter a valid email');
});
```

Keep each section focused. If Arrange is longer than Act + Assert combined, consider whether setup belongs in `beforeEach`.

## Test Isolation

- **Each test must be independent.** Never rely on another test running first.
- **No shared mutable state.** Playwright creates a fresh browser context per test by default — use this.
- **No test ordering.** Tests must pass when run individually, in any order, or in parallel.
- **Clean data assumptions.** If a test creates data, it should not assume that data persists for the next test.

## Naming

Test names should read as specifications — describe the expected behavior, not the implementation:

```typescript
// GOOD — describes behavior
test('should display error when submitting empty form', ...);
test('should redirect to dashboard after successful login', ...);
test('should disable submit button while request is pending', ...);

// BAD — describes implementation
test('test form validation', ...);
test('click login button', ...);
test('check button state', ...);
```

Use `test.describe` to group by feature or user flow:

```typescript
test.describe('User registration', () => {
  test('should create account with valid data', ...);
  test('should reject duplicate email', ...);
  test('should require password confirmation match', ...);
});
```

## Selector Resilience

Why selector choice matters for E2E tests:

| Selector type | Resilience | Breaks when... |
|--------------|------------|-----------------|
| `data-testid` | High | Attribute is deliberately removed |
| `getByRole` | High | Accessibility semantics change |
| `getByLabel` | Medium | Label text changes |
| `getByText` | Low-Medium | Any copy change |
| CSS class | Low | Style refactor, framework upgrade |

**Rules:**
- Prefer `data-testid` for elements without clear semantic roles
- Use `getByRole` with accessible name for buttons, links, headings, form controls
- Never select by auto-generated classes (`ng-star-inserted`, `mat-mdc-*`, `css-1a2b3c`)
- If a suitable selector doesn't exist, add a `data-testid` to the source code

## Waiting & Timing

- **Never use `page.waitForTimeout()`** — it makes tests slow and flaky
- **Trust auto-wait** — `click()`, `fill()`, `check()` wait for actionability automatically
- **Assert visibility before conditional interaction:**
  ```typescript
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Confirm' }).click();
  ```
- **Wait for network when actions trigger API calls:**
  ```typescript
  const responsePromise = page.waitForResponse('**/api/bookings');
  await bookingPage.submit();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  ```

## Single Responsibility

Each test should have **one reason to fail**:

```typescript
// BAD — tests two behaviors, unclear which failed
test('should handle form submission', async ({ page }) => {
  await loginPage.fillEmail('invalid');
  await loginPage.submit();
  await expect(loginPage.emailError).toBeVisible();     // validation behavior
  await loginPage.fillEmail('valid@test.com');
  await loginPage.fillPassword('password');
  await loginPage.submit();
  await expect(page).toHaveURL('/dashboard');            // login behavior
});

// GOOD — separate tests, clear failure signals
test('should show error for invalid email', async ({ page }) => {
  await loginPage.fillEmail('invalid');
  await loginPage.submit();
  await expect(loginPage.emailError).toBeVisible();
});

test('should redirect to dashboard after valid login', async ({ page }) => {
  await loginPage.fillEmail('valid@test.com');
  await loginPage.fillPassword('password');
  await loginPage.submit();
  await expect(page).toHaveURL('/dashboard');
});
```

## Readability Over Cleverness

- Inline test data when it helps understand the test (don't extract every string into a constant)
- Use descriptive variable names: `validBookingData` not `d1`
- Prefer explicit steps over chained one-liners
- Add a brief comment only when the "why" isn't obvious from the code
