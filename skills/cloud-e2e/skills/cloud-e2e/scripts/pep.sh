#!/usr/bin/env bash
# pep.sh — pep-driver CLI bound to one tenant box.
#   pep.sh <tenant-id> [--out <file>] <pep command ...>     e.g. pep.sh <tenant-id> dialogs
#                                                            pep.sh <tenant-id> flow create_stamp --param zeit=06:58
#   pep.sh <tenant-id> push-seed-flows [--force]            install the seed flows (default groups/utr/scripts/seed/flows, override PEP_SEED_FLOWS) into pep-driver and push them
# Global pep options (--out, --raw, --trace) go BEFORE the subcommand. Inventory: $PEP_ANSIBLE_ROOT/inventories/deploymate/<id>/hosts
# (env-setup.md §2). Env: PEP_DRIVER (default ~/dev/polypoint/pep-driver), PEP_ANSIBLE_ROOT (default ~/ansible).
# Never pass secrets with `settext`: its readback error can echo the text. Use `type` for the PEP login password.
set -u
[ $# -ge 2 ] || { echo "usage: pep.sh <tenant-id> [--out f] <command ...> | push-seed-flows [--force]" >&2; exit 2; }
T=$1; shift
PEP_DRIVER=${PEP_DRIVER:-$HOME/dev/polypoint/pep-driver}
export PEP_ANSIBLE_ROOT=${PEP_ANSIBLE_ROOT:-$HOME/ansible}
[ -f "$PEP_DRIVER/cli/pep" ] || { echo "pep-driver not found at $PEP_DRIVER (set PEP_DRIVER)" >&2; exit 2; }
if [ "$1" = "push-seed-flows" ]; then
  # pep push-flow only ships files from $PEP_DRIVER/agent/flows. Copy a skill flow there when it is missing; never overwrite
  # a different local version without --force (the pep-driver copy may be newer: then contribute the change back to the skill).
  here=$(cd "$(dirname "$0")" && pwd); force=${2:-}
  for f in "${PEP_SEED_FLOWS:-$here/../groups/utr/scripts/seed/flows}"/*.py; do
    n=$(basename "$f" .py); dst="$PEP_DRIVER/agent/flows/$n.py"
    if [ -f "$dst" ] && ! cmp -s "$f" "$dst"; then
      if [ "$force" != "--force" ]; then echo "$n: pep-driver has a different version, kept it (use --force to replace)"; else cp "$f" "$dst"; echo "$n: replaced"; fi
    elif [ ! -f "$dst" ]; then cp "$f" "$dst"; echo "$n: installed into pep-driver (contribute it upstream)"; fi
    python3 "$PEP_DRIVER/cli/pep" --tenant "$T" push-flow "$n"
  done
  exit 0
fi
exec python3 "$PEP_DRIVER/cli/pep" --tenant "$T" "$@"
