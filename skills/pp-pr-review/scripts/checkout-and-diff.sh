#!/usr/bin/env bash
#
# Deterministic setup step. Checks out the feature branch and computes the diff
# against the target branch, writing artifacts the review skills consume.
#
# Usage: checkout-and-diff.sh [feature-branch] [target-branch]
#
# Branches default to the values resolve-pr.sh recorded in ./.pr-review/run.meta
# (feature_branch / target_branch); explicit args override them.

set -euo pipefail

WORKDIR="./.pr-review"
mkdir -p "$WORKDIR"

meta() { sed -n "s/^$1=//p" "$WORKDIR/run.meta" 2>/dev/null | head -n1; }
FEATURE="${1:-$(meta feature_branch)}"
TARGET="${2:-$(meta target_branch)}"

if [ -z "$FEATURE" ] || [ -z "$TARGET" ]; then
  echo "ERROR: no branches given and none in run.meta. Run resolve-pr.sh <pr-url> first, or pass: checkout-and-diff.sh <feature-branch> <target-branch>" >&2
  exit 1
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: not inside a git repository." >&2
  exit 1
fi

# Refuse to run on a dirty tree so we never disturb uncommitted work.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: working tree has uncommitted changes. Commit or stash before review." >&2
  exit 1
fi

echo "Fetching latest refs..."
git fetch --quiet --all --prune || {
  echo "WARNING: git fetch failed; proceeding with local refs." >&2
}

# Resolve the target ref: prefer origin/<target>, fall back to local.
if git rev-parse --verify --quiet "origin/$TARGET" >/dev/null; then
  TARGET_REF="origin/$TARGET"
elif git rev-parse --verify --quiet "$TARGET" >/dev/null; then
  TARGET_REF="$TARGET"
else
  echo "ERROR: target branch '$TARGET' not found locally or on origin." >&2
  exit 1
fi

# Check out the feature branch.
if git rev-parse --verify --quiet "$FEATURE" >/dev/null; then
  git checkout --quiet "$FEATURE"
elif git rev-parse --verify --quiet "origin/$FEATURE" >/dev/null; then
  git checkout --quiet -b "$FEATURE" "origin/$FEATURE"
else
  echo "ERROR: feature branch '$FEATURE' not found locally or on origin." >&2
  exit 1
fi

# Use the merge-base so the diff reflects only what the feature branch added,
# not changes that landed on target in the meantime.
MERGE_BASE="$(git merge-base "$TARGET_REF" HEAD)"

git diff "$MERGE_BASE"...HEAD > "$WORKDIR/diff.patch"
git diff --stat "$MERGE_BASE"...HEAD > "$WORKDIR/diffstat.txt"

# Changed-files list as JSON (no jq dependency).
{
  echo "["
  git diff --name-only "$MERGE_BASE"...HEAD | awk '
    NR>1 { printf ",\n" }
    { gsub(/\\/,"\\\\"); gsub(/"/,"\\\""); printf "  \"%s\"", $0 }
    END { if (NR>0) printf "\n" }'
  echo "]"
} > "$WORKDIR/files.json"

CHANGED_COUNT="$(git diff --name-only "$MERGE_BASE"...HEAD | wc -l | tr -d ' ')"

{
  echo "feature_branch=$FEATURE"
  echo "target_ref=$TARGET_REF"
  echo "merge_base=$MERGE_BASE"
  echo "head=$(git rev-parse HEAD)"
  echo "changed_files=$CHANGED_COUNT"
} >> "$WORKDIR/run.meta"

if [ "$CHANGED_COUNT" -eq 0 ]; then
  echo "NO CHANGES: '$FEATURE' has no diff against '$TARGET'. Nothing to review."
  exit 0
fi

echo "Setup complete: $CHANGED_COUNT file(s) changed."
echo "  diff:     $WORKDIR/diff.patch"
echo "  files:    $WORKDIR/files.json"
echo "  diffstat: $WORKDIR/diffstat.txt"
