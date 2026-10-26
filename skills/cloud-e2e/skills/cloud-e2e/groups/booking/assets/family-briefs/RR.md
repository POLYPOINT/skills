# Family RR — Resource replacement (BKG-21, BKG-22) · ER, HPG, HPH, SP2

|                           |                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | BKG-21, BKG-22                                                                                                                                 |
| Actors                    | ER `{{ER_LOGIN}}` ({{ER_ID}}) (replaced), HPG `{{HPG_LOGIN}}` ({{HPG_ID}}), HPH `{{HPH_LOGIN}}` ({{HPH_ID}}), SP2 `{{SP2_LOGIN}}` ({{SP2_ID}}) |
| Days                      | `{{RR_DAY}}` (BKG-21), `{{RR_DAY2}}` (BKG-22): ER presence, HPG / HPH free                                                                     |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/RR` · `{{RUN_DIR}}/RR/<id>/` · `created/RR.jsonl`                                                         |
| Read first                | the group brief; scenarios.md BKG-21, BKG-22 and the notification oracle table; `known-deviations.md` SD-38                                    |
| PEP                       | none (the RR is created through the public API as the PEP stand-in; the PEP entry point is group `manual`)                                     |
| Windows                   | none of its own; **paused by W-X-WRITE-OFF**                                                                                                   |

**RR creation (PEP stand-in), used by both scenarios:**

1. ids: `{{SKILL_DIR}}/scripts/sql.sh {{TENANT}} -f {{GROUP_DIR}}/scripts/rr-ids.sql -D er={{ER_ID}} -D day=<RR day> -D cands={{HPG_ID}},{{HPH_ID}}` → `rr-ids.txt` (planning node, Planblatt candidates, Keycloak ids).
2. ER (`--app mypp`): `ps = (await rosterRange(api, '<RR day>', '<RR day>')).body.days[0].planned_shifts[0]`, then `detail = (await api.get('/api/mobile/health-professional/v1/calendar/planned-shift-detail?shift-planning-id=' + ps.shift_planning_id + '&roster-cell-id=' + ps.roster_cell_id)).body` → start, end, shift_type, title, shift_definition_id (PA code), employment id; save `er-shift-detail.json`.
3. SP2 (`--app poma`, any planner page loaded so the bearer is captured): `body = rrBodyFrom(detail, {employeeId: <detail.employee_id or {{ER_ID}}>, employmentId: <detail.employment_id or {{ER_ID}}>, nodeId: <R1 node>, employeeName: <ER name>, roster: {id: '{{GROUP_NODE}}', name: '{{GROUP_NAME}}'}, pool: [{employeeId: {{HPG_ID}}, keycloakUserId: <R4>}, {employeeId: {{HPH_ID}}, keycloakUserId: <R4>}]})`; `createRR(api, body)` → save request + response; `url` = `…?opportunity=<id>` → `oppIdFromUrl`. A 4xx naming a field: fix that field once from the schema (`ResourceReplacementRequest`), else BLOCKED "RR creation body".

## BKG-21 — Resource replacement end to end (cloud-write mode)

1. Create the RR for `{{RR_DAY}}` (above). 2. SP2 opens the `url` → RR page (PENDING): both candidates listed with conflict info; `#absence-type-field` "Absenzgrund" offers only plannable absences → `{{ABS_DEF}}`; message in `#comment-text-area-field` → publish; capture `PUT …/resource-replacement/{rrId}/absence-shifts/{id}` and `POST /api/private/opportunities/{id}/active-participants`. 3. Side menu "Anfragen verwalten" → status "Aktiv" lists it. 4. HPG: NC row (N-08) → tap → `…/calendar/opportunity-details/<id>` → "Zusagen" ▸ "Ja, aber" + comment; record the page after the answer (SD-38: home instead of an inform page → KNOWN-FAIL SD-38 for that step only). HPH: "Zusagen". 5. SP2 NC (myPP as SP2, who also holds the HP role): N-10 rows (observation SD-27). 6. Planner details: answers "Ja, aber" and "Zugesagt"; "Erinnerung senden" disabled (< 15 min). 7. "Bestätigen" on HPG → dialog "Ressourcenersatz … wird von <name> übernommen" (conflicts → "Trotzdem abschliessen?") → "Abschliessen"; capture `POST /api/private/opportunities/{id}/final-selection` and `POST /api/private/resource-replacement/shift-plannings?opportunity-id=` (+ `apply-contexts/{ctx}`). 8. `plan-day.sh` ER and HPG on `{{RR_DAY}}` (before / after). 9. "Anfragen verwalten": default "Aktiv" no longer lists it; "Bestätigt" does. 10. HPG NC selection (N-11); HPH NC rejection (N-12) and its detail shows the finished state.
   Expect: as listed; ER's planning becomes `{{ABS_DEF}}`; HPG gets the RR Dienst; opportunity FINALIZED.

## BKG-22 — RR reminders and cancellation

1. Create + publish an RR for `{{RR_DAY2}}` to both. 2. Immediately: "Erinnerung senden" disabled ("Eine Benachrichtigung wurde kürzlich versendet…"); `GET …/reminders/available-trigger` says not available. 3. HPG "Zusagen"; wait ≥ 15 min (sleep in 60 s steps). 4. "Erinnerung senden" → `POST …/reminders`; "reminder sent" dialog. 5. NC: HPH (no answer) has a reminder row (N-14), HPG none. 6. Planner: "Anfrage annullieren" → confirm; capture `DELETE /api/private/opportunities/{id}`. 7. HPG NC cancellation (N-13); myPP detail "Abgesagt", no answer buttons.
   Expect: as listed; CANCELLED; no PLANUNG change for HPG; ER keeps its presence.

## Cleanup checklist

- No opportunity of SP2 left OPEN (BKG-22 cancelled, BKG-21 finalized).
- BKG-21 changed ER / HPG on `{{RR_DAY}}`: list in `created_data`.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
