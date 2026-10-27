# Manual session — Staging Beekeeper (HPN-22, HPN-23)

|         |                                                                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testers | 1 person with Staging access and the Beekeeper test-tenant account (secret store)                                                                                    |
| Where   | Staging tenant `preview-hive-test`, Beekeeper test tenant `andras2.dev.beekeeper.io`, HP `aermo`                                                                     |
| Rule    | Staging runs on the **production cluster**: humans only. No Claude session, no harness, no agent touches it; the runner only records the verdicts the tester reports |
| Time    | ≈ 1.25 h                                                                                                                                                             |
| Record  | PASS / FAIL / BLOCKED per scenario; tester screenshots → the runner writes `scenarios/manual~<id>`                                                                   |

Notifications for `aermo` (one `WEEK_VIEW` target and one swap target) are prepared by the tester on Staging (HPN-08 recipe).

## HPN-22 — Beekeeper embedded mode (flag `poma.mobileApp.beekeeperFullPwa` OFF)

1. Confluence Part 1 (1.1–1.4) for the six pages plus the further entry points (scheduling request, shift swap create / manage / view, time recording).
2. 1.5: follow an in-app link to a non-allowed page → lands on "Planungspräferenzen".
   Expect: no myPP header; the title in the native header (mobile app only — the Beekeeper web app cannot receive it); no tab bar; no back button on entry pages, back on sub-pages; NC: a not-allowed target does nothing (row marked read), a swap target opens.

## HPN-23 — Beekeeper full PWA mode (flag ON, set by the Staging owner)

1. Confluence Part 2 (2.1–2.3) including the logout control outside Beekeeper.
   Expect: dashboard default, tab bar on top, header below, all pages, back arrow + bottom back on sub-pages, no logout entry; direct links open stand-alone pages with header and back button, no tab bar.

## After the session

- The flag back to its Staging value (owner).
