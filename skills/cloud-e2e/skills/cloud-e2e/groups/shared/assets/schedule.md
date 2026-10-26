# Group shared — schedule (order, windows)

No DeployMate env. 8 scenarios, ≈ 215 worker-minutes, ≈ 4 h wall clock including consents (`env-plan.md` §7.2: Day 2 afternoon, runner R2 after the partner group). Pace rule: N = 2.

## Before the first launch

| Step | What                                                                                                                          | Who    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0    | consents (SH-G1) and the gates P-PTN-10, AUT-G4, SH-G3, SH-G4 → `results/<run>/shared/env-facts.md`                           | runner |
| 1    | one run config per family (`tenant`, `STAGE`, `CRED_FILE`, ids), `gen-prompts.py … --group shared --families <F>` per config  | runner |
| 2    | request `windows/ct~W-SH-ANTBE` / `windows/ct~W-SH-MSTENANT` with the consent in `reason`; announce them to the tenant owners | runner |

## Order

| Lane | Families                                                                                                                                                 | Notes                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| L1   | **SH-TEAMS** (HPN-26, read-only, gives GO / NO-GO for the manual Teams session) → **SH-PW** (W-SH-ANTBE, attended) → **SH-BEE** (BLOCKED unless decided) | SH-TEAMS first: the manual Teams testers need its GO |
| L2   | **SH-OLD** (SWP-20) → **SH-MS** (W-SH-MSTENANT, attended)                                                                                                | SH-MS needs the operator for ≈ 75 min                |

## Windows owned by this group

| Window        | Class  | Scenarios      | Change                                           | Est.   | Restore proof                                                |
| ------------- | ------ | -------------- | ------------------------------------------------ | ------ | ------------------------------------------------------------ |
| W-SH-ANTBE    | SHARED | PTN-10, 11, 18 | antbe's partner link reset → relinked            | 60 min | `link-after-11.json` (Linked: YES) or the agreed reset state |
| W-SH-MSTENANT | SHARED | AUT-12, 13     | provider type ADFS+pwd → ADFS → Entra → original | 75 min | `provider-after.json` = `provider-before.json`               |

Neither window pauses a DeployMate group; both affect other people on the shared tenant, hence the consent and the announcement.
