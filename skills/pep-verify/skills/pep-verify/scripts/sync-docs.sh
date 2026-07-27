#!/usr/bin/env bash
# sync-docs.sh — re-copy the PEP knowledge docs from the pep-driver checkout
# into this skill's references/, then report what changed.
#
# The five docs below are authored in pep-driver (next to the code they
# describe) and mirrored here so the skill is self-contained for people who
# have not cloned the toolchain yet. Run this after a pep-driver pull, or after
# a session where you updated a doc there.
#
#   ./sync-docs.sh [--check]
#
#   --check   report drift and exit 1 if any; copy nothing (for CI / pre-PR)
#
# Env: PEP_DRIVER_ROOT (default ~/dev/polypoint/pep-driver)

set -uo pipefail

ROOT="${PEP_DRIVER_ROOT:-$HOME/dev/polypoint/pep-driver}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REFS="$(dirname "$HERE")/references"
CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

DOCS=(PEP-SUPERUSER-GUIDE.md PEP-DOMAIN-MODEL.md PEP-UI-MAP.md P2-SOURCE-NOTES.md USRADMIN-UI-MAP.md)

if [ ! -d "$ROOT/docs" ]; then
  echo "pep-driver docs not found at $ROOT/docs" >&2
  echo "clone it (git clone git@ssh.dev.azure.com:v3/polypoint/cloud/pep-driver $ROOT)" >&2
  echo "or set PEP_DRIVER_ROOT." >&2
  exit 2
fi

DRIFT=0
for d in "${DOCS[@]}"; do
  src="$ROOT/docs/$d"
  dst="$REFS/$d"
  if [ ! -f "$src" ]; then
    echo "MISSING in pep-driver: $d"
    DRIFT=1
    continue
  fi
  # Prettier reflows paragraphs, pads tables and rewrites emphasis markers here,
  # so compare the alphanumeric token stream — that ignores all formatting and
  # only reports genuine content drift.
  norm() { tr -cs '[:alnum:]' '\n' < "$1" | grep -v '^$'; }
  if diff -q <(norm "$src") <(norm "$dst") >/dev/null 2>&1; then
    echo "  ok    $d"
  else
    DRIFT=1
    if [ "$CHECK" -eq 1 ]; then
      echo "  DRIFT $d"
    else
      cp "$src" "$dst"
      echo "  sync  $d  (copied — run 'npm run format' before committing)"
    fi
  fi
done

if [ "$CHECK" -eq 1 ] && [ "$DRIFT" -eq 1 ]; then
  echo
  echo "references/ differ from pep-driver/docs. Run sync-docs.sh (no --check)." >&2
  exit 1
fi

# GOTCHAS.md and OPERATIONS.md are authored HERE, not in pep-driver — never
# overwritten by this script. Keep session learnings flowing into them.
echo
echo "note: GOTCHAS.md and OPERATIONS.md are skill-owned — update them by hand."
