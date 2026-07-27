# PEP driving — gotchas, recipes and hard-won lessons

Everything that cost a live session to learn. **Read the section for whatever you are about to do
before you do it.** Each entry states the symptom, the cause, and the recipe.

Operational/connection problems (transport, agent, recovery) live in
[OPERATIONS.md](OPERATIONS.md). This file is about driving PEP's UI.

---

## Universal rules

1. **Inspect before acting.** Never fire a click at a selector you haven't confirmed with `find`.
2. **All data-bearing controls are owner-drawn and opaque to UIA** — roster `TMultiSelectionGrid`,
   Stempeleditor `TIntervalGrid`/`TMonthPlanGrid`, org `TVirtualStringTree`, and even
   `TDBGrid`/`TcxGrid`. Zero accessible text, no cell/node elements. Read them with `screenshot` (or
   api-pp for values); interact with `clickin`/`clickxy`. There is no GUI data backdoor.
3. **Writes persist immediately** to the tenant DB. On a shared or prod-adjacent tenant, confirm the
   target employee and day with the user before mutating.
4. Prefer `menupath` / `def` / flows over raw click chains — they encode the `#32768` popup handling
   and the `[0]` ambiguity traps.
5. Screenshots capture **screen regions**, not window contents — bring the target window to the
   foreground first (`rpc set_focus`), or an occluding window shows through.

---

## Roster: painting a Dienst

**A plain `click`/`clickxy` never paints.** PEP's `TMultiSelectionGrid` initiates painting on
mouse-**DOWN**, tracks a selection while held, and commits on mouse-**UP**. An instant down/up does
nothing. Use the `drag_paint` flow (press → wiggle 3 px → release).

Recipe (verified live on ct-zinc-master, 2026-07-20 — painted "Krank kurz" RIGHT over Nachtdienst 2,
P2 wrote the `IS_ZULAGE_BLOCK` block):

```bash
# 1. arm the palette — radio Ganz/Links/Rechts at ≈(104, 99/115/131)
$P clickxy 104 115
# 2. pick the Dienst icon (row 2, e.g. Krank-kurz pencil ≈(281,137)); the tooltip
#    confirms which definition is armed — read it before painting
$P clickxy 281 137
$P screenshot --out /tmp/armed.png
# 3. paint the cell
$P flow drag_paint --param x=<cellx> --param y=<celly>
# 4. the overplan dialog TfrmPlanOptionen appears:
#    "Überschreiben von Planungsdaten bestätigen" — standard UIA controls.
#    "Sollzeit beibehalten %" and the "Zulage behalten" checkbox come pre-set
#    from the absence definition's DIENST_DETAIL policy. Verify, then OK.
$P dialogs
$P click 'class=TfrmPEPMain > class=TfrmPlanOptionen > button="OK"'
```

**⚠ An armed palette turns clicks inside the Stempeleditor timeline into blocks.** This is how a
stray `Block 2 Dienst A 20:00–21:00` got persisted on a real employee's day. Disarm or be sure of
where you're clicking before opening the Stempeleditor.

### Repair recipe — deleting an accidental block

```bash
# select the block row in the (opaque) list grid
$P clickin '<grid-sel>' --fx <..> --fy <..>
# the Neu / Bearbeiten / Löschen side buttons are NOT UIA-exposed — rect-click them
$P clickxy 1295 393            # "Löschen…" on ct-zinc-master's layout
$P dialogs                     # confirm popup = child class=TECMessageForm "Bestätigen"
$P click 'class=TfrmPEPMain > class=TECMessageForm > button="Ja"'   # element click works here
# then OK the Stempeleditor to persist the deletion
```

**Side effect observed:** re-OK-ing an already-stamped day as `adminec` re-writes the day (Letzte
Änderung flips from ECLINK) and shifted the year GLAZ/JrIst by +1:41 (that day's saldo), while
day-level values stayed identical. The year-saldo semantics of a manual OK on an interpreted day are
unclear — **check before OK-ing a stamped day you only meant to read.**

---

## Stempeleditor (`TStampEditor`)

- **Closing without OK silently discards the edit.** A Round 1.6 block write "didn't take" for
  exactly this reason. Always verify the write landed (api-pp, or reopen) afterwards.
- **`pep close` can fall back to OK on `TStampEditor` — which persists.** For a read-only bail-out
  always click Abbrechen explicitly:
  ```bash
  $P click 'class=TfrmPEPMain > class=TStampEditor > button="Abbrechen"'
  ```
- **A double-click on a roster cell can queue TWO Stempeleditor instances.** After `close`, run
  `dialogs` again before clicking anything.
- **PEP refuses nested absence blocks** — "Der Blockbeginn liegt innerhalb eines anderen Blocks".
  INSERTED sub-blocks cannot be created this way.
- `Beginn` and `Ende` are **both required** on a Block, even for absence PA-codes; PEP pops a
  validation dialog otherwise. The `create_block` flow handles this.
- Time fields have a **focus trap** — the `create_zeitsumme` / `create_block` flows encode the
  working order; prefer them over hand-rolled click+type sequences.

---

## Dienst / Dienstpalette

- The **"lokale Bezeichnung" field is disabled until the small green button next to it is clicked.**
  Keystrokes sent before that land in the Tastaturkürzel hotkey field. The `rename_dienst_palette`
  flow handles it.
- Chain: `Definitionen → Dienst…` → `TfrmKnotenwahl` (node picker, **no lock**, unlike the Planblatt
  picker) → `TfrmDienstMain` → `TfrmEditDienstGlobal` (per-Dienst) → period detail.

---

## Dialogs and selectors

- PEP is a **single top-level window** `class=TfrmPEPMain` (`pepwin.exe`). Every dialog/editor is a
  **child window** — they never appear in `pep windows`. Use `pep dialogs` (it recurses into nested
  dialogs) and root selectors at `class=TfrmPEPMain > class=<DialogClass> > …`.
- `Datei → Planblatt bearbeiten` opens **`TfrmKnotenwahlSperr`** — this dialog **acquires an edit
  lock** ("Sperrung") when you click Weiter. Don't click Weiter blindly on a shared tenant.
- Duplicate button matches are common (`OK`, `Abbrechen` often match twice). Index them: `button="OK"[0]`.

---

## UsrAdmin (`usradmin.exe`)

Full map: [USRADMIN-UI-MAP.md](USRADMIN-UI-MAP.md). The traps that bite most:

- **Session timeout** — after idling, the next action pops "Die Session ist abgelaufen. Das Programm
  wird beendet." and OK **exits usradmin**. Relaunch with `exec` and re-login.
- **Grid-scroll trap** — after OK on a `TfPolyRechte` dialog the Rollen grid can scroll/re-select
  arbitrarily, so a blind double-click opens the **wrong role**. Always verify
  `read … > class=TfPolyRechte > edit[0]` (Titel) and the footer `PolyUsrRoleId` before touching the
  matrix; `button="Abbrechen"[0]` out if it's wrong.
- The login CEF form **ignores `settext`** — focus-click by rect fraction, then `keys`.

---

## Environment-shaped surprises

- **UIA-opaque boxes**: on some boxes (verified `preview-feature`) PEP exposes nothing to UIA at all
  and enumerating windows crashes the agent. Driving is then 100 % `screenshot` + `clickxy` + `keys`
  — no selector fallback exists. See OPERATIONS.md §4.
- **Disconnected RDP** — reads work, screenshots and input don't. See OPERATIONS.md §4.
- **Fresh DeployMate envs** — no session, no initialized PEP. See OPERATIONS.md §5.

---

## Log — newest last

Append a dated line when a session teaches something new, and fold the lesson into the section
above so the next run doesn't rediscover it.

- 2026-07-15 — Toolchain verified end-to-end on ct-zinc-master; drove Stempeleditor block writes,
  Zeitsummen (PPCLOUD-14074 fixtures F1–F3), Dienstpalette rename for real QA.
- 2026-07-16 — 12753 session: roster painting found not to work with plain clicks; armed-palette
  accident on a real employee's day + repair recipe; `close`→OK hazard on `TStampEditor`.
- 2026-07-20 — Roster painting solved with the `drag_paint` press-wiggle-release flow;
  `TfrmPlanOptionen` overplan dialog documented. UsrAdmin driving added (`exec` op).
- 2026-07-21 — UsrAdmin Mobile-App FunktionsId → api-gw flag mapping verified on the wire
  (306/1033/307/1032); session-timeout, grid-scroll and disconnected-RDP traps recorded.
- 2026-07-22 — WinRM transport (SMB deploy + curl.exe loopback) working on `preview-feature`;
  schtasks-launched agent found unable to inject input into PEP → human `start-agent.cmd` recipe.
- 2026-07-24 — `pep windows` crashes the agent on the UIA-opaque `preview-feature` box; stale dist
  `pep_agent.py` and port-8765 thrash traps recorded.
- 2026-07-27 — Stale-agent trap fixed at the source: `deploy` now mirrors `agent/` into `dist/`, clears the box's
  `__pycache__`, and stamps a source digest that `pep status` checks. `deploy --code-only` is a speed option again,
  not a required follow-up. Skill hardened for general use (preflight, OPERATIONS/GOTCHAS); pep-driver `main` gained
  the WinRM and key-auth transports.
