#!/usr/bin/env bash
# pe-open.sh <tenant-id> <row_y> <day_of_month> — close any Stempeleditor (Abbrechen) and open the one of that roster cell.
# Coordinates: see seed/README.md § PEP coordinates (PEP 1920x1080 default roster layout; verify with a screenshot first).
set -u
[ $# -eq 3 ] || { echo "usage: pe-open.sh <tenant-id> <row_y> <day_of_month>" >&2; exit 2; }
P="$(cd "$(dirname "$0")/../../../.." && pwd)/scripts/pep.sh"; t=$1; y=$2; d=$3
SE='class=TfrmPEPMain > class=TStampEditor'
for i in 1 2; do
  if "$P" "$t" exists "$SE" 2>/dev/null | grep -q true; then "$P" "$t" click "$SE > button=\"Abbrechen\"" >/dev/null; sleep 1.5; fi
done
x=$(( ${PE_X0:-215} + (d - 1) * ${PE_DX:-25} ))
"$P" "$t" clickxy "$x" "$y" --double >/dev/null; sleep 3
"$P" "$t" dialogs | grep -E '"(class|title)"' | paste - -
