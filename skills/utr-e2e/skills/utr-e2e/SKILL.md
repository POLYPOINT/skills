---
name: utr-e2e
description: Use when asked to run the UTR E2E, the unified time recording end-to-end regression of one on-prem bundle (e.g. "run the UTR E2E against the PR env", "E2E the time recording feature on a DeployMate env", "check what the api-pp refactor broke in myPP time recording", optionally "and compare it with master"), or to re-run the time-recording scenario catalogue after an on-prem or cloud change. Solo alias of the cloud-e2e skill's group utr - provisions and seeds the DeployMate environment, orchestrates Sonnet agents per scenario family with pace control, a live dashboard artifact, PEP/DB oracles, and a consolidated findings report.
argument-hint: '<run name> [--agents N] [--families R,O,M,W,P,C,L,MO,X] [--compare <second env>] [--worker-model opus]'
compatibility: Needs the cloud-e2e plugin (same marketplace) - this alias carries no content of its own. Claude Code as the orchestrator (Opus 5.5 recommended) with the Agent tool (Sonnet 5.5 workers), the Artifact + ArtifactData tools, the deploymate, pep-verify and playwright-cli skills, az/poco CLIs.
metadata:
  version: '0.6.0'
---

# UTR E2E — solo alias of cloud-e2e group `utr`

The UTR time-recording regression moved, unchanged, into the **cloud-e2e** skill as its group `utr` (v0.6.0 of this alias = cloud-e2e 0.1.0). `/utr-e2e` keeps its arguments and behaviour: one person, one environment (plus the optional `--compare` environment), results in `results/<run>/`.

**Usage:** `/utr-e2e "<run name>" [--agents N] [--families R,O,M,W,P,C,L,MO,X] [--compare <second env>] [--worker-model opus]`

## What to do

1. Invoke the `cloud-e2e` skill (Skill tool) with the arguments
   `run "<run name>" --group utr --solo` followed by every argument this alias received, unchanged (`--agents`, `--families`, `--compare`, `--worker-model`).
2. If the `cloud-e2e` skill is not available, stop and tell the user to install it: `/plugin install cloud-e2e` (marketplace POLYPOINT/skills). Do not run the regression from memory.

Inside cloud-e2e the run follows `groups/utr/references/runbook.md` (the former `SKILL.md` of this skill: Phase 0 provision, 0b gates + dashboard, 1 seed, 2 fan-out, 3 consolidation) with the UTR scenario catalogue, briefs, seed runbook and helpers under `groups/utr/`. What changed around it is listed at the top of that runbook: paths, the PEP lock (a dashboard-db lock instead of a lock file), the prompt engine (`scripts/gen-prompts.py --group utr --solo`), and the multi-group dashboard (it still reads the v0.5.0 rows; `--compare` keeps `assets/dashboard-compare.html`).
