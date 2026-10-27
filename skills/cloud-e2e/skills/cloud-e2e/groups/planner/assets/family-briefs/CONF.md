# Family CONF — Conflict checker: PEP night warning, nightly cleanup, tenant rule (PSP-17, 18, 16) · HP3, HP4, PLANALL, TA

|                           |                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scenarios (in this order) | PSP-17, PSP-18, PSP-16 (last, in its window)                                                                                                                                   |
| Actors                    | PLANALL `{{PLANALL_LOGIN}}`, TA `{{TA_LOGIN}}` (`--app poma`); HP3 `{{HP3_LOGIN}}` ({{HP3_ID}}), HP4 `{{HP4_LOGIN}}` ({{HP4_ID}}) (`--app mypp`)                               |
| Days                      | HP3: `{{D2M1}}` (night paint), `{{D2}}` (EARLY availability) · HP4: `{{D3}}` · HP1–HP4 availabilities on `{{D1}}` (PSP-16)                                                     |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/CONF` · `{{RUN_DIR}}/CONF/<id>/` · `created/CONF.jsonl`                                                                                   |
| Read first                | the group brief; scenarios.md PSP-16..18; `{{RUN_DIR}}/ADMIN/PSP-15/cc-config.json` (restore value of PSP-16)                                                                  |
| PEP                       | paints via `pp-plan.sh` (PEP fallback under `{{PEP_LOCK_DOC}}`)                                                                                                                |
| Windows / jobs            | PSP-18 job only inside **J-Y-JOBS**; PSP-16 only inside **W-Y-CONFRULE** (read `windows/{{ENV}}~<id>`; poll 60 s, max 30 min, else that scenario BLOCKED "window not granted") |

## PSP-17 — PEP night shift raises the cloud warning for an early booking

Pre: gate PSP-G4 PASS (EARLY `{{DEF_EARLY}}`, NIGHT `{{DEF_NIGHT}}`); HP3 has an EARLY availability on `{{D2}}` (seed F10) and no planning on `{{D2M1}}` / `{{D2}}` (`plan-day.sh`).

1. PLANALL: find-HP `{{D2}}`, EARLY Dienst, pool P-A → HP3 listed; capture `consumable-pools/availabilities` → `avail-baseline.json` (no `NO_EARLY_SHIFT_AFTER_NIGHT_SHIFT`). 2. Paint NIGHT for HP3 on `{{D2M1}}`: `pp-plan.sh {{TENANT}} {{HP3_ID}} {{D2M1}} {{DEF_NIGHT}} FULL`; `plan-day.sh` → `oracle-planung.txt`. 3. Poll step 1 every 60 s for ≤ 10 min. 4. Optional (POMA ops ADMIN of the runner): `/ops/conflict-checker` Debug tab: HP3's cached shifts include `{{D2M1}}`. 5. Delete the paint (`pp-plan.sh … DELETE`); poll until the warning is gone (≤ 10 min).
   Expect: after 3 HP3's `conflicts[]` holds `rule` `NO_EARLY_SHIFT_AFTER_NIGHT_SHIFT`, `severity` WARNING, `date` `{{D2M1}}`, shown on HP3's row; gone after 5. Never appears: BLOCKED "conflict cache not fed on DM tenant" when the Debug tab shows no shifts of HP3 at all (or step 4 not possible and nothing else proves it), FAIL when other shifts of HP3 are cached but not this one.

## PSP-18 — Nightly cleanup deletes an availability blocked by a PEP presence

Pre: HP4 availability on `{{D3}}` (seed F11): as HP4 `GET /api/mobile/health-professional/v1/calendar/day-view?date={{D3}}` shows it → `avail-before.json`.

1. Paint a presence for HP4 on `{{D3}}` (`pp-plan.sh {{TENANT}} {{HP4_ID}} {{D3}} <a day Dienst of G-A> FULL`). 2. Inside J-Y-JOBS: `portal-ops.mjs {{PORTAL_PROFILE}} "job run poma-core AvailabilityConflictChecker --tenant {{TENANT}}" {{RUN_DIR}}/CONF/PSP-18/job` (save the output as `job-trigger.txt`). Window not granted → report BLOCKED "job window not granted; overnight variant: read after 08:00 tomorrow" and keep the paint (the runner relaunches steps 3–5). 3. HP4: availabilities of `{{D3}}` (day view), calendar `{{D3}}`, notification centre. 4. PLANALL: `/pool-manager/pool-metrics` tab "Verfügbarkeiten" for `{{D3}}` (or `GET /api/private/availabilities-audit-log?from={{D3}}&to={{D3}}`) → `audit-log.json`. 5. Remove the paint.
   Expect: the `{{D3}}` availability is gone; an audit-log row for HP4 / `{{D3}}` with action DELETED; HP4 no longer offered by find-HP for `{{D3}}`.

## PSP-16 — Tenant-admin conflict rule reaches "Mitarbeitende finden" (W-Y-CONFRULE)

Pre: window active; restore value = `cc-config.json` of PSP-15 (rule groups + extra rules); HP1–HP4 availabilities on `{{D1}}`.

1. TA: `/tenant-admin/manage-conflicts-rules` → add `ALWAYS_CONFLICT_TEST_RULE` in `#tenant-extra-rules` → `#save-conflict-rules`; capture `PUT …/conflict-checker/admin/config/{{TENANT}}` (no UI message expected). 2. Reload → chip still there; `GET …/config/{{TENANT}}` → `config-after.json`. 3. PLANALL: find-HP `{{D1}}` (P-A); capture `consumable-pools/availabilities` → `availabilities-with-rule.json`. 4. TA: remove the chip, save, reload; PLANALL repeats step 3 → `availabilities-without-rule.json`. 5. Restore proof: `GET …/config/{{TENANT}}` equals the recorded value → `restore-proof.json`.
   Expect: PUT 200; after step 1 every `data[]` user has a `conflicts[]` entry `rule` `ALWAYS_CONFLICT_TEST_RULE`, `severity` HINT, list shows "Testkonflikt-Regel"; after step 4 none. Record the rule's presence in the catalogue (SD-56 observation).

## Cleanup checklist

- Paints of PSP-17 / PSP-18 deleted (`plan-day.sh` after); conflict-checker config = recorded value (`restore-proof.json`); PEP lock released.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
