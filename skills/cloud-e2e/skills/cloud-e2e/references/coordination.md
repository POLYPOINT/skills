# Coordination — the run dashboard's database as the shared store

One run = one dashboard artifact, published by the steward. Its database (the `db` capability) holds the registry, claims, locks, windows, heartbeats, rows and findings of every group. Every session (steward, runners, workers that take the PEP lock) reads and writes it with the **ArtifactData** tool, acting as its own claude.ai user. The page itself only reads (`onSnapshot`). No secret is ever written here.

ArtifactData semantics this protocol relies on:

- a write to a document that already exists is refused without `if_version` → `set` without `if_version` = **create-if-absent**;
- `set` / `update` / `delete` with `if_version` = **compare-and-set** (a stale version writes nothing and names the current one);
- `batch` (≤ 50 writes) is all-or-nothing where the server supports it; a batch without any pinned entry may run one write at a time (the result says which) — the claim protocol handles both;
- documents ≤ 256 KiB; at most 25,000 documents per artifact; doc ids use letters, digits and `_ - . ~ : @ +`.

## 1. Precondition: the two-person dry run (WBS step 0, user + one colleague)

Before the first multi-person run, on a throw-away artifact published by person A with **the dashboard's exact declared capabilities** (below) and shared with person B at **Contributor**.

**Part a — person A alone.** A checks the rules with ArtifactData `as_level`:

- at `interact`: create-if-absent, a second create refused, `update` with the current version applied, with an old one refused; a `run/meta` write refused, a `run/meta` read allowed; an atomic batch that meets one existing document or one stale pin writes nothing; a pinned `delete` applied;
- at `view`: claims readable, `run/meta` not readable, no write at all;
- at `admin`: a `run/meta` write applied.

This part passed on 2026-10-27.

**Part b — person B, as themselves:**

| #   | Person B does (ArtifactData / Artifact)                                             | Expected                                              |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | `set collection="claims" doc_id="dry~emp-1" data={"group":"dry"}` (no `if_version`) | created                                               |
| 2   | the same `set` again                                                                | refused (document exists)                             |
| 3   | `get`, then `update … if_version=<v>`                                               | applied, new version                                  |
| 4   | `update … if_version=<the old v>`                                                   | refused, names the current version                    |
| 5   | Artifact publish `asset: true` of a PNG to A's artifact                             | an asset `url`                                        |
| 6   | `update` of `run/meta` with its current version                                     | refused (only Editors write `run`)                    |
| 7   | A and B send the same 20-create claim batch at the same minute                      | exactly one batch commits; the other writes nothing   |
| 8   | B keeps the page open while A creates a claim                                       | the page shows it within about 30 s, without a reload |

Record the outcome in the run notes. **All of part b passes → mode `artifact-db`.** Any fails → mode `degraded` (F2, §7.2; decision 2026-10-27), or `gcs` (F1, §7.1) only if the user asks for it and every runner has gcloud write access to a dev bucket. The mode is a run setting: `run/meta.coordination` and `"coordination"` in every `run-config.json` (`gen-prompts.py` turns it into the workers' PEP-lock steps). Solo runs always use `artifact-db` (the owner can write everything) or `local-file` (one machine, the v0.5.0 lock file).

## 2. Schema

| collection / doc id                                      | writer                               | body (no secrets)                                                                                                                                                                                                             | protocol                                                                                                         |
| -------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `run/meta`                                               | steward                              | `run, status (not started / running / done / aborted), stage, pin, bundle_class, coordination, envs[], groups[{key, title, env, families[[id, name]]}], started, notes, updated`                                              | `if_version`                                                                                                     |
| `envs/<env>`                                             | steward                              | `env, role (X/Y), state, instanceState, host, seed_date, roster {start, end}, partitions {gruppe: group}, kits ("ok" / "partial"), flags_hash, autoStop false, pin, allowlist [runner], ssh [runner], owner_only_queue []`    | `if_version`                                                                                                     |
| `kits/<env>`                                             | steward                              | `log [{step, ok, time, value}]` (S1 steps and their verification value)                                                                                                                                                       | append via `if_version`                                                                                          |
| `stage/<object>`                                         | steward                              | `run-partner {id, tenant_access, logging, created}`, `gln {value, day}`, `provider-gate {ok, note}`                                                                                                                           | `if_version`                                                                                                     |
| `schedule/<env>`                                         | steward                              | `slots [{id, from, to, owner}]` (planned windows, `env-plan.md` §7.2)                                                                                                                                                         | `if_version`                                                                                                     |
| `runners/<name>`                                         | that runner                          | `machine, groups [], envs {env: level}, activeWorkers {env: {"group:family": n}}, heartbeat`                                                                                                                                  | `if_version`; heartbeat ≤ 10 min                                                                                 |
| `groups/<key>`                                           | claiming runner                      | `runner, env, status (claimed / seeding / running / done / released), families_done [], counts {}, findings [], summary {}`                                                                                                   | **claim = create without `if_version`**                                                                          |
| `claims/<env>~<kind>-<id>`                               | claiming runner                      | `group, runner, since, note`. Kinds: `emp-<MA_ID>`, `node-<KNOTEN_ID>`, `login-<kuerzel>`, `pool-<name>`, `prefix-<p>`                                                                                                        | create-if-absent, one batch per group; release = pinned delete                                                   |
| `locks/<env>~pep`, `locks/<env>~jobs`, `locks/ct~gwmock` | holder                               | `holder ("<runner>/<family>"), purpose, since, expiresAt` (≤ 20 min, renewed)                                                                                                                                                 | create-if-absent; takeover only when `expiresAt` < now, steward only, with `if_version`; release = pinned delete |
| `windows/<env>~<window-id>`, `windows/ct~<S-id>`         | requester (steward for HARD / STAGE) | `env, id, class, state (requested / draining / active / released), group, pauses [], exempt [], reason, restore, restore_proof, requestedAt, activeAt, releasedAt`                                                            | §4                                                                                                               |
| `scenarios/<group>~<id>`                                 | that group's runner (steward seeds)  | `group, family, id, title, env, runner, agent, status (pending / running / pass / fail / blocked / skipped), verdict, findings [], evidence (path on the runner's machine), shots [{id, url, caption, kind}], notes, updated` | `if_version`                                                                                                     |
| `findings/<group>~<id>`                                  | runner                               | `text, scenarios [], env, bundle, evidence, shot_url, known ("<deviation id>" or "new")`                                                                                                                                      | create-if-absent                                                                                                 |
| `manual/<session>`                                       | runner with the testers              | `testers [names], checklist [{id, state, note}]`                                                                                                                                                                              | `if_version`                                                                                                     |

UTR v0.5.0 rows (doc id = scenario id, status in `envM`) are still read by the dashboard as group `utr` (solo runs that keep the old seeding).

**Declared capabilities** (steward, on the first publish of the run dashboard):

```json
{
  "db": {
    "rules": [
      { "path": "", "read": "view", "write": "interact" },
      { "path": "run", "read": "interact", "write": "admin" },
      { "path": "envs", "read": "interact", "write": "admin" },
      { "path": "kits", "read": "interact", "write": "admin" },
      { "path": "stage", "read": "interact", "write": "admin" },
      { "path": "schedule", "read": "interact", "write": "admin" }
    ]
  },
  "assets": { "upload": "interact" }
}
```

Runners are shared at **Contributor** (`interact`): they write everything except the steward collections. Viewers (managers, testers without a session) read rows but not the registry.

## 3. Protocols

### 3.1 Claims (R1)

1. `set collection="groups" doc_id="<key>" data={runner, env, status: "claimed"}` without `if_version`. Refused → another runner holds the group: stop, ask the steward.
2. One `batch` of creates (no `if_version`), at most 50 per batch: `{op: "set", collection: "claims", doc_id: "<env>~emp-<MA_ID>", data: {group, runner, since}}`, the same for `node-`, `login-`, `pool-`, `prefix-`. Only ids inside `envs/<env>.partitions` for your group.
3. A refused batch (atomic) writes nothing: stop with "partition conflict <first id>". A non-atomic batch that fails midway: delete the documents this batch created (each with the version its create returned), then stop.
4. Export: `list collection="claims"` (page with `query.cursor`), keep your group's documents → `results/<run>/<group>/claims.json` (`gen-prompts.py --claims` refuses any role whose employee or login is not claimed by your group).
5. Release (R5): pinned `delete` of each of your claims; `groups/<key>.status = "released"`.

### 3.2 Locks (PEP desktop, tenant jobs, gateway mock)

- **Acquire**: `set collection="locks" doc_id="<env>~pep" data={holder: "<runner>/<family>", purpose, since: <now>, expiresAt: <now + 20 min>}` without `if_version`.
- **Busy** (refused): `get` it; wait — poll every 60 s, at most 30 min — then report the blocker `PEP lock held by <holder>`. Never force. A worker never takes over an expired lock.
- **Renew** every ≤ 10 min while working: `update … if_version=<held version> data={expiresAt: <now + 20 min>}`.
- **Release** right after the step: `delete … if_version=<held version>`.
- **Takeover** (steward only): `expiresAt` < now and the holder does not answer → `delete` with the read version, note it in `run/meta.notes`.
- Order when more than one is needed: pep → jobs → gwmock. A window never waits for a lock its own requester holds.
- No human RDP session on a box while a pep-driver agent holds its PEP lock; a human RDP session takes the lock itself (`holder: "<name>/manual"`).
- `locks/ct~gwmock` is held for every gateway-mock strategy change (`gwmock.mjs strategy set` needs its doc id).

### 3.3 Heartbeats and active workers

Each runner updates `runners/<name>` at least every 10 min while its group runs: `heartbeat` and `activeWorkers {env: {"group:family": n}}` (set on every launch and hand-back). The window protocol and the stale-runner check read them.

### 3.4 Rows, findings, screenshots

- The steward seeds `scenarios/<group>~<id>` for every planned group from `groups/<key>/assets/scenarios.json` (`status: "pending"`); afterwards only that group's runner writes them, always with `if_version`.
- New findings: `findings/<group>~N-<GROUP>-<n>` (create-if-absent). KNOWN-FAILs are rows with `verdict` starting `KNOWN-FAIL <id> <ticket>`, plus a findings doc with `known: "<id>"` when the run confirms it.
- Screenshots: Artifact publish `url=<dashboard>`, `asset: true`, `file_paths` (≤ 25 per call); write the returned `url` exactly into `shots`.

## 4. Windows

Classes and ids: `references/env-plan.md` §3 (HARD, LOGIN, FLAG, SOFT, INTERNAL, LOCK, JOBS, STAGE, SHARED). Each group's `group.json` `windows[]` names its own; the union per env is the env's window list.

Window keys in `group.json`: `id`, `class`, `scenarios` (they run inside it), `changes`, `est_min`, `pauses`, `exempt` (optional), `shared_with`, `note`.

- `pauses` and `exempt` hold `<group>:<family>` or `<group>` entries.
- **HARD** pauses every family of its env except the families that run inside it and those in `exempt` (W-Y-MSG: `["ops:LIFE", "ops:X16"]`, they work on the CT portal only). `exempt` is for HARD windows only; every other class pauses only what `pauses` lists (a LOGIN window also every login-first family, step 2).
- **One id = one window.** A window declared by several groups (W-Y-MSG: auth and ops; W-X-WRITE-OFF: swap and booking) is one window and one document: owners = every declaring group, `scenarios`, `pauses` and `exempt` = the union of the declarations. The `class` must agree, else `gen-prompts.py --dry-run` fails.
- **Env of a window**: the env in its id (`W-X-…`, `J-Y-…`, `T-Y-…`), else the declaring group's `env.preferred` (UTR-P → Y). STAGE windows (`S-CT-*`) apply to every env, SHARED windows (`W-SH-*`) to the shared group only. A worker prompt (`{{WINDOWS}}`) lists only the windows of the worker's env, one line each: "runs inside", "exempt" or "pauses".

1. **Request** at the planned slot (`schedule/<env>`): `set collection="windows" doc_id="<env>~<id>" data={env, id, class, state: "requested", group, pauses, exempt, reason, restore, requestedAt}` without `if_version`. HARD and STAGE windows are requested by the steward (STAGE also needs the user's OK, written into `reason`). A window that already ran (document in `released`) is re-requested with `update … if_version=<v>` (`state: "requested"`, new `requestedAt`); W-X-WRITE-OFF runs its two states (SWP-14, then BKG-25) inside one request.
2. **Every runner, before every worker launch**, reads `windows/`: a `draining`/`active` window of its env that lists `<group>:<family>` or `<group>` in `pauses`, a HARD window of its env unless the family runs inside it or is in `exempt`, or a LOGIN window for a login-first family → do not launch.
3. The requester sets `state: "draining"` when it is first in line: at most **one** non-INTERNAL window per env is `draining` or `active`, granted FIFO by `requestedAt` (INTERNAL windows only pause the owning group's own families and need no queue).
4. When every paused `group:family` counter in `runners/*.activeWorkers` for that env is 0 (HARD: every family of the env except its own and the `exempt` ones) → `state: "active"`, `activeAt`; make the change (portal-ops flag, DeployMate call by the steward, PEP setting), run the window's scenarios.
5. Restore, verify (fresh `config/features` read, `flags-baseline.py --compare`, PEP read), write `restore_proof`, `state: "released"`, `releasedAt`. Paused runners resume.
6. `window <run> --env X --id <id> release` of a window you did not request is the steward's (after confirming the restore).

Deadlock avoidance: PEP locks are bounded (≤ 20 min); a window never waits for a lock its requester holds; lock order pep → jobs → gwmock.

## 5. Stale runner

No heartbeat for 20 min → the steward contacts the person. After confirmation (or 60 min without answer) the steward: restores an `active` window of that runner first (its `restore` plan), releases the runner's locks and windows (pinned deletes / `released`), marks its `running` rows `blocked` with `verdict: "runner lost"`, and notes it in `run/meta.notes`. Claims stay until the runner (or the steward at consolidation) releases them.

## 6. Credentials distribution

| secret                                 | how a runner gets it                                                                                                                                    | never                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| DeployMate session                     | own `dm-login-capture.mjs` (headed, once per machine)                                                                                                   | shared tokens                                   |
| RDP / DB of an env                     | own reveal as OPERATOR in `dm-join.sh` → `~/.config/deploymate/<env>.credentials.json` (0600)                                                           | pasting; files under `results/`                 |
| Seed password                          | `dm-api.sh test-data <env>` (VIEWER is enough) → `<env>.test-data.json` (0600); the harness reads it                                                    | briefs, rows, prompts                           |
| SSH                                    | the runner sends the **public** key; steward `dm-api.sh ssh-keys-add <env> <pub>` (≤ 5 per env)                                                         | private keys                                    |
| api-pp service secret                  | own vault access → local 0600 file read by `api-pp.sh` / `pp-plan.sh`; steps that need it run on a runner with vault access, else the steward runs them | db, briefs                                      |
| Portal ops / POMA ops / PolyID ops     | personal account, headed login into a profile outside `results/` (≈ 1.5 h)                                                                              | shared ops accounts unless the user names one   |
| Mailbox links, SMS codes, TOTP secrets | read in memory; a mail link goes to `<outdir>/.mail-link` (0600), deleted after use                                                                     | any file, row, screenshot (shots mask OTP / QR) |
| Partner client secret                  | `portal-ops.mjs partner secret-to-mem` (memory only, used by `partner-api.mjs`)                                                                         | saved JSON (`client_secret` → `[redacted]`)     |
| DM-213 SYS login                       | the steward types it into their own terminal (deploymate skill §6a)                                                                                     | any Claude session                              |

## 7. Fallbacks

### 7.1 F1 — GCS create-if-absent objects (`coordination: "gcs"`)

- Bucket `gs://<dev-project>-cloud-e2e/<run>/` (a dev project, never production). Every runner needs `roles/storage.objectAdmin` on it; the steward checks with one probe object.
- One object per claim, lock or window, path = the db path with `.json` (`claims/<env>~emp-480.json`, `locks/<env>~pep.json`, `windows/<env>~<id>.json`, `rows/<group>~<id>.json` for rows).
- Create-if-absent: `gcloud storage cp <local.json> gs://…/<path>.json --if-generation-match=0` (a 412 precondition failure = exists).
- Compare-and-set: read the generation (`gcloud storage objects describe gs://…/<path>.json --format='value(generation)'`), then `cp … --if-generation-match=<generation>`; release `gcloud storage rm gs://…/<path>.json --if-generation-match=<generation>`.
- The steward's session mirrors the bucket into the dashboard db every 5 min (single writer: rows, claims, locks, windows), so the page stays the live view.

### 7.2 F2 — degraded, no shared store (`coordination: "degraded"`)

- Runners write rows into `results/<run>/<group>/dashboard-rows.json`; the steward imports them into the dashboard (single writer).
- Claims are fixed by the steward's partition document (`results/<run>/partition.md`, shared by message); no runner claims on its own.
- Windows run only at the scheduled times of `schedule/<env>`; runners pause by the clock (no worker launch from 10 min before a slot until the steward reports the restore).
- PEP: the steward grants PEP slots per runner and family (`"pep_slot"` in that runner's run config, e.g. `"14:00–14:40 Europe/Zurich"`); outside its slot a worker stops a PEP step with the blocker `PEP slot`.

## 8. `status <run>`

Reads only: `run/meta`, `envs/*`, `runners/*` (heartbeat age; stale > 20 min), `groups/*`, counts of `claims` per group and kind, `locks/*` (holder, time to expiry), `windows/*` (state per env), `scenarios` counts per group and status, `findings` (new vs known). Print one table per section; change nothing.
