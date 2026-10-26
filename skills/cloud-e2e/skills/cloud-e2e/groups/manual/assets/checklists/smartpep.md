# Manual session — smartPEP (PSP-23)

|         |                                                                                              |
| ------- | -------------------------------------------------------------------------------------------- |
| Testers | 1 person with access to Preview `preview-smartpep` and an HP of that tenant                  |
| Where   | Preview `preview-smartpep` (shared; the CPP service is not registered on DeployMate tenants) |
| Time    | ≈ 30 min                                                                                     |
| Record  | PASS / FAIL / BLOCKED; screenshots → the runner writes `scenarios/manual~PSP-23`             |

## PSP-23 — Planning wish v2 (smartPEP planning requests)

1. The HP opens "Wunsch erfassen" (v2) and picks a date range.
2. The definition picker lists only Dienste with Planungswunsch on the Dienst **and** on the job-assignment node (DIENSTPALETTE + DIENST.PLANBAR + DIENST.PLANUNGSWUNSCH + DIENST_DETAIL.PLANUNGSWUNSCH; CPP window now − 1 … now + 150 days).
3. Submit → check the request in smartPEP → delete it.
   Expect: as listed. The flag `schedulingRequestV2` is "not ready for production yet": record the tenant's value.
