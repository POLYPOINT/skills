"""Add a Zeitsumme in the open Stempeleditor (live-verified replacement for the
provisional create_zeitsumme selectors; DeployMate customer-roster box, 2026-10-14).

- "Neu..." (right side) and its popup "Zeitsumme..." are NOT UIA-exposed ->
  rect-fraction clicks inside TStampEditor (default 1078x766 editor).
- Dialog class ``TStampEditorZeitsumme`` ("Neue Zeitsumme"): Dauer = TTimeEdit
  with three TEdits hhh:mm:ss (edit[2]=hours, edit[1]=minutes, edit[0]=secs);
  PA-Code = TPAEdit > edit (``settext`` -- type_keys drops a leading '-');
  Kommentar = direct edit[0]; "Detail >>" reveals Zeitkontos Gutschrift
  (combo[1] inside pane "Zeitkontos", list GLAZ / Zeitgutschrift).
- PEP rejects the seed presence codes 111/112/113/141 with "Der PA-Code ist
  nicht gültig!"; system codes -1 (Ungeplante Präsenz) / -9 (Fixer Saldo) work.
- Only buffered; persist with flow stampeditor_commit.

Params: dauer "H:MM", pa_code, kommentar=None, gutschrift=None ("GLAZ"),
        belastung=False (true -> leave Gutschrift, not supported yet)
"""
from __future__ import annotations

import time

from . import _base

SE = _base.STEMPELEDITOR_SELECTOR
DLG = f'{SE} > class=TStampEditorZeitsumme'
H = f'{DLG} > class=TTimeEdit > edit[2]'
M = f'{DLG} > class=TTimeEdit > edit[1]'
PA = f'{DLG} > class=TPAEdit > edit'
KOMM = f'{DLG} > edit[0]'
GUT = f'{DLG} > pane="Zeitkontos" > combo[1]'
MSG = f'{_base.MAIN_WINDOW_SELECTOR} > class=TECMessageForm'


def _num(ctx, sel, val):
    ctx.click(sel)
    if str(ctx.read(sel)).strip():
        ctx.type(sel, "{HOME}+{END}{DEL}", verify=False)
    ctx.type(sel, val, verify=False)
    got = str(ctx.read(sel)).strip()
    if int(got or 0) != int(val):
        raise RuntimeError(f"add_zeitsumme: {sel!r} wrote {val!r} read {got!r}")


def run(ctx, dauer, pa_code, kommentar=None, gutschrift=None,
        neu_fx=0.9137, neu_fy=0.3825, item_fx=0.949, item_fy=0.441) -> dict:
    hh, mm = str(dauer).split(":")
    if not ctx.exists(SE, timeout=5):
        raise RuntimeError("add_zeitsumme: Stempeleditor not open")
    tab = f'{SE} > tabitem="Blöcke und Aufgaben"'
    if ctx.exists(tab, timeout=1):
        ctx.click(tab)
        time.sleep(0.8)
    ctx.click_in(SE, float(neu_fx), float(neu_fy))
    time.sleep(1.0)
    ctx.click_in(SE, float(item_fx), float(item_fy))
    if not ctx.exists(DLG, timeout=8):
        ctx.screenshot()
        raise RuntimeError("add_zeitsumme: Neue Zeitsumme dialog did not open")
    _num(ctx, H, hh.zfill(3))
    _num(ctx, M, mm.zfill(2))
    ctx.set_text(PA, str(pa_code))
    if str(ctx.read(PA)).strip() != str(pa_code):
        raise RuntimeError("add_zeitsumme: PA-Code readback mismatch")
    if kommentar:
        ctx.click(KOMM)
        ctx.type(KOMM, kommentar, verify=False)
    if gutschrift:
        if not ctx.exists(GUT, timeout=1):
            # reveal the Detail part
            ctx.click_in(DLG, 0.145, 0.86)
            time.sleep(0.8)
        ctx.click(GUT)
        time.sleep(0.5)
        ctx.keys(gutschrift[0])
        ctx.keys("{ENTER}")
        time.sleep(0.5)
        got = str(ctx.read(GUT)).strip()
        if got != gutschrift:
            ctx.screenshot()
            raise RuntimeError(f"add_zeitsumme: Gutschrift readback {got!r} != {gutschrift!r}")
    ctx.click(f'{DLG} > button="OK"')
    time.sleep(1.2)
    if ctx.exists(MSG, timeout=0.5):
        try:
            import re as _re
            txt = " | ".join(_re.findall(r'"([^"]{6,})"', str(ctx.tree(MSG, depth=4))))
        except Exception as ex:  # noqa: BLE001
            txt = f"<unreadable {ex}>"
        ctx.log(f"popup: {txt}")
        ctx.screenshot()
        ctx.click(f'{MSG} > button="OK"')
        raise RuntimeError(f"add_zeitsumme: PEP popup after OK: {txt}; dialog left open")
    if ctx.exists(DLG, timeout=0.5):
        raise RuntimeError("add_zeitsumme: dialog still open after OK")
    ctx.log(f"add_zeitsumme: {dauer} pa={pa_code} gutschrift={gutschrift} buffered")
    return {"dauer": dauer, "pa_code": pa_code}
