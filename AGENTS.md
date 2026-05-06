# POLYPOINT Skills Repository

Shared skills for Claude Code, distributed as a Claude Code plugin marketplace. Each skill is packaged as its own plugin so it can be installed via `/plugin install <name>` or symlinked/copied for tools that follow the [Agent Skills](https://agentskills.io) standard.

## Repository Layout

```
.
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest — lists every plugin
├── skills/
│   └── <plugin-name>/             # One directory per plugin
│       ├── .claude-plugin/
│       │   └── plugin.json        # Plugin manifest (name, version, description)
│       └── skills/
│           └── <skill-name>/      # Skill directory inside the plugin
│               ├── SKILL.md       # Required — frontmatter + instructions
│               ├── references/    # Optional — heavy reference docs
│               ├── examples/      # Optional — example outputs
│               ├── scripts/       # Optional — utility scripts
│               └── assets/        # Optional — templates, images
└── README.md
```

- The repository root is a Claude Code **plugin marketplace** (`.claude-plugin/marketplace.json`).
- Every entry in `skills/` is a **plugin**, not a bare skill. Each plugin has its own `.claude-plugin/plugin.json`.
- Skills inside a plugin live under the plugin's `skills/<skill-name>/` subdirectory. The double-nesting (`skills/<plugin>/skills/<skill>/`) is intentional and required by Claude Code plugin auto-discovery.
- Plugin name and skill name typically match (e.g. plugin `pdx` contains skill `pdx`), but this is convention, not a constraint — a plugin may ship multiple skills.

> **Alternate layout (single-skill plugins):** A few existing plugins (e.g. `playwright-api`, `playwright-e2e`) place `SKILL.md` directly at the plugin root instead of under `skills/<name>/`. Both layouts are valid in Claude Code; prefer the nested form for new plugins so the structure scales if a second skill is added later.

## Adding a Plugin / Skill

1. Create `skills/<plugin-name>/.claude-plugin/plugin.json` with `name`, `version`, and `description`.
2. Create `skills/<plugin-name>/skills/<skill-name>/SKILL.md` with YAML frontmatter (`name` and `description` required).
3. Register the plugin in `.claude-plugin/marketplace.json` under `plugins[]`.
4. Move heavy material (≥100 lines or domain reference data) into `references/`, `examples/`, `scripts/`, or `assets/`.

## Conventions

### Naming

- Lowercase kebab-case for plugin and skill directories (`delphi-to-angular`, not `DelphiToAngular`).
- Verb-first active voice for action skills (`creating-reports` over `report-creation`); topic names are fine for reference skills (`pdx`, `research`).
- The `name` field in `plugin.json` and SKILL.md frontmatter must match its directory name.

### SKILL.md description

The frontmatter `description` is what Claude Code matches against to auto-trigger the skill — it is the most important field. Keep it under 1024 characters and start it with one of:

- **`Use when …`** — preferred concise form, used by most skills in this repo.
- **`This skill should be used when …`** — third-person form recommended by Anthropic's official skill-development guidance. Equally acceptable.

Both forms describe _triggering conditions_ (what the user is doing or asking for), not _workflow steps_. Include concrete trigger phrases and symptoms users would actually say.

### File size budget

The budgets differ by file type — apply the right one:

| File           | Budget                                 | Why                                                |
| -------------- | -------------------------------------- | -------------------------------------------------- |
| `SKILL.md`     | < 500 lines, ideally 1,500–2,000 words | Always loaded when the skill triggers — keep lean. |
| `references/*` | No hard limit                          | Loaded on-demand by Claude when needed.            |
| `examples/*`   | No hard limit                          | Loaded on-demand.                                  |
| `scripts/*`    | No hard limit                          | Often executed without being read into context.    |

If `SKILL.md` is approaching the limit, move detailed patterns, schemas, recipes, or domain inventories into `references/` and link to them from `SKILL.md`. Reference files of 1000+ lines are normal and expected (e.g. `pdx/references/component-inventory.md`).

### Style

- One excellent code example beats many mediocre ones.
- No narrative storytelling — skills are reference guides, not blog posts.
- Include keywords Claude would search for: error messages, symptoms, tool names, library names.
- Use imperative form in instructions ("Run X", "Validate Y"), not second person ("You should run X").

## Verifying a Skill

Before opening a PR, walk through this checklist for every plugin you touched:

### Structure & registration

1. Plugin lives at `skills/<plugin-name>/` with a `.claude-plugin/plugin.json`.
2. Skill lives at `skills/<plugin-name>/skills/<skill-name>/SKILL.md` (or, for legacy single-skill plugins, at the plugin root).
3. Plugin is listed in `.claude-plugin/marketplace.json` under `plugins[]`, and every entry there points to a directory that exists.

### Name consistency (4-way match)

The same string must appear in all of:

- The plugin directory name (`skills/<plugin-name>/`)
- `plugin.json` `name` field
- `marketplace.json` entry `name`
- (For the skill itself) the skill directory name and `SKILL.md` frontmatter `name`

Mismatches usually mean a half-finished rename.

### Required fields

- `plugin.json`: `name`, `version`, `description`.
- `SKILL.md` frontmatter: `name`, `description`. YAML must parse.
- `description` starts with `Use when …` or `This skill should be used when …` and describes triggering conditions.

### Version

- `plugin.json` `version` matches `SKILL.md` frontmatter `metadata.version` (when the latter is present — keep them in lockstep).
- **Version bump:** if any file under `skills/<plugin>/` changed vs `main`, bump that plugin's `version` (semver) in both `plugin.json` and `SKILL.md` `metadata.version`. Skip the bump only when the change is purely cosmetic (e.g. fixing a typo in a comment) — when in doubt, bump.

### Content

- `SKILL.md` is under 500 lines; heavier material lives in `references/` / `examples/` / `scripts/` / `assets/`.
- Every `](references/…)` / `](examples/…)` / `](scripts/…)` link in `SKILL.md` resolves to a real file.
- `npm run format` (Prettier) passes.

### Behavioural

- Skill triggers correctly: `/<skill-name>` works, or it auto-triggers on a relevant prompt.

### Deep validation (optional but recommended for non-trivial changes)

Ask Claude to run these agents against the changed plugin:

- `plugin-dev:plugin-validator` — structural and manifest validation.
- `plugin-dev:skill-reviewer` — description quality, content organization, progressive disclosure.
