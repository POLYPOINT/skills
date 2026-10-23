---
name: cloud-release
description: Use when preparing, planning, running or reviewing a POLYPOINT cloud production release night (a PCR such as PCR-2643) with the release board in the pcr-companion repo — deciding the scope from the Confluence release page AND the release/maintenance..release/preview diff, choosing catalogue steps and writing new ones, ordering the window and estimating downtimes, then on release night saying which board step comes next, reading the board state and step logs, diagnosing a failed step and preparing the fix, and afterwards running the retro and archiving the evidence. Triggers on "prepare / plan the release", "PCR-xxxx", "release night", "start the board", "which step next", "step 4xx failed", "release retro", "rb board", "cloud-release-dashboard". Do NOT use for ordinary CT/preview deploys, single-ticket work (dev-ticket), or the nightly release-branch merge (release-branch-merge).
metadata:
  version: 0.1.0
---

# Cloud release

Help a team member prepare and run a cloud production release night with the **release board** — the engine, the
step catalogue and every release definition live in the Azure DevOps repo `pcr-companion`. Three modes:

| Mode            | When                     | What Claude does                                                                               |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| **Plan**        | days before the window   | a discussion with the user: scope, steps, order, estimate → a reviewed release definition (PR) |
| **Orchestrate** | release week + the night | next step on request, progress, failure diagnosis and fixes — the operator runs every step     |
| **Retro**       | after the night          | what went wrong → catalogue / engine fixes with test steps, evidence archived                  |

Pick the mode from the request; ask when it is unclear. A release can be planned by one person and run by another:
the definition travels by git, the run state stays on the operator's Mac.

## Ground rules (non-negotiable)

- **Only the operator runs board steps.** Never run `rb run`, `rb next` (without `--show`), `mark`, `reset`, `stop`,
  `attach`, `window`, `forget`, `archive`, nor press board keys for the user — not even local or "harmless" steps.
  Hand over the exact command instead (`rb -r PCR-xxxx run 412`). Read-only commands are fine: `rb releases`,
  `rb -r X list`, `next --show`, `where`, `log <id>` (no `-f`), `timeline`, `board --once --no-color`, and `dry-run`
  of a step **without** `@plan yes` (an `@plan` step's dry-run runs its live read-only plan against the target).
- **No production access by Claude** unless the user grants it explicitly for that task. Prod and staging share the
  prod cluster: steps reach them only through the operator's typed confirmation. When prod data is needed, give the
  operator short read-only commands to run (one per line, explicit `--context`, no `use-context`) and read their output.
  Never `kubectl config use-context` anything.
- **Secrets never pass through Claude:** never read `~/.release-board/*/private/`, Vault dumps, the keychain or
  `~/.poco/debug.out`; never print a password or token; logs are masked — keep it that way in every step written.
- **Subagents stop on a block:** every delegated brief says "if the auto-mode classifier or a permission rule blocks
  an action, stop and report it — never retry it renamed, wrapped or through another tool".
- **Git:** commit, push and PRs in `pcr-companion` only when the user asks. Never push `main` directly.
- **Release rules** of the team (`docs/release-rules.md` in the repo) apply to every plan: no prod change before the
  window, downtimes grouped and short, maintenance page across the downtimes, late fixes only through a
  regeneration step.

## Setup — find the board

1. Repo: `$PP_RELEASE_HOME` (the pcr-companion clone), else ask. Check it is current:
   `git -C "$PP_RELEASE_HOME" fetch -q && git -C "$PP_RELEASE_HOME" status -sb`. Behind → tell the user `rb update`.
2. Entry point: `$PP_RELEASE_HOME/tools/release-board/rb` (alias `rb`). Missing setup → the user runs
   `tools/release-board/install.sh` (checks tools, creates `~/.release-board/operator.sh`, prints the shell lines).
3. Release: `-r PCR-xxxx` on every command or `$PP_RELEASE`. `rb releases` lists the definitions, `rb -r X where`
   shows the three places (engine · `runs/<release>/` · operator run data `~/.release-board/<release>/`).
4. Read once per session: `docs/release-board.md` (operator guide), `docs/release-rules.md`,
   `tools/release-board/catalogue/README.md`. On a failure: `docs/release-recipes.md`.

## Plan mode — a discussion, with checkpoints

Work through the phases in order; each ends with a **STOP** for the user's agreement. Keep the decisions in the
release's `RELEASE.md` (sections A–E) as they are made, so the operator reads the same story later.
Details, commands and tables: [references/planning.md](references/planning.md).

1. **Identify the release.** PCR id, window date/time, operator and release manager, rotation mode
   (`maintenance-only` or `maintenance-and-preview`). The Confluence **release page** is a subpage of the PCR page —
   read it with the Atlassian connector (ask for the link if the search fails). Create the definition when it does
   not exist: the user runs `rb new PCR-xxxx --window "YYYY-MM-DD 22:00" --core` (or ask before running it yourself —
   it only writes files under `runs/`).
2. **Scope — both sources, always.** The release page lists the planned stories; the repo diff shows what really
   ships. Diff every shipping repo on origin refs only (`origin/release/maintenance..origin/release/preview` for the
   cloud repo; polypoint-ci and gitops as relevant) and classify each change by the step it needs (Flyway, Vault /
   Keycloak bootstrapping, manifests, new apps, infra, toggles, on-prem contracts). Delegate big diffs to parallel
   subagents per area. Reconcile into the scope table of `RELEASE.md` section A; list every mismatch (change without
   story, story without change) as a question. **STOP** — scope agreed.
3. **Steps.** Start from `catalogue/CORE` (already copied by `--core`), add catalogue steps for what the scope needs
   (`rb -r X add <group/file> [id] [slug]`), and write new steps from `templates/step.sh` for the rest. Prod app
   syncs: one copy of the template per app or family (`rb -r X add window/415-prod-sync-app.sh 422 sync-poma-core`,
   then its `SYNC_RE`, `@title`, `@depends`, `@downtime`; the README lists the regexes; step 344 checks coverage
   before the window). Each new step:
   header complete (`@phase @target @kind @depends`, downtime headers), gates not warnings, verify + rollback in its
   comment, no secrets, `bash -n` clean, `rb -r X list` and `dry-run` readable. **STOP** — step list agreed.
4. **Order and window.** Apply the release rules: everything that can run before the window runs before it without
   touching prod workloads; in the window, group the downtimes so user impacts overlap, maintenance page on before the
   first one. Estimate from measured data ([references/pcr-baseline.md](references/pcr-baseline.md)), never from
   guesses; say which numbers are measured and which are assumed. Write `RELEASE.md` B–C. **STOP** — plan agreed.
5. **Rehearse what is new.** Every new or changed step gets a test on CT (or staging) before the night: a thin TEST
   step that calls the real step or lib functions (patterns in `catalogue/tests/`: CT 181–183; the prod rehearsals
   521–526 only after a window), run by the operator; fix until green. Steps that cannot be rehearsed are
   marked as such in `RELEASE.md` E.
6. **Hand over.** `rb selftest` green, then a PR in pcr-companion with the definition (only when the user asks to
   commit). The operator `git pull`s the merged definition and opens `rb -r X board`.

## Orchestrate mode — the operator runs, Claude reads and prepares

Commands, state-file format and the triage flow: [references/orchestration.md](references/orchestration.md).

- **"Which step next?"** → `rb -r X next --show`, cross-check with `list`, answer with the step id(s) only
  (`412`, or `412, then 413`) unless the user asks for more. Mention a downtime badge (▲ starts, ▼ ends, ◆ inside)
  when the next step carries one. Never suggest running steps in parallel unless asked.
- **Progress** → `rb -r X list`, the state files and `rb -r X log <id>`; summarise running / failed / blocked and the
  ongoing downtimes. Keep `RELEASE.md` section F (log) current with what happened, in one line per event.
- **A step failed** → read its log tail, the step script and the libs it sources; match the symptom against
  `docs/release-recipes.md`; then propose ONE of: a fix to the step script (edit it, show the diff, the operator
  reruns), a manual action as exact commands for the operator, or a decision for the release manager (skip /
  postpone / rollback step). The operator records outcomes (`rb -r X mark <id> done "<note>"` — give them the
  command). After a fix, say exactly what to rerun and what to check.
- **Late change after the freeze** (a critical PR) → a release-regeneration step (catalogue `releases/`), never an
  ad-hoc deploy.
- **The night ends** → `467`-style all-synced check green, maintenance page off, bootstrapping back to 0 with the
  Vault root token removed, then the post steps.

## Retro mode — every failure becomes a fix or a decision

Workflow and file conventions: [references/retro.md](references/retro.md).

1. Collect: `rb -r X timeline` (the report under the operator's logs), `RELEASE.md` section F, the user's and other
   participants' notes. List everything that went wrong, numbered, in `RELEASE.md` section G.
2. Go item by item with the user: **close** (no action), **park** (with an owner), or **fix**. A fix is a catalogue
   step, an engine change or a release rule — written now, with a thin TEST step (post phase, 521+) the operator runs
   on CT or prod; after the test the wrapper leaves the board and the result goes to section F.
3. The operator runs `rb -r X archive` (evidence → `runs/<release>/evidence/`, secrets refused) after the
   forget-credentials step; then a PR with the evidence, the retro and the catalogue/engine fixes.

## Memory

Keep one project memory per release while it is active (`<pcr-id>-release`): window, operator, decisions, the
current step, open retro items. Delete or close it once the evidence is archived — the repo is the record.
