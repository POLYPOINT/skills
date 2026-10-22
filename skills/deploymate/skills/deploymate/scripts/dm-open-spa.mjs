// Open the DeployMate SPA in a headed browser for a human to watch, using the signed-in
// persistent profile created by dm-login-capture.mjs. Stays open until the window is closed.
//
// Usage:  cd ~/.config/deploymate && node <skill>/scripts/dm-open-spa.mjs [path-or-url]
//   e.g.  node dm-open-spa.mjs /ops/envs/utr-p-1801
import { createRequire } from 'node:module';
import { join } from 'node:path';

const { chromium } = createRequire(join(process.cwd(), '/'))('playwright');

const SPA = 'https://deploymate.dev.k8s.polypoint-dev.com';
const target = process.argv[2] ?? '/ops/';
const url = target.startsWith('http') ? target : SPA + target;

const ctx = await chromium.launchPersistentContext('./dm-profile', { headless: false, viewport: null });
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(url);
console.log(`SPA open at ${url}; close the browser window to end.`);
await new Promise((resolve) => ctx.on('close', resolve));
console.log('Browser closed.');
