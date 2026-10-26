#!/usr/bin/env bash
# pe-ready.sh <tenant-id> — bring the shared PEP session into the "ready" state of the PEP state contract
# (assets/agent-brief.md): pep-driver agent answering, PEP main window up, "Session abgelaufen" acknowledged and the Keycloak
# re-login done, first-run "Optionen" dialog confirmed, team plan sheet open. The password is read from
# $DM_CONFIG_DIR/<tenant-id>.test-data.json (manifest.loginPassword), typed with `type`, never printed.
# Prints one state line per action and finally READY / NOT READY.
#
# Warm path (workers and orchestrator):
#   - taskbar click (PE_TASKBAR_X/Y) ONLY when PEP runs (a TApplication window naming PEP is listed) but TfrmPEPMain is not:
#     with PEP down the taskbar button is the pinned launcher and starts a second PEP (run a1801, gap 3);
#   - TECMessageForm (session expiry) -> OK; TfrmKeycloakLogin inside PEP -> password re-login, submitted once (exit 3 if it stays);
#   - TPEPOptions ("Optionen", first login of a box) -> OK; team plan sheet opened when none is open.
# Cold path (PE_COLD_START=1 PE_USER=<seed planner login>, orchestrator only; without it: exit 4, nothing is started):
#   1. agent: `pep.sh windows` failing with "no agent token" = pep-driver never deployed on this box -> `pep.sh <id> deploy`
#      once (~3 min, first time per box; PE_DEPLOY=0 -> exit 4 "DEPLOY NEEDED" instead), then `agent-start`.
#   2. login windows are counted first: more than one TfrmKeycloakLogin = a duplicate PEP instance -> exit 5. pepwin is
#      launched ONCE (PE_PEPWIN) only when there is no TfrmPEPMain, no login window and no PEP TApplication.
#   3. poll up to PE_LOGIN_POLL s (90) for TfrmPEPMain (already logged in) or the IDM form `window*="Anmeldung"` with its
#      username field rendered; submit the form ONCE; wait up to PE_MAIN_WAIT s (60) for TfrmPEPMain; form still there -> exit 3.
#   4. continue with the warm path.
# Exit codes: 0 (last line READY or NOT READY), 2 usage, 3 login failed (never retry: IDM / PolyID brute-force lock without
#   expiry), 4 cold start or deploy needed (or it failed), 5 more than one PEP login window (close one, rerun).
# Coordinates (PEP 1920x1080, scripts/seed/README.md § PEP coordinates) — verify with a screenshot first, override via env:
#   PE_TASKBAR_X/Y  PEP button in the Windows taskbar        default 1160,1056 (first run)
#   PE_NODE_X/Y     team node row in TfrmKnotenwahlSperr      default 934,420  (first run: "Pflege Chirurgie")
# Hold the PEP lock (<results root>/.locks/pep-<tenant-id>.lock — the parent of results/<run>) while running this.
# Cold path rewritten from the run-a1801 login helper; unverified end to end on a fresh box.
set -u
[ $# -eq 1 ] || { echo "usage: pe-ready.sh <tenant-id>" >&2; exit 2; }
T=$1
here=$(cd "$(dirname "$0")/.." && pwd)
P="$here/pep.sh $T"
DM_DIR=${DM_CONFIG_DIR:-$HOME/.config/deploymate}
IDM='window*="Anmeldung"'
COLD=${PE_COLD_START:-0}

wins() { $P windows 2>&1; }
count() { wins | grep -c "$1"; }
pep_app() { wins | grep -Eq 'TApplication .*PEP'; }
stop() { echo "$1"; echo "NOT READY"; exit "${2:-4}"; }
need_cold() {
  [ "$COLD" = 1 ] || stop "COLD START NEEDED ($1): orchestrator runs PE_COLD_START=1 PE_USER=<login> pe-ready.sh $T"
  [ -n "${PE_USER:-}" ] || stop "PE_COLD_START=1 needs PE_USER=<seed planner login>"
}
password() { jq -r '.manifest.loginPassword' "$DM_DIR/$T.test-data.json"; }

# 1. pep-driver agent
out=$(wins); rc=$?
if [ "$rc" -ne 0 ]; then
  if printf '%s' "$out" | grep -q 'no agent token'; then
    need_cold "pep-driver agent never deployed on this box (no agent token)"
    [ "${PE_DEPLOY:-1}" = 1 ] || stop "DEPLOY NEEDED: run '$here/pep.sh $T deploy' once (first time per box), then rerun"
    echo "pep-driver deploy (first time on this box, ~3 min)"
    $P deploy >/dev/null 2>&1 || stop "DEPLOY NEEDED: '$here/pep.sh $T deploy' failed - run it by hand and read its output"
    echo "deploy done"
  else
    need_cold "pep-driver agent not answering"
  fi
  $P agent-start >/dev/null 2>&1; sleep 10; echo "agent-start done"
  wins >/dev/null || stop "agent still not answering after agent-start"
fi

# 2. PEP main window: restore a minimised PEP only when PEP runs
main=$(count TfrmPEPMain); login=$(count TfrmKeycloakLogin)
if [ "$main" -eq 0 ] && [ "$login" -eq 0 ] && pep_app; then
  $P clickxy "${PE_TASKBAR_X:-1160}" "${PE_TASKBAR_Y:-1056}" >/dev/null 2>&1; sleep 3; echo "restored main window (taskbar)"
  main=$(count TfrmPEPMain); login=$(count TfrmKeycloakLogin)
fi

# 3. cold start: launch once, IDM login once
if [ "$main" -eq 0 ]; then
  need_cold "no PEP main window"
  [ "$login" -gt 1 ] && stop "STOP: $login PEP login windows (duplicate PEP instance): close one ($P click '$IDM[1] > button=\"Close\"'), then rerun" 5
  if [ "$login" -eq 0 ]; then
    if pep_app; then
      echo "PEP process present without main or login window: waiting for its login form"
    else
      exe=${PE_PEPWIN:-'D:\POLYPOINT\pepwin.exe'}
      $P exec "$exe" --cwd "${exe%\\*}" >/dev/null 2>&1; echo "PEP launched"
    fi
  fi
  submitted=0; i=0; polls=$(( ${PE_LOGIN_POLL:-90} / 3 ))
  while [ "$i" -lt "$polls" ]; do
    main=$(count TfrmPEPMain); login=$(count TfrmKeycloakLogin)
    [ "$main" -ge 1 ] && { echo "PEP main window up"; break; }
    [ "$login" -gt 1 ] && stop "STOP: $login PEP login windows (duplicate PEP instance): close one, then rerun" 5
    if [ "$login" -eq 1 ] && $P exists "$IDM >> edit auto=username" 2>/dev/null | grep -q true; then
      sleep 2
      $P type "$IDM >> edit auto=username" "$PE_USER" >/dev/null 2>&1; sleep 1
      PW=$(password); $P type "$IDM >> edit auto=password" "$PW" >/dev/null 2>&1; unset PW; sleep 1
      $P click "$IDM >> button auto=kc-login" >/dev/null 2>&1; submitted=1; echo "IDM form submitted"
      break
    fi
    sleep 3; i=$((i + 1))
  done
  if [ "$submitted" = 1 ]; then
    i=0; polls=$(( ${PE_MAIN_WAIT:-60} / 3 ))
    while [ "$i" -lt "$polls" ]; do
      [ "$(count TfrmPEPMain)" -ge 1 ] && break
      sleep 3; i=$((i + 1))
    done
    if [ "$(count TfrmPEPMain)" -eq 0 ]; then
      $P exists "$IDM >> edit auto=username" 2>/dev/null | grep -q true && stop "IDM LOGIN FAILED - stop (no retry, IDM lockout risk)" 3
      stop "no PEP main window after the IDM login"
    fi
    echo "IDM login done"
  fi
  [ "$(count TfrmPEPMain)" -ge 1 ] || stop "no PEP main window after ${PE_LOGIN_POLL:-90} s (login form never rendered)"
  sleep 3
fi

# 4. warm path
if $P dialogs 2>/dev/null | grep -q TPEPOptions; then
  $P click 'class=TfrmPEPMain > class=TPEPOptions >> button="OK"' >/dev/null 2>&1; sleep 2; echo "Optionen (first run) confirmed"
fi
if $P dialogs 2>/dev/null | grep -q TECMessageForm; then
  $P click 'class=TfrmPEPMain > class=TECMessageForm > button="OK"' >/dev/null 2>&1; sleep 5; echo "message acknowledged (session expiry?)"
fi
if $P dialogs 2>/dev/null | grep -q TfrmKeycloakLogin; then
  KL='class=TfrmPEPMain > class=TfrmKeycloakLogin'
  sleep 4; $P click "$KL >> edit auto=password" >/dev/null 2>&1; sleep 1
  PW=$(password); $P type "$KL >> edit auto=password" "$PW" >/dev/null 2>&1; unset PW
  sleep 1; $P click "$KL >> button auto=kc-login" >/dev/null 2>&1; sleep 8
  if $P dialogs 2>/dev/null | grep -q TfrmKeycloakLogin; then echo "RELOGIN FAILED - stop (no retry, IDM lockout risk)"; exit 3; fi
  echo "relogged"
fi
# the month grid TfrmPlbMonth exists only while a plan sheet is open
if ! $P exists 'class=TfrmPEPMain >> class=TfrmPlbMonth' 2>/dev/null | grep -q true; then
  $P menupath Datei "Planblatt bearbeiten" >/dev/null 2>&1; sleep 3
  $P clickxy "${PE_NODE_X:-934}" "${PE_NODE_Y:-420}" >/dev/null 2>&1; sleep 1
  $P click 'class=TfrmPEPMain > class=TfrmKnotenwahlSperr >> button="Weiter"' >/dev/null 2>&1; sleep 7
  echo "plan sheet opened (check the screenshot shows the team)"
fi
$P dialogs 2>/dev/null | grep -E '"(class|title)"' | paste - -
$P exists 'class=TfrmPEPMain >> class=TfrmPlbMonth' 2>/dev/null | grep -q true && echo "READY" || echo "NOT READY"
