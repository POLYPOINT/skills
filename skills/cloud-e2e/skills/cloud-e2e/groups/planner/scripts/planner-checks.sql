-- planner-checks.sql — read-only oracles of group planner (gate PSP-GD, PSP-09, PSP-20, PSP-22).
-- Run: scripts/sql.sh <env> -f groups/planner/scripts/planner-checks.sql -D login=<dmseed-kuerzel of PMA or SPA> -D ga_node=<G-A KNOTEN_ID>
-- Column names follow area pool-sp (ShiftDefinitionEntity.java:70-83, users_idm.py); INTERNER_POOL exists only on the master line
-- (migration feature-26-3): on main-26 the C2a statement fails — then read C2b only. HIERARCHIE.PARENT_ID and the DIENST_DETAIL
-- columns (KNOTEN_ID, GUELTIG_AB / GUELTIG_BIS) are guesses: if a statement fails, describe the table (`DESC ECBERN.<table>`) and
-- note the real column names in the scenario notes; never guess-write.

PROMPT == C1 node selection of the user's groups (POLYUSRGRP.POLYKNOTENAUSWAHLID_SICHTBAR -> POLYKNOTENAUSWAHL_DETAIL), PSP-09
select substr(g.BEZEICHNUNG,1,30) as GRP, g.POLYKNOTENAUSWAHLID_SICHTBAR as SEL, d.KNOTEN_ID, substr(k.NAME,1,30) as NODE_NAME
  from ECBERN.POLYUSER u
  join ECBERN.POLYUSER_POLYUSRGRP ug on ug.USER_ID = u.USER_ID
  join ECBERN.POLYUSRGRP g on g.POLYUSRGRPID = ug.POLYUSRGRPID
  left join ECBERN.POLYKNOTENAUSWAHL_DETAIL d on d.POLYKNOTENAUSWAHLID = g.POLYKNOTENAUSWAHLID_SICHTBAR
  left join ECBERN.KNOTEN k on k.ID = d.KNOTEN_ID
 where lower(u.KUERZEL) = lower('&login')
 order by 1, 3;

PROMPT == C1b subtree of G-A (HIERARCHIE) — compare with readable-nodes
select h.KNOTEN_ID, substr(k.NAME,1,30) as NODE_NAME
  from ECBERN.HIERARCHIE h join ECBERN.KNOTEN k on k.ID = h.KNOTEN_ID
 start with h.KNOTEN_ID = &ga_node
 connect by prior h.KNOTEN_ID = h.PARENT_ID
 order by 1;

PROMPT == C2a own PSP Dienste with the internal-pool flags (master line), PSP-20
select d.PA_CODE, substr(d.TITEL,1,25) as TITEL, d.INTERNER_POOL, d.RESSOURCENERSATZ, d.ALWAYS_VISIBLE, d.PLANUNGSWUNSCH
  from ECBERN.DIENST d where d.TITEL like 'PSP-%' order by 1;

PROMPT == C2b own PSP Dienste without INTERNER_POOL (any line)
select d.PA_CODE, substr(d.TITEL,1,25) as TITEL, d.RESSOURCENERSATZ, d.ALWAYS_VISIBLE, d.PLANUNGSWUNSCH
  from ECBERN.DIENST d where d.TITEL like 'PSP-%' order by 1;

PROMPT == C3 DIENST_DETAIL planning-wish flag per node (PSP-WUNSCH-*), PSP-22
select dd.PA_CODE, dd.KNOTEN_ID, dd.PLANUNGSWUNSCH, to_char(dd.GUELTIG_AB,'YYYY-MM-DD') as AB, to_char(dd.GUELTIG_BIS,'YYYY-MM-DD') as BIS
  from ECBERN.DIENST_DETAIL dd
 where dd.PA_CODE in (select PA_CODE from ECBERN.DIENST where TITEL like 'PSP-WUNSCH%')
 order by 1, 2;

PROMPT == C4 palette of G-A: the PSP Dienste must be there
select dp.KNOTEN_ID, dp.PA_CODE, substr(d.TITEL,1,25) as TITEL
  from ECBERN.DIENSTPALETTE dp join ECBERN.DIENST d on d.PA_CODE = dp.PA_CODE
 where dp.KNOTEN_ID = &ga_node and d.TITEL like 'PSP-%'
 order by 2;
