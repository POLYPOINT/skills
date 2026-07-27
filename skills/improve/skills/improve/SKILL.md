---
name: improve
description: Use when the user wants to reflect on how the skills used in this session performed and file improvement plans — typically invoked as /improve right after a skill-driven task (e.g. /playwright-e2e … then /improve), or as /improve <skill-name> to focus on one skill. Uploads concrete, actionable plans as self-contained HTML pages to Whetstone for asynchronous human review.
argument-hint: '[skill-name]'
disable-model-invocation: true
compatibility: Requires cloudflared for uploads (brew install cloudflared) and an email covered by the Whetstone Access policy (@polypoint.ch, @polypoint.de, or allow-listed).
metadata:
  version: '1.0.0'
---

# Improve — Whetstone reflection pass

Review how the skill(s) used in this session performed and upload concrete improvement plans to
[Whetstone](https://whetstone.screamxy.workers.dev), the review queue for self-improving skills.
This is about the skills' instructions, not about the task itself — do not redo or re-verify the task.

**Usage:** `/improve` (review every skill used this session) or `/improve <skill-name>` (review one skill).

## 1. Identify the skills to review

- If `$ARGUMENTS` names a skill, review only that skill.
- Otherwise, scan the current conversation for every skill that was invoked (Skill tool calls,
  `<command-name>` blocks) and review each of them.
- If no skill was used this session and none was named, say so in one line and stop.

## 2. Reflect

For each skill, ask:

- Did the skill give wrong, outdated, or confusing instructions?
- Did the session require figuring something out that the skill should have stated?
- Was a step unnecessary, or was an important step missing?

Only **concrete, actionable** improvements count — "could be clearer" without a specific edit is not
a plan. If nothing noteworthy came up for any skill, say so in one line and stop; do not upload filler.

## 3. Plan format

Write each plan as a **self-contained HTML page** (not Markdown) so a human can skim it quickly in
the Whetstone viewer:

- Inline CSS only, no external resources, no JavaScript required.
- Structure: **What happened** (1-2 sentences of session context), **Problem** (what the skill got
  wrong or was missing), **Proposed change** (the concrete edit, ideally with a before/after diff of
  the skill text), **Impact** (why it's worth doing).
- Keep it under one screen of reading. One plan per distinct improvement.

### Skills you don't own (third-party plugins, marketplace skills)

For a skill the team cannot edit directly, the plan may have to seed a **fork** instead of an edit,
and the reviewer won't have this session's context. Make the plan self-sufficient — capture this
while the skill's full text is still loaded in context:

- Record provenance: plugin/marketplace name, skill version (frontmatter `metadata.version` if
  present), and where it was installed from.
- Quote the exact original text of every section being changed — verbatim, not paraphrased — so the
  change can be applied without the original file at hand.
- If the change is substantial or a fork is the likely outcome, append the **complete revised
  SKILL.md** at the bottom of the plan inside a collapsed
  `<details><summary>Full revised SKILL.md</summary><pre>…</pre></details>` block (HTML-escape the
  content). The one-screen rule applies to the visible part; the plan body limit is 256 KB, which is
  far more than any SKILL.md.

## 4. Upload

Whetstone lives at `https://whetstone.screamxy.workers.dev`. No configuration is needed —
authentication is a Cloudflare Access session via `cloudflared` (the same email One-time-PIN login
humans use; no API keys exist).

If `cloudflared` is not installed or its token comes back empty, do NOT retry in a loop. Show the
plan(s) inline instead and tell the user: "run
`cloudflared access login https://whetstone.screamxy.workers.dev` to enable uploads."

Write each plan to a temporary file (e.g. `plan.html`) first — do **not** try to hand-escape the
HTML into a JSON string. Then upload it:

```bash
python3 - <<'PY'
import json, pathlib, subprocess, urllib.request

base = 'https://whetstone.screamxy.workers.dev'
token = subprocess.run(
    ['cloudflared', 'access', 'token', f'-app={base}'],
    capture_output=True, text=True,
).stdout.strip()
body = json.dumps({
    'skill': '<skill-name>',
    'title': '<one-line summary of the improvement>',
    'html': pathlib.Path('plan.html').read_text(),
}).encode()
req = urllib.request.Request(
    base + '/api/plans',
    data=body,
    headers={'cf-access-token': token, 'Content-Type': 'application/json'},
)
print(urllib.request.urlopen(req).read().decode())
PY
```

The response is `{"id": "…", "url": "…"}` — `url` is the human viewer link. **Include every uploaded
plan's url in the final message** so the user can review each with one click.

Plans are reviewed asynchronously by a human. When a plan is implemented (or rejected), it is
deleted from Whetstone — the skill file itself is the durable artifact, plans are just the queue.
