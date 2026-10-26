// ui-stamp-crud.mjs — W-01 recipe: add a clock-in, edit it, add the clock-out, then delete both, all through the unified
// day view of a PAST day (card button .unified-shift-card-stamp-btn), with the DB oracle after every step.
//   DAY=YYYY-MM-DD EMP=<employment id> IN=HH:MM EDIT=HH:MM OUT=HH:MM [KEEP=1  stop after the pair, do not delete]
//     node scripts/harness/mypp.mjs <tenant-id> <login> scripts/harness/ui-stamp-crud.mjs <outdir>
// Times are local (Europe/Zurich) inside the day's planned window. Files: timestamps-post.json, timestamps-put.json,
// timestamps-post-out.json, timestamps-delete-<n>.json, days-before/after.json. Only stamps with a DELETE action are deleted.
// An update is delete+add on-prem (new id, old row POSITION -1). Verified on the CT build of 2026-10-14.
import { day, dayx, readDay, summary, save, dumpButtons, setTime, oracle, act, expand, comment, alertText } from './utr-lib.mjs';
export default async (ctx) => {
  const { page, shot, log, out, env, api } = ctx;
  const D = process.env.DAY, EMP = process.env.EMP;
  const IN = process.env.IN, EDIT = process.env.EDIT, OUT = process.env.OUT;
  if (!D || !EMP || !IN || !EDIT || !OUT) throw new Error('set DAY, EMP, IN, EDIT, OUT');
  const res = { steps: [] };
  const step = (name, o) => { res.steps.push({ name, ...o }); log(name, JSON.stringify(o).slice(0, 600)); };
  const r0 = await dayx(ctx, D); await shot('before');
  if (!ctx.dayViewOk) throw new Error(`day view of ${D} not reached (SPA on ${page.url()}) - nothing written, re-run`);
  save(out, 'days-before.json', r0?.body); step('before', { status: r0?.status, sum: summary(r0?.body?.[0]), db: oracle(env, EMP, D) });

  // 1. add clock-in IN
  await page.locator('.unified-shift-card-stamp-btn').first().click(); await page.waitForTimeout(1500);
  await setTime(page, 0, IN, log); await comment(page, 'e2e W-01 in'); await shot('add-in-form');
  let w = await act(page, 'POST', '/unified-time-recording/v1/timestamps', () => page.locator('#primaryButton').click());
  await page.waitForTimeout(2500); await expand(page); await shot('after-add-in');
  save(out, 'timestamps-post.json', w); step('post-in', { status: w?.status, req: w?.requestBody, sum: summary(w?.body), alert: await alertText(page), db: oracle(env, EMP, D) });

  // 2. edit to EDIT
  const edit = page.locator('button.unified-shift-card-ts-action-btn.edit').locator('visible=true').first();
  if (!(await edit.count())) { log('no edit button', JSON.stringify(await dumpButtons(page))); }
  await edit.click(); await page.waitForTimeout(1500);
  await setTime(page, 0, EDIT, log); await shot('edit-form');
  w = await act(page, 'PUT', '/unified-time-recording/v1/timestamps/', () => page.locator('#primaryButton').click());
  await page.waitForTimeout(2500); await expand(page); await shot('after-edit');
  save(out, 'timestamps-put.json', w); step('put-in', { status: w?.status, url: w?.url, req: w?.requestBody, sum: summary(w?.body), alert: await alertText(page), db: oracle(env, EMP, D) });

  // 3. add clock-out OUT
  log('buttons before out', JSON.stringify(await dumpButtons(page)));
  await page.locator('.unified-shift-card-stamp-btn').locator('visible=true').first().click(); await page.waitForTimeout(1500);
  await setTime(page, 0, OUT, log); await comment(page, 'e2e W-01 out'); await shot('add-out-form');
  w = await act(page, 'POST', '/unified-time-recording/v1/timestamps', () => page.locator('#primaryButton').click());
  await page.waitForTimeout(2500); await expand(page); await shot('after-add-out');
  save(out, 'timestamps-post-out.json', w); step('post-out', { status: w?.status, req: w?.requestBody, sum: summary(w?.body), alert: await alertText(page), db: oracle(env, EMP, D) });

  if (process.env.KEEP === '1') { const k = await readDay(api, D); save(out, 'days-after.json', k); step('kept', { sum: summary(k.plan), db: oracle(env, EMP, D) }); return res; }
  // 4. delete both (manual stamps only)
  for (let i = 0; i < 2; i++) {
    const del = page.locator('button.unified-shift-card-ts-action-btn.delete').locator('visible=true').first();
    if (!(await del.count())) { log('no delete button left'); break; }
    await del.click(); await page.waitForTimeout(1200); await shot(`delete-dialog-${i}`);
    log('dialog buttons', JSON.stringify(await dumpButtons(page)));
    const confirm = page.locator('ion-modal:visible ion-button, ion-alert:visible button').filter({ hasText: /Löschen|Entfernen/ }).last();
    w = await act(page, 'DELETE', '/unified-time-recording/v1/timestamps/', () => confirm.click());
    await page.waitForTimeout(2500); await expand(page); await shot(`after-delete-${i}`);
    save(out, `timestamps-delete-${i}.json`, w); step(`delete-${i}`, { status: w?.status, url: w?.url, sum: summary(w?.body), alert: await alertText(page), db: oracle(env, EMP, D) });
  }
  const fin = await readDay(api, D); save(out, 'days-after.json', fin); step('final', { status: fin.status, sum: summary(fin.plan), db: oracle(env, EMP, D) });
  return res;
};
