# Page Object Model Pattern

## Purpose

Page Object Models (POMs) encapsulate page structure and interactions behind a clean API. Tests call POM methods instead of using raw selectors, so when the UI changes you update one POM instead of every test.

## Class Structure

```typescript
import { type Locator, type Page, expect } from '@playwright/test';

export class BookingPage {
  // --- Locators (readonly, defined in constructor) ---
  readonly page: Page;
  readonly nameInput: Locator;
  readonly dateInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly nameError: Locator;
  readonly bookingRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByLabel('Name');
    this.dateInput = page.getByLabel('Date');
    this.submitButton = page.getByRole('button', { name: 'Create Booking' });
    this.successMessage = page.getByTestId('success-message');
    this.nameError = page.getByTestId('name-error');
    this.bookingRows = page.getByTestId('booking-row');
  }

  // --- Navigation ---
  async goto() {
    await this.page.goto('/bookings/new'); // Always relative URL
  }

  // --- Actions ---
  async fillBookingForm(data: { name: string; date: string }) {
    await this.nameInput.fill(data.name);
    await this.dateInput.fill(data.date);
  }

  async submit() {
    await this.submitButton.click();
  }

  // --- Queries ---
  async getBookingCount(): Promise<number> {
    return this.bookingRows.count();
  }

  // --- Assertion helpers ---
  async expectSuccessMessage(text: string) {
    await expect(this.successMessage).toBeVisible();
    await expect(this.successMessage).toHaveText(text);
  }
}
```

## Selector Preference Order

Choose selectors in this order — each level is less resilient than the one above:

| Priority | Selector type | Example | Why |
|----------|--------------|---------|-----|
| 1 | `data-testid` | `page.getByTestId('submit-btn')` | Dedicated test attribute, immune to UI text/style changes |
| 2 | Role + name | `page.getByRole('button', { name: 'Submit' })` | Semantic, tied to accessibility — changes only if UX changes |
| 3 | Label | `page.getByLabel('Email')` | Good for form fields, tied to visible label text |
| 4 | Text | `page.getByText('Create Booking')` | Readable but breaks on copy changes |
| 5 | CSS selector | `page.locator('.btn-primary')` | Last resort — breaks on style refactors |

**Never use:**
- Auto-generated class names (e.g., `mat-mdc-form-field-123`, `ng-star-inserted`)
- Deeply nested CSS paths (`div > div > span.label`)
- XPath (hard to read, fragile)

## Method Naming Conventions

| Method type | Naming pattern | Example |
|-------------|---------------|---------|
| Navigation | `goto()`, `goToDetail(id)` | `await page.goto()` |
| Actions | Verb describing user action | `fillForm()`, `clickSubmit()`, `selectOption()`, `toggleFilter()` |
| Queries | `get` prefix, returns data | `getRowCount()`, `getErrorText()` |
| Assertion helpers | `expect` prefix | `expectSuccessMessage()`, `expectRowCount()` |

## Composition: Page and Component Objects

When a page contains reusable components (e.g., a data table, a modal, a sidebar), extract component objects:

```typescript
export class DataTable {
  readonly rows: Locator;
  readonly searchInput: Locator;

  constructor(private root: Locator) {
    this.rows = root.getByTestId('table-row');
    this.searchInput = root.getByRole('searchbox');
  }

  async search(term: string) {
    await this.searchInput.fill(term);
  }

  async getRowCount(): Promise<number> {
    return this.rows.count();
  }
}

export class BookingListPage {
  readonly page: Page;
  readonly table: DataTable;

  constructor(page: Page) {
    this.page = page;
    this.table = new DataTable(page.getByTestId('bookings-table'));
  }

  async goto() {
    await this.page.goto('/bookings');
  }
}
```

## Anti-Patterns

| Anti-pattern | Why it's bad | Do this instead |
|-------------|-------------|-----------------|
| Assertions inside POM action methods | Couples test logic to POM, makes failures harder to trace | Put assertions in tests or dedicated `expect*` helper methods |
| Hardcoded URLs (`http://localhost:3000/...`) | Breaks across environments | Use relative URLs — `baseURL` comes from config |
| `page.waitForTimeout(ms)` | Flaky and slow | Wait for a specific condition (`toBeVisible`, `waitForURL`, `waitForResponse`) |
| Storing state between POM method calls | Creates hidden coupling | Return values from methods, let the test manage state |
| Giant POMs with every possible interaction | Hard to maintain, violates KISS | Split into focused page + component objects |
| Raw selectors in tests | Duplicates POM's job, breaks DRY | Always go through POM locators and methods |
