# API Helper Pattern

API helpers encapsulate endpoint URLs and request construction behind a clean interface — the API equivalent of Page Object Models. Tests call helper methods instead of raw `request.get()`/`request.post()`, so when endpoints change you update one helper instead of every test.

## Class Structure

```typescript
import { APIRequestContext, APIResponse } from '@playwright/test';

interface CreateBookingRequest {
  name: string;
  date: string;
  roomId?: number;
}

export class BookingsApi {
  constructor(private request: APIRequestContext) {}

  async create(data: CreateBookingRequest): Promise<APIResponse> {
    return this.request.post('/api/bookings', { data });
  }

  async getById(id: number): Promise<APIResponse> {
    return this.request.get(`/api/bookings/${id}`);
  }

  async list(params?: { status?: string; page?: number; pageSize?: number }): Promise<APIResponse> {
    return this.request.get('/api/bookings', { params });
  }

  async update(id: number, data: Partial<CreateBookingRequest>): Promise<APIResponse> {
    return this.request.put(`/api/bookings/${id}`, { data });
  }

  async delete(id: number): Promise<APIResponse> {
    return this.request.delete(`/api/bookings/${id}`);
  }
}
```

## Key Design Rules

- **Return raw `APIResponse`**, not parsed JSON. Let the test decide what to assert on (`response.status()`, `response.json()`, `response.headers()`).
- **Use relative URLs only.** The `baseURL` comes from `playwright.config.ts`.
- **Accept typed request objects.** Define interfaces for request bodies — no `any`.
- **One helper class per resource/endpoint group.** `BookingsApi`, `UsersApi`, `RoomsApi` — not one giant `ApiHelper`.
- **File naming:** `<resource>.api.ts` (no `.spec` suffix). Place in `tests/api/helpers/` or alongside test files.

## Method Naming Conventions

| Method type | Pattern | Examples |
|-------------|---------|----------|
| Create | `create(data)` | `create({ name: 'Test' })` |
| Read one | `getById(id)` | `getById(42)` |
| Read many | `list(params?)` | `list({ status: 'active' })` |
| Update (full) | `update(id, data)` | `update(42, { name: 'Updated' })` |
| Update (partial) | `patch(id, data)` | `patch(42, { status: 'cancelled' })` |
| Delete | `delete(id)` | `delete(42)` |
| Custom action | Verb describing action | `activate(id)`, `assign(id, userId)` |

## Fixture Integration

Wire helpers into Playwright tests using custom fixtures:

```typescript
// tests/api/fixtures.ts
import { test as base, expect } from '@playwright/test';
import { BookingsApi } from './helpers/bookings.api';
import { UsersApi } from './helpers/users.api';

type ApiFixtures = {
  bookingsApi: BookingsApi;
  usersApi: UsersApi;
};

export const test = base.extend<ApiFixtures>({
  bookingsApi: async ({ request }, use) => {
    await use(new BookingsApi(request));
  },
  usersApi: async ({ request }, use) => {
    await use(new UsersApi(request));
  },
});

export { expect };
```

Usage in tests:

```typescript
import { test, expect } from './fixtures';

test('should return 404 for non-existent booking', async ({ bookingsApi }) => {
  const response = await bookingsApi.getById(999999);
  expect(response.status()).toBe(404);
});
```

## Composition

When tests span multiple resources, inject multiple helpers:

```typescript
test('should create booking for existing user', async ({ usersApi, bookingsApi }) => {
  // Arrange — create a user first
  const userResponse = await usersApi.create({ name: 'Test User', email: 'test@example.com' });
  const user = await userResponse.json();

  // Act — create booking for that user
  const response = await bookingsApi.create({ name: 'Team Meeting', date: '2025-06-15', userId: user.id });

  // Assert
  expect(response.status()).toBe(201);
});
```

## Sending Raw / Malformed Requests

For corner case tests that send intentionally invalid data (wrong types, missing Content-Type, malformed JSON), **bypass the helper** and use `request` directly. Helpers enforce correct types — corner case tests need to violate them:

```typescript
test('should return 400 for malformed JSON body', async ({ request }) => {
  const response = await request.post('/api/bookings', {
    data: 'not valid json',
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(400);
});
```

Use helpers for setup/teardown (creating prerequisite data) and `request` directly for the corner case assertion.

## Anti-Patterns

| Anti-pattern | Why it's bad | Do this instead |
|-------------|-------------|-----------------|
| Assertions inside helpers | Couples test logic to helper, hides failures | Return `APIResponse`, assert in test |
| Hardcoded URLs | Breaks across environments | Relative paths — `baseURL` from config |
| Parsing JSON inside helpers | Hides response details from test | Return raw `APIResponse` |
| Single giant `ApiHelper` class | Hard to maintain, violates single responsibility | One class per resource group |
| Storing state between method calls | Hidden coupling, breaks test isolation | Let the test manage state |
| Helper methods with `any` types | Loses type safety, allows silent bugs | Define typed interfaces for requests |
