#!/usr/bin/env bash
#
# Pre-flight consistency guard.
#
# resolve-pr.sh has already turned the PR URL into coordinates + branches in
# run.meta. This script confirms the current directory is a checkout of the SAME
# repository the PR belongs to, so we can never review the wrong code or post to
# the wrong PR. It compares the local `origin` remote's repo against the repo from
# the PR URL and HARD-STOPS on a mismatch, then confirms the PR's source/target
# branches are resolvable locally or on origin.
#
# Usage: verify-repo.sh   (no args — reads ./.pr-review/run.meta)
#
# Optional override (rarely needed — e.g. a fork whose origin isn't the PR's repo):
# AZDO_ALLOW_REPO_MISMATCH=1 downgrades the hard stop to a warning.

set -euo pipefail

WORKDIR="./.pr-review"
META="$WORKDIR/run.meta"

err()  { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARNING: $*" >&2; }
ok()   { echo "  ok: $*"; }
lc()   { printf '%s' "$1" | tr 'A-Z' 'a-z'; }
meta() { sed -n "s/^$1=//p" "$META" 2>/dev/null | head -n1; }

[ -f "$META" ] || err "no run.meta found. Run resolve-pr.sh <pr-url> first."

PR_REPO="$(meta azdo_repo)"
FEATURE="$(meta feature_branch)"
TARGET="$(meta target_branch)"
[ -n "$PR_REPO" ] && [ -n "$FEATURE" ] && [ -n "$TARGET" ] \
  || err "run.meta is missing PR coordinates/branches. Re-run resolve-pr.sh <pr-url>."

# 1. Must be inside a git work tree.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || err "this directory is not inside a git repository. Run /pp-pr-review from a clone of the PR's repository."
REPO_ROOT="$(git rev-parse --show-toplevel)"
ok "inside git repo: $REPO_ROOT"

# 2. Derive the local origin's repo and compare it to the PR's repo.
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
[ -n "$ORIGIN_URL" ] \
  || err "no 'origin' remote configured. Run /pp-pr-review from a clone of the PR's repository."
ok "origin remote: $ORIGIN_URL"

# Pull the repo name out of an Azure DevOps remote URL, sans .git. Handles both the
# https form (.../_git/{repo}) and the ssh form (git@ssh.dev.azure.com:v3/{org}/
# {project}/{repo}, which has no _git/ segment — the repo is the last path part).
origin_repo() {
  local url="${1%.git}" lower
  lower="$(lc "$url")"
  case "$lower" in
    *dev.azure.com*|*visualstudio.com*)
      case "$url" in
        *_git/*) url="${url#*_git/}"; printf '%s' "${url%%/*}" ;;
        *)       printf '%s' "${url##*/}" ;;
      esac
      ;;
    *) return 1 ;;
  esac
}

if LOCAL_REPO="$(origin_repo "$ORIGIN_URL")" && [ -n "$LOCAL_REPO" ]; then
  if [ "$(lc "$LOCAL_REPO")" = "$(lc "$PR_REPO")" ]; then
    ok "checkout matches the PR repo: $PR_REPO"
  else
    MSG="this checkout's origin repo ('$LOCAL_REPO') does not match the PR's repo ('$PR_REPO'). You are likely in the wrong repository — re-run from a clone of '$PR_REPO'."
    if [ "${AZDO_ALLOW_REPO_MISMATCH:-}" = "1" ]; then
      warn "$MSG (continuing because AZDO_ALLOW_REPO_MISMATCH=1)"
    else
      err "$MSG"
    fi
  fi
else
  warn "origin is not a recognized Azure DevOps remote; cannot confirm it matches the PR repo '$PR_REPO'. Proceeding, but make sure this is the right checkout."
fi

# 3. The PR's source and target branches must be resolvable (locally or on origin).
branch_exists() {
  local b="$1"
  git rev-parse --verify --quiet "$b" >/dev/null 2>&1 && return 0
  git rev-parse --verify --quiet "origin/$b" >/dev/null 2>&1 && return 0
  git ls-remote --exit-code --heads origin "$b" >/dev/null 2>&1 && return 0
  return 1
}
branch_exists "$FEATURE" \
  || err "the PR's source branch '$FEATURE' was not found locally or on origin. Fetch it, or confirm you are in the right repository."
ok "feature branch resolvable: $FEATURE"
branch_exists "$TARGET" \
  || err "the PR's target branch '$TARGET' was not found locally or on origin."
ok "target branch resolvable: $TARGET"

echo "Repository verification passed; this checkout matches PR #$(meta azdo_pr_id)'s repo."
