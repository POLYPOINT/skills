// myPOLYPOINT (CT) browser harness for the UTR E2E.
//   node mypp.mjs <tenant-id> <login> <script.mjs|-> <outdir> [--headed] [--mobile]
// Opens a persistent Chromium profile per tenant+login, logs in through PolyID if needed, records EVERY
// /api/ response (and request body) of the run under <outdir>/api/NNN-<METHOD>-<path>.json with an
// index (api-index.jsonl), then runs the script's default export:
//   async ({page, ctx, out, shot, log, api, env, envId, login, MYPP, APP}) => {}   (env === envId === tenant id)
// The script "-" only logs in and takes a screenshot.
// Login: PolyID step 1 = e-mail <login>@<tenant-id>.ch (ASCII-transliterated local part), step 2 = tenant IDM username <login>
// (the on-prem Keycloak user, dmseed-<kuerzel> on customer-roster seeds) + the seed password read at runtime from
// $DM_CONFIG_DIR/<tenant-id>.test-data.json `.manifest.loginPassword` — never written anywhere. The password is submitted at
// most twice per run (PolyID brute-force detection locks the caller IP per provider without expiry: never probe guessed logins).
// Playwright is resolved from $DM_CONFIG_DIR (default ~/.config/deploymate, where the deploymate skill installs it).
// Env: MYPP_URL, POMA_API_URL, MYPP_PROFILES (default ./profiles), MYPP_EMAIL / MYPP_USER_FORMAT=email, MYPP_TRACE.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const DM_DIR = process.env.DM_CONFIG_DIR || join(homedir(), '.config/deploymate');
const require = createRequire(join(DM_DIR, '/'));
const { chromium, devices } = require('playwright');

const [ENV_ID, login, scriptPath, outdirArg, ...flags] = process.argv.slice(2);
if (!ENV_ID || !login || !scriptPath || !outdirArg) {
  console.error('usage: node mypp.mjs <tenant-id> <login> <script.mjs|-> <outdir> [--headed] [--mobile]');
  process.exit(2);
}
if (!/^[a-z][a-z0-9-]{0,14}$/.test(ENV_ID)) throw new Error('first argument must be the DeployMate env id = CT tenant id');
const env = ENV_ID; // kept for scripts written against the older <m|p> signature
const MYPP = process.env.MYPP_URL || 'https://ct-poma-webapp.dev.k8s.polypoint-dev.com';
const APP = MYPP + '/health-professional-app'; // SPA base; routes like /tabs/unified-time-recording live under it
const manifest = JSON.parse(readFileSync(join(DM_DIR, `${ENV_ID}.test-data.json`), 'utf8')).manifest;
const person = manifest.loginUsers.find((u) => u.username === login); // may be absent: Oracle/Keycloak seed names differ from the manifest
// PolyID's on-board (e-mail) form posts ISO-8859-1 and dies on non-ASCII local parts (e.g. dmseed-awüt -> blank page);
// the e-mail step only resolves the tenant from the domain, so transliterate the local part (ü->ue ...). MYPP_EMAIL overrides.
const asciiLocal = (s) => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').normalize('NFD').replace(/[^\x00-\x7f]/g, '');
const USER = process.env.MYPP_EMAIL || (process.env.MYPP_USER_FORMAT === 'email' && person ? person.email : `${asciiLocal(login)}@${ENV_ID}.ch`);
const PASS = manifest.loginPassword;
const headed = flags.includes('--headed');
const mobile = flags.includes('--mobile');
const out = resolve(outdirArg);
mkdirSync(join(out, 'api'), { recursive: true });
const profileDir = resolve(process.env.MYPP_PROFILES || join(process.cwd(), 'profiles'), `${ENV_ID}-${login}${mobile ? '-mobile' : ''}`);
mkdirSync(profileDir, { recursive: true });

const log = (...a) => { const line = `[${new Date().toISOString().slice(11, 19)}] ${a.join(' ')}`; console.log(line); appendFileSync(join(out, 'harness.log'), line + '\n'); };

const ctxOpts = { headless: !headed, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'de-CH', timezoneId: 'Europe/Zurich', ignoreHTTPSErrors: true };
if (mobile) Object.assign(ctxOpts, { userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const ctx = await chromium.launchPersistentContext(profileDir, ctxOpts);
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.setDefaultTimeout(30000);

// PolyID's login pages declare no charset, so Chromium submits their forms as windows-1252 (ü -> %FC) and the server
// (UTF-8) receives a mangled username for logins like dmseed-awüt. Re-encode such form bodies as UTF-8 before they leave.
const reencodeForm = (body) => body.split('&').map((kv) => kv.split('=').map((part) => {
  const raw = part.replace(/\+/g, ' ');
  try { decodeURIComponent(raw); return part; } catch { /* not valid UTF-8 percent-encoding: treat as latin-1 */ }
  const bytes = []; for (let i = 0; i < raw.length; i++) { if (raw[i] === '%' && /^[0-9A-Fa-f]{2}$/.test(raw.slice(i + 1, i + 3))) { bytes.push(parseInt(raw.slice(i + 1, i + 3), 16)); i += 2; } else bytes.push(raw.charCodeAt(i)); }
  return encodeURIComponent(Buffer.from(bytes).toString('latin1'));
}).join('=')).join('&');
await page.route(/polyid-login[^/]*\/ui\/.*\/submit/, async (route) => {
  const req = route.request(); const body = req.postData();
  if (req.method() !== 'POST' || !body) return route.continue();
  const fixed = reencodeForm(body);
  if (fixed !== body) { log('re-encoded PolyID form body as UTF-8'); return route.continue({ postData: fixed, headers: { ...req.headers(), 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } }); }
  return route.continue();
});

let seq = 0;
let bearer = null; // last Authorization header seen on an API call (lets scripts call the API directly)
const apiIndex = join(out, 'api-index.jsonl');
page.on('response', async (resp) => {
  const url = resp.url();
  if (!url.includes('/api/')) return;
  const req = resp.request();
  const auth = (await req.allHeaders().catch(() => ({})))['authorization'];
  if (auth) bearer = auth;
  const n = String(++seq).padStart(3, '0');
  const u = new URL(url);
  const safe = (u.pathname + (u.search || '')).replace(/^\/+/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 150);
  const file = `api/${n}-${req.method()}-${safe}.json`;
  let body = null; let text = null;
  try { text = await resp.text(); body = JSON.parse(text); } catch { body = text; }
  const rec = { seq: n, ts: new Date().toISOString(), method: req.method(), url, status: resp.status(), file, requestBody: req.postData() ?? null };
  try { writeFileSync(join(out, file), JSON.stringify({ meta: rec, body }, null, 2)); } catch (e) { rec.error = String(e); }
  appendFileSync(apiIndex, JSON.stringify(rec) + '\n');
});
if (process.env.MYPP_TRACE) page.on('response', async (r) => { const u = r.url(); if (/\.(js|css|png|svg|woff2?|ico|json)(\?|$)/.test(u)) return; const q = r.request(); log('TRACE', q.method(), r.status(), u.slice(0, 200), q.postData() ? 'body=' + q.postData().replace(/password=[^&]*/gi, 'password=***').slice(0, 300) : '', (r.headers()['location'] || '').slice(0, 200)); });
page.on('pageerror', (e) => log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE', m.text().slice(0, 300)); });

let shotN = 0;
const shot = async (name) => { const f = join(out, `${String(++shotN).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f, fullPage: false }); log('shot', f); return f; };

const visibleBtn = (re) => page.getByRole('button', { name: re }).locator('visible=true').first();
async function ensureLoggedIn() {
  await page.goto(MYPP + '/', { waitUntil: 'domcontentloaded' });
  let pwAttempts = 0;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1500);
    const url = page.url();
    if (url.startsWith(MYPP) && !/login|logout|error/i.test(url) && (/\/tabs\//.test(url) || /health-professional-app/.test(url))) { log('logged in, at', url); return true; }
    // consent / "allow myPP" modal after login
    const allow = page.locator('#allow-mypp-yes-button:visible');
    if (await allow.count()) { await shot('allow-modal'); await allow.click(); continue; }
    // PolyID first-login consent form: tick the terms checkbox, click "Zustimmen"
    const consent = visibleBtn(/zustimmen|accept|agree|consentir|accetta/i);
    if (await consent.count()) {
      for (const cb of await page.locator('input[type="checkbox"]:visible').all()) { if (!(await cb.isChecked())) await cb.check().catch(() => cb.click()); }
      await shot('consent');
      await consent.click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }
    const texts = page.locator('input:visible:not([type="password"]):not([type="checkbox"]):not([type="hidden"])');
    const passes = page.locator('input[type="password"]:visible');
    const nText = await texts.count(), nPass = await passes.count();
    if (nPass > 0) {
      // step 2: tenant IDM login (username = Keycloak login of the person)
      // never submit the password more than twice: repeated failures lock the account in the tenant IDM (account_locked)
      if (++pwAttempts > 2) { log('password step reached a 3rd time: stopping to avoid an IDM lockout'); break; }
      if (nText > 0 && (await texts.first().inputValue()) !== login) await texts.first().fill(login);
      await passes.first().fill(PASS);
      await shot('login-step2-filled');
      await visibleBtn(/senden|anmelden|login|sign in|weiter|next/i).click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }
    if (nText > 0) {
      // step 1: e-mail / tenant resolution
      await texts.first().fill(USER);
      await shot('login-step1-filled');
      await visibleBtn(/senden|weiter|next|login|anmelden/i).click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      continue;
    }
    const btn = visibleBtn(/login|anmelden|sign in/i);
    if (await btn.count()) { await btn.click(); continue; }
    log('waiting: url', url);
  }
  { const m = /[?&]errors=([^&]+)/.exec(page.url()); if (m) log('IDM error:', decodeURIComponent(m[1]), (/technical_details=([^&]+)/.exec(page.url()) || [])[1] || ''); }
  await shot('login-failed');
  try { writeFileSync(join(out, 'login-failed.html'), await page.content()); } catch {}
  log('LOGIN FAILED at', page.url());
  return false;
}

const API_BASE = process.env.POMA_API_URL || 'https://ct-poma-api.dev.k8s.polypoint-dev.com';
const api = {
  token: () => bearer,
  // direct API call with the app's bearer token (captured from the page's own requests); saved like page traffic
  call: async (method, path, body) => {
    if (!bearer) throw new Error('no bearer token captured yet: navigate to a page that calls the API first');
    const url = path.startsWith('http') ? path : API_BASE + path;
    const res = await fetch(url, { method, headers: { authorization: bearer, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { json = text; }
    const n = String(++seq).padStart(3, '0');
    const u = new URL(url);
    const safe = (u.pathname + (u.search || '')).replace(/^\/+/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 150);
    const file = `api/${n}-${method}-${safe}.json`;
    const rec = { seq: n, ts: new Date().toISOString(), method, url, status: res.status, file, requestBody: body ? JSON.stringify(body) : null, direct: true };
    writeFileSync(join(out, file), JSON.stringify({ meta: rec, body: json }, null, 2));
    appendFileSync(apiIndex, JSON.stringify(rec) + '\n');
    return { status: res.status, body: json };
  },
  get: (path) => api.call('GET', path),
  // wait for the next response matching a URL fragment, returns parsed JSON
  wait: (frag, timeout = 30000) => page.waitForResponse((r) => r.url().includes(frag), { timeout }).then(async (r) => ({ status: r.status(), url: r.url(), body: await r.json().catch(() => null) })),
  // dismiss the "new features" tour / tutorial overlays when they pop up (poll a few seconds)
  dismissTour: async (ms = 5000) => {
    const until = Date.now() + ms; let n = 0;
    while (Date.now() < until) {
      const b = page.getByRole('button', { name: /nicht jetzt|not now|später|skip|überspringen/i }).locator('visible=true').first();
      if (await b.count()) { await b.click().catch(() => {}); n++; await page.waitForTimeout(800); if (n > 3) break; continue; }
      await page.waitForTimeout(400);
    }
    return n > 0;
  },
  // navigate to an app route (paths under /tabs/ are prefixed with the SPA base) and wait for one API response
  goto: async (path, waitFrag, timeout = 30000) => {
    const url = (path.startsWith('/tabs/') ? APP : MYPP) + path;
    const wait = () => (waitFrag ? page.waitForResponse((r) => r.url().includes(waitFrag), { timeout }).catch(() => null) : Promise.resolve(null));
    let p = wait();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const dismissed = await api.dismissTour(4000);
    if (dismissed) { p = wait(); await page.goto(url, { waitUntil: 'domcontentloaded' }); await api.dismissTour(2000); }
    const r = await p;
    await page.waitForTimeout(1200);
    return r ? { status: r.status(), url: r.url(), body: await r.json().catch(() => null) } : null;
  },
};

try {
  const ok = await ensureLoggedIn();
  const result = { env, envId: ENV_ID, login, user: USER, loggedIn: ok, url: page.url() };
  if (ok && scriptPath !== '-') {
    const mod = await import(pathToFileURL(resolve(scriptPath)).href);
    result.script = await mod.default({ page, ctx, out, shot, log, api, env, envId: ENV_ID, login, MYPP, APP });
  } else if (ok) {
    await shot('home');
  }
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (e) {
  log('ERROR', e.stack || String(e));
  await shot('error').catch(() => {});
  process.exitCode = 1;
} finally {
  await ctx.close();
}
