#!/usr/bin/env bash
#
# Tear down the PR review working directory once the review is complete.
# Removes ./.pr-review so findings, drafts, and the approval marker never
# leak between reviews. Safe to run when the directory is already gone.

set -euo pipefail

WORKDIR="./.pr-review"

if [ -d "$WORKDIR" ]; then
  rm -rf "$WORKDIR"
  echo "Removed $WORKDIR — review run cleaned up."
else
  echo "$WORKDIR not present — nothing to clean up."
fi
