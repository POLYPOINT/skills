// cloud-e2e browser harness for the POLYPOINT cloud apps (myPP web, POMA planner web app, customer portal).
//   node app.mjs <tenant> <login> <script.mjs|-> <outdir> [--app mypp|poma|customer-portal] [--stage ct|preview] [--headed]
//                [--mobile] [--downloads] [--console info] [--token-entry <url>] [--cred-file <file>]
// Logs in through PolyID (persistent profile <MYPP_PROFILES>/<tenant>-<login>[-poma|-portal][-mobile]), records the app's API
// responses (redacted) under <outdir>/api/NNN-<METHOD>-<path>.json + api-index.jsonl, then runs the script's default export:
//   async ({page, ctx, out, shot, log, api, env, envId, login, MYPP, APP, app, stage, urls, POMA, PORTAL}) => {}
// "-" only logs in and takes a screenshot. Logged in = mypp: /tabs/ or health-professional-app; poma: /shift-planner/,
// /pool-manager/, /tenant-admin/, /invalid-user, /badi, /partner-simulator (or myPP for an HP-only user; result.landing tells)
// after a poma-api call with a bearer; customer-portal: /portal/ after a portal-api call with a bearer.
// Credentials: the DeployMate manifest $DM_CONFIG_DIR/<tenant>.test-data.json (manifest.loginPassword), or --cred-file
// (0600 JSON {"tenant","users":[{"login","email","password"}]}) for shared tenants. The password is submitted at most twice
// per run (PolyID brute-force detection locks the caller IP per provider without expiry) and never written anywhere.
// --token-entry <url>: no PolyID form; open the URL (it carries a token, never logged) and wait for a flows/ or tabs/ route.
// --downloads: api.download(action, name) saves files under <outdir>/downloads/. --console info: also log console info/log lines.
// Host guard: CT hosts only (ct-*.dev.k8s.polypoint-dev.com); Preview only with --stage preview; polypointservices.ch,
// "prod", "staging", /test/** and GAT clean are refused / blocked in the browser. Env overrides: MYPP_URL (POMA webapp root),
// POMA_API_URL, PORTAL_URL, PORTAL_API_URL, MYPP_PROFILES, MYPP_EMAIL, MYPP_USER_FORMAT=email, MYPP_TRACE, POMA_ENTRY, PORTAL_ENTRY.
// Exit: 0 (result.json tells loggedIn), 1 script error, 2 usage, 5 guard refusal.
import { runHarness, APPS } from './lib/session.mjs';
import { parseArgs } from './lib/util.mjs';
import { TENANT_RE, SHARED_TENANT_RE, GuardError } from './lib/guard.mjs';

const USAGE = 'usage: node app.mjs <tenant> <login> <script.mjs|-> <outdir> [--app mypp|poma|customer-portal] [--stage ct|preview] [--headed] [--mobile] [--downloads] [--console info] [--token-entry <url>] [--cred-file <file>]';
const { pos, flags } = parseArgs(process.argv.slice(2), ['--app', '--stage', '--console', '--token-entry', '--cred-file']);
const [tenant, login, scriptPath, outdir] = pos;
const app = flags['--app'] || 'mypp';
if (!tenant || !login || !scriptPath || !outdir || pos.length > 4) { console.error(USAGE); process.exit(2); }
if (!APPS.includes(app)) { console.error(`--app must be one of ${APPS.join('|')}\n${USAGE}`); process.exit(2); }
if (flags['--console'] && flags['--console'] !== 'info') { console.error('--console takes the value info'); process.exit(2); }
const credFile = flags['--cred-file'] || null;
if (!(credFile ? SHARED_TENANT_RE : TENANT_RE).test(tenant)) {
  console.error(credFile ? 'tenant must match ^[a-z][a-z0-9-]{0,62}$' : 'first argument must be the DeployMate env id = CT tenant id (^[a-z][a-z0-9-]{0,14}$); shared tenants need --cred-file');
  process.exit(2);
}
try {
  await runHarness({
    app, tenant, login, scriptPath, outdir, credFile,
    stage: flags['--stage'] || 'ct', headed: !!flags['--headed'], mobile: !!flags['--mobile'], downloads: !!flags['--downloads'],
    consoleInfo: flags['--console'] === 'info', tokenEntry: flags['--token-entry'] || null,
  });
} catch (e) {
  if (e instanceof GuardError) { console.error(e.message); process.exit(5); }
  throw e;
}
