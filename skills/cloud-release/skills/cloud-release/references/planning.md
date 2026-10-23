# Planning a release — details

The plan is a conversation with the user, phase by phase (see SKILL.md). This file holds the commands, the
classification table and the ordering rules the phases rely on.

## 1. The release page

- A Confluence subpage of the PCR page in space Zn2C, titled `<Type>-Release-<version> (PCR-xxxx)` and suffixed
  `- Released` after the night. Example: "Feature-Release-26.3 (PCR-2643) - Released", page id 14646181904.
- Read it with the Atlassian connector: `getConfluencePage` (markdown) by page id. When only the PCR id is known,
  search with CQL `title ~ "PCR-xxxx"` in space Zn2C, or ask the user for the link. The connector can time out;
  retry once, then ask the user for the link or the content.
- What the page holds, and what to take from it:

  - **Header table:** Release ID, Type, PREVIEW and PROD deployment target dates, Release Trigger, **Includes
    myPOLYPOINT**, Technical Lead, and Change Failure / Time to Restore (filled after the night, from the retro).
    "Includes myPOLYPOINT: Yes" means the maintenance page and the app-store submission are part of the plan.
  - **Change Log Release Candidate:** Major Features (REL epics with their PPCLOUD stories), Improvements, Regular
    Fixes, items covered by another team (e.g. "Scheduling Request / SmartPEP - covered via H1"), and Technical / Team
    Issues. Extract every Jira key with its section. The same key can appear twice; dedupe it.
  - **Release Status checklist:**

    - release candidate on preview;
    - BAT performed;
    - preliminary announcement + maintenance banner;
    - myPP pushed to the App Store and Play Store;
    - production deployment completed.

    Each item that isn't ticked is a manual board step in the right phase (BAT and banner before the window, app
    stores as the app-release process says). Tick the boxes on the page after the night.

- Keys starting with `PPTX` need the user's permission before they are opened (organisation rule).
- Put the page link into the plan's `config.sh` (`CONFLUENCE_RELEASE_PAGE`) and into the `RELEASE.md` facts.

## 2. The repo diff — what really ships

Origin refs only; never check out or reset the user's clones.

```bash
git -C "$CLOUD_REPO" fetch -q origin
# commits that prod gets (prod runs release/maintenance; the release ships release/preview)
git -C "$CLOUD_REPO" log --oneline --no-merges origin/release/maintenance..origin/release/preview | wc -l
git -C "$CLOUD_REPO" log --no-merges --format='%h %s' origin/release/maintenance..origin/release/preview \
  | grep -o -E '\b[A-Z][A-Z0-9]+-[0-9]+\b' | sort | uniq -c | sort -rn          # ticket keys in the diff
git -C "$CLOUD_REPO" diff --stat --name-only origin/release/maintenance...origin/release/preview   # files (since the merge base)
```

Same for `polypoint-ci` (pipeline / release-definition changes) and, when `GITOPS_DIR` is set, the gitops repo.
For a maintenance-only hotfix release the range is the hotfix commits on `release/maintenance` since the last prod
deploy — ask the user for the baseline when unsure.

Big diffs (hundreds of commits): fan out one subagent per area (Flyway, Vault/Keycloak, manifests, apps) with the
range and the table below; each returns findings with `sha file:line` and the step implication.

### Classification → what it needs on the board

| Change (path pattern)                                                | Implication                                                                                                              | Board steps (catalogue)                                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `**/src/main/resources/db/migration/**` (Flyway)                     | out-of-order or duplicate versions break startup; long migrations lengthen the window; several pods racing one migration | migration scan (`tools/migscan.py`), Flyway check after the sync, first-pod-then-all (default in `argo_sync`)                    |
| `polypoint-vault-configurer/**/migration/V1_0_*`                     | Vault migrations run only on `POST /bootstrapping/vault`; the ArgoCD path never calls it                                 | vault dump refresh, root token add, bootstrapping sync + up, vault migrations, vault diff, bootstrapping down, root token remove |
| keycloak-configurer realm migrations                                 | run only on `POST /bootstrapping/keycloak`; need a master-realm admin                                                    | KC master admin create → keycloak configurer → admin delete                                                                      |
| `polypoint-kubernetes/v2/src/**` strategy / probes / resources / HPA | restarts, capacity dips (`spec.replicas` vs HPA), Recreate = full outage                                                 | the app's sync step with an honest `@downtime`; compiled diff per env reviewed                                                   |
| a new app or CronJob                                                 | needs its ArgoCD Application and a sync step; secrets/buckets may be missing (tpms-attachments: bucket)                  | new sync step + a pre-check that its Application, secrets and buckets exist                                                      |
| ingress / maintenance / nginx↔Traefik                               | the maintenance page automation only rewrites nginx Ingresses                                                            | maintenance controller check (prep)                                                                                              |
| `polypoint-ci/**` release definitions                                | which artifacts and tags a release picks                                                                                 | release creation step: `NEED_*` commits, `PICK_PIN_*` build pins in config.sh                                                    |
| feature toggles / config keys                                        | Config and Secrets release first                                                                                         | sync order: config first                                                                                                         |
| on-prem contracts (api-gw, PEP error names)                          | on-prem must ship first or be compatible                                                                                 | a manual go/no-go line with the on-prem team                                                                                     |
| DB engine / instance changes                                         | data migration, credentials, rollback                                                                                    | release-specific steps + `lib/` in the release's plan; a rollback phase (9xx)                                                    |

### Reconcile

One table in `RELEASE.md` section A: change/story · source (page/diff/both) · needs a step? · step ids · owner · status.
Ask about every mismatch:

- a change without a story → who owns it, is it meant to ship?
- a story without a change → missing merge, or shipped in an earlier release?

## 3. Steps

- `rb new PCR-xxxx --window "YYYY-MM-DD 22:00" --core` builds the plan in `~/.release-board/<release>/plan/` with
  `catalogue/CORE` and pushes it to `gs://ppcloud-releases/<release>/plan/`. Add the rest with
  `rb -r PCR-xxxx add <group/file> [id]`, then `rb -r PCR-xxxx push` (when the user agrees — the bucket is shared).
- Several people can edit the plan: `rb pull` (`--diff` shows the changes) before editing, `rb push` after. A push
  that names a conflicting file means someone pushed it meanwhile: `rb pull --force`, redo the change, push again.
  Never `--force` over the user's unpushed edits without asking.
- Ids encode the phase: 1xx pre · 2xx staging · 3xx prep · 4xx window · 5xx post · 9xx rollback (on demand). Keep gaps
  so a forgotten step fits in on release day.
- New steps start from `tools/release-board/templates/step.sh`. A step:
  - is a gate: it passes or exits non-zero, with no "warn and continue" on something that matters;
  - names its target. prod/staging steps get the typed confirmation from `release.sh`; never bypass it;
  - announces every write on stdout before doing it, and logs it with `tl ACTION`;
  - says how it is verified and how it is rolled back, in the header comment;
  - carries `@downtime` / `@downstart` / `@downend` when users notice anything, and calls `dt_mark start|end` at the
    exact action;
  - reads release-specific values from the plan's `config.sh`, never hard-coded.
- Check every new step:
  - `bash -n` it;
  - `rb -r X list` shows it in the right phase with the right dependencies;
  - `rb -r X dry-run <id>` reads well;
  - `rb selftest` stays green after any engine change.

## 4. Order and estimate

- **Before the window:**

  - read-only checks;
  - Preview and Staging deploys;
  - the Prod stages, which only commit to gitops;
  - dumps and PITR timestamps;
  - pre-created indexes that don't block writes.

  No prod sync, restart or data change.

- **Window skeleton** (PCR-2643 order, proven):
  1. maintenance page on;
  2. config;
  3. apidocs;
  4. Vault root token, then bootstrapping sync + up;
  5. keycloak, KC admin, configurer, admin delete;
  6. polyid-login, hydra;
  7. portal family;
  8. TPMS family;
  9. vault migrations + diff;
  10. poma family;
  11. switch-specific work;
  12. bootstrapping down + root token removed;
  13. maintenance page off;
  14. all-synced check.
- **Group the downtimes:** start the slow independent syncs as background jobs so their user impact overlaps
  (portal-tenant-access, appointment index, poma-core ran together at PCR-2643). Name each downtime in one line for the
  communication: what users see, from which step to which, the estimate.
- **Estimate from measured data:** use [pcr-baseline.md](pcr-baseline.md), CT/staging timings of the same steps, and
  pod restart times. State the assumptions. First-pod-then-all lengthens a multi-replica sync by roughly one pod's
  start time compared with PCR-2643's numbers.

## 5. Questions to settle with the user before the plan goes to the operator

- Who is the operator, who is the release manager, and who communicates? When does the maintenance banner go up?
- Which rotation mode applies after the release?
- What are the go/no-go criteria, and who decides?
- What is the rollback for each risky change? Which ones get an on-demand 9xx step?
- Which steps can't be rehearsed?
- Who owns each scope mismatch?
