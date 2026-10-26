# Group brief — partner

Runner notes (the part above the `---` line is not sent to workers): it fills the `{{GROUP_BRIEF}}` slot of `assets/agent-brief.md`. Values come from `partner-allocation.md` (seed P-PTN-7 / P-PTN-9), `stage/run-partner`, `stage/gln`, `stage/provider-gate` and `kits/<env>`. Launch X20 only when `windows/ct~S-CT-GWMOCK` is `active` (the steward requests it with the user's OK). PE starts after PAPI reported PTN-07. Every family needs the runner's PolyPortal ops ADMIN profile `{{PORTAL_PROFILE}}` signed in (≈ 1.5 h); PA and PE also the POMA ops ADMIN profile `{{POMA_OPS_PROFILE}}`.

---

## Group partner — what every worker of this group needs

You test integration partners, partner events, the Partner API and the external workforce on DeployMate env **`{{TENANT}}`** (role {{ENV_ROLE}}, shared with the groups swap, booking, hp and ts) and on the CT stage registries next to it (PolyPortal partners, the external-workforce provider, the gateway mock). Your family brief names your scenarios, actors and days; this part gives the facts they share.

### Actors (claimed by this group; use no other person)

| Token        | Login (MITARBEITER_ID)                                                                           | Role                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| PH1          | `{{PH1_LOGIN}}` ({{PH1_ID}})                                                                     | HP on `{{PH_NODE}}`, owner of the partner trade (seed presence on `{{ST_DAY}}`)                                                       |
| PH2, PH3     | `{{PH2_LOGIN}}` ({{PH2_ID}}), `{{PH3_LOGIN}}` ({{PH3_ID}})                                       | trade candidates, same personnel category as PH1                                                                                      |
| PH4          | `{{PH4_LOGIN}}` ({{PH4_ID}})                                                                     | scheduling-request HP (free on `{{SR_DAY}}`)                                                                                          |
| PH5          | `{{PH5_LOGIN}}` ({{PH5_ID}})                                                                     | planned-shift events HP, RR candidate of PTN-19                                                                                       |
| SPX          | `{{SPX_LOGIN}}` ({{SPX_ID}})                                                                     | planner with 1065 + 1062 (kit `E2E:EXTPOOL`) and 1050 / 1070: BADI external pools, trade approval, RR start; Planblatt `{{SPX_NODE}}` |
| SPN          | `{{SPN_LOGIN}}` ({{SPN_ID}})                                                                     | planner without 1062 / 1065                                                                                                           |
| ERX          | `{{ERX_LOGIN}}` ({{ERX_ID}})                                                                     | optional: replaced employee of the PTN-19 resource replacement                                                                        |
| external HPs | `E2E PTN {{RUN_TAG}} A`, `… B`, `… C`; e-mails `e2e-ptn-{{RUN_TAG}}-a@zinc.ch`, `…-b@…`, `…-c@…` | registered by family EW in the partner simulator (stage-wide registry, run-unique)                                                    |

Tenant subjects of PH1..PH5 (claim values, not credentials) are in `{{RUN_DIR}}/partner-allocation.md`. Read them from there; never log a token to get them.

### Partners

- **Run partner `{{PARTNER_ID}}`** (steward-owned, tenant access to `{{TENANT}}` with USERS, PLANNED_SHIFTS, SHIFT_REQUESTS, NOTIFICATIONS, API_GATEWAY, POMA_SHIFT_TRADE_API, POMA_OPPORTUNITY_API, POMA_SHIFT_REQUEST_API; no UI_EMBEDDING; Debug logging ON). **Read-only for you: never open its editor, never press Save, never toggle its logging.** Any save switches logging off and deletes every logged event of every group (swap SWP-31 and booking BKG-27 read the same log).
- **Throw-away partners** `e2e-ptn-x-{{RUN_TAG}}` (PTN-01), `e2e-ptn-l-{{RUN_TAG}}` (PTN-02), `e2e-ptn-g-{{RUN_TAG}}` (PTN-05): created and deleted by their own scenario, tenant access only to `{{TENANT}}`. Edits need a change-request id `E2E-{{RUN_TAG}}` and a comment.

### Apps, hosts and harness

| What                                     | Where                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| planner web app, BADI, partner simulator | `https://ct-poma-webapp.dev.k8s.polypoint-dev.com` (`/shift-planner/…`, `/badi?group-node-id=<node>&range-start=YYYY-MM-DD&cell-width=60&number-of-cells-displayed=14&employee-column-width=220` — without the sizing parameters the roster body stays empty, `/partner-simulator`) |
| myPP web                                 | `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app`                                                                                                                                                                                                          |
| poma-api                                 | `https://ct-poma-api.dev.k8s.polypoint-dev.com`                                                                                                                                                                                                                                     |
| PolyPortal ops / portal-api              | `https://ct-portal-webapp.dev.k8s.polypoint-dev.com/ops/` / `https://ct-portal-api.dev.k8s.polypoint-dev.com`                                                                                                                                                                       |
| POMA ops                                 | `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/ops/` (`/ops/conflict-checker`, tab "Partner")                                                                                                                                                                                    |
| polyid-login                             | `https://ct-polyid-login.dev.k8s.polypoint-dev.com`                                                                                                                                                                                                                                 |

Commands (exact flags: `{{SKILL_DIR}}/references/harness.md`; always `cd {{RUN_DIR}}` and `MYPP_PROFILES={{RUN_DIR}}/.profiles/{{FAMILY}}`):

```
node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app poma      # SPX / SPN (planner, BADI, simulator)
node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} <login> <script.mjs|-> <outdir> --app mypp      # PH*
node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "<command>" <outdir>              # partner logs / logging / create / delete
node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} <script.mjs> <outdir>             # PolyPortal ops UI (partner editor, Testing tab)
node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{POMA_OPS_PROFILE}} <script.mjs> <outdir> --base poma-ops   # conflict-checker "Partner" publish
node {{SKILL_DIR}}/scripts/harness/partner-api.mjs <partner-id> <outdir> token client|hp … --portal-profile {{PORTAL_PROFILE}}
node {{SKILL_DIR}}/scripts/harness/partner-api.mjs <partner-id> <outdir> <script.mjs> --portal-profile {{PORTAL_PROFILE}}
node {{SKILL_DIR}}/scripts/harness/gwmock.mjs <outdir> received --tx <id,id,…> | strategy get
```

- `portal-ops.mjs` commands used here: `partner logs <id> --since <ISO> [--count 200]` (→ `partner-logs-<id>.json`), `partner logging on|off <id>` and `partner delete <id>` (throw-aways only), `partner create <id> --spec <file.json>` (`e2e-*` ids only). Script mode gives `api.call(method, path, body)` on the portal admin API with the captured ops bearer.
- `partner-api.mjs` reads the partner's client secret **in memory** through your portal ops session (only `e2e-*` partners) and never prints a token. `token client` = client credentials (Keycloak realm `polypoint-polyportal-realm`, client `event-consumer-integration-<id>`); `token hp {{TENANT}} <tenant-subject> de` = HP impersonation through polyid-login `POST /api/partner/{{TENANT}}/token`. Saved: decoded claims only. Calls: `call <METHOD> api:/api/partner/v1/… --as client|hp:{{TENANT}}:<subject> [--body <file>]` (`api:` = poma-api, `portal-api:` = portal-api, `pidl:` = polyid-login).
- `gwmock.mjs` reads the CT gateway mock (one pod for all CT teams): `received --tx` filters the received-bookings inbox by your transaction ids; `strategy get` reads both response strategies. `strategy set` exists only for family X20 inside its window.
- DB oracles (read-only): `{{SKILL_DIR}}/scripts/plan-day.sh {{TENANT}} <MA_ID> <YYYY-MM-DD>` (PEP plannings of a seed employee) and `{{SKILL_DIR}}/scripts/sql.sh {{TENANT}} -f {{GROUP_DIR}}/scripts/ext-planning.sql -D node=<KNOTEN_ID|-> -D day_from=<YYYY-MM-DD> -D day_to=<YYYY-MM-DD>` (plannings of employees **without a login** = the virtual external employees).
- Helpers: `import { act, alertText, issueShot, jsonShot, ncSince, byId, waitFlag } from '{{SKILL_DIR}}/scripts/harness/e2e-lib.mjs'`.

### Oracles (never "looks fine")

| What                | How                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Partner events      | Debug log of the partner: `portal-ops.mjs … "partner logs <id> --since <scenario start ISO>"`. Match by CloudEvent `type` (`v1/<Subclass>`), `source` (= `{{TENANT}}`) and the object id / tenant subject inside `data`. A logged event proves routing to the partner's subscription. Other groups' events are in the same log: filter, never count all rows |
| Partner API results | HTTP status + error name of every call (`guards.json`-style table: token kind, path, status)                                                                                                                                                                                                                                                                 |
| External workforce  | consumer API (`GET /api/external-workforce/v1/health-professionals`, `POST …/availabilities`), planner API as SPX (`GET /api/private/tenant/consumable-external-pools`, `GET /api/private/external-availability-roster/{poolId}?from=&to=`, `GET /api/private/external-providers/transactions?…`), `gwmock.mjs received`, `ext-planning.sql`                 |
| PEP plannings       | `plan-day.sh` before / after, saved as `oracle-<who>-<day>-before.txt` / `-after.txt`                                                                                                                                                                                                                                                                        |

### Concurrency on the shared env

- Every seed login is a planner over all nodes: BADI internal mode, candidate lists and the run partner's log show other groups' people and events. Assert by your own ids, subjects, transaction ids and time windows.
- Family EW works in BADI **external** mode only (booking's pools appear in internal mode).
- Other CT teams register their own external HPs ("Registered on the server, not in your catalog"): never touch them. External HP e-mails are unique stage-wide: only the `e2e-ptn-{{RUN_TAG}}-…` addresses.
- Flags (`partnerSimulator`, `externalAvailabilities`, `schedulingRequestV1`, `shiftTrades`, `opportunities`, write flags) are the steward's baseline: never flip them. Swap and booking windows can pause your PAPI / PE families (the runner checks before launching you).

### Windows

Your family's windows: {{WINDOWS}}. Only X20 changes stage state (gateway-mock strategies), under the lock `locks/ct~gwmock` inside `windows/ct~S-CT-GWMOCK`.

### Evidence and report

- Folder `{{RUN_DIR}}/{{FAMILY}}/<scenario>/`: `NN-<step>.png`, `<endpoint>.json`, `partner-log*.json`, `received-bookings.json`, `oracle-*.txt`, `claims-*.json`, `notes.md`.
- Every created object (throw-away partner, external HP, availability, booking transaction id, scheduling request, opportunity id) one JSON line in `{{RUN_DIR}}/created/{{FAMILY}}.jsonl`.
- KNOWN-FAIL only with a matching signature of `{{GROUP_DIR}}/references/known-deviations.md` (PF-1..PF-5); new findings `N-PARTNER-<n>`.

### Never

- Never edit, save or toggle the run partner `{{PARTNER_ID}}`; never edit the PolyID partner `partner-embedding-mock`.
- Never call a path containing `/test/` yourself (portal-api, polyid-login, event-handler, poma-api, gateway mock): the gateway-mock reads go through `gwmock.mjs` only. Never open the embedding mock's "Notification simulator". Never delete the received-bookings inbox, never restart the gateway mock, never change a strategy outside X20.
- Never run a POMA job (`SyncGlnMappingsWithHubspot`, `PublishShiftsCronJob` included); never press a cache reset.
- Never touch people, days or objects of another group (swap T* / U*, booking HP* / SP*, hp N*, ts N4*), other teams' external HPs or partners, or another tenant.
- No DML: the GLN, the provider and the run partner are the steward's.
- Never print, copy or save client secrets, tokens, passwords or connect strings; the scripts keep them in memory.
- **Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
