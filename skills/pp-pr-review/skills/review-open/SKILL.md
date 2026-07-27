---
name: review-open
description: Cross-cutting review step that runs after the focused steps. Connects the developer's already-accepted findings and surfaces concerns that fell between the dedicated steps (backwards-compat, operability, docs, config/migrations). Runs as a non-interactive sub-agent; the open-ended developer-directed part is handled by the orchestrator. Use as the last analysis step before drafting.
---

# Open / cross-cutting review

This is the catch-all analysis step. The earlier steps looked at logic, tests,
security, SQL/JPA, memory, and performance in isolation. Here you (a) connect the
findings the developer has **already accepted** and (b) surface things that fell
between the dedicated steps. You run as a **sub-agent**: you do not talk to the
developer. The orchestrator handles the open-ended "anything else you want
analysed?" conversation separately.

Security and performance now have their own dedicated steps — **do not** re-run
those checklists here. Reference their accepted findings; don't duplicate them.

## Inputs

- `./.pr-review/accepted.md` — the findings the developer accepted during triage
- `./.pr-review/diff.patch` — the change under review
- The checked-out repo is your CWD; open files for context as needed.
- Output: `./.pr-review/open.md`

## What to produce

Write `./.pr-review/open.md` with a short cross-cutting summary and a Findings
section (triageable, shared schema, IDs `OPEN-<n>`).

### Cross-cutting observations
Read the accepted findings together with the diff and note anything that:
- **connects** accepted findings (e.g. a logic gap that's also untested, a
  performance fix that changes a contract),
- **sits between** the dedicated steps and so nobody covered:
  - **Backwards compatibility**: API/contract/schema changes, on-prem vs SaaS
    deployment differences, migration ordering.
  - **Operability**: logging, metrics, error visibility, rollback safety,
    feature flags.
  - **Config & migrations**: new config keys, data migrations, defaults.
  - **Documentation**: behaviour changes that should be reflected in docs or
    runbooks.
- concerns the change **as a whole** rather than any single hunk.

Raise only what genuinely applies to this diff — don't manufacture concerns. An
empty area is fine.

### Findings
Capture each cross-cutting concern as a triageable finding:

```markdown
## Findings

### OPEN-1 · Medium · Med — <short title>
- **Location:** `/abs/path/to/File.ext:NN`  (or "(whole change)" if not anchorable)
- **What & why:** <the cross-cutting concern and why it matters>
- **Suggested comment:** <phrased as a question or specific request>
- **Confidence rationale:** <why this confidence>
```

Finding rules: prefer an **IntelliJ-clickable absolute `path:line`** location;
use "(whole change)" only when the concern truly isn't anchorable. **Severity** ∈
High/Med/Low; **Confidence** ∈ High/Med/Low; **ID** `OPEN-<n>`; **order by
severity, then confidence**; one concern each. If nothing applies, write a "No
cross-cutting findings" note and an empty Findings section.

## Guardrails

- Don't duplicate points already in the accepted findings or covered by the
  dedicated steps (logic, tests, security, sql-jpa, memory, performance) — here
  you connect and fill gaps, you don't repeat.
- If a cross-cutting area keeps producing substantial findings across many
  reviews, that's the signal to propose promoting it to its own dedicated step —
  the team can add a skill, the way security/performance were promoted.
- Stay advisory. The developer decides what matters during triage.
