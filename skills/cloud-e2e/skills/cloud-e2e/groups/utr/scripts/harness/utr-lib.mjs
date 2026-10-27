// Shared helpers for UTR E2E worker scripts (run inside scripts/harness/mypp.mjs or mypp-inapp.mjs).
// Distilled from the first run's W/C worker helpers (2026-10-14/15, CT myPP build of that date, desktop viewport).
// Import from a worker script:   import { day, readDay, summary, save, ... } from '<skill>/groups/utr/scripts/harness/utr-lib.mjs';
// oracle(env, emp, day) shells out to groups/utr/scripts/oracle-day.sh <tenant-id> <emp> <day> (read-only DB rows; env === tenant id).
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const UTR = '/api/mobile/unified-time-recording/v1';
export const CTR = '/api/mobile/time-recording/v1';
export const LTR = '/api/mobile/legacy-time-recording/v1';
const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');

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

// unified day view of d (YYYY-MM-DD); returns {status, url, body} of GET /days (falls back to a direct read)
export async function day(ctx, d) {
  const { page, api } = ctx;
  const r = await api.goto(`/tabs/unified-time-recording?date=${d}`, '/unified-time-recording/v1/days');
  await page.waitForTimeout(1500);
  const t = await tour(page);
  await page.waitForTimeout(800);
  if (t || !r || !r.body) {
    if (t) { await page.goto(page.url(), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); await tour(page); }
    const x = await api.get(`${UTR}/days?from=${d}&to=${d}`);
    return { status: x.status, url: 'direct', body: x.body };
  }
  return r;
}

// true when the page shows the unified day view (URL + visible day selector), not Home / the tutorial
export async function onDayView(page) {
  return /unified-time-recording/.test(page.url()) && (await page.locator('.day-selector-arrow-btn').locator('visible=true').count()) > 0;
}

// day() with a navigation retry (master-1822): after api.goto the SPA sometimes lands on /tabs/home/main (fresh login,
// tutorial) and the first navigation of a fresh profile may issue no /days request at all. Retries day() until the day view
// is shown (max `tries`, 3 s apart), then expands the accordions. Returns the last day() result; ctx.dayViewOk tells the outcome.
export async function dayx(ctx, d, tries = 4) {
  let r;
  for (let i = 0; i < tries; i++) {
    r = await day(ctx, d);
    await ctx.page.waitForTimeout(1500);
    const ok = await onDayView(ctx.page);
    if (ctx.log) ctx.log('dayx', d, 'try', i, ctx.page.url(), ok);
    if (ok) { await expand(ctx.page); ctx.dayViewOk = true; return r; }
    await ctx.page.waitForTimeout(3000);
  }
  ctx.dayViewOk = false;
  return r;
}

// classic tab: deep links leave the card list empty, so open the tab (today) and walk back with the day arrow
export async function classicDay(page, api, log, date, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date())) {
  let r = await go(page, api, log, '/tabs/time-recording', '/mobile/time-recording/v1/days', 30000);
  await page.waitForTimeout(2000);
  const n = Math.round((Date.parse(today) - Date.parse(date)) / 86400000);
  for (let i = 0; i < n; i++) {
    const w = api.wait('/mobile/time-recording/v1/days', 20000).catch(() => null);
    await page.locator('.day-selector-arrow-btn').first().click();
    r = await w; await page.waitForTimeout(i === n - 1 ? 3000 : 1200);
  }
  return r;
}

// direct read of one day's unified plan (no UI)
export async function readDay(api, d) {
  const r = await api.get(`${UTR}/days?from=${d}&to=${d}`);
  return { status: r.status, plan: Array.isArray(r.body) ? r.body[0] : r.body };
}

// compact view of a UnifiedDayPlan: shifts/blocks/breaks/timestamps/time_credits/time_amounts as H:mm
export function summary(plan) {
  if (!plan || !plan.shifts) return plan;
  const hm = (x) => (x == null ? null : `${Math.floor(x.total_minutes / 60)}:${String(Math.abs(x.total_minutes % 60)).padStart(2, '0')}`);
  return {
    date: plan.date, rc: plan.roster_cell_id, actions: plan.allowed_actions,
    shifts: plan.shifts.map((s) => ({ sp: s.shift_planning_id, def: s.shift_definition_id, kind: s.shift_kind, actions: s.allowed_actions,
      planned: hm(s.planned_duration), recorded: hm(s.recorded_duration), credited: hm(s.credited_duration),
      blocks: (s.blocks || []).map((b) => ({ id: b.block_id, s: b.start, e: b.end, d: hm(b.duration), note: b.note, actions: b.allowed_actions,
        breaks: (b.breaks || []).map((k) => ({ id: k.break_block_id, s: k.start, e: k.end, paid: k.is_paid, actions: k.allowed_actions })),
        paid: (b.paid_breaks || []).map((k) => ({ id: k.break_block_id, s: k.start, e: k.end, actions: k.allowed_actions })) })) })),
    ts: (plan.timestamps || []).map((t) => ({ id: t.id, t: t.time, type: t.type, note: t.note, sp: t.shift_planning_id, auto: t.is_automatic, actions: t.allowed_actions })),
    tc: (plan.time_credits || []).map((c) => ({ ...c, icon: undefined })),
    amounts: Object.fromEntries(Object.entries(plan.time_amounts || {}).map(([k, v]) => [k, hm(v)])),
  };
}

export function save(out, name, obj) { writeFileSync(join(out, name), JSON.stringify(obj, null, 2)); }

export async function dumpButtons(page) {
  return page.locator('button:visible, ion-button:visible').evaluateAll((els) => els.map((e) => `${e.tagName}#${e.id} .${String(e.className).split(' ').slice(0, 3).join('.')} [${e.getAttribute('aria-label') || ''}] ${e.textContent.trim().slice(0, 40)}`));
}

// set the nth (0-based) pp-timepicker of the page to HH:MM via the desktop dialog (mobile in-app: ion-picker wheels, see mypp-inapp.mjs header)
export async function setTime(page, idx, hhmm, log) {
  const [h, m] = hhmm.split(':');
  await page.locator('pp-timepicker #timepicker').locator('visible=true').nth(idx).click();
  await page.waitForTimeout(800);
  await page.locator('ion-modal .hours-input input').last().fill(h);
  await page.locator('ion-modal .minutes-input input').last().fill(m);
  await page.waitForTimeout(300);
  const acc = page.locator('ion-modal pp-modal-header-actions').last().locator('ion-button, button').filter({ hasText: /Übernehmen|OK|Bestätigen|Speichern|Annehmen|Akzeptieren/ }).first();
  if (await acc.count()) await acc.click();
  else { log && log('accept button not found; buttons:', JSON.stringify(await dumpButtons(page))); throw new Error('timepicker accept not found'); }
  await page.waitForTimeout(800);
}

// DB rows of one employee for d and d+1 (STEMPEL incl. POSITION, BLOCK, PLANUNG, PLANUNGSEINHEIT, ZEITSUMME, ZEITANRECHNUNG per CODEART)
// + active-stamp count
export function oracle(env, emp, d) {
  try { return execFileSync(join(SCRIPTS, 'oracle-day.sh'), [env, String(emp), d], { encoding: 'utf8', timeout: 90000 }); } catch (e) { return 'ORACLE ERROR ' + e.message; }
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

// expand every collapsed accordion of the day view (stamp rows and edit/delete buttons live inside)
export async function expand(page) {
  const heads = page.locator('ion-accordion:not(.accordion-expanded) [slot=header]');
  const n = await heads.count();
  for (let i = 0; i < n; i++) { await heads.nth(i).click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300); }
  await page.waitForTimeout(500);
}

export async function comment(page, text) {
  const t = page.locator('ion-textarea textarea').locator('visible=true').first();
  if (await t.count()) await t.fill(text);
}

// text of a visible error/info dialog, or null
export async function alertText(page) {
  const m = page.locator('ion-modal, ion-alert').filter({ hasText: /Weitere Informationen|Zeiterfassung|Fehler|nicht/ }).locator('visible=true');
  if (!(await m.count())) return null;
  return (await m.last().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600);
}

// a step logger that also keeps the steps for the script result
export function stepper(log) {
  const steps = [];
  const step = (name, o) => { steps.push({ name, ...o }); log(name, JSON.stringify(o).slice(0, 1200)); };
  return { steps, step };
}

// ---- Issue screenshots (every non-PASS scenario carries at least one; agent-brief "Screenshots of the issue") ----
// issueShot: outline the element(s) that show the problem in red, scroll the first into view, save `<out>/ISSUE-<name>.png`,
// remove the outline again. `target` = a Playwright locator (or CSS selector string) of the WRONG value / the error dialog,
// or null (plain screenshot of the view). `name` without the "ISSUE-" prefix (leading "ISSUE-" is stripped); an empty name or
// one with an undefined / null part (e.g. `${id}-x` with id undefined) throws. The welcome tour / onboarding tutorial is dismissed first (a fresh profile shows "Willkommen bei
// myPOLYPOINT" over the view). Returns the file path; open the PNG and check it shows the problem before listing it in `shots`.
export function issueName(name) {
  const n = String(name ?? '').trim().replace(/^(ISSUE-)+/i, '').replace(/\.png$/i, '');
  if (!n || n.split(/[-_.\s]+/).some((s) => ['undefined', 'null', 'nan'].includes(s.toLowerCase()))) {
    throw new Error(`issueShot: missing or undefined name (got ${JSON.stringify(name)})`);
  }
  return n;
}
export async function issueShot(page, out, name, target = null, { fullPage = false } = {}) {
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
  await page.screenshot({ path: f, fullPage });
  if (n) await loc.evaluateAll(els => els.forEach(e => { e.style.outline = e.dataset.utrOutline || ''; e.style.outlineOffset = ''; delete e.dataset.utrOutline; })).catch(() => {});
  return f;
}

// jsonShot: for API-only failures (500, error envelope, wrong number in a response the UI does not show): render the
// request line, status and the relevant excerpt of the body (keep it short: the field that is wrong, or the error name)
// next to the expected value, and save `<out>/ISSUE-<name>.png`. Uses a separate tab so the app page stays as it is.
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
