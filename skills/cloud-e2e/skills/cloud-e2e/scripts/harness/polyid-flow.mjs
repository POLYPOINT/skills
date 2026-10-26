// PolyID login-flow driver WITHOUT auto-login (auth scenarios: on-board, password, lockout, 2FA, consent, logout chains).
//   node polyid-flow.mjs <tenant-id> <login|-> <script.mjs> <outdir> [--app mypp|poma|portal|inapp] [--fresh | --profile <dir>]
//        [--headed] [--stage ct|preview] [--max-password-submits N] [--allow-wrong <login>] [--grant-clipboard] [--cred-file <file>]
// A fresh (incognito) context by default so the PolyID forms appear; --profile <dir> reuses a persistent profile. --app inapp
// uses the mobile-app path (Pixel 7 UA, 390 px, touch, window.cordova shim) like mypp-inapp.mjs.
// The script's default export gets {page, ctx, out, shot, log, api, polyid, env, envId, login, MYPP, APP, POMA, PORTAL, urls, app, stage}:
//   polyid.open([app])             entry URL: myPP root | /shift-planner/dashboard | /portal/user-management | in-app root
//   polyid.onboard([email])        e-mail step (#email → #submit-button; in-app #provider-email-input); default <login>@<tenant>.ch
//   polyid.password('SEED'|'WRONG') username + password step (#email_or_username / #password; in-app #name-input / #password-input);
//                                  SEED = the manifest (or --cred-file) password, WRONG = random, in memory; budget enforced
//   polyid.errors()                {errors, warnings} query params + visible .login-error / .login-warning texts
//   polyid.readOtpSecret()         base32 secret of #otp_secret (TOTP enrolment), in memory only — never log or save it
//   polyid.totp(secret)            RFC 6238 code (SHA1, 6 digits, 30 s)
//   polyid.submitOtp(code)         fill the 2FA code field and submit
//   polyid.consent('accept'|'reject')
//   polyid.chain()                 navigation chain: host + path + parameter names; values only for errors, warnings, language,
//                                  providerId; presence flags for code, state, id_token_hint, login_challenge
//   polyid.state()                 {submissions, wrong, lastWasWrong}
// Budget (hard rule 4): at most 2 password submissions per run by default; --max-password-submits N > 2 only together with
//   --allow-wrong <same login> (the lockout scenario, inside its LOGIN window). WRONG is refused unless --allow-wrong names the
//   login. Every wrong password must be followed by a SEED success from the same IP: result.wrongWithoutSuccess flags a miss.
// Recording: app API + polyid-login /api/ responses (redacted); request bodies of /ui/login-form|2fa-form|password-management
//   /submit, /ui/impersonation/* and every /api/auth/* body are never written. shot() masks .otp-img, .qr_code, #otp_secret,
//   .copy-secret-container, .otp-setup-container. chain.json is written at the end. UTF-8 re-encoding of PolyID forms as mypp.mjs.
// Exit: 0 (see result.json), 1 script error, 2 usage, 5 guard / budget refusal.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { loadPlaywright, parseArgs, makeLogger, readManifest, readCredFile, asciiLocal, reencodeForm, safeSeg, totp as totpCode } from './lib/util.mjs';
import { stageUrls, guardUrl, blockedRequestReason, GuardError, TENANT_RE, SHARED_TENANT_RE } from './lib/guard.mjs';
import { safeRecord, redactUrl, redactString, redactDeep, MASK_SELECTORS } from './lib/redact.mjs';

const USAGE = 'usage: node polyid-flow.mjs <tenant-id> <login|-> <script.mjs> <outdir> [--app mypp|poma|portal|inapp] [--fresh|--profile <dir>] [--headed] [--stage ct|preview] [--max-password-submits N] [--allow-wrong <login>] [--grant-clipboard] [--cred-file <file>]';
const { pos, flags } = parseArgs(process.argv.slice(2), ['--app', '--profile', '--stage', '--max-password-submits', '--allow-wrong', '--cred-file']);
const [tenant, loginArg, scriptPath, outdir] = pos;
const die = (code, msg) => { console.error(msg); process.exit(code); };
if (!tenant || !loginArg || !scriptPath || !outdir || pos.length > 4) die(2, USAGE);
const app = flags['--app'] || 'mypp';
if (!['mypp', 'poma', 'portal', 'inapp'].includes(app)) die(2, `--app must be mypp|poma|portal|inapp\n${USAGE}`);
const credFile = flags['--cred-file'] || null;
if (!(credFile ? SHARED_TENANT_RE : TENANT_RE).test(tenant)) die(2, 'tenant-id must be the DeployMate env id (shared tenants: --cred-file)');
const login = loginArg === '-' ? null : loginArg;
const allowWrong = flags['--allow-wrong'] || null;
let maxSubmits = flags['--max-password-submits'] ? Number(flags['--max-password-submits']) : 2;
if (!Number.isInteger(maxSubmits) || maxSubmits < 0 || maxSubmits > 20) die(2, '--max-password-submits must be 0..20');
if (maxSubmits > 2 && (!allowWrong || allowWrong !== login)) die(5, 'GUARD: more than 2 password submissions only with --allow-wrong <the same login> (lockout scenario, inside its LOGIN window)');
const stage = flags['--stage'] || 'ct';

let urls;
try { urls = stageUrls(stage, process.env, app === 'portal' ? ['portalWeb', 'portalApi', 'polyidLogin'] : ['pomaWeb', 'pomaApi', 'polyidLogin']); } catch (e) { die(5, e.message); }
const MYPP = urls.pomaWeb; const APP = MYPP + '/health-professional-app'; const POMA = urls.pomaWeb; const PORTAL = urls.portalWeb;
const ENTRY = { mypp: MYPP + '/', poma: POMA + '/shift-planner/dashboard', portal: PORTAL + '/portal/user-management', inapp: APP + '/' };

let SEED = null; let credEmail = null;
if (login) {
  if (credFile) { const c = readCredFile(credFile, login, tenant); SEED = c.password; credEmail = c.email; }
  else SEED = readManifest(tenant).loginPassword;
}
const EMAIL = process.env.MYPP_EMAIL || credEmail || (login ? `${asciiLocal(login)}@${tenant}.ch` : null);

const out = resolve(outdir);
mkdirSync(join(out, 'api'), { recursive: true });
const log = makeLogger(out, 'harness.log');
const { chromium, devices } = loadPlaywright();
const mobile = app === 'inapp';
const ctxOpts = { viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'de-CH', timezoneId: 'Europe/Zurich' };
if (mobile) Object.assign(ctxOpts, { userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
let browser = null; let ctx;
if (flags['--profile'] && !flags['--fresh']) { mkdirSync(flags['--profile'], { recursive: true }); ctx = await chromium.launchPersistentContext(resolve(flags['--profile']), { headless: !flags['--headed'], ...ctxOpts }); }
else { browser = await chromium.launch({ headless: !flags['--headed'] }); ctx = await browser.newContext(ctxOpts); }
if (flags['--grant-clipboard']) await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
if (mobile) await ctx.addInitScript(() => { window.cordova = window.cordova || {}; });
await ctx.route((u) => !!blockedRequestReason(u.href), (r) => { log('BLOCKED request', redactUrl(r.request().url()).slice(0, 200)); return r.abort(); });
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.setDefaultTimeout(30000);
await page.route(/polyid-login[^/]*\/ui\/.*\/submit/, async (route) => {
  const req = route.request(); const body = req.postData();
  if (req.method() !== 'POST' || !body) return route.continue();
  const fixed = reencodeForm(body);
  if (fixed !== body) return route.continue({ postData: fixed, headers: { ...req.headers(), 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
  return route.continue();
});

// ---- recording + chain -------------------------------------------------------------------------------------------------
const apiBase = app === 'portal' ? urls.portalApi : urls.pomaApi;
const recordHosts = [apiBase, urls.polyidLogin].filter(Boolean).map((h) => new URL(h).host);
const st = { seq: 0, bearer: null, chain: [], submissions: 0, wrong: 0, lastWasWrong: false };
const record = (rec, body) => { const safe = safeRecord(rec, body); try { writeFileSync(join(out, rec.file), JSON.stringify(safe, null, 2)); } catch {} appendFileSync(join(out, 'api-index.jsonl'), JSON.stringify(safe.meta) + '\n'); };
page.on('response', async (resp) => {
  let u; try { u = new URL(resp.url()); } catch { return; }
  if (!resp.url().includes('/api/') || !recordHosts.includes(u.host)) return;
  const req = resp.request();
  if (u.host === new URL(apiBase).host) { const a = (await req.allHeaders().catch(() => ({})))['authorization']; if (a) st.bearer = a; }
  const n = String(++st.seq).padStart(3, '0');
  let body = null; try { const t = await resp.text(); try { body = JSON.parse(t); } catch { body = t; } } catch {}
  record({ seq: n, ts: new Date().toISOString(), method: req.method(), url: resp.url(), status: resp.status(), file: `api/${n}-${req.method()}-${safeSeg(u)}.json`, requestBody: req.postData() ?? null }, body);
});
const VALUE_PARAMS = ['errors', 'warnings', 'language', 'providerId'];
const FLAG_PARAMS = ['code', 'state', 'id_token_hint', 'login_challenge', 'consent_challenge', 'logout_challenge'];
page.on('framenavigated', (f) => {
  if (f !== page.mainFrame()) return;
  let u; try { u = new URL(f.url()); } catch { return; }
  const e = { t: new Date().toISOString(), host: u.host, path: u.pathname, params: [...new Set(u.searchParams.keys())] };
  for (const k of VALUE_PARAMS) if (u.searchParams.has(k)) e[k] = u.searchParams.get(k);
  for (const k of FLAG_PARAMS) if (u.searchParams.has(k)) e[`has_${k}`] = true;
  st.chain.push(e);
});
page.on('pageerror', (e) => log('PAGEERROR', redactString(e.message)));
page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE', redactString(m.text()).slice(0, 300)); });

let shotN = 0;
const shot = async (name, opts = {}) => {
  const f = join(out, `${String(++shotN).padStart(2, '0')}-${name}.png`);
  const mask = [...MASK_SELECTORS.polyid, ...(opts.mask || [])].map((s) => (typeof s === 'string' ? page.locator(s) : s));
  await page.screenshot({ path: f, fullPage: !!opts.fullPage, mask }); log('shot', f); return f;
};
const firstVisible = async (sels) => { for (const s of sels) { const l = page.locator(s).locator('visible=true').first(); if (await l.count()) return l; } return null; };
const clickSubmit = async (sels, re) => { const b = await firstVisible(sels); if (b) return b.click(); return page.getByRole('button', { name: re }).locator('visible=true').first().click(); };

const polyid = {
  open: async (which = app) => { const url = ENTRY[which] || ENTRY[app]; guardUrl('polyid.open', url, stage); await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000); log('open', which, redactUrl(page.url()).split('?')[0]); return page.url(); },
  onboard: async (email = EMAIL) => {
    if (!email) throw new Error('onboard: no e-mail (login "-": pass one)');
    if (app === 'inapp') {
      const f = await firstVisible(['#provider-email-input input', 'input#provider-email-input', 'input[type="email"]']); if (!f) throw new Error('onboard: in-app e-mail field not found');
      await f.fill(''); await f.pressSequentially(email, { delay: 20 }); await clickSubmit(['button.on-board-form-button'], /weiter|senden|next|ok/i);
    } else {
      const f = await firstVisible(['#email', 'input[name="email"]', 'input[type="email"]', 'input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])']); if (!f) throw new Error('onboard: e-mail field not found');
      await f.fill(email); await clickSubmit(['#submit-button', 'button[type="submit"]'], /weiter|senden|next|login|anmelden/i);
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {}); await page.waitForTimeout(1500);
    log('onboard submitted for', email); return page.url();
  },
  password: async (kind = 'SEED') => {
    if (!login) throw new Error('password: no login given ("-")');
    if (!['SEED', 'WRONG'].includes(kind)) throw new Error("password(kind): 'SEED' or 'WRONG'");
    if (kind === 'WRONG' && allowWrong !== login) throw new GuardError(`GUARD: WRONG password refused: --allow-wrong ${login} not given`);
    if (st.submissions >= maxSubmits) throw new GuardError(`GUARD: password budget of ${maxSubmits} submission(s) used up (PolyID locks the caller IP without expiry)`);
    const pw = kind === 'SEED' ? SEED : `Wrong-${randomBytes(6).toString('hex')}!`;
    if (app === 'inapp') {
      const n = await firstVisible(['#name-input input', 'input#name-input']); if (n) { await n.fill(''); await n.pressSequentially(login, { delay: 20 }); }
      const p = await firstVisible(['#password-input input', 'input#password-input', 'input[type="password"]']); if (!p) throw new Error('password: in-app password field not found');
      await p.fill(''); await p.pressSequentially(pw, { delay: 10 }); await clickSubmit(['button.login-form-button'], /anmelden|login|weiter/i);
    } else {
      const u = await firstVisible(['#email_or_username', 'input[name="username"]']); if (u && (await u.inputValue()) !== login) await u.fill(login);
      const p = await firstVisible(['#password', 'input[type="password"]']); if (!p) throw new Error('password: password field not found');
      await p.fill(pw); await clickSubmit(['#submit-button', 'button[type="submit"]'], /senden|anmelden|login|sign in|weiter|next/i);
    }
    st.submissions++; if (kind === 'WRONG') st.wrong++; st.lastWasWrong = kind === 'WRONG';
    await page.waitForLoadState('domcontentloaded').catch(() => {}); await page.waitForTimeout(2500);
    log('password submitted', kind, `(${st.submissions}/${maxSubmits})`, 'now at', redactUrl(page.url()).split('?')[0]);
    return page.url();
  },
  errors: async () => {
    let u; try { u = new URL(page.url()); } catch { u = null; }
    const texts = await page.locator('.login-error, .login-warning, .alert-error, .alert-warning, .error-message').locator('visible=true').allInnerTexts().catch(() => []);
    return { errors: u?.searchParams.get('errors') ?? null, warnings: u?.searchParams.get('warnings') ?? null, texts: texts.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean) };
  },
  readOtpSecret: async () => {
    const el = page.locator('#otp_secret').first();
    if (!(await el.count())) return null;
    const v = (await el.inputValue().catch(() => null)) || (await el.textContent().catch(() => null));
    return v ? v.replace(/\s+/g, '') : null;
  },
  totp: (secret) => totpCode(secret),
  submitOtp: async (code) => {
    const f = await firstVisible(['#otp', '#code', 'input[name="otp"]', 'input[name="code"]', 'input[autocomplete="one-time-code"]']); if (!f) throw new Error('submitOtp: code field not found');
    await f.fill(String(code)); await clickSubmit(['#submit-button', 'button[type="submit"]'], /senden|bestätigen|weiter|verify|ok/i);
    await page.waitForLoadState('domcontentloaded').catch(() => {}); await page.waitForTimeout(2000); log('2FA code submitted'); return page.url();
  },
  consent: async (choice = 'accept') => {
    if (app === 'inapp' && choice === 'accept') { for (const cb of await page.locator('input[type="checkbox"]:visible, ion-checkbox:visible').all()) await cb.click().catch(() => {}); await page.locator('#btn-accept:visible').click(); }
    else if (choice === 'accept') {
      for (const cb of await page.locator('input[type="checkbox"]:visible').all()) { if (!(await cb.isChecked())) await cb.check().catch(() => cb.click()); }
      await page.getByRole('button', { name: /zustimmen|accept|agree|consentir|accetta/i }).locator('visible=true').first().click();
    } else await page.getByRole('button', { name: /ablehnen|reject|decline|refuser|rifiuta/i }).locator('visible=true').first().click();
    await page.waitForLoadState('domcontentloaded').catch(() => {}); await page.waitForTimeout(1500); log('consent', choice); return page.url();
  },
  chain: () => st.chain.map((e) => ({ ...e })),
  state: () => ({ submissions: st.submissions, wrong: st.wrong, lastWasWrong: st.lastWasWrong }),
};

const api = {
  token: () => st.bearer,
  call: async (method, path, body) => {
    if (!st.bearer) throw new Error('no bearer token captured yet');
    const url = guardUrl('api.call', path.startsWith('http') ? path : apiBase + path, stage).href;
    const res = await fetch(url, { method, headers: { authorization: st.bearer, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { json = text; }
    const n = String(++st.seq).padStart(3, '0');
    record({ seq: n, ts: new Date().toISOString(), method, url, status: res.status, file: `api/${n}-${method}-${safeSeg(new URL(url))}.json`, requestBody: body ? JSON.stringify(body) : null, direct: true }, json);
    return { status: res.status, body: json };
  },
  get: (path) => api.call('GET', path),
  wait: (frag, timeout = 30000) => page.waitForResponse((r) => r.url().includes(frag), { timeout }).then(async (r) => ({ status: r.status(), url: r.url(), body: await r.json().catch(() => null) })),
  seen: () => null,
};

const result = { env: tenant, envId: tenant, login, app, stage, user: EMAIL };
try {
  const mod = await import(pathToFileURL(resolve(scriptPath)).href);
  result.script = await mod.default({ page, ctx, out, shot, log, api, polyid, env: tenant, envId: tenant, login, MYPP, APP, POMA, PORTAL, urls, app, stage });
} catch (e) {
  log('ERROR', redactString(e.stack || String(e)));
  await shot('error').catch(() => {});
  result.error = redactString(String(e.message || e));
  process.exitCode = e instanceof GuardError ? 5 : 1;
} finally {
  Object.assign(result, { submissions: st.submissions, wrong: st.wrong, wrongWithoutSuccess: st.lastWasWrong, url: redactUrl(page.url()).split('?')[0] });
  if (st.lastWasWrong) log('WARN: the last password submission was WRONG — follow it with a SEED success from this IP (hard rule 4)');
  writeFileSync(join(out, 'chain.json'), JSON.stringify(st.chain, null, 1));
  const safe = redactDeep(result);
  writeFileSync(join(out, 'result.json'), JSON.stringify(safe, null, 2));
  console.log(JSON.stringify(safe));
  await ctx.close().catch(() => {}); if (browser) await browser.close().catch(() => {});
}
