# Family TEN — DeployMate tenant sections (OPS-07, 10, 11, 12, 09) · OPS on `{{TENANT}}`, CPU

|                           |                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | OPS-07, OPS-10, OPS-11, OPS-12, OPS-09                                                                                             |
| Actors                    | OPS (`{{PORTAL_PROFILE}}`, ADMIN); CPU `{{CPU_LOGIN}}` only as the employee searched in OPS-12                                     |
| Tenant                    | `{{TENANT}}` in organisation `{{PORTAL_ORG}}` (editor `{{PORTAL_HOST}}/ops/organizations/{{PORTAL_ORG}}/{{TENANT}}?section=<key>`) |
| PEP                       | OPS-09 writes the on-prem licence (identical content): hold `{{PEP_LOCK_DOC}}` during OPS-09 although no PEP step is done          |
| Paused by                 | W-Y-HEALTH (OPS-07 reads tenant health), W-Y-MSG (HARD)                                                                            |
| Profiles / results        | `{{RUN_DIR}}/TEN/<scenario>/` · `created/TEN.jsonl`                                                                                |
| Read first                | the group part above; scenarios.md OPS-07, 09–12; `env-facts.md` OPS-G2                                                            |

Read-only except "Update Version Matrix" (OPS-07), log / export requests (OPS-11) and the unchanged licence save (OPS-09). Never choose actuator `env`, `configprops`, `heapdump` or a logger write; never press a diagnostics fix button.

## OPS-07 — Monitoring section, certificates, versions, uptime, metrics, installation reports

1. `section('{{PORTAL_ORG}}', '{{TENANT}}', 'monitoring')`: the status badge next to the tenant name equals the worst non-skipped component of `GET /health?tenantIds={{TENANT}}` → `health.json`. Shot `01-monitoring.png`.
2. Tenant status dashboard: one row per report (vpn, ping, health, deephealthcheck, ratelimiter …) with the same status as the health map.
3. On-prem services tiles UP / DOWN: the list equals `GET /tenants/{{TENANT}}/on-prem/services` minus the ignore list (poly-time-connect absent) → `services.json`.
4. Certificates: at least the Keycloak certificate with an expiry date; compare with the captured `…/keycloak/certificates` → `certificates.json`.
5. Versions: "P2" and "Release Bundle" (expect `26.99.0`) equal `GET /versions/tenants` for `{{TENANT}}` (`versions-before.json`); "Update Version Matrix" → `alert("Version matrix updated…")`, `PUT /versions/tenants/{{TENANT}}` 2xx; `last_update` newer (`versions-after.json`).
6. Tab Uptime: "Last hour" default → "Last 3 hours": the captured `POST /monitor/graphql` carries the new range and the response has points; toggle "Ping" → its line appears. Shot `06-uptime.png`.
7. Tab Metrics: Service = the first on-prem service (e.g. `api-pp-personnel-planning`), Metric `http.server.requests`, Statistics "TOTAL_TIME" (or the first offered) → one chart per instance within 30 s. Shot `07-metrics.png`.
8. Section "On-Prem Installation": reports exist or the empty state — either is PASS; note which (shot `08-installation.png`).
9. Cross-check: `env-facts.md` DeployMate tenant health (vpn / ping / health / deephealthcheck, recorded by the runner) agrees with step 2.

## OPS-10 — Api Gateway section: actuator viewer and VPN stats

1. `section(…, 'api-gateway')`: heading "Actuator for {{TENANT}}"; Service "Api Gateway" (default), Endpoint `health` → one text area per instance with `status`. Then Service = `api-pp-personnel-planning` (or the first listed), Endpoint `info` → JSON per instance. Store JSON **keys only** (`actuator-*.json`). Shot `01-health.png`.
2. Toggle "On-prem / Cloud" once each: the VPN viewer reloads (captured call 2xx).
3. Requests / connection-errors tables: record row counts if rendered; record any dialog text (a 503 must not open an error dialog, PPCLOUD-14475).

## OPS-11 — Logs and Data Exports

1. `section(…, 'data-exports')`: rows `<service> logs` per on-prem service, `p2 logs`, "PEP config export"; capture `GET /logfiles/{{TENANT}}` → `logfiles-1.json`. Shot `01-exports.png`.
2. Part A: `api-gateway logs` (or the first row) → "Request" → PREPARING → refresh until READY (≤ 5 min) or FAILED; READY → "View" (line count only) → "Download" (size only, then delete the local file).
3. Part B: `p2 logs` → "Request" → Format + Date range (today) → READY → View ("P2 Logs" table: row count) → OK.
4. Cancel path: request another service log and press "Cancel" while PREPARING → IDLE / FAILED (record).
5. Part C (optional): "PEP config export" needs a PEP DB login typed by the operator in a headed window — without the operator at the machine: BLOCKED "no PEP DB login" for part C only (not FAIL).

Expect: each export READY with a non-empty file; cancel works.

## OPS-12 — Diagnostics

1. `section(…, 'diagnostics')` → "Check Typical configuration mistakes" → component list + report (`…/diagnostics/components`, `…/validation-report`); findings per component → `diagnostics-typical.json`. Shot `01-typical.png`. No fix button.
2. "Employee configuration checks" → search `{{CPU_LOGIN}}` → one hit → validate → `…/diagnostics/user-report/<subject>` (errors / warnings count).
3. "E2E Events Validation" → trigger → per-event outcome (`event-test.json`).
4. "Long Running Checks" → list loads (names + status); start nothing.
5. "Debug on-prem crash / outage" → last 24 h → list loads (may be empty).

## OPS-09 — Licence: view, history, unchanged save (PEP lock)

Take `{{PEP_LOCK_DOC}}` (common part, PEP section; no `pe-ready.sh` needed — no PEP UI step), keep it until step 6.

1. `section(…, 'license')`: Customer Type and the Applications table (title, "Limit: …", "KEYID: …"); capture `GET /tenants/{{TENANT}}/license` and `…/license/history` → `license.json` (`raw_xml` → SHA-256 by the harness), `history-before.json`. Shot `01-license.png`.
2. UI rows = API applications (count, titles, key ids). Optional box read `SELECT COUNT(*) FROM ECBERN.SCHLUESSEL;` (only if SSH works for you; record a 1:1 mismatch as a note).
3. "License information" text = `raw_xml` (compare hashes only).
4. Version select: "Current from On-prem" + n history entries.
5. Save without editing → `alert("License updated successfully")`; `PUT …/license` 2xx; history length = min(n + 1, 10) (`history-after.json`); audit `TENANT_LICENSE` UPDATE ("License XML pushed to the on-prem API gateway…") → `audit-license.json`.
6. Select "V.<n+1>" → hash equals step 3; "Current from On-prem" → same hash; `GET …/license` unchanged. Release the lock (pinned delete).

## Cleanup checklist

- PEP lock released; downloaded files deleted (sizes recorded); nothing else changed.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
