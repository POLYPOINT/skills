#!/usr/bin/env python3
"""diff-fixtures.py <dirA> <dirB> [out.md] [--labels=A,B] [--maxval=140] [--maxdiffs=60]

Compare two fixture folders written by scripts/harness/mypp.mjs + baseline.mjs
(<dir>/<login>/api/NNN-METHOD-path.json, each {meta, body}) — e.g. the G5 cloud fixtures of the environment under test
before and after a change (`--labels=before,after`; options need the `=` form), or of the baseline and the candidate bundle with `--compare`
(`--labels=baseline,candidate`):
    python3 -I scripts/diff-fixtures.py results/<run>/fixtures/<tenant-a> results/<run>/fixtures/<tenant-b> \
        results/<run>/fixtures/diff.md --labels=baseline,candidate
Two single harness outdirs (each containing api/) are compared directly (e.g. a scenario folder and its compare/ folder).
For every login present in either folder and every saved endpoint response, normalize and compare:
  - ids dropped (values of keys 'id' / '*_id' / '*Id' become '<id>'; null and 0 are kept, so a missing/zero id still shows)
  - timestamps / URLs / hrefs / icons / challenge files dropped
  - arrays sorted by date/start/time/type
Output: markdown, one section per login: "identical" or the differing paths with both values (compact).
Stdlib only.
"""
import json, os, re, sys, glob
from collections import defaultdict

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
if len(args) < 2:
    sys.exit(__doc__)
A, B = args[0], args[1]
OUT = args[2] if len(args) > 2 else None
LA, LB = (opts.get('labels') or 'A,B').split(',')
MAXV = int(opts.get('maxval', 140))
SKIP_FILE = re.compile(r'api_(login|consent)_|notifications|current-user_sync')
DROP_KEYS = {'ts', 'timestamp', 'url', 'href', 'hrefs', 'links', '_links', 'icon', 'lcdate', 'created_at', 'updated_at', 'last_modified'}
ID_KEY = re.compile(r'(^id$|_id$|Id$|^ids?$)')
SORT_KEYS = ('date', 'day', 'start', 'time', 'from', 'type', 'description', 'name', 'key', 'code')

def endpoint_key(fname):
    k = re.sub(r'^\d+-', '', fname)
    k = re.sub(r'\.json$', '', k)
    return k

def load_dir(d):
    res = {}
    if not os.path.isdir(os.path.join(d, 'api')):
        return res
    seen = defaultdict(int)
    for f in sorted(os.listdir(os.path.join(d, 'api'))):
        if not f.endswith('.json') or SKIP_FILE.search(f):
            continue
        k = endpoint_key(f); seen[k] += 1
        if seen[k] > 1:
            k = f'{k}#{seen[k]}'
        try:
            j = json.load(open(os.path.join(d, 'api', f)))
        except Exception as e:
            j = {'meta': {}, 'body': f'<unreadable {e}>'}
        res[k] = {'status': (j.get('meta') or {}).get('status'), 'body': j.get('body'), 'file': f}
    return res

def norm(o, key=None):
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            if k.lower() in DROP_KEYS:
                continue
            if ID_KEY.search(k) and not isinstance(v, (dict, list)):
                out[k] = v if v in (None, 0, '0', '') else '<id>'
            else:
                out[k] = norm(v, k)
        return out
    if isinstance(o, list):
        items = [norm(v, key) for v in o]
        def sk(v):
            if isinstance(v, dict):
                return tuple(str(v.get(k, '')) for k in SORT_KEYS) + (json.dumps(v, sort_keys=True),)
            return ('', json.dumps(v, sort_keys=True))
        return sorted(items, key=sk)
    if isinstance(o, str) and re.match(r'^https?://', o):
        return '<url>'
    return o

def label(v, i):
    if isinstance(v, dict):
        for k in ('date', 'day', 'start', 'time', 'description', 'type', 'key', 'name'):
            if k in v and isinstance(v[k], (str, int)):
                return f'[{k}={v[k]}]'
    return f'[{i}]'

def short(v):
    s = json.dumps(v, ensure_ascii=False, sort_keys=True)
    return s if len(s) <= MAXV else s[:MAXV - 1] + '…'

def diff(a, b, path, out):
    if type(a) != type(b):
        out.append((path, a, b)); return
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a: out.append((f'{path}.{k}', '<absent>', b[k]))
            elif k not in b: out.append((f'{path}.{k}', a[k], '<absent>'))
            else: diff(a[k], b[k], f'{path}.{k}', out)
    elif isinstance(a, list):
        la = {}
        for i, v in enumerate(a): la.setdefault(label(v, i), []).append(v)
        lb = {}
        for i, v in enumerate(b): lb.setdefault(label(v, i), []).append(v)
        if len(la) == len(a) and len(lb) == len(b):  # unique labels: match by label
            for k in list(dict.fromkeys(list(la) + list(lb))):
                if k not in la: out.append((f'{path}{k}', '<absent>', lb[k][0]))
                elif k not in lb: out.append((f'{path}{k}', la[k][0], '<absent>'))
                else: diff(la[k][0], lb[k][0], f'{path}{k}', out)
        else:
            if len(a) != len(b):
                out.append((f'{path}.length', len(a), len(b)))
            for i, (x, y) in enumerate(zip(a, b)):
                diff(x, y, f'{path}{label(x, i)}', out)
            for i in range(len(b), len(a)): out.append((f'{path}{label(a[i], i)}', a[i], '<absent>'))
            for i in range(len(a), len(b)): out.append((f'{path}{label(b[i], i)}', '<absent>', b[i]))
    elif a != b:
        out.append((path, a, b))

if os.path.isdir(os.path.join(A, 'api')) and os.path.isdir(os.path.join(B, 'api')):
    logins = ['.']  # two single harness outdirs (each with api/): compare them directly
else:
    logins = sorted({os.path.basename(p) for d in (A, B) for p in glob.glob(os.path.join(d, '*')) if os.path.isdir(os.path.join(p, 'api'))})
lines = [f'# Fixture diff {LA} vs {LB}', '', f'- {LA}: `{A}`', f'- {LB}: `{B}`',
         '- Normalized: ids -> `<id>` (null/0 kept), timestamps/URLs/icons dropped, arrays sorted by date/start/time; login/consent/notification/sync calls skipped.', '']
summary = []
for login in logins:
    ea, eb = load_dir(os.path.join(A, login)), load_dir(os.path.join(B, login))
    sect, ndiff = [], 0
    for k in sorted(set(ea) | set(eb)):
        if k not in ea: sect.append(f'- `{k}`: only in {LB} (status {eb[k]["status"]})'); ndiff += 1; continue
        if k not in eb: sect.append(f'- `{k}`: only in {LA} (status {ea[k]["status"]})'); ndiff += 1; continue
        ra, rb = ea[k], eb[k]
        d = []
        if ra['status'] != rb['status']:
            d.append(('status', ra['status'], rb['status']))
        diff(norm(ra['body']), norm(rb['body']), '$', d)
        if d:
            ndiff += 1
            sect.append(f'- `{k}` ({len(d)} differences)')
            for p, x, y in d[:int(opts.get('maxdiffs', 60))]:
                sect.append(f'  - `{p}`: {LA} {short(x)} | {LB} {short(y)}')
            if len(d) > int(opts.get('maxdiffs', 60)):
                sect.append(f'  - … {len(d) - int(opts.get("maxdiffs", 60))} more')
    summary.append(f'| {login} | {len(ea)} | {len(eb)} | {"identical" if not ndiff else f"{ndiff} endpoint(s) differ"} |')
    lines += [f'## {login}', ''] + (['identical'] if not ndiff else sect) + ['']
lines[6:6] = ['| login | endpoints ' + LA + ' | endpoints ' + LB + ' | result |', '|---|---|---|---|', *summary, '']
md = '\n'.join(lines)
if OUT:
    open(OUT, 'w').write(md)
print(md)
