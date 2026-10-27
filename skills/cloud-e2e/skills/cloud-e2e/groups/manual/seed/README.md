# Group manual — session preparation (runner)

Nothing is seeded for the human sessions. Before each session the runner:

1. Names the testers and checks their access (`../references/data-plan.md` §1): devices (phone, Teams client), RDP + OPERATOR reveal for pep-rdp, Staging access, GCP access, mailboxes. Gates MAN-G1..G4 of `../group.json` → `results/<run>/manual/env-facts.md`.
2. Collects the consents (ct-zinc-master owners for teams / mail, Preview owners for smartpep, the Staging owner, the provider for PTN-24) and records them.
3. Picks free logins where a session uses a DeployMate env (phone: a DM-X HP; pep-rdp: seed planners), with the steward's agreement, and claims them for `manual` (`claims/<env>~emp-<id>`, group `manual`) so no agent group uses them meanwhile; releases them after the session.
4. Creates `manual/<session>` on the dashboard (`testers`, `checklist` from the session checklist) and prints `../assets/checklists/<session>.md`.
5. For pep-rdp: takes `locks/<env>~pep` (`holder "<tester>/manual"`) right before each RDP block, renews it, deletes it after.

Never: passwords or links in any file or row; any Claude session or harness on Staging; Teams domain mappings.
