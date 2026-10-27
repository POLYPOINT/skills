// Host guard shared by every cloud-e2e harness helper (references/harness.md § Host guard).
// Allowed: https hosts of the CT stage (ct-*.dev.k8s.polypoint-dev.com) and, only with an explicit `--stage preview`, Preview
// (preview-*.demo.k8s.polypoint-dev.com). Refused always: *.polypointservices.ch (Staging / Production cluster), any host
// containing "prod" or "staging", plain http, explicit ports, and the destructive paths of hard rule 2 (/test/** outside the
// gateway-mock allow-list, GAT clean / shift-trades).
// No network access here: pure functions, unit-tested offline in tests/run-tests.mjs.

export class GuardError extends Error {
  constructor(msg) { super(msg); this.name = 'GuardError'; this.code = 5; }
}

// Stage hosts. CT values verified from the frontends' environment.ct.ts and polypoint-kubernetes (see harness.md).
// Preview: only the hosts named in the repo; pomaApi / hydra are unknown there and must be given by env (POMA_API_URL …).
export const STAGES = {
  ct: {
    pomaWeb: 'https://ct-poma-webapp.dev.k8s.polypoint-dev.com',
    pomaApi: 'https://ct-poma-api.dev.k8s.polypoint-dev.com',
    portalWeb: 'https://ct-portal-webapp.dev.k8s.polypoint-dev.com',
    portalApi: 'https://ct-portal-api.dev.k8s.polypoint-dev.com',
    polyidLogin: 'https://ct-polyid-login.dev.k8s.polypoint-dev.com',
    hydra: 'https://ct-polyid.dev.k8s.polypoint-dev.com',
    keycloak: 'https://ct-keycloak.dev.k8s.polypoint-dev.com',
    gwmock: 'https://ct-poma-gateway-mock.dev.k8s.polypoint-dev.com',
    eventHandler: 'https://ct-data-events.dev.k8s.polypoint-dev.com',
  },
  preview: {
    pomaWeb: 'https://preview-placement.demo.k8s.polypoint-dev.com',
    pomaApi: null,
    portalWeb: 'https://preview-portal.demo.k8s.polypoint-dev.com',
    portalApi: 'https://preview-portal-api.demo.k8s.polypoint-dev.com',
    polyidLogin: 'https://preview-polyid-login.demo.k8s.polypoint-dev.com',
    hydra: null,
    keycloak: 'https://preview-iam.demo.k8s.polypoint-dev.com',
    gwmock: 'https://preview-gateway-mock.demo.k8s.polypoint-dev.com',
    eventHandler: null,
  },
};

// env variable that overrides each base (kept compatible with the UTR helpers: MYPP_URL, POMA_API_URL, PORTAL_URL, POLYID_LOGIN_URL)
export const ENV_OVERRIDES = {
  pomaWeb: 'MYPP_URL', pomaApi: 'POMA_API_URL', portalWeb: 'PORTAL_URL', portalApi: 'PORTAL_API_URL',
  polyidLogin: 'POLYID_LOGIN_URL', hydra: 'HYDRA_URL', keycloak: 'KEYCLOAK_URL', gwmock: 'GWMOCK_URL', eventHandler: 'EVENT_HANDLER_URL',
};

const STAGE_HOST = {
  ct: /^ct-[a-z0-9-]+\.(dev\.)?k8s\.polypoint-dev\.com$/,
  preview: /^preview-[a-z0-9-]+\.(demo\.)?k8s\.polypoint-dev\.com$/,
};
const STAGE_TEXT = { ct: 'ct-*.dev.k8s.polypoint-dev.com', preview: 'preview-*.demo.k8s.polypoint-dev.com' };

export function normStage(stage) {
  const s = String(stage || 'ct').toLowerCase();
  if (!STAGE_HOST[s]) throw new GuardError(`GUARD: stage "${stage}" refused: only ct (default) or preview; staging and production are never driven by agents`);
  return s;
}

// Why a hostname is never acceptable, whatever the stage (null = not forbidden by itself)
export function forbiddenHostReason(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return 'empty host';
  if (/(^|\.)polypointservices\.ch$/.test(h)) return 'polypointservices.ch (Staging / Production cluster)';
  if (/prod/.test(h)) return 'host names "prod"';
  if (/staging/.test(h)) return 'host names "staging" (production cluster)';
  return null;
}

// Paths no helper may call (hard rule 2). The gateway mock's own API lives under /test/: gwmock.mjs passes allowGwmockTest.
const GWMOCK_TEST_OK = /^\/test\/(received-bookings|booking-response-strategy|cancel-booking-response-strategy)$/;
export function forbiddenPathReason(pathname, { gwmock = false } = {}) {
  const p = String(pathname || '/');
  if (/\/gat\/(clean|shift-trades)(\/|$)/i.test(p)) return 'GAT clean / shift-trades (stage-wide test-data generator)';
  if (/(^|\/)test(\/|$)/i.test(p)) {
    if (gwmock && GWMOCK_TEST_OK.test(p)) return null;
    return '/test/** endpoint (wipes or fakes stage data)';
  }
  return null;
}

// Check one URL against a stage; returns {ok, url, reason}
export function checkUrl(raw, stage = 'ct', opts = {}) {
  let s;
  try { s = normStage(stage); } catch (e) { return { ok: false, reason: e.message }; }
  let u;
  try { u = new URL(String(raw)); } catch { return { ok: false, reason: `not a URL: ${raw}` }; }
  const h = u.hostname.toLowerCase();
  const bad = forbiddenHostReason(h);
  if (bad) return { ok: false, url: u, reason: `refusing host "${h}": ${bad}` };
  if (u.protocol !== 'https:') return { ok: false, url: u, reason: `refusing ${u.protocol} (https only): ${h}` };
  if (u.port && u.port !== '443') return { ok: false, url: u, reason: `refusing explicit port ${u.port} on ${h}` };
  if (u.username || u.password) return { ok: false, url: u, reason: 'refusing credentials inside the URL' };
  if (!STAGE_HOST[s].test(h)) return { ok: false, url: u, reason: `refusing host "${h}": stage ${s} allows only ${STAGE_TEXT[s]}` };
  const badPath = forbiddenPathReason(u.pathname, opts);
  if (badPath) return { ok: false, url: u, reason: `refusing path ${u.pathname}: ${badPath}` };
  return { ok: true, url: u, reason: null };
}

export function guardUrl(label, raw, stage = 'ct', opts = {}) {
  const r = checkUrl(raw, stage, opts);
  if (!r.ok) throw new GuardError(`GUARD: ${label}: ${r.reason}`);
  return r.url;
}

// The base URLs of a stage with env overrides applied; every value that is set is guarded. `need` lists the keys the
// caller uses: a missing one (e.g. Preview pomaApi) throws with the env variable to set.
export function stageUrls(stage = 'ct', env = process.env, need = []) {
  const s = normStage(stage);
  const out = {};
  for (const [key, def] of Object.entries(STAGES[s])) {
    const raw = (env[ENV_OVERRIDES[key]] || def || '').replace(/\/+$/, '');
    if (!raw) { out[key] = null; continue; }
    out[key] = guardUrl(`${ENV_OVERRIDES[key] || key}`, raw, s).href.replace(/\/+$/, '');
  }
  for (const k of need) if (!out[k]) throw new GuardError(`GUARD: no ${k} URL for stage ${s}: set ${ENV_OVERRIDES[k]}`);
  return out;
}

// Playwright route predicate: block requests that must never leave the browser (production hosts, /test/**, GAT clean).
// Third-party hosts (fonts, maps) are not blocked; only forbidden hosts and forbidden paths on polypoint hosts are.
export function blockedRequestReason(rawUrl) {
  let u; try { u = new URL(rawUrl); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  const bad = forbiddenHostReason(h);
  if (bad && /polypoint/.test(h)) return bad;
  if (/polypoint/.test(h)) {
    const gw = /gateway-mock/.test(h);
    const bp = forbiddenPathReason(u.pathname, { gwmock: gw });
    if (bp) return bp;
  }
  return null;
}

// DeployMate tenant id (= env id): the UTR rule, kept for every helper that reads the DeployMate manifest
export const TENANT_RE = /^[a-z][a-z0-9-]{0,14}$/;
// Shared tenants (ct-zinc-master, pre-dev-main24, beekeeper-integration-tenant-test …) used with --cred-file
export const SHARED_TENANT_RE = /^[a-z][a-z0-9-]{0,62}$/;
