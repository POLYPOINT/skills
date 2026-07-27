---
name: pp-pr-review
description: "Use when reviewing an Azure DevOps pull request through the complete POLYPOINT workflow: repository verification, JIRA PII redaction, parallel specialist reviews, developer-led triage, cross-cutting analysis, comment drafting, and explicitly approved posting. Trigger when the user supplies or refers to an Azure DevOps PR URL and asks for a PR or code review."
---

# POLYPOINT PR review

Run the complete gated PR-review workflow. Treat the developer's decisions and
the files under `./.pr-review/` as the authoritative run state.

## Load the workflow

Read [the shared orchestration workflow](../../commands/pp-pr-review.md)
completely before starting. It is the authoritative sequence for both Claude
Code and Codex. Follow every gate, artifact contract, triage rule, and token
handling restriction in that file.

Apply these Codex mappings while following it:

- Treat the PR URL in the user's prompt as the workflow's `$1` argument. Ask for
  it only when none was supplied.
- Use `PLUGIN_ROOT` for plugin-relative scripts. Codex also supplies
  `CLAUDE_PLUGIN_ROOT` for compatibility, so commands in the shared workflow can
  run unchanged.
- Treat references to Claude's `Agent` tool or a `general-purpose` agent as
  instructions to delegate to a Codex sub-agent.
- Explicitly name the required bundled skill in every delegated task and list
  its input and output files.
- Launch the seven step-5 review agents concurrently when capacity permits. If
  fewer slots are available, keep the main conversation focused on
  orchestration and launch the remaining reviews as slots become available.
- Do not perform specialist analysis in the main conversation merely because
  delegation is temporarily unavailable. Preserve the workflow boundary.
- Use normal Codex user interaction for every `STOP` and approval gate. Never
  infer approval from earlier messages.

## Posting safety

The bundled `PreToolUse` hook checks attempts to execute
`post-to-azure.sh`. Codex requires the developer to review and trust the hook
before it runs. Do not treat an untrusted, disabled, or unavailable hook as
permission to weaken the workflow gate.

Run `approve-post.sh` only after the developer answers the final posting prompt
with an unambiguous yes. The posting script consumes the approval marker before
making Azure DevOps requests, so one approval authorizes one posting attempt.

Never call Azure DevOps posting endpoints directly or reproduce the posting
script with raw shell commands.
