# Family NAV — Shell: landing, menus, small screen, languages (PSP-01, 02, 03) · read-only

|                           |                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Scenarios (in this order) | PSP-01, PSP-02, PSP-03                                                                                                               |
| Actors                    | PLANALL `{{PLANALL_LOGIN}}`, SPA `{{SPA_LOGIN}}`, PMA `{{PMA_LOGIN}}`, TA `{{TA_LOGIN}}` (all `--app poma`, fresh profile per actor) |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/NAV` · `{{RUN_DIR}}/NAV/<id>/`                                                                  |
| Read first                | the group brief; scenarios.md PSP-01..03; gate PSP-G1 result (seed log)                                                              |
| PEP / windows             | none                                                                                                                                 |

## PSP-01 — Role landing, menus and profile menu (desktop 1280×900)

1. PLANALL: log in at the webapp root; record the landing URL (`result.json` `landing`); `roles(api)` → `roles-planall.json`; `GET /api/private/users/current` 200. 2. Side menu: `#dashboard-menu-item`, `#pool-management-menu-item`, `#pool-metrics` and texts. 3. `/shift-planner/dashboard`: `#dashboard-menu-item`, `#find-health-professional-menu-item`, `#manage-shift-bookings-menu-item`, `#manage-opportunities-menu-item`, `#shift-swap-marketplace`. 4. Header user name (`.user-container`) → panel with name, e-mail, "Sprache", "Ausloggen". 5. Repeat 1–2 as SPA, PMA, TA (TA menu `#dashboard-menu-item`, `#manage-conflicts-rules-menu-item`). 6. Breadcrumb active label "Übersicht".
   Expect: landing PLANALL and PMA `/pool-manager/dashboard`, SPA `/shift-planner/dashboard`, TA `/tenant-admin/dashboard`; menus PM = Übersicht / Pool Management / Pool-Metriken; SPA = Übersicht / Mitarbeitende finden / Geplante Dienste verwalten / Anfragen verwalten / Diensttausch; TA = Übersicht / Konfliktregeln konfigurieren; profile panel with the four entries; no PAGEERROR / CONSOLE lines in `harness.log`.

## PSP-02 — Small-screen navigation (< 960 px)

As SPA and PMA, viewport 800×900 (once 390×844): 1. Dashboard: desktop nav `.pdx-menu-item-desktop` hidden, `#menu-button` visible. 2. `#menu-button` → mobile list `.pdx-menu-item-mobile` = the PSP-01 items. 3. "Anfragen verwalten" (SPA) / "Pool Management" (PMA) → route changes, drawer closes (`mat-sidenav` not opened). 4. Header user icon → profile panel with "Sprache" (name text hidden).
Expect: as listed; the language selector is in the header panel, not in the drawer.

## PSP-03 — Localization: switch, persistence, query parameter

As SPA, PMA, TA (start DE): 1. Profile panel → "Sprache" → list (`.language-panel-option`). 2. Français. 3. `#dashboard-menu-item` text and two page titles; raw-key scan of the DOM text (`/\b[A-Z_]{3,}\.[A-Z_.]{3,}\b/`). 4. Two other pages (SPA: Anfragen verwalten, Diensttausch; PMA: Pool Management, Pool-Metriken; TA: Konfliktregeln) + scan. 5. Reload → still FR. 6. SPA: `/shift-planner/dashboard?lang=it` → Italian. 7. Restore DE.
Expect: texts = `assets/i18n/<lang>.json` of the deployed webapp (fetch `/assets/i18n/fr.json` etc. in the script; DE "Übersicht", FR "Aperçu", IT "Panoramica", EN "Dashboard"); selected language ticked; raw-key count 0; choice survives navigation and reload.

## Cleanup checklist

- Language of SPA, PMA, TA back to DE (TA is borrowed by other groups: verify).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
