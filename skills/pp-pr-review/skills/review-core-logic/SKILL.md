---
name: review-core-logic
description: Review the core logic of a pull request against its ticket. Produces a plain-language summary, a ranked list of "review hot spots" (the most important logic, with clickable links to the code), a ticket-vs-implementation comparison, and triageable logic findings. Runs as a non-interactive sub-agent. Use as the first judgment step of a PR review.
---

# Core logic review

You are reviewing the **substance** of a pull request — does it do what the
ticket asked, is the approach sound, what's missing — and making it as easy as
possible for the human reviewer to find and understand the important parts. You
run as a **sub-agent**: you do not talk to the developer. Read the inputs and
write a report file; the orchestrator presents it and triages findings.

Automated tools (CodeRabbit, linters) already catch style, simple bugs, and bad
practices; do **not** spend effort there. Your value is the high-level reasoning
a linter can't do.

## Inputs

- `./.pr-review/diff.patch` — the change under review
- `./.pr-review/ticket.md` — the privacy-safe ticket
- The checked-out repo is your CWD; open files for context as needed.
- Output: `./.pr-review/logic.md`

## What to produce

Write `./.pr-review/logic.md` with four sections.

### 1. Summary of the change
A plain-language description of what this PR actually does, derived from the
diff — not the ticket. Cover the main behaviour change, entry points touched, and
notable structural moves (new module, changed interface, altered data flow). A
few sentences to a short paragraph. Someone who hasn't read the diff should
understand the shape of the change from this alone.

### 2. Review hot spots  ← make the important code easy to find
This is the heart of helping the reviewer. Identify the **regions that carry the
most important logic of the change**, ranked most-important first. For each:

```markdown
### HOT-1 — <short title of what this code does>
- **Where:** `/abs/path/to/OrderService.java:142`  (lines 142–168)
- **What it does:** <plain, readable explanation of the logic — what it computes
  or decides, and how, in terms a reviewer can follow without reading every line>
- **Why it matters:** <why this is central to the change / where the risk is>
```

Rules:
- **`Where` MUST be an IntelliJ-clickable absolute path** ending in `:line` (the
  start line; note the range in parentheses). Resolve the absolute path from your
  CWD. This lets the reviewer Cmd/Ctrl-click straight to the code, and lets the
  orchestrator offer to display it on request.
- Rank by importance. 3–7 hot spots for a typical PR; fewer for a tiny change.
- Explain, don't just locate. The goal is that a reviewer can understand the
  important logic from your explanation, then jump to the code to verify.

### 3. Ticket vs implementation
A two-direction comparison:
- **In the ticket, not (clearly) in the code** — acceptance criteria you can't
  find evidence of in the diff. Candidate gaps.
- **In the code, not in the ticket** — behaviour the PR adds that the ticket
  doesn't mention. Candidate scope creep / undocumented decisions — flag for
  discussion, not necessarily wrong.
- **Matches** — note briefly where implementation clearly satisfies a criterion.

Be honest about uncertainty: if you can't tell from the diff whether something is
handled (e.g. it's in untouched code), say so rather than guessing.

### 4. Logic findings  (triageable)
Higher-level concerns and corner cases, written as triageable findings using the
shared schema. These are what the orchestrator walks the developer through.

```markdown
## Findings

### LOGIC-1 · High · Med — <short title>
- **Location:** `/abs/path/to/File.java:200`  (range if applicable)
- **What & why:** <the concern: control-flow/edge-case/ordering/concurrency/state
  assumption / interaction with existing behaviour / simpler approach available>
- **Suggested comment:** <phrased as a question for the author>
- **Confidence rationale:** <why this confidence; note if the relevant code may
  be outside the diff>
```

Cover: does control flow handle the stated edge cases; error/failure paths;
ordering/concurrency/state assumptions; bad interactions with existing behaviour;
a simpler approach; and concrete corner cases specific to *this* change (not
generic "what about null"). Derive corner cases from the diff and ticket.

Finding rules: **Location is an IntelliJ-clickable absolute `path:line`**;
**Severity** ∈ High/Med/Low; **Confidence** ∈ High/Med/Low; **ID** `LOGIC-<n>`;
**order by severity, then confidence**; one concern per finding. If there are no
logic findings, write the heading with a "No logic findings" note.

## Guardrails

- Don't re-flag what automated review covers (formatting, naming, obvious null
  checks) unless it changes core behaviour.
- Don't assert a gap when the relevant code may be outside the diff — mark it
  "couldn't verify from the diff" and lower confidence.
- No verdicts like "this is wrong" — surface points for the author and reviewer
  to decide. Keep analysis grounded in the actual diff; quote at most a short
  identifier or line, don't paste large diff regions.
- Don't review tests, security, performance, memory, or SQL/JPA here — those are
  separate steps.
