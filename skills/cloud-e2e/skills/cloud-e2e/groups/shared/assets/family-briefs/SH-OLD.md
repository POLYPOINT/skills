# Family SH-OLD — Swap below on-prem 26 (SWP-20) · second box, owners' consent

|                           |                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | SWP-20                                                                                                                                                                  |
| Tenant                    | `{{TENANT}}` on stage `{{STAGE}}` (a box with on-prem < 26: Preview `pre-dev-main24` or CT-zinc-main24); poma-api `{{OLD_POMA_API}}` when Preview                       |
| Actors                    | OLDHP1 `{{OLDHP1_LOGIN}}` (owner), OLDHP2 `{{OLDHP2_LOGIN}}` (candidate, same personnel category); passwords from `{{CRED_FILE}}` (`--cred-file`)                       |
| Day                       | `{{OLD_DAY}}`: OLDHP1 holds a swappable presence; OLDHP2 can be a candidate                                                                                             |
| Gate                      | SH-G3 in `env-facts.md` (version < 26, non-production host, VPN if Preview, cred file); missing → BLOCKED "no < 26 box" (DeployMate provisions only master and main-26) |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/SH-OLD` · `{{RUN_DIR}}/SH-OLD/SWP-20/` · `created/SH-OLD.jsonl`                                                                    |
| Read first                | the group part above; scenarios.md SWP-20                                                                                                                               |

Harness: `POMA_API_URL={{OLD_POMA_API}} node {{SKILL_DIR}}/scripts/harness/app.mjs {{TENANT}} "<login>" <script> <out> --app mypp --stage {{STAGE}} --cred-file {{CRED_FILE}}` (omit `POMA_API_URL` on CT). The harness refuses any production host: a refusal (exit 5) = BLOCKED, never a workaround. Definitions and settings of the shared box are never changed.

## SWP-20 — Below on-prem 26: generic list keeps "Abwesenheit", the flow stays direct

1. As OLDHP1: `GET /api/capabilities/v1/capabilities` → `GET_SHIFT_TRADE_CANDIDATES_WITH_TARGET_EMPLOYMENT_IDS` **absent** → `capabilities.json` (present → the box is ≥ 26: BLOCKED "box not < 26").
2. `{{OLD_DAY}}` shift detail → "Diensttausch" → step "Wunsch": the generic list "Frühdienst", "Tagdienst", "Spätdienst", "Nachtdienst", "Abwesenheit" (record the option texts; shot `02-wunsch.png`).
3. Pick "Abwesenheit" → the stepper still has 3 steps (no "Angebot" / "Auswahl") — shot.
4. Back; pick "Spätdienst" → candidates with `shift_type` LATE (`candidates.json`); select OLDHP2 → create → 200 (`create.json`); log the opportunity id in `created/SH-OLD.jsonl`.
5. Cleanup: OLDHP1 deletes the swap ("Tausch löschen") → the owner's open swaps no longer list it.

Expect: as listed (corrected expectation: the absence option **is** available below 26). A generic list that cannot match candidates because the seed Dienste have no `POMASCHICHTTYP` → BLOCKED-data "POMA shift types missing on the shared box" (never set them).

## Cleanup checklist

- The SWP-20 swap deleted (verified); nothing else changed on the shared box.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
