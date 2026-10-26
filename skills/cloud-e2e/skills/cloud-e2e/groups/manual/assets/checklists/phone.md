# Manual session — phone (SWP-34, BKG-30, HPN-27)

|         |                                                                                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testers | 1 person with a physical phone (Android preferred: the permission modal of HPN-27 is Android-only) and the store / TestFlight "myPOLYPOINT Testing" app; for HPN-27 step 4 an older store build                         |
| Where   | DM-X (the run's roster env) with a seed HP login that **no group claimed for its own scenarios at that time** — the runner picks a spare claimed by `manual` (ask the steward) or an actor of a group that has finished |
| Helper  | the runner drives the "other side" with the web harness (`app.mjs … --app mypp` / `--app poma`) when a step needs a second actor                                                                                        |
| Time    | ≈ 1.5 h                                                                                                                                                                                                                 |
| Record  | PASS / FAIL / BLOCKED per scenario; phone screenshots of the push banner and the opened page → the runner writes `scenarios/manual~<id>`                                                                                |

CT sends real pushes (FCM): only to the tester's own device.

## SWP-34 — Real push notification on a phone (swap)

1. The phone user logs in on the device (push allowed).
2. The runner (web harness, another HP of the same roster) creates a swap inviting the phone user.
3. Observe the push; tap it → the swap detail opens.
   Expect: push arrives; tap opens the swap detail.

## BKG-30 — Push notifications for booking / RR events

1. The phone user is the HP of an RR invitation started by the runner as SP (BKG-21 steps 2 and 7: invite, then selection).
2. Tap each push.
   Expect: invite and selection pushes arrive; tap opens the opportunity detail.

## HPN-27 — Native device: generic notification push, permission modal, push language, update prompt

1. First start, deny notifications → modal "Berechtigungen deaktiviert" (Android).
2. Allow → the runner sends one `WEEK_VIEW` and one `OPPORTUNITY_DETAIL` generic notification (public notification API v2, HPN-08 recipe; the resource id of a real opportunity) → both pushes arrive in German; tap → week view / opportunity detail (record whether the id is lost).
3. App language French → the next push is French.
4. Older store build: modal "Neue Version der App ist verfügbar" with "myPOLYPOINT aktualisieren".
   Expect: as listed. The native `login-callback` deep link may land nowhere (SD-39: record if seen).

## After the session

- Log the phone user out; the runner cleans the swap / RR it created.
