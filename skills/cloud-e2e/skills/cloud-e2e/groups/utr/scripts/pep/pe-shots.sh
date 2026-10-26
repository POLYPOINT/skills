#!/usr/bin/env bash
# pe-shots.sh <tenant-id> <outdir> <label:row_y:day_of_month> ... — screenshot the Blöcke tab of each prepared day.
#   e.g. pe-shots.sh <tenant-id> results/<run>/pep E1-<date>:259:<day> E2-<date>:423:<day>
# Row y as in seed/README.md § PEP coordinates (use the Ist-Zeit Tag view, Ctrl+0, so the roster cells also show PEP's credited value).
set -u
[ $# -ge 3 ] || { echo "usage: pe-shots.sh <tenant-id> <outdir> <label:row_y:day> ..." >&2; exit 2; }
H="$(cd "$(dirname "$0")" && pwd)"; P="$H/../../../../scripts/pep.sh"; t=$1; out=$2; shift 2
mkdir -p "$out"
SE='class=TfrmPEPMain > class=TStampEditor'
for spec in "$@"; do
  label=${spec%%:*}; rest=${spec#*:}; y=${rest%%:*}; d=${rest#*:}
  "$H/pe-open.sh" "$t" "$y" "$d" | grep -o 'Stempeleditor - [^"]*'
  "$P" "$t" click "$SE > tabitem=\"Blöcke und Aufgaben\"" >/dev/null; sleep 1
  "$P" "$t" --out "$out/$label.png" screenshot "$SE" | tail -1
done
"$P" "$t" click "$SE > button=\"Abbrechen\"" >/dev/null
