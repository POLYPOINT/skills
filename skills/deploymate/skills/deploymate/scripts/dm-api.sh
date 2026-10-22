#!/usr/bin/env bash
# DeployMate API helper. Needs curl + jq and a session file written by dm-login-capture.mjs.
#
#   export DM_SESSION=~/.config/deploymate/dm-session.json   # default location
#
#   dm-api.sh me                              quota status + the IP DeployMate sees for you
#   dm-api.sh token                           print a fresh access token
#   dm-api.sh tracks | dumps | eta | my-ip
#   dm-api.sh versions <track> [DEV|RC|PROD|REVIEW]
#   dm-api.sh master-builds [P2|PP_SERVICES] [limit]
#   dm-api.sh list [all]                      visible envs (admin: all)
#   dm-api.sh get <id>
#   dm-api.sh create <payload.json>           POST /environments
#   dm-api.sh wait <id> [DONE] [interval-s]   poll until the state (or ERROR/DESTROYED)
#   dm-api.sh steps <id>                      per-step summary with exit codes
#   dm-api.sh logs <id> [afterId] [limit] [source] [step]
#   dm-api.sh services | health | test-data <id>
#   dm-api.sh reveal <id> rdp|db|pep          one-shot reveal+consume → JSON on stdout ONLY (redirect to a 0600 file)
#   dm-api.sh extend <id> [days]              1..14
#   dm-api.sh auto-stop <id> on|off
#   dm-api.sh time-recording <id> LEGACY|UNIFIED
#   dm-api.sh refresh-ip <id> [cidr ...]
#   dm-api.sh ssh-keys <id> <pubkey-file> [...]
#   dm-api.sh retry | reseed | start | stop | restart <id>
#   dm-api.sh share <id> <viewerSub> [VIEWER|OPERATOR] ; viewers <id> ; unshare <id> <viewerSub>
#   dm-api.sh destroy <id>                    DELETE (only on an explicit user request)
#   dm-api.sh raw <METHOD> <path> [json]      anything else
set -euo pipefail

DM_API="${DM_API:-https://deploymate-api.dev.k8s.polypoint-dev.com/api/v1}"
DM_SESSION="${DM_SESSION:-$HOME/.config/deploymate/dm-session.json}"

die() { echo "dm-api: $*" >&2; exit 2; }
need() { [ $# -ge 1 ] || die "missing argument"; }

_token() {
  [ -r "$DM_SESSION" ] || die "no session file at $DM_SESSION (run scripts/dm-login-capture.mjs)"
  local authority client rt resp new_rt
  authority=$(jq -r .authority "$DM_SESSION"); client=$(jq -r .client_id "$DM_SESSION"); rt=$(jq -r .refresh_token "$DM_SESSION")
  resp=$(curl -sS -X POST "$authority/protocol/openid-connect/token" \
    -d grant_type=refresh_token -d "client_id=$client" --data-urlencode "refresh_token=$rt")
  new_rt=$(echo "$resp" | jq -r '.refresh_token // empty')
  if [ -n "$new_rt" ] && [ "$new_rt" != "$rt" ]; then
    jq --arg rt "$new_rt" '.refresh_token = $rt' "$DM_SESSION" > "$DM_SESSION.tmp" && mv "$DM_SESSION.tmp" "$DM_SESSION" && chmod 600 "$DM_SESSION"
  fi
  echo "$resp" | jq -re .access_token 2>/dev/null || die "token refresh failed: $(echo "$resp" | jq -r '.error_description // .error // .' 2>/dev/null)"
}

_call() { # METHOD path [json-body]
  local m=$1 p=$2 b=${3:-} t code out
  t=$(_token)
  if [ -n "$b" ]; then
    out=$(curl -sS -w '\n%{http_code}' -X "$m" "$DM_API$p" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$b")
  else
    out=$(curl -sS -w '\n%{http_code}' -X "$m" "$DM_API$p" -H "Authorization: Bearer $t")
  fi
  code=${out##*$'\n'}; out=${out%$'\n'*}
  if [ "$code" -ge 400 ]; then echo "HTTP $code $m $p: $out" >&2; return 1; fi
  [ -n "$out" ] && echo "$out"
  return 0
}

cmd=${1:-}; shift || true
case "$cmd" in
  token) _token ;;
  me) _call GET /quota/me | jq .; _call GET /profile/my-ip | jq . ;;
  my-ip) _call GET /profile/my-ip | jq -r .ip ;;
  tracks) _call GET /release-tracks | jq . ;;
  versions) need "$@"; _call GET "/release-versions?track=$1${2:+&onPremStage=$2}" | jq . ;;
  master-builds) _call GET "/master-builds?repo=${1:-PP_SERVICES}&track=master&limit=${2:-10}" | jq . ;;
  dumps) _call GET /db-dumps | jq . ;;
  eta) _call GET /provisioning/eta-profile | jq '{generatedAt, sampleEnvs, states: [.states[] | {state, p50min: (.p50Seconds/60|floor), p90min: (.p90Seconds/60|floor), samples}]}' ;;
  list) _call GET "/environments${1:+?scope=$1}" | jq -r '.[] | "\(.id)\t\(.provisioningState)\t\(.instanceState // "-")\t\(.track)/\(.onPremStage)\t\(.stage)\tttl=\(.ttlExpiresAt[0:10])\tpr=\([.prSources[]?.prId]|join(","))\tpins=\(.masterBuildPins|tostring)"' ;;
  get) need "$@"; _call GET "/environments/$1" | jq . ;;
  create) need "$@"; [ -r "$1" ] || die "payload file $1 not readable"; _call POST /environments "$(cat "$1")" | jq '{id, provisioningState, stage, track, onPremStage, prSources, masterBuildPins, ttlExpiresAt}' ;;
  wait)
    need "$@"; id=$1; want=${2:-DONE}; every=${3:-60}
    while :; do
      s=$(_call GET "/environments/$id" | jq -r '"\(.provisioningState)\tretry=\(.retryCount)/\(.retryLimit)\tnext=\(.nextAttemptAt // "-")\terr=\(.lastErrorMessage // "" | .[0:160])"')
      echo "$(date '+%F %H:%M') $id $s"
      case "$s" in "$want"$'\t'*) exit 0 ;; ERROR$'\t'*|DESTROYED$'\t'*) exit 1 ;; esac
      sleep "$every"
    done ;;
  steps) need "$@"; _call GET "/environments/$1/logs/steps" | jq -r '.[] | "\(.startedAt[11:19])-\(.endedAt[11:19])\t\(.state)\t\(.source)\t\(.status)\texit=\(.exitCode // "-")\terr=\(.errorCount)\t\(.step)"' ;;
  logs) need "$@"; id=$1; q="afterId=${2:-0}&limit=${3:-500}${4:+&source=$4}${5:+&step=$5}"; _call GET "/environments/$id/logs?$q" | jq -r '.lines[] | "\(.ts[11:19]) \(.state) \(.source) \(.level) \(.line)"' ;;
  services) need "$@"; _call GET "/environments/$1/services" | jq . ;;
  health) need "$@"; _call GET "/environments/$1/tenant-health" | jq . ;;
  test-data) need "$@"; _call GET "/environments/$1/test-data" | jq . ;;
  reveal)
    need "$@"; [ $# -ge 2 ] || die "reveal <id> rdp|db|pep"
    tok=$(_call POST "/environments/$1/credentials/$2/reveal" | jq -r .token)
    _call POST "/environments/$1/credentials/$2/consume" "$(jq -nc --arg t "$tok" '{token:$t}')" ;;
  extend) need "$@"; _call POST "/environments/$1/extend" "$(jq -nc --argjson d "${2:-7}" '{days:$d}')" | jq '{id, ttlExpiresAt}' ;;
  auto-stop) need "$@"; [ $# -ge 2 ] || die "auto-stop <id> on|off"; v=false; [ "$2" = on ] && v=true; _call PUT "/environments/$1/auto-stop" "{\"enabled\":$v}" | jq '{id, autoStopEnabled}' ;;
  time-recording) need "$@"; [ $# -ge 2 ] || die "time-recording <id> LEGACY|UNIFIED"; _call PUT "/environments/$1/time-recording" "{\"mode\":\"$2\"}" | jq '{id, timeRecordingMode}' ;;
  refresh-ip) need "$@"; id=$1; shift; body=$(jq -nc --args '{additionalCidrs: $ARGS.positional, replaceExisting: true}' "$@"); _call POST "/environments/$id/refresh-ip" "$body" | jq '{id, provisioningState, ipAllowlist}' ;;
  ssh-keys) need "$@"; id=$1; shift; [ $# -ge 1 ] || die "ssh-keys <id> <pubkey-file> [...]"; body=$(cat "$@" | jq -Rsc '{sshPublicKeys: (split("\n") | map(select(length>0)))}'); _call PUT "/environments/$id/ssh-keys" "$body" | jq '{id, provisioningState, sshPublicKeys}' ;;
  retry) need "$@"; _call POST "/environments/$1/retry" | jq '{id, provisioningState, lastFailedState}' ;;
  reseed) need "$@"; _call POST "/environments/$1/reseed" "${2:+$(cat "$2")}" | jq '{id, provisioningState}' ;;
  start|stop|restart) need "$@"; _call POST "/environments/$1/$cmd" | jq '{id, instanceState, provisioningState}' ;;
  share) need "$@"; [ $# -ge 2 ] || die "share <id> <viewerSub> [VIEWER|OPERATOR]"; _call POST "/environments/$1/viewers" "$(jq -nc --arg s "$2" --arg l "${3:-VIEWER}" '{viewerSub:$s, level:$l}')" | jq . ;;
  viewers) need "$@"; _call GET "/environments/$1/viewers" | jq . ;;
  unshare) need "$@"; [ $# -ge 2 ] || die "unshare <id> <viewerSub>"; _call DELETE "/environments/$1/viewers/$2" ;;
  destroy) need "$@"; _call DELETE "/environments/$1" | jq '{id, provisioningState, cancelRequested}' ;;
  raw) need "$@"; [ $# -ge 2 ] || die "raw <METHOD> <path> [json]"; _call "$1" "$2" "${3:-}" ;;
  *) sed -n '2,27p' "$0"; exit 2 ;;
esac
