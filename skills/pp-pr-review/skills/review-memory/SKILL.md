---
name: review-memory
description: Review a pull request for memory problems — leaks, unbounded retention, and inefficient allocation — across Java/JVM (Spring, JPA/Hibernate), Node.js/TypeScript, and Angular (RxJS, DOM). Produces a structured, non-interactive findings report for the orchestrator to triage. Use as the memory-focused analysis step of a PR review.
---

# Memory review

You are analysing a pull request for **memory problems**: leaks, references
retained longer than needed, unbounded growth, and inefficient allocation. You
run as a **sub-agent**: you do not talk to the developer. Your only job is to
read the diff and write a findings report file. The orchestrator presents your
findings to the developer afterwards.

Automated tools (linters, CodeRabbit) already catch trivia. Your value is the
memory reasoning they can't do: what does this change *retain*, and for how
long.

## Inputs

- `./.pr-review/diff.patch` — the change under review
- `./.pr-review/files.json` — changed files (to know which stacks apply)
- The checked-out repo is your CWD, so you can open any file for context.
- Output: `./.pr-review/memory.md`

## How to work

1. Read the diff. Determine which stacks are touched (`.java` → JVM/Spring/JPA;
   `.ts`/`.js` under a Node project → Node; `.ts`/`.html` under Angular →
   Angular).
2. Apply the **catalog below** for the relevant stack(s), plus the cross-cutting
   patterns. Open surrounding code when the diff alone can't tell you whether a
   resource is cleaned up (e.g. is there an `ngOnDestroy`? a `finally`? a
   matching `remove`?).
3. The catalog is **not exhaustive** — also flag memory issues specific to this
   change that are not listed.
4. If the diff uses a framework/library whose memory idioms you cannot
   confidently assess, do **one** focused web search to confirm, cite it in the
   finding, and move on. Do not turn this into open-ended research.
5. Write `./.pr-review/memory.md` using the finding schema. If you find nothing,
   still write the file with a "No memory findings" note and an empty Findings
   section — do not invent concerns.

## Finding schema (shared across all review steps)

Write the report as:

```markdown
# Memory review — findings

> This catalog is not exhaustive. Findings below also include issues not in the
> standard catalog where they apply to this change.

## Summary
<1–3 sentences: overall memory risk of this change.>

## Findings

### MEM-1 · High · High — <short title>
- **Location:** `/abs/path/to/File.java:142`  (range: lines 142–168)
- **Pattern:** <catalog name, e.g. "Un-unsubscribed RxJS subscription"; or "(not in catalog)">
- **What & why:** <plain language: what the code does and the concrete risk — heap growth, OOM, GC pressure, leak across requests, etc.>
- **Suggested comment:** <the PR comment, phrased as a question or specific request the author can act on>
- **Confidence rationale:** <why High/Med/Low — e.g. "couldn't see teardown from the diff; may exist in untouched code">
- **Reference:** <source name + URL>
```

Rules for every finding:
- **Location MUST be an IntelliJ-clickable absolute path** ending in `:line`
  (single line; note any range in prose). Resolve the absolute path from your
  CWD. This is what lets the reviewer Cmd/Ctrl-click straight to the code.
- **Severity** ∈ High / Medium / Low (heap/OOM risk and likelihood).
- **Confidence** ∈ High / Med / Low. Lower it honestly when the fix might live
  in code outside the diff.
- **ID** is `MEM-<n>`, numbered from 1.
- **Order findings by severity (High→Low), then confidence.**
- One concern per finding.

## Catalog — memory patterns to look for

> Not exhaustive. A checklist to start from, not a substitute for reasoning
> about what this specific diff retains and for how long.

### JVM / Java (Spring, JPA/Hibernate)

- **Unbounded cache / collection growth.** `static`/long-lived `Map`/`List`/`Set`
  only ever added to, no eviction/size cap/TTL; `@Cacheable` with no Caffeine/
  Redis bound; reliance on Spring Boot's default (unbounded `ConcurrentHashMap`)
  cache. → `OutOfMemoryError`. Ref: Spring Boot Caching
  https://docs.spring.io/spring-boot/reference/io/caching.html
- **ThreadLocal not removed.** `threadLocal.set(...)` with no `remove()` in a
  `finally`, on pooled (never-dying) threads — leaks the value and can pin a
  classloader. Ref: Oracle ThreadLocal
  https://docs.oracle.com/javase/8/docs/api/java/lang/ThreadLocal.html
- **Static field retaining references.** Static `List`/`Map` or static field
  assigned a large graph and never nulled — GC root for the classloader's life.
  Ref: Oracle Troubleshooting OOME
  https://docs.oracle.com/javase/8/docs/technotes/guides/troubleshoot/memleaks002.html
- **Hibernate first-level cache growth in batch loops.** `persist`/`save` in a
  large loop with no periodic `flush()`+`clear()`; no `hibernate.jdbc.batch_size`;
  a `Session` where a `StatelessSession` fits. Ref: Spring Batch DB readers
  https://docs.spring.io/spring-batch/reference/readers-and-writers/database.html
- **Holding entity graphs / EAGER fetching.** `@ManyToOne`/`@OneToOne` left
  EAGER (the default), `@OneToMany(fetch = EAGER)`; query results stored in
  long-lived fields. Ref: JPA Entity Graphs
  https://docs.oracle.com/javaee/7/tutorial/persistence-entitygraphs.htm
- **Unclosed resources.** Streams/JDBC/`Session`/any `AutoCloseable` used without
  try-with-resources or with `close()` only on the happy path — leaks OS handles
  & native/direct buffers (GC won't reclaim them). Ref: Oracle try-with-resources
  https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html
- **Inefficient allocation in hot loops.** Autoboxing (`Integer`/`Long` in loop
  math, `Map<Integer,…>`), `s += x` String building (O(n²)), `new byte[]`/
  `StringBuilder` allocated inside the loop. → GC pressure. Ref: Oracle String
  https://docs.oracle.com/javase/8/docs/api/java/lang/String.html
- **Classloader leaks.** App class registered into a container/JVM-global
  structure (JDBC driver not deregistered, ThreadLocal pinning an app class) with
  no cleanup → `OutOfMemoryError: Metaspace` on redeploy.
- **Lapsed listener.** `addXxxListener`/`eventBus.register` with no matching
  remove on teardown — publisher strongly holds the listener. Ref: Oracle
  EventListener https://docs.oracle.com/javase/8/docs/api/java/util/EventListener.html
- **Spring singleton holding per-request state.** Mutable instance field on a
  singleton bean that accumulates per-request data — grows for the container's
  life and is a thread-safety hazard. Use prototype/request scope. Ref: Spring
  Bean Scopes https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html

### Node.js / TypeScript

- **EventEmitter listener leaks.** `.on(...)` in a handler/loop with no `.off(...)`
  on cleanup; `setMaxListeners(Infinity)` as a band-aid; re-registering on a
  long-lived emitter each call. Prefer `.once()`; pair on/off. Ref: Node Events
  https://nodejs.org/api/events.html
- **Unbounded in-memory caches/Maps/arrays.** Module-level `Map`/`Set`/array only
  written to, no eviction/TTL/LRU; keyed by unbounded per-request values. Ref:
  MDN WeakMap https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
- **Closures capturing large scopes.** Long-lived callback (stored, registered,
  in `setInterval`) defined where a large Buffer/body/resultset is in scope —
  pins it. Ref: MDN Closures https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures
- **Timers not cleared.** `setInterval` never `clearInterval`'d on shutdown; per-
  request timer with no `clearTimeout`; missing `.unref()` on background timers.
  Ref: Node Timers https://nodejs.org/api/timers.html
- **Stream backpressure / Buffer.** `writable.write` in a loop ignoring its return
  (no `'drain'`); manual `data→write` instead of `pipe()`/`pipeline()`;
  `Buffer.concat` of a whole body instead of streaming. Ref: Node Stream
  https://nodejs.org/api/stream.html
- **Object-keyed strong Maps.** `Map`/`Set` keyed by objects (requests, nodes)
  with shorter lifetime than the Map and no `.delete` — use `WeakMap`. Ref: MDN
  WeakMap (above).
- **Accidental globals / module-cache retention.** Undeclared assignments;
  `global.x` as ad-hoc storage; heavy allocation at module top level (cached for
  the process life). Ref: Node Modules https://nodejs.org/api/modules.html

### Angular (RxJS, DOM)

- **Un-unsubscribed subscription.** `.subscribe(...)` in a component with no
  `takeUntilDestroyed()` / `takeUntil(destroy$)` / `DestroyRef`, and the template
  not using `| async`. Especially on long-lived sources: `router.events`,
  `route.params`, `form.valueChanges`, `statusChanges`, service Subjects. This is
  also an explicit **POLYPOINT house rule** (clean up with `takeUntil(onDestroy)`
  completed in `ngOnDestroy`, or `| async`). Ref: Angular takeUntilDestroyed
  https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed — POLYPOINT Coding
  Guidelines (Frontend)
  https://polypoint.atlassian.net/wiki/spaces/P35/pages/11606949962/Coding+Guidelines+Frontend
- **DOM listeners never removed.** `addEventListener` (esp. on `window`/`document`)
  with no `removeEventListener` in `ngOnDestroy`; anonymous handlers (no ref to
  remove); discarded `Renderer2.listen` un-listen fn. Prefer `AbortSignal`/
  `@HostListener`. Ref: MDN removeEventListener
  https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener
- **Detached DOM nodes.** Element removed from the DOM while a field/array/closure
  still holds it (`this.cachedEl`, `this.nodes.push`) and never nulled. Ref: MDN
  Memory management https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management
- **Component timers not cleared in `ngOnDestroy`.** `setInterval`/recursive
  `setTimeout` polling not cleared; prefer RxJS `interval()` + `takeUntilDestroyed`.
- **Service Subjects never completed; large data in singletons.** `providedIn:
  'root'` service caching large arrays or `BehaviorSubject(largeArray)`/
  `ReplaySubject` never bounded/reset; subjects `.next()`-ed but never
  `.complete()`-ed. Ref: RxJS Subject https://rxjs.dev/guide/subject
- **RxJS operators buffering unboundedly.** `scan` reducing into an ever-growing
  array on an infinite source; `shareReplay()` without `refCount: true` (default
  keeps source + buffer alive); `bufferTime` whose closing notifier never fires.
  Ref: RxJS shareReplay https://rxjs.dev/api/operators/shareReplay
- **`ElementRef`/`ViewChild` held after destroy.** `nativeElement`/`TemplateRef`
  copied into a longer-lived holder (singleton service, static) → detached-DOM
  leak. Ref: Angular ElementRef https://angular.dev/api/core/ElementRef

### Cross-cutting instincts

- **Unbounded growth:** "what bounds this container's growth?" (cap/TTL/eviction)
- **Register-without-deregister:** every `add`/`on`/`subscribe`/`register` needs a
  paired removal on a teardown path.
- **Reference outliving its owner:** short-lived data pinned by a long-lived
  holder — weak references are the cross-cutting fix.
- **Unclosed resources / ignored backpressure:** GC reclaims memory, not OS
  handles or unbounded buffers.
- **Allocation in hot loops:** per-iteration throwaway objects raise GC pressure.

## Guardrails

- Don't flag a leak when teardown may exist outside the diff — mark confidence
  Low and say so in the rationale.
- Don't restate generic linter output. Tie every finding to retention/allocation
  risk in *this* change.
- No verdicts; phrase the suggested comment as a question or specific request.
  The developer decides what's real during triage.
