// PolyID ops admin helper (CT / Preview) for the cloud-e2e groups: provider and user reads, per-user 2FA / state / OTP / session
// resets, partner and Teams link resets, audit, applied policies, steward-only lockout unlock.
//   node polyid-admin.mjs <profileDir> <outDir> <tenant-id> <cmd> [args] [--stage ct|preview|staging] [--provider <id>] [options]
// Commands:
//   login                                    HEADED window on <ops>/security; the operator signs in (support-ops / admin rights)
//   applied-policies                         locked subjects of the tenant's provider → applied-policies.json (= polyid-unlock read)
//   unlock --subject <ip|username|my-ip>     STEWARD ONLY (DeployMate owner of <tenant>, checked through dm-api.sh): delete the
//                                            applied policies of ONE exact subject, re-read to prove it is gone
//   provider-read                            provider details (clientSecret → [redacted]) → provider.json
//   provider-2fa <DISABLED|TOTP|MOBILE_OR_EMAIL> --window <window-id>   config-window owner only (W-Y-TENANT2FA): PUT the provider
//                                            with capabilities.twoFactorType changed; before/after written (redacted)
//   user-read <username>                     PolyID user (state, 2FA override, otp_verified, links) → user-<username>.json
//   user-2fa <username> <DEFAULT|DISABLED|TOTP|MOBILE_OR_EMAIL>          per-user 2FA override (DEFAULT = no override)
//   reset-otp <username>                     DELETE the user's OTP enrolment (re-enrol on next login)
//   user-state <username> <ACTIVE|BLOCKED|DISABLED|TEMPORARY_BLOCK> --reason <text>
//   revoke-sessions <username>               DELETE the user's Hydra sessions
//   reset-teams-link <username>              DELETE the MS Teams link of the user (tenant + tenant subject)
//   reset-partner-link <username>            DELETE the user's partner link
//   audit [--since ISO] [--target-type T]    PolyID admin audit log of the tenant → audit.json
// User writes are done by the worker that owns that actor (its claimed login); provider-2fa and unlock are not for workers.
// The SPA keeps its OIDC user IN MEMORY and re-acquires a token from the PolyID SSO cookies of the persistent profile on every
// load; the script captures the Bearer the SPA sends to /api/admin/ and calls the API directly with it (never printed or written).
// Stages: ct (default) or preview after the operator's headed login; staging runs on the PRODUCTION cluster: nothing is called,
//   manual instructions are printed (exit 7). Hard guard: CT / Preview hosts only (lib/guard.mjs), every call checked against
//   the polyid-login origin. Env: POLYID_LOGIN_URL, POLYID_OPS_URL (default <login>/ops), POLYID_PROVIDER_ID, DM_API_SH,
//   DM_CONFIG_DIR, POLYID_ADMIN_LOG (log file name, default polyid-admin.log).
// Exit codes: 0 ok; 2 provider / subject / user not found (nothing changed); 3 LOGIN_NEEDED; 4 change not applied (re-read
//   differs) or subject still present; 5 usage / guard refusal; 6 403 (missing ops rights) or unexpected HTTP; 7 staging.
// NOT yet run against the live CT stage (user / provider writes written 2026-10-23 from the polyid-login admin API code).
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, parseArgs, decodeJwt } from './lib/util.mjs';
import { guardUrl, TENANT_RE, STAGES } from './lib/guard.mjs';
import { redactDeep } from './lib/redact.mjs';

const CMDS = ['login', 'applied-policies', 'unlock', 'provider-read', 'provider-2fa', 'user-read', 'user-2fa', 'reset-otp', 'user-state', 'revoke-sessions', 'reset-teams-link', 'reset-partner-link', 'audit'];
const USAGE = `usage: node polyid-admin.mjs <profileDir> <outDir> <tenant-id> <${CMDS.join('|')}> [args] [--stage ct|preview|staging] [--provider <id>] [--subject <ip|username|my-ip>] [--reason <text>] [--window <id>] [--since ISO]`;
const die = (code, msg) => { console.error(msg); process.exit(code); };

const { pos, flags } = parseArgs(process.argv.slice(2), ['--stage', '--provider', '--subject', '--reason', '--window', '--since', '--target-type']);
const [profile, outArg, tenant, action, ...args] = pos;
const stage = String(flags['--stage'] || process.env.POLYID_STAGE || 'ct').toLowerCase();
if (!['ct', 'preview', 'staging'].includes(stage)) die(5, '--stage must be ct, preview or staging');
if (!profile || !outArg || !tenant || !CMDS.includes(action)) die(5, USAGE);
if (!TENANT_RE.test(tenant) && !/^[a-z][a-z0-9-]{0,62}$/.test(tenant)) die(5, 'tenant-id must be the CT tenant id (DeployMate env id), ^[a-z][a-z0-9-]{0,14}$');
const providerArg = flags['--provider'] ?? process.env.POLYID_PROVIDER_ID;
if (providerArg !== undefined && !/^[0-9]{1,9}$/.test(String(providerArg))) die(5, '--provider must be a numeric PolyID provider id');
const subjectArg = flags['--subject'];
if (action === 'unlock' && (subjectArg === undefined || subjectArg === true)) die(5, 'unlock refuses to run without --subject <ip|username|my-ip>');
if (action !== 'unlock' && subjectArg !== undefined) die(5, '--subject only applies to unlock');
const needUser = ['user-read', 'user-2fa', 'reset-otp', 'user-state', 'revoke-sessions', 'reset-teams-link', 'reset-partner-link'];
const USERNAME_OK = /^[\p{L}\p{N}._@+-]{1,320}$/u;
if (needUser.includes(action) && !USERNAME_OK.test(args[0] || '')) die(5, `${action} needs <username> (the tenant IDM login, e.g. dmseed-<kuerzel>)`);
const TFA_USER = ['DEFAULT', 'DISABLED', 'TOTP', 'MOBILE_OR_EMAIL'];
const TFA_PROVIDER = ['DISABLED', 'TOTP', 'MOBILE_OR_EMAIL'];
const STATES = ['ACTIVE', 'BLOCKED', 'DISABLED', 'TEMPORARY_BLOCK'];
if (action === 'user-2fa' && !TFA_USER.includes(args[1])) die(5, `user-2fa <username> <${TFA_USER.join('|')}>`);
if (action === 'user-state' && (!STATES.includes(args[1]) || !flags['--reason'] || flags['--reason'] === true)) die(5, `user-state <username> <${STATES.join('|')}> --reason <text>`);
if (action === 'provider-2fa' && (!TFA_PROVIDER.includes(args[0]) || !flags['--window'] || flags['--window'] === true)) die(5, `provider-2fa <${TFA_PROVIDER.join('|')}> --window <config window id, e.g. W-Y-TENANT2FA> (config-window owner only)`);

// ---- stage guard (CT / Preview only; Staging = production cluster: instructions only) ---------------------------------
if (stage === 'staging') {
  const subj = subjectArg && subjectArg !== 'my-ip' ? subjectArg : '<this machine\'s public IP or the locked test user>';
  console.log('STAGING runs on the PRODUCTION cluster: this script makes no call there.');
  console.log('Ask the operator to act manually in the PolyID ops frontend of Staging (Security → applied policies / Users)');
  console.log(`for tenant "${tenant}"${action === 'unlock' ? ` → remove ONLY the locked subject ${subj}` : ''}.`);
  process.exit(7);
}
let loginUrl, opsUrl;
try {
  const LOGIN = String(process.env.POLYID_LOGIN_URL || STAGES[stage].polyidLogin).replace(/\/+$/, '');
  const OPS = String(process.env.POLYID_OPS_URL || `${LOGIN}/ops`).replace(/\/+$/, '');
  loginUrl = guardUrl('POLYID_LOGIN_URL', LOGIN, stage);
  opsUrl = guardUrl('POLYID_OPS_URL', OPS, stage);
} catch (e) { die(5, e.message); }
if (opsUrl.origin !== loginUrl.origin) die(5, `GUARD: ops frontend (${opsUrl.origin}) must be served by polyid-login (${loginUrl.origin})`);
const ADMIN = `${loginUrl.origin}/api/admin`;
console.log(`TARGET polyid-login=${loginUrl.host} ops=${opsUrl.origin}${opsUrl.pathname} tenant=${tenant} action=${action}`);

// ---- dm-api.sh (my-ip, steward check) ----------------------------------------------------------------------------------
const scriptDir = dirname(fileURLToPath(import.meta.url));
const dmApi = () => {
  const cands = [process.env.DM_API_SH, resolve(scriptDir, '../../../../../deploymate/skills/deploymate/scripts/dm-api.sh'),
    join(homedir(), 'skills/skills/deploymate/skills/deploymate/scripts/dm-api.sh')].filter(Boolean);
  return { sh: cands.find((p) => existsSync(p)), cands };
};
const myIp = () => {
  const { sh, cands } = dmApi();
  if (!sh) die(5, `my-ip: dm-api.sh not found (set DM_API_SH); tried ${cands.join(', ')}`);
  let ip;
  try { ip = execFileSync(sh, ['my-ip'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 60000 }).trim(); }
  catch (e) { die(5, `my-ip: dm-api.sh my-ip failed (${e.status ?? e.message}); pass the IP explicitly`); }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && !/^[0-9a-f:]{2,39}$/i.test(ip)) die(5, `my-ip: unexpected answer "${ip}"`);
  console.log(`my-ip resolved via ${sh}: ${ip}`);
  return ip;
};
// unlock is steward-only: the caller must own the DeployMate env <tenant> (owner sub in `dm-api.sh get` = sub of `dm-api.sh token`)
const checkSteward = () => {
  if (flags['--i-am-steward']) { console.log('steward check: --i-am-steward given (legacy orchestrator entry point)'); return; }
  const { sh } = dmApi();
  if (!sh) die(5, 'unlock is steward-only and dm-api.sh was not found to check ownership (set DM_API_SH)');
  let env, tok;
  try { env = JSON.parse(execFileSync(sh, ['get', tenant], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 })); } catch { die(5, `unlock is steward-only: dm-api.sh get ${tenant} failed (not the owner, or no DeployMate session)`); }
  try { tok = execFileSync(sh, ['token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 }).trim(); } catch { die(5, 'unlock is steward-only: dm-api.sh token failed'); }
  const me = decodeJwt(tok)?.payload?.sub; tok = null;
  const owner = env.ownerSub ?? env.owner?.sub ?? (typeof env.owner === 'string' ? env.owner : null) ?? env.createdBySub ?? env.createdBy ?? env.ownerId ?? null;
  if (!me || !owner) die(5, 'unlock is steward-only: the env owner could not be determined from dm-api.sh get; the steward runs it with --i-am-steward');
  if (String(owner) !== String(me)) die(5, `unlock is steward-only: you are not the DeployMate owner of ${tenant}; ask the env steward`);
  console.log('steward check: caller owns the DeployMate env');
};
const SUBJECT_OK = /^[\p{L}\p{N}._@:+-]{1,320}$/u;
let subject;
if (action === 'unlock') {
  checkSteward();
  subject = subjectArg === 'my-ip' ? myIp() : subjectArg;
  if (!subject || !SUBJECT_OK.test(subject)) die(5, `unlock refuses subject ${JSON.stringify(subject)}: one exact IP or username, no wildcards / commas / spaces`);
}

// ---- browser session ---------------------------------------------------------------------------------------------------
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const LOGFILE = process.env.POLYID_ADMIN_LOG || 'polyid-admin.log';
const log = (...a) => { const l = `[${new Date().toISOString()}] ` + a.join(' '); console.log(l); appendFileSync(join(out, LOGFILE), l + '\n'); };
const { chromium } = loadPlaywright();
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
const save = (name, obj) => writeFileSync(join(out, name), JSON.stringify(redactDeep(obj), null, 1));

const api = async (method, path, body) => {
  const url = ADMIN + path;
  if (new URL(url).origin !== loginUrl.origin) await finish(5, `GUARD: refusing call outside ${loginUrl.origin}`);
  const res = await fetch(url, { method, headers: { authorization: bearer, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text.slice(0, 300); }
  log('api', res.status, method, path.split('?')[0]);
  if (res.status === 401) await finish(3, 'LOGIN_NEEDED (401 from the admin API; run the login action with the operator)');
  if (res.status === 403) await finish(6, 'FORBIDDEN (403): the signed-in account lacks support-ops/admin rights in PolyID');
  return { status: res.status, body: parsed };
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
let providerId = providerArg; let providerDetails = null;
const providerInfo = { tenant, source: providerArg ? 'argument' : 'GET /providers/{tenant}' };
if (!providerId || ['provider-read', 'provider-2fa'].includes(action)) {
  const p = await api('GET', `/providers/${encodeURIComponent(tenant)}`);
  if (p.status !== 200 || !p.body || p.body.id == null) await finish(2, `provider of tenant ${tenant} not found (HTTP ${p.status}); pass --provider <id> (ops frontend → Provider editor)`);
  providerDetails = p.body;
  providerId = providerId || String(p.body.id);
  Object.assign(providerInfo, { name: p.body.name, domains: (p.body.domains || []).map((d) => d.domain ?? d) });
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

if (action === 'applied-policies') {
  const s = await readState();
  print(s.rows);
  log('summary(provider)', JSON.stringify(s.providerSummary));
  writeFileSync(join(out, 'applied-policies.json'), JSON.stringify({ at: new Date().toISOString(), host: loginUrl.host, provider: providerInfo, locked: s.rows, providerSummary: s.providerSummary, summary: s.summary, policies: s.policies }, null, 1));
  await finish(0, `written ${join(out, 'applied-policies.json')}`);
}

if (action === 'unlock') {
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
}

if (action === 'provider-read') {
  save('provider.json', { at: new Date().toISOString(), host: loginUrl.host, provider: providerDetails });
  log('provider twoFactorType', JSON.stringify(providerDetails?.capabilities?.twoFactorType ?? null), 'type', JSON.stringify(providerDetails?.providerType ?? null), 'active', JSON.stringify(providerDetails?.active ?? null));
  await finish(0, `written ${join(out, 'provider.json')}`);
}

if (action === 'provider-2fa') {
  const want = args[0];
  const sec = providerDetails?.clientSecret;
  if (sec && /^\*+$|\*{3,}|^\[?redacted/i.test(String(sec))) await finish(5, 'provider GET returns a masked clientSecret: a PUT would overwrite the real secret — change 2FA in the PolyID ops UI instead');
  const before = providerDetails?.capabilities?.twoFactorType ?? null;
  const body = { ...providerDetails, capabilities: { ...(providerDetails.capabilities || {}), twoFactorType: want } };
  const w = await api('PUT', `/providers/${encodeURIComponent(tenant)}`, body);
  const re = await api('GET', `/providers/${encodeURIComponent(tenant)}`);
  const after = re.body?.capabilities?.twoFactorType ?? null;
  save('provider-2fa.json', { at: new Date().toISOString(), window: flags['--window'], tenant, before, requested: want, after, writeStatus: w.status, restore: `polyid-admin.mjs … ${tenant} provider-2fa ${before ?? 'DISABLED'} --window ${flags['--window']}` });
  if (w.status >= 300) await finish(6, `PUT failed: HTTP ${w.status}`);
  await finish(after === want ? 0 : 4, `provider 2FA ${before} → ${after} (requested ${want}); restore value recorded in provider-2fa.json`);
}

if (action === 'audit') {
  const qs = new URLSearchParams({ tenant, 'page-size': '200' });
  if (flags['--since'] && flags['--since'] !== true) qs.set('from', flags['--since']);
  if (flags['--target-type'] && flags['--target-type'] !== true) qs.set('target-type', flags['--target-type']);
  const r = await api('GET', `/audit-logs?${qs}`);
  save('audit.json', { at: new Date().toISOString(), query: Object.fromEntries(qs), status: r.status, body: r.body });
  await finish(r.status === 200 ? 0 : 6, `written ${join(out, 'audit.json')}`);
}

// ---- user commands -----------------------------------------------------------------------------------------------------
const username = args[0];
const findUser = async () => {
  const r = await api('GET', `/users?tenant-id=${encodeURIComponent(tenant)}&username=${encodeURIComponent(username)}`);
  const list = Array.isArray(r.body) ? r.body : (r.body?.content || []);
  // the API filters by username server-side; UserDTO carries no username field, so accept exactly one match
  const u = list.length === 1 ? list[0] : list.find((x) => [x.tenant_subject, x.subject].map((v) => String(v ?? '').toLowerCase()).includes(username.toLowerCase())) || null;
  if (r.status !== 200 || !u) await finish(2, `PolyID user ${username} of tenant ${tenant} not found (HTTP ${r.status}, ${list.length} match(es)); a never-logged-in user has no PolyID record`);
  return u;
};
const view = (u) => ({ id: u.id, polyId: u.polyId, subject: u.subject, tenant_subject: u.tenant_subject, state: u.state, state_change_reason: u.state_change_reason,
  twoFactorType: u.twoFactorType ?? null, otp_verified: u.otp_verified, account_linked: u.account_linked, ms_teams_linked: u.ms_teams_linked, linked_partner: u.linked_partner ?? null });
const u0 = await findUser();
if (action === 'user-read') {
  save(`user-${username}.json`, { at: new Date().toISOString(), user: view(u0) });
  log('user', username, JSON.stringify(view(u0)));
  await finish(0);
}
let w; let check;
if (action === 'user-2fa') {
  const want = args[1] === 'DEFAULT' ? null : args[1];
  w = await api('PUT', `/users/${encodeURIComponent(u0.id)}/2fa`, { twoFactorType: want, twoFactorConfig: null });
  check = (u) => (u.twoFactorType ?? null) === want;
} else if (action === 'reset-otp') {
  w = await api('DELETE', `/otp/${encodeURIComponent(u0.polyId)}`);
  check = (u) => u.otp_verified !== true;
} else if (action === 'user-state') {
  w = await api('PUT', `/users/${encodeURIComponent(u0.id)}/state`, { state: args[1], state_change_reason: String(flags['--reason']) });
  check = (u) => u.state === args[1];
} else if (action === 'revoke-sessions') {
  w = await api('DELETE', `/hydra/sessions?subject=${encodeURIComponent(u0.subject)}`);
  check = () => true;
} else if (action === 'reset-teams-link') {
  w = await api('DELETE', `/msTeams/${encodeURIComponent(tenant)}/${encodeURIComponent(u0.tenant_subject)}`);
  check = (u) => u.ms_teams_linked !== true;
} else if (action === 'reset-partner-link') {
  w = await api('DELETE', `/users/${encodeURIComponent(u0.id)}/partner-link`);
  check = (u) => !u.linked_partner;
}
const u1 = await findUser();
const applied = check(u1);
save(`${action}-${username}.json`, { at: new Date().toISOString(), action, args: args.slice(1), reason: flags['--reason'] ?? null, writeStatus: w.status, before: view(u0), after: view(u1), applied });
if (w.status < 200 || w.status >= 300) await finish(6, `${action} failed: HTTP ${w.status}`);
await finish(applied ? 0 : 4, `${action} ${username}: ${applied ? 'applied (re-read)' : 'NOT visible in the re-read'}`);
