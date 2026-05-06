# Sample Conversion: fChooseMonthRange -> choose-month-range

A small worked example that demonstrates the conventions end-to-end. For larger conversions, the same patterns scale up — see [../references/angular-conventions.md](../references/angular-conventions.md) for stores, optimistic UI, locking, mat-tree, etc., and [../references/pdx-recipes.md](../references/pdx-recipes.md) for PDX layout structure.

## Input: Delphi Source

### DFM (simplified)

```
object frmChooseMonthRange: TfrmChooseMonthRange
  BorderStyle = bsToolWindow
  Caption = 'Choose Month Range'
  ClientHeight = 126
  ClientWidth = 263

  object lblVonMonat: TLabel
    Caption = 'From:'

  object lblBisMonat: TLabel
    Caption = 'To:'

  object edFirstMonth: TECMonthEdit
    CustomDisplayFormat = 'MMMM YYYY'

  object edLastMonth: TECMonthEdit
    CustomDisplayFormat = 'MMMM YYYY'

  object ButtonPanel: TButtonPanel
    VisibleButtons = [bbOk, bbCancel]
```

### PAS (simplified)

```pascal
type
  TfrmChooseMonthRange = class(TDBParForm)
    lblVonMonat: TLabel;
    lblBisMonat: TLabel;
    edFirstMonth: TECMonthEdit;
    edLastMonth: TECMonthEdit;
    ButtonPanel: TButtonPanel;
    procedure edMonthExit(Sender: TObject);
  private
    function GetFirstMonth: TDatetime;
    function GetLastMonth: TDatetime;
    procedure SetFirstMonth(const Value: TDatetime);
    procedure SetLastMonth(const Value: TDatetime);
  public
    property FirstMonth: TDatetime read GetFirstMonth write SetFirstMonth;
    property LastMonth: TDatetime read GetLastMonth write SetLastMonth;
  end;

procedure TfrmChooseMonthRange.edMonthExit(Sender: TObject);
begin
  if edFirstMonth.Date.Date > edLastMonth.Date.Date then
  begin
    if Sender = edFirstMonth then
      edLastMonth.Date.Date := edFirstMonth.Date.Date
    else
      edFirstMonth.Date.Date := edLastMonth.Date.Date;
  end;
end;
```

---

## Analyze Output

```
## Conversion Plan: fChooseMonthRange -> choose-month-range

### Components to generate
1. ChooseMonthRangeComponent (dialog)
   - Mapped from: TfrmChooseMonthRange (TDBParForm with bsToolWindow)
   - Layout: simple vertical stack with two month-picker fields and action buttons
   - Contains: 2x mat-form-field + matInput type="month" (no PDX month picker yet), pp-button x2 inside mat-dialog-actions

### Connected dialogs
- None traced from the PAS

### Reused utilities
- None — simple dialog, no shared helpers needed yet

### Store
- Not needed (simple dialog, no async data)

### Service
- Not needed (no data fetching)

### Form model
- monthRangeForm: signal<{ firstMonth: string, lastMonth: string }>
  - Validation: both required; firstMonth <= lastMonth (custom validate())
- Drives: confirm() compares the two and closes the dialog with Temporal.PlainYearMonth values

### Route
- None (opened as MatDialog from a parent feature)

### Translation decisions needed

List the user-visible strings that need a translation key, without prescribing a specific namespace. Inspect the workspace's existing locale files and propose keys that follow the project's convention (flat vs nested, kebab vs snake, feature-prefixed vs not). Ask the user if no convention is clear.

- "Choose Month Range" — dialog title
- "From:" / "To:" — month-picker labels
- "OK" / "Cancel" — action button labels (likely belong in an existing shared/common namespace if the project already has one)
- Validation messages: "Start month is required", "End month is required"
```

---

## Generate Output

### choose-month-range.component.ts

```typescript
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, requiredError, validate } from '@angular/forms/signals';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { PPButtonComponent } from '@pdx/pp-button';

interface MonthRangeData {
  firstMonth: string;
  lastMonth: string;
}

export interface MonthRangeResult {
  firstMonth: Temporal.PlainYearMonth;
  lastMonth: Temporal.PlainYearMonth;
}

@Component({
  selector: 'app-choose-month-range',
  imports: [FormField, PPButtonComponent, MatDialogModule, MatFormFieldModule, MatInputModule, TranslatePipe],
  templateUrl: './choose-month-range.component.html',
  styleUrl: './choose-month-range.component.scss',
  host: { 'data-testid': 'choose-month-range' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChooseMonthRangeComponent {
  private readonly dialogRef = inject(MatDialogRef<ChooseMonthRangeComponent, MonthRangeResult | null>);

  private readonly model = signal<MonthRangeData>({
    firstMonth: Temporal.Now.plainDateISO().toPlainYearMonth().toString(),
    lastMonth: Temporal.Now.plainDateISO().toPlainYearMonth().toString(),
  });

  protected readonly monthRangeForm = form(this.model, (schema) => {
    validate(schema.firstMonth, (ctx) => {
      const value = ctx.value();
      if (!value?.trim()) {
        return requiredError({
          message: 'choose_month_range.first_month_required',
        });
      }
      return null;
    });

    validate(schema.lastMonth, (ctx) => {
      const value = ctx.value();
      if (!value?.trim()) {
        return requiredError({
          message: 'choose_month_range.last_month_required',
        });
      }
      return null;
    });
  });

  protected confirm(): void {
    const data = this.model();
    const first = Temporal.PlainYearMonth.from(data.firstMonth);
    const last = Temporal.PlainYearMonth.from(data.lastMonth);

    if (Temporal.PlainYearMonth.compare(first, last) > 0) {
      // Mirror the Delphi edMonthExit guard — silently keep the range valid.
      return;
    }

    this.dialogRef.close({ firstMonth: first, lastMonth: last });
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}
```

Notes:

- `Temporal` is a global — no import.
- Visibility modifiers on every member (`private readonly dialogRef`, `protected readonly monthRangeForm`).
- `OnPush` change detection.
- Validators use `validate()` + `requiredError()`. Error messages are translation keys, not raw English.

### choose-month-range.component.html

> **Heads up — this sample predates the canonical `pp-dialog` recipe.** New conversions should wrap the dialog body in `<pp-dialog>` and let it render the title and confirm/dismiss buttons (see the `pp-dialog` section in `pdx-recipes.md`). The `<h2 mat-dialog-title>` + `<mat-dialog-content>` + `<mat-dialog-actions>` pattern shown below is a fallback only when migrating a legacy dialog that isn't ready for the `pp-dialog` shell yet.

```html
<h2 mat-dialog-title data-testid="choose-month-range-title">{{ 'choose_month_range.title' | translate }}</h2>

<mat-dialog-content class="month-range">
  <mat-form-field class="month-range__field">
    <mat-label>{{ 'choose_month_range.from' | translate }}</mat-label>
    <input matInput type="month" data-testid="choose-month-range-from" [formField]="monthRangeForm.firstMonth" />
  </mat-form-field>

  <mat-form-field class="month-range__field">
    <mat-label>{{ 'choose_month_range.to' | translate }}</mat-label>
    <input matInput type="month" data-testid="choose-month-range-to" [formField]="monthRangeForm.lastMonth" />
  </mat-form-field>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <pp-button
    [label]="'common.cancel' | translate"
    variant="text"
    data-testid="choose-month-range-cancel"
    (click)="cancel()"
  />
  <pp-button
    [label]="'common.ok' | translate"
    variant="filled"
    data-testid="choose-month-range-ok"
    (click)="confirm()"
  />
</mat-dialog-actions>
```

Notes:

- Every interactive surface has a `data-testid` so e2e tests don't query by translated text.
- `pp-button` uses `[label]` binding with the translate pipe — never content projection.
- `<mat-dialog-actions>` (not `<pp-form-actions>`) because this sample uses the legacy Material dialog shell. New conversions should use `<pp-dialog>` and let it own the footer; see the `pp-dialog` recipe in `pdx-recipes.md`.
- Month picker uses Material's `<input matInput type="month">` — no native PDX month picker yet.

### choose-month-range.component.scss

```scss
:host {
  display: block;
}

.month-range {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 16rem;

  &__field {
    width: 100%;
  }
}
```

No `@use '@pdx/pp-icons/icons';` — that import is global-only (in the app's root `styles.scss`). For PDX layout structure, see [../references/pdx-recipes.md](../references/pdx-recipes.md).

### choose-month-range.component.spec.ts

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService, TranslateModule } from '@ngx-translate/core';
import { axe } from 'vitest-axe';
// Path varies per workspace — resolve from the shared testing lib.
import { formatA11yViolations } from '<workspace-shared-testing>';
import { ChooseMonthRangeComponent } from './choose-month-range.component';

describe('ChooseMonthRangeComponent', () => {
  let component: ChooseMonthRangeComponent;
  let fixture: ComponentFixture<ChooseMonthRangeComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ChooseMonthRangeComponent, TranslateModule.forRoot()],
      providers: [{ provide: MatDialogRef, useValue: mockDialogRef }, provideTranslateService()],
    }).compileComponents();

    fixture = TestBed.createComponent(ChooseMonthRangeComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('renders the dialog title key (TranslateModule.forRoot resolves keys to themselves)', () => {
    const title = fixture.nativeElement.querySelector('[data-testid="choose-month-range-title"]');
    expect(title?.textContent?.trim()).toBe('choose_month_range.title');
  });

  it('closes with null on cancel', () => {
    component['cancel']();
    expect(mockDialogRef.close).toHaveBeenCalledWith(null);
  });

  it('has no a11y violations', async () => {
    const results = await axe(fixture.nativeElement);
    expect(results.violations, formatA11yViolations(results)).toHaveLength(0);
  }, 15000);
});
```

Notes:

- `await fixture.whenStable()` instead of `fixture.detectChanges()`.
- Asserts on the **translation key** (`choose_month_range.title`), not German or English text — `TranslateModule.forRoot()` doesn't load JSON.
- Axe a11y assertion is part of every component spec.
- `formatA11yViolations` is imported from the workspace's shared testing lib — find the canonical path by inspecting an existing spec.

### Translation keys to add

Add the new keys to **every** locale file in the workspace's i18n folder (discover via `find . -type d -name i18n` or by inspecting an existing locale file).

The shape below is **illustrative** — match the project's existing namespace structure (flat vs nested, snake vs kebab, feature-prefixed or not). Inspect a few existing keys before deciding. If the project already has a `common` / `shared` namespace for OK/Cancel, reuse it instead of duplicating.

```json
{
  "choose_month_range": {
    "title": "Choose Month Range",
    "from": "From",
    "to": "To",
    "first_month_required": "Start month is required",
    "last_month_required": "End month is required"
  }
}
```

Use English as the placeholder for any locale you can't translate confidently and flag those as TODO in the conversion summary.
