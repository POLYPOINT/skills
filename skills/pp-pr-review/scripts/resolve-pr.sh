#!/usr/bin/env bash
#
# Resolves an Azure DevOps pull request from its web URL into the coordinates and
# branches the rest of the review run needs. This replaces the old "pass the
# feature/target branches and JIRA id by hand" flow: a single PR URL carries the
# org / project / repo / PR id, and the PR's own metadata gives us the source and
# target branches plus the title/description we scan for a JIRA ticket.
#
# Usage: resolve-pr.sh <pr-url>
#
# The PR URL looks like one of:
#   https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
#   https://{org}@dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
#   https://{org}.visualstudio.com/{project}/_git/{repo}/pullrequest/{id}   (legacy)
# (a trailing ?_a=... query or extra path segments are tolerated.)
#
# Writes to ./.pr-review/run.meta: azdo_org_url, azdo_project, azdo_repo,
# azdo_host, azdo_pr_id, feature_branch, target_branch, jira_candidates.
# Prints the non-secret PR summary (title, branches, detected JIRA ids) so the
# orchestrator can confirm the ticket with the developer.
#
# SECURITY: the Azure DevOps token is read the same way post-to-azure.sh reads it
# (AZDO_PAT, else git's credential helper) and is used ONLY to build the HTTP
# Authorization header. It is never printed, never written to disk, and must never
# be surfaced to the calling agent. Do not add `set -x` here or echo the token.

set -euo pipefail

WORKDIR="./.pr-review"
mkdir -p "$WORKDIR"
URL="${1:-}"
API_VERSION="7.1"

err() { echo "ERROR: $*" >&2; exit 1; }
lc()  { printf '%s' "$1" | tr 'A-Z' 'a-z'; }

[ -n "$URL" ] || err "usage: resolve-pr.sh <pr-url>"
command -v curl >/dev/null 2>&1 || err "curl is required."
command -v jq   >/dev/null 2>&1 || err "jq is required to parse the PR metadata."

# Strip a query string / fragment so the path parses cleanly.
CLEAN="${URL%%\?*}"; CLEAN="${CLEAN%%#*}"; CLEAN="${CLEAN%/}"

# Parse the PR URL into: ORG_URL <tab> PROJECT <tab> REPO <tab> PR_ID <tab> HOST.
# Path segments are kept exactly as they appear (URL-encoded), which is what the
# Azure REST API expects in the path, matching how post-to-azure.sh uses them.
parse_pr_url() {
  local url="$1" lower path org proj repo prid host rest
  lower="$(lc "$url")"
  case "$lower" in
    *dev.azure.com*)
      path="${url#*dev.azure.com/}"                 # org/proj/_git/repo/pullrequest/id
      org="${path%%/*}";  path="${path#*/}"
      proj="${path%%/*}"; path="${path#*/}"
      path="${path#_git/}"
      repo="${path%%/*}"; rest="${path#*/}"          # pullrequest/id...
      ;;
    *visualstudio.com*)
      host="${url#*://}"; host="${host%%/*}"; host="${host#*@}"
      org="${host%.visualstudio.com}"
      path="${url#*visualstudio.com/}"               # proj/_git/repo/pullrequest/id
      proj="${path%%/*}"; path="${path#*/}"
      path="${path#_git/}"
      repo="${path%%/*}"; rest="${path#*/}"
      ;;
    *) return 1 ;;
  esac
  # rest is 'pullrequest/<id>[/...]' (the web UI uses the singular spelling).
  rest="${rest#pullrequest/}"; rest="${rest#pullRequest/}"
  prid="${rest%%/*}"
  case "$lower" in
    *dev.azure.com*) host="dev.azure.com" ;;
  esac
  printf '%s' "$prid" | grep -Eq '^[0-9]+$' || return 1
  [ -n "$org" ] && [ -n "$proj" ] && [ -n "$repo" ] || return 1
  if [ "$host" = "dev.azure.com" ]; then
    printf '%s\t%s\t%s\t%s\t%s\n' "https://dev.azure.com/$org" "$proj" "$repo" "$prid" "$host"
  else
    printf '%s\t%s\t%s\t%s\t%s\n' "https://$host" "$proj" "$repo" "$prid" "$host"
  fi
}

PARSED="$(parse_pr_url "$CLEAN")" \
  || err "could not parse '$URL' as an Azure DevOps pull request URL. Expected something like https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}."
ORG_URL="$(printf '%s' "$PARSED" | cut -f1)"
PROJECT="$(printf '%s'  "$PARSED" | cut -f2)"
REPO="$(printf '%s'     "$PARSED" | cut -f3)"
PR_ID="$(printf '%s'    "$PARSED" | cut -f4)"
HOST="$(printf '%s'     "$PARSED" | cut -f5)"

# Resolve the token without it ever leaving this script (AZDO_PAT, else git's
# credential helper for the host — same approach as post-to-azure.sh).
PAT="${AZDO_PAT:-}"
if [ -z "$PAT" ]; then
  PAT="$(printf 'protocol=https\nhost=%s\n\n' "$HOST" \
        | git credential fill 2>/dev/null \
        | sed -n 's/^password=//p' | head -n1)"
fi
[ -n "$PAT" ] || err "no Azure DevOps token available to read the PR. Configure git credentials for https://$HOST (e.g. Git Credential Manager) or export AZDO_PAT. The token is used only to call Azure and is never shown."
AUTH="Authorization: Basic $(printf ':%s' "$PAT" | base64 | tr -d '\n')"
unset PAT

PR_API="$ORG_URL/$PROJECT/_apis/git/repositories/$REPO/pullrequests/$PR_ID?api-version=$API_VERSION"
PR_JSON="$(curl -sf -H "$AUTH" "$PR_API")" \
  || err "could not fetch PR #$PR_ID from $ORG_URL/$PROJECT (repo '$REPO'). Check the URL, that the PR exists, and that your token has 'Code (read)' scope."

TITLE="$(printf '%s' "$PR_JSON"  | jq -r '.title // ""')"
DESC="$(printf '%s' "$PR_JSON"   | jq -r '.description // ""')"
SRC="$(printf '%s' "$PR_JSON"    | jq -r '.sourceRefName // ""')"
TGT="$(printf '%s' "$PR_JSON"    | jq -r '.targetRefName // ""')"
STATUS="$(printf '%s' "$PR_JSON" | jq -r '.status // ""')"

FEATURE="${SRC#refs/heads/}"
TARGET="${TGT#refs/heads/}"
[ -n "$FEATURE" ] || err "the PR response did not include a source branch; cannot continue."
[ -n "$TARGET" ]  || err "the PR response did not include a target branch; cannot continue."

# Scan title + description for JIRA-style ticket ids (e.g. PROJ-123), de-duplicated
# in first-seen order. The developer confirms which one is correct.
JIRA_CANDIDATES="$(printf '%s\n%s\n' "$TITLE" "$DESC" \
  | grep -oE '[A-Z][A-Z0-9]+-[0-9]+' \
  | awk '!seen[$0]++' \
  | paste -sd, - || true)"

{
  echo "azdo_org_url=$ORG_URL"
  echo "azdo_project=$PROJECT"
  echo "azdo_repo=$REPO"
  echo "azdo_host=$HOST"
  echo "azdo_pr_id=$PR_ID"
  echo "feature_branch=$FEATURE"
  echo "target_branch=$TARGET"
  echo "jira_candidates=$JIRA_CANDIDATES"
} >> "$WORKDIR/run.meta"

echo "Resolved PR #$PR_ID (status: ${STATUS:-unknown})"
echo "  title:   $TITLE"
echo "  source:  $FEATURE"
echo "  target:  $TARGET"
echo "  repo:    $REPO ($PROJECT @ $ORG_URL)"
if [ -n "$JIRA_CANDIDATES" ]; then
  echo "  jira candidates: $JIRA_CANDIDATES"
else
  echo "  jira candidates: (none found in title/description — ask the developer)"
fi
