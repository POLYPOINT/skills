# Family WISH — Planning wish v1 (PSP-22) · HP7

|                           |                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | PSP-22                                                                                                    |
| Actors                    | HP7 `{{HP7_LOGIN}}` ({{HP7_ID}}) (`--app mypp`)                                                           |
| Days                      | `{{DW}}`, `{{DW1}}`                                                                                       |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/WISH` · `{{RUN_DIR}}/WISH/PSP-22/` · `created/WISH.jsonl`            |
| Read first                | the group brief; scenarios.md PSP-22 (two-level flag: on the Dienst and on the Dienst detail of the node) |
| PEP                       | step 6 (accept the wish) under `{{PEP_LOCK_DOC}}`, exploratory pep-verify (no flow, OQ-20)                |
| Windows                   | paused by W-Y-SOLLPLAN (calendar reads)                                                                   |

## PSP-22 — Planning wish (v1): node-level definitions, create, PEP decision, notification, delete

Pre: gate PSP-GD PASS (`PSP-WUNSCH-JA` `{{DEF_WUNSCH_JA}}` with PLANUNGSWUNSCH on DIENST and on the G-A detail covering `{{DW}}`; `PSP-WUNSCH-NODE-NEIN` `{{DEF_WUNSCH_NEIN}}` only on DIENST); HP7 has right 1031 (steward `rights.sql`); flag `schedulingRequestV1` ON.

1. HP7: `/tabs/shiftmarketplace` → FAB / "Planungswunsch" → add-scheduling-request; pick `{{DW}}`; capture `GET /api/mobile/health-professional/v1/scheduling-requests/shift-definitions?…` → `defs.json`. 2. Create a wish for `PSP-WUNSCH-JA` on `{{DW}}`; capture `POST …/scheduling-requests` → `post.json`. 3. The same wish again via `api.call` → `dup.json`. 4. Calendar `{{DW}}` (`GET …/calendar/roster?from={{DW}}&to={{DW}}`): `scheduling_requests[]` state REQUESTED. 5. On-prem: the wish row exists (`sql.sh` read of the wish table identified at run time, or api-gw impersonated read if available) → `oracle-wish-requested.txt`. 6. PEP lock → accept the wish in the G-A plan sheet (screenshots before / after) → release. 7. HP7: poll `GET /api/mobile/health-professional/v1/notifications?notification-types=SCHEDULING_REQUEST` (≤ 5 min) and the calendar. 8. Second wish on `{{DW1}}`, then delete it in myPP (detail → delete); capture `DELETE …/scheduling-requests/{id}`.
   Expect: step 1 lists `PSP-WUNSCH-JA`, not `PSP-WUNSCH-NODE-NEIN`; 2 → 201; 3 → `SCHEDULING_REQUEST_ALREADY_EXISTS`; 4 REQUESTED; 7 one notification row of type SCHEDULING_REQUEST (`SHIFT_PLANNER_ACCEPTED_SCHEDULING_REQUEST`) and state accepted; 8 → 204, gone from the calendar and from PEP. Step 7 never shows a row: BLOCKED "inbound scheduling-request event not delivered to DM tenant" when the PEP decision is stored, else FAIL. No PEP path for step 6 → steps 6–7 BLOCKED (OQ-20), the rest decides.

## Cleanup checklist

- No wish of HP7 left (delete in myPP or PEP); the accepted wish's planning (if PEP created one) listed in `created_data`.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
