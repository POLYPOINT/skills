---
name: review-sql-jpa
description: Review a pull request for inefficient SQL and JPA/Hibernate usage — N+1 queries, missing pagination, over-fetching, bad transaction/fetch strategy, missing indexes. Stays in the data-access lane (general compute performance is a separate step). Produces a structured, non-interactive findings report for the orchestrator to triage.
---

# SQL / JPA review

You are analysing a pull request for **inefficient data access**: SQL statements
and JPA/Hibernate usage that will be slow or won't scale. You run as a
**sub-agent**: you do not talk to the developer. Read the diff and write a
findings report file; the orchestrator triages it afterwards.

**Stay in your lane.** You own the data-access layer: queries, ORM mapping,
fetch strategy, transactions, indexing. General compute/concurrency performance
belongs to the **performance** step, and SQL *injection* belongs to the
**security** step (note it and defer). Don't duplicate those.

## Inputs

- `./.pr-review/diff.patch` — the change under review
- `./.pr-review/files.json` — changed files
- The checked-out repo is your CWD; open repositories, entities, and mappings
  for context (a query's cost often depends on the entity mapping, not the diff).
- Output: `./.pr-review/sql-jpa.md`

## How to work

1. Find data-access changes: `@Repository`, Spring Data repository methods,
   `@Query`, JPQL/HQL/Criteria, `EntityManager`/`Session` calls, `@Entity`
   mappings and fetch annotations, raw SQL / stored-proc calls, migrations.
2. Apply the **catalog below**. Because ORM cost is often invisible in the diff,
   open the entity mappings to judge fetch types and associations.
3. The catalog is **not exhaustive** — flag data-access inefficiencies specific
   to this change that aren't listed.
4. For each finding, say **how to confirm** it (e.g. enable generated-SQL logging
   `spring.jpa.show-sql` / `hibernate.show_sql` or `datasource-proxy`; run
   `EXPLAIN`/`EXPLAIN ANALYZE`). The reviewer may not have run the query.
5. If the diff uses an unfamiliar ORM/driver, do **one** focused web search to
   confirm an idiom, cite it, and move on.
6. Write `./.pr-review/sql-jpa.md` using the finding schema. If nothing applies,
   write the file with a "No SQL/JPA findings" note and an empty Findings section.

## Finding schema (shared across all review steps)

```markdown
# SQL / JPA review — findings

> This catalog is not exhaustive. Findings include data-access issues not in the
> standard catalog where they apply to this change.

## Summary
<1–3 sentences: overall data-access risk of this change.>

## Findings

### SQL-1 · High · High — <short title>
- **Location:** `/abs/path/to/OrderRepository.java:54`  (range if applicable)
- **Pattern:** <catalog name, e.g. "N+1 select"; or "(not in catalog)">
- **What & why:** <plain language: the inefficiency and its scaling cost>
- **How to confirm:** <show-sql / datasource-proxy / EXPLAIN — what to look at>
- **Suggested comment:** <the PR comment, phrased as a question or specific request>
- **Confidence rationale:** <why this confidence>
- **Reference:** <source name + URL>
```

Rules for every finding:
- **Location MUST be an IntelliJ-clickable absolute path** ending in `:line`
  (resolve from CWD). This is what makes it Cmd/Ctrl-clickable for the reviewer.
- **Severity** ∈ High / Medium / Low (latency/scaling impact, data-volume
  sensitivity).
- **Confidence** ∈ High / Med / Low — lower it when the cost depends on mapping
  or data volume you can't see.
- **ID** is `SQL-<n>`. **Order by severity, then confidence.** One concern each.

## Catalog — SQL / JPA inefficiency patterns

> Not exhaustive. Reason about the actual queries this change will issue and the
> data volumes they run against.

### JPA / Hibernate

- **N+1 select.** A query loads N parents, then a query per parent fetches a
  lazy association (loop over results touching `parent.getChildren()`; lazy
  association rendered/serialized). Fixes: `JOIN FETCH`, `@EntityGraph`,
  `@BatchSize` / `hibernate.default_batch_fetch_size`. Confirm via generated-SQL
  count. Ref: Hibernate ORM User Guide §12 Fetching
  https://docs.hibernate.org/orm/current/userguide/html_single/Hibernate_User_Guide.html#fetching
- **EAGER fetching by default.** `@ManyToOne`/`@OneToOne` left EAGER (the JPA
  default), `@OneToMany(fetch = EAGER)` — drags the whole graph on every load and
  causes accidental joins. Prefer LAZY + explicit fetch. Ref: as above.
- **`LazyInitializationException` / OSIV reliance.** Lazy access outside the
  session; reliance on `spring.jpa.open-in-view=true` (on by default) hiding N+1
  into the view layer. Fetch what you need in the transaction instead. Ref:
  Spring Data JPA
  https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html
- **Cartesian product / `MultipleBagFetchException`.** Two `JOIN FETCH` on
  collections in one query → row explosion (or the exception for `List` bags).
  Fetch one collection per query, or use `@BatchSize`/separate queries. Ref:
  Hibernate User Guide (above).
- **Unbounded result set / missing pagination.** Repository method returning
  `List<…>` for a potentially large table; `findAll()`; no `Pageable`/
  `setMaxResults`. Add pagination or streaming. Ref: Spring Data JPA paging
  https://docs.spring.io/spring-data/jpa/reference/repositories/query-methods-details.html
- **Entity fetched when a projection would do.** Loading full entities (and their
  graphs) just to read a few fields / return a DTO. Use interface or class
  (constructor) projections. Ref: Spring Data Projections
  https://docs.spring.io/spring-data/jpa/reference/repositories/projections.html
- **One-by-one writes instead of batch.** Loop of `save`/`persist`/`merge`
  without batching; no `hibernate.jdbc.batch_size`; updates/deletes row-by-row
  where a single bulk JPQL `update`/`delete` (or `saveAll` with batch) fits.
- **`@Transactional` misuse / long transactions.** Missing `@Transactional` (read
  done in multiple connections), `readOnly` not set for reads, or a transaction
  spanning slow external calls (HTTP, message publish) holding a DB connection.
- **Page count overhead.** `Page<…>` issues an extra `count(*)`; if the total
  isn't needed, return `Slice<…>` instead. Ref: Spring Data return types
  https://docs.spring.io/spring-data/jpa/reference/repositories/query-return-types-reference.html
- **In-memory pagination (`HHH000104`).** Pagination applied after a collection
  `JOIN FETCH` forces Hibernate to read all rows and paginate in memory.
- **POLYPOINT house rule — "Use JPA repositories wisely".** Derived query methods
  (method-name queries) are fine for simple lookups (`SELECT … WHERE id = :id`),
  but for joins or sub-selects use an explicit `@Query` (JPQL) rather than a long,
  unreadable derived method name. Flag derived methods encoding complex
  joins/conditions. Ref: POLYPOINT Coding Guidelines (Backend)
  https://polypoint.atlassian.net/wiki/spaces/P35/pages/11564285957/Coding+Guidelines+Backend

### SQL (raw / stored procedures)

- **`SELECT *` / fetching unused columns** — extra IO and prevents covering
  indexes; select only needed columns.
- **Missing index on filtered/joined columns** — `WHERE`/`JOIN`/`ORDER BY` on
  unindexed columns → full scans. Confirm with `EXPLAIN`. Ref: Use The Index, Luke
  https://use-the-index-luke.com/
- **Non-sargable predicates** — a function on the column (`WHERE UPPER(name)=…`,
  `WHERE DATE(ts)=…`), implicit type conversion, or leading-wildcard `LIKE '%x'`
  defeats indexes.
- **Deep-offset pagination** — `OFFSET 100000 LIMIT 20` scans and discards; use
  keyset/seek pagination.
- **Chatty per-row queries in application code** — the raw-SQL equivalent of N+1.
- **String-built SQL** — flag the *efficiency* angle (no plan caching from
  non-parameterized queries); the injection risk is the security step's call.

## Guardrails

- ORM cost depends on mapping and data volume — when you can't see those, mark
  confidence Low and recommend confirming via generated SQL / `EXPLAIN` rather
  than asserting.
- Don't re-flag general performance or security issues — name them and defer to
  those steps.
- Recommendations, phrased as questions/specific requests; the developer decides
  during triage.
