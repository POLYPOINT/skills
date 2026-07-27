# UsrAdmin (POLYPOINT Benutzeradministration) — UI map

`usradmin.exe` is the separate Delphi/VCL app that manages PolyUsers, groups,
roles and their **function permissions** (the rights api-pp exposes through
`/legacy-time-recording/permissions` and friends). PEP itself never edits
these. Verified on ct-zinc-master, 2026-07-20.

## Launch & login

```bash
P="python3 ~/dev/polypoint/pep-driver/cli/pep --tenant <tenant>"
$P exec 'D:\POLYPOINT\usradmin.exe' --cwd 'D:\POLYPOINT'   # in-session launch (agent child)
```

- Binary lives next to `pepwin.exe` (`D:\POLYPOINT\` on ct-zinc-master).
- Login window: `class=TfrmKeycloakLogin` "Anmeldung bei usradmin" — a
  **Keycloak form embedded in Chromium (CEF)**. The web form is OPAQUE to UIA
  (only `Chrome_RenderWidgetHostHWND` document node). Drive it with rect
  fractions on the window (verified at 616×680):
  - username field `clickin … --fx 0.50 --fy 0.512`, then `keys <user>`
  - password field `clickin … --fx 0.50 --fy 0.611`, then `keys <pw>`
  - Anmelden button `clickin … --fx 0.74 --fy 0.894`
  - "Anmeldeprofil" combo (top right, default IDM) is a normal TComboBox.
- Superuser for PEP + UsrAdmin: `adminec` (password: ask Yannick).
- The `exec` op runs children inside the agent's RDP session, so the new
  windows are immediately drivable. Windows may open BEHIND PEP — screenshots
  capture screen regions, so `rpc set_focus` the window first.

## Main window `TfrmUsrAdminMain22`

Title `[<USER>] POLYPOINT Benutzeradministration - <DB> - <Kunde>`.
Menu: Datei · Extras · ?. Top tab toolbar (owner-drawn; click by fraction at
`fy≈0.0706`): **Benutzer** 0.032 · **Gruppen** 0.081 · **Rollen** 0.126 ·
**Knoten** 0.170 · **RAP Profile** 0.220.

### Benutzer tab

- User list is a TcxGrid (**opaque** — golden rule applies: screenshot to read,
  clickin to interact). Filter row "Zum Filtern hier Text eingeben" directly
  under the header: `clickin --fx 0.10 --fy 0.149`, then `keys <login>`
  (filters `Login like 'x%'`).
- Double-click a row (first row `--fy 0.175`) → **"Benutzer" detail dialog**
  (child window, standard VCL): Name/Vorname, Zugeord. Mitarbeiter, IDM E-Mail,
  Login, Gesperrt checkbox, and the **"Mitglied in Gruppe"** grid
  (Applikation | Gruppe | Rolle | Knoten) with Hinzufügen…/Entfernen….
  OK persists, Abbrechen discards.
- A user's myPP time-recording rights come from the **PEP-application role**
  they are member of (NOT the myPOLYPOINT role — that one only carries app
  UI rights like month visibility / Diensttausch).

### Rollen tab

- List: Applikation | Bezeichnung | Rechte (truncated preview). Same filter-row
  pattern. Sorted by application: PEP roles first, then USERADMIN,
  myPOLYPOINT, RAP/DIS.
- Double-click a role → **`TfPolyRechte` "Rechte" editor** (child window of the
  main window — root selectors at
  `class=TfrmUsrAdminMain22 > class=TfPolyRechte > …`):
  - Left: TInspectorBar (Global / PEP) + a **standard TTreeView** of function
    categories — fully UIA-readable, `treeitem="Mobile-App"` etc. resolve.
  - Right: permission matrix, rows = functions of the selected category,
    columns **Lesen / Drucken / Ändern / Löschen / Erstellen / Ausführen**
    (= P2 PermissionTypes READ/…/MODIFY/DELETE/CREATE/EXECUTE). The matrix is
    owner-drawn: read via screenshot, toggle via `clickin` on the cell.
  - Footer shows `PolyUsrRoleId`. OK persists, Abbrechen discards. NOTE:
    two "Abbrechen" buttons match — use index `button="Abbrechen"[0]`.

## Mobile-App rights ↔ api-pp EmployeePermissions

Category **Mobile-App** carries the myPP time-recording rights that
`pp-services/personnel-planning` `PermissionDetailSetter.java` maps to
function IDs 306 / 1033 / 307 / 1032 and api-gateway re-exposes as
`/api/v1/legacy-time-recording/permissions` (snake_case: `time_stamp_delete`,
`block_delete`, `on_call_delete`, …):

| UsrAdmin row                              | Checked types            | FunktionsId → api-gw flags (VERIFIED 2026-07-21, per-right toggles + wire)             |
| ----------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| Mobile Applikation verwenden              | Ausführen                | app license gate                                                                       |
| Stempeln mobile Applikation               | Ausführen                | 306 `allow_time_stamps`                                                                |
| Autostempel bearbeiten mobile Applikation | Ändern/Löschen/Erstellen | **307** — Löschen → `block_delete` (BLOCKS, not stamps)                                |
| Stempel nacherfassen                      | Ändern/Löschen/Erstellen | **1033** — Löschen → `time_stamp_delete` (timestamps lose DELETE in `allowed_actions`) |
| Planungswunsch einreichen                 | Löschen/Erstellen        | 1031 scheduling request                                                                |
| Piketteinsätze erfassen                   | Löschen/Erstellen        | **1032** — Löschen → `on_call_delete`                                                  |
| "Mein Team" einblenden                    | Lesen                    | team visibility                                                                        |

The `TfPolyRechte` footer shows the selected row's **FunktionsId** — click a row
cell and read the footer to attribute a right without guessing. Server-side
these flags gate poma-core `UnifiedTimeRecordingService.validateDeletePermission`:
DELETE `/timestamps/{id}` ← `time_stamp_delete`, `/shifts/{id}` ← `block_delete`,
`/on-call-shifts/{id}` ← `on_call_delete` (each 403s `ACCESS_FORBIDDEN_TO_USER`
when its flag is off; the gate runs before entity lookup). Stamp-level and
Einsatz-level delete are independent gates.

To strip ALL myPP delete rights from a test user: open their PEP role
(e.g. `UTR_YHU_TEST_1`, used by hp1ya on ct-zinc-master) and uncheck
**Löschen** on the two stamp rows + Piketteinsätze erfassen. Servers cache
permissions per request — changes are effective on the next myPP reload.
ct-zinc-master test roles: `UTR_YHU_TEST_1` (hp1ya), `UTR_YHU_TEST_2`.

## Gotchas

- usradmin windows are all children/top-levels in the same session; `pep
windows` shows `TfrmUsrAdminMain22` once logged in, `TfrmKeycloakLogin`
  before.
- The login CEF form ignores `settext` — use focus-click + `keys`.
- Like PEP, everything data-bearing is owner-drawn: **screenshot + clickin**,
  never trust `grid` on the TcxGrids here.
- **Session timeout** (verified 2026-07-21): after idling, the next action pops
  "Information — Die Session ist abgelaufen. Das Programm wird beendet." and
  OK **exits usradmin**. Relaunch via `exec` + CEF re-login. PEP independently
  shows its own re-login ("Bitte melden Sie sich neu an.", username prefilled,
  same CEF-fraction driving) and may hold foreground over usradmin.
- **Grid-scroll trap**: after OK on a `TfPolyRechte` dialog the Rollen grid can
  scroll/re-select arbitrarily (a blind dbl-click then opens the WRONG role —
  even a DOC role). Always verify `read … > class=TfPolyRechte > edit[0]`
  (Titel) + footer PolyUsrRoleId before touching the matrix; if wrong,
  `button="Abbrechen"[0]` out. Both OK and Abbrechen are duplicated — always
  index `[0]`.
- **Disconnected RDP session**: UIA _reads_ (find/tree/read/exists) keep
  working, but screenshots fail ("screen grab failed") and any mouse/keyboard
  injection fails ("There is no active desktop…"). Reactivate by opening an
  RDP connection (macOS "Windows App" + a `.rdp` file with
  `full address`/`username` auto-connects when creds are stored);
  `tscon <id> /dest:console` needs the session password.
- **Wire oracle for rights toggles**: verify effects via api-gw/poma
  (`/api/mobile/unified-time-recording/v1/days` → per-item `allowed_actions`,
  e.g. DELETE disappearing) instead of re-reading matrix pixels — it also
  proves exactly which function IDs your clicks hit.
