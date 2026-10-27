#!/usr/bin/env python3
"""gen-prompts.py — build the worker prompts of one UTR E2E run from the skill's briefs and a run config.

    python3 -I scripts/gen-prompts.py <results/<run>/run-config.json> [--run-date YYYY-MM-DD] [--out <dir>]
                                      [--families R,M,...] [--allow-violations] [--print-day-map]

Prompt = header (guardrails, day map, notes, day-rule warnings) + assets/agent-brief.md (the part below its first `---`)
+ assets/family-briefs/<F>.md, every {{placeholder}} filled. Family C gives two prompts, C-part1.md and C-part2.md (same body,
the header names the part). Never patch a generated prompt by hand: change the config or the brief and regenerate (SKILL.md
"Day map and date shift"). Exit 1 on a leftover `{{`, an unknown placeholder or a day-rule / ownership violation (unless
--allow-violations: then the violations are printed into the prompt header and on stderr).

Day map (Europe/Zurich run date R, from --run-date or config.run_date): TODAY = R, MONTH = R's month, WD2 = the last weekday
before R, WD1 = the weekday before WD2, WE1/WE2 = Saturday/Sunday of the last weekend inside R−7..R−1, oldest UI-writable day =
R−6 (while KD-3 is open; config.oldest_offset overrides). P0..P3, KOMBI_DAY, CARVE_DAY, E6_WD are absolute (config). Overrides
(a value may be "R-3"-style relative or an ISO date), most specific wins:
  config.days                      all families
  config.family_days.<F>           one family (legacy shape), same as config.families.<F>.days.<TOKEN>
  config.families.<F>.days.<ROLE>  one employee inside one family, e.g. {"E1": {"WD1": "...", "WD2": "..."}, "E3": {...}};
                                   extra keys (e.g. "W06": "...") name further write days of that employee.
Role-tagged tokens: for every role (E1..E6, ES, ER) and day token (WD1, WD2, WE1, WE2, TODAY, plus extra per-employee keys)
the generator defines {{<ROLE>_<TOKEN>}} = the per-employee override of this family, else the family-level value. Briefs use
them on every employee-specific line, so a per-employee override reaches the body without the worker remapping anything; a
per-employee override whose {{<ROLE>_<TOKEN>}} the family brief never uses is a violation.
config.families may also be the plain list of families to generate (legacy); with the dict shape use config.generate.

Checks (violations):
  - run level: P0..P3 are weekdays, ascending, before R, and none of them is a write token of the day map (WD1, WD2, WE1, WE2,
    TODAY: a seed date equal to the run date makes them collide); P3 >= the oldest UI-writable day when L or C is generated
    (C-04 / L-02 write on E3 P3);
    a prepared day before config.roster_start (manifest.roster.startDate) must be listed in config.painted_days (painted in PEP,
    seed README § Dates). Note (not a violation): WE1 = the oldest UI-writable day leaves the window on R+1.
  - per family write (WRITES below): not older than the oldest UI-writable day; not a fixture day of that employee (P0..P3,
    KOMBI/CARVE, config.fixture_days) unless the brief writes there by design (L-02 / C-04 on E3 P3); fixture-day protection
    (a config.night_days[role] day followed by a fixture day of that employee).
  - planning type (needs config.night_days / config.planless_days from scripts/seed/write-days.sql): W-01, W-02/W-06a, W-06b,
    P-01b, MO-05 need a day planning (not a night, not planning-less); MO-02 needs a planning on TODAY; W-05 needs a
    planning-less day (and not a config.carry_days day: a night's out-stamp).
  - ownership: a scenario id appears in the "Scenarios" row of exactly one generated family brief (plus
    config.families.<F>.scenarios, extra ids handed to a family).

Config (JSON; ids/logins are the run's, never credentials):
{ "run": "...", "run_dir": "<abs>", "results_root": "<abs, default parent of run_dir>", "tenant": "...", "compare_tenant": "none",
  "bundle": "0.0.1829", "bundle_class": "1801", "worker_model": "sonnet", "run_date": "YYYY-MM-DD",
  "prepared_days": ["P0", "P1", "P2", "P3" as dates], "roster_start": "YYYY-MM-DD", "painted_days": ["YYYY-MM-DD"],
  "employees": {"E1": {"login": "dmseed-…", "id": 480, "row_y": 259}, ..., "ES": {...}, "ER": {...}},
  "config": {"TEAM_NODE": "...", "PLANNER_ROLE_ID": "...", "E1_NODE": "...", "ER_NODE": "...", "PORTAL_PROFILE": "...",
             "PORTAL_ORG": "...", "KOMBI_EMP": "E2", "KOMBI_DAY": "...", "CARVE_EMP": "E2", "CARVE_DAY": "...", "E6_WD": "..."},
  "days": {"WD1": "..."}, "family_days": {"W": {"WD1": "...", "WD2": "..."}},
  "files": {"pep-oracle.md": "<abs>", "write-days.md": "<abs>", "verify-seed.md": "<abs>"},
  "night_days": {"E1": ["YYYY-MM-DD"]}, "planless_days": {"E1": ["YYYY-MM-DD"]}, "carry_days": {"E1": ["YYYY-MM-DD"]},
  "fixture_days": {"E1": ["YYYY-MM-DD"]},
  "common_notes": "markdown for every prompt", "family_notes": {"W": "markdown day map / data facts for W"},
  "families": ["R", "M", "O", "W", "L", "MO", "P", "C"] }
"""
import argparse, datetime as dt, json, pathlib, re, sys

SKILL = pathlib.Path(__file__).resolve().parent.parent
ROLES = ["E1", "E2", "E3", "E4", "E5", "E6", "ES", "ER"]
FAMILIES = ["R", "M", "O", "W", "L", "MO", "P", "C"]
DAY_TOKENS = ["WD1", "WD2", "WE1", "WE2", "TODAY"]
PARTS = {"C": ["1", "2"]}  # families launched in parts (C part 1 normal slot, part 2 exclusive)
# family -> [(role, token)] of the days it WRITES stamps / blocks on (family briefs)
WRITES = {
    "O": [("E2", "WE1"), ("E2", "WE2"), ("E2", "WD1"), ("E2", "WD2"), ("E2", "TODAY")],
    "W": [("E1", "WD1"), ("E1", "WD2"), ("E1", "WE2"), ("E3", "WD1"), ("E3", "WD2"), ("E6", "E6_WD")],
    "L": [("E3", "P3")],
    "MO": [("E5", "TODAY"), ("E5", "WD1"), ("ES", "WD1")],
    "P": [("E1", "WD1")],
    "C": [("E5", "WD1"), ("E3", "P3"), ("E2", "WD2")],
}
BY_DESIGN = {("L", "E3", "P3"), ("C", "E3", "P3")}  # round trips on a prepared day, cleaned by the brief
STAMPING = {"O", "W", "P", "MO", "C"}  # families that write stamps (fixture-day protection applies)
NEEDS_DAY_PLANNING = {("W", "E1", "WD1"): "W-01", ("W", "E3", "WD1"): "W-02 / W-06a", ("W", "E6", "E6_WD"): "W-06b",
                      ("P", "E1", "WD1"): "P-01b", ("MO", "ES", "WD1"): "MO-05"}
NEEDS_PLANNING = {("MO", "E5", "TODAY"): "MO-02"}
NEEDS_NO_PLANNING = {("W", "E1", "WE2"): "W-05"}
SCEN_ID = re.compile(r"\b(?:MO|[RMOWLPCX])-\d{2}[ab]?\b")
DE = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def d(s):
    return dt.date.fromisoformat(s)


def derive(R, cfg):
    tok = {"R": R.isoformat(), "TODAY": R.isoformat(), "MONTH": R.strftime("%Y-%m")}
    x = R - dt.timedelta(days=1)
    while x.weekday() > 4:
        x -= dt.timedelta(days=1)
    tok["WD2"] = x.isoformat()
    y = x - dt.timedelta(days=1)
    while y.weekday() > 4:
        y -= dt.timedelta(days=1)
    tok["WD1"] = y.isoformat()
    sun = R - dt.timedelta(days=1)
    while sun.weekday() != 6:
        sun -= dt.timedelta(days=1)
    sat = sun - dt.timedelta(days=1)
    if sat < R - dt.timedelta(days=7):
        sys.exit("no full weekend inside the write window R-7..R-1")
    tok["WE1"], tok["WE2"] = sat.isoformat(), sun.isoformat()
    for i, p in enumerate(cfg.get("prepared_days", [])):
        tok[f"P{i}"] = p
    return tok


def resolve(v, R):
    m = re.fullmatch(r"R([+-−])(\d+)", str(v).replace("−", "-"))
    if m:
        n = int(m.group(2)) * (1 if m.group(1) == "+" else -1)
        return (R + dt.timedelta(days=n)).isoformat()
    if v == "R":
        return R.isoformat()
    d(str(v))  # validate ISO
    return str(v)


def role_label(cfg, v):
    e = cfg["employees"].get(v)
    return f"{v} `{e['login']}` ({e['id']})" if e else v


def fam_cfg(cfg, fam):
    f = cfg.get("families")
    return f.get(fam, {}) if isinstance(f, dict) else {}


def emp_days(cfg, fam, R):
    """{role: {token: date}} per-employee overrides of one family"""
    out = {}
    for k, v in fam_cfg(cfg, fam).get("days", {}).items():
        if isinstance(v, dict):
            if k not in ROLES:
                sys.exit(f"[{fam}] unknown role {k} in families.{fam}.days")
            out[k] = {tk: resolve(dv, R) for tk, dv in v.items()}
    return out


def tokens_for(cfg, fam, R):
    t = derive(R, cfg)
    for k, v in cfg.get("days", {}).items():
        t[k] = resolve(v, R)
    for k, v in cfg.get("family_days", {}).get(fam, {}).items():
        t[k] = resolve(v, R)
    for k, v in fam_cfg(cfg, fam).get("days", {}).items():
        if not isinstance(v, dict):
            t[k] = resolve(v, R)
    run_dir = cfg["run_dir"]
    root = cfg.get("results_root") or str(pathlib.Path(run_dir).parent)
    t.update({"RUN": cfg["run"], "RUN_DIR": run_dir, "SKILL_DIR": str(SKILL), "TENANT": cfg["tenant"],
              "COMPARE_TENANT": cfg.get("compare_tenant", "none"), "BUNDLE": cfg["bundle"], "BUNDLE_CLASS": cfg["bundle_class"],
              "PEP_LOCK": f"{root}/.locks/pep-{cfg['tenant']}.lock", "FAMILY": fam, "AGENT_NAME": f"worker-{fam}"})
    for r, e in cfg["employees"].items():
        t[f"{r}_LOGIN"], t[f"{r}_ID"] = e["login"], str(e["id"])
        if "row_y" in e:
            t[f"{r}_ROW_Y"] = str(e["row_y"])
    for k, v in cfg.get("config", {}).items():
        t[k] = role_label(cfg, v) if k in ("KOMBI_EMP", "CARVE_EMP") else (resolve(v, R) if k in ("KOMBI_DAY", "CARVE_DAY", "E6_WD") else str(v))
    ed = emp_days(cfg, fam, R)
    for r in ROLES:
        for tk in DAY_TOKENS:
            t[f"{r}_{tk}"] = ed.get(r, {}).get(tk, t[tk])
        for tk, v in ed.get(r, {}).items():
            t[f"{r}_{tk}"] = v
    return t


def fixtures(cfg, t):
    """{role: {dates}}: prepared days (every role: R reads them, never written), Kombi/carve day, config.fixture_days"""
    fx = {r: set(v) for r, v in cfg.get("fixture_days", {}).items()}
    for r in ROLES:
        fx.setdefault(r, set()).update(cfg.get("prepared_days", []))
    c = cfg.get("config", {})
    for ek, dk in (("KOMBI_EMP", "KOMBI_DAY"), ("CARVE_EMP", "CARVE_DAY")):
        if c.get(ek) in ROLES and dk in t:
            fx.setdefault(c[ek], set()).add(t[dk])
    return fx


def run_checks(cfg, R, fams):
    """run-level date rules (seed date vs run date); returns (violations, notes)"""
    bad, notes = [], []
    t = derive(R, cfg)
    oldest = R - dt.timedelta(days=cfg.get("oldest_offset", 6))
    pdays = [d(p) for p in cfg.get("prepared_days", [])]
    for i, p in enumerate(pdays):
        if p.weekday() > 4:
            bad.append(f"P{i}={p} is a weekend day (prepared days are roster weekdays)")
        if p >= R:
            bad.append(f"P{i}={p} is not in the past (R={R})")
        if i and p <= pdays[i - 1]:
            bad.append(f"P{i}={p} is not after P{i - 1}={pdays[i - 1]}")
        for tk in DAY_TOKENS:
            if p.isoformat() == t[tk]:
                bad.append(f"P{i}={p} equals the write token {tk} (seed date = run date? paint P0/P1 on the two weekdays "
                           f"before the roster start, seed README § Dates)")
    if len(pdays) >= 4 and pdays[3] < oldest and {"L", "C"} & set(fams):
        bad.append(f"P3={pdays[3]} is older than the oldest UI-writable day {oldest} (C-04 / L-02 write on E3 P3: P3 >= R-6)")
    if cfg.get("roster_start"):
        rs = d(cfg["roster_start"])
        painted = set(cfg.get("painted_days", []))
        for i, p in enumerate(pdays):
            if p < rs and p.isoformat() not in painted:
                bad.append(f"P{i}={p} is before the roster start {rs}: paint it in PEP (seed README § Dates) and list it "
                           f"in painted_days")
    if d(t["WE1"]) == oldest:
        notes.append(f"WE1={t['WE1']} is the oldest UI-writable day: it leaves the window on {R + dt.timedelta(days=1)} "
                     f"(run O's WE1 scenario O-03 on R, or regenerate with --run-date and re-pick the day)")
    return bad, notes


def check(cfg, fam, t, R):
    out = []
    oldest = R - dt.timedelta(days=cfg.get("oldest_offset", 6))
    fx = fixtures(cfg, t)
    nights = {r: set(v) for r, v in cfg.get("night_days", {}).items()}
    planless = {r: set(v) for r, v in cfg.get("planless_days", {}).items()}
    carry = {r: set(v) for r, v in cfg.get("carry_days", {}).items()}
    ed = emp_days(cfg, fam, R)
    writes = [(role, tk, ed.get(role, {}).get(tk, t.get(tk))) for role, tk in WRITES.get(fam, [])]
    writes += [(role, tk, v) for role, m in ed.items() for tk, v in m.items() if (role, tk) not in WRITES.get(fam, [])]
    for role, tk, val in writes:
        if val is None:
            continue
        day = d(val)
        ds = day.isoformat()
        if day < oldest:
            out.append(f"{fam}: {role} {tk}={day} is older than the oldest UI-writable day {oldest} (date shift?)")
        if ds in fx.get(role, set()) and (fam, role, tk) not in BY_DESIGN:
            out.append(f"{fam}: {role} {tk}={day} is a fixture day of {role} (prepared day / Kombi / carve / data fix) - pick another day")
        if fam in STAMPING and ds in nights.get(role, set()) and (day + dt.timedelta(days=1)).isoformat() in fx.get(role, set()):
            out.append(f"{fam}: {role} {tk}={day} is a night planning followed by the fixture day {day + dt.timedelta(days=1)} "
                       f"(fixture-day protection, N-W-3)")
        key = (fam, role, tk)
        if key in NEEDS_DAY_PLANNING:
            if ds in nights.get(role, set()):
                out.append(f"{fam}: {role} {tk}={day} is a night planning; {NEEDS_DAY_PLANNING[key]} needs a day planning")
            if ds in planless.get(role, set()):
                out.append(f"{fam}: {role} {tk}={day} has no planning; {NEEDS_DAY_PLANNING[key]} needs a day planning")
        if key in NEEDS_PLANNING and ds in planless.get(role, set()):
            out.append(f"{fam}: {role} {tk}={day} has no planning; {NEEDS_PLANNING[key]} needs one")
        if key in NEEDS_NO_PLANNING:
            if role in planless and ds not in planless[role]:
                out.append(f"{fam}: {role} {tk}={day} is planned; {NEEDS_NO_PLANNING[key]} needs a planning-less day")
            if ds in carry.get(role, set()):
                out.append(f"{fam}: {role} {tk}={day} carries a night's out-stamp; {NEEDS_NO_PLANNING[key]} needs a day without stamps")
    return out


def brief_scenarios(fam, fb, cfg):
    ids = []
    for line in fb.splitlines():
        if line.startswith("| Scenarios"):
            ids += SCEN_ID.findall(line)
    ids += fam_cfg(cfg, fam).get("scenarios", [])
    return ids


def day_map(t, R, fam, cfg):
    rows = ["| Token | Date | Day | Offset from R |", "|---|---|---|---|"]
    if emp_days(cfg, fam, R):
        rows = ["Rows \"<role> <token>\" are per-employee days of this family; the brief's employee lines already carry them.", ""] + rows
    keys = ["R", "TODAY", "P0", "P1", "P2", "P3", "WE1", "WE2", "WD1", "WD2", "KOMBI_DAY", "CARVE_DAY", "E6_WD"]
    for k in keys:
        if k in t:
            x = d(t[k])
            rows.append(f"| {k} | {t[k]} | {DE[x.weekday()]} | R{(x - R).days:+d} |".replace("R+0", "R"))
    for role, m in emp_days(cfg, fam, R).items():
        for k, v in m.items():
            x = d(v)
            rows.append(f"| {role_label(cfg, role)} {k} | {v} | {DE[x.weekday()]} | R{(x - R).days:+d} |".replace("R+0", "R"))
    rows.append(f"| oldest UI-writable day | {R - dt.timedelta(days=cfg.get('oldest_offset', 6))} | | R−{cfg.get('oldest_offset', 6)} |")
    return "\n".join(rows)


def header(cfg, fam, t, R, warns, notes, part=None):
    model = cfg.get("worker_model", "sonnet")
    title = fam if not part else f"{fam} part {part}"
    h = [f"# UTR E2E run {cfg['run']} — family {title} — worker prompt (environment under test {cfg['tenant']}, bundle {cfg['bundle']} / {cfg['bundle_class']}, worker model {model})",
         "",
         "## Run guardrails (they override anything below)",
         f"- **Environment under test: `{cfg['tenant']}` ONLY**" + ("" if t["COMPARE_TENANT"] == "none" else f"; compare environment `{t['COMPARE_TENANT']}` only for the overlay") + ". Never touch any other tenant.",
         "- **Never run kubectl** (or helm, or any cluster tool). **No git** at all.",
         "- **Never print, cat, grep, copy or persist credentials** (DeployMate credential / test-data files, tokens, passwords, connect strings): the scripts read them.",
         "- **Permission classifier denials**: do not work around a refused command; put it into `blockers` and continue.",
         f"- Run date **{R.isoformat()} ({DE[R.weekday()]})**, Europe/Zurich; the day map below is authoritative where anything disagrees; common hard rule 11 (date shift) applies if the date is later when you write.",
         f"- Bundle `{cfg['bundle']}`, class `{cfg['bundle_class']}`: judge every mismatch against scenarios.md \"Known product defects\" and \"Bundle-aware expectations\".",
         f"- PEP lock file: `{t['PEP_LOCK']}`. Evidence `{cfg['run_dir']}/{fam}/<scenario-id>/`, scripts `{cfg['run_dir']}/scripts/{fam}-*.mjs`, profiles `{cfg['run_dir']}/.profiles/{fam}`, created objects `{cfg['run_dir']}/created/{fam}.jsonl`."]
    if part:
        other = [p for p in PARTS[fam] if p != part]
        h.append(f"- **You run PART {part} of family {fam} only** (section \"Part {part}\" of the family brief). "
                 + ("Report every part-2 item with verdict `PENDING` (family brief \"PENDING convention\")."
                    if part == "1" else f"Read your part-{other[0]} report / evidence first; report the final verdicts of the part-2 items."))
    h += ["", f"## Day map — family {fam}", day_map(t, R, fam, cfg)]
    if notes:
        h += ["", "## Day-map notes (generated)"] + [f"- {n}" for n in notes]
    if cfg.get("common_notes"):
        h += ["", cfg["common_notes"].strip()]
    if cfg.get("family_notes", {}).get(fam):
        h += ["", cfg["family_notes"][fam].strip()]
    if warns:
        h += ["", "## Day-rule warnings (generated; the orchestrator accepted them with --allow-violations — stop and report a blocker before writing on such a day)"] + [f"- {w}" for w in warns]
    return "\n".join(h) + "\n"


def subst(text, t, fam):
    def f(m):
        k = m.group(1)
        if k not in t:
            sys.exit(f"[{fam}] unknown placeholder {{{{{k}}}}} (add it to the config)")
        return t[k]
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", f, text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config"); ap.add_argument("--run-date"); ap.add_argument("--out"); ap.add_argument("--families")
    ap.add_argument("--allow-violations", action="store_true"); ap.add_argument("--print-day-map", action="store_true")
    a = ap.parse_args()
    cfg = json.loads(pathlib.Path(a.config).read_text())
    R = d(a.run_date or cfg["run_date"])
    fl = cfg.get("families")
    fams = a.families.split(",") if a.families else (fl if isinstance(fl, list) else cfg.get("generate", FAMILIES))
    common = (SKILL / "assets/agent-brief.md").read_text().split("\n---\n", 1)[1]
    outdir = pathlib.Path(a.out or f"{cfg['run_dir']}/prompts"); outdir.mkdir(parents=True, exist_ok=True)
    bad = 0; summary = []
    run_bad, notes = run_checks(cfg, R, fams)
    for w in run_bad:
        print("DAY RULE:", w, file=sys.stderr)
    for n in notes:
        print("NOTE:", n, file=sys.stderr)
    briefs, owner = {}, {}
    for fam in fams:
        if fam not in FAMILIES:
            sys.exit(f"unknown family {fam} (RE and X prompts are written by the orchestrator)")
        briefs[fam] = (SKILL / f"assets/family-briefs/{fam}.md").read_text()
        for sid in brief_scenarios(fam, briefs[fam], cfg):
            owner.setdefault(sid, set()).add(fam)
    own_bad = [f"scenario {sid} is handed to families {', '.join(sorted(f))} (one owner only; G-orch-8)"
               for sid, f in sorted(owner.items()) if len(f) > 1]
    for w in own_bad:
        print("OWNERSHIP:", w, file=sys.stderr)
    if set(fams) == set(FAMILIES):
        known = {s["id"] for s in json.loads((SKILL / "assets/scenarios.json").read_text())}
        covered = set(owner) | {s[:-1] for s in owner if s[-1] in "ab"}
        rest = sorted(k for k in known - covered if not k.startswith("X-"))
        if rest:
            print("NOTE: scenarios in no family brief:", ", ".join(rest), file=sys.stderr)
    for fam in fams:
        t = tokens_for(cfg, fam, R)
        fb = briefs[fam]
        warns = run_bad + own_bad + check(cfg, fam, t, R)
        for role, m in emp_days(cfg, fam, R).items():
            for tk in m:
                if "{{" + f"{role}_{tk}" + "}}" not in fb:
                    warns.append(f"{fam}: per-employee override {role} {tk} is never used by the brief ({{{{{role}_{tk}}}}}): "
                                 f"the body would keep the family value")
        for w in warns[len(run_bad) + len(own_bad):]:
            print("DAY RULE:", w, file=sys.stderr)
        if warns and not a.allow_violations:
            bad = 1
            continue
        body = common + "\n\n---\n\n" + fb
        for name, path in cfg.get("files", {}).items():
            body = body.replace("`{{RUN_DIR}}/" + name + "`", f"`{path}`").replace("`" + name + "`", f"`{path}`")
        filled = subst(body, t, fam)
        for part in PARTS.get(fam, [None]):
            out = header(cfg, fam, t, R, warns, notes, part) + "\n---\n" + filled
            if "{{" in out:
                sys.exit(f"[{fam}] leftover '{{{{' in the prompt")
            name = f"{fam}.md" if not part else f"{fam}-part{part}.md"
            (outdir / name).write_text(out)
            summary.append(f"{name[:-3]} {len(out)}")
        if a.print_day_map:
            print(f"## {fam}\n" + day_map(t, R, fam, cfg))
    print("written:", ", ".join(summary) or "nothing", "->", outdir)
    sys.exit(bad)


if __name__ == "__main__":
    main()
