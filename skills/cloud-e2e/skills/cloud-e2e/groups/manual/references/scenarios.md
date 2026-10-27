# Group manual — scenario catalogue (17 human-only scenarios)

Collected from the area catalogues (`areas/{swap,booking,pool-sp,hp-notif,partner,auth}/scenarios.md`, 2026-10-23) with the S1 reconciliations: every scenario that needs a human (a real Teams client, a phone, PEP over RDP, a mailbox, Staging, smartPEP, an external system) is grouped into **one session** per kind. The testers work from the session checklists `../assets/checklists/<session>.md` (Sonnet-free, written for humans); this file keeps the area reference text. No worker prompt is generated for this group.

| Session (`manual <run> --session …`) | Scenarios                                                           | Where                                                                                                | Who                                             |
| ------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `teams`                              | SWP-32, BKG-29, HPN-25, AUT-15                                      | ct-zinc-master + Teams client (Azure dev tenant `wr7g0`: `engsa`, `schre`, `shasm` HP; `schbea` SP)  | 1 tester with Teams; after the shared HPN-26 GO |
| `phone`                              | SWP-34, BKG-30, HPN-27                                              | DM-X + myPOLYPOINT Testing app on a phone                                                            | 1 tester with a phone                           |
| `pep-rdp`                            | BKG-32, PTN-22 (DM-X), PSP-24 (DM-Y), AUT-19 (DM-Y, inside W-Y-MSG) | DeployMate box RDP (own OPERATOR reveal), under `locks/<env>~pep` (`holder "<tester>/manual"`)       | 1 tester with RDP                               |
| `mail`                               | BKG-31                                                              | ct-zinc-master, owners' consent, owned mailbox (DeployMate tenants keep `sendEmailConfirmation` OFF) | 1 tester                                        |
| `staging`                            | HPN-22, HPN-23                                                      | Staging `preview-hive-test` — production cluster: humans only, never an agent                        | 1 tester                                        |
| `smartpep`                           | PSP-23                                                              | Preview `preview-smartpep`                                                                           | 1 tester                                        |
| `externals`                          | PTN-23, PTN-24                                                      | GCP Pub/Sub access; CT `tenant1` + Careanesth test system                                            | 1 tester                                        |

Recording: the runner writes `manual/<session>` (testers, checklist state) and one row `scenarios/manual~<id>` per scenario from the tester's verdict; FAIL rows carry a tester screenshot (cropped). KNOWN-FAILs: `known-deviations.md`. Each scenario below names its closest automated substitute (in another group).

---

### SWP-32 MS Teams notifications and deep links — manual-only

> Data prerequisite: CT tenant `ct-zinc-master` with the Teams dev tenant users (`schbea` SP, `engsa`/`shasm` HP; environments.md §3); a real Teams client. Not on DeployMate (no Teams mapping).
> Steps (human): run the SWP-06 → SWP-08 → SWP-11 chain with Teams users; in Teams check each activity card; click the invitation and the response card.
> Expect: one card per event; the links open a working swap page — today they open the legacy pages (KNOWN-FAIL SW-K5 if broken).
> Why manual: needs a real Teams client and tenant. Closest automatable substitute: SWP-33 (legacy routes) + SWP-30 (the record that also feeds Teams).
> Oracle: Teams cards + the page that opens. Evidence: screenshots by the tester. Source: 11465982071#7, 14150369282#12, gap G-08.

### SWP-34 Real push on a phone — manual-only

> Data prerequisite: an HP login on a physical phone with the store/TestFlight app, push allowed; CT DeployMate tenant.
> Steps (human): HP1 (web harness) creates a swap inviting the phone user; observe the push; tap → swap detail opens.
> Why manual: real push delivery needs a device. Substitute: SWP-30 (notification-center record created by the same call) + the device registration request in the phone user's API log.
> Oracle: push banner + opened route. Evidence: phone screenshots. Source: 14150369282#12, 14149124150#2/#5, 11465982071#2/#5.

### BKG-29 MS Teams activity notifications (manual-only)

> Data prerequisite: shared CT tenant `ct-zinc-master` with `poma.msTeams.notifications` on and the Azure dev-tenant Teams users (`engsa`, `schbea`, … — `environments.md` §3); cannot run on DeployMate (e-mail-domain → single provider mapping).
> Why manual: no Teams sink exists in the product (polyid-login only calls Graph, nothing persisted); requires a human in the Teams client "myPOLYPOINT Testing".
> Steps: run BKG-12 (one booking), BKG-21 (invite, selection, rejection), BKG-23 (invite) on `ct-zinc-master` with Teams users; check each activity card and its deep link.
> Expect: one card per event; links open the routes of BKG-28; known mismatches: selection opens WEEK_VIEW, rejection opens OPPORTUNITY_DETAIL (N-11/N-12).
> Closest automatable substitute: NC rows for the same events (BKG-28) + optional event-handler data plugin on `<TYPE>_MSTEAMS_NOTIFICATION` events with `ERROR_MESSAGE` empty (`MsTeamsNotificationEvent.java:52-73`; guess, needs a plugin set up by the operator).
> Source: 12008062977 Teams column, 12007276651 (2023 ✗ on selected rows); MYPP-NOTIF-05.

### BKG-30 Push on a physical device (manual-only)

> Why manual: FCM delivery needs a real device token; CT sends real pushes.
> Steps: Testing app on a phone logged in as `{{HPG}}`; repeat BKG-21 steps 2 and 7; tap the pushes.
> Expect: invite and selection pushes arrive; tap opens the opportunity detail.
> Closest automatable substitute: `mypp-inapp.mjs` login (device registration `PUT …/devices/{uuid}`) + NC rows (BKG-28).
> Source: 11465293970#3, 11466702849#3, 10046210711#1, #6; MYPP-NOTIF-03/04.

### BKG-31 Booking confirmation e-mail (manual-only)

> Why manual: DeployMate users have synthetic mailboxes (`<env>.ch`); CT sends real e-mail via SES; no mail sink exists (`k1c-notes/shared-services-tpms.md:196-205`).
> Steps: on a tenant whose SP and HP have real mailboxes, `sendEmailConfirmation` on, book via Find HP (with and without a comment — fix `f0749ab666`).
> Expect: one e-mail to the SP and one to the HP, language of the recipient, booking data correct.
> Closest automatable substitute: none per message; event-handler metadata shows `EmailNotificationEvent` / `MESSAGING_SERVICE_ON_MESSAGE_COMPLETE` types arriving (`/metadata/event-types`, ADMIN/DATA_ANALYST) — weak.
> Source: 12008062977#15; POMA-NOTIF-02.

### BKG-32 PEP-side entry points and PEP display (manual-only until pep-verify flows exist)

> Why manual: the PEP Delphi UI (context menu "Ressourcenersatz", "Poolmanagement öffnen" → "Neue Anfrage" / "Verfügbarkeiten", BADI URL configuration, green availability squares, F5, read-only Planblatt, Bedarfsprofil sync) is not in the repo and pep-verify has no flows for it yet.
> Steps: on the DeployMate box via RDP: configure the BADI URL `{{POMA}}/badi` (Definitionen → Konfiguration POLYPOINT-Server → Cloud Services → "Verfügbare Mitarbeitende direkt buchen"); open BADI from "Poolmanagement öffnen" → "Verfügbarkeiten"; start an RR from a shift's context menu and an IPO from "Neue Anfrage"; check the green days of BKG-01/04 after F5; open a Planblatt read-only in a second session and try BADI.
> Expect: as the Confluence pages (corrected).
> Closest automatable substitute: the API stand-ins of BKG-21/23, the standalone `/badi` route (BKG-16), the api-pp availability oracle. Candidate pep-verify flows to build: `rr_start`, `ipo_new_request`, `open_badi`, `read_day_availability_mark`.
> Source: 11465293970#1, 11466702849#1, 12347080711#1, #2, 11474174016#3, 12344229921#2, #16, #22, #24.

### PSP-23 Planning wish (v2, smartPEP) — manual-only

> Why manual: needs a smartPEP tenant with the CPP service (`{{cpp-api-service}}/cpp/api/v1/planning-requests`); DeployMate tenants register only POMA and PolyId (`code/deploymate-sharing.md` §5.1); the flag `schedulingRequestV2` is "not ready for production yet".
> Where: Preview `preview-smartpep` (shared), manual tester.
> Steps (manual): HP opens "Wunsch erfassen" (v2), picks a date range; the definition picker lists only Dienste with Planungswunsch on the Dienst and on the job-assignment node (DIENSTPALETTE + DIENST.PLANBAR + DIENST.PLANUNGSWUNSCH + DIENST_DETAIL.PLANUNGSWUNSCH, CPP window now−1 … now+150 days); submit; check the request in smartPEP; delete.
> Closest automatable substitute: PSP-22 (v1, same two-level flag idea, on-prem picker).
> Source: gap G-02; MYPP-WISH-02; memory note "planning-wish definitions flow".

### PSP-24 PEP entry points into the planner web app — manual-only

> Why manual: the PEP Delphi source is not available and the content of PEP's embedded Chromium is not machine-readable through pep-driver (guess); the entry points produce no cloud request the harness can observe except the token exchange `POST /api/token` on the webapp.
> Where: the DeployMate box (PEP as PLAN-ALL), manual or a pep-verify screenshot session.
> Steps (manual): Datei → "Poolmanagement: Schichtplaner-Dashboard öffnen…" and "…Poolmanager-Dashboard öffnen…"; Planblatt → button "Poolmanagement öffnen" → each entry ("Schichtplaner-Dashboard…", "Poolmanager-Dashboard…", "Einen Health Professional finden…", "Neue Anfrage…", "Planblatt-Übersicht…" if still present). Expected: the page opens embedded without the language / logout entries and without `missing-authentication.html`; find-HP opens with the plan-sheet date and roster preselected.
> Closest automatable substitute: PSP-01 plus a run with `poma.webApp.simulatePEP` on (emulated `window.polypointRichClient`, POMA-SHELL-02) on the same tenant in an exclusive flag window.
> Source: 11484037225#1–#2, 11485380609#1–#2, 11484627032#1, #4, 11490133274#1; POMA-SHELL-02.

### HPN-22 Beekeeper embedded mode on Staging — manual-only

> Data prerequisite: Staging tenant `preview-hive-test`, Beekeeper test tenant `andras2.dev.beekeeper.io`, HP `aermo` (credentials from the store), flag `poma.mobileApp.beekeeperFullPwa` OFF; notifications prepared for `aermo` (HPN-08 recipe, run by the tester on Staging) incl. a `WEEK_VIEW` target and a swap target.
> Why manual: real Beekeeper app/web is wired to Staging, which is on the production cluster — agents never act there (`code/deploymate-sharing.md` §6).
> Steps (human): Confluence Part 1 (1.1–1.4) for the six pages + the further entry points (scheduling request, shift swap create/manage/view, time recording); 1.5: follow an in-app link to a non-allowed page → lands on "Planungspräferenzen".
> Expect: no myPP header, title in the native header (mobile app only — the Beekeeper web app cannot receive it), no tab bar, no back button on entry pages, back on sub-pages; NC: not-allowed target does nothing (row marked read), swap target opens.
> Closest automatable substitute: HPN-24.
> Evidence: tester screenshots.
> Source: 14773288966#0, #1, #2, #3, #4; MYPP-EMBED-02; G-19.

### HPN-23 Beekeeper full PWA mode on Staging — manual-only

> Data prerequisite: as HPN-22 with `poma.mobileApp.beekeeperFullPwa` ON (staging portal, tester).
> Why manual: as HPN-22.
> Steps (human): Confluence Part 2 (2.1–2.3) incl. the logout control outside Beekeeper.
> Expect: dashboard default, tab bar top, header below, all pages, back arrow + bottom back on sub-pages, no logout entry, direct links open stand-alone pages with header and back button, no tab bar.
> Closest automatable substitute: HPN-24 (PWA part).
> Source: 14773288966#5, #6, #7; MYPP-EMBED-03.

### HPN-25 MS Teams personal app: login cases, link reset, allow-myPP, layout, activity deep link — manual-only

> Data prerequisite: shared CT tenant `ct-zinc-master` (or Preview) with the Teams app "myPOLYPOINT Testing" ("Preview myPOLYPOINT" on Preview); Azure dev tenant `wr7g0` alive; HP users `engsa`, `schre`, `shasm` (CT) — not `schbea` (SP/PM); HPN-26 pre-flight green; owners of `ct-zinc-master` informed (link resets affect their users).
> Why manual: needs the real Teams client and Microsoft accounts; DeployMate tenants cannot get Teams (e-mail-domain → single provider mapping, `code/deploymate-sharing.md` §5.3).
> Steps (human): 1. Reset the link of `engsa` (PolyID ops → Tenants → `ct-zinc-master` → Users → expand → "Reset MS Teams Link"; "Linked: NO"). 2. Teams → myPOLYPOINT app → PolyID login with the on-prem user → "allow myPOLYPOINT outside Teams" dialog → answer "Ja" → dashboard inside Teams ("Linked: YES"). 3. Close and reopen → no login. 4. Teams desktop: tab bar at the bottom; Teams mobile: at the top; no heat-map FAB, no "Zwischenspeicher leeren". 5. Trigger one notification for `engsa` (e.g. a booking via BKG-29) → Teams activity card → opens the target page and marks the NC row read. 6. Optional (tenant you own only): "Enforce MS Teams only" ON → browser login of the same user rejected (`EnforceMsTeamsOnly`), Teams login works; switch OFF.
> Expect: as listed; known: shift-swap cards open legacy pages (SWP-33).
> Closest automatable substitute: HPN-26 (config/link state), BKG-28 / SWP-30 (the NC rows behind the cards), SWP-33 (legacy routes).
> Source: 12871467050#0, #1, #2, #3, #4; 13640368197#1; MYPP-EMBED-04, PID-API-05; G-20; PPCLOUD-12262 (first-login bug 04/2025).

### HPN-27 Native device: push of generic notifications, permission modal, app-store update prompt — manual-only

> Data prerequisite: a physical Android phone with the testing app logged in as `{{N1}}` on the DeployMate tenant (push allowed or denied per step); `{{N2}}` for HPN-08-style sends; a store build older than the current one (update prompt).
> Why manual: FCM push, OS permissions and the store update check exist only on a device (`A/shared/services/notification/notification.service.ts:55-120`, `A/app.component.ts:146-180`).
> Steps (human): 1. Deny notifications at first start → "Berechtigungen deaktiviert" modal (Android). 2. Allow → `{{N2}}` sends one `WEEK_VIEW` and one `OPPORTUNITY_DETAIL` generic notification (resource id of a real opportunity) → pushes arrive in German; tap → week view / opportunity detail (record whether the id is lost, k1b dead #10). 3. Change the app language to French → the next push is French. 4. Old build: "Neue Version der App ist verfügbar" modal with "myPOLYPOINT aktualisieren".
> Expect: as listed.
> Closest automatable substitute: HPN-08/10 (NC rows and routes of the same notifications), BKG-30 / SWP-34 (event pushes).
> Source: 13975879681#7 (rest), gaps G-11, G-22, G-23; MYPP-NOTIF-03/04, MYPP-SYS-03.

### PTN-22 Sync an external booking into PEP (Planblatt display) — manual-only

> Why manual: the sync button exists only when the page runs embedded in PEP (`COLUMNS_IN_PEP`) and calls the PEP bridge `pushExternalBooking`; the result is a Planblatt cell in PEP (Delphi). Needs an RDP PEP session (pep-verify) and booking-partner records (P-PTN-8).
> Steps (human or future pep-verify flow): PEP → Planblatt → open "Externe Buchungen" (the cloud page opened by PEP) → "sync" on one record → Planblatt shows the booking in the chosen category on that day (white cell) → the record is SYNCED in the cloud list.
> Closest automatable substitute: PTN-16 (list, state toggle) + `PUT {{API}}/api/private/external-bookings/{id}/synced` effect in the list (not the PEP display).
> Source: 13224148994#4.

### PTN-23 Pub/Sub delivery to a real partner subscriber — manual-only

> Why manual: pulling from the partner's Pub/Sub subscription needs GCP credentials/IAM for that subscription (the `integration-partner-resources` tool, `events subscribe`); workers have no GCP access.
> Steps (human): run `partner-test-tool.sh ct` with `{{PARTNER_ID}}`'s configuration, `events subscribe`, then trigger PTN-07/PTN-09 → the tool prints the same events as the Debug log.
> Closest automatable substitute: the Debug log (PTN-02, PTN-08, PTN-09), which reads a logging subscription with the same routing filter.
> Source: 11525881991#7; PORT-EVT-01.

### PTN-24 Real external providers (Careanesth test system, booking-partner simulator on Vercel) — manual-only

> Why manual: third-party systems with their own accounts (11236016150 lists real logins), not under our control; CT `tenant1` / pp-tpms-05 is a TPMS-era box.
> Steps (human, only with the provider's consent): create an availability / booking at the provider → it appears in the cloud (external pool or "Externer Anbieter") → book / sync.
> Closest automatable substitute: PTN-12…15 + PTN-20 (simulator + gateway-mock as provider), PTN-16 (booking-partner records).
> Source: 11236016150#1; 13224148994#0.

### AUT-15 Logout from myPOLYPOINT inside Microsoft Teams (manual-only)

> Why manual: needs the real Teams client with the "myPOLYPOINT Testing" app and a Teams user of the Azure dev tenant mapped to a CT tenant. The e-mail domain maps to exactly one PolyID provider, so this is stage-wide (`code/deploymate-sharing.md` §5.3). Area hp-notif owns the Teams flows. Closest automatable substitute: AUT-14 (browser) + the unit spec of `auth.guard.ts` (scope `openid offline` when embedded in Teams).
> Steps (manual): open myPOLYPOINT in Teams (CT app), log in, open Profile → "Ausloggen". Expect the login page or app start page, **not** the Ory page "Logout failed because query parameter state is set but id_token_hint is missing"; reopening the tab requires the Teams auto-login again.
> Oracle: what the tester sees; optional HAR from the Teams web client.
> Source: gap G5 (PPCLOUD-14322 part 2); `MA/shared/auth.guard.ts:87`.

### AUT-19 New user from PEP / UsrAdmin: set-password mail and first login (manual-only)

> Why manual: no pep-verify flows exist to create a PEP employee and a UsrAdmin user with a myPOLYPOINT role (open question, `data-plan.md`). The mail needs an owned mailbox and Send Messages (exclusive window). Closest automatable substitutes: AUT-08 (same set-password mail and link chain) and AUT-18 (first login, consent, user creation, sync).
> Steps (manual, corrected page 12369657898 part a): PEP → new employee (e-mail `{{AUTH_MAILBOX}}`) → UsrAdmin → new user mapped to the employee, myPOLYPOINT role → "send set-password mail" = yes → the mail arrives → PolyID set password → myPOLYPOINT first login (consent "Zustimmen") → dashboard. Cleanup: delete the user and the employee in PEP / UsrAdmin.
> Oracle: mail, login, `current-user/sync` 200 with the new employment.
> Source: 12369657898#1–#3.
