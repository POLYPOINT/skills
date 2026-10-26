#!/usr/bin/env bash
# plan-day.sh <env> <emp MA_ID> <YYYY-MM-DD> — read-only PEP planning oracle of one employee and day, through sql.sh.
# One line per PLANUNG row (oracle-day.sh prints no position):
#   PL|<PLANUNG_ID>|<YYYY-MM-DD>|PA=<code>|POS=<DIENSTPOSITION>|TEIL=<DIENSTTEIL>|NODE=<KNOTEN_ID>|SOLL=<SOLLZEIT s>|TYP=<P/A/I>|<title>
# or "(no rows)". DIENSTPOSITION / DIENSTTEIL: 'G' = whole cell on seeded rows; half cells (LEFT / RIGHT) show their own codes —
# read them once from a known half paint before asserting a value. Identify plannings by employee, day, PA code and position,
# never by PLANUNG_ID (every replan renumbers). Needs SSH to the box (sql.sh: credentials file + ~/.ssh/deploymate key).
# Exit: 0 (rows or "(no rows)"), 2 usage, 3 sql.sh failed (message on stderr). ORA- / SP2- lines are printed as they come.
set -u
[ $# -eq 3 ] || { echo "usage: plan-day.sh <env> <emp> <YYYY-MM-DD>" >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
t=$1; emp=$2; d=$3
case "$t" in [a-z]*) ;; *) echo "env must be the DeployMate env id" >&2; exit 2;; esac
case "$emp" in ''|*[!0-9]*) echo "emp must be numeric" >&2; exit 2;; esac
case "$d" in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;; *) echo "date must be YYYY-MM-DD" >&2; exit 2;; esac
out=$("$here/sql.sh" "$t" "SET LINESIZE 400
SET PAGESIZE 0
SELECT 'PL|'||p.PLANUNG_ID||'|'||TO_CHAR(p.DATUM,'YYYY-MM-DD')||'|PA='||p.PA_CODE||'|POS='||p.DIENSTPOSITION||'|TEIL='||p.DIENSTTEIL||'|NODE='||p.KNOTEN_ID||'|SOLL='||p.SOLLZEIT||'|TYP='||d.TYP||'|'||SUBSTR(d.TITEL,1,30) AS R FROM ECBERN.PLANUNG p LEFT JOIN ECBERN.DIENST d ON d.PA_CODE = p.PA_CODE WHERE p.MITARBEITER_ID=$emp AND p.DATUM=DATE '$d' ORDER BY p.DIENSTPOSITION, p.PA_CODE, p.PLANUNG_ID;" 2>&1); rc=$?
# a failed sql.sh (no credentials file, SSH not allowed, timeout) is an error, never "(no rows)"
[ $rc -eq 0 ] || { echo "plan-day: sql.sh failed (exit $rc): $(printf '%s\n' "$out" | grep -E 'sql.sh:|ssh|ORA-' | head -2 | tr '\n' ' ')" >&2; exit 3; }
rows=$(printf '%s\n' "$out" | grep -E '^PL\||ORA-|SP2-')
if [ -n "$rows" ]; then printf '%s\n' "$rows"; else echo '(no rows)'; fi
