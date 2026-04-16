---
name: zn2c-quick-win
description: Use when implementing a Zn2C Quick-Win from the ZQW Jira board end-to-end, including Jira transitions, Confluence documentation, git worktree workflow, build validation, Azure DevOps PR creation, and review feedback handling.
argument-hint: "[ZQW-XXX]"
disable-model-invocation: true
compatibility: Designed for Claude Code. Requires Atlassian MCP tools, Azure DevOps CLI (`az`), and access to the Zn2C cloud repository.
metadata:
  version: "1.0.2"
---

# Quick-Win Implementation

Implement a Zn2C Quick-Win from the ZQW Jira board end-to-end.

**Usage:** `/zn2c-quick-win ZQW-XXX`

The argument is the Jira issue key (e.g., `ZQW-1`, `ZQW-42`).

## Workflow

Execute these phases in order. Always keep the Jira board updated with the current status.

### Phase 0: Setup

1. **Fetch the Jira issue** using the Atlassian MCP tools (`getJiraIssue`). Extract: summary, description, acceptance criteria, current status.
2. **Fetch available transitions** (`getTransitionsForJiraIssue`) so you know the transition IDs for this board.
3. **Transition the issue to "In Progress"** (`transitionJiraIssue`).
4. **Create a Confluence documentation sub-page** under the Quick-Wins parent page (ID: `14170488840`, space ID: `11137581287`) with title `{ISSUE_KEY}: {summary}`. Start with a skeleton:
   - Summary section (Jira link, branch name, date)
   - "What changed" placeholder
   - "Files changed" placeholder
   - "How it works" placeholder
   - "Acceptance criteria verification" placeholder (copy from Jira, all unchecked)
   - "Test results" placeholder
5. **Add a comment on the Jira issue** linking to the new Confluence page.
6. **Create a git worktree** with branch `feature/{ISSUE_KEY}-short-desc` (lowercase, kebab-case) based on `master`.

### Phase 1: Explore & Plan

1. Read `AGENTS.md` for project coding guidelines.
2. **Explore the codebase** using Explore agents in parallel to understand the areas affected by the issue.
3. **Enter plan mode** and design the implementation approach.
4. Present the plan to the user for approval. Do NOT proceed without approval.

### Phase 2: Implement

1. Create task list to track progress.
2. Implement changes in the worktree, following AGENTS.md guidelines:
   - Build with `./polypoint-cloud-cli/build.sh` (from the main repo, not worktree) — never Maven directly
   - Constructor injection via `@RequiredArgsConstructor`
   - `@PreAuthorize` on public service methods
   - `@NotNull`/`@Nullable` on method parameters and return types
   - Use `TestObject` classes for test data
   - Generated DTOs use fluent setters
3. Write tests covering the new behavior.
4. **Build and validate**: Run `./polypoint-cloud-cli/build.sh "" "--module {module}" "" "" "" ""` from the worktree directory. Ensure all tests pass with 0 failures.
5. If the build fails, fix the issues and re-run until green.

### Phase 3: Ship

1. **Commit** with message: `{ISSUE_KEY} {imperative description}` + `Co-Authored-By` trailer. Stage only relevant files (not unrelated generated artifacts).
2. **Push** the branch to origin.
3. **Create a draft PR** on Azure DevOps:
   ```
   az repos pr create \
     --organization "https://dev.azure.com/polypoint" \
     --project "cloud" --repository "cloud" \
     --source-branch "feature/{ISSUE_KEY}-short-desc" \
     --target-branch "master" \
     --title "{ISSUE_KEY} {short title}" \
     --description "..." --draft true
   ```
4. **Transition the Jira issue to "In Review"**.

### Phase 4: Review Feedback

1. If the user asks to address review comments (CodeRabbit, SonarQube, human reviewers):
   - Fetch PR threads via `az devops invoke --area git --resource pullRequestThreads`
   - Fix each issue or explain why it's a won't-fix
   - Commit, push, and resolve the threads as `fixed` or `closed`

### Phase 5: Document

1. **Update the Confluence sub-page** with the final implementation details:
   - Fill in all placeholder sections
   - List all files changed with a summary table
   - Explain how it works (backend, frontend, migration as applicable)
   - Check off all acceptance criteria that are verified
   - Record test results (count, failures, build time)
2. **Add a comment on the Jira issue** with the PR link if not already done.

## Important Notes

- **Never include sensitive information** in Jira comments, Confluence pages, or PR descriptions (no credentials, tokens, customer data).
- **Always work in a git worktree** — never modify the main working directory.
- **Build script location**: The `polypoint-cloud-cli/` directory may not be in the worktree. Use the absolute path from the main repo.
- **Portal-core uses PostgreSQL** — write Flyway migrations with PostgreSQL syntax.
- **Azure DevOps** (not GitHub) — use `az repos pr` for PR operations, `az devops invoke` for thread management.
- **Confluence cloud ID**: `polypoint.atlassian.net`
- **Confluence parent page ID**: `14170488840` (Zn2C Quick-Wins)
- **Confluence space ID**: `11137581287`
- **Jira transitions**: Backlog=11, Ready=21, In Progress=31, In Review=41, Done=51

$ARGUMENTS
