// swap-lib.mjs — group swap helpers for worker scripts run by scripts/harness/app.mjs (--app mypp for HPs, --app poma for the SP).
//   import { HP, plannedShifts, shiftDetail, candidates, createSwap, ... } from '<GROUP_DIR>/scripts/swap-lib.mjs'
// Every function takes the harness `api` object ({call(method, path, body), get(path)}; responses are recorded by the harness
// under <outdir>/api/). Paths and bodies follow the myPP / planner frontends (cloud master 89d7e960e0):
//   myPP  shared/services/api/shift-swap-api.service.ts, calendar-api.service.ts, opportunity-api.service.ts
//   POMA  service/api/shift-swap-api.service.ts
// No credentials here: the bearer is the one the page captured. Never call GAT endpoints or any test-data endpoint from scripts.

export const HP = '/api/mobile/health-professional/v1';
export const SPT = '/api/private/shift-trades';

const q = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
const ok = (r) => r && r.status >= 200 && r.status < 300;
function must(r, what) {
  if (!ok(r)) throw new Error(`${what}: HTTP ${r?.status} ${JSON.stringify(r?.body).slice(0, 300)}`);
  return r.body;
}

// planned shifts of one day for the logged-in HP: [{shift_planning_id, roster_cell_id, shift_definition_id, shift_position, shift_kind, available_for_shift_trade, title, employment_id}]
export async function plannedShifts(api, day) {
  const b = must(await api.get(`${HP}/calendar/roster?${q({ from: day, to: day })}`), `calendar/roster ${day}`);
  const d = (b.days || []).find((x) => x.date === day) || (b.days || [])[0] || { planned_shifts: [] };
  return d.planned_shifts || [];
}

// the planning of `day` with a given position (FULL/LEFT/RIGHT) or PA code; throws when ambiguous or missing
export async function pickShift(api, day, { position, def } = {}) {
  const all = await plannedShifts(api, day);
  const hit = all.filter((s) => (!position || s.shift_position === position) && (!def || String(s.shift_definition_id) === String(def)));
  if (hit.length !== 1) throw new Error(`pickShift ${day} ${position || ''} ${def || ''}: ${hit.length} matches of ${all.length}`);
  return hit[0];
}

export async function shiftDetail(api, ps) {
  return must(await api.get(`${HP}/calendar/planned-shift-detail?${q({ 'shift-planning-id': ps.shift_planning_id, 'roster-cell-id': ps.roster_cell_id })}`), 'planned-shift-detail');
}

// candidates for a planning; targetEmploymentIds = flexible / specific candidates, targetNodeIds = category filter nodes
export async function candidates(api, ps, { targetNodeIds = [], targetEmploymentIds = [] } = {}) {
  const r = await api.call('POST', `${HP}/calendar/shift-trade-candidates`, {
    shift_planning_id: ps.shift_planning_id, roster_cell_id: ps.roster_cell_id,
    target_node_ids: targetNodeIds, target_employment_ids: targetEmploymentIds,
  });
  return { status: r.status, list: ok(r) ? (r.body?.candidates || []) : [], body: r.body };
}

// candidate entry of an employee (MITARBEITER_ID = employment id); matches employee_id, target_employment or shift.employment_id
export function candidateOf(list, employmentId) {
  const id = String(employmentId);
  return list.find((c) => [c.employee_id, c.target_employment, c.shift?.employment_id].map((v) => (v == null ? '' : String(v))).includes(id)) || null;
}

// direct (or flexible with `compensation`) swap; returns {status, body, oppId}; oppId read from the owner's open list
export async function createSwap(api, { detail, chosen, message = '', compensation = null }) {
  const body = { shift: { shift: detail, message, candidates: chosen } };
  if (compensation) body.compensation_shift = { shift: compensation.shift, message: compensation.message || '', candidates: compensation.candidates };
  const before = new Set((await openTrades(api)).map(oppIdOf));
  const r = await api.call('POST', `${HP}/shift-trades`, body);
  let oppId = null;
  if (ok(r)) {
    const m = /opportunit(?:y|ies)[=/]([0-9a-f-]{8,})/i.exec(r.body?.url || '');
    oppId = m ? m[1] : ((await openTrades(api)).map(oppIdOf).find((id) => id && !before.has(id)) || null);
  }
  return { status: r.status, body: r.body, oppId, request: body };
}

export const oppIdOf = (t) => t?.opportunity?.id ?? t?.opportunity_id ?? t?.id ?? null;

export async function openTrades(api) {
  const r = await api.get(`${HP}/shift-trades/open-shift-trades`);
  return ok(r) ? (r.body?.shift_trades || r.body || []) : [];
}
export async function openTrade(api, oppId) { return api.get(`${HP}/shift-trades/open-shift-trades/${oppId}`); }
export async function cancelledTrades(api) { return api.get(`${HP}/shift-trades/cancelled-shift-trades?limit=10`); }

// candidate answers: response YES | NO (message only with NO / YES_BUT)
export async function answer(api, oppId, response, message) {
  return api.call('POST', `${HP}/opportunities/${oppId}/application`, message ? { response, message } : { response });
}
// owner submits one accepted request (shift_trade_requests[].id from openTrade)
export async function submit(api, oppId, requestId) {
  return api.call('POST', `${HP}/opportunities/${oppId}/submission?${q({ 'shift-trade-request-id': requestId })}`, {});
}
// owner cancels ("Tausch löschen")
export async function cancelSwap(api, oppId) { return api.call('DELETE', `${HP}/opportunities/${oppId}`); }

// lock state of the logged-in user per day: {day: true|false}
export async function locks(api, from, to = from) {
  const b = must(await api.call('POST', `${HP}/calendar/user-calendar-locks?${q({ from, to })}`, {}), 'user-calendar-locks');
  return Object.fromEntries((b.user_calendar_locks || []).map((l) => [l.date, !!l.is_locked]));
}

// request id of a candidate inside the owner's swap detail
export function requestIdOf(tradeDetail, employmentId) {
  const reqs = tradeDetail?.opportunity?.shift_trade_requests || tradeDetail?.shift_trade_requests || [];
  const id = String(employmentId);
  const r = reqs.find((x) => [x.shift?.employment_id, x.employee_id, x.target_employment].map((v) => (v == null ? '' : String(v))).includes(id));
  return r ? r.id : null;
}

// ---- shift planner (planner web app session, --app poma) ----
export async function spList(api, { state, hpId, page = 0, size = 50 } = {}) {
  return api.get(`${SPT}/past-and-current?${q({ 'current-page': page, 'page-size': size, 'opportunity-state': state, 'hp-id': hpId })}`);
}
// SP row of one opportunity (searches the first pages; never judge by counts)
export async function spRow(api, oppId, { state } = {}) {
  for (let p = 0; p < 5; p++) {
    const r = await spList(api, { state, page: p });
    const rows = r.body?.data || [];
    const hit = rows.find((x) => String(x.opportunity_id ?? x.id ?? x.opportunity?.id) === String(oppId));
    if (hit || rows.length === 0) return hit || null;
  }
  return null;
}
// APPROVE | REJECT through the conflict-checking write (what "Bestätigen" / "Ablehnen" send)
export async function spDecide(api, oppId, requestId, operation, statusMessage = null) {
  return api.call('PUT', `${SPT}/${oppId}/check-conflicts-and-write`, { shift_trade_request_id: requestId, operation, status_message: statusMessage });
}
export async function spApply(api, oppId, writeShiftTradeConflicts) {
  return api.call('PUT', `${SPT}/${oppId}/apply-and-write`, writeShiftTradeConflicts);
}

// ---- notification center (recipient session) ----
// rows created at/after `sinceIso` whose object_id is oppId (type filter optional, e.g. /SHIFT_TRADE/)
export async function swapNotifications(api, oppId, sinceIso, typeRe = /SHIFT_TRADE/) {
  const r = await api.get(`${HP}/notifications?${q({ 'current-page': 0, 'sort-direction': 'DESC', 'page-size': 50 })}`);
  const rows = r.body?.data || r.body?.notifications || r.body?.content || [];
  return rows.filter((n) => String(n.object_id) === String(oppId) && (!sinceIso || String(n.created_date) >= sinceIso) && (!typeRe || typeRe.test(String(n.type))));
}
