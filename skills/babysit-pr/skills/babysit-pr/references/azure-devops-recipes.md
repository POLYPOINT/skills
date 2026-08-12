# Azure DevOps PR recipes (az CLI)

Battle-tested command recipes for babysitting a PR. All commands need the `azure-devops` az extension and a logged-in session.

## Parse the PR reference

PR URLs have the form `https://dev.azure.com/<org>/<project>/_git/<repo>/pullrequest/<id>`.

POLYPOINT specifics:

| Project       | Repo          | Default target branch |
| ------------- | ------------- | --------------------- |
| `SaaS`        | `SaaS`        | `main`                |
| `pp-services` | `pp-services` | `master`              |

`repositoryId` route parameters accept the repo **name** or GUID. Get the GUID if needed:

```bash
az repos pr show --organization https://dev.azure.com/polypoint --id <PR_ID> --query "repository.id" -o tsv
```

## Preflight

```bash
az account show --query user.name -o tsv          # logged in?
az extension list --query "[].name" -o tsv         # must contain azure-devops
```

If not logged in, ask the user to run `az login` themselves (interactive).

`az account show` succeeding does NOT guarantee devops calls work: they can still fail with `AADSTS50076` (MFA re-auth required). The fix is interactive — ask the user to run:

```bash
az logout && az login --tenant <TENANT_ID> --scope "499b84ac-1321-427f-aa17-267ca6975798/.default"
```

(`499b84ac-…` is the fixed Azure DevOps resource id; the tenant id is in the AADSTS50076 error text.)

## PR overview (status, draft, votes, source commit)

```bash
az repos pr show --id <PR_ID> --organization https://dev.azure.com/polypoint \
  --query "{title: title, status: status, isDraft: isDraft, mergeStatus: mergeStatus, sourceRef: sourceRefName, lastMergeSourceCommit: lastMergeSourceCommit.commitId, reviewers: reviewers[].{name: displayName, vote: vote}}" -o json
```

Vote values: `10` approved, `5` approved with suggestions, `0` no vote, `-5` waiting for author, `-10` rejected.

## Comment threads

### List threads

```bash
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=<PROJECT> repositoryId=<REPO> pullRequestId=<PR_ID> \
  --organization https://dev.azure.com/polypoint --api-version 7.1 -o json
```

Relevant fields per thread: `id`, `status` (`active`, `fixed`, `wontFix`, `closed`, `pending`, or `null` for system/summary threads), `threadContext.filePath` + `threadContext.rightFileStart.line` (null for PR-level comments), `comments[]` with `author.displayName`, `content`, `commentType`. Skip threads with `isDeleted` and comments with `isDeleted`. CodeRabbit wraps machinery in HTML comments (`<!-- ... -->`) — strip them before reading.

### Reply to a thread and set its status (one call)

A `PATCH` on the thread accepts a reply and a status change together:

```bash
printf '%s' '{"comments": [{"parentCommentId": 1, "content": "@itpolypoint.ch Fixed in <short-sha> — <what changed>.\n\n_[🤖 AI-generated · /babysit-pr]_", "commentType": 1}], "status": "fixed"}' > "$SCRATCH/reply-<THREAD_ID>.json"
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=<PROJECT> repositoryId=<REPO> pullRequestId=<PR_ID> threadId=<THREAD_ID> \
  --http-method PATCH --in-file "$SCRATCH/reply-<THREAD_ID>.json" \
  --organization https://dev.azure.com/polypoint --api-version 7.1 -o none
```

- The leading `@itpolypoint.ch` is required on CodeRabbit threads — without it CodeRabbit never reacts (see CodeRabbit specifics below). Drop it when replying to a human.
- Omit `"status"` to reply without resolving.
- Append the AI attribution trailer (below) to every prose comment body.
- `--in-file` is required — az cannot take the JSON body inline. Write the payload with `printf '%s'` (no trailing newline needed) to a scratchpad file.
- Escape carefully: the payload is JSON inside single-quoted shell. For embedded double quotes use `\"`, for a literal single quote close/reopen the shell quote (`'"'"'`).

### Post a new PR-level thread (e.g. trigger CodeRabbit)

```bash
printf '%s' '{"comments": [{"parentCommentId": 0, "content": "@itpolypoint.ch review", "commentType": 1}], "status": "active"}' > "$SCRATCH/new-thread.json"
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=<PROJECT> repositoryId=<REPO> pullRequestId=<PR_ID> \
  --http-method POST --in-file "$SCRATCH/new-thread.json" \
  --organization https://dev.azure.com/polypoint --api-version 7.1 --query "id" -o json
```

## AI attribution trailer

Everything posted by this skill goes out under the user's own az identity — Azure DevOps shows the user as the author. So every prose comment body (replies, new discussion threads) ends with this exact line, separated by a blank line:

```
_[🤖 AI-generated · /babysit-pr]_
```

- On CodeRabbit threads the `@itpolypoint.ch` mention must stay the first token of the body; the trailer always goes last.
- **Exception — bot command comments** (`@itpolypoint.ch review` triggers/nudges) are posted bare, no trailer: extra text can interfere with command parsing, and the thread gets closed right after anyway.

## CodeRabbit specifics (POLYPOINT org)

- CodeRabbit posts as the service account **"it polypoint.ch"**. Replies meant for CodeRabbit MUST start with **`@itpolypoint.ch`** — without the mention, CodeRabbit assumes the reply is not addressed to it and never reacts.
- CodeRabbit skips **draft** PRs ("Review skipped — Draft detected") — trigger a one-off review instead (see Draft PRs below).
- CodeRabbit reviews incrementally — after pushing fixes it only re-reviews new commits.
- **Stale vote**: CodeRabbit's `-5` (waiting for author) can survive ~20 minutes after all its threads are resolved. Nudge it with a PR-level `@itpolypoint.ch review` comment — it re-reviews and re-votes (and the "Minimum number of reviewers" policy flips back to approved). Close the nudge threads afterwards (see Draft PRs).

## Draft PRs

Draft PRs run neither CI build policies nor CodeRabbit on their own; both can be kicked off manually.

- **Trigger a CodeRabbit review**: post a PR-level thread (recipe above) with content exactly `@itpolypoint.ch review` — bare, no attribution trailer (see the trailer exception). CodeRabbit acknowledges with an "Action performed / Review triggered" thread (or answers directly with the review), and findings arrive as new threads a few minutes later.
- **Close the trigger threads afterwards**: the trigger comment and CodeRabbit's acknowledgment are `active` threads, and an active thread flips the **Comment requirements** policy to `rejected`. Once the ack lands, PATCH both threads to `status: closed` or that gate stays red.
- **Queue the build policies**: take `evaluationId` from the unfiltered `az repos pr policy list` output for each build policy stuck at `queued`, then queue it (same command as the re-queue recipe below). **Every push resets the evaluations to `queued` with no build** — re-queue after each push for as long as the PR stays a draft.
- **Publishing a draft** (only when the user asks): `az repos pr update --id <PR_ID> --draft false --organization https://dev.azure.com/polypoint`. Once published, CI and CodeRabbit run on their own.

## CI state

### Branch policy evaluations (build gates)

```bash
az repos pr policy list --id <PR_ID> --organization https://dev.azure.com/polypoint \
  --query "[].{policy: configuration.type.displayName, build: context.buildDefinitionName, status: status}" -o json
```

`status` values: `queued`, `running`, `approved` (passed), `rejected` (failed). The build id of a policy evaluation is at `context.buildId` in the unfiltered output.

### PR statuses (e.g. code coverage)

```bash
az devops invoke --area git --resource pullRequestStatuses \
  --route-parameters project=<PROJECT> repositoryId=<REPO> pullRequestId=<PR_ID> \
  --organization https://dev.azure.com/polypoint --api-version 7.1 \
  --query "value[].{context: context.name, state: state, description: description}" -o json
```

### Failed build diagnosis

```bash
az pipelines build show --organization https://dev.azure.com/polypoint --project <PROJECT> --id <BUILD_ID> \
  --query "{def: definition.name, result: result, status: status}" -o json

# Timeline: find the failed task and its logId
az devops invoke --area build --resource timeline \
  --route-parameters project=<PROJECT> buildId=<BUILD_ID> \
  --organization https://dev.azure.com/polypoint --api-version 7.1 \
  --query "records[?result=='failed'].{name: name, logId: log.id}" -o json

# Raw log content (az invoke mangles log output; use curl with a bearer token)
curl -s -u ":$(az account get-access-token --query accessToken -o tsv)" \
  "https://dev.azure.com/polypoint/<PROJECT>/_apis/build/builds/<BUILD_ID>/logs/<LOG_ID>?api-version=7.1" | tail -80
```

### Re-queue a rejected build policy

```bash
# evaluationId from the unfiltered `az repos pr policy list` output
az repos pr policy queue --id <PR_ID> --evaluation-id <EVALUATION_ID> --organization https://dev.azure.com/polypoint
```

## Babysit in a linked worktree

Keeps the main checkout free for other work while the babysit fixes land in a separate directory.

Location rule: **sibling of the repo root, named `babysit-pr-<PR_ID>-<repo>`** — self-describing, easy to spot in the parent directory, easy to sweep.

`<source-branch>` is the PR's `sourceRefName` with the `refs/heads/` prefix stripped — the full ref would produce a detached HEAD, and commits would land on no branch.

```bash
git -C <repo-root> fetch origin <source-branch>
git -C <repo-root> worktree add "<repo-root>/../babysit-pr-<PR_ID>-<repo>" <source-branch>
# the local branch may be stale — the fetch only moved origin/<source-branch>:
git -C <worktree-path> rev-list --left-right --count HEAD...origin/<source-branch>
```

- If the count shows the local branch **behind** (0 ahead), `git -C <worktree-path> reset --hard origin/<source-branch>`. If it is **ahead**, stop and ask the user — there are local commits the remote does not have.
- Fails with "already checked out" when the main tree has the source branch checked out — ask the user to switch the main checkout to their own work first (that is the point of the worktree anyway).
- In Claude Code, switch the session into it with `EnterWorktree` `{path: "<worktree-path>"}` (creating via `EnterWorktree` `{name}` is wrong here — it branches fresh from the default branch instead of checking out the PR's source branch).
- Install dependencies in the worktree before running the repo's feedback loop — it starts without `node_modules` etc.

**Cleanup is part of ending the watch, not optional** — a forgotten worktree keeps a full checkout plus build artifacts on disk:

```bash
# after everything is committed and pushed; ExitWorktree {action: "keep"} first if the session is inside it
git -C <repo-root> worktree remove "<worktree-path>"   # refuses while dirty — that refusal is a safety net, investigate before --force
git -C <repo-root> worktree prune
```

Stale sweep (setup step): `git -C <repo-root> worktree list | grep babysit-pr` — offer to remove leftovers from earlier runs.
