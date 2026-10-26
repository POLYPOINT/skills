# Family IP — Internal pool opportunity (BKG-23, BKG-24) · HPG, HPH, SP2

|                           |                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | BKG-23, BKG-24                                                                                                         |
| Actors                    | HPG `{{HPG_LOGIN}}` ({{HPG_ID}}), HPH `{{HPH_LOGIN}}` ({{HPH_ID}}), SP2 `{{SP2_LOGIN}}`                                |
| Days                      | `{{IPO_DAY}}` (BKG-23), `{{IPO_DAY2}}` (BKG-24): HPG and HPH free                                                      |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/IP` · `{{RUN_DIR}}/IP/<id>/` · `created/IP.jsonl`                                 |
| Read first                | the group brief; scenarios.md BKG-23, BKG-24; gate BKG-G2 (internal-pool Dienste from the definitions kit)             |
| PEP                       | none (`POST /api/v2/internal-pool-opportunity` is the PEP "Neue Anfrage" stand-in; it requires `writeShiftsOnPrem` ON) |
| Windows                   | none of its own; **paused by W-X-WRITE-OFF**                                                                           |

## BKG-23 — Internal pool opportunity end to end (cloud-write mode)

1. SP2: `createIPO(api, '{{IPO_DAY}}', '{{GROUP_NODE}}')` → `url` → `oppIdFromUrl`. 2. Open it → "Interne Pool-Anfrage": Datum preset, Dienst list = only internal-pool Dienste (compare with `GET /api/private/shift-definition/roster?group-node-id={{GROUP_NODE}}&from={{IPO_DAY}}&to={{IPO_DAY}}&include-presences=true&shift-type-filter=USE_IN_PLANNING&available-for-internal-pool=true`), Pools `E2E-BKG-IPO` → "Weiter"; capture `PUT /api/private/internal-pool-opportunity?opportunity-id=`. 3. "Mögliche Mitarbeitende": both HPs (a never-logged-in member would show "Benutzer hat sich nie angemeldet": none in this pool unless P3b added one — note); comment → publish; confirmation. 4. HPG "Zusagen" (record the page after the answer: SD-38), HPH "Ja, aber". 5. Planner details → "Bestätigen" on HPG → dialog "Einsatz buchen": Datum Einsatz, Dienst, Zielkategorie (+ Anstellung) → OK (conflicts → "Trotzdem Buchen?"); capture `POST /api/private/internal-pool-opportunity/shift-plannings?opportunity-id=`. 6. `plan-day.sh` HPG `{{IPO_DAY}}` before / after. 7. NC: invites (N-07), SP2 responses (N-10, observation), selection HPG (N-11), rejection HPH (N-12).
   Expect: FINALIZED; HPG PLANUNG row with the chosen Dienst; NC rows per the oracle table.

## BKG-24 — IPO: cancel a draft, cancel a published request, whole-day fallback

1. `createIPO(api, '{{IPO_DAY2}}', '{{GROUP_NODE}}')` → open → "Abbrechen" in DRAFT → `DELETE /api/private/opportunities/{id}`; it never appears as "Aktiv"; no NC rows. 2. Create again, enrich with a Dienst whose shift request has no block times, publish to both; `opportunity(api, id)`: the shift request spans the whole day with the next-day end flag honoured (PPCLOUD-14529). 3. HPG "Zusagen". 4. Planner "Anfrage annullieren" → HPG NC cancellation (N-13).
   Expect: as listed; CANCELLED; no PLANUNG change.

## Cleanup checklist

- No IPO of SP2 left OPEN; BKG-23 changed HPG on `{{IPO_DAY}}` (list in `created_data`).

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
