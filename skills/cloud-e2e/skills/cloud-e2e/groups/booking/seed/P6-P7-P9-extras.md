# P6 / P7 / P9 — paging fixtures, second employment, oracles (group booking)

## P9 — oracles (before fan-out)

1. `sql.sh --install` was done by the steward (check `kits/<env>`); a quick `scripts/plan-day.sh <env> <HPA id> <HPA_PRES>` must print the seed presence.
2. **Gate BKG-G4:** `scripts/api-pp.sh <env> avail <HPA id> <today> <today+7>` → 200 (empty list is fine). Needs the api-pp service secret in the runner's local 0600 file (vault, OQ-11); without it every api-pp oracle step of AV is BLOCKED "no service token" — the runner with vault access or the steward runs the group.
3. RR ids: `scripts/sql.sh <env> -f groups/booking/scripts/rr-ids.sql -D er=<ER id> -D day=<RR_DAY> -D cands=<HPG id>,<HPH id>` → `rr-ids.txt` (workers repeat it per RR day). Confirm `GROUP_NODE` (the Planblatt id: the palette node of R3 that is the Medizin Gruppe) and `GROUP_NAME`.
4. **Gate BKG-G2:** as SP, `GET /api/private/shift-definition/roster?group-node-id=<GROUP_NODE>&from=<IPO_DAY>&to=<IPO_DAY>&include-presences=true&shift-type-filter=USE_IN_PLANNING&available-for-internal-pool=true` → non-empty and contains `DAY_DEF`. Empty → steward (definitions kit + G4b), IP family BLOCKED until fixed.

## P6 — paging fixtures (optional; after family BD reported)

BKG-13 and BKG-19 want ≥ 11 rows. Count `assignments(api)` and the BADI availability cells of the BKG-19 week. Fewer → add one-offs for HPD / HPE on further free days of their own (never another token's day) and book a few of them as SP (Find HP). Log every id; the scenarios record "paging not testable" if this step is skipped.

## P7 — second employment for HPM (optional)

Only if HPM was claimed: in PEP (pep-verify exploratory session under the PEP lock; no pep-driver flow exists yet, OQ-20) add a second current employment for HPM on Paediatrie, enqueue the PSC event (`scripts/psc-enqueue.sh <env> employment <HPM id>`), re-login HPM. Without it BKG-17 step 7 is BLOCKED-data. Restore only if the env is reused.
