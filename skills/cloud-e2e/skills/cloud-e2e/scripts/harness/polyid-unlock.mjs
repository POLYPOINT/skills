// CT-only PolyID brute-force lockout helper (USER_OR_IP_LOCKED): read / remove the applied policies of one tenant's provider.
// UTR-compatible wrapper of polyid-admin.mjs (login → login, read → applied-policies, unlock → unlock; same files, log file
// polyid-unlock.log and exit codes as before).
//   node polyid-unlock.mjs <profileDir> <outDir> <tenant-id> <login|read|unlock> [--subject <ip|username|my-ip>] [--provider <id>]
// ORCHESTRATOR / ENV STEWARD ONLY, on behalf of the operator running the E2E, after the operator's headed login. Workers never
// run it. In multi-runner runs only the steward's brief names it (this legacy entry point skips polyid-admin's DeployMate
// owner check). The PolyID ops frontend is served by polyid-login itself under /ops/; its admin API is <polyid-login>/api/admin.
// The SPA keeps its OIDC user IN MEMORY and re-acquires a token from the PolyID SSO session cookies of the persistent profile on
// every load; the script captures the Bearer the SPA sends to /api/admin/ and calls the API directly with it (never printed,
// never written).
// login  : HEADED window on <ops>/security; the operator signs in with an account holding support-ops/admin rights.
//          Waits up to 5 min for an authenticated admin call (GET /applied-policies/summary 200).
// read   : HEADLESS. Provider id = GET /api/admin/providers/<tenant-id> → id (or --provider / POLYID_PROVIDER_ID), then the locked
//          rows, the summary and the thresholds; prints subject, policy, attempts, lock threshold, last attempt and unlockAt;
//          writes <outDir>/applied-policies.json.
// unlock : HEADLESS. --subject is mandatory: one exact subject (IP or username), no wildcards, no commas, never empty (a DELETE
//          without subject wipes EVERY applied policy of the provider). `--subject my-ip` = this machine's public IP from the
//          deploymate skill (`dm-api.sh my-ip`; script path via DM_API_SH). The subject must exist among the provider's applied
//          policies first (else exit 2, nothing deleted); then DELETE and re-read to prove it is gone.
// Stages: --stage ct (default) or preview; --stage staging runs on the PRODUCTION cluster: the script refuses every call and only
//          prints the manual instructions for the operator (exit 7). Hard guard: CT / Preview hosts only, https, never production.
// Env: POLYID_LOGIN_URL, POLYID_OPS_URL (default <login>/ops), POLYID_PROVIDER_ID, DM_API_SH, DM_CONFIG_DIR.
// Exit codes: 0 ok; 2 provider or subject not found (nothing deleted); 3 LOGIN_NEEDED; 4 subject still present after the
//   DELETE; 5 usage / guard refusal; 6 403 (account lacks admin rights) or unexpected HTTP status; 7 staging.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const USAGE = 'usage: node polyid-unlock.mjs <profileDir> <outDir> <tenant-id> <login|read|unlock> [--stage ct|preview|staging] [--subject <ip|username|my-ip>] [--provider <id>]';
const die = (code, msg) => { console.error(msg); process.exit(code); };
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v ?? ''; };
const subjectArg = opt('--subject');
const stage = (opt('--stage') || process.env.POLYID_STAGE || 'ct').toLowerCase();
if (!['ct', 'preview', 'staging'].includes(stage)) die(5, '--stage must be ct, preview or staging');
const providerArg = opt('--provider');
const [profile, out, tenant, action, ...rest] = argv;
if (!profile || !out || !tenant || !['login', 'read', 'unlock'].includes(action) || rest.length) die(5, USAGE);
if (!/^[a-z][a-z0-9-]{0,14}$/.test(tenant)) die(5, 'tenant-id must be the DeployMate env id (= CT tenant id), ^[a-z][a-z0-9-]{0,14}$');
if (providerArg !== undefined && !/^[0-9]{1,9}$/.test(providerArg)) die(5, '--provider must be a numeric PolyID provider id');
if (action === 'unlock' && subjectArg === undefined) die(5, 'unlock refuses to run without --subject <ip|username|my-ip>');
if (action !== 'unlock' && subjectArg !== undefined) die(5, '--subject only applies to unlock');
if (stage === 'staging') {
  const subj = subjectArg && subjectArg !== 'my-ip' ? subjectArg : '<this machine\'s public IP or the locked test user>';
  console.log('STAGING runs on the PRODUCTION cluster: this script makes no call there.');
  console.log('Ask the operator to unlock manually: https://staging-polyid-login.polypointservices.ch/ops/ → Security → applied');
  console.log(`policies of the provider of tenant "${tenant}" → remove ONLY the locked subject ${subj}.`);
  process.exit(7);
}
const mapped = { login: 'login', read: 'applied-policies', unlock: 'unlock' }[action];
const next = [profile, out, tenant, mapped, '--stage', stage];
if (providerArg !== undefined) next.push('--provider', providerArg);
if (action === 'unlock') next.push('--subject', subjectArg, '--i-am-steward');
process.env.POLYID_ADMIN_LOG = process.env.POLYID_ADMIN_LOG || 'polyid-unlock.log';
const admin = join(dirname(fileURLToPath(import.meta.url)), 'polyid-admin.mjs');
process.argv = [process.argv[0], admin, ...next];
await import(pathToFileURL(admin).href);
