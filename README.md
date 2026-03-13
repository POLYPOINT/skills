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

## Repository Structure

```
skills/
  skill-name/
    SKILL.md              # Main instructions (required)
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

**Step 2 — Install the plugin:**

```
/plugin install delphi-to-angular
```

**Update to latest version:**

```
/plugin update delphi-to-angular
```

Once installed, invoke with:

```
/delphi-to-angular analyze /path/to/file.dfm
/delphi-to-angular generate
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

### Cursor

Cursor has [native Agent Skills support](https://cursor.com/docs/context/skills). Copy or symlink the skill directory into `.cursor/skills/`:

```bash
cp -r skills/delphi-to-angular .cursor/skills/
```

Cursor auto-discovers `SKILL.md` files and loads them based on the `description` field.

### VS Code — Copilot

VS Code Copilot [supports Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills). Copy or symlink into `.github/skills/`:

```bash
cp -r skills/delphi-to-angular .github/skills/
```

Copilot also reads `AGENTS.md` files at the workspace root. See [GitHub docs](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills).

### Codex (OpenAI)

Codex [supports Agent Skills](https://developers.openai.com/codex/skills/). Copy or symlink into `.agents/skills/`:

```bash
cp -r skills/delphi-to-angular .agents/skills/
```

Codex auto-discovers skills in `.agents/skills/` and `~/.codex/skills/`.

### Gemini CLI

Gemini CLI has [native Agent Skills support](https://geminicli.com/docs/cli/skills/). Install directly from GitHub:

```bash
gemini skills install https://github.com/POLYPOINT/skills
```

Or copy into the local skills directory:

```bash
cp -r skills/delphi-to-angular .gemini/skills/
```

Manage with `/skills list`, `/skills enable`, `/skills disable`.

### JetBrains — Junie

Junie [supports Agent Skills](https://junie.jetbrains.com/docs/agent-skills.html). Copy or symlink into `.junie/skills/`:

```bash
cp -r skills/delphi-to-angular .junie/skills/
```

Junie CLI also reads from `.agents/skills/` and can import skills from other agents.

### Antigravity

Copy skill content into the Antigravity rules directory:

```bash
cp -r skills/delphi-to-angular .agents/skills/
```

Antigravity reads from `.agents/` at the project root.

### OpenCode

OpenCode [supports Agent Skills](https://opencode.ai/docs/skills/). Copy or symlink into `.agents/skills/`:

```bash
cp -r skills/delphi-to-angular .agents/skills/
```

OpenCode also has Claude Code compatibility — it reads from `.claude/skills/` as a fallback.

### Other Agent Skills-Compatible Tools

Any tool that supports the [Agent Skills standard](https://agentskills.io) can use these skills. Check the [full list of compatible tools](https://agentskills.io) for specific instructions. The general pattern is to copy the skill directory into the tool's skills location.

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

| Field                      | Required    | Description                                                              |
| :------------------------- | :---------- | :----------------------------------------------------------------------- |
| `name`                     | Yes         | Must match directory name. Lowercase, hyphens, max 64 chars.             |
| `description`              | Yes         | What the skill does and when to use it. Used by agents for auto-discovery. Max 1024 chars. |
| `license`                  | No          | License name or reference to a bundled license file.                     |
| `compatibility`            | No          | Environment requirements (intended product, system packages, etc.).      |
| `metadata`                 | No          | Arbitrary key-value map for tool-specific properties.                    |
| `allowed-tools`            | No          | Space-delimited list of pre-approved tools. Support varies by tool.      |
| `argument-hint`            | No          | Hint for autocomplete, e.g. `[issue-number]`. (Claude Code extension)    |
| `disable-model-invocation` | No          | `true` = only user can invoke via `/name`. (Claude Code extension)       |
| `user-invocable`           | No          | `false` = hidden from `/` menu. (Claude Code extension)                  |
| `model`                    | No          | Model override when skill is active. (Claude Code extension)             |
| `context`                  | No          | `fork` to run in an isolated subagent context. (Claude Code extension)   |
| `agent`                    | No          | Subagent type when `context: fork` is set. (Claude Code extension)       |

### String Substitutions

| Variable               | Description                                           |
| :--------------------- | :---------------------------------------------------- |
| `$ARGUMENTS`           | All arguments passed when invoking the skill.         |
| `$ARGUMENTS[N]` / `$N` | Access a specific argument by 0-based index.          |
| `${CLAUDE_SESSION_ID}` | Current session ID.                                   |
| `` !`command` ``       | Runs a shell command and injects its output (preprocessing). |

## Contributing

### Adding a New Skill

1. Create `skills/your-skill-name/SKILL.md`
2. Add YAML frontmatter with at least `name` and `description`
3. Description must start with "Use when..." — describe triggering conditions, not workflow
4. Keep `SKILL.md` under 500 lines; move heavy reference to supporting files
5. Test the skill: invoke it directly with `/skill-name` and verify Claude follows instructions
6. Open a PR for review

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
