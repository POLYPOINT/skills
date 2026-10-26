// Partner PWA embedding-mock driver (partner family PW, shared group: ct-zinc-master mock users only).
//   node pwa-embed.mjs <outdir> <script.mjs|-> [--stage ct|preview] [--headed] [--profile <dir>] [--mock-path <path>]
// Opens <gateway-mock>/partner-pwa-embedding-mock/ (or --mock-path) in a FRESH context (default; --profile reuses one), captures
// every POST <polyid-login>/api/auth/partner-sessions (request {partner_id, code_challenge, customer_id, tenant_id}, status,
// outcome, decoded claims of a returned token — the token itself is never written) into partner-sessions.json, records the
// embedded myPP's poma-api responses (redacted) as api/NNN-*.json, then runs the script's default export:
//   async ({page, ctx, out, shot, log, frame, myppFrame, sessions, claims, urls}) => {}
//   frame()      FrameLocator of the first iframe (the embedded myPP); myppFrame() the Frame whose URL is the myPP SPA
//   sessions()   the partner-sessions captured so far; claims(token) header + payload of a JWT (in memory)
// The mock knows only hard-coded users of shared CT tenants (ct-zinc-master: antbe = code_challenge_3, aermo = code_challenge_4);
// resetting a user's partner link is polyid-admin.mjs reset-partner-link inside window W-SH-ANTBE (owners' consent).
// "-" opens the mock, waits for the first partner-sessions call (≤ 20 s) and takes a screenshot.
// Answering POLYPOINT-AUTH-INIT with another tenant / challenge (to embed a DeployMate tenant) is NOT implemented: it needs a
// PolyID + portal partner for that tenant (stage registry, steward + user OK).
// Exit: 0, 1 script error, 2 usage, 5 guard refusal.
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlaywright, parseArgs, makeLogger, decodeJwt, safeSeg } from './lib/util.mjs';
import { stageUrls, guardUrl, blockedRequestReason, GuardError } from './lib/guard.mjs';
import { safeRecord, redactDeep, redactString, MASK_SELECTORS } from './lib/redact.mjs';

const USAGE = 'usage: node pwa-embed.mjs <outdir> <script.mjs|-> [--stage ct|preview] [--headed] [--profile <dir>] [--mock-path <path>]';
const { pos, flags } = parseArgs(process.argv.slice(2), ['--stage', '--profile', '--mock-path']);
const [outdir, scriptPath] = pos;
if (!outdir || !scriptPath || pos.length > 2) { console.error(USAGE); process.exit(2); }
const stage = flags['--stage'] || 'ct';
let urls, mockUrl;
try {
  urls = stageUrls(stage, process.env, ['gwmock', 'polyidLogin', 'pomaApi']);
  mockUrl = guardUrl('mock', urls.gwmock + (flags['--mock-path'] || '/partner-pwa-embedding-mock/'), stage, { gwmock: true }).href;
} catch (e) { console.error(e.message); process.exit(5); }
const out = resolve(outdir);
mkdirSync(join(out, 'api'), { recursive: true });
const log = makeLogger(out, 'harness.log');
const { chromium } = loadPlaywright();
let browser = null; let ctx;
const opts = { viewport: { width: 1280, height: 900 }, locale: 'de-CH', timezoneId: 'Europe/Zurich', ignoreHTTPSErrors: true };
if (flags['--profile']) ctx = await chromium.launchPersistentContext(resolve(flags['--profile']), { headless: !flags['--headed'], ...opts });
else { browser = await chromium.launch({ headless: !flags['--headed'] }); ctx = await browser.newContext(opts); }
await ctx.route((u) => !!blockedRequestReason(u.href), (r) => { log('BLOCKED request', r.request().url().slice(0, 120)); return r.abort(); });
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.setDefaultTimeout(30000);

const claims = (tok) => { const d = decodeJwt(tok); return d ? { header: d.header, payload: d.payload } : null; };
const SESS = `${urls.polyidLogin}/api/auth/partner-sessions`;
const apiHost = new URL(urls.pomaApi).host;
const captured = []; let seq = 0;
page.on('response', async (resp) => {
  const url = resp.url(); const req = resp.request();
  if (url.startsWith(SESS) && req.method() === 'POST') {
    let body = null; try { body = await resp.json(); } catch { body = null; }
    let request = null; try { request = JSON.parse(req.postData() || 'null'); } catch { request = null; }
    const tok = body && typeof body === 'object' ? Object.values(body).find((v) => typeof v === 'string' && v.split('.').length === 3 && v.startsWith('eyJ')) : null;
    const e = { at: new Date().toISOString(), request: redactDeep(request), status: resp.status(), outcome: body?.status ?? body?.name ?? body?.error ?? null, claims: tok ? claims(tok) : null };
    captured.push(e); log('partner-sessions', e.status, e.outcome ?? '', 'partner', request?.partner_id ?? '?', 'tenant', request?.tenant_id ?? '?');
    writeFileSync(join(out, 'partner-sessions.json'), JSON.stringify(captured, null, 1));
    return;
  }
  let u; try { u = new URL(url); } catch { return; }
  if (u.host !== apiHost || !url.includes('/api/')) return;
  const n = String(++seq).padStart(3, '0');
  let body = null; try { const t = await resp.text(); try { body = JSON.parse(t); } catch { body = t; } } catch {}
  const safe = safeRecord({ seq: n, ts: new Date().toISOString(), method: req.method(), url, status: resp.status(), file: `api/${n}-${req.method()}-${safeSeg(u)}.json`, requestBody: req.postData() ?? null }, body);
  writeFileSync(join(out, safe.meta.file), JSON.stringify(safe, null, 2)); appendFileSync(join(out, 'api-index.jsonl'), JSON.stringify(safe.meta) + '\n');
});
page.on('pageerror', (e) => log('PAGEERROR', redactString(e.message)));

let shotN = 0;
const shot = async (name) => { const f = join(out, `${String(++shotN).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: f, mask: MASK_SELECTORS.polyid.map((s) => page.locator(s)) }); log('shot', f); return f; };
const frame = () => page.frameLocator('iframe').first();
const myppFrame = () => page.frames().find((f) => /health-professional-app/.test(f.url())) || null;

const result = { mock: mockUrl, stage };
try {
  await page.goto(mockUrl, { waitUntil: 'domcontentloaded' });
  if (scriptPath === '-') {
    const until = Date.now() + 20000; while (Date.now() < until && !captured.length) await page.waitForTimeout(1000);
    await shot('mock');
  } else {
    const mod = await import(pathToFileURL(resolve(scriptPath)).href);
    result.script = await mod.default({ page, ctx, out, shot, log, frame, myppFrame, sessions: () => captured.map((e) => ({ ...e })), claims, urls });
  }
} catch (e) {
  log('ERROR', redactString(e.stack || String(e))); await shot('error').catch(() => {});
  process.exitCode = e instanceof GuardError ? 5 : 1;
} finally {
  result.sessions = captured.length;
  writeFileSync(join(out, 'partner-sessions.json'), JSON.stringify(captured, null, 1));
  writeFileSync(join(out, 'result.json'), JSON.stringify(redactDeep(result), null, 2));
  console.log(JSON.stringify(redactDeep(result)));
  await ctx.close().catch(() => {}); if (browser) await browser.close().catch(() => {});
}
