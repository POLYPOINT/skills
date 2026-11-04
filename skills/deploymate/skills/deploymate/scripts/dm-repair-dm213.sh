#!/usr/bin/env bash
# dm-repair-dm213.sh — DM-213 repair in one call, no human step (SKILL.md § 6a).
#
#   dm-repair-dm213.sh <env-id> [--check] [--force]
#
# 1. reads the P4 Nomad job states over SSH; nothing dead (and no --force) -> skips to 5
# 2. copies dm-upgrade-stdin.ps1 + dm-rerun-jobs.ps1 to D:\TempPOLYPOINT\liquibase\ on the box
# 3. pipes the owner's revealed DB login (DBA role, the same login sql.sh uses) on stdin into dm-upgrade-stdin.ps1:
#    INSTALLER gets a throwaway password, boostrap-app runs the missing upgrade step -> must print UPGRADE_EXIT 0
# 4. re-runs the five P4 jobs (dm-rerun-jobs.ps1)
# 5. waits up to $DM_REPAIR_WAIT seconds (default 600) for `dm-api.sh services` to list the api-pp and gateway routes and
#    `dm-api.sh health` to report ping / health / vpn UP
# --check: steps 1 and 5 once, changes nothing. --force: run 2-4 even when no job is dead.
# DB login: $DM_CONFIG_DIR/<env-id>.credentials.json (.db.username/.password/.port/.service, written by the cloud-e2e skill's
# dm-join.sh), else a one-shot `dm-api.sh reveal <env-id> db` kept in memory only. The login travels on stdin, is never printed.
# Exit 0 = repaired (or nothing to repair), 1 = a step failed (output says which), 2 = usage / no access.
# Env: DM_API_SH (default: dm-api.sh next to this script), DM_SESSION, DM_CONFIG_DIR (default ~/.config/deploymate),
#      DM_SSH_KEY (default ~/.ssh/deploymate), DM_REPAIR_WAIT (seconds).
set -uo pipefail
die() { echo "dm-repair-dm213: $*" >&2; exit 2; }
[ $# -ge 1 ] || { sed -n '2,18p' "$0" >&2; exit 2; }
id=$1; shift
LC_ALL=C; [[ "$id" =~ ^[a-z][a-z0-9-]{0,14}$ ]] || die "bad env id $id"
check=0 force=0
for a in "$@"; do case "$a" in --check) check=1;; --force) force=1;; *) die "unknown option $a";; esac; done
here=$(cd "$(dirname "$0")" && pwd)
dm=${DM_API_SH:-$here/dm-api.sh}
[ -x "$dm" ] || die "dm-api.sh not found ($dm)"
cfg=${DM_CONFIG_DIR:-$HOME/.config/deploymate}
key=${DM_SSH_KEY:-$HOME/.ssh/deploymate}
wait_s=${DM_REPAIR_WAIT:-600}
host="$id-host.deploymate.polypoint.dev"
rdir='D:\TempPOLYPOINT\liquibase'
jobs="api-pp-personnel-planning api-pc-patient-case id-administration-service api-gateway poly-time-connect"
ssh_opts="-i $key -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"
run() { perl -e 'alarm shift; exec @ARGV' "$@"; }   # macOS has no `timeout`
# PowerShell over SSH answers with CRLF line ends: strip the CR, or exact matches ("running", "UPGRADE_EXIT 0") never hit
box_ps() { run "$1" ssh $ssh_opts "pp-01@$host" 'powershell -NoProfile -ExecutionPolicy RemoteSigned -Command -' | tr -d '\r'; }

job_states() {
  box_ps 60 <<EOF
\$want = '$jobs' -split ' '
\$j = Invoke-RestMethod -Uri http://localhost:4646/v1/jobs -TimeoutSec 20
foreach (\$n in \$want) { \$s = (\$j | Where-Object { \$_.Name -eq \$n }).Status; if (-not \$s) { \$s = 'missing' }; "JOB \$n \$s" }
EOF
}

# 0 when the P4 routes are listed and ping / health / vpn are UP; prints one status line
verify() {
  local sv hl routes up
  sv=$("$dm" services "$id" 2>/dev/null) || sv=""
  hl=$("$dm" health "$id" 2>/dev/null) || hl=""
  routes=0
  printf '%s' "$sv" | grep -q 'pp-api-personnel-planning' && printf '%s' "$sv" | grep -q 'pp-api-gateway' && routes=1
  up=$(printf '%s' "$hl" | jq -r '[.components[]? | select(.name=="ping" or .name=="health" or .name=="vpn") | "\(.name)=\(.status)"] | join(" ")' 2>/dev/null)
  echo "VERIFY routes=$([ $routes = 1 ] && echo ok || echo missing) $up"
  [ "$routes" = 1 ] && [ "$(printf '%s' "$up" | grep -o '=UP' | wc -l | tr -d ' ')" = 3 ]
}

states=$(job_states) || { echo "STEP 1 failed: cannot read Nomad jobs over SSH ($host)"; exit 1; }
echo "$states"
# one JOB line per job, else the Nomad API call failed on the box (an empty list must never read as "nothing dead")
n_jobs=$(printf '%s\n' "$states" | grep -c '^JOB ') n_want=$(set -- $jobs; echo $#)
[ "$n_jobs" -eq "$n_want" ] || { echo "STEP 1 failed: Nomad answered $n_jobs of $n_want job states ($host)"; exit 1; }
dead=$(printf '%s\n' "$states" | awk '$1=="JOB" && $3!="running" {print $2}')
if [ "$check" = 1 ]; then verify; exit $?; fi

if [ -n "$dead" ] || [ "$force" = 1 ]; then
  scp $ssh_opts "$here/dm-upgrade-stdin.ps1" "$here/dm-rerun-jobs.ps1" "pp-01@$host:D:/TempPOLYPOINT/liquibase/" >/dev/null \
    || { echo "STEP 2 failed: scp of the repair scripts"; exit 1; }
  echo "COPIED repair scripts"

  # EZConnect on the box itself (127.0.0.1, the revealed port / service); every field must be present (jq -e fails on a gap)
  ez='select(.username and .password and .port and .service) | "\(.username)/\(.password)@127.0.0.1:\(.port)/\(.service)"'
  cred="$cfg/$id.credentials.json"
  if [ -r "$cred" ] && [ -n "$(jq -r '.db.password // empty' "$cred")" ]; then
    login=$(jq -er ".db | $ez" "$cred") || die "incomplete .db login in $cred (dm-join.sh again)"
  else
    login=$("$dm" reveal "$id" db | jq -er "$ez") || die "no DB login: reveal of $id db failed (owner or OPERATOR needed)"
  fi
  out=$(printf '%s\n' "$login" | run 900 ssh $ssh_opts "pp-01@$host" \
    "powershell -NoProfile -ExecutionPolicy RemoteSigned -File $rdir\\dm-upgrade-stdin.ps1" | tr -d '\r')
  unset login
  # markers, Liquibase summary and the grant changesets that failed with failOnError=false (APIPP-1863 lines); full log on the box
  printf '%s\n' "$out" | grep -E '^(INSTALLER_|UPGRADE_EXIT|NO_LOGIN)|Run: |Previously run: |Upgrade completed|^[^ ].*APIPP-1863: [0-9]+ of' \
    | sed -E 's/^.*(APIPP-1863: [0-9]+ of [0-9]+ grants could not be applied).*/WARN \1/; s/^.*liquibase\.util +: +//' | awk '!seen[$0]++'
  if printf '%s\n' "$out" | grep -qx 'INSTALLER_RESET_FAILED'; then
    # the ORA- codes of the ALTER USER (sqlplus never echoes the connect string); ORA-01031 = this login lacks ALTER USER -> SYS fallback
    printf '%s\n' "$out" | grep -oE 'ORA-[0-9]{5}: [^.]{0,80}' | head -3 | sed 's/^/REASON /'
    echo "STEP 3 failed: INSTALLER password reset refused: SYS fallback of SKILL.md 6a (operator's own terminal)"; exit 1
  fi
  printf '%s\n' "$out" | grep -qx 'UPGRADE_EXIT 0' || { echo "STEP 3 failed: upgrade did not print UPGRADE_EXIT 0 (log $rdir\\dm-upgrade.log)"; exit 1; }

  box_ps 300 <<EOF || { echo "STEP 4 failed: job re-run"; exit 1; }
& '$rdir\\dm-rerun-jobs.ps1' $jobs
EOF
else
  echo "NOTHING_DEAD all P4 jobs running"
fi

deadline=$((SECONDS + wait_s))
until verify; do
  [ "$SECONDS" -ge "$deadline" ] && { echo "STEP 5 failed: not healthy after ${wait_s}s"; job_states; exit 1; }
  sleep 20
done
echo "REPAIRED $id"
