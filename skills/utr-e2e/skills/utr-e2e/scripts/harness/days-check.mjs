// days-check.mjs — read-only unified day check for one employee (the login the harness runs as). Gate G4b verifier and the
// quick "does /days answer for these days" probe (first run: the check that proved the api-pp definition-cache flush).
//   DAYS=YYYY-MM-DD[,YYYY-MM-DD...] [EXPECT_DEF=<shift definition id>] \
//     node scripts/harness/mypp.mjs <tenant-id> <login> scripts/harness/days-check.mjs <outdir>
// Per day: HTTP status of GET /unified-time-recording/v1/days (through the day view), the shift definition ids of the day's
// shifts (or the start of the error body), and with EXPECT_DEF whether that definition is among them.
// Exit signal: result.ok === false when any day is not 200 or EXPECT_DEF is missing on a day (see result.json of the harness).
// Failure signature of a stale api-pp definition cache: 404 "Shift definition with id <N> not found" (api-pp self-service
// .../shiftplanning) or 500 on permissions/month/allowed-on-call-shifts for every day planned with that definition.
export default async ({ api, log, shot }) => {
  const days = (process.env.DAYS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!days.length) throw new Error('set DAYS=YYYY-MM-DD[,...]');
  const expect = process.env.EXPECT_DEF ? String(process.env.EXPECT_DEF) : null;
  const out = { ok: true, expectDef: expect, days: {} };
  for (const d of days) {
    const nav = () => api.goto(`/tabs/unified-time-recording?date=${d}`, '/unified-time-recording/v1/days')
      .catch((e) => ({ status: 'ERR', body: String(e).slice(0, 200) }));
    let r = await nav();
    // the first navigation of a fresh profile sometimes issues no /days request (X-05, master-1822): retry once, then mark it
    if (!r || r.status == null) { log(d, 'no response, retrying once'); await new Promise((res) => setTimeout(res, 3000)); r = await nav(); }
    const body = r?.body;
    const plan = Array.isArray(body) ? body[0] : null;
    const defs = plan ? (plan.shifts || []).map((s) => String(s.shift_definition?.id ?? s.shift_definition_id ?? s.kind)) : null;
    const onCall = plan ? (plan.on_call_shifts || []).map((s) => String(s.shift_definition?.id ?? s.shift_definition_id ?? 'on-call')) : null;
    const row = { status: r?.status ?? 'no response', defs, onCall };
    if (!plan) row.error = typeof body === 'object' ? JSON.stringify(body).slice(0, 300) : String(body).slice(0, 300);
    if (expect) row.expectedPresent = !!plan && [...(defs || []), ...(onCall || [])].includes(expect);
    if (row.status !== 200 || (expect && !row.expectedPresent)) out.ok = false;
    out.days[d] = row;
    log(d, JSON.stringify(row));
    await shot(`day-${d}`);
  }
  return out;
};
