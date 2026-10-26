# Group brief — manual (runner guide; no worker prompts)

This group is executed by **human testers**, never by Sonnet workers: its families have no brief, so `gen-prompts.py --group manual` generates nothing. The runner (a Claude Code session of a person present with the testers) does three things:

1. `manual <run> --session teams|phone|pep-rdp|mail|staging|smartpep|externals` → print `assets/checklists/<session>.md` (the session's checklist) for the testers, and create or update the coordination doc `manual/<session>` on the run dashboard (`testers [names], checklist [{id, state, note}]`, ArtifactData, `if_version` after the first write).
2. While the testers work: write each tester's verdict as the row `scenarios/manual~<id>` (`status`, `verdict` PASS / FAIL / BLOCKED, `notes` with what the tester saw, `runner`, `updated`). A FAIL needs an issue screenshot taken by the tester (phone / Teams / RDP screenshot with personal data and secrets cropped) — the runner uploads it to the dashboard asset store and writes `shots`. KNOWN-FAILs only with a matching signature of `references/known-deviations.md`.
3. Locks and windows: a PEP-RDP block takes `locks/<env>~pep` with `holder "<tester>/manual"` **before** the tester connects (no pep-driver agent may hold it meanwhile) and deletes it afterwards; AUT-19 runs only inside the steward's W-Y-MSG (ON phase).

Never: a Claude session or harness on Staging (production cluster); credentials, codes or links in rows, notes or screenshots; Teams domain mappings; changes on shared tenants without the owners' consent.

---

No worker prompts are generated for this group (human-only). Hard rule 9 still applies to the runner session: **on a classifier or permission block, stop that action and report it as a blocker; never retry it renamed, wrapped or through another tool.**
