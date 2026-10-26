-- rr-ids.sql — ids for the resource-replacement body (BKG-21, BKG-22, BKG-25) and the IPO roster. Read-only.
-- Run: scripts/sql.sh <env> -f groups/booking/scripts/rr-ids.sql -D er=<ER MITARBEITER_ID> -D day=<YYYY-MM-DD> -D cands=<HPG id>,<HPH id>
-- Column names follow audit.sql and the DeployMate data-loader (MITARBEITER.NACHNAME, POLYUSER.KEYCLOAK_USER_ID); the
-- MITARBEITER primary key column (ID) is a guess — if the last query fails, drop the NACHNAME join and take names from the UI.

PROMPT == R1 ER planning on the day (the shift to replace): planning id, PA code, position, planning node
select p.PLANUNG_ID, p.PA_CODE, p.DIENSTPOSITION, p.KNOTEN_ID, substr(k.NAME,1,40) as NODE_NAME
  from ECBERN.PLANUNG p left join ECBERN.KNOTEN k on k.ID = p.KNOTEN_ID
 where p.MITARBEITER_ID = &er and p.DATUM = DATE '&day'
 order by p.DIENSTPOSITION;

PROMPT == R2 ER category node (Station); its Gruppe is the Planblatt (pep_roster) — see R3
select mk.KNOTEN_ID as STATION, substr(k.NAME,1,40) as STATION_NAME
  from ECBERN.MITARBEITER_KATEGORIEDETAIL mk join ECBERN.KNOTEN k on k.ID = mk.KNOTEN_ID
 where mk.MITARBEITER_ID = &er;

PROMPT == R3 palette nodes that carry the planned PA code (Planblatt candidates = Gruppe nodes)
select dp.KNOTEN_ID, substr(k.NAME,1,40) as NODE_NAME
  from ECBERN.DIENSTPALETTE dp join ECBERN.KNOTEN k on k.ID = dp.KNOTEN_ID
 where dp.PA_CODE in (select p.PA_CODE from ECBERN.PLANUNG p where p.MITARBEITER_ID = &er and p.DATUM = DATE '&day')
 order by 1;

PROMPT == R4 candidates: MITARBEITER_ID (= employee_id in the RR pool), Keycloak user id, surname, login
select mp.ID as MA_ID, u.KEYCLOAK_USER_ID, substr(m.NACHNAME,1,30) as NACHNAME, lower(u.KUERZEL) as LOGIN
  from ECBERN.MITARBEITER_POLYUSER mp
  join ECBERN.POLYUSER u on u.USER_ID = mp.USER_ID
  left join ECBERN.MITARBEITER m on m.ID = mp.ID
 where mp.ID in (&cands)
 order by 1;
