// One-time interactive login to the DeployMate SPA, capturing the OIDC refresh token
// so the orchestrator can mint short-lived access tokens with curl for the rest of the run.
//
// Usage:  node dm-login-capture.mjs <out-file>   (default session path for dm-api.sh: ~/.config/deploymate/dm-session.json)
//   - run it from the directory where playwright is installed (cd ~/.config/deploymate); opens a headed Chromium with a persistent profile under ./dm-profile
//   - ticks "Stay signed in on this device" on the login screen (best effort; tick it yourself if
//     it is not ticked) so the SPA keeps the session in localStorage and requests an offline token.
//     Do NOT force the dm-stay-signed-in flag from outside: the SPA's login() resets it from the
//     checkbox and keeps the PKCE state in the matching store, so an externally forced flag makes
//     the callback look in the wrong store and fail with "No matching state found in storage".
//   - waits (up to 10 min) until the SPA has stored an oidc-client-ts user with a refresh token
//   - writes {authority, client_id, refresh_token, sub, preferred_username} to <out-file> (0600)
//
// Refresh later with:
//   curl -s -X POST "$AUTHORITY/protocol/openid-connect/token" \
//     -d grant_type=refresh_token -d client_id=deploy-mate-spa -d refresh_token="$RT" | jq -r .access_token
import { writeFileSync, chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Resolve playwright from the directory the script is run in (e.g. ~/.config/deploymate),
// not from the skill's own location, so the skill folder needs no node_modules.
const { chromium } = createRequire(join(process.cwd(), '/'))('playwright');

const out = process.argv[2];
if (!out) { console.error('usage: node dm-login-capture.mjs <out-file>'); process.exit(2); }

const SPA = 'https://deploymate.dev.k8s.polypoint-dev.com/ops/';
const CLIENT_ID = 'deploy-mate-spa';

const ctx = await chromium.launchPersistentContext('./dm-profile', { headless: false, viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
await page.goto(SPA);
console.log('Browser open. Tick "Stay signed in on this device" and sign in (PolyId). Waiting for the SPA to store a session…');

// Best effort: tick the checkbox for the user. The login button reads its state on click.
page.getByLabel('Stay signed in on this device').check({ timeout: 15000 })
  .then(() => console.log('"Stay signed in" ticked.'))
  .catch(() => console.log('Could not tick "Stay signed in" automatically - please tick it before signing in.'));

// Surface the SPA's own callback error (shown as "Sign-in failed") instead of waiting silently.
let lastErr = null;
async function callbackError() {
  if (!page.url().includes('/auth/callback')) return null;
  const pre = page.locator('pre').first();
  return (await pre.count()) ? (await pre.innerText()).trim() : null;
}

const deadline = Date.now() + 10 * 60 * 1000;
let found = null;
while (Date.now() < deadline && !found) {
  await page.waitForTimeout(2000);
  try {
    const err = await callbackError();
    if (err && err !== lastErr) { lastErr = err; console.log('Sign-in failed in the SPA: ' + err); }
    found = await page.evaluate((clientId) => {
      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && k.startsWith('oidc.user:') && k.endsWith(':' + clientId)) {
            const u = JSON.parse(store.getItem(k));
            if (u && u.refresh_token) {
              return { authority: k.slice('oidc.user:'.length, -(clientId.length + 1)), client_id: clientId,
                       refresh_token: u.refresh_token, sub: u.profile?.sub, preferred_username: u.profile?.preferred_username,
                       roles: u.profile?.realm_access?.roles ?? null };
            }
          }
        }
      }
      return null;
    }, CLIENT_ID);
  } catch { /* page navigating */ }
}
await ctx.close();
if (!found) { console.error('No session with a refresh token captured within 10 minutes.'); process.exit(1); }
writeFileSync(out, JSON.stringify(found, null, 2) + '\n');
chmodSync(out, 0o600);
console.log(`Captured session for ${found.preferred_username ?? found.sub}; roles=${JSON.stringify(found.roles)}; written to ${out}`);
