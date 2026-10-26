# Family SH-BEE — Beekeeper-mode simulation on CT (HPN-24) · BLOCKED until the partner-token source is decided

|                           |                                                                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | HPN-24                                                                                                                                                                                                                                               |
| Tenant                    | `{{TENANT}}` (= `beekeeper-integration-tenant-test`, stage `{{STAGE}}`); HP `{{BEEHP_LOGIN}}` reached through a partner token                                                                                                                        |
| Decision                  | `BEE_DECISION` = `{{BEE_DECISION}}`. Anything but `approved` → report HPN-24 **BLOCKED "partner-token source not decided (OQ-28)"** and do nothing else                                                                                              |
| Token                     | the runner starts the token-entry login itself (`app.mjs … --token-entry <url>`, the URL carries the token and is never logged) into the profile `{{RUN_DIR}}/.profiles/SH-BEE`; you only reuse that profile — never request, print or store a token |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/SH-BEE` · `{{RUN_DIR}}/SH-BEE/HPN-24/`                                                                                                                                                                          |
| Read first                | the group part above; scenarios.md HPN-24                                                                                                                                                                                                            |

## HPN-24 — Beekeeper-mode simulation (partner token with UI_EMBEDDING + BeekeeperBridge shim)

Only with `BEE_DECISION` = `approved`. Each step in an `app.mjs {{TENANT}} "{{BEEHP_LOGIN}}" <script> <out> --app mypp --stage {{STAGE}}` run on the prepared profile; the script first calls `ctx.addInitScript(() => { window.__bk = []; window.BeekeeperBridge = { get: () => undefined, set: (n, d) => window.__bk.push([n, d]) }; })`. A login form appearing = the profile lost its token → BLOCKED "token-entry profile expired".
Part A — embedded (flag `poma.mobileApp.beekeeperFullPwa` OFF as found; read it, never change it here):

1. `<myPP>/flows/beekeeper/notification-center` → redirect via `/partner/notification-center` to `/flows/profile/notification-center`; `.header-bar` absent, no tab bar, no back button; `window.__bk` contains `['ui.title', '{"value":"Benachrichtigungen"}']` → `bridge.json`.
2. Repeat for `planning-preferences` (may fail on a tenant without cpp: record), `time-accounts`, `additional-balances`, `time-recording`, `scheduling-request`, `shift-swap/create` (shot each).
3. From time-accounts `api.goto('/tabs/calendar')` → redirected to `/flows/beekeeper/planning-preferences` (allow-list).
4. Notification centre: tap a `WEEK_VIEW` card → URL unchanged, row read; tap a swap card if one exists → swap detail opens.
5. Sub-page (time recording → month report) → back button visible and works.
   Part B (PWA, flag ON) runs only when the tenant owners set the flag ON for this window themselves; else part B "not run (flag OFF)":
6. `<myPP>/flows/beekeeper/home` → dashboard, tab bar on top, header visible; profile without `#logout-menu-entry`; `window.__bk` stays empty.
7. `<myPP>/flows/beekeeper/time-accounts` → stand-alone page with back button, no tab bar.
   Oracle also: `GET /api/capabilities/v1/capabilities` 200 with the partner token (UI_EMBEDDING may call `/api/mobile/**`).

Expect: as listed (mirrors the manual Staging cases HPN-22 / HPN-23).

## Cleanup checklist

- Nothing changed on the tenant; the profile folder stays outside the evidence.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
