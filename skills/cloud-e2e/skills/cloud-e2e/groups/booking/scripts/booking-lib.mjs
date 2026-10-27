// booking-lib.mjs — group booking helpers for worker scripts run by scripts/harness/app.mjs (--app mypp for HPs, --app poma for SP / PM).
//   import { HP, createAvailability, createSeries, dayView, ncRows, findHp, assignments, cancelAssignment, rrBodyFrom, createRR,
//            createIPO, opportunity, cancelOpportunity } from '<GROUP_DIR>/scripts/booking-lib.mjs'
// Every function takes the harness `api` ({call(method, path, body), get(path)}; the harness records each response).
// Paths / bodies follow cloud master 89d7e960e0: myPP availability-api.service.ts, calendar-api.service.ts; planner
// assignment-api.service.ts, health-professional-api.service.ts; public API schemas poma-public/v1 (ResourceReplacementRequest,
// PepEmployee). No credentials here. Never call GAT, any test-data endpoint or a POMA job from these scripts.

export const HP = '/api/mobile/health-professional/v1';
export const PRIV = '/api/private';

const q = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
const ok = (r) => r && r.status >= 200 && r.status < 300;

// ---- HP availabilities (myPP session) ----
// shifts: ['EARLY'|'NORMAL'|'LATE'|'NIGHT'] (Frühdienst / Tagdienst / Spätdienst / Nachtdienst); pools: [{id}] or allPools
export async function createAvailability(api, { date, shifts, poolIds = [], allPools = false }) {
  return api.call('POST', `${HP}/availabilities`, { date, shifts, pools: poolIds.map((id) => ({ id })), all_pools_selected: allPools });
}
// series body as the form sends it (capture once from the UI and reuse its shape): {date, end_date, days_of_week, repeat_type, repeat_count, shifts, pools, all_pools_selected, series: true}
export async function createSeries(api, body, force = false) { return api.call('POST', `${HP}/availabilities-series?${q({ force })}`, body); }
export async function editSeries(api, body, fromDay, force = false) { return api.call('PUT', `${HP}/availabilities-series?${q({ force, from: fromDay })}`, body); }
export async function deleteAvailability(api, id) { return api.call('DELETE', `${HP}/availabilities/${id}`); }
export async function deleteIteration(api, id, day) { return api.call('DELETE', `${HP}/availabilities-series/${id}/iteration?${q({ day })}`); }
export async function dayView(api, date) { return api.get(`${HP}/calendar/day-view?${q({ date })}`); }
export async function rosterRange(api, from, to) { return api.get(`${HP}/calendar/roster?${q({ from, to })}`); }
// dates in [from,to] that carry an availability, from calendar/roster
export async function availabilityDates(api, from, to) {
  const r = await rosterRange(api, from, to);
  return ok(r) ? (r.body?.days || []).filter((d) => (d.availabilities || []).length).map((d) => d.date) : [];
}

// ---- notification center (recipient session) ----
// rows of one object created at/after sinceIso (ISO string); typeRe optional (e.g. /BOOKING/, /RESOURCE_REPLACEMENT/)
export async function ncRows(api, { objectId, sinceIso, typeRe } = {}) {
  const out = [];
  for (let p = 0; p < 4; p++) {
    const r = await api.get(`${HP}/notifications?${q({ 'current-page': p, 'sort-direction': 'DESC', 'page-size': 20 })}`);
    const rows = r.body?.data || [];
    out.push(...rows.filter((n) => (!objectId || String(n.object_id) === String(objectId)) && (!sinceIso || String(n.created_date) >= sinceIso) && (!typeRe || typeRe.test(String(n.type)))));
    if (rows.length < 20 || (sinceIso && rows.some((n) => String(n.created_date) < sinceIso))) break;
  }
  return out;
}

// ---- planner web app (SP / PM session) ----
// Find HP: replay the query string the UI sent (capture it from api-index.jsonl), e.g. 'date=2026-11-03&group-node-id=..&shift-definition-id=..&pool-ids=..'
export async function findHp(api, query) { return api.get(`${PRIV}/tenant/consumable-pools/availabilities?${query}`); }
export async function assignments(api, params = {}) { return api.get(`${PRIV}/assignments?${q({ 'current-page': 0, 'page-size': 50, ...params })}`); }
export async function cancelAssignment(api, id) { return api.call('PUT', `${PRIV}/assignments/${id}/cancel`, {}); }
export async function opportunity(api, id) { return api.get(`${PRIV}/opportunities/${id}`); }
export async function cancelOpportunity(api, id) { return api.call('DELETE', `${PRIV}/opportunities/${id}`); }

// Resource replacement as PEP would start it (public API v1, PEP stand-in). `detail` = the replaced employee's
// planned-shift-detail (myPP, ER session: start, end, shift_type, title, shift_definition_id, shift_position);
// ids from scripts/rr-ids.sql (employment / node / roster / candidates' keycloak ids). Icon: 1×1 PNG placeholder
// (the schema requires an icon; the real one is optional evidence).
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
export function rrBodyFrom(detail, { employeeId, employmentId, nodeId, employeeName, roster, pool, absenceShiftId }) {
  const body = {
    shift_request: {
      start: new Date(detail.start).toISOString(), end: new Date(detail.end).toISOString(), shift_type: detail.shift_type,
      employee_id: String(employeeId), employment_id: String(employmentId), node_id: String(nodeId),
      shift_title: detail.title, employee_name: employeeName,
    },
    pep_service: { code: Number(detail.shift_definition_id), position: detail.shift_position || 'FULL', title: detail.title, icon: { format: 'PNG', data: [PNG_1PX] } },
    pep_roster: { id: String(roster.id), name: roster.name, path: roster.path || roster.name },
    pep_pool: pool.map((p) => ({ employee_id: String(p.employeeId), keycloak_user_id: p.keycloakUserId, first_name: p.firstName, last_name: p.lastName, email: p.email })),
  };
  if (absenceShiftId) body.absence_shift_id = String(absenceShiftId);
  return body;
}
export async function createRR(api, body) { return api.call('POST', '/api/v1/resource-replacement', body); }
// Internal pool opportunity as PEP "Neue Anfrage" would start it (v2 needs writeShiftsOnPrem ON)
export async function createIPO(api, date, rosterId) { return api.call('POST', '/api/v2/internal-pool-opportunity', { date, roster_id: String(rosterId) }); }
// opportunity id from the `url` the create calls answer ("…?opportunity=<id>" or "…opportunity-id=<id>")
export function oppIdFromUrl(url) {
  const m = /opportunity(?:-id)?=([0-9a-f-]{8,})/i.exec(String(url || ''));
  return m ? m[1] : null;
}
