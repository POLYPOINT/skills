-- rights.sql — Phase 1 step (b): grant the mobile-app rights (PEP app 2471) to every seed user through the seed planner role.
-- Run: scripts/sql.sh <tenant-id> -f scripts/seed/rights.sql -D role_id=<POLYUSRROLEID of group "DMSEED:Planner", audit.sql A2>
-- Idempotent: a row is inserted only if the same (role, app, function, operation) row does not exist yet.
--
-- Why this works: api-pp builds the myPP permissions from user -> group (POLYUSER_POLYUSRGRP) -> role (POLYUSRGRP.POLYUSRROLEID)
-- -> POLYUSRROLE_DETAIL rows of app 2471. SAVE_POLYRECHT and the myPOLYPOINT app 2610 are NOT read for this.
-- OPERATION ids as api-pp reads them (PermissionTypeIdConverter): 1 READ, 2 MODIFY, 3 DELETE, 4 CREATE, 5 PRINT, 6 EXECUTE.
-- Functions (POLYFUNKTION, app 2471) -> cloud flag:
--   1030 Mobile Applikation verwenden  op 6  -> license
--    306 Stempeln mobile Applikation   op 6  -> time_stamp_add
--    307 Autostempel bearbeiten        op 2,3,4 -> block_* (auto-stamp / BLOCKS employees)
--   1033 Stempel nacherfassen          op 2,3,4 -> time_stamp_retroactive / change / delete
--   1032 Piketteinsaetze erfassen      op 3,4 -> on_call_add / on_call_delete
--   1031 Planungswunsch                op 3,4
--   1040 Mein Team                     op 1
-- AUSWAHL_SELEKTION follows the seed pattern: 1 for read/print rows, 2 for modify/delete/create/execute rows.
-- The boxes lack the TIUD_POLYUSRROLE_DETAIL_PSC trigger, so api-pp's role cache (up to 7 days) is refreshed explicitly by the
-- ENQUEUE_PERSISTENCE_STATE_CHANGE call at the end. Verify with the harness (scripts/harness/api-probe.mjs): legacy /permissions
-- all true incl. license; unified /permissions can_add_timestamps + can_add_retroactive_timestamps true.
DEFINE app_id = 2471

insert into ECBERN.POLYUSRROLE_DETAIL (POLYUSRROLE_DETAILID, POLYUSRROLEID, APP_ID, FUNKTIONSID, SUBID, OPERATION, WERT, AUSWAHL_SELEKTION)
select ECBERN.SEQID_POLYUSRROLE_DETAIL.NEXTVAL, &role_id, &app_id, g.F, -1, g.OP, 'T', case when g.OP in (1, 5) then 1 else 2 end
  from (select 1030 as F, 6 as OP from dual union all
        select  306, 6 from dual union all
        select  307, 2 from dual union all select 307, 3 from dual union all select 307, 4 from dual union all
        select 1033, 2 from dual union all select 1033, 3 from dual union all select 1033, 4 from dual union all
        select 1032, 3 from dual union all select 1032, 4 from dual union all
        select 1031, 3 from dual union all select 1031, 4 from dual union all
        select 1040, 1 from dual) g
 where not exists (select 1 from ECBERN.POLYUSRROLE_DETAIL r
                    where r.POLYUSRROLEID = &role_id and r.APP_ID = &app_id and r.FUNKTIONSID = g.F and r.OPERATION = g.OP);
COMMIT;
exec IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('PERMISSION_ROLE', '&role_id', null, null, &app_id, null);
COMMIT;

PROMPT == granted rows (expect 13)
select POLYUSRROLE_DETAILID as ID, FUNKTIONSID as FUNC, OPERATION as OP, WERT, AUSWAHL_SELEKTION as SEL
  from ECBERN.POLYUSRROLE_DETAIL
 where POLYUSRROLEID = &role_id and APP_ID = &app_id and FUNKTIONSID in (1030, 306, 307, 1033, 1032, 1031, 1040)
 order by 2, 3;
