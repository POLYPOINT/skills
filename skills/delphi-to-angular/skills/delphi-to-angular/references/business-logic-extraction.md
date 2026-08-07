# Business-Logic Extraction (Delphi P2 → Angular + MSW → Java)

> Counts, file paths, and repo anecdotes in this document are a snapshot from the 2026-08 analysis of the P2 and pp-services repos. Treat them as recognition patterns and evidence for the method — re-verify any specific file or number before relying on it.

## Why this exists

The migration is frontend-first: the Angular app is built against MSW mock handlers, and those handlers are later handed to the Java backend team as the de-facto specification. Business rules are not UI, so they never land in Angular components — and if the MSW handler is plain CRUD, they never reach the backend team either. The rule is silently lost, and **absence is invisible**: an unwritten rule and a nonexistent rule look identical in a handler file.

The handoff chain, proven by git history in the saas repo, is serialized and one-directional: the OpenAPI spec and the Java service are hand-written **from** the mock and its fixtures roughly eight weeks later, by someone who did not write the mock (e.g. `shift-group.handlers.ts` 2026-05-14 → `api-shift-groups.yaml` + `SaasShiftGroupsService` 2026-07-08, whose commit message cites the mock, the frontend fixtures, and an Azure DevOps PR thread as its sources). **Corollary: the handler is the spec. Whatever is in it at time T becomes Java at T+8 weeks; whatever is not, does not.**

### Worked failure: the shift-palette validity chain

The canonical lost rule — "a shift can have multiple palette definitions, but their validity ranges must not overlap" — is **not a validation rule in P2 at all**. No overlap error message exists anywhere in the codebase. The invariant is produced by three cooperating mechanisms:

| #   | Mechanism                                                        | Where                                                                                                                      | What it does                                                                                                                                                              |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `UNIQUE INDEX XAKDIENST_DETAIL (pa_code, knoten_id, gueltig_ab)` | `P2/shared/db/ecbern/create/main_ecbern.sql`                                                                               | At most one definition per (shift, node) per **start** day. `gueltig_bis` is in no constraint.                                                                            |
| B   | `ECBERN.SyncDienstDetailLookup(knotenId, paCode)`                | `P2/shared/db/ecbern/procs/SyncDienstDetailLookup.sql`, called from `u_dstass.pas:833-835`, `:925-927`, `udstdet.pas:3609` | After **every** write, re-derives `gueltig_bis` for every row as `MIN(later gueltig_ab) − 1` or 2999-12-31. `gueltig_bis` is a materialized lookup column, not user data. |
| C   | UI chaining                                                      | `fEditDienstPalette.pas:350-359`, `fEditDienstGlobal.pas:296-303`                                                          | Committing row N's end date immediately writes row N+1's start = end + 1.                                                                                                 |

Overlap is impossible **by construction**. A naive "@backend-rule: validity ranges must not overlap" comment would have been actively harmful: a backend team reading it builds an overlap _validator_ — and then rejects a legal edit (moving a boundary) that P2 accepts and silently repairs. The correct handoff is "end dates are derived; recompute the chain after every write." Any mechanism that only carries a one-line prose summary is a mechanism that ships the wrong rule. This is why rule cards (below) require the mechanism, the Delphi evidence, and a test sketch — not just a statement.

The rule was lost at **analyze time**: the message-oriented PAS sweep is blind to a rule that emits no message, mechanism (B) lives in a `.sql` file no form references, and mechanism (A) lives in Liquibase. Everything downstream (a singular `validity` field in the wire model, a mock store keyed on `paCode` alone, CRUD-only handlers) was a consequence.

## Tooling caveats — read before grepping

Get these wrong and every sweep silently under-reports:

- **`export LC_ALL=C` first.** P2 sources are ISO-8859-1/CP1252. Under a UTF-8 locale, grep skips them as binary: an unprefixed run reported 592 of 1,991 `.pas` files containing `begin`; with `LC_ALL=C` it is 1,708.
- Use `command grep` (a `ugrep --ignore-files` alias silently skips most of the tree), or `rg --no-ignore --text`.
- DFM string literals split across physical lines with a trailing `' +`. Re-join continuations and unescape `''` / `#39` **before** matching, or predicates straddling the join are missed.
- Grep in German. Rule verbs: `darf`, `muss`, `kann nicht`, `nicht erlaubt`, `bereits`, `ueberschneid`, `ungueltig`, `Regel`, `Pruefung`, `gueltig`, `Abschluss`, `Trigger`, `Berechnung`, `Rundung`.
- `grep -rnE '(PP|B)-[0-9]{3,5}'` — ticket references sit next to almost every non-obvious rule _and_ next to commented-out earlier versions of it (the rule's relaxation history).
- Skip `delphi/tools/` — third-party JCL/JVCL code.

## Where P2 hides business logic — 18 location classes

Ordered by risk-of-loss (how likely a form-centric conversion is to miss the class), not by frequency. For each: how to recognize it, what it holds, and the default target layer.

1. **Oracle procedures / functions / packages** — `StoredProcName =` in DFMs (383 `TOraStoredProc` components), `BEGIN X(:…); END;` in PAS/DFM SQL, inline functions `(Get|Fn|Is)[A-Za-z]+\(:` in SELECTs. ~251 distinct schema-side routines under `shared/db/<schema>/procs/`. Holds derivations, resolutions, the entire payroll (Abrechnung) engine. **No Delphi source exists — a form-only sweep sees nothing.** Target: backend.
2. **DB constraints and unique indexes** — Liquibase `INDEX_*.xml` (`unique="true"`), `CONSTRAINT_*.xml`; `main_<schema>.sql` in P2. The schema is constraint-poor (ECBERN: 311 PKs but 2 unique constraints, 3 FKs, 1 CHECK; the Postgres SaaS baseline: 0 FKs, 0 triggers, 2 CHECKs), so every unique index that _does_ exist is deliberate. **The tell:** a unique key on a _start_ date with an unconstrained end date means the end date is derived — find the procedure that derives it. Target: backend.
3. **Triggers** — grep German comments naming `td_*` / `TIUD_*` triggers; `ALTER TRIGGER … DISABLE` in DFM SQL. 2,294 ERwin-generated triggers historically carried referential integrity. **Critical: 431 of 602 ECBERN triggers begin `if sys_context('USERENV','CLIENT_PROGRAM_NAME') = 'JDBC Thin Client' then return;` — they do not fire for the Java backend.** Every rule they carry (including genuine ones like the closed-payroll-period lock) must be re-homed explicitly. Target: backend, always explicit.
4. **Embedded SQL in DFMs** — `SQL.Strings` in 261 of 1,027 DFMs, ~11,500 lines. WHERE clauses encode validity-date resolution (`max(gueltig_ab)`, `BETWEEN`), magic status codes, eligibility. Target: backend read-model.
5. **Dynamic SQL** — `SQL.Text :=` (443 files), `MacroByName` (71 files). **The if/else choosing the macro is the rule**; the final statement never exists as a literal. Target: backend.
6. **Checker classes** — the `PlaChk.pas` orchestrator + fifteen `uPlanCheck*.pas` units + `T*Checker` classes + reusable `IConditionChecker.DoCheck(cond, msg)` chains. (`dmplachk.pas` itself is a near-empty shell — the SQL is in `dmplachk.dfm`.) Target: backend, sometimes both.
7. **DB-stored rule parameters** — `IPEPConflictSettings.ReadFor(nodeId)`: thresholds resolved per hierarchy node at runtime. The code holds the rule _shape_; the DB holds the numbers. Target: backend + config data.
8. **Tenant config / feature flags** — `PEPOptions.` (812 hits), `objSpital.` (142), GLOBALEINSTELLUNGEN. Which rules are _active_ is per-tenant DB data — the effective rule set cannot be enumerated from code alone. Target: backend.
9. **Constants and sentinels** — `pepConst.pas`, `intfPlanCheck.pas`. `cInfiniteDate = 401768` (= 2999-12-31) means "open-ended", **not NULL**; `-1` means "rule switched off"; severity ladder `cCheckIgnore=-2 … cCheckIllegal=2`. These cross the wire — state the mapping decision explicitly. Target: both.
10. **Magic status codes / implicit state machines** — `INDIKATOR IN ('DE','WE','DA','WA','NA')`, `typ = 'A'`, `resourcentyp = 'P'`, `ID > 0` vs `ID < 0`. The legal transitions live in scattered event handlers. Target: backend.
11. **Temporal validity + period closure** — `max(gueltig_ab)` resolution, inclusive `BETWEEN`, `Abschlussdatum` (closed accounting periods block edits). Target: backend.
12. **Authorization composition** — `RightManager.HasRight*` (101 hits). Composition matters: `dstutils.pas:24-42` — create/delete require **all** sub-rights (AND), edit requires **any** (OR). Frontend receives capability flags only. Target: backend.
13. **Licence gating** — `ILizenzChecker`, seat counts, `Reset` invalidation. Target: backend.
14. **Application-level locking** — SPERRUNG table, `sperr.pas` `GetLockStr` compatibility matrix. Target: backend.
15. **Cache-invalidation side effects** — `DbIncreaseVersionId`, `DIENSTPALETTE_VERSION` per-node counters. Contracts the new backend must reproduce or consciously drop. Target: backend, `documented-only` if the mock can't model it.
16. **Shared calculation utilities** — commercial rounding (vs banker's rounding — the difference is money), period math. Target: backend; frontend must never re-implement.
17. **UI event handlers and DFM widget constraints** — `MaxLength`, `MaxValue`, `EditMask` on controls; enable/disable logic. The only class the existing Steps 3–4 fully cover. Target: both (backend value is source of truth).
18. **Resource strings as a rule index; `.qry` files; report units** — 3,678 `rs_*` ids in `Strres.pas` form a near-complete inventory of _reported_ rules; `.qry` files and DB-stored SQL hold queries outside any DFM; report units recompute derivations. Target: varies.

Also check what is **already externalized**: `rest/` + PPAPI (`TPPAPIConflictCategory` in `rest/intfPPAPI.pas`) carry conflict checks already moved to the cloud API behind an activation-date setting. Don't re-port those.

## The extraction pass

Sweep 0, then the seven sweeps from SKILL.md Step 4.5, cheapest signal first. Record each sweep's result — including "none found" — so the reviewer knows it ran.

| Sweep                               | Target                                                                                                                                                                                              | Finds                                                                            | Blind to             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------- |
| 0. Exclude done                     | `ls rest/*.pas`, `grep -rn 'PPAPI'`                                                                                                                                                                 | Rules already externalized — don't re-port                                       | —                    |
| 1. Reported rules                   | `Strres.pas` rule verbs → grep each `rs_*` id to its enforcement site; note `ECMessage` button set (`[mbOK]` = hard stop, `[mbYes,mbNo]` = user-overridable — that distinction is part of the rule) | The backbone: every rule that produces a message (1,946 `ECMessage(` sites)      | Everything silent    |
| 2. Server-side logic                | `StoredProcName`, `BEGIN X(:`, inline Oracle fns → **open and read each `procs/<NAME>.sql`**                                                                                                        | Derivations, resolutions, cascades — the class that hid `SyncDienstDetailLookup` | Rules in constraints |
| 3. DB constraints                   | Liquibase `INDEX_*.xml` / `CONSTRAINT_*.xml` per written table                                                                                                                                      | Unique keys; the derived-column tell                                             | Anything not a key   |
| 4. Triggers                         | German comments naming triggers; `ALTER TRIGGER … DISABLE`                                                                                                                                          | Cascades and history rows the client assumes — check for the JDBC bypass on each | —                    |
| 5. Embedded + dynamic SQL           | DFM `SQL.Strings` (re-join `' +`), `SQL.Text :=`, `MacroByName`                                                                                                                                     | Resolution semantics, status filters, eligibility, ordering                      | —                    |
| 6. Sentinels / config / permissions | `cInfiniteDate`, `-1`, `PEPOptions.`, `IPEPConflictSettings`, `RightManager`, `LizenzChecker`, SPERRUNG, `DbIncreaseVersionId`                                                                      | Wire conventions, per-tenant activation, auth/licence/lock/cache contracts       | —                    |
| 7. Existing spec                    | `ls tests/PolyTest.Tests.*.pas` (71 DUnit rule-spec units)                                                                                                                                          | Ready-made test cases — port them before the implementation                      | Untested rules       |

## Classification decision tree

Apply in order to each rule found; first match wins.

1. Does violating it **corrupt persisted data** or produce a wrong paid/legal value? → **backend-invariant** (authoritative). Mock must enforce it or declare `model-blocked`/`documented-only`.
2. Is it a **derivation** (a value computed on write, not a rejection)? → **backend-owned derivation**. Frontend displays the server value and never computes it. Mock must derive it too. _(← `SyncDienstDetailLookup`)_
3. Is it a **resolution** rule (which record is in force on date D, hierarchy fallback)? → **backend read-model**. Frontend never resolves. _(← `FindDienstDetail`, root-node special case)_
4. Is it an **authorization / licence / lock / period-closure** decision? → **backend-invariant**; frontend receives a capability flag and never re-derives.
5. Is it a **cascade** triggered by a write? → **backend-invariant**, and it must be _explicit_ — never inherited from a trigger (431 are JDBC-bypassed).
6. Is it checkable using **only data present in the open dialog**? → **both**: frontend for immediate feedback (never authoritative) + backend as the real gate.
7. Is it pure input shaping (max length, format, required)? → **both**, backend value as source of truth, with `@openapi maxLength: N` so the generator emits `@Size`.
8. Is it caching / client lock lifetime / DevExpress plumbing? → **out of scope**, `documented-only`.

Default when in doubt: anything producing a persisted value, a paid amount, a legal conflict, an authorization decision, a licence decision, a lock, or a point-in-time resolution → **backend, authoritative. Nothing may exist only in Angular.**

## The representability gate

Before writing rule cards into the plan, check each backend-invariant against the data model about to be designed: **can the wire model and the mock store express the rule's `@scope` tuple?**

Symptoms of a model that cannot state a rule:

- a **singular field where the rule needs a list** (shift-palette: `ShiftDefinition.validity: ShiftValidityRange` — singular — made "two windows for one shift" unrepresentable);
- a **store keyed on a subset of the scope tuple** (`Map<paCode, ShiftDefinition>` when the rule is scoped `(paCode, nodeId, validFrom)`);
- a **payload typed `Record<string, unknown>`** — an ~80-field opaque blob validates nothing and specifies nothing.

A rule about relationships _between_ rows cannot be stated when only one row can exist. This is a **model defect, not a documentation problem**: raise it as a `<FEATURE>-000` card and fix the model before annotating. An annotation on an unrepresentable rule is a comment describing something that cannot exist.

## Rule-card format

One card per rule, written as a JSDoc block above the handler code that implements it (or above the store/type it concerns when not executable). Ids `<FEATURE>-NNN` are assigned in discovery order and are **permanent** — they join the handler, the spec file, the generated doc, the i18n key, and the eventual Java guard.

```text
@backend-rule  <FEATURE>-<NNN> <one-line title>
@statement     <plain-language, testable. Say what the system DOES, not what is forbidden.>
@scope         <the key tuple the rule ranges over, e.g. (paCode, nodeId)>
@kind          invariant | derivation | resolution | validation | authorization | cascade | concurrency
@layer         backend | frontend | both
@delphi        <path>:<lines> — <mechanism>          (repeat per mechanism; SQL/index/trigger count too)
@p2-behaviour  <what P2 does on violation: silent repair | ECMessage rs_xxx (hard stop) | confirm dialog>
@error         <status> { code, field?, ruleId }  |  none — derivation
@i18n          <feature>.error.<key>              (omit when @error is none)
@mock          implemented: <fn> | model-blocked: <why + blocking id> | documented-only: <why>
@openapi       <what the spec must carry: maxLength / enum / error DTO / nothing expressible>
@test          given <state> / when <action> / then <outcome>
@confidence    verified | inferred | assumed
@question      <open question for the user — only on inferred/assumed>
```

Confidence semantics: `verified` = the Delphi evidence was read and the behaviour is unambiguous. `inferred` = deduced from structure (e.g. a unique index implies the check) but no enforcement site was read. `assumed` = domain guesswork. Every `inferred`/`assumed` card must carry a `@question` and be surfaced to the user in the analyze plan and the generate summary — **a wrong rule in an executable mock becomes law faster than a wrong comment.**

### Worked example: the shift-palette validity chain

Note it decomposes into **five** cards plus a model-defect card — and the _primary_ card is a derivation with no error at all. Any single-line summary would have produced the wrong backend.

```text
@backend-rule  SP-000 A shift has MANY validity-scoped definitions per hierarchy node
@statement     The definition chain is keyed (paCode, nodeId, validFrom). One shift on one node
               has an ordered list of definitions; a shift on two nodes has two independent lists.
@scope         (paCode, nodeId)
@kind          invariant
@layer         backend
@delphi        main_ecbern.sql — UNIQUE XAKDIENST_DETAIL(pa_code, knoten_id, gueltig_ab)
@delphi        fEditDienstPalette.pas:838-863 — editor walks the chain backwards from cLastDate
@mock          model-blocked: ShiftDefinition.validity is singular; the store is
               Map<paCode, ShiftDefinition>; detail is keyed `${paCode}:${nodeId}`.
               SP-001..SP-005 cannot be expressed until this is fixed.
@confidence    verified

@backend-rule  SP-001 At most one definition per shift per node per start date
@statement     Creating a definition whose validFrom equals an existing definition's validFrom
               on the same (paCode, nodeId) is rejected.
@scope         (paCode, nodeId, validFrom)
@kind          invariant
@layer         both
@delphi        main_ecbern.sql — UNIQUE XAKDIENST_DETAIL
@delphi        fEditDienstPalette.pas:629-657 — client pre-check against ORIGINAL start dates
@p2-behaviour  ECMessage rs_DatumSchonVergeben, dialog reopens (hard stop)
@error         409 { code: 'DUPLICATE_VALID_FROM', field: 'validFrom', ruleId: 'SP-001' }
@i18n          shiftDefinition.error.duplicate_valid_from
@mock          model-blocked: see SP-000
@openapi       error DTO with code enum (mirror BlockCategoryDeleteConflictDTO.yml)
@test          given a definition at 2026-01-01 / when POST another at 2026-01-01 on the same node
               / then 409 DUPLICATE_VALID_FROM and the chain is unchanged
@confidence    verified

@backend-rule  SP-002 validTo is DERIVED on every write — never stored from user input
@statement     After every insert, update or delete of a definition, recompute validTo for EVERY
               definition of that shift as (next definition's validFrom − 1 day), or 2999-12-31
               when there is no later one. Overlap is impossible by construction; P2 has no
               overlap validator because none is needed. A backend that stores a user-supplied
               validTo verbatim WILL produce overlaps and will pass every DB constraint.
@scope         (paCode, nodeId) — one contiguous, gap-free chain ordered by validFrom
@kind          derivation
@layer         backend
@delphi        shared/db/ecbern/procs/SyncDienstDetailLookup.sql:11-18 — the derivation
@delphi        u_dstass.pas:833-835, :925-927 — called after every insert path
@delphi        udstdet.pas:3609 — called inside the delete transaction (predecessor absorbs the gap)
@delphi        fEditDienstPalette.pas:1041-1071 — "Wird aber nicht in die Db gespeichert"
@p2-behaviour  silent repair, no message, no user-visible failure mode
@error         none — write-time derivation
@mock          model-blocked: see SP-000. Once unblocked: syncValidityChain(paCode, nodeId)
               called at the end of every create/update/delete.
@openapi       not expressible; must live in the endpoint description + a Java service guard
@test          given definitions at 2026-01-01 and 2026-06-01 / when a third is inserted at
               2026-03-01 / then validTo becomes 2026-02-28, 2026-05-31, 2999-12-31 respectively
@confidence    verified

@backend-rule  SP-003 Editing a definition's end date moves the NEXT definition's start date
@statement     Committing validTo on a non-last row sets the following definition's validFrom to
               validTo + 1 day. On the last row it moves the palette's own end date instead.
@delphi        fEditDienstPalette.pas:350-359; fEditDienstGlobal.pas:296-303
@kind          cascade   @layer both   @mock model-blocked: see SP-000   @confidence verified

@backend-rule  SP-004 Resolution: MAX(validFrom) wins, then walk UP the hierarchy to the parent
@statement     "Which definition applies for node X on date D": take the definition on X whose
               [validFrom, validTo] contains D (inclusive, whole-day); if none, retry on
               HIERARCHIE.VATER_ID; stop at -1. Any exception yields "no definition", never an error.
@delphi        shared/db/ecbern/procs/FindDienstDetail.sql:22-47
@kind          resolution   @layer backend
@mock          documented-only: the mock has no hierarchy walk for shift definitions
@test          given no definition on the child node / when resolving for date D
               / then the nearest ancestor's definition is returned
@confidence    verified

@backend-rule  SP-005 Root node (nodeId = 1) ignores validTo during resolution
@statement     On the root node the BETWEEN test is not applied — only MAX(validFrom) <= D. The
               last global definition never expires. A port applying BETWEEN at all levels will
               return "no definition" where P2 returns one.
@delphi        shared/db/ecbern/procs/FindDienstDetail.sql:32-37
@kind          resolution   @layer backend   @mock documented-only   @confidence verified
```

## MSW annotation and error contract

### Why the handler carries the rules

Evaluated against the actual handoff (the backend team transcribes the handler eight weeks later):

| Option                           | Discoverability                       | Staleness risk                                                                           | Enforceability                                              |
| -------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| JSDoc comments alone             | high (right file)                     | medium — sits above the enforcing code, unlike the repo's dangling `_aux/…` doc pointers | none                                                        |
| **Handler implements the rules** | **highest — executable, unambiguous** | **low — a wrong rule breaks the app in dev**                                             | high                                                        |
| Handler spec tests per rule id   | medium                                | lowest — CI fails                                                                        | highest                                                     |
| Separate rules document          | medium                                | high — even a generated one adds tooling humans must maintain and understand             | none                                                        |
| OpenAPI annotations              | high (Java side)                      | medium                                                                                   | high, **but field-level only and written _after_ the mock** |

Hence the mechanism: the `@backend-rule` block is the single authored source, sitting directly above the code that enforces it; the handler implements what the in-memory model can express; the spec file holds one test slot per rule id. **No separate rules document** — the handler plus its spec is the whole handoff artifact, in the one file the backend team already reads. A rule the mock enforces is also the error-path UX the app needs anyway — the store handles a coded conflict _before_ the real backend exists.

### Handlers that already set the bar

Find the workspace's current exemplars by grepping the handlers directory for coded conflict bodies (`grep -rln "status: 409\|code:"`) and copy from those — not from the CRUD-only ones. Exemplars found in the 2026-08 analysis (re-verify they still exist; the pattern matters more than the file):

- `calendar.handlers.ts` — a temporal "at most one DST changeover per half-year" rule (Delphi `TKalender.UpdateZeitumstellung`) **including the cascade** that clears the sibling and returns it so the client can reconcile.
- `date-category.handlers.ts` — system-row immutability (ids 1–5) and `409 {code:'IN_USE'}` delete conflicts.
- `hierarchy.handlers.ts` — node-lock and child-reference 409s.
- `block-category.handlers.ts` — an immutability rule expressed in the type itself.

### The error contract

Generalize the repo's one proven machine-readable code (`DELETE_CONFLICT_IN_USE`, which flows FE constant → mock body → OpenAPI `enum` → Java error handler) to every rule violation:

```typescript
type RuleViolation = {
  code: string; // stable enum, e.g. 'DUPLICATE_VALID_FROM'
  ruleId: string; // 'SP-001' — joins handler ↔ spec ↔ i18n ↔ Java guard
  field?: string; // 'validFrom'
  message: string; // English, for logs — never rendered
};
```

The frontend maps `code` → translation key and **never branches on the bare status**. A 409 on save can mean duplicate, over-length, a stale lock, or a referential failure. The cautionary case is live in the repo: shift-group `title` is capped at 80 in Angular but is `VARCHAR(30)` in the DB; the backend catches the DB failure and re-throws 409; the store maps any 409 to `shiftGroup.error.duplicate` — so a user typing 31–80 characters is told the title is already in use.

### Keeping it honest: one test slot per rule id

`<feature>.handlers.spec.ts` contains one `it('<ID> …')` per `@mock implemented` rule (derived from the card's `@test` line — plain vitest, no custom tooling) and one `it.todo('<ID> <statement>')` per `documented-only` / `model-blocked` rule. A rule the mock deliberately cannot enforce still occupies a named, visible slot in every test run. Keep the handler and the spec in step when adding or removing a rule; PR review is the gate.

That choice is deliberate. A `rules:sync`/`rules:check` mechanism (generated `RULES.md` handout + a CI script diffing rule ids between handler and spec) was built and retired in the SAAS-736 retrofit: it worked, but the ~200-line bespoke parser, the generated markdown noise, and a prettier/byte-comparison conflict cost more than the deletion-drift it prevented — the original failure mode was extraction-time loss, not deletion, and deletions are visible in diffs. If deletion-drift is ever observed in practice, reintroduce a gate then, with evidence.

## What to hand the backend beyond the mock

The `@openapi` line on each card carries forward what the spec _can_ express, because the generated Java DTOs actually enforce it:

- **Expressible** — `maxLength` / `minLength` / `pattern` / `enum` / `required` → `@Size` / `@Pattern` / `@NotNull` via openapi-generator; error DTOs with `code` enums (mirror `BlockCategoryDeleteConflictDTO.yml`). These are cheap wins the specs currently skip (9 `maxLength` across 557 properties — which is how the 80-vs-VARCHAR(30) bug shipped).
- **Not expressible** — cross-record invariants, conditional/composite rules, derivations, temporal resolution. OpenAPI 3.0.3 has no keyword for any of them; the team already resorts to prose in `description:` fields for such cases. These must live in the endpoint `description` **and** as a hand-written Java service guard.
- The backend has **zero custom `ConstraintValidator`s** — real rules land as hand-written service-layer guards. Write each card's `@test` line so it can be lifted straight into a Java test.
