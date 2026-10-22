-- audit.sql — Phase 1 step (a): what the DeployMate customer-roster seed provides on this box. Read-only.
-- Run: scripts/sql.sh <tenant-id> -f scripts/seed/audit.sql
-- Seed marker: POLYUSER.KUERZEL 'DMSEED-<KUERZEL>'; the on-prem Keycloak / PolyID login is lower(KUERZEL) = dmseed-<kuerzel>.
-- Times in ECBERN are seconds after midnight; DAUER in seconds.

PROMPT == A1 seed users -> employees (login, mode, BG, team node). AUTO_ZEITSTEMPEL F = must-stamp (TIMESTAMPS), T = auto-stamp (BLOCKS)
select mp.ID as MA_ID, u.USER_ID as POLYUSER_ID, lower(u.KUERZEL) as LOGIN,
       case when u.KEYCLOAK_USER_ID is null then 'no' else 'yes' end as KC,
       md.AUTO_ZEITSTEMPEL as AUTO, md.BESCHAEFTIGUNGSGRAD as BG, md.TEILZEIT_STUNDENREDUKTION as RED,
       md.LOHNART, md.TAGESSOLL, mk.KNOTEN_ID as NODE, substr(k.NAME,1,30) as NODE_NAME
  from ECBERN.POLYUSER u
  join ECBERN.MITARBEITER_POLYUSER mp on mp.USER_ID = u.USER_ID
  left join ECBERN.MITARBEITER_DETAIL md on md.MITARBEITER_ID = mp.ID
       and trunc(sysdate) >= md.GUELTIG_AB and (md.GUELTIG_BIS is null or trunc(sysdate) <= md.GUELTIG_BIS)
  left join ECBERN.MITARBEITER_KATEGORIEDETAIL mk on mk.MITARBEITER_ID = mp.ID
  left join ECBERN.KNOTEN k on k.ID = mk.KNOTEN_ID
 where u.KUERZEL like 'DMSEED-%'
 order by mp.ID;

PROMPT == A2 groups of the seed users (the planner role is the one to grant the mobile-app rights on)
select g.POLYUSRGRPID as GRP, substr(g.BEZEICHNUNG,1,30) as GROUP_NAME, g.APP_ID, g.POLYUSRROLEID as ROLE_ID,
       count(*) as USERS, sum(case when ug.DEFAULTGRP = 'T' then 1 else 0 end) as AS_DEFAULT
  from ECBERN.POLYUSER_POLYUSRGRP ug
  join ECBERN.POLYUSRGRP g on g.POLYUSRGRPID = ug.POLYUSRGRPID
  join ECBERN.POLYUSER u on u.USER_ID = ug.USER_ID
 where u.KUERZEL like 'DMSEED-%'
 group by g.POLYUSRGRPID, g.BEZEICHNUNG, g.APP_ID, g.POLYUSRROLEID
 order by 1;

PROMPT == A3 mobile-app function rows already on those roles (app 2471; empty = step b still to do)
select r.POLYUSRROLEID as ROLE_ID, r.FUNKTIONSID as FUNC, r.OPERATION as OP, r.WERT, r.POLYUSRROLE_DETAILID as ID
  from ECBERN.POLYUSRROLE_DETAIL r
 where r.APP_ID = 2471 and r.FUNKTIONSID in (1030, 306, 307, 1033, 1032, 1031, 1040)
   and r.POLYUSRROLEID in (select g.POLYUSRROLEID from ECBERN.POLYUSRGRP g
                            where g.POLYUSRGRPID in (select ug.POLYUSRGRPID from ECBERN.POLYUSER_POLYUSRGRP ug
                                                      join ECBERN.POLYUSER u on u.USER_ID = ug.USER_ID
                                                     where u.KUERZEL like 'DMSEED-%'))
 order by 1, 2, 3;

PROMPT == A4 roster window and shift codes planned for seed employees
select to_char(min(p.DATUM),'YYYY-MM-DD') as FIRST_DAY, to_char(max(p.DATUM),'YYYY-MM-DD') as LAST_DAY,
       count(*) as PLANNINGS, count(distinct p.MITARBEITER_ID) as EMPLOYEES
  from ECBERN.PLANUNG p
 where p.MITARBEITER_ID in (select mp.ID from ECBERN.MITARBEITER_POLYUSER mp join ECBERN.POLYUSER u on u.USER_ID = mp.USER_ID where u.KUERZEL like 'DMSEED-%');
select p.PA_CODE, substr(d.TITEL,1,30) as TITEL, d.TYP, count(*) as N
  from ECBERN.PLANUNG p join ECBERN.DIENST d on d.PA_CODE = p.PA_CODE
 where p.MITARBEITER_ID in (select mp.ID from ECBERN.MITARBEITER_POLYUSER mp join ECBERN.POLYUSER u on u.USER_ID = mp.USER_ID where u.KUERZEL like 'DMSEED-%')
 group by p.PA_CODE, d.TITEL, d.TYP order by 1;

PROMPT == A5 plannings per seed employee (MM-DD:PA_CODE), node of the planning
select p.MITARBEITER_ID as MA_ID, min(p.KNOTEN_ID) as NODE,
       listagg(to_char(p.DATUM,'MM-DD')||':'||p.PA_CODE, ' ') within group (order by p.DATUM) as PLANNINGS
  from ECBERN.PLANUNG p
 where p.MITARBEITER_ID in (select mp.ID from ECBERN.MITARBEITER_POLYUSER mp join ECBERN.POLYUSER u on u.USER_ID = mp.USER_ID where u.KUERZEL like 'DMSEED-%')
 group by p.MITARBEITER_ID order by 1;

PROMPT == A6 palettes (node -> PA codes with type P/A/I). Absences and Pikett missing here must be added in PEP (step c)
select dp.KNOTEN_ID as NODE, substr(k.NAME,1,30) as NODE_NAME,
       listagg(dp.PA_CODE||'/'||d.TYP, ' ') within group (order by d.TYP, dp.PA_CODE) as PALETTE
  from ECBERN.DIENSTPALETTE dp join ECBERN.DIENST d on d.PA_CODE = dp.PA_CODE left join ECBERN.KNOTEN k on k.ID = dp.KNOTEN_ID
 where dp.PALETTE_GUELTIG_BIS is null or dp.PALETTE_GUELTIG_BIS >= trunc(sysdate)
 group by dp.KNOTEN_ID, k.NAME order by 1;

PROMPT == A7 on-call definitions: Pikett (TYP I) and Einsatz (PIKETTZUSATZ T); none of TYP I on a fresh seed
select d.PA_CODE, substr(d.TITEL,1,30) as TITEL, d.TYP, d.PIKETTZUSATZ, d.PLANBAR,
       (select count(*) from ECBERN.DIENST_DETAIL dd where dd.PA_CODE = d.PA_CODE) as DETAILS
  from ECBERN.DIENST d where d.TYP = 'I' or d.PIKETTZUSATZ = 'T' order by 1;

PROMPT == A8 absence definitions the recipe uses (25 Ferien Monatslohn, 57 Homeoffice, 60 Weiterbildung) and the seed's 145; DETAILS 0 = unusable
select d.PA_CODE, substr(d.TITEL,1,30) as TITEL, d.TYP, d.PLANBAR,
       (select count(*) from ECBERN.DIENST_DETAIL dd where dd.PA_CODE = d.PA_CODE) as DETAILS
  from ECBERN.DIENST d where d.PA_CODE in (25, 57, 60, 145, -1, -9) order by 1;

PROMPT == A9 closing dates per category node (ML = monthly wage, SL = hourly wage); 1999/2019 values = open
select v.KATEGORIE_ID as NODE, substr(k.NAME,1,30) as NODE_NAME, to_char(v.ML_ABSCHLUSS_DATUM,'YYYY-MM-DD') as ML_CLOSED,
       to_char(v.SL_ABSCHLUSS_DATUM,'YYYY-MM-DD') as SL_CLOSED, v.LOCK_LAST_MONAT
  from ECBERN.SYSTEM_KATEGORIE_VARIABELN v left join ECBERN.KNOTEN k on k.ID = v.KATEGORIE_ID
 where v.KATEGORIE_ID in (select mk.KNOTEN_ID from ECBERN.MITARBEITER_KATEGORIEDETAIL mk
                           where mk.MITARBEITER_ID in (select mp.ID from ECBERN.MITARBEITER_POLYUSER mp join ECBERN.POLYUSER u on u.USER_ID = mp.USER_ID where u.KUERZEL like 'DMSEED-%'))
 order by 1;

PROMPT == A10 time-recording rows of seed employees (fresh seed: STEMPEL 0, BLOCK 0, one ZEITSUMME A/P per presence planning)
select 'STEMPEL' as TAB, count(*) as N, null as KIND from ECBERN.STEMPEL s
 where s.MITARBEITER_ID in (select mp.ID from ECBERN.MITARBEITER_POLYUSER mp join ECBERN.POLYUSER u on u.USER_ID = mp.USER_ID where u.KUERZEL like 'DMSEED-%')
union all
select 'BLOCK', count(*), null from ECBERN.BLOCK b
 where b.MITARBEITER_ID in (select mp.ID from ECBERN.MITARBEITER_POLYUSER mp join ECBERN.POLYUSER u on u.USER_ID = mp.USER_ID where u.KUERZEL like 'DMSEED-%')
union all
select 'ZEITSUMME', count(*), z.ZSTYPE||'/'||z.DIENSTTYPE from ECBERN.ZEITSUMME z
 where z.MITARBEITER_ID in (select mp.ID from ECBERN.MITARBEITER_POLYUSER mp join ECBERN.POLYUSER u on u.USER_ID = mp.USER_ID where u.KUERZEL like 'DMSEED-%')
 group by z.ZSTYPE, z.DIENSTTYPE;
