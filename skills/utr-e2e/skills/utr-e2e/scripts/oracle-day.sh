#!/usr/bin/env bash
# oracle-day.sh <tenant-id> <employee MA_ID> <YYYY-MM-DD>
# Read-only DB oracle of one employee for the day and day+1 (night shifts carry their out-stamp on day+1), through sql.sh.
# Prints one line per row, prefixed ST| (STEMPEL), BL| (BLOCK), PL| (PLANUNG), PE| (PLANUNGSEINHEIT), ZS| (ZEITSUMME),
# ZA| (Σ ZEITANRECHNUNG minutes per day, CODEART and account: GLAZ = acct 1; a day whose only GLAZ row is CODEART P and that has
# no real block (BL| prev=F) is a KD-7 day on pre-1801 bundles), then ACTIVE| with the number of ACTIVE stamps per day.
# Identify fixtures by PA + time window, never by id (every re-interpretation renumbers blocks). Deleted unified stamps keep their row with POSITION = -1:
# always count active stamps with "POSITION <> -1 OR POSITION IS NULL" (an update = delete + add: new id, old row POSITION -1).
set -u
[ $# -eq 3 ] || { echo "usage: oracle-day.sh <tenant-id> <emp> <YYYY-MM-DD>" >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
t=$1; emp=$2; d=$3
case "$emp" in *[!0-9]*) echo "emp must be numeric" >&2; exit 2;; esac
case "$d" in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;; *) echo "date must be YYYY-MM-DD" >&2; exit 2;; esac
"$here/sql.sh" "$t" "SET LINESIZE 400
SET PAGESIZE 0
SELECT 'ST|'||ID||'|'||TO_CHAR(DATUM,'MM-DD')||'|'||ZEIT||'|'||STEMPELART||'|PE='||PLANUNGSEINHEIT||'|PL='||PLANUNG_ID||'|pos='||POSITION||'|del='||GELOESCHT||'|'||KOMMENTAR||'|orig='||ORIGINAL_ZEITPUNKT AS R FROM ECBERN.STEMPEL WHERE MITARBEITER_ID=$emp AND DATUM BETWEEN DATE '$d' AND DATE '$d'+1 ORDER BY DATUM,ZEIT,ID;
SELECT 'BL|'||BLOCK_ID||'|main='||MAINBLOCK_ID||'|'||TO_CHAR(DATUM,'MM-DD')||'|'||STARTTIME||'-'||ENDTIME||'|dur='||DURATION||'|type='||BLOCKTYPE||'|art='||BLOCKART||'|PA='||PACODE||'|DT='||DIENSTTYPE||'|PE='||PLANUNGSEINHEIT_ID||'|PL='||PLANUNG_ID||'|prev='||IS_ZE_PREVIEW||'|'||KOMMENTAR AS R FROM ECBERN.BLOCK WHERE MITARBEITER_ID=$emp AND DATUM BETWEEN DATE '$d' AND DATE '$d'+1 ORDER BY DATUM,STARTTIME,BLOCK_ID;
SELECT 'PL|'||PLANUNG_ID||'|'||TO_CHAR(DATUM,'MM-DD')||'|PA='||PA_CODE||'|PE='||PLANUNGSEINHEIT||'|soll='||SOLLZEIT AS R FROM ECBERN.PLANUNG WHERE MITARBEITER_ID=$emp AND DATUM BETWEEN DATE '$d' AND DATE '$d'+1 ORDER BY DATUM;
SELECT 'PE|'||ID||'|'||TO_CHAR(DATUM,'MM-DD')||'|st='||INTERPRETATION_STATUS||'|mode='||BLOCK_CREATION_MODE||'|lc='||TO_CHAR(LCDATE,'MM-DD HH24:MI')||' '||LCUSER AS R FROM ECBERN.PLANUNGSEINHEIT WHERE MITARBEITER_ID=$emp AND DATUM BETWEEN DATE '$d' AND DATE '$d'+1 ORDER BY DATUM;
SELECT 'ZS|'||ZEITSUMME_ID||'|'||TO_CHAR(DATUM,'MM-DD')||'|PA='||PA_CODE||'|dauer='||DAUER||'|'||ZSTYPE||'/'||DIENSTTYPE AS R FROM ECBERN.ZEITSUMME WHERE MITARBEITER_ID=$emp AND DATUM BETWEEN DATE '$d' AND DATE '$d'+1 ORDER BY DATUM;
SELECT 'ZA|'||TO_CHAR(ZA_DATUM,'MM-DD')||'|'||CODEART||'|acct='||AN_ZEITKONTO||'|min='||SUM(ZEIT)/60||'|rows='||COUNT(*) AS R FROM ECBERN.ZEITANRECHNUNG WHERE MITARBEITER_ID=$emp AND ZA_DATUM BETWEEN DATE '$d' AND DATE '$d'+1 GROUP BY ZA_DATUM, CODEART, AN_ZEITKONTO ORDER BY ZA_DATUM, CODEART, AN_ZEITKONTO;
SELECT 'ACTIVE|'||TO_CHAR(DATUM,'MM-DD')||'|stamps='||COUNT(*) AS R FROM ECBERN.STEMPEL WHERE MITARBEITER_ID=$emp AND DATUM BETWEEN DATE '$d' AND DATE '$d'+1 AND (POSITION <> -1 OR POSITION IS NULL) GROUP BY DATUM ORDER BY DATUM;" 2>&1 | grep -E '^(ST|BL|PL|PE|ZS|ZA|ACTIVE)\||ORA-|SP2-' || echo '(no rows)'
