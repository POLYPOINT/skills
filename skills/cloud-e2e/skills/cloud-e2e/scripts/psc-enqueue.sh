#!/usr/bin/env bash
# psc-enqueue.sh — enqueue persistence-state-change events on a DeployMate box (gate G4b) and COMMIT, through sql.sh.
# DeployMate boxes have no TIUD_*_PSC triggers and api-pp caches definitions, palettes, rights, closing dates and employments for
# up to 7 days: after every such change made in PEP or SQL, enqueue the matching events (one call = one PL/SQL block, one COMMIT).
#
#   psc-enqueue.sh [--dry-run] <env-id> shift-definition <code> [<code> ...]   ('SHIFT_DEFINITION', '<code>', null, null, null, null)
#   psc-enqueue.sh [--dry-run] <env-id> palette <node-id> [<node-id> ...]       ('SHIFT_DEFINITION_PALETTE', null, <node>, ...)
#   psc-enqueue.sh [--dry-run] <env-id> policy-of <code> [<code> ...]          one SHIFT_DEFINITION_POLICY per DIENST_DETAIL row of the codes
#   psc-enqueue.sh [--dry-run] <env-id> permission-role <role-id> [<app-id>]   ('PERMISSION_ROLE', '<role>', null, null, <app, default 2471>, null)
#   psc-enqueue.sh [--dry-run] <env-id> employment <ma-id> [<ma-id> ...]       ('EMPLOYMENT', '<id>', null, null, null, null)
#   psc-enqueue.sh [--dry-run] <env-id> period-closing | default-setting | allowance-profile | allowance-type | org-structure
#   psc-enqueue.sh [--dry-run] <env-id> keycloak-role-mapping [<role-id>]      ('POLY_USER_ROLE_KEYCLOAK_ROLE_MAPPING', '<role>'|null, ...)
#                                                                              arguments UNVERIFIED (areas/pool-sp data-plan): gate G-ROLES decides
#   psc-enqueue.sh [--dry-run] <env-id> raw <TYPE> <a2|-> [<a3|-> <a4|-> <a5|-> <a6|->]   a2 = string id or '-', a3..a6 = integer or '-'
#   psc-enqueue.sh [--dry-run] <env-id> --batch <file>                          lines "<sub-command> <args...>" (# comments), ONE block + COMMIT
#
# --dry-run prints the PL/SQL and sends nothing (offline check). Otherwise the block runs through sql.sh (SQL_TIMEOUT applies; on
# exit 124 check the effect before re-running). Verify afterwards with the read gate of the step that needed it (e.g. a unified
# /days read of an employee planned with the definition, days-check.mjs EXPECT_DEF=<code>). Ids are validated: digits only, codes too.
set -euo pipefail
die() { echo "psc-enqueue: $*" >&2; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
dry=0; [ "${1:-}" = "--dry-run" ] && { dry=1; shift; }
[ $# -ge 2 ] || { sed -n '2,24p' "$0" >&2; exit 2; }
env_id=$1; shift
LC_ALL=C; [[ "$env_id" =~ ^[a-z][a-z0-9-]{0,14}$ ]] || die "bad env id $env_id (DeployMate ids: ^[a-z][a-z0-9-]{0,14}$)"

num() { case "$1" in ''|*[!0-9]*) die "$2 must be digits: '$1'";; esac; }
call() { printf "  IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE(%s);\n" "$1"; }
q() { [ "$1" = "-" ] && echo null || { case "$1" in *[!A-Za-z0-9_.:-]*) die "id '$1' has unsupported characters";; esac; echo "'$1'"; }; }
n() { [ "$1" = "-" ] && echo null || { num "$1" "argument"; echo "$1"; }; }

emit() { # <sub-command> <args...> -> PL/SQL lines on stdout
  local c=$1; shift
  case "$c" in
    shift-definition) [ $# -ge 1 ] || die "shift-definition <code>..."; for x in "$@"; do num "$x" code; call "'SHIFT_DEFINITION', '$x', null, null, null, null"; done ;;
    palette) [ $# -ge 1 ] || die "palette <node-id>..."; for x in "$@"; do num "$x" node; call "'SHIFT_DEFINITION_PALETTE', null, $x, null, null, null"; done ;;
    policy-of) [ $# -ge 1 ] || die "policy-of <code>..."; for x in "$@"; do num "$x" code; done
      local list; list=$(IFS=,; echo "$*")
      printf "  FOR d IN (SELECT DIENST_DETAIL_ID, KNOTEN_ID FROM ECBERN.DIENST_DETAIL WHERE PA_CODE IN (%s)) LOOP\n" "$list"
      printf "    IFDBA.ENQUEUE_PERSISTENCE_STATE_CHANGE('SHIFT_DEFINITION_POLICY', d.DIENST_DETAIL_ID, d.KNOTEN_ID, null, null, null);\n  END LOOP;\n" ;;
    permission-role) [ $# -ge 1 ] || die "permission-role <role-id> [app-id]"; num "$1" role; local app=${2:-2471}; num "$app" app
      call "'PERMISSION_ROLE', '$1', null, null, $app, null" ;;
    employment) [ $# -ge 1 ] || die "employment <ma-id>..."; for x in "$@"; do num "$x" employment; call "'EMPLOYMENT', '$x', null, null, null, null"; done ;;
    period-closing) call "'PERIOD_CLOSING', null, null, null, null, null" ;;
    default-setting) call "'DEFAULT_SETTING', null, null, null, null, null" ;;
    allowance-profile) call "'ALLOWANCE_PROFILE', null, null, null, null, null" ;;
    allowance-type) call "'ALLOWANCE_TYPE', null, null, null, null, null" ;;
    org-structure) call "'ORGANIZATION_STRUCTURE', null, null, null, null, null" ;;
    keycloak-role-mapping) if [ $# -ge 1 ]; then num "$1" role; call "'POLY_USER_ROLE_KEYCLOAK_ROLE_MAPPING', '$1', null, null, null, null"; else call "'POLY_USER_ROLE_KEYCLOAK_ROLE_MAPPING', null, null, null, null, null"; fi ;;
    raw) [ $# -ge 2 ] || die "raw <TYPE> <a2> [a3..a6]"; case "$1" in *[!A-Z_]*|'') die "TYPE must be [A-Z_]: $1";; esac
      local t=$1 a2; a2=$(q "$2"); shift 2
      local rest=() i; for i in 1 2 3 4; do rest+=("$(n "${1:--}")"); [ $# -gt 0 ] && shift; done
      [ $# -eq 0 ] || die "raw takes at most 6 arguments"
      call "'$t', $a2, ${rest[0]}, ${rest[1]}, ${rest[2]}, ${rest[3]}" ;;
    *) die "unknown sub-command $c" ;;
  esac
}

body=""
if [ "$1" = "--batch" ]; then
  [ $# -eq 2 ] && [ -r "$2" ] || die "--batch needs a readable file"
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%%#*}; [ -n "${line// /}" ] || continue
    # shellcheck disable=SC2086
    body+=$(emit $line)$'\n'
  done < "$2"
else
  body=$(emit "$@")$'\n'
fi
[ -n "${body//[$'\n ']/}" ] || die "nothing to enqueue"
sql="BEGIN
${body}  COMMIT;
END;
/
PROMPT == psc-enqueue done ($env_id): verify with the step's read gate (G4b)"
if [ "$dry" = 1 ]; then printf '%s\n' "$sql"; exit 0; fi
exec "$here/sql.sh" "$env_id" "$sql"
