# pp-pr-review

A Claude Code plugin that runs a **gated, sub-agent-driven pull request review**
for Azure DevOps repositories. Automated tools (CodeRabbit, linters) already
catch style and simple bugs; this plugin helps a developer do the *high-level*
review — does the change do what the ticket asked, are the tests meaningful, is
it secure, efficient, and leak-free, what's missing — and then posts the
resulting comments to the PR, but only with explicit approval.

Every analysis runs in a **sub-agent**, so the main conversation stays focused on
orchestration and the developer's decisions; this keeps the reviewer's context
clean and the triage sharp.

## What it does

`/pp-pr-review <feature-branch> <target-branch> <jira-ticket>` runs:

1. **Init** (deterministic script) — clean working dir, run metadata.
2. **Verify repository** (blocking) — confirms you started the review from a
   checkout of the PR's repository (git repo, `origin` matches the configured
   Azure repo, branches resolvable) *before* anything is checked out or posted.
3. **Setup** (deterministic script) — checks out the branch, computes the diff
   against the target.
4. **Redact PII** (blocking gate) — a sub-agent fetches the JIRA ticket and
   strips personal information; the raw text never enters the main conversation.
5. **Parallel analyses** — seven sub-agents run concurrently, each writing a
   findings report: **core logic** (with a plain-language summary and ranked
   "review hot spots" linking to the important code), **tests**, **security**,
   **SQL/JPA efficiency**, **memory**, **performance**, and **guidelines** (the
   team's documented POLYPOINT Coding Guidelines — conventions and clean-code
   rules generic linters don't know).
6. **Triage** — the developer is walked through each dimension's findings as a
   severity-ranked batch and picks which to include/edit/reject. Accepted
   findings accumulate in a curated set. Code references are IntelliJ-clickable,
   and the developer can ask to see the code behind any finding.
7. **Cross-cutting (open) review** — a sub-agent connects the accepted findings
   and surfaces gaps between the dedicated steps; then an open-ended,
   developer-directed pass.
8. **Sign-off gate** — the developer signs off on the curated finding set.
9. **Draft PR comments** — a sub-agent turns the accepted findings into postable
   comments.
10. **Post to PR** — **Gate: irreversible, requires explicit "yes".** Also
    enforced by a `PreToolUse` hook that blocks the post script unless approval
    was recorded for this run.

Each review dimension is a **skill**, so its heuristics (including the cited
pattern catalogs for security/SQL-JPA/memory/performance) can be refined
independently of the orchestration. The orchestration spine lives in the
`pp-pr-review` **command**. The posting gate is hardened by a **hook**.

The pattern catalogs are tuned to the team's stacks — **Java/Spring/JPA-Hibernate,
TypeScript/Node, and Angular** — and each is explicitly **not exhaustive**: the
sub-agents are told to also flag issues beyond the listed examples.

## Components

```
pp-pr-review/
├── .claude-plugin/plugin.json
├── commands/pp-pr-review.md            orchestrator (the workflow spine + gates)
├── skills/
│   ├── redact-jira/SKILL.md         privacy-safe ticket (sub-agent)
│   ├── review-core-logic/SKILL.md   summary + hot spots + logic findings
│   ├── review-tests/SKILL.md        test findings
│   ├── review-security/SKILL.md     OWASP-grounded security findings
│   ├── review-sql-jpa/SKILL.md      SQL/JPA-Hibernate efficiency findings
│   ├── review-memory/SKILL.md       leak/retention/allocation findings
│   ├── review-performance/SKILL.md  compute/concurrency/render findings
│   ├── review-guidelines/SKILL.md   POLYPOINT Coding Guidelines adherence
│   ├── review-open/SKILL.md         cross-cutting findings
│   └── draft-pr-comments/SKILL.md   accepted findings -> postable comments
├── hooks/
│   ├── hooks.json                   PreToolUse guard registration
│   └── scripts/guard-post.sh        blocks posting without approval
└── scripts/
    ├── init-run.sh                  clean working dir per run
    ├── verify-repo.sh               pre-flight: right repository?
    ├── checkout-and-diff.sh         deterministic setup
    ├── approve-post.sh              writes the one-shot approval marker
    └── post-to-azure.sh             posts comments as PR threads
```

Run artifacts in `./.pr-review/`: per-dimension reports (`logic.md`, `tests.md`,
`security.md`, `sql-jpa.md`, `memory.md`, `performance.md`, `guidelines.md`,
`open.md`), the curated `accepted.md`, and the `pr-comments.md` draft.

Run artifacts are written to `./.pr-review/` in the repo under review and are
git-ignored automatically.

## Installing the plugin manually (local, all your projects)

For local/manual use straight from this checkout — before it's published to a
deployed marketplace (those instructions live elsewhere). The plugin ships with a
bundled marketplace `pp-pr-review-marketplace` (marketplace name:
**`polypoint-internal`**, plugin name: **`pp-pr-review`**). Installing at **user
scope** (the default) makes it available in **every project** you open with Claude
Code — you do not install it per-repository.

### Option A — install from the local checkout (quickest)

From any Claude Code session, add the marketplace by its directory path, then
install the plugin:

```
/plugin marketplace add /ABSOLUTE/PATH/TO/review-plugin/pp-pr-review-plugin/pp-pr-review-marketplace
/plugin install pp-pr-review@polypoint-internal
```

`marketplace add` defaults to `--scope user`, and `install` defaults to user
scope, so the plugin is now enabled across all your projects. Verify with
`/plugin` (it should list `pp-pr-review` as enabled) and confirm `/pp-pr-review`
is available.

### Option B — declare it in user settings (persistent, all projects)

Add this to your **`~/.claude/settings.json`** (user-level = all projects). Claude
Code picks it up on the next start — no commands needed:

```json
{
  "extraKnownMarketplaces": {
    "polypoint-internal": {
      "source": {
        "source": "directory",
        "path": "/ABSOLUTE/PATH/TO/review-plugin/pp-pr-review-plugin/pp-pr-review-marketplace"
      }
    }
  },
  "enabledPlugins": {
    "pp-pr-review@polypoint-internal": true
  }
}
```

### Updating after the plugin changes

The marketplace caches its contents, so after editing skills/commands refresh it:

```
/plugin marketplace update polypoint-internal
```

> Note: there are two copies of the plugin in this repo — the source tree
> (`pp-pr-review-plugin/pp-pr-review/`) and the marketplace copy
> (`pp-pr-review-marketplace/plugins/pp-pr-review/`). The marketplace serves its
> own copy, so keep them in sync (they are byte-identical today).

### Trying it on a real PR

1. Install the plugin (Option A is fine for a first run).
2. In the **repository the PR belongs to** (e.g. your `polypoint-vibe-apps`
   checkout), commit/stash any local changes — the setup step refuses a dirty
   tree.
3. Make sure git can authenticate to Azure DevOps from that checkout (you can
   already `git fetch`), so the posting step can reuse the credential — or
   `export AZDO_PAT=…` in your shell. Org/project/repo are auto-derived; don't
   paste any token into the chat (see *Setup for developers* below).
4. Run, from that checkout:

   ```
   /pp-pr-review <feature-branch> <target-branch> <jira-ticket>
   ```

5. Work through the gates: confirm the PII redaction, triage each dimension's
   findings, sign off, review the drafted comments. **Nothing is posted to the PR
   until you answer "yes" at the final, hook-protected gate** — so you can do a
   full dry run and simply decline to post.

## Setup for developers

**Org / project / repo are not configured** — `verify-repo.sh` derives them from
the checkout's `origin` remote at the start of every run and records them for the
posting step. So you don't export `AZDO_PROJECT`/`AZDO_REPO`; the plugin just
works in whichever Azure DevOps repo you run it in.

**The token** is needed only to post, and is resolved by the posting script in
this order:

1. **Git's credential helper** — if you already clone/fetch from Azure DevOps over
   HTTPS, the stored credential is reused automatically. Nothing to set up.
2. **`AZDO_PAT`** environment variable (PAT with *Code (read & write)*) — only if
   you prefer to provide one explicitly.

> **The token never passes through Claude.** It is read inside the shell script
> and used solely to call Azure DevOps — it is never printed, written to disk, or
> shown to the assistant. **Do not paste a PAT into the chat;** if you need to set
> one, `export AZDO_PAT=…` in your own shell, or (preferred) configure it in your
> git credential manager.

Optional overrides (rarely needed — e.g. a fork whose `origin` isn't the PR's
repo): `AZDO_ORG_URL`, `AZDO_PROJECT`, `AZDO_REPO`. `AZDO_PR_ID` can pin the PR;
otherwise it's resolved from the feature branch.

Requires `git`, `curl`, and `jq` on PATH.

A JIRA/Atlassian connector enables automatic ticket fetching in the redaction
step; without it, the plugin asks the developer to paste the ticket text.

## The gating model (why posting is safe)

The posting gate is enforced two ways. The orchestrator stops and asks for a
clear "yes". Independently, a `PreToolUse` hook intercepts any attempt to run
`post-to-azure.sh` and blocks it unless `./.pr-review/.post-approved` exists.
That marker is written only by `approve-post.sh`, which the orchestrator runs
solely after the developer's explicit approval, and the hook consumes the
marker on use so one approval posts exactly once. This converts a soft
instruction into a hard stop.

## Security note for reviewers / org admins

This plugin ships executable scripts and a hook that run with the developer's
privileges, and `post-to-azure.sh` uses an Azure DevOps PAT. Review
`scripts/post-to-azure.sh` and `hooks/scripts/guard-post.sh` before
distributing org-wide. Distribute via a private/internal marketplace only.
