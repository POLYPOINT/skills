// PolyPortal ops core of portal-ops.mjs, portal-flag.mjs and partner-api.mjs (references/harness.md § portal-ops.mjs).
// The operator signs in once, headed, into a persistent profile OUTSIDE results/ (personal ops account, ≈ 1.5 h session);
// headless calls reuse it. The SPA's own Bearer for the portal admin API is captured from its requests and used for direct
// calls to <portal-api>/api/private/admin/… (the same endpoints the ops frontend calls; paths from
// polypoint-portal-ops-frontend/src/app/services/admin/*.service.ts). The Bearer is never printed or written.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPlaywright, makeLogger, safeSeg } from './util.mjs';
import { stageUrls, guardUrl, blockedRequestReason, GuardError } from './guard.mjs';
import { safeRecord, redactUrl, redactString, MASK_SELECTORS } from './redact.mjs';

export class PortalExit extends Error { constructor(code, msg) { super(msg); this.exitCode = code; } }

// k8s selector of a monitored service (polypoint-portal-ops-frontend model/service.ts)
export function serviceSelector(service) {
  if (service === 'portal-tenant-access') return 'service=portal-tenant-access';
  if (['cpp-api', 'cpp', 'ipsp'].includes(service)) return `app=${service}`;
  return `app.kubernetes.io/name=${service}`;
}
export function actuatorPath(service, endpoint, { podIp = null, segment = null } = {}) {
  const base = podIp ? `/services/${podIp}/actuator` : '/services/actuator';
  let p = `${base}${endpoint ? '/' + endpoint : ''}?k8s-service-name=${service}&k8s-selector=${encodeURIComponent(serviceSelector(service))}`;
  if (segment) p += `&actuatorOptionalSegment=${encodeURIComponent(segment)}`;
  return p;
}
// actuator reads refused by the helper (secrets / heavy dumps); the helper only ever GETs
export const ACTUATOR_REFUSED = /^(env|configprops|heapdump|threaddump)(\/|$)/;

// Job allow-list (areas/portal-ops/data-plan.md §6): Tier A = read / compute / idempotent (stage window S-CT-JOBS);
// Tier T = tenant-scoped, ALWAYS with tenantIds=<own DeployMate env>. Everything else (Tier B / D) is refused.
export const JOBS_TIER_A = {
  'portal-core': ['LoadTenantVersions', 'TenantHealthEventJob'],
  'event-handler': ['PluginTableMaintenanceCronJob'],
  'polyid-login': ['DeleteExpiredTwoFactorAuthCodesJob', 'RefreshJsonWebKeysJob'],
  'poma-conflict-checker': ['FindAbandonedSyncJobs', 'ProcessTeamRosterAdoptionMetricsCronJob', 'ProcessTeamRosterConsentMetricsCronJob', 'ProcessTeamRosterRequestsMetricsCronJob', 'ProcessTeamRosterSystemMetricsCronJob'],
};
export const JOBS_TIER_T = {
  'poma-core': ['ResyncEmployeesWithNoEmploymentsJob', 'AvailabilityConflictCheckerCronJob', 'EmploymentExpirationCronJob', 'ResyncUserEmploymentsJob', 'UsersSyncCronJob'],
};
const jobKey = (s) => String(s).toLowerCase().replace(/(cron)?job$/, '');
export function jobTier(service, job) {
  const k = jobKey(job);
  if ((JOBS_TIER_T[service] || []).some((j) => jobKey(j) === k)) return 'T';
  if ((JOBS_TIER_A[service] || []).some((j) => jobKey(j) === k)) return 'A';
  return null;
}

// Flags whose ON value sends real messages: only inside the manual / messaging windows (env-plan conflict #6)
export const MESSAGING_FLAGS = ['poma.internalPool.sendEmailConfirmation', 'poma.msTeams.notifications'];

const listOf = (b) => (Array.isArray(b) ? b : b?.items || b?.content || b?.data || b?.organizations || b?.partners || []);

// open a portal session: {base: 'ops'|'poma-ops'|'customer'}; dialogs = queue [{prompt:"DELETE"}|{confirm:true|false}]
export async function openPortal({ profile, out, base = 'ops', stage = 'ct', headed = false, dialogs = [], logFile = 'portal-ops.log' }) {
  if (!profile) throw new PortalExit(4, 'a profile directory is required');
  if (!['ops', 'poma-ops', 'customer'].includes(base)) throw new PortalExit(4, '--base must be ops, poma-ops or customer');
  const urls = stageUrls(stage, process.env, base === 'poma-ops' ? ['portalWeb', 'portalApi', 'pomaWeb', 'pomaApi'] : ['portalWeb', 'portalApi']);
  const BASE = base === 'poma-ops' ? `${urls.pomaWeb}/ops` : base === 'customer' ? `${urls.portalWeb}/portal` : `${urls.portalWeb}/ops`;
  const ADMIN = `${urls.portalApi}/api/private/admin`;
  mkdirSync(join(out, 'api'), { recursive: true });
  const log = makeLogger(out, logFile, { iso: true });
  const { chromium } = loadPlaywright();
  const ctx = await chromium.launchPersistentContext(profile, { headless: !headed, viewport: { width: 1600, height: 1100 } });
  await ctx.route((u) => !!blockedRequestReason(u.href), (r) => { log('BLOCKED request', redactUrl(r.request().url()).slice(0, 200)); return r.abort(); });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(30000);

  const queue = [...dialogs];
  page.on('dialog', async (d) => {
    const msg = d.message(); appendFileSync(join(out, 'dialogs.log'), `[${new Date().toISOString()}] ${d.type()} ${JSON.stringify(msg)}\n`);
    log('dialog', d.type(), JSON.stringify(msg).slice(0, 300));
    if (d.type() === 'alert' || d.type() === 'beforeunload') return d.accept();
    const next = queue.shift();
    if (d.type() === 'prompt') { if (next && typeof next.prompt === 'string') return d.accept(next.prompt); log('prompt without a scripted answer: dismissed'); return d.dismiss(); }
    if (next && next.confirm === false) return d.dismiss();
    if (next && next.confirm === true) return d.accept();
    log('confirm without a scripted answer: dismissed'); return d.dismiss();
  });

  const apiHosts = [urls.portalApi, urls.eventHandler, base === 'poma-ops' ? urls.pomaApi : null].filter(Boolean).map((h) => new URL(h).host);
  const RECORD = /\/api\/private\/admin\/|\/api\/admin\/|\/api\/v1\/|\/api\/v2\/|\/api\/private\/business\/|\/admin\/plugins|\/metadata\/|\/actuator\/polypointjobs/;
  const state = { bearer: null, adminOk: false, seq: 0 };
  // the Bearer of the base's own API: portal-api (ops, customer) or poma-api (POMA ops)
  const primaryHost = new URL(base === 'poma-ops' ? urls.pomaApi : urls.portalApi).host;
  page.on('request', async (r) => {
    let u; try { u = new URL(r.url()); } catch { return; }
    if (!apiHosts.includes(u.host)) return;
    const a = (await r.allHeaders().catch(() => ({})))['authorization'];
    if (a && /^Bearer\s+\S+/.test(a) && u.host === primaryHost) state.bearer = a;
  });
  const record = (rec, body) => {
    const safe = safeRecord(rec, body);
    try { writeFileSync(join(out, rec.file), JSON.stringify(safe, null, 2)); } catch (e) { safe.meta.error = String(e); }
    appendFileSync(join(out, 'api-index.jsonl'), JSON.stringify(safe.meta) + '\n');
  };
  page.on('response', async (r) => {
    let u; try { u = new URL(r.url()); } catch { return; }
    if (!apiHosts.includes(u.host) || !RECORD.test(u.pathname + u.search)) return;
    if (u.href.startsWith(ADMIN + '/') && r.status() === 200) state.adminOk = true;
    const n = String(++state.seq).padStart(3, '0');
    let body = null; try { const t = await r.text(); try { body = JSON.parse(t); } catch { body = t; } } catch { body = null; }
    record({ seq: n, ts: new Date().toISOString(), method: r.request().method(), url: r.url(), status: r.status(), file: `api/${n}-${r.request().method()}-${safeSeg(u)}.json`, requestBody: r.request().postData() ?? null }, body);
  });

  let shotN = 0;
  const shot = async (name, opts = {}) => {
    const f = join(out, `${String(++shotN).padStart(2, '0')}-${name}.png`);
    const mask = [...MASK_SELECTORS.portal, ...(opts.mask || [])].map((s) => (typeof s === 'string' ? page.locator(s) : s));
    await page.screenshot({ path: f, fullPage: !!opts.fullPage, mask }).catch((e) => log('shot failed', e.message));
    log('shot', f); return f;
  };

  // direct call with the captured Bearer; relative paths go to the portal admin API
  const call = async (method, path, body) => {
    if (!state.bearer) throw new PortalExit(3, 'LOGIN_NEEDED (no portal admin Bearer captured; run the login action)');
    const url = guardUrl('portal call', path.startsWith('http') ? path : ADMIN + path, stage).href;
    const res = await fetch(url, { method, headers: { authorization: state.bearer, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    const n = String(++state.seq).padStart(3, '0');
    record({ seq: n, ts: new Date().toISOString(), method, url, status: res.status, file: `api/${n}-${method}-${safeSeg(new URL(url))}.json`, requestBody: body !== undefined ? JSON.stringify(body) : null, direct: true }, json);
    log('api', res.status, method, redactUrl(url).replace(ADMIN, '<admin>').split('?')[0]);
    if (res.status === 401) throw new PortalExit(3, 'LOGIN_NEEDED (401 from the portal admin API; run the login action with the operator)');
    return { status: res.status, body: json };
  };

  // wait until the SPA has an authenticated admin call (headless ≤ 45 s; headed login ≤ 5 min)
  const ensureSession = async ({ timeoutMs = headed ? 300000 : 45000, path = base === 'ops' ? '/dashboard' : '/' } = {}) => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => log('goto err', e.message));
    if (headed) log('LOGIN: sign in to the portal ops frontend in the opened window; waiting up to 5 min');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && !(state.bearer && (state.adminOk || base !== 'ops'))) await page.waitForTimeout(1000);
    if (!state.bearer) {
      await page.screenshot({ path: join(out, 'login-needed.png') }).catch(() => {});
      throw new PortalExit(3, `LOGIN_NEEDED (run the login action); page at ${(() => { try { const x = new URL(page.url()); return x.host + x.pathname; } catch { return '?'; } })()}`);
    }
    return true;
  };

  const resolveOrg = async (tenant, explicit) => {
    if (explicit) return explicit;
    if (process.env.PORTAL_ORG) return process.env.PORTAL_ORG;
    const r = await call('GET', '/organizations?count=500&expand=tenants');
    const org = listOf(r.body).find((o) => (o.tenants || o.tenant_list || []).some((t) => (t.id ?? t) === tenant));
    return org ? org.id : null;
  };

  const close = async () => { await ctx.close().catch(() => {}); };
  return { ctx, page, log, shot, call, ensureSession, resolveOrg, close, urls, BASE, ADMIN, state, stage };
}

// in-memory read of an integration partner's Keycloak client secret (ADMIN rights); never written, never printed
export async function readPartnerSecret({ profile, partnerId, stage = 'ct', out }) {
  if (!/^e2e-[a-z0-9-]+$/.test(partnerId)) throw new PortalExit(5, `refusing partner ${partnerId}: only e2e-* partners`);
  const s = await openPortal({ profile, out, stage, logFile: 'portal-secret.log' });
  try {
    await s.ensureSession();
    const r = await s.call('GET', `/integration-partners/${encodeURIComponent(partnerId)}/consumer-service-account-credentials`);
    if (r.status !== 200 || !r.body?.client_secret) throw new PortalExit(r.status === 404 ? 2 : 6, `client secret of ${partnerId} not readable (HTTP ${r.status}; ADMIN needed)`);
    return r.body.client_secret;
  } finally { await s.close(); }
}

// ---- legacy UI flow of portal-flag.mjs (UTR P-03; boolean path unverified live) ------------------------------------------
// Kept step for step so the wrapper stays byte-compatible: same files (portal.log, tenant-features-N.json,
// 01-<action>-before(-row).png, 02-<action>-after(-row).png, portal-calls.json) and exit codes (0 ok, 2 row not found,
// 3 login needed, 4 usage, 5 boolean control not found / wrong value).
export async function legacyFlagUi({ profile, out, tenant, action, value, org, code, portalUrl }) {
  const PORTAL = guardUrl('PORTAL_URL', portalUrl, 'ct').href.replace(/\/+$/, '');
  mkdirSync(out, { recursive: true });
  const headed = action === 'login';
  const { chromium } = loadPlaywright();
  const ctx = await chromium.launchPersistentContext(profile, { headless: !headed, viewport: { width: 1600, height: 1100 } });
  await ctx.route((u) => !!blockedRequestReason(u.href), (r) => r.abort());
  const page = ctx.pages()[0] || await ctx.newPage();
  const log = (...a) => { const l = `[${new Date().toISOString()}] ` + a.join(' '); console.log(l); appendFileSync(`${out}/portal.log`, l + '\n'); };
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); log('dialog', d.type(), JSON.stringify(d.message())); await d.accept(); });
  const calls = [];
  page.on('response', async (r) => {
    const u = r.url(); if (!/portal-api.*\/features/.test(u)) return;
    const e = { t: new Date().toISOString(), status: r.status(), method: r.request().method(), url: u.replace(/^https:\/\/[^/]+/, '') };
    calls.push(e); log('api', e.status, e.method, e.url);
    if (e.method === 'GET') {
      try {
        const b = await r.json(); writeFileSync(`${out}/tenant-features-${calls.length}.json`, JSON.stringify(b, null, 1));
        const f = Array.isArray(b) ? b.find((x) => x.code === code) : null; if (f) log('flag-in-response', JSON.stringify({ code: f.code, type: f.type, value: f.value, master: f.master }));
      } catch { /* not JSON */ }
    }
  });
  const url = `${PORTAL}/ops/organizations/${org}/${tenant}?section=features`;
  const rowOf = () => page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: code }).first();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => log('goto err', e.message));
  if (headed) {
    log('LOGIN: sign in to portal ops in the opened window; waiting up to 5 min for the features table');
    await rowOf().waitFor({ timeout: 300000 }).catch(() => log('login timeout'));
    const ok = (await rowOf().count()) > 0;
    log('login', ok ? 'OK (session stored in the profile)' : 'NOT DONE');
    await ctx.close(); return ok ? 0 : 3;
  }
  await page.waitForTimeout(3000);
  if (!page.url().startsWith(PORTAL)) { log('LOGIN_NEEDED (run the login action)'); await ctx.close(); return 3; }
  await rowOf().waitFor({ timeout: 20000 }).catch(() => log('row not found'));
  if (!(await rowOf().count())) { await page.screenshot({ path: `${out}/no-row.png`, fullPage: true }); await ctx.close(); return 2; }
  await rowOf().scrollIntoViewIfNeeded();
  const toggle = rowOf().locator('mat-slide-toggle button[role=switch], button[role=switch], mat-checkbox input[type=checkbox], input[type=checkbox]').first();
  const isBool = (await toggle.count()) > 0;
  const input = rowOf().locator('input:not([type=checkbox])').first();
  const boolState = async () => { const a = await toggle.getAttribute('aria-checked').catch(() => null); if (a != null) return a === 'true'; return toggle.isChecked().catch(() => null); };
  log('ui-value', tenant, isBool ? `boolean ${JSON.stringify(await boolState())}` : JSON.stringify(await input.inputValue().catch(() => null)));
  await page.screenshot({ path: `${out}/01-${action}-before.png` });
  await rowOf().screenshot({ path: `${out}/01-${action}-before-row.png` });
  let exit = 0;
  if (action === 'set' && isBool) {
    if (!['true', 'false'].includes(String(value).toLowerCase())) { log('boolean feature: value must be true|false'); await ctx.close(); return 4; }
    const want = String(value).toLowerCase() === 'true';
    const now = await boolState(); log('boolean before', JSON.stringify(now), 'want', want);
    if (now !== want) { await toggle.click(); await page.waitForTimeout(800); }
    const save = rowOf().locator('button.save-btn-icon, #save-feature');
    if (await save.count()) { await save.first().click(); await page.waitForTimeout(3000); }
    else await page.waitForTimeout(3000);
  } else if (action === 'set') {
    await input.fill(value); await page.waitForTimeout(300);
    await rowOf().locator('button.save-btn-icon, #save-feature').click(); await page.waitForTimeout(3000);
  } else if (action === 'delete') {
    await rowOf().locator('button.delete-btn-icon, #delete-feature').click(); await page.waitForTimeout(3000);
  }
  if (action !== 'read') {
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(3000);
    await rowOf().waitFor({ timeout: 20000 }).catch(() => {}); await rowOf().scrollIntoViewIfNeeded().catch(() => {});
    if (isBool) {
      const after = await boolState(); log('ui-value-after-reload', tenant, `boolean ${JSON.stringify(after)}`);
      if (action === 'set' && after !== (String(value).toLowerCase() === 'true')) { log('boolean value not applied'); exit = 5; }
    } else log('ui-value-after-reload', tenant, JSON.stringify(await rowOf().locator('input:not([type=checkbox])').first().inputValue().catch(() => null)));
    await page.screenshot({ path: `${out}/02-${action}-after.png` });
    await rowOf().screenshot({ path: `${out}/02-${action}-after-row.png` }).catch(() => {});
  }
  writeFileSync(`${out}/portal-calls.json`, JSON.stringify({ calls, dialogs }, null, 1));
  await ctx.close();
  return exit;
}

export { GuardError, redactString };
