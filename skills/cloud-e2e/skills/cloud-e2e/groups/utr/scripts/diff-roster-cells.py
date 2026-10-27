#!/usr/bin/env python3
"""Semantic diff of two api-gw `GET /api/v1/roster-cells` responses (baseline vs candidate).

Baseline = the reference capture (e.g. a master bundle, or the same environment before a change); candidate = the
capture under test. Each side is also checked on its own for the F1/F2/F12 signatures, so one file pair is enough to
evaluate a single environment against a known-good baseline.

Usage:
    python3 -I diff-roster-cells.py baseline.json candidate.json [--day YYYY-MM-DD] [--json]

Input: the raw api-gw JSON array (snake_case, as poma-core receives it) or the
poma-gateway-mock shape. Ids are dropped, lists are sorted, and per day the script prints:
planning ids and definitions, planned-layer entries, counted-layer entries
(type, shift_planning_id, credit account, shift definition id/type, duration),
block counts, and the F1 / F2 signatures:
  * every counted entry has shift_planning_id 0 while plannings exist  -> F1 (attribution lost)
  * SHIFT_DEFINITION entries without credit shift definition           -> F1 (absence/Einsatz detection lost)
  * enum literals unknown to the cloud (TimeAmountType, ShiftType)     -> F2 (decode failure)
Dependency-free; exit code 1 when any signature fires on either side.
"""
import argparse
import json
import sys

KNOWN_TIME_AMOUNT_TYPES = {
    "SHIFT_DEFINITION", "ALLOWANCE_TYPE", "ALLOWANCE_PREVIEW", "BALANCE_CORRECTION",
    "TARGET_TIME_EXTENSION", "BALANCE_CONTROL", "OVERLAP_CORRECTION", "POST_PROCESSING", "UNKNOWN",
}
KNOWN_SHIFT_TYPES = {"PRESENCE", "ABSENCE", "ON_CALL"}


def g(d, *keys, default=None):
    """Read a nested key tolerating snake_case and camelCase."""
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        camel = k.split("_")[0] + "".join(p.title() for p in k.split("_")[1:])
        cur = cur.get(k, cur.get(camel))
        if cur is None:
            return default
    return cur


def entry_row(e):
    credit = g(e, "credit_time_amount") or {}
    sd = g(credit, "shift_definition_policy_identifier", "shift_definition") or g(e, "shift_definition_policy_identifier", "shift_definition") or {}
    return {
        "type": g(e, "type"),
        "sp_id": g(e, "shift_planning_id", default=0) or 0,
        "account": g(credit, "time_account_identifier", "id"),
        "sd_id": g(sd, "id"),
        "sd_type": g(sd, "shift_type"),
        "duration": g(credit, "duration") or g(e, "duration"),
        "allowance": g(e, "allowance_type_identifier", "title"),
    }


def block_row(b):
    sd = g(b, "shift_definition_policy_identifier", "shift_definition") or {}
    return {
        "sp_id": g(b, "shift_planning_id"),
        "start": g(b, "start_time"),
        "end": g(b, "end_time"),
        "sd_id": g(sd, "id"),
        "sd_type": g(sd, "shift_type"),
        "breaks": len(g(b, "breaks") or []),
        "paid_breaks": len(g(b, "paid_breaks") or []),
        "sub_blocks": len(g(b, "shift_sub_blocks") or []),
        "allowance_block": bool(g(b, "legacy_allowance_block")),
        "in_stamp": g(b, "legacy_in_time_stamp_id"),
        "out_stamp": g(b, "legacy_out_time_stamp_id"),
    }


def normalize(cells, day_filter=None):
    out = {}
    for c in cells:
        day = g(c, "day")
        if day_filter and day != day_filter:
            continue
        plannings = []
        for p in g(c, "shift_plannings") or []:
            sd = g(p, "shift_definition") or {}
            plannings.append({
                "id": g(p, "id"), "position": g(p, "schedule_position"),
                "sd_id": g(sd, "id"), "sd_type": g(sd, "shift_type"), "title": g(sd, "title"),
                "planned_blocks": len(g(g(p, "planned_layer") or {}, "shift_blocks") or []),
            })
        planned = [entry_row(e) for e in g(g(c, "planned_layer") or {}, "time_amount_journal_entries") or []]
        counted = [entry_row(e) for e in g(g(c, "counted_layer") or {}, "time_amount_journal_entries") or []]
        pblocks = [block_row(b) for b in g(g(c, "planned_layer") or {}, "shift_blocks") or []]
        cblocks = [block_row(b) for b in g(g(c, "counted_layer") or {}, "shift_blocks") or []]
        stamps = g(c, "interpreted_time_stamps") or []
        key = lambda r: json.dumps(r, sort_keys=True, default=str)
        out[day] = {
            "employment": g(c, "employment_identifier", "id"),
            "plannings": sorted(plannings, key=key),
            "planned_entries": sorted(planned, key=key),
            "counted_entries": sorted(counted, key=key),
            "planned_blocks": sorted(pblocks, key=key),
            "counted_blocks": sorted(cblocks, key=key),
            "stamps": len(stamps),
            "stamps_without_sp": sum(1 for s in stamps if not g(s, "shift_planning_id")),
        }
    return out


def signatures(day, d):
    sigs = []
    planning_ids = {p["id"] for p in d["plannings"] if p["id"] is not None}
    counted = d["counted_entries"]
    if planning_ids and counted and all((e["sp_id"] or 0) == 0 for e in counted):
        sigs.append("F1: every counted entry has shift_planning_id 0 although %d planning(s) exist" % len(planning_ids))
    if any(e["type"] == "SHIFT_DEFINITION" and e["sd_id"] is None for e in counted):
        sigs.append("F1: SHIFT_DEFINITION counted entry without credit shift definition (absence / Einsatz detection lost)")
    for e in counted + d["planned_entries"]:
        if e["type"] and e["type"] not in KNOWN_TIME_AMOUNT_TYPES:
            sigs.append("F2: unknown TimeAmountType literal %r (cloud decode fails)" % e["type"])
        if e["sd_type"] and e["sd_type"] not in KNOWN_SHIFT_TYPES:
            sigs.append("F2: unknown ShiftType literal %r" % e["sd_type"])
        if e["account"] == 0:
            sigs.append("F12: time account id 0 (expected 1 GLAZ or -1 none)")
    for b in d["counted_blocks"] + d["planned_blocks"]:
        if b["sd_type"] and b["sd_type"] not in KNOWN_SHIFT_TYPES:
            sigs.append("F2: unknown block ShiftType literal %r" % b["sd_type"])
    return sorted(set(sigs))


def fmt_entries(rows):
    if not rows:
        return "    (none)"
    return "\n".join(
        "    %-18s sp=%-8s acct=%-4s sd=%s/%s dur=%s%s" % (
            r["type"], r["sp_id"], r["account"], r["sd_id"], r["sd_type"], r["duration"],
            (" allowance=" + r["allowance"]) if r["allowance"] else "")
        for r in rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("baseline")
    ap.add_argument("candidate")
    ap.add_argument("--day")
    ap.add_argument("--json", action="store_true", help="print the normalized structures instead of the table")
    a = ap.parse_args()
    with open(a.baseline, encoding="utf-8") as f:
        m = normalize(json.load(f), a.day)
    with open(a.candidate, encoding="utf-8") as f:
        p = normalize(json.load(f), a.day)
    if a.json:
        json.dump({"baseline": m, "candidate": p}, sys.stdout, indent=1, default=str)
        return 0
    failed = False
    for day in sorted(set(m) | set(p)):
        dm, dp = m.get(day), p.get(day)
        print("=" * 100)
        print("DAY", day, "| employment", (dm or dp or {}).get("employment"))
        for label, d in (("baseline", dm), ("candidate", dp)):
            print("-- %s" % label)
            if d is None:
                print("    (no cell)")
                continue
            print("  plannings:", ", ".join("%s %s %s(%s)" % (x["id"], x["position"], x["sd_id"], x["sd_type"]) for x in d["plannings"]) or "(none)")
            print("  blocks: planned=%d counted=%d stamps=%d (unkeyed %d)" % (
                len(d["planned_blocks"]), len(d["counted_blocks"]), d["stamps"], d["stamps_without_sp"]))
            print("  planned entries:\n" + fmt_entries(d["planned_entries"]))
            print("  counted entries:\n" + fmt_entries(d["counted_entries"]))
            sigs = signatures(day, d)
            for s in sigs:
                print("  !! " + s)
            failed = failed or bool(sigs)
        if dm and dp:
            same = json.dumps(dm, sort_keys=True, default=str) == json.dumps(dp, sort_keys=True, default=str)
            print("  => %s" % ("IDENTICAL after normalisation" if same else "DIFFERENT"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
