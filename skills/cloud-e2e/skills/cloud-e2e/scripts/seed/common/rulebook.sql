-- rulebook.sql — steward common seed S1 (both envs, before definitions-kit.sql): the product's default planning rule book id 1.
--   scripts/sql.sh <env> -f scripts/seed/common/rulebook.sql
-- Why: the DeployMate install records the APIPPDBA structure changesets but never applies pp-initial-data APIPPDBA 09-data.xml, so
-- ECBERN.PLANNINGRULEBOOK is empty on a fresh box. api-pp then answers PlanningRuleBookNotFoundException ("Planungsregelwerk mit
-- ID 1 nicht gefunden") on /api/v2/read/shift_trades (no shift swap can be created: swap candidates fail) and on
-- direct-shift-planning (pp-plan.sh). MITARBEITER_DETAIL / MITARBEITER_DEFAULTS.PLANNINGRULEBOOK_ID stay NULL: api-pp uses id 1.
-- What: exactly the row of changeset rthueroff-ecbern-planningrulebook-baseline-data-1 (pp-services
-- liquibase/pp-initial-data/src/main/resources/db/oracle/APIPPDBA/09-data.xml), guarded like its precondition (no row id 1).
-- Idempotent (a re-run prints RULEBOOK|skipped). No ADJUSTED_PLANNINGRULEPARAMETER rows, no changelog row, sequence untouched.
-- Undo (reused env only; destroy makes it moot), when no ADJUSTED_PLANNINGRULEPARAMETER row points at it:
--   DELETE FROM ECBERN.PLANNINGRULEBOOK WHERE ID = 1 AND RULEBOOKTYPE = 'SWISS_ARGV2'; COMMIT;
--   api-pp keeps its cached copy (PLANNING_RULE_BOOK_DEFINITION_CACHE) until it restarts.
-- Verified live once (e2e-pilot-av, 2026-11-03, batch swap1): swap candidates answered 200 right after the insert.
SET SERVEROUTPUT ON SIZE UNLIMITED
SET FEEDBACK OFF
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
SET PAGESIZE 0
SET LINESIZE 250
BEGIN
  IF SYS_CONTEXT('USERENV', 'CLIENT_PROGRAM_NAME') = 'JDBC Thin Client' THEN
    RAISE_APPLICATION_ERROR(-20001, 'kit SQL runs through sqlplus (scripts/sql.sh) only');
  END IF;
END;
/
SELECT 'RULEBOOK|before|' || COUNT(*) FROM ECBERN.PLANNINGRULEBOOK;
DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM ECBERN.PLANNINGRULEBOOK WHERE ID = 1;
  IF n = 0 THEN
    INSERT INTO ECBERN.PLANNINGRULEBOOK (ID, RULEBOOKTYPE, COUNTRY, TITLE, CREATEDAT, MODIFIEDAT)
    VALUES (1, 'SWISS_ARGV2', 'CH', 'ArGV 2: Verordnung 2 zum Arbeitsgesetz, SR 822.112', SYSDATE, SYSDATE);
    DBMS_OUTPUT.PUT_LINE('RULEBOOK|inserted|' || SQL%ROWCOUNT);
    COMMIT;
  ELSE
    DBMS_OUTPUT.PUT_LINE('RULEBOOK|skipped|id 1 exists');
  END IF;
END;
/
SELECT 'RULEBOOK|after|' || ID || '|' || RULEBOOKTYPE || '|' || COUNTRY || '|' || TITLE FROM ECBERN.PLANNINGRULEBOOK ORDER BY ID;
SELECT 'RULEBOOK|adjusted parameters|' || COUNT(*) FROM ECBERN.ADJUSTED_PLANNINGRULEPARAMETER;
