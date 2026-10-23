# Orchestrating the night — details

The operator runs every step from the board. Claude reads, explains, prepares fixes and hands over commands.

## Commands

| Command                                                                                   | Who runs it                                | What it does                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `rb releases` · `rb -r X where` · `rb -r X list`                                          | Claude or operator                         | read-only                                                                                   |
| `rb watch X --once`                                                                       | Claude or anyone                           | read-only: pulls the bucket's plan + run data into `~/.release-board/<release>-watch/`      |
| `rb -r X pull`                                                                            | Claude or operator                         | the bucket's plan into the local cache; refuses local edits not pushed (never `--force`)    |
| `rb -r X push`                                                                            | when the user asks                         | plan edits to the bucket (generation preconditions; a conflict names the file)              |
| `rb -r X next --show`                                                                     | Claude or operator                         | read-only: the failed step to rerun first, else the next runnable step                      |
| `rb -r X log <id>`                                                                        | Claude or operator                         | last 200 lines of the step's log. `-f` follows it: operator only                            |
| `rb -r X dry-run <id>`                                                                    | Claude, only for steps without `@plan yes` | prints the header and body. An `@plan` step's dry-run runs its live, read-only plan         |
| `rb -r X timeline`                                                                        | Claude or operator                         | writes `logs/timeline-report.md` (steps, downtime windows, every action)                    |
| `rb -r X board --once --no-color --width 160`                                             | Claude or operator                         | one frame of the board as text                                                              |
| `rb -r X board`                                                                           | operator                                   | the live board. `s`/`S` start a background job, `f` foreground, Ctrl-B back, `!` force stop |
| `rb -r X run <id>` · `next` · `mark` · `reset` · `stop` · `window` · `forget` · `archive` | **operator only**                          | writes state or touches targets (all but `forget` need the lease)                           |
| `rb -r X take` · `handover` · `sync`                                                      | **operator only**                          | the lease: take it (inherits plan + run data), hand it on, sync to the bucket               |

## Where things are

`rb -r X where` prints them. The plan is cached in `~/.release-board/<release>/plan/` (from
`gs://ppcloud-releases/<release>/plan/`). The operator's run data is in `~/.release-board/<release>/`; while they hold
the lease, the board copies step states, `events.log`, `window.start`, step logs and the timeline (masked) to
`gs://ppcloud-releases/<release>/run/` every 15 s, and `run/OPERATOR` names the operator and their last heartbeat. A
watch reads that copy into `~/.release-board/<release>-watch/` (same layout):

- **`state/<id>.state`:** `key=value` lines with `status` (todo · running · done · failed · skip · blocked), `started`,
  `ended` (epoch), `exit`, `note` (the step's last `step_note`), `by`, `pid`, `forced`. A status of running whose pid is
  dead is shown as **stale**: the runner is gone, so mark the step failed or todo.
- **`state/<id>.waiting`:** the step waits for an answer, and the file holds the prompt. With a board job, the operator
  presses `f`.
- **`state/events.log`:** one line per start, end or mark.
- **`state/window.start`:** the window clock, set by the first window step.
- **`state/artifacts/`:** files that steps hand to each other: release ids, markers, snapshots. These are not secrets.
- **`logs/<id>.log`:** timestamped output of every run of the step. Reruns are separated by a `=====` line.
- **`logs/timeline.log`:** TSV with time, step, type, text and operator. Types: STEP-START, STEP-END, DOWNTIME-START,
  DOWNTIME-END, ACTION, MARK, WINDOW, NOTE.
- **`private/`:** 0700. Never read it. It, `artifacts/`, `proxies/` and `confirm.*` never reach the bucket.

Exit codes: 0 done · 3 skip · 4 blocked · anything else failed · 130 interrupted (Ctrl-C).

## "Which step next?"

1. Run `rb -r X next --show`. A `RERUN` line means a step failed and must be fixed or decided on before anything else.
2. Answer with the id(s) only, e.g. `412`, unless asked for more. Add the downtime badge when the step carries one
   (▲ starts · ▼ ends · ◆ inside).
3. Only mention steps that can run while another one waits when the user asks for that.

## Triage of a failed step

1. Read `rb -r X log <id>`. The last 40–80 lines usually hold the `[FAIL]` line and its cause.
2. Read the step script (the plan cache: `~/.release-board/<release>/plan/steps/<id>-*.sh`) and the libs it sources, to
   see what it did before failing.
3. Sort the failure into one kind:
   - **script bug:** wrong pattern, name or path; a gate that cannot pass;
   - **environment:** missing secret, bucket, permission or user; cluster state; a pod in CrashLoopBackOff;
   - **data:** constraint, duplicates, column too short;
   - **dependency:** an earlier step was skipped or was wrong;
   - **transient:** network, timeout, API hiccup.
4. Look the symptom up in `docs/release-recipes.md` (pcr-companion). It records every failure seen so far, with the
   fix and the step that now prevents it.
5. If prod facts are needed, give the operator read-only commands, one per line, short, with explicit
   `--context <prod ctx>`. Never use `use-context`. Read the output they paste.
6. Propose one way forward:
   - **Fix the script:** edit `steps/<id>-*.sh` in the operator's plan cache (the board reloads within 10 s and its
     sync pushes the fix to the bucket within ~15 s). Keep the diff minimal, run `bash -n`, show the diff, and say
     what to rerun and what to check.
   - **A manual action:** exact commands for the operator, then the mark command with a note, e.g.
     `rb -r X mark 454 done "false positive: …"`.
   - **A decision for the release manager:** skip, postpone, or an on-demand rollback step (9xx). Its `dry-run`
     shows the live plan without changing anything; the operator runs it.
7. Note it in `RELEASE.md` section F: time, step, what happened, the fix. Fixes made on the night are in the bucket's
   plan already (the board's sync); a fix worth keeping for later releases goes to the catalogue in the retro.

## Things to know on the night

- A force stop (`!`, `rb stop`) only stops the local run. An ADO stage, an ArgoCD sync or a pgloader run that already
  started keeps going server-side, so check before you rerun.
- `argo_sync` pauses an app's Deployments before syncing and resumes them on failure, Ctrl-C, TERM or a closed
  terminal. A runner killed hard (KILL, crash) leaves them paused; rerunning the sync step finishes their
  first-pod-then-all rollout (`fta_finish_paused`), even when the app already reads Synced.
- Prod ArgoCD never auto-syncs, so a manual `kubectl patch` stays as drift until the next sync.
- While the maintenance page is on, every sync re-routes the `MAINT_APPS` Ingresses it reset. The myPOLYPOINT app only
  shows the banner after its own next API call.
- A prod or staging step asks for the typed target. Read-only checks reuse that confirmation for 30 minutes.
- The board's sync line: `sync ✔ <age>` is normal; `⚠ LEASE LOST` means someone took the release over (or the lease
  was deleted) — this board is read-only now, the operator runs `rb watch` or a new `rb take`; `PLAN CONFLICT` means a
  plan file was pushed from elsewhere — `rb push` names it. When the bucket is unreachable the operator keeps running
  steps on their own lease (with a warning); the sync catches up later.
- A handover: the outgoing operator `rb handover` (refused while a step runs or a job is open), the incoming one
  `rb take` — they inherit the real state; no `rb mark … "handover"`. A takeover of a lease whose heartbeat is older
  than 10 min needs the word `takeover` typed.
