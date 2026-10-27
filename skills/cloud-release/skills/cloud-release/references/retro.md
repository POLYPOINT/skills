# Retro — details

Goal: every failure, workaround or surprise of the night becomes either a tested fix for the next release or an
explicit decision not to act. The board catalogue grows from this; it is how PCR-2643's 38 retro items became the
catalogue's root-token, Keycloak-admin, first-pod-then-all and maintenance-page steps.

## 1. Collect

- `rb -r X timeline` → `~/.release-board/<release>/logs/timeline-report.md`: step durations, failed runs, downtime
  windows (exact vs step bounds), every action.
- `RELEASE.md` section F (the log) and E (decisions taken on the night).
- Notes from other participants (on-call, communication, the on-prem team) — ask the user for them.
- List everything in `RELEASE.md` section G, numbered, grouped: what broke · what was slow · process · tooling.

## 2. Decide, item by item

Go through the items one at a time with the user. For each, record the decision in G:

```
12. `[x]` <what went wrong> — **closed** (<who> <date>): <why no action>
14. `[ ]` <…> — **analysis before the next release** (<who> <date>): <what to find out>
34. `[~]` <…> — **parked** (<who> <date>): <waiting for whom/what>
 9. `[x]` <…> — **automated + CT-tested <date>**: <catalogue step / engine change> (TEST 528 passed)
```

Don't push a fix the user does not want; "we just fix it by hand if it happens again" is a valid decision.

## 3. Fix

- **A missing step** → write it in `tools/release-board/catalogue/<group>/` (reusable) and add it to `CORE` when every
  release needs it. Release-specific → the next release's plan (`rb add`, `rb push`) once that release exists.
- **An engine problem** → change `tools/release-board/` and keep `rb selftest` green; add a selftest case when the bug
  can be reproduced on throwaway state.
- **A rule** → `docs/release-rules.md` (one line, plus the incident behind it); a known failure → `docs/release-recipes.md`
  (symptom → cause → fix → prevention).

## 4. Back into the catalogue — what changed in the plan

Planning and the night changed the plan's copies and wrote new tasks; none of it reached the catalogue (release rule
15). Now it does, once, through one PR.

```bash
rb -r X plan diff-catalogue          # read-only: every plan step against where it came from
git -C "$PP_RELEASE_HOME" fetch -q origin
git -C "$PP_RELEASE_HOME" worktree add -b retro/pcr-xxxx-catalogue ~/pcr-companion-worktrees/pcr-xxxx-catalogue origin/main
rb -r X plan diff-catalogue --catalogue ~/pcr-companion-worktrees/pcr-xxxx-catalogue/tools/release-board/catalogue --diff
```

| Verdict                                  | What to do                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| changed in the plan                      | a candidate: port the change, or keep it release-only                                               |
| changed in the plan AND in the catalogue | merge by hand: start from the catalogue's version, re-apply the plan's change                       |
| filled-in template copies                | nothing, unless the template's fixed part changed (`--diff` shows it)                               |
| deploy-group tasks changed in the plan   | the fix belongs in `lib/plan.sh` (the generator) or `lib/deploy.sh` (what it runs)                  |
| new — written in the plan                | reusable → a catalogue step (an id in its phase directory, full header); release-specific → nothing |
| the catalogue changed since the copy     | nothing to bring back                                                                               |
| `@from` not readable                     | compare by hand                                                                                     |

`@phase`, `@depends` and `@item` are the plan's layout: `--diff` shows them, the verdict ignores them. Read the
"Catalogue candidates" list in `RELEASE.md` G next to it (it says why each change was made) and decide every item with
the user: **port**, **release-only**, **drop** — record the decision in G.

Porting, in the worktree:

- The catalogue's layout, not the plan's: no `@from` line, the catalogue id and slug, `@phase` / `@depends` as the
  catalogue numbers them. A new step also gets its row in `catalogue/README.md` (the lesson column: this release and
  why) and a line in `CORE` when every release needs it.
- A behaviour change gets a CT test step in `catalogue/tests/` when it can be rehearsed (§5 runs it).
- `tools/release-board/selftest.sh` green, `bash -n` on every touched step; `release-notes/rb-v<next>.md` for the tag.
- Then, with the user's explicit OK, one commit and one PR (with the retro's other catalogue / engine / doc fixes of
  §3). After the merge the user pushes the tag `rb-v<next>` (pipeline 478 publishes it): the catalogue ships inside the
  engine, so teammates get it with that release. Claude never tags.

## 5. Test before closing

- For each fix, a thin TEST step on the current release's board: post phase, ids 521+, `@target ct` (or prod when only
  prod can show it — the operator decides), which calls the real catalogue step or lib functions.
- The operator runs it (`rb -r X run 52N`) and confirms what they saw (e.g. the banner in the app).
- Then move the wrapper out of `steps/` into the plan's `retro-tests/` (kept with the release; the board's sync or
  `rb push` uploads it) and log the result in F: date, what was tested, outcome. All of this happens before the
  archive: the plan freezes with the evidence.
- A test that fails is a finding, not a formality: reopen the item.

## 6. Close the release

- After the forget-credentials step (the keychain items and private dumps are the rollback baseline until then) and
  with `RELEASE.md` final (retro + log): the operator runs `rb -r X archive` → `gs://ppcloud-releases/<release>/evidence/`
  (timeline, logs, state; refuses unmasked secrets) + `evidence/FROZEN`, and the lease is released. No git commit.
- The PR of §3–4 holds the catalogue / engine / doc fixes only — committed and opened at the retro with the user's OK,
  never while planning or on the night. The evidence and `RELEASE.md` stay in the bucket.
- The release is frozen once `evidence/FROZEN` exists (`rb push` and `rb take` refuse): later improvements go to the
  catalogue, the engine or the next release, never back into the run.
