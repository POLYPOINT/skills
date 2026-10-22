#!/usr/bin/env bash
# tunnels.sh — (re)start SSH port-forwards to one DeployMate box.
#   tunnels.sh <tenant-id> <host|-> <port-base-digit 1..5> [stop]
# host "-" = .db.host of $DM_CONFIG_DIR/<tenant-id>.credentials.json (the box name <id>-host.deploymate.polypoint.dev).
# Local ports = <digit> prefixed to the box port: base 1 -> 19090 Traefik (/pp-api-personnel-planning, /pp-api-gateway),
# 19091 Traefik API, 18383 Keycloak https (realm POLYP01), 18303 IDM, 11521 Oracle (service POLYP01).
# Use a different digit per environment (e.g. 1 for the bundle under test, 2 for an optional --compare env).
# SSH key $DM_SSH_KEY (default ~/.ssh/deploymate), user pp-01. An allowlisted IP reaches 9090/8383/1521 directly too;
# tunnels are the fallback and the stable local addresses for scripts.
# TUNNEL_TIMEOUT (seconds, default 60): the initial ssh (auth + forward set-up, before it backgrounds itself with -f) is killed
# after it — macOS has no `timeout` (perl alarm); a hung connect then reports FAILED instead of blocking the caller.
set -u
[ $# -ge 3 ] || { echo "usage: tunnels.sh <tenant-id> <host|-> <port-base-digit> [stop]" >&2; exit 2; }
tenant=$1; host=$2; b=$3; action=${4:-start}
case "$b" in [1-5]) ;; *) echo "port-base digit must be 1..5" >&2; exit 2;; esac
if [ "$host" = "-" ]; then
  host=$(jq -r '.db.host // empty' "${DM_CONFIG_DIR:-$HOME/.config/deploymate}/$tenant.credentials.json" 2>/dev/null)
  [ -n "$host" ] || { echo "no host for $tenant: pass it explicitly" >&2; exit 2; }
fi
KEY=${DM_SSH_KEY:-$HOME/.ssh/deploymate}
pkill -f "ssh -f -N -i $KEY .*pp-01@$host" 2>/dev/null
[ "$action" = "stop" ] && { echo "tunnel $tenant stopped"; exit 0; }
if perl -e 'alarm shift; exec @ARGV' "${TUNNEL_TIMEOUT:-60}" ssh -f -N -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -o ServerAliveInterval=30 \
     -o ExitOnForwardFailure=yes \
     -L "${b}9090:127.0.0.1:9090" -L "${b}9091:127.0.0.1:9091" -L "${b}8383:127.0.0.1:8383" \
     -L "${b}8303:127.0.0.1:8303" -L "${b}1521:127.0.0.1:1521" "pp-01@$host"; then
  echo "tunnel $tenant up: localhost ${b}9090 (Traefik) ${b}9091 ${b}8383 (Keycloak) ${b}8303 (IDM) ${b}1521 (Oracle)"
else
  echo "tunnel $tenant FAILED (SSH timeout = IP not allowlisted: deploymate dm-api.sh refresh-ip)" >&2; exit 1
fi
