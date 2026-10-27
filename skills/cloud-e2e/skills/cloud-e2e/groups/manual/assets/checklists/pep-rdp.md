# Manual session — PEP over RDP (BKG-32, PTN-22 on DM-X; PSP-24, AUT-19 on DM-Y)

|         |                                                                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Testers | 1 person with an OPERATOR share and an own RDP reveal of DM-X and DM-Y (deploymate skill), PEP experience                                                                                                                                              |
| Lock    | before **each** RDP block the runner creates `locks/<env>~pep` with `holder "<tester>/manual"` (ArtifactData, no `if_version`), renews it every ≤ 10 min, deletes it after the block. Taken by an agent → wait (no RDP while a pep-driver agent works) |
| Time    | ≈ 2 h (BKG-32 60 min, PTN-22 20 min, PSP-24 20 min, AUT-19 60 min inside W-Y-MSG)                                                                                                                                                                      |
| Record  | PASS / FAIL / BLOCKED per scenario; RDP screenshots (no credentials visible) → the runner writes `scenarios/manual~<id>`                                                                                                                               |

PEP on DeployMate: one Windows desktop user per box; never two sessions. Planner logins for PEP are seed planners of the env (ask the runner which one is free).

## BKG-32 — PEP-side entry points and display (DM-X)

1. Definitionen → Konfiguration POLYPOINT-Server → Cloud Services → "Verfügbare Mitarbeitende direkt buchen": BADI URL `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/badi` configured.
2. "Poolmanagement öffnen" → "Verfügbarkeiten" opens BADI.
3. A shift's context menu → "Ressourcenersatz" starts an RR; "Neue Anfrage" starts an IPO (cancel both afterwards in the planner app).
4. The green availability squares of the booking group's days after F5 (ask the booking runner for an HP / day with an availability).
5. A Planblatt opened read-only in a second session → try BADI → record the behaviour.
   Expect: as the corrected Confluence pages (booking `confluence-corrections.md`).

## PTN-22 — Sync an external booking into PEP and see it in the Planblatt (DM-X)

Needs booking-partner records (OQ-29: no BOOKING_PARTNER client known on CT) → without them BLOCKED "no booking-partner records".

1. PEP → Planblatt → "Externe Buchungen" (the cloud page opened by PEP) → "sync" on one record.
2. The Planblatt shows the booking in the chosen category on that day (white cell); the record is SYNCED in the cloud list (partner PTN-16 tab "Externer Anbieter" with "Zeige bereits synchronisierte Buchungen").

## PSP-24 — PEP entry points into the planner web app (DM-Y, as the planner group's PLAN-ALL)

1. Datei → "Poolmanagement: Schichtplaner-Dashboard öffnen…" and "…Poolmanager-Dashboard öffnen…".
2. Planblatt → button "Poolmanagement öffnen" → each entry ("Schichtplaner-Dashboard…", "Poolmanager-Dashboard…", "Einen Health Professional finden…", "Neue Anfrage…", "Planblatt-Übersicht…" if still present).
   Expect: each page opens embedded without the language / logout entries and without `missing-authentication.html`; Find HP opens with the plan-sheet date and roster preselected.

## AUT-19 — New user from PEP / UsrAdmin: set-password mail and first login (DM-Y, inside W-Y-MSG)

Only when the steward's W-Y-MSG is in its ON phase (after auth AUT-08 and ops OPS-13 part B) and the team mailbox is available (OQ-24).

1. PEP → new employee with e-mail = the team mailbox.
2. UsrAdmin → new user mapped to that employee, myPOLYPOINT role → "send set-password mail" = yes.
3. The mail arrives in the team mailbox → open the link → PolyID set password (a new strong password, kept only in the tester's head / password manager).
4. myPOLYPOINT first login → consent "Zustimmen" → dashboard; `current-user/sync` OK (the runner can confirm with a harness read of the new user only if the tester wants).
5. Cleanup: delete the user and the employee in UsrAdmin / PEP.
   Expect: mail received, password set, first login works with the new employment.

## After the session

- Every lock deleted; created PEP objects (AUT-19 employee / user, BKG-32 RR / IPO) removed; tell the steward when AUT-19 is done (last item of W-Y-MSG).
