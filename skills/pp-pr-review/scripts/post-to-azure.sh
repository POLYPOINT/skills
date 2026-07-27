#!/usr/bin/env bash
#
# Posts the drafted review comments to an Azure DevOps pull request as threads.
# This script is GUARDED: the PreToolUse hook (guard-post.sh) blocks it unless
# ./.pr-review/.post-approved exists, which is written only by approve-post.sh
# after the developer's explicit "yes". This script also consumes that marker
# itself before posting, preserving one-shot approval outside a hook runtime.
#
# Usage: post-to-azure.sh [feature-branch]
#
# Coordinates and the PR id are normally read from ./.pr-review/run.meta (written
# by resolve-pr.sh from the PR URL). The environment variables below override
# those values and are the fallback when running outside the orchestrated flow.
#
# Optional environment (set in your shell or a local .env you source; never commit):
#   AZDO_ORG_URL   e.g. https://dev.azure.com/yourorg
#   AZDO_PROJECT   project name or id
#   AZDO_REPO      repository name or id
#   AZDO_PR_ID     PR id; if unset, taken from run.meta, else resolved from branch
#   AZDO_PAT       a personal access token with "Code (read & write)" scope

set -euo pipefail

WORKDIR="./.pr-review"
DRAFT="$WORKDIR/pr-comments.md"
API_VERSION="7.1"

err() { echo "ERROR: $*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || err "curl is required."
command -v jq   >/dev/null 2>&1 || err "jq is required to build and parse API payloads."

# SECURITY: the Azure DevOps token is a secret. This script uses it ONLY to build
# the HTTP Authorization header below. It is NEVER printed, never written to disk,
# and must never be surfaced to the calling agent. Do not add `set -x` here, do
# not `echo` $PAT/$AUTH, and never run this script through a tracer.

[ -f "$DRAFT" ] || err "no draft comments at $DRAFT."

APPROVAL_MARKER="$WORKDIR/.post-approved"
[ -f "$APPROVAL_MARKER" ] || err "posting has not been approved for this run."
rm -f "$APPROVAL_MARKER"

# Resolve org / project / repo: explicit env override > values derived by
# verify-repo.sh (recorded in run.meta) > error. No per-repo config needed.
meta() { sed -n "s/^$1=//p" "$WORKDIR/run.meta" 2>/dev/null | head -n1; }
FEATURE="${1:-$(meta feature_branch)}"
ORG_URL="${AZDO_ORG_URL:-$(meta azdo_org_url)}"
PROJECT="${AZDO_PROJECT:-$(meta azdo_project)}"
REPO="${AZDO_REPO:-$(meta azdo_repo)}"
HOST="${AZDO_HOST:-$(meta azdo_host)}"; HOST="${HOST:-dev.azure.com}"
[ -n "$ORG_URL" ] || err "could not resolve the Azure DevOps org URL. Run via /pp-pr-review (verify-repo derives it from the git remote), or set AZDO_ORG_URL."
[ -n "$PROJECT" ] || err "could not resolve the Azure DevOps project. Run via /pp-pr-review, or set AZDO_PROJECT."
[ -n "$REPO" ]    || err "could not resolve the Azure DevOps repo. Run via /pp-pr-review, or set AZDO_REPO."
ORG_URL="${ORG_URL%/}"

# Resolve the token WITHOUT it ever leaving this script:
#   1) AZDO_PAT env var, if the developer chose to export one; else
#   2) git's credential helper for the host (reuses the credential git already
#      uses to clone/fetch — nothing to configure separately).
# The value is read into $PAT and consumed only by the Authorization header.
PAT="${AZDO_PAT:-}"
if [ -z "$PAT" ]; then
  PAT="$(printf 'protocol=https\nhost=%s\n\n' "$HOST" \
        | git credential fill 2>/dev/null \
        | sed -n 's/^password=//p' | head -n1)"
fi
[ -n "$PAT" ] || err "no Azure DevOps token available. Either configure git credentials for https://$HOST (e.g. Git Credential Manager) so the token can be reused, or export AZDO_PAT. The token is used only to call Azure and is never shown."

AUTH="Authorization: Basic $(printf ':%s' "$PAT" | base64 | tr -d '\n')"
unset PAT   # header is built; drop the plaintext token from the environment
BASE="$ORG_URL/$PROJECT/_apis/git/repositories/$REPO"

# Absolute repo root recorded at init, used to turn the IntelliJ-clickable
# absolute paths in the draft back into the repo-relative paths Azure expects.
REPO_ROOT="$(sed -n 's/^git_dir=//p' "$WORKDIR/run.meta" 2>/dev/null | head -n1)"

# PR id: explicit env override > value recorded by resolve-pr.sh > resolve from branch.
PR_ID="${AZDO_PR_ID:-$(meta azdo_pr_id)}"
if [ -z "$PR_ID" ]; then
  [ -n "$FEATURE" ] || err "no AZDO_PR_ID, none in run.meta, and no feature branch given to resolve it."
  echo "Resolving PR id for branch '$FEATURE'..."
  PR_LIST="$(curl -sf -H "$AUTH" \
    "$BASE/pullrequests?searchCriteria.sourceRefName=refs/heads/$FEATURE&searchCriteria.status=active&api-version=$API_VERSION")" \
    || err "failed to query pull requests."
  PR_ID="$(printf '%s' "$PR_LIST" | jq -r '.value[0].pullRequestId // empty')"
  [ -n "$PR_ID" ] || err "no active PR found for source branch '$FEATURE'."
fi
echo "Target PR: #$PR_ID"

THREADS_URL="$BASE/pullRequests/$PR_ID/threads?api-version=$API_VERSION"

# post_thread <content> [filePath] [line]
post_thread() {
  local content="$1" file="${2:-}" line="${3:-}"
  local payload
  if [ -n "$file" ] && [ -n "$line" ]; then
    payload="$(jq -n --arg c "$content" --arg f "$file" --argjson ln "$line" '{
      comments: [ { parentCommentId: 0, content: $c, commentType: 1 } ],
      status: 1,
      threadContext: {
        filePath: $f,
        rightFileStart: { line: $ln, offset: 1 },
        rightFileEnd:   { line: $ln, offset: 1 }
      }
    }')"
  else
    payload="$(jq -n --arg c "$content" '{
      comments: [ { parentCommentId: 0, content: $c, commentType: 1 } ],
      status: 1
    }')"
  fi

  local resp
  resp="$(curl -sf -X POST -H "$AUTH" -H "Content-Type: application/json" \
    -d "$payload" "$THREADS_URL")" || { echo "  FAILED to post a thread." >&2; return 1; }
  local tid
  tid="$(printf '%s' "$resp" | jq -r '.id // "?"')"
  echo "  posted thread $tid"
}

# Parse the draft. The draft format (produced by the draft-pr-comments skill):
#   ## Summary comment
#   <body...>
#   ## Inline / threaded comments
#   ### <file>:<line> — <title>
#   <body...>
#
# We split on headings with awk into per-section temp files, then post each.
PARSED_DIR="$WORKDIR/parsed"
rm -rf "$PARSED_DIR"; mkdir -p "$PARSED_DIR"

awk -v dir="$PARSED_DIR" '
  function flush() {
    if (section != "") { close(out) }
  }
  /^## Summary comment[[:space:]]*$/ {
    flush(); section="summary"; idx=0; out=dir"/summary.txt"; printf "" > out; next
  }
  /^## Inline \/ threaded comments[[:space:]]*$/ {
    flush(); section="inline-header"; next
  }
  /^### / {
    flush(); idx++; section="inline";
    hdr=$0; sub(/^### /,"",hdr);
    out=dir"/inline_" idx ".txt";
    print hdr > (dir"/inline_" idx ".hdr");
    printf "" > out; next
  }
  {
    if (section=="summary" || section=="inline") { print $0 >> out }
  }
' "$DRAFT"

POSTED=0; FAILED=0

if [ -s "$PARSED_DIR/summary.txt" ]; then
  echo "Posting summary comment..."
  if post_thread "$(cat "$PARSED_DIR/summary.txt")"; then POSTED=$((POSTED+1)); else FAILED=$((FAILED+1)); fi
fi

for hdrfile in "$PARSED_DIR"/inline_*.hdr; do
  [ -e "$hdrfile" ] || continue
  bodyfile="${hdrfile%.hdr}.txt"
  hdr="$(cat "$hdrfile")"
  # Header looks like:  path/to/file.ext:42 — Short title
  # Extract file and line if present (best-effort; falls back to a plain thread).
  loc="${hdr%% —*}"; loc="${loc%% -*}"
  title="${hdr#*— }"; [ "$title" = "$hdr" ] && title="${hdr#*- }"
  file=""; line=""
  if printf '%s' "$loc" | grep -Eq ':[0-9]+$'; then
    file="${loc%:*}"; line="${loc##*:}"
    # Drafts use IntelliJ-clickable absolute paths; strip the repo root so Azure
    # gets a repo-relative path.
    if [ -n "$REPO_ROOT" ] && [ "$REPO_ROOT" != "not-a-git-repo" ]; then
      case "$file" in "$REPO_ROOT"/*) file="${file#"$REPO_ROOT"}";; esac
    fi
    # Azure expects a leading slash on the repo-relative path.
    case "$file" in /*) ;; *) file="/$file";; esac
  fi
  body="**${title}**

$(cat "$bodyfile")"
  echo "Posting inline comment: $loc"
  if post_thread "$body" "$file" "$line"; then POSTED=$((POSTED+1)); else FAILED=$((FAILED+1)); fi
done

echo "Done. Posted $POSTED thread(s); $FAILED failure(s)."
[ "$FAILED" -eq 0 ] || exit 1
