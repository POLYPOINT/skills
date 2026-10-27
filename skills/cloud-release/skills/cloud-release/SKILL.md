---
name: cloud-release
description: Use when preparing, planning, running or reviewing a POLYPOINT cloud production release night (a PCR such as PCR-2643) with the release board in the pcr-companion repo — deciding the scope from the Confluence release page AND the release/maintenance..release/preview diff, choosing catalogue steps and writing new ones, ordering the window and estimating downtimes, building the plan with sections, tasks and deploy groups (rb plan, the board's plan mode — a component deployed from release/preview or release/maintenance, an existing Azure DevOps release or a new one), then on release night saying which board step comes next, reading the board state and step logs, diagnosing a failed step and preparing the fix, and afterwards running the retro — bringing the steps changed or written in the plan back into the catalogue (rb plan diff-catalogue, one PR) — and archiving the evidence. Triggers on "prepare / plan the release", "plan a hotfix release", "deploy POMA from maintenance", "PCR-xxxx", "release night", "rb plan", "start the board", "which step next", "step 4xx failed", "release retro", "catalogue candidates", "diff-catalogue", "rb board", "rb take", "rb watch", "gs://ppcloud-releases", "cloud-release-dashboard". Do NOT use for ordinary CT/preview deploys, single-ticket work (dev-ticket), or the nightly release-branch merge (release-branch-merge).
metadata:
  version: 0.4.0
---

# Cloud release

Help a team member prepare and run a cloud production release night with the **release board** — the engine and the
step catalogue live in the Azure DevOps repo `pcr-companion`; every release's plan, run record and evidence live in the
bucket `gs://ppcloud-releases/<release>/` (one folder per release). Three modes:

| Mode            | When                     | What Claude does                                                                           |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| **Plan**        | days before the window   | a discussion with the user: scope, steps, order, estimate → a plan pushed to the bucket    |
| **Orchestrate** | release week + the night | next step on request, progress, failure diagnosis and fixes — the operator runs every step |
| **Retro**       | after the night          | what went wrong → tested fixes; plan changes back into the catalogue (one PR); evidence    |

Pick the mode from the request; ask when it is unclear. A release can be planned by one person and run by another:
the plan travels through the bucket (`rb push` / `rb pull`, no PR — every pulled change is shown as a diff and becomes
active only once the operator types `accept`), the operator holds the release's lease (`rb take` … `rb handover`) and
their board syncs state, logs and artifacts (masked) to `<release>/run/`; everyone else follows with
`rb watch PCR-xxxx`. A backup operator is ready for every window and takes over if the operator's Mac dies.

## Ground rules (non-negotiable)

- **Only the operator runs board steps.** Never run `rb run`, `rb next` (without `--show`), `mark`, `reset`, `stop`,
  `attach`, `window`, `forget`, `archive`, `take`, `handover`, `sync`, nor press board keys for the user — not even
  local or "harmless" steps; never hold the lease. Hand over the exact command instead (`rb -r PCR-xxxx run 412`).
  Read-only commands are fine: `rb releases`, `rb watch PCR-xxxx --once`, `rb -r X list`, `next --show`, `where`,
  `log <id>` (no `-f`), `timeline`, `board --once --no-color`, `pull` (without `--force`), `plan show`,
  `plan components`, `plan releases <component> --from preview|maintenance` (reads Azure DevOps), and `dry-run` of a
  step **without** `@plan yes` (an `@plan` step's dry-run runs its live read-only plan against the target).
  `rb -r X plan section|task|group …` edit the local plan only — run them for what the user agreed in the discussion;
  sharing it is `rb push` (below).
- **The operator accepts plan changes, never Claude.** `rb pull` / `rb take` print the change and stop at the typed
  `accept` (Claude has no terminal for it — never work around that). Claude may read the diff and summarise it: what
  changed in `config.sh`, `steps/`, `probes/`, `lib/`, anything surprising (a `\xNN` control-character warning, a
  write to prod, a secret) — then the operator types `accept`. Never type `accept` or `takeover` for the user.
- **No production access by Claude** unless the user grants it explicitly for that task. Prod and staging share the
  prod cluster: steps reach them only through the operator's typed confirmation. When prod data is needed, give the
  operator short read-only commands to run (one per line, explicit `--context`, no `use-context`) and read their output.
  Never `kubectl config use-context` anything.
- **Secrets never pass through Claude:** never read `~/.release-board/*/private/`, Vault dumps, the keychain or
  `~/.poco/debug.out`; never print a password or token; logs are masked — keep it that way in every step written.
- **Subagents stop on a block:** every delegated brief says "if the auto-mode classifier or a permission rule blocks
  an action, stop and report it — never retry it renamed, wrapped or through another tool".
- **Shared writes only when asked:** `rb new` and `rb push` (the plan in the bucket, read by the whole team), and
  commit / push / PRs in `pcr-companion` (engine, catalogue, docs), only when the user asks. Never push `main`
  directly. Never touch bucket or project IAM (the team manages access to `gs://ppcloud-releases`).
- **The catalogue changes only at the retro** (release rule 15). While planning and on the night a catalogue step is
  changed in the plan's copy and a new step is written in the plan — both go on the "Catalogue candidates" list in
  `RELEASE.md` G; no commit, branch or PR in pcr-companion for them before the retro. The one exception: a fix in what
  steps load from the engine (`lib/`, `tools/`) that the night needs — ask the user: write it into the plan's copy, or
  an engine PR + `rb-v…` tag before the window.
- **Release rules** of the team (`docs/release-rules.md` in the repo) apply to every plan: no prod change before the
  window, downtimes grouped and short, maintenance page across the downtimes, late fixes only through a
  regeneration step.

## Setup — find the board

1. Engine: `rb` on PATH — installed with `curl -fsSL https://get-rb.polypoint.dev | bash` (updates itself, never while
   this Mac operates a release; `rb version` shows it, `rb update` updates by hand). Not installed → the user runs that
   line; `rb doctor` then checks tools, logins and access to `gs://ppcloud-releases` (a 403 means asking the team for
   access) and creates `~/.release-board/operator.sh`. A pcr-companion checkout (`$PP_RELEASE_HOME`) is dev mode: `rb`
   via its alias, `rb update` = git pull — needed only to change the engine, the catalogue or the docs.
2. Docs and catalogue: in the pcr-companion repo (`$PP_RELEASE_HOME` when cloned, else Azure DevOps `pcr-companion`).
   The installed engine carries the catalogue too: `rb version` prints the engine directory
   (`~/.release-board/engine/versions/<v>`), the catalogue is its `catalogue/`.
3. Release: `-r PCR-xxxx` on every command or `$PP_RELEASE`. `rb releases` lists the releases in the bucket (lease
   holder, `FROZEN`), `rb -r X where` shows the places: engine · plan cache `~/.release-board/<release>/plan/` of
   `gs://ppcloud-releases/<release>/plan/` · run data `~/.release-board/<release>/` · bucket paths · lease. Legacy
   `runs/<release>/` in git (PCR-2632) load read-only.
4. Read once per session: `docs/release-board.md` (operator guide), `docs/release-rules.md`,
   `tools/release-board/catalogue/README.md`. On a failure: `docs/release-recipes.md`.

## Plan mode — a discussion, with checkpoints

Work through the phases in order; each ends with a **STOP** for the user's agreement. Keep the decisions in the
release's `RELEASE.md` (sections A–E) as they are made, so the operator reads the same story later.
Details, commands and tables: [references/planning.md](references/planning.md).

1. **Identify the release.** PCR id, window date/time, operator and release manager, rotation mode
   (`maintenance-only` or `maintenance-and-preview`). The Confluence **release page** is a subpage of the PCR page —
   read it with the Atlassian connector (ask for the link if the search fails). Create the plan when it does not
   exist — a feature release from CORE: `rb new PCR-xxxx --window "YYYY-MM-DD 22:00" --core`; a hotfix or small
   release: `rb new PCR-xxxx` (empty; it opens the board in plan mode on the user's terminal). The user runs it, or
   ask before running it yourself (with `--no-board`) — it builds the plan in `~/.release-board/<release>/plan/` and
   pushes it to the bucket. When it exists: `rb -r X pull`. Edit the plan in that cache (`rb plan …`, files);
   `rb -r X push` after each agreed change (when the user says so). The user may plan in the board instead (`rb plan`,
   key `p`: sections `a`, tasks `t`, deploy groups `g`) — it pushes by itself.
2. **Scope — both sources, always.** The release page lists the planned stories; the repo diff shows what really
   ships. Diff every shipping repo on origin refs only (`origin/release/maintenance..origin/release/preview` for the
   cloud repo; polypoint-ci and gitops as relevant) and classify each change by the step it needs (Flyway, Vault /
   Keycloak bootstrapping, manifests, new apps, infra, toggles, on-prem contracts). Delegate big diffs to parallel
   subagents per area. Reconcile into the scope table of `RELEASE.md` section A; list every mismatch (change without
   story, story without change) as a question. **STOP** — scope agreed.
3. **Steps.** Every component that ships is a **deploy group**: `rb -r X plan group add <component> --from
preview|maintenance [--release <id|URL|create>] [--staging <section>] [--prod <section>]` (components:
   `rb plan components`). Ask for each: which line, and whether its Azure DevOps release exists already — show the
   newest ones with `rb -r X plan releases <component> --from <line>` (CI creates a maintenance release every morning)
   and let the user pick; no answer = the release task asks when it runs. In a CORE plan a preview group only adds the
   definition to `RELEASE_DEFS` (+ `RELEASE_ID_<def>` for an existing release) and the app syncs; elsewhere it adds the
   whole chain (release → stages → checks → test on staging → Prod stage → syncs → prod check). Then sections and
   free tasks for the rest (`rb plan section add`, `rb plan task add <section> "<title>" --desc … [--command …]`),
   catalogue steps (`rb -r X add <group/file> [id] [slug]`), and new steps (`rb -r X plan task add <section>
"<title>" --script` → a step from `templates/step.sh` with its id; Claude writes its body in the plan's file with its
   own tools — `rb plan task edit` opens `$EDITOR` and needs the user's terminal). A catalogue step that needs a change
   for this release → edit the plan's copy, never the catalogue; every changed copy and every new reusable step goes on
   the "Catalogue candidates" list in `RELEASE.md` G (id, origin, what and why) for the retro. Details:
   [references/planning.md](references/planning.md) §3. Each new step:
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
6. **Hand over.** The plan is pushed (`rb -r X push`). Catalogue candidates wait for the retro; only an engine fix
   the night needs goes through a PR and an `rb-v…` tag before the window (`rb selftest` green, when the user asks).
   No PR for the plan — the bucket replaces it: the incoming operator reviews it (`rb -r X pull` shows the diff, they type `accept`; a `dry-run` walk through
   the steps), then `rb -r X take` and `rb -r X board`. Name the **backup operator** in `RELEASE.md` (release rule 14:
   set up, bucket access, own prod access and credentials, plan pulled and accepted, `rb watch` open in the window)
   and decide `RB_LEASE_STALE_MIN` for the window (e.g. `5` in `config.sh`).

## Orchestrate mode — the operator runs, Claude reads and prepares

Commands, state-file format and the triage flow: [references/orchestration.md](references/orchestration.md).

- **"Which step next?"** → `rb -r X next --show`, cross-check with `list`, answer with the step id(s) only
  (`412`, or `412, then 413`) unless the user asks for more. Mention a downtime badge (▲ starts, ▼ ends, ◆ inside)
  when the next step carries one. Never suggest running steps in parallel unless asked.
- **Progress** → `rb -r X list`, the state files and `rb -r X log <id>` on the operator's Mac, or `rb watch X --once`
  from anywhere (a read-only copy in `~/.release-board/<release>-watch/`); summarise running / failed / blocked and the
  ongoing downtimes. Keep `RELEASE.md` section F (log) current with what happened, in one line per event (in the
  operator's plan cache the board's sync pushes it; elsewhere `rb push` when the user says so).
- **A step failed** → read its log tail, the step script and the libs it sources; match the symptom against
  `docs/release-recipes.md`; then propose ONE of: a fix to the step script (edit the plan's copy, show the diff, the
  operator reruns; then add it to the catalogue candidates in `RELEASE.md` G), a manual action as exact commands for
  the operator, or a decision for the release manager (skip / postpone / rollback step). The operator records outcomes (`rb -r X mark <id> done "<note>"` — give them the
  command). After a fix, say exactly what to rerun and what to check.
- **Late change after the freeze** (a critical PR) → a release-regeneration step (catalogue `releases/`), never an
  ad-hoc deploy.
- **The operator's Mac died** (power cut, crash) → the backup operator follows "Emergency takeover" in
  `docs/release-board.md`: wait until the lease is stale (`rb -r X where` shows the threshold), `rb -r X take` +
  `takeover` + `accept` (they type both), then check the step that was running (log, probes, the target) before a
  rerun or a `mark`. Claude reads (`rb watch X --once`, `log <id>`) and advises; it never takes the lease.
- **The night ends** → `467`-style all-synced check green, maintenance page off, bootstrapping back to 0 with the
  Vault root token removed, then the post steps.

## Retro mode — every failure becomes a fix or a decision

Workflow and file conventions: [references/retro.md](references/retro.md).

1. Collect: `rb -r X timeline` (the report under the operator's logs), `RELEASE.md` section F, the user's and other
   participants' notes. List everything that went wrong, numbered, in `RELEASE.md` section G.
2. Go item by item with the user: **close** (no action), **park** (with an owner), or **fix**. A fix is a catalogue
   step, an engine change or a release rule — written now, with a thin TEST step (post phase, 521+) the operator runs
   on CT or prod; after the test the wrapper leaves the board and the result goes to section F.
3. **Back into the catalogue** — the only moment it changes. `rb -r X plan diff-catalogue` (read-only) lists the
   copies changed in the plan, the new tasks, the filled-in templates and the deploy-group tasks changed in the plan;
   with `--catalogue <worktree on origin/main>/tools/release-board/catalogue --diff` it compares with the PR's base.
   Merge it with the "Catalogue candidates" list of `RELEASE.md` G and decide each with the user: **port**,
   **release-only** or **drop**. Port in a pcr-companion worktree on `origin/main` (catalogue layout, not the plan's:
   no `@from`, the catalogue's id and `@depends`; `CORE` when every release needs it; a CT test step when behaviour
   changes), `rb selftest` green, release notes for the next tag — then, with the user's OK, one commit and one PR
   (with the retro's other catalogue / engine / doc fixes). After the merge the user pushes the `rb-v…` tag: the
   catalogue ships inside the engine. Details: [references/retro.md](references/retro.md) §4.
4. Write the retro into `RELEASE.md` first — the plan freezes with the evidence. Then the operator runs
   `rb -r X archive` after the forget-credentials step: evidence → `gs://ppcloud-releases/<release>/evidence/` +
   `FROZEN`, secrets refused, lease released, no git commit.

## Memory

Keep one project memory per release while it is active (`<pcr-id>-release`): window, operator, decisions, the
current step, open retro items. Delete or close it once the evidence is frozen — the bucket is the record.
