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
printf '%s' '{"comments": [{"parentCommentId": 1, "content": "Fixed in <short-sha> — <what changed>.", "commentType": 1}], "status": "fixed"}' > "$SCRATCH/reply-<THREAD_ID>.json"
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=<PROJECT> repositoryId=<REPO> pullRequestId=<PR_ID> threadId=<THREAD_ID> \
  --http-method PATCH --in-file "$SCRATCH/reply-<THREAD_ID>.json" \
  --organization https://dev.azure.com/polypoint --api-version 7.1 -o none
```

- Omit `"status"` to reply without resolving.
- `--in-file` is required — az cannot take the JSON body inline. Write the payload with `printf '%s'` (no trailing newline needed) to a scratchpad file.
- Escape carefully: the payload is JSON inside single-quoted shell. For embedded double quotes use `\"`, for a literal single quote close/reopen the shell quote (`'"'"'`).

### Post a new PR-level thread (e.g. trigger CodeRabbit)

```bash
printf '%s' '{"comments": [{"parentCommentId": 0, "content": "@coderabbitai review", "commentType": 1}], "status": "active"}' > "$SCRATCH/new-thread.json"
az devops invoke --area git --resource pullRequestThreads \
  --route-parameters project=<PROJECT> repositoryId=<REPO> pullRequestId=<PR_ID> \
  --http-method POST --in-file "$SCRATCH/new-thread.json" \
  --organization https://dev.azure.com/polypoint --api-version 7.1 --query "id" -o json
```

## CodeRabbit specifics (POLYPOINT org)

- CodeRabbit posts as the service account **"it polypoint.ch"**. Replies meant for CodeRabbit MUST start with **`@itpolypoint.ch`** — without the mention, CodeRabbit assumes the reply is not addressed to it and never reacts.
- CodeRabbit skips **draft** PRs ("Review skipped — Draft detected"). Trigger a one-off review on a draft with a `@coderabbitai review` comment (recipe above); it acknowledges with an "Action performed / Review triggered" thread, and findings arrive as new threads a few minutes later.
- CodeRabbit reviews incrementally — after pushing fixes it only re-reviews new commits.
- Publishing a draft: `az repos pr update --id <PR_ID> --draft false --organization https://dev.azure.com/polypoint`.

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
