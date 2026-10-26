"""Add a Block in the open Stempeleditor (live-verified, DeployMate customer-roster box, 2026-10-14).

- "Neu..." and its popup "Block..." are not UIA-exposed -> rect fractions in
  TStampEditor (default 1078x766 editor).
- Dialog ``TStampEditorBlock`` ("Neuer Block"): Beginn = TTimeEdit[1], Ende =
  TTimeEdit[0] (each: edit[1]=hours, edit[0]=minutes); PA-Code TPAEdit > edit
  (prefilled with the day's planned code; set via settext); Kommentar edit[0];
  Zeitkontos Gutschrift prefilled GLAZ.
- PEP refuses blocks overlapping another block ("Der Blockbeginn liegt
  innerhalb eines anderen Blocks") -> RuntimeError.
- Only buffered; persist with flow stampeditor_commit.
Params: beginn "HH:MM", ende "HH:MM", pa_code=None (keep prefill), kommentar=None
"""
from __future__ import annotations

import time

from . import _base

SE = _base.STEMPELEDITOR_SELECTOR
DLG = f'{SE} > class=TStampEditorBlock'
MSG = f'{_base.MAIN_WINDOW_SELECTOR} > class=TECMessageForm'


def _num(ctx, sel, val):
    ctx.click(sel)
    if str(ctx.read(sel)).strip():
        ctx.type(sel, "{HOME}+{END}{DEL}", verify=False)
    ctx.type(sel, val, verify=False)
    got = str(ctx.read(sel)).strip()
    if got != val:
        raise RuntimeError(f"add_block: {sel!r} wrote {val!r} read {got!r}")


def run(ctx, beginn, ende, pa_code=None, kommentar=None,
        neu_fx=0.9137, neu_fy=0.3825, item_fx=0.94, item_fy=0.411) -> dict:
    bh, bm = [x.zfill(2) for x in str(beginn).split(":")]
    eh, em = [x.zfill(2) for x in str(ende).split(":")]
    tab = f'{SE} > tabitem="Blöcke und Aufgaben"'
    if ctx.exists(tab, timeout=1):
        ctx.click(tab)
        time.sleep(0.8)
    ctx.click_in(SE, float(neu_fx), float(neu_fy))
    time.sleep(1.0)
    ctx.click_in(SE, float(item_fx), float(item_fy))
    if not ctx.exists(DLG, timeout=8):
        ctx.screenshot()
        raise RuntimeError("add_block: Neuer Block dialog did not open")
    _num(ctx, f'{DLG} > class=TTimeEdit[1] > edit[1]', bh)
    _num(ctx, f'{DLG} > class=TTimeEdit[1] > edit[0]', bm)
    _num(ctx, f'{DLG} > class=TTimeEdit[0] > edit[1]', eh)
    _num(ctx, f'{DLG} > class=TTimeEdit[0] > edit[0]', em)
    if pa_code is not None and str(pa_code) != "":
        ctx.set_text(f'{DLG} > class=TPAEdit > edit', str(pa_code))
    if kommentar:
        ctx.click(f'{DLG} > edit[0]')
        ctx.type(f'{DLG} > edit[0]', kommentar, verify=False)
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
        time.sleep(0.5)
        ctx.click(f'{DLG} > button="Abbrechen"')
        raise RuntimeError(f"add_block: PEP popup after OK: {txt}; dialog cancelled")
    if ctx.exists(DLG, timeout=0.5):
        raise RuntimeError("add_block: dialog still open after OK")
    ctx.log(f"add_block: {beginn}-{ende} pa={pa_code} buffered")
    return {"beginn": beginn, "ende": ende, "pa_code": pa_code}
