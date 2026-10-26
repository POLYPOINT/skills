#!/usr/bin/env python3
"""flags-baseline.py — the explicit tenant flag baseline of one DeployMate env (steward S1, gate G-FLAGS).

    python3 -I scripts/flags-baseline.py --env X|Y [--groups swap,booking,...] [--json]
                                         [--compare <current-flags.json>] [--commands <tenant> --profile <dir> --out <dir>]
    python3 -I scripts/flags-baseline.py --check-all          # X and Y: every group merges without contradiction

Merges the env-plan baseline of the env role (references/env-plan.md §6.5, encoded below) with the `baseline_flags` of every group
package placed on that role (`group.json` env.preferred, or --groups). A flag two sources set to different values is a
contradiction: exit 1 with both sources (this is how the sendEmailConfirmation and default-value conflicts are caught). The steward
sets every flag of `set` explicitly (portal ops tenant override), reads the `record` flags without setting them, and stores the
`hash` in envs/<id>.flags_hash.

--compare <file>: a JSON object {flag: value} read from the tenant (portal-ops.mjs `flag read`, or a fresh config/features); exit 3
when a baseline flag differs or is missing (gate G-FLAGS fails). --commands prints the portal-ops.mjs `flag set` calls (CLI
contract skill-design.md 8.3; the command is passed as one argument). Window check: a window that changes a flag without a baseline
value on that env is reported (its restore value would be unknown). Offline; no network.
"""
import argparse, hashlib, json, pathlib, sys

SKILL = pathlib.Path(__file__).resolve().parent.parent
RECORD = "record"  # env-plan "default (record)": read and record, never set
ENV_PLAN = {  # references/env-plan.md §6.5 (S1 synthesis 2026-10-23)
    "poma.flows.availabilities": (True, True),
    "poma.flows.internalPools": (True, True),
    "poma.flows.opportunities": (True, True),
    "poma.flows.availabilitySeries": (True, RECORD),
    "poma.flows.shiftTrades": (True, True),
    "poma.flows.shiftTradesWithCategories": (True, RECORD),
    "poma.flows.schedulingRequestV1": (True, True),
    "poma.flows.externalAvailabilities": (True, False),
    "poma.webApp.partnerSimulator": (True, False),
    "poma.onPrem.writeShiftsOnPrem": (True, True),
    "poma.onPrem.writeResourceReplacementShiftsToPep": (True, RECORD),
    "poma.onPrem.events": (True, RECORD),
    "poma.onPrem.nodeBasedApprovers": (True, RECORD),
    "poma.mobileApp.showMyTeam": (True, RECORD),
    "poma.mobileApp.teamPlan": (True, RECORD),
    "poma.mobileApp.debugPage": (True, RECORD),
    "poma.flows.timeAccounts": (True, RECORD),
    "poma.flows.shiftCredit": (True, RECORD),
    "poma.mobileApp.teamPlanAutoConsent": (False, False),
    "poma.webApp.simulatePEP": (False, False),
    "poma.onPrem.conflictsWithAbsences": (False, False),
    "poma.internalPool.sendEmailConfirmation": (False, False),
    "poma.msTeams.notifications": (False, False),
    "poma.webApp.mouseflow": (False, False),
    "poma.webApp.development": (False, False),
    "poma.mobileApp.beekeeperFullPwa": (False, False),
    "poma.flows.timesheet": (False, False),
    "poma.onPrem.conflictCheckingMonths": (3, 3),
}
CHECKS = {  # not portal flags: verified by the steward's gates, never set by this script
    "X": ["time-recording mode UNIFIED (DeployMate)", "portal tenant Send Messages OFF, never changed", "PolyID tenant 2FA DISABLED"],
    "Y": ["time-recording mode UNIFIED (LEGACY only in W-Y-TRMODE)", "portal tenant Send Messages OFF (ON only in W-Y-MSG)",
          "PolyID tenant 2FA DISABLED (TOTP only in W-Y-TENANT2FA)"],
}


def groups_on(role, only):
    out = []
    gd = SKILL / "groups"
    for p in sorted(gd.iterdir()) if gd.is_dir() else []:
        f = p / "group.json"
        if not f.is_file():
            continue
        try:
            g = json.loads(f.read_text())
        except ValueError as e:
            sys.exit(f"{f}: {e}")
        env = g.get("env") or {}
        if only:
            if p.name in only:
                out.append((p.name, g))
        elif env.get("kind", "deploymate") == "deploymate" and str(env.get("preferred", "")).upper() == role:
            out.append((p.name, g))
    missing = sorted(set(only or []) - {k for k, _ in out})
    if missing:
        sys.exit(f"unknown group(s): {', '.join(missing)}")
    return out


def merge(role, only=None):
    idx = 0 if role == "X" else 1
    value, source, record, conflicts = {}, {}, set(), []
    for flag, vals in ENV_PLAN.items():
        v = vals[idx]
        if v == RECORD:
            record.add(flag)
        else:
            value[flag], source[flag] = v, ["env-plan"]
    groups = groups_on(role, only)
    for key, g in groups:
        for flag, v in (g.get("baseline_flags") or {}).items():
            if flag in value and value[flag] != v:
                conflicts.append(f"{flag}: {json.dumps(value[flag])} ({', '.join(source[flag])}) vs {json.dumps(v)} ({key})")
                source[flag].append(f"{key}!")
                continue
            if flag in value:
                source[flag].append(key)
            else:
                value[flag], source[flag] = v, [key]
            record.discard(flag)
    notes = []
    for key, g in groups:
        for w in g.get("windows") or []:
            for ch in w.get("changes") or []:
                fl = ch.get("flag") if isinstance(ch, dict) else None
                if fl and fl not in value and fl not in record:
                    notes.append(f"window {w.get('id')} ({key}) changes {fl}, which has no baseline on DM-{role}: record its value before the window")
    canon = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return {"env_role": role, "groups": [k for k, _ in groups], "set": dict(sorted(value.items())), "record": sorted(record),
            "sources": {k: source[k] for k in sorted(source)}, "checks": CHECKS[role], "notes": notes,
            "hash": hashlib.sha256(canon.encode()).hexdigest()}, conflicts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", choices=["X", "Y"]); ap.add_argument("--groups"); ap.add_argument("--json", action="store_true")
    ap.add_argument("--compare"); ap.add_argument("--commands", metavar="TENANT"); ap.add_argument("--profile", default="<portal profile>")
    ap.add_argument("--out", default="<outdir>"); ap.add_argument("--check-all", action="store_true")
    a = ap.parse_args()
    if a.check_all:
        rc = 0
        for role in ("X", "Y"):
            res, conf = merge(role)
            print(f"DM-{role}: groups {', '.join(res['groups']) or 'none'}; {len(res['set'])} flags set, {len(res['record'])} recorded; "
                  f"{'OK' if not conf else str(len(conf)) + ' contradiction(s)'}; hash {res['hash'][:12]}")
            for c in conf:
                print("  CONTRADICTION:", c)
            for n in res["notes"]:
                print("  NOTE:", n)
            rc |= 1 if conf else 0
        sys.exit(rc)
    if not a.env:
        ap.error("--env X|Y (or --check-all)")
    res, conf = merge(a.env, a.groups.split(",") if a.groups else None)
    if a.json:
        print(json.dumps(dict(res, contradictions=conf), indent=2))
    else:
        print(f"DM-{a.env} baseline (groups: {', '.join(res['groups']) or 'none'}), hash {res['hash']}")
        for k, v in res["set"].items():
            print(f"  set    {k} = {json.dumps(v)}   [{', '.join(res['sources'][k])}]")
        for k in res["record"]:
            print(f"  record {k}")
        for c in res["checks"]:
            print(f"  check  {c}")
        for n in res["notes"]:
            print(f"  NOTE   {n}")
        for c in conf:
            print(f"  CONTRADICTION {c}")
    if conf:
        sys.exit(1)
    if a.commands:
        for k, v in res["set"].items():
            print(f"node scripts/harness/portal-ops.mjs {a.profile} 'flag set {a.commands} {k} {json.dumps(v)}' {a.out}")
    if a.compare:
        cur = json.loads(pathlib.Path(a.compare).read_text())
        bad = [f"{k}: baseline {json.dumps(v)}, tenant {json.dumps(cur.get(k, '<missing>'))}" for k, v in res["set"].items() if cur.get(k) != v]
        for b in bad:
            print("G-FLAGS MISMATCH:", b)
        print(f"G-FLAGS: {'OK' if not bad else str(len(bad)) + ' mismatch(es)'} ({len(res['set'])} flags, hash {res['hash'][:12]})")
        sys.exit(3 if bad else 0)


if __name__ == "__main__":
    main()
