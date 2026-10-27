// dashboard-check.mjs — offline render check of assets/dashboard.html (acceptance: the dashboard renders the UTR rows plus one
// dummy second group from local JSON). No network: every non-file request is aborted; window.claude is replaced by an in-memory
// db that serves dashboard-fixture-demo.json + the UTR rows of groups/utr/assets/scenarios.json (v0.5.0 row shape: doc id = id,
// status in envM).
//
//   node groups/utr/tests/dashboard-check.mjs [screenshot.png]
// Playwright is resolved from $PLAYWRIGHT_DIR (default ~/.config/deploymate, where the deploymate skill installs it).
// Exit 0 = all assertions hold; 1 = an assertion failed (printed); 2 = Playwright not found.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const skill = resolve(here, '../../..');
let chromium;
try {
  const req = createRequire(join(process.env.PLAYWRIGHT_DIR || join(homedir(), '.config/deploymate'), 'package.json'));
  ({ chromium } = req('playwright'));
} catch (e) {
  console.error('dashboard-check: playwright not found (set PLAYWRIGHT_DIR): ' + e.message);
  process.exit(2);
}

const fx = JSON.parse(readFileSync(join(here, 'dashboard-fixture-demo.json'), 'utf8'));
const utrRows = JSON.parse(readFileSync(join(skill, 'groups/utr/assets/scenarios.json'), 'utf8'));
const statuses = ['pass', 'fail', 'blocked', 'pending', 'running'];
const scenarios = {};
utrRows.forEach((r, i) => {
  const row = { ...r, envM: statuses[i % statuses.length] };
  if (row.envM === 'fail' && i % 2) row.verdict = 'KNOWN-FAIL F1 (fixture)';
  scenarios[r.id] = row; // v0.5.0 doc id = scenario id
});
Object.assign(scenarios, fx.scenarios);
const store = { ...fx, scenarios };
delete store['run/meta']; delete store._doc;
const expectRows = Object.keys(scenarios).length;

// The page is a fragment (the Artifact tool wraps it at publish time): wrap it like the publish skeleton for the check.
const frag = readFileSync(join(skill, 'assets/dashboard.html'), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'dash-check-'));
const page_file = join(dir, 'index.html');
writeFileSync(page_file, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}</style></head><body>' + frag + '</body></html>');

const browser = await chromium.launch();
const failures = [];
const consoleErrors = [];
for (const [label, viewport, scheme] of [['desktop-light', { width: 1280, height: 900 }, 'light'], ['phone-dark', { width: 400, height: 860 }, 'dark']]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  await ctx.route('**/*', (route) => (route.request().url().startsWith('file:') ? route.continue() : route.abort()));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) consoleErrors.push(`${label}: ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`${label}: ${e.message}`));
  await page.addInitScript(({ meta, store }) => {
    const snapDoc = (id, data) => ({ id, exists: data !== undefined, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });
    const db = {
      doc: (path) => ({ onSnapshot: (next) => { setTimeout(() => next(snapDoc(path.split('/').pop(), path === 'run/meta' ? meta : undefined)), 5); return () => {}; } }),
      collection: (name) => ({ onSnapshot: (next) => {
        const docs = Object.entries(store[name] || {}).map(([k, v]) => snapDoc(k, v));
        setTimeout(() => next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }), 10);
        return () => {};
      } }),
    };
    window.claude = { use: async (n) => (n === 'db' ? db : null) };
  }, { meta: fx['run/meta'], store });
  await page.goto(pathToFileURL(page_file).href);
  await page.waitForFunction((n) => document.querySelectorAll('#rows tr').length === n, expectRows, { timeout: 5000 }).catch(() => {});
  const got = await page.evaluate(() => ({
    rows: document.querySelectorAll('#rows tr').length,
    groups: [...document.querySelectorAll('#group-chips button[data-group]')].map((b) => b.getAttribute('data-group')),
    groupCards: document.querySelectorAll('#groups button.card').length,
    envCards: document.querySelectorAll('#envs .card').length,
    locks: document.querySelectorAll('#locks li').length,
    runners: document.querySelectorAll('#runners li').length,
    claims: document.querySelectorAll('#claims li').length,
    windows: document.querySelectorAll('#windows .win').length,
    findings: document.querySelectorAll('#findings-list li').length,
    known: document.querySelectorAll('#rows .pill.known').length,
    banner: document.getElementById('banner').hidden,
    title: document.getElementById('run-name').textContent,
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  const want = (ok, msg) => { if (!ok) failures.push(`${label}: ${msg}`); };
  want(got.rows === expectRows, `rows ${got.rows}, expected ${expectRows} (${utrRows.length} utr + ${Object.keys(fx.scenarios).length} demo)`);
  want(got.groups.includes('utr') && got.groups.includes('demo'), `group chips ${JSON.stringify(got.groups)}`);
  want(got.groupCards === 2, `group meters ${got.groupCards}`);
  want(got.envCards === 3, `env cards ${got.envCards} (2 envs + stage objects)`);
  want(got.locks === 1 && got.runners === 2 && got.claims === 2, `locks ${got.locks}, runners ${got.runners}, claim groups ${got.claims}`);
  want(got.windows === 3, `windows ${got.windows} (2 docs + 1 planned slot)`);
  want(got.findings >= 2, `findings ${got.findings}`);
  want(got.known >= 1, 'no KNOWN-FAIL pill');
  want(got.banner === true, 'offline banner still visible');
  want(got.title === 'fixture-run', `title ${got.title}`);
  want(!got.hscroll, 'page scrolls horizontally');
  // filter by the dummy group, then open one row
  await page.click('#group-chips button[data-group="demo"]');
  const demoRows = await page.evaluate(() => document.querySelectorAll('#rows tr').length);
  want(demoRows === Object.keys(fx.scenarios).length, `demo filter shows ${demoRows} rows`);
  const famChips = await page.evaluate(() => [...document.querySelectorAll('#fam-chips button[data-fam]')].map((b) => b.getAttribute('data-fam')));
  want(famChips.includes('A') && famChips.includes('B'), `family chips ${JSON.stringify(famChips)}`);
  await page.click('#rows tr[data-key="demo~DEM-03"]');
  const drawer = await page.evaluate(() => ({ open: !document.getElementById('drawer').hidden, id: document.getElementById('d-id').textContent }));
  want(drawer.open && drawer.id.includes('DEM-03'), `drawer ${JSON.stringify(drawer)}`);
  await page.keyboard.press('Escape');
  await page.click('#group-chips button[data-group=""]');
  if (label === 'desktop-light' && process.argv[2]) await page.screenshot({ path: process.argv[2], fullPage: true });
  await ctx.close();
  console.log(`${label}: ${JSON.stringify(got)}`);
}
await browser.close();
if (consoleErrors.length) failures.push(...consoleErrors.map((e) => 'console error ' + e));
if (failures.length) { console.log('FAIL\n' + failures.join('\n')); process.exit(1); }
console.log(`OK: ${expectRows} rows (utr ${utrRows.length} + demo ${Object.keys(fx.scenarios).length}), panels rendered, light/desktop and dark/phone`);
