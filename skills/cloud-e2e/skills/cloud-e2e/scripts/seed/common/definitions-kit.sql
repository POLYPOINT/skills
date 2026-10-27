-- definitions-kit.sql — steward common seed S1 step 4 (synthesis env-plan §6.2): the shared Dienst definitions every group of
-- an env relies on, set ONCE by the env steward before any group seed (conflict register #21: no group flips a seed Dienst).
--
--   DM-X: scripts/sql.sh <env> -f scripts/seed/common/definitions-kit.sql -D env_role=X -D nodes=<palette nodes> -D abs_codes=<codes> -D swap_abs=<code>
--   DM-Y: scripts/sql.sh <env> -f scripts/seed/common/definitions-kit.sql -D env_role=Y -D nodes=- -D abs_codes=- -D swap_abs=-   (Y: no palettes)
--
-- Parameters (sqlplus DEFINEs; every one must be passed, "-" = none):
--   env_role   X | Y
--   nodes      comma-separated KNOTEN_IDs of the DM-X Gruppe palette nodes that get the palette absences (audit.sql A6;
--              swap: Pflege Chirurgie + Geriatrie, booking: Pflege Medizin, hp: Geburtshilfe + Paediatrie …); "-" on Y
--   abs_codes  comma-separated absence PA codes added to those palettes (UTR's 25 Ferien Monatslohn, 57 Homeoffice, 60
--              Weiterbildung; never 145 "DMSEED Ferien": unusable seed defect); "-" on Y
--   swap_abs   ONE absence PA code (one of abs_codes) made swappable (DIENSTTAUSCH 'T') for the swap absence cases; "-" on Y
--
-- What it does (idempotent: every UPDATE is guarded by "value differs", every INSERT by NOT EXISTS; a re-run changes nothing):
--   both envs  POMASCHICHTTYP (POMA shift type, api-pp PomaShiftTypeConverter ordinal: 0 NONE 1 EARLY 2 NORMAL 3 LATE 4 NIGHT):
--              111 → 1 EARLY, 113 → 2 NORMAL, 112 → 3 LATE, 141 → 4 NIGHT
--   DM-X       DIENSTTAUSCH 'T' on 111/112/113 and swap_abs (141 stays 'F'); DIENST_DETAIL.DIENST_TEILEN 'T' on every detail
--              row of 111/112/113 (half-day split); DIENST.INTERNER_POOL 'T' on 111/112/113 when the column exists
--              (pp-services ≥ feature-26-3; else reported, RESSOURCENERSATZ untouched); palette rows for abs_codes on nodes
--              (the shape PEP writes: AUTO_PLANBAR 'F', SHORTCUT 0, next POSITION, valid 2000-01-01..2999-12-31)
--   G4b        one batch at the end (boxes have no TIUD_*_PSC triggers; api-pp caches definitions ≤ 7 days):
--              SHIFT_DEFINITION 111,112,113,141,145 + swap_abs + abs_codes; SHIFT_DEFINITION_POLICY for every DIENST_DETAIL of
--              111..141; SHIFT_DEFINITION_PALETTE for node 1 (R0 rows) and every node — this also covers r0-root-rows.sql
-- Stops at the first error and rolls back (WHENEVER SQLERROR). sqlplus only (sql.sh): refuses JDBC thin sessions.
-- Afterwards: restart PEP (PEP loads definitions at login: PE_COLD_START=1 PE_USER=<login> scripts/pep/pe-ready.sh <env>), then
-- verify-kits.sql and the read gates of README.md (available_for_shift_trade, roster shift types, internal-pool roster).
-- Column names: verified against the DeployMate db-introspect catalog (DIENST.DIENSTTAUSCH / POMASCHICHTTYP / RESSOURCENERSATZ,
-- DIENST_DETAIL.DIENST_TEILEN, DIENSTPALETTE); INTERNER_POOL is newer than that catalog — UNVERIFIED until the first run.
SET SERVEROUTPUT ON SIZE UNLIMITED
SET FEEDBACK OFF
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
BEGIN
  IF SYS_CONTEXT('USERENV', 'CLIENT_PROGRAM_NAME') = 'JDBC Thin Client' THEN
    RAISE_APPLICATION_ERROR(-20001, 'kit SQL runs through sqlplus (scripts/sql.sh) only: PSC / role triggers skip JDBC thin sessions');
  END IF;
END;
/
DECLARE
  v_role  VARCHAR2(10)   := UPPER(TRIM('&env_role'));
  v_nodes VARCHAR2(4000) := TRIM('&nodes');
  v_abs   VARCHAR2(4000) := TRIM('&abs_codes');
  v_swap  VARCHAR2(40)   := TRIM('&swap_abs');
  l_nodes SYS.ODCINUMBERLIST := SYS.ODCINUMBERLIST();
  l_abs   SYS.ODCINUMBERLIST := SYS.ODCINUMBERLIST();
  l_defs  SYS.ODCINUMBERLIST := SYS.ODCINUMBERLIST(111, 112, 113, 141, 145);
  n NUMBER; pos NUMBER; has_ip NUMBER;
  PROCEDURE say(s VARCHAR2) IS BEGIN DBMS_OUTPUT.PUT_LINE(s); END;
  FUNCTION nums(p VARCHAR2, what VARCHAR2) RETURN SYS.ODCINUMBERLIST IS
    r SYS.ODCINUMBERLIST := SYS.ODCINUMBERLIST();
  BEGIN
    IF p IS NULL OR p = '-' THEN RETURN r; END IF;
    IF NOT REGEXP_LIKE(p, '^-?[0-9]+( *, *-?[0-9]+)*$') THEN RAISE_APPLICATION_ERROR(-20002, what || ' must be comma-separated numbers or "-" (got ' || p || ')'); END IF;
    FOR i IN 1 .. REGEXP_COUNT(p, '-?[0-9]+') LOOP r.EXTEND; r(r.COUNT) := TO_NUMBER(REGEXP_SUBSTR(p, '-?[0-9]+', 1, i)); END LOOP;
    RETURN r;
  END;
BEGIN
  IF v_role NOT IN ('X', 'Y') THEN RAISE_APPLICATION_ERROR(-20002, 'env_role must be X or Y (got ' || v_role || ')'); END IF;
  l_nodes := nums(v_nodes, 'nodes'); l_abs := nums(v_abs, 'abs_codes');
  IF v_role = 'Y' AND (l_nodes.COUNT > 0 OR l_abs.COUNT > 0 OR v_swap <> '-') THEN
    RAISE_APPLICATION_ERROR(-20002, 'DM-Y gets POMA shift types only: pass -D nodes=- -D abs_codes=- -D swap_abs=-');
  END IF;
  IF v_role = 'X' AND (l_nodes.COUNT = 0 OR l_abs.COUNT = 0 OR NOT REGEXP_LIKE(v_swap, '^[0-9]+$')) THEN
    RAISE_APPLICATION_ERROR(-20002, 'DM-X needs -D nodes=<palette nodes> -D abs_codes=<absence codes> -D swap_abs=<one absence code>');
  END IF;

  -- K1 POMA shift types (both envs)
  FOR c IN (SELECT 111 AS PA, 1 AS T FROM dual UNION ALL SELECT 113, 2 FROM dual UNION ALL SELECT 112, 3 FROM dual UNION ALL SELECT 141, 4 FROM dual) LOOP
    UPDATE ECBERN.DIENST SET POMASCHICHTTYP = c.T WHERE PA_CODE = c.PA AND NVL(POMASCHICHTTYP, -1) <> c.T;
    n := SQL%ROWCOUNT;
    SELECT COUNT(*) INTO pos FROM ECBERN.DIENST WHERE PA_CODE = c.PA;
    IF pos = 0 THEN RAISE_APPLICATION_ERROR(-20003, 'seed Dienst ' || c.PA || ' missing: not a customer-roster seed?'); END IF;
    say('K1|SHIFTTYPE|' || c.PA || '|' || c.T || '|' || CASE WHEN n > 0 THEN 'set' ELSE 'already' END);
  END LOOP;

  IF v_role = 'X' THEN
    -- K2 swappable Dienste (141 Nacht stays non-swappable)
    UPDATE ECBERN.DIENST SET DIENSTTAUSCH = 'T' WHERE PA_CODE IN (111, 112, 113) AND NVL(TRIM(DIENSTTAUSCH), 'F') <> 'T';
    say('K2|DIENSTTAUSCH|111,112,113|T|updated=' || SQL%ROWCOUNT);
    UPDATE ECBERN.DIENST SET DIENSTTAUSCH = 'F' WHERE PA_CODE = 141 AND NVL(TRIM(DIENSTTAUSCH), 'F') <> 'F';
    say('K2|DIENSTTAUSCH|141|F|updated=' || SQL%ROWCOUNT);
    SELECT COUNT(*) INTO n FROM ECBERN.DIENST WHERE PA_CODE = TO_NUMBER(v_swap);
    IF n = 0 THEN RAISE_APPLICATION_ERROR(-20004, 'swap_abs ' || v_swap || ' is not a Dienst on this box (audit.sql A8)'); END IF;
    SELECT COUNT(*) INTO n FROM TABLE(l_abs) WHERE COLUMN_VALUE = TO_NUMBER(v_swap);
    IF n = 0 THEN RAISE_APPLICATION_ERROR(-20004, 'swap_abs ' || v_swap || ' must be one of abs_codes (it needs a palette row)'); END IF;
    UPDATE ECBERN.DIENST SET DIENSTTAUSCH = 'T' WHERE PA_CODE = TO_NUMBER(v_swap) AND NVL(TRIM(DIENSTTAUSCH), 'F') <> 'T';
    say('K2|DIENSTTAUSCH|' || v_swap || '|T|updated=' || SQL%ROWCOUNT);

    -- K3 half-day split on every detail row of the presences
    UPDATE ECBERN.DIENST_DETAIL SET DIENST_TEILEN = 'T' WHERE PA_CODE IN (111, 112, 113) AND NVL(TRIM(DIENST_TEILEN), 'F') <> 'T';
    say('K3|DIENST_TEILEN|111,112,113|T|updated=' || SQL%ROWCOUNT);

    -- K4 internal pool (column from pp-services feature-26-3; absent on older bundles)
    SELECT COUNT(*) INTO has_ip FROM ALL_TAB_COLUMNS WHERE OWNER = 'ECBERN' AND TABLE_NAME = 'DIENST' AND COLUMN_NAME = 'INTERNER_POOL';
    IF has_ip = 1 THEN
      EXECUTE IMMEDIATE q'[UPDATE ECBERN.DIENST SET INTERNER_POOL = 'T' WHERE PA_CODE IN (111, 112, 113) AND NVL(TRIM(INTERNER_POOL), 'F') <> 'T']';
      say('K4|INTERNER_POOL|111,112,113|T|updated=' || SQL%ROWCOUNT);
    ELSE
      say('K4|INTERNER_POOL|column absent (bundle older than feature-26-3): internal-pool rosters stay empty, booking IP / planner D1 BLOCKED-data');
    END IF;

    -- K5 palette absences on the DM-X palette nodes
    FOR a IN (SELECT COLUMN_VALUE AS PA FROM TABLE(l_abs)) LOOP
      SELECT COUNT(*) INTO n FROM ECBERN.DIENST WHERE PA_CODE = a.PA;
      IF n = 0 THEN RAISE_APPLICATION_ERROR(-20005, 'absence ' || a.PA || ' is not a Dienst on this box (audit.sql A8)'); END IF;
      IF a.PA = 145 THEN RAISE_APPLICATION_ERROR(-20005, '145 "DMSEED Ferien" is unusable (seed defect): use 25 / 57 / 60'); END IF;
      FOR k IN (SELECT COLUMN_VALUE AS NODE FROM TABLE(l_nodes)) LOOP
        SELECT COUNT(*) INTO n FROM ECBERN.KNOTEN WHERE ID = k.NODE;
        IF n = 0 THEN RAISE_APPLICATION_ERROR(-20006, 'node ' || k.NODE || ' does not exist (audit.sql A1 / A6)'); END IF;
        SELECT COUNT(*) INTO n FROM ECBERN.DIENSTPALETTE WHERE KNOTEN_ID = k.NODE AND PA_CODE = a.PA;
        IF n = 0 THEN
          SELECT NVL(MAX(POSITION), 0) + 1 INTO pos FROM ECBERN.DIENSTPALETTE WHERE KNOTEN_ID = k.NODE;
          INSERT INTO ECBERN.DIENSTPALETTE (KNOTEN_ID, PA_CODE, AUTO_PLANBAR, SHORTCUT, POSITION, NAME, PALETTE_GUELTIG_AB, PALETTE_GUELTIG_BIS)
          VALUES (k.NODE, a.PA, 'F', 0, pos, NULL, DATE '2000-01-01', DATE '2999-12-31');
          say('K5|PALETTE|' || k.NODE || '|' || a.PA || '|inserted pos ' || pos);
        ELSE
          say('K5|PALETTE|' || k.NODE || '|' || a.PA || '|already');
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  COMMIT;

  -- G4b: one batch (fire-and-forget; the gate is the read check of README.md)
  FOR c IN (SELECT DISTINCT d.PA_CODE FROM ECBERN.DIENST d
             WHERE d.PA_CODE IN (SELECT COLUMN_VALUE FROM TABLE(l_defs))
                OR d.PA_CODE IN (SELECT COLUMN_VALUE FROM TABLE(l_abs))
                OR (v_role = 'X' AND d.PA_CODE = TO_NUMBER(CASE WHEN REGEXP_LIKE(v_swap, '^[0-9]+$') THEN v_swap END))) LOOP
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION', TO_CHAR(c.PA_CODE), null, null, null, null);
    say('G4B|SHIFT_DEFINITION|' || c.PA_CODE);
  END LOOP;
  FOR d IN (SELECT DIENST_DETAIL_ID, KNOTEN_ID FROM ECBERN.DIENST_DETAIL WHERE PA_CODE IN (111, 112, 113, 141)) LOOP
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION_POLICY', d.DIENST_DETAIL_ID, d.KNOTEN_ID, null, null, null);
  END LOOP;
  say('G4B|SHIFT_DEFINITION_POLICY|details of 111,112,113,141');
  IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION_PALETTE', null, 1, null, null, null);
  say('G4B|SHIFT_DEFINITION_PALETTE|1');
  FOR k IN (SELECT DISTINCT COLUMN_VALUE AS NODE FROM TABLE(l_nodes)) LOOP
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION_PALETTE', null, k.NODE, null, null, null);
    say('G4B|SHIFT_DEFINITION_PALETTE|' || k.NODE);
  END LOOP;
  COMMIT;
  say('DONE|definitions-kit|' || v_role || '|restart PEP before any PEP paint, then verify-kits.sql');
END;
/
SET PAGESIZE 0
SET LINESIZE 300
PROMPT == definitions after the kit (TAUSCH = DIENSTTAUSCH, TYP0 = POMASCHICHTTYP)
SELECT 'DEF|' || d.PA_CODE || '|' || TRIM(d.TYP) || '|TAUSCH=' || TRIM(d.DIENSTTAUSCH) || '|TYP0=' || d.POMASCHICHTTYP || '|ERSATZ=' || TRIM(d.RESSOURCENERSATZ) || '|' || SUBSTR(d.TITEL, 1, 30)
  FROM ECBERN.DIENST d
 WHERE d.PA_CODE IN (111, 112, 113, 141) OR TRIM(d.DIENSTTAUSCH) = 'T'
 ORDER BY d.PA_CODE;
SELECT 'TEILEN|' || PA_CODE || '|node ' || KNOTEN_ID || '|' || TRIM(DIENST_TEILEN) FROM ECBERN.DIENST_DETAIL WHERE PA_CODE IN (111, 112, 113) ORDER BY PA_CODE, KNOTEN_ID;
