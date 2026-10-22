// ui-edit-row.mjs — edit or delete a row (block, break, timestamp) of the unified day view through its row action button.
//   DAY=YYYY-MM-DD EMP=<employment id> MODE=edit|delete [IDX=n  n-th visible button, default 0] [START=HH:MM] [END=HH:MM]
//   [NOTE=…] [TAG=…] [SEL=<css of the action buttons>] [FRAG=<URL fragment of the write, default /unified-time-recording/v1/shifts/>]
//   [METHOD=PUT] [CONFIRM=<css of the delete dialog buttons>]
//     node scripts/harness/mypp.mjs <tenant-id> <login> scripts/harness/ui-edit-row.mjs <outdir>
// Default buttons: button.unified-shift-card-ts-action-btn.edit|.delete (expand() opens the accordions first).
// Timestamps: FRAG=/unified-time-recording/v1/timestamps/  Breaks: FRAG=/breaks/ (break delete dialog: primary = CANCEL,
// secondary = DELETE; the default CONFIRM picks the button labelled Löschen/Entfernen). Verified on the CT build 2026-10-14.
import { day, dayx, readDay, summary, save, dumpButtons, setTime, oracle, act, expand, comment, alertText } from './utr-lib.mjs';
export default async (ctx) => {
  const { page, shot, log, out, env, api } = ctx;
  const D = process.env.DAY, EMP = process.env.EMP, tag = process.env.TAG || 'edit', mode = process.env.MODE || 'edit';
  const res = { steps: [] };
  const step = (name, o) => { res.steps.push({ name, ...o }); log(name, JSON.stringify(o).slice(0, 900)); };
  const r0 = await dayx(ctx, D); await shot(`${tag}-before`);
  if (!ctx.dayViewOk) throw new Error(`day view of ${D} not reached (SPA on ${page.url()}) - nothing written, re-run`);
  step('before', { sum: summary(r0?.body?.[0]) });
  const idx = Number(process.env.IDX || 0);
  const sel = process.env.SEL || `button.unified-shift-card-ts-action-btn.${mode}`;
  const btn = page.locator(sel).locator('visible=true').nth(idx);
  await btn.click(); await page.waitForTimeout(1800); await shot(`${tag}-opened`);
  log('buttons', JSON.stringify(await dumpButtons(page)));
  let w;
  if (mode === 'edit') {
    if (process.env.START) await setTime(page, 0, process.env.START, log);
    if (process.env.END) await setTime(page, 1, process.env.END, log);
    if (process.env.NOTE) await comment(page, process.env.NOTE);
    await shot(`${tag}-form-filled`);
    w = await act(page, process.env.METHOD || 'PUT', process.env.FRAG || '/unified-time-recording/v1/shifts/', () => page.locator('#primaryButton').click(), 30000);
  } else {
    const confirm = page.locator(process.env.CONFIRM || 'ion-modal:visible ion-button, ion-alert:visible button').filter({ hasText: /Löschen|Entfernen/ }).last();
    w = await act(page, 'DELETE', process.env.FRAG || '/unified-time-recording/v1/shifts/', () => confirm.click(), 30000);
  }
  await page.waitForTimeout(2500);
  const al = await alertText(page);
  await shot(`${tag}-after`);
  save(out, `${tag}-${mode}.json`, w);
  step(mode, { status: w?.status, url: w?.url, req: w?.requestBody, body: w && w.status >= 400 ? w.body : undefined, sum: w && w.status < 400 ? summary(w.body) : undefined, alert: al });
  await dayx(ctx, D); await shot(`${tag}-day-after`);
  const fin = await readDay(api, D); save(out, `${tag}-days-after.json`, fin);
  step('after', { sum: summary(fin.plan), db: oracle(env, EMP, D) });
  return res;
};
