#!/usr/bin/env bash
# dm-join.sh — R0 runner join for one shared DeployMate env: every secret is revealed by the runner for themselves, into 0600
# files on this machine (skill-design.md 5.5). The steward must have shared the env with you (OPERATOR, or VIEWER for read-only
# groups) and added your SSH public key (dm-api.sh ssh-keys-add) before.
#
#   dm-join.sh <env-id> [--dry-run] [--no-reveal] [--no-ip] [--no-inventory] [--probe-pep]
#
# Steps (each prints one line, never a secret):
#   1. who am I: dm-api.sh me -> your userId (= PolyID sub; send it to the steward for the share)
#   2. visibility + level: GET /environments/<id> (404 = not shared with you yet), GET /viewers -> OWNER / OPERATOR / VIEWER
#   3. test-data -> $DM_CONFIG_DIR/<id>.test-data.json (0600; VIEWER is enough; the harness reads the seed password from it)
#   4. OPERATOR / owner: reveal rdp + db -> $DM_CONFIG_DIR/<id>.credentials.json (0600; keys rdp.username/password,
#      db.username/password/host/port/service = what sql.sh, tunnels.sh and pep-verify read)
#   5. OPERATOR / owner: dm-api.sh refresh-ip <id> --union (adds your public /32, keeps everyone else's; allowlist budget ~9)
#   6. PEP inventory $PEP_ANSIBLE_ROOT/inventories/deploymate/<id>/hosts (0600; pep.sh / pep-verify; local only, never commit)
#   7. probes: SSH (pp-01, $DM_SSH_KEY), sql.sh "select 1 from dual;", optional --probe-pep (pep.sh <id> windows)
#   8. prints the runners/<name> fields to write with ArtifactData (machine, level, joined env) — the script itself writes no db doc
# --dry-run prints the plan and calls nothing. Exit 0 = joined (all applicable probes ok), 1 = a probe failed, 2 = usage / no access.
# Env: DM_API_SH (path of the deploymate skill's dm-api.sh), DM_SESSION, DM_CONFIG_DIR (default ~/.config/deploymate),
#      DM_SSH_KEY (default ~/.ssh/deploymate), PEP_ANSIBLE_ROOT (default ~/ansible).
set -uo pipefail
die() { echo "dm-join: $*" >&2; exit 2; }
[ $# -ge 1 ] || { sed -n '2,23p' "$0" >&2; exit 2; }
id=$1; shift
LC_ALL=C; [[ "$id" =~ ^[a-z][a-z0-9-]{0,14}$ ]] || die "bad env id $id (DeployMate ids: ^[a-z][a-z0-9-]{0,14}$)"
dry=0 reveal=1 ip=1 inv=1 ppep=0
for a in "$@"; do case "$a" in --dry-run) dry=1;; --no-reveal) reveal=0;; --no-ip) ip=0;; --no-inventory) inv=0;; --probe-pep) ppep=1;; *) die "unknown option $a";; esac; done
here=$(cd "$(dirname "$0")" && pwd)
cfg=${DM_CONFIG_DIR:-$HOME/.config/deploymate}
key=${DM_SSH_KEY:-$HOME/.ssh/deploymate}
pep_root=${PEP_ANSIBLE_ROOT:-$HOME/ansible}
host="$id-host.deploymate.polypoint.dev"
case "$host" in *polypointservices.ch*) die "refusing a production host";; esac

find_dm() {
  local c
  for c in "${DM_API_SH:-}" "$here/../../../../deploymate/skills/deploymate/scripts/dm-api.sh"; do
    [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return; }
  done
  c=$(ls -t "$HOME"/.claude/plugins/cache/*/deploymate/*/skills/deploymate/scripts/dm-api.sh 2>/dev/null | head -1)
  [ -n "$c" ] && { echo "$c"; return; }
  return 1
}

if [ "$dry" = 1 ]; then
  cat <<EOF
dm-join plan for $id (dry run, nothing called):
  1 dm-api.sh me                                  -> userId
  2 dm-api.sh get $id ; dm-api.sh viewers $id     -> visibility, level
  3 dm-api.sh test-data $id > $cfg/$id.test-data.json (0600)
  4 $( [ $reveal = 1 ] && echo "dm-api.sh reveal $id rdp|db -> $cfg/$id.credentials.json (0600)  [OPERATOR/owner]" || echo "skipped (--no-reveal)")
  5 $( [ $ip = 1 ] && echo "dm-api.sh refresh-ip $id --union  [OPERATOR/owner]" || echo "skipped (--no-ip)")
  6 $( [ $inv = 1 ] && echo "$pep_root/inventories/deploymate/$id/hosts (0600)" || echo "skipped (--no-inventory)")
  7 ssh -i $key pp-01@$host echo ok ; sql.sh $id "select 1 from dual;"$( [ $ppep = 1 ] && echo " ; pep.sh $id windows")
EOF
  exit 0
fi

command -v jq >/dev/null || die "jq missing"
dm=$(find_dm) || die "dm-api.sh not found (install the deploymate skill or set DM_API_SH)"
umask 077
mkdir -p "$cfg"
rc=0

me=$("$dm" me 2>/dev/null) || die "no DeployMate session: run the deploymate skill's dm-login-capture.mjs once on this machine"
sub=$(printf '%s\n' "$me" | jq -rs 'map(select(.userId?)) | .[0].userId // empty')
echo "1 userId (PolyID sub, send it to the steward): ${sub:-unknown}"

env_json=$("$dm" get "$id" 2>/dev/null) || die "env $id not visible: ask the steward for the share (dm-api.sh share $id ${sub:-<your sub>} OPERATOR)"
state=$(printf '%s' "$env_json" | jq -r '"\(.provisioningState) / \(.instanceState // "-") / autoStop \(.autoStopEnabled // "-")"')
owner=$(printf '%s' "$env_json" | jq -r '.ownerId // .ownerSub // .owner // empty')
if [ -n "$sub" ] && [ "$owner" = "$sub" ]; then level=OWNER
else
  # a share lists you with your level; an env you can see without a share is yours (or you are a read-only admin: reveals then fail)
  lv=$("$dm" viewers "$id" 2>/dev/null | jq -r --arg s "$sub" '(if type=="array" then . else (.viewers // []) end) | map(select(.viewerSub == $s)) | .[0].level // empty')
  level=${lv:-OWNER}
fi
echo "2 env $id: $state; your level: $level"

if "$dm" test-data "$id" > "$cfg/$id.test-data.json.tmp" 2>/dev/null; then
  mv "$cfg/$id.test-data.json.tmp" "$cfg/$id.test-data.json"; chmod 600 "$cfg/$id.test-data.json"
  echo "3 test-data -> $cfg/$id.test-data.json (0600)"
else rm -f "$cfg/$id.test-data.json.tmp"; echo "3 test-data FAILED"; rc=1; fi

operator=0; case "$level" in OWNER|OPERATOR) operator=1;; esac
if [ "$reveal" = 1 ] && [ "$operator" = 1 ]; then
  rdp=$("$dm" reveal "$id" rdp 2>/dev/null) && db=$("$dm" reveal "$id" db 2>/dev/null) &&
  jq -n --argjson r "$rdp" --argjson d "$db" --arg h "$host" \
     '{rdp: {username: $r.username, password: $r.password}, db: {username: $d.username, password: $d.password, host: ($d.host // $h), port: ($d.port // 1521), service: ($d.service // "POLYP01")}}' \
     > "$cfg/$id.credentials.json.tmp" && mv "$cfg/$id.credentials.json.tmp" "$cfg/$id.credentials.json" && chmod 600 "$cfg/$id.credentials.json" &&
  echo "4 credentials -> $cfg/$id.credentials.json (0600)" || { rm -f "$cfg/$id.credentials.json.tmp"; echo "4 reveal FAILED (OPERATOR share? env DONE?)"; rc=1; }
  unset rdp db
else echo "4 reveal skipped (level $level$( [ "$reveal" = 0 ] && echo ", --no-reveal"))"; fi

if [ "$ip" = 1 ] && [ "$operator" = 1 ]; then
  if out=$("$dm" refresh-ip "$id" --union 2>&1); then echo "5 allowlist: $(printf '%s' "$out" | jq -c '.ipAllowlist // empty' 2>/dev/null) (your /32 added, union)"
  else echo "5 refresh-ip FAILED: $(printf '%s' "$out" | tail -1)"; rc=1; fi
else echo "5 refresh-ip skipped (level $level)"; fi

if [ "$inv" = 1 ] && [ -r "$cfg/$id.credentials.json" ]; then
  d="$pep_root/inventories/deploymate/$id"; mkdir -p "$d"
  pw=$(jq -r '.rdp.password // empty' "$cfg/$id.credentials.json")
  if [ -n "$pw" ]; then
    printf '[applicationservers]\n%s\n[applicationservers:vars]\nansible_user=pp-01\nansible_password="%s"\n' "$host" "$pw" > "$d/hosts"; chmod 600 "$d/hosts"
    echo "6 PEP inventory -> $d/hosts (0600, local only)"
  else echo "6 PEP inventory skipped (no rdp password)"; fi
  unset pw
else echo "6 PEP inventory skipped"; fi

if perl -e 'alarm shift; exec @ARGV' 30 ssh -i "$key" -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "pp-01@$host" "echo ok" >/dev/null 2>&1; then
  echo "7 ssh pp-01@$host ok"
  if [ -r "$cfg/$id.credentials.json" ]; then
    if SQL_TIMEOUT=60 "$here/sql.sh" "$id" "select 'DB_OK' from dual;" 2>/dev/null | grep -q DB_OK; then echo "7 db ok (sql.sh)"
    else echo "7 db FAILED (sql.sh $id --install once per box? allowlist?)"; rc=1; fi
  fi
  if [ "$ppep" = 1 ]; then
    if PEP_ANSIBLE_ROOT="$pep_root" perl -e 'alarm shift; exec @ARGV' 90 "$here/pep.sh" "$id" windows 2>/dev/null | grep -q TfrmPEPMain; then echo "7 pep agent ok (TfrmPEPMain)"
    else echo "7 pep NOT ready (steward: PE_COLD_START=1 scripts/pep/pe-ready.sh $id)"; fi
  fi
else
  echo "7 ssh FAILED (key not on the env yet: steward runs dm-api.sh ssh-keys-add $id <your .pub>; or IP not allowlisted)"; rc=1
fi

echo "8 runners/<your name> fields: {\"machine\": \"$(hostname -s)\", \"envs\": {\"$id\": \"$level\"}, \"heartbeat\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
exit $rc
