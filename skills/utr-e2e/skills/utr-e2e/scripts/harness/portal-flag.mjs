// CT portal ops: read / set / delete the tenant override of one feature (default: the past-days window of scenario P-03).
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
//   NOT yet verified against the live portal (2026-10-16): check 02-set-after-row.png and the logged PUT before relying on it.
// Exit codes: 0 ok, 2 row not found, 3 login needed (run the login action), 4 usage, 5 boolean control not found / wrong value.
// Propagation to myPP: portal allFeatures cache (≈ 3 min) + poma features reload (60 s) → poll the myPP config/features
// response with a FRESH myPP profile folder until the new value shows (first run: 3–5 min). Never prints tokens.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DM_DIR = process.env.DM_CONFIG_DIR || join(homedir(), '.config/deploymate');
const { chromium } = createRequire(join(DM_DIR, '/'))('playwright');
const [profile, out, tenant, action, value] = process.argv.slice(2);
const ORG = process.env.PORTAL_ORG;
const CODE = process.env.PORTAL_FEATURE || 'poma.onPrem.timeRecodingMaxAllowedPastDays';
const PORTAL = process.env.PORTAL_URL || 'https://ct-portal-webapp.dev.k8s.polypoint-dev.com';
if (!profile || !out || !tenant || !['login', 'read', 'set', 'delete'].includes(action) || (action === 'set' && !value) || !ORG) {
  console.error('usage: PORTAL_ORG=<org slug> node portal-flag.mjs <profileDir> <outDir> <tenant-id> <login|read|set|delete> [value]');
  process.exit(4);
}
mkdirSync(out, { recursive: true });
const headed = action === 'login';
const ctx = await chromium.launchPersistentContext(profile, { headless: !headed, viewport: { width: 1600, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => { const l = `[${new Date().toISOString()}] ` + a.join(' '); console.log(l); appendFileSync(`${out}/portal.log`, l + '\n'); };
const dialogs = [];
page.on('dialog', async (d) => { dialogs.push(d.message()); log('dialog', d.type(), JSON.stringify(d.message())); await d.accept(); });
const calls = [];
page.on('response', async (r) => {
  const u = r.url(); if (!/portal-api.*\/features/.test(u)) return;
  const e = { t: new Date().toISOString(), status: r.status(), method: r.request().method(), url: u.replace(/^https:\/\/[^/]+/, '') };
  calls.push(e); log('api', e.status, e.method, e.url);
  if (e.method === 'GET') {
    try {
      const b = await r.json(); writeFileSync(`${out}/tenant-features-${calls.length}.json`, JSON.stringify(b, null, 1));
      const f = Array.isArray(b) ? b.find((x) => x.code === CODE) : null; if (f) log('flag-in-response', JSON.stringify({ code: f.code, type: f.type, value: f.value, master: f.master }));
    } catch { /* not JSON */ }
  }
});
const url = `${PORTAL}/ops/organizations/${ORG}/${tenant}?section=features`;
const rowOf = () => page.locator('tr.mat-mdc-row, tr[mat-row]').filter({ hasText: CODE }).first();
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => log('goto err', e.message));
if (headed) {
  log('LOGIN: sign in to portal ops in the opened window; waiting up to 5 min for the features table');
  await rowOf().waitFor({ timeout: 300000 }).catch(() => log('login timeout'));
  const ok = (await rowOf().count()) > 0;
  log('login', ok ? 'OK (session stored in the profile)' : 'NOT DONE');
  await ctx.close(); process.exit(ok ? 0 : 3);
}
await page.waitForTimeout(3000);
if (!page.url().startsWith(PORTAL)) { log('LOGIN_NEEDED (run the login action)'); await ctx.close(); process.exit(3); }
await rowOf().waitFor({ timeout: 20000 }).catch(() => log('row not found'));
if (!(await rowOf().count())) { await page.screenshot({ path: `${out}/no-row.png`, fullPage: true }); await ctx.close(); process.exit(2); }
await rowOf().scrollIntoViewIfNeeded();
const toggle = rowOf().locator('mat-slide-toggle button[role=switch], button[role=switch], mat-checkbox input[type=checkbox], input[type=checkbox]').first();
const isBool = (await toggle.count()) > 0;
const input = rowOf().locator('input:not([type=checkbox])').first();
const boolState = async () => { const a = await toggle.getAttribute('aria-checked').catch(() => null); if (a != null) return a === 'true'; return toggle.isChecked().catch(() => null); };
log('ui-value', tenant, isBool ? `boolean ${JSON.stringify(await boolState())}` : JSON.stringify(await input.inputValue().catch(() => null)));
await page.screenshot({ path: `${out}/01-${action}-before.png` });
await rowOf().screenshot({ path: `${out}/01-${action}-before-row.png` });
if (action === 'set' && isBool) {
  if (!['true', 'false'].includes(String(value).toLowerCase())) { log('boolean feature: value must be true|false'); await ctx.close(); process.exit(4); }
  const want = String(value).toLowerCase() === 'true';
  const now = await boolState(); log('boolean before', JSON.stringify(now), 'want', want);
  if (now !== want) { await toggle.click(); await page.waitForTimeout(800); }
  const save = rowOf().locator('button.save-btn-icon, #save-feature');
  if (await save.count()) { await save.first().click(); await page.waitForTimeout(3000); }
  else await page.waitForTimeout(3000);
} else if (action === 'set') {
  await input.fill(value); await page.waitForTimeout(300);
  await rowOf().locator('button.save-btn-icon, #save-feature').click(); await page.waitForTimeout(3000);
} else if (action === 'delete') {
  await rowOf().locator('button.delete-btn-icon, #delete-feature').click(); await page.waitForTimeout(3000);
}
if (action !== 'read') {
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(3000);
  await rowOf().waitFor({ timeout: 20000 }).catch(() => {}); await rowOf().scrollIntoViewIfNeeded().catch(() => {});
  if (isBool) {
    const after = await boolState(); log('ui-value-after-reload', tenant, `boolean ${JSON.stringify(after)}`);
    if (action === 'set' && after !== (String(value).toLowerCase() === 'true')) { log('boolean value not applied'); process.exitCode = 5; }
  } else log('ui-value-after-reload', tenant, JSON.stringify(await rowOf().locator('input:not([type=checkbox])').first().inputValue().catch(() => null)));
  await page.screenshot({ path: `${out}/02-${action}-after.png` });
  await rowOf().screenshot({ path: `${out}/02-${action}-after-row.png` }).catch(() => {});
}
writeFileSync(`${out}/portal-calls.json`, JSON.stringify({ calls, dialogs }, null, 1));
await ctx.close();
