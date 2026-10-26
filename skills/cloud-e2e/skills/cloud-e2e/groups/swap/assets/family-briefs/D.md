# Family D — PEP-driven cancellation (SWP-21, 22, 23, 24, 25) · writes on T1..T8 on W1 / W2, U1, U2 on D4 / D5

|                           |                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scenarios (in this order) | SWP-21, SWP-22, SWP-23, SWP-24, SWP-25                                                                                                                                                                                                                                                                                                  |
| Actors                    | T1 `{{T1_LOGIN}}` ({{T1_ID}}), T2 `{{T2_LOGIN}}` ({{T2_ID}}), T3 `{{T3_LOGIN}}` ({{T3_ID}}), T4 `{{T4_LOGIN}}` ({{T4_ID}}), T5 `{{T5_LOGIN}}` ({{T5_ID}}), T6 `{{T6_LOGIN}}` ({{T6_ID}}), T7 `{{T7_LOGIN}}` ({{T7_ID}}), T8 `{{T8_LOGIN}}` ({{T8_ID}}), U1 `{{U1_LOGIN}}` ({{U1_ID}}), U2 `{{U2_LOGIN}}` ({{U2_ID}}), SP `{{SP_LOGIN}}` |
| Days / cells              | `{{W1}}`: T1 111, T2 112 (SWP-21 a, b), T3 111, T4 112 (22), T5 111, T6 112 (23), T7 111, T8 112 (24) · `{{W2}}`: T1 111, T2 112 (SWP-21 c) · `{{D4}}`/`{{D5}}`: U1 111 / —, U2 `{{ABS_DEF}}` / 112 (25)                                                                                                                                |
| Profiles / results        | `MYPP_PROFILES={{RUN_DIR}}/.profiles/D` · `{{RUN_DIR}}/D/<id>/` · `created/D.jsonl`                                                                                                                                                                                                                                                     |
| Read first                | the group brief; scenarios.md section D; `swap-allocation.md` (gate G-SWP-EVT result and the write path that triggered it)                                                                                                                                                                                                              |
| PEP changes               | the write path of gate G-SWP-EVT: `pp-plan.sh {{TENANT}} <emp> <day> <PA> FULL` (= "changed") / `… DELETE` (= "deleted"); PEP UI only if the gate says only PEP triggers events — then under `{{PEP_LOCK_DOC}}` with `pe-ready.sh` + `pe-paint.sh`, one cell per lock hold                                                              |
| Windows                   | none of its own; paused by W-X-TRADES-OFF, W-X-CATEGORIES-OFF, W-X-WRITE-OFF (SP approvals in SWP-23/24)                                                                                                                                                                                                                                |

**Gate first:** `swap-allocation.md` / `kits/{{ENV}}` must show G-SWP-EVT = PASS. Missing or FAIL → every scenario of this family BLOCKED "no inbound roster events on this box (G-SWP-EVT)", nothing else to do.

"Wait" below = poll the owner's `openTrade(api, oppId)` every 30 s for ≤ 5 min. After every PEP-side change save `plan-day.sh` before/after.

## SWP-21 — Owner's shift changed / deleted (T1 → T2)

a (changed, T2 silent): T1 shortcut swap on `{{W1}}` inviting T2 → change T1's `{{W1}}` to 113 → wait. b (changed, T2 YES): new swap on `{{W1}}` → T2 YES → change T1 back to 111 → wait. c (deleted, owner submitted): swap on `{{W2}}` → T2 YES → T1 submits → delete T1's `{{W2}}` planning → wait. After each: owner state, T2 state, notifications, SP list.
Expect: each swap CANCELLED (reason `PLANNING_CHANGED`); T1 notified in a, b, c; T2 notified in b and c, not in a; SP list no longer shows c as open. Restore: repaint T1 `{{W2}}` 111 (and `{{W1}}` 111 if a/b left 113); log it.

## SWP-22 — Accepted single candidate's shift deleted (T3 → T4 on `{{W1}}`)

Shortcut swap → T4 YES → delete T4's `{{W1}}` planning → wait.
Expect: T4 request INVALID, swap CANCELLED (`ALL_PARTICIPANTS_REMOVED`); T3 notified. T4: record whether a cancellation notice arrives (SW-K7: code sends it, the WIP log saw none) — observation, no verdict impact. Restore T4 `{{W1}}` 112.

## SWP-23 — Un-answered candidate's shift changed: swap stays open (T5 → T6 on `{{W1}}`)

1. Shortcut swap T5 → T6. 2. Change T6 `{{W1}}` to 113; wait 5 min. 3. Owner state + notifications. 4. T6 opens the invitation → which shift does the detail show? → "Bestätigen". 5. T5 submits T6. 6. SP approves. 7. `plan-day.sh` after.
   Expect per code: step 3 still OPEN, no notification → **KNOWN-FAIL SW-K3** if so; steps 4–7: record exactly what is written (T5 receives 113 or the stored 112? error?). A write that does not match the current roster = new finding (gap G-27, SD-21). Restore T5/T6 to the allocation (111 / 112) and log it.

## SWP-24 — Selected candidate's shift changed after submission; SP acts on a stale row (T7 → T8 on `{{W1}}`)

1. Shortcut swap → T8 YES → T7 submits. 2. SP script `D-SWP-24-sp.mjs`, started as a background command: it opens "Diensttausch" (row visible, screenshot), then polls every 10 s (max 10 min) for the marker file `{{RUN_DIR}}/D/SWP-24/go` without touching the page. 3. Meanwhile (foreground) change T8 `{{W1}}` to 113 → wait until T7's `openTrade` shows CANCELLED → `touch {{RUN_DIR}}/D/SWP-24/go`. 4. The SP script then clicks the stale row → "Bestätigen" (capture the response and the dialog). 5. The SP script reloads and reads "Offene Anfragen".
   Expect: 3 → CANCELLED, T7 + T8 notified; 4 → error dialog (state conflict, e.g. `SHIFT_TRADE_STATE_CONFLICT_*` or `SHIFT_TRADE_NOT_ACCEPTED`; `issueShot` of the dialog as evidence even on PASS), PEP unchanged; 5 → row gone from "Offene Anfragen". Restore T8 112.

## SWP-25 — Flexible swap: compensation-day change (U1 → U2, main `{{D4}}`, compensation `{{D5}}`)

Flexible shortcut swap (U1 offers 111 on `{{D4}}` for U2's absence, compensation U2's 112 on `{{D5}}`: `createSwap(api, {detail, chosen, compensation: {shift: <U2 D5 planned shift from tradable-shifts-for-compensation>, candidates: [<U2 entry>]}})`) → U2 YES → change U2's `{{D5}}` planning to 113 → wait.
Expect: U2 INVALID → swap CANCELLED (single candidate); notifications as SWP-22 (SW-K7 observation). Restore U2 `{{D5}}` 112.

## Cleanup checklist

- No OPEN / SUBMITTED swap of T1, T3, T5, T7, U1.
- Every changed / deleted planning restored to the allocation and listed in `created_data` (`plan-day.sh` after).
- PEP lock doc deleted if you took it.

**Classifier or permission block (hard rule 9): stop that action and report it as a blocker. Never retry it renamed, wrapped or through another tool.**
