---
name: draft-pr-comments
description: Turn the developer's accepted review findings into well-formed, postable PR comments for Azure DevOps. Reads only the curated accepted-findings file. Runs as a non-interactive sub-agent producing the draft; the orchestrator presents it and applies edits. Use after triage, before the posting gate.
---

# Draft PR comments

You are turning the **accepted** review findings into comments the developer can
post on the pull request. You run as a **sub-agent**: you do not talk to the
developer. Produce the draft file; the orchestrator shows it to the developer and
applies any edits. You **draft only** — posting is a separate, gated,
hook-protected step.

## Inputs

- `./.pr-review/accepted.md` — the only **source of findings**. It contains exactly
  the findings the developer accepted (and possibly edited) during triage, drawn
  from all the review steps. Do **not** read the per-dimension reports; anything not
  in `accepted.md` was deliberately dismissed and must not become a comment.
- `./.pr-review/diff.patch` — the branch diff, read **only to anchor comments**
  (see "Anchor each comment to the diff"). Never mine it for new findings; it is
  not a source of issues, just a check on where each accepted finding lands.
- Output: `./.pr-review/pr-comments.md`

## What to produce

Write `./.pr-review/pr-comments.md` as discrete, independently-postable comments.

**Produce actionable comments only — do not write a PR summary.** Summarising the
PR is handled by other tools; this draft contains only the specific, actionable
findings the developer accepted. Do **not** add a `## Summary comment` section, an
overview, or any "what this PR does" preamble.

```markdown
# PR review comments

## Inline / threaded comments
### /abs/path/to/File.ext:42 — <short title>
<one or two sentences: the issue in plain language, phrased as a question or a
specific request the author can respond to. This is the part most readers act on.>

**Details**

<the technical explanation: what the code does now, why it's a problem, the edge
case / requirement / risk involved, and what the expected behaviour is. Use short
paragraphs or a bullet list. Reference specific symbols/lines as needed.>

---

<details>
<summary><b>Fix prompt</b> — paste into an AI coding assistant to address this</summary>

> <a self-contained instruction the author can hand straight to an LLM — see
> "The fix prompt" below>

</details>

### General — <short title>   (NO path:line in this heading)
**Relates to:** `path/to/File.ext` — `methodName()` (around line 42)

<same body shape: summary, then **Details**, then the `---` rule and **Fix prompt**.
Because the location is not part of this PR's diff, the comment cannot be anchored
inline, so the **Relates to** line is what tells the author where to look.>

### ...
```

> Both anchored and general comments live under the single
> `## Inline / threaded comments` heading. The only difference is the `###` line:
> a heading ending in `:<line>` is posted anchored to that line; a heading with no
> `path:line` is posted as an ordinary (unanchored) PR thread. Do **not** add any
> other `##` section (in particular, no `## Summary comment`) — the posting script
> recognises only `## Inline / threaded comments`, and any other `##` line would be
> swallowed into the previous comment's body.

Format the body so it is **easy to skim**: the short summary first, then a
**Details** section, then the **Fix prompt** last, separated from the details by a
`---` rule. Leave a blank line between every heading, paragraph, list, and
blockquote — generous whitespace is what makes the rendered comment readable.
Bold the section labels (`**Details**`, `**Fix prompt**`) exactly as shown; do not
introduce extra `##`/`###` headings inside a comment body (they would confuse the
parser, which splits only on `##`/`###`). Use markdown the author will appreciate —
backticks for code/identifiers, bullet lists for multiple points, fenced code
blocks for short before/after snippets.

For a brief, observational comment with nothing technical to expand, the
**Details** section may be omitted — but keep the summary and (when there's
something to fix) the **Fix prompt**.

### Anchor each comment to the diff

Azure only shows an inline thread usefully when it is attached to a line the PR
actually changed. **Before drafting each comment, verify its location is part of
the branch diff** in `./.pr-review/diff.patch`:

1. Find the finding's file among the patch's `diff --git ... b/<file>` /
   `+++ b/<file>` headers. If the file does not appear in the patch at all, the
   location is **not in the diff**.
2. If the file is present, read its hunk headers — `@@ -old,len +new,len @@`. The
   new-side range a hunk covers is lines `new` through `new + len - 1`. The
   finding's line is **in the diff** if it falls within some hunk's new-side range
   (an added `+` line or a context line shown inside a changed hunk).
3. Otherwise (file unchanged, or line outside every hunk) the location is **not in
   the diff**.

Then:

- **In the diff** → write a normal anchored inline comment: heading
  `### <absolute path>:<line> — <title>`, exactly as before.
- **Not in the diff** → write it as a **general comment**: a `###` entry with **no
  `path:line` in the heading** (so the posting script posts it as an ordinary,
  unanchored PR thread), and put a **`Relates to:`** line at the top of the body
  naming the file, the method/symbol, and the approximate line(s) the comment is
  about. Be specific — this line replaces the lost click-through, so the author can
  still find exactly what you mean.

This keeps every accepted finding — a comment about a pre-existing method the PR
calls but didn't modify simply becomes a clearly-labelled general comment instead
of an inline thread stuck on an unrelated line. When unsure whether a line is
inside a hunk, prefer the general-comment form; a precise `Relates to:` is better
than a mis-anchored inline thread.

### The fix prompt

Every actionable comment ends with a **Fix prompt**: a self-contained instruction
the author can copy and paste into an AI coding assistant (or hand to a teammate)
to resolve the issue. The author may be working in a different checkout from a
later state of the branch, so the prompt must stand on its own without relying on
anything else in this conversation or review.

**Wrap the fix prompt in a collapsible section** so it stays out of the way until
the author wants it. Azure DevOps renders HTML `<details>`/`<summary>` in comment
markdown, so use:

```html
<details>
<summary><b>Fix prompt</b> — paste into an AI coding assistant to address this</summary>

> <the prompt, as a blockquote>

</details>
```

Two formatting rules make the markdown inside render correctly on Azure DevOps:

- Leave a **blank line after the `<summary>...</summary>`** line (and a blank line
  before the closing `</details>`). Without the blank line the blockquote/markdown
  inside the `<details>` will not render.
- Keep the prompt itself as a `> ` blockquote inside the block.

**Every fix prompt must begin with this exact line, verbatim, as its first
sentence** (before the "Where"):

> Verify each finding against current code. Fix only still-valid issues, skip the
> rest with a brief reason, keep changes minimal, and validate.

Then the prompt content must include:

1. **Where** — the file by **repo-relative** path (most portable for the author)
   and the line number and/or the symbol/function/method involved. Repo-relative
   is the path after the repository root; if the accepted finding only gives an
   absolute path, drop the repo-root prefix.
2. **What's wrong and why** — a precise description of the problem and the impact,
   enough that the LLM understands the issue without seeing this review (e.g. the
   edge case missed, the unsafe pattern, the ticket requirement not met).
3. **Enough context to fix it** — the expected behaviour or the constraint that
   must hold, any relevant ticket acceptance criterion, and the desired outcome of
   the change. Don't assume the LLM can see the finding's reasoning — restate what
   it needs.
4. **A verification clause (required)** — end the prompt by instructing the LLM to
   first confirm the issue still applies before changing anything, and to verify
   its fix afterwards. Use wording like:
   > *Before editing, re-read the current code at this location and confirm the
   > issue is still present and this change still applies — the code may have moved
   > on since the review. If it no longer applies, stop and report that instead of
   > editing. After making the change, verify the fix compiles/passes relevant
   > tests and actually resolves the issue without introducing a regression.*

Keep the fix prompt focused on the single concern of its comment — one prompt per
comment, matching the one-concern-per-comment rule. For purely observational notes
that ask a question with no concrete change to make, you may omit the fix prompt;
include it whenever there is something to fix.

For **summary-level** actionable points that have no single location, write them
as **general comments** (a `###` entry with no `path:line` in the heading and a
`Relates to:` line pointing at the relevant area), and give them a fix prompt in
the same self-contained, verify-first style. Do not roll them into a PR summary —
there is no summary comment.

### Worked example of one inline comment

```markdown
### /Users/dev/app/src/main/java/com/pp/UserService.java:88 — Unbounded findAll loads every user

Should this page the query instead of calling `findAll()`? On a large tenant this
looks like it could load the whole `users` table into memory.

**Details**

`exportActiveUsers()` calls `userRepository.findAll()` and filters in Java. For a
big tenant that materialises every row at once — a memory and latency risk, and the
ticket's acceptance criterion only needs *active* users.

- Push the `active = true` filter into the query (`findByActiveTrue`, or a
  `@Query`).
- Stream or page the result rather than building one large `List`.

---

<details>
<summary><b>Fix prompt</b> — paste into an AI coding assistant to address this</summary>

> Verify each finding against current code. Fix only still-valid issues, skip the
> rest with a brief reason, keep changes minimal, and validate.
>
> In `src/main/java/com/pp/UserService.java`, method `exportActiveUsers()` (around
> line 88), the code calls `userRepository.findAll()` and filters for active users
> in memory, which loads the entire `users` table for large tenants. Change it to
> filter in the database (add a `findByActiveTrue()` derived query or an equivalent
> `@Query`) and process the results in a paged or streamed fashion so the whole
> table is never held in memory. The feature only needs active users.
>
> Before editing, re-read the current code at this location and confirm the issue
> is still present and this change still applies — the code may have moved on since
> the review. If it no longer applies, stop and report that instead of editing.
> After making the change, verify it compiles and passes the relevant tests and
> that the export still returns the correct active users.

</details>
```

Guidelines:
- **Phrase as questions or specific requests**, not verdicts. "Should this also
  handle the empty-list case the ticket mentions?" beats "this is broken".
- **One concern per comment.** Don't bundle a test gap and a logic question.
- **Anchor each inline comment** with the finding's location as the heading:
  `### <absolute path>:<line> — <title>`. Keep the absolute `path:line` form from
  the accepted findings — it is IntelliJ-clickable for the reviewer, and the
  posting script converts it to the repo-relative path Azure needs. **Only anchor
  when the location is in the diff** (see "Anchor each comment to the diff");
  otherwise drop the `path:line` from the heading and use a general comment with a
  `Relates to:` line. Summary-level points with no location also become general
  comments — there is no summary comment.
- **Carry only what's in `accepted.md`.** Nothing else.
- **Be concise.** Trim reasoning to what the author needs to act.
- **Keep PII out.** Don't reintroduce names or customer identifiers.

## Output format note

The posting script (`post-to-azure.sh`) parses this file: each `###` heading under
`## Inline / threaded comments` becomes a separate thread, with the `path:line`
from the heading used as the inline anchor. (The script also supports an optional
`## Summary comment`, but this skill does **not** produce one — summaries are out
of scope.) **Keep the `## Inline / threaded comments` heading exact** so the script
can parse the file — everything below a `###` heading (including the **Fix prompt**
blockquote)
is the comment body and is posted verbatim with that comment, which is intended:
the author gets the actionable prompt right on the thread. Return control to the
orchestrator; do not post.
