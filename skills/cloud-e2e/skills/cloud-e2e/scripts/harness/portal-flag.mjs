// CT portal ops: read / set / delete the tenant override of one feature (default: the past-days window of UTR scenario P-03).
// UTR-compatible wrapper over lib/portal.mjs (same CLI, files and exit codes as before; new work uses `portal-ops.mjs … flag`).
//   node portal-flag.mjs <profileDir> <outDir> <tenant-id> <login|read|set|delete> [value]
// Env: PORTAL_ORG (required, the organization slug of the DeployMate organization in portal ops, e.g. "deploymate-<org uuid>",
//      read once from the Organizations list and kept in env-facts.md), PORTAL_URL (default CT portal webapp),
//      PORTAL_FEATURE (default poma.onPrem.timeRecodingMaxAllowedPastDays), DM_CONFIG_DIR (Playwright location, as mypp.mjs).
// login  : HEADED window; the operator signs in to portal ops (right before family P: the session lasts ~1.5 h); the session lands in <profileDir> and every later
//          headless call (workers) reuses it. The script waits up to 5 min for the features table, then closes.
// read   : captures the tenant features JSON (GET …/admin/features/tenants/<tenant>) and screenshots the feature row.
// set    : types <value> into the feature row and clicks its save icon (PUT tenant override, the confirm dialog is accepted).
// delete : clicks the row's delete icon (removes the tenant override → the master value applies again) = the restore.
// Boolean features (upper table, e.g. PORTAL_FEATURE=poma.mobileApp.unifiedTimeRecording for the C family's classic UI): `set true|false`
//   flips the row's toggle (mat-slide-toggle / role=switch / checkbox) when its state differs, then clicks the row's save icon if
//   one exists; `read` logs the toggle state; `delete` is the same row delete icon. Detected automatically from the row content.
//   NOT yet verified against the live portal (2026-10-16): check 02-set-after-row.png and the logged PUT before relying on it
//   (or use `portal-ops.mjs <profile> flag <out> set <tenant> <code> <value>`, which writes through the API and re-reads).
// Exit codes: 0 ok, 2 row not found, 3 login needed (run the login action), 4 usage, 5 boolean control not found / wrong value
//   or host guard refusal (PORTAL_URL must be a CT host).
// Propagation to myPP: portal allFeatures cache (≈ 3 min) + poma features reload (60 s) → poll the myPP config/features
// response with a FRESH myPP profile folder until the new value shows (first run: 3–5 min; e2e-lib waitFlag). Never prints tokens.
import { legacyFlagUi } from './lib/portal.mjs';
import { GuardError } from './lib/guard.mjs';

const [profile, out, tenant, action, value] = process.argv.slice(2);
const ORG = process.env.PORTAL_ORG;
const CODE = process.env.PORTAL_FEATURE || 'poma.onPrem.timeRecodingMaxAllowedPastDays';
const PORTAL = process.env.PORTAL_URL || 'https://ct-portal-webapp.dev.k8s.polypoint-dev.com';
if (!profile || !out || !tenant || !['login', 'read', 'set', 'delete'].includes(action) || (action === 'set' && !value) || !ORG) {
  console.error('usage: PORTAL_ORG=<org slug> node portal-flag.mjs <profileDir> <outDir> <tenant-id> <login|read|set|delete> [value]');
  process.exit(4);
}
try {
  process.exitCode = await legacyFlagUi({ profile, out, tenant, action, value, org: ORG, code: CODE, portalUrl: PORTAL });
} catch (e) {
  if (e instanceof GuardError) { console.error(e.message); process.exit(5); }
  throw e;
}
