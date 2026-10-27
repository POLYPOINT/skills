# Oracles — how to prove a number

Three oracles, in order of speed: the api-gw JSON the cloud actually consumed (captured from the browser or fetched through the tunnel), the api-pp journal (what api-gw consumed), PEP's Stempeleditor (what the customer sees in the source system). A scenario passes when the myPP screen, the API payload and the oracle agree.

## 1. api-pp oracle (fastest, exact payload api-gw consumes)

Prerequisite: a tunnel to the on-prem box of the tenant under test (see env-setup.md §4) exposing api-pp on `localhost:9090` and Keycloak on `localhost:8383`, plus the service-client secret from the vault / credentials file (`$PP_SECRET`). Never inline the secret.

Token (60 s lifetime, mint right before each call):

```bash
TOK=$(curl -sk -X POST https://localhost:8383/auth/realms/POLYP01/protocol/openid-connect/token \
  -d grant_type=client_credentials -d client_id=polypoint-p4-api-personnelplanning \
  -d client_secret="$PP_SECRET" | jq -r .access_token)
```

Roster cells with journal entries (master bundle shape) or time allocations / time quantities (PR bundle shape). Note: POST, a GET answers 405.

```bash
curl -s -X POST \
  "http://localhost:9090/pp-api-personnel-planning/api/v2/read/dynamic_roster_complete/employment-ids/range/2026-09-01/2026-09-30" \
  -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"ids":[22234]}' > apipp-roster.json
# master bundle: per cell
jq '.[].rosterCells[] | {day, counted: .countedLayer.timeAmountJournalEntries, planned: .plannedLayer.timeAmountJournalEntries}' apipp-roster.json
# PR bundle: per cell
jq '.[].rosterCells[] | {day, timeAllocations, timeQuantities, previewBlocks: (.previewBlocks|length), shiftBlocks: (.shiftBlocks|length)}' apipp-roster.json
```

Reading rule: `creditTimeAmount.timeAccountIdentifier.id` (master) / `creditTimeAccountIdentifier.id` (PR) — `1` = GLAZ (counts as credited flex time), `-1` = ohne Zeitkonto (never counts). Credited for a day = Σ duration of SHIFT_DEFINITION-type (master) or PRESENCE/ABSENCE/ON_CALL-type (PR) entries with credit account 1, absences reported separately.

Daily time report (BG-reduced planned time, the source of the month "Geplant"):

```bash
curl -s "http://localhost:9090/pp-api-personnel-planning/api/v2/daily-time-report/22234/2026-09-01/2026-09-30" \
  -H "Authorization: Bearer $TOK" | jq '.[] | {day, plannedWorkTime, targetWorkTime, workTime, flexTimeBalance}'
```

Flex-time balance at a date:

```bash
curl -s "http://localhost:9090/pp-api-personnel-planning/api/v2/read/flex_times/22234/balance/2026-09-30" -H "Authorization: Bearer $TOK" | jq .
```

Keep raw seconds: PEP rounds for display (half away from zero), the cloud rounds the same way since PPCLOUD-14029.

The Bruno collection `~/Documents/bruno/API-PP` documents more shapes (read the YAML, run with curl; saved tokens are stale).

## 2. api-gw JSON as the cloud sees it

Two ways:

- From the browser: every myPP day view triggers `GET /api/mobile/unified-time-recording/v1/days?from&to`; the roster-cell JSON itself is not exposed to the browser. For the raw api-gw payload use the tunnel: `GET http://localhost:<apigw-port>/pp-api-gateway/api/v1/roster-cells?from=YYYY-MM-DD&to=YYYY-MM-DD` with an impersonation token of the employee (how the cloud mints it: portal-tenant-access; for E2E ask the orchestrator for the captured fixtures instead of minting yourself).
- From the orchestrator's fixtures folder (gate G5 and after each write family): `<fixtures>/<env>/<employment>-<month>.json`.

Diff a baseline and a candidate capture semantically (a known-good bundle vs the bundle under test, or the same environment before/after a change):

```bash
python3 -I <skill>/scripts/diff-roster-cells.py fixtures/<baseline>/22234-2026-09.json fixtures/<candidate>/22234-2026-09.json --day 2026-09-16
```

The signatures are evaluated on each side on its own, so the candidate's F1/F2/F12 flags count even without a baseline difference. For the cloud-side harness fixtures (no service client): `python3 -I <skill>/scripts/diff-fixtures.py <dirA> <dirB> [out.md] --labels=A,B`.
The script prints per day the plannings, planned/counted entries (type, shift_planning_id, account, shift definition, duration), block counts, and flags: `F1` (all counted entries unattributed, SHIFT_DEFINITION entries without shift definition), `F2` (enum literal unknown to the cloud), `F12` (account id 0). Exit code 1 when any signature fires.

## 3. PEP Stempeleditor (source of truth for the customer)

Through the `pep-verify` skill on the tenant box (one RDP session per box, serialize access with the lock file described in the agent brief):

- Open Stempeleditor for the employee and day (or the roster's "Ist-Zeit Tag" view, Ctrl+0): Ist / Angerechnet is the credited number myPP must match. PEP's **"Soll"** is the Arbeitsplan target (TAGESSOLL × BG) and is **not** the oracle of the cloud's "Geplant" (that is Σ `PLANUNG.SOLLZEIT`, §5); the unified day view shows no planned total at all.
- GLAZ Saldo: PEP Zeitkonto view (flex balance) at month end → compare with the myPP header chip (HOURLY_BALANCE).
- Interpretation marks ("Fatal: keine Stempel" etc.) on the roster cell after a myPP block write (W-02).
- Block list of the day (Dienstplanung / Stempeleditor block tab) to count preview blocks after W-05 and to check survival after W-06.

Asymmetries to remember (from pep-verify OPERATIONS §6): api-pp planning writes silently no-op on days that already carry stamps (use PEP for those); api-pp direct-shift-planning cannot keep allowances (paint in PEP); for permission checks the wire is the oracle (`allowed_actions` in `/days`).

## 4. Reading the unified payload (`/days` item)

`shifts[].time_amounts.{planned,recorded,credited}` in minutes/ISO as rendered; `shifts[].blocks[]`, `timestamps[].shift_planning_id` (null until the pair completes), `on_call_shifts[].assignments[]`, `permissions.{is_period_closed,is_read_only,can_edit_timestamps,can_edit_blocks,can_edit_breaks,can_add_on_call,can_add_retroactive_timestamps}`, `allowed_actions` on the day, each shift, break and timestamp, `benefits[]`, `time_credits[]`. Month: `GET /reports/month` → `days[].time_amounts.{planned,credited,balance,benefits_credited}` and `summary`.

## 5. Which oracle for which number (root-caused 2026-10-15)

| Number                                                                                      | Oracle                                                                                                                                                                                                                                                                           | Not the oracle                                                                                                                                        |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unified credited (day card, month row, `summary.credited`)                                  | Σ `ZEITANRECHNUNG.ZEIT` with `AN_ZEITKONTO = 1` per day / month = PEP "Ist-Zeit Tag" (verified on every first-run employee)                                                                                                                                                      | —                                                                                                                                                     |
| Unified planned ("Geplant", month rows and summary)                                         | Σ `PLANUNG.SOLLZEIT` per day / month = api-pp `plannedWorkTime` (BG reduction is written into SOLLZEIT on-prem by P2 `Modifypacode`; the cloud only displays it)                                                                                                                 | PEP "Soll" / TAGESSOLL × BG; the unified day-level `time_amounts.planned` / balance (roster-cell planned layer, not shown as a total in the day view) |
| Classic credited (`/time-recording/v1` day and month)                                       | Σ stamp `creditedDuration` per shift + absence credits + unplanned stamps / on-call (+ FLEX benefits)                                                                                                                                                                            | PEP Ist on any day with Zeitsummen (classic has no Zeitsummen path)                                                                                   |
| Legacy month `accounted` (`/legacy-time-recording/v1/reports/month`)                        | with `time_stamp_add`: Σ stamp spans (corrected from/to) + on-call block spans; a shift without stamps → Σ `planned_timestamps` spans when that list is non-empty (P2 preview blocks, AS stamps; only up to today+1); without the right: Σ GLAZ `ZEITANRECHNUNG`, past days only | PEP Ist                                                                                                                                               |
| Unified credited of a planning without real blocks (today, future, un-stamped painted days) | Σ GLAZ `ZEITANRECHNUNG` = PEP's planned pre-credit (CODEART P) on 1801; **0:00 on pre-1801 (KD-7)**                                                                                                                                                                              | —                                                                                                                                                     |
| Flex balance (chip, `month-flex-time`)                                                      | api-pp flex balance (raw seconds) = PEP GLAZ-Saldo, except KD-5 drift for BG ≠ 100 (scenarios.md "Known product defects")                                                                                                                                                        | —                                                                                                                                                     |
| Benefits                                                                                    | `ZEITANRECHNUNG` CODEART 'C' rows on a non-GLAZ account (ALLOWANCE)                                                                                                                                                                                                              | GLAZ rows                                                                                                                                             |

Box logs (api-pp, api-gw on the Windows box) are not a dependable oracle — no reachable log path in practice; judge errors on the response body's error name / code (X-02, X-03, W-09) and attach a log excerpt only when one is at hand.

SQL (read-only, through `scripts/sql.sh <tenant-id>`; `ZEIT` / `SOLLZEIT` in seconds; on macOS wrap a call that may hang with `perl -e 'alarm shift; exec @ARGV' <s> …` — there is no `timeout`):

```sql
-- credited per day (GLAZ)
SELECT TO_CHAR(ZA_DATUM,'YYYY-MM-DD') AS DAY, SUM(ZEIT)/60 AS MIN FROM ECBERN.ZEITANRECHNUNG
 WHERE MITARBEITER_ID = <emp> AND AN_ZEITKONTO = 1 AND ZA_DATUM BETWEEN DATE '<from>' AND DATE '<to>' GROUP BY ZA_DATUM ORDER BY 1;
-- planned per day
SELECT TO_CHAR(DATUM,'YYYY-MM-DD') AS DAY, SUM(SOLLZEIT)/60 AS MIN, MAX(SOLLZEIT_BASIS) AS BASIS, MAX(SOLLZEIT_FAKTOR) AS FAKTOR FROM ECBERN.PLANUNG
 WHERE MITARBEITER_ID = <emp> AND DATUM BETWEEN DATE '<from>' AND DATE '<to>' GROUP BY DATUM ORDER BY 1;
-- (groups/utr/scripts/oracle-day.sh prints the same split as ZA| lines for one employee-day)
-- credited per day split by CODEART (KD-7: a day whose only GLAZ row is CODEART P and that has no real block)
SELECT TO_CHAR(ZA_DATUM,'YYYY-MM-DD') AS DAY, CODEART, SUM(ZEIT)/60 AS MIN FROM ECBERN.ZEITANRECHNUNG
 WHERE MITARBEITER_ID = <emp> AND AN_ZEITKONTO = 1 AND ZA_DATUM BETWEEN DATE '<from>' AND DATE '<to>' GROUP BY ZA_DATUM, CODEART ORDER BY 1;
-- benefits per day
SELECT TO_CHAR(ZA_DATUM,'YYYY-MM-DD') AS DAY, CODE, AN_ZEITKONTO, ZEIT FROM ECBERN.ZEITANRECHNUNG
 WHERE MITARBEITER_ID = <emp> AND CODEART = 'C' AND ZA_DATUM BETWEEN DATE '<from>' AND DATE '<to>' ORDER BY 1;
```
