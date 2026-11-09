# Orchestrating the night — details

The operator runs every step from the board. Claude reads, explains, prepares fixes and hands over commands.

## Commands

| Command                                                                                   | Who runs it                                | What it does                                                                                                   |
| ----------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `rb releases [--active \| --archived]` · `rb -r X where` · `rb -r X list`                 | Claude or operator                         | read-only                                                                                                      |
| `rb watch X --once`                                                                       | Claude or anyone                           | read-only: pulls the bucket's plan + run data into `~/.release-board/<release>-watch/`                         |
| `rb -r X pull`                                                                            | Claude reads, operator accepts             | shows the bucket's plan change as a diff; only the operator's typed `accept` activates it                      |
| `rb -r X pull --check`                                                                    | Claude or operator                         | read-only: is a plan change waiting in the bucket? (exit 0 no · 3 yes · 1 unreachable; refused in a watch)     |
| `rb -r X push`                                                                            | when the user asks                         | plan edits to the bucket (generation preconditions; a conflict names the file)                                 |
| `rb -r X next --show`                                                                     | Claude or operator                         | read-only: the failed step to rerun first, else the next runnable step                                         |
| `rb -r X log <id>`                                                                        | Claude or operator                         | last 200 lines of the step's log. `-f` follows it: operator only                                               |
| `rb -r X dry-run <id>`                                                                    | Claude, only for steps without `@plan yes` | prints the header and body. An `@plan` step's dry-run runs its live, read-only plan                            |
| `rb -r X plan chain show`                                                                 | Claude or operator                         | read-only: the chain links (`CHAIN_LINKS` in `config.sh`)                                                      |
| `rb -r X plan chain set <id> <next ids\|->`                                               | Claude for what the user agreed            | a plan edit (`-` removes the links); shared like any other (`rb push`, the operator's sync)                    |
| `rb -r X timeline`                                                                        | Claude or operator                         | writes `logs/timeline-report.md` (steps, downtime windows, every action)                                       |
| `rb -r X board --once --no-color --width 160`                                             | Claude or operator                         | one frame of the board as text                                                                                 |
| `rb -r X board`                                                                           | operator                                   | the live board; its keys: [below](#board-keys-rb-160)                                                          |
| `rb -r X run <id>` · `next` · `mark` · `reset` · `stop` · `window` · `forget` · `archive` | **operator only**                          | writes state or touches targets (all but `forget` need the lease); `mark` refuses a live step unless `--force` |
| `rb -r X take` · `handover` · `sync`                                                      | **operator only**                          | the lease: take it (plan diff + `accept`, run data), hand it on, sync to the bucket                            |

## Where things are

`rb -r X where` prints them. The plan accepted here is in `~/.release-board/<release>/plan/` (from
`gs://ppcloud-releases/<release>/plan/`; a pulled change not accepted yet waits in `.sync/incoming/`). The operator's
run data is in `~/.release-board/<release>/`; while they hold the lease, the board copies step states, `events.log`,
`window.start`, artifacts, step logs and the timeline (masked) to `gs://ppcloud-releases/<release>/run/` every 15 s, and
`run/OPERATOR` names the operator, their last heartbeat and the takeover threshold. A watch reads that copy into
`~/.release-board/<release>-watch/` (same layout; it never runs plan code — probes show as operator-side only):

- **`state/<id>.state`:** `key=value` lines with `status` (todo · running · done · failed · skip · blocked), `started`,
  `ended` (epoch), `exit`, `note` (the step's last `step_note`), `by`, `pid`, `forced`. A status of running whose pid is
  dead is shown as **stale**: the runner is gone, so mark the step failed or todo.
- **`state/<id>.waiting`:** the step waits for an answer, and the file holds the prompt. With a board job, the operator
  presses `f`.
- **`state/events.log`:** one line per start, end or mark.
- **`state/window.start`:** the window clock, set by the first window step.
- **`state/artifacts/`:** files that steps hand to each other: release ids, markers, snapshots. These are not secrets.
  Synced as masked copies (names `[A-Za-z0-9._-]`, ≤ 1 MiB each), so a takeover inherits them.
- **`logs/<id>.log`:** timestamped output of every run of the step. Reruns are separated by a `=====` line.
- **`logs/dry-<id>.log`:** a dry-run job's output (`d` / `D`; an `@plan yes` step's live plan) — `rb log dry-<id>`,
  never in the step's own log, which is the run's evidence.
- **`state/chain/`:** the operator's chain switch and the completions already acted on. Local, never synced; a watch
  sees the switch from the `chain-on` / `chain-off` events.
- **`logs/timeline.log`:** TSV with time, step, type, text and operator. Types: STEP-START, STEP-END, DOWNTIME-START,
  DOWNTIME-END, ACTION, MARK, WINDOW, NOTE.
- **`private/`:** 0700. Never read it. It, `proxies/`, the probe cache and `confirm.*` never reach the bucket.

Exit codes: 0 done · 3 skip · 4 blocked · anything else failed · 130 interrupted (Ctrl-C).

## Board keys (rb 1.6.0)

The operator presses them; Claude names the key, never presses it. The bottom line shows the most used keys, `?`
(or `h`) shows every key by context (run view, jobs, chain, plan mode, watch) and the legend of states and row marks.

| Key             | Does                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `s` / `S`       | start the selected step as a background job / and bring it to the foreground                                |
| `f` · `x`       | foreground a job (its run, else its dry-run; a `⌨` job waits for its typed target) · clear ended jobs      |
| `d` / `D`       | dry-run the selected step as a job (no state, no ▶; `logs/dry-<id>.log`); refused while the step runs      |
| `m`             | `rb mark` on the selected step (done · skip · todo · failed · blocked + note); prod / staging: typed target |
| `U`             | review the bucket's plan change (`rb pull`'s review); only the full word `accept` + Enter activates it      |
| `A` · `W`       | chain on / off · auto on / off (`⛓ CHAIN ON · AUTO`) — the operator's local choice, default off            |
| `Y` · `>`       | start what the chain proposes · the selected step's chain links (a plan edit)                               |
| `!` · `p` · `?` | force-stop (`y` confirms) · plan mode · help                                                                |

`m` and `s` / `S` are refused in a watch, without the lease and on a running step (`m` checks again right before it
marks); `s` / `S` are refused while the step's dry-run job is open. A dry-run needs no lease (in a watch `d` copies the
command). Ctrl-C in a dialog (`m`, `U`, `>`, plan mode's) cancels the dialog only; the board keeps running.

## "Which step next?"

1. Run `rb -r X next --show`. A `RERUN` line means a step failed and must be fixed or decided on before anything else.
2. Answer with the id(s) only, e.g. `412`, unless asked for more. Add the downtime badge when the step carries one
   (▲ starts · ▼ ends · ◆ inside).
3. Only mention steps that can run while another one waits when the user asks for that.
4. With the chain on, the board may propose (`Y`) or start (`W`) linked steps by itself — see "The chain". Say so when
   the next step is linked; `rb -r X list` and the timeline show `started by chain after N` for those.

## The chain (rb 1.6.0)

- **Links belong to the plan:** `CHAIN_LINKS='401>402,403 402,403>404'` in `config.sh` (1→1, 1→n, n→1, n→n; always
  quoted). Set with `>` on the board or `rb -r X plan chain set <id> <next ids|->`; `rb -r X plan chain show` reads
  them. Setting a link is a plan edit: only what the user agreed. Refused: a step after itself, an unknown id, a loop,
  a rollback step after a non-rollback one; over 200 links / 4096 characters the whole value is ignored (one warning).
- **Running it is the operator's local choice** (`A`, `W`), never the plan's and never Claude's: default off, off
  again after a new `rb take`. Chain on: when a linked step ends done (a run or `rb mark … done`), its ready next steps
  are proposed (`⛓ 401 done → 402, 403 — Y starts them`); with auto (`W`) they start at once as background jobs.
- **It never** continues after a step that did not end done, starts a failed / blocked / skipped step or a done
  run-once step, starts a step whose `@depends` are unmet (held: `⧗ chain: 404 waits for …`) or whose dry-run job is
  open, nor runs in a watch, in plan mode or without the lease. A step after several linked steps waits for all.
- **A prod or staging step it starts still stops at its typed target** (`⌨`, `f` answers) — a check too, it never
  reuses an earlier confirmation. Nothing types it for the operator.
- **The record:** every start leaves an event and the timeline line `started by chain after 401`; a step it leaves
  alone a `chain-skip` event with the reason. To let a proposal go: `A` twice (only later completions count).

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
     `rb -r X mark 454 done "false positive: …"` (board: `m`). `mark` refuses a step that runs now (its runner or
     board job is alive, also at its typed target) — it records its own outcome. A runner gone (`?`, dead pid) is
     marked as before. Give `rb -r X mark <id> <state> --force "…"` only when the runner is really gone or stuck,
     after telling the operator what it means: the step is recorded while its process may still act on the target,
     the steps after it count it as met, and the timeline notes `forced while it ran`. A range never marks a live step.
   - **A decision for the release manager:** skip, postpone, or an on-demand rollback step (9xx). Its `dry-run`
     shows the live plan without changing anything; the operator runs it.
7. Note it in `RELEASE.md` section F: time, step, what happened, the fix. Fixes made on the night are in the bucket's
   plan already (the board's sync); a fix worth keeping for later releases goes on the "Catalogue candidates" list in
   `RELEASE.md` G — the catalogue itself changes at the retro (release rule 15), never on the night.

## Things to know on the night

- A force stop (`!`, `rb stop`) only stops the local run. An ADO stage, an ArgoCD sync or a pgloader run that already
  started keeps going server-side, so check before you rerun.
- `argo_sync` pauses an app's Deployments before syncing and resumes them on failure, Ctrl-C, TERM or a closed
  terminal. A runner killed hard (KILL, crash) leaves them paused; rerunning the sync step finishes their
  first-pod-then-all rollout (`fta_finish_paused`), even when the app already reads Synced.
- Prod ArgoCD never auto-syncs, so a manual `kubectl patch` stays as drift until the next sync.
- While the maintenance page is on, every sync re-routes the `MAINT_APPS` Ingresses it reset. The myPOLYPOINT app only
  shows the banner after its own next API call.
- A prod or staging step asks for the typed target. A `check` step's confirmation covers the next 30 minutes'
  checks (`CHECK_CONFIRM_TTL`) — except a step the chain starts, which always asks, and a dry-run's own, never kept.
- **NO-GO (330).** The operator marks 330 skip, then `rb -r X mark 334-469 skip "no-go"` — a skipped range leaves
  its done steps done (a late fix 340 that already ran keeps its record). A skipped 330 counts as a met dependency, so
  until that mark the board offers the next prep steps: from rb 1.5.1 342 (the Prod stages) refuses after a NO-GO,
  334 sets nothing. Claude gives the command, never marks.
- **A late fix (340 or a copy)** lists per component every commit the new build adds besides the fix, with its PR,
  and asks for `ship-extra`: the release manager decides, the operator types it; anything else stops, nothing created.
  Claude may summarise that list for the release manager (the step output; `state/artifacts/hotfix-<id>.txt` keeps
  `extra=` and `decision=` once shipped) — it never types the word. A copy that already ran asks `resume` (deploy its
  release's Preview / Staging stages) or `again` (a new regeneration from the release `artifacts/releases.txt` names
  now; a superseded release that never replaced the row may be abandoned — its Prod stage must never run). 342
  refuses while a copy is neither done nor skipped: run it, or `rb -r X mark <id> skip "<decision>"`.
- **OutOfSync apps at 344 / 467.** Health problems, paused Deployments and (467) the page still on fail with no
  question. Apps that are only OutOfSync (Healthy) — at 344 those no step syncs — are listed last; the operator
  accepts the whole list by typing how many apps it shows (e.g. `27`), logged in the step log, note and timeline —
  anything else, or no terminal, fails. Claude may explain an app's drift read-only (the step log, the gitops
  history; prod facts through the operator's read-only commands) and whether it belongs to the release; it never
  accepts for them. An app the release ships needs its sync step instead.
- **UptimeRobot (rb 1.5.0).** 334 (prep, the afternoon session, after GO 330) sets the night's maintenance window
  from `PHASE_AT_window` for `UPTIMEROBOT_WINDOW_MIN` minutes (480) over the monitors it lists before a typed `y`;
  nothing is set after a NO-GO. A rerun keeps it, `[u]pdate`s a moved window start or `[d]elete`s it — a night
  called off after 334: rerun 334 → `[d]elete` (it ends skip), then `mark 469 skip`. 469 (after 467) cuts the window
  to the real end so UptimeRobot alerts again; it refuses before the window's start and says when the night ran past
  the window. The account's MAIN API key (Keeper) is typed by the operator at 334's hidden prompt, kept in the
  keychain until 530 and handed to curl on stdin only; a refused key (401) is forgotten and the rerun asks again.
  Claude never asks for the key, reads it or passes it on. First live run: compare the window in the UptimeRobot
  dashboard with what 334 printed — the API takes date + time without a zone, assumed to be `UPTIMEROBOT_TZ`.
- The board's sync line: `sync ✔ <age>` is normal; `⚠ LEASE LOST` means someone took the release over (or the lease
  was deleted) — this board is read-only now, the operator runs `rb watch` or a new `rb take`; `PLAN CONFLICT` means a
  plan file was pushed from elsewhere — `rb push` names it; "plan change … waits for review" means a pulled change was
  not accepted (the board runs the accepted plan). When the bucket is unreachable the operator keeps running steps on
  their own lease (with a warning) — for at most `RB_LEASE_STALE_MIN − 2` minutes (8 by default): then
  `⚠ LEASE NOT CONFIRMED` and no step starts (a backup operator may take over 2 minutes later; a running step is not
  killed). Check `rb -r X where`.
- **The plan banner** above NEXT, `⚠ plan changed in the bucket — 2 files, pushed 14:02 — U to review`: the board
  polls `rb pull --check` (every `RB_PLAN_POLL_SECONDS`, 30) and never activates anything itself. Claude may confirm
  it with `rb -r X pull --check` (read-only; exit 3 = a change waits). Tell the operator to press `U` and review: the
  diff, then the warnings above the prompt (control characters, lines that look like a secret, what acts on prod, the
  running steps it replaces — they finish with the version they started with). Only the full word `accept` + Enter
  activates it; anything else changes nothing. Claude may summarise the diff (`rb -r X pull`, or the operator pastes
  it); who pushed it is a question for the release channel (the bucket records when, not who). A dim line
  `plan check: the bucket does not answer …` is only a warning: the board goes on.
- A handover: the outgoing operator `rb handover` (refused while a step runs or a job is open), the incoming one
  `rb take` — they inherit the real state and the artifacts; no `rb mark … "handover"`. A takeover of a lease whose
  heartbeat is older than its threshold (`RB_LEASE_STALE_MIN`, 10 min by default, often 5 for the window) needs the
  word `takeover` typed.

## Emergency takeover (the operator dropped out)

The backup operator runs it (release rule 14), following `docs/release-board.md` "Emergency takeover":

1. `rb -r X where` (or `rb watch X --once`): the lease holder, its last heartbeat and the takeover threshold. Before
   the threshold `take` refuses.
2. `rb -r X take`: they type `takeover`, read the plan diff (normally none), type `accept`. Claude may summarise the
   diff; it never types either word.
3. The step that was running shows as runner gone: read its log and the probes, check the target (an ADO stage, ArgoCD
   sync or rollout keeps going server-side), then the operator reruns it or records it (`rb -r X mark <id> …`).
4. Credentials and target confirmations are asked again on the backup operator's board (the UptimeRobot key at 469 too); proxies
   start again on demand.
