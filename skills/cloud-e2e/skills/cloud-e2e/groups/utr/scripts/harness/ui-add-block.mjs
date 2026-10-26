// ui-add-block.mjs — add a block through the unified day view (card "Block hinzufügen" / add-block wrapper), desktop viewport.
//   DAY=YYYY-MM-DD EMP=<employment id> START=HH:MM END=HH:MM NOTE="e2e W-02" [TAG=w02] [SDATE_NEXT=1] [EDATE_NEXT=1]
//   [SDATE_PREV=1] [EDATE_PREV=1  move the start / end date one day back — a night card defaults "Datum bis" to the next day]
//   [END_DAY=YYYY-MM-DD  expected local (Europe/Zurich) day of the block end; default DAY, DAY+1 with EDATE_NEXT]
//   [GUARD_END=0  disable the end-day guard: by default the POST is ABORTED in the browser (nothing sent) when the request's
//    `end` falls on another local day than END_DAY — the master-1822 night-card trap (17:00–18:00 became a 25 h block)]
//   [DEFNEXT=n  advance the definition arrow picker n times] [DAYLEVEL=1|<selector>  use the day-level add control]
//   [DRY=1  open the editor, screenshot, do not save]
//     node scripts/harness/mypp.mjs <tenant-id> <login> scripts/harness/ui-add-block.mjs <outdir>
// Captures the POST /unified-time-recording/v1/shifts request + response (<TAG>-shifts-post.json), the day before/after
// (<TAG>-days-*.json) and the DB oracle rows (scripts/oracle-day.sh) in the step log. Verified on the CT build 2026-10-14.
// The CT build of that date had NO day-level add-block control (PPCLOUD-14201 absent): DAYLEVEL then finds nothing.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { day, dayx, readDay, summary, save, dumpButtons, setTime, oracle, act, expand, comment, alertText } from './utr-lib.mjs';
export default async (ctx) => {
  const { page, shot, log, out, env, api } = ctx;
  const D = process.env.DAY, EMP = process.env.EMP, tag = process.env.TAG || 'add';
  const res = { steps: [] };
  const step = (name, o) => { res.steps.push({ name, ...o }); log(name, JSON.stringify(o).slice(0, 900)); };
  const r0 = await dayx(ctx, D); await shot(`${tag}-before`);
  if (!ctx.dayViewOk) throw new Error(`day view of ${D} not reached (SPA on ${page.url()}) - nothing written, re-run`);
  save(out, `${tag}-days-before.json`, r0?.body); step('before', { sum: summary(r0?.body?.[0]), db: oracle(env, EMP, D) });
  log('buttons', JSON.stringify(await dumpButtons(page)));
  if (process.env.DAYLEVEL) {
    const sel = process.env.DAYLEVEL === '1' ? '.day-stamp-container ion-button, .day-stamp-container button' : process.env.DAYLEVEL;
    const avail = page.waitForResponse((r) => r.url().includes('available-shift-definitions'), { timeout: 15000 }).catch(() => null);
    await page.locator(sel).locator('visible=true').first().click(); await page.waitForTimeout(2000);
    const a = await avail; if (a) save(out, `${tag}-available-shift-definitions.json`, { url: a.url(), status: a.status(), body: await a.json().catch(() => null) });
  } else {
    await page.locator('.unified-shift-card-add-block-wrapper ion-button, ion-button.unified-shift-card-stamp-btn').filter({ hasText: /Block/ }).locator('visible=true').first().click();
    await page.waitForTimeout(2000);
  }
  await shot(`${tag}-form-initial`);
  writeFileSync(join(out, `${tag}-form.html`), await page.content());
  log('form buttons', JSON.stringify(await dumpButtons(page)));
  if (process.env.DRY) return res;
  if (process.env.DEFNEXT) { for (let i = 0; i < Number(process.env.DEFNEXT); i++) { await page.locator('pp-arrow-picker-card').first().locator('.arrow-picker-card-next').click(); await page.waitForTimeout(400); } }
  const pickers = page.locator('pp-arrow-picker-card');
  const np = await pickers.count();
  // date pickers: the last two arrow pickers are start/end date
  if (process.env.SDATE_NEXT) { await pickers.nth(np - 2).locator('.arrow-picker-card-next').click(); await page.waitForTimeout(400); }
  if (process.env.EDATE_NEXT) { await pickers.nth(np - 1).locator('.arrow-picker-card-next').click(); await page.waitForTimeout(400); }
  if (process.env.SDATE_PREV) { await pickers.nth(np - 2).locator('.arrow-picker-card-prev').click(); await page.waitForTimeout(400); }
  if (process.env.EDATE_PREV) { await pickers.nth(np - 1).locator('.arrow-picker-card-prev').click(); await page.waitForTimeout(400); }
  log('pickers', JSON.stringify(await pickers.evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')))));
  // end-day guard: abort the POST in the browser when the block would end on another local day than expected
  const localDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date(iso));
  const plusDay = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  const endDay = process.env.END_DAY || (process.env.EDATE_NEXT ? plusDay(D, 1) : D);
  if (process.env.GUARD_END !== '0') {
    await page.route('**/unified-time-recording/v1/shifts', async (route) => {
      const req = route.request();
      let b = null; try { b = JSON.parse(req.postData() || 'null'); } catch { b = null; }
      if (req.method() === 'POST' && b?.end && localDay(b.end) !== endDay) {
        res.guard = { aborted: true, end: b.end, endLocalDay: localDay(b.end), expected: endDay };
        log('END-DAY GUARD: POST aborted, nothing sent', JSON.stringify(res.guard)); return route.abort();
      }
      return route.continue();
    });
  }
  if (process.env.START) await setTime(page, 0, process.env.START, log);
  if (process.env.END) await setTime(page, 1, process.env.END, log);
  await comment(page, process.env.NOTE || 'e2e W');
  await shot(`${tag}-form-filled`);
  const w = await act(page, 'POST', '/unified-time-recording/v1/shifts', () => page.locator('#primaryButton').click(), 30000);
  await page.waitForTimeout(2500);
  const al = await alertText(page);
  await shot(`${tag}-after`);
  save(out, `${tag}-shifts-post.json`, w);
  step('post', { status: w?.status, req: w?.requestBody, body: w && w.status >= 400 ? w.body : undefined, sum: w && w.status < 400 ? summary(w.body) : undefined, alert: al, url: page.url() });
  if (al) { const x = page.locator('ion-modal:visible .icon-close, ion-modal:visible [class*=close]').first(); if (await x.count()) await x.click().catch(() => {}); }
  await day(ctx, D); await expand(page); await shot(`${tag}-day-after`);
  const fin = await readDay(api, D); save(out, `${tag}-days-after.json`, fin);
  step('after', { sum: summary(fin.plan), db: oracle(env, EMP, D) });
  log('buttons after', JSON.stringify(await dumpButtons(page)));
  return res;
};
