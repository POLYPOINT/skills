# Family LG — Logging and debug (HPN-13, HPN-14) · N3

|                           |                                                                           |
| ------------------------- | ------------------------------------------------------------------------- |
| Scenarios (in this order) | HPN-13, HPN-14                                                            |
| Actors                    | N3 `{{N3_LOGIN}}` ({{N3_ID}})                                             |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/LG` · `{{RUN_DIR}}/LG/<id>/`         |
| Read first                | the group brief; scenarios.md HPN-13, HPN-14; `known-deviations.md` SD-16 |
| Windows                   | paused by W-X-SYSMSG                                                      |

Clipboard: `ctx.grantPermissions(['clipboard-read','clipboard-write'], {origin: 'https://ct-poma-webapp.dev.k8s.polypoint-dev.com'})` at the start of each script.

## HPN-13 — Debug page: entry, log list, filter, copy, token refresh

Pre: browse Home, Kalender, Benachrichtigungen first (the logger flushes periodically). 1. Profile → "Debug" → `/app/debug`; header "Debug"; "Konfigurierte Log-Stufe: DEBUG". 2. Cards: date / time, "Correlation ID", "Type: HTTP_REQUEST|HTTP_RESPONSE|…", "Level"; request / response pairs with one correlation id (e.g. `…/dashboard`). 3. `localStorage['CapacitorStorage.debug_messages']` → array A (≤ logSize, newest first) → `storage-debug.json` (store only `type`, `level`, `correlationId`, url and lengths — **no message bodies**: they may contain names, SD-16). 4. "Copy" → toast "Logs copied to clipboard"; `navigator.clipboard.readText()` → array C; compare C with A (length, order, `message` / `correlationId` / `type` equality, computed in the browser; save only the comparison result). 5. "Filter Logs..." = `dashboard` → only matching cards; "Copy" → C' contains only matching entries. 6. Tap a card → alert with the full message → "OK". 7. "TEST token refresh" → toast "Token refresh OK". 8. `api.goto('/health-professional-app/app/debug')` works without the menu (no guard) — record.
Expect: as listed. Privacy observation (SD-16): count of entries whose body contains personal data (names from `dashboard` / `team` responses) — counts only.

## HPN-14 — Error dialog: copy logs and error details

1. `api.goto('/health-professional-app/flows/calendar/booking-details/00000000-0000-0000-0000-000000000000')`; capture the `assignments/<uuid>` response (expected 404, guess). 2. Global error dialog: title from the error code (or the "Fehler…" default), "OK" (or "Weitere Informationen" with technical details) and "Copy". 3. "Copy" → clipboard JSON has an entry `level` ERROR, `type` HTTP_REQUEST or GENERAL_ERROR, the failed URL. 4. If "Weitere Informationen": tap → details dialog ("Fehlerdetails" or the error name) + "Copy"; "Copy"; "OK". 5. Debug page lists the same error entries with one correlation id.
   Expect: one dialog (not stacked); copy works from both dialogs; entries present in storage.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
