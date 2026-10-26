// Gateway-mock reader (external workforce, partner family EW) — the CT stage's ONE shared mock pod (env-plan S-CT-GWMOCK).
//   node gwmock.mjs <outdir> received [--tx <id,id,…>]                    GET /test/received-bookings, filtered by transaction ids
//   node gwmock.mjs <outdir> strategy get                                  GET /test/booking-response-strategy + cancel-…-strategy
//   node gwmock.mjs <outdir> strategy set <booking|cancel> <STRATEGY> --lock <locks/ct~gwmock doc version> --window S-CT-GWMOCK
//        booking: SUCCESS|CONFLICT|GENERIC_ERROR|HTTP_500; cancel: SUCCESS|DEADLINE_PASSED|GENERIC_ERROR|HTTP_500 (restore = SUCCESS)
// The mock's own API lives under /test/: these three paths are the ONLY /test/ paths any cloud-e2e helper may call (exception
// to hard rule 2, read-only except `strategy set`). Never DELETE the inbox, never restart the mock, never call other /test/ paths.
// `strategy set` changes every CT team's external-workforce tests: only by the holder of the db lock locks/ct~gwmock inside the
// announced stage window, and the restore (SUCCESS) is GET-verified in the same window. The script cannot read the db: --lock
// records the lock document version the caller holds; without --lock and --window S-CT-GWMOCK it refuses.
// Output: received-bookings.json (filtered), strategies.json, strategy-set.json (before / after). Host guard: CT (Preview: --stage).
// Exit: 0 ok, 2 usage, 4 strategy not applied (re-read differs), 5 guard refusal, 6 HTTP error.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs, makeLogger } from './lib/util.mjs';
import { stageUrls, guardUrl } from './lib/guard.mjs';
import { redactDeep } from './lib/redact.mjs';

const USAGE = 'usage: node gwmock.mjs <outdir> received [--tx <ids>] | strategy get | strategy set <booking|cancel> <STRATEGY> --lock <doc version> --window S-CT-GWMOCK  [--stage ct|preview]';
const { pos, flags } = parseArgs(process.argv.slice(2), ['--tx', '--lock', '--window', '--stage']);
const [outdir, cmd, a1, a2, a3] = pos;
const die = (code, msg) => { console.error(msg); process.exit(code); };
if (!outdir || !cmd) die(2, USAGE);
const stage = flags['--stage'] || 'ct';
let GWM;
try { GWM = stageUrls(stage, process.env, ['gwmock']).gwmock; } catch (e) { die(5, e.message); }
const PATHS = { received: '/test/received-bookings', booking: '/test/booking-response-strategy', cancel: '/test/cancel-booking-response-strategy' };
const out = resolve(outdir); mkdirSync(out, { recursive: true });
const log = makeLogger(out, 'gwmock.log', { iso: true });
const save = (name, obj) => writeFileSync(join(out, name), JSON.stringify(redactDeep(obj), null, 1));

const req = async (method, key, body) => {
  if (!['GET', 'PUT'].includes(method)) die(5, `GUARD: ${method} refused on the gateway mock (GET / PUT strategy only)`);
  const url = guardUrl('gateway mock', GWM + PATHS[key], stage, { gwmock: true }).href;
  const res = await fetch(url, { method, headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  log(method, res.status, PATHS[key]);
  return { status: res.status, body: json };
};
// the mock answers {"strategy": "SUCCESS"} and takes the same body on PUT (partner-simulator-gateway-mock-api.service.ts)
const strategyOf = (b) => (b && typeof b === 'object' ? (b.strategy ?? JSON.stringify(b)) : b);

if (cmd === 'received') {
  const r = await req('GET', 'received');
  if (r.status !== 200) die(6, `received-bookings HTTP ${r.status}`);
  const all = Array.isArray(r.body) ? r.body : (r.body?.items || r.body?.bookings || []);
  const ids = flags['--tx'] ? String(flags['--tx']).split(',').map((s) => s.trim()).filter(Boolean) : null;
  const has = (o, id) => JSON.stringify(o).includes(`"${id}"`);
  const hits = ids ? all.filter((b) => ids.some((id) => has(b, id))) : all;
  save('received-bookings.json', { at: new Date().toISOString(), filter: ids, total: all.length, count: hits.length, bookings: hits });
  log('received', hits.length, 'of', all.length, ids ? `for ${ids.length} transaction id(s)` : '');
  process.exit(0);
}
if (cmd === 'strategy' && a1 === 'get') {
  const b = await req('GET', 'booking'); const c = await req('GET', 'cancel');
  save('strategies.json', { at: new Date().toISOString(), booking: { status: b.status, value: strategyOf(b.body), body: b.body }, cancel: { status: c.status, value: strategyOf(c.body), body: c.body } });
  log('strategies booking', strategyOf(b.body), 'cancel', strategyOf(c.body));
  process.exit(b.status === 200 && c.status === 200 ? 0 : 6);
}
if (cmd === 'strategy' && a1 === 'set') {
  const kind = a2; const value = a3;
  const ALLOWED = { booking: ['SUCCESS', 'CONFLICT', 'GENERIC_ERROR', 'HTTP_500'], cancel: ['SUCCESS', 'DEADLINE_PASSED', 'GENERIC_ERROR', 'HTTP_500'] };
  if (!ALLOWED[kind] || !ALLOWED[kind].includes(value)) die(2, `strategy set booking <${ALLOWED.booking.join('|')}> | cancel <${ALLOWED.cancel.join('|')}>`);
  if (!flags['--lock'] || flags['--lock'] === true) die(5, 'GUARD: strategy set needs --lock <version of the locks/ct~gwmock document you hold>');
  if (flags['--window'] !== 'S-CT-GWMOCK') die(5, 'GUARD: strategy set only inside the announced stage window: --window S-CT-GWMOCK');
  const before = await req('GET', kind);
  const w = await req('PUT', kind, { strategy: value });
  const after = await req('GET', kind);
  const applied = String(strategyOf(after.body)) === value;
  save('strategy-set.json', { at: new Date().toISOString(), kind, lock: String(flags['--lock']), window: flags['--window'], before: strategyOf(before.body), requested: value, after: strategyOf(after.body), writeStatus: w.status, applied, restore: `gwmock.mjs <out> strategy set ${kind} SUCCESS --lock <same> --window S-CT-GWMOCK` });
  if (w.status >= 300) die(6, `PUT HTTP ${w.status}`);
  log('strategy', kind, strategyOf(before.body), '→', strategyOf(after.body));
  process.exit(applied ? 0 : 4);
}
die(2, USAGE);
