// Partner API driver (partner group, swap / booking partner readers): client-credentials and impersonation tokens, Partner-API
// and full-sync calls, raw partner-sessions calls. Tokens and the client secret live in memory only.
//   node partner-api.mjs <partner-id> <outdir> token client --portal-profile <dir>
//   node partner-api.mjs <partner-id> <outdir> token hp <tenant> <tenant-subject> [locale] --portal-profile <dir>
//   node partner-api.mjs <partner-id> <outdir> call <METHOD> <[api:|portal-api:|pidl:]path|url> [--as client|hp:<tenant>:<subject>] [--body <file.json>] --portal-profile <dir>
//   node partner-api.mjs <partner-id> <outdir> session <body.json>       raw POST <polyid-login>/api/auth/partner-sessions (no secret)
//   node partner-api.mjs <partner-id> <outdir> <script.mjs> --portal-profile <dir>
// Script mode: default export async ({tokens: {client(), hp(tenant, subject, locale)}, call(method, url, {as, body}), claims(token),
//   save(name, obj), log, out, urls, partnerId}) => {}  — tokens are cached per process; never return or save a token.
// Client secret: read in memory through the operator's portal ops session (--portal-profile, ADMIN; lib/portal.mjs
//   readPartnerSecret), only for e2e-* partners. Client id: event-consumer-integration-<partner-id> (--client-id overrides).
// Token endpoints: client = <keycloak>/auth/realms/polypoint-polyportal-realm/protocol/openid-connect/token (client_credentials);
//   hp = <polyid-login>/api/partner/<tenant>/token {"tenant_subject","locale"} with the client token.
// Saved: decoded claims (header + payload only) as claims-client.json / claims-hp-<n>.json; every call as api/NNN-*.json with
//   access_token / refresh_token / client_secret values → "[redacted]" and JWTs → "[redacted-jwt]". Host guard: CT (Preview with --stage).
// Exit: 0 ok (call: HTTP < 400), 2 usage, 3 portal login needed, 5 guard refusal, 6 HTTP error / token failure.
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, makeLogger, decodeJwt, safeSeg } from './lib/util.mjs';
import { stageUrls, guardUrl, GuardError } from './lib/guard.mjs';
import { safeRecord, redactDeep } from './lib/redact.mjs';
import { readPartnerSecret, PortalExit } from './lib/portal.mjs';

const USAGE = 'usage: node partner-api.mjs <partner-id> <outdir> <token client|token hp <tenant> <subject> [locale]|call <METHOD> <path|url>|session <body.json>|script.mjs> [--portal-profile <dir>] [--as client|hp:<tenant>:<subject>] [--body f] [--client-id id] [--stage ct|preview]';
const { pos, flags } = parseArgs(process.argv.slice(2), ['--portal-profile', '--as', '--body', '--client-id', '--stage']);
const [partnerId, outdir, cmd, ...args] = pos;
const die = (code, msg) => { console.error(msg); process.exit(code); };
if (!partnerId || !outdir || !cmd) die(2, USAGE);
if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(partnerId)) die(2, 'partner-id: lowercase id');
const stage = flags['--stage'] || 'ct';
let urls;
try { urls = stageUrls(stage, process.env, ['pomaApi', 'portalApi', 'polyidLogin', 'keycloak']); } catch (e) { die(5, e.message); }
const out = resolve(outdir);
mkdirSync(join(out, 'api'), { recursive: true });
const log = makeLogger(out, 'partner-api.log', { iso: true });
let seq = 0;
const record = (rec, body) => { const safe = safeRecord(rec, body); writeFileSync(join(out, rec.file), JSON.stringify(safe, null, 2)); appendFileSync(join(out, 'api-index.jsonl'), JSON.stringify(safe.meta) + '\n'); };
const save = (name, obj) => writeFileSync(join(out, name), JSON.stringify(redactDeep(obj), null, 1));
const claims = (tok) => { const d = decodeJwt(tok); return d ? { header: d.header, payload: d.payload } : null; };
const BASES = { 'api': urls.pomaApi, 'portal-api': urls.portalApi, 'pidl': urls.polyidLogin };
const resolveUrl = (p) => {
  if (/^https?:\/\//.test(p)) return guardUrl('url', p, stage).href;
  const m = /^(api|portal-api|pidl):(\/.*)$/.exec(p);
  const base = m ? BASES[m[1]] : BASES.api; const path = m ? m[2] : p;
  if (!path.startsWith('/')) throw new GuardError(`GUARD: path must start with / (got ${p})`);
  return guardUrl('url', base + path, stage).href;
};
const firstJwt = (body) => {
  if (!body || typeof body !== 'object') return null;
  for (const k of ['access_token', 'accessToken', 'token', 'id_token']) if (typeof body[k] === 'string' && body[k].split('.').length === 3) return body[k];
  for (const v of Object.values(body)) if (typeof v === 'string' && /^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+$/.test(v)) return v;
  return null;
};

const cache = { secret: null, client: null, hp: new Map() };
let hpN = 0;
const tokens = {
  client: async () => {
    if (cache.client) return cache.client;
    if (!/^e2e-/.test(partnerId)) throw new GuardError('GUARD: the client secret is read only for e2e-* partners');
    if (!flags['--portal-profile']) throw new Error('--portal-profile <dir> (operator portal ops session, ADMIN) is needed to read the client secret');
    if (!cache.secret) cache.secret = await readPartnerSecret({ profile: resolve(flags['--portal-profile']), partnerId, stage, out: join(out, 'portal-secret') });
    const tokenUrl = guardUrl('keycloak', `${urls.keycloak}/auth/realms/polypoint-polyportal-realm/protocol/openid-connect/token`, stage).href;
    const form = new URLSearchParams({ grant_type: 'client_credentials', client_id: flags['--client-id'] || `event-consumer-integration-${partnerId}`, client_secret: cache.secret });
    const res = await fetch(tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: form.toString() });
    const body = await res.json().catch(() => null);
    log('token client', res.status);
    if (res.status !== 200 || !body?.access_token) throw new PortalExit(6, `client token failed: HTTP ${res.status} ${body?.error || ''}`);
    cache.client = body.access_token;
    save('claims-client.json', { at: new Date().toISOString(), status: res.status, claims: claims(cache.client) });
    return cache.client;
  },
  hp: async (tenant, subject, locale = 'de') => {
    if (!/^[a-z][a-z0-9-]{0,62}$/.test(tenant || '') || !subject) throw new Error('tokens.hp(tenant, tenantSubject[, locale])');
    const key = `${tenant}|${subject}|${locale}`;
    if (cache.hp.has(key)) return cache.hp.get(key);
    const client = await tokens.client();
    const url = guardUrl('pidl', `${urls.polyidLogin}/api/partner/${encodeURIComponent(tenant)}/token`, stage).href;
    const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${client}`, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ tenant_subject: subject, locale }) });
    const text = await res.text(); let body = null; try { body = JSON.parse(text); } catch { body = text; }
    const n = String(++seq).padStart(3, '0');
    record({ seq: n, ts: new Date().toISOString(), method: 'POST', url, status: res.status, file: `api/${n}-POST-${safeSeg(new URL(url))}.json`, requestBody: JSON.stringify({ tenant_subject: subject, locale }) }, body);
    const tok = firstJwt(body);
    log('token hp', tenant, res.status);
    if (res.status !== 200 || !tok) { save(`claims-hp-${++hpN}.json`, { at: new Date().toISOString(), tenant, status: res.status, claims: null, error: typeof body === 'object' ? body : String(body).slice(0, 300) }); return null; }
    cache.hp.set(key, tok);
    save(`claims-hp-${++hpN}.json`, { at: new Date().toISOString(), tenant, status: res.status, claims: claims(tok) });
    return tok;
  },
};

const call = async (method, target, { as = 'client', body } = {}) => {
  const url = resolveUrl(target);
  let tok = null;
  if (as === 'client') tok = await tokens.client();
  else if (typeof as === 'string' && as.startsWith('hp:')) { const [, t, ...s] = as.split(':'); tok = await tokens.hp(t, s.join(':')); }
  else if (typeof as === 'string' && as.split('.').length === 3) tok = as;
  else if (as !== 'none') throw new Error(`--as must be client, hp:<tenant>:<subject> or none (got ${as})`);
  const res = await fetch(url, { method, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  const n = String(++seq).padStart(3, '0');
  record({ seq: n, ts: new Date().toISOString(), method, url, status: res.status, file: `api/${n}-${method}-${safeSeg(new URL(url))}.json`, requestBody: body !== undefined ? JSON.stringify(body) : null, as: as === 'client' || as === 'none' ? as : as.startsWith('hp:') ? 'hp' : 'token' }, json);
  log('call', res.status, method, new URL(url).host + new URL(url).pathname);
  return { status: res.status, body: json };
};

async function main() {
  if (cmd === 'token') {
    if (args[0] === 'client') { await tokens.client(); return 0; }
    if (args[0] === 'hp') { const t = await tokens.hp(args[1], args[2], args[3] || 'de'); return t ? 0 : 6; }
    die(2, USAGE);
  }
  if (cmd === 'call') {
    const [method, target] = args;
    if (!/^(GET|POST|PUT|DELETE|PATCH)$/.test(method || '') || !target) die(2, USAGE);
    const body = flags['--body'] ? JSON.parse(readFileSync(flags['--body'], 'utf8')) : undefined;
    const r = await call(method, target, { as: flags['--as'] || 'client', body });
    return r.status < 400 ? 0 : 6;
  }
  if (cmd === 'session') {
    if (!args[0]) die(2, 'session <body.json> ({partner_id, code_challenge, customer_id, tenant_id})');
    const body = JSON.parse(readFileSync(args[0], 'utf8'));
    const url = guardUrl('pidl', `${urls.polyidLogin}/api/auth/partner-sessions`, stage).href;
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
    const text = await res.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text.slice(0, 500); }
    // the endpoint is under /api/auth/: the generic recorder skips its bodies, so the evidence is written here with JWTs redacted
    save(`session-${String(++seq).padStart(3, '0')}.json`, { at: new Date().toISOString(), request: body, status: res.status, body: json });
    log('partner-sessions', res.status, typeof json === 'object' && json ? (json.status || json.name || json.error || '') : '');
    return 0;
  }
  if (/\.m?js$/.test(cmd)) {
    const mod = await import(pathToFileURL(resolve(cmd)).href);
    const result = await mod.default({ tokens, call, claims, save, log, out, urls, partnerId });
    save('result.json', { partnerId, stage, script: result });
    return 0;
  }
  die(2, USAGE);
}

try { process.exitCode = await main(); } catch (e) {
  if (e instanceof GuardError) { console.error(e.message); process.exit(5); }
  if (e instanceof PortalExit) { console.error(e.message); process.exit(e.exitCode); }
  console.error(String(e.message || e)); process.exit(1);
} finally { cache.secret = null; cache.client = null; cache.hp.clear(); }
