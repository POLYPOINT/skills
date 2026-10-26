// legacy-reads.mjs — L-01 recipe: legacy-time-recording reads (read-only) next to the classic and unified equivalents.
//   LDAYS=YYYY-MM-DD,... (consecutive days, first..last = range) LPLAN=<planning ids for shifts/{id}, comma-separated>
//   MONTH=YYYY-MM (default: month of the first day)
//     node scripts/harness/mypp.mjs <tenant-id> <login> scripts/harness/legacy-reads.mjs <outdir>
// Writes <outdir>/L-01-result.json ({employment, calls:[{name, path, status, body}]}); any 500 is the F3 signature.
// Planning ids: shifts[].shift_planning_id of the unified /days of those days. Verified on the CT build of 2026-10-14.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const LTR = '/api/mobile/legacy-time-recording/v1', CTR = '/api/mobile/time-recording/v1', UTR = '/api/mobile/unified-time-recording/v1';
export default async ({ api, shot, log, out }) => {
  const days = (process.env.LDAYS || '').split(',').filter(Boolean);
  const plans = (process.env.LPLAN || '').split(',').filter(Boolean);
  const first = days[0], last = days[days.length - 1];
  const month = process.env.MONTH || first.slice(0, 7); const [yy, mm] = month.split('-').map(Number);
  const mEnd = `${month}-${String(new Date(Date.UTC(yy, mm, 0)).getUTCDate()).padStart(2, '0')}`;
  const r0 = await api.goto(`/tabs/unified-time-recording?date=${first}`, '/unified-time-recording/v1/days');
  await shot(`day-${first}`);
  let emp = r0?.body?.[0]?.employment_id;
  if (!emp) { const x = await api.get(`${UTR}/days?from=${first}&to=${first}`); emp = x.body?.[0]?.employment_id; }
  const res = { employment: emp, calls: [] };
  const go = async (name, path) => {
    const r = await api.get(path).catch((e) => ({ status: 'ERR', body: String(e) }));
    res.calls.push({ name, path, status: r.status, body: r.body });
    log(name, r.status, JSON.stringify(r.body).slice(0, 300));
    return r;
  };
  await go('legacy-permissions', `${LTR}/permissions`);
  for (const d of days) await go(`legacy-month-flex-time-${d}`, `${LTR}/month-flex-time?date=${d}&employmentId=${emp}`);
  await go(`legacy-month-flex-time-nodate-emp`, `${LTR}/month-flex-time?date=${last}`);
  await go(`legacy-reports-month-range`, `${LTR}/reports/month?employment-id=${emp}&start=${first}&end=${last}`);
  for (const d of days) await go(`legacy-reports-month-${d}`, `${LTR}/reports/month?employment-id=${emp}&start=${d}&end=${d}`);
  await go(`legacy-reports-month-${month}`, `${LTR}/reports/month?employment-id=${emp}&start=${month}-01&end=${mEnd}`);
  for (const p of plans) await go(`legacy-shift-${p}`, `${LTR}/${emp}/shifts/${p}`);
  // comparison (C-02 / C-06 equivalents and unified)
  await go(`classic-reports-month-range`, `${CTR}/reports/month?employment-id=${emp}&start=${first}&end=${last}`);
  await go(`classic-reports-month-${month}`, `${CTR}/reports/month?employment-id=${emp}&start=${month}-01&end=${mEnd}`);
  await go(`classic-month-flex-time-${last}`, `${CTR}/month-flex-time?date=${last}`);
  await go(`unified-days`, `${UTR}/days?from=${first}&to=${last}`);
  writeFileSync(join(out, 'L-01-result.json'), JSON.stringify(res, null, 2));
  return { employment: emp, statuses: res.calls.map((c) => `${c.name}:${c.status}`) };
};
