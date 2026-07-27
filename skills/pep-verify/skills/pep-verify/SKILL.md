---
name: pep-verify
description: >-
  Use when driving or verifying things directly in PEP (POLYPOINT's Delphi/VCL personnel-planning Windows client) on a
  tenant box over RDP/SSH/WinRM — e.g. "verify yourself in PEP on ct-zinc-master", open the Stempeleditor, create a
  Zeitsumme/Block/Dienst, paint a shift onto the roster, rename a Dienst, read roster/GLAZ data, or change user
  permissions in UsrAdmin. Element-level automation (pywinauto over a loopback agent), not pixel clicking. Runs a
  preflight check and bootstraps the toolchain itself, then drives selector-based UI commands and flows. Requires the
  companion pep-driver toolchain.
compatibility: Designed for Claude Code on macOS. Requires the companion `pep-driver` toolchain (the `pep` CLI + agent), `sshpass` (SSH boxes) or `pywinrm` (WinRM boxes), access to the ansible inventory for tenant creds, and an open RDP session on the box while driving.
metadata:
  version: '1.1.1'
---

# PEP verify / drive

PEP is POLYPOINT's Delphi/VCL Windows client. This skill drives it **at the element level** (pywinauto UI tree) from
inside the target box's interactive desktop session — no fragile pixel-coordinate clicking, no dropped keystrokes over
the RDP video stream. Claude runs the `pep` CLI on the Mac; it talks to an in-session agent over loopback.

The companion toolchain (`pep-driver`) provides the CLI and agent. It is a separate POLYPOINT-internal repository from
this skills marketplace — this skill orchestrates it. Clone it from Azure DevOps
(`https://dev.azure.com/polypoint/cloud/_git/pep-driver`) to **`~/dev/polypoint/pep-driver`** (the path this skill
assumes; override with `PEP_DRIVER_ROOT`). The CLI is then `~/dev/polypoint/pep-driver/cli/pep` (run with `python3`).

## Architecture in one paragraph

A Python **agent** runs inside the RDP desktop session on the box (where PEP's windows are live objects), listening on
`127.0.0.1:8765`. The Mac `pep` CLI reaches the box over **SSH or WinRM** (auto-selected from the tenant's ansible
inventory) and `curl`s that loopback port — the remote shell lands in session 0, but loopback is machine-wide, so it
crosses into the desktop session with no firewall fuss and never touches the RDP video stream. Selectors are
position-independent (`window*="Stempel" > button="OK"`); real screen clicks are only ever a fallback computed from an
element's own rectangle.

## STEP 1 — Preflight (always, before anything else)

Run this skill's `scripts/preflight.sh` with the tenant name. Installs land in different places, so locate it once:

```bash
PF=$(find ~/.claude -path '*pep-verify*/scripts/preflight.sh' 2>/dev/null | head -1)
"$PF" <tenant>          # e.g. ct-zinc-master (SSH), preview-feature (WinRM)
```

The script checks the toolchain checkout (and warns if it is behind origin or carries uncommitted local-only fixes),
the tenant's inventory entry and transport, `sshpass`/`pywinrm`, DNS and port reachability (printing the GCP firewall
fix if tcp/22 is filtered), the offline bundle, and the live agent — then prints a **VERDICT** with the exact next
command. It mutates nothing.

`VERDICT: READY` → go to STEP 3. Anything else → STEP 2. Do not skip preflight and start clicking; almost every failure
mode this skill knows about announces itself here.

## STEP 2 — Bootstrap (only what preflight flagged; ask before slow/network steps)

```bash
P="python3 ~/dev/polypoint/pep-driver/cli/pep --tenant <tenant>"

git clone git@ssh.dev.azure.com:v3/polypoint/cloud/pep-driver ~/dev/polypoint/pep-driver   # missing toolchain
~/dev/polypoint/pep-driver/packaging/build-bundle.sh    # missing bundle (few minutes, needs internet)
$P deploy                                               # first time on this box (ships current code)
$P deploy --code-only                                   # faster re-deploy: skips the ~200 MB python
$P status                                               # want: agent: UP … interactive=True
```

Three bootstrap facts that cost live sessions to learn:

- **Trust `status` on staleness, not the version string.** `deploy` stamps a source digest on the box and `status`
  compares it against your checkout, warning `agent is running STALE code` when they differ (`__version__` stays
  `0.1.0` regardless, so it never told you). On a pre-2026-07-27 pep-driver this is unguarded — there, a full `deploy`
  ships a stale agent and must be chased with `deploy --code-only`.
- **⚠ Which launcher matters.** `$P agent-start` (schtasks InteractiveToken, no human needed) is fine for **read-only**
  work. For **driving PEP**, a human double-clicking `C:\pep-driver\start-agent.cmd` in the live RDP window is the
  reliable path — a schtasks-launched agent has been observed to screenshot fine while its synthetic input silently
  no-ops on PEP. Symptom: screenshots update (clock advances) but `clickxy` does nothing on PEP while the shell reacts
  normally. Don't diagnose it, switch launchers.
- **Missing inventory**: the CLI reads tenant creds from `~/dev/polypoint/shared/devops/ansible/inventories/*/<tenant>/hosts`.
  Set `PEP_ANSIBLE_ROOT` if it lives elsewhere.

Iterating on toolchain code: single flow → `$P push-flow <name>` (hot-reloads). Agent ops/dispatch →
`$P deploy --code-only` + restart. Full transport/bootstrap/recovery detail:
[references/OPERATIONS.md](references/OPERATIONS.md).

## STEP 3 — The driving loop (inspect → act → verify)

Always **inspect before acting** — never fire a click at a selector you haven't confirmed resolves.

```bash
P="python3 ~/dev/polypoint/pep-driver/cli/pep --tenant <tenant>"

$P dialogs                                   # open child dialogs (PEP's editors are NOT top-level)
$P tree 'window*="Stempel"' --depth 5        # element tree of a window (greppable)
$P find 'window*="Stempel" > button="OK"'    # confirm one element resolves (rect/name/state)
$P read 'window*="Stempel" > edit[2]'        # read a field value
$P click 'window*="Stempel" > button="Übernehmen"'
$P type  'window*="Stempel" > edit[0]' '1:00' --verify   # type + readback assert
$P screenshot 'window*="Stempel"' --out /tmp/pep.png      # crisp Windows-side capture
```

Selector language (steps split by `>`; predicates `key=exact`, `key~regex`, `key*=contains`, `[n]` index): keys
`title`/`class`/`ctype`/`auto`; control-type shorthands `window button edit text tree treeitem menu menuitem tab list
checkbox combo pane table datagrid` etc. A bare shorthand word = just that type. Example:
`window~"Dienst.*definitionen" > tree > treeitem*="IT Team 1"`.

**Prefer flows for multi-step runbooks** — they encode the known dialog quirks and focus traps and self-verify each step:

```bash
$P flows                                          # list available flows
$P flow open_stempeleditor --param plan="IT Team 1"
$P flow create_zeitsumme --param dauer="1:00" --param pa_code="..."
$P flow create_block --param beginn="08:00" --param ende="12:00" --param pa_code="..."
$P flow drag_paint --param x=<cellx> --param y=<celly>   # the ONLY way to paint the roster
$P flow rename_dienst_palette --param ...
$P flow delete_row --param ...
```

To iterate on a flow: edit `~/dev/polypoint/pep-driver/agent/flows/<name>.py`, `$P push-flow <name>`, rerun. Fast loop,
no redeploy. **A recurring runbook belongs in a flow, not in a click sequence you retype each session.**

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
- **Painting the roster needs a real press-move-release gesture** — an instant click never paints. Use the `drag_paint`
  flow; the overplan dialog `TfrmPlanOptionen` follows. Full recipe in [references/GOTCHAS.md](references/GOTCHAS.md).
- `uia` backend is correct; `win32` gains nothing on these controls.
- **Some boxes expose nothing to UIA at all** (verified on `preview-feature`) — there, enumerating windows _crashes the
  agent_. Drive those in screenshot-only mode: `screenshot` + `clickxy` + `keys`, never `windows`/`tree`/`find`.

## Batched / high-level commands (use these, not raw clicks)

```bash
$P menupath Definitionen Hierarchie   # atomic menu nav (handles #32768 popup + [0] ambiguity)
$P def Dienst                         # open a Definitionen dialog + report its class
$P dialogs                            # list open modal dialogs (incl. nested child windows of PEP)
$P close                              # close topmost dialog (⚠ can fall back to OK — see below)
$P clickin '<sel>' --fx 0.2 --fy 0.4  # click a spot in an opaque tree/grid by rect fraction
$P clickxy 548 358 --double           # absolute double-click (e.g. roster cell → Stempeleditor)
$P keys 'text'                        # type into whatever has focus (CEF forms ignore settext)
$P exec 'D:\POLYPOINT\usradmin.exe' --cwd 'D:\POLYPOINT'   # launch a program inside the RDP session
$P screenshot --out day.png           # read opaque grids visually
```

Pattern for opaque trees/roster: `screenshot` to SEE it → `clickin`/`clickxy` at the row/cell position →
`screenshot`/`dialogs` to confirm. Key dialogs: Stempeleditor=`TStampEditor` (Übernehmen/OK persist → **Abbrechen** for
read-only), Datei→Planblatt bearbeiten=`TfrmKnotenwahlSperr` (⚠ acquires an edit lock), overplan
confirm=`TfrmPlanOptionen`, message popups=`TECMessageForm`, Definitionen→Hierarchie=`TfFlexHierDef`,
Definitionen→Dienst=`TfrmKnotenwahl`→`TfrmDienstMain`→`TfrmEditDienstGlobal`.

## Guardrails

- Read-only inspection (`windows`/`tree`/`find`/`read`/`grid`/`screenshot`) is always safe — except on UIA-opaque boxes,
  where enumeration crashes the agent.
- Writes (`click`/`type`/`settext`/`menu`/`flow`-that-mutates, and PEP's `Übernehmen`/`OK`) **persist to the tenant DB
  immediately**. On a shared or prod-adjacent tenant, confirm the target employee and day with the user before mutating.
- **`pep close` can fall back to OK on `TStampEditor`, which persists.** For a read-only bail-out, click
  `button="Abbrechen"` explicitly.
- **An armed Dienst palette turns a click in the Stempeleditor timeline into a persisted block.** This has already put
  stray data on a real employee's day once — repair recipe in GOTCHAS.md.
- Keep the RDP session connected while driving (a disconnected session still answers UIA reads but fails every
  screenshot and input; a reconnect may land in a new session — relaunch the agent there). Unattended operation is out
  of scope.

## Reference docs

Mechanics and traps first, domain knowledge second:

- [references/GOTCHAS.md](references/GOTCHAS.md) — **read the relevant section before acting.** Roster painting, the
  Stempeleditor accident + repair recipe, duplicate-button traps, environment surprises, and a dated log of what each
  live session taught.
- [references/OPERATIONS.md](references/OPERATIONS.md) — transports (SSH / WinRM / key-auth), bootstrap, agent
  lifecycle, the recovery runbook (stray agents on port 8765, agent crashes, disconnected RDP), fresh/headless
  DeployMate envs, and oracle cross-checking against api-pp.
- [references/PEP-SUPERUSER-GUIDE.md](references/PEP-SUPERUSER-GUIDE.md) — every screen: window class, how to reach it
  (menupath), its fields, and how to do real planner work. **Start here for planner-domain work.**
- [references/PEP-DOMAIN-MODEL.md](references/PEP-DOMAIN-MODEL.md) — the DB/source data model: Dienst = `DIENST` +
  `DIENSTPALETTE` + date-versioned `DIENST_DETAIL` (keyed by `pa_code`, no PA-code master table; `typ∈{P,A,I}`), the
  `Zulagen→Lohnart→Zeitkonto` per-day pipeline, Guthaben/Saldo (`Anspruch−Bezug+Übertrag`), one org tree, and the
  `PLANUNG`/`PLANUNGSEINHEIT` model that maps to cloud `TRosterCellComplete{Planned,Recorded,Covered,Counted}`.
- [references/PEP-UI-MAP.md](references/PEP-UI-MAP.md) — selector language, readability rules, stable dialog classes.
- [references/USRADMIN-UI-MAP.md](references/USRADMIN-UI-MAP.md) — the separate user/role/permission admin app.
- [references/P2-SOURCE-NOTES.md](references/P2-SOURCE-NOTES.md) — automation internals from the P2 Delphi source
  (owner-draw verdict, no REST/COM hook, ISO-8859/CRLF grep caveat).

## UsrAdmin (Benutzeradministration) — user/role/permission admin

The per-user PEP/myPP **function permissions** (e.g. myPP "Stempel löschen", "Blöcke löschen", "Pikett löschen" that
api-pp exposes via `/legacy-time-recording/permissions`) are NOT in PEP — they live in the separate `usradmin.exe`
(same folder as pepwin.exe, e.g. `D:\POLYPOINT\`). The toolchain drives it end-to-end; full map in
[references/USRADMIN-UI-MAP.md](references/USRADMIN-UI-MAP.md).

```bash
$P exec 'D:\POLYPOINT\usradmin.exe' --cwd 'D:\POLYPOINT'  # launch inside the RDP session
# login window class=TfrmKeycloakLogin — a Keycloak form in embedded Chromium (OPAQUE to UIA):
#   clickin fractions fy≈0.512 (user) / 0.611 (pw) / 0.74,0.894 (Anmelden) + keys.
# main window class=TfrmUsrAdminMain22; top tabs Benutzer/Gruppen/Rollen/Knoten/RAP Profile.
# Rollen → double-click a role → class=TfPolyRechte rights editor:
#   left TTreeView is UIA-readable (treeitem="Mobile-App"); the rights matrix
#   (Lesen/Drucken/Ändern/Löschen/Erstellen/Ausführen) is owner-drawn → screenshot + clickin.
#   OK persists; both OK and Abbrechen are ambiguous → index them: button="Abbrechen"[0].
```

Key facts: a user's myPP time-recording rights come from their **PEP-application role** (Benutzer detail →
"Mitglied in Gruppe"; the myPOLYPOINT role only carries app-UI rights). Mobile-App category rows map to P2 functions
306/1033/307/1032 (`PermissionDetailSetter.java` in pp-services). Verify a rights change on the **wire**
(`/api/mobile/unified-time-recording/v1/days` → `allowed_actions`), not by re-reading matrix pixels.

Note PEP's own login form behaves differently from usradmin's: PEP's IDM/Keycloak CEF form **is** UIA-readable
(`edit auto=username`, `edit auto=password`, `button auto=kc-login`).

## Feed what you learn back (do this at the end of every session)

This skill is only as good as the traps it already knows. When a session turns up something non-obvious — a new dialog
class, a gesture that doesn't work the obvious way, a recovery step, a box that behaves differently:

1. **Add it to [references/GOTCHAS.md](references/GOTCHAS.md)** in the matching section, and append a dated line to its
   Log. State the symptom, the cause, and the recipe — symptoms are what the next session will search for.
2. **If it's a repeatable runbook, make it a flow** in `pep-driver/agent/flows/` rather than prose.
3. **If it's toolchain behaviour** (transport, bootstrap, recovery), it belongs in
   [references/OPERATIONS.md](references/OPERATIONS.md); if it's PEP screen/domain knowledge, in the pep-driver `docs/`
   originals — then run `scripts/sync-docs.sh` to mirror them back here (`--check` reports drift without copying).
4. Bump `metadata.version` in this file and `version` in `plugin.json` together, and open a PR.

The five `PEP-*`/`P2-*`/`USRADMIN-*` references are **mirrors** of `pep-driver/docs/` — edit them there, sync here.
`GOTCHAS.md` and `OPERATIONS.md` are owned by this skill and edited directly.
