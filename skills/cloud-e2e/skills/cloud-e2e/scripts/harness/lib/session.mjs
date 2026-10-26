// Browser session core of app.mjs, mypp.mjs and mypp-inapp.mjs (references/harness.md § app.mjs).
// One persistent Chromium profile per tenant + login + app, PolyID login (web pages or the myPP in-app forms) or a token entry
// URL, recording of the app's API responses (redacted) to <out>/api/NNN-<METHOD>-<path>.json + api-index.jsonl, then the
// worker script's default export:
//   async ({page, ctx, out, shot, log, api, env, envId, login, MYPP, APP, app, stage, urls, POMA, PORTAL}) => {}
// The mypp app is byte-compatible with the UTR mypp.mjs (same login predicate, profile name, files, result keys).
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlaywright, makeLogger, readManifest, readCredFile, asciiLocal, reencodeForm, safeSeg } from './util.mjs';
import { stageUrls, guardUrl, blockedRequestReason } from './guard.mjs';
import { safeRecord, redactUrl, redactBodyString, redactString, redactDeep } from './redact.mjs';

export const APPS = ['mypp', 'poma', 'customer-portal'];
const POMA_ROUTE = /^\/(shift-planner|pool-manager|tenant-admin|invalid-user|badi|partner-simulator)(\/|$)/;

function appSpec(app, urls, { mobile }) {
  const MYPP = urls.pomaWeb; const POMA = urls.pomaWeb; const PORTAL = urls.portalWeb;
  const APP = MYPP + '/health-professional-app';
  const pathOf = (u) => { try { return new URL(u).pathname; } catch { return ''; } };
  const myppLanded = (url) => url.startsWith(MYPP) && !/login|logout|error/i.test(url) && (/\/tabs\//.test(url) || /health-professional-app/.test(url));
  switch (app) {
    case 'mypp': return {
      entry: MYPP + '/', base: MYPP, apiBase: urls.pomaApi, recordHosts: [urls.pomaApi, urls.pomaWeb], profile: mobile ? '-mobile' : '',
      landed: myppLanded, gotoUrl: (p) => (p.startsWith('/tabs/') ? APP : MYPP) + p, APP, MYPP };
    case 'mypp-inapp': return {
      entry: APP + '/', base: MYPP, apiBase: urls.pomaApi, recordHosts: [urls.pomaApi], profile: '-inapp',
      landed: (url) => /\/tabs\//.test(url), gotoUrl: (p) => (p.startsWith('/tabs/') ? APP : MYPP) + p, APP, MYPP };
    case 'poma': return {
      entry: POMA + (process.env.POMA_ENTRY || '/'), base: POMA, apiBase: urls.pomaApi, recordHosts: [urls.pomaApi, urls.pomaWeb], profile: '-poma' + (mobile ? '-mobile' : ''),
      // planner routes count as logged in once the app has called poma-api with a bearer (the SPA shows its routes before
      // the PolyID redirect); an HP-only user routed to myPP also counts (result.landing reports where it landed)
      landed: (url, s) => url.startsWith(POMA) && !/login|logout|error/i.test(pathOf(url)) && (POMA_ROUTE.test(pathOf(url)) || myppLanded(url)) && !!s.bearer,
      gotoUrl: (p) => (p.startsWith('/tabs/') ? APP : POMA) + p, APP, MYPP };
    case 'customer-portal': return {
      entry: PORTAL + (process.env.PORTAL_ENTRY || '/portal/'), base: PORTAL, apiBase: urls.portalApi, recordHosts: [urls.portalApi], profile: '-portal',
      landed: (url, s) => url.startsWith(PORTAL + '/portal') && !/login|logout/i.test(pathOf(url)) && !!s.bearer,
      gotoUrl: (p) => PORTAL + (p.startsWith('/portal') ? p : '/portal' + p), APP, MYPP };
    default: throw new Error(`unknown app ${app}`);
  }
}

// o: {app, tenant, login, scriptPath, outdir, stage, headed, mobile, downloads, consoleInfo, tokenEntry, credFile, extra}
export async function runHarness(o) {
  const app = o.app || 'mypp';
  const stage = o.stage || 'ct';
  const ENV_ID = o.tenant; const login = o.login;
  const need = app === 'customer-portal' ? ['portalWeb', 'portalApi'] : ['pomaWeb', 'pomaApi'];
  const urls = stageUrls(stage, process.env, need);
  const mobile = app === 'mypp-inapp' ? true : !!o.mobile;
  const spec = appSpec(app, urls, { mobile });
  const { MYPP, APP } = spec;
  const env = ENV_ID; // kept for scripts written against the older <m|p> signature

  // credentials: DeployMate manifest (default) or a 0600 --cred-file for shared tenants; the password is never written
  let PASS = null; let person = null; let credEmail = null;
  if (!o.tokenEntry) {
    if (o.credFile) { const c = readCredFile(o.credFile, login, ENV_ID); PASS = c.password; credEmail = c.email; }
    else { const manifest = readManifest(ENV_ID); PASS = manifest.loginPassword; person = (manifest.loginUsers || []).find((u) => u.username === login); }
  }
  const USER = process.env.MYPP_EMAIL || credEmail || (process.env.MYPP_USER_FORMAT === 'email' && person ? person.email : `${asciiLocal(login)}@${ENV_ID}.ch`);

  const out = resolve(o.outdir);
  mkdirSync(join(out, 'api'), { recursive: true });
  const profileDir = resolve(process.env.MYPP_PROFILES || join(process.cwd(), 'profiles'), `${ENV_ID}-${login}${spec.profile}${o.tokenEntry ? '-token' : ''}`);
  mkdirSync(profileDir, { recursive: true });
  const log = makeLogger(out, 'harness.log');

  const { chromium, devices } = loadPlaywright();
  const ctxOpts = { headless: !o.headed, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'de-CH', timezoneId: 'Europe/Zurich', ignoreHTTPSErrors: true };
  if (mobile) Object.assign(ctxOpts, { userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  if (o.downloads) ctxOpts.acceptDownloads = true;
  const ctx = await chromium.launchPersistentContext(profileDir, ctxOpts);
  if (app === 'mypp-inapp') await ctx.addInitScript(() => { window.cordova = window.cordova || {}; });
  // hard rules 1 + 2: production hosts and /test/** never leave the browser
  await ctx.route((u) => !!blockedRequestReason(u.href), (route) => { log('BLOCKED request', redactUrl(route.request().url()).slice(0, 200), blockedRequestReason(route.request().url())); return route.abort(); });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.setDefaultTimeout(30000);

  await page.route(/polyid-login[^/]*\/ui\/.*\/submit/, async (route) => {
    const req = route.request(); const body = req.postData();
    if (req.method() !== 'POST' || !body) return route.continue();
    const fixed = reencodeForm(body);
    if (fixed !== body) { log('re-encoded PolyID form body as UTF-8'); return route.continue({ postData: fixed, headers: { ...req.headers(), 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } }); }
    return route.continue();
  });

  const state = { bearer: null, seq: 0, seen: [] };
  const recordHosts = spec.recordHosts.filter(Boolean).map((h) => new URL(h).host);
  const seenHosts = [urls.pomaWeb, urls.pomaApi, urls.portalWeb, urls.portalApi].filter(Boolean).map((h) => new URL(h).host);
  const apiIndex = join(out, 'api-index.jsonl');
  const record = (rec, body) => {
    const safe = safeRecord(rec, body);
    try { writeFileSync(join(out, rec.file), JSON.stringify(safe, null, 2)); } catch (e) { safe.meta.error = String(e); }
    appendFileSync(apiIndex, JSON.stringify(safe.meta) + '\n');
  };
  page.on('response', async (resp) => {
    const url = resp.url();
    let u; try { u = new URL(url); } catch { return; }
    // every app-host URL is remembered for api.seen() (e.g. the webapp's own /config/features poll, which is not under /api/)
    if (seenHosts.includes(u.host)) { state.seen.push(url); if (state.seen.length > 400) state.seen.shift(); }
    if (!url.includes('/api/') || !recordHosts.includes(u.host)) return;
    const req = resp.request();
    const auth = (await req.allHeaders().catch(() => ({})))['authorization'];
    if (auth) state.bearer = auth;
    const n = String(++state.seq).padStart(3, '0');
    const file = `api/${n}-${req.method()}-${safeSeg(u)}.json`;
    let body = null; let text = null;
    try { text = await resp.text(); body = JSON.parse(text); } catch { body = text; }
    record({ seq: n, ts: new Date().toISOString(), method: req.method(), url, status: resp.status(), file, requestBody: req.postData() ?? null }, body);
  });
  if (process.env.MYPP_TRACE) page.on('response', async (r) => { const u = r.url(); if (/\.(js|css|png|svg|woff2?|ico|json)(\?|$)/.test(u)) return; const q = r.request(); log('TRACE', q.method(), r.status(), redactUrl(u).slice(0, 200), q.postData() ? 'body=' + redactBodyString(q.postData()).slice(0, 300) : '', redactUrl(r.headers()['location'] || '').slice(0, 200)); });
  page.on('pageerror', (e) => log('PAGEERROR', redactString(e.message)));
  page.on('console', (m) => {
    if (m.type() === 'error') log('CONSOLE', redactString(m.text()).slice(0, 300));
    else if (o.consoleInfo && ['info', 'log'].includes(m.type())) {
      const t = redactString(m.text()).slice(0, 500); log('CONSOLE-' + m.type().toUpperCase(), t);
      appendFileSync(join(out, 'console.jsonl'), JSON.stringify({ ts: new Date().toISOString(), type: m.type(), text: t }) + '\n');
    }
  });

  let shotN = 0;
  const shot = async (name, opts = {}) => {
    const f = join(out, `${String(++shotN).padStart(2, '0')}-${name}.png`);
    const mask = (opts.mask || []).map((s) => (typeof s === 'string' ? page.locator(s) : s));
    await page.screenshot({ path: f, fullPage: !!opts.fullPage, ...(mask.length ? { mask } : {}) }); log('shot', f); return f;
  };
  const visibleBtn = (re) => page.getByRole('button', { name: re }).locator('visible=true').first();

  async function failLogin(reason) {
    { const m = /[?&]errors=([^&]+)/.exec(page.url()); if (m) log('IDM error:', decodeURIComponent(m[1]), (/technical_details=([^&]+)/.exec(page.url()) || [])[1] || ''); }
    await shot('login-failed');
    try { writeFileSync(join(out, 'login-failed.html'), (await page.content()).replace(/value="[^"]*"/g, 'value="***"')); } catch {}
    log('LOGIN FAILED at', redactUrl(page.url()), reason || '');
    return false;
  }

  // PolyID web pages (myPP browser path, POMA planner app, customer portal)
  async function loginWeb() {
    await page.goto(spec.entry, { waitUntil: 'domcontentloaded' });
    let pwAttempts = 0;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1500);
      const url = page.url();
      if (spec.landed(url, state)) { log('logged in, at', redactUrl(url)); return true; }
      const allow = page.locator('#allow-mypp-yes-button:visible');
      if (await allow.count()) { await shot('allow-modal'); await allow.click(); continue; }
      const consent = visibleBtn(/zustimmen|accept|agree|consentir|accetta/i);
      if (await consent.count()) {
        for (const cb of await page.locator('input[type="checkbox"]:visible').all()) { if (!(await cb.isChecked())) await cb.check().catch(() => cb.click()); }
        await shot('consent'); await consent.click(); await page.waitForLoadState('domcontentloaded').catch(() => {}); continue;
      }
      const texts = page.locator('input:visible:not([type="password"]):not([type="checkbox"]):not([type="hidden"])');
      const passes = page.locator('input[type="password"]:visible');
      const nText = await texts.count(), nPass = await passes.count();
      if (nPass > 0) {
        // never submit the password more than twice: repeated failures lock the account / caller IP (PolyID, tenant IDM)
        if (++pwAttempts > 2) { log('password step reached a 3rd time: stopping to avoid an IDM lockout'); break; }
        if (nText > 0 && (await texts.first().inputValue()) !== login) await texts.first().fill(login);
        await passes.first().fill(PASS);
        await shot('login-step2-filled');
        await visibleBtn(/senden|anmelden|login|sign in|weiter|next/i).click();
        await page.waitForLoadState('domcontentloaded').catch(() => {}); continue;
      }
      if (nText > 0) {
        await texts.first().fill(USER);
        await shot('login-step1-filled');
        await visibleBtn(/senden|weiter|next|login|anmelden/i).click();
        await page.waitForLoadState('domcontentloaded').catch(() => {}); continue;
      }
      const btn = visibleBtn(/login|anmelden|sign in/i);
      if (await btn.count()) { await btn.click(); continue; }
      log('waiting: url', redactUrl(url));
    }
    return failLogin();
  }

  // myPP in-app forms (cordova shim: Ionic reports hybrid + android and runs LoginAuthPolyidService)
  async function loginInApp() {
    await page.goto(spec.entry, { waitUntil: 'domcontentloaded' });
    let pwAttempts = 0; let emailDone = false;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1500);
      const url = page.url();
      const hybrid = await page.evaluate(() => !!window.cordova).catch(() => null);
      if (/\/team-roster-tutorial/.test(url)) {
        await shot('tutorial');
        for (let k = 0; k < 10 && /team-roster-tutorial/.test(page.url()); k++) { const b = page.locator('button:visible, ion-button:visible').last(); await b.click().catch(() => {}); await page.waitForTimeout(900); }
        log('tutorial left, at', redactUrl(page.url())); continue;
      }
      if (/\/tabs\//.test(url)) { log('logged in (in-app), at', redactUrl(url), 'cordova shim', hybrid); return true; }
      const allow = page.locator('#allow-mypp-yes-button:visible');
      if (await allow.count()) { await shot('allow-modal'); await allow.click(); continue; }
      const accept = page.locator('#btn-accept:visible');
      if (await accept.count()) {
        for (const cb of await page.locator('input[type="checkbox"]:visible, ion-checkbox:visible').all()) { await cb.click().catch(() => {}); }
        await shot('consent'); await accept.click().catch(() => {}); continue;
      }
      const pw = page.locator('#password-input input:visible, input#password-input:visible, input[type="password"]:visible').first();
      if (await pw.count()) {
        if (++pwAttempts > 2) { log('password step reached a 3rd time: stopping to avoid a lockout'); break; }
        const name = page.locator('#name-input input:visible, input#name-input:visible').first();
        if (await name.count()) { await name.fill(''); await name.pressSequentially(login, { delay: 20 }); }
        await pw.fill(''); await pw.pressSequentially(PASS, { delay: 10 });
        await shot('inapp-login-filled');
        await page.locator('button.login-form-button:visible').first().click();
        await page.waitForTimeout(3000); continue;
      }
      const email = page.locator('#provider-email-input input:visible, input#provider-email-input:visible, input[type="email"]:visible').first();
      if (await email.count() && !emailDone) {
        await email.fill(''); await email.pressSequentially(USER, { delay: 20 });
        await shot('inapp-onboard-filled');
        await page.locator('button.on-board-form-button:visible').first().click();
        emailDone = true; await page.waitForTimeout(2500); continue;
      }
      if (emailDone && await email.count()) { log('still on on-board form after submit'); emailDone = false; await shot('onboard-stuck'); continue; }
      const btn = visibleBtn(/^\s*ok\s*$|login|anmelden|sign in|weiter|next|start/i);
      if (await btn.count()) { await btn.click().catch(() => {}); continue; }
      log('waiting: url', redactUrl(url), 'hybrid', hybrid);
    }
    return failLogin();
  }

  // token entry (H-HPN-1): open an entry URL that carries a token; logged in when the app reaches flows/ or tabs/
  async function loginToken() {
    const u = guardUrl('--token-entry', o.tokenEntry, stage);
    log('token entry at', u.origin + u.pathname, '(query not logged)');
    await page.goto(u.href, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1500);
      const url = page.url();
      if (/\/(flows|tabs)\//.test(url) || spec.landed(url, state)) { log('token entry reached', redactUrl(url).split('?')[0]); return true; }
    }
    return failLogin('token entry did not reach a flows/ or tabs/ route');
  }

  const API_BASE = spec.apiBase;
  const api = {
    token: () => state.bearer,
    // direct API call with the app's bearer (captured from the page's own requests); guarded to the stage hosts, saved like page traffic
    call: async (method, path, body) => {
      if (!state.bearer) throw new Error('no bearer token captured yet: navigate to a page that calls the API first');
      const url = guardUrl('api.call', path.startsWith('http') ? path : API_BASE + path, stage).href;
      const res = await fetch(url, { method, headers: { authorization: state.bearer, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { json = text; }
      const n = String(++state.seq).padStart(3, '0');
      const file = `api/${n}-${method}-${safeSeg(new URL(url))}.json`;
      record({ seq: n, ts: new Date().toISOString(), method, url, status: res.status, file, requestBody: body ? JSON.stringify(body) : null, direct: true }, json);
      return { status: res.status, body: json };
    },
    get: (path) => api.call('GET', path),
    wait: (frag, timeout = 30000) => page.waitForResponse((r) => r.url().includes(frag), { timeout }).then(async (r) => ({ status: r.status(), url: r.url(), body: await r.json().catch(() => null) })),
    // last recorded URL containing frag (e.g. the app's own config/features request), or null
    seen: (frag) => [...state.seen].reverse().find((u) => u.includes(frag)) || null,
    dismissTour: async (ms = 5000) => {
      const until = Date.now() + ms; let n = 0;
      while (Date.now() < until) {
        const b = page.getByRole('button', { name: /nicht jetzt|not now|später|skip|überspringen/i }).locator('visible=true').first();
        if (await b.count()) { await b.click().catch(() => {}); n++; await page.waitForTimeout(800); if (n > 3) break; continue; }
        await page.waitForTimeout(400);
      }
      return n > 0;
    },
    goto: async (path, waitFrag, timeout = 30000) => {
      const url = spec.gotoUrl(path);
      const wait = () => (waitFrag ? page.waitForResponse((r) => r.url().includes(waitFrag), { timeout }).catch(() => null) : Promise.resolve(null));
      let p = wait();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const dismissed = await api.dismissTour(4000);
      if (dismissed) { p = wait(); await page.goto(url, { waitUntil: 'domcontentloaded' }); await api.dismissTour(2000); }
      const r = await p;
      await page.waitForTimeout(1200);
      return r ? { status: r.status(), url: r.url(), body: await r.json().catch(() => null) } : null;
    },
    // --downloads: run the action, save the download under <out>/downloads/, return {file, bytes, lines}
    download: async (action, name, timeout = 60000) => {
      if (!o.downloads) throw new Error('start the harness with --downloads to capture files');
      const p = page.waitForEvent('download', { timeout });
      await action();
      const d = await p;
      mkdirSync(join(out, 'downloads'), { recursive: true });
      const fn = basename(String(name || d.suggestedFilename() || 'download.bin')).replace(/[^A-Za-z0-9._-]+/g, '_');
      const f = join(out, 'downloads', fn);
      await d.saveAs(f);
      const buf = readFileSync(f);
      const text = /\.(csv|txt|json|tsv)$/i.test(fn);
      log('download', f, buf.length, 'bytes');
      return { file: f, bytes: buf.length, lines: text ? buf.toString('utf8').split('\n').length : null, suggested: d.suggestedFilename() };
    },
  };

  try {
    const ok = o.tokenEntry ? await loginToken() : app === 'mypp-inapp' ? await loginInApp() : await loginWeb();
    const result = { env, envId: ENV_ID, login, user: USER, loggedIn: ok, url: redactUrl(page.url()) };
    if (app !== 'mypp' && app !== 'mypp-inapp') Object.assign(result, { app, stage, landing: (() => { try { return new URL(page.url()).pathname; } catch { return null; } })() });
    if (ok && o.scriptPath !== '-') {
      const mod = await import(pathToFileURL(resolve(o.scriptPath)).href);
      result.script = await mod.default({ page, ctx, out, shot, log, api, env, envId: ENV_ID, login, MYPP, APP, app, stage, urls, POMA: urls.pomaWeb, PORTAL: urls.portalWeb, ...(o.extra || {}) });
    } else if (ok) {
      await shot('home');
    }
    const safe = redactDeep(result);
    writeFileSync(join(out, 'result.json'), JSON.stringify(safe, null, 2));
    console.log(JSON.stringify(safe));
  } catch (e) {
    log('ERROR', redactString(e.stack || String(e)));
    await shot('error').catch(() => {});
    process.exitCode = 1;
  } finally {
    await ctx.close();
  }
}
