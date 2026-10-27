# Family PE — Partner events (PTN-09, PTN-08) · PH5 on CM_DAY / NM_DAY, the PTN-07 trade

|                           |                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scenarios (in this order) | PTN-09, PTN-08                                                                                                                                                                       |
| Actors                    | PH5 `{{PH5_LOGIN}}` ({{PH5_ID}}) on `{{PH_NODE}}`; PH2 / PH3 only as recipients in the run partner's log; portal ops `{{PORTAL_PROFILE}}`, POMA ops `{{POMA_OPS_PROFILE}}`           |
| Days                      | `{{CM_DAY}}` (future day of the current month, PH5 free), `{{NM_DAY}}` (next month, PH5 free, no Sollplan saved)                                                                     |
| Partner                   | run partner `{{PARTNER_ID}}` — read its Debug log only                                                                                                                               |
| PEP                       | PTN-09 paints and deletes one cell for PH5 under the PEP lock (≈ 15 min); palette coordinates of the Dienst and PH5's row are in `{{RUN_DIR}}/partner-allocation.md` (seed P-PTN-11) |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/PE` · `{{RUN_DIR}}/PE/<scenario>/` · `created/PE.jsonl`                                                                                         |
| Read first                | the group part above; scenarios.md PTN-08, PTN-09; known-deviations.md PF-2; `{{RUN_DIR}}/PAPI/PTN-07/notes.md` (oppId, start time)                                                  |

## PTN-09 — Planned-shift partner events: current month vs next month, delete, ops publish

The Dienst you paint must **not** be "always visible" (`partner-allocation.md` names the checked Dienst; seed definitions 111/112/113 are not always visible). PEP is the event source under test.

1. Oracles before: `plan-day.sh {{TENANT}} {{PH5_ID}} {{CM_DAY}}` and `… {{NM_DAY}}` → both "(no rows)" (else BLOCKED-data "PH5 not free").
2. Take the PEP lock `{{PEP_LOCK_DOC}}` as the common part's PEP section says, run `{{SKILL_DIR}}/scripts/pep/pe-ready.sh {{TENANT}}` (continue only on `READY`), open the plan sheet of `{{PH_NODE}}` for the month of `{{CM_DAY}}` and paint the Dienst for PH5 on `{{CM_DAY}}` with `{{SKILL_DIR}}/scripts/pep/pe-paint.sh {{TENANT}} {{PH5_ID}} {{CM_DAY}} <PA code> <radio_y> <slot_x> <slot_y> <row_y>` (values from `partner-allocation.md`; screenshot first to confirm them); then switch the sheet to the month of `{{NM_DAY}}` and paint `{{NM_DAY}}` the same way. Note the time T1 after the second paint. Release the lock if the next PEP step is more than 10 min away, else keep renewing it.
3. Wait ≤ 3 min, then `portal-ops.mjs {{PORTAL_PROFILE}} "partner logs {{PARTNER_ID}} --since <T1 − 5 min>" {{RUN_DIR}}/PE/PTN-09/log-1` → `partner-log-1.json`. Filter: `source {{TENANT}}`, PH5's subject, the day.
4. PEP (lock held): delete the `{{CM_DAY}}` planning (pe-paint the empty / delete gesture of the palette as the allocation file describes; snapshot before and after). Release the lock. Note T2.
5. Logs since T2 → `partner-log-2.json`.
6. POMA ops script (`portal-ops.mjs {{POMA_OPS_PROFILE}} {{RUN_DIR}}/scripts/PE-PTN-09-publish.mjs <out> --base poma-ops`): `/ops/conflict-checker` → tab "Partner" → Type `CREATE`, From / To = `{{NM_DAY}}`, Tenant Subject = PH5's, tenant `{{TENANT}}` → "Publish Events" (shot `06-publish.png`); note T3; logs since T3 → `partner-log-3.json`.
7. Optional `v1/UpdateUser`: only if the on-prem IdM edit of PH5's last name is possible for you without new credentials — else record BLOCKED-data for this step only (not FAIL); revert any change.
8. Cleanup: delete the `{{NM_DAY}}` planning (PEP under the lock, or `pp-plan.sh {{TENANT}} {{PH5_ID}} {{NM_DAY}} <PA code> DELETE` when `kits/{{ENV}}` marks pp-plan verified); oracles after for both days = "(no rows)".

Expect: step 3 → `v1/UpdatePlannedShift` (often with `v1/UpdateShiftBlock`) for `{{CM_DAY}}` and **none** for `{{NM_DAY}}` (next-month shifts are held back until a Sollplan exists); step 5 → `v1/DeletePlannedShift` for `{{CM_DAY}}`; step 6 → `v1/UpdatePlannedShift` for `{{NM_DAY}}`. If the PEP lock cannot be taken within 30 min: BLOCKED "PEP lock held by <holder>".

## PTN-08 — Partner notification events of the partner-initiated trade + opportunity callback

Pre: PAPI's PTN-07 notes give `oppId` and its start time T. PTN-07 not PASS or no `oppId` → BLOCKED "PTN-07 not done".

1. `portal-ops.mjs … "partner logs {{PARTNER_ID}} --since <T>"` → `partner-log.json`.
2. Build `partner-match.json` (expected vs found, matched by `type`, `source {{TENANT}}` and `oppId` in `data`): `v1/OpportunityShiftTradeInvitation` (recipients PH2, PH3), `v1/OpportunityResponse` (to PH1 after PH2's YES), `v1/ShiftTradeSubmission` (approvers), `v1/ShiftTradeApproval` (PH1 / PH2).
3. Callback with the run partner's **client** token: `node {{SKILL_DIR}}/scripts/harness/partner-api.mjs {{PARTNER_ID}} {{RUN_DIR}}/PE/PTN-08 call GET api:/api/partner/v1/events/consumer/opportunities/<oppId> --as client --portal-profile {{PORTAL_PROFILE}}` → 200 with the full opportunity → `opp-callback.json`.
4. Absence check: no `v1/ShiftTradeNonselection` for PH3. That absence is by design today (**PF-2**): put "PF-2 observed" in notes; it is not a FAIL of PTN-08.

Expect: the four event types with the opportunity id; callback 200. A missing expected event → FAIL with `partner-match.json` and a jsonShot.

## Cleanup checklist

- PH5 has no planning left on `{{CM_DAY}}` / `{{NM_DAY}}` (oracle after); every paint and delete listed in `created/PE.jsonl`.
- PEP lock released (pinned delete); no plan sheet left open.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
