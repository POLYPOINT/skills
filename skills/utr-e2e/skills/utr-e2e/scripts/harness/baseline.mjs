// Baseline capture / G5 fixture (read-only): open the unified day view (captures bearer + employment id), then call the reads
// directly. Every response lands in <outdir>/api/; a compact status summary is written to <outdir>/baseline-summary.json.
//   node mypp.mjs <tenant-id> <login> baseline.mjs results/<run>/fixtures/<tenant-id>/<login>
// Env: DAY (default yesterday), MONTH (default DAY's month), FROM/TO (default the whole MONTH; on a customer-roster seed
// the roster only spans the seeded window, e.g. FROM/TO = audit.sql A4 FIRST_DAY/LAST_DAY).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
// Dates default relative to the run date (Europe/Zurich): DAY = yesterday, MONTH = DAY's month.
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const yesterday = () => ymd(new Date(Date.now() - 864e5));
const monthBounds = (month) => { const [y, m] = month.split('-').map(Number); return [`${month}-01`, `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`]; };
export default async ({ api, shot, log, out }) => {
  const day = process.env.DAY || yesterday(), month = process.env.MONTH || day.slice(0, 7);
  const [mFirst, mLast] = monthBounds(month);
  const from = process.env.FROM || mFirst, to = process.env.TO || mLast;
  const nav = await api.goto(`/tabs/unified-time-recording?date=${day}`, '/unified-time-recording/v1/days');
  await shot(`day-${day}`);
  let emp = nav?.body?.[0]?.employment_id;
  if (!emp) { const r = await api.get(`/api/mobile/unified-time-recording/v1/days?from=${day}&to=${day}`); emp = r.body?.[0]?.employment_id; }
  const calls = {
    unifiedDays: `/api/mobile/unified-time-recording/v1/days?from=${from}&to=${to}`,
    unifiedPermissions: `/api/mobile/unified-time-recording/v1/permissions?date=${day}&employment-id=${emp}`,
    unifiedMonth: `/api/mobile/unified-time-recording/v1/reports/month?employment-id=${emp}&start=${mFirst}&end=${mLast}`,
    classicMonth: `/api/mobile/time-recording/v1/reports/month?employment-id=${emp}&start=${mFirst}&end=${mLast}`,
    classicDay: `/api/mobile/time-recording/v1/days?day=${day}`,
    legacyPermissions: `/api/mobile/legacy-time-recording/v1/permissions`,
    monthFlexTime: `/api/mobile/time-recording/v1/month-flex-time?date=${day}`,
  };
  const summary = { employment_id: emp, day, month, from, to, navStatus: nav?.status ?? null, calls: {} };
  for (const [k, p] of Object.entries(calls)) {
    const r = await api.get(p).catch((e) => ({ status: 'ERR', body: String(e) }));
    const b = r.body;
    const info = { status: r.status, path: p };
    if (r.status >= 400 || r.status === 'ERR') info.errorBody = typeof b === 'string' ? b.slice(0, 2000) : b;
    else if (Array.isArray(b)) info.items = b.length;
    else if (b && typeof b === 'object') info.keys = Object.keys(b).slice(0, 15);
    if (k === 'unifiedDays' && Array.isArray(b)) info.days = b.map((d) => ({ date: d.date, shifts: d.shifts?.length, credited: d.time_amounts?.credited, planned: d.time_amounts?.planned }));
    summary.calls[k] = info;
    log(k, r.status);
  }
  writeFileSync(join(out, 'baseline-summary.json'), JSON.stringify(summary, null, 2));
  return { employment_id: emp, statuses: Object.fromEntries(Object.entries(summary.calls).map(([k, v]) => [k, v.status])) };
};
