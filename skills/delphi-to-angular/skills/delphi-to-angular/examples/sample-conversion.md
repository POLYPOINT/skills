# Sample Conversion: fChooseMonthRange -> choose-month-range

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
   - Layout: simple vertical stack with two date fields and action buttons
   - Contains: 2x mat-form-field with matDatepicker, mat-dialog-actions

### Store
- Not needed (simple dialog, no async data)

### Service
- Not needed (no data fetching)

### Form model
- monthRangeForm: signal<{ firstMonth: string, lastMonth: string }>
  - Validation: firstMonth <= lastMonth (custom validator)
  - Both fields required

### Route
- None (opened as MatDialog)
```

---

## Generate Output

### choose-month-range.component.ts

```typescript
import { Component, inject, signal } from '@angular/core'
import { form, FormField, required } from '@angular/forms/signals'
import { PPButtonComponent } from '@pdx/pp-button'
import { MatDatepickerModule } from '@angular/material/datepicker'
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'

interface MonthRangeData {
  firstMonth: string
  lastMonth: string
}

export interface MonthRangeResult {
  firstMonth: Temporal.PlainYearMonth
  lastMonth: Temporal.PlainYearMonth
}

@Component({
  selector: 'app-choose-month-range',
  imports: [FormField, PPButtonComponent, MatDatepickerModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  templateUrl: './choose-month-range.component.html',
  styleUrl: './choose-month-range.component.scss',
  host: { 'data-testid': 'choose-month-range' },
})
export class ChooseMonthRangeComponent {
  private readonly dialogRef = inject(MatDialogRef<ChooseMonthRangeComponent>)

  private readonly model = signal<MonthRangeData>({
    firstMonth: Temporal.Now.plainDateISO().toPlainYearMonth().toString(),
    lastMonth: Temporal.Now.plainDateISO().toPlainYearMonth().toString(),
  })

  protected readonly monthRangeForm = form(this.model, (schema) => {
    required(schema.firstMonth, { message: 'Start month is required' })
    required(schema.lastMonth, { message: 'End month is required' })
  })

  protected confirm(): void {
    const data = this.model()
    const first = Temporal.PlainYearMonth.from(data.firstMonth)
    const last = Temporal.PlainYearMonth.from(data.lastMonth)

    if (Temporal.PlainYearMonth.compare(first, last) > 0) {
      return
    }

    this.dialogRef.close({ firstMonth: first, lastMonth: last })
  }

  protected cancel(): void {
    this.dialogRef.close(null)
  }
}
```

### choose-month-range.component.html

```html
<h2 mat-dialog-title>Choose Month Range</h2>

<mat-dialog-content class="month-range">
  <mat-form-field class="month-range__field">
    <mat-label>From</mat-label>
    <input matInput [formField]="monthRangeForm.firstMonth" type="month" />
  </mat-form-field>

  <mat-form-field class="month-range__field">
    <mat-label>To</mat-label>
    <input matInput [formField]="monthRangeForm.lastMonth" type="month" />
  </mat-form-field>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <pp-button variant="text" (click)="cancel()">Cancel</pp-button>
  <pp-button variant="filled" (click)="confirm()">OK</pp-button>
</mat-dialog-actions>
```

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

### choose-month-range.component.spec.ts

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing'
import { MatDialogRef } from '@angular/material/dialog'
import { ChooseMonthRangeComponent } from './choose-month-range.component'

describe('ChooseMonthRangeComponent', () => {
  let component: ChooseMonthRangeComponent
  let fixture: ComponentFixture<ChooseMonthRangeComponent>
  let mockDialogRef: { close: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() }

    await TestBed.configureTestingModule({
      imports: [ChooseMonthRangeComponent],
      providers: [{ provide: MatDialogRef, useValue: mockDialogRef }],
    }).compileComponents()

    fixture = TestBed.createComponent(ChooseMonthRangeComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })

  it('should close with null on cancel', () => {
    component['cancel']()
    expect(mockDialogRef.close).toHaveBeenCalledWith(null)
  })
})
```
