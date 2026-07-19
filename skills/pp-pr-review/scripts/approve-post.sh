#!/usr/bin/env bash
#
# Records the developer's explicit approval to post review comments to the PR,
# by writing the marker file that the PreToolUse guard hook requires.
#
# The orchestrator runs this ONLY after the developer answers "yes" to the
# irreversible posting gate. The post script consumes (deletes) the marker
# before making network requests, so each approval is good for one attempt.

set -euo pipefail

WORKDIR="./.pr-review"

if [ ! -d "$WORKDIR" ]; then
  echo "ERROR: no active review run ($WORKDIR missing). Run the review from the start." >&2
  exit 1
fi

if [ ! -f "$WORKDIR/pr-comments.md" ]; then
  echo "ERROR: no draft comments to post ($WORKDIR/pr-comments.md missing)." >&2
  exit 1
fi

printf 'approved_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$WORKDIR/.post-approved"
echo "Posting approved for this run."
