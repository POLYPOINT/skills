# Family NT — Notification channels (BKG-27, BKG-28) · read-only, after the other booking families

|                           |                                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | BKG-27, BKG-28                                                                                                                                                                                  |
| Actors                    | portal ops = the runner's profile `{{PORTAL_PROFILE}}`; recipients HPD `{{HPD_LOGIN}}`, HPE `{{HPE_LOGIN}}`, HPF `{{HPF_LOGIN}}`, HPG `{{HPG_LOGIN}}`, HPH `{{HPH_LOGIN}}`, SP2 `{{SP2_LOGIN}}` |
| Inputs                    | `created/FH.jsonl`, `created/BD.jsonl`, `created/RR.jsonl`, `created/IP.jsonl` (assignment, opportunity, availability ids and the time window of each scenario)                                 |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/NT` · `{{RUN_DIR}}/NT/<id>/`                                                                                                                               |
| Read first                | the group brief; scenarios.md "Notification oracle per event", BKG-27, BKG-28; `known-deviations.md` SD-30, SD-27                                                                               |
| Run partner               | `{{PARTNER_NAME}}` (id `{{PARTNER_ID}}`): **read only** — never save, edit or toggle it                                                                                                         |
| Windows                   | none                                                                                                                                                                                            |

Start only after FH, BD, RR and IP are reported. Build `expected.json` first: one entry per (event, recipient) from the oracle table and the created ids (booking confirmed / cancelled: BKG-12, 14, 17, 20; RR invite / response / selection / rejection / reminder / cancellation: BKG-21, 22; IPO invite / response / selection / rejection / cancellation: BKG-23, 24; availability deleted: BKG-26).

## BKG-27 — Partner event channel for every booking / RR / IPO event

1. `node {{SKILL_DIR}}/scripts/harness/portal-ops.mjs {{PORTAL_PROFILE}} "partner logs {{PARTNER_ID}}" {{RUN_DIR}}/NT/BKG-27` (all pages from the run start; usage: harness.md) → `partner-log.json`; one screenshot of the Debug tab. 2. Match each expected event by CloudEvent `type` (`v1/<Subclass>`) and the id in `data` → `partner-match.json` (expected / found / extra).
   Expect: one event per expected notification and recipient; tenant = `{{TENANT}}`; involved user = the recipient's subject. `v1/AvailabilityDeleted` (BKG-26) missing → KNOWN-FAIL SD-30 (only that row). Logging off / partner missing → BLOCKED "run partner not ready" (never switch logging on yourself).

## BKG-28 — Notification centre content and tap routing per event

1. Per recipient (myPP): `/health-professional-app/flows/profile/notification-center` (header bell); capture `notifications` and `all-unread` → `nc-<who>.json`. 2. Type filter chips: Buchung, Ressourcenersatz, interne Pool-Anfrage, Verfügbarkeit. 3. Tap one row per event kind: booking → `…/calendar/booking-details/<id>`; invite / reminder / selection → `…/calendar/opportunity-details/<id>`; rejection / cancellation / availability → stays in the notification centre. 4. "Alle gelesen" → unread counter 0 (only for HPD, HPE, HPF, HPG, HPH; never for another group's user).
   Expect: every expected row present with a German title (`translated_title.de` non-empty, no raw key); routes as listed. SP2's own response rows: record what arrives (SD-27 observation).

## Cleanup checklist

- Nothing written except read states of your own recipients.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
