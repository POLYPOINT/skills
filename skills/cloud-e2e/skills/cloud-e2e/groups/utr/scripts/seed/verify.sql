-- verify.sql — per-day truth rows of the prepared days (what PEP wrote), the seed double-count detector, the odd-stamp guard
-- and (V4) the fixture inventory to diff before/after every writing family.
-- Read-only. Run after every prepared day and once at the end of Phase 1:
--   scripts/sql.sh <tenant-id> -f scripts/seed/verify.sql -D emp_ids=<MA_IDs> -D from_day=YYYY-MM-DD -D to_day=YYYY-MM-DD
-- Times are seconds after midnight (79080 = 21:58; an END above 86400 is on the next day); durations in seconds.
-- K: PL planning (ID, PA), PE planning unit (ID, interpretation status), ST stamp (ID, time, kind MS manual / AS auto pause /
--    ES clock / PS pause, X = deleted), BL block (ID, start-end, BLOCKART, PA, planning link), ZS Zeitsumme (ID, seconds, ZSTYPE/DIENSTTYPE, PA).

PROMPT == V1 rows per employee/day
select * from (
  select 'PL' as K, p.MITARBEITER_ID as MA_ID, to_char(p.DATUM,'MM-DD') as D, p.PLANUNG_ID as ID,
         null as T1, null as T2, null as KIND, to_char(p.PA_CODE) as PA, null as LINK
    from ECBERN.PLANUNG p where p.MITARBEITER_ID in (&emp_ids) and p.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
  union all
  select 'PE', pe.MITARBEITER_ID, to_char(pe.DATUM,'MM-DD'), pe.ID, null, null, pe.INTERPRETATION_STATUS, null, null
    from ECBERN.PLANUNGSEINHEIT pe where pe.MITARBEITER_ID in (&emp_ids) and pe.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
  union all
  select 'ST', s.MITARBEITER_ID, to_char(s.DATUM,'MM-DD'), s.ID, s.ZEIT, null, s.STEMPELART||decode(s.GELOESCHT,'T',' X',null), null, to_char(s.PLANUNGSEINHEIT)
    from ECBERN.STEMPEL s where s.MITARBEITER_ID in (&emp_ids) and s.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD') + 1
  union all
  select 'BL', b.MITARBEITER_ID, to_char(b.DATUM,'MM-DD'), b.BLOCK_ID, b.STARTTIME, b.ENDTIME, b.BLOCKART||'/'||b.DIENSTTYPE, to_char(b.PACODE), to_char(b.PLANUNG_ID)
    from ECBERN.BLOCK b where b.MITARBEITER_ID in (&emp_ids) and b.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
  union all
  select 'ZS', z.MITARBEITER_ID, to_char(z.DATUM,'MM-DD'), z.ZEITSUMME_ID, z.DAUER, null, z.ZSTYPE||'/'||z.DIENSTTYPE, to_char(z.PA_CODE), to_char(z.PLANUNG_ID)
    from ECBERN.ZEITSUMME z where z.MITARBEITER_ID in (&emp_ids) and z.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
) order by MA_ID, D, K, T1, ID;

PROMPT == V2 double-count candidates: seed planned-credit ZEITSUMME (ZSTYPE A on a presence Dienst; DIENSTTYPE A fresh, P after a PEP interpretation run) on a day that has stamps, blocks or manual Zeitsummen. Expected after step (e): no rows for prepared days
select z.MITARBEITER_ID as MA_ID, to_char(z.DATUM,'YYYY-MM-DD') as DAY, z.ZEITSUMME_ID as ZS_ID, z.PA_CODE, z.DAUER, z.ZSTYPE||'/'||z.DIENSTTYPE as TYPES,
       (select count(*) from ECBERN.STEMPEL s where s.MITARBEITER_ID = z.MITARBEITER_ID and s.PLANUNGSEINHEIT = z.PLANUNGSEINHEIT) as ST,
       (select count(*) from ECBERN.BLOCK b where b.MITARBEITER_ID = z.MITARBEITER_ID and b.DATUM = z.DATUM) as BL,
       (select count(*) from ECBERN.ZEITSUMME m where m.MITARBEITER_ID = z.MITARBEITER_ID and m.DATUM = z.DATUM and m.ZSTYPE = 'M') as ZS_M
  from ECBERN.ZEITSUMME z join ECBERN.DIENST d on d.PA_CODE = z.PA_CODE
 where z.MITARBEITER_ID in (&emp_ids) and z.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
   and z.ZSTYPE = 'A' and d.TYP = 'P'
   and (exists (select 1 from ECBERN.STEMPEL s where s.MITARBEITER_ID = z.MITARBEITER_ID and s.PLANUNGSEINHEIT = z.PLANUNGSEINHEIT)
     or exists (select 1 from ECBERN.BLOCK b where b.MITARBEITER_ID = z.MITARBEITER_ID and b.DATUM = z.DATUM)
     or exists (select 1 from ECBERN.ZEITSUMME m where m.MITARBEITER_ID = z.MITARBEITER_ID and m.DATUM = z.DATUM and m.ZSTYPE = 'M'))
 order by 1, 2;

PROMPT == V3 odd-stamp guard (hard rule 1): planning units with an odd number of ACTIVE manual/clock stamps. Expected: no rows
-- Active = not GELOESCHT and POSITION <> -1: a stamp deleted (or updated = delete + add) through myPP keeps its row with POSITION -1
-- and GELOESCHT null (first run 2026-10-14), so GELOESCHT alone over-counts.
select s.MITARBEITER_ID as MA_ID, to_char(pe.DATUM,'YYYY-MM-DD') as DAY, s.PLANUNGSEINHEIT as PE_ID, count(*) as STAMPS
  from ECBERN.STEMPEL s join ECBERN.PLANUNGSEINHEIT pe on pe.ID = s.PLANUNGSEINHEIT
 where s.MITARBEITER_ID in (&emp_ids) and pe.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
   and s.STEMPELART in ('MS', 'ES') and nvl(s.GELOESCHT, 'F') <> 'T' and nvl(s.POSITION, 0) <> -1
 group by s.MITARBEITER_ID, pe.DATUM, s.PLANUNGSEINHEIT
having mod(count(*), 2) = 1
 order by 1, 2;

PROMPT == V4 fixture inventory (run before and after every writing family and diff the two outputs; identify fixtures by MA_ID/DAY/PA/time, never by id): carved absence sub-blocks (BLOCKART i) with their main block, ad-hoc blocks without planning, Kombi legs without time account, Pikett standby blocks, manual Zeitsummen. A row that vanished = a lost fixture (N-W-3): re-apply its Phase 1 step and re-run its readers
-- First executed in run a1801 (columns resolve). CARVE narrowed to BLOCKART 'i' (MAINBLOCK alone also lists every paid pause,
-- BLOCKART b) and AD-HOC added (non-preview top-level blocks with PLANUNG_ID NULL: the R-06 block, myPP / legacy block writes)
-- after that run; both changes unverified on a box.
select * from (
  select 'CARVE' as K, b.MITARBEITER_ID as MA_ID, to_char(b.DATUM,'YYYY-MM-DD') as DAY, to_char(b.PACODE) as PA,
         b.STARTTIME||'-'||b.ENDTIME as SPAN, b.BLOCKART as ART,
         (select m.PACODE||' '||m.STARTTIME||'-'||m.ENDTIME from ECBERN.BLOCK m where m.BLOCK_ID = b.MAINBLOCK_ID) as PARENT
    from ECBERN.BLOCK b where b.MITARBEITER_ID in (&emp_ids) and b.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
     and b.MAINBLOCK_ID is not null and b.BLOCKART = 'i' and nvl(b.IS_ZE_PREVIEW, 'F') <> 'T'
  union all
  select 'AD-HOC', b.MITARBEITER_ID, to_char(b.DATUM,'YYYY-MM-DD'), to_char(b.PACODE), b.STARTTIME||'-'||b.ENDTIME, b.BLOCKART, null
    from ECBERN.BLOCK b where b.MITARBEITER_ID in (&emp_ids) and b.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
     and b.PLANUNG_ID is null and b.MAINBLOCK_ID is null and nvl(b.IS_ZE_PREVIEW, 'F') <> 'T'
  union all
  select 'NO-ACCOUNT-LEG', b.MITARBEITER_ID, to_char(b.DATUM,'YYYY-MM-DD'), to_char(b.PACODE), b.STARTTIME||'-'||b.ENDTIME, b.BLOCKART, to_char(b.PLANUNG_ID)
    from ECBERN.BLOCK b where b.MITARBEITER_ID in (&emp_ids) and b.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
     and b.AN_ZEITKONTO = -1 and nvl(b.IS_ZE_PREVIEW, 'F') <> 'T'
  union all
  select 'STANDBY', b.MITARBEITER_ID, to_char(b.DATUM,'YYYY-MM-DD'), to_char(b.PACODE), b.STARTTIME||'-'||b.ENDTIME, b.BLOCKART, to_char(b.PLANUNG_ID)
    from ECBERN.BLOCK b join ECBERN.DIENST d on d.PA_CODE = b.PACODE
   where b.MITARBEITER_ID in (&emp_ids) and b.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD') and d.TYP = 'I'
  union all
  select 'ZS-MANUAL', z.MITARBEITER_ID, to_char(z.DATUM,'YYYY-MM-DD'), to_char(z.PA_CODE), to_char(z.DAUER), z.ZSTYPE, null
    from ECBERN.ZEITSUMME z where z.MITARBEITER_ID in (&emp_ids) and z.DATUM between to_date('&from_day','YYYY-MM-DD') and to_date('&to_day','YYYY-MM-DD')
     and z.ZSTYPE = 'M'
) order by MA_ID, DAY, K, SPAN;
