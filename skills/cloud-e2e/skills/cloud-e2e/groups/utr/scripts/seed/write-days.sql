-- write-days.sql — Phase 1 step (f): per employee and day, what is planned and recorded (write-surface inventory). Read-only.
-- Run: scripts/sql.sh <tenant-id> -f scripts/seed/write-days.sql -D emp_ids=<E1..E6 MA_IDs, comma-separated> -D from_day=YYYY-MM-DD -D to_day=YYYY-MM-DD
-- Columns: PLAN = PA_CODE/TYP of the planning ('-' = planning-less day: W-05 candidate for a must-stamp employee),
-- SEED_ZS = seed planned-credit ZEITSUMME rows (ZSTYPE A on a presence Dienst: they double count once the day is stamped),
-- ZS_OTHER = other Zeitsummen, ST = active stamps of this day's planning unit (POSITION -1 = deleted through myPP, not counted), ST_CARRY = stamps dated this day that belong to the
-- previous day's unit (night-shift out-stamp: such a 'planning-less' day is NOT empty), BL = blocks, INTERP = PLANUNGSEINHEIT.INTERPRETATION_STATUS.
-- NIGHT = 'N' when a planning of the day crosses midnight (DIENST_DETAIL.DATUMSWECHSEL 'T': Nacht 141, Pikett 150/151);
-- RISK = 'NIGHT>FIX' when such a night is followed by a day carrying stamps, real (non-preview) blocks or manual Zeitsummen
-- (fixture-day protection: never write stamps on that night — on-prem re-interprets the next day and drops fixtures, N-W-3).
-- NIGHT/RISK added 2026-10-16 (Phase B), not yet executed on a box.
select e.MA_ID, substr(to_char(c.D,'YYYY-MM-DD DY','NLS_DATE_LANGUAGE=ENGLISH'),1,14) as DAY,
       substr(nvl((select listagg(p.PA_CODE||'/'||d.TYP, ',') within group (order by p.PA_CODE)
              from ECBERN.PLANUNG p join ECBERN.DIENST d on d.PA_CODE = p.PA_CODE
             where p.MITARBEITER_ID = e.MA_ID and p.DATUM = c.D), '-'),1,24) as PLAN,
       (select count(*) from ECBERN.ZEITSUMME z join ECBERN.DIENST d on d.PA_CODE = z.PA_CODE
         where z.MITARBEITER_ID = e.MA_ID and z.DATUM = c.D and z.ZSTYPE = 'A' and d.TYP = 'P') as SEED_ZS,
       (select count(*) from ECBERN.ZEITSUMME z join ECBERN.DIENST d on d.PA_CODE = z.PA_CODE
         where z.MITARBEITER_ID = e.MA_ID and z.DATUM = c.D and not (z.ZSTYPE = 'A' and d.TYP = 'P')) as ZS_OTHER,
       (select count(*) from ECBERN.STEMPEL s join ECBERN.PLANUNGSEINHEIT pe on pe.ID = s.PLANUNGSEINHEIT
         where s.MITARBEITER_ID = e.MA_ID and pe.DATUM = c.D and nvl(s.POSITION, 0) <> -1) as ST,
       (select count(*) from ECBERN.STEMPEL s join ECBERN.PLANUNGSEINHEIT pe on pe.ID = s.PLANUNGSEINHEIT
         where s.MITARBEITER_ID = e.MA_ID and s.DATUM = c.D and pe.DATUM <> c.D and nvl(s.POSITION, 0) <> -1) as ST_CARRY,
       (select count(*) from ECBERN.BLOCK b where b.MITARBEITER_ID = e.MA_ID and b.DATUM = c.D) as BL,
       substr((select max(pe.INTERPRETATION_STATUS) from ECBERN.PLANUNGSEINHEIT pe where pe.MITARBEITER_ID = e.MA_ID and pe.DATUM = c.D),1,6) as INTERP,
       (case when exists (select 1 from ECBERN.PLANUNG p join ECBERN.DIENST_DETAIL dd on dd.PA_CODE = p.PA_CODE
                           where p.MITARBEITER_ID = e.MA_ID and p.DATUM = c.D and dd.DATUMSWECHSEL = 'T') then 'N' else '-' end) as NIGHT,
       (case when exists (select 1 from ECBERN.PLANUNG p join ECBERN.DIENST_DETAIL dd on dd.PA_CODE = p.PA_CODE
                           where p.MITARBEITER_ID = e.MA_ID and p.DATUM = c.D and dd.DATUMSWECHSEL = 'T')
              and (exists (select 1 from ECBERN.STEMPEL s join ECBERN.PLANUNGSEINHEIT pe on pe.ID = s.PLANUNGSEINHEIT
                            where s.MITARBEITER_ID = e.MA_ID and pe.DATUM = c.D + 1 and nvl(s.POSITION, 0) <> -1)
                or exists (select 1 from ECBERN.BLOCK b where b.MITARBEITER_ID = e.MA_ID and b.DATUM = c.D + 1 and nvl(b.IS_ZE_PREVIEW, 'F') <> 'T')
                or exists (select 1 from ECBERN.ZEITSUMME z where z.MITARBEITER_ID = e.MA_ID and z.DATUM = c.D + 1 and z.ZSTYPE = 'M'))
             then 'NIGHT>FIX' else '-' end) as RISK
  from (select ID as MA_ID from ECBERN.MITARBEITER where ID in (&emp_ids)) e
 cross join (select to_date('&from_day','YYYY-MM-DD') + level - 1 as D from dual
              connect by level <= to_date('&to_day','YYYY-MM-DD') - to_date('&from_day','YYYY-MM-DD') + 1) c
 order by e.MA_ID, c.D;
