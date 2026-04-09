# Playwright Test Conventions

## File Structure & Naming

- Test files: `<feature>.spec.ts` in the project's configured test directory
- One `test.describe` block per feature or user flow
- Group related scenarios inside the same `describe`

```typescript
import { test, expect } from '@playwright/test';
import { BookingPage } from '../pages/booking.page';

test.describe('Booking creation', () => {
  let bookingPage: BookingPage;

  test.beforeEach(async ({ page }) => {
    bookingPage = new BookingPage(page);
    await bookingPage.goto();
  });

  test('should create a booking with valid data', async ({ page }) => {
    // Arrange
    const bookingData = { name: 'Test User', date: '2025-03-15' };

    // Act
    await bookingPage.fillBookingForm(bookingData);
    await bookingPage.submit();

    // Assert
    await expect(bookingPage.successMessage).toBeVisible();
    await expect(bookingPage.successMessage).toHaveText('Booking created');
  });

  test('should show validation error for missing required fields', async () => {
    // Act — submit without filling required fields
    await bookingPage.submit();

    // Assert
    await expect(bookingPage.nameError).toBeVisible();
    await expect(bookingPage.nameError).toHaveText('Name is required');
  });
});
```

## Assertions

Use Playwright's built-in assertions — they auto-retry until timeout:

| Assertion | Use for |
|-----------|---------|
| `toBeVisible()` | Element is on screen |
| `toBeHidden()` | Element is not visible |
| `toHaveText('exact')` | Exact text content |
| `toContainText('partial')` | Partial text match |
| `toHaveValue('val')` | Input field value |
| `toHaveURL(/pattern/)` | Current page URL |
| `toHaveCount(n)` | Number of matching elements |
| `toBeEnabled()` / `toBeDisabled()` | Interactive state |
| `toBeChecked()` | Checkbox/radio state |
| `toHaveAttribute('name', 'value')` | HTML attribute |

Always assert visibility before interacting with an element when there is any doubt:

```typescript
await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
await page.getByRole('button', { name: 'Submit' }).click();
```

## Waiting Strategies

**Prefer Playwright auto-wait** — most actions (`click`, `fill`, `check`) wait automatically for the element to be actionable.

**Use explicit waits only when necessary:**

```typescript
// Wait for navigation after an action
await page.waitForURL('/dashboard');

// Wait for a network request to complete
await page.waitForResponse(resp => resp.url().includes('/api/bookings') && resp.status() === 200);

// Wait for a specific element state
await expect(page.getByTestId('loading-spinner')).toBeHidden();
```

**Never use arbitrary timeouts:**

```typescript
// BAD — flaky and slow
await page.waitForTimeout(3000);

// GOOD — wait for a specific condition
await expect(page.getByTestId('results-table')).toBeVisible();
```

## Environment Parameterization

**Always use relative URLs in tests and POMs.** The base URL comes from `playwright.config.ts`:

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
});
```

```typescript
// In tests and POMs — always relative
await page.goto('/bookings/new');       // GOOD
await page.goto('http://localhost:3000/bookings/new'); // BAD — hardcoded
```

Run against different environments:

```bash
BASE_URL=https://staging.example.com npx playwright test
```

Or use Playwright projects for named environments:

```typescript
projects: [
  { name: 'local', use: { baseURL: 'http://localhost:3000' } },
  { name: 'staging', use: { baseURL: 'https://staging.example.com' } },
],
```

## Authentication Patterns

**Option 1: `storageState` (preferred for multiple tests)**

Save authenticated state once in global setup, reuse across tests:

```typescript
// global-setup.ts
async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: './auth-state.json' });
  await browser.close();
}

// playwright.config.ts
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  use: { storageState: './auth-state.json' },
});
```

**Option 2: `beforeEach` login (for tests that need fresh auth)**

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');
});
```

## Traces & Screenshots on Failure

Configure in `playwright.config.ts` for debugging:

```typescript
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
},
```

View traces: `npx playwright show-trace trace.zip`

## `beforeEach` / `afterEach` Patterns

- Use `beforeEach` for navigation and page object instantiation
- Use `afterEach` sparingly — only for cleanup that Playwright doesn't handle automatically
- Playwright already isolates each test in a fresh browser context — no manual cleanup needed for cookies/storage

```typescript
test.beforeEach(async ({ page }) => {
  bookingPage = new BookingPage(page);
  await bookingPage.goto();
});
```
