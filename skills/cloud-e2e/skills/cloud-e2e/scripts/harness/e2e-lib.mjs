// Generic helpers for cloud-e2e worker scripts (run inside app.mjs, mypp.mjs, mypp-inapp.mjs, polyid-flow.mjs, portal-ops.mjs).
// Import from a worker script:   import { go, act, issueShot, jsonShot, roles, ncSince, ... } from '<skill>/scripts/harness/e2e-lib.mjs';
// The generic part of the UTR utr-lib.mjs (tour, leaveTutorial, go, act, save, stepper, alertText, dumpButtons, issueName,
// issueShot, jsonShot — same semantics; utr-lib.mjs re-exports or mirrors them) plus:
//   dialogText(page)                            text of the last visible Material dialog / snackbar (planner app, portal ops)
//   roles(api)                                  role names of the captured bearer (decoded in memory; only names are returned)
//   ncSince(api, iso, {type, objectId, path})   notification-center items created at/after iso, filtered by type / object id
//   waitFlag(api, code, value, maxMin, {path})  poll a FRESH config/features read until <code> has <value> (portal cache ≈ 3 min
//                                               + POMA reload 60 s); returns {ok, value, polls, minutes}
//   byId(json, path, id)                        the element of the array at a dotted path whose id (or *_id / *Id) equals id
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeJwt, roleNames } from './lib/util.mjs';

// "Willkommen bei myPOLYPOINT" tour / "Nicht jetzt" overlays
export async function tour(page) {
  for (let i = 0; i < 10; i++) {
    const t = page.getByText('Willkommen bei myPOLYPOINT').locator('visible=true');
    const nj = page.getByText(/^\s*Nicht jetzt\s*$/).locator('visible=true').first();
    if (!(await t.count()) && !(await nj.count())) return i;
    if (await nj.count()) await nj.click({ timeout: 2000 }).catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);
  }
  return -1;
}

// onboarding tutorial route (user-level, first login): page through with the last visible button
export async function leaveTutorial(page, log) {
  for (let k = 0; k < 12 && /tutorial/.test(page.url()); k++) {
    const nj = page.getByRole('button', { name: /nicht jetzt|not now|überspringen|skip/i }).locator('visible=true').first();
    if (await nj.count()) await nj.click().catch(() => {});
    else await page.locator('button:visible, ion-button:visible').last().click().catch(() => {});
    await page.waitForTimeout(1000);
  }
  if (log) log('after tutorial at', page.url());
}

// navigate (leaving the tutorial if it intercepts) and wait for one API response
export async function go(page, api, log, path, frag, timeout = 30000) {
  let r = await api.goto(path, frag, timeout);
  if (/tutorial/.test(page.url()) || (!r && frag)) { await leaveTutorial(page, log); r = await api.goto(path, frag, timeout); }
  return r;
}

export function save(out, name, obj) { writeFileSync(join(out, name), JSON.stringify(obj, null, 2)); }

export async function dumpButtons(page) {
  return page.locator('button:visible, ion-button:visible').evaluateAll((els) => els.map((e) => `${e.tagName}#${e.id} .${String(e.className).split(' ').slice(0, 3).join('.')} [${e.getAttribute('aria-label') || ''}] ${e.textContent.trim().slice(0, 40)}`));
}

// run a UI action and capture the first response of METHOD whose URL contains frag (request body included)
export async function act(page, method, frag, action, timeout = 45000) {
  const p = page.waitForResponse((r) => r.request().method() === method && r.url().includes(frag), { timeout }).catch(() => null);
  await action();
  const r = await p;
  if (!r) return null;
  let body = null; try { body = await r.json(); } catch { body = await r.text().catch(() => null); }
  const pd = r.request().postData();
  let requestBody = null; try { requestBody = pd ? JSON.parse(pd) : null; } catch { requestBody = pd; }
  return { status: r.status(), url: r.url(), method, requestBody, body };
}

// text of a visible error/info dialog, or null: the myPP Ionic modal / alert first (UTR semantics, same filter); when there is
// none, the last visible Angular Material dialog / snackbar (POMA planner app, portal ops)
export async function alertText(page) {
  const m = page.locator('ion-modal, ion-alert').filter({ hasText: /Weitere Informationen|Zeiterfassung|Fehler|nicht/ }).locator('visible=true');
  if (await m.count()) return (await m.last().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
  const mat = page.locator('mat-dialog-container, .mat-mdc-dialog-container, .mat-mdc-snack-bar-container, snack-bar-container').locator('visible=true');
  if (!(await mat.count())) return null;
  return (await mat.last().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
}

// text of the last visible dialog / snackbar of an Angular Material app (POMA planner, portal ops), or null
export async function dialogText(page) {
  const m = page.locator('mat-dialog-container, .mat-mdc-dialog-container, .mat-mdc-snack-bar-container, snack-bar-container, ion-modal, ion-alert').locator('visible=true');
  if (!(await m.count())) return null;
  return (await m.last().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
}

// a step logger that also keeps the steps for the script result
export function stepper(log) {
  const steps = [];
  const step = (name, o) => { steps.push({ name, ...o }); log(name, JSON.stringify(o).slice(0, 1200)); };
  return { steps, step };
}

// ---- Issue screenshots (every FAIL / KNOWN-FAIL / BLOCKED-by-error row carries at least one; agent-brief "Screenshots") ----
// issueShot: outline the element(s) that show the problem in red, scroll the first into view, save `<out>/ISSUE-<name>.png`,
// remove the outline again. `target` = a Playwright locator (or CSS selector string) of the WRONG value / the error dialog,
// or null (plain screenshot of the view). `name` without the "ISSUE-" prefix (a leading "ISSUE-" is stripped); an empty name
// or one with an undefined / null part throws. The myPP welcome tour / onboarding tutorial is dismissed first. Options:
// {fullPage, mask: [selectors]} (mask OTP / QR / secret elements). Returns the file path; open the PNG and check it shows the
// problem before listing it in `shots`.
export function issueName(name) {
  const n = String(name ?? '').trim().replace(/^(ISSUE-)+/i, '').replace(/\.png$/i, '');
  if (!n || n.split(/[-_.\s]+/).some((s) => ['undefined', 'null', 'nan'].includes(s.toLowerCase()))) {
    throw new Error(`issueShot: missing or undefined name (got ${JSON.stringify(name)})`);
  }
  return n;
}
export async function issueShot(page, out, name, target = null, { fullPage = false, mask = [] } = {}) {
  const n0 = issueName(name);
  if (/tutorial/.test(page.url())) await leaveTutorial(page);
  await tour(page);
  const loc = !target ? null : (typeof target === 'string' ? page.locator(target) : target);
  const n = loc ? await loc.count().catch(() => 0) : 0;
  if (n) {
    await loc.first().scrollIntoViewIfNeeded().catch(() => {});
    await loc.evaluateAll(els => els.forEach(e => { e.dataset.utrOutline = e.style.outline || ''; e.style.outline = '3px solid #d0021b'; e.style.outlineOffset = '2px'; })).catch(() => {});
  }
  const f = join(out, `ISSUE-${n0}.png`);
  const m = (mask || []).map((s) => (typeof s === 'string' ? page.locator(s) : s));
  await page.screenshot({ path: f, fullPage, ...(m.length ? { mask: m } : {}) });
  if (n) await loc.evaluateAll(els => els.forEach(e => { e.style.outline = e.dataset.utrOutline || ''; e.style.outlineOffset = ''; delete e.dataset.utrOutline; })).catch(() => {});
  return f;
}

// jsonShot: for API-only failures (500, error envelope, wrong number in a response the UI does not show): render the
// request line, status and the relevant excerpt of the body (keep it short: the field that is wrong, or the error name)
// next to the expected value, and save `<out>/ISSUE-<name>.png`. Uses a separate tab so the app page stays as it is.
// Never pass tokens or secrets in `excerpt` (it is rendered as is).
export async function jsonShot(page, out, name, { request, status, expected, excerpt }) {
  const n0 = issueName(name);
  let p;
  try { p = await page.context().newPage(); } catch { p = await page.context().browser().newPage(); }
  const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const body = typeof excerpt === 'string' ? excerpt : JSON.stringify(excerpt, null, 2);
  await p.setContent(`<body style="font:14px system-ui;margin:16px;max-width:1100px"><div style="font:600 15px system-ui">${esc(request)}</div>
    <div style="margin:6px 0;color:${String(status).startsWith('2') ? '#2f7d4f' : '#d0021b'};font-weight:600">HTTP ${esc(status)}</div>
    ${expected ? `<div style="margin:6px 0"><b>Expected:</b> ${esc(expected)}</div>` : ''}
    <pre style="background:#f3f1ec;border-left:4px solid #d0021b;padding:10px;white-space:pre-wrap;font:12px ui-monospace,Menlo,monospace">${esc(body.slice(0, 4000))}</pre></body>`);
  const f = join(out, `ISSUE-${n0}.png`);
  await p.screenshot({ path: f, fullPage: true });
  await p.close();
  return f;
}

// ---- new generic helpers ---------------------------------------------------------------------------------------------

// role names of the bearer the page sent last (api.token()); decoded in memory, only names returned (gates G-ROLES, PSP-G1)
export function roles(api) {
  const tok = typeof api === 'string' ? api : api?.token?.();
  const d = decodeJwt(tok);
  if (!d) return { ok: false, roles: [], byClient: {}, reason: tok ? 'bearer is not a JWT' : 'no bearer captured yet' };
  const r = roleNames(d.payload);
  return { ok: true, roles: r.roles, byClient: r.byClient };
}

// time of an item: the first field named like created / timestamp / date that parses
const itemTime = (it) => {
  for (const k of ['created_date', 'createdDate', 'creation_date', 'creationDate', 'created_at', 'createdAt', 'created', 'timestamp', 'sent_at', 'date']) {
    if (it && it[k] != null) { const t = Date.parse(it[k]); if (!Number.isNaN(t)) return t; }
  }
  return null;
};
const containsValue = (obj, needle, depth = 0) => {
  if (obj == null || depth > 6) return false;
  if (typeof obj !== 'object') return String(obj) === String(needle);
  return Object.values(obj).some((v) => containsValue(v, needle, depth + 1));
};
const listOf = (body) => (Array.isArray(body) ? body : body?.content || body?.items || body?.notifications || body?.data || []);

// notification-center items created at/after iso. Default source = HP notification center (myPP); planners: pass {path}.
// Filters: type (exact match on type / notification_type / category) and objectId (anywhere in the item). Reads 3 pages max.
export async function ncSince(api, iso, { type = null, objectId = null, path = '/api/mobile/health-professional/v1/notifications', pageSize = 50, pages = 3 } = {}) {
  const since = Date.parse(iso);
  if (Number.isNaN(since)) throw new Error(`ncSince: bad iso time ${iso}`);
  const items = [];
  for (let p = 0; p < pages; p++) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await api.get(`${path}${sep}current-page=${p}&page-size=${pageSize}&sort-direction=DESC`);
    if (r.status !== 200) return { ok: false, status: r.status, items };
    const list = listOf(r.body);
    items.push(...list);
    const oldest = list.length ? Math.min(...list.map((x) => itemTime(x) ?? Infinity)) : -Infinity;
    if (list.length < pageSize || oldest < since) break;
  }
  const hits = items.filter((it) => {
    const t = itemTime(it);
    if (t == null || t < since) return false;
    if (type && ![it.type, it.notification_type, it.notificationType, it.category].includes(type)) return false;
    if (objectId != null && !containsValue(it, objectId)) return false;
    return true;
  });
  return { ok: true, status: 200, count: hits.length, items: hits };
}

// find a feature value in a config/features payload (list of {code, value} or a map)
const featureValue = (body, code) => {
  if (Array.isArray(body)) { const f = body.find((x) => x && (x.code === code || x.key === code || x.name === code)); return f ? (f.value ?? f.enabled ?? f.state) : undefined; }
  if (body && typeof body === 'object') {
    if (code in body) { const v = body[code]; return v && typeof v === 'object' && 'value' in v ? v.value : v; }
    for (const v of Object.values(body)) { const r = featureValue(v, code); if (r !== undefined) return r; }
  }
  return undefined;
};

// poll a fresh config/features read until code === value (string compare). The URL is the app's own last
// config/features request (api.seen) unless {path} is given; a page must have loaded config/features once before.
export async function waitFlag(api, code, value, maxMin = 6, { path = null, everySec = 30, log = null } = {}) {
  const url = path || api.seen?.('/config/features');
  if (!url) throw new Error('waitFlag: no config/features request seen yet (open a page first or pass {path})');
  const started = Date.now(); let polls = 0; let last;
  while (true) {
    polls++;
    const r = await api.get(url);
    last = featureValue(r.body, code);
    if (log) log('waitFlag', code, 'poll', polls, 'value', JSON.stringify(last));
    if (r.status === 200 && String(last) === String(value)) return { ok: true, value: last, polls, minutes: +((Date.now() - started) / 60000).toFixed(1) };
    if (Date.now() - started > maxMin * 60000) return { ok: false, value: last, polls, minutes: +((Date.now() - started) / 60000).toFixed(1) };
    await new Promise((res) => setTimeout(res, everySec * 1000));
  }
}

// element of the array at a dotted path ('' = json itself) whose id / *_id / *Id equals id (string compare)
export function byId(json, path, id) {
  const arr = !path ? json : String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), json);
  if (!Array.isArray(arr)) return null;
  const want = String(id);
  return arr.find((el) => el && typeof el === 'object' && (String(el.id) === want ||
    Object.entries(el).some(([k, v]) => (/_id$|Id$/.test(k)) && v != null && typeof v !== 'object' && String(v) === want))) || null;
}
