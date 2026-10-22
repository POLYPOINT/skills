// CT-only PolyID brute-force lockout helper (USER_OR_IP_LOCKED): read / remove the applied policies of one tenant's provider.
//   node polyid-unlock.mjs <profileDir> <outDir> <tenant-id> <login|read|unlock> [--subject <ip|username|my-ip>] [--provider <id>]
// ORCHESTRATOR ONLY, on behalf of the operator running the E2E, after the operator's headed login. Workers never run it.
// Model: portal-flag.mjs. The PolyID ops frontend is served by polyid-login itself under /ops/ (AdminWebappController); its
// admin API is <polyid-login>/api/admin (Apis.POLYID_LOGIN = environment.baseUrl + '/api/admin', environment.ct.ts baseUrl =
// https://ct-polyid-login.dev.k8s.polypoint-dev.com). The SPA keeps its OIDC user IN MEMORY (oidc-client-ts InMemoryWebStorage)
// and re-acquires a token from the PolyID SSO session cookies of the persistent profile on every load; the script captures the
// Bearer the SPA sends to /api/admin/ and calls the API directly with it (never printed, never written).
// login  : HEADED window on <ops>/security; the operator signs in with an account holding support-ops/admin rights
//          (isSupportOperationsOrAdmin). Waits up to 5 min for an authenticated admin call (GET /applied-policies/summary 200).
// read   : HEADLESS. Provider id = GET /api/admin/providers/<tenant-id> → id (or --provider / POLYID_PROVIDER_ID), then
//          GET /applied-policies/provider/<id>?exceeds-threshold=true (= locked rows), GET /applied-policies/summary,
//          GET /security-policies/provider/<id> (thresholds). Prints subject, policy, attempts, lock threshold, last attempt and
//          unlockAt (= last_attempt + expiration_window_sec, the formula of LockedState); writes <outDir>/applied-policies.json.
// unlock : HEADLESS. --subject is mandatory: one exact subject (IP or username), no wildcards, no commas (Spring would split
//          them into several subjects), never empty (a DELETE without subject wipes EVERY applied policy of the provider).
//          `--subject my-ip` = this machine's public IP from the deploymate skill (`dm-api.sh my-ip`; script path via
//          DM_API_SH). The subject must exist among the provider's applied policies first (else exit 2, nothing deleted);
//          then DELETE /applied-policies/provider/<id>?subject=<subject> and re-read to prove it is gone.
// Stages: --stage ct (default) or preview may be unlocked by the orchestrator after the operator's
//          headed login; --stage staging runs on the PRODUCTION cluster: the script refuses every call and only prints
//          the manual instructions for the operator (exit 7). Hard guard: hosts must be CT (`ct-*.dev.k8s.polypoint-dev.com`)
//          or Preview (`preview-*.demo.k8s.polypoint-dev.com`), https, no "prod", no polypointservices.ch; the target is
//          printed first; every API call is checked against the polyid-login origin.
// Env: POLYID_LOGIN_URL (default per stage: ct https://ct-polyid-login.dev.k8s.polypoint-dev.com, preview
//      https://preview-polyid-login.demo.k8s.polypoint-dev.com), POLYID_OPS_URL (default <login>/ops),
//      POLYID_PROVIDER_ID, DM_API_SH (dm-api.sh path), DM_CONFIG_DIR (Playwright location, as mypp.mjs).
// Exit codes: 0 ok; 2 provider or subject not found (nothing deleted); 3 LOGIN_NEEDED (run login with the operator; login:
//   timeout); 4 subject still present after the DELETE; 5 usage / guard refusal; 6 403 (account lacks admin rights) or
//   unexpected HTTP status; 7 staging (production cluster): nothing called, operator must unlock manually.
// NOT yet run against the live CT stage (written 2026-10-16 from the repo; only `node --check`ed).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const USAGE = 'usage: node polyid-unlock.mjs <profileDir> <outDir> <tenant-id> <login|read|unlock> [--stage ct|preview|staging] [--subject <ip|username|my-ip>] [--provider <id>]';
const die = (code, msg) => { console.error(msg); process.exit(code); };

// ---- arguments ---------------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v ?? ''; };
const subjectArg = opt('--subject');
const stage = (opt('--stage') || process.env.POLYID_STAGE || 'ct').toLowerCase();
if (!['ct', 'preview', 'staging'].includes(stage)) die(5, '--stage must be ct, preview or staging');
const providerArg = opt('--provider') ?? process.env.POLYID_PROVIDER_ID;
const [profile, out, tenant, action, ...rest] = argv;
if (!profile || !out || !tenant || !['login', 'read', 'unlock'].includes(action) || rest.length) die(5, USAGE);
if (!/^[a-z][a-z0-9-]{0,14}$/.test(tenant)) die(5, 'tenant-id must be the DeployMate env id (= CT tenant id), ^[a-z][a-z0-9-]{0,14}$');
if (providerArg !== undefined && !/^[0-9]{1,9}$/.test(providerArg)) die(5, '--provider must be a numeric PolyID provider id');
if (action === 'unlock' && subjectArg === undefined) die(5, 'unlock refuses to run without --subject <ip|username|my-ip>');
if (action !== 'unlock' && subjectArg !== undefined) die(5, '--subject only applies to unlock');

// ---- stage guard (CT / Preview only; Staging = production cluster: instructions only) ---------------------------------
if (stage === 'staging') {
  const subj = subjectArg && subjectArg !== 'my-ip' ? subjectArg : '<this machine\'s public IP or the locked test user>';
  console.log('STAGING runs on the PRODUCTION cluster: this script makes no call there.');
  console.log('Ask the operator to unlock manually: https://staging-polyid-login.polypointservices.ch/ops/ → Security → applied');
  console.log(`policies of the provider of tenant "${tenant}" → remove ONLY the locked subject ${subj}.`);
  process.exit(7);
}
const STAGE_DEFAULT = { ct: 'https://ct-polyid-login.dev.k8s.polypoint-dev.com', preview: 'https://preview-polyid-login.demo.k8s.polypoint-dev.com' };
const LOGIN = (process.env.POLYID_LOGIN_URL || STAGE_DEFAULT[stage]).replace(/\/+$/, '');
const OPS = (process.env.POLYID_OPS_URL || `${LOGIN}/ops`).replace(/\/+$/, '');
const CT_HOST = stage === 'preview' ? /^preview-[a-z0-9-]+\.demo\.k8s\.polypoint-dev\.com$/ : /^ct-[a-z0-9-]+\.dev\.k8s\.polypoint-dev\.com$/;
const guard = (label, raw) => {
  let u; try { u = new URL(raw); } catch { die(5, `GUARD: ${label} is not a URL: ${raw}`); }
  const h = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || !CT_HOST.test(h) || /prod/.test(h) || /polypointservices\.ch$/.test(h) || u.port) {
    die(5, `GUARD: refusing ${label} host "${h}" — stage ${stage} allows only ${stage === 'preview' ? 'preview-*.demo.k8s.polypoint-dev.com' : 'ct-*.dev.k8s.polypoint-dev.com'}, never production`);
  }
  return u;
};
const loginUrl = guard('POLYID_LOGIN_URL', LOGIN);
const opsUrl = guard('POLYID_OPS_URL', OPS);
if (opsUrl.origin !== loginUrl.origin) die(5, `GUARD: ops frontend (${opsUrl.origin}) must be served by polyid-login (${loginUrl.origin})`);
const ADMIN = `${loginUrl.origin}/api/admin`;
console.log(`TARGET polyid-login=${loginUrl.host} ops=${opsUrl.origin}${opsUrl.pathname} tenant=${tenant} action=${action}`);

// ---- subject (unlock) --------------------------------------------------------------------------------------------------
const SUBJECT_OK = /^[\p{L}\p{N}._@:+-]{1,320}$/u; // IPv4/IPv6 or a username / e-mail; no wildcards, commas, spaces, '%', '*'
const scriptDir = dirname(fileURLToPath(import.meta.url));
const myIp = () => {
  const cands = [process.env.DM_API_SH, resolve(scriptDir, '../../../../../deploymate/skills/deploymate/scripts/dm-api.sh'),
    join(homedir(), 'skills/skills/deploymate/skills/deploymate/scripts/dm-api.sh')].filter(Boolean);
  const sh = cands.find((p) => existsSync(p));
  if (!sh) die(5, `my-ip: dm-api.sh not found (set DM_API_SH); tried ${cands.join(', ')}`);
  let ip;
  try { ip = execFileSync(sh, ['my-ip'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 60000 }).trim(); }
  catch (e) { die(5, `my-ip: dm-api.sh my-ip failed (${e.status ?? e.message}); pass the IP explicitly`); }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && !/^[0-9a-f:]{2,39}$/i.test(ip)) die(5, `my-ip: unexpected answer "${ip}"`);
  console.log(`my-ip resolved via ${sh}: ${ip}`);
  return ip;
};
let subject;
if (action === 'unlock') {
  subject = subjectArg === 'my-ip' ? myIp() : subjectArg;
  if (!subject || !SUBJECT_OK.test(subject)) die(5, `unlock refuses subject ${JSON.stringify(subject)}: one exact IP or username, no wildcards / commas / spaces`);
}

// ---- browser session ---------------------------------------------------------------------------------------------------
const DM_DIR = process.env.DM_CONFIG_DIR || join(homedir(), '.config/deploymate');
const { chromium } = createRequire(join(DM_DIR, '/'))('playwright');
mkdirSync(out, { recursive: true });
const log = (...a) => { const l = `[${new Date().toISOString()}] ` + a.join(' '); console.log(l); appendFileSync(join(out, 'polyid-unlock.log'), l + '\n'); };
const headed = action === 'login';
const ctx = await chromium.launchPersistentContext(profile, { headless: !headed, viewport: { width: 1400, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
let bearer = null; let adminOk = false;
page.on('request', async (r) => {
  if (!r.url().startsWith(ADMIN + '/')) return;
  const a = (await r.allHeaders().catch(() => ({})))['authorization'];
  if (a && /^Bearer\s+\S+/.test(a)) bearer = a;
});
page.on('response', (r) => {
  if (!r.url().startsWith(ADMIN + '/')) return;
  log('spa-api', r.status(), r.request().method(), r.url().slice(loginUrl.origin.length).split('?')[0]);
  if (r.status() === 200) adminOk = true;
});
const finish = async (code, msg) => { if (msg) log(msg); await ctx.close().catch(() => {}); process.exit(code); };

// Direct admin API call with the captured Bearer; guarded to the CT polyid-login origin.
const api = async (method, path) => {
  const url = ADMIN + path;
  if (new URL(url).origin !== loginUrl.origin) await finish(5, `GUARD: refusing call outside ${loginUrl.origin}`);
  const res = await fetch(url, { method, headers: { authorization: bearer, accept: 'application/json' } });
  const text = await res.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text.slice(0, 300); }
  log('api', res.status, method, path);
  if (res.status === 401) await finish(3, 'LOGIN_NEEDED (401 from the admin API; run the login action with the operator)');
  if (res.status === 403) await finish(6, 'FORBIDDEN (403): the signed-in account lacks support-ops/admin rights in PolyID');
  return { status: res.status, body };
};

await page.goto(`${opsUrl.origin}${opsUrl.pathname}/security`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => log('goto err', e.message));
const deadline = Date.now() + (headed ? 300000 : 45000);
if (headed) log('LOGIN: sign in to the PolyID ops frontend in the opened window; waiting up to 5 min for an authenticated admin call');
while (Date.now() < deadline && !(bearer && adminOk)) await page.waitForTimeout(1000);
if (!(bearer && adminOk)) {
  await page.screenshot({ path: join(out, `${action}-no-session.png`) }).catch(() => {});
  const at = (() => { try { const u = new URL(page.url()); return u.host + u.pathname; } catch { return '?'; } })();
  await finish(3, `${headed ? 'login timeout' : 'LOGIN_NEEDED (run the login action)'}; page at ${at}`);
}
const probe = await api('GET', '/applied-policies/summary');
if (probe.status !== 200) await finish(headed ? 3 : 6, `admin probe failed: HTTP ${probe.status}`);
if (headed) await finish(0, 'login OK (session stored in the profile)');

// ---- provider ----------------------------------------------------------------------------------------------------------
let providerId = providerArg;
const providerInfo = { tenant, source: providerArg ? 'argument' : 'GET /providers/{tenant}' };
if (!providerId) {
  const p = await api('GET', `/providers/${encodeURIComponent(tenant)}`);
  if (p.status !== 200 || !p.body || p.body.id == null) await finish(2, `provider of tenant ${tenant} not found (HTTP ${p.status}); pass --provider <id> (ops frontend → Provider editor)`);
  providerId = String(p.body.id);
  Object.assign(providerInfo, { name: p.body.name, domains: (p.body.domains || []).map((d) => d.domain) });
  if (!providerInfo.domains.includes(`${tenant}.ch`)) log(`WARN provider ${providerId} domains ${JSON.stringify(providerInfo.domains)} do not list ${tenant}.ch — check emailDomain`);
}
providerInfo.id = Number(providerId);
log('provider', JSON.stringify(providerInfo));

const readState = async () => {
  const locked = await api('GET', `/applied-policies/provider/${providerId}?exceeds-threshold=true`);
  if (locked.status !== 200) await finish(6, `applied-policies read failed: HTTP ${locked.status}`);
  const summary = await api('GET', '/applied-policies/summary');
  const pol = await api('GET', `/security-policies/provider/${providerId}`);
  const policies = pol.status === 200 && Array.isArray(pol.body) ? pol.body : [];
  const byId = new Map(policies.map((p) => [p.id, p]));
  const rows = (locked.body || []).map((a) => {
    const sp = byId.get(a.security_policy_id) || {};
    const win = sp.expiration_window_sec;
    const unlockAt = a.last_attempt && win ? new Date(Date.parse(a.last_attempt) + win * 1000).toISOString() : null;
    return { subject: a.affected_subject, policy: sp.policy ?? a.security_policy_id, attempts: a.attempts, lockThreshold: sp.lock_threshold ?? null,
      locked: a.locked, lastAttempt: a.last_attempt ?? null, expirationWindowSec: win ?? null, unlockAt, needsAdminRights: sp.needs_admin_rights ?? null, id: a.id };
  });
  const providerSummary = (summary.body?.providers || []).find((p) => String(p.provider_id) === String(providerId)) || null;
  return { rows, providerSummary, summary: summary.body, policies };
};
const print = (rows) => {
  if (!rows.length) { log(`no locked subjects on provider ${providerId}`); return; }
  for (const r of rows) log(`LOCKED subject=${r.subject} policy=${r.policy} attempts=${r.attempts}/${r.lockThreshold ?? '?'} lastAttempt=${r.lastAttempt} unlockAt=${r.unlockAt ?? 'n/a'} needsAdminRights=${r.needsAdminRights}`);
};

// ---- read --------------------------------------------------------------------------------------------------------------
if (action === 'read') {
  const s = await readState();
  print(s.rows);
  log('summary(provider)', JSON.stringify(s.providerSummary));
  writeFileSync(join(out, 'applied-policies.json'), JSON.stringify({ at: new Date().toISOString(), host: loginUrl.host, provider: providerInfo, locked: s.rows, providerSummary: s.providerSummary, summary: s.summary, policies: s.policies }, null, 1));
  await finish(0, `written ${join(out, 'applied-policies.json')}`);
}

// ---- unlock ------------------------------------------------------------------------------------------------------------
const q = `?subject=${encodeURIComponent(subject)}`;
const before = await api('GET', `/applied-policies/provider/${providerId}${q}`);
const present = (b) => (Array.isArray(b) ? b : []).filter((a) => a.affected_subject === subject);
if (before.status !== 200) await finish(6, `pre-read failed: HTTP ${before.status}`);
const pre = present(before.body);
if (!pre.length) {
  print((await readState()).rows);
  await finish(2, `subject ${subject} has no applied policy on provider ${providerId}: nothing deleted (pick a subject from the list above)`);
}
log(`before: ${pre.length} applied polic${pre.length === 1 ? 'y' : 'ies'} for ${subject}`, JSON.stringify(pre.map((a) => ({ id: a.id, attempts: a.attempts, locked: a.locked, last_attempt: a.last_attempt }))));
const del = await api('DELETE', `/applied-policies/provider/${providerId}${q}`);
if (del.status < 200 || del.status >= 300) await finish(6, `DELETE failed: HTTP ${del.status} ${JSON.stringify(del.body)}`);
const after = await api('GET', `/applied-policies/provider/${providerId}${q}`);
const post = present(after.body);
const s = await readState();
print(s.rows);
writeFileSync(join(out, 'applied-policies.json'), JSON.stringify({ at: new Date().toISOString(), host: loginUrl.host, provider: providerInfo, unlocked: subject, before: pre, afterForSubject: post, locked: s.rows, providerSummary: s.providerSummary }, null, 1));
if (after.status !== 200 || post.length) await finish(4, `subject ${subject} STILL PRESENT after the DELETE (HTTP ${after.status}, ${post.length} row(s))`);
await finish(0, `unlocked ${subject} on provider ${providerId} (re-read: gone)`);
