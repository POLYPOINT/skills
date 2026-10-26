#!/usr/bin/env bash
# pp-plan.sh — paint (or delete) ONE roster cell WITHOUT the PEP desktop, through api-pp direct-shift-planning, and prove the
# effect with a DB read-back. UNVERIFIED: written 2026-10-23 from the api-pp code (ShiftPlanningController); the first live use
# per env (steward, S1) must verify it on a scratch cell and log the outcome in kits/<env> — until then paint with
# pep/pe-paint.sh under the PEP lock (references/harness.md § pp-plan.sh).
#
#   pp-plan.sh <env> <emp MA_ID> <YYYY-MM-DD> <defId PA_CODE> FULL|LEFT|RIGHT|DELETE        (ON_CALL also accepted)
#
#   FULL|LEFT|RIGHT|ON_CALL  POST /api/v2/direct-shift-planning/<defId>/<emp>/<date>/<position>   body $PP_PLAN_BODY (default {})
#                            "plan a shift and remove or create temporary assignments and previous planning"
#   DELETE                   DELETE /api/v2/delete-shift-planning/<emp>/<date>/<position>          body {} — position = $PP_DELETE_POSITION
#                            (default FULL); <defId> = the PA code expected in the cell before (guard), or "-" for any
# Steps: snapshot (plan-day.sh) → api-pp call (api-pp.sh raw, service token) → snapshot → verdict. Files under $PP_OUT
# (default ./pp-plan): <emp>-<date>-before.txt, -after.txt, -<position>-response.json.
# Known asymmetries (oracles): api-pp planning writes silently no-op on days that already carry stamps, and direct planning
# cannot keep allowances → such cells are painted in PEP. Only own claimed employees and days (hard rule 5).
# Exit: 0 applied and verified, 1 HTTP 2xx but the cell did not change as expected (paint in PEP), 2 usage, 3 HTTP error,
#   4 secret / token problem, 5 guard refusal (incl. DELETE when the cell does not hold <defId>), 6 HTTP 2xx but no DB
#   read-back possible (no SSH: verify with another oracle before relying on it).
set -u
[ $# -eq 5 ] || { echo "usage: pp-plan.sh <env> <emp> <YYYY-MM-DD> <defId|-> FULL|LEFT|RIGHT|DELETE" >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
t=$1; emp=$2; d=$3; def=$4; pos=$5
[[ "$t" =~ ^[a-z][a-z0-9-]{0,14}$ ]] || { echo "env must be the DeployMate env id" >&2; exit 2; }
[[ "$emp" =~ ^[0-9]+$ ]] || { echo "emp must be numeric (MA_ID)" >&2; exit 2; }
[[ "$d" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "date must be YYYY-MM-DD" >&2; exit 2; }
case "$pos" in FULL|LEFT|RIGHT|ON_CALL) [[ "$def" =~ ^-?[0-9]+$ ]] || { echo "defId must be the numeric PA code" >&2; exit 2; };;
  DELETE) [[ "$def" =~ ^(-|-?[0-9]+)$ ]] || { echo "defId must be a PA code or -" >&2; exit 2; };;
  *) echo "position must be FULL, LEFT, RIGHT, ON_CALL or DELETE" >&2; exit 2;; esac
OUT=${PP_OUT:-./pp-plan}; mkdir -p "$OUT"
snap() { "$here/plan-day.sh" "$t" "$emp" "$d" 2>/dev/null; }
has_pa() { grep -Eq "^PL\|[0-9]+\|$d\|PA=$def\|" <<<"$1"; }

db=1
before=$(snap); rc=$?
if [ $rc -ne 0 ] || grep -Eq 'ORA-|SP2-|sql.sh:' <<<"$before" || [ -z "$before" ]; then db=0; echo "pp-plan: DB read-back unavailable (sql.sh / SSH): the result cannot be verified here" >&2; fi
[ $db -eq 1 ] && printf '%s\n' "$before" > "$OUT/$emp-$d-before.txt"
echo "$emp $d before: $( [ $db -eq 1 ] && tr '\n' ' ' <<<"$before" || echo 'n/a')"

if [ "$pos" = DELETE ]; then
  dpos=${PP_DELETE_POSITION:-FULL}
  case "$dpos" in FULL|LEFT|RIGHT|ON_CALL) ;; *) echo "PP_DELETE_POSITION must be FULL, LEFT, RIGHT or ON_CALL" >&2; exit 2;; esac
  if [ $db -eq 1 ] && [ "$def" != "-" ] && ! has_pa "$before"; then echo "pp-plan: GUARD: cell $emp $d does not hold PA $def: nothing deleted" >&2; exit 5; fi
  "$here/api-pp.sh" "$t" raw DELETE "/api/v2/delete-shift-planning/$emp/$d/$dpos" '{}' > "$OUT/$emp-$d-DELETE-response.json"; rc=$?
else
  body=${PP_PLAN_BODY:-'{}'}
  "$here/api-pp.sh" "$t" raw POST "/api/v2/direct-shift-planning/$def/$emp/$d/$pos" "$body" > "$OUT/$emp-$d-$pos-response.json"; rc=$?
fi
[ $rc -eq 0 ] || { echo "pp-plan: api-pp call failed (exit $rc): see $OUT/$emp-$d-*-response.json" >&2; exit $rc; }
[ $db -eq 1 ] || { echo "pp-plan: api-pp answered 2xx; NOT verified (no DB read-back)"; exit 6; }

sleep "${PP_SETTLE:-2}"
after=$(snap); printf '%s\n' "$after" > "$OUT/$emp-$d-after.txt"
echo "$emp $d after:  $(tr '\n' ' ' <<<"$after")"
if [ "$pos" = DELETE ]; then
  if [ "$def" != "-" ]; then has_pa "$after" && { echo "pp-plan: NOT APPLIED: PA $def still planned on $emp $d"; exit 1; }
  elif [ "$after" = "$before" ]; then echo "pp-plan: NOT APPLIED: the cell did not change"; exit 1; fi
  echo "pp-plan: deleted ($emp $d, position ${PP_DELETE_POSITION:-FULL}) — verified"; exit 0
fi
if ! has_pa "$after"; then echo "pp-plan: NOT APPLIED: no PLANUNG with PA $def on $emp $d after a 2xx (stamped day? paint it in PEP)"; exit 1; fi
others=$(grep -E '^PL\|' <<<"$after" | grep -Ev "\|PA=$def\|" || true)
if [ "$pos" = FULL ] && [ -n "$others" ]; then echo "pp-plan: WARN other plannings still on the day (FULL should replace them): $(tr '\n' ' ' <<<"$others")"; fi
echo "pp-plan: painted PA $def $pos on $emp $d — verified"
exit 0
