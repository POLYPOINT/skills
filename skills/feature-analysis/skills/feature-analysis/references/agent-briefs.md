# Agent briefs & workflow scripts

Templates for the research and critique fan-outs. Both workflows follow the same economy
rules: every `agent()` sets `model: 'opus'`, agents write their full findings to a file in
the working folder, and only a small schema-validated summary flows back into the script.

## Research brief template

Each research agent gets one self-contained brief. It must contain all five parts — agents
have no conversation context, so anything not in the brief does not exist for them.

```
You are researching ONE dimension of a planned feature. Write your findings to a file;
your return value is only a short structured summary.

FEATURE CONTEXT (2–5 sentences: what is being built, what exists today, the target chain)

DIMENSION: <name>
GOAL: <one sentence — what the plan needs to know from this dimension>

QUESTIONS (answer every one; "does not exist" is a valid, valuable answer — prove it):
1. <concrete question>
2. <concrete question>
...

WHERE TO LOOK: <repo paths, module names, known entry points, search terms>

RULES:
- Verify every claim by reading the actual code. Never report from naming or convention
  alone — open the file. If you cannot verify something, say so explicitly.
- Prefer facts that constrain the design: what gets dropped/remapped at a boundary, size
  and timeout limits, which patterns have precedents and which would be net-new.
- When something the plan will need does NOT exist (no endpoint, no library, no config
  precedent), state that as a finding with the searches that prove it.

OUTPUT: write /path/to/<working-folder>/research-<dimension>.md in exactly this format:

# <dimension>

## Summary
One dense paragraph (300–600 words) of verified facts. Name classes, endpoints, tables,
config keys inline. Mark confirmations of suspected facts ("CONFIRMED — ...") and negatives
("NO x exists — ..."). This paragraph is what the plan is built from — make every sentence
load-bearing.

## Key files
- `/abs/path/File.java` — one line: what it is and why it matters to THIS feature
  (template to copy, boundary where fields get dropped, the exact slot for new code, ...)
(15–25 entries, ordered by importance)

Return value: {dimension, summary (<=150 words), open_questions (things you could not
resolve that the plan must treat as open)}
```

### What separates good research from filler

- **Precedent-hunting**: for every piece of new code the feature needs, the agent should
  name the closest existing file that does the same kind of thing. Those become the
  work-item templates in the plan.
- **Boundary behavior**: at every hop, what happens to unknown fields, locales, numeric
  formats, sizes? Silent-drop and silent-rewrite behaviors are exactly the facts that
  invalidate naive designs.
- **Proving negatives**: "no month-based endpoint exists anywhere" or "no PDF library exists
  in either repo" are among the most valuable findings — they mark genuinely new contracts
  and unscoped effort.

## Workflow #1 — research fan-out

```javascript
export const meta = {
  name: 'feature-research',
  description: 'Parallel code-verified research for a feature analysis',
  phases: [{ title: 'Research' }],
};

const SUMMARY = {
  type: 'object',
  properties: {
    dimension: { type: 'string' },
    summary: { type: 'string' },
    open_questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['dimension', 'summary', 'open_questions'],
};

phase('Research');
const results = await parallel(
  args.briefs.map(
    (b) => () =>
      agent(b.prompt, {
        label: `research:${b.dimension}`,
        phase: 'Research',
        model: 'opus',
        schema: SUMMARY,
      }),
  ),
);
const ok = results.filter(Boolean);
log(`${ok.length}/${args.briefs.length} research dimensions completed`);
return { ok, failed: args.briefs.filter((_, i) => !results[i]).map((b) => b.dimension) };
```

Pass the briefs via `args` as a real JSON array: `args: { briefs: [{dimension, prompt}, …] }`.
If a dimension failed, re-run just that one (resume with the same script — completed calls
return cached), then move on; a missing dimension becomes an open item in the plan, not a
reason to stall.

## Critique briefs

All three critique agents get the same preamble:

```
You are critiquing a draft implementation plan for a feature that will drive one or more
quarters of work. Read the draft at <working-folder>/plan-draft.md and the research files
research-*.md in the same folder. You may (and should) read the actual code to check
anything — the repos are at <paths>.

Write your critique to <working-folder>/critique-<name>.md in exactly this format:

# <name>

## Overall
One paragraph: your verdict on the plan through your lens, naming the findings that matter
most.

## Findings
### [blocker|major|minor] <short title>
What is wrong, why it matters, and what the plan should say instead. Grade honestly:
[blocker] = the plan fails or strands data if this ships as written; [major] = expensive
rework or missed scope if discovered late; [minor] = wording/mechanism detail.

*Evidence:* file paths (with line numbers where useful) proving the finding.

Return value: {name, blockers, majors, minors (counts), headline (<=50 words)}
```

Plus one charter each:

**fact-check**

```
CHARTER: Verify every load-bearing claim in the draft against the actual code — class and
file names, migration/version numbers, path constants, annotation semantics, security
roles, config defaults, "X exists / X does not exist" statements. A claim is load-bearing
if a work item or decision rests on it. Report each wrong or imprecise claim with the
correct fact and evidence. Also flag claims that are true but over- or under-attributed
(e.g. blaming a config class for behavior that is also the framework default — which
changes what mitigations are available).
```

**design-skeptic**

```
CHARTER: Attack the plan's recommendations, not its facts. For each architectural decision,
construct the adversarial scenario that breaks it: two actors racing (submit vs approve),
producers on different versions emitting different shapes, one item vs five hundred over a
slow link, data that must render years after the systems that produced it changed or
disappeared, upstream records deleted while references remain. Internal contradictions
between plan sections are prime findings ("§A stores the exact payload, §B says the payload
excludes X — both cannot hold"). For every attack that lands, propose the smallest design
change that survives it.
```

**completeness**

```
CHARTER: Find what the plan does not mention. Sweep the standard blind spots: i18n and
locale flow across every hop (and what locale frozen snapshots keep), error handling and
timeout budgets per hop, pagination and bulk-operation scalability, compliance (encryption
at rest, legal retention, GDPR erasure), user-lifecycle edges (user deleted, never
onboarded, employment ended), test strategy per layer, ops/infra work that lives outside
the repos (buckets, service accounts, monitoring), translation pipelines and their lead
times, docs/API-collection artifacts the team maintains. For each gap: why it matters at
this feature's scale, and the concrete work item or contract requirement to add.
```

## Workflow #2 — critique fan-out

```javascript
export const meta = {
  name: 'feature-critique',
  description: 'Adversarial critique of a draft feature plan',
  phases: [{ title: 'Critique' }],
};

const VERDICT = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    blockers: { type: 'number' },
    majors: { type: 'number' },
    minors: { type: 'number' },
    headline: { type: 'string' },
  },
  required: ['name', 'blockers', 'majors', 'minors', 'headline'],
};

phase('Critique');
const verdicts = await parallel(
  args.critics.map(
    (c) => () =>
      agent(c.prompt, {
        label: `critique:${c.name}`,
        phase: 'Critique',
        model: 'opus',
        schema: VERDICT,
      }),
  ),
);
return verdicts.filter(Boolean);
```

The counts in the verdicts are only a health signal — the real content is in the
`critique-*.md` files, which the main agent must read in full before writing `plan-final.md`.
