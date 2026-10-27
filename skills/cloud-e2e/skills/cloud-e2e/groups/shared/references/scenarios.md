# Group shared — scenario catalogue (8 scenarios on shared tenants)

Converted from `areas/partner/scenarios.md` (PTN-10, 11, 18), `areas/auth/scenarios.md` (AUT-12, 13), `areas/hp-notif/scenarios.md` (HPN-24, 26) and `areas/swap/scenarios.md` (SWP-20), 2026-10-23, with the S1 reconciliations: these scenarios need tenants that DeployMate cannot provide, so they run on **shared tenants that belong to other people**, with the owners' consent (gate SH-G1) and — where they change state — inside the SHARED windows **W-SH-ANTBE** (PTN-10/11/18) and **W-SH-MSTENANT** (AUT-12/13). No DeployMate env, no claims of seed people.

| Family   | Scenarios              | Tenant                                     | Why not DeployMate                                                              | Blocker if missing                                         |
| -------- | ---------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| SH-PW    | PTN-10, PTN-11, PTN-18 | CT `ct-zinc-master`                        | the embedding mock's partner users (antbe, aermo) are hard-coded to it          | BLOCKED "PW prerequisites" (gate P-PTN-10) or "no consent" |
| SH-MS    | AUT-12, AUT-13         | `<MS_TENANT>` (named by the user)          | the Azure redirect URI contains the provider id: a new tenant is not registered | BLOCKED "no Microsoft test tenant" (AUT-G4, OQ-22)         |
| SH-TEAMS | HPN-26                 | CT `ct-zinc-master` (read-only)            | Teams users (`wr7g0`) map only to this tenant                                   | —                                                          |
| SH-BEE   | HPN-24                 | CT `beekeeper-integration-tenant-test`     | needs a partner token with UI_EMBEDDING                                         | BLOCKED until the token source is decided (OQ-28)          |
| SH-OLD   | SWP-20                 | Preview `pre-dev-main24` or CT-zinc-main24 | needs on-prem < 26; DeployMate offers only master and main-26                   | BLOCKED "no < 26 box" (SH-G3)                              |

Worker steps with resolved tokens: `../assets/family-briefs/<F>.md` (one run config per family: `tenant` = that family's shared tenant). This file is the reference text; the `{{…}}` tokens below are descriptive (area tokens): `{{GWM}}` = the CT gateway mock, `{{PIDL}}` = CT polyid-login, `{{MYPP}}` / `{{APP}}` = the myPP web app, `{{MS_TENANT}}` = the Microsoft tenant, `{{PIDOPS}}` / `{{OPS}}` = the runner's PolyID / portal ops sessions. Harness names: `pwa-embed.mjs` (HP-2), `polyid-admin.mjs` (`reset-partner-link`, `provider-read`, `user-read`; HP-5 / H-HPN-2), `polyid-flow.mjs`, `app.mjs --token-entry` (H-HPN-1), `portal-ops.mjs flag read`.

Conventions: never call a `/test/**` path (also not the embedding mock's "Notification simulator"); never restart the gateway mock; never edit the PolyID partner `partner-embedding-mock` or its portal partner; never add an MS Teams domain mapping; never act on Staging (Beekeeper real app = manual group); passwords of shared test users are typed by the operator or read from the runner's 0600 cred file by the harness; record → change → restore → prove the restore with a second read.

---

### PTN-10 First embedded login through the embedding mock: link, layout, token claims

> Data prerequisite: PolyID partner `partner-embedding-mock` exists on CT with `navbar_position top`, `show_header false`, and the portal partner of the same id has UI_EMBEDDING on `ct-zinc-master` (gate P-PTN-10: a `partner-sessions` call for challenge 3 answers 200, not 403/404). Fresh browser profile (pwa-embed.mjs).
> Steps: 1. PolyID ops → tenant `ct-zinc-master` → Users → search `antbe` → expand → "Reset Partner User Link" → row shows "Linked: NO". 2. Open `{{GWM}}/partner-pwa-embedding-mock/` → environment "ct" → partner user "Beat Antonietti" (ct) → entry "Full HP app" → "Connect". 3. Capture `POST {{PIDL}}/api/auth/partner-sessions` (in the iframe) → `status`. 4. Log in inside the iframe as `antbe` (≤ 2 password submissions; IDM form). 5. Dashboard loads in the iframe; screenshot. 6. Checks: `ion-tab-bar[slot=top]` present, no `ion-tab-bar[slot=bottom]`; header content (title bar) hidden; profile tab → no `#logout-menu-entry`. 7. Decode the PolyID access token stored by myPP (localStorage, frame context) → claims. 8. PolyID ops Users row "Linked: YES".
> Expect: 3 → `AUTHENTICATION_REQUIRED` with providers; after login the app is in CUSTOMIZABLE_PWA mode: tab bar on top, no header content, no logout; claims `partner_id = partner-embedding-mock` (or the partner's id), `navbar_position = top`, `show_header = false`, `partner_rights` contains UI_EMBEDDING; link = YES. No gateway-mock restart (13719273499#3 removed).
> Oracle: partner-sessions response (token redacted), DOM checks, claims JSON, PolyID ops row.
> Evidence: 01-reset.png, 02-mock.png, partner-sessions-1.json, 05-dashboard.png, 06-profile.png, claims-pwa.json, 08-linked.png.
> Source: 13719273499#1, #2, #4, #5; 13652000794#1; MYPP-EMBED-05, MYPP-AUTH-07, PID-API-04, PID-OPS-04.

### PTN-11 Follow-up embedded login without credentials; re-link after a reset

> Data prerequisite: PTN-10 done (antbe linked).
> Steps: 1. New empty browser profile → mock → ct / Beat Antonietti / Full HP app → Connect. 2. Capture `partner-sessions` → `LINKED` + token; the dashboard opens without a login form. 3. Same layout checks as PTN-10 step 6. 4. PolyID ops → "Reset Partner User Link" for antbe. 5. New profile → Connect → `AUTHENTICATION_REQUIRED` → log in → linked again (no gateway-mock restart needed).
> Expect: 2 no IDM form appears; 3 as PTN-10; 5 relinks (PolyID `Linked: YES`), proving the restart step is obsolete.
> Oracle: partner-sessions responses; absence of the IDM form; PolyID ops row.
> Evidence: partner-sessions-2.json, 02-dashboard.png, partner-sessions-3.json, 05-linked.png.
> Source: 13719273499#3 (correction), #6; 13652000794#1.

### PTN-18 Partner deep-link entry points in the embedded app

> Data prerequisite: PTN-11 done (antbe linked); flags of ct-zinc-master as they are (record `schedulingRequestV2`, `unifiedTimeRecording`).
> Steps: for each mock entry (selector "entry point"): "Partner time-recording", "Partner shift-marketplace", "Partner Time Accounts", "Partner calendar", "Partner profile", "Partner planning-preferences", "Partner planning-agreements", "Partner notification-center", "Partner Shift swap" → Connect (linked, no login) → record the iframe's final URL after the redirection guard; then with Playwright `frame.goto` inside the iframe: `{{MYPP}}/partner/shift-swap/create?context=partner-embedding-mock` and `…/partner/does-not-exist?context=…`.
> Expect: each mapped entry lands on its `tabs/…` target (full-access partner, navbar not hidden): time-accounts → `tabs/profile/time-accounts`, shift-marketplace → `tabs/shiftmarketplace`, calendar → `tabs/calendar`, profile → `tabs/profile`, notification-center → the notification centre, time-recording → unified or classic per flag (UTR-covered beyond routing), shift-swap/create → `flows/shift-swap/planned-shift`; "Partner Shift swap" (`partner/shift-swap`) and the unknown path → `/tabs/home` (PF-5 for the mock entry).
> Oracle: final URL per entry (`partner-route-config.ts`, `partner-redirection.guard.ts:30-113`).
> Evidence: routes.json (entry → final URL), one screenshot per entry.
> Source: MYPP-EMBED-01 (PPCLOUD-14604); swap gap G-14; PF-5.

### AUT-12 Microsoft ADFS and Entra login in the browser

> Data prerequisite: gate AUT-G4 (`{{MS_TENANT}}`, provider id, Microsoft test account `{{MS_ACCOUNT}}` from the secret store, PEP user with the same e-mail, registered redirect URI). **Exclusive on `{{MS_TENANT}}`** while the provider type is changed (other teams use the shared tenant: announce the window). The Microsoft sign-in is done by the operator in the headed window the first time; later runs reuse the Microsoft SSO cookie of the profile ("saved account").
> Pre: record the provider's current type, URI and client id (H-AUTH-2 `provider-read`, client secret stripped); profile `auth-MS` (persistent).
> Steps:
>
> 1. **ADFS + password variant.** OPS → PolyID ops → `{{MS_TENANT}}` → **Basic Data** → "OAuth2 Provider Type" = "Microsoft ADFS & API-Gateway Password Validation", Provider URI / Client Id / Client Secret of the ADFS app (from the secret store) → Update Provider. Read back the type.
> 2. Fresh context, onboard `<user>@<tenant domain>`. The login form shows the password fields and `#login-with-microsoft-button`. Shot.
> 3. Click "Sign in with Microsoft". The navigation goes to the Microsoft / ADFS host, then (after the sign-in) to `https://ct-polyid-login…/api/accept-login/<provider id>`, then Hydra, then the myPP `/tabs/`. `current-user/sync` returns the PEP user mapped to the Microsoft e-mail. Record the host chain (no tokens).
> 4. **Pure ADFS.** Type = "Microsoft ADFS" → fresh login. After the on-board e-mail the browser goes straight to Microsoft, with no PolyID password form. Expect `/tabs/`.
> 5. **Entra.** Type = "Microsoft Entra" with the v2 settings → as step 4. Expect `/tabs/`.
> 6. Restore the recorded type and settings; one password login of a control user on `{{MS_TENANT}}` works.
>    Expect: every login lands in myPP. An `AADSTS50011` (redirect URI) is an environment blocker → BLOCKED. A PolyID error after the callback (`ExternalOAuthTokenExchangeException`, `/ui/error`) is a FAIL.
>    Oracle: navigation host chain, landing, sync identity, provider read-backs.
>    Evidence: 02-login-with-ms.png, 03-chain.json, 04-adfs.png, 05-entra.png, provider-before/after.json.
>    Source: 13219168271#1, #2 (corrected); gap G13 (PID-IDP-01, PID-IDP-02); `PL/rest/LoginWebappController.java:110-117`, `PL/service/authhandler/MicrosoftOidcAuthHandler.java:52-110`, `PL/rest/HydraLoginController.java:538-548`.

### AUT-13 Microsoft login on the myPOLYPOINT app path

> Data prerequisite: AUT-12 steps 4 or 5 active (pure ADFS or Entra on `{{MS_TENANT}}`, same exclusive window). Guess: the desktop harness can complete it because the app polls `auth-status` and does not need the deep link. If the app never starts polling → BLOCKED "deep link not simulable", manual on a device.
> Pre: `polyid-flow.mjs <MS_TENANT> - aut13.mjs out/AUT-13 --app inapp --headed`.
> Steps:
>
> 1. Type `#provider-email-input` = the tenant e-mail. Capture `GET …/api/providers?email=`; `externalOAuthConfig.authorizeUrl` is present (host only recorded).
> 2. The app opens the external browser (Playwright `popup` / new page). Sign in to Microsoft (saved account).
> 3. The callback `…/api/auth/external-oauth-provider/auth-callback` answers 301 to `mypolypoint://auth-callback`; the desktop navigation fails, which is expected. Meanwhile the app keeps polling `POST /api/auth/external-oauth-provider/auth-status` (401 until done, then 200 or `CONSENT`). Record the statuses.
> 4. The app shows `/tabs/home` (or consent first).
>    Expect: logged in through the poll.
>    Oracle: providers JSON, poll statuses, landing.
>    Evidence: providers.json, auth-status-statuses.json, 04-home.png.
>    Source: 13219168271#3; PID-API-02, MYPP-AUTH-06; `PL/rest/AuthApiController.java:70-86`, `MA/flows/auth/services/microsoft-oauth-auth.service.ts:24-156`.

### HPN-26 MS Teams pre-flight on the shared CT tenant (read-only)

> Data prerequisite: `{{PIDOPS}}` PolyID-ops operator session on CT (harness extension polyid-admin.mjs provider-read / user-read); `{{OPS}}` portal session.
> Pre: none. **Read-only** on `ct-zinc-master` (no reset, no save).
> Steps: 1. PolyID ops → Tenants → `ct-zinc-master` → tab "Microsoft Teams": record "Enabled", "Enforce MS Teams only", App/Tenant/Client id present (values not saved). 2. Tab "Users": for `engsa`, `schre`, `shasm`, `schbea`, `chial` (master2) record "MS Teams — Linked: YES/NO" (or `ms_teams_linked` from `GET /api/admin/users?tenant-id=…&username=…`). 3. Portal ops: `portal-ops.mjs … flag read ct-zinc-master poma.msTeams.notifications` for `ct-zinc-master`. 4. Write `teams-preflight.md`: GO for HPN-25 when Teams is enabled, ≥ 1 HP linked or resettable, flag known.
> Expect: values recorded; GO/NO-GO.
> Oracle: the admin API JSON / ops UI values.
> Evidence: teams-preflight.md, screenshots with secrets masked.
> Source: 12871467050#4, 13640368197#2; PID-API-05, PID-OPS-04.

### HPN-24 Beekeeper-mode simulation on CT (partner token + bridge shim) — automatable substitute, BLOCKED until decided

> Data prerequisite (open decision, `data-plan.md` §6 Q1): a PolyID token for an HP that carries `partner_id` and partner right `UI_EMBEDDING` for the tenant — candidates: the CT tenant `beekeeper-integration-tenant-test` with partner client `event-consumer-integration-beekeeper-integration-partner` (named in `useful-stuff/bruno/polyid/environments/4. ct-zinc-master.bru`; liveness unknown), or a DeployMate tenant granted that partner (stage-wide partner registry → steward only, with the user's OK). Token source: PolyID `POST /api/partner/{tenantId}/token` (role EVENT_CONSUMER, PID-API-04) or the Beekeeper token exchange (needs Beekeeper). Harness extension app.mjs --token-entry (token entry instead of the PolyID form). Flag `beekeeperFullPwa` OFF (part A) / ON (part B, tenant mutation).
> Pre: `ctx.addInitScript(() => { window.__bk = []; window.BeekeeperBridge = { get: () => undefined, set: (n, d) => window.__bk.push([n, d]) }; })` (Android bridge shape, `A/shared/util/beekeeper-set-title.ts`).
> Steps: A (embedded): 1. Open `{{APP}}/flows/beekeeper/notification-center?access_token=<token>` → redirect via `/partner/notification-center` to `/flows/profile/notification-center`; `.header-bar` absent, no tab bar, no back button; `window.__bk` contains `['ui.title', '{"value":"Benachrichtigungen"}']`. 2. Repeat for `planning-preferences` (record: smartPEP page, may fail on a tenant without cpp), `time-accounts`, `additional-balances`, `time-recording`, `scheduling-request`, `shift-swap/create`. 3. From the time-accounts page `api.goto('/tabs/calendar')` → redirected to `/flows/beekeeper/planning-preferences` (allow-list, `full-app.guard.ts`). 4. NC: tap a `WEEK_VIEW` card → URL unchanged, row read; tap a swap card (if any) → swap detail opens. 5. Sub-page (time recording → month report) → back button visible, back returns. B (PWA, flag ON): 6. Open `{{APP}}/flows/beekeeper/home?access_token=…` → dashboard, tab bar on top, header visible; profile without `#logout-menu-entry`; `window.__bk` stays empty. 7. Open `…/flows/beekeeper/time-accounts` → stand-alone page with back button, no tab bar.
> Expect: as listed (mirrors HPN-22/23 expectations).
> Oracle: final URLs, DOM presence (`.header-bar`, tab bar, `#backButton`, `#logout-menu-entry`), `window.__bk` contents, `GET /api/capabilities/v1/capabilities` 200 with the partner token (partner tokens with UI_EMBEDDING may call `/api/mobile/**`, `PomaApiSecurityConfiguration.java:96-112`).
> Evidence: screenshots, bridge.json.
> Source: 14773288966#1…#7 (substitute); MYPP-EMBED-01, -02, -03; G-19.

### SWP-20 Below on-prem 26: no flexible flow (second environment)

> Data prerequisite: a shared box below on-prem 26 (Preview `pre-dev-main24` or CT-zinc-main24; DeployMate provisions only master and main-26), owners' consent; never change its version, definitions or settings. Its Dienste need `POMASCHICHTTYP` (else the generic list cannot match candidates, gap G-24) — not set → BLOCKED-data. OLDHP1 / OLDHP2 (same personnel category) on that box.
> Steps: 1. Capabilities: `GET_SHIFT_TRADE_CANDIDATES_WITH_TARGET_EMPLOYMENT_IDS` absent. 2. HP1: F-day detail → "Wunsch": generic list "Frühdienst", "Tagdienst", "Spätdienst", "Nachtdienst", "Abwesenheit". 3. Pick "Abwesenheit" → stepper still 3 steps (no "Angebot"/"Auswahl"). 4. Pick "Spätdienst" → candidates with `shift_type` LATE; select HP2 → create → 200.
> Expect: as listed (corrected expectation; the edge-case page says the absence option is not available).
> Oracle: capabilities.json, option texts, step count, candidates/create responses.
> Evidence: screenshots, JSON. Source: 14149550106#1, 14149976102#10, gap G-24.
