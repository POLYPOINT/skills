# Lessons — read before the first seed step

Generic lessons from the UTR runs (2026-10-14 … 10-22) and the cloud-E2E research. Group packages keep their own (`groups/<key>/references/lessons.md`, UTR: the full v0.5.0 list).

## Environment artefacts that look like product regressions

- **api-pp definition cache (gate G4b)**: a definition, palette, right, closing date or employment changed in PEP or SQL is invisible to api-pp until the persistence-state-change events are enqueued (`scripts/psc-enqueue.sh`; DeployMate boxes have no PSC triggers, api-pp caches up to 7 days). Signatures: api-pp 404 "Shift definition with id N not found", unified `/days` 404 / 500, block writes 500 `LEGACY_TIME_RECORDING_OPERATION_FAILED`, legacy writes 409. The first UTR run filed four "findings" that were this.
- **Portal flags propagate in 3–5 min** (portal cache ≈ 3 min + POMA reload 60 s): every FLAG window includes 2 × 5 min; poll a fresh `config/features` (`waitFlag`), hard-reload the app. Restore = delete the tenant override, not "set it back".
- **Seed traps**: logins from `POLYUSER.KUERZEL` (the manifest drifts), ASCII kürzel only (umlauts break the PolyID form), `HIERARCHIE.STAMM` NULL (classic card crash → STAMM + `ORGANIZATION_STRUCTURE` fix), every seeded login is a planner over all nodes (assert by own ids, never by counts).
- **Box logs** (api-pp, api-gw) are not reachable on the Windows box in practice: judge errors on the response body's error name / code.

## Access and identity

- **PolyID brute-force lock**: a few failed logins lock the caller IP per OIDC provider **without expiry**; runners behind one office NAT share the lock. Harnesses submit a password at most twice; never probe guessed usernames; one harness call per literal login (no shell loops: zsh does not word-split an unquoted variable, so the whole list arrives as one malformed username). Unlock = the steward.
- **PEP session expiry**: the shared PEP session expires during long runs ("Session abgelaufen" + Keycloak form); `pe-ready.sh` re-logs in once (password typed with `type`, never `settext`) and reopens the plan sheet; never retry a failed re-login.
- **Fresh boxes**: pep-driver must be deployed once per box (`PE_COLD_START=1 … pe-ready.sh` does it); the pinned taskbar icon starts a second PEP (`pe-ready.sh` exit 5). Cold start again after every box restart, stop / start or DM-213 repair.
- **Ops sessions last ≈ 1.5 h**: log in (headed) right before the families that need them, run those first.

## PEP

- Painting repaints the previously selected cell with the newly armed Dienst on the next gesture → one cell per gesture, close / reopen the plan sheet, SQL snapshot diff of the neighbours (`pe-paint.sh`); prefer `pp-plan.sh` (api-pp, no PEP) once it is verified on the env.
- `keys {ESC}` minimised PEP once: disarm a palette with the palette radio instead.
- PEP holds an edit lock on an open plan-sheet node: cloud writes of the same node before or after the PEP step, never during it.

## Orchestration

- **Permission classifier**: subagents may be refused box-side DML, PEP wizards that create definitions, or box log reads ("modify shared resources"). Keep such steps with the runner / steward (seed, G4b, window configuration); workers report them as `blockers`, never retry them renamed.
- **Pace**: launch the next family in the same turn the previous worker hands back; bookkeeping never holds a slot empty.
- **Multi-day runs**: prompts generated for R go stale on R+1 (write windows, "day −1"): regenerate with `gen-prompts.py --run-date R′` after the daily pre-flight; never patch a prompt by hand.
- **Screenshots**: every non-PASS needs an issue shot that shows the wrong value outlined; open each PNG once (welcome tours and spinners slip through).
- **macOS has no `timeout`**: `sql.sh` (`SQL_TIMEOUT`), `tunnels.sh` (`TUNNEL_TIMEOUT`), `pe-paint.sh` bound themselves; wrap anything else in `perl -e 'alarm shift; exec @ARGV' <s> <cmd…>`.
- **Worker model**: regular runs use Sonnet workers with Sonnet-ready briefs; `--worker-model opus` only for validation runs.

## Shared environments (design facts to respect from the first run on)

- One owner per env: the steward must be reachable for LEGACY / UNIFIED, SSH keys, auto-stop, shares and DM-213; a deputy covers PolyID unlocks.
- `refresh-ip` without `--union` drops every runner's IP when the owner calls it.
- Reseed renumbers every group's employees and Keycloak users: never during a run.
- Stage-wide CT state (gateway-mock strategies, untargeted POMA jobs, provider / partner registries, Teams domain mapping) affects other teams: STAGE windows with the user's OK only.
