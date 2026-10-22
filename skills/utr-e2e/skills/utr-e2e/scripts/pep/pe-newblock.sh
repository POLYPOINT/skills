#!/usr/bin/env bash
# pe-newblock.sh <tenant-id> <bh> <bm> <eh> <em> [--day2] [--autosync] [--no-ok]
# Dienst wizard (Definitionen › Dienst › Tf_def), page "Zeitraster / Stempel": Neu… › Block… (TBlockIntervalNew), type the
# Zeitblock Beginn / Ende (hour and minute edits), optionally tick "Autostempel sync." (Pikett blocks only) and the day-2
# toggle right of the Ende field, screenshot, OK. The wizard must be open on the Zeitraster page (seed README § Dienst wizard).
#   --day2      end time on the next day (Pikett 18:00–07:00): clicks NB_DAY2_DX px (default 30) right of the end-minute edit
#   --autosync  tick "Autostempel sync." (Pikett block dialog; Präsenz block dialogs have no such box)
#   --no-ok     leave the dialog open after the screenshot (check it, then click OK by hand)
# Recovered from run a1801 (newblock.sh): verified there for the three Kombi 9102 blocks (07:00–11:00, 11:00–14:00,
# 14:00–18:15) on a Präsenz wizard. --day2 and --autosync are UNVERIFIED (the Pikett wizard places the dialog elsewhere):
# run them with --no-ok first and check the screenshot.
# Control auto-ids change per wizard instance: the edits are found by position (sorted by y, then x; the first two rows are
# Beginn and Ende, each hour then minute). Pause rows below them are left untouched.
# Offsets relative to Tf_def (measured at 1920x1080 with Tf_def at 502,121): Neu… +803,+235, Block… +820,+260; override
# with NB_NEU_DX/NB_NEU_DY/NB_ITEM_DX/NB_ITEM_DY. Screenshot: $PE_OUT/nb-<bh><bm>-<eh><em>.png (PE_OUT default .).
# Exit 0 block added (or left open with --no-ok), 1 dialog not found / still open, 2 usage.
set -u
[ $# -ge 5 ] || { echo "usage: pe-newblock.sh <tenant-id> <bh> <bm> <eh> <em> [--day2] [--autosync] [--no-ok]" >&2; exit 2; }
T=$1; bh=$2; bm=$3; eh=$4; em=$5; shift 5
day2=0; sync=0; ok=1
for a in "$@"; do
  case "$a" in --day2) day2=1 ;; --autosync) sync=1 ;; --no-ok) ok=0 ;; *) echo "unknown option $a" >&2; exit 2 ;; esac
done
P="$(cd "$(dirname "$0")/.." && pwd)/pep.sh $T"
W='class=TfrmPEPMain >> class=Tf_def'
B='class=TfrmPEPMain >> class=TBlockIntervalNew'
out=${PE_OUT:-.}
nx=$($P find "$W" | jq -r '.rect.left'); ny=$($P find "$W" | jq -r '.rect.top')
case "$nx$ny" in *[!0-9]*|'') echo "no Tf_def (Dienst wizard) open"; exit 1 ;; esac
$P clickxy $((nx + ${NB_NEU_DX:-803})) $((ny + ${NB_NEU_DY:-235})) >/dev/null; sleep 2
$P clickxy $((nx + ${NB_ITEM_DX:-820})) $((ny + ${NB_ITEM_DY:-260})) >/dev/null; sleep 3
$P exists "$B" | grep -q true || { echo "no TBlockIntervalNew"; exit 1; }
rows=$(for a in $($P tree "$B" --depth 8 | grep 'Edit class=TEdit' | grep -o 'auto=[0-9]*' | cut -d= -f2); do
  echo "$($P find "$B >> edit auto=$a" | jq -r '"\(.rect.cy) \(.rect.cx)"') $a"; done | sort -n -k1,1 -k2,2)
set -- $(echo "$rows" | head -4 | awk '{print $3}')
[ $# -eq 4 ] || { echo "expected 4 time edits, found $#"; exit 1; }
$P type "$B >> edit auto=$1" "$bh" >/dev/null; $P type "$B >> edit auto=$2" "$bm" >/dev/null
$P type "$B >> edit auto=$3" "$eh" >/dev/null; $P type "$B >> edit auto=$4" "$em" >/dev/null; sleep 1
if [ "$day2" = 1 ]; then
  read -r ey ex <<EOF
$(echo "$rows" | sed -n 4p | awk '{print $1, $2}')
EOF
  $P clickxy $((ex + ${NB_DAY2_DX:-30})) "$ey" >/dev/null; sleep 1
fi
[ "$sync" = 1 ] && { $P click "$B >> checkbox=\"Autostempel sync.\"" >/dev/null; sleep 1; }
$P --out "$out/nb-$bh$bm-$eh$em.png" screenshot "$B" >/dev/null
[ "$ok" = 1 ] || { echo "dialog left open: check $out/nb-$bh$bm-$eh$em.png, then OK by hand"; exit 0; }
$P click "$B >> button=\"OK\"" >/dev/null; sleep 2
$P exists "$B" | grep -q true && { echo "block dialog still open"; exit 1; }
echo "block $bh:$bm-$eh:$em added"
