# Manual session — externals (PTN-23, PTN-24)

|         |                                                                                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testers | 1 person with GCP access to the run partner's Pub/Sub subscription (PTN-23) and, with the provider's consent, an account at the Careanesth test system / the booking-partner simulator (PTN-24) |
| Where   | DM-X + GCP (PTN-23); CT `tenant1` + Careanesth test system (PTN-24)                                                                                                                             |
| Time    | ≈ 1 h                                                                                                                                                                                           |
| Record  | PASS / FAIL / BLOCKED; terminal output / screenshots without secrets → the runner writes `scenarios/manual~<id>`                                                                                |

## PTN-23 — Pub/Sub delivery to a real partner subscriber

Only while the steward's run partner `e2e-ptn-<run>` still exists (before its deletion) and only if `integration-partner-resources` is still the sanctioned tool (OQ-7); else BLOCKED.

1. Run `partner-test-tool.sh ct` with the run partner's configuration, `events subscribe` (the tester's own GCP credentials).
2. Trigger PTN-07 / PTN-09-like events (ask the partner runner, or reuse their next actions).
   Expect: the tool prints the same events as the run partner's Debug log (`portal-ops.mjs … "partner logs <id>"`).

## PTN-24 — Real external providers (Careanesth test system / booking-partner simulator on Vercel)

Only with the provider's consent; the accounts are the provider's, never Confluence copies.

1. Create an availability / booking at the provider.
2. It appears in the cloud (external pool in BADI or "Externer Anbieter") of CT `tenant1` → book / sync.
   Expect: the record flows through; cancel what was created.
