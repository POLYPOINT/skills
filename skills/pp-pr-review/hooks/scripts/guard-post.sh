#!/usr/bin/env bash
#
# PreToolUse guard. Claude Code and Codex invoke this before matching Bash tool
# calls and pass the tool input as JSON on stdin. We inspect the command being
# run.
# If it is the post-to-azure script, we ALLOW it only when the approval marker
# file exists in the current run directory. Otherwise we BLOCK it.
#
# This converts the "post" gate from a soft instruction into a hard stop: even
# if the model is induced to call the post script early, it cannot succeed
# without the marker, and the marker is only written by approve-post.sh, which
# the orchestrator runs solely after an explicit developer "yes".
#
# Hook protocol: exit 0 = allow. Exit 2 blocks the call and surfaces stderr.
# Any other nonzero is treated as a non-blocking error, so we fail safe by
# allowing unrelated commands through and only ever blocking deliberately.

set -euo pipefail

input="$(cat 2>/dev/null || true)"

# Extract the command string from the tool input JSON without requiring jq.
# Fall back to scanning the raw input if extraction fails.
cmd=""
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
fi
if [ -z "$cmd" ]; then
  cmd="$input"
fi

# Only ever act on the post script. Everything else passes untouched.
case "$cmd" in
  *post-to-azure.sh*)
    marker="./.pr-review/.post-approved"
    if [ -f "$marker" ]; then
      # Approved. The posting script consumes the marker immediately before it
      # makes network requests, keeping the one-shot gate effective even when
      # the script is invoked outside a supported hook runtime.
      exit 0
    fi
    echo "BLOCKED: posting to the PR requires explicit developer approval for this run. The post step has not been approved (no ./.pr-review/.post-approved marker). Ask the developer to confirm posting; approval is recorded by approve-post.sh, which runs only on a clear 'yes'. Do not attempt to bypass this." >&2
    exit 2
    ;;
  *)
    exit 0
    ;;
esac
