# POLYPOINT Skills

Shared custom skills for Claude Code used across all POLYPOINT projects. Everyone can contribute, improve, and use these skills.

Skills follow the [Agent Skills](https://agentskills.io) open standard. For full details, see the [Claude Code skills documentation](https://code.claude.com/docs/en/skills).

## What Are Skills?

Skills are folders of instructions and resources that Claude loads dynamically to perform specialized tasks. Each skill has a `SKILL.md` file with YAML frontmatter and markdown instructions that Claude follows when the skill is active.

Skills can:
- Add knowledge (conventions, patterns, domain context)
- Define tasks (deployments, code generation, reviews)
- Bundle scripts and templates for complex workflows
- Run in isolation via subagents with `context: fork`

## Repository Structure

```
skills/
  skill-name/
    SKILL.md              # Main instructions (required)
    template.md           # Templates for Claude to fill in (optional)
    examples/             # Example outputs (optional)
    scripts/              # Utility scripts (optional)
```

## Installing Skills

### As a Plugin (Recommended)

If this repo is registered as a plugin marketplace, install via:

```bash
/plugin install <skill-name>@polypoint-skills
```

### Symlink into Personal Skills

```bash
# Link a specific skill
ln -s /path/to/this/repo/skills/skill-name ~/.claude/skills/skill-name

# Or link all skills
for skill in /path/to/this/repo/skills/*/; do
  ln -s "$skill" ~/.claude/skills/
done
```

### Copy into Project Skills

```bash
cp -r /path/to/this/repo/skills/skill-name .claude/skills/
```

### Where Skills Live

| Location   | Path                                     | Applies to                     |
| :--------- | :--------------------------------------- | :----------------------------- |
| Enterprise | Managed settings                         | All users in your organization |
| Personal   | `~/.claude/skills/<skill-name>/SKILL.md` | All your projects              |
| Project    | `.claude/skills/<skill-name>/SKILL.md`   | This project only              |
| Plugin     | `<plugin>/skills/<skill-name>/SKILL.md`  | Where plugin is enabled        |

Higher-priority locations win: enterprise > personal > project. Plugin skills use a `plugin-name:skill-name` namespace.

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
| `name`                     | No          | Display name / slash command. Defaults to directory name. Lowercase, hyphens, max 64 chars. |
| `description`              | Recommended | What the skill does and when to use it. Claude uses this for auto-discovery. |
| `argument-hint`            | No          | Hint for autocomplete, e.g. `[issue-number]`.                            |
| `disable-model-invocation` | No          | `true` = only user can invoke via `/name`. Default: `false`.             |
| `user-invocable`           | No          | `false` = hidden from `/` menu, Claude-only. Default: `true`.            |
| `allowed-tools`            | No          | Tools Claude can use without asking permission when skill is active.     |
| `model`                    | No          | Model override when skill is active.                                     |
| `context`                  | No          | `fork` to run in an isolated subagent context.                           |
| `agent`                    | No          | Subagent type when `context: fork` is set (e.g. `Explore`, `Plan`).     |

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
