-- psc-batch.sql — Phase 1 step (c2), gate G4b: ONE batch of persistence-state-change events for every definition / palette /
-- default / employment / allowance / org-structure change made by steps c, j, n, o, p (DeployMate boxes have no TIUD_*_PSC
-- triggers; api-pp caches these up to 7 days). Run after step p, before k:
--   scripts/sql.sh <tenant-id> -f scripts/seed/psc-batch.sql -D team_node=<team palette node> -D emp_ids=<ids, comma-separated>
-- emp_ids = the test employees whose MITARBEITER_DETAIL.PA_PIKETT was set in step n.2 (run a1801: 480,481,482,483,484,485).
-- The code lists below are the definitions this runbook creates or changes (c: 150 + palette 25/57/60/770, j: 111..141 + 145,
-- n: 151, o: 9102/9103, p: 111..141); add a code here if the run changed another one. Recovered from run a1801 (seed/c2-psc.sql,
-- first written on the m2 box); the gate is the read check of the README (no row to SELECT back: the enqueue is fire-and-forget).
BEGIN
  FOR c IN (SELECT COLUMN_VALUE AS PA FROM TABLE(SYS.ODCINUMBERLIST(111,112,113,141,145,150,151,770,9102,9103))) LOOP
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION', TO_CHAR(c.PA), null, null, null, null);
  END LOOP;
  FOR d IN (SELECT DIENST_DETAIL_ID, KNOTEN_ID FROM ECBERN.DIENST_DETAIL WHERE PA_CODE IN (111,112,113,141,150,151,9102,9103)) LOOP
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION_POLICY', d.DIENST_DETAIL_ID, d.KNOTEN_ID, null, null, null);
  END LOOP;
  IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION_PALETTE', null, 1, null, null, null);
  IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION_PALETTE', null, &team_node, null, null, null);
  IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('DEFAULT_SETTING', null, null, null, null, null);
  FOR e IN (SELECT COLUMN_VALUE AS ID FROM TABLE(SYS.ODCINUMBERLIST(&emp_ids))) LOOP
    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('EMPLOYMENT', TO_CHAR(e.ID), null, null, null, null);
  END LOOP;
  IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('ALLOWANCE_PROFILE', null, null, null, null, null);
  IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('ALLOWANCE_TYPE', null, null, null, null, null);
  IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('ORGANIZATION_STRUCTURE', null, null, null, null, null);
  COMMIT;
END;
/
PROMPT == psc-batch enqueued; gate: days-check.mjs EXPECT_DEF=<code> on a planned day + available-shift-definitions 200 (seed README c2)
