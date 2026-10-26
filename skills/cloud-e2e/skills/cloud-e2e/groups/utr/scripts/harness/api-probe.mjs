// Day view (to capture a token) then direct API reads: unified + legacy permissions (rights check of step b), unified/classic
// month report, classic day (its `configuration` carries the time-stamp config), month flex time, capabilities. Read-only.
// Every endpoint here answered 200 on 2026-10-14. result.dayPermissions = the /days day.permissions of DATE (can_add_on_call,
// is_period_closed, is_read_only, can_edit_*). result.permissions.values / result.legacyPermissions.values = the full permission
// objects (small): the values step (b) and the P family check (legacy all true incl. license; unified can_add_timestamps,
// can_add_retroactive_timestamps, time_recording_mode) are readable in result.json without opening api/*.json.
// The cloud has no mobile closing-dates or legacy /days endpoint (both 404): closing = unified /days `permissions.is_period_closed`
// and seed/audit.sql A9; allowed periods = api-gw /api/v1/legacy-time-recording/{emp}/days (oracles.md).
//   DATE=YYYY-MM-DD (default yesterday, Europe/Zurich)  MONTH=YYYY-MM (default DATE's month)
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const yesterday = () => ymd(new Date(Date.now() - 864e5));

export default async ({ api, shot, log }) => {
  const d = process.env.DATE || yesterday(); const month = process.env.MONTH || d.slice(0, 7);
  const day = await api.goto(`/tabs/unified-time-recording?date=${d}`, '/unified-time-recording/v1/days');
  await shot(`day-${d}`);
  const emp = day?.body?.[0]?.employment_id; const [y, m] = month.split('-').map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // /days day.permissions carries can_add_on_call (P-04); the unified /permissions endpoint has no such field
  const out = { employment: emp, day: day?.status, dayPermissions: day?.body?.[0]?.permissions ?? null };
  log('dayPermissions', JSON.stringify(out.dayPermissions));
  const calls = {
    permissions: `/api/mobile/unified-time-recording/v1/permissions?date=${d}&employment-id=${emp}`,
    legacyPermissions: `/api/mobile/legacy-time-recording/v1/permissions`,
    unifiedMonth: `/api/mobile/unified-time-recording/v1/reports/month?employment-id=${emp}&start=${month}-01&end=${month}-${String(last).padStart(2, '0')}`,
    classicMonth: `/api/mobile/time-recording/v1/reports/month?employment-id=${emp}&start=${month}-01&end=${month}-${String(last).padStart(2, '0')}`,
    classicDay: `/api/mobile/time-recording/v1/days?day=${d}`,
    flex: `/api/mobile/time-recording/v1/month-flex-time?date=${d}`,
    capabilities: `/api/capabilities/v1/capabilities`,
  };
  const withValues = new Set(['permissions', 'legacyPermissions']);
  for (const [k, p] of Object.entries(calls)) {
    const r = await api.get(p).catch((e) => ({ status: 'ERR', body: String(e) }));
    out[k] = { status: r.status, keys: r.body && typeof r.body === 'object' ? Object.keys(r.body).slice(0, 12) : String(r.body).slice(0, 120) };
    if (withValues.has(k) && r.body && typeof r.body === 'object') out[k].values = r.body;
    log(k, JSON.stringify(out[k]));
  }
  return out;
};
