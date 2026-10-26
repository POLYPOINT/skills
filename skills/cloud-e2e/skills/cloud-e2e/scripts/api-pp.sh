#!/usr/bin/env bash
# api-pp.sh — call api-pp (the on-prem personnel-planning API of one DeployMate box) with the box service token.
#
#   api-pp.sh <env> avail <emp> <from> <to>            POST /api/v2/poma-availability-info/employee-ids/range/<from>/<to>  body [<emp>]
#   api-pp.sh <env> timesheet <employment> <YYYY-MM>   GET $APIPP_TIMESHEET_PATH ({employment}, {month} replaced; path not known yet:
#                                                      find it with `paths timesheet` on the first run and export it)
#   api-pp.sh <env> raw <METHOD> <path> [json|@file]   any /api/… path of api-pp (GET POST PUT DELETE)
#   api-pp.sh <env> paths [filter]                     OpenAPI paths of api-pp (GET /v3/api-docs) containing <filter>
#   api-pp.sh <env> token-check                        mint one token, print client id + expiry (never the token)
#
# <env> = DeployMate env id = CT tenant id. <emp> / <employment> = MITARBEITER_ID (= employment id on DeployMate seeds).
# Output: the response body on stdout; "HTTP <code> <METHOD> <path>" on stderr; with APIPP_OUT=<dir> a copy of every response
# is saved as <dir>/NNN-<METHOD>-<path>.json (bodies of api-pp carry no secrets; the token is never written).
# Service token: client polypoint-p4-api-personnelplanning (APIPP_CLIENT_ID), realm POLYP01 of the box Keycloak, 60 s lifetime,
# minted per call. Secret (hard rule 7): each runner reads it from its own vault access into a 0600 file —
# $APIPP_SECRET_FILE, else $DM_CONFIG_DIR/<env>.apipp-secret, else $DM_CONFIG_DIR/apipp-service-secret (first line). Never pass it
# on a command line: the secret goes to curl on stdin and the token through a /dev/fd header file (not visible in `ps`).
# Endpoints: box Traefik http://<box>:9090/pp-api-personnel-planning and Keycloak https://<box>:8383 from an allowlisted IP
# (<box> = .db.host of $DM_CONFIG_DIR/<env>.credentials.json or $DM_HOST), or through tunnels.sh with APIPP_TUNNEL=<digit>
# (localhost <digit>9090 / <digit>8383). Overrides: APIPP_BASE, KC_BASE. Host guard: localhost / 127.0.0.1 /
# *.deploymate.polypoint.dev only; polypointservices.ch, "prod", raw IPs and /test/** paths are refused.
# Exit: 0 HTTP 2xx, 2 usage, 3 HTTP >= 300 (body still printed), 4 secret / token problem, 5 guard refusal.
set -uo pipefail
die() { echo "api-pp.sh: $*" >&2; exit "${2:-2}"; }
[ $# -ge 2 ] || die "usage: api-pp.sh <env> avail|timesheet|raw|paths|token-check …"
env=$1; cmd=$2; shift 2
[[ "$env" =~ ^[a-z][a-z0-9-]{0,14}$ ]] || die "env must be the DeployMate env id (^[a-z][a-z0-9-]{0,14}\$)"
cfg=${DM_CONFIG_DIR:-$HOME/.config/deploymate}
client=${APIPP_CLIENT_ID:-polypoint-p4-api-personnelplanning}

if [ -n "${APIPP_TUNNEL:-}" ]; then
  case "$APIPP_TUNNEL" in [1-5]) ;; *) die "APIPP_TUNNEL must be the tunnels.sh port digit 1..5";; esac
  base_default="http://localhost:${APIPP_TUNNEL}9090/pp-api-personnel-planning"; kc_default="https://localhost:${APIPP_TUNNEL}8383/auth/realms/POLYP01"
else
  host=${DM_HOST:-$(jq -r '.db.host // empty' "$cfg/$env.credentials.json" 2>/dev/null)}
  [ -n "$host" ] || die "no box host: run dm-join.sh / reveal the db login (credentials file), set DM_HOST, or use APIPP_TUNNEL=<digit>"
  base_default="http://$host:9090/pp-api-personnel-planning"; kc_default="https://$host:8383/auth/realms/POLYP01"
fi
APIPP=${APIPP_BASE:-$base_default}; KC=${KC_BASE:-$kc_default}

guard_host() { # url
  local h; h=$(printf '%s' "$1" | sed -E 's#^[a-z]+://([^/:]+).*#\1#' | tr 'A-Z' 'a-z')
  case "$h" in *polypointservices.ch|*prod*|*staging*) die "GUARD: refusing host $h (production cluster)" 5;; esac
  case "$h" in localhost|127.0.0.1|*.deploymate.polypoint.dev) ;; *) die "GUARD: refusing host $h: only localhost (tunnel) or <id>-host.deploymate.polypoint.dev" 5;; esac
}
guard_host "$APIPP"; guard_host "$KC"
guard_path() { # path
  case "$1" in /api/*|/v3/api-docs*) ;; *) die "GUARD: path must start with /api/ (got $1)" 5;; esac
  case "/$1/" in */test/*) die "GUARD: /test/** paths are never called (hard rule 2)" 5;; esac
  case "$1" in *[[:space:]]*) die "path must not contain spaces" 2;; esac
}

secret_file() {
  local f=${APIPP_SECRET_FILE:-}
  [ -n "$f" ] || { [ -r "$cfg/$env.apipp-secret" ] && f="$cfg/$env.apipp-secret"; }
  [ -n "$f" ] || f="$cfg/apipp-service-secret"
  [ -r "$f" ] || die "no api-pp service secret file ($f): read it from your vault access into a 0600 file (never paste it into a prompt)" 4
  local mode; mode=$(stat -f %Lp "$f" 2>/dev/null || stat -c %a "$f" 2>/dev/null)
  case "$mode" in 600|400) ;; *) die "secret file $f has mode $mode: chmod 600 it" 4;; esac
  printf '%s' "$f"
}

mint() { # prints the access token on stdout (captured by the caller, never echoed)
  local f resp tok
  f=$(secret_file) || exit $?
  resp=$( { printf 'grant_type=client_credentials&client_id=%s&client_secret=' "$client"; head -n1 "$f" | tr -d '\r\n' | jq -sRr @uri; } \
    | curl -sk --max-time 30 -X POST "$KC/protocol/openid-connect/token" -H 'Content-Type: application/x-www-form-urlencoded' --data-binary @- )
  tok=$(printf '%s' "$resp" | jq -er '.access_token' 2>/dev/null) || die "token request failed: $(printf '%s' "$resp" | jq -r '.error_description // .error // "no JSON answer (Keycloak reachable? IP allowlisted?)"' 2>/dev/null)" 4
  printf '%s' "$tok"
}

n=0
call() { # METHOD path [body]
  local m=$1 p=$2 b=${3:-} tok tmp code safe
  guard_path "$p"
  case "$m" in GET|POST|PUT|DELETE) ;; *) die "method must be GET POST PUT DELETE";; esac
  tok=$(mint) || exit $?
  tmp=$(mktemp "${TMPDIR:-/tmp}/apipp.XXXXXX")
  if [ -n "$b" ]; then
    code=$(printf '%s' "$b" | curl -s --max-time "${APIPP_TIMEOUT:-60}" -o "$tmp" -w '%{http_code}' -X "$m" "$APIPP$p" \
      -H @<(printf 'Authorization: Bearer %s\n' "$tok") -H 'Content-Type: application/json' -H 'Accept: application/json' --data-binary @-)
  else
    code=$(curl -s --max-time "${APIPP_TIMEOUT:-60}" -o "$tmp" -w '%{http_code}' -X "$m" "$APIPP$p" \
      -H @<(printf 'Authorization: Bearer %s\n' "$tok") -H 'Accept: application/json')
  fi
  tok=
  cat "$tmp"; echo
  if [ -n "${APIPP_OUT:-}" ]; then
    mkdir -p "$APIPP_OUT"; n=$((n + 1)); safe=$(printf '%s' "${p#/}" | tr -c 'A-Za-z0-9._-' '_' | cut -c1-120)
    cp "$tmp" "$APIPP_OUT/$(date +%H%M%S)-$(printf '%03d' $n)-$m-$safe.json"
  fi
  rm -f "$tmp"
  echo "HTTP $code $m $p" >&2
  case "$code" in 2??) return 0;; *) return 3;; esac
}

date_ok() { [[ "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "date must be YYYY-MM-DD (got $1)"; }
case "$cmd" in
  avail)
    [ $# -eq 3 ] || die "avail <emp> <from> <to>"
    [[ "$1" =~ ^[0-9]+$ ]] || die "emp must be numeric"; date_ok "$2"; date_ok "$3"
    call POST "/api/v2/poma-availability-info/employee-ids/range/$2/$3" "[$1]"; exit $? ;;
  timesheet)
    [ $# -eq 2 ] || die "timesheet <employment> <YYYY-MM>"
    [[ "$1" =~ ^[0-9]+$ ]] || die "employment must be numeric"; [[ "$2" =~ ^[0-9]{4}-[0-9]{2}$ ]] || die "month must be YYYY-MM"
    [ -n "${APIPP_TIMESHEET_PATH:-}" ] || die "set APIPP_TIMESHEET_PATH (template with {employment} and {month}); find the path with: api-pp.sh $env paths timesheet"
    p=${APIPP_TIMESHEET_PATH//\{employment\}/$1}; p=${p//\{month\}/$2}
    call GET "$p"; exit $? ;;
  raw)
    [ $# -ge 2 ] || die "raw <METHOD> <path> [json|@file]"
    body=${3:-}
    if [ "${body#@}" != "$body" ]; then [ -r "${body#@}" ] || die "body file ${body#@} not readable"; body=$(cat "${body#@}"); fi
    if [ -n "$body" ]; then printf '%s' "$body" | jq -e . >/dev/null 2>&1 || die "body is not JSON"; fi
    call "$1" "$2" "$body"; exit $? ;;
  paths)
    out=$(call GET /v3/api-docs 2>/dev/null); rc=$?
    [ $rc -eq 0 ] || { echo "api-pp.sh: /v3/api-docs not reachable (HTTP error): use the Bruno collection ~/Documents/bruno/API-PP" >&2; exit $rc; }
    printf '%s' "$out" | jq -r '.paths | to_entries[] | .key as $p | .value | keys[] | "\(ascii_upcase) \($p)"' 2>/dev/null | grep -i -- "${1:-}" ; exit 0 ;;
  token-check)
    tok=$(mint) || exit $?
    printf '%s' "$tok" | cut -d. -f2 | tr '_-' '/+' | { b=$(cat); while [ $(( ${#b} % 4 )) -ne 0 ]; do b="$b="; done; printf '%s' "$b"; } | base64 -d 2>/dev/null \
      | jq -r '"token OK: azp=\(.azp // .client_id // "?") exp=\(.exp | todate) roles=\((.realm_access.roles // []) | length)"'
    tok=; exit 0 ;;
  *) die "unknown command $cmd (avail|timesheet|raw|paths|token-check)";;
esac
