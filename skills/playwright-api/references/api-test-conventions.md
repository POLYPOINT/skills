# API Test Conventions

## File Structure and Naming

- Test files: `<feature>.api.spec.ts` — the `.api.` distinguishes from E2E tests
- Location: same `testDir` as E2E tests, in an `api/` subdirectory
- One `test.describe` per endpoint or corner case category
- Import `test` and `expect` from a local fixtures file (or from `@playwright/test` directly)

```typescript
import { test, expect } from './fixtures';

test.describe('POST /api/bookings — validation', () => {
  test('should return 400 when name is missing', async ({ bookingsApi }) => {
    // ...
  });

  test('should return 400 when date is empty string', async ({ bookingsApi }) => {
    // ...
  });
});

test.describe('POST /api/bookings — auth edge cases', () => {
  test('should return 401 without auth token', async ({ request }) => {
    // ...
  });
});
```

## APIRequestContext Basics

Playwright provides `request` as a built-in test fixture — an `APIRequestContext` that shares cookies and `baseURL` from `playwright.config.ts`.

```typescript
// GET
const response = await request.get('/api/bookings');

// POST with JSON body
const response = await request.post('/api/bookings', {
  data: { name: 'Test Booking', date: '2025-06-15' },
});

// PUT
const response = await request.put('/api/bookings/42', {
  data: { name: 'Updated Booking' },
});

// PATCH
const response = await request.patch('/api/bookings/42', {
  data: { status: 'cancelled' },
});

// DELETE
const response = await request.delete('/api/bookings/42');

// With query parameters
const response = await request.get('/api/bookings', {
  params: { status: 'active', page: 1, pageSize: 10 },
});

// With custom headers
const response = await request.post('/api/bookings', {
  data: { name: 'Test' },
  headers: { 'X-Custom-Header': 'value' },
});
```

**Always use relative paths.** The `baseURL` comes from config — never hardcode `http://localhost:3000`.

## Reading Responses

```typescript
const response = await request.get('/api/bookings/42');

// Status code
const status = response.status();         // e.g., 200
const statusText = response.statusText(); // e.g., "OK"

// JSON body
const body = await response.json();

// Text body
const text = await response.text();

// Headers
const headers = response.headers();
const contentType = headers['content-type'];

// Check if response is OK (2xx)
const ok = response.ok(); // true if status 200-299
```

## Assertion Patterns

Unlike E2E assertions, API assertions do **not** auto-retry. Use `expect()` for straightforward checks:

```typescript
// Status code
expect(response.status()).toBe(201);

// Response body — specific fields
const body = await response.json();
expect(body).toHaveProperty('id');
expect(body.name).toBe('Test Booking');

// Response body — shape validation
expect(body).toEqual(expect.objectContaining({
  id: expect.any(Number),
  name: expect.any(String),
  createdAt: expect.any(String),
}));

// Error response structure
expect(response.status()).toBe(400);
const error = await response.json();
expect(error).toHaveProperty('message');
expect(error.errors).toContainEqual(
  expect.objectContaining({ field: 'name', message: expect.any(String) })
);

// Array responses
const items = await response.json();
expect(Array.isArray(items)).toBe(true);
expect(items.length).toBeGreaterThan(0);

// Headers
expect(response.headers()['content-type']).toContain('application/json');

// Not found
expect(response.status()).toBe(404);

// Unauthorized
expect(response.status()).toBe(401);
```

## Authentication Patterns

### Option 1: Reuse `storageState` (preferred when E2E auth already exists)

If the project has a `globalSetup` that saves `storageState`, `APIRequestContext` inherits cookies automatically:

```typescript
// playwright.config.ts — already configured for E2E
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    storageState: './auth-state.json',
  },
});
```

No additional setup needed — `request` fixture inherits the auth cookies.

### Option 2: Bearer token via `extraHTTPHeaders`

```typescript
// playwright.config.ts or test.use()
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    extraHTTPHeaders: {
      'Authorization': `Bearer ${process.env.API_TOKEN}`,
    },
  },
});
```

### Option 3: Login in `beforeAll`

```typescript
test.describe('Booking API', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'password' },
    });
    const body = await response.json();
    authToken = body.token;
  });

  test('should create a booking', async ({ request }) => {
    const response = await request.post('/api/bookings', {
      data: { name: 'Test' },
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    expect(response.status()).toBe(201);
  });
});
```

### Option 4: Custom authenticated fixture

```typescript
// fixtures.ts
import { test as base, expect, request as apiRequest } from '@playwright/test';

export const test = base.extend<{ authRequest: APIRequestContext }>({
  authRequest: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      extraHTTPHeaders: {
        'Authorization': `Bearer ${process.env.API_TOKEN}`,
      },
    });
    await use(context);
    await context.dispose();
  },
});
```

### Testing unauthenticated scenarios

For auth corner cases (missing token, expired token), create a **separate unauthenticated request context**:

```typescript
test('should return 401 without auth token', async ({ playwright }) => {
  const unauthRequest = await playwright.request.newContext({
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  });
  const response = await unauthRequest.get('/api/bookings');
  expect(response.status()).toBe(401);
  await unauthRequest.dispose();
});
```

## Environment Parameterization

Same approach as E2E tests:

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
});
```

Run against different environments:

```bash
BASE_URL=https://staging.example.com npx playwright test tests/api/
```

If the API base URL differs from the UI base URL, use a separate env var:

```typescript
use: {
  baseURL: process.env.API_BASE_URL || process.env.BASE_URL || 'http://localhost:3000',
},
```

## Test Data Management

### Create data in setup, clean up after

```typescript
test.describe('Booking update corner cases', () => {
  let bookingId: number;

  test.beforeEach(async ({ bookingsApi }) => {
    const response = await bookingsApi.create({ name: 'Setup Booking', date: '2025-06-15' });
    const body = await response.json();
    bookingId = body.id;
  });

  test.afterEach(async ({ bookingsApi }) => {
    await bookingsApi.delete(bookingId);
  });

  test('should return 400 when updating with empty name', async ({ bookingsApi }) => {
    const response = await bookingsApi.update(bookingId, { name: '' });
    expect(response.status()).toBe(400);
  });
});
```

### Use unique identifiers to avoid collisions

```typescript
const uniqueName = `Test Booking ${Date.now()}`;
```

## General Testing Principles

### AAA Pattern — Arrange, Act, Assert

Structure every test in three distinct sections:

```typescript
test('should return 400 when date is in the past', async ({ bookingsApi }) => {
  // Arrange
  const pastDate = '2020-01-01';

  // Act
  const response = await bookingsApi.create({ name: 'Test', date: pastDate });

  // Assert
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.message).toContain('date');
});
```

### Test Isolation

- Each test must be independent — never rely on another test's side effects.
- No shared mutable state between tests.
- Tests must pass when run individually, in any order, or in parallel.
- If a test creates data, clean it up or use unique identifiers.

### Naming

Test names should read as specifications:

```typescript
// GOOD — describes behavior
test('should return 404 for non-existent booking ID', ...);
test('should return 400 when name exceeds 100 characters', ...);
test('should return 401 when auth token is missing', ...);

// BAD — describes implementation
test('test validation', ...);
test('check 404', ...);
test('auth test', ...);
```

### Single Responsibility

Each test should have **one reason to fail**. Test one corner case per test — don't bundle multiple assertions about different behaviors.

### DRY — but not prematurely

- Use `beforeEach` for common setup (creating prerequisite data).
- Use API helpers to avoid duplicating endpoint URLs across tests.
- Don't extract every string into a constant — inline test data when it helps readability.
- Three similar lines of inline code beat a premature utility function.

### KISS

- One behavior per test. If a test name needs "and", split it.
- No conditional logic in test bodies (`if`/`else` is a code smell).
- Prefer clarity over brevity.
