---
name: dev-ticket
description: Use when the user asks to actually work on a Jira ticket — do, fix, implement, take, start, resume, or finish it — in any language; never start coding a ticket without this skill, even if the request looks like a plain coding task. The signature is a ticket key like PROJECT-123 (any uppercase prefix — ABC-1234, PLAT-1290, PPCLOUD-14330) combined with intent to change code, however terse ("let's do X-123") or however much context surrounds it (bug details, urgency, PO assignment, screenshots, base branch). Runs the full lifecycle — fetch and analyze the ticket, reproduce, implement in an isolated git worktree, verify live with the user, commit, create the PR, shepherd it to merge. Also use for `/dev-ticket setup` (first-time project setup). Do NOT use when the user only wants information or Jira actions about a ticket (summarize, explain, estimate, status, transition, comment) or for coding tasks with no ticket involved.
metadata:
  version: 1.0.0
---

# Dev ticket workflow

Drive a ticket from its Jira description to a merged PR. The workflow has hard
checkpoints (marked **STOP**) where you wait for the user — everything between
checkpoints you do autonomously.

## Project context — derive, ask, remember

This skill is project-agnostic on purpose: it never hardcodes paths, environments,
credentials, tools, or team conventions. Resolve that information in this order:

1. **From the repo itself**: agent docs (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING`),
   build files (`package.json`, `pom.xml`, `Makefile`, …), CI pipeline definitions,
   and git history (commit message style, branch naming).
2. **From memory**: look for a `dev-ticket-setup-<project>` memory saved by earlier
   tickets in this project.
3. **Ask the user** — only for what you couldn't derive, and only when the phase at
   hand actually needs it. Don't front-load a questionnaire at ticket start.

When the user supplies such an answer, offer to save it to memory so it's never
asked twice; store it only if they agree — especially anything credential-like.
Keep one memory file per project, `dev-ticket-setup-<project>`, typically covering:

- where ticket worktrees live (suggest a sibling folder, e.g. `<repo>-worktrees`)
- related repos worth reading for context (always read-only)
- the team's long-lived base branches
- build / lint / test commands
- how to run the app locally and against which test environment
- test environment names/URLs and dedicated test users (never production ones)
- deployment tooling and its machine-specific quirks

### `/dev-ticket setup` — guided first run (optional)

When invoked with the argument `setup`, or when the user asks to set the skill up
for a project, skip the ticket workflow and run the project-context interview in
one pass instead: derive everything you can from the repo first, present what you
found for confirmation, then ask only for the gaps (worktrees location, related
repos, base branches, commands, test environment + users, tooling quirks). Save
the agreed result to the `dev-ticket-setup-<project>` memory and summarize what
was stored. Later tickets then start without setup interruptions.

## Orchestration model

The main session is the **orchestrator**: it keeps the big picture, does the deep
thinking (root-cause synthesis, decisions, checkpoint summaries), and talks to the
user. It should not burn its own context on expensive exploration.

Delegate every expensive or context-heavy subtask to **subagents running Opus 5**
(Agent tool with `model: "opus"`): tracing code paths, researching across the
repo or related repos, analyzing logs or CI output, reading long histories, and
the pre-commit self-review. Give each subagent a precisely scoped task and the
expected output shape; it does the legwork and returns a **compact summary**
(findings with `file:line` references, evidence, open questions — never raw file
dumps). The main session integrates those summaries into its context and reasons
over them.

Run independent subagents in parallel. Keep in the main session what subagents
cannot do: talking to the user, decisions, cross-summary synthesis, and the
STOP checkpoints.

## Ground rules

- **Never touch the main working copy.** The user works there in parallel; all
  edits happen in a dedicated worktree (Phase 3). Read-only access to the main
  checkout (reading files, `git fetch`, `git worktree add`) is fine.
- **Related repos are reference material only.** Read them whenever the ticket
  touches shared contracts or behavior that lives elsewhere — but never modify
  anything outside the ticket worktree. If the fix (or part of it) belongs in
  another repo, report it; that's separate work.
- **Commit + push are pre-authorized** — but only on the ticket branch inside the
  worktree you created. Never push to a long-lived branch (`master`, `main`,
  `release/*`, …), never force-push, never tag. (If your global config forbids
  unprompted commits, record this skill as an exception there — see the note at
  the bottom.)
- **Dev/test environments ONLY — never production.** Never switch a cloud or
  kubernetes context to production, never point a build tool, database connection,
  or log query at a production system — not even read-only "just to check". Leave
  whatever context is currently set alone unless it's the dev one you need. If a
  step ever _seems_ to require production access, or you're unsure whether a
  target is production, stop and ask — that decision is never yours to make
  inside this skill.
- **Resume support:** before starting from scratch, check memory for a ticket file
  (see Memory) and whether the worktree already exists
  (`git -C <repo> worktree list`). If so, pick up where the memory file says you
  left off instead of redoing earlier phases.
- Follow the project's own coding conventions and agent docs at all times.

## Phase 1 — Gather context

1. **Ticket key**: take it from the invocation args; ask if missing.
2. **Fetch the ticket** via the Atlassian MCP tools when the integration is
   connected: `getAccessibleAtlassianResources` → cloudId, then `getJiraIssue`
   with `responseContentFormat: "markdown"` and fields including `comment`. Read
   the description AND the comments — reproduction steps and decisions often hide
   in comments. If the integration isn't available, ask the user to paste the
   ticket content instead.
3. **Images**: Jira attachments are not reachable through the API. If the ticket
   references screenshots, mockups, or UI behavior, ask the user to paste the
   images before analyzing — a wrong mental picture of the UI wastes the whole
   analysis.
4. **Branch name**: branch with the command Jira generates, which produces
   `<TICKET-KEY>-kebab-case-summary`. Derive that name from the ticket key +
   summary and include it in the confirmation below. If the summary is long or
   ambiguous, ask the user to paste the branch command from the ticket instead
   of guessing.
5. **Base branch**: ask which long-lived branch to base the work on (offer the
   ones from project context). Never assume — a hotfix and a feature can look
   identical from the ticket text.

## Phase 2 — Deep analysis (read-only, no code changes yet)

Analyze before proposing anything — per the Orchestration model, fan the legwork
out to parallel Opus subagents (one per angle: affected flow, related repos,
git history, domain docs) and synthesize their summaries in the main session:

- Trace the affected flow through the repo. Read the actual code, not just
  search hits. Use the project's architecture/domain docs when they exist.
- Check memory and any local issue/feature docs for prior work on the same area.
- **Cross-repo impact check**: when the ticket involves data or contracts shared
  with related repos, read the relevant parts there to confirm where the behavior
  actually lives. Flag explicitly if the real fix (or part of it) belongs in a
  repo you must not modify.
- Look at recent git history of the affected files — the bug is often a recent
  change.

Then present a summary: root cause, proposed fix, files to change, tests you plan
to write (test-first where the project prescribes it), risks, and any cross-repo
findings or open questions.

**STOP — wait for explicit agreement on the summary before touching any file or
creating the worktree.** If the user amends the approach, update the summary and
reconfirm.

## Phase 3 — Set up the isolated worktree

```bash
mkdir -p <worktrees-dir>
git -C <repo> fetch origin
# New branch:
git -C <repo> worktree add <worktrees-dir>/<TICKET> -b <branch> origin/<base>
# If the branch already exists on origin (Jira "create branch" already clicked):
git -C <repo> worktree add <worktrees-dir>/<TICKET> <branch>
```

Work exclusively inside `<worktrees-dir>/<TICKET>` from here on. A fresh worktree
has no installed dependencies — install what the affected part needs first (e.g.
`npm ci` in the affected app directory).

## Phase 4 — Reproduce the issue (bug tickets)

Before changing anything, reproduce the issue on the untouched worktree (the base
branch state): run the affected app exactly as described in the Live verification
section of Phase 5 and walk through the ticket's scenario until you see the broken
behavior yourself. This proves the root-cause analysis was right, and the recorded
broken behavior becomes the before/after benchmark — the fix is verified later by
re-running the very same scenario. Note precisely what you observed (and grab a
screenshot when it's visual).

If you cannot reproduce it, tell the user what you tried and what you saw
instead — the cause may be environment-specific, need test data they must
prepare, or the analysis may be wrong. Don't start fixing a bug you've never
seen fail.

Report the reproduction: the scenario you ran, what breaks and how, and whether
it confirms or amends the approved analysis.

**STOP — wait for the user's approval before moving on to implementation.**

For feature tickets there is nothing to reproduce — say you're skipping this
phase and continue.

## Phase 5 — Implement and verify

Implement per the approved summary, following the project's conventions
(test-first where prescribed).

Before any commit, verify — the goal is that CI on the PR passes on the first try:

- Run the project's lint, the tests covering your change, and make sure the
  build compiles — using the project's own commands (from its docs or the
  project-context memory), never ad-hoc tool invocations the project forbids.
- **Machine-global build config**: some build tools read a machine-global config
  that points at a specific checkout (not your worktree). If you must repoint it
  to the worktree, first read its current value:
  - Points at the main checkout → safe: repoint it, and note that restoring it is
    part of cleanup (Phase 8).
  - Already points at _this ticket's_ worktree (resumed session) → proceed as is.
  - Points anywhere else → another session is likely mid-ticket. Do NOT repoint —
    you'd hijack their builds. Tell the user and wait for approval to try again.
- **Self-review**: before moving to Phase 6, spawn a code-review subagent
  (`model: "opus"`) on the diff (fresh eyes, no attachment to the implementation)
  and fix the findings
  that are genuinely valid — verify each against the code first. Re-run the
  affected verification after fixes. This cuts review rounds on the PR.

### Live verification (whenever the change affects visible behavior)

Tests prove the unit; seeing the fix run proves the ticket. For UI or user-facing
behavior changes, verify live before declaring Phase 5 done.

Make the live check as realistic as possible: exercise the real flow a user would
go through, against real backend behavior. Don't inject fabricated test data or
mock services when the real thing is reachable — a check that passes against a
mock proves the mock, not the fix. Mocks/stubs are for what's genuinely out of
reach.

Once the testing phase starts, **keep the app up continuously until Phase 6
begins** — run the dev server in the background and don't tear it down between
verification rounds or while waiting for feedback. The user may want to look at
or test the change at any moment, unannounced; the served app (with hot reload
picking up your fixes) is the shared workbench for the whole loop. Share the URL
as soon as the server is up, and only shut it down once the user validates and
you move on to committing.

Not every project is a web app. When there is no UI to serve, hand over the
equivalent workbench: a running local stack plus ready-to-run requests (a REST
collection or curl commands) for API changes, the exact command line and sample
input for a CLI, or the emulator/device recipe for a mobile app. The same rules
apply — keep it running, use realistic data, and the user tries it before
anything is committed.

- **Frontend**: serve the affected app from the worktree against the team's test
  environment and drive it with a browser. **Always run the browser headed
  (visible), never headless** — the user wants to watch what you're doing and be
  able to step in and try things in the same window at any moment. Prefer a
  persistent browser profile so the test-environment session survives between
  runs; when a login is needed, ask the user to log in manually in the open
  window.
- **Test users**: use the dedicated test users from the project context (ask and
  offer to remember them if unknown). They are test-environment-only — never use
  them anywhere else, and never use real/production accounts.
- **Backend**: prefer a local stack when the project has one. When a change must
  be verified end-to-end on the shared test environment, deploy the local build
  with the project's tooling — but two cautions:
  - When building container images for a remote cluster, match the cluster's CPU
    architecture (e.g. an arm64 image built on Apple Silicon won't run on amd64
    nodes — use the tool's amd64 flag/option).
  - **Always ask before deploying to a shared test environment**: the user must
    check no one else has their own build deployed there and that deployment
    auto-sync (e.g. ArgoCD) is handled. Wait for their explicit go. Roll the
    deployment back when done so the environment returns to its synced state.
- **Shared-environment etiquette**: create your own separate test data/users
  rather than reusing or modifying someone else's, and clear what you created
  when done — the test environment is shared with other developers.
- **Test scenario setup**: some scenarios need domain state that can't be set up
  through the app under test. When that state lives in PEP (POLYPOINT's on-prem
  planning client), use the `pep-verify` skill (same marketplace as this skill)
  to prepare and inspect it directly on a tenant box — its writes persist to the
  tenant DB immediately, so confirm the target employee/day with the user before
  mutating a shared tenant. For other connected systems, check the project
  context for a companion driving skill/tool (record one there when you learn of
  it). Only when neither exists, don't struggle around it or water down the
  test — ask the user to prepare it, specifying exactly what you need so it can
  be done in one pass:
  which users, which entities, which dates, and the state things must be in. Say
  what you'll verify once it's ready, then wait for their go. When they say it's
  ready, first check the prepared state yourself (look at it in the live app) and
  confirm it matches what you asked for — a scenario that's subtly off produces a
  misleading test result. If something doesn't match, say precisely what differs
  instead of testing anyway.
- **Hand-over test**: after your own live check passes, let the user try it too
  before you commit anything. Keep the dev server running, and give them what they
  need to test in one message: the URL (with any required query params), which
  user to log in as, the scenario/steps to exercise, and what they should observe.
  **STOP — wait for their verdict.** If they find an issue, fix it and repeat
  verification; only move to Phase 6 once they're satisfied. This loop can go
  several rounds — never commit anything while it's running, no matter how many
  iterations. Commits happen only in Phase 6, from the final validated state, so
  the history reflects the finished change rather than the back-and-forth.
- **State report every round**: each time you hand back after a fix, show the
  current state so the user never has to reconstruct it — what changed since
  their last feedback (and why), the verification results of this round (tests,
  lint, build, live check — pass/fail, not just "done"), which files are touched
  overall so far, and what exactly to re-test now (often narrower than the first
  round).

## Phase 6 — Commit, push, create the PR

- **Commit only after implementation and verification are fully done** — never
  mid-work. Commit/push may hit permission prompts, and the user may be away or on
  something else; batching all git writes at the end means a pending prompt never
  blocks you from continuing the actual work. Do all the commits back-to-back in
  one go.
- **Group the changes into logical commits**, not one big one. You decide the
  grouping; aim for commits that each tell one story and could be reviewed alone —
  e.g. preparatory refactoring first, then the fix together with the tests that
  prove it, then independent side-changes (regenerated files, translations, dev
  tooling). Don't over-split: related test + production code belong in the same
  commit, and two or three well-cut commits beat six fragments.
- **Commit messages follow the project's convention** — derive it from recent git
  history and the project docs (typically `<TICKET-KEY> <imperative summary>`).
- `git push -u origin <branch>` from the worktree (single push after all commits).
- Summarize for the user: what changed, why, how it was verified, anything they
  should double-check manually.
- **Create the PR** with the platform's CLI (e.g. `az repos pr create` for Azure
  DevOps, `gh pr create` for GitHub — check `--help` for exact arguments instead
  of assuming):
  - Title: `<TICKET-KEY> <summary>`.
  - Description: it MUST start with a line stating the PR was generated by
    Claude (e.g. `> 🤖 This PR was generated by Claude Code.`), then short
    markdown sections (`##` headers, `-` bullets, backticks for file/class
    names) — what changed and why (root cause in one or two sentences), how it
    was verified (tests + live check), and anything reviewers should pay
    attention to. Keep it tight; reviewers read the diff, the description gives
    them the story.
  - Target branch: the base branch chosen in Phase 1. What must never happen is
    pushing commits _directly_ to a long-lived branch: the ticket branch is
    always its own branch (created with `-b` in Phase 3), never a checkout that
    tracks a long-lived branch so that pushing it would push that branch itself.
  - Share the PR link with the user right after creation.
- Write/update the ticket memory file (see Memory).

## Phase 7 — PR babysitting

Watch the PR you created in Phase 6 until it merges (when resuming a session and
the PR link is unknown, ask for it): invoke the `babysit-pr` skill (same
marketplace as this skill) with the PR link; if it isn't installed, suggest
installing it and fall back to polling the platform CLI for review comments and
CI status. Verify each incoming finding against the code before acting on it,
fix the valid ones inside the same worktree, reply to and resolve the threads,
and keep committing/pushing on the same branch — the pre-authorization still
holds.

## Phase 8 — Cleanup (when the user says the ticket is done)

When the user declares the ticket done/completed (usually after the PR merges),
leave the machine exactly as you found it. Go through all of these — skip only
what was never touched, and say what you cleaned:

1. **Stop background processes**: dev servers, log follows, browser sessions
   still running from the testing phase.
2. **Undo any test-environment deploy**: withdraw/roll back your deployed build so
   the environment returns to its synced state (and remind the user to re-enable
   any auto-sync that was disabled for you).
3. **Restore machine-global config**: set back any build-tool or environment
   config you repointed during the ticket, and verify the restored value.
4. **Clean up test data**: delete the test users/data you created, and list any
   remaining data you couldn't remove so the user can decide.
5. **Remove the worktree and branch**:
   ```bash
   git -C <repo> worktree remove <worktrees-dir>/<TICKET>
   git -C <repo> branch -d <branch>
   ```
6. **Update the memory file** status to MERGED/DONE (keep root cause + PR number,
   drop the step-by-step state — it's no longer needed).

## Memory

Two kinds of memory files keep this skill working across sessions:

- **Per project** — `dev-ticket-setup-<project>` (type `project`): the project
  context described at the top (paths, environments, test users, commands,
  tooling quirks). Create/extend it whenever the user answers a setup question
  and agrees to store it.
- **Per ticket** — `<ticket-key>-<short-slug>` (type `project`): so a fresh
  session can resume mid-ticket. Update it at every phase transition and whenever
  a significant decision is made. Contents: current phase/status, branch, base
  branch, worktree path, root cause, key decisions and why, PR link once known.

Remember to add/update the `MEMORY.md` index line for any file you touch.

## Note for installing this skill

If your global Claude configuration forbids unprompted git commits/pushes (a good
default!), add an exception like: _"when the `dev-ticket` skill is active,
committing and pushing are pre-authorized — but only on the ticket branch inside
the worktree that skill created, never on long-lived branches, and still no
force-push, tags, or history rewrites."_ Without it, the skill will stop and ask
at every commit. Connecting the Atlassian (Jira) integration is recommended so
tickets are fetched automatically; without it the skill asks you to paste ticket
content. Recommended companions from the same marketplace: `babysit-pr` (Phase 7)
and, for PEP-related scenarios, `pep-verify` (Phase 5).
