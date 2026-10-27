// myPOLYPOINT (CT) browser harness — UTR-compatible wrapper of app.mjs --app mypp (same CLI, files and result keys).
//   node mypp.mjs <tenant-id> <login> <script.mjs|-> <outdir> [--headed] [--mobile]
// Opens a persistent Chromium profile per tenant+login, logs in through PolyID if needed, records every poma-api /api/ response
// (and request body, redacted) of the run under <outdir>/api/NNN-<METHOD>-<path>.json with an index (api-index.jsonl), then runs
// the script's default export:
//   async ({page, ctx, out, shot, log, api, env, envId, login, MYPP, APP}) => {}   (env === envId === tenant id)
// The script "-" only logs in and takes a screenshot.
// Login: PolyID step 1 = e-mail <login>@<tenant-id>.ch (ASCII-transliterated local part), step 2 = tenant IDM username <login>
// (the on-prem Keycloak user, dmseed-<kuerzel> on customer-roster seeds) + the seed password read at runtime from
// $DM_CONFIG_DIR/<tenant-id>.test-data.json `.manifest.loginPassword` — never written anywhere. The password is submitted at
// most twice per run (PolyID brute-force detection locks the caller IP per provider without expiry: never probe guessed logins).
// Playwright is resolved from $DM_CONFIG_DIR (default ~/.config/deploymate, where the deploymate skill installs it).
// Env: MYPP_URL, POMA_API_URL, MYPP_PROFILES (default ./profiles), MYPP_EMAIL / MYPP_USER_FORMAT=email, MYPP_TRACE.
// Host guard (cloud-e2e): MYPP_URL / POMA_API_URL must be CT hosts; production hosts and /test/** are blocked (exit 5).
// Other apps (POMA planner web app, customer portal), Preview, downloads, console info, token entry, --cred-file: app.mjs.
import { runHarness } from './lib/session.mjs';
import { GuardError } from './lib/guard.mjs';

const [ENV_ID, login, scriptPath, outdirArg, ...flags] = process.argv.slice(2);
if (!ENV_ID || !login || !scriptPath || !outdirArg) {
  console.error('usage: node mypp.mjs <tenant-id> <login> <script.mjs|-> <outdir> [--headed] [--mobile]');
  process.exit(2);
}
if (!/^[a-z][a-z0-9-]{0,14}$/.test(ENV_ID)) throw new Error('first argument must be the DeployMate env id = CT tenant id');
try {
  await runHarness({ app: 'mypp', tenant: ENV_ID, login, scriptPath, outdir: outdirArg, stage: 'ct', headed: flags.includes('--headed'), mobile: flags.includes('--mobile') });
} catch (e) {
  if (e instanceof GuardError) { console.error(e.message); process.exit(5); }
  throw e;
}
