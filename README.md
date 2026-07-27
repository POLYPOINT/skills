# POLYPOINT Skills

Shared custom skills used across all POLYPOINT projects. Everyone can contribute, improve, and use these skills.

Skills follow the [Agent Skills](https://agentskills.io) open standard, supported by 30+ AI coding tools including Claude Code, Cursor, VS Code Copilot, Gemini CLI, Codex, JetBrains Junie, OpenCode, and more.

## What Are Skills?

Skills are folders of instructions and resources that AI agents load dynamically to perform specialized tasks. Each skill has a `SKILL.md` file with YAML frontmatter and markdown instructions that the agent follows when the skill is active.

Skills can:

- Add knowledge (conventions, patterns, domain context)
- Define tasks (deployments, code generation, reviews)
- Bundle scripts and templates for complex workflows
- Work across any tool that supports the [Agent Skills standard](https://agentskills.io)

## Available Skills

| Skill                            | Description                                                                                                                                                                                                                                            | Usage                                         |
| :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| **delphi-to-angular**            | Converts Delphi VCL views (.dfm/.pas) to Angular components. Produces full Angular features (component + store + service + tests) matching the POLYPOINT saas repo stack.                                                                              | `/delphi-to-angular analyze path/to/file.dfm` |
| **zn2c-quick-win**               | Guided end-to-end implementation of Zn2C Quick-Win issues from the ZQW Jira board, including Jira transitions, Confluence docs, git worktree workflow, build validation, Azure DevOps PR creation, and review feedback handling.                       | `/zn2c-quick-win ZQW-123`                     |
| **pdx**                          | Applies the PDX (POLYPOINT Design Experience) design system to Angular frontends. Guides usage of `@pdx/*` component libraries and design tokens for consistent POLYPOINT UI.                                                                          | `/pdx`                                        |
| **design-review-for-developers** | Short, structured design review of a single design-system component against its Figma source — visual fidelity, states, accessibility, and implementation consistency, with a POLYPOINT/PDX addendum. Not for full-page reviews.                       | `/design-review-for-developers`               |
| **research**                     | Deeply investigate a codebase topic and produce a structured research document with architecture diagrams, glossary, and actionable findings.                                                                                                          | `/research <topic>`                           |
| **playwright-e2e**               | Creates Playwright E2E tests from an annotated codegen recording — enriches it with resilient selectors via Chrome exploration and generates Page Object Model tests.                                                                                  | `/playwright-e2e path/to/recording.spec.ts`   |
| **playwright-api**               | Generates Playwright API-level corner-case tests from an existing E2E test file or a description — discovers API endpoints and exercises corner cases via `APIRequestContext` (no browser).                                                            | `/playwright-api tests/e2e/login.spec.ts`     |
| **babysit-pr**                   | Time-boxed watch over an Azure DevOps PR — polls comments, CI, and votes via the az CLI, verifies each review finding against current code, fixes still-valid issues minimally, replies to and resolves threads.                                       | `/babysit-pr <pr-url> for 1 hour`             |
| **pp-pr-review**                 | Gated, sub-agent-driven review of an Azure DevOps PR — repository verification, JIRA PII redaction, parallel specialist reviews (logic, security, performance, SQL/JPA, tests), developer-led triage, and comment posting only with explicit approval. | `/pp-pr-review <pr-url>`                      |
| **improve**                      | Reflects on how the skills used in the current session performed and uploads concrete HTML improvement plans to Whetstone for asynchronous human review. Run it after any skill-driven task; also covers third-party skills.                           | `/improve` or `/improve <skill-name>`         |
| **pep-verify**                   | Drives and verifies PEP (the Delphi/VCL planning client) on a tenant box at the element level over SSH/WinRM — preflight + bootstrap of the companion `pep-driver` toolchain, then selector-based UI commands and flows.                               | `/pep-verify on ct-zinc-master`               |

## Repository Structure

```
skills/
  skill-name/
    SKILL.md              # Main instructions (required)
    .claude-plugin/       # Claude Code plugin manifest (required for /command)
      plugin.json
    references/           # Detailed documentation (optional)
    examples/             # Example outputs (optional)
    scripts/              # Utility scripts (optional)
    assets/               # Templates, images, static resources (optional)
```

## Installation

These skills follow the [Agent Skills](https://agentskills.io) open standard and work with any compatible tool.

### Claude Code

Works the same in the terminal CLI, VS Code extension, and JetBrains plugin.

**Step 1 — Add the marketplace (one-time):**

```
/plugin marketplace add https://github.com/POLYPOINT/skills
```

**Step 2 — Install a skill:**

```
/plugin install delphi-to-angular
/plugin install zn2c-quick-win
/plugin install pdx
/plugin install design-review-for-developers
/plugin install research
/plugin install playwright-e2e
/plugin install playwright-api
/plugin install babysit-pr
/plugin install improve
/plugin install pep-verify
```

**Update to latest version:**

```
/plugin update delphi-to-angular
```

Once installed, invoke with `/skill-name`:

```
/delphi-to-angular analyze path/to/file.dfm
/zn2c-quick-win ZQW-123
/pdx
/design-review-for-developers
/research Authentication flow in the API layer
/playwright-e2e path/to/recording.spec.ts
/playwright-api tests/e2e/login.spec.ts
/babysit-pr https://dev.azure.com/polypoint/SaaS/_git/SaaS/pullrequest/12345 for 1 hour
/improve playwright-e2e
/pep-verify on ct-zinc-master
```

<details>
<summary>Alternative: Symlink as a personal skill</summary>

```bash
ln -s /path/to/this/repo/skills/skill-name ~/.claude/skills/skill-name
```

</details>

<details>
<summary>Alternative: Copy as a project skill</summary>

```bash
cp -r /path/to/this/repo/skills/skill-name .claude/skills/
```

</details>

### Other Tools (Cursor, Copilot, Codex, Gemini CLI, Junie, OpenCode, ...)

Use the [Agent Skills CLI](https://github.com/vercel-labs/skills) to install skills:

```bash
# Install all skills (auto-detects installed tools)
npx skills add https://github.com/POLYPOINT/skills

# Install a specific skill only
npx skills add https://github.com/POLYPOINT/skills --skill pdx

# Install to specific tools only
npx skills add https://github.com/POLYPOINT/skills --agent cursor codex

# Install globally (user-level, available across all projects)
npx skills add https://github.com/POLYPOINT/skills -g

# Preview available skills without installing
npx skills add https://github.com/POLYPOINT/skills --list

# Copy files instead of symlinking
npx skills add https://github.com/POLYPOINT/skills --copy
```

Manage installed skills:

```bash
npx skills list              # List project skills
npx skills list -g           # List global skills
npx skills check             # Check for updates
npx skills update            # Update all skills
npx skills remove pdx        # Remove a skill
```

<details>
<summary>Manual installation per tool</summary>

Copy or symlink the skill directory into the tool's skills location:

| Tool              | Skills directory  |
| :---------------- | :---------------- |
| Cursor            | `.cursor/skills/` |
| VS Code — Copilot | `.github/skills/` |
| Codex (OpenAI)    | `.agents/skills/` |
| Gemini CLI        | `.gemini/skills/` |
| JetBrains — Junie | `.junie/skills/`  |
| OpenCode          | `.agents/skills/` |
| Antigravity       | `.agents/skills/` |

Example:

```bash
cp -r skills/pdx .cursor/skills/
```

</details>

## SKILL.md Format

```yaml
---
name: skill-name
description: Use when [specific triggering conditions and symptoms]
---

# Skill Name

## Overview
Core principle in 1-2 sentences.

## When to Use
- Specific symptoms and use cases
- When NOT to use

## Core Pattern
The technique, pattern, or reference material.

## Quick Reference
Table or bullets for scanning.

## Common Mistakes
What goes wrong and how to fix it.
```

### Frontmatter Reference

| Field                      | Required | Description                                                                                |
| :------------------------- | :------- | :----------------------------------------------------------------------------------------- |
| `name`                     | Yes      | Must match directory name. Lowercase, hyphens, max 64 chars.                               |
| `description`              | Yes      | What the skill does and when to use it. Used by agents for auto-discovery. Max 1024 chars. |
| `license`                  | No       | License name or reference to a bundled license file.                                       |
| `compatibility`            | No       | Environment requirements (intended product, system packages, etc.).                        |
| `metadata`                 | No       | Arbitrary key-value map for tool-specific properties.                                      |
| `allowed-tools`            | No       | Space-delimited list of pre-approved tools. Support varies by tool.                        |
| `argument-hint`            | No       | Hint for autocomplete, e.g. `[issue-number]`. (Claude Code extension)                      |
| `disable-model-invocation` | No       | `true` = only user can invoke via `/name`. (Claude Code extension)                         |
| `user-invocable`           | No       | `false` = hidden from `/` menu. (Claude Code extension)                                    |
| `model`                    | No       | Model override when skill is active. (Claude Code extension)                               |
| `context`                  | No       | `fork` to run in an isolated subagent context. (Claude Code extension)                     |
| `agent`                    | No       | Subagent type when `context: fork` is set. (Claude Code extension)                         |

### String Substitutions

| Variable               | Description                                                  |
| :--------------------- | :----------------------------------------------------------- |
| `$ARGUMENTS`           | All arguments passed when invoking the skill.                |
| `$ARGUMENTS[N]` / `$N` | Access a specific argument by 0-based index.                 |
| `${CLAUDE_SESSION_ID}` | Current session ID.                                          |
| `` !`command` ``       | Runs a shell command and injects its output (preprocessing). |

## Contributing

### Adding a New Skill

1. Create `skills/your-skill-name/SKILL.md`
2. Add YAML frontmatter with at least `name` and `description`
3. Create `.claude-plugin/plugin.json` for Claude Code slash command support (see existing skills for the format)
4. Description must start with "Use when..." — describe triggering conditions, not workflow
5. Keep `SKILL.md` under 500 lines; move heavy reference to supporting files
6. Test the skill: invoke it directly with `/skill-name` and verify Claude follows instructions
7. Open a PR for review

### Naming Conventions

- Lowercase kebab-case: `my-skill-name`
- Verb-first active voice: `creating-reports` not `report-creation`
- Descriptive names: `condition-based-waiting` not `async-helpers`

### Skill Content Guidelines

- **Keep it concise**: under 500 words for most skills, under 200 for frequently-loaded ones
- **One great example** beats many mediocre ones
- **Inline code** for patterns under 50 lines; separate files for heavy reference
- **No narrative storytelling** — skills are reference guides, not blog posts
- **Include keywords** Claude would search for: error messages, symptoms, tool names

### Updating Existing Skills

1. Open a PR with your changes
2. Describe what changed and why
3. Test that the skill still works as expected

## Resources

- [Agent Skills Standard](https://agentskills.io)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Anthropic Skills Examples](https://github.com/anthropics/skills)
- [Creating Custom Skills](https://support.claude.com/en/articles/12512198-creating-custom-skills)
