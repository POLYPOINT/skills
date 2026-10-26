-- ext-planning.sql — read-only DB oracle of the partner group: PEP plannings of employees WITHOUT a login in a day range
-- (= the virtual external employees that POMA creates for external-workforce bookings, FindOrCreateExternalHealthProfessional).
--
--   scripts/sql.sh <env> -f groups/partner/scripts/ext-planning.sql -D node=<KNOTEN_ID|-> -D day_from=<YYYY-MM-DD> -D day_to=<YYYY-MM-DD>
--
-- node = the Planblatt / planning node to filter on (the BADI group-node-id, or a child node), or "-" for any node.
-- Output, one line per planning:  XP|<MA_ID>|<YYYY-MM-DD>|PA=<code>|POS=<DIENSTPOSITION>|NODE=<KNOTEN_ID>|TYP=<P/A/I>|<Dienst title>
-- then XN|<count of distinct login-less employees with plannings in the range> (always printed; 0 = none).
-- Seed employees all have a login (MITARBEITER_POLYUSER), so a login-less planning in the range is external; compare the days and
-- the count with the BOOKED transactions of the run (never identify an external employee by PLANUNG_ID: replans renumber).
-- Columns verified from plan-day.sh (PLANUNG, DIENST) and kit-member.sql (MITARBEITER_POLYUSER.ID = MA_ID); the employee name
-- columns of MITARBEITER are not used (unverified). sqlplus only, read-only, no COMMIT.
SET LINESIZE 400
SET PAGESIZE 0
SET FEEDBACK OFF
SET VERIFY OFF
SELECT 'XP|' || p.MITARBEITER_ID || '|' || TO_CHAR(p.DATUM, 'YYYY-MM-DD') || '|PA=' || p.PA_CODE || '|POS=' || p.DIENSTPOSITION ||
       '|NODE=' || p.KNOTEN_ID || '|TYP=' || TRIM(d.TYP) || '|' || SUBSTR(d.TITEL, 1, 30) AS R
  FROM ECBERN.PLANUNG p
  LEFT JOIN ECBERN.DIENST d ON d.PA_CODE = p.PA_CODE
 WHERE p.DATUM BETWEEN DATE '&day_from' AND DATE '&day_to'
   AND ('&node' = '-' OR TO_CHAR(p.KNOTEN_ID) = '&node')
   AND NOT EXISTS (SELECT 1 FROM ECBERN.MITARBEITER_POLYUSER mp WHERE mp.ID = p.MITARBEITER_ID)
 ORDER BY p.DATUM, p.MITARBEITER_ID, p.PA_CODE;
SELECT 'XN|' || COUNT(DISTINCT p.MITARBEITER_ID) AS R
  FROM ECBERN.PLANUNG p
 WHERE p.DATUM BETWEEN DATE '&day_from' AND DATE '&day_to'
   AND ('&node' = '-' OR TO_CHAR(p.KNOTEN_ID) = '&node')
   AND NOT EXISTS (SELECT 1 FROM ECBERN.MITARBEITER_POLYUSER mp WHERE mp.ID = p.MITARBEITER_ID);
