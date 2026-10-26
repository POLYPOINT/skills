# Family SH-PW — Partner PWA embedding on ct-zinc-master (PTN-10, PTN-11, PTN-18) · user antbe

|                           |                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | PTN-10, PTN-11, PTN-18                                                                                                                                     |
| Tenant                    | `{{TENANT}}` (= `ct-zinc-master`, stage `{{STAGE}}`); mock user `{{ANTBE_LOGIN}}` = "Beat Antonietti" (`code_challenge_3`) — login name only               |
| Window                    | **W-SH-ANTBE** (SHARED, ≈ 60 min, owners' consent): launched only when `windows/ct~W-SH-ANTBE` is `active`; nobody else uses the mock with antbe meanwhile |
| Gate                      | P-PTN-10 in `env-facts.md` (partner-sessions for challenge 3 → 200); 403 / 404 → BLOCKED "PW prerequisites", change nothing                                |
| Attended                  | PTN-10 step 4 and PTN-11 step 5: the operator types antbe's password inside the iframe of the headed window; you never see it                              |
| Profiles / results        | fresh contexts (default of `pwa-embed.mjs`) · `{{RUN_DIR}}/SH-PW/<scenario>/` · `created/SH-PW.jsonl`                                                      |
| Read first                | the group part above; scenarios.md PTN-10, 11, 18; known-deviations.md PF-5                                                                                |

Sequential: one link state of antbe. Link reads / resets: `node {{SKILL_DIR}}/scripts/harness/polyid-admin.mjs {{PIDOPS_PROFILE}} <out> {{TENANT}} user-read "{{ANTBE_LOGIN}}" --stage {{STAGE}}` / `reset-partner-link "{{ANTBE_LOGIN}}"`. Mock: `node {{SKILL_DIR}}/scripts/harness/pwa-embed.mjs <out> {{RUN_DIR}}/scripts/SH-PW-<scenario>.mjs --stage {{STAGE}} [--headed]`.

## PTN-10 — First embedded login: AUTHENTICATION_REQUIRED, login in the iframe, link, layout, token claims

1. `user-read` → record the link state → `link-before.json`; `reset-partner-link "{{ANTBE_LOGIN}}"` → `user-read` "Linked: NO" (shot `01-reset.png` of the ops row if you use the UI). Log it in `created/SH-PW.jsonl`.
2. Mock (headed): environment "ct" → partner user "Beat Antonietti" (ct) → entry "Full HP app" → "Connect" (shot `02-mock.png`).
3. `sessions()` → the partner-sessions answer `AUTHENTICATION_REQUIRED` with providers → `partner-sessions-1.json`.
4. Log `WAITING FOR OPERATOR: antbe login in the iframe`; wait ≤ 5 min until the dashboard loads in the iframe (shot `05-dashboard.png`). At most 2 password submissions (the operator's).
5. Checks in `myppFrame()`: `ion-tab-bar[slot=top]` present, no `ion-tab-bar[slot=bottom]`; header content hidden; profile tab → no `#logout-menu-entry` (shot `06-profile.png`).
6. Claims of the PolyID access token stored by myPP (frame localStorage, decoded in memory with `claims()`): `partner_id`, `navbar_position = top`, `show_header = false`, `partner_rights` contains UI_EMBEDDING → `claims-pwa.json` (claims only).
7. `user-read` → "Linked: YES" → `link-after-10.json`.

Expect: AUTHENTICATION_REQUIRED, then CUSTOMIZABLE_PWA layout (top tab bar, no header, no logout), claims as stated, linked. No gateway-mock restart.

## PTN-11 — Follow-up embedded login without credentials; re-link after a reset

1. New fresh context → mock → ct / Beat Antonietti / Full HP app → Connect.
2. `sessions()` → `LINKED` (+ token, never saved); the dashboard opens without a login form → `partner-sessions-2.json`, shot `02-dashboard.png`.
3. Layout checks as PTN-10 step 5.
4. `reset-partner-link "{{ANTBE_LOGIN}}"`.
5. New context → Connect → `AUTHENTICATION_REQUIRED` → the operator logs in inside the iframe → linked again (`user-read` "Linked: YES" → `link-after-11.json`) — no gateway-mock restart → `partner-sessions-3.json`.

Expect: no form on the linked login; the re-link works without a restart (the old Confluence restart step is obsolete).

## PTN-18 — Partner deep-link entry points in the embedded app

Pre: antbe linked (after PTN-11). Record the tenant flags `schedulingRequestV2` and `unifiedTimeRecording` of `{{TENANT}}` (`portal-ops.mjs … "flag read {{TENANT}} poma.flows.schedulingRequestV2"` etc., read-only).

1. For each mock entry ("Partner time-recording", "Partner shift-marketplace", "Partner Time Accounts", "Partner calendar", "Partner profile", "Partner planning-preferences", "Partner planning-agreements", "Partner notification-center", "Partner Shift swap") → Connect (linked, no login) → record the iframe's final URL after the redirection guard; one shot per entry.
2. Inside the iframe (`myppFrame().goto(…)`): `<myPP>/partner/shift-swap/create?context=partner-embedding-mock` and `<myPP>/partner/does-not-exist?context=partner-embedding-mock` → final URLs.
3. Write `routes.json` (entry → final URL).

Expect: time-accounts → `tabs/profile/time-accounts`, shift-marketplace → `tabs/shiftmarketplace`, calendar → `tabs/calendar`, profile → `tabs/profile`, notification-center → the notification centre, time-recording → unified or classic per flag, `shift-swap/create` → `flows/shift-swap/planned-shift`; the unknown path → `/tabs/home`; the mock entry "Partner Shift swap" (`partner/shift-swap`) → `/tabs/home` = **KNOWN-FAIL PF-5** (mock entry not mapped since PPCLOUD-14604).

## Cleanup checklist

- antbe linked (state after PTN-11) unless the owners asked for a reset — record which; `link-after-11.json` is the proof the runner copies into the window doc.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
