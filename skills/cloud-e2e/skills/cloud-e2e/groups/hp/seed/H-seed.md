# Group hp — group seed (R2), runner

Run after R1 (claims: N1, N2, N3, N3C of Geburtshilfe; N5, N5C of Paediatrie) and after the steward's kits and flag baseline are logged OK (`kits/<env>`: definitions kit with swappable 111 / 112 / 113, G-FLAGS with the hp UI flags). A VIEWER share is enough: the seed password comes from `dm-api.sh test-data <id>`. Log in `results/<run>/hp/seed-log.md`, objects in `results/<run>/hp/created/seed.jsonl`.

## H1 — logins, N1 subject, capabilities (gate HPN-G1)

1. One harness login each: N1, N2, N3, N5, N5C (`app.mjs <env> <login> - <outdir> --app mypp`, profile `results/<run>/hp/.profiles/seed`). **Never N3C** (an untouched colleague for the Teamplan rows).
2. N1: `current-user/sync` 2xx in its `api-index.jsonl` (without it HPN-08 finds no recipient).
3. N1's tenant subject: a one-line script `export default async ({api, out}) => { const { tokenClaim } = await import('<GROUP_DIR>/scripts/hp-lib.mjs'); await api.goto('/tabs/home/main', 'dashboard'); console.log('tenant_subject', tokenClaim(api, 'tenant_subject')); }` → write the value into `employees.md` and the run config placeholder `N1_SUBJECT` (claim value only, never the token).
4. Capabilities (from N3's login): `GET_ANNUAL_PLAN`, `GET_TEAM_ROSTER_FOR_WEEK` present. N3 has seed plannings on ≥ 3 of the next 7 days (run inside the seeded window).

## H2 — own swap N5 → N5C (gate HPN-G3)

1. Choose `N5_DAY`: a seeded weekday ≥ R+1 where N5 and N5C both have a swappable presence (111 / 112 / 113) with **different** definitions (`calendar/roster` of both, read in their sessions). None → ask the steward to paint one cell for N5C with `pp-plan.sh` (hp has no SSH), then re-check.
2. N5 session: `createOwnSwap(api, '<N5_DAY>', <N5C MITARBEITER_ID>)` (`scripts/hp-lib.mjs`) → status 200 and `oppId`; log it. `candidate not offered` → stop and tell the runner (a day where N5C has the same definition, a lock, or the definitions kit missing).
3. N5C session: the invitation is in the notification center (no answer). Leave the swap OPEN (HPN-05, HPN-21 read it; PV cancels it at the end).

## H3 — gates HPN-G2 and HPN-G4

1. N3: `GET /api/mobile/health-professional/v1/team-roster/assignments` (path as the app calls it; take it from N3's `api-index.jsonl` after opening the Teamplan segment once without consenting) → 200 with ≥ 1 group = HPN-G2 PASS; else HPN-07 BLOCKED (OQ-19; the steward may enable the conflict checker for the tenant in POMA ops — never disable).
2. `portal-ops.mjs <profile> "flag read <env> general.incidents.incidentmsg.<lang>" <outdir>` for de, fr, en, it, nl → all empty = HPN-G4 PASS (else tell the steward: someone left a banner).
