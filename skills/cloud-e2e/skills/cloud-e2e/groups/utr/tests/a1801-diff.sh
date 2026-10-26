#!/usr/bin/env bash
# a1801-diff.sh — acceptance check of the UTR migration (skill-design.md 8.1 / 9.5): the synthetic a1801 run config through the
# ORIGINAL utr-e2e v0.5.0 generator and through the cloud-e2e engine (--group utr --solo); the prompts may differ only in paths
# and the PEP-lock line. Offline: no environment, no network. Git is used read-only (git show of commit 7e1711a) to rebuild the
# v0.5.0 brief files when skills/utr-e2e no longer holds them.
#
#   groups/utr/tests/a1801-diff.sh            writes a1801-diff-raw.txt (paths normalised to <SKILL>/<GROUP>) and
#                                              a1801-diff-pathmapped.txt (moved paths mapped too) next to this script
# Exit 0 = the path-mapped diff contains only the two PEP-lock lines per prompt; 1 otherwise.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
skill=$(cd "$here/../../.." && pwd)                       # skills/cloud-e2e/skills/cloud-e2e
repo=$(cd "$skill/../../../.." && pwd)                    # repo root
old_rel=skills/utr-e2e/skills/utr-e2e
tmp=$(cd "$(mktemp -d "${TMPDIR:-/tmp}/a1801-diff.XXXXXX")" && pwd -P)
snap="$tmp/utr-e2e-v0.5.0"
mkdir -p "$snap/scripts" "$snap/assets/family-briefs"
cp "$here/gen-prompts-v0.5.0.py" "$snap/scripts/gen-prompts.py"
for f in assets/agent-brief.md assets/scenarios.json assets/family-briefs/{R,M,O,W,L,MO,P,C}.md; do
  if git -C "$repo" cat-file -e "7e1711a:$old_rel/$f" 2>/dev/null; then
    git -C "$repo" show "7e1711a:$old_rel/$f" > "$snap/$f"
  elif [ -f "$repo/$old_rel/$f" ]; then
    cp "$repo/$old_rel/$f" "$snap/$f"
  else
    echo "a1801-diff: cannot find v0.5.0 $f" >&2; exit 2
  fi
done
cfg="$here/a1801-run-config.json"
python3 -I "$snap/scripts/gen-prompts.py" "$cfg" --out "$tmp/old" >"$tmp/old.log" 2>&1 || { cat "$tmp/old.log"; exit 2; }
python3 -I "$skill/scripts/gen-prompts.py" "$cfg" --group utr --solo --out "$tmp/new" >"$tmp/new.log" 2>&1 || { cat "$tmp/new.log"; exit 2; }
cat "$tmp/old.log" "$tmp/new.log"
python3 -I - "$tmp" "$snap" "$skill" "$here" <<'PY'
import difflib, pathlib, re, sys
tmp, snap, skill, here = map(pathlib.Path, sys.argv[1:5])
group = skill / "groups/utr"
def norm_new(s):
    return s.replace(str(group), "<GROUP>").replace(str(skill), "<SKILL>")
def norm_old(s):
    return s.replace(str(snap), "<SKILL>")
MOVES = [  # old path (v0.5.0, relative to the skill) -> new path (cloud-e2e)
    (r"<SKILL>/references/scenarios\.md", "<GROUP>/references/scenarios.md"),
    (r"<SKILL>/scripts/harness/(utr-lib|days-check|api-probe|legacy-reads|ui-add-block|ui-stamp-crud|ui-edit-row|baseline)\.mjs", r"<GROUP>/scripts/harness/\1.mjs"),
    (r"<SKILL>/scripts/(oracle-day\.sh|diff-roster-cells\.py)", r"<GROUP>/scripts/\1"),
    (r"<SKILL>/scripts/seed/verify\.sql", "<GROUP>/scripts/seed/verify.sql"),
    (r"<SKILL>/scripts/seed/rights\.sql", "<SKILL>/scripts/seed/common/rights.sql"),
    (r"(?<![\w/>])scripts/harness/(utr-lib|ui-stamp-crud)\.mjs", r"<GROUP>/scripts/harness/\1.mjs"),
    (r"(?<![\w/>])scripts/pep/pe-(open|del-zs|reinterp|shots|newblock)\.sh", r"<GROUP>/scripts/pep/pe-\1.sh"),
    (r"the helpers `scripts/pep/pe-\{ready,open,del-zs,reinterp,shots\}\.sh`", "the helpers `<SKILL>/scripts/pep/pe-ready.sh`, `<GROUP>/scripts/pep/pe-{open,del-zs,reinterp,shots}.sh`"),
]
raw, mapped, bad = [], [], []
names = sorted(p.name for p in (tmp / "old").glob("*.md"))
assert names == sorted(p.name for p in (tmp / "new").glob("*.md")), "different prompt sets"
for n in names:
    o = norm_old((tmp / "old" / n).read_text()).splitlines()
    w = norm_new((tmp / "new" / n).read_text()).splitlines()
    raw += list(difflib.unified_diff(o, w, f"v0.5.0/{n}", f"cloud-e2e/{n}", n=0, lineterm=""))
    om = []
    for line in o:
        for a, b in MOVES:
            line = re.sub(a, b, line)
        om.append(line)
    d = list(difflib.unified_diff(om, w, f"v0.5.0/{n}", f"cloud-e2e/{n}", n=0, lineterm=""))
    mapped += d
    changed = [l for l in d if l[:1] in "+-" and not l.startswith(("+++", "---"))]
    for l in changed:
        if not (("PEP lock" in l) or ("**Lock**" in l)):
            bad.append(f"{n}: {l[:160]}")
    if len(changed) != 4:
        bad.append(f"{n}: {len(changed)} changed lines after path mapping (expected 4: header lock line + brief lock line, old and new)")
(here / "a1801-diff-raw.txt").write_text("\n".join(raw) + "\n")
(here / "a1801-diff-pathmapped.txt").write_text("\n".join(mapped) + "\n")
print(f"prompts compared: {len(names)} ({', '.join(names)})")
print(f"raw diff lines: {sum(1 for l in raw if l[:1] in '+-' and not l.startswith(('+++','---')))}; "
      f"after path mapping: {sum(1 for l in mapped if l[:1] in '+-' and not l.startswith(('+++','---')))}")
if bad:
    print("UNEXPECTED DIFFERENCES:"); print("\n".join(bad)); sys.exit(1)
print("OK: only paths and the PEP-lock lines differ")
PY
rc=$?
rm -rf "$tmp"
exit $rc
