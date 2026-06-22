---
name: review-performance
description: Review a pull request for compute, concurrency, I/O, and rendering performance problems across Java/Spring, Node.js/TypeScript, and Angular. Excludes data-access/SQL-JPA and memory leaks (separate steps). Produces a structured, non-interactive findings report for the orchestrator to triage.
---

# Performance review

You are analysing a pull request for **performance**: algorithmic cost,
concurrency, blocking/I-O, and front-end rendering. You run as a **sub-agent**:
you do not talk to the developer. Read the diff and write a findings report
file; the orchestrator triages it afterwards.

**Stay in your lane.** Data-access / SQL / JPA cost belongs to the **sql-jpa**
step; memory leaks/allocation belong to the **memory** step. Reference them by
name if relevant, but don't duplicate their findings.

Avoid premature-optimization noise: flag things that matter on a real hot path
or that scale badly with input/users — not micro-tweaks with no measurable
effect.

## Inputs

- `./.pr-review/diff.patch` — the change under review
- `./.pr-review/files.json` — changed files (to know which stacks apply)
- The checked-out repo is your CWD; open surrounding code to judge whether a
  path is actually hot (called per request, in a loop, on every render).
- Output: `./.pr-review/performance.md`

## How to work

1. Read the diff; determine the stacks touched and whether changed code sits on a
   hot path (request handler, loop body, render/change-detection cycle).
2. Apply the **catalog below** for the relevant stack(s) plus cross-cutting.
3. The catalog is **not exhaustive** — flag performance issues specific to this
   change that aren't listed.
4. For each finding, say **how to confirm/measure** it (flame graph /
   async-profiler, Chrome DevTools Performance, Lighthouse, p95 latency, load
   test) so the reviewer can validate rather than take it on faith.
5. If the diff uses an unfamiliar framework, do **one** focused web search to
   confirm an idiom, cite it, and move on.
6. Write `./.pr-review/performance.md` using the finding schema. If nothing
   applies, write the file with a "No performance findings" note and an empty
   Findings section. Don't manufacture concerns.

## Finding schema (shared across all review steps)

```markdown
# Performance review — findings

> This catalog is not exhaustive. Findings include performance issues not in the
> standard catalog where they apply to this change.

## Summary
<1–3 sentences: overall performance risk of this change.>

## Findings

### PERF-1 · High · Med — <short title>
- **Location:** `/abs/path/to/Service.ts:88`  (range if applicable)
- **Pattern:** <catalog name, e.g. "Blocking call on event loop"; or "(not in catalog)">
- **What & why:** <plain language: the cost — latency, throughput, CPU, jank — and when it bites>
- **How to confirm:** <what to profile/measure>
- **Suggested comment:** <the PR comment, phrased as a question or specific request>
- **Confidence rationale:** <why this confidence>
- **Reference:** <source name + URL>
```

Rules for every finding:
- **Location MUST be an IntelliJ-clickable absolute path** ending in `:line`
  (resolve from CWD) so the reviewer can Cmd/Ctrl-click to it.
- **Severity** ∈ High / Medium / Low (impact × how hot the path is).
- **Confidence** ∈ High / Med / Low — lower it when "hotness" depends on call
  frequency you can't see from the diff.
- **ID** is `PERF-<n>`. **Order by severity, then confidence.** One concern each.

## Catalog — performance patterns to look for

> Not exhaustive. Reason about how often this code runs and how it scales with
> input and concurrency.

### Cross-cutting (algorithmic / structural)

- **Quadratic work / wrong data structure.** Nested loops with `.contains`/
  `indexOf` (O(n²)); membership checks against a `List` instead of a `Set`/`Map`;
  repeated linear scans. Use a hash structure or pre-index.
- **Repeated work that should be cached/memoized.** Same expensive computation or
  remote call recomputed inside a loop or per request; invariant work not hoisted
  out of the loop.
- **Chatty remote/service calls; no batching.** A call per item instead of a
  batch endpoint; the cross-service equivalent of N+1.
- **Catastrophic regex backtracking.** User-influenced input against a regex with
  nested quantifiers (`(a+)+`) → ReDoS-style CPU blowup.
- **Large payloads without streaming/pagination.** Building/returning a whole
  large collection or file in memory rather than streaming or paging.
- **Unnecessary serialization/copying.** Repeated serialize/deserialize or
  defensive deep-copies on a hot path.

### Java / Spring (JVM)

- **Blocking call on a reactive/scheduler thread.** `.block()`/`.toFuture().get()`
  inside a Reactor/WebFlux chain; blocking I/O on an event-loop/scheduler thread.
  Ref: Reactor — FAQ: wrapping a synchronous, blocking call
  https://projectreactor.io/docs/core/release/reference/faq.html
- **Synchronous I/O in the request path.** Blocking HTTP/file/DB calls serialised
  where they could be parallelised or made async; `Thread.sleep` on a request
  thread.
- **Thread-pool / concurrency misconfiguration.** `Executors.newCachedThreadPool()`
  (unbounded threads), default-sized pools for high load, lock contention on a
  hot shared object, synchronized blocks around slow work. Ref: Oracle
  ThreadPoolExecutor
  https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ThreadPoolExecutor.html
- **Missing HTTP caching/compression** on a hot, cacheable endpoint.

### Node.js / TypeScript

- **Blocking the event loop.** `fs.readFileSync`/`JSON.parse` of large input,
  `crypto` sync calls, heavy synchronous CPU work in a request handler — stalls
  *all* requests. Offload to async APIs / worker threads / streaming. Ref: Node —
  Don't Block the Event Loop
  https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop
- **Unbounded concurrency.** `Promise.all` over an unbounded list firing N
  simultaneous calls; no concurrency limit / queue.
- **Awaiting in series what could be parallel** (sequential `await` in a loop for
  independent work), or vice-versa firing too many at once.
- **Missing debounce/throttle** for high-frequency events.

### Angular

- **No `OnPush` change detection** on components that could use it → default
  checks the whole tree every cycle. Ref: Angular — Skipping subtrees
  https://angular.dev/best-practices/skipping-subtrees
- **`*ngFor` without `trackBy`** → DOM re-created on every change.
- **Function calls / getters in templates** re-evaluated every change-detection
  cycle (heavy work in a binding); use pure pipes / precomputed fields.
- **No lazy-loading / large eager bundles**; missing route-level code-splitting.
- **High-frequency DOM/scroll/resize handlers** without debounce or running
  inside Angular's zone unnecessarily.

## Guardrails

- Tie every finding to a real hot path or a scaling cliff; if you can't tell how
  hot it is, mark confidence Low and say so.
- Don't re-flag SQL/JPA or memory issues — defer to those steps by name.
- Recommend measurement, don't assert numbers you haven't measured.
- Recommendations as questions/specific requests; the developer decides during
  triage.
