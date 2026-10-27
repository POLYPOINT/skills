// Redaction of everything a harness writes to disk (api/NNN-*.json, api-index.jsonl, result.json, logs).
// Rules (references/harness.md § Redaction): secret-named keys → "[redacted]"; JWTs anywhere in a string → "[redacted-jwt]";
// "Bearer …" → "Bearer [redacted]"; secret query parameters in URLs → "[redacted]"; per-endpoint rules (portal / PolyID):
// bodies never written for credential endpoints, actuator env/configprops/heapdump, PolyID login/2FA/password posts;
// licence raw_xml → "sha256:<hex>"; downloaded log / ZIP contents → size and line count only.
// Pure functions; unit-tested offline on tests/fixtures/*.json.
import { createHash } from 'node:crypto';

export const REDACTED = '[redacted]';
export const REDACTED_JWT = '[redacted-jwt]';

const SECRET_KEYS = new Set([
  'accesstoken', 'refreshtoken', 'idtoken', 'idtokenhint', 'token', 'tokens', 'bearer', 'authorization', 'proxyauthorization',
  'cookie', 'setcookie', 'secret', 'clientsecret', 'keycloakclientsecret', 'password', 'passwort', 'newpassword', 'oldpassword',
  'currentpassword', 'confirmpassword', 'pwd', 'pin', 'otp', 'otpsecret', 'totpsecret', 'otpcode', 'twofactorcode', 'code2fa',
  'apikey', 'privatekey', 'sessiontoken', 'codeverifier', 'clientassertion', 'assertion', 'masterpassword', 'loginpassword',
  'credentials', 'servicesaccountcredentials', 'producerserviceaccountcredentials', 'consumerserviceaccountcredentials',
  'subjecttoken', 'actortoken', 'supporttoken', 'impersonationtoken', 'dbpassword', 'connectstring', 'sshprivatekey',
]);
const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
export function isSecretKey(key) {
  const n = norm(key);
  if (!n) return false;
  if (SECRET_KEYS.has(n)) return true;
  // suffix rule: fooToken, xyzSecret, newPassword … but not tokenType / expiresIn / secretName-like metadata keys
  if (/(token|tokens|secret|password|passwort)$/.test(n) && !/^(is|has|show|can|use|allow)/.test(n)) return true;
  return false;
}

const JWT_RE = /eyJ[A-Za-z0-9_-]{4,}\.eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g;
const BEARER_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const SECRET_QUERY = /^(access_?token|refresh_?token|id_?token|id_token_hint|token|client_?secret|password|secret|otp|session_?token|support_?token|subject_token|assertion|code_verifier|login_challenge|consent_challenge)$/i;
// `code` is an OAuth authorization code only on auth redirects; on the portal feature API it is the flag code (kept)
const isAuthCode = (u) => u.searchParams.has('state') || /(callback|oauth|openid|login|auth|redirect|consent)/i.test(u.pathname);

export function redactString(s) {
  if (typeof s !== 'string' || s.length < 8) return s;
  let out = s.replace(JWT_RE, REDACTED_JWT).replace(BEARER_RE, (m, kind) => `${kind} ${REDACTED}`);
  // form bodies / query strings embedded in strings: password=…&token=…
  out = out.replace(/(^|[?&\s])((?:access_?token|refresh_?token|id_?token|id_token_hint|client_?secret|password|passwort|secret|otp|code_verifier)=)([^&\s"]+)/gi,
    (m, pre, key) => `${pre}${key}${REDACTED}`);
  return out;
}

export function redactUrl(raw) {
  let u; try { u = new URL(raw); } catch { return redactString(String(raw)); }
  for (const k of [...u.searchParams.keys()]) if (SECRET_QUERY.test(k) || (k === 'code' && isAuthCode(u))) u.searchParams.set(k, REDACTED);
  if (u.username || u.password) { u.username = ''; u.password = ''; }
  if (u.hash && /token|code|secret/i.test(u.hash)) u.hash = '#[redacted]';
  return redactString(u.toString());
}

export function sha256(s) { return createHash('sha256').update(String(s)).digest('hex'); }

// Deep copy with secrets removed. Options: {hashKeys: ['raw_xml']} replace values of these keys by "sha256:<hex>".
export function redactDeep(value, opts = {}, depth = 0) {
  const hashKeys = new Set((opts.hashKeys || ['raw_xml', 'rawxml', 'licensexml', 'license_xml']).map(norm));
  const walk = (v, d) => {
    if (d > 60) return '[depth-limit]';
    if (v == null) return v;
    if (typeof v === 'string') return redactString(v);
    if (typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((x) => walk(x, d + 1));
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (hashKeys.has(norm(k)) && typeof x === 'string') o[k] = `sha256:${sha256(x)}`;
      else if (isSecretKey(k)) o[k] = x == null || x === '' ? x : REDACTED;
      else o[k] = walk(x, d + 1);
    }
    return o;
  };
  return walk(value, depth);
}

// Request body (string, possibly JSON or form-encoded) → safe string
export function redactBodyString(body) {
  if (body == null) return null;
  const s = String(body);
  try { return JSON.stringify(redactDeep(JSON.parse(s))); } catch { /* not JSON */ }
  if (/^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(s)) {
    return s.split('&').map((kv) => { const i = kv.indexOf('='); const k = i < 0 ? kv : kv.slice(0, i); return isSecretKey(decodeURIComponent(k.replace(/\+/g, ' '))) || SECRET_QUERY.test(k) ? `${k}=${REDACTED}` : redactString(kv); }).join('&');
  }
  return redactString(s);
}

export function redactHeaders(h = {}) {
  const o = {};
  for (const [k, v] of Object.entries(h)) o[k] = isSecretKey(k) || /^(authorization|cookie|set-cookie|x-api-key|x-auth-token)$/i.test(k) ? REDACTED : redactString(String(v));
  return o;
}

// ---- endpoint rules --------------------------------------------------------------------------------------------------
// skipBody: response body never written (replaced by a marker with byte count); skipRequest: request body never written.
const ENDPOINT_RULES = [
  { re: /\/(producer|consumer)-service-account-credentials(\/|$|\?)/i, skipBody: true, why: 'service-account credentials' },
  { re: /\/integration-partners\/[^/]+\/secret|fetchSecret|\/client-secret/i, skipBody: true, why: 'client secret' },
  { re: /\/actuator\/(env|configprops|heapdump|threaddump)(\/|$|\?)|actuatorOptionalSegment=(env|configprops|heapdump)/i, skipBody: true, why: 'actuator env / configprops / heapdump' },
  { re: /\/(onprem-config-generator|config-encryption)\/.*(master-?password|passphrase)/i, skipBody: true, skipRequest: true, why: 'Config Generator master password' },
  { re: /\/config-encryption\/(unlock|master)/i, skipRequest: true, why: 'Config Generator master password' },
  { re: /\/recordings?\/[^?]*\/(content|body|payload)/i, skipBody: true, why: 'recording bodies' },
  { re: /\/support-token(\/|$|\?)/i, skipBody: true, why: 'support token' },
  { re: /\/api\/auth\//i, skipBody: true, skipRequest: true, why: 'PolyID auth API (tokens, passwords)' },
  { re: /\/ui\/(login-form|2fa-form|password-management)\/submit/i, skipRequest: true, why: 'PolyID login / 2FA / password form' },
  { re: /\/ui\/impersonation\//i, skipRequest: true, why: 'PolyID impersonation form' },
  { re: /\/protocol\/openid-connect\/token/i, skipBody: true, skipRequest: true, why: 'token endpoint' },
  { re: /\/api\/partner\/[^/]+\/token(\?|$)/i, skipBody: true, skipRequest: false, why: 'partner impersonation token' },
  { re: /\/logfiles\/|\/logs\/download|\.zip(\?|$)|\/pep-config-exports\/[^/]+\/download/i, summarize: true, why: 'log / ZIP contents' },
];
export function endpointRule(url) {
  const s = String(url);
  return ENDPOINT_RULES.find((r) => r.re.test(s)) || null;
}

export function summarizeContent(text) {
  const s = typeof text === 'string' ? text : JSON.stringify(text ?? '');
  return { redacted: 'content not recorded (log / archive)', bytes: Buffer.byteLength(s), lines: s ? s.split('\n').length : 0 };
}

// Build the record written to api/NNN-*.json: {meta, body}. `body` is the parsed JSON or text of the response.
export function safeRecord(meta, body) {
  const rule = endpointRule(meta.url);
  const m = { ...meta, url: redactUrl(meta.url) };
  if (m.requestBody != null) m.requestBody = rule?.skipRequest ? REDACTED : redactBodyString(m.requestBody);
  let b;
  if (rule?.skipBody) b = { redacted: `body not recorded: ${rule.why}`, bytes: Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body ?? '')) };
  else if (rule?.summarize) b = summarizeContent(body);
  else b = typeof body === 'string' ? redactString(body) : redactDeep(body);
  if (rule) m.redactionRule = rule.why;
  return { meta: m, body: b };
}

// Masks for screenshots: OTP / QR elements (PolyID), secret spans (portal Tenant Details), phone of "Test Send Messages"
export const MASK_SELECTORS = {
  polyid: ['.otp-img', '.qr_code', '#otp_secret', '.copy-secret-container', '.otp-setup-container'],
  portal: ['.code', 'input[type=tel]', 'input[name*="mobile" i]', 'input[formcontrolname*="mobile" i]', 'input[formcontrolname*="recipient" i]'],
};
