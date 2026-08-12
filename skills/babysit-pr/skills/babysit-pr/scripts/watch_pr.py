#!/usr/bin/env python3
"""Poll an Azure DevOps PR for new comments, CI changes, votes, and pushes.

Emits one line per change on stdout (designed as an event source for a
background monitor). Exits when the watch window elapses or the PR is
completed/abandoned. Requires: az CLI with the azure-devops extension, logged in.

Usage:
  python3 -u watch_pr.py --org https://dev.azure.com/polypoint --project SaaS \
      --repo SaaS --pr 12345 --minutes 60 --state-file /path/to/state.json
"""
import argparse
import json
import re
import subprocess
import time

VOTE_LABELS = {10: 'approved', 5: 'approved with suggestions', 0: 'no vote', -5: 'waiting for author', -10: 'rejected'}


def az(args):
    r = subprocess.run(['az'] + args, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or '').strip()[:300])
    return json.loads(r.stdout)


def snippet(text, n=220):
    text = re.sub(r'<!--.*?-->', '', text or '', flags=re.S)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:n]


def poll(opts, state):
    events = []

    threads_raw = az(['devops', 'invoke', '--area', 'git', '--resource', 'pullRequestThreads',
                      '--route-parameters', f'project={opts.project}', f'repositoryId={opts.repo}',
                      f'pullRequestId={opts.pr}', '--organization', opts.org, '--api-version', '7.1', '-o', 'json'])
    new_threads = {}
    for t in threads_raw.get('value', []):
        if t.get('isDeleted'):
            continue
        comments = [c for c in t.get('comments', []) if not c.get('isDeleted')]
        if not comments:
            continue
        tid = str(t['id'])
        status = t.get('status')
        new_threads[tid] = {'status': status, 'count': len(comments)}
        ctx = t.get('threadContext') or {}
        loc = f"{ctx.get('filePath', '')}:{(ctx.get('rightFileStart') or {}).get('line', '')}"
        prev = state['threads'].get(tid)
        if prev is None:
            author = (comments[0].get('author') or {}).get('displayName', '?')
            events.append(f"NEW THREAD {tid} [{status}] {loc} by {author}: {snippet(comments[0].get('content'))}")
        else:
            if prev['count'] != len(comments):
                last = comments[-1]
                author = (last.get('author') or {}).get('displayName', '?')
                events.append(
                    f"THREAD {tid} comments {prev['count']}->{len(comments)} [{status}] {loc} "
                    f"latest by {author}: {snippet(last.get('content'))}")
            if prev['status'] != status:
                events.append(f"THREAD {tid} status {prev['status']}->{status} {loc}")
    state['threads'] = new_threads

    policies_raw = az(['repos', 'pr', 'policy', 'list', '--id', str(opts.pr), '--organization', opts.org, '-o', 'json'])
    new_policies = {}
    for p in policies_raw:
        cfg = p.get('configuration') or {}
        name = (cfg.get('type') or {}).get('displayName') or '?'
        build = (p.get('context') or {}).get('buildDefinitionName') or ''
        key = f'{name}/{build}' if build else name
        st = p.get('status')
        new_policies[key] = st
        if state['policies'].get(key) != st:
            events.append(f"CI policy '{key}' {state['policies'].get(key) or 'new'}->{st}")
    state['policies'] = new_policies

    statuses_raw = az(['devops', 'invoke', '--area', 'git', '--resource', 'pullRequestStatuses',
                       '--route-parameters', f'project={opts.project}', f'repositoryId={opts.repo}',
                       f'pullRequestId={opts.pr}', '--organization', opts.org, '--api-version', '7.1', '-o', 'json'])
    # A context can have one entry per build iteration; only the latest (highest id) reflects
    # current truth — diffing every entry makes stale iterations flap the state each poll.
    latest = {}
    for s in statuses_raw.get('value', []):
        name = (s.get('context') or {}).get('name', '?')
        sid = s.get('id') or 0
        if name not in latest or sid > latest[name][0]:
            latest[name] = (sid, s.get('state'), s.get('description', ''))
    new_statuses = {}
    for name, (sid, st, desc) in latest.items():
        new_statuses[name] = st
        if state['statuses'].get(name) != st:
            events.append(f"CI status '{name}' {state['statuses'].get(name) or 'new'}->{st}: {desc}")
    state['statuses'] = new_statuses

    pr = az(['repos', 'pr', 'show', '--id', str(opts.pr), '--organization', opts.org, '-o', 'json'])
    pr_status = pr.get('status')
    if pr_status != state['pr_status']:
        events.append(f"PR status {state['pr_status']}->{pr_status}")
        state['pr_status'] = pr_status
    # ADO emits no thread/comment when the target branch advances into a conflict —
    # mergeStatus polling is the only way to notice (values: succeeded, conflicts, ...).
    merge_status = pr.get('mergeStatus')
    if merge_status != state.get('merge_status') and state.get('merge_status') is not None:
        events.append(f"MERGE STATUS {state.get('merge_status')}->{merge_status}")
    state['merge_status'] = merge_status
    is_draft = pr.get('isDraft')
    if is_draft != state.get('is_draft') and state.get('is_draft') is not None:
        events.append(f"DRAFT {state.get('is_draft')}->{is_draft}")
    state['is_draft'] = is_draft
    commit = (pr.get('lastMergeSourceCommit') or {}).get('commitId', '')
    if commit != state['commit']:
        events.append(f"NEW COMMIT on source branch: {commit[:12]}")
        state['commit'] = commit
    new_votes = {}
    for r in pr.get('reviewers', []):
        name = r.get('displayName', '?')
        vote = r.get('vote', 0)
        new_votes[name] = vote
        # First observation of a reviewer is not an event, but a reset back to 0
        # ("waiting for author" cleared, vote withdrawn) is — don't swallow it.
        if name in state['votes'] and state['votes'][name] != vote:
            events.append(f"VOTE {name} -> {VOTE_LABELS.get(vote, vote)}")
    state['votes'] = new_votes

    return events


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--org', required=True, help='https://dev.azure.com/<org>')
    ap.add_argument('--project', required=True)
    ap.add_argument('--repo', required=True, help='repository name or GUID')
    ap.add_argument('--pr', required=True, type=int)
    ap.add_argument('--minutes', type=float, default=60)
    ap.add_argument('--interval', type=int, default=60, help='poll interval in seconds')
    ap.add_argument('--state-file', required=True)
    opts = ap.parse_args()

    deadline = time.time() + opts.minutes * 60
    try:
        with open(opts.state_file) as f:
            state = json.load(f)
        # A foreign schema (e.g. a notes file written by someone else) would KeyError inside
        # poll() on every iteration and silently poison the whole watch — start fresh instead.
        if not isinstance(state, dict) or 'threads' not in state:
            raise ValueError('not a watcher state file')
    except (OSError, ValueError):
        state = {'threads': {}, 'policies': {}, 'statuses': {}, 'votes': {}, 'pr_status': 'active', 'commit': '',
                 'merge_status': None, 'is_draft': None}
        try:
            baseline = poll(opts, state)
            print(f"WATCH-BASELINE recorded: {len(state['threads'])} threads, "
                  f"policies {state['policies']}, PR {state['pr_status']} ({len(baseline)} initial events suppressed)",
                  flush=True)
        except Exception as exc:  # noqa: BLE001
            # A failed baseline leaves `state` half-mutated; continuing would replay every
            # pre-existing thread/policy as a fresh event on the first successful poll.
            print(f'WATCH-ERROR: baseline poll failed, watcher exiting — fix auth and re-arm: {exc}', flush=True)
            return

    failures = 0
    while time.time() < deadline:
        try:
            events = poll(opts, state)
            with open(opts.state_file, 'w') as f:
                json.dump(state, f, indent=2)
            if failures >= 3:
                print('WATCH-RECOVERED: polling works again', flush=True)
            failures = 0
            for e in events:
                print(e, flush=True)
            if state['pr_status'] in ('completed', 'abandoned'):
                print(f"WATCH-DONE: PR is {state['pr_status']}, stopping watch", flush=True)
                return
        except Exception as exc:  # noqa: BLE001 - keep the watch alive on transient az failures
            failures += 1
            if failures % 3 == 0:
                print(f'WATCH-ERROR: {failures} consecutive poll failures, last: {exc}', flush=True)
        time.sleep(opts.interval)
    print(f'WATCH-DONE: {opts.minutes:g}-minute watch window elapsed', flush=True)


if __name__ == '__main__':
    main()
