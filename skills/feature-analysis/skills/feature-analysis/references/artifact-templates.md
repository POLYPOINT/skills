# Artifact templates

Both artifacts are views of `plan-final.md` for a specific audience. Load the
`artifact-design` skill before writing either — it is built into Claude Code, not part of
this repo; if it isn't available in the session, the structures below stand on their own.
Publish each as its own artifact (own file path, own favicon); on later rounds republish to
the same URL with a bumped version `label` (`v2`, `v3`, …) — reviewers bookmark these links.

## 1. Technical deep-dive artifact

**Audience:** the developer/tech-lead reviewing the plan. **Job:** let them verify the
reasoning and answer the open decisions — by number.

Structure (mirrors `plan-final.md`):

1. **Header** — feature name, version, one-line status ("plan for review — N decision
   points open"), and the confidence basis ("consolidated from N research agents + 3
   adversarial critique agents; load-bearing claims fact-checked against code").
2. **Context** — today vs target, the chain hop by hop, team ownership per repo.
3. **One section per feature phase** — each architectural decision presented as:
   verified obstacles → decision → why it survives the critique. Keep file paths and
   class names; this audience wants them.
4. **Work items grouped by repo/team**, each with its named template/precedent.
5. **Sequencing** — what unblocks what, mocks first.
6. **Ranked open decisions / risks** — the review core, as numbered decision points.

### Numbered decision points

Every open decision gets a stable number (**#01, #02, …**) and three parts:

- **The question**, phrased so it can be answered in one sentence
- **Context** — why it matters and what it shapes downstream
- **Dev recommendation** (or "no recommendation — needs product/ops input")

Numbers are stable across versions: once #07 exists, it stays #07 even when resolved
(mark it "✓ decided: …") — reviewers refer to decisions by number in comments, chats, and
follow-up rounds, and renumbering breaks every prior reference.

When answers come back, record them in `plan-final.md` under a dated
**"Review decisions (name, date) — these WIN over anything conflicting below"** section,
propagate into the body, and republish.

## 2. EO briefing artifact

**Audience:** the Epic Owner — product, not engineering. **Job:** give them an honest
picture of what the epic changes for users, and collect the decisions only they can make.

**Language rules:** no class names, repo names, endpoints, or table names — describe
behavior, not implementation ("the approval is recorded permanently", not "an append-only
revision row"). Domain terms the EO uses daily (the feature's own vocabulary) are fine and
should be used. Short sentences; every section skimmable.

Structure (proven in review):

1. **Title + kicker** — the epic in two sentences: what exists today, what it becomes.
2. **What changes** — a side-by-side of _Today_ vs _With this epic_, as a user experiences
   it.
3. **One section per feature phase** — a narrative of what each user role sees and does,
   in order. Where the design makes a promise worth trusting, add a short
   **"What the system guarantees"** list (e.g. "an approval always refers to the exact
   version the employee saw").
4. **Your input — open product decisions** — the questions only the EO can answer. Each:
   the question in plain language, why it matters, and what happens under each answer.
   Keep the technical decision-point numbers (#NN) as small tags so answers map back to
   the plan.
5. **Dev answered — working answers you may override** — product-shaped decisions dev made
   as working assumptions (scope cuts, default behaviors, retention periods). State each
   as: what dev assumed, why, and what changes if the EO decides otherwise. This section
   exists because dev inevitably makes product calls during analysis — hiding them from
   the EO is how epics get re-litigated after implementation.
6. **Dependencies worth knowing** — external factors that shape timeline or scope (other
   teams' deliverables, release-train coupling, translation lead times), in plain language.

Keep the two decision sections rigorously separate. An item moves from "Dev answered" to
resolved only when the EO explicitly confirms or overrides it — never merge it silently
into the plan as settled.

## Bookkeeping after each round

- `plan-final.md` is the single source of truth; artifacts are regenerated views of it.
  Never patch an artifact with content that is not in the plan file.
- Track per round: which decision points were answered, by whom (dev vs EO), and which
  remain open — the artifact headers should state the current count.
- Both artifacts start private. Hand the user both links, say which audience each is for,
  and let them share.
