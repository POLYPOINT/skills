# Measured baseline — PCR-2643 (Wed 2026-10-21, prod)

Real durations from the board's timeline (`runs/pcr-2643/evidence/` once archived). Use them to estimate a window;
say which numbers you reuse and what differs this time (more replicas, new migrations, first-pod-then-all).

**Window:** first window step 22:13 → all-synced 23:56 = **1 h 43 min**, including a MySQL→PostgreSQL switch of three
services and an idm PG15→PG16 blue-green cutover (neither is part of a normal release).

## Prod syncs (ArgoCD, one board step each; before first-pod-then-all was the default)

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
| poma-core (5 replicas)                            | 13:59               | several new pods raced the Flyway migration → first-pod-then-all; shift trades fail: downtime 13:59 |
| poma-api                                          | 4:15                |                                                                                                     |
| poma-conflict-checker                             | 6:01                |                                                                                                     |
| poma-webapp                                       | 3:00                |                                                                                                     |

## Other window steps

| Step                                     | Duration                    |
| ---------------------------------------- | --------------------------- |
| Vault dump refresh (before 22:00)        | 1:17                        |
| PITR timestamps · hydra snapshot         | 0:04 · 0:01                 |
| POST /bootstrapping/vault (8 migrations) | 0:34                        |
| Vault diff, whole namespace vs dump      | 3:31 (first) · 4:12 (final) |
| bootstrapping back to 0                  | 0:37                        |
| all apps Synced + Healthy check          | 0:25                        |

## Downtimes users saw

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
