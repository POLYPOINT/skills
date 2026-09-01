---
name: feature-analysis
description: Use when the user asks for a deep feature analysis, feasibility study, or pre-development implementation plan for a new feature or epic — "analyze this feature", "deep dive on this epic", "how would we build X", "prepare a feature analysis", "Zeitausweis/Timesheet-style analysis" — before any code is written. Runs the whole analysis as token-capped Workflow (ultracode) fan-outs with Opus subagents — parallel code-verified research, a consolidated plan, adversarial critique (fact-check, design-skeptic, completeness) — and publishes two review artifacts, a technical deep-dive with numbered decision points and a plain-language Epic Owner (EO) briefing. Do NOT use for reviewing existing code, for researching a single codebase topic (research skill), or for implementing a ticket (dev-ticket skill).
metadata:
  version: 1.0.0
---

# Deep feature analysis

Turn a feature or epic idea into a code-verified implementation plan **before** development
starts, and package it for the two audiences that must sign it off:

1. **`plan-final.md`** — the canonical plan (working file, source of truth)
2. **Technical deep-dive artifact** — the plan as a published page for dev/tech-lead review,
   with numbered decision points
3. **EO briefing artifact** — the same epic in plain language for the Epic Owner, separating
   the product decisions that are genuinely theirs from the ones dev already answered

The method was distilled from a real epic analysis that survived two review rounds:
parallel research agents establish verified facts, the main agent synthesizes a draft,
adversarial critique agents attack it, and only what survives becomes the plan. The value
comes from two habits enforced throughout: **every load-bearing claim is verified against
actual code** (file paths as evidence), and **recommendations are attacked before they are
published** (concurrency races, version skew, scale, multi-year retention).

## Orchestration & token economy (non-negotiable)

- **All subagent fan-outs run through the Workflow tool** (ultracode) — never ad-hoc Agent
  calls. Invoking this skill is the user's explicit opt-in to the Workflow tool for these
  fan-outs. Load the `workflow-authoring` skill before writing each script.
- **Every `agent()` call sets `model: 'opus'` explicitly.** The analysis gets its breadth
  from parallelism and adversarial structure, not from model tier — and the main session may
  run a pricier model that the agents must not inherit. This is what keeps a nine-agent
  analysis affordable.
- **Caps:** at most 6 research agents and exactly 3 critique agents. If a research agent
  returns null (skipped/died), re-run that one dimension once, then proceed without it and
  say so in the plan.
- **Agents write findings to files and return only a small structured summary.** The heavy
  content stays on disk for the main agent to read selectively; agent return values must not
  flood the main context.
- **Synthesis is main-agent work.** The draft plan, the final plan, and both artifacts are
  written by you, not delegated — they need the full conversation context, the user's review
  decisions, and judgment about what is load-bearing. Never spawn a "consolidator" agent.

## Phase 0 — Scope intake

Collect the feature description from wherever it lives: Jira epic/ticket, the conversation,
Confluence pages, mockups. Establish before spending any workflow tokens:

- What exists **today** (the thing being replaced or extended), and where it lives
- What is being built, and whether it splits into phases (e.g. read-only display first,
  write/approval flow second) — phases structure the whole analysis
- Which teams own which repos in the chain, and which parts are "ours"
- Known constraints and anything the user already flagged as risky or undecided

Create a working folder for the analysis **outside any repo** — e.g.
`~/.claude/projects/<project>/<feature-slug>-analysis/` or a sibling of the repo — and keep
every produced file there. These files are working documents, never committed.

If the input is too thin to choose research dimensions (you can't name the closest existing
analog, or don't know which systems the feature touches), ask the user now — one round of
questions here is far cheaper than a mis-aimed research fan-out.

## Phase 1 — Choose research dimensions

Pick **4–6 research dimensions**, each answerable independently by one agent reading code.
Draw from this menu, then merge or split until each dimension is one coherent investigation:

1. **The closest existing analog**, traced end-to-end — the feature the new one will mirror,
   followed through every layer (UI → BFF → services → integrations). This is reliably the
   most valuable dimension: it yields the template files, the naming conventions, and the
   hop-by-hop constraints the new feature inherits.
2. **The current/legacy implementation** of what is being replaced — including proving
   negatives ("no code for X exists in system Y today"), which define what is genuinely new.
3. **Each integration boundary the feature crosses** (gateway, tunnel, third-party API) —
   what passes through today, what gets remapped, dropped, or cached, and the boundary's
   limits (payload sizes, timeouts, locale/header handling).
4. **Each infrastructure capability the feature will need** — persistence patterns and
   migration numbering, scheduled/async job frameworks, feature-flag systems, blob/archive
   storage, auth/permission models, notification infrastructure. One dimension can bundle
   several related capabilities.
5. **Anything the user flagged** as risky, unknown, or contested.

Write one research brief per dimension using the template in
[references/agent-briefs.md](references/agent-briefs.md) — concrete questions, repo paths to
search, and the required output format. Vague briefs produce vague research; the brief
should read like a checklist the agent can finish.

## Phase 2 — Research fan-out (Workflow #1)

Run all research agents in one Workflow script: a single `parallel()` over the briefs, every
agent `model: 'opus'`, each writing `research-<dimension>.md` into the working folder and
returning `{dimension, summary, open_questions}` via schema. The worked script is in
[references/agent-briefs.md](references/agent-briefs.md).

When the workflow returns, **read every research file in full** before synthesizing.
The returned summaries tell you the workflow succeeded; the files are the actual input to
the plan.

## Phase 3 — Draft plan (main agent)

Write `plan-draft.md` yourself. Structure:

- **Context** — what exists today and the target architecture, verified facts only
  (prefix them "Verified:"); name the chain hop by hop.
- **One section per phase of the feature**, each leading with its hardest architectural
  decision: state the verified obstacles first, then the recommendation and why it survives
  them. Decisions that hinge on unverifiable or product-level input go into the open list
  instead of being silently assumed.
- **Work items grouped by repo/team**, each naming its template/precedent (an existing
  file, class, commit, or PR that does the same kind of thing) — a work item without a
  precedent is a guess.
- **Sequencing** — what unblocks what, including mocks/stubs that decouple teams.
- **Open decisions** — everything unresolved, honestly listed.

Two rules keep the draft honest: every claim must be traceable to a research file or your
own verification, and recommendations must be visibly labeled as recommendations, not
smuggled in as facts. The critique agents will check both.

## Phase 4 — Adversarial critique (Workflow #2)

Run the second Workflow: exactly **3 critique agents** in one `parallel()`, all
`model: 'opus'`, each receiving the draft plus the research files:

- **fact-check** — re-verify every load-bearing claim against the actual code; every
  finding cites file-path evidence.
- **design-skeptic** — attack each recommendation with adversarial scenarios: two-actor
  races, version skew between producers, scale (hundreds of items where the plan tested
  one), multi-year retention, deleted upstream data.
- **completeness** — hunt for missing cross-cutting concerns: i18n/locale handling, error
  handling and timeouts, pagination, bulk-operation scalability, compliance/retention,
  user-lifecycle edge cases, test strategy, ops/infra work outside the repo, translation
  lead times.

Each writes `critique-<name>.md` with findings graded `[blocker]` / `[major]` / `[minor]`
and an `*Evidence:*` line per finding. Full briefs and the script are in
[references/agent-briefs.md](references/agent-briefs.md).

## Phase 5 — Final plan (main agent)

Read all three critiques and fold them into `plan-final.md`:

- Every **blocker** is either resolved in the design (state the revised decision and why)
  or promoted into the ranked open-decisions list — never dropped, never left as a footnote.
- **Majors** are folded into the affected sections or ranked as open decisions.
- **Minors** fix wording/mechanism details in place.
- End with **"Ranked open decisions / risks"** — a numbered list ordered by how much of the
  plan each one shapes. This list is the backbone of both artifacts.
- Header states the sources ("N research agents + 3 critique agents, fact-check verified
  claims against code") so a reader knows the confidence basis.

`plan-final.md` stays the single source of truth from here on; the artifacts are views of it.

## Phase 6 — Publish the two artifacts

Load the `artifact-design` skill before writing each artifact. Structures, tone rules, and
the numbered-decision-point mechanism are specified in
[references/artifact-templates.md](references/artifact-templates.md).

1. **Technical deep-dive** — the full plan for dev/tech-lead review. Its defining feature:
   every open decision is a **numbered decision point (#01, #02, …)** carrying the question,
   the context, and dev's recommendation, so reviewers can answer by number and answers can
   be folded back without ambiguity.
2. **EO briefing** — the epic in plain language for the Epic Owner: no code identifiers, no
   repo names. It must clearly separate **"Your input"** (open product decisions only the EO
   can make) from **"Dev answered"** (product-shaped calls dev made as working assumptions,
   which the EO may override).

Both start private — hand the user both links and say which audience each is for.

## Phase 7 — Review loop

Reviews come back as answers to numbered points. For each round:

1. Record the answers in `plan-final.md` under a dated section — e.g.
   **"Review decisions (name, date) — these WIN over anything conflicting below"** — so
   later readers never have to guess which statement is current.
2. Propagate the decisions into the affected sections and prune the open-decisions list.
3. Republish both artifacts **to the same URLs** (pass `url`, bump the version `label`);
   new links would orphan reviewers' bookmarks.
4. Keep dev-side and EO-side decisions visibly separate — the EO briefing must keep flagging
   dev-answered product decisions until the EO has actually confirmed them.

When the session ends with the analysis still in review, offer to save a project memory
pointing at the working folder, both artifact URLs, the decisions taken so far, and the next
step — the review loop usually spans days and multiple sessions.
