// Small shared helpers of the cloud-e2e harness: Playwright loading, argument parsing, logging, credential files,
// PolyID form helpers (ASCII e-mail, UTF-8 re-encoding), JWT decoding (in memory), RFC 6238 TOTP.
import { createRequire } from 'node:module';
import { appendFileSync, readFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHmac } from 'node:crypto';

export const DM_DIR = process.env.DM_CONFIG_DIR || join(homedir(), '.config/deploymate');

// Playwright is installed by the deploymate skill under $DM_CONFIG_DIR (same rule as the UTR harness)
export function loadPlaywright() {
  const require = createRequire(join(DM_DIR, '/'));
  return require('playwright');
}

// argv → {pos: [...], flags: {name: value|true}}; `valued` lists the flags that take a value (e.g. ['--app', '--stage'])
export function parseArgs(argv, valued = []) {
  const pos = []; const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) { flags[a.slice(0, eq)] = a.slice(eq + 1); continue; }
      if (valued.includes(a)) { flags[a] = argv[i + 1] ?? ''; i++; } else flags[a] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

export function makeLogger(outDir, file = 'harness.log', { iso = false } = {}) {
  mkdirSync(outDir, { recursive: true });
  return (...a) => {
    const ts = iso ? new Date().toISOString() : new Date().toISOString().slice(11, 19);
    const line = `[${ts}] ${a.join(' ')}`;
    console.log(line);
    try { appendFileSync(join(outDir, file), line + '\n'); } catch { /* out dir gone */ }
  };
}

// Credential files with secrets must be private (0600 / 0400): refuse group/other bits
export function readPrivateJson(path, label = 'credential file') {
  if (!existsSync(path)) throw new Error(`${label} ${path} not found`);
  const mode = statSync(path).mode & 0o777;
  if (mode & 0o077) throw new Error(`${label} ${path} has mode ${mode.toString(8)}: chmod 600 it first (secrets must stay private)`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

// DeployMate seed manifest ($DM_CONFIG_DIR/<tenant>.test-data.json, written by dm-api.sh test-data / dm-join.sh)
export function readManifest(tenant) {
  return JSON.parse(readFileSync(join(DM_DIR, `${tenant}.test-data.json`), 'utf8')).manifest;
}

// --cred-file for shared tenants: {"tenant": "<id>", "users": [{"login": "...", "email": "...", "password": "..."}]} (0600)
export function readCredFile(path, login, tenant) {
  const j = readPrivateJson(path, '--cred-file');
  if (j.tenant && tenant && j.tenant !== tenant) throw new Error(`--cred-file is for tenant ${j.tenant}, not ${tenant}`);
  const users = Array.isArray(j.users) ? j.users : [];
  const u = users.find((x) => x.login === login);
  if (!u) throw new Error(`--cred-file has no user with login ${login}`);
  if (!u.password) throw new Error(`--cred-file user ${login} has no password`);
  return { email: u.email || null, password: u.password };
}

// PolyID's on-board (e-mail) form posts ISO-8859-1 and dies on non-ASCII local parts: transliterate (ü→ue …)
export const asciiLocal = (s) => String(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').normalize('NFD').replace(/[^\x00-\x7f]/g, '');

// PolyID's login pages declare no charset, so Chromium submits their forms as windows-1252; re-encode such bodies as UTF-8
export const reencodeForm = (body) => body.split('&').map((kv) => kv.split('=').map((part) => {
  const raw = part.replace(/\+/g, ' ');
  try { decodeURIComponent(raw); return part; } catch { /* not valid UTF-8 percent-encoding: treat as latin-1 */ }
  const bytes = []; for (let i = 0; i < raw.length; i++) { if (raw[i] === '%' && /^[0-9A-Fa-f]{2}$/.test(raw.slice(i + 1, i + 3))) { bytes.push(parseInt(raw.slice(i + 1, i + 3), 16)); i += 2; } else bytes.push(raw.charCodeAt(i)); }
  return encodeURIComponent(Buffer.from(bytes).toString('latin1'));
}).join('=')).join('&');

// Decode a JWT (or "Bearer <jwt>") in memory: header + payload, never the signature. Returns null when not a JWT.
export function decodeJwt(token) {
  if (!token) return null;
  const t = String(token).replace(/^Bearer\s+/i, '').trim();
  const parts = t.split('.');
  if (parts.length < 2) return null;
  const dec = (p) => JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  try { return { header: dec(parts[0]), payload: dec(parts[1]) }; } catch { return null; }
}

// Role names of a decoded token (realm roles, client roles, flat role / authority claims). Names only.
export function roleNames(payload) {
  if (!payload) return { roles: [], byClient: {} };
  const set = new Set(); const byClient = {};
  const add = (r) => { if (typeof r === 'string' && r) set.add(r); };
  (payload.realm_access?.roles || []).forEach(add);
  for (const [client, v] of Object.entries(payload.resource_access || {})) { byClient[client] = [...(v.roles || [])]; (v.roles || []).forEach(add); }
  for (const k of ['roles', 'authorities', 'groups', 'permissions']) { const v = payload[k]; if (Array.isArray(v)) v.forEach((x) => add(typeof x === 'string' ? x : x?.authority || x?.name)); else if (typeof v === 'string') v.split(/[ ,]+/).forEach(add); }
  return { roles: [...set].sort(), byClient };
}

// RFC 4648 base32 → Buffer
export function base32Decode(s) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(s).toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  let bits = 0; let value = 0; const out = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error('invalid base32 character in OTP secret');
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

// RFC 6238 TOTP (default SHA1, 6 digits, 30 s). `secret` = base32 string as PolyID shows it (#otp_secret); kept in memory only.
export function totp(secret, { time = Date.now(), step = 30, digits = 6, algorithm = 'sha1' } = {}) {
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  let counter = Math.floor(time / 1000 / step);
  const msg = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) { msg[i] = counter & 0xff; counter = Math.floor(counter / 256); }
  const h = createHmac(algorithm, key).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

// file-name segment of an API path (same rule as the UTR harness)
export const safeSeg = (u) => (u.pathname + (u.search || '')).replace(/^\/+/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 150);

// usage error helper: print and exit with the given code
export function die(code, msg) { console.error(msg); process.exit(code); }
