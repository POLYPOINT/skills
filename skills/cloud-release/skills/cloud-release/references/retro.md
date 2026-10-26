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
  release needs it. Release-specific → `runs/<next release>/steps/` once that release exists.
- **An engine problem** → change `tools/release-board/` and keep `rb selftest` green; add a selftest case when the bug
  can be reproduced on throwaway state.
- **A rule** → `docs/release-rules.md` (one line, plus the incident behind it); a known failure → `docs/release-recipes.md`
  (symptom → cause → fix → prevention).

## 4. Test before closing

- For each fix, a thin TEST step on the current release's board: post phase, ids 521+, `@target ct` (or prod when only
  prod can show it — the operator decides), which calls the real catalogue step or lib functions.
- The operator runs it (`rb -r X run 52N`) and confirms what they saw (e.g. the banner in the app).
- Then move the wrapper out of `steps/` into `runs/<release>/retro-tests/` (kept with the run) and log the result
  in F: date, what was tested, outcome.
- A test that fails is a finding, not a formality: reopen the item.

## 5. Close the release

- After the forget-credentials step (the keychain items and private dumps are the rollback baseline until then): the
  operator runs `rb -r X archive` → `runs/<release>/evidence/` (timeline, logs, state; refuses unmasked secrets).
- One PR in pcr-companion with the evidence, `RELEASE.md` (retro + log) and the catalogue/engine/doc fixes — when the
  user asks for it.
- `runs/<release>/` is frozen after that merge (pcr-companion convention): later improvements go to the catalogue,
  the engine or the next release, never back into the run.
