---
name: pep-verify
description: >-
  Use when driving or verifying things directly in PEP (POLYPOINT's Delphi/VCL personnel-planning Windows client) on a
  tenant box over RDP/SSH — e.g. "verify yourself in PEP on ct-zinc-master", open the Stempeleditor, create a
  Zeitsumme/Block/Dienst, rename or plan a shift, read roster/GLAZ data, or check/change planning data in the PEP GUI.
  Element-level automation (pywinauto over SSH+loopback), not pixel clicking. Handles prerequisite checks and bootstrap
  (build/deploy/launch the in-session agent), then selector-based UI commands and flows. Requires the companion
  pep-driver toolchain.
compatibility: Designed for Claude Code on macOS. Requires the companion `pep-driver` toolchain (the `pep` CLI + agent), `sshpass`, SSH access to the tenant box (creds resolved from the ansible inventory), and an open RDP session on the box while driving.
metadata:
  version: '1.0.1'
---

# PEP verify / drive

PEP is POLYPOINT's Delphi/VCL Windows client. This skill drives it **at the element level** (pywinauto UI tree) from
inside the target box's interactive session, reached over SSH — so no fragile pixel-coordinate clicking, no dropped
keystrokes over the RDP video stream. Claude runs the `pep` CLI on the Mac; it talks to an in-session agent over
loopback.

The companion toolchain (`pep-driver`) provides the CLI and agent. It is a separate POLYPOINT-internal repository from
this skills marketplace — this skill orchestrates it. Clone it from Azure DevOps
(`https://dev.azure.com/polypoint/cloud/_git/pep-driver`) to **`~/dev/polypoint/pep-driver`** (the path this skill
assumes by convention); the CLI is then `~/dev/polypoint/pep-driver/cli/pep` (run with `python3`).

## Architecture in one paragraph

A Python **agent** runs inside the RDP desktop session on the box (where PEP's windows are live objects). It listens on
`127.0.0.1`. The Mac `pep` CLI SSHes in (using creds from the ansible inventory) and `curl`s that loopback port —
loopback is machine-wide, so it crosses into the desktop session with no firewall issue. Selectors are
position-independent (`window*="Stempel" > button="OK"`); real screen clicks are only ever a fallback computed from an
element's own rectangle.

## STEP 1 — Prerequisite check (always run first)

Check each; if something's missing, offer to fix it (see STEP 2). Run these and read the results before doing anything
else (the toolchain path defaults to `~/dev/polypoint/pep-driver`):

```bash
# a) toolchain repo present?
ls ~/dev/polypoint/pep-driver/cli/pep

# b) ansible inventory present (source of SSH creds)? resolves tenant -> host+creds
python3 ~/dev/polypoint/pep-driver/cli/inventory.py <tenant>     # e.g. ct-zinc-master

# c) sshpass installed (non-interactive inventory password)?
which sshpass || echo "MISSING sshpass"

# d) offline bundle built (self-contained python for the box)?
ls ~/dev/polypoint/pep-driver/dist/pep-driver/python/python.exe 2>/dev/null || echo "NO BUNDLE"

# e) box reachable + agent up + interactive?
python3 ~/dev/polypoint/pep-driver/cli/pep --tenant <tenant> status
```

Interpreting (e): `agent: UP ... interactive=True` → ready, go to STEP 3. `DOWN` → needs deploy + launch (STEP 2c).
`interactive=False` → the agent got launched in the wrong session; it must be started from inside the RDP desktop.

## STEP 2 — Bootstrap (only what's missing; ask before slow/network steps)

- **(a) Missing toolchain repo**: `pep-driver` is a separate companion repo (POLYPOINT-internal). If absent, clone it:
  ```bash
  git clone git@ssh.dev.azure.com:v3/polypoint/cloud/pep-driver ~/dev/polypoint/pep-driver
  ```
  Or point at an existing checkout elsewhere (adjust the paths in the commands below).
- **(b) Missing ansible inventory**: the CLI reads SSH creds from
  `~/dev/polypoint/shared/devops/ansible/inventories/*/<tenant>/hosts`. If that repo isn't cloned, offer to clone it
  (ask the user for the remote URL if you don't know it) or set `PEP_ANSIBLE_ROOT` to where it lives.
- **(c1) No bundle**: build it (downloads standalone Python + vendors win_amd64 wheels; needs internet on the Mac, a few
  minutes):
  ```bash
  ~/dev/polypoint/pep-driver/packaging/build-bundle.sh
  ```
- **(c2) Deploy to the box** (scp the bundle to `C:\pep-driver`):
  ```bash
  python3 ~/dev/polypoint/pep-driver/cli/pep --tenant <tenant> deploy
  ```
- **(c3) Launch the agent IN the RDP session** — a process started plainly over SSH lands in non-interactive session 0
  and **cannot see PEP**. Use:
  ```bash
  python3 ~/dev/polypoint/pep-driver/cli/pep --tenant <tenant> agent-start
  ```
  This creates+runs a scheduled task with an **InteractiveToken** principal (auto-detects the Active RDP session's user;
  no password, no double-click) that launches the agent (windowless `pythonw.exe`) inside that desktop session. Requires
  the user to be RDP'd in (a logged-on session must exist). `agent-stop` tears it down. Fallback if no Active session /
  task blocked: have the user double-click `C:\pep-driver\start-agent.cmd` in their RDP window.
- After code changes to the agent (not python): `pep --tenant <t> deploy --code-only` then
  `pep --tenant <t> agent-stop && pep --tenant <t> agent-start` (ops/dispatch need a restart; flows hot-reload). After
  editing a single flow: `pep push-flow <name>`.

## STEP 3 — The driving loop (inspect → act → verify)

Always **inspect before acting** — never fire a click at a selector you haven't confirmed resolves. The loop:

```bash
P="python3 ~/dev/polypoint/pep-driver/cli/pep --tenant <tenant>"

$P windows                                   # what top-level windows exist
$P tree 'window*="Stempel"' --depth 5        # element tree of a window (greppable)
$P find 'window*="Stempel" > button="OK"'    # confirm one element resolves (rect/name/state)
$P read 'window*="Stempel" > edit[2]'        # read a field value
$P click 'window*="Stempel" > button="Übernehmen"'
$P type  'window*="Stempel" > edit[0]' '1:00' --verify   # type + readback assert
$P screenshot 'window*="Stempel"' --out /tmp/pep.png      # crisp Windows-side capture
```

Selector language (steps split by `>`; predicates `key=exact`, `key~regex`, `key*=contains`, `[n]` index): keys
`title`/`class`/`ctype`/`auto`; control-type shorthands `window button edit text tree treeitem menu menuitem tab list
checkbox combo pane table datagrid` etc. A bare shorthand word = just that type (`tree`). Example:
`window~"Dienst.*definitionen" > tree > treeitem*="IT Team 1"`.

**Prefer flows for multi-step runbooks** (they encode the known dialog quirks & focus traps and self-verify each step):

```bash
$P flows                                          # list available flows
$P flow open_stempeleditor --param plan="IT Team 1"
$P flow create_zeitsumme --param dauer="1:00" --param pa_code="..."
```

To iterate on a flow: edit `~/dev/polypoint/pep-driver/agent/flows/<name>.py`, `pep push-flow <name>`, rerun. Fast loop,
no redeploy of python.

## VERIFIED reality of driving PEP (read this — it shapes everything)

PEP is a **single top-level window `class=TfrmPEPMain`** (`pepwin.exe`). All dialogs/editors are **child windows** of it
→ they never show in `pep windows`; use **`pep dialogs`** to see them (it recurses into nested dialogs), and root their
selectors at `class=TfrmPEPMain > class=<DialogClass> > …`.

- **Standard VCL controls are UIA-readable/clickable**: menus, `TBitBtn` buttons, `TRzRadioButton`, `TComboBox`,
  `TEdit`, toolbars, tabs, panel titles.
- **All DATA controls are owner-drawn and OPAQUE** (roster `TMultiSelectionGrid`, Stempeleditor
  `TIntervalGrid`/`TMonthPlanGrid`, org `TVirtualStringTree`, even `TDBGrid`/`TcxGrid`): zero accessible text, no
  cell/node elements. **Read them with `pep screenshot` (visual — crisp, Windows-side) or via api-pp (values). Interact
  with them via `pep clickin`/`clickxy` (rect-derived clicks).** There is NO GUI data backdoor.
- `uia` backend is correct; `win32` gains nothing on these controls.

## Batched / high-level commands (use these, not raw clicks)

```bash
$P menupath Definitionen Hierarchie   # atomic menu nav (handles #32768 popup + [0] ambiguity)
$P def Dienst                         # open a Definitionen dialog + report its class
$P dialogs                            # list open modal dialogs (incl. nested child windows of PEP)
$P close                              # close topmost dialog (Abbrechen/Schliessen/OK/ESC)
$P clickin '<sel>' --fx 0.2 --fy 0.4  # click a spot in an opaque tree/grid by rect fraction
$P clickxy 548 358 --double           # absolute double-click (e.g. roster cell → Stempeleditor)
$P screenshot --out day.png           # read opaque grids visually
```

Pattern for opaque trees/roster: `screenshot` to SEE it → `clickin`/`clickxy` at the row/cell position →
`screenshot`/`dialogs` to confirm. Key dialogs: Stempeleditor=`TStampEditor` (Übernehmen/OK persist → **Abbrechen** for
read-only), Datei→Planblatt bearbeiten=`TfrmKnotenwahlSperr` (⚠ locking dialog), Definitionen→Hierarchie=`TfFlexHierDef`,
Definitionen→Dienst=`TfrmKnotenwahl`→`TfrmDienstMain`→`TfrmEditDienstGlobal`.

## Deep PEP knowledge — reference docs

For anything beyond mechanics — shift definitions, Zulagen/Lohnarten, Zeitkonten, hierarchy, planning semantics —
consult these bundled references (they make this skill a PEP super-user):

- [references/PEP-SUPERUSER-GUIDE.md](references/PEP-SUPERUSER-GUIDE.md) — every screen: window class, how to reach it
  (menupath), its fields, and how to do real planner work (Dienst editor 3 depths, Abrechnung master data, planning
  gestures, Stempeleditor). **Start here.**
- [references/PEP-DOMAIN-MODEL.md](references/PEP-DOMAIN-MODEL.md) — the DB/source data model: Dienst = `DIENST` +
  `DIENSTPALETTE` + date-versioned `DIENST_DETAIL` (keyed by `pa_code`, no PA-code master table; `typ∈{P,A,I}`), the
  `Zulagen→Lohnart→Zeitkonto` per-day pipeline, Guthaben/Saldo (`Anspruch−Bezug+Übertrag`), one org tree, and the
  `PLANUNG`/`PLANUNGSEINHEIT` model that maps to cloud `TRosterCellComplete{Planned,Recorded,Covered,Counted}`.
- [references/PEP-UI-MAP.md](references/PEP-UI-MAP.md) — selector language, readability rules, stable dialog classes.
- [references/P2-SOURCE-NOTES.md](references/P2-SOURCE-NOTES.md) — automation internals from the P2 Delphi source
  (owner-draw verdict, no REST/COM hook, ISO-8859/CRLF grep caveat).

Golden read rule (verified across TMultiSelectionGrid/TVirtualStringTree/TDBGrid/TcxGrid): **all PEP data grids/trees
are opaque to UIA — read them via `screenshot` + api-pp; interact via `clickin`/`clickxy`.** Standard controls drive
normally.

## First time on a NEW box / new PEP dialog — probe first

Run the probe to learn what the box exposes (sessions, backend recommendation, grid cell-addressability). Best run by
double-clicking `C:\pep-driver\probe.cmd` inside the RDP session (real desktop); or `pep --tenant <t> probe` over SSH
(reports session-0 limits).

## Oracle cross-check

For time-recording work, PEP is one oracle; api-pp is the faster one. Cross-check PEP reads against api-pp
(`poco onprem port-forward` + direct queries). If a PEP write "didn't take", remember api-pp planning writes silently
no-op on days that already carry stamps — use PEP for those.

## Guardrails

- Read-only inspection (`windows`/`tree`/`find`/`read`/`grid`/`screenshot`) is always safe.
- Writes (`click`/`type`/`settext`/`menu`/`flow`-that-mutates, and PEP's `Übernehmen`/`OK`) persist to the tenant DB
  immediately. On a shared/prod-adjacent tenant, confirm the target employee/day with the user before mutating.
- Keep the RDP session connected while driving (a disconnected session stops rendering and UIA gets flaky; a reconnect
  may land in a new session — relaunch the agent there). Unattended operation is out of scope.
