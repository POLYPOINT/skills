#!/usr/bin/env bash
# preflight.sh — one-shot readiness check for driving PEP on a tenant box.
#
#   ./preflight.sh <tenant>          # e.g. ct-zinc-master, preview-feature
#
# Checks every prerequisite in order, prints PASS/FAIL per item, and ends with
# a VERDICT plus the exact next command to run. Never mutates anything on the
# box — safe to run at the start of every session.
#
# Env:
#   PEP_DRIVER_ROOT   toolchain checkout (default ~/dev/polypoint/pep-driver)
#   PEP_ANSIBLE_ROOT  ansible inventory root (default: the CLI's own defaults)

set -uo pipefail

TENANT="${1:-}"
ROOT="${PEP_DRIVER_ROOT:-$HOME/dev/polypoint/pep-driver}"
CLI="$ROOT/cli/pep"
INV="$ROOT/cli/inventory.py"

pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILED=1; }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; }
hint() { printf '        ↳ %s\n' "$1"; }
FAILED=0

if [ -z "$TENANT" ]; then
  echo "usage: preflight.sh <tenant>" >&2
  [ -f "$INV" ] && { echo "known tenants:" >&2; python3 "$INV" 2>/dev/null | head -40 >&2; }
  exit 2
fi

echo "pep-verify preflight — tenant: $TENANT"
echo

# --- 1. toolchain ----------------------------------------------------------
echo "1. Toolchain"
if [ -f "$CLI" ]; then
  pass "pep CLI at $CLI"
else
  fail "pep CLI not found at $CLI"
  hint "git clone git@ssh.dev.azure.com:v3/polypoint/cloud/pep-driver $ROOT"
  hint "or export PEP_DRIVER_ROOT=<your checkout>"
  echo; echo "VERDICT: BLOCKED — clone the toolchain first."; exit 1
fi
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  BEHIND=$(git -C "$ROOT" rev-list --count HEAD..@{u} 2>/dev/null || echo 0)
  [ "${BEHIND:-0}" -gt 0 ] && warn "toolchain is $BEHIND commit(s) behind origin — git -C $ROOT pull"
  DIRTY=$(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  [ "${DIRTY:-0}" -gt 0 ] && warn "toolchain has $DIRTY uncommitted change(s) — local-only fixes others won't have"
fi

# --- 2. inventory / transport ---------------------------------------------
echo "2. Inventory + transport"
RESOLVED=$(python3 "$INV" "$TENANT" 2>&1)
if [ $? -ne 0 ]; then
  fail "cannot resolve tenant '$TENANT'"
  hint "$(echo "$RESOLVED" | tail -3)"
  hint "clone the ansible inventory, or set PEP_ANSIBLE_ROOT=<dir containing inventories/>"
  echo; echo "VERDICT: BLOCKED — no host/creds for $TENANT."; exit 1
fi
HOST=$(echo "$RESOLVED" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("host",""))')
CONN=$(echo "$RESOLVED" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("connection","ssh"))')
pass "tenant resolves → host=$HOST transport=$CONN"

# DNS first — an unresolvable host (internal name, VPN down) otherwise surfaces
# as a wall of urllib3/paramiko traceback in the agent check below.
if ! python3 -c "import socket,sys;socket.getaddrinfo(sys.argv[1],None)" "$HOST" 2>/dev/null; then
  fail "cannot resolve $HOST"
  hint "internal name? connect the VPN, or add a hosts entry"
  echo; echo "VERDICT: BLOCKED — host does not resolve."; exit 1
fi

if [ "$CONN" = "winrm" ]; then
  if python3 -c 'import winrm' 2>/dev/null; then
    pass "pywinrm installed (WinRM transport)"
  else
    fail "pywinrm missing — required for ansible_connection=winrm boxes"
    hint "pip3 install pywinrm"
  fi
  command -v mount_smbfs >/dev/null 2>&1 && pass "mount_smbfs present (SMB deploy)" \
    || fail "mount_smbfs missing — needed to copy the bundle over SMB"
  PORT=$(echo "$RESOLVED" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("winrm_port",5985))' 2>/dev/null)
  if command -v nc >/dev/null 2>&1; then
    nc -z -G 5 -w 5 "$HOST" "${PORT:-5985}" 2>/dev/null \
      && pass "WinRM port ${PORT:-5985} reachable on $HOST" \
      || fail "WinRM port ${PORT:-5985} unreachable on $HOST — VPN/firewall?"
  fi
else
  if command -v sshpass >/dev/null 2>&1; then
    pass "sshpass installed"
  else
    fail "sshpass missing"
    hint "brew install sshpass"
  fi
  if command -v nc >/dev/null 2>&1 && [ -n "$HOST" ]; then
    if nc -z -G 5 -w 5 "$HOST" 22 2>/dev/null; then
      pass "tcp/22 reachable on $HOST"
    else
      fail "tcp/22 filtered on $HOST — your IP is probably not whitelisted"
      hint "GCP (ct-* tenants): gcloud compute firewall-rules describe public-allow-ssh-ansible --project=ppcloud-213507"
      hint "then --source-ranges=<existing>,\$(curl -s ifconfig.me)/32"
    fi
  fi
fi

# --- 3. bundle -------------------------------------------------------------
echo "3. Offline bundle"
if [ -f "$ROOT/dist/pep-driver/python/python.exe" ]; then
  pass "bundle built at dist/pep-driver/"
else
  fail "no bundle — the box needs the self-contained python"
  hint "$ROOT/packaging/build-bundle.sh   (downloads CPython + win_amd64 wheels, few minutes)"
fi

# --- 4. agent --------------------------------------------------------------
echo "4. Agent on the box"
if [ "$FAILED" -eq 1 ]; then
  warn "skipping live agent check — fix the failures above first"
  echo; echo "VERDICT: NOT READY — see FAIL lines."; exit 1
fi
STATUS=$(python3 "$CLI" --tenant "$TENANT" status 2>&1)
# a transport-level failure comes back as a multi-page python traceback — show
# only the exception line, the detail is noise here.
if echo "$STATUS" | grep -q '^Traceback'; then
  echo "$STATUS" | grep -v '^ ' | tail -3 | sed 's/^/        /'
else
  echo "$STATUS" | sed 's/^/        /'
fi
if echo "$STATUS" | grep -q "interactive=True"; then
  pass "agent UP and interactive"
  echo
  echo "VERDICT: READY — drive with:"
  echo "  P=\"python3 $CLI --tenant $TENANT\""
  echo "  \$P dialogs && \$P screenshot --out /tmp/pep.png"
elif echo "$STATUS" | grep -q "interactive=False"; then
  fail "agent is in session 0 — it cannot see PEP"
  hint "pep --tenant $TENANT agent-stop, then have a human double-click C:\\pep-driver\\start-agent.cmd in the RDP session"
  echo; echo "VERDICT: NOT READY — agent in the wrong session."
  exit 1
else
  fail "agent DOWN"
  hint "pep --tenant $TENANT deploy            # first time on this box"
  hint "pep --tenant $TENANT deploy --code-only # faster re-deploy (skips the bundled python)"
  hint "pep --tenant $TENANT agent-start        # read-only work; for DRIVING PEP prefer start-agent.cmd (see references/OPERATIONS.md)"
  echo; echo "VERDICT: NOT READY — agent not running."
  exit 1
fi
