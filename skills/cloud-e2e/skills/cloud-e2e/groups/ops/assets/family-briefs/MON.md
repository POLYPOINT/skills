# Family MON — Ops dashboard, versions, tenant access (OPS-01, OPS-15, OPS-17) · read-only

|                           |                                                         |
| ------------------------- | ------------------------------------------------------- |
| Scenarios (in this order) | OPS-01, OPS-15, OPS-17                                  |
| Actor                     | OPS (`{{PORTAL_PROFILE}}`)                              |
| Paused by                 | W-Y-HEALTH (OPS-17 reads tenant health), W-Y-MSG (HARD) |
| Profiles / results        | `{{RUN_DIR}}/MON/<scenario>/`                           |
| Read first                | the group part above; scenarios.md OPS-01, 15, 17       |

Read-only family: never press "reconcile enabled_for" (tenant analytics) or any edit.

## OPS-01 — Ops dashboard: organisation health cards and organisation detail

1. `{{PORTAL_HOST}}/ops/dashboard`; timer from navigation until the first `.card` with `.card-status-header` is visible. Shot `01-dashboard.png`.
2. Capture `GET /dashboard/organizations` and the page's `GET /health?tenantIds=…` calls → `dashboard-organizations.json`, `health-*.json`.
3. Cards = organisations returned; every card has a header class `status-<X>` and tenant pills `.tenant-status-pill.status-DOWN|WARN|PRE_PROD_DOWN|UP|UNKNOWN`.
4. The card of `{{PORTAL_ORG}}`: its UP / DOWN pill counts match its tenants' statuses in the health map (a tenant is DOWN if any component is DOWN).
5. Filters (tenant type PROD / TEST, status) once each: record the card count change.
6. Click the `{{PORTAL_ORG}}` card → `/dashboard/{{PORTAL_ORG}}` lists `{{TENANT}}` with per-component status → click → `/organizations/{{PORTAL_ORG}}/{{TENANT}}`. Shot `06-org-detail.png`.
7. Public probes (no token): `GET {{PORTAL_API}}/api/v1/version` and `/api/v1/server/time` → 200.

Expect: first card ≤ 10 s (timing in notes); cards = organisations; consistent pills; detail and deep link work.

## OPS-15 — Versions page, version matrix, bundle compare, tenant analytics

1. `/ops/versions` tab "Tenant Versions": a row for `{{TENANT}}` with bundle `26.99.0` and the P2 version = `GET /versions/tenants` → `versions.json`. Shot `01-versions.png`.
2. "Show bundle details" on that row → dialog with `application_versions_list`; close.
3. Select `{{TENANT}}` and one other row → "Compare" → the comparison dialog renders.
4. Tab "Version Matrix" (`GET /versions/matrix` → `matrix.json`, ≥ 1 bundle row).
5. `/ops/tenant-analytics`: summary and browse render; a chip on bundle `26.99.0` narrows the browse list to include `{{TENANT}}`. Shot `05-analytics.png`.

## OPS-17 — Tenant access page and uptime dialog

1. `/ops/tenant-access` "VPN Endpoints": tabs "Default VPN Endpoints" and "Tenant Specific VPN Endpoints" render tables. Shot `01-tabs.png`.
2. In the tab that lists `{{TENANT}}`: "expand row" on its endpoint → tenant rows; on `{{TENANT}}` "Show Uptime Graph" → dialog titled `{{TENANT}}` with "Health %, Deephealthcheck %, Vpn %, Ping %, Ratelimiter %" (values 0–100). Shot `02-dialog.png`.
3. Time Range "Last 3 hours" → the displayed range changes and a new `POST /monitor/graphql` with the new bounds is captured (`graphql-*.json`); toggle "Ping" → a Ping line appears. Close.
4. "Open tenant details page" on the same row → `/organizations/{{PORTAL_ORG}}/{{TENANT}}…`.

## Cleanup checklist

- Nothing changed.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
