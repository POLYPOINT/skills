#!/usr/bin/env bash
# pe-paint.sh <tenant-id> <emp MA_ID> <YYYY-MM-DD> <want_pa> <radio_y> <slot_x> <slot_y> <row_y>
# Paint ONE roster cell in the open team plan sheet and prove that nothing else changed (generalised from the master-1822
# bring-up helper). PEP repaints the previously SELECTED cell with the newly armed Dienst on the next gesture (deferred repaint;
# it survives a close + reopen of the sheet), so every paint is:
#   1. SQL snapshot of the plannings around the target (NEIGHBOURS employees, target −2..+2 days; an empty neighbourhood is fine,
#      a failed SQL call is not)  -> $PE_OUT/<emp>-<day>-before.txt
#   2. plain-click the target cell (selects it without painting), so the deferred repaint lands on the target itself
#   3. arm the palette (radio at x=PE_RADIO_X / <radio_y>: "Ganz" for presences/absences, "Pikett" for Pikett slots; then the slot
#      <slot_x>,<slot_y> — read its tooltip from a screenshot first), drag_paint the cell (x = PE_X0 + (day−1)·PE_DX, y = <row_y>)
#   4. read the target by SQL; repeat the arm + drag up to PE_TRIES times only while nothing changed (first drag sometimes ignored)
#   5. any PEP dialog → screenshot, stop (no auto-confirm, exit 3); any other change of the target day → stop (exit 4)
#   6. close the plan sheet (click on the close box of the sheet tab) and reopen it (Datei › Planblatt bearbeiten › team node ›
#      Weiter); a dialog still open afterwards (close box or node missed) → screenshot, exit 6 after step 7
#   7. snapshot again and diff with step 1: the only allowed difference is the target cell; anything else → exit 5. The last line
#      also reports the BLOCK rows of the painted planning (0 on a presence = no start / end in api-pp: not swappable)
# Env: NEIGHBOURS=<comma-separated MA_IDs> (default: the target employee), PE_OUT (default ./pe-paint), PE_TRIES (4),
#   PE_RADIO_X (103), PE_X0/PE_DX (215/25), PE_CLOSE_X/Y (89,55: the close box at the right end of the sheet tab; x moves with the
#   tab label = the node name, e.g. 71 for "Geburtshilfe", 95 for "Pflege Paediatrie": read it from a screenshot per sheet),
#   PE_NODE_X/Y (934,420: team node in TfrmKnotenwahlSperr; depends on the tree), SQL_TIMEOUT (seconds per SQL call, default 60;
#   macOS has no `timeout`: perl alarm).
# Exit: 0 painted + neighbours unchanged, 1 not painted after PE_TRIES, 2 usage, 3 dialog, 4 unexpected target change or the
#   first snapshot failed, 5 a neighbour changed (report both snapshots, do not repaint) or the second snapshot failed,
#   6 painted + neighbours unchanged but the sheet was not reopened cleanly (close the dialog, fix PE_CLOSE_X/Y or PE_NODE_X/Y
#   before the next paint). Hold the PEP lock and run pe-ready.sh first.
# Coordinates: PEP 1920x1080 (scripts/seed/README.md § PEP coordinates) — verify with a screenshot first.
set -u
[ $# -eq 8 ] || { echo "usage: pe-paint.sh <tenant-id> <emp> <YYYY-MM-DD> <want_pa> <radio_y> <slot_x> <slot_y> <row_y>" >&2; exit 2; }
T=$1; emp=$2; d=$3; want=$4; ry=$5; sx=$6; sy=$7; cy=$8
case "$emp$want$ry$sx$sy$cy" in *[!0-9-]*) echo "numeric arguments expected" >&2; exit 2;; esac
case "$d" in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;; *) echo "date must be YYYY-MM-DD" >&2; exit 2;; esac
here=$(cd "$(dirname "$0")/.." && pwd)
P="$here/pep.sh $T"
OUT=${PE_OUT:-./pe-paint}; mkdir -p "$OUT"
NB=${NEIGHBOURS:-$emp}
case "$NB" in *[!0-9,]*) echo "NEIGHBOURS must be comma-separated ids" >&2; exit 2;; esac
dom=$((10#${d:8:2})); cx=$(( ${PE_X0:-215} + (dom - 1) * ${PE_DX:-25} ))
TO=${SQL_TIMEOUT:-60}
sq() { local t r; for t in 1 2 3; do r=$(perl -e 'alarm shift; exec @ARGV' "$TO" "$here/sql.sh" "$T" "$1" 2>/dev/null) && { printf '%s\n' "$r"; return 0; }; sleep 2; done; return 1; }
# planning lines of the neighbourhood (none is a valid answer); 1 = the SQL call failed (no SNAP_OK marker, or ORA- / SP2-)
snap() { local r; r=$(sq "SET PAGESIZE 0
SET LINESIZE 200
SELECT MITARBEITER_ID||' '||TO_CHAR(DATUM,'YYYY-MM-DD')||' PA='||PA_CODE||' #'||PLANUNG_ID FROM ECBERN.PLANUNG WHERE MITARBEITER_ID IN ($NB) AND DATUM BETWEEN DATE '$d'-2 AND DATE '$d'+2 ORDER BY 1;
SELECT 'SNAP_OK' FROM dual;") || return 1
  printf '%s\n' "$r" | grep -q '^SNAP_OK' || return 1
  printf '%s\n' "$r" | grep -Eq 'ORA-[0-9]|SP2-[0-9]' && return 1
  printf '%s\n' "$r" | grep -E '^[0-9]+ ' || true; }
cur() { sq "SET PAGESIZE 0
SELECT 'PAS='||LISTAGG(PA_CODE,',') WITHIN GROUP (ORDER BY PA_CODE) FROM ECBERN.PLANUNG WHERE MITARBEITER_ID=$emp AND DATUM=DATE '$d';" | grep '^PAS=' ; }
has() { sq "SET PAGESIZE 0
SELECT 'HIT='||PLANUNG_ID||'|'||PA_CODE||'|'||SOLLZEIT FROM ECBERN.PLANUNG WHERE MITARBEITER_ID=$emp AND DATUM=DATE '$d' AND PA_CODE=$want;" | grep '^HIT=' ; }
blk() { sq "SET PAGESIZE 0
SELECT 'BLK='||COUNT(*) FROM ECBERN.BLOCK b JOIN ECBERN.PLANUNG p ON p.PLANUNG_ID = b.PLANUNG_ID WHERE p.MITARBEITER_ID=$emp AND p.DATUM=DATE '$d' AND p.PA_CODE=$want;" | grep '^BLK=' | tr -d '\r' ; }
snap > "$OUT/$emp-$d-before.txt" || { echo "snapshot failed (SQL)"; exit 4; }
before=$(cur); echo "$emp $d before: ${before:-none}"
# select the target first: the deferred repaint of the next arm gesture then hits the target, never the previously selected cell
$P clickxy "$cx" "$cy" >/dev/null; sleep 1.5
ok=""
for k in $(seq 1 "${PE_TRIES:-4}"); do
  $P clickxy "${PE_RADIO_X:-103}" "$ry" >/dev/null; sleep 0.5; $P clickxy "$sx" "$sy" >/dev/null; sleep 1
  $P flow drag_paint --param x="$cx" --param y="$cy" --param wiggle=6 >/dev/null 2>&1; sleep 3
  dl=$($P dialogs 2>/dev/null | grep -o '"class": "[^"]*"' | grep -v TfrmPlbMonth | tr '\n' ' ')
  if [ -n "$dl" ]; then $P --out "$OUT/$emp-$d-dialog-$k.png" screenshot >/dev/null 2>&1; echo "$emp $d try $k: DIALOG $dl (screenshot $OUT/$emp-$d-dialog-$k.png) - stopping"; exit 3; fi
  got=$(has); echo "$emp $d want $want try $k: ${got:-none}"
  [ -n "$got" ] && { ok=1; break; }
  now=$(cur); if [ "$now" != "$before" ]; then echo "$emp $d UNEXPECTED change: $before -> $now (wanted $want) - stopping"; exit 4; fi
done
# close + reopen the plan sheet (releases the edit lock and reloads the sheet)
$P clickxy "${PE_CLOSE_X:-89}" "${PE_CLOSE_Y:-55}" >/dev/null; sleep 2
$P menupath Datei 'Planblatt bearbeiten' >/dev/null 2>&1; sleep 3
$P clickxy "${PE_NODE_X:-934}" "${PE_NODE_Y:-420}" >/dev/null; sleep 1
$P click 'class=TfrmPEPMain > class=TfrmKnotenwahlSperr >> button="Weiter"' >/dev/null 2>&1; sleep 9
# nothing may be left open: a leftover node chooser / message means the close click missed the tab or the node click missed
reopen=""
left=$($P dialogs 2>/dev/null | grep -o '"class": "[^"]*"' | grep -v TfrmPlbMonth | tr '\n' ' ')
if [ -n "$left" ]; then
  $P --out "$OUT/$emp-$d-reopen.png" screenshot >/dev/null 2>&1
  echo "$emp $d: sheet NOT reopened cleanly, still open: $left(screenshot $OUT/$emp-$d-reopen.png; check PE_CLOSE_X/Y and PE_NODE_X/Y)"; reopen=1
fi
[ -n "$ok" ] || { echo "$emp $d: not painted after ${PE_TRIES:-4} tries"; exit 1; }
snap > "$OUT/$emp-$d-after.txt" || { echo "snapshot after failed (SQL)"; exit 5; }
# allowed difference: lines of the target employee and day only
other=$(diff <(grep -v "^$emp $d " "$OUT/$emp-$d-before.txt") <(grep -v "^$emp $d " "$OUT/$emp-$d-after.txt"))
if [ -n "$other" ]; then echo "NEIGHBOUR CHANGED - do not repaint, report both snapshots:"; printf '%s\n' "$other"; exit 5; fi
b=$(blk); b=${b#BLK=}
echo "painted $emp $d PA $want; neighbours unchanged ($OUT/$emp-$d-before.txt / -after.txt); BLOCK rows ${b:-?}"
[ -z "$reopen" ] || exit 6
