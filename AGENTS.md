# POLYPOINT Skills Repository

Shared custom skills for Claude Code used across all POLYPOINT projects.

## Structure

```
skills/
  skill-name/
    SKILL.md              # Main skill file (required)
    supporting-file.*     # Templates, scripts, reference docs (optional)
```

- Flat namespace: all skills at the top level of `skills/`
- Each skill lives in its own directory named with lowercase-kebab-case
- `SKILL.md` is the only required file per skill

## Adding a Skill

1. Create a directory under `skills/` with a descriptive kebab-case name
2. Add a `SKILL.md` with YAML frontmatter (`name` and `description` fields)
3. Description must start with "Use when..." and describe triggering conditions only
4. Keep `SKILL.md` under 500 lines — move heavy reference to separate files

## Conventions

- Name using verb-first active voice: `creating-reports` not `report-creation`
- One excellent code example beats many mediocre ones
- Inline code for patterns under 50 lines; separate files for heavy reference (100+ lines)
- No narrative storytelling — skills are reference guides, not stories
- Keep frequently-loaded skills under 200 words
