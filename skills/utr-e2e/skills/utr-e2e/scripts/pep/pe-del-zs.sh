#!/usr/bin/env bash
# pe-del-zs.sh <tenant-id> <row_y> — in the open Stempeleditor (Blöcke und Aufgaben tab) select the row at y and delete it
# (Löschen -> Ja). Used for the seed planned-credit ZEITSUMME (step e). Persist afterwards: ../pep.sh <id> flow stampeditor_commit
# Coordinates: seed/README.md § PEP coordinates. Screenshot the tab first: the row positions depend on the day's content.
set -u
[ $# -eq 2 ] || { echo "usage: pe-del-zs.sh <tenant-id> <row_y>" >&2; exit 2; }
P="$(cd "$(dirname "$0")/.." && pwd)/pep.sh"; t=$1; y=$2
SE='class=TfrmPEPMain > class=TStampEditor'
MSG='class=TfrmPEPMain > class=TECMessageForm'
"$P" "$t" click "$SE > tabitem=\"Blöcke und Aufgaben\"" >/dev/null; sleep 1
"$P" "$t" clickxy "${PE_ROW_X:-491}" "$y" >/dev/null; sleep 0.7
"$P" "$t" clickxy "${PE_DEL_X:-1421}" "${PE_DEL_Y:-475}" >/dev/null; sleep 1.5
if "$P" "$t" exists "$MSG" | grep -q true; then
  "$P" "$t" --out "${PE_OUT:-.}/pe-del-confirm.png" screenshot "$MSG" >/dev/null
  "$P" "$t" click "$MSG > button=\"Ja\"" >/dev/null; echo "deleted row y=$y (not yet persisted)"
else
  echo "NO confirm popup (nothing selected at y=$y?)" >&2; exit 1
fi
