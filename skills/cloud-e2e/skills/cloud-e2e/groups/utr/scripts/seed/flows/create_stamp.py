"""Create a raw time stamp (Stempel) in the currently-open Stempeleditor.

Verified live on a DeployMate customer-roster box (2026-10-14):
- The tab strip exposes ``tabitem="Stempeluhr"`` (deep in the tree); the
  right-side "Stempeln" button is NOT UIA-exposed -> rect-fraction click
  inside ``TStampEditor`` (editor at its default 1078x766 size, plan shown).
- "Stempeln" opens ``TNewStampForm`` ("Stempeln"): ``TTimeEdit`` with two
  TEdits (edit[1] = hours, left; edit[0] = minutes, right), a ``TComboBox``
  Datum (dd.mm.yyyy, defaults to the editor day), ``TPAEdit`` PA-Code and a
  Kommentar TEdit; OK/Abbrechen TBitBtns.
- PEP stamps have no In/Out direction; the interpretation decides.
- The stamp is only in the editor buffer after OK; the caller must click
  Übernehmen/OK on the Stempeleditor to persist.

Params
------
zeit : str   "HH:MM" (required)
datum : str  "dd.mm.yyyy" (optional; for a cross-midnight stamp on the next day)
kommentar : str (optional)
pa_code : str (optional) -- stamp-level PA-Code (Dienstwechsel: the block from this stamp on uses that code)
tab_fx, tab_fy, btn_fx, btn_fy : float  rect fractions of the Stempeluhr tab
    and the Stempeln button inside TStampEditor (defaults measured live).
"""

from __future__ import annotations

import time

from . import _base

SE = _base.STEMPELEDITOR_SELECTOR
FORM = f'{SE} > class=TNewStampForm'
HOURS = f'{FORM} > class=TTimeEdit > edit[1]'
MINUTES = f'{FORM} > class=TTimeEdit > edit[0]'
DATUM = f'{FORM} > combo'
KOMMENTAR = f'{FORM} > edit[0]'
POPUP = f'{_base.MAIN_WINDOW_SELECTOR} > class=TECMessageForm'


def _set(ctx, sel, value):
    for attempt in range(3):
        ctx.click(sel)
        # NO clear=True: the {BACKSPACE}x80 clear runs past the empty minutes
        # field back into the hours field of TTimeEdit and wipes it.
        if str(ctx.read(sel)).strip():
            ctx.type(sel, "{HOME}+{END}{DEL}", clear=False, verify=False)
        ctx.type(sel, value, clear=False, verify=False)
        got = str(ctx.read(sel)).strip()
        if got == value:
            return got
        ctx.log(f"create_stamp: readback {sel!r} wrote {value!r} read {got!r} (attempt {attempt + 1})")
    raise RuntimeError(f"create_stamp: could not set {sel!r} to {value!r}")


def run(ctx, zeit, datum=None, kommentar=None, pa_code=None,
        tab_fx=0.154, tab_fy=0.313, btn_fx=0.921, btn_fy=0.383) -> dict:
    hh, mm = str(zeit).strip().split(":")
    hh, mm = hh.zfill(2), mm.zfill(2)
    if not ctx.exists(SE, timeout=10):
        raise RuntimeError("create_stamp: Stempeleditor not open")
    if ctx.exists(FORM, timeout=0.5):
        raise RuntimeError("create_stamp: a Stempeln form is already open")

    tab = f'{SE} > tabitem="Stempeluhr"'
    if ctx.exists(tab, timeout=1):
        ctx.click(tab)
    else:
        ctx.click_in(SE, float(tab_fx), float(tab_fy))
    time.sleep(0.8)
    ctx.click_in(SE, float(btn_fx), float(btn_fy))
    if not ctx.exists(FORM, timeout=8):
        ctx.screenshot()
        raise RuntimeError("create_stamp: Stempeln form (TNewStampForm) did not appear")
    ctx.wait(FORM, state="ready", timeout=10)

    _set(ctx, HOURS, hh)
    _set(ctx, MINUTES, mm)

    if datum:
        cur = str(ctx.read(DATUM)).strip()
        if cur != datum:
            ctx.click(DATUM)
            ctx.type(DATUM, datum, clear=True, verify=False)
            time.sleep(0.3)
            got = str(ctx.read(DATUM)).strip()
            if got != datum:
                ctx.screenshot()
                raise RuntimeError(f"create_stamp: Datum readback {got!r} != {datum!r}")
        ctx.log(f"create_stamp: datum={datum}")

    if pa_code is not None and str(pa_code) != "":
        pa = f'{FORM} > class=TPAEdit > edit'
        ctx.set_text(pa, str(pa_code))
        if str(ctx.read(pa)).strip() != str(pa_code):
            raise RuntimeError("create_stamp: PA-Code readback mismatch")
        ctx.log(f"create_stamp: pa_code={pa_code}")

    if kommentar:
        ctx.click(KOMMENTAR)
        ctx.type(KOMMENTAR, kommentar, clear=True, verify=False)

    # re-verify the time (focus traps)
    if str(ctx.read(HOURS)).strip() != hh or str(ctx.read(MINUTES)).strip() != mm:
        raise RuntimeError("create_stamp: time readback changed before OK")

    ctx.click(f'{FORM} > button="OK"')
    time.sleep(1.0)
    if ctx.exists(FORM, timeout=0.5):
        ctx.screenshot()
        raise RuntimeError("create_stamp: Stempeln form still open after OK (validation?)")
    if ctx.exists(POPUP, timeout=0.5):
        ctx.screenshot()
        raise RuntimeError("create_stamp: message popup after OK")
    ctx.log(f"create_stamp: stamp {hh}:{mm} {datum or ''} added to editor buffer (not yet persisted)")
    return {"stamp": f"{hh}:{mm}", "datum": datum}
