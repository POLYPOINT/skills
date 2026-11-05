# Measured baselines

Real durations from the board's timeline (a release's archived `evidence/` once frozen; `rb -r <release> timeline` writes
the report). Use them to estimate a window; say which numbers you reuse and what differs this time (more replicas, new
migrations, first-pod-then-all, lanes run in parallel). Newest release first.

## PCR-2643-BF1 — bugfix release (Wed 2026-11-04, prod)

Every component from release/preview; no Vault / Keycloak bootstrapping in the window (CORE without 120 210 268 401
406–408 410 411 414 466 468). After Keycloak and PolyID, the app syncs ran in four lanes at once (Portal · TPMS · shared
services · POMA).

**Window:** 22:00:35 → 23:39:28 = 1 h 39 min — **not a reference**: every app sync was done by 22:46 (46 min);
portal-tenant-access was held back on purpose until 23:25 (HA-Proxy migration), then came the ConfigMap restart and the
end checks. Without that hold the window ends ≈ 23:00. It ran without the maintenance page (page ON failed: Ingress class
`haproxy,nginx`).

### Freeze day and prep (Mon 11-02 → Wed 11-04)

| Step                                                | Duration           | Note                                                              |
| --------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| cloud-release-preview (275), changes=all, every app | 45–49 min          | the step's first wait gave up at 44:49 while the run was still on |
| myPOLYPOINT (271) on the same head                  | 2:11               | started by the step (no triggered run found)                      |
| create the 7 releases                               | 1:08               |                                                                   |
| Preview stage of every release                      | 27:19              |                                                                   |
| myPOLYPOINT PROD stage = store upload for review    | 29:53              | ran next to the Preview stages                                    |
| Staging: Config + Bootstrapping stages and syncs    | 3:55               |                                                                   |
| Staging: every other release + its sync             | 20:52              |                                                                   |
| Staging rehearsal: restart for a ConfigMap (CVE)    | 3:29               |                                                                   |
| late-fix regeneration → Preview + Staging (3 fixes) | 5:02 · 4:13 · 8:17 | the third failed once first (0:06)                                |
| Prod stages of the 7 releases (gitops commits only) | 3:30               |                                                                   |

### Prod syncs (window)

| Step                                | Duration | Note                                                          |
| ----------------------------------- | -------- | ------------------------------------------------------------- |
| PITR restore point                  | 0:10     |                                                               |
| maintenance app                     | 1:16     |                                                               |
| config                              | 0:27     |                                                               |
| keycloak (StatefulSet, pod by pod)  | 4:46     | logins can fail for seconds: downtime 4:46                    |
| polyid-login                        | 2:45     |                                                               |
| polyid-hydra                        | 1:41     |                                                               |
| portal-core                         | 3:40     |                                                               |
| portal-events                       | 2:54     |                                                               |
| portal-api                          | 3:39     |                                                               |
| portal-monitor                      | 1:42     |                                                               |
| portal-webapp                       | 2:37     |                                                               |
| portal-tenant-access (every tenant) | 7:16     | VPN tunnels reconnect: downtime 7:15 (3:04 in PCR-2643)       |
| tpms-core                           | 4:02     | Flyway V63                                                    |
| tpms-api                            | 2:30     |                                                               |
| tpms-cloud-connector-api            | 3:34     |                                                               |
| tpms-attachments                    | 2:19     |                                                               |
| tpms-appointment-index              | 9:10     | appointment search pauses: downtime 9:09                      |
| tpms-webapp                         | 2:17     |                                                               |
| messaging                           | 4:05     |                                                               |
| event-handler                       | 2:41     |                                                               |
| permissions                         | 4:14     |                                                               |
| skill-catalog-core                  | 0:48     |                                                               |
| poma-core                           | 5:42     | no Flyway migration this time: downtime 5:42 (13:59 with one) |
| poma-api                            | 3:29     |                                                               |
| poma-conflict-checker               | 3:30     |                                                               |
| poma-webapp                         | 2:22     |                                                               |

### Other window and post steps

| Step                                                   | Duration |
| ------------------------------------------------------ | -------- |
| Flyway ready + clean logs check                        | 0:14     |
| restart of the workloads reading a ConfigMap (CVE)     | 3:32     |
| check after that restart                               | 0:03     |
| maintenance page OFF                                   | 0:32     |
| all apps Synced + Healthy check                        | 0:05     |
| next release line carries the release (post)           | 0:13     |
| branch rotation, maintenance-only (script + typed yes) | 3:47     |
| rotation verified                                      | 0:03     |

## PCR-2643 — feature release (Wed 2026-10-21, prod)

**Window:** first window step 22:13 → all-synced 23:56 = **1 h 43 min**, including a MySQL→PostgreSQL switch of three
services and an idm PG15→PG16 blue-green cutover (neither is part of a normal release).

### Prod syncs (ArgoCD, one board step each; before first-pod-then-all was the default)

| Step                                              | Duration            | Note                                                                                                |
| ------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| config                                            | 0:06                |                                                                                                     |
| apidocs                                           | 1:44                |                                                                                                     |
| bootstrapping (first sync + scale to 1)           | 3:48                | first run failed: Vault root token missing in Secret vault-unseal-keys                              |
| keycloak (StatefulSet, 3 pods in order)           | 4:18                | logins can fail for seconds: downtime 4:17                                                          |
| keycloak-configurer POST                          | 0:09                | after 3 failed runs: no master-realm admin, then a temporary password                               |
| polyid-login                                      | 3:31                |                                                                                                     |
| polyid-hydra (Recreate → RollingUpdate, one-time) | 1:14                |                                                                                                     |
| portal-core                                       | 3:31                | Flyway out-of-order V89–V104                                                                        |
| portal-events                                     | 3:15                |                                                                                                     |
| portal-api                                        | 2:29                |                                                                                                     |
| portal-monitor                                    | 1:28                |                                                                                                     |
| portal-tenant-access ×20                          | 3:04                | every on-prem VPN tunnel reconnects: downtime 3:04                                                  |
| portal-webapp                                     | 2:13                |                                                                                                     |
| tpms-core                                         | 4:47                |                                                                                                     |
| tpms-api                                          | 3:29                |                                                                                                     |
| tpms-cloud-connector-api                          | 3:45                |                                                                                                     |
| tpms-webapp                                       | 2:59                |                                                                                                     |
| tpms-appointment-index ×7                         | 8:51                | appointment search pauses per customer: downtime 8:50                                               |
| tpms-attachments                                  | 20:29 failed → 0:06 | crash loop: missing GCS bucket, created by hand                                                     |
| poma-core                                         | 13:59               | several new pods raced the Flyway migration → first-pod-then-all; shift trades fail: downtime 13:59 |
| poma-api                                          | 4:15                |                                                                                                     |
| poma-conflict-checker                             | 6:01                |                                                                                                     |
| poma-webapp                                       | 3:00                |                                                                                                     |

### Other window steps

| Step                                     | Duration                    |
| ---------------------------------------- | --------------------------- |
| Vault dump refresh (before 22:00)        | 1:17                        |
| PITR timestamps · hydra snapshot         | 0:04 · 0:01                 |
| POST /bootstrapping/vault (8 migrations) | 0:34                        |
| Vault diff, whole namespace vs dump      | 3:31 (first) · 4:12 (final) |
| bootstrapping back to 0                  | 0:37                        |
| all apps Synced + Healthy check          | 0:25                        |

### Downtimes users saw

| What                                                  | Duration |
| ----------------------------------------------------- | -------- |
| logins (idm cutover, Keycloak + polyid-login stopped) | 2:31     |
| Keycloak pod-by-pod restart                           | 4:17     |
| on-prem VPN tunnels reconnect                         | 3:04     |
| TPMS appointment search                               | 8:50     |
| shift trades / opportunities (poma-core)              | 13:59    |
| TPMS 401 during the permissions switch                | 5:52     |
| event-handler paused (events wait in Pub/Sub)         | 16:57    |

Several ran concurrently (portal-tenant-access, appointment index and poma-core overlapped 23:03–23:18): the sum of
the windows (1 h 23 min) is far more than what users experienced end to end.
