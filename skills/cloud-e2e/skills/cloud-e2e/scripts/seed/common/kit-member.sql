-- kit-member.sql — move OWN CLAIMED seed actors into a kit group (and out of seed groups) — group seeds R2 / steward for TA.
--
--   scripts/sql.sh <env> -f scripts/seed/common/kit-member.sql -D ma_ids=<MA_IDs> -D kit="<group>" -D leave="<group|group>"
--   e.g. -D ma_ids=512 -D kit="E2E:SP-ALL" -D leave=-   (join only)
--        -D ma_ids=487,489 -D kit="E2E:HP-PLAIN" -D leave="DMSEED:Planner"
--   restore (cleanup, if the env is reused): the same call with kit = the group left before and leave = the kit group
--
-- Parameters: ma_ids = comma-separated MITARBEITER_IDs, each CLAIMED by your group (claims/<env>~emp-<MA_ID>; hard rule 5) and a
-- seed login (POLYUSER.KUERZEL 'DMSEED-%' — other users are refused); kit = the group to join: an "E2E:*" kit group, or for a
-- restore "DMSEED:Planner" / "PEP - Leitbediener"; leave = "|"-separated exact group names to leave, or "-".
-- Default group: after the move every app the user still belongs to keeps exactly one DEFAULTGRP 'T' — the joined group if it is
-- of that app and none is left, else DMSEED:Planner, else the lowest group id. The BEFORE / AFTER lines are your restore record
-- (log them in created_data).
-- Seed facts: every seed login is a member of "DMSEED:Planner" (1050, 1070 + the mobile rights, all nodes) and, on the UTR
-- first run, of "PEP - Leitbediener" (default group; LEITBEDIENER role — api-pp may treat it as all permissions where an
-- administrator login is accepted). An actor that must LACK a right (HPX without 200005, node-restricted SP-A / PM-A, plain HPs,
-- TA) leaves DMSEED:Planner and, when its gate still shows the right, "PEP - Leitbediener" too; HP-NOSWAP actors also leave the
-- seed myPOLYPOINT group that verify-kits.sql K9 names.
-- G4b: PERMISSION_GROUP_MAPPING (user id, app) for every app whose memberships changed; the actor logs in again afterwards (a
-- fresh token carries the new roles: gate G-ROLES / the group's gate). Idempotent. sqlplus only (sql.sh).
SET SERVEROUTPUT ON SIZE UNLIMITED
SET FEEDBACK OFF
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
BEGIN
  IF SYS_CONTEXT('USERENV', 'CLIENT_PROGRAM_NAME') = 'JDBC Thin Client' THEN
    RAISE_APPLICATION_ERROR(-20001, 'kit SQL runs through sqlplus (scripts/sql.sh) only: PSC triggers skip JDBC thin sessions');
  END IF;
END;
/
DECLARE
  v_ids   VARCHAR2(4000) := TRIM('&ma_ids');
  v_kit   VARCHAR2(800)  := TRIM('&kit');
  v_leave VARCHAR2(4000) := TRIM('&leave');
  g_kit NUMBER; a_kit NUMBER; v_uid NUMBER; kz VARCHAR2(200); n NUMBER; d NUMBER;
  TYPE t_set IS TABLE OF VARCHAR2(1) INDEX BY VARCHAR2(60);
  psc t_set; k VARCHAR2(60);  -- 'user:app' pairs to enqueue after the COMMIT
  PROCEDURE say(s VARCHAR2) IS BEGIN DBMS_OUTPUT.PUT_LINE(s); END;
  PROCEDURE dump(p_tag VARCHAR2, p_ma NUMBER, p_uid NUMBER) IS
  BEGIN
    FOR m IN (SELECT g.BEZEICHNUNG, g.APP_ID, g.POLYUSRGRPID, TRIM(ug.DEFAULTGRP) AS DEF, NVL(TRIM(r.LEITBEDIENER), 'F') AS LB
                FROM ECBERN.POLYUSER_POLYUSRGRP ug JOIN ECBERN.POLYUSRGRP g ON g.POLYUSRGRPID = ug.POLYUSRGRPID
                LEFT JOIN ECBERN.POLYUSRROLE r ON r.POLYUSRROLEID = g.POLYUSRROLEID
               WHERE ug.USER_ID = p_uid ORDER BY g.APP_ID, g.BEZEICHNUNG) LOOP
      say(p_tag || '|' || p_ma || '|user ' || p_uid || '|' || m.BEZEICHNUNG || '|grp ' || m.POLYUSRGRPID || '|app ' || m.APP_ID || '|default ' || NVL(m.DEF, '-') || CASE WHEN m.LB = 'T' THEN '|LEITBEDIENER' END);
    END LOOP;
  END;
BEGIN
  IF NOT REGEXP_LIKE(v_ids, '^[0-9]+( *, *[0-9]+)*$') THEN RAISE_APPLICATION_ERROR(-20002, 'ma_ids must be comma-separated MITARBEITER_IDs (got ' || v_ids || ')'); END IF;
  IF NOT (v_kit LIKE 'E2E:%' OR v_kit IN ('DMSEED:Planner', 'PEP - Leitbediener')) THEN
    RAISE_APPLICATION_ERROR(-20002, 'kit must be an E2E:* kit group (or DMSEED:Planner / PEP - Leitbediener for a restore), got ' || v_kit);
  END IF;
  SELECT COUNT(*) INTO n FROM ECBERN.POLYUSRGRP WHERE BEZEICHNUNG = v_kit;
  IF n <> 1 THEN RAISE_APPLICATION_ERROR(-20003, 'group ' || v_kit || ' found ' || n || ' times (role-kit.sql run on this env?)'); END IF;
  SELECT POLYUSRGRPID, APP_ID INTO g_kit, a_kit FROM ECBERN.POLYUSRGRP WHERE BEZEICHNUNG = v_kit;

  FOR e IN (SELECT TO_NUMBER(REGEXP_SUBSTR(v_ids, '[0-9]+', 1, LEVEL)) AS MA FROM dual CONNECT BY LEVEL <= REGEXP_COUNT(v_ids, '[0-9]+')) LOOP
    BEGIN
      SELECT mp.USER_ID, u.KUERZEL INTO v_uid, kz FROM ECBERN.MITARBEITER_POLYUSER mp JOIN ECBERN.POLYUSER u ON u.USER_ID = mp.USER_ID WHERE mp.ID = e.MA;
    EXCEPTION WHEN NO_DATA_FOUND THEN RAISE_APPLICATION_ERROR(-20004, 'MA_ID ' || e.MA || ' has no login (MITARBEITER_POLYUSER)');
              WHEN TOO_MANY_ROWS THEN RAISE_APPLICATION_ERROR(-20004, 'MA_ID ' || e.MA || ' has several logins: move by hand'); END;
    IF kz NOT LIKE 'DMSEED-%' THEN RAISE_APPLICATION_ERROR(-20004, 'MA_ID ' || e.MA || ' (' || kz || ') is not a seed login: refused'); END IF;
    dump('BEFORE', e.MA, v_uid);
    -- leave
    IF v_leave <> '-' THEN
      FOR l IN (SELECT ug.POLYUSRGRPID, ug.APP_ID, g.BEZEICHNUNG FROM ECBERN.POLYUSER_POLYUSRGRP ug JOIN ECBERN.POLYUSRGRP g ON g.POLYUSRGRPID = ug.POLYUSRGRPID
                 WHERE ug.USER_ID = v_uid AND INSTR('|' || v_leave || '|', '|' || g.BEZEICHNUNG || '|') > 0 AND g.POLYUSRGRPID <> g_kit) LOOP
        DELETE FROM ECBERN.POLYUSER_POLYUSRGRP WHERE USER_ID = v_uid AND POLYUSRGRPID = l.POLYUSRGRPID;
        say('LEFT|' || e.MA || '|' || l.BEZEICHNUNG);
        psc(v_uid || ':' || l.APP_ID) := 'x';
      END LOOP;
    END IF;
    -- join
    SELECT COUNT(*) INTO n FROM ECBERN.POLYUSER_POLYUSRGRP WHERE USER_ID = v_uid AND POLYUSRGRPID = g_kit;
    IF n = 0 THEN
      INSERT INTO ECBERN.POLYUSER_POLYUSRGRP (POLYUSRGRPID, USER_ID, APP_ID, DEFAULTGRP) VALUES (g_kit, v_uid, a_kit, 'F');
      say('JOINED|' || e.MA || '|' || v_kit);
    ELSE
      say('JOINED|' || e.MA || '|' || v_kit || '|already');
    END IF;
    psc(v_uid || ':' || a_kit) := 'x';
    -- exactly one default group per app the user still belongs to
    FOR ap IN (SELECT DISTINCT APP_ID FROM ECBERN.POLYUSER_POLYUSRGRP WHERE USER_ID = v_uid) LOOP
      SELECT COUNT(*) INTO d FROM ECBERN.POLYUSER_POLYUSRGRP WHERE USER_ID = v_uid AND APP_ID = ap.APP_ID AND TRIM(DEFAULTGRP) = 'T';
      IF d = 0 THEN
        UPDATE ECBERN.POLYUSER_POLYUSRGRP SET DEFAULTGRP = 'T'
         WHERE USER_ID = v_uid AND APP_ID = ap.APP_ID AND POLYUSRGRPID = (
               SELECT MIN(x.POLYUSRGRPID) KEEP (DENSE_RANK FIRST ORDER BY CASE WHEN x.POLYUSRGRPID = g_kit THEN 0 WHEN g.BEZEICHNUNG = 'DMSEED:Planner' THEN 1 ELSE 2 END, x.POLYUSRGRPID)
                 FROM ECBERN.POLYUSER_POLYUSRGRP x JOIN ECBERN.POLYUSRGRP g ON g.POLYUSRGRPID = x.POLYUSRGRPID
                WHERE x.USER_ID = v_uid AND x.APP_ID = ap.APP_ID);
        say('DEFAULT|' || e.MA || '|app ' || ap.APP_ID || '|set');
      ELSIF d > 1 AND ap.APP_ID = a_kit THEN
        UPDATE ECBERN.POLYUSER_POLYUSRGRP SET DEFAULTGRP = 'F' WHERE USER_ID = v_uid AND POLYUSRGRPID = g_kit AND TRIM(DEFAULTGRP) = 'T';
      END IF;
    END LOOP;
    dump('AFTER', e.MA, v_uid);
  END LOOP;
  COMMIT;
  -- G4b after the COMMIT, so api-pp never refreshes from uncommitted memberships
  k := psc.FIRST;
  WHILE k IS NOT NULL LOOP
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('PERMISSION_GROUP_MAPPING', REGEXP_SUBSTR(k, '^[0-9]+'), null, null, TO_NUMBER(REGEXP_SUBSTR(k, '[0-9]+$')), null);
    say('G4B|PERMISSION_GROUP_MAPPING|user ' || REGEXP_SUBSTR(k, '^[0-9]+') || '|app ' || REGEXP_SUBSTR(k, '[0-9]+$'));
    k := psc.NEXT(k);
  END LOOP;
  COMMIT;
  say('DONE|kit-member|' || v_kit || '|log the BEFORE / AFTER lines; the actors log in again before their gate');
END;
/
