#!/usr/bin/env python3
"""gen-prompts.py — the cloud-e2e prompt engine: worker prompts of one group from its package and a run config.

    python3 -I scripts/gen-prompts.py <run-config.json> --group <key> [--solo] [--claims <claims.json>]
                                      [--run-date YYYY-MM-DD] [--out <dir>] [--families A,B] [--allow-violations]
                                      [--print-day-map]
    python3 -I scripts/gen-prompts.py [<run-config.json>] --group <key> --dry-run      # every check, nothing written
    python3 -I scripts/gen-prompts.py --check-catalogue <synthesis/catalogue.json>      # every id in exactly one family (merged / dropped rows: in none)

Group package (frozen schemas, skill-design.md 4.1 / 4.2): groups/<key>/group.json (families with brief + scenarios, windows,
roles ...) and groups/<key>/rules.json (ROLES, DAY_TOKENS, WRITES, PARTS, NEEDS, BY_DESIGN, SCEN_ID, DAY_RULES, PLACEHOLDERS).
A config without --group uses config.group, else "utr"; without --group, config.group and config.mode it runs as the v0.5.0
command line did (`gen-prompts.py <config>` = group utr, solo).

Prompt = header (guardrails, day map, notes, day-rule warnings) + common part + family brief, every {{placeholder}} filled:
  - slot layout (default): common part = assets/agent-brief.md below its first `---` line, its {{GROUP_BRIEF}} replaced by
    groups/<key>/assets/group-brief.md (the text after `<!-- BEGIN WORKER BRIEF -->` when that marker exists, else the text
    after its first `---` line when it has one — runner notes above it —, else all of it);
  - standalone layout (the group brief carries `<!-- BRIEF LAYOUT: standalone`; group utr): common part = the group brief alone,
    plus, unless --solo, the generic "Hard rules" and the "Multi-group run" addendum of assets/agent-brief.md. A solo utr prompt is the v0.5.0 prompt
    (only paths and the PEP-lock line differ: groups/utr/tests/a1801-*).
A family with `parts` (rules PARTS) gives one prompt per part (C-part1.md, C-part2.md). Families without a brief (UTR X) and
families without scenarios (re-check RE) are written by the runner, never generated. Never patch a generated prompt: change the
config or the brief and regenerate. Exit 1 on a leftover `{{`, an unknown placeholder, a day-rule / ownership violation (unless
--allow-violations: then printed into the header and on stderr), an unclaimed actor (--claims) or two concurrent families
writing the same (actor, day) (actor_day_check, multi-group only); the last two are never bypassed.

Run directory: --solo (or config.mode "solo") -> RUN_DIR = config.run_dir (results/<run>, v0.5.0); multi-group -> RUN_DIR =
config.run_dir/<group> unless run_dir already ends with /<group>. Results never mix groups.

Day map (Europe/Zurich run date R, from --run-date or config.run_date). Always: R, TODAY = R, MONTH. With DAY_RULES.derive_week:
WD2 = the last weekday before R, WD1 = the weekday before WD2, WE1/WE2 = the last weekend inside R-7..R-1. Prepared days from
DAY_RULES.prepared (config.prepared_days -> P0..Pn). A DAY_TOKENS entry may be {"rule": "R-relative", "offset": n,
"weekday": "next"|"prev"}: computed. Every other day token comes from the config (a value may be "R-3"-style or an ISO date),
most specific wins: config.days (all families) < config.family_days.<F> < config.families.<F>.days.<TOKEN> < per employee
config.families.<F>.days.<ROLE>.<TOKEN>. Role-tagged tokens {{<ROLE>_<TOKEN>}} = the per-employee override of this family, else
the family value (briefs use them on every employee line; an override the brief never uses is a violation).

Coordination (config.coordination, references/coordination.md): "artifact-db" (default: ArtifactData on the run dashboard),
"gcs" (fallback F1, config.gcs_bucket), "degraded" (F2: the steward grants PEP slots, config.pep_slot) or "local-file"
(solo on one machine: the v0.5.0 lock file). It fills {{PEP_LOCK_DOC}} and {{PEP_LOCK_STEPS}}.

Windows ({{WINDOWS}}, references/coordination.md 4): every group's `windows` merged by id (owners, scenarios, pauses, exempt
united; class and env must agree, else a schema error). A window's env: STAGE = every env, SHARED = the shared group only, an id
`W-X-` / `J-Y-` / `T-Y-`... = X / Y, else the declaring group's env.preferred. The worker's env: SH for the shared group, else
config.env_role, else the group's env.preferred. One entry per window of that env: "runs inside", "exempt" (HARD only) or "pauses".

Config (JSON; ids / logins / urls, never credentials):
{ "run": "...", "run_dir": "<abs results/<run>>", "group": "utr", "mode": "solo|multi", "tenant": "<env id>",
  "env_role": "X|Y", "runner": "<name>", "dashboard_url": "https://claude.ai/...", "coordination": "artifact-db",
  "compare_tenant": "none", "bundle": "0.0.1829", "bundle_class": "1801", "worker_model": "sonnet", "run_date": "YYYY-MM-DD",
  "prepared_days": [...], "roster_start": "YYYY-MM-DD", "roster_end": "YYYY-MM-DD", "painted_days": [...],
  "employees": {"<ROLE>": {"login": "dmseed-...", "id": 480, "row_y": 259}},
  "config": {"<TOKEN>": "value"}, "days": {...}, "family_days": {...}, "families": {"<F>": {"days": {...}, "scenarios": [...]}},
  "files": {"<name>": "<abs path>"}, "night_days": {...}, "planless_days": {...}, "carry_days": {...}, "fixture_days": {...},
  "common_notes": "...", "family_notes": {"<F>": "..."}, "generate": ["R", ...] }
"""
import argparse, datetime as dt, json, pathlib, re, sys

SKILL = pathlib.Path(__file__).resolve().parent.parent
DE = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
WEEK_TOKENS = ["WD1", "WD2", "WE1", "WE2", "TODAY"]
BEGIN_WORKER = "<!-- BEGIN WORKER BRIEF -->"
STANDALONE = "<!-- BRIEF LAYOUT: standalone"
ADD_BEGIN, ADD_END = "<!-- BEGIN MULTI-GROUP ADDENDUM -->", "<!-- END MULTI-GROUP ADDENDUM -->"
WINDOW_CLASSES = {"HARD", "LOGIN", "FLAG", "SOFT", "INTERNAL", "LOCK", "JOBS", "STAGE", "SHARED"}
MODES = {"artifact-db", "gcs", "degraded", "local-file"}


def d(s):
    return dt.date.fromisoformat(s)


def jload(p):
    try:
        return json.loads(pathlib.Path(p).read_text())
    except (OSError, ValueError) as e:
        sys.exit(f"cannot read {p}: {e}")


class Group:
    """One group package: group.json + rules.json, with the v0.5.0 constants derived from them."""

    def __init__(self, key):
        self.key = key
        self.dir = SKILL / "groups" / key
        if not (self.dir / "group.json").is_file():
            known = sorted(p.name for p in (SKILL / "groups").iterdir() if (p / "group.json").is_file()) if (SKILL / "groups").is_dir() else []
            sys.exit(f"unknown group {key} (groups with a group.json: {', '.join(known) or 'none'})")
        self.g = jload(self.dir / "group.json")
        self.r = jload(self.dir / "rules.json") if (self.dir / "rules.json").is_file() else {}
        r, dr = self.r, self.r.get("DAY_RULES", {}) or {}
        self.dr = dr
        self.roles = list((r.get("ROLES") or {}).keys())
        self.role_kind = dict(r.get("ROLES") or {})
        self.day_tokens = dict(r.get("DAY_TOKENS") or {})
        self.parts = {k: list(v) for k, v in (r.get("PARTS") or {}).items()}
        for f in self.g.get("families", []):
            if f.get("parts") and f["id"] not in self.parts:
                self.parts[f["id"]] = list(f["parts"])
        self.writes = {k: [tuple(x[:2]) for x in v] for k, v in (r.get("WRITES") or {}).items()}
        self.by_design = {tuple(x[:3]) for x in (r.get("BY_DESIGN") or [])}
        self.stamping = set(dr.get("stamping_families", []))
        pt = dr.get("planning_type", {}) or {}
        self.needs_day = {tuple(x[:3]): x[3] for x in pt.get("day_planning", [])}
        self.needs_plan = {tuple(x[:3]): x[3] for x in pt.get("planning", [])}
        self.needs_none = {tuple(x[:3]): x[3] for x in pt.get("no_planning", [])}
        self.scen_id = re.compile(r.get("SCEN_ID") or r"\b[A-Z]{1,5}-\d{2}[ab]?\b")
        self.fams = [f["id"] for f in self.g.get("families", [])]
        self.fam = {f["id"]: f for f in self.g.get("families", [])}
        self.generatable = [f["id"] for f in self.g.get("families", []) if f.get("brief") and f.get("scenarios")]
        self.week = bool(dr.get("derive_week")) or (bool(self.day_tokens) and all(self.day_tokens.get(t) == "R-relative" for t in WEEK_TOKENS[:4]))
        self.week_tokens = [t for t in WEEK_TOKENS if t in self.day_tokens or self.week]
        ph = r.get("PLACEHOLDERS") or {}
        self.ph_values = {k: v["value"] for k, v in ph.items() if isinstance(v, dict) and "value" in v}
        self.ph_docs = {k: (v.get("doc", "") if isinstance(v, dict) else str(v)) for k, v in ph.items()}
        gb = self.dir / "assets/group-brief.md"
        self.gb_text = gb.read_text() if gb.is_file() else ""
        self.standalone = STANDALONE in self.gb_text
        self.gb_worker = self.gb_text
        if BEGIN_WORKER in self.gb_text:  # the marker sits on its own line: drop that line's newline
            w = self.gb_text.split(BEGIN_WORKER, 1)[1]
            self.gb_worker = w[1:] if w.startswith("\n") else w
        elif "\n---\n" in self.gb_text:  # runner notes above the first `---` line (same convention as assets/agent-brief.md)
            self.gb_worker = self.gb_text.split("\n---\n", 1)[1]

    def brief(self, fam):
        return (self.dir / self.fam[fam]["brief"]).read_text()


# ---------------------------------------------------------------- validation (schema-level, offline)
def validate(G):
    errs, notes = [], []
    g, r = G.g, G.r
    for k in ("key", "title", "env", "families", "roles", "baseline_flags", "windows", "schedule"):
        if k not in g:
            errs.append(f"group.json: missing key `{k}`")
    if g.get("key") != G.key:
        errs.append(f"group.json: key `{g.get('key')}` differs from the folder name `{G.key}`")
    if not (G.dir / "rules.json").is_file():
        errs.append("rules.json missing")
    for k in ("ROLES", "SCEN_ID"):
        if k not in r:
            errs.append(f"rules.json: missing key `{k}`")
    try:
        re.compile(r.get("SCEN_ID", ""))
    except re.error as e:
        errs.append(f"rules.json: SCEN_ID does not compile: {e}")
    seen = {}
    for f in g.get("families", []):
        if "id" not in f or "scenarios" not in f:
            errs.append(f"group.json: family without id / scenarios: {f}")
            continue
        if f.get("brief") and not (G.dir / f["brief"]).is_file():
            errs.append(f"family {f['id']}: brief {f['brief']} not found")
        for s in f["scenarios"]:
            if not G.scen_id.fullmatch(s) and not G.scen_id.search(s):
                notes.append(f"family {f['id']}: scenario id {s} does not match SCEN_ID")
            seen.setdefault(s, []).append(f["id"])
    for s, fs in sorted(seen.items()):
        if len(fs) > 1:
            errs.append(f"scenario {s} is in families {', '.join(fs)} (one owner only)")
    for w in g.get("windows", []):
        if not w.get("id"):
            errs.append(f"window without id: {w}")
        if w.get("class") not in WINDOW_CLASSES:
            errs.append(f"window {w.get('id')}: class {w.get('class')} not in {sorted(WINDOW_CLASSES)}")
        for p in w.get("pauses", []):
            if not re.fullmatch(r"[a-z]+(:[A-Za-z0-9*-]+)?", p):
                errs.append(f"window {w.get('id')}: pause `{p}` is not group:family")
        if w.get("exempt") and w.get("class") != "HARD":
            errs.append(f"window {w.get('id')}: `exempt` is for HARD windows only (a {w.get('class')} window pauses only its `pauses`)")
        for p in w.get("exempt", []):
            if not re.fullmatch(r"[a-z]+(:[A-Za-z0-9*-]+)?", p):
                errs.append(f"window {w.get('id')}: exempt `{p}` is not group:family")
    errs += merge_windows()[1]  # windows declared by several groups (merged by id): class / env must agree
    for fam, ws in G.writes.items():
        if fam not in G.fams:
            notes.append(f"rules WRITES: family {fam} not in group.json")
        for role, _ in ws:
            if role not in G.roles:
                errs.append(f"rules WRITES {fam}: role {role} not in ROLES")
    if not G.gb_text:
        notes.append("assets/group-brief.md missing (the {{GROUP_BRIEF}} slot stays empty)")
    return errs, notes


# ---------------------------------------------------------------- day map
def derive(R, cfg, G):
    tok = {"R": R.isoformat(), "TODAY": R.isoformat(), "MONTH": R.strftime("%Y-%m")}
    if G.week:
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
    pr = G.dr.get("prepared")
    if pr:
        for i, p in enumerate(cfg.get(pr.get("config_key", "prepared_days"), [])):
            tok[f"{pr.get('prefix', 'P')}{i}"] = p
    for k, spec in G.day_tokens.items():
        if isinstance(spec, dict) and spec.get("rule") == "R-relative" and "offset" in spec:
            x = R + dt.timedelta(days=int(spec["offset"]))
            step = {"next": 1, "prev": -1}.get(spec.get("weekday"))
            while step and x.weekday() > 4:
                x += dt.timedelta(days=step)
            tok[k] = x.isoformat()
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


def emp_days(cfg, fam, R, G):
    """{role: {token: date}} per-employee overrides of one family"""
    out = {}
    for k, v in fam_cfg(cfg, fam).get("days", {}).items():
        if isinstance(v, dict):
            if k not in G.roles:
                sys.exit(f"[{fam}] unknown role {k} in families.{fam}.days")
            out[k] = {tk: resolve(dv, R) for tk, dv in v.items()}
    return out


def lock_tokens(cfg, env, run_dir, fam="<family>"):
    mode = cfg.get("coordination", "artifact-db")
    if mode not in MODES:
        sys.exit(f"config.coordination `{mode}` is not one of {sorted(MODES)}")
    holder = f"{cfg.get('runner', 'runner')}/{fam}"
    url = cfg.get("dashboard_url", "<dashboard url>")
    if mode == "artifact-db":
        doc = f"locks/{env}~pep"
        steps = (f"before any PEP step create the lock with ArtifactData on the run dashboard {url} (load the tool first if it is deferred): "
                 f"`action \"set\"`, `collection \"locks\"`, `doc_id \"{env}~pep\"`, **no** `if_version`, `data` "
                 f"`{{\"holder\": \"{holder}\", \"purpose\": \"<step>\", \"since\": \"<ISO now>\", \"expiresAt\": \"<now + 20 min>\"}}`. "
                 f"Refused because it exists = the desktop is taken: `get` it, wait (poll every 60 s, at most 30 min), then stop the step and "
                 f"report the blocker `PEP lock held by <holder>`; never force it and never take over an expired lock (the steward does). "
                 f"While you work renew it every ≤ 10 min (`update`, `if_version` = the version you hold, new `expiresAt`); right after the step "
                 f"`delete` it with `if_version`.")
    elif mode == "gcs":
        b = cfg.get("gcs_bucket", "<bucket>")
        doc = f"gs://{b}/{cfg['run']}/locks/{env}~pep.json"
        steps = (f"before any PEP step create the lock object with `gcloud storage cp <local json> {doc} --if-generation-match=0` "
                 f"(json `{{\"holder\": \"{holder}\", \"purpose\": \"<step>\", \"since\": \"<ISO now>\", \"expiresAt\": \"<now + 20 min>\"}}`). "
                 f"A precondition failure (412) = taken: read it (`gcloud storage cat`), wait (poll every 60 s, at most 30 min), then stop the step "
                 f"and report the blocker `PEP lock held by <holder>`; never force, never take over an expired lock (the steward does). "
                 f"Renew every ≤ 10 min with `--if-generation-match=<your generation>`; right after the step "
                 f"`gcloud storage rm {doc} --if-generation-match=<your generation>`.")
    elif mode == "degraded":
        slot = cfg.get("pep_slot")
        doc = f"steward PEP slot of {env}"
        steps = (f"this run has no shared lock store: the steward granted your family the PEP desktop of `{env}` for {slot}; drive PEP only "
                 f"inside that slot and stop the step with the blocker `PEP slot` outside it." if slot else
                 f"this run has no shared lock store and the steward granted no PEP slot: do not drive PEP; report every PEP step as the "
                 f"blocker `PEP slot needed`.")
    else:
        root = cfg.get("results_root") or str(pathlib.Path(run_dir).parent)
        doc = f"{root}/.locks/pep-{env}.lock"
        steps = (f"before any PEP step write your family id into `{doc}` (abort if it exists and is younger than 20 min); delete it right "
                 f"after the step. Valid only when every PEP user of `{env}` runs on this machine (solo).")
    return mode, doc, steps


def window_env(w, preferred):
    """env a window applies to: "*" = every env (STAGE), "SH" = the shared group only (SHARED), X / Y from an id
    `<letter>-X-...` / `<letter>-Y-...` (W-X-WRITE-OFF, J-Y-JOBS, T-Y-TENANTFORM), else the declaring group's env.preferred (UTR-P)"""
    if w.get("class") == "STAGE":
        return "*"
    if w.get("class") == "SHARED":
        return "SH"
    m = re.match(r"[A-Z]-([XY])-", str(w.get("id", "")))
    return m.group(1) if m else str(preferred or "-")


def worker_env(cfg, G):
    """env of the worker, for the window filter: SH for a group of env kind "shared", else config.env_role (X / Y), else the
    group's env.preferred (synthetic dry-run and solo configs carry no env_role)"""
    e = G.g.get("env") or {}
    if e.get("kind") == "shared":
        return "SH"
    return str(cfg.get("env_role") or e.get("preferred") or "-")


def merge_windows():
    """every group's windows merged by id (W-Y-MSG is declared by auth and ops, W-X-WRITE-OFF by swap and booking):
    ([{id, class, env, est_min, owners [], scenarios [], pauses [], exempt []}], errors). scenarios / pauses / exempt are the
    union of the declarations; class and env must agree; a family may not be both paused and exempt."""
    merged, errs = {}, []
    gd = SKILL / "groups"
    for p in sorted(gd.iterdir()) if gd.is_dir() else []:
        if not (p / "group.json").is_file():
            continue
        try:
            g = json.loads((p / "group.json").read_text())
        except ValueError:
            continue
        pref = (g.get("env") or {}).get("preferred")
        for w in g.get("windows", []):
            if not w.get("id"):
                continue
            env, m = window_env(w, pref), merged.get(w["id"])
            if m is None:
                m = merged[w["id"]] = {"id": w["id"], "class": w.get("class"), "env": env, "est_min": w.get("est_min"),
                                       "owners": [], "scenarios": [], "pauses": [], "exempt": []}
            else:
                if w.get("class") != m["class"]:
                    errs.append(f"window {w['id']}: class {w.get('class')} in group {p.name} but {m['class']} in group "
                                f"{m['owners'][0]} (one id = one window: every declaration must name the same class)")
                if env != m["env"]:
                    errs.append(f"window {w['id']}: env {env} in group {p.name} but {m['env']} in group {m['owners'][0]}")
                if isinstance(w.get("est_min"), (int, float)) and (not isinstance(m["est_min"], (int, float)) or w["est_min"] > m["est_min"]):
                    m["est_min"] = w["est_min"]
            m["owners"].append(p.name)
            for k in ("scenarios", "pauses", "exempt"):
                m[k] += [x for x in w.get(k, []) if x not in m[k]]
    for m in merged.values():
        both = sorted(set(m["pauses"]) & set(m["exempt"]))
        if both:
            errs.append(f"window {m['id']}: {', '.join(both)} in both `pauses` and `exempt`")
    return list(merged.values()), errs


def all_windows():
    return merge_windows()[0]


def windows_text(G, fam, wins, env):
    """{{WINDOWS}}: one entry per window of the worker's env that touches the family (wins = all_windows(), merged by id):
    runs inside (one of its scenarios, or the family's `window`) > exempt (HARD only) > pauses (listed in `pauses`, or HARD)"""
    out, fs = [], set(G.fam.get(fam, {}).get("scenarios", []))
    own = G.fam.get(fam, {}).get("window")
    me = {f"{G.key}:{fam}", G.key, f"{G.key}:*"}
    for w in wins:
        if w["env"] not in ("*", env):
            continue
        hard, o = w.get("class") == "HARD", w["owners"]
        what = (f"`{w['id']}` ({w.get('class')}, ~{'?' if w.get('est_min') is None else w['est_min']} min, "
                f"group{'s' if len(o) > 1 else ''} {', '.join(o)})")
        if w["id"] == own or fs & set(w["scenarios"]):
            out.append(f"{what}: this family runs inside it")
        elif hard and me & set(w["exempt"]):
            out.append(f"{what}: this family is exempt (keeps running)")
        elif hard or me & set(w["pauses"]):
            out.append(f"{what}: pauses this family")
    return "; ".join(out) or "none"


def run_dir_of(cfg, G, solo):
    rd = cfg["run_dir"].rstrip("/")
    if solo or rd.endswith("/" + G.key):
        return rd
    return f"{rd}/{G.key}"


def tokens_for(cfg, fam, R, G, solo, wins):
    t = derive(R, cfg, G)
    for k, v in cfg.get("days", {}).items():
        t[k] = resolve(v, R)
    for k, v in cfg.get("family_days", {}).get(fam, {}).items():
        t[k] = resolve(v, R)
    for k, v in fam_cfg(cfg, fam).get("days", {}).items():
        if not isinstance(v, dict):
            t[k] = resolve(v, R)
    run_dir = run_dir_of(cfg, G, solo)
    env = cfg["tenant"]
    mode, lock_doc, lock_steps = lock_tokens(cfg, env, run_dir, fam)
    t.update({"RUN": cfg["run"], "RUN_DIR": run_dir, "SKILL_DIR": str(SKILL), "TENANT": env,
              "COMPARE_TENANT": cfg.get("compare_tenant", "none"), "BUNDLE": cfg["bundle"], "BUNDLE_CLASS": cfg["bundle_class"],
              "PEP_LOCK_DOC": lock_doc, "PEP_LOCK_STEPS": lock_steps, "PEP_LOCK": lock_doc, "COORD_MODE": mode,
              "FAMILY": fam, "AGENT_NAME": f"worker-{fam}",
              "GROUP": G.key, "GROUP_DIR": str(G.dir), "GROUP_TITLE": G.g.get("title", G.key),
              "RUNNER": cfg.get("runner", "solo" if solo else "<runner>"), "ENV": env, "ENV_ROLE": cfg.get("env_role", "-"),
              "DASHBOARD_URL": cfg.get("dashboard_url", "<dashboard url>"), "WINDOWS": windows_text(G, fam, wins, worker_env(cfg, G))})
    for k, v in G.ph_values.items():
        t.setdefault(k, str(v))
    for r, e in cfg["employees"].items():
        t[f"{r}_LOGIN"], t[f"{r}_ID"] = e["login"], str(e["id"])
        if "row_y" in e:
            t[f"{r}_ROW_Y"] = str(e["row_y"])
    labels, dates = set(G.dr.get("role_label_keys", [])), set(G.dr.get("date_keys", []))
    for k, v in cfg.get("config", {}).items():
        t[k] = role_label(cfg, v) if k in labels else (resolve(v, R) if k in dates else str(v))
    ed = emp_days(cfg, fam, R, G)
    tagged = list(G.week_tokens) + [k for k in G.day_tokens if k not in G.week_tokens]
    for r in G.roles:
        for tk in tagged:
            if tk in t or tk in ed.get(r, {}):
                t[f"{r}_{tk}"] = ed.get(r, {}).get(tk, t.get(tk))
        for tk, v in ed.get(r, {}).items():
            t[f"{r}_{tk}"] = v
    return t


def fixtures(cfg, t, G):
    """{role: {dates}}: prepared days (every role), the DAY_RULES.fixture_roles days, config.fixture_days"""
    fx = {r: set(v) for r, v in cfg.get("fixture_days", {}).items()}
    pr = G.dr.get("prepared")
    for r in G.roles:
        fx.setdefault(r, set()).update(cfg.get(pr.get("config_key", "prepared_days"), []) if pr else [])
    c = cfg.get("config", {})
    for ek, dk in G.dr.get("fixture_roles", []):
        if c.get(ek) in G.roles and dk in t:
            fx.setdefault(c[ek], set()).add(t[dk])
    return fx


def run_checks(cfg, R, fams, G):
    """run-level date rules (seed date vs run date, DAY_TOKENS rules); returns (violations, notes)"""
    bad, notes = [], []
    t = derive(R, cfg, G)
    oldest = R - dt.timedelta(days=cfg.get("oldest_offset", G.dr.get("oldest_offset", 6)))
    pr = G.dr.get("prepared")
    if pr:
        pfx = pr.get("prefix", "P")
        pdays = [d(p) for p in cfg.get(pr.get("config_key", "prepared_days"), [])]
        for i, p in enumerate(pdays):
            if pr.get("weekday") and p.weekday() > 4:
                bad.append(f"{pfx}{i}={p} is a weekend day (prepared days are roster weekdays)")
            if pr.get("before_run_date") and p >= R:
                bad.append(f"{pfx}{i}={p} is not in the past (R={R})")
            if i and p <= pdays[i - 1]:
                bad.append(f"{pfx}{i}={p} is not after {pfx}{i - 1}={pdays[i - 1]}")
            if pr.get("not_write_tokens"):
                for tk in WEEK_TOKENS:
                    if tk in t and p.isoformat() == t[tk]:
                        bad.append(f"{pfx}{i}={p} equals the write token {tk} (seed date = run date? paint P0/P1 on the two weekdays "
                                   f"before the roster start, seed README § Dates)")
        mo = pr.get("min_oldest")
        if mo and len(pdays) > mo["index"] and pdays[mo["index"]] < oldest and set(mo.get("families", [])) & set(fams):
            bad.append(f"{pfx}{mo['index']}={pdays[mo['index']]} is older than the oldest UI-writable day {oldest} ({mo.get('label', '')})")
        if pr.get("roster_start_painted") and cfg.get("roster_start"):
            rs = d(cfg["roster_start"])
            painted = set(cfg.get("painted_days", []))
            for i, p in enumerate(pdays):
                if p < rs and p.isoformat() not in painted:
                    bad.append(f"{pfx}{i}={p} is before the roster start {rs}: paint it in PEP (seed README § Dates) and list it "
                               f"in painted_days")
    if G.dr.get("we1_note") and "WE1" in t and d(t["WE1"]) == oldest:
        notes.append(f"WE1={t['WE1']} is the oldest UI-writable day: it leaves the window on {R + dt.timedelta(days=1)} "
                     f"(run O's WE1 scenario O-03 on R, or regenerate with --run-date and re-pick the day)")
    # generic DAY_TOKENS rules (other groups): seeded future weekdays and painted days
    painted = set(cfg.get("painted_days", []))
    rend = d(cfg["roster_end"]) if cfg.get("roster_end") else None
    for k, spec in G.day_tokens.items():
        rule = spec.get("rule") if isinstance(spec, dict) else spec
        v = cfg.get("days", {}).get(k)
        if v is None:
            continue
        x = d(resolve(v, R))
        if rule == "seeded-future-weekday":
            if x <= R or x.weekday() > 4:
                bad.append(f"{k}={x} must be a weekday after R={R} (seeded-future-weekday)")
            if rend and x > rend and x.isoformat() not in painted:
                bad.append(f"{k}={x} is after the seeded roster end {rend}: paint it and list it in painted_days")
        elif rule == "painted" and painted and x.isoformat() not in painted:
            notes.append(f"{k}={x} is a painted day but not listed in painted_days")
    # generic DAY_RULES keys used by the group packages (when present)
    vals = {}
    for k, v in list(cfg.get("days", {}).items()) + list(cfg.get("config", {}).items()):
        if k in G.day_tokens:
            try:
                vals[k] = d(resolve(v, R))
            except ValueError:
                pass
    dr = G.dr
    for k in dr.get("weekday_only", []):
        if k in vals and vals[k].weekday() > 4:
            bad.append(f"{k}={vals[k]} is a weekend day (DAY_RULES.weekday_only)")
    for k in dr.get("past", []):
        if k in vals and vals[k] >= R:
            bad.append(f"{k}={vals[k]} is not in the past (DAY_RULES.past, R={R})")
    lo, hi = dr.get("min_offset_days"), dr.get("max_offset_days")
    for k in list(dr.get("seeded", [])) + list(dr.get("painted", [])):
        if k in vals:
            off = (vals[k] - R).days
            if lo is not None and off < lo:
                bad.append(f"{k}={vals[k]} is R{off:+d}, before R+{lo} (DAY_RULES.min_offset_days)")
            if hi is not None and off > hi:
                bad.append(f"{k}={vals[k]} is R{off:+d}, after R+{hi} (DAY_RULES.max_offset_days)")
    for k in dr.get("seeded", []):
        if G.day_tokens.get(k) == "seeded-future-weekday":
            continue  # already checked above
        if k in vals and rend and vals[k] > rend and vals[k].isoformat() not in painted:
            bad.append(f"{k}={vals[k]} is after the seeded roster end {rend} (DAY_RULES.seeded): paint it and list it in painted_days")
    dist = [k for k in dr.get("distinct", []) if k in vals]
    seen = {}
    for k in dist:
        if vals[k] in seen:
            bad.append(f"{k}={vals[k]} equals {seen[vals[k]]} (DAY_RULES.distinct)")
        seen.setdefault(vals[k], k)
    return bad, notes


def check(cfg, fam, t, R, G):
    out = []
    oldest = R - dt.timedelta(days=cfg.get("oldest_offset", G.dr.get("oldest_offset", 6)))
    fx = fixtures(cfg, t, G)
    nights = {r: set(v) for r, v in cfg.get("night_days", {}).items()}
    planless = {r: set(v) for r, v in cfg.get("planless_days", {}).items()}
    carry = {r: set(v) for r, v in cfg.get("carry_days", {}).items()}
    ed = emp_days(cfg, fam, R, G)
    wr = G.writes.get(fam, [])
    writes = [(role, tk, ed.get(role, {}).get(tk, t.get(tk))) for role, tk in wr]
    writes += [(role, tk, v) for role, m in ed.items() for tk, v in m.items() if (role, tk) not in wr]
    for role, tk, val in writes:
        if val is None:
            continue
        day = d(val)
        ds = day.isoformat()
        if day < oldest:
            out.append(f"{fam}: {role} {tk}={day} is older than the oldest UI-writable day {oldest} (date shift?)")
        if ds in fx.get(role, set()) and (fam, role, tk) not in G.by_design:
            out.append(f"{fam}: {role} {tk}={day} is a fixture day of {role} (prepared day / Kombi / carve / data fix) - pick another day")
        if fam in G.stamping and ds in nights.get(role, set()) and (day + dt.timedelta(days=1)).isoformat() in fx.get(role, set()):
            out.append(f"{fam}: {role} {tk}={day} is a night planning followed by the fixture day {day + dt.timedelta(days=1)} "
                       f"(fixture-day protection, N-W-3)")
        key = (fam, role, tk)
        if key in G.needs_day:
            if ds in nights.get(role, set()):
                out.append(f"{fam}: {role} {tk}={day} is a night planning; {G.needs_day[key]} needs a day planning")
            if ds in planless.get(role, set()):
                out.append(f"{fam}: {role} {tk}={day} has no planning; {G.needs_day[key]} needs a day planning")
        if key in G.needs_plan and ds in planless.get(role, set()):
            out.append(f"{fam}: {role} {tk}={day} has no planning; {G.needs_plan[key]} needs one")
        if key in G.needs_none:
            if role in planless and ds not in planless[role]:
                out.append(f"{fam}: {role} {tk}={day} is planned; {G.needs_none[key]} needs a planning-less day")
            if ds in carry.get(role, set()):
                out.append(f"{fam}: {role} {tk}={day} carries a night's out-stamp; {G.needs_none[key]} needs a day without stamps")
    return out


def brief_scenarios(fam, fb, cfg, G):
    ids = list(G.fam.get(fam, {}).get("scenarios", []))
    for line in fb.splitlines():
        if line.startswith("| Scenarios"):
            ids += G.scen_id.findall(line)
    ids += fam_cfg(cfg, fam).get("scenarios", [])
    return ids


def day_map(t, R, fam, cfg, G):
    rows = ["| Token | Date | Day | Offset from R |", "|---|---|---|---|"]
    if emp_days(cfg, fam, R, G):
        rows = ["Rows \"<role> <token>\" are per-employee days of this family; the brief's employee lines already carry them.", ""] + rows
    keys = G.dr.get("day_map_keys") or (["R", "TODAY"] + [k for k in G.day_tokens if k != "TODAY"])
    for k in keys:
        if k in t:
            x = d(t[k])
            rows.append(f"| {k} | {t[k]} | {DE[x.weekday()]} | R{(x - R).days:+d} |".replace("R+0", "R"))
    for role, m in emp_days(cfg, fam, R, G).items():
        for k, v in m.items():
            x = d(v)
            rows.append(f"| {role_label(cfg, role)} {k} | {v} | {DE[x.weekday()]} | R{(x - R).days:+d} |".replace("R+0", "R"))
    off = cfg.get("oldest_offset", G.dr.get("oldest_offset", 6))
    rows.append(f"| oldest UI-writable day | {R - dt.timedelta(days=off)} | | R−{off} |")
    return "\n".join(rows)


def header(cfg, fam, t, R, warns, notes, G, solo, part=None):
    model = cfg.get("worker_model", "sonnet")
    title = fam if not part else f"{fam} part {part}"
    run_title = t.get("RUN_TITLE", f"Cloud E2E {G.key}")
    dev = t.get("DEVIATIONS_HINT", f"`{G.dir}/{G.g.get('known_deviations', 'references/known-deviations.md')}`")
    dsr = t.get("DATE_SHIFT_RULE", "the common hard rule \"Date shift\"")
    rd = t["RUN_DIR"]
    h = [f"# {run_title} run {cfg['run']} — family {title} — worker prompt (environment under test {cfg['tenant']}, bundle {cfg['bundle']} / {cfg['bundle_class']}, worker model {model})",
         "",
         "## Run guardrails (they override anything below)",
         f"- **Environment under test: `{cfg['tenant']}` ONLY**" + ("" if t["COMPARE_TENANT"] == "none" else f"; compare environment `{t['COMPARE_TENANT']}` only for the overlay") + ". Never touch any other tenant.",
         "- **Never run kubectl** (or helm, or any cluster tool). **No git** at all.",
         "- **Never print, cat, grep, copy or persist credentials** (DeployMate credential / test-data files, tokens, passwords, connect strings): the scripts read them.",
         "- **Permission classifier denials**: do not work around a refused command; put it into `blockers` and continue.",
         f"- Run date **{R.isoformat()} ({DE[R.weekday()]})**, Europe/Zurich; the day map below is authoritative where anything disagrees; {dsr} applies if the date is later when you write.",
         f"- Bundle `{cfg['bundle']}`, class `{cfg['bundle_class']}`: judge every mismatch against {dev}.",
         f"- PEP lock: `{t['PEP_LOCK_DOC']}` (coordination {t['COORD_MODE']}). Evidence `{rd}/{fam}/<scenario-id>/`, scripts `{rd}/scripts/{fam}-*.mjs`, profiles `{rd}/.profiles/{fam}`, created objects `{rd}/created/{fam}.jsonl`."]
    if not solo:
        h.append(f"- **Multi-group run**: group `{G.key}`, runner `{t['RUNNER']}`, env `{t['ENV']}` (role {t['ENV_ROLE']}), dashboard {t['DASHBOARD_URL']}. "
                 f"Windows of this family: {t['WINDOWS']}. Your runner writes the dashboard rows; you write only the PEP lock.")
    if part:
        other = [p for p in G.parts[fam] if p != part]
        h.append(f"- **You run PART {part} of family {fam} only** (section \"Part {part}\" of the family brief). "
                 + ("Report every part-2 item with verdict `PENDING` (family brief \"PENDING convention\")."
                    if part == "1" else f"Read your part-{other[0]} report / evidence first; report the final verdicts of the part-2 items."))
    h += ["", f"## Day map — family {fam}", day_map(t, R, fam, cfg, G)]
    if notes:
        h += ["", "## Day-map notes (generated)"] + [f"- {n}" for n in notes]
    if cfg.get("common_notes"):
        h += ["", cfg["common_notes"].strip()]
    if cfg.get("family_notes", {}).get(fam):
        h += ["", cfg["family_notes"][fam].strip()]
    if warns:
        h += ["", "## Day-rule warnings (generated; the orchestrator accepted them with --allow-violations — stop and report a blocker before writing on such a day)"] + [f"- {w}" for w in warns]
    return "\n".join(h) + "\n"


def subst(text, t, fam, unknown=None):
    def f(m):
        k = m.group(1)
        if k not in t:
            if unknown is not None:
                unknown.add(k)
                return m.group(0)
            sys.exit(f"[{fam}] unknown placeholder {{{{{k}}}}} (add it to the config)")
        return t[k]
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", f, text)


def common_part(G, solo):
    core = (SKILL / "assets/agent-brief.md").read_text().split("\n---\n", 1)[1]
    add = ""
    if ADD_BEGIN in core and ADD_END in core:
        pre, rest = core.split(ADD_BEGIN, 1)
        add, post = rest.split(ADD_END, 1)
        core_all = pre + add + post
    else:
        core_all = core
    if G.standalone:
        if solo:
            return G.gb_worker
        # multi-group: the group's own brief + the generic hard rules + the multi-group addendum
        rules = ""
        if "\n## Hard rules\n" in core:
            rules = core.split("\n## Hard rules\n", 1)[1].split("\n## ", 1)[0].strip("\n")
            rules = "## Cloud E2E hard rules (in addition to the rules above; on a conflict the stricter one wins)\n\n" + rules
        return G.gb_worker.rstrip("\n") + "\n\n" + (rules + "\n\n" if rules else "") + add.strip("\n") + "\n"
    return core_all.replace("{{GROUP_BRIEF}}", G.gb_worker.strip("\n"))


# ---------------------------------------------------------------- claims
def load_claims(path):
    raw = jload(path)
    docs = {}
    if isinstance(raw, dict) and "documents" in raw:
        raw = raw["documents"]
    if isinstance(raw, dict):
        for k, v in raw.items():
            docs[k] = v if isinstance(v, dict) else {}
    else:
        for x in raw:
            k = x.get("doc_id") or x.get("id")
            docs[k] = x.get("data", x)
    return {k.split("/")[-1]: v for k, v in docs.items() if k}


def claim_check(cfg, G, claims):
    env, bad = cfg["tenant"], []
    for role, e in cfg["employees"].items():
        kind = G.role_kind.get(role, "emp")
        if kind in ("none", "borrowed", "shared"):
            continue
        need = []
        if "emp" in kind:
            need.append([f"{env}~emp-{e['id']}"])
        if "login" in kind:
            lg = str(e["login"])
            need.append([f"{env}~login-{lg}", f"{env}~login-{lg.removeprefix('dmseed-')}"])
        for alts in need:
            hit = next((claims[a] for a in alts if a in claims), None)
            if hit is None:
                bad.append(f"{role}: no claim {alts[0]} (R1 claims first)")
            elif hit.get("group") not in (None, G.key):
                bad.append(f"{role}: {alts[0]} is claimed by group {hit.get('group')}")
    return bad


def actor_day_check(cfg, G, R, fams):
    """Hard rule 5 exception: inside one group families may share actors on disjoint days, so two families of `fams` that can
    run at the same time must never write the same (actor, day). Returns (violations, notes); fewer than two lanes = nothing.
    Concurrent: entries in different `schedule.lanes` (an entry is a scenario id, a family id or `<family>-part<n>`; one lane
    runs its families one after the other). Outside the lanes (group schedule.md): `first` runs before them (never
    concurrent); a family with a `window` and no parts runs only inside it (swap X03, UTR P): concurrent with every family
    its windows do not pause; any other (after_fanout: swap F starts after B / D only; booking X25 part 1 runs before its
    window): concurrent with all. Writes = rules WRITES + per-employee overrides, dated as in the prompt (tokens_for); actor =
    the role's employee id or login in this config (two roles with one id or login are one person). A family that enters
    the lanes with only some of its parts (UTR C part 1) gives NOTEs, not violations: WRITES are per family."""
    sch = G.g.get("schedule") or {}
    lanes_raw = [x for x in (sch.get("lanes") or []) if isinstance(x, list)]
    if len(lanes_raw) < 2:
        return [], []
    owner = {s: f["id"] for f in G.g.get("families", []) for s in f.get("scenarios", [])}

    def fam_of(x):
        m = re.fullmatch(r"(.+)-part(\w+)", str(x))
        if str(x) in G.fam:
            return str(x), None
        if m and m.group(1) in G.fam:
            return m.group(1), m.group(2)
        return owner.get(x), None

    lane, parts_in = {}, {}
    for i, entries in enumerate(lanes_raw):
        for x in entries:
            f, p = fam_of(x)
            if f:
                lane.setdefault(f, set()).add(i)
                if p:
                    parts_in.setdefault(f, set()).add(p)
    partial = {f for f, ps in parts_in.items() if set(G.parts.get(f, [])) - ps}
    first = {fam_of(x)[0] for x in sch.get("first") or []} - set(lane)
    wins = all_windows()

    def own_windows(f):  # the windows an outside family runs only inside: its `window` / windows holding its scenarios
        if f in lane or G.parts.get(f):
            return []
        fd, sc = G.fam.get(f, {}), set(G.fam.get(f, {}).get("scenarios", []))
        return [w for w in wins if w["id"] == fd.get("window") or sc & set(w["scenarios"])]

    def pauses(w, f):
        me, sc = {G.key, f"{G.key}:*", f"{G.key}:{f}"}, set(G.fam.get(f, {}).get("scenarios", []))
        if w.get("class") == "HARD":
            return not (me & set(w["exempt"])) and not (sc & set(w["scenarios"]))
        return bool(me & set(w["pauses"]))

    def slot(f):
        if f in lane:
            return "lane" + ("s " if len(lane[f]) > 1 else " ") + ", ".join(str(i + 1) for i in sorted(lane[f]))
        ws = own_windows(f)
        return "first" if f in first else "outside the lanes" + (f" (window {', '.join(w['id'] for w in ws)})" if ws else "")

    def concurrent(fa, fb):
        if fa in lane and fb in lane:
            return any(i != j for i in lane[fa] for j in lane[fb])
        if fa in first or fb in first:
            return False
        return not (any(pauses(w, fb) for w in own_windows(fa)) or any(pauses(w, fa) for w in own_windows(fb)))

    def ident(role, e):
        keys = {f"role {role}"}
        for k in ("id", "login"):
            v = str(e.get(k, "")).strip()
            if v and v != "0" and "<" not in v:
                keys.add(f"{k} " + (v.lower().removeprefix("dmseed-") if k == "login" else v))
        return keys

    bad, notes, cache = [], [], {}

    def writes_of(f):
        if f in cache:
            return cache[f]
        cache[f] = out = []
        try:
            t, ed = tokens_for(cfg, f, R, G, False, []), emp_days(cfg, f, R, G)
        except (SystemExit, KeyError, ValueError, TypeError) as e:
            notes.append(f"actor-day: family {f}: day tokens not resolvable ({e}); its writes are not checked")
            return out
        wr, miss = G.writes.get(f, []), []
        ws = [(r, k, ed.get(r, {}).get(k, t.get(k))) for r, k in wr]
        ws += [(r, k, v) for r, m in ed.items() for k, v in m.items() if (r, k) not in wr]
        for role, tk, v in ws:
            e = cfg["employees"].get(role)
            try:
                day = d(str(v)).isoformat() if v is not None else None
            except ValueError:
                day = None
            if not isinstance(e, dict):
                miss.append(f"{role} (not in employees)")
            elif day is None:
                miss.append(f"{role} {tk} (no date)")
            else:
                out.append((role, tk, day, ident(role, e)))
        if miss:
            notes.append(f"actor-day: family {f}: cannot resolve {', '.join(dict.fromkeys(miss))}; those writes are not checked")
        return out

    def writes_any(f):
        try:
            return bool(G.writes.get(f) or emp_days(cfg, f, R, G))
        except (SystemExit, ValueError, TypeError):
            return True  # writes_of() reports it as a NOTE

    seen = set()
    cand = [f for f in dict.fromkeys(fams) if writes_any(f)]
    for i, fa in enumerate(cand):
        for fb in cand[i + 1:]:
            if fa == fb or not concurrent(fa, fb):
                continue
            for ra, ta, da, ia in writes_of(fa):
                for rb, tb, db, ib in writes_of(fb):
                    if da != db or not ia & ib or (fa, fb, ra, rb, da) in seen:
                        continue
                    seen.add((fa, fb, ra, rb, da))
                    who = role_label(cfg, ra) + ("" if ra == rb else f" = {role_label(cfg, rb)}")
                    msg = (f"families {fa} ({slot(fa)}) and {fb} ({slot(fb)}) can run at the same time and both write {who} "
                           f"on {da} ({fa}: {ra} {ta}; {fb}: {rb} {tb})")
                    if fa in partial or fb in partial:
                        p = fa if fa in partial else fb
                        notes.append(f"actor-day: {msg}; {p} enters the lanes only with part(s) {', '.join(sorted(parts_in[p]))} "
                                     f"and WRITES are per family: the part that writes this day must run outside the lanes")
                    else:
                        bad.append(msg + ": move one of them to another day (config days / per-employee override) or into one lane")
    return bad, notes


# ---------------------------------------------------------------- catalogue
def check_catalogue(path):
    cat = jload(path)
    owner, groups, bad, notes = {}, {}, [], []
    gd = SKILL / "groups"
    for p in sorted(gd.iterdir()) if gd.is_dir() else []:
        if not (p / "group.json").is_file():
            continue
        g = jload(p / "group.json")
        groups[p.name] = g
        for f in g.get("families", []):
            for s in f.get("scenarios", []):
                owner.setdefault(s, []).append(f"{p.name}:{f['id']}")
    expected = set(cat.get("groups", []))
    missing_groups = sorted(expected - set(groups))
    if missing_groups:
        bad.append(f"groups without a package: {', '.join(missing_groups)}")
    for row in cat.get("rows", []):
        sid, hits = row["id"], owner.get(row["id"], [])
        if row.get("merged_into"):
            if len(hits) > 1:
                bad.append(f"{sid} (merged into {row['merged_into']}) is in {', '.join(hits)}")
            elif hits:
                notes.append(f"{sid} is merged into {row['merged_into']} but still listed in {hits[0]}")
            continue
        if row.get("dropped"):
            if hits:
                bad.append(f"{sid} is dropped ({row['dropped']}) but listed in {', '.join(hits)}")
            continue
        if len(hits) != 1:
            bad.append(f"{sid} ({row.get('group')}) is in {len(hits)} families: {', '.join(hits) or 'none'}")
        elif hits[0].split(":")[0] != row.get("group"):
            bad.append(f"{sid}: catalogue group {row.get('group')}, package {hits[0]}")
    ids = {r["id"] for r in cat.get("rows", [])}
    for s, hits in sorted(owner.items()):
        if len(hits) > 1:
            bad.append(f"{s} is in several families: {', '.join(hits)}")
        if s not in ids and not hits[0].startswith("utr:"):
            notes.append(f"{s} ({hits[0]}) is not in the catalogue")
    if "utr" in groups:
        fams = {f["id"] for f in groups["utr"].get("families", [])}
        for uf in cat.get("utr_families", []):
            if uf["family"] not in fams:
                bad.append(f"utr family {uf['family']} missing in groups/utr/group.json")
        sj = gd / "utr/assets/scenarios.json"
        if sj.is_file():
            uids = {r["id"] for r in json.loads(sj.read_text())}
            want = sum(int(uf.get("count", 0)) for uf in cat.get("utr_families", []))
            listed = {s for s, h in owner.items() if h[0].startswith("utr:")}
            if uids - listed:
                bad.append(f"utr scenarios in no family: {', '.join(sorted(uids - listed))}")
            if want and len(uids) != want:
                bad.append(f"utr: {len(uids)} scenarios in scenarios.json, catalogue says {want}")
    for w in bad:
        print("CATALOGUE:", w, file=sys.stderr)
    for n in notes:
        print("NOTE:", n, file=sys.stderr)
    n_rows = len(cat.get("rows", []))
    print(f"catalogue: {n_rows} rows + {len(cat.get('utr_families', []))} utr families checked against {len(groups)} packages: "
          f"{'OK' if not bad else str(len(bad)) + ' violation(s)'}")
    return 1 if bad else 0


# ---------------------------------------------------------------- main
def dry_config(G):
    today = dt.date.today().isoformat()
    return {"run": "dry-run", "run_dir": "/nonexistent/cloud-e2e-dry-run/results/dry-run", "tenant": "dry-run-env",
            "bundle": "0.0.0", "bundle_class": "1801", "run_date": today,
            "employees": {r: {"login": f"dryrun-{r.lower()}", "id": 0} for r in G.roles}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config", nargs="?"); ap.add_argument("--group"); ap.add_argument("--solo", action="store_true")
    ap.add_argument("--claims"); ap.add_argument("--run-date"); ap.add_argument("--out"); ap.add_argument("--families")
    ap.add_argument("--allow-violations", action="store_true"); ap.add_argument("--print-day-map", action="store_true")
    ap.add_argument("--dry-run", action="store_true"); ap.add_argument("--check-catalogue", metavar="CATALOGUE_JSON")
    a = ap.parse_args()
    if a.check_catalogue:
        sys.exit(check_catalogue(a.check_catalogue))
    if not a.config and not a.dry_run:
        ap.error("a run config is required (or --dry-run / --check-catalogue)")
    cfg = jload(a.config) if a.config else None
    G = Group(a.group or (cfg or {}).get("group") or "utr")
    errs, vnotes = validate(G)
    for e in errs:
        print("SCHEMA:", e, file=sys.stderr)
    for n in vnotes:
        print("NOTE:", n, file=sys.stderr)
    synthetic = cfg is None
    if synthetic:
        cfg = dry_config(G)
    # v0.5.0 command line (`gen-prompts.py <config>`: no --group, no config.group / config.mode) = UTR solo, unchanged paths
    solo = a.solo or cfg.get("mode") == "solo" or (not synthetic and not a.group and "group" not in cfg and "mode" not in cfg)
    R = d(a.run_date or cfg["run_date"])
    fl = cfg.get("families")
    fams = a.families.split(",") if a.families else (fl if isinstance(fl, list) else cfg.get("generate", G.generatable))
    for fam in fams:
        if fam not in G.generatable:
            sys.exit(f"unknown family {fam} for group {G.key} (generatable: {', '.join(G.generatable)}; families without a brief or "
                     f"without scenarios, e.g. RE and X, are written by the runner)")
    if errs and not a.allow_violations:
        sys.exit(1)
    if a.claims:
        cb = claim_check(cfg, G, load_claims(a.claims))
        for w in cb:
            print("CLAIMS:", w, file=sys.stderr)
        if cb:
            sys.exit("refused: actors not claimed by this group (skill-design 5.3); claim them (R1) and export claims.json again")
    # hard rule 5 exception: concurrent families never write the same (actor, day); solo (v0.5.0 UTR) and synthetic skip it
    ad_bad, ad_notes = ([], []) if synthetic or solo else actor_day_check(cfg, G, R, fams)
    for w in ad_bad:
        print("ACTOR-DAY:", w, file=sys.stderr)
    for n in ad_notes:
        print("NOTE:", n, file=sys.stderr)
    if ad_bad and not a.dry_run:
        sys.exit("refused: concurrent families write the same (actor, day) (SKILL.md hard rule 5); change the days or the lanes")
    rd = run_dir_of(cfg, G, solo)
    outdir = pathlib.Path(a.out or f"{rd}/prompts")
    if not a.dry_run:
        outdir.mkdir(parents=True, exist_ok=True)
    bad = 0; summary = []
    run_bad, notes = ([], []) if synthetic else run_checks(cfg, R, fams, G)
    for w in run_bad:
        print("DAY RULE:", w, file=sys.stderr)
    for n in notes:
        print("NOTE:", n, file=sys.stderr)
    briefs, owner = {}, {}
    for fam in fams:
        briefs[fam] = G.brief(fam)
        for sid in brief_scenarios(fam, briefs[fam], cfg, G):
            owner.setdefault(sid, set()).add(fam)
    own_bad = [f"scenario {sid} is handed to families {', '.join(sorted(f))} (one owner only; G-orch-8)"
               for sid, f in sorted(owner.items()) if len(f) > 1]
    for w in own_bad:
        print("OWNERSHIP:", w, file=sys.stderr)
    sj = G.dir / "assets/scenarios.json"
    if set(fams) == set(G.generatable) and sj.is_file():
        rows = json.loads(sj.read_text())
        known = {s["id"] for s in (rows if isinstance(rows, list) else rows.get("rows", []))}
        covered = set(owner) | {s[:-1] for s in owner if s[-1] in "ab"}
        runner_owned = {s for f in G.g.get("families", []) if f["id"] not in G.generatable for s in f.get("scenarios", [])}
        rest = sorted(known - covered - runner_owned)
        if rest:
            print("NOTE: scenarios in no family brief:", ", ".join(rest), file=sys.stderr)
    wins = all_windows()
    unknown_all = {}
    for fam in fams:
        t = tokens_for(cfg, fam, R, G, solo, wins)
        fb = briefs[fam]
        warns = run_bad + own_bad + ([] if synthetic else check(cfg, fam, t, R, G))
        for role, m in emp_days(cfg, fam, R, G).items():
            for tk in m:
                if "{{" + f"{role}_{tk}" + "}}" not in fb:
                    warns.append(f"{fam}: per-employee override {role} {tk} is never used by the brief ({{{{{role}_{tk}}}}}): "
                                 f"the body would keep the family value")
        for w in warns[len(run_bad) + len(own_bad):]:
            print("DAY RULE:", w, file=sys.stderr)
        if warns and not a.allow_violations:
            bad = 1
            if not a.dry_run:
                continue
        body = common_part(G, solo) + "\n\n---\n\n" + fb
        for name, path in cfg.get("files", {}).items():
            body = body.replace("`{{RUN_DIR}}/" + name + "`", f"`{path}`").replace("`" + name + "`", f"`{path}`")
        unknown = set() if synthetic or a.dry_run else None
        filled = subst(body, t, fam, unknown)
        for part in G.parts.get(fam, [None]):
            out = header(cfg, fam, t, R, warns, notes, G, solo, part) + "\n---\n" + filled
            if unknown:
                unknown_all.setdefault(fam, set()).update(unknown)
            elif "{{" in out:
                sys.exit(f"[{fam}] leftover '{{{{' in the prompt")
            name = f"{fam}.md" if not part else f"{fam}-part{part}.md"
            if not a.dry_run:
                (outdir / name).write_text(out)
            summary.append(f"{name[:-3]} {len(out)}")
        if a.print_day_map:
            print(f"## {fam}\n" + day_map(t, R, fam, cfg, G))
    for fam, u in unknown_all.items():
        docs = [f"{k}" + (f" ({G.ph_docs[k]})" if G.ph_docs.get(k) else "") for k in sorted(u)]
        print(f"NEEDS CONFIG [{fam}]: " + ", ".join(docs), file=sys.stderr)
    if a.dry_run:
        layout = "standalone" if G.standalone else "slot"
        print(f"dry-run {G.key} ({layout} layout, {'solo' if solo else 'multi-group'}): {', '.join(summary) or 'nothing'}; "
              f"schema {'OK' if not errs else str(len(errs)) + ' error(s)'}; ownership {'OK' if not own_bad else 'violations'}"
              + ("" if synthetic or solo else f"; actor-day {'OK' if not ad_bad else str(len(ad_bad)) + ' violation(s)'}")
              + ("; synthetic config (day rules skipped)" if synthetic else ""))
        sys.exit(1 if errs or own_bad or ad_bad or (bad and not synthetic) else 0)
    print("written:", ", ".join(summary) or "nothing", "->", outdir)
    sys.exit(bad)


if __name__ == "__main__":
    main()
