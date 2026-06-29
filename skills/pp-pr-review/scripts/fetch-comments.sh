#!/usr/bin/env bash
#
# Downloads all existing comments (threads) from an Azure DevOps pull request so
# the review can avoid re-raising issues a human (or another tool) already
# commented on. READ-ONLY: it never posts or modifies anything, so it is not
# behind the posting gate.
#
# Writes:
#   ./.pr-review/existing-comments.json  raw threads payload (for reference)
#   ./.pr-review/existing-comments.md    distilled, human/agent-readable list
#
# Coordinates and the PR id are read from ./.pr-review/run.meta (written by
# resolve-pr.sh). The same environment overrides as post-to-azure.sh apply.
#
# Optional environment (never commit a token):
#   AZDO_ORG_URL   e.g. https://dev.azure.com/yourorg
#   AZDO_PROJECT   project name or id
#   AZDO_REPO      repository name or id
#   AZDO_PR_ID     PR id; if unset, taken from run.meta
#   AZDO_PAT       a personal access token with "Code (read)" scope

set -euo pipefail

WORKDIR="./.pr-review"
API_VERSION="7.1"
OUT_JSON="$WORKDIR/existing-comments.json"
OUT_MD="$WORKDIR/existing-comments.md"

err() { echo "ERROR: $*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || err "curl is required."
command -v jq   >/dev/null 2>&1 || err "jq is required to parse the API payload."

[ -d "$WORKDIR" ] || err "no $WORKDIR — run /pp-pr-review (init-run.sh) first."

# SECURITY: the Azure DevOps token is a secret. This script uses it ONLY to build
# the HTTP Authorization header. It is NEVER printed or written to disk. Do not
# add `set -x` here and never run this script through a tracer.

meta() { sed -n "s/^$1=//p" "$WORKDIR/run.meta" 2>/dev/null | head -n1; }
ORG_URL="${AZDO_ORG_URL:-$(meta azdo_org_url)}"
PROJECT="${AZDO_PROJECT:-$(meta azdo_project)}"
REPO="${AZDO_REPO:-$(meta azdo_repo)}"
HOST="${AZDO_HOST:-$(meta azdo_host)}"; HOST="${HOST:-dev.azure.com}"
PR_ID="${AZDO_PR_ID:-$(meta azdo_pr_id)}"
REPO_ROOT="$(sed -n 's/^git_dir=//p' "$WORKDIR/run.meta" 2>/dev/null | head -n1)"

[ -n "$ORG_URL" ] || err "could not resolve the Azure DevOps org URL. Run via /pp-pr-review (resolve-pr derives it), or set AZDO_ORG_URL."
[ -n "$PROJECT" ] || err "could not resolve the Azure DevOps project. Run via /pp-pr-review, or set AZDO_PROJECT."
[ -n "$REPO" ]    || err "could not resolve the Azure DevOps repo. Run via /pp-pr-review, or set AZDO_REPO."
[ -n "$PR_ID" ]   || err "could not resolve the PR id. Run via /pp-pr-review, or set AZDO_PR_ID."
ORG_URL="${ORG_URL%/}"

# Resolve the token WITHOUT it ever leaving this script (same approach as
# post-to-azure.sh): AZDO_PAT, else git's credential helper for the host.
PAT="${AZDO_PAT:-}"
if [ -z "$PAT" ]; then
  PAT="$(printf 'protocol=https\nhost=%s\n\n' "$HOST" \
        | git credential fill 2>/dev/null \
        | sed -n 's/^password=//p' | head -n1)"
fi
[ -n "$PAT" ] || err "no Azure DevOps token available. Configure git credentials for https://$HOST, or export AZDO_PAT (read scope is enough). The token is used only to call Azure and is never shown."

AUTH="Authorization: Basic $(printf ':%s' "$PAT" | base64 | tr -d '\n')"
unset PAT   # header is built; drop the plaintext token from the environment
BASE="$ORG_URL/$PROJECT/_apis/git/repositories/$REPO"
THREADS_URL="$BASE/pullRequests/$PR_ID/threads?api-version=$API_VERSION"

echo "Fetching existing comments for PR #$PR_ID..."
RESP="$(curl -sf -H "$AUTH" "$THREADS_URL")" || err "failed to fetch PR threads."

printf '%s' "$RESP" > "$OUT_JSON"

# Distil into markdown: keep only real, non-deleted text comments (drop Azure's
# system threads — votes, status changes, ref updates). Anchor each thread to its
# file:line when present, made absolute against the repo root so it is
# IntelliJ-clickable, matching the rest of the review's references.
{
  echo "# Existing PR comments"
  echo
  echo "Comments already on PR #$PR_ID. Findings that merely repeat one of these"
  echo "should be dropped during analysis so the review doesn't duplicate work."
  echo
} > "$OUT_MD"

printf '%s' "$RESP" | jq -r --arg root "$REPO_ROOT" '
  def loc:
    if (.threadContext and .threadContext.filePath) then
      ( $root as $r
        | (if ($r != "" and $r != "not-a-git-repo") then $r else "" end) + .threadContext.filePath )
      + ( if (.threadContext.rightFileStart and .threadContext.rightFileStart.line)
          then ":" + (.threadContext.rightFileStart.line | tostring)
          elif (.threadContext.leftFileStart and .threadContext.leftFileStart.line)
          then ":" + (.threadContext.leftFileStart.line | tostring)
          else "" end )
    else "(general comment)" end;
  [ .value[]?
    | select(.isDeleted != true)
    | . as $t
    | ([ .comments[]?
         | select((.commentType == "text") and (.isDeleted != true))
       ]) as $cs
    | select(($cs | length) > 0)
    | { loc: ($t | loc), status: ($t.status // "unknown"), comments: $cs }
  ] as $threads
  | "Total existing comment threads: \($threads | length)\n",
    ( $threads[]
      | "## Thread \(.loc)  _(\(.status))_",
        ( .comments[]
          | "- **\(.author.displayName // "unknown")**: "
            + ((.content // "") | gsub("\r"; "") | gsub("\n"; "\n  ")) ),
        ""
    )
' >> "$OUT_MD"

COUNT="$(printf '%s' "$RESP" | jq '[ .value[]? | select(.isDeleted != true) | select([ .comments[]? | select((.commentType=="text") and (.isDeleted != true)) ] | length > 0) ] | length')"
echo "Wrote $COUNT existing comment thread(s) to $OUT_MD (raw JSON in $OUT_JSON)."
