#!/usr/bin/env bash
# pe-reinterp.sh <tenant-id> — open Stempeleditor: Stempeluhr tab -> Neu interpretieren -> OK -> Übernehmen (stampeditor_commit).
# Coordinates: seed/README.md § PEP coordinates (rect fractions of TStampEditor at its default size).
set -u
[ $# -eq 1 ] || { echo "usage: pe-reinterp.sh <tenant-id>" >&2; exit 2; }
P="$(cd "$(dirname "$0")/../../../.." && pwd)/scripts/pep.sh"; t=$1
SE='class=TfrmPEPMain > class=TStampEditor'
MSG='class=TfrmPEPMain > class=TECMessageForm'
"$P" "$t" click "$SE > tabitem=\"Stempeluhr\"" >/dev/null; sleep 1
"$P" "$t" clickin "$SE" --fx "${PE_REINT_FX:-0.93}" --fy "${PE_REINT_FY:-0.464}" >/dev/null; sleep 2
if "$P" "$t" exists "$MSG" | grep -q true; then
  "$P" "$t" click "$MSG > button=\"OK\"" >/dev/null; sleep 2; echo "reinterpreted"
else
  echo "NO reinterpretation popup" >&2
fi
"$P" "$t" flow stampeditor_commit | grep -E 'commit:|ERROR'
