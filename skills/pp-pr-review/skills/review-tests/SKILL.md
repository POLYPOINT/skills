---
name: review-tests
description: Review the tests in a pull request — useless/weak tests, missing coverage for changed behaviour, and whether integration tests are warranted. Runs as a non-interactive sub-agent producing a triageable findings report. Use as the test-focused judgment step of a PR review.
---

# Test review

You are judging the **tests** in a pull request. You run as a **sub-agent**: you
do not talk to the developer. Judge test quality from the diff, write a report
file; the orchestrator triages the findings afterwards. You do not need the
ticket or the logic findings here.

## Inputs

- `./.pr-review/diff.patch` — the change under review (includes test changes)
- The checked-out repo is your CWD; open test files and the code under test for
  context as needed.
- Output: `./.pr-review/tests.md`

## What to produce

Write `./.pr-review/tests.md` with a short summary and a Findings section. Each
test concern is a triageable finding using the shared schema.

```markdown
# Test review — findings

## Summary
<1–3 sentences: overall state of the tests in this change.>

## Findings

### TEST-1 · Medium · High — <short title>
- **Location:** `/abs/path/to/FooTest.java:31`  (range if applicable)
- **Category:** <Useless/weak | Missing | Integration>
- **What & why:** <the issue and the real risk it leaves uncovered or the value it fails to add>
- **Suggested comment:** <phrased as a question or specific request — what to add, change, or remove>
- **Confidence rationale:** <why this confidence>
```

Finding rules: **Location is an IntelliJ-clickable absolute `path:line`** (resolve
from CWD — for a *missing* test, point at the untested code path); **Severity** ∈
High/Med/Low; **Confidence** ∈ High/Med/Low; **ID** `TEST-<n>`; **order by
severity, then confidence**; one concern per finding. If there are no findings,
write a "No test findings" note and an empty Findings section.

Look for these three categories:

### Useless or weak tests
Tests in the diff that don't earn their place:
- Assert nothing meaningful (only that no exception was thrown when behaviour
  should be checked), or assert on mocks rather than real outcomes.
- Duplicate coverage already provided by another test in the change.
- So tightly coupled to implementation detail they'll break on any refactor
  without catching real regressions.
- Name claims one thing, body checks another.

Name the test and say why it's weak and what would make it worthwhile (or whether
to remove it).

### Missing tests
Behaviour introduced or changed by the diff with no corresponding test. Work from
the changed code paths:
- New branches/conditions/error paths with no test exercising them.
- Boundary and edge values implied by the change.
- The specific corner cases the change is *meant* to handle.
- Regression risk: behaviour the change could plausibly break, unpinned by a test.

Be concrete about *what* to test, not just "add more tests".

### Integration tests
Assess whether unit tests suffice or the change warrants integration-level
coverage — crosses a service boundary, touches persistence, changes an API
contract, or coordinates components whose interaction is the actual risk.
Recommend for/against with the reason. If integration tests already exist for the
area, note whether they cover the change. Capture the recommendation as a finding
(or a one-line note in the summary if it's clearly not warranted).

## POLYPOINT test guidelines

The team's Coding Guidelines say **good tests are required to approve a PR**, and
give a what-to-test strategy. Use it to judge whether the *right kind* of test is
present, not just whether some test exists:

| Code under test | Expected test kind |
|---|---|
| Business logic / helper / utility classes | **Unit tests**, thorough (used everywhere) |
| Services | **Integration tests** with a fully-loaded Spring app (key cases) |
| Controllers | **Integration tests with a test slice** (endpoint exists, args passed through, (de)serialization) |
| Feign clients | **Integration tests with a test slice** (correct endpoint, (de)serialization) |
| Microservice interactions | **Scenario tests** over typical user flows |
| Angular components / directives / services | **Unit tests**; **Cypress** for UI |

Also flag: tests containing complex logic (should be simple/readable, use helper
methods), and changes that add only positive tests where a **negative** test
matters (the guidelines call for both). Test naming follows
`unitOfWork_stateUnderTest_expectedBehavior`. Ref: POLYPOINT Coding Guidelines
(Backend) https://polypoint.atlassian.net/wiki/spaces/P35/pages/11564285957/Coding+Guidelines+Backend

## Guardrails

- Don't demand exhaustive coverage for its own sake. Tie every "missing test" to
  a real risk in the changed behaviour.
- Don't restate what a coverage tool reports as uncovered lines unless you can say
  *why* that path matters.
- Recommendations, not mandates — the developer decides during triage.
