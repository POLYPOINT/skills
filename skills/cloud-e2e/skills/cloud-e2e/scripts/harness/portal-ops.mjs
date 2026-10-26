// PolyPortal ops driver (portal ops / POMA ops / customer portal) for the cloud-e2e groups and the steward.
//   node portal-ops.mjs <profileDir> <script.mjs|-> <outDir> [--base ops|poma-ops|customer] [--stage ct|preview] [--headed] [--dialogs '<json>']
//   node portal-ops.mjs <profileDir> <cmd> <outDir> [cmd args …] [options]
//   node portal-ops.mjs <profileDir> "<cmd> <args…> [options]" <outDir>             (quoted form; inner quotes and flags allowed)
// Commands (base ops; the portal admin API with the SPA's captured Bearer, the endpoints the ops frontend itself calls):
//   login                                       HEADED: the operator signs in (personal ops account), ≤ 5 min; session ≈ 1.5 h
//   flag read <tenant> <code>                   GET /features/tenants/<tenant> → flag-read.json (exit 2 if the code is absent)
//   flag set <tenant> <code> <value>            PUT …?code=&value=, re-read; exit 5 if not applied. Messaging flags ON refused
//                                               (poma.internalPool.sendEmailConfirmation, poma.msTeams.notifications) unless --allow-messaging
//   flag delete <tenant> <code>                 DELETE the tenant override (master value applies again) = the restore
//   tenant read <tenant>                        tenant row, services, IPs, licence (raw_xml → sha256) → tenant-<tenant>.json
//   partner create <id> --spec <file.json>      POST an IntegrationPartner (id must start with e2e-; spec = the partner JSON)
//   partner delete <id>                         DELETE (e2e-* only), verified by a list read
//   partner logging on|off <id>                 PUT /integration-partners/<id>/logs {enabled}
//   partner logs <id> [--since ISO] [--count N] [--pages P]   Debug-tab events → partner-logs-<id>.json
//   partner secret-to-mem <id>                  checks that the client secret is readable (never printed); partner-api.mjs uses it
//   job list <service>                          jobs + arguments of a service (actuator polypointjobs through the portal proxy)
//   job run <service> <job> --tenant <id>       allow-list only: Tier T (tenant-scoped, poma-core) needs --tenant = an env this
//                                               machine joined ($DM_CONFIG_DIR/<id>.test-data.json); Tier A needs --window S-CT-JOBS
//   health <tenant> [--force]                   GET /health?tenantIds=<tenant> → health-<tenant>.json
//   audit [--tenant <id>] [--since ISO]         portal audit logs → audit*.json
// Script mode: default export async ({page, ctx, out, shot, log, api, section, select, pods, actuator, metricSum, routeAbort,
//   urls, base, org}) — api.call(method, path, body) relative to <portal-api>/api/private/admin; shot() masks .code spans and
//   phone fields; section(org, tenant, key) deep-links the tenant editor; actuator() refuses env/configprops/heapdump/threaddump.
// Dialogs: --dialogs '[{"prompt":"DELETE"},{"confirm":true}]' answers prompt/confirm in order; alerts are accepted; every
//   dialog text goes to dialogs.log. Other options: --org <slug> (else PORTAL_ORG or resolved from the organisation list).
// Recording: portal admin / business / v1 API responses → api/NNN-*.json (redacted: credentials, client secrets, actuator env /
//   configprops / heapdump bodies, licence raw_xml → sha256, log contents → size / lines). Host guard: CT (Preview with --stage).
// Exit: 0 ok, 2 not found, 3 LOGIN_NEEDED, 4 usage, 5 refused by a guard / value not applied, 6 HTTP error (403 = rights).
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, DM_DIR } from './lib/util.mjs';
import { GuardError } from './lib/guard.mjs';
import { redactDeep } from './lib/redact.mjs';
import { openPortal, PortalExit, actuatorPath, ACTUATOR_REFUSED, jobTier, MESSAGING_FLAGS, readPartnerSecret, serviceSelector } from './lib/portal.mjs';

const USAGE = `usage: node portal-ops.mjs <profileDir> <script.mjs|-> <outDir> [--base ops|poma-ops|customer] [--stage ct|preview] [--headed] [--dialogs <json>]
       node portal-ops.mjs <profileDir> <login|flag|tenant|partner|job|health|audit> <outDir> [args…] [--org <slug>] [--spec f] [--tenant id] [--window id] [--since ISO]`;
const VALUED = ['--base', '--stage', '--dialogs', '--org', '--spec', '--tenant', '--window', '--since', '--count', '--pages'];
const { pos, flags } = parseArgs(process.argv.slice(2), VALUED);
const COMMANDS = ['login', 'flag', 'tenant', 'partner', 'job', 'health', 'audit'];
const SUBWORDS = new Set(['read', 'set', 'delete', 'create', 'logging', 'logs', 'secret-to-mem', 'list', 'run', 'on', 'off']);

const fail = (code, msg) => { console.error(msg); process.exit(code); };
// shell-like split of a quoted command ("flag set <t> <code> \"text with spaces\"", "job run poma-core X --tenant t")
function shellSplit(str) {
  const out = []; let cur = ''; let q = null; let has = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (q) { if (ch === q) q = null; else if (ch === '\\' && q === '"' && i + 1 < str.length) cur += str[++i]; else cur += ch; }
    else if (ch === '"' || ch === "'") { q = ch; has = true; }
    else if (/\s/.test(ch)) { if (cur || has) { out.push(cur); cur = ''; has = false; } }
    else if (ch === '\\' && i + 1 < str.length) cur += str[++i];
    else cur += ch;
  }
  if (q) fail(4, `unbalanced quote in the command: ${str}`);
  if (cur || has) out.push(cur);
  return out;
}
const [profile, second, ...rest] = pos;
if (!profile || !second || !rest.length) fail(4, USAGE);
let mode, cmd = [], outDir;
if (second === '-' || /\.m?js$/.test(second)) { mode = 'script'; outDir = rest[0]; if (rest.length > 1) fail(4, USAGE); }
else if (/\s/.test(second.trim())) {
  // quoted form: the command string may carry its own flags (e.g. --tenant inside "job run …"); outer flags win
  const inner = parseArgs(shellSplit(second.trim()), VALUED);
  mode = 'cmd'; cmd = inner.pos; outDir = rest[0]; cmd.push(...rest.slice(1));
  for (const [k, v] of Object.entries(inner.flags)) if (!(k in flags)) flags[k] = v;
}
else { mode = 'cmd'; cmd = [second]; outDir = rest[0]; cmd.push(...rest.slice(1)); }
if (mode === 'cmd' && !COMMANDS.includes(cmd[0])) fail(4, `unknown command ${cmd[0]}\n${USAGE}`);
if (!outDir || SUBWORDS.has(outDir) || COMMANDS.includes(outDir)) fail(4, `outDir missing or looks like a command word ("${outDir}"): the order is <profileDir> <cmd> <outDir> [args]\n${USAGE}`);
const out = resolve(outDir);
const stage = flags['--stage'] || 'ct';
const base = flags['--base'] || 'ops';
let dialogs = [];
if (flags['--dialogs']) { try { dialogs = JSON.parse(flags['--dialogs']); if (!Array.isArray(dialogs)) throw new Error('not an array'); } catch (e) { fail(4, `--dialogs must be a JSON array: ${e.message}`); } }
if (mode === 'cmd' && cmd[0] !== 'login' && base !== 'ops') fail(4, 'commands run on --base ops (portal ops); use script mode for poma-ops / customer');

const save = (name, obj) => { const f = join(out, name); writeFileSync(f, JSON.stringify(redactDeep(obj), null, 1)); return f; };
const enc = encodeURIComponent;
const TENANT_OK = /^[a-z][a-z0-9-]{0,62}$/;
const PARTNER_OK = /^e2e-[a-z0-9-]{1,60}$/;
const listOf = (b) => (Array.isArray(b) ? b : b?.items || b?.content || b?.data || []);

async function main() {
  if (mode === 'cmd' && cmd[0] === 'partner' && cmd[1] === 'secret-to-mem') {
    const id = cmd[2]; if (!PARTNER_OK.test(id || '')) throw new PortalExit(5, 'partner id must start with e2e-');
    const secret = await readPartnerSecret({ profile, partnerId: id, stage, out });
    console.log(`client secret of ${id}: readable (${secret.length} chars; kept in memory only, not printed)`);
    return 0;
  }
  const s = await openPortal({ profile, out, base, stage, headed: mode === 'cmd' && cmd[0] === 'login' ? true : !!flags['--headed'], dialogs });
  try {
    if (mode === 'cmd' && cmd[0] === 'login') { await s.ensureSession(); s.log('login OK (session stored in the profile)'); return 0; }
    await s.ensureSession();
    if (mode === 'script') return await runScript(s);
    return await runCommand(s);
  } finally { await s.close(); }
}

async function runScript(s) {
  if (second === '-') { await s.shot('home'); return 0; }
  const org = flags['--org'] || process.env.PORTAL_ORG || null;
  const helpers = {
    section: async (o, tenant, key) => { await s.page.goto(`${s.urls.portalWeb}/ops/organizations/${o}/${tenant}?section=${enc(key)}`, { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(2500); },
    select: async (label, optionText) => {
      const field = s.page.locator('mat-form-field').filter({ has: s.page.locator('mat-label', { hasText: label }) }).first();
      await field.locator('mat-select').click(); await s.page.locator('mat-option', { hasText: optionText }).first().click(); await s.page.waitForTimeout(500);
    },
    pods: async (service) => { const r = await s.call('GET', `/services/pods?k8s-service-name=${service}&k8s-selector=${enc(serviceSelector(service))}`); return listOf(r.body).map((p) => ({ name: p.metadata?.name, ip: p.status?.podIP ?? p.status?.pod_ip })); },
    actuator: async (service, podIp, endpoint) => {
      if (ACTUATOR_REFUSED.test(String(endpoint))) throw new PortalExit(5, `actuator ${endpoint} refused (secrets / dumps)`);
      const [ep, ...seg] = String(endpoint).split('/');
      return s.call('GET', actuatorPath(service, ep, { podIp, segment: seg.length ? seg.join('/') : null }));
    },
    metricSum: async (service, name, tag) => {
      const pods = await helpers.pods(service); let sum = 0; const per = [];
      for (const p of pods) {
        const r = await s.call('GET', actuatorPath(service, 'metrics', { podIp: p.ip, segment: `${name}${tag ? `?tag=${tag}` : ''}` }));
        const v = (r.body?.measurements || []).reduce((a, m) => a + (Number(m.value) || 0), 0); per.push({ pod: p.name, value: v, status: r.status }); sum += v;
      }
      return { sum, per };
    },
    routeAbort: async (pattern) => s.page.route(pattern, (r) => r.abort()),
  };
  const mod = await import(pathToFileURL(resolve(second)).href);
  const result = await mod.default({ page: s.page, ctx: s.ctx, out, shot: s.shot, log: s.log, api: { call: s.call, get: (p) => s.call('GET', p) }, ...helpers, urls: s.urls, base, org });
  save('result.json', { base, stage, script: result });
  return 0;
}

async function runCommand(s) {
  const [c, a1, a2, a3, a4] = cmd;
  if (c === 'flag') {
    const action = a1, tenant = a2, code = a3, value = a4;
    if (!['read', 'set', 'delete'].includes(action) || !TENANT_OK.test(tenant || '') || !code || (action === 'set' && value === undefined)) throw new PortalExit(4, 'flag read|set|delete <tenant> <code> [value]');
    if (action === 'set' && MESSAGING_FLAGS.includes(code) && String(value).toLowerCase() === 'true' && !flags['--allow-messaging']) throw new PortalExit(5, `${code}=true sends real messages: refused without --allow-messaging (manual / messaging window only)`);
    const read = async () => { const r = await s.call('GET', `/features/tenants/${enc(tenant)}`); if (r.status !== 200) throw new PortalExit(6, `features read HTTP ${r.status}`); return listOf(r.body).find((f) => f.code === code) || null; };
    const before = await read();
    if (action === 'read') { save('flag-read.json', { tenant, code, entry: before }); s.log('flag', code, '=', JSON.stringify(before?.value ?? null)); return before ? 0 : 2; }
    if (!before) throw new PortalExit(2, `feature ${code} not in the tenant list of ${tenant}`);
    const w = action === 'set' ? await s.call('PUT', `/features/tenants/${enc(tenant)}?code=${enc(code)}&value=${enc(value)}`)
      : await s.call('DELETE', `/features/tenants/${enc(tenant)}?code=${enc(code)}`);
    const after = await read();
    const okSet = action === 'set' ? String(after?.value) === String(value) : true;
    save(`flag-${action}.json`, { tenant, code, requested: value ?? null, writeStatus: w.status, before, after, applied: okSet });
    s.log('flag', action, code, 'before', JSON.stringify(before?.value), 'after', JSON.stringify(after?.value), 'HTTP', w.status);
    try { const o = await s.resolveOrg(tenant, flags['--org']); if (o) { await s.page.goto(`${s.urls.portalWeb}/ops/organizations/${o}/${tenant}?section=features`, { waitUntil: 'networkidle', timeout: 60000 }); await s.page.waitForTimeout(2500); const row = s.page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: code }).first(); if (await row.count()) await row.scrollIntoViewIfNeeded(); await s.shot(`flag-${action}-after`); } } catch (e) { s.log('screenshot skipped:', e.message); }
    if (w.status >= 300) throw new PortalExit(6, `write HTTP ${w.status}`);
    return okSet ? 0 : 5;
  }
  if (c === 'tenant') {
    if (a1 !== 'read' || !TENANT_OK.test(a2 || '')) throw new PortalExit(4, 'tenant read <tenant>');
    const t = a2;
    const list = await s.call('GET', `/tenants?search=${enc(t)}&count=20`);
    const row = listOf(list.body).find((x) => x.id === t);
    if (!row) { save(`tenant-${t}.json`, { tenant: t, found: false }); return 2; }
    const services = await s.call('GET', `/tenants/${enc(t)}/services`);
    const ips = await s.call('GET', `/tenants/${enc(t)}/ips`);
    const license = await s.call('GET', `/tenants/${enc(t)}/license`);
    save(`tenant-${t}.json`, { tenant: t, found: true, row, services: services.body, ips: ips.body, license: license.body, statuses: { services: services.status, ips: ips.status, license: license.status } });
    return 0;
  }
  if (c === 'partner') {
    const action = a1;
    const id = action === 'logging' ? a3 : a2;
    if (!PARTNER_OK.test(id || '')) throw new PortalExit(5, `partner commands accept only e2e-* ids (got ${id}); never edit a shared partner`);
    if (action === 'create') {
      if (!flags['--spec']) throw new PortalExit(4, 'partner create <id> --spec <IntegrationPartner.json>');
      const spec = JSON.parse(readFileSync(flags['--spec'], 'utf8'));
      if (spec.id !== id) throw new PortalExit(4, `spec id ${spec.id} differs from ${id}`);
      const r = await s.call('POST', '/integration-partners', spec);
      const l = await s.call('GET', '/integration-partners?count=500');
      const present = listOf(l.body).some((p) => p.id === id);
      save(`partner-create-${id}.json`, { id, status: r.status, present });
      if (r.status >= 300) throw new PortalExit(6, `create HTTP ${r.status}`);
      return present ? 0 : 5;
    }
    if (action === 'delete') {
      const r = await s.call('DELETE', `/integration-partners/${enc(id)}`);
      const l = await s.call('GET', '/integration-partners?count=500');
      const gone = !listOf(l.body).some((p) => p.id === id);
      save(`partner-delete-${id}.json`, { id, status: r.status, gone });
      if (r.status >= 300 && r.status !== 404) throw new PortalExit(6, `delete HTTP ${r.status}`);
      return gone ? 0 : 5;
    }
    if (action === 'logging') {
      if (!['on', 'off'].includes(a2)) throw new PortalExit(4, 'partner logging on|off <id>');
      const r = await s.call('PUT', `/integration-partners/${enc(id)}/logs`, { enabled: a2 === 'on' });
      save(`partner-logging-${id}.json`, { id, enabled: a2 === 'on', status: r.status });
      return r.status < 300 ? 0 : 6;
    }
    if (action === 'logs') {
      const since = flags['--since'] || new Date(Date.now() - 24 * 3600e3).toISOString();
      const count = Number(flags['--count'] || 100); const pages = Number(flags['--pages'] || 5);
      const events = []; let after = null;
      for (let p = 0; p < pages; p++) {
        const r = await s.call('GET', `/integration-partners/${enc(id)}/logs?start=${enc(since)}&count=${count}${after ? `&after=${enc(after)}` : ''}`);
        if (r.status !== 200) throw new PortalExit(6, `logs HTTP ${r.status}`);
        const items = r.body?.logs?.items || listOf(r.body); events.push(...items);
        after = r.body?.logs?.next || null; if (!after || items.length < count) break;
      }
      save(`partner-logs-${id}.json`, { id, since, count: events.length, logging: null, events });
      s.log('partner logs', id, events.length, 'events since', since);
      return 0;
    }
    throw new PortalExit(4, 'partner create|delete|logging on|off|logs|secret-to-mem <id>');
  }
  if (c === 'job') {
    const action = a1, service = a2, job = a3;
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(service || '')) throw new PortalExit(4, 'job list|run <service> [job] --tenant <id>');
    const list = await s.call('GET', actuatorPath(service, 'polypointjobs'));
    if (list.status !== 200) throw new PortalExit(6, `job list HTTP ${list.status}`);
    const jobs = listOf(list.body).map((j) => ({ name: j.name, arguments: (j.arguments || []).map((x) => ({ name: x.name, required: x.required, description: x.description })) }));
    if (action === 'list') { save(`jobs-${service}.json`, { service, jobs }); jobs.forEach((j) => s.log('job', j.name, j.arguments.map((x) => x.name).join(','))); return 0; }
    if (action !== 'run' || !job) throw new PortalExit(4, 'job run <service> <job> --tenant <id>');
    const tier = jobTier(service, job);
    if (!tier) throw new PortalExit(5, `job ${service}/${job} is not on the allow-list (Tier A / tenant-scoped only; Tier B / D never)`);
    const real = jobs.find((j) => j.name.toLowerCase() === job.toLowerCase() || j.name.toLowerCase().replace(/(cron)?job$/, '') === job.toLowerCase().replace(/(cron)?job$/, ''));
    if (!real) throw new PortalExit(2, `job ${job} not offered by ${service}`);
    let segment;
    if (tier === 'T') {
      const t = flags['--tenant'];
      if (!t || !/^[a-z][a-z0-9-]{0,14}$/.test(t)) throw new PortalExit(5, 'tenant-scoped job: --tenant <own DeployMate env id> is mandatory (an empty tenantIds runs on every tenant)');
      if (!existsSync(join(DM_DIR, `${t}.test-data.json`))) throw new PortalExit(5, `--tenant ${t}: no $DM_CONFIG_DIR/${t}.test-data.json on this machine — jobs run only on an env this runner joined`);
      if (!real.arguments.some((x) => x.name === 'tenantIds')) throw new PortalExit(5, `${real.name} offers no tenantIds argument: refusing (it would act on all tenants)`);
      segment = `${real.name}?tenantIds=${t}`;
    } else {
      if (flags['--window'] !== 'S-CT-JOBS') throw new PortalExit(5, 'Tier A jobs run only inside the announced stage window: pass --window S-CT-JOBS');
      segment = `${real.name}?`;
    }
    const r = await s.call('POST', actuatorPath(service, 'polypointjobs', { segment }));
    save(`job-run-${real.name}.json`, { service, job: real.name, tier, tenantIds: flags['--tenant'] || null, status: r.status, at: new Date().toISOString(), note: 'success = counters polypoint.job.task.executed / unrecoverable.errors (script helper metricSum)' });
    return r.status < 300 ? 0 : 6;
  }
  if (c === 'health') {
    const t = a1; if (!TENANT_OK.test(t || '')) throw new PortalExit(4, 'health <tenant> [--force]');
    const r = await s.call('GET', `/health?tenantIds=${enc(t)}&force=${flags['--force'] ? 'true' : 'false'}`);
    save(`health-${t}.json`, { tenant: t, status: r.status, body: r.body });
    return r.status === 200 ? 0 : 6;
  }
  if (c === 'audit') {
    const t = flags['--tenant']; const q = flags['--since'] ? `?from=${enc(flags['--since'])}` : '';
    if (t && !TENANT_OK.test(t)) throw new PortalExit(4, 'audit [--tenant <id>] [--since ISO]');
    const res = {};
    if (t) res.tenant = await s.call('GET', `/tenants/${enc(t)}/audit-logs${q}`);
    else { res.portal = await s.call('GET', `/audit-logs${q}`); res.usermanagement = await s.call('GET', `/usermanagement/audit-logs${q}`); }
    save(t ? `audit-${t}.json` : 'audit.json', Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { status: v.status, body: v.body }])));
    return Object.values(res).every((v) => v.status === 200) ? 0 : 6;
  }
  throw new PortalExit(4, USAGE);
}

try { process.exitCode = await main(); } catch (e) {
  if (e instanceof PortalExit) { console.error(e.message); process.exit(e.exitCode); }
  if (e instanceof GuardError) { console.error(e.message); process.exit(5); }
  console.error(e.stack || String(e)); process.exit(1);
}
