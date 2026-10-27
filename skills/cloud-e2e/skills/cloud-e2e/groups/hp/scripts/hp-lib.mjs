// hp-lib.mjs — group hp helpers for worker scripts run by scripts/harness/app.mjs --app mypp.
//   import { HP, tokenClaim, notificationBodies, sendNotifications, ncPage, ncAll, rawKeys, waitNoSpinner, maskAudit,
//            createOwnSwap } from '<GROUP_DIR>/scripts/hp-lib.mjs'
// Shapes follow cloud master 89d7e960e0: poma-public v2 ApiNotificationRequestV2 (POST /api/v2/notification), myPP
// notification-api / shift-swap-api services. No credentials: the bearer is the page's; tokenClaim returns ONE claim value
// and never writes the token anywhere. Never call GAT, a test-data endpoint or a POMA job from these scripts.

export const HP = '/api/mobile/health-professional/v1';
const q = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
const ok = (r) => r && r.status >= 200 && r.status < 300;

// one claim of the captured access token, decoded in memory (e.g. 'tenant_subject'); returns null when absent
export function tokenClaim(api, name) {
  const raw = String(api.token ? api.token() || '' : '').replace(/^Bearer\s+/i, '');
  const part = raw.split('.')[1];
  if (!part) return null;
  try {
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return json[name] ?? null;
  } catch { return null; }
}

// HPN-08 recipe: 26 rows that are saved in the notification center + 1 probe of a resource that "does not support notification
// center save" (expectNc false). Every text starts with HPN-<run>-<n>; resource ids are unique per run except the thread.
export function notificationBodies({ run, tenant, subject }) {
  const t = (de, en) => ({ 'de-CH': de, 'en-US': en });
  const out = [];
  let n = 0;
  const add = (resource, target, { state = 'OPEN', rid, content, expectNc = true, key } = {}) => {
    n += 1;
    const id = rid || `hpn-${run}-${n}`;
    out.push({ n, key: key || `${resource}-${target}`, expectNc, body: {
      tenant_id: tenant, recipients_tenant_subject: [subject], resource_id: id, navigation_target: target, state,
      notification_type: { resource, action: 'CREATE' },
      notification_data: { title: t(`HPN-${run}-${n} Titel`, `HPN-${run}-${n} title`), content: t(content || `HPN-${run}-${n} Inhalt`, `HPN-${run}-${n} content`), type_title: t('E2E Test', 'E2E test') },
    } });
  };
  const thread = `hpn-${run}-thread`;
  add('SHIFT_TRADE', 'NOTIFICATION_CENTER', { rid: thread, state: 'OPEN', key: 'thread-1' });          // (a) thread of 3
  add('SHIFT_TRADE', 'NOTIFICATION_CENTER', { rid: thread, state: 'CONFIRMED', key: 'thread-2' });
  add('SHIFT_TRADE', 'NOTIFICATION_CENTER', { rid: thread, state: 'CLOSED', key: 'thread-3' });
  for (const r of ['BOOKING', 'RESOURCE_REPLACEMENT', 'INTERNAL_POOLS_OPPORTUNITY', 'SCHEDULING_REQUEST', 'POOL_USER_ADDITION', 'POOL_USER_REMOVAL', 'AVAILABILITY']) add(r, 'NOTIFICATION_CENTER', { key: `type-${r}` }); // (b)
  add('AVAILABILITY', 'WEEK_VIEW', { key: 'target-WEEK_VIEW' });                                         // (c) targets
  add('AVAILABILITY', 'DEFAULT_VIEW', { key: 'target-DEFAULT_VIEW' });
  add('SCHEDULING_REQUEST_V2', 'SCHEDULING_REQUEST_V2_DETAIL', { key: 'target-SR_V2_DETAIL' });
  add('AVAILABILITY', 'CACHE_MANAGEMENT', { key: 'target-CACHE_MANAGEMENT' });
  add('BOOKING', 'NOTIFICATION_CENTER', { state: 'DELETED', key: 'deleted' });                            // (d)
  add('AVAILABILITY', 'NOTIFICATION_CENTER', { content: '<b>fett</b><img src="x" alt="hpn-probe">', key: 'probe' }); // (e)
  for (let i = 0; i < 10; i++) add('AVAILABILITY', 'NOTIFICATION_CENTER', { key: `filler-${i + 1}` });      // (f) → 26 saved rows
  add('NOTIFICATION_API_REQUEST', 'NOTIFICATION_CENTER', { expectNc: false, key: 'api-request-probe' });  // (g) not saved by design
  return out;
}

// sends the bodies ≥ gapMs apart; returns [{n, key, status, body}] (bodies saved by the harness under api/)
export async function sendNotifications(api, items, gapMs = 250) {
  const res = [];
  for (const it of items) {
    const r = await api.call('POST', '/api/v2/notification', it.body);
    res.push({ n: it.n, key: it.key, expectNc: it.expectNc, status: r.status, body: r.body });
    await new Promise((s) => setTimeout(s, gapMs));
  }
  return res;
}

export async function ncPage(api, page = 0, { sort = 'DESC', size = 20, types } = {}) {
  return api.get(`${HP}/notifications?${q({ 'current-page': page, 'sort-direction': sort, 'page-size': size, 'notification-types': types })}`);
}
// all rows (≤ maxPages pages)
export async function ncAll(api, maxPages = 6) {
  const rows = [];
  for (let p = 0; p < maxPages; p++) {
    const r = await ncPage(api, p);
    const d = ok(r) ? (r.body?.data || []) : [];
    rows.push(...d);
    if (d.length < 20) break;
  }
  return rows;
}
export async function unread(api) { const r = await api.get(`${HP}/notifications/all-unread`); return ok(r) ? r.body?.number : null; }

// raw translation keys visible on the page (sweep oracle)
export async function rawKeys(page) {
  const txt = await page.evaluate(() => document.body ? document.body.innerText : '');
  return [...new Set((txt.match(/\b[A-Z][A-Z0-9_]+(\.[A-Z0-9_]+){1,}\b/g) || []))];
}
// waits until no visible pp-loading-spinner (max ms); returns true when the spinner is gone
export async function waitNoSpinner(page, ms = 10000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const n = await page.locator('pp-loading-spinner:visible').count().catch(() => 0);
    if (!n) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

// HPN-21: every visible text node containing one of `strings` must sit under .mouseflow-hidden (or inside input / textarea).
// Returns [{hash, path, cls, dataPrivate}] of unmasked occurrences; no clear text leaves the browser (hash + first letter).
export async function maskAudit(page, strings) {
  return page.evaluate((needles) => {
    const hits = [];
    const h = (s) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) | 0; return (x >>> 0).toString(16); };
    const pathOf = (el) => { const p = []; for (let e = el; e && e.nodeType === 1 && p.length < 6; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')); return p.join('>'); };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue || '';
      const el = node.parentElement;
      if (!el || !el.offsetParent) continue;
      for (const s of needles) {
        if (!s || s.length < 3 || !text.includes(s)) continue;
        if (el.closest('.mouseflow-hidden') || el.closest('input,textarea')) continue;
        hits.push({ hash: h(s), first: s[0], path: pathOf(el), cls: el.className || '', dataPrivate: !!el.closest('[data-private]') });
      }
    }
    return hits;
  }, strings);
}

// seed H2: own swap N5 → N5C on `day` through the swap API shortcut (myPP shift-swap-api.service.ts); call in N5's session.
// candidateEmploymentId = N5C's MITARBEITER_ID. Returns {status, oppId, detail, candidate}; never picks another candidate.
export async function createOwnSwap(api, day, candidateEmploymentId) {
  const roster = await api.get(`${HP}/calendar/roster?${q({ from: day, to: day })}`);
  const ps = (roster.body?.days?.[0]?.planned_shifts || []).find((s) => s.available_for_shift_trade !== false && s.shift_kind !== 'ON_CALL');
  if (!ps) return { status: 0, error: `no swappable planning of the owner on ${day}` };
  const detail = (await api.get(`${HP}/calendar/planned-shift-detail?${q({ 'shift-planning-id': ps.shift_planning_id, 'roster-cell-id': ps.roster_cell_id })}`)).body;
  const c = await api.call('POST', `${HP}/calendar/shift-trade-candidates`, { shift_planning_id: ps.shift_planning_id, roster_cell_id: ps.roster_cell_id, target_node_ids: [], target_employment_ids: [] });
  const cand = (c.body?.candidates || []).find((x) => String(x.shift?.employment_id) === String(candidateEmploymentId) || String(x.target_employment) === String(candidateEmploymentId));
  if (!cand) return { status: c.status, error: 'candidate not offered', candidates: c.body };
  const before = new Set(((await api.get(`${HP}/shift-trades/open-shift-trades`)).body?.shift_trades || []).map((s) => s.opportunity?.id));
  const r = await api.call('POST', `${HP}/shift-trades`, { shift: { shift: detail, message: 'HPN own swap', candidates: [cand] } });
  const after = ((await api.get(`${HP}/shift-trades/open-shift-trades`)).body?.shift_trades || []).map((s) => s.opportunity?.id);
  return { status: r.status, oppId: after.find((id) => id && !before.has(id)) || null, detail, candidate: cand };
}
