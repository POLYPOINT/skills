# Group auth — schedule (lanes, order, windows)

Env DM-Y. 16 scenarios, ≈ 413 worker-minutes, group seed ≈ 1 h. Pace rule: N = 2 (two lanes plus serial windows). Wall clock ≈ 6 h (`env-plan.md` §7.2: seed on Day 1 evening 17:30–18:30 without NEWU; families on Day 2).

## Order

| Step | What                                                                                                                                                                                                                                           | Workers   | Notes                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| 0    | R2 seed A1 → A2 → A3 → A5 → (A6 after AUT-G3) → (A8) + gates AUT-G1, AUT-G2                                                                                                                                                                    | runner    | `seed/README.md`; NEWU never logged in                           |
| 1    | **LOGOUT part 1** (logs in the part-2 profile: note the time) and **LOGIN** (AUT-18 first)                                                                                                                                                     | 2         | lane B starts with LOGOUT 1, lane A with LOGIN                   |
| 2    | Lane A: NAV → 2FA (AUT-11 attended) → IMP (attended); lane B: UM (AUT-20 holds the PEP lock)                                                                                                                                                   | 2         |                                                                  |
| W1   | **W-Y-MSG** Day 2 08:00–09:20 (HARD, steward): PWD part 1 (AUT-06, Send Messages OFF) ‖ ops X13 part 1 → steward switches ON → PWD part 2 (AUT-07, AUT-08; operator reads the mailbox) ‖ ops X13 part 2 → manual AUT-19 → steward OFF + verify | 1 (+ ops) | nothing else of auth runs; tell the steward when part 1 reported |
| W2   | **W-Y-LOCKOUT** Day 2 ≈ 10:00 (LOGIN, ≈ 10 min): LOCK part 1                                                                                                                                                                                   | 1         | no fresh PolyID login on DM-Y meanwhile (all Y runners)          |
| W3   | **W-Y-TENANT2FA** Day 2 ≈ 10:15 (LOGIN, ≈ 20 min): X10                                                                                                                                                                                         | 1         | OFFU must have logged in ≥ 5 min before (X10 pre-step)           |
| 3    | **LOGOUT part 2** (≥ 65 min after part 1) and **LOCK part 2** (≥ 31 min after the lock; then the steward's unlock)                                                                                                                             | 1–2       | at the end of the group                                          |
| 4    | Cleanup (`data-plan.md` §6), summary, release claims                                                                                                                                                                                           | runner    | password / e-mail restores in the box Keycloak                   |

## Windows owned by this group

| Window                            | Class | Scenarios                         | Change                                         | Est.          | Pauses                                                                 | Slot        |
| --------------------------------- | ----- | --------------------------------- | ---------------------------------------------- | ------------- | ---------------------------------------------------------------------- | ----------- |
| W-Y-LOCKOUT                       | LOGIN | AUT-05 (LOCK part 1)              | LOCKU locked (13 wrong passwords)              | 10 min freeze | fresh logins of every Y group (utr, planner, ops, other auth families) | Day 2 10:00 |
| W-Y-TENANT2FA                     | LOGIN | AUT-10 (X10)                      | provider `twoFactorType` TOTP → DISABLED       | 20 min        | fresh logins of every Y group                                          | Day 2 10:15 |
| W-Y-MSG (shared with ops, manual) | HARD  | AUT-06, 07, 08 (+ OPS-13, AUT-19) | portal tenant Send Messages ON → OFF (steward) | 90–150 min    | every Y group except ops LIFE / X16 (CT portal only)                   | Day 2 08:00 |

Restore rules: the provider back to DISABLED (read back, X10 step 5); the password-reset flag back to `false` (set, never delete); Send Messages OFF verified by the steward; LOCKU unlocked by the steward only.

## Windows of other groups that pause auth

| Window            | Owner               | Pauses                                                                                          |
| ----------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| W-Y-SOLLPLAN      | planner (PSP-21)    | auth UM (AUT-20 employment reads)                                                               |
| W-Y-HEALTH        | ops (OPS-08 part B) | none of auth's families are in its list; avoid customer-portal reads of tenant health meanwhile |
| UTR-P, W-Y-TRMODE | utr                 | nothing in auth                                                                                 |

## Attended steps (operator at the machine)

PWD part 2 (mailbox links), 2FA AUT-11 (SMS codes), IMP (ops-realm sign-in), seed A3 / A5 / A6 / A8 (box Keycloak admin). Plan them in one block on Day 2 morning.
