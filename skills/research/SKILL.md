---
name: research
description: Use when the user wants to deeply understand a codebase topic, feature, module, or domain concept. Produces a structured research document with architecture diagrams, glossary, and actionable findings saved to the project's docs directory.
argument-hint: "<topic>"
disable-model-invocation: true
compatibility: Designed for Claude Code. Works with any codebase.
metadata:
  version: "1.0.1"
---

# Research

Deeply investigate a codebase topic and produce a structured research document.

**Usage:** `/research <topic>`

The argument is a free-form topic description (e.g., `Time Recording Implementation`, `Authentication flow`, `How billing data reaches the PDF export`).

## Workflow

### Phase 1: Scope

1. Parse `$ARGUMENTS` as the research topic.
2. Do a quick 2-minute scan of the codebase: README, project structure, entry points, and anything directly related to the topic.
3. Ask the user **3-5 focused questions** to narrow scope. Examples:
   - What decisions will this research inform? (implementation, refactor, onboarding, review)
   - Which parts of the system are in/out of scope?
   - What depth: surface overview or deep trace through every layer?
   - Are there known pain points or areas of confusion to prioritize?
4. Wait for answers before proceeding.

### Phase 2: Investigate

Systematically explore the topic. For each area, read actual code — do not guess.

- **Trace execution paths** end-to-end (entry point to storage/output)
- **Map architecture layers** (UI, service, data, infrastructure)
- **Identify patterns and abstractions** (base classes, shared utilities, conventions)
- **Catalog domain terms** found in code, comments, and naming
- **Document dependencies** (internal modules, external packages, APIs)
- **Note inconsistencies, tech debt, or risks** you encounter

### Phase 3: Document

Produce the research document following the format in [references/output-format.md](references/output-format.md).

**Output location:** `docs/research/<slugified-topic>.md` in the project root. Create the directory if it doesn't exist.

Important:

- Every claim must reference specific files and line numbers
- Diagrams use Mermaid syntax
- Skip sections that don't apply — no filler
- Optimize for a developer who needs to make decisions, not just understand
