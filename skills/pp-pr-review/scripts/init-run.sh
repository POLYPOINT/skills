#!/usr/bin/env bash
#
# Initialise a PR review run. Creates a clean ./.pr-review working directory,
# removing any artifacts (including a stale approval marker) from a prior run,
# so findings and approvals never leak between reviews.

set -euo pipefail

WORKDIR="./.pr-review"

if [ -d "$WORKDIR" ]; then
  rm -rf "$WORKDIR"
fi
mkdir -p "$WORKDIR"

{
  echo "run_started=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "cwd=$(pwd)"
  echo "git_dir=$(git rev-parse --show-toplevel 2>/dev/null || echo 'not-a-git-repo')"
} > "$WORKDIR/run.meta"

# Make sure the review working dir is ignored by git so it never gets committed.
if [ -d ".git" ] || git rev-parse --git-dir >/dev/null 2>&1; then
  if ! git check-ignore -q "$WORKDIR" 2>/dev/null; then
    if [ -f ".git/info/exclude" ]; then
      grep -qxF ".pr-review/" .git/info/exclude 2>/dev/null \
        || echo ".pr-review/" >> .git/info/exclude
    fi
  fi
fi

echo "Initialised clean $WORKDIR for this review run."
