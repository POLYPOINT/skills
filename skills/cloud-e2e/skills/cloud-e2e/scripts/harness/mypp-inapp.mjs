// myPOLYPOINT (CT) IN-APP harness — the mobile-app login path in a desktop Chromium (UTR-compatible CLI).
//   node mypp-inapp.mjs <tenant-id> <login> <script.mjs|-> <outdir> [--headed]
// Same contract as mypp.mjs (script default export gets {page, ctx, out, shot, log, api, env, envId, login, MYPP, APP};
// api.goto/get/call/wait identical), but always in MOBILE APP mode: Pixel 7 user agent + 390x844 viewport + touch + a
// `window.cordova = {}` shim injected before any page script, so Ionic reports platform 'hybrid' + 'android' and the app runs
// its in-app LoginAuthPolyidService (own on-board e-mail form #provider-email-input, login form #name-input/#password-input,
// #btn-accept consent, /team-roster-tutorial) against the DEPLOYED CT webapp — no local `ionic serve` needed.
// `mypp.mjs --mobile` only sets UA/viewport/touch (browser path, PolyID web pages); use THIS harness for scenarios that need the
// in-app path (MO-01 login + capabilities, MO-05 in-app add-block, swap in-app steps). Verified 2026-10-14 on the CT build.
// Recording: only responses of the poma API host (POMA_API_URL) are written (redacted) — PolyID /api/auth/* carries the
// password and tokens and is never recorded. The password is read at runtime from $DM_CONFIG_DIR/<tenant-id>.test-data.json
// and is submitted at most twice (PolyID brute-force detection locks the caller IP per provider without expiry).
// Mobile time pickers are ion-picker (legacy wheels): set the column selectedIndex on the element, then press OK.
// Profiles: $MYPP_PROFILES/<tenant-id>-<login>-inapp. Env: MYPP_URL, POMA_API_URL, MYPP_PROFILES (default ./profiles),
// MYPP_EMAIL / MYPP_USER_FORMAT=email. Host guard as app.mjs (CT only; exit 5 on refusal).
import { runHarness } from './lib/session.mjs';
import { GuardError } from './lib/guard.mjs';

const [ENV_ID, login, scriptPath, outdirArg, ...flags] = process.argv.slice(2);
if (!ENV_ID || !login || !scriptPath || !outdirArg) {
  console.error('usage: node mypp-inapp.mjs <tenant-id> <login> <script.mjs|-> <outdir> [--headed]');
  process.exit(2);
}
if (!/^[a-z][a-z0-9-]{0,14}$/.test(ENV_ID)) throw new Error('first argument must be the DeployMate env id = CT tenant id');
try {
  // flag --mobile is accepted and ignored (always mobile-app mode)
  await runHarness({ app: 'mypp-inapp', tenant: ENV_ID, login, scriptPath, outdir: outdirArg, stage: 'ct', headed: flags.includes('--headed') });
} catch (e) {
  if (e instanceof GuardError) { console.error(e.message); process.exit(5); }
  throw e;
}
