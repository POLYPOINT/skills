# Family NC — Notification center mechanics (HPN-08, 09, 10, 11, 12) · N1 recipient, N2 sender

|                           |                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | HPN-08, HPN-09, HPN-10, HPN-11, HPN-12 (strictly sequential)                                         |
| Actors                    | N1 `{{N1_LOGIN}}` ({{N1_ID}}, tenant subject `{{N1_SUBJECT}}`), N2 `{{N2_LOGIN}}` ({{N2_ID}})        |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/NC` · `{{RUN_DIR}}/NC/<id>/` · `created/NC.jsonl`               |
| Read first                | the group brief; scenarios.md family NC; `known-deviations.md` HPN-K4, SD-03                         |
| Writes                    | 27 generic notifications to N1 (HPN-08) + 1 (HPN-11); N1's read states and one preference (restored) |
| Windows                   | paused by W-X-SYSMSG                                                                                 |

No SMS / e-mail: generic notifications fan out to push only for registered devices (web users have none), to Teams only with `msTeams.notifications` (OFF). Partner events may be logged if a partner is subscribed to the tenant (others filter by their ids).

## HPN-08 — Seed generic notifications through the public API v2

Pre: as N1 open `/health-professional-app/flows/profile/notification-center`; `nc-before.json` (`ncAll`) and `unread-before` (`unread(api)`); empty list → text "Keine Benachrichtigung, bitte prüfen Sie die Filter." (`00-empty-nc.png`).

1. As N2 (any page loaded so the bearer is captured): `items = notificationBodies({run: '{{RUN}}', tenant: '{{TENANT}}', subject: '{{N1_SUBJECT}}'})` (27 bodies: 3-row thread `SHIFT_TRADE`, 7 resource types, 4 navigation targets `WEEK_VIEW` / `DEFAULT_VIEW` / `SCHEDULING_REQUEST_V2_DETAIL` / `CACHE_MANAGEMENT`, 1 `DELETED`, 1 probe text `<b>fett</b><img src="x" alt="hpn-probe">`, 10 fillers, 1 `NOTIFICATION_API_REQUEST` probe expected **not** to be saved); `sendNotifications(api, items, 250)` → `requests.json` (bodies only, never headers / tokens). 2. Wait ≤ 60 s; as N1 `ncAll` → `nc-after.json`, `unread` → `unread-after`.
   Expect: every POST 200 with an empty unresolved list; N1 has +26 rows (each `type` = resource — IPO shows as `INTERNAL_POOL_OPPORTUNITY` — `object_id` = resource id, `translated_title.de` = the sent title, `state` as sent, `read_date` null); the `NOTIFICATION_API_REQUEST` probe has no row (record either way); `unread-after` = before + 26 (record whether the DELETED row counts). A 404 for every POST = no recipient resolved (N1 never synced: seed H1) → BLOCKED.

## HPN-09 — NC list: badge, sort, filter, threads, infinite scroll, deleted row, text-only content

Pre: N1 has not opened the NC since HPN-08. 1. `/tabs/home/main` → badge `.header-container-notification-badge` = `all-unread.number`. 2. Bell → NC; first request `page-size=20`, `sort-direction=DESC`. 3. Scroll to the bottom → `current-page=1`; `pp-scroll-to-top-button` → `scrollTop` 0. 4. "Eingangsdatum" → `sort-direction=ASC` (oldest first); again → DESC. 5. "Filter" (`#open-filter-modal`): options = `notification-preferences` with `enabled_by_tenant` + "Pool-Zuweisung" / "Pool-Entfernung" + "Verfügbarkeit"; select "Diensttausch" + "Pool-Buchung" → `notification-types=SHIFT_TRADE,BOOKING`, label "Filter (2)", only those cards. 6. Deselect all → full list, label "Filter". 7. Thread card → "Verlauf anzeigen" → 3 entries `dd.MM.yy | HH:mm` → "Weniger anzeigen". 8. DELETED card: `.disabled-card`, state "Gelöscht"; tap → URL unchanged (marked read). 9. Probe card shows the literal text; no `img[alt="hpn-probe"]` in the DOM; its span has `mouseflow-hidden` and `data-private`.
Expect: as listed; no "Wunsch V2" / roster types in the filter options.

## HPN-10 — Read state and tap routing (incl. dead targets)

Pre: note `unread` = U. 1. Tap the `BOOKING` / `NOTIFICATION_CENTER` card → `PUT …/notifications/read` with its id; URL stays; dot gone after the list reload. 2. `WEEK_VIEW` card → `/tabs/calendar…`; back. 3. `DEFAULT_VIEW` card → `/tabs/home…`; badge U − 3 after the next poll (≤ 60 s). 4. `SCHEDULING_REQUEST_V2_DETAIL` and `CACHE_MANAGEMENT` cards → record the final URL and any dialog: route with `undefined` / wildcard to `/tabs/home` → **KNOWN-FAIL HPN-K4**. 5. "Alle gelesen" → `PUT …/notifications/all-read`; dots and badge gone (`unread` 0).
Expect: read calls 2xx; dots / badge follow `read_date` / `all-unread`; routes as listed. Per-event routes (booking / invitation / swap) are covered by BKG-28 / SWP-30.

## HPN-11 — Notification preferences ("Push-Nachrichten")

1. N1: Profile → "Push-Nachrichten" → `GET …/notification-preferences` → `prefs-before.json`. 2. Listed = types with `enabled_by_tenant=true`; SR v2 / roster snapshot absent. 3. "Diensttausch" off → `PUT …/notification-preferences` (`enabled_by_user=false`). 4. Reload → still off. 5. N2 sends one `SHIFT_TRADE` generic notification to N1 (HPN-08 body shape, resource id `hpn-{{RUN}}-pref`). 6. N1: the NC contains it (preference does not block the NC row). 7. **"Diensttausch" on again** → `prefs-after.json`.
   Expect: list = tenant-enabled types; PUT persisted; NC row created while the preference is off.

## HPN-12 — Unread-counter failure: "?" badge and info panel (fault injection)

1. `page.route('**/notifications/all-unread', r => r.fulfill({status: 500, body: '{}'}))`. 2. `/tabs/home/main`; wait ≥ 65 s (one poll). 3. `.header-container-notification-attention-badge` visible, no numeric badge. 4. NC → info panel "Anzahl Benachrichtigungen" / "Die Anzahl der neuen Benachrichtigungen kann momentan nicht anzeigt werden." 5. No error dialog. 6. `page.unroute`; next poll → numeric badge back; panel gone after re-entry.
   Expect: as listed; `debug_messages` contains a GENERAL_ERROR entry for `/all-unread`.

## Cleanup checklist

- Preference "Diensttausch" on (prefs-after); all generic rows read (they stay: list the resource ids in `created/NC.jsonl`); no route left active.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
