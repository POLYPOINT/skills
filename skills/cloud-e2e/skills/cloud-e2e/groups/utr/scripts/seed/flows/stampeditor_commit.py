"""Persist the open Stempeleditor (Übernehmen, editor stays open) and confirm
the planning-rule popups PEP raises on save.

Verified live on a DeployMate customer-roster box (2026-10-14): Übernehmen on a day with new stamps
pops ``TRegelverstossForm`` "Planungskonflikt" (e.g. "Es ist keine auszahlbare
Mehrzeit vorhanden.") as a child of TStampEditor; "Trotzdem planen" saves.

Params
------
button : "Übernehmen" (default) or "OK" (persist + close)
confirm : bool (default True) -- click "Trotzdem planen" on rule popups;
    False -> click Abbrechen there and raise.
"""

from __future__ import annotations

import time

from . import _base

SE = _base.STEMPELEDITOR_SELECTOR
REGEL = f'{_base.MAIN_WINDOW_SELECTOR} > class=TRegelverstossForm'
MSG = f'{_base.MAIN_WINDOW_SELECTOR} > class=TECMessageForm'


def run(ctx, button="Übernehmen", confirm=True) -> dict:
    if isinstance(confirm, str):
        confirm = confirm.lower() not in ("0", "false", "no")
    if not ctx.exists(SE, timeout=5):
        raise RuntimeError("stampeditor_commit: Stempeleditor not open")
    ctx.click(f'{SE} > button="{button}"')
    popups = []
    for _ in range(6):
        time.sleep(1.5)
        if ctx.exists(REGEL, timeout=0.5):
            popups.append("TRegelverstossForm")
            if not confirm:
                ctx.click(f'{REGEL} > button="Abbrechen"')
                raise RuntimeError("stampeditor_commit: rule popup, aborted (confirm=False)")
            ctx.click(f'{REGEL} > button="Trotzdem planen"')
            continue
        if ctx.exists(MSG, timeout=0.5):
            ctx.screenshot()
            raise RuntimeError("stampeditor_commit: TECMessageForm popup after save -- inspect it")
        break
    still_open = ctx.exists(SE, timeout=0.5)
    ctx.log(f"stampeditor_commit: {button} done, popups={popups}, editor_open={still_open}")
    return {"popups": popups, "editor_open": still_open}
