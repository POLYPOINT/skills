// Offline acceptance checks of the cloud-e2e harness and common seed (work package I2). NO network, NO environment access:
// pure-function unit tests on fixtures, CLI usage / guard refusals that exit before any browser or HTTP call, wrapper
// compatibility against the UTR originals (git HEAD), static checks of the kit SQL and a credential scan.
//   node scripts/harness/tests/run-tests.mjs            (exit 1 when a check fails)
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { checkUrl, guardUrl, stageUrls, blockedRequestReason, forbiddenPathReason, GuardError, TENANT_RE, normStage } from '../lib/guard.mjs';
import { redactDeep, redactString, redactUrl, redactBodyString, redactHeaders, safeRecord, endpointRule, isSecretKey, sha256, REDACTED, REDACTED_JWT } from '../lib/redact.mjs';
import { totp, base32Decode, decodeJwt, roleNames, asciiLocal, reencodeForm, parseArgs } from '../lib/util.mjs';
import { issueName, byId, roles } from '../e2e-lib.mjs';
import { jobTier, actuatorPath, serviceSelector, ACTUATOR_REFUSED, MESSAGING_FLAGS } from '../lib/portal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = resolve(HERE, '..');
const SCRIPTS = resolve(HARNESS, '..');
const SKILL = resolve(SCRIPTS, '..');
const FIX = join(HERE, 'fixtures');
const fx = (n) => JSON.parse(readFileSync(join(FIX, n), 'utf8'));
let pass = 0; const failures = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { failures.push(`${name}: ${e.message.split('\n')[0]}`); } };
const sandbox = mkdtempSync(join(tmpdir(), 'cloud-e2e-i2-'));
// a fake DeployMate config dir so no helper can reach a real manifest / credentials file
const FAKE_DM = join(sandbox, 'dm'); mkdirSync(FAKE_DM);
const run = (cmd, args, env = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000, cwd: sandbox, env: { ...process.env, DM_CONFIG_DIR: process.env.REAL_DM_FOR_LEGACY ? process.env.DM_CONFIG_DIR : FAKE_DM, MYPP_URL: '', POMA_API_URL: '', PORTAL_URL: '', PORTAL_API_URL: '', POLYID_LOGIN_URL: '', ...env } });

// ---- 1. host guard ---------------------------------------------------------------------------------------------------
t('guard: CT webapp allowed', () => assert.equal(checkUrl('https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app', 'ct').ok, true));
t('guard: CT api allowed', () => assert.equal(checkUrl('https://ct-portal-api.dev.k8s.polypoint-dev.com/api/private/admin/features/tenants/x', 'ct').ok, true));
for (const [u, why] of [
  ['https://staging-polyid-login.polypointservices.ch/ops/', 'polypointservices'],
  ['https://prod-portal.polypointservices.ch/', 'polypointservices'],
  ['https://ct-poma-api.polypointservices.ch/', 'polypointservices'],
  ['https://review-appointment.polypointservices.ch/', 'polypointservices'],
  ['https://ct-prod-portal.dev.k8s.polypoint-dev.com/', 'prod'],
  ['https://ct-staging-x.dev.k8s.polypoint-dev.com/', 'staging'],
  ['http://ct-poma-webapp.dev.k8s.polypoint-dev.com/', 'https only'],
  ['https://ct-portal-api.dev.k8s.polypoint-dev.com:8443/', 'port'],
  ['https://user:pw@ct-portal-api.dev.k8s.polypoint-dev.com/', 'credentials'],
  ['https://preview-portal.demo.k8s.polypoint-dev.com/', 'stage ct allows only'],
  ['https://review-portal.demo.k8s.polypoint-dev.com/', 'stage ct allows only'],
  ['https://example.com/', 'stage ct allows only'],
  ['https://ct-portal-api.dev.k8s.polypoint-dev.com/test/clear', '/test/'],
  ['https://ct-polyid-login.dev.k8s.polypoint-dev.com/test/clear', '/test/'],
  ['https://ct-poma-api.dev.k8s.polypoint-dev.com/api/private/gat/clean', 'GAT'],
  ['https://ct-poma-api.dev.k8s.polypoint-dev.com/api/private/gat/shift-trades', 'GAT'],
]) t(`guard: refuses ${u}`, () => { const r = checkUrl(u, 'ct'); assert.equal(r.ok, false); assert.match(r.reason, new RegExp(why.replace(/[/]/g, '\\/'))); });
t('guard: preview host allowed only with stage preview', () => { assert.equal(checkUrl('https://preview-portal.demo.k8s.polypoint-dev.com/portal', 'preview').ok, true); assert.equal(checkUrl('https://preview-placement.k8s.polypoint-dev.com/', 'preview').ok, true); });
t('guard: preview refuses polypointservices', () => assert.equal(checkUrl('https://preview-placement.polypointservices.ch/', 'preview').ok, false));
t('guard: preview refuses CT host', () => assert.equal(checkUrl('https://ct-poma-webapp.dev.k8s.polypoint-dev.com/', 'preview').ok, false));
t('guard: stages staging / prod refused', () => { assert.throws(() => normStage('staging'), GuardError); assert.throws(() => normStage('prod'), GuardError); assert.equal(checkUrl('https://ct-x.dev.k8s.polypoint-dev.com/', 'staging').ok, false); });
t('guard: gateway-mock /test allow-list', () => {
  assert.equal(checkUrl('https://ct-poma-gateway-mock.dev.k8s.polypoint-dev.com/test/received-bookings', 'ct', { gwmock: true }).ok, true);
  assert.equal(checkUrl('https://ct-poma-gateway-mock.dev.k8s.polypoint-dev.com/test/booking-response-strategy', 'ct', { gwmock: true }).ok, true);
  assert.equal(checkUrl('https://ct-poma-gateway-mock.dev.k8s.polypoint-dev.com/test/resubmission-requests', 'ct', { gwmock: true }).ok, false);
  assert.equal(checkUrl('https://ct-poma-gateway-mock.dev.k8s.polypoint-dev.com/test/received-bookings', 'ct').ok, false);
});
t('guard: guardUrl throws GuardError with code 5', () => { try { guardUrl('x', 'https://a.polypointservices.ch/', 'ct'); assert.fail('no throw'); } catch (e) { assert.ok(e instanceof GuardError); assert.equal(e.code, 5); } });
t('guard: env override to production refused', () => assert.throws(() => stageUrls('ct', { MYPP_URL: 'https://ct-poma-webapp.polypointservices.ch' }), GuardError));
t('guard: preview pomaApi must be given by env', () => assert.throws(() => stageUrls('preview', {}, ['pomaApi']), /POMA_API_URL/));
t('guard: CT defaults resolve', () => { const u = stageUrls('ct', {}, ['pomaWeb', 'pomaApi', 'portalWeb', 'portalApi', 'polyidLogin', 'keycloak', 'gwmock']); assert.equal(u.pomaApi, 'https://ct-poma-api.dev.k8s.polypoint-dev.com'); });
t('guard: browser block list', () => {
  assert.ok(blockedRequestReason('https://staging-polyid-login.polypointservices.ch/ui/x'));
  assert.ok(blockedRequestReason('https://ct-portal-api.dev.k8s.polypoint-dev.com/test/clear'));
  assert.ok(blockedRequestReason('https://ct-data-events.dev.k8s.polypoint-dev.com/test/clear'));
  assert.equal(blockedRequestReason('https://ct-poma-gateway-mock.dev.k8s.polypoint-dev.com/test/received-bookings'), null);
  assert.equal(blockedRequestReason('https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app/tabs/home'), null);
  assert.equal(blockedRequestReason('https://fonts.googleapis.com/css2?family=x'), null);
  assert.equal(blockedRequestReason('https://ct-portal-api.dev.k8s.polypoint-dev.com/api/private/admin/integration-partners/e2e-x/tests'), null);
});
t('guard: test path detection', () => { assert.ok(forbiddenPathReason('/api/test')); assert.equal(forbiddenPathReason('/api/testing'), null); assert.equal(forbiddenPathReason('/partner-api-testing'), null); });
t('guard: tenant id rule', () => { assert.ok(TENANT_RE.test('ext1234')); assert.ok(!TENANT_RE.test('beekeeper-integration-tenant-test')); assert.ok(!TENANT_RE.test('Ext')); });

// ---- 2. redaction ----------------------------------------------------------------------------------------------------
t('redact: token response', () => {
  const r = redactDeep(fx('token-response.json'));
  assert.equal(r.access_token, REDACTED); assert.equal(r.refresh_token, REDACTED); assert.equal(r.id_token, REDACTED);
  assert.equal(r.token_type, 'Bearer'); assert.equal(r.expires_in, 300); assert.equal(r.scope, 'openid profile');
  assert.ok(!JSON.stringify(r).includes('eyJ'));
});
t('redact: partner credentials (deep + endpoint rule)', () => {
  assert.equal(redactDeep(fx('partner-credentials.json')).client_secret, REDACTED);
  const rec = safeRecord({ url: 'https://ct-portal-api.dev.k8s.polypoint-dev.com/api/private/admin/integration-partners/e2e-x/consumer-service-account-credentials', method: 'GET', status: 200, file: 'f', requestBody: null }, fx('partner-credentials.json'));
  assert.ok(!JSON.stringify(rec).includes('FAKE-not-a-real-secret')); assert.match(rec.body.redacted, /not recorded/);
});
t('redact: provider clientSecret, nested user secrets, keeps flags', () => {
  const r = redactDeep(fx('provider.json'));
  assert.equal(r.clientSecret, REDACTED); assert.equal(r.capabilities.twoFactorType, 'DISABLED'); assert.equal(r.capabilities.showResetPasswordButton, false);
  assert.equal(r.users[0].newPassword, REDACTED); assert.equal(r.users[0].otp_secret, REDACTED);
  assert.equal(r.users[0].hasPassword, true); assert.equal(r.users[0].tokenType, 'x'); assert.equal(r.users[0].passwordStrengthLevel, 'STRONG'); assert.equal(r.users[0].username, 'dmseed-abc');
});
t('redact: licence raw_xml hashed', () => { const f = fx('license.json'); const r = redactDeep(f); assert.equal(r.raw_xml, `sha256:${sha256(f.raw_xml)}`); assert.equal(r.valid_until, '2027-12-31'); });
t('redact: portal features unchanged (code is the flag code)', () => assert.deepEqual(redactDeep(fx('features.json')), fx('features.json')));
t('redact: UTR /days payload unchanged (no false positives)', () => assert.deepEqual(redactDeep(fx('days.json')), fx('days.json')));
t('redact: partner event payload keeps data, drops bearer', () => { const r = redactDeep(fx('partner-events.json')); assert.equal(r.logs.items[0].payload.answer, 'YES'); assert.equal(r.logs.items[0].payload.authorization, REDACTED); });
t('redact: strings with JWT / Bearer / form secrets', () => {
  const jwt = fx('token-response.json').access_token;
  assert.equal(redactString(`x ${jwt} y`), `x ${REDACTED_JWT} y`);
  assert.match(redactString(`Authorization: Bearer ${jwt}`), /Bearer \[redacted/);
  assert.equal(redactBodyString('username=dmseed-abc&password=Secret123'), `username=dmseed-abc&password=${REDACTED}`);
  assert.equal(JSON.parse(redactBodyString('{"password":"x1","login":"a"}')).password, REDACTED);
});
t('redact: URLs (auth code vs flag code)', () => {
  assert.match(redactUrl('https://ct-poma-webapp.dev.k8s.polypoint-dev.com/auth/callback?code=abc123&state=xyz'), /code=%5Bredacted%5D|code=\[redacted\]/);
  assert.match(redactUrl('https://ct-portal-api.dev.k8s.polypoint-dev.com/api/private/admin/features/tenants/x?code=poma.flows.timesheet&value=true'), /code=poma\.flows\.timesheet/);
  assert.match(redactUrl('https://ct-x.dev.k8s.polypoint-dev.com/entry?access_token=abc&x=1'), /access_token=(%5B|\[)redacted/);
});
t('redact: headers', () => { const h = redactHeaders({ authorization: 'Bearer abc.def.ghi', cookie: 'a=b', accept: 'application/json' }); assert.equal(h.authorization, REDACTED); assert.equal(h.cookie, REDACTED); assert.equal(h.accept, 'application/json'); });
t('redact: endpoint rules', () => {
  assert.ok(endpointRule('https://h/api/private/admin/services/10.0.0.1/actuator/env?k8s-service-name=x')?.skipBody);
  assert.ok(endpointRule('https://h/api/private/admin/services/actuator?k8s-service-name=x&actuatorOptionalSegment=heapdump')?.skipBody);
  const auth = endpointRule('https://ct-polyid-login.dev.k8s.polypoint-dev.com/api/auth/partner-sessions'); assert.ok(auth.skipBody && auth.skipRequest);
  assert.ok(endpointRule('https://ct-polyid-login.dev.k8s.polypoint-dev.com/ui/login-form/submit').skipRequest);
  assert.ok(endpointRule('https://h/api/private/admin/logfiles/ext1')?.summarize);
  assert.equal(endpointRule('https://ct-poma-api.dev.k8s.polypoint-dev.com/api/mobile/unified-time-recording/v1/days?from=x'), null);
  const login = safeRecord({ url: 'https://ct-polyid-login.dev.k8s.polypoint-dev.com/ui/login-form/submit', method: 'POST', status: 302, file: 'f', requestBody: 'email_or_username=a&password=b' }, '');
  assert.equal(login.meta.requestBody, REDACTED);
});
t('redact: secret key names', () => { for (const k of ['access_token', 'clientSecret', 'keycloak_client_secret', 'NewPassword', 'otp_secret', 'Authorization', 'set-cookie', 'pushToken']) assert.ok(isSecretKey(k), k); for (const k of ['code', 'token_type', 'tokenType', 'expires_in', 'showResetPasswordButton', 'hasPassword', 'secretName', 'password_strength_level', 'shift_planning_id']) assert.ok(!isSecretKey(k), k); });

// ---- 3. util ---------------------------------------------------------------------------------------------------------
t('totp: RFC 6238 SHA1 vectors', () => {
  const key = Buffer.from('12345678901234567890');
  for (const [s, code] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']]) assert.equal(totp(key, { time: s * 1000, digits: 8 }), code);
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', { time: 59000, digits: 8 }), '94287082');
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', { time: 59000 }), '287082');
  assert.deepEqual(base32Decode('GEZDGNBVGY3TQOJQ'), Buffer.from('1234567890'));
});
t('jwt: decode + role names (in memory)', () => {
  const d = decodeJwt('Bearer ' + fx('token-response.json').access_token); assert.equal(d.payload.sub, 'test-user');
  const r = roleNames(d.payload); assert.deepEqual(r.roles, ['ROLE_HEALTH_PROFESSIONAL', 'ROLE_SHIFT_PLANNER', 'offline_access']); assert.ok(r.byClient['polypoint-poolmanagement']);
  assert.equal(decodeJwt('not-a-jwt'), null);
});
t('util: ascii local part, form re-encoding, args', () => {
  assert.equal(asciiLocal('dmseed-awüt'), 'dmseed-awuet'); assert.equal(asciiLocal('Müller-Öz'), 'Mueller-Oez');
  assert.equal(reencodeForm('username=dmseed-aw%FCt&x=1'), 'username=dmseed-aw%C3%BCt&x=1');
  assert.deepEqual(parseArgs(['a', '--app', 'poma', '--headed', 'b', '--stage=ct'], ['--app']), { pos: ['a', 'b'], flags: { '--app': 'poma', '--headed': true, '--stage': 'ct' } });
});

// ---- 4. e2e-lib + portal pure helpers ---------------------------------------------------------------------------------
t('e2e-lib: issueName', () => { assert.equal(issueName('ISSUE-SWP-06-candidates'), 'SWP-06-candidates'); assert.equal(issueName('x.png'), 'x'); assert.throws(() => issueName('SWP-undefined')); assert.throws(() => issueName('')); });
t('e2e-lib: byId', () => { const j = { content: [{ id: 1, a: 'x' }, { opportunity_id: 'op-9' }, { employmentId: 77 }] }; assert.equal(byId(j, 'content', 1).a, 'x'); assert.ok(byId(j, 'content', 'op-9')); assert.ok(byId(j, 'content', 77)); assert.equal(byId(j, 'content', 5), null); assert.equal(byId(j, 'nope', 1), null); });
t('e2e-lib: roles(api) names only', () => { const r = roles({ token: () => 'Bearer ' + fx('token-response.json').access_token }); assert.equal(r.ok, true); assert.ok(r.roles.includes('ROLE_SHIFT_PLANNER')); assert.ok(!JSON.stringify(r).includes('eyJ')); assert.equal(roles({ token: () => null }).ok, false); });
t('portal: job allow-list tiers', () => {
  assert.equal(jobTier('poma-core', 'AvailabilityConflictChecker'), 'T'); assert.equal(jobTier('poma-core', 'AvailabilityConflictCheckerCronJob'), 'T');
  assert.equal(jobTier('poma-core', 'ResyncEmployeesWithNoEmploymentsJob'), 'T'); assert.equal(jobTier('portal-core', 'LoadTenantVersions'), 'A');
  for (const j of ['DeleteUsersCronJob', 'SyncGlnMappingsWithHubspotCronJob', 'VaultKeyRotatorJob', 'ExpireOpportunityCronJob']) assert.equal(jobTier('poma-core', j), null, j);
  assert.equal(jobTier('poma-core', 'LoadTenantVersions'), null); assert.equal(jobTier('poma-conflict-checker', 'SyncUsersAndShiftsCronJob'), null);
});
t('portal: actuator proxy path', () => {
  assert.equal(serviceSelector('poma-core'), 'app.kubernetes.io/name=poma-core'); assert.equal(serviceSelector('portal-tenant-access'), 'service=portal-tenant-access');
  assert.equal(actuatorPath('poma-core', 'polypointjobs', { segment: 'X?tenantIds=ext1' }), '/services/actuator/polypointjobs?k8s-service-name=poma-core&k8s-selector=app.kubernetes.io%2Fname%3Dpoma-core&actuatorOptionalSegment=X%3FtenantIds%3Dext1');
  assert.ok(ACTUATOR_REFUSED.test('env') && ACTUATOR_REFUSED.test('heapdump') && !ACTUATOR_REFUSED.test('metrics'));
  assert.ok(MESSAGING_FLAGS.includes('poma.msTeams.notifications'));
});

// ---- 5. CLI refusals (exit before any browser / HTTP) + wrapper compatibility -------------------------------------------
const node = (file, args, env) => run(process.execPath, [join(HARNESS, file), ...args], env);
const expectExit = (name, r, code, re) => t(name, () => { assert.equal(r.status, code, `exit ${r.status} (want ${code}); ${(r.stderr || r.stdout).slice(0, 200)}`); if (re) assert.match(r.stdout + r.stderr, re); });
expectExit('app.mjs: usage', node('app.mjs', []), 2, /usage: node app\.mjs/);
expectExit('app.mjs: bad --app', node('app.mjs', ['ext1', 'l', '-', 'o', '--app', 'bad']), 2, /--app must be/);
expectExit('app.mjs: long tenant without --cred-file', node('app.mjs', ['beekeeper-integration-tenant-test', 'l', '-', 'o']), 2, /--cred-file/);
expectExit('app.mjs: stage staging refused', node('app.mjs', ['ext1', 'l', '-', 'o', '--stage', 'staging']), 5, /GUARD/);
expectExit('app.mjs: MYPP_URL production refused', node('app.mjs', ['ext1', 'l', '-', 'o'], { MYPP_URL: 'https://ct-poma-webapp.polypointservices.ch' }), 5, /polypointservices/);
expectExit('mypp.mjs: POMA_API_URL production refused', node('mypp.mjs', ['ext1', 'l', '-', 'o'], { POMA_API_URL: 'https://prod-api.polypointservices.ch' }), 5, /GUARD/);
expectExit('portal-ops.mjs: usage', node('portal-ops.mjs', []), 4, /usage/);
expectExit('portal-ops.mjs: outDir looks like a sub-command', node('portal-ops.mjs', ['/p', 'flag', 'set', 'ext1', 'x', 'true', 'out']), 4, /outDir/);
expectExit('portal-ops.mjs: stage staging refused', node('portal-ops.mjs', [join(sandbox, 'p'), 'health', join(sandbox, 'o'), 'ext1', '--stage', 'staging']), 5, /GUARD/);
expectExit('portal-ops.mjs: quoted form parses inner flags (inner --stage staging refused)', node('portal-ops.mjs', [join(sandbox, 'p'), 'job run poma-core AvailabilityConflictChecker --tenant ext1 --stage staging', join(sandbox, 'o')]), 5, /GUARD/);
expectExit('portal-ops.mjs: quoted form with an unbalanced quote', node('portal-ops.mjs', ['/p', 'flag set ext1 x "a b', join(sandbox, 'o')]), 4, /unbalanced/);
expectExit('portal-ops.mjs: commands only on base ops', node('portal-ops.mjs', ['/p', 'health', join(sandbox, 'o'), 'ext1', '--base', 'customer']), 4, /base ops/);
expectExit('polyid-admin.mjs: staging = instructions only', node('polyid-admin.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'applied-policies', '--stage', 'staging']), 7, /PRODUCTION cluster/);
expectExit('polyid-admin.mjs: bad 2FA type', node('polyid-admin.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'user-2fa', 'dmseed-abc', 'SMS']), 5, /user-2fa/);
expectExit('polyid-admin.mjs: provider-2fa needs --window', node('polyid-admin.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'provider-2fa', 'TOTP']), 5, /--window/);
expectExit('polyid-admin.mjs: user-state needs --reason', node('polyid-admin.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'user-state', 'dmseed-abc', 'BLOCKED']), 5, /--reason/);
expectExit('polyid-admin.mjs: POLYID_LOGIN_URL production refused', node('polyid-admin.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'applied-policies'], { POLYID_LOGIN_URL: 'https://staging-polyid-login.polypointservices.ch' }), 5, /GUARD/);
expectExit('polyid-flow.mjs: usage', node('polyid-flow.mjs', []), 2, /usage/);
expectExit('polyid-flow.mjs: >2 submissions need --allow-wrong same login', node('polyid-flow.mjs', ['ext1', 'dmseed-a', 's.mjs', 'o', '--max-password-submits', '15']), 5, /allow-wrong/);
expectExit('polyid-flow.mjs: stage staging refused', node('polyid-flow.mjs', ['ext1', 'dmseed-a', 's.mjs', 'o', '--stage', 'staging']), 5, /GUARD/);
expectExit('partner-api.mjs: usage', node('partner-api.mjs', []), 2, /usage/);
expectExit('partner-api.mjs: stage staging refused', node('partner-api.mjs', ['e2e-ptn-x', join(sandbox, 'o'), 'token', 'client', '--stage', 'staging']), 5, /GUARD/);
expectExit('pwa-embed.mjs: usage', node('pwa-embed.mjs', []), 2, /usage/);
expectExit('pwa-embed.mjs: stage staging refused', node('pwa-embed.mjs', [join(sandbox, 'o'), '-', '--stage', 'staging']), 5, /GUARD/);
expectExit('gwmock.mjs: unknown strategy', node('gwmock.mjs', [join(sandbox, 'o'), 'strategy', 'set', 'booking', 'FOO']), 2, /strategy set/);
expectExit('gwmock.mjs: set needs the lock', node('gwmock.mjs', [join(sandbox, 'o'), 'strategy', 'set', 'booking', 'SUCCESS']), 5, /--lock/);
expectExit('gwmock.mjs: set needs the window', node('gwmock.mjs', [join(sandbox, 'o'), 'strategy', 'set', 'cancel', 'SUCCESS', '--lock', 'v3']), 5, /S-CT-GWMOCK/);

// wrapper compatibility: same stdout / stderr / exit as the UTR originals (git HEAD) for every argument error
const legacyDir = join(sandbox, 'legacy'); mkdirSync(legacyDir);
let legacyOk = true;
try {
  for (const f of ['mypp.mjs', 'mypp-inapp.mjs', 'portal-flag.mjs', 'polyid-unlock.mjs']) {
    writeFileSync(join(legacyDir, f), execFileSync('git', ['-C', SKILL, 'show', `7e1711a19c5c4b197ad816cd4114b546d10caef7:skills/utr-e2e/skills/utr-e2e/scripts/harness/${f}`], { encoding: 'utf8' }));
  }
} catch (e) { legacyOk = false; failures.push(`wrapper compat: cannot read the UTR originals from git (utr-e2e v0.5.0, 7e1711a) (${e.message.split('\n')[0]})`); }
const realDm = process.env.DM_CONFIG_DIR || join(process.env.HOME, '.config/deploymate');
const hasPw = existsSync(join(realDm, 'node_modules', 'playwright'));
if (legacyOk) {
  const cases = [
    ['mypp.mjs', []], ['mypp.mjs', ['ext1', 'l']], ['mypp-inapp.mjs', []],
    ['portal-flag.mjs', []], ['portal-flag.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'read']], ['portal-flag.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'set'], { PORTAL_ORG: 'org' }],
    ['polyid-unlock.mjs', []], ['polyid-unlock.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'unlock']], ['polyid-unlock.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'read', '--subject', '1.2.3.4']],
    ['polyid-unlock.mjs', ['/p', join(sandbox, 'o'), 'Bad!', 'read']], ['polyid-unlock.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'read', '--provider', 'abc']],
    ['polyid-unlock.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'read', '--stage', 'prod']], ['polyid-unlock.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'read', '--stage', 'staging']],
    ['polyid-unlock.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'unlock', '--subject', '1.2.3.4', '--stage', 'staging']], ['polyid-unlock.mjs', ['/p', join(sandbox, 'o'), 'ext1', 'login', 'extra']],
  ];
  for (const [f, args, env] of cases) {
    // the originals load Playwright at import (mypp, portal-flag): they need the real $DM_CONFIG_DIR, only for argument errors
    const needsPw = ['mypp.mjs', 'mypp-inapp.mjs', 'portal-flag.mjs'].includes(f);
    if (needsPw && !hasPw) { failures.push(`wrapper compat ${f}: Playwright not installed under ${realDm} (cannot run the original)`); continue; }
    const envAll = { ...(env || {}), DM_CONFIG_DIR: needsPw ? realDm : FAKE_DM };
    const a = spawnSync(process.execPath, [join(legacyDir, f), ...args], { encoding: 'utf8', timeout: 30000, cwd: sandbox, env: { ...process.env, ...envAll } });
    const b = spawnSync(process.execPath, [join(HARNESS, f), ...args], { encoding: 'utf8', timeout: 30000, cwd: sandbox, env: { ...process.env, ...envAll } });
    t(`wrapper compat ${f} ${args.join(' ') || '(no args)'}`, () => { assert.equal(b.status, a.status, `exit new ${b.status} vs old ${a.status}`); assert.equal(b.stdout, a.stdout); assert.equal(b.stderr, a.stderr); });
  }
  // invalid tenant: the originals throw (uncaught Error); same exit code and message, stack paths differ
  for (const f of ['mypp.mjs', 'mypp-inapp.mjs']) {
    if (!hasPw) break;
    const a = spawnSync(process.execPath, [join(legacyDir, f), 'Bad_Tenant', 'l', '-', 'o'], { encoding: 'utf8', timeout: 30000, cwd: sandbox, env: { ...process.env, DM_CONFIG_DIR: realDm } });
    const b = spawnSync(process.execPath, [join(HARNESS, f), 'Bad_Tenant', 'l', '-', 'o'], { encoding: 'utf8', timeout: 30000, cwd: sandbox, env: { ...process.env, DM_CONFIG_DIR: realDm } });
    t(`wrapper compat ${f} invalid tenant`, () => { assert.equal(b.status, a.status); const m = /Error: first argument must be the DeployMate env id = CT tenant id/; assert.match(a.stderr, m); assert.match(b.stderr, m); });
  }
  // CLI signatures documented identically: the first usage line of the header comment
  for (const f of ['mypp.mjs', 'mypp-inapp.mjs', 'portal-flag.mjs', 'polyid-unlock.mjs']) {
    const sig = (s) => (s.split('\n').find((l) => /^\/\/\s+node \S+\.mjs /.test(l)) || '').replace(/\s+/g, ' ').trim();
    t(`wrapper signature ${f}`, () => assert.equal(sig(readFileSync(join(HARNESS, f), 'utf8')), sig(readFileSync(join(legacyDir, f), 'utf8'))));
  }
}

// ---- 6. bash helpers: syntax + guards (no network: every case stops before curl / ssh) -----------------------------------
for (const f of ['api-pp.sh', 'pp-plan.sh', 'plan-day.sh', 'pep/pe-ready.sh', 'pep/pe-paint.sh']) t(`bash -n ${f}`, () => assert.equal(spawnSync('bash', ['-n', join(SCRIPTS, f)]).status, 0));
const sh = (f, args, env) => run('bash', [join(SCRIPTS, f), ...args], env);
expectExit('api-pp.sh: usage', sh('api-pp.sh', []), 2, /usage/);
expectExit('api-pp.sh: production base refused', sh('api-pp.sh', ['ext1', 'token-check'], { DM_HOST: 'ext1-host.deploymate.polypoint.dev', APIPP_BASE: 'http://api.polypointservices.ch/pp-api-personnel-planning' }), 5, /GUARD/);
expectExit('api-pp.sh: raw IP refused', sh('api-pp.sh', ['ext1', 'token-check'], { DM_HOST: '10.1.2.3' }), 5, /GUARD/);
expectExit('api-pp.sh: /test/ path refused', sh('api-pp.sh', ['ext1', 'raw', 'GET', '/api/test/clear'], { DM_HOST: 'ext1-host.deploymate.polypoint.dev' }), 5, /test/);
expectExit('api-pp.sh: non-/api path refused', sh('api-pp.sh', ['ext1', 'raw', 'GET', '/actuator/env'], { DM_HOST: 'ext1-host.deploymate.polypoint.dev' }), 5, /GUARD/);
{ const sf = join(sandbox, 'secret'); writeFileSync(sf, 'not-a-secret\n'); chmodSync(sf, 0o644);
  expectExit('api-pp.sh: secret file must be 0600', sh('api-pp.sh', ['ext1', 'token-check'], { DM_HOST: 'ext1-host.deploymate.polypoint.dev', APIPP_SECRET_FILE: sf }), 4, /chmod 600/); }
expectExit('api-pp.sh: timesheet path required', sh('api-pp.sh', ['ext1', 'timesheet', '480', '2026-11'], { DM_HOST: 'ext1-host.deploymate.polypoint.dev' }), 2, /APIPP_TIMESHEET_PATH/);
expectExit('pp-plan.sh: bad position', sh('pp-plan.sh', ['ext1', '480', '2026-11-02', '111', 'HALF']), 2, /position/);
expectExit('pp-plan.sh: bad date', sh('pp-plan.sh', ['ext1', '480', '2.11.2026', '111', 'FULL']), 2, /date/);
expectExit('plan-day.sh: sql.sh failure is an error, not "(no rows)"', sh('plan-day.sh', ['ext1', '480', '2026-11-02']), 3, /sql\.sh failed/);
expectExit('pp-plan.sh: no box host → stops before any call', sh('pp-plan.sh', ['ext1', '480', '2026-11-02', '111', 'FULL'], { DM_HOST: '' }), 2, /no box host/);
expectExit('plan-day.sh: bad emp', sh('plan-day.sh', ['ext1', 'abc', '2026-11-02']), 2, /numeric/);

// ---- 7. kit SQL: placeholders, guards, X/Y parameterisation (static inspection) -------------------------------------------
const SEED = join(SCRIPTS, 'seed', 'common');
const PARAMS = { 'definitions-kit.sql': ['env_role', 'nodes', 'abs_codes', 'swap_abs'], 'role-kit.sql': ['env_role', 'ga_node'], 'kit-member.sql': ['ma_ids', 'kit', 'leave'], 'verify-kits.sql': ['env_role'], 'stamm-fix.sql': [] };
for (const [f, params] of Object.entries(PARAMS)) {
  const s = readFileSync(join(SEED, f), 'utf8');
  const code = s.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  t(`kit ${f}: placeholders = documented parameters`, () => assert.deepEqual([...new Set((s.match(/&&?[A-Za-z_][A-Za-z0-9_]*/g) || []).map((x) => x.replace(/&/g, '')))].sort(), [...params].sort()));
  t(`kit ${f}: every documented parameter appears in the header usage`, () => params.forEach((p) => assert.match(s.split('\n').slice(0, 12).join('\n'), new RegExp(`-D ${p}=`))));
  if (f !== 'verify-kits.sql') t(`kit ${f}: sqlplus-only guard + stop on error`, () => { assert.match(code, /JDBC Thin Client/); assert.match(code, /WHENEVER SQLERROR EXIT FAILURE ROLLBACK/); });
  // idempotency by inspection: each INSERT is guarded (NOT EXISTS / prior COUNT or NULL check); each UPDATE only touches rows whose value differs
  const stmts = code.split(/;\s*\n/);
  stmts.forEach((st, i) => {
    if (/\bINSERT INTO\b/i.test(st)) t(`kit ${f}: INSERT #${i} guarded`, () => assert.match(st + (stmts[i - 1] || '') + (stmts[i - 2] || '') + (stmts[i - 3] || ''), /NOT EXISTS|IF (n|c|d) = 0|IS NULL THEN/));
    if (/\bUPDATE ECBERN\./i.test(st)) t(`kit ${f}: UPDATE #${i} touches changed rows only`, () => assert.match(st + (stmts[i - 1] || ''), /<>|IF d = 0 THEN|AND TRIM\(DEFAULTGRP\) = 'T'/));
  });
  t(`kit ${f}: no credentials`, () => assert.doesNotMatch(s, /(password|passwd|pwd)\s*[:=]\s*['"][^'"&]+['"]|identified by|@\/\/|[a-z]+\/[A-Za-z0-9!#$%]+@[0-9.]+:/i));
  t(`kit ${f}: no DDL / GRANT statements, DELETE only on own memberships`, () => { assert.doesNotMatch(code, /^\s*(DROP|TRUNCATE|ALTER|GRANT|REVOKE|CREATE)\s/im); assert.doesNotMatch(code, /DELETE FROM ECBERN\.(?!POLYUSER_POLYUSRGRP)/i); });
}
t('kit definitions-kit.sql: X and Y branches', () => { const s = readFileSync(join(SEED, 'definitions-kit.sql'), 'utf8'); assert.match(s, /v_role = 'X'/); assert.match(s, /v_role = 'Y'/); assert.match(s, /POMASCHICHTTYP/); assert.match(s, /SHIFT_DEFINITION_PALETTE/); });
t('kit role-kit.sql: X and Y kits + G4b', () => { const s = readFileSync(join(SEED, 'role-kit.sql'), 'utf8'); for (const k of ['E2E:SP-ALL', 'E2E:PM-ALL', 'E2E:EXTPOOL', 'E2E:HP-NOSWAP', 'E2E:PLANALL', 'E2E:SP-GA', 'E2E:PM-GA', 'E2E:TA', 'E2E:HP-PLAIN', 'PERMISSION_ROLE', 'POLY_USER_ROLE_KEYCLOAK_ROLE_MAPPING', 'PERMISSION_GROUP']) assert.ok(s.includes(k), k); });
t('kit kit-member.sql: enqueue after COMMIT, seed logins only', () => { const s = readFileSync(join(SEED, 'kit-member.sql'), 'utf8'); assert.ok(s.indexOf('PERMISSION_GROUP_MAPPING\', REGEXP') > s.indexOf('  COMMIT;')); assert.match(s, /DMSEED-%/); });
t('moved files unchanged', () => {
  for (const [a, b] of [['pep/pe-ready.sh', 'scripts/pep/pe-ready.sh'], ['pep/pe-paint.sh', 'scripts/pep/pe-paint.sh'], ['seed/audit.sql', 'scripts/seed/common/audit.sql'], ['seed/rights.sql', 'scripts/seed/common/rights.sql'], ['seed/r0-root-rows.sql', 'scripts/seed/common/r0-root-rows.sql'], ['seed/psc-batch.sql', 'scripts/seed/common/psc-batch.sql']]) {
    const orig = execFileSync('git', ['-C', SKILL, 'show', `7e1711a19c5c4b197ad816cd4114b546d10caef7:skills/utr-e2e/skills/utr-e2e/scripts/${a}`  /* utr-e2e v0.5.0, before the move */], { encoding: 'utf8' });
    assert.equal(readFileSync(join(SKILL, b), 'utf8'), orig, b);
  }
});

t('api-pp.sh guard_host: strict authority parsing', () => {
  const run = (url) => { try { execFileSync('bash', ['-c', 'die(){ exit 5; }; eval "$(sed -n \'/^guard_host() {/,/^}/p\' "$1")"; guard_host "$2"', '_', join(SCRIPTS, 'api-pp.sh'), url], { stdio: 'ignore' }); return 0; } catch (e) { return e.status; } };
  for (const bad of ['https://evil.example?.deploymate.polypoint.dev', 'https://evil.example#.deploymate.polypoint.dev', 'https://x.deploymate.polypoint.dev@evil.example/', 'https://evil.example@x.deploymate.polypoint.dev/', 'ftp://x.deploymate.polypoint.dev', 'https://x%2Eevil.example/.deploymate.polypoint.dev', 'https://foo.polypointservices.ch/api']) assert.equal(run(bad), 5, bad);
  for (const good of ['https://ct-a-host.deploymate.polypoint.dev:9090/api', 'http://localhost:9090/pp-api/api', 'http://127.0.0.1:8383/auth']) assert.equal(run(good), 0, good);
});
t('no ignoreHTTPSErrors in the harness', () => { for (const f of ['polyid-flow.mjs', 'pwa-embed.mjs', 'lib/session.mjs', 'app.mjs']) { const p = join(HARNESS, f); if (existsSync(p)) assert.ok(!readFileSync(p, 'utf8').includes('ignoreHTTPSErrors'), f); } });

// ---- 8. credential / forbidden-call scan of every owned file ----------------------------------------------------------------
const owned = [];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { if (!['fixtures', 'node_modules'].includes(e.name)) walk(p); } else owned.push(p); } };
walk(HARNESS); walk(SEED); for (const f of ['api-pp.sh', 'pp-plan.sh', 'plan-day.sh', 'pep/pe-ready.sh', 'pep/pe-paint.sh']) owned.push(join(SCRIPTS, f)); owned.push(join(SKILL, 'references', 'harness.md'));
for (const p of owned.filter((x) => existsSync(x) && !x.endsWith('run-tests.mjs'))) {
  const s = readFileSync(p, 'utf8'); const rel = p.slice(SKILL.length + 1);
  t(`scan ${rel}: no token / secret literal`, () => { assert.doesNotMatch(s, /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/); assert.doesNotMatch(s, /(client_secret|password|passwort)\s*[:=]\s*['"][A-Za-z0-9!$%^*+=_-]{6,}['"]/i); });
  if (/\.(mjs|sh)$/.test(p)) t(`scan ${rel}: no /test/ call outside the gateway-mock allow-list`, () => {
    const hits = s.split('\n').filter((l) => /['"`][^'"`]*\/test\/[a-z]/.test(l) && !/received-bookings|booking-response-strategy|resubmission|forbidden|refus|never|GUARD|allow-list|\/test\/\*\*|test\/clear/.test(l));
    assert.deepEqual(hits, []);
  });
}

rmSync(sandbox, { recursive: true, force: true });
console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log('FAIL', f);
process.exit(failures.length ? 1 : 0);
