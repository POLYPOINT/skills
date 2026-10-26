-- stamm-fix.sql — steward common seed S1 step 3 (UTR seed README step k): the seed inserts HIERARCHIE rows without STAMMRECHNEN,
-- so every seeded node has STAMM NULL → api-pp node.path null → the classic day card crashes (UTR C-01) and node paths are empty
-- in every cloud reader. Recompute from the root and refresh api-pp's org-structure cache (boxes have no PSC triggers).
--   scripts/sql.sh <env> -f scripts/seed/common/stamm-fix.sql
-- Idempotent (STAMMRECHNEN rewrites the paths; re-running is harmless). sqlplus only (sql.sh).
SET SERVEROUTPUT ON SIZE UNLIMITED
SET FEEDBACK OFF
SET PAGESIZE 0
WHENEVER SQLERROR EXIT FAILURE ROLLBACK
BEGIN
  IF SYS_CONTEXT('USERENV', 'CLIENT_PROGRAM_NAME') = 'JDBC Thin Client' THEN
    RAISE_APPLICATION_ERROR(-20001, 'run through sqlplus (scripts/sql.sh) only');
  END IF;
END;
/
SELECT 'BEFORE|STAMM NULL|' || COUNT(*) FROM ECBERN.HIERARCHIE WHERE STAMM IS NULL;
exec ECBERN.STAMMRECHNEN(1);
COMMIT;
exec IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('ORGANIZATION_STRUCTURE', null, null, null, null, null);
COMMIT;
SELECT 'AFTER|STAMM NULL|' || COUNT(*) || '|expect 0 (or only nodes outside the tree)' FROM ECBERN.HIERARCHIE WHERE STAMM IS NULL;
