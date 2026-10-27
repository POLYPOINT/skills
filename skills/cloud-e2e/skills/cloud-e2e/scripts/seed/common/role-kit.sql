-- role-kit.sql — steward common seed S1 step 5 (synthesis env-plan §6.2): the PEP permission groups ("kit groups") that group
-- runners move their own claimed actors into (kit-member.sql). Created ONCE per env by the env steward; no group edits a kit
-- role and nobody touches the DMSEED:Planner role rows except UTR family P (conflict register #22, #23).
--
--   DM-X: scripts/sql.sh <env> -f scripts/seed/common/role-kit.sql -D env_role=X -D ga_node=-   (X: no node selection)
--   DM-Y: scripts/sql.sh <env> -f scripts/seed/common/role-kit.sql -D env_role=Y -D ga_node=<KNOTEN_ID of the planner G-A Gruppe node>
--
-- Kit groups (role + group of the same name, operation 6 = EXECUTE, WERT 'T', SUBID -1; node selection "E2E:Alle Knoten" = -2
-- unless noted). App 2471 = PEP (planner / mobile-app functions), app 2610 = myPOLYPOINT.
--   DM-X  E2E:SP-ALL     2471: 1050 Ressourcenersatz starten, 1061 Pool-Mitarbeiter buchen, 1070 Diensttausch bewilligen
--         E2E:PM-ALL     2471: 1060 Pool erstellen
--         E2E:EXTPOOL    2471: 1065 Pool-Mitarbeiter buchen (externer Pool), 1062 Externe Buchungen importieren
--         E2E:HP-NOSWAP  2610: a copy of the seed logins' myPOLYPOINT role WITHOUT 200005 Diensttausch einreichen (and without
--                        200015 Cloud Administrator); source = the 2610 role most seed logins hold that does not grant 200015
--   DM-Y  E2E:PLANALL    2471: 1050, 1060, 1061, 1070
--         E2E:SP-GA      2471: 1050, 1061, 1070 — node selection "E2E:G-A" = ga_node (the planner Gruppe)
--         E2E:PM-GA      2471: 1060 — node selection "E2E:G-A"
--         E2E:TA         2610: 200015 Cloud Administrator + 200010 myPOLYPOINT verwenden (the product's PP-14972 pattern) and the
--                        Keycloak mapping row ROLE_TENANT_ADMIN (the role trigger has no branch for 200015)
--         E2E:HP-PLAIN   2471: the 13 mobile-app rows of rights.sql (1030, 306, 307, 1033, 1032, 1031, 1040) — for plain-HP
--                        actors moved OUT of DMSEED:Planner (else the planner role changes their landing page)
-- Cloud roles: on these images TIUD_POLYUSRROLE_DETAIL (an AFTER trigger on the rights table) mints the
-- POLYUSRROLE_KEYCLOAK_ROLE_MAPPING rows (1050 → ROLE_SHIFT_PLANNER/RESOURCE_REPLACEMENT, 1060 → ROLE_POOL_MANAGER/INTERNAL_POOL,
-- 1061 → ROLE_SHIFT_PLANNER/INTERNAL_POOL + SHIFT_TRADING). This file inserts the same rows only when they are still missing after
-- the rights insert (NOT EXISTS: never collides with trigger-minted rows; covers a box without the trigger).
-- Idempotent: objects are found by name (role TITEL / group BEZEICHNUNG / selection TITEL) and app; rights and mappings only if
-- missing. An existing group bound to another role or selection stops the run (fix by hand). Stops at the first error and rolls
-- back. sqlplus only (sql.sh): refuses JDBC thin sessions (the role trigger skips them).
-- G4b at the end: PERMISSION_ROLE (role, app) + POLY_USER_ROLE_KEYCLOAK_ROLE_MAPPING (role) per kit role, PERMISSION_GROUP (group,
-- app) per kit group. Enqueue arguments of the mapping type follow the id-administration trigger (id = role id); UNVERIFIED on a
-- box — gate G-ROLES decides (README.md). Memberships are NOT part of this file: kit-member.sql (the steward makes TA a member).
SET SERVEROUTPUT ON SIZE UNLIMITED
SET FEEDBACK OFF
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
BEGIN
  IF SYS_CONTEXT('USERENV', 'CLIENT_PROGRAM_NAME') = 'JDBC Thin Client' THEN
    RAISE_APPLICATION_ERROR(-20001, 'kit SQL runs through sqlplus (scripts/sql.sh) only: the role trigger skips JDBC thin sessions');
  END IF;
END;
/
DECLARE
  v_role VARCHAR2(10) := UPPER(TRIM('&env_role'));
  v_ga   VARCHAR2(40) := TRIM('&ga_node');
  ka_all NUMBER; ka_ga NUMBER; r_ta NUMBER; v_dom VARCHAR2(400); n NUMBER;
  TYPE t_num IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
  e_role t_num; e_rapp t_num; e_grp t_num; e_gapp t_num;
  PROCEDURE say(s VARCHAR2) IS BEGIN DBMS_OUTPUT.PUT_LINE(s); END;

  FUNCTION selection(p_title VARCHAR2, p_node NUMBER) RETURN NUMBER IS v NUMBER; d NUMBER;
  BEGIN
    BEGIN SELECT POLYKNOTENAUSWAHLID INTO v FROM ECBERN.POLYKNOTENAUSWAHL WHERE TITEL = p_title;
    EXCEPTION WHEN NO_DATA_FOUND THEN v := NULL; END;
    IF v IS NULL THEN
      v := ECBERN.SEQID_POLYKNOTENAUSWAHL.NEXTVAL;
      INSERT INTO ECBERN.POLYKNOTENAUSWAHL (POLYKNOTENAUSWAHLID, TITEL) VALUES (v, p_title);
      INSERT INTO ECBERN.POLYKNOTENAUSWAHL_DETAIL (POLYKNOTENAUSWAHLID, KNOTEN_ID) VALUES (v, p_node);
      say('SELECTION|' || p_title || '|' || v || '|created node ' || p_node);
    ELSE
      SELECT COUNT(*) INTO d FROM ECBERN.POLYKNOTENAUSWAHL_DETAIL WHERE POLYKNOTENAUSWAHLID = v AND KNOTEN_ID = p_node;
      IF d = 0 THEN RAISE_APPLICATION_ERROR(-20010, 'selection ' || p_title || ' exists without node ' || p_node || ': another ga_node earlier? fix by hand'); END IF;
      say('SELECTION|' || p_title || '|' || v || '|already');
    END IF;
    RETURN v;
  END;

  FUNCTION role_of(p_title VARCHAR2, p_app NUMBER) RETURN NUMBER IS v NUMBER;
  BEGIN
    BEGIN SELECT POLYUSRROLEID INTO v FROM ECBERN.POLYUSRROLE WHERE TITEL = p_title AND APP_ID = p_app;
    EXCEPTION WHEN NO_DATA_FOUND THEN v := NULL; END;
    IF v IS NULL THEN
      v := ECBERN.SEQID_POLYUSRROLE.NEXTVAL;
      INSERT INTO ECBERN.POLYUSRROLE (POLYUSRROLEID, APP_ID, APPLIKATION, TITEL, LEITBEDIENER)
      VALUES (v, p_app, CASE p_app WHEN 2471 THEN 'PEP' ELSE 'myPOLYPOINT' END, p_title, 'F');
      say('ROLE|' || p_title || '|' || v || '|created app ' || p_app);
    ELSE
      say('ROLE|' || p_title || '|' || v || '|already');
    END IF;
    e_role(e_role.COUNT + 1) := v; e_rapp(e_rapp.COUNT + 1) := p_app;
    RETURN v;
  END;

  PROCEDURE grant_right(p_role NUMBER, p_app NUMBER, p_f NUMBER, p_op NUMBER) IS c NUMBER;
  BEGIN
    SELECT COUNT(*) INTO c FROM ECBERN.POLYUSRROLE_DETAIL WHERE POLYUSRROLEID = p_role AND APP_ID = p_app AND FUNKTIONSID = p_f AND OPERATION = p_op AND SUBID = -1;
    IF c = 0 THEN
      INSERT INTO ECBERN.POLYUSRROLE_DETAIL (POLYUSRROLE_DETAILID, POLYUSRROLEID, APP_ID, FUNKTIONSID, SUBID, OPERATION, WERT, AUSWAHL_SELEKTION)
      VALUES (ECBERN.SEQID_POLYUSRROLE_DETAIL.NEXTVAL, p_role, p_app, p_f, -1, p_op, 'T', CASE WHEN p_op IN (1, 5) THEN 1 ELSE 2 END);
    ELSE
      UPDATE ECBERN.POLYUSRROLE_DETAIL SET WERT = 'T'
       WHERE POLYUSRROLEID = p_role AND APP_ID = p_app AND FUNKTIONSID = p_f AND OPERATION = p_op AND SUBID = -1 AND TRIM(WERT) <> 'T';
    END IF;
  END;

  PROCEDURE map_role(p_role NUMBER, p_kc VARCHAR2, p_domain VARCHAR2) IS
  BEGIN
    INSERT INTO ECBERN.POLYUSRROLE_KEYCLOAK_ROLE_MAPPING (POLYUSRROLEID, KEYCLOAK_ROLE, DOMAIN)
    SELECT p_role, p_kc, p_domain FROM dual
     WHERE NOT EXISTS (SELECT 1 FROM ECBERN.POLYUSRROLE_KEYCLOAK_ROLE_MAPPING m WHERE m.POLYUSRROLEID = p_role AND m.KEYCLOAK_ROLE = p_kc AND m.DOMAIN = p_domain);
    IF SQL%ROWCOUNT > 0 THEN say('MAPPING|' || p_role || '|' || p_kc || '|' || p_domain || '|inserted'); END IF;
  END;

  PROCEDURE planner_maps(p_role NUMBER, p_f NUMBER) IS
  BEGIN
    IF p_f = 1050 THEN map_role(p_role, 'ROLE_SHIFT_PLANNER', 'RESOURCE_REPLACEMENT');
    ELSIF p_f = 1060 THEN map_role(p_role, 'ROLE_POOL_MANAGER', 'INTERNAL_POOL');
    ELSIF p_f = 1061 THEN map_role(p_role, 'ROLE_SHIFT_PLANNER', 'INTERNAL_POOL'); map_role(p_role, 'ROLE_SHIFT_PLANNER', 'SHIFT_TRADING');
    END IF;
  END;

  PROCEDURE group_of(p_name VARCHAR2, p_app NUMBER, p_role NUMBER, p_sel NUMBER) IS g NUMBER; gr NUMBER; gs NUMBER;
  BEGIN
    BEGIN SELECT POLYUSRGRPID, POLYUSRROLEID, POLYKNOTENAUSWAHLID_MODIFIBAR INTO g, gr, gs FROM ECBERN.POLYUSRGRP WHERE BEZEICHNUNG = p_name AND APP_ID = p_app;
    EXCEPTION WHEN NO_DATA_FOUND THEN g := NULL; END;
    IF g IS NULL THEN
      g := ECBERN.SEQID_POLYUSRGRP.NEXTVAL;
      INSERT INTO ECBERN.POLYUSRGRP (POLYUSRGRPID, BEZEICHNUNG, APP_ID, POLYUSRROLEID, POLYKNOTENAUSWAHLID_SICHTBAR, POLYKNOTENAUSWAHLID_MODIFIBAR)
      VALUES (g, p_name, p_app, p_role, p_sel, p_sel);
      say('GROUP|' || p_name || '|' || g || '|created role ' || p_role || ' selection ' || p_sel);
    ELSIF NVL(gr, -1) <> p_role OR NVL(gs, -1) <> p_sel THEN
      RAISE_APPLICATION_ERROR(-20011, 'group ' || p_name || ' exists with role ' || gr || ' / selection ' || gs || ' (expected ' || p_role || ' / ' || p_sel || '): fix by hand');
    ELSE
      say('GROUP|' || p_name || '|' || g || '|already');
    END IF;
    e_grp(e_grp.COUNT + 1) := g; e_gapp(e_gapp.COUNT + 1) := p_app;
  END;

  -- p_rights = 'f:op,f:op,…'
  FUNCTION kit(p_name VARCHAR2, p_app NUMBER, p_sel NUMBER, p_rights VARCHAR2) RETURN NUMBER IS r NUMBER; tok VARCHAR2(40); f NUMBER; op NUMBER;
  BEGIN
    r := role_of(p_name, p_app);
    FOR i IN 1 .. REGEXP_COUNT(p_rights, '[^,]+') LOOP
      tok := REGEXP_SUBSTR(p_rights, '[^,]+', 1, i);
      f := TO_NUMBER(REGEXP_SUBSTR(tok, '[^:]+', 1, 1)); op := TO_NUMBER(REGEXP_SUBSTR(tok, '[^:]+', 1, 2));
      grant_right(r, p_app, f, op);
      IF p_app = 2471 AND op = 6 THEN planner_maps(r, f); END IF;
    END LOOP;
    say('RIGHTS|' || p_name || '|' || p_rights);
    group_of(p_name, p_app, r, p_sel);
    RETURN r;
  END;

  PROCEDURE hp_noswap(p_sel NUMBER) IS src NUMBER; dst NUMBER; has5 NUMBER; srcname VARCHAR2(800);
  BEGIN
    BEGIN
      SELECT POLYUSRROLEID, GNAME INTO src, srcname FROM (
        SELECT g.POLYUSRROLEID, MIN(g.BEZEICHNUNG) AS GNAME, COUNT(*) AS C
          FROM ECBERN.POLYUSRGRP g
          JOIN ECBERN.POLYUSER_POLYUSRGRP ug ON ug.POLYUSRGRPID = g.POLYUSRGRPID
          JOIN ECBERN.POLYUSER u ON u.USER_ID = ug.USER_ID
         WHERE g.APP_ID = 2610 AND u.KUERZEL LIKE 'DMSEED-%' AND g.BEZEICHNUNG NOT LIKE 'E2E:%' AND g.POLYUSRROLEID IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM ECBERN.POLYUSRROLE_DETAIL x WHERE x.POLYUSRROLEID = g.POLYUSRROLEID AND x.FUNKTIONSID = 200015 AND TRIM(x.WERT) = 'T')
         GROUP BY g.POLYUSRROLEID ORDER BY C DESC, g.POLYUSRROLEID) WHERE ROWNUM = 1;
    EXCEPTION WHEN NO_DATA_FOUND THEN src := NULL; END;
    dst := role_of('E2E:HP-NOSWAP', 2610);
    IF src IS NULL THEN
      say('HP-NOSWAP|WARN no myPOLYPOINT (2610) group of the seed logins without 200015: the kit role stays empty; gate SWP-01 decides where submit_shift_trade comes from');
    ELSE
      SELECT COUNT(*) INTO has5 FROM ECBERN.POLYUSRROLE_DETAIL WHERE POLYUSRROLEID = src AND FUNKTIONSID = 200005 AND TRIM(WERT) = 'T';
      INSERT INTO ECBERN.POLYUSRROLE_DETAIL (POLYUSRROLE_DETAILID, POLYUSRROLEID, APP_ID, FUNKTIONSID, SUBID, OPERATION, WERT, AUSWAHL_SELEKTION, POLYKNOTENAUSWAHLID)
      SELECT ECBERN.SEQID_POLYUSRROLE_DETAIL.NEXTVAL, dst, s.APP_ID, s.FUNKTIONSID, s.SUBID, s.OPERATION, s.WERT, s.AUSWAHL_SELEKTION, s.POLYKNOTENAUSWAHLID
        FROM ECBERN.POLYUSRROLE_DETAIL s
       WHERE s.POLYUSRROLEID = src AND s.FUNKTIONSID NOT IN (200005, 200015)
         AND NOT EXISTS (SELECT 1 FROM ECBERN.POLYUSRROLE_DETAIL d WHERE d.POLYUSRROLEID = dst AND d.APP_ID = s.APP_ID
                            AND d.FUNKTIONSID = s.FUNKTIONSID AND d.SUBID = s.SUBID AND d.OPERATION = s.OPERATION);
      say('HP-NOSWAP|copied ' || SQL%ROWCOUNT || ' rows from role ' || src || ' (group "' || srcname || '") without 200005 / 200015; source grants 200005: '
          || CASE WHEN has5 > 0 THEN 'yes' ELSE 'NO (submit_shift_trade comes from elsewhere: gate SWP-01)' END);
    END IF;
    group_of('E2E:HP-NOSWAP', 2610, dst, p_sel);
  END;
BEGIN
  IF v_role NOT IN ('X', 'Y') THEN RAISE_APPLICATION_ERROR(-20002, 'env_role must be X or Y (got ' || v_role || ')'); END IF;
  ka_all := selection('E2E:Alle Knoten', -2);
  IF v_role = 'X' THEN
    IF v_ga <> '-' THEN RAISE_APPLICATION_ERROR(-20002, 'DM-X takes -D ga_node=-'); END IF;
    r_ta := kit('E2E:SP-ALL', 2471, ka_all, '1050:6,1061:6,1070:6');
    r_ta := kit('E2E:PM-ALL', 2471, ka_all, '1060:6');
    r_ta := kit('E2E:EXTPOOL', 2471, ka_all, '1065:6,1062:6');
    hp_noswap(ka_all);
    r_ta := NULL;
  ELSE
    IF NOT REGEXP_LIKE(v_ga, '^[0-9]+$') THEN RAISE_APPLICATION_ERROR(-20003, 'DM-Y needs -D ga_node=<KNOTEN_ID of the planner G-A Gruppe node> (audit.sql A1 NODE)'); END IF;
    SELECT COUNT(*) INTO n FROM ECBERN.KNOTEN WHERE ID = TO_NUMBER(v_ga);
    IF n = 0 THEN RAISE_APPLICATION_ERROR(-20003, 'ga_node ' || v_ga || ' does not exist'); END IF;
    ka_ga := selection('E2E:G-A', TO_NUMBER(v_ga));
    r_ta := kit('E2E:PLANALL', 2471, ka_all, '1050:6,1060:6,1061:6,1070:6');
    r_ta := kit('E2E:SP-GA', 2471, ka_ga, '1050:6,1061:6,1070:6');
    r_ta := kit('E2E:PM-GA', 2471, ka_ga, '1060:6');
    r_ta := kit('E2E:HP-PLAIN', 2471, ka_all, '1030:6,306:6,307:2,307:3,307:4,1033:2,1033:3,1033:4,1032:3,1032:4,1031:3,1031:4,1040:1');
    r_ta := kit('E2E:TA', 2610, ka_all, '200015:6,200010:6');
    -- domain: the one the box already uses for ROLE_TENANT_ADMIN (product Cloud Administrator role), else MY-POLYPOINT
    SELECT NVL(MIN(DOMAIN), 'MY-POLYPOINT') INTO v_dom FROM ECBERN.POLYUSRROLE_KEYCLOAK_ROLE_MAPPING WHERE KEYCLOAK_ROLE = 'ROLE_TENANT_ADMIN' AND POLYUSRROLEID <> r_ta;
    map_role(r_ta, 'ROLE_TENANT_ADMIN', v_dom);
    say('TA|mapping ROLE_TENANT_ADMIN domain ' || v_dom);
  END IF;
  COMMIT;

  FOR i IN 1 .. e_role.COUNT LOOP
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('PERMISSION_ROLE', TO_CHAR(e_role(i)), null, null, e_rapp(i), null);
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('POLY_USER_ROLE_KEYCLOAK_ROLE_MAPPING', TO_CHAR(e_role(i)), null, null, null, null);
  END LOOP;
  FOR i IN 1 .. e_grp.COUNT LOOP
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('PERMISSION_GROUP', TO_CHAR(e_grp(i)), null, null, e_gapp(i), null);
  END LOOP;
  COMMIT;
  say('G4B|PERMISSION_ROLE + POLY_USER_ROLE_KEYCLOAK_ROLE_MAPPING x' || e_role.COUNT || ', PERMISSION_GROUP x' || e_grp.COUNT);
  say('DONE|role-kit|' || v_role || '|next: kit-member.sql for TA (steward) / group runners, then verify-kits.sql and gate G-ROLES');
END;
/
SET PAGESIZE 0
SET LINESIZE 300
PROMPT == kit groups (KIT|group|id|app|role|rights|mappings)
SELECT 'KIT|' || g.BEZEICHNUNG || '|' || g.POLYUSRGRPID || '|' || g.APP_ID || '|role ' || g.POLYUSRROLEID || '|'
       || (SELECT LISTAGG(d.FUNKTIONSID || ':' || d.OPERATION, ',') WITHIN GROUP (ORDER BY d.FUNKTIONSID, d.OPERATION)
             FROM ECBERN.POLYUSRROLE_DETAIL d WHERE d.POLYUSRROLEID = g.POLYUSRROLEID AND TRIM(d.WERT) = 'T') || '|'
       || (SELECT LISTAGG(m.KEYCLOAK_ROLE || '/' || m.DOMAIN, ',') WITHIN GROUP (ORDER BY m.KEYCLOAK_ROLE, m.DOMAIN)
             FROM ECBERN.POLYUSRROLE_KEYCLOAK_ROLE_MAPPING m WHERE m.POLYUSRROLEID = g.POLYUSRROLEID)
  FROM ECBERN.POLYUSRGRP g WHERE g.BEZEICHNUNG LIKE 'E2E:%' ORDER BY g.BEZEICHNUNG;
