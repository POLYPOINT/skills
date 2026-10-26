#!/usr/bin/env bash
# sql.sh — run Oracle SQL on a DeployMate box as the revealed DB login (schema ECBERN), through SSH + sqlplus on the box.
#
#   sql.sh <tenant-id> "<sql; one statement per line, each ending with ;>"
#   sql.sh <tenant-id> -f <file.sql> [-D name=value ...]      # &name / &name. placeholders, sqlplus DEFINE syntax
#   sql.sh <tenant-id> --install                              # copy dm-sql.ps1 to the box (once per box)
#
# Inputs (never printed): $DM_CONFIG_DIR/<tenant-id>.credentials.json (default ~/.config/deploymate), keys
#   .db.username .db.password .db.port .db.service .db.host  (the DeployMate `reveal <id> db` result, file mode 0600).
# SSH target: $DM_HOST if set, else .db.host of the credentials file (the box name <id>-host.deploymate.polypoint.dev).
# SSH key: $DM_SSH_KEY (default ~/.ssh/deploymate), user pp-01. Remote wrapper: $DM_SQL_DIR\dm-sql.ps1.
# The connect string travels on stdin only (line 1), the wrapper reads it and pipes the rest into sqlplus -S.
# DML is allowed on CT DeployMate boxes: COMMIT explicitly. Undefined &placeholders abort before anything is sent.
# SQL_TIMEOUT (seconds, default 300; 0 = none): the ssh + sqlplus call is killed after it (macOS has no `timeout`: perl alarm);
# exit 124 and "sql.sh: timed out" on stderr. Never re-run a timed-out DML blindly: check its effect first.
set -uo pipefail
die() { echo "sql.sh: $*" >&2; exit 2; }
[ $# -ge 2 ] || die "usage: sql.sh <tenant-id> \"<sql>\" | -f <file.sql> [-D name=value ...] | --install"
tenant=$1; shift
cfg=${DM_CONFIG_DIR:-$HOME/.config/deploymate}
cred="$cfg/$tenant.credentials.json"
[ -r "$cred" ] || die "no credentials file $cred (reveal the db login with the deploymate skill first)"
host=${DM_HOST:-$(jq -r '.db.host // empty' "$cred")}
[ -n "$host" ] || die "no host: set DM_HOST or add .db.host to $cred"
key=${DM_SSH_KEY:-$HOME/.ssh/deploymate}
rdir=${DM_SQL_DIR:-D:/TempPOLYPOINT/liquibase}
ssh_opts="-i $key -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"

if [ "$1" = "--install" ]; then
  here=$(cd "$(dirname "$0")" && pwd)
  ssh $ssh_opts "pp-01@$host" "if not exist \"${rdir//\//\\}\" mkdir \"${rdir//\//\\}\"" >/dev/null
  scp $ssh_opts "$here/dm-sql.ps1" "pp-01@$host:$rdir/dm-sql.ps1" && echo "installed dm-sql.ps1 on $tenant"
  exit $?
fi

defs=""
if [ "$1" = "-f" ]; then
  [ $# -ge 2 ] && [ -r "$2" ] || die "-f needs a readable file"
  body=$(cat "$2"); shift 2
  while [ $# -gt 0 ]; do
    [ "$1" = "-D" ] && [ $# -ge 2 ] || die "unexpected argument $1 (expected -D name=value)"
    case "$2" in *=*) ;; *) die "bad -D $2";; esac
    defs="${defs}DEFINE ${2%%=*} = \"${2#*=}\""$'\n'; shift 2
  done
else
  body="$*"
fi
# every &name used must be defined (here or by a DEFINE line in the SQL), else sqlplus would read the next stdin line as its value
used=$(printf '%s\n' "$body" | grep -oE '&&?[A-Za-z_][A-Za-z0-9_]*' | tr -d '&' | sort -u)
known=$(printf '%s\n%s\n' "$defs" "$body" | grep -iE '^ *DEFINE +[A-Za-z_]' | awk '{print $2}' | sort -u)
for v in $used; do printf '%s\n' "$known" | grep -qix "$v" || die "placeholder &$v is not defined (pass -D $v=...)"; done

to=${SQL_TIMEOUT:-300}
case "$to" in ''|*[!0-9]*) die "SQL_TIMEOUT must be seconds";; esac
run() { if [ "$to" -gt 0 ]; then perl -e 'alarm shift; exec @ARGV' "$to" "$@"; else "$@"; fi; }
login=$(jq -r '.db | "\(.username)/\(.password)@127.0.0.1:\(.port)/\(.service)"' "$cred")
{ printf '%s\n' "$login"; printf 'SET VERIFY OFF\n%s%s\n' "$defs" "$body"; } |
  run ssh $ssh_opts "pp-01@$host" "powershell -NoProfile -ExecutionPolicy RemoteSigned -File ${rdir//\//\\}\\dm-sql.ps1"
rc=$?
[ "$rc" -eq 142 ] && { echo "sql.sh: timed out after ${to}s (SQL_TIMEOUT)" >&2; exit 124; }
exit "$rc"
