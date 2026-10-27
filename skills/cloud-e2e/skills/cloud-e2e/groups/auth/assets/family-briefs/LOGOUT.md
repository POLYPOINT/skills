# Family LOGOUT — Logout chains (AUT-14) · HPA (myPP), SEEDSP (planner app)

|                           |                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Scenarios (in this order) | AUT-14                                                                                                                               |
| Actors                    | HPA `{{HPA_LOGIN}}`, SEEDSP `{{SEEDSP_LOGIN}}`                                                                                       |
| Parts                     | part 1 at the start of the group (steps 0–5); part 2 ≥ 65 min after step 0 (step 6)                                                  |
| Budget                    | 1 submission per profile login                                                                                                       |
| Profiles / results        | profiles `{{RUN_DIR}}/.profiles/LOGOUT-hpa`, `…/LOGOUT-sp`, `…/LOGOUT-hpa-b` · `{{RUN_DIR}}/LOGOUT/AUT-14/` · `created/LOGOUT.jsonl` |
| Read first                | the group part above; scenarios.md AUT-14                                                                                            |

**PENDING convention.** Part 1 reports AUT-14 `PENDING` with the part-1 results in `observed`; part 2 reads them and reports the final verdict.

Record, in every logout, each request to `https://ct-polyid.dev.k8s.polypoint-dev.com/oauth2/sessions/logout` and `https://ct-polyid-login.dev.k8s.polypoint-dev.com/api/logout`: parameter **names** and the presence of `id_token_hint` (values never), via `page.on('request')` in your script → `logout-chain-<app>.json`.

## Part 1

0. Profile B for part 2: `MYPP_PROFILES={{RUN_DIR}}/.profiles/LOGOUT-hpa-b node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} "{{HPA_LOGIN}}" - {{RUN_DIR}}/LOGOUT/AUT-14/b-login --app mypp` → note the time TB in `notes.md`. Do not touch this profile again in part 1.
1. Profile A (`MYPP_PROFILES={{RUN_DIR}}/.profiles/LOGOUT-hpa`): `app.mjs {{TENANT}} "{{HPA_LOGIN}}" <script> <out> --app mypp`; Profile → "Ausloggen".
2. The end-session request to Hydra carries `id_token_hint` (present) and `post_logout_redirect_uri` / `state`.
3. The chain passes `…/api/logout?logout_challenge=…` and ends on the client's post-logout URL (record host + path). No page shows "Logout failed because query parameter state is set but id_token_hint is missing"; no `/ui/error`. Shot `03-end-page.png`.
4. Open the myPP root again: `#form-onboard` appears (no silent login). Shot `04-onboard.png`.
5. SEEDSP (`MYPP_PROFILES={{RUN_DIR}}/.profiles/LOGOUT-sp`, `--app poma`): `/shift-planner/dashboard` → header user menu (`.user-container`) → "Ausloggen" → steps 2–4 for the planner app → `logout-chain-poma.json`.

## Part 2 (≥ 65 min after TB)

6. Reopen the myPP root with profile `LOGOUT-hpa-b` (`app.mjs … "{{HPA_LOGIN}}" <script> <out> --app mypp`; the profile is still logged in, so no password is submitted — if a password form appears, record it and stop: BLOCKED "profile B lost its session"). The app renews its tokens silently: record the status of the token request(s) to `…/oauth2/token`. Then "Ausloggen" → steps 2–3 again → `logout-chain-refresh.json` (PPCLOUD-14322: the id_token survives the refresh).

Expect: `id_token_hint` present in all three logouts; a clean end page; a new login required afterwards.

## Cleanup checklist

- All three profiles logged out.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
