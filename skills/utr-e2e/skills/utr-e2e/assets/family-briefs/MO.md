# Family MO — Mobile app flows (MO-01..MO-05) · in-app path

|                           |                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | MO-01, MO-04, MO-02, MO-03, MO-05                                                                                                                                                |
| Employees                 | E5 `{{E5_LOGIN}}` ({{E5_ID}}, must-stamp / TIMESTAMPS) for MO-01..MO-04; ES `{{ES_LOGIN}}` ({{ES_ID}}, auto-stamp / BLOCKS) for MO-05                                            |
| Days                      | E5: `{{E5_TODAY}}` (MO-01, MO-02), `{{E5_WD1}}` (MO-03), month `{{MONTH}}` (MO-04); ES: `{{ES_WD1}}` (MO-05)                                                                     |
| Harness                   | `{{SKILL_DIR}}/scripts/harness/mypp-inapp.mjs` (cordova shim + Pixel 7 UA + 390 px: the app's own login forms). `mypp.mjs --mobile` is NOT the in-app path (no shim → web login) |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/MO` · `{{RUN_DIR}}/MO/<id>/` · `created/MO.jsonl`                                                                                           |
| Read first                | the common part; scenarios.md section MO; `{{RUN_DIR}}/write-days.md` (E5 / ES plannings)                                                                                        |

Invocation pattern (every scenario):

```
cd {{RUN_DIR}} && MYPP_PROFILES={{RUN_DIR}}/.profiles/MO \
  node {{SKILL_DIR}}/scripts/harness/mypp-inapp.mjs {{TENANT}} <login> <script.mjs|-> MO/<id>
```

The first call per login walks on-board (e-mail), login form, consent (`#btn-accept`) and the team-roster tutorial; the in-app coach marks (`.in-app-tutorial-wrapper .close-button`) appear on the first day view — close them before clicking. Card clicks must be real pointer clicks (`locator.click()`), not `el.click()`.

## MO-01 — in-app login + capabilities (E5)

Script: after login `api.goto('/tabs/unified-time-recording?date={{E5_TODAY}}', '/unified-time-recording/v1/days')`, then `api.get('/api/capabilities/v1/capabilities')` and `api.get('/api/mobile/health-professional/v1/scheduling-requests/shift-definitions?day={{E5_TODAY}}')`; screenshots `login`, `day`.
Expected: `harness.log` shows "logged in (in-app) … cordova shim true"; capabilities 200 containing `UNIFIED_TIME_RECORDING` and `LEGACY_IN_OUT_TIME_STAMP_ID` (first run: 81 entries; compare with the X-04 capture); the day view loads with cards (no endless spinner); the scheduling-request picker 200. A 404 "Shift definition with id N not found" on the picker = G4b (first run N-MO-1 before the refresh) → BLOCKED + blocker for that sub-check only.

## MO-04 — mobile month report (E5, read-only)

`.month-report-button` on the day view → month `{{MONTH}}` table renders (`.v1-month-report-container-table-row`); capture `reports/month`; click one row → navigates to that day. Expected: rows = API rows; summary consistent with the API (first run: 31 rows, 80:00 / 80:00 / 0:00). Rows of today / future days at 0:00 while Σ GLAZ holds PEP's pre-credit = KD-7 (pre-1801): record, judged in M, not an MO verdict item.

## MO-02 — clock in/out today (E5 `{{E5_TODAY}}`)

Precondition: `oracle-day.sh {{TENANT}} {{E5_ID}} {{E5_TODAY}}` → `ACTIVE|` 0 (otherwise stop, BLOCKED). Script steps:

1. Day view; card button `pp-unified-shift-card .unified-shift-card-stamp-multi-btn`; its chevron `.popover-trigger` at 390 px opens a `pp-modal-sheet` (`ion-modal`), not the desktop popover — screenshot, Escape.
2. Main button `.pp-multi-button-btn` → immediate `POST /timestamps` (no editor); capture with `page.waitForResponse(url includes '/unified-time-recording/v1/timestamps' && POST)`; toast; label switches CLOCK_IN → CLOCK_OUT.
3. Wait ≥ 3 minutes (clock-out < ~2 min after clock-in triggers the backend re-stamp correction "Stempel korrigiert" — by design; the first run used a 65 s gap and saw the correction).
4. Clock out the same way → second POST 200.
5. `/days`: two manual stamps; credited = Σ GLAZ `ZEITANRECHNUNG` of E5 `{{E5_TODAY}}` after the pair (oracle): seed 8:00 + the stamped minutes while the seed ZS is still there (first run 8:03), only the stamped minutes after Phase 1 step (l) — PEP's planned pre-credit of today is replaced by the stamps (master-1822 0:03). Before the pair a pre-1801 bundle shows credited null although Σ GLAZ holds the pre-credit (KD-7) — record, not judged. The same minutes a second time as a `GLAZ` time credit = F1 (KNOWN-FAIL F1 on 1801).
6. Delete both stamps: expand the credited accordion (`.unified-shift-card-credited-header`), row button `button.unified-shift-card-ts-action-btn.delete` → confirm the button named "Löschen"; fallback `DELETE /timestamps/{id}?date={{E5_TODAY}}&employmentId={{E5_ID}}`. `ACTIVE|` back to 0.

## MO-03 — narrow-viewport split button / add-block entry (E5 `{{E5_WD1}}`)

E5 is TIMESTAMPS: `allowed_actions` [ADD_TIMESTAMP], `can_add_blocks` false → no add-block entry (expected by design). Verdict covers the narrow-viewport part: the split button opens `pp-modal-sheet` (screenshot, list its entries). The add-block flow itself is MO-05 on the BLOCKS employee. If the sheet part was already proven in MO-02, reference that evidence; verdict BLOCKED-by-mode only if no split button renders at all (first run: BLOCKED, re-run on ES).

## MO-05 — in-app add-block on a BLOCKS employee (ES `{{ES_WD1}}`)

Precondition: `oracle-day.sh {{TENANT}} {{ES_ID}} {{ES_WD1}}` → no `BL|` row (first run 487 10-12: 113 Mittel, PLANUNG 1356, seed ZS 8:00).

1. Day view; screenshot; `.unified-shift-card-add-block-wrapper ion-button` ("Zusätzlichen Block hinzufügen") → editor.
2. Time pickers are `ion-picker` wheels; set them programmatically, then press OK:
   ```js
   async function setPicker(page, hh, mm) {
     await page.waitForSelector('ion-picker-legacy, ion-picker');
     await page.waitForTimeout(700);
     await page.evaluate(
       ([h, m]) => {
         const p = document.querySelector('ion-picker-legacy') || document.querySelector('ion-picker');
         p.columns = p.columns.map((c) => {
           const want = c.name === 'hours' ? h : m;
           const i = c.options.findIndex((o) => o.text === want);
           return { ...c, selectedIndex: i >= 0 ? i : c.selectedIndex };
         });
       },
       [hh, mm],
     );
     await page.waitForTimeout(500);
     await page
       .locator('.time-picker-ok-button:visible, button:has-text("OK"):visible, button:has-text("Übernehmen"):visible')
       .first()
       .click();
   }
   const tp = page.locator('pp-time-picker-card .timepicker-container');
   await tp.nth(0).click();
   await setPicker(page, '17', '00');
   await tp.nth(1).click();
   await setPicker(page, '18', '00');
   ```
   Check `pp-time-picker-card` texts show 17:00 and 18:00 before saving (abort otherwise).
3. `#primaryButton:visible` → `POST /unified-time-recording/v1/shifts` 200 (save request + response); `/days` credited 9:00 (seed 8:00 + 1:00), the block listed once (an extra GLAZ 1:00 time credit = F1).
4. Delete via the row trash (`button.unified-shift-card-ts-action-btn.delete`, confirm "Löschen") → `DELETE /shifts/{id}` 200; credited 8:00; DB no `BL|` row.
   Expected PASS on a correct bundle (first run: master PASS; candidate 500 before the G4b refresh = N-MO-2). 1801: the block minutes repeated in a `GLAZ` time credit with the right total = KNOWN-FAIL F1 "parts". The seed ZEITSUMME of that planning is regenerated (new id, DIENSTTYPE A→P) — legitimate for auto-stamp employees.

## Cleanup checklist

E5 `{{E5_TODAY}}` `ACTIVE|` 0; ES `{{ES_WD1}}` no block you created; every id in `created/MO.jsonl`.

## Compare overlay (optional)

Same scripts with `{{COMPARE_TENANT}}` into `MO/<id>/compare/` (fresh in-app profile per tenant+login is created automatically); `diff` = capabilities count, credited after the clock pair / the block on both (first run: "candidate 8:03 + 0:03 extra GLAZ credit").
