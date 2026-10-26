# Group shared — known deviations (KNOWN-FAIL signatures)

A mismatch that matches the **signature** of a row is reported as KNOWN-FAIL: verdict `FAIL`, `findings_confirmed: ["<id>"]`, `notes` starting with `KNOWN-FAIL <id>`. A different signature, or a FAIL where the row says PASS, is new (`N-SHARED-<n>`). A listed deviation that does not show → PASS with "<id> not reproduced". Ids keep the owning area's prefix so that the consolidation can merge them with the same defect seen elsewhere; SD-nn = `synthesis/suspected-defects.md` (report only).

| Id   | Deviation                                                                                                             | Signature (what you observe)                                                                                                   | Scenario | Layer → owner                                                               | SD    | Status 2026-10-23        |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------- | ----- | ------------------------ |
| PF-5 | The embedding mock entry "Partner Shift swap" (`partner/shift-swap`) has no partner route mapping since PPCLOUD-14604 | that entry lands on `/tabs/home` (the direct route `partner/shift-swap/create` still maps to `flows/shift-swap/planned-shift`) | PTN-18   | myPP `partner-route-config.ts`, gateway mock `mypp-access-routes.ts` → Zinc | SD-31 | suspected (code reading) |

## Observations (record, never a verdict)

| Topic                                                                | What to record                                                                 | Scenario |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| The old Confluence step "restart the gateway mock before re-linking" | the re-link works without a restart (expected)                                 | PTN-11   |
| `planning-preferences` in Beekeeper mode on a tenant without cpp     | the page outcome                                                               | HPN-24   |
| SWP-20 corrected expectation                                         | the absence option **is** offered below 26 (the edge-case page said otherwise) | SWP-20   |
| Microsoft app path without a deep link                               | whether the app reaches `/tabs/` through the `auth-status` poll on a desktop   | AUT-13   |
