# Group booking — scenario catalogue (BKG, 29 scenarios)

Converted from `areas/booking/scenarios.md` (A-booking, 2026-10-22) with the S1 reconciliations of 2026-10-23:

- environment = **DM-X**; flags = steward baseline with **`poma.internalPool.sendEmailConfirmation` OFF**; the pool-manager role, the book right and the internal-pool flag on the day Dienste come from the steward kits (area steps P1, P2-roles, P4, P8 removed);
- BKG-27 reads the steward's **run partner** instead of `e2e-bkg-<run>`;
- BKG-03 step 4 uses HPC (own family) instead of HPD; BKG-25 is split into a preparation part (before the window) and the window part; the RR / IPO lane acts as SP2;
- moved out to group `manual`: BKG-29 (Teams), BKG-30 (phone), BKG-31 (mail), BKG-32 (PEP entry points);
- harness names: `app.mjs --app mypp|poma` (was `mypp.mjs` / `poma.mjs`), `portal-ops.mjs` (was `portal-read.mjs` / `portal-flag.mjs`), `api-pp.sh avail` (was `api-pp-avail.sh`), `plan-day.sh` (was `oracle-day.sh` PL lines), `pp-plan.sh` for paints.

Families: AV (BKG-01..09, 33) · FH (11–15) · BD (16–20, 26) · RR (21, 22) · IP (23, 24) · NT (27, 28) · window families X10 (BKG-10) and X25 (BKG-25). Worker-facing steps with resolved tokens: `assets/family-briefs/<F>.md`; known deviations: `known-deviations.md`.

## Conventions used by every scenario

- **Environment**: DeployMate env DM-X (`customer-roster` seed, master pin, real PEP + api-gw + api-pp; on-prem 26.99.0 → every capability incl. `GET_PLANNED_SHIFT_TIME_RANGE` ≥ 26.3.3), shared with swap, partner, hp, ts. The gateway mock cannot be used: it serves none of the booking writes (`pool-management/shift-plannings`, `resource-replacement/shift-plannings`, `apply/{ctx}`, `DELETE /shift-plannings` are missing there). The manual cases (Teams, phone, mail, PEP entry points: BKG-29…32) are group `manual`.
- **Tenant configuration = steward flag baseline ("cloud-write mode")**: `poma.flows.availabilities`, `poma.flows.internalPools`, `poma.flows.opportunities`, `poma.flows.availabilitySeries`, `poma.onPrem.writeShiftsOnPrem`, `poma.onPrem.writeResourceReplacementShiftsToPep`, `poma.onPrem.events` = **true**; `poma.internalPool.sendEmailConfirmation` = **false** (reconciled: no mail from DeployMate tenants; the mail path is BKG-31 in group `manual`); `poma.webApp.simulatePEP`, `poma.onPrem.conflictsWithAbsences`, `poma.msTeams.notifications` = false; `poma.onPrem.conflictCheckingMonths` = 3. Only BKG-10 (W-X-SERIES-OFF) and BKG-25 (W-X-WRITE-OFF, state 2) change flags, inside their windows, with `portal-ops.mjs … flag set`; wait for propagation (`waitFlag`, ≈ 5 min) and verify through the app (never through a test-data endpoint).
- **URLs (CT)**: myPP web `https://ct-poma-webapp.dev.k8s.polypoint-dev.com/health-professional-app` (`{{MYPP}}`), planner web app `https://ct-poma-webapp.dev.k8s.polypoint-dev.com` (`{{POMA}}`), poma-api `https://ct-poma-api.dev.k8s.polypoint-dev.com` (`{{API}}`), PolyPortal ops `https://ct-portal-webapp.dev.k8s.polypoint-dev.com` (`{{PORTAL}}`). Logins `dmseed-<kuerzel>@<env-id>.ch` (role-tagged tokens `{{SP}}`, `{{PM}}`, `{{HPA}}`…`{{HPH}}`, `{{ER}}`, see data-plan.md §2). Passwords come from the DeployMate manifest only.
- **Harness**: myPP → `scripts/harness/app.mjs <env> <login> <script> <outdir> --app mypp` (records every `/api/` response into `api/NNN-*.json`, exposes `api.call/get` with the page's bearer); mobile in-app path → `mypp-inapp.mjs`. Planner web app / BADI → `app.mjs … --app poma` (login predicate on `/shift-planner|/pool-manager|/badi`; `--console info` captures the `simulatePEP` bridge lines). Portal ops reads → `portal-ops.mjs` (partner logs, flags, jobs). DB oracle → `scripts/plan-day.sh <env> <MA_ID> <day>` (PLANUNG rows with PA code and position). api-pp availability oracle → `scripts/api-pp.sh <env> avail <MA_ID> <from> <to>` (`POST /pp-api-personnel-planning/api/v2/poma-availability-info/employee-ids/range/{from}/{to}`, `PomaAvailabilityController.java:30-41`). Group helpers: `../scripts/booking-lib.mjs` (availabilities, NC filter, Find HP replay, assignments, RR / IPO creation), `../scripts/rr-ids.sql` (RR ids).
- **Never** call `/test/**` on any host (portal-api / polyid-login `/test/clear` wipe the stage; poma-api `/test/**` is denied on CT anyway). Never run a POMA job without `tenantIds=<env-id>`.
- **Days**: day tokens of the group paint plan (`data-plan.md` §3): `{{HPx_PRES}}` (future day with a presence planning), `{{HPx_ABS}}` (future day with an absence), `{{HPx_FREE*}}` (future day without planning), week `{{W2}}` (Monday of the painted week), `{{RR_DAY}}`, `{{IPO_DAY}}`, `TODAY`. One worker owns one HP and its days; a booking removes the HP from every other open opportunity of that day (`AvailabilityRosterService.java:358-366`), so days are never shared.
- **Evidence naming**: `NN-<step>.png`, `<endpoint>.json` (captured XHR), `oracle-pl-<emp>-<day>.txt` (DB), `oracle-avail-<emp>.json` (api-pp), `nc-<user>.json`, `partner-log.json`, `notes.md`. Every FAIL gets an outlined issue screenshot (`utr-lib.mjs issueShot`).
- **Selectors**: no data-test attributes. Stable ids: planner `#find-hp-btn`, `#search-clear-filters`, `#shift-definition-type-field`, `#manage-bookings-date-filter`, `#manage-bookings-pool-filter`, `#manage-bookings-shift-type-filter`, `#manage-bookings-sort-by`, `#shift-booking-clear-filter`, `#absence-type-field`, `#comment-text-area-field`, `#filter-services`, `#sorting-criteria-field`, `#opportunity-select-hp-display`; myPP `#header-title`, footer `#primaryButton` / `#secondaryButton`. Otherwise locate by visible German text (quoted in the steps).

## Notification oracle per event (used by every scenario below and consolidated in BKG-27 / BKG-28)

NC = notification centre row of the recipient, read with `GET {{API}}/api/mobile/health-professional/v1/notifications?current-page=0&sort-direction=DESC&page-size=20` as the recipient (fields `type`, `object_id`, `navigation_target`, `created_date`, `translated_title.de`). Partner = entry in the steward's **run partner** `{{PARTNER_NAME}}` → tab **Debug** (`portal-ops.mjs … partner logs {{PARTNER_ID}}` = `GET …/integration-partners/{id}/logs`; read only, never edit the partner), CloudEvent `type` = `v1/<Subclass>` (`PEVT/rest/controller/PublicEventsController.java:212`). Filter by `created_date` / event time ≥ scenario start and by `object_id`.

| event (template row)                 | N-id | recipient                   | NC `type` / `navigation_target` / `object_id`                                                                  | partner `type`                                                          | Teams (manual, BKG-29)                          | other                                                                            |
| ------------------------------------ | ---- | --------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| booking confirmed (12008062977#13)   | N-01 | booked HP                   | `BOOKING` / `ASSIGNMENT_DETAIL` / assignment id                                                                | `v1/AssignmentBookingConfirmation`                                      | BOOKINGCONFIRMATION                             | e-mail N-02 only with `sendEmailConfirmation` (OFF on DeployMate; BKG-31 manual) |
| booking cancelled (#14)              | N-03 | HP                          | `BOOKING` / `ASSIGNMENT_DETAIL` / assignment id                                                                | `v1/AssignmentBookingCancellation`                                      | BOOKINGCANCELLATION                             | —                                                                                |
| RR invite (#1)                       | N-08 | each active participant     | `RESOURCE_REPLACEMENT` / `OPPORTUNITY_DETAIL` / opportunity id                                                 | `v1/OpportunityResourceReplacementInvitation`                           | OPPRESOURCEREPLACEMENTINVITATION                | —                                                                                |
| IPO invite (#7)                      | N-07 | each active participant     | `INTERNAL_POOL_OPPORTUNITY` / `OPPORTUNITY_DETAIL` / opportunity id                                            | `v1/OpportunityInternalPoolsOpportunityInvitation`                      | OPPINTERNALPOOLINVITATION                       | —                                                                                |
| HP response → SP (#2, #5, #8, #11)   | N-10 | opportunity owner (SP)      | owner's NC (type by opportunity type) / `DEFAULT_VIEW` — readable because DeployMate SPs also hold the HP role | response subclass (guess `v1/OpportunityResponse`; record what appears) | OPPRESPONSE                                     | event E-02 `v1/ApplicationReceived` to on-prem (`poma.onPrem.events`)            |
| selected (#3, #9)                    | N-11 | selected HP                 | RR/IPO type / `OPPORTUNITY_DETAIL`                                                                             | `v1/OpportunitySelection`                                               | OPPSELECTION (route WEEK_VIEW — known mismatch) | —                                                                                |
| not selected (#4, #10)               | N-12 | other positive applicants   | RR/IPO type / `NOTIFICATION_CENTER`                                                                            | `v1/OpportunityRejection`                                               | OPPREJECTION                                    | —                                                                                |
| opportunity cancelled (#6, #12)      | N-13 | applicants (+ selectee)     | RR/IPO type / `NOTIFICATION_CENTER`                                                                            | `v1/OpportunityCancellation`                                            | OPPCANCELLATION                                 | —                                                                                |
| reminder (no template row)           | N-14 | participants without answer | RR/IPO type / `OPPORTUNITY_DETAIL`                                                                             | `v1/OpportunityReminder`                                                | OPPREMINDER                                     | —                                                                                |
| availability deleted by PEP (no row) | N-04 | HP                          | `AVAILABILITY` / `NOTIFICATION_CENTER` / availability id                                                       | `v1/AvailabilityDeleted`                                                | AVAILABILITYCANCELLATION                        | —                                                                                |

Push (all rows): only on a device (BKG-30); `PushNotificationEvent` exists in the data lake but is not readable per message.

---

## Family AV — availabilities (myPOLYPOINT, HP)

### BKG-01 One-off availability: create, see it as HP, SP and on-prem

> Data prerequisite / status on customer-roster seed: group seed P3b (pool `E2E-BKG-A` with `{{HPA}}`), P5 (paint plan, `{{HPA_FREE1}}`). Not provided by the seed (pools are cloud objects).
> Pre: series flag on (irrelevant for one-off); `{{HPA}}` member of `E2E-BKG-A`; `{{HPA_FREE1}}` has no planning.
> Steps: 1. myPP as `{{HPA}}` → `/tabs/calendar` → floating "+" → "Verfügbarkeit erfassen". 2. Choose "Einmalig" if the radio is shown, date `{{HPA_FREE1}}`, Dienstgruppe "Tagdienst" only, pool `E2E-BKG-A` (not "Alle Pools ausgewählt") → "Verfügbarkeit senden"; capture `POST …/v1/availabilities`. 3. Confirmation "Danke. Ihre Verfügbarkeit wurde erfolgreich eingetragen" → back to the calendar; open the day view `…/calendar/day-view/{{HPA_FREE1}}`; capture `GET …/calendar/day-view`. 4. Month view: switch on "Meine Verfügbarkeiten anzeigen"; screenshot the month. 5. Planner app as `{{SP}}` → `/shift-planner/health-professionals` → Datum `{{HPA_FREE1}}`, Planblatt = `{{HPA}}`'s Gruppe, Dienst = a day shift of that Planblatt, Pools `E2E-BKG-A`; capture `GET /api/private/tenant/consumable-pools/availabilities`. 6. api-pp oracle for `{{HPA}}`'s employee id, range = the day.
> Expect: POST 2xx; day view lists one availability (NORMAL, pool `E2E-BKG-A`); month cell marked; Find HP result contains `{{HPA}}` with a "Buchen" button; api-pp returns an entry for `{{HPA_FREE1}}`.
> Oracle: `day-view.json` `availabilities[0].shifts == ["NORMAL"]` and pool id; `consumable-pools/availabilities` response contains `{{HPA}}`'s user; `oracle-avail-<emp>.json` lists the date.
> Evidence: 01-form.png, 02-confirm.png, 03-day-view.png, 04-month.png, 05-find-hp.png, the JSON above.
> Source: 11474174016#1–#3, 12481757204#1; MYPP-AVAIL-01, POMA-FINDHP-01.

### BKG-02 One-off on a presence day is rejected (de and fr)

> Data prerequisite: P5 `{{HPA_PRES}}` (seeded or painted presence, future).
> Pre: `{{HPA}}` in a pool.
> Steps: 1. myPP as `{{HPA}}` (language de) → "Verfügbarkeit erfassen" → date `{{HPA_PRES}}`, Tagdienst, pool → "Verfügbarkeit senden". 2. Capture the POST response and the alert. 3. Switch the profile language to Français (profile → language) and repeat; screenshot the alert. 4. Restore German.
> Expect: POST 4xx with error code `AVAILABILITY_VALIDATION_ERROR_CONFLICT`; alert title "Konflikt Verfügbarkeiten/Dienste" (de) and the French text from `fr.json` (no raw key, OK button closes); no availability on that day afterwards (day view empty).
> Oracle: response body `errorCode`; `GET …/calendar/day-view?date={{HPA_PRES}}` → `availabilities` empty.
> Evidence: 01-alert-de.png, 02-alert-fr.png, availabilities-post.json, day-view.json.
> Source: 11741921430#19; MYPP-AVAIL-01 (`AvailabilityConflictService.java:50-66`).

### BKG-03 Absence day and free day accept an availability; a booked day does not

> Data prerequisite: P5 `{{HPA_ABS}}` (absence painted), `{{HPA_FREE2}}`; `{{HPC}}` free on `{{HPC_FREE3}}` (step 4 books it).
> Pre: `poma.onPrem.conflictsWithAbsences` = false.
> Steps: 1. myPP `{{HPA}}`: one-off on `{{HPA_ABS}}` (Spätdienst). 2. One-off on `{{HPA_FREE2}}` (Frühdienst). 3. api-pp oracle for both days. 4. Booked-day guard (group S1 edit: the area used HPD after BKG-12; HPC keeps this scenario inside its own family): a. myPP `{{HPC}}`: one-off on `{{HPC_FREE3}}` (Tagdienst, pool `E2E-BKG-A`). b. Planner `{{SP}}`: Find HP for `{{HPC_FREE3}}` → "Buchen" `{{HPC}}` → confirm (assignment SUCCESS). c. myPP `{{HPC}}`: a second one-off on `{{HPC_FREE3}}` (any Dienstgruppe). d. Cleanup: SP cancels the booking (`PUT /api/private/assignments/{id}/cancel`), HPC deletes its availability.
> Expect: 1–2 created (2xx, visible in the day view); api-pp lists both dates; 4c → 4xx `AVAILABILITY_VALIDATION_ERROR_BOOKING` "Konflikt Verfügbarkeiten/Buchungen".
> Oracle: POST statuses + `errorCode`; api-pp JSON; assignment id and final state CANCELLED after 4d.
> Evidence: day-view-abs.json, day-view-free.json, oracle-avail-<emp>.json, 04-booking-conflict.png, assignment-hpc.json.
> Source: 11741921430#20, #21; gap G-AV-3 (booking conflict).

### BKG-04 Week series across presence, absence and free days: conflict modal and force

> Data prerequisite: P5 week `{{W2}}` for `{{HPA}}`: presence on Tue, absence on Thu, all other days free (painted, outside the seed roster window).
> Pre: `poma.flows.availabilitySeries` = true (steward baseline).
> Steps: 1. myPP `{{HPA}}` → "Verfügbarkeit erfassen" → assert the "Häufigkeit" radio (Einmalig / Wiederholend) is visible → "Wiederholend". 2. Von = Mon `{{W2}}`, Bis = Sun `{{W2}}+6`, Wochentage "Alle", Wiederholung "Wöchentlich", Dienstgruppe Tagdienst, pool `E2E-BKG-A` → "Verfügbarkeit senden"; capture `POST …/availabilities-series?force=false`. 3. Modal "Verfügbarkeitskonflikt" ("… gibt es 1 Konflikte. An folgenden Daten wird die Verfügbarkeit weggelassen") lists Tue → Ok; capture `POST …?force=true`. 4. Day view for each of the 7 days; week view screenshot; month view with "Meine Verfügbarkeiten anzeigen". 5. api-pp oracle for the week.
> Expect: first POST returns exactly one conflict (Tue, presence); forced POST 2xx; availabilities on Mon, Wed, Thu (absence), Fri, Sat, Sun — not on Tue; api-pp shows the same 6 dates.
> Oracle: conflict list in `availabilities-series-force-false.json`; day-view JSONs; api-pp.
> Evidence: 01-frequency.png, 03-conflict-modal.png, 04-week.png, 04-month.png, JSONs.
> Source: 11741921430#1, #2, 12481757204#2; MYPP-AVAIL-02 (`availabilities-conflicts-modal.component.ts:74-77`).

### BKG-05 Series repetition matrix and the 3-month on-prem horizon

> Data prerequisite: none beyond P3 (`{{HPB}}` in `E2E-BKG-A`); `{{HPB}}` has no plannings after the seed window (+6 d).
> Pre: series flag on; start dates ≥ seed + 7 d so no seeded planning conflicts.
> Steps: for each config create, read back, delete — one at a time: (a) Di, wöchentlich, 3 Wochen; (b) Mo+Mi+Fr, alle 2 Wochen, 2 Monate; (c) Fr, alle 3 Wochen, 15 Wochen; (d) Monatlich, Bis "Offen" (weekday row must be hidden). For each: 1. create; capture POST. 2. `GET …/calendar/roster` (or day views) for the next 6 months: list the dates carrying the availability. 3. api-pp oracle range today … today + 6 months. 4. delete via day view → "Löschen" → "Alle Tage der Serienverfügbarkeit" → Ok; capture the DELETE. 5. Re-read myPP and api-pp.
> Expect: generated dates follow the rule exactly ((a) 3 Tuesdays; (b) Mo/Mi/Fr every second week for 2 months; (c) 6 Fridays; (d) one per month on the start day-of-month — guess, the first run confirms the recurrence); myPP shows iterations also after month 3; api-pp lists only dates ≤ today + 3 months (`EffectiveAvailabilityService.java:118-124`); after delete both are empty.
> Oracle: date lists computed by the worker from the rule vs `calendar/roster` and api-pp responses; DELETE 2xx.
> Evidence: `series-<a..d>-dates.json` (expected vs actual), api-pp JSON per config, screenshots of the form for (d).
> Source: 11741921430#5–#8, 12481757204#4; MYPP-AVAIL-02, POMA-JOB-01.

### BKG-06 Edit a not-started series, delete one iteration, delete the series, one-off on the freed day

> Data prerequisite: as BKG-05 (`{{HPB}}`, future dates without plannings). Runs after BKG-05.
> Pre: series flag on.
> Steps: 1. Create Mo+Mi+Fr wöchentlich, start = next Monday ≥ seed + 7 d, 2 Monate; note the availability id. 2. Day view of the first Friday → "Bearbeiten" → "Alle Tage der Serienverfügbarkeit" → change to Mo+Fr, end + 3 Monate → send; capture `PUT …/availabilities-series?force=false&from=…`. 3. Read dates (myPP + api-pp). 4. Day view of the second Friday → "Löschen" → "Einzelner Tag der Serienverfügbarkeit" → Ok; capture `DELETE …/availabilities-series/{id}/iteration?day=`. 5. Delete the whole series. 6. One-off on that second Friday.
> Expect: step 2 keeps the same series id (no split: series not started, `AvailabilityHealthProfessionalService.java:231-239`), Wednesdays gone, end date extended; step 4 removes only that Friday (myPP + api-pp); step 5 removes all; step 6 creates a one-off visible in myPP and api-pp.
> Oracle: ids and dates from the captured JSON + `calendar/roster`; api-pp per step.
> Evidence: JSON per step, 02-edit.png, 04-delete-iteration.png, 06-one-off.png.
> Source: 11741921430#9–#12, 12481757204#3, #4, #8; MYPP-AVAIL-02.

### BKG-07 Started series is split on edit; past one-offs are immutable (two-day scenario)

> Data prerequisite: `{{HPA}}` free from TODAY to TODAY + 21 d except fixtures of BKG-01..04 (pick days not used there).
> Pre: series flag on. Part 1 on day R, part 2 on day R+1 (same worker brief, two sessions).
> Steps: Part 1 (day R): 1. Series "Wiederholend", Von TODAY, Bis TODAY + 21 d, Wochentage alle, Spätdienst; note id. 2. One-off for TODAY (Nachtdienst). Part 2 (day R+1): 3. Edit the series from a day ≥ TODAY (now R+1): change Dienstgruppe to Frühdienst; capture PUT. 4. Read series list / day views for R (yesterday) and R+1. 5. Try to edit and to delete yesterday's one-off (API `PUT/DELETE …/availabilities/{id}` with the captured bearer if the UI hides it).
> Expect: step 3 truncates the old series to end R (yesterday) and creates a new series from R+1 with Frühdienst (two ids, `AvailabilityHealthProfessionalService.java:217-230`); yesterday keeps Spätdienst and offers no edit/delete; step 5 → 4xx invalid/past date (`checkAvailabilityDateIsValid`, iteration delete `:263-266`).
> Oracle: PUT response, two series ids with the expected start/end; status codes of step 5.
> Evidence: part1/_.json, part2/_.json, 04-yesterday.png.
> Source: 12481757204#7, #9; MYPP-AVAIL-02.

### BKG-08 All-pools vs single-pool availability after the HP joins a new pool

> Data prerequisite: P3 pools `E2E-BKG-A` (with `{{HPC}}`) and `E2E-BKG-B` (without `{{HPC}}`); `{{PM}}` holds ROLE_POOL_MANAGER (kit group `E2E:PM-ALL`, gate BKG-G1); days `{{HPC_FREE1}}`, `{{HPC_FREE2}}`.
> Pre: owns pool `E2E-BKG-B` membership changes.
> Steps: 1. myPP `{{HPC}}`: one-off on `{{HPC_FREE1}}` with "Alle Pools ausgewählt"; one-off on `{{HPC_FREE2}}` with only `E2E-BKG-A`. 2. Planner as `{{PM}}` → `/pool-manager/manage-pools/hp` (or edit pool `E2E-BKG-B`) → add `{{HPC}}` to `E2E-BKG-B`; capture the save call. 3. Planner as `{{SP}}` → Find HP on each day with Pools = `E2E-BKG-B` only, then `E2E-BKG-A` only. 4. myPP `{{HPC}}`: NC contains a "added to pool" row (N-20, owned by pool-sp area — record only). 5. Delete the all-pools availability; repeat step 3 for day 1; api-pp for day 1.
> Expect: day 1 (all pools): HP listed for B and A; day 2 (single pool): listed for A only, not for B; after delete not listed and api-pp empty for day 1.
> Oracle: `consumable-pools/availabilities` responses per pool filter (`AvailabilityShiftPlannerService.java:368-380`).
> Evidence: find-hp-<day>-<pool>.json, 02-pool-save.json, nc-hpc.json.
> Source: 11741921430#22, #23; MYPP-AVAIL-01, POMA-POOL-04.

### BKG-09 Availability form validation and the no-pool HP

> Data prerequisite: `{{HPN}}` = a seeded login that is in **no** pool (P3 keeps one aside); `{{HPA}}` in a pool.
> Steps: 1. myPP `{{HPA}}`: open the form, untick every Dienstgruppe → send → alert "Verfügbarkeitsfehler" / "At least one shift group" text (`ERROR.AVAILABILITY_NOT_VALID`). 2. Tick a Dienstgruppe, untick all pools and "Alle Pools" → alert `AVAILABILITY_SELECT_POOL_ERROR`. 3. Wiederholend without weekday (Wöchentlich) → alert `AVAILABILITY_SELECT_WEEK_DAY_ERROR`. 4. Past date via API: `POST …/v1/availabilities` with yesterday → 4xx. 5. myPP `{{HPN}}`: open the calendar FAB.
> Expect: alerts 1–3, no POST sent; 4 → 4xx (invalid date); 5 → no "Verfügbarkeit erfassen" entry in the FAB (`actions-floating-button.component.ts:65-80`); deep link `…/calendar/add-availability` shows "Sie sind noch keinem Pool zugewiesen" (`NO_POOLS_AVAILABLE`) and no pools.
> Oracle: absence of a POST in `api-index.jsonl` for 1–3; status of 4; screenshot texts.
> Evidence: 01..05 screenshots, api-index.jsonl.
> Source: gap G-AV-1 (MYPP-AVAIL-01 error codes).

### BKG-10 Tenant without availability series (default configuration)

> Data prerequisite: `{{HPA}}` with a free day `{{HPA_FREE3}}`. Exclusive phase: flips `poma.flows.availabilitySeries` to false, restores true afterwards.
> Pre: window W-X-SERIES-OFF `active`; the worker sets the flag false (`portal-ops.mjs … flag set`) and waits for propagation (`waitFlag`, ≈ 5 min).
> Steps: 1. myPP `{{HPA}}` (re-login) → "Verfügbarkeit erfassen": the "Häufigkeit" radio and the series fields are absent; only "Datum". 2. Create a one-off on `{{HPA_FREE3}}`. 3. API: `POST …/v1/availabilities-series?force=false` with a minimal weekly body (captured from BKG-04) using the bearer.
> Expect: 1 no series UI; 2 → 2xx; 3 → refused by `@EnabledByFeature` (4xx `DisabledFeatureException` — record status and body).
> Oracle: DOM check + statuses.
> Evidence: 01-form-no-series.png, 02-post.json, 03-series-refused.json.
> Source: 11741921430#18; MYPP-AVAIL-02 (`AvailabilitiesController.java:108-112`).

## Family FH — Find HP and manage shift bookings (planner web app, SP)

### BKG-11 Find HP: entry, mandatory filters, pool filter, blocked toggle, horizon

> Data prerequisite: BKG-01 availability of `{{HPA}}` on `{{HPA_FREE1}}` (read-only use) and `{{HPD}}` availabilities on `{{HPD_FREE1}}` (created in step 0); P3 pools.
> Steps: 0. myPP `{{HPD}}`: one-off on `{{HPD_FREE1}}` (Tagdienst, `E2E-BKG-A`). 1. Planner `{{SP}}` → `/shift-planner/dashboard` → `#find-hp-btn` "Mitarbeitende finden" → `/shift-planner/health-professionals`. 2. With only Datum set: no results, hint "Bitte ergänzen Sie die Pflichtfelder Datum, Planblatt und Dienst". 3. Set Planblatt and Dienst → list with "Buchen" per row; capture `consumable-pools/availabilities`. 4. Pools = `E2E-BKG-A` → `{{HPD}}` still listed; Pools = `E2E-BKG-B` → `{{HPD}}` not listed. 5. Toggle "blockierte Mitarbeitende" on → blocked HPs (e.g. `{{HPA}}` on a day with a planned shift) appear with the blocked reason ("Mitarbeitende hat eine geplante Schicht …"). 6. Datum picker: days after today + 3 months are not selectable. 7. "Filter löschen" (`#search-clear-filters`) resets.
> Expect: as listed.
> Oracle: request parameters and response of `consumable-pools/availabilities` per filter state; DOM for 2, 5, 6.
> Evidence: 01..07 screenshots, JSON per filter state.
> Source: 11741921430#13, #14, 11474174016#2; POMA-FINDHP-01.

### BKG-12 Book via Find HP (cloud-write mode): absence day, free day, day from a series

> Data prerequisite: P5 `{{HPD_ABS}}`, `{{HPD_FREE2}}`, a weekly series of `{{HPD}}` covering `{{HPD_FREE3}}` (created in step 0); `{{HPD}}` employee id (`{{HPD_MA}}`).
> Pre: `writeShiftsOnPrem` = true.
> Steps: 0. myPP `{{HPD}}`: one-offs on `{{HPD_ABS}}` and `{{HPD_FREE2}}`; series (2 weeks, all weekdays) covering `{{HPD_FREE3}}`. 1. Planner `{{SP}}` → Find HP for `{{HPD_ABS}}` → "Buchen" on `{{HPD}}` → dialog "Einsatz buchen": Dienst, Tageszeit (position), Pool, Zielkategorie, Kommentar → "Bestätigen"; capture `POST /api/private/availability-roster/assignment` (write mode) and the booking-resume page "Person in PEP eingetragen und benachrichtigt". 2. Same for `{{HPD_FREE2}}` and for `{{HPD_FREE3}}` (series day); set `{{HPD_BOOKED}}` = `{{HPD_FREE2}}` for BKG-03. 3. DB oracle `plan-day.sh <env> {{HPD_MA}} <day>` for each day. 4. Find HP again for `{{HPD_FREE3}}` → `{{HPD}}` not offered any more. 5. myPP `{{HPD}}`: NC rows; open the NC item of one booking → lands on `…/calendar/booking-details/<assignment id>`. 6. `GET /api/private/assignments?…` (Manage shift bookings) shows 3 CONFIRMED rows.
> Expect: each booking 2xx with state SUCCESS (or CONFLICT handled with "Trotzdem Buchen?" — note which); PLANUNG row with the chosen Dienst PA on each day (absence day: the absence row stays or is replaced — record PEP's behaviour); 3 NC rows type `BOOKING`, target `ASSIGNMENT_DETAIL`, object*id = assignment ids; series day consumed; partner events `v1/AssignmentBookingConfirmation` ×3 (read in BKG-27).
> Oracle: assignment ids/status; DB PLANUNG rows; NC JSON.
> Evidence: 01-dialog.png, 01-resume.png, assignment-*.json, oracle-pl-\_.txt, nc-hpd.json, 05-booking-details.png.
> Source: 11741921430#3, #4, 12481757204#5, 12008062977#13; POMA-FINDHP-03, N-01.

### BKG-13 Manage shift bookings list: menu entry, filters, sort, cancelled toggle, paging

> Data prerequisite: ≥ 11 bookings in the tenant for paging (BKG-12, BKG-17, BKG-21 … plus P6 extra bookings of `{{HPD}}`/`{{HPE}}` if fewer); read-only.
> Steps: 1. Planner `{{SP}}` → side menu "Geplante Dienste verwalten" → `/shift-planner/manage-shift-bookings/internal-pool` (dashboard has no such button). 2. Filter `#manage-bookings-date-filter` = `{{HPD_ABS}}` → only that day; add `#manage-bookings-pool-filter`, `#manage-bookings-shift-type-filter`; "Filter löschen" (`#shift-booking-clear-filter`) resets. 3. `#manage-bookings-sort-by`: "Shift creation", "Date ascending", "Date descending"; default order = booking time descending. 4. Tick "Show cancelled bookings" → cancelled rows appear (after BKG-14). 5. Page size 10 → page 2; change page size.
> Expect: each filter/sort/page sends `GET /api/private/assignments` with the matching params (`date`, `pool`, `shift-type`, `status`, sort, `current-page`, `page-size`) and the table matches the response.
> Oracle: captured request params vs table rows.
> Evidence: screenshot + JSON per state.
> Source: 11741921430#15, #16; POMA-BOOK-01.

### BKG-14 Cancel a booking: availability restored, PEP shift removed, re-book possible

> Data prerequisite: BKG-12 booking of `{{HPD}}` on `{{HPD_ABS}}` (or a fresh one on `{{HPD_FREE4}}` booked in step 0).
> Pre: `writeShiftsOnPrem` = true.
> Steps: 1. Manage shift bookings → row of `{{HPD}}` / `{{HPD_FREE4}}` → cancel → confirm; capture `PUT /api/private/assignments/{id}/cancel`. 2. DB oracle for the day. 3. myPP `{{HPD}}`: day view of the day; NC. 4. Find HP for the day → `{{HPD}}` offered again → "Buchen" again. 5. DB oracle again.
> Expect: status CANCELLED; PLANUNG row of the booked Dienst gone (`AssignmentService.java:515-562`); availability back in myPP without user action; NC `BOOKING` cancellation row (N-03); second booking SUCCESS and a new PLANUNG row.
> Oracle: assignment status; DB rows before/after; NC; partner `v1/AssignmentBookingCancellation` (BKG-27).
> Evidence: cancel.json, oracle-pl-before/after/rebook.txt, day-view.json, nc-hpd.json.
> Source: 11741921430#17, 12008062977#14; POMA-BOOK-02, N-03.

### BKG-15 Booking API validations: presence day, beyond 3 months, past

> Data prerequisite: `{{HPD_PRES}}`; `{{HPD}}` availability far ahead (create a one-off at today + 100 d in step 0; one-off creation allows it because conflicts beyond the horizon are not checked).
> Steps: 1. As `{{SP}}` with the captured bearer: `POST /api/private/assignments` (classic body captured from the UI in BKG-25 or built from the schema) for `{{HPD_PRES}}`. 2. Same for today + 100 d. 3. Same for yesterday. 4. UI: Find HP date picker refuses today + 100 d (see BKG-11 step 6).
> Expect: 1 → `ASSIGNMENT_VALIDATION_PLANNED_PRESENCE` (`AssignmentService.java:877`); 2 → `ASSIGNMENT_VALIDATION_DATE_TOO_FAR` (`:844`); 3 → `ASSIGNMENT_VALIDATION_DATE_VIOLATION` ("No bookings in the past").
> Oracle: status + `errorCode` per call.
> Evidence: assignment-presence.json, assignment-too-far.json, assignment-past.json.
> Source: gap G-FH-2 (POMA-FINDHP-02).

## Family BD — BADI (planner web app route `/badi`, SP)

### BKG-16 BADI view: load, header, refresh, filters, categories

> Data prerequisite: P3 pool `E2E-BKG-A` with ≥ 3 HPs holding availabilities in the displayed 14 days (`{{HPE}}`, `{{HPF}}` create them in step 0, Früh and Nacht); `{{GROUP_NODE}}` = Gruppe node id of `{{HPE}}` (data-plan §2).
> Steps: 0. myPP `{{HPE}}`: one-offs Frühdienst on `{{HPE_FREE1}}`; `{{HPF}}`: Nachtdienst on `{{HPF_FREE1}}`. 1. Planner `{{SP}}` → `{{POMA}}/badi?group-node-id={{GROUP_NODE}}&range-start=<Monday of HPE_FREE1>&cell-width=60&number-of-cells-displayed=14&employee-column-width=220`; capture `GET /api/private/tenant/consumable-pools` and `GET /api/private/availability-roster/<poolId>?from&to`. 2. Header "Verfügbarkeiten", "aktualisiert HH:MM"; wait 1 min, refresh button → time changes, roster re-fetched. 3. Diensttyp filter: options Frühdienst, Tagesdienst, Spätdienst, Nachtdienst (+ "Alle"), toggle "nur verfügbare Mitarbeitende" on by default; select Frühdienst → only Früh icons coloured, `{{HPF}}` row still shown. 4. Toggle "nur verfügbare Mitarbeitende" off → HPs without availability appear. 5. Personalkategorie: lists only categories valid in the range; select `{{HPE}}`'s → only matching rows. 6. Name search with `{{HPE}}`'s last name.
> Expect: as listed; no external-pools toggle (flag off).
> Oracle: roster JSON vs rendered rows/cells; category options vs `GET /api/private/organization/roster-categories` (or the roster response) validity dates.
> Evidence: 01-load.png, 02-refresh.png, 03..06 screenshots, JSON.
> Source: 12347080711#2–#6, 12344229921#29, #36; POMA-BADI-01/02.

### BKG-17 BADI books two HPs

> Data prerequisite: BKG-16 availabilities of `{{HPE}}` and `{{HPF}}`; employee ids `{{HPE_MA}}`, `{{HPF_MA}}`. Optional multi-employment HP `{{HPM}}` (data-plan P7) for the "Anstellung" check.
> Pre: on-prem writes (BADI always writes).
> Steps: 1. BADI as in BKG-16 → click `{{HPE}}`'s and `{{HPF}}`'s availability cells → "Weiter". 2. First HP form: Station/Planblatt, Dienst (list = plannable Dienste of the Planblatt only; no non-plannable PA codes), Tageszeit, Zielkategorie, Anstellung (if offered), "Text für Mitarbeitende" → "Buchen"; capture `POST /api/private/availability-roster/assignment` (+ `…/assignment/{id}` if CONFLICT). 3. Second HP → "Buchen". 4. Final state "Auswahl verarbeitet" / "Vorgenommene Buchungen wurden geplant …". 5. DB oracle both days. 6. myPP NC of both HPs. 7. (Optional `{{HPM}}`) the Anstellung select is empty by default and must be chosen.
> Expect: both responses state SUCCESS (or CONFLICT → "Möchten Sie den Dienst trotzdem buchen?" → apply → SUCCESS); PLANUNG rows with the chosen Dienst; NC `BOOKING` rows; cells become booked/unavailable after reload.
> Oracle: responses; DB; NC.
> Evidence: 01-selection.png, 02-form.png, 04-finished.png, assignment-_.json, oracle-pl-_.txt, nc-\*.json.
> Source: 12347080711#7, 12344229921#18, #25, #33; POMA-BADI-03, N-01.

### BKG-18 BADI conflict booking and the started-shift confirmation

> Data prerequisite: P5 `{{HPE}}` has a Nacht planning on `{{HPE_CONF}}`−1 (rule-conflict hint for the next day) and an availability on `{{HPE_CONF}}`; TODAY availability of `{{HPF}}` for a Dienst that already started (step 0 creates it in the morning, e.g. Frühdienst, run after its start time).
> Steps: 1. BADI: book `{{HPE}}` on `{{HPE_CONF}}`. 2. If the response is CONFLICT: the UI shows the conflicts and "Möchten Sie den Dienst trotzdem buchen?" → confirm; capture the apply call. 3. BADI: book `{{HPF}}` TODAY with the started Dienst → dialog (`BADI.BOOKING_FLOW.SHIFT_ALREADY_STARTED_DIALOG`) → confirm; capture the retry with `ignore_started_shift=true`. 4. DB oracle for both.
> Expect: step 1 CONFLICT then SUCCESS after apply (UI not stuck, PPCLOUD-10835); step 3 first response 4xx `ASSIGNMENT_VALIDATION_SHIFT_ALREADY_STARTED`, retry SUCCESS; PLANUNG rows exist. If no conflict arises in step 1, record it and mark the conflict half BLOCKED (data) rather than FAIL.
> Oracle: response states and error codes; DB.
> Evidence: 02-conflicts.png, 03-started-dialog.png, JSON, oracle-pl-\*.txt.
> Source: 12344229921#4, #26; POMA-BADI-03 (PPCLOUD-12404).

### BKG-19 BADI selection rules, delete dialogs and range reload

> Data prerequisite: ≥ 11 availability cells in the view (P6 adds them for `{{HPE}}`/`{{HPF}}` and pool members); `{{HPE}}` member of two pools with an all-pools availability on one day (makes the same HP/day appear twice).
> Steps: 1. Select `{{HPE}}`'s cell in pool A, then the same day in pool B → second selection refused / cell blocked. 2. Select cells until 10 → further cells blocked, message "Sie können maximal 10 Buchungen zugleich vornehmen". 3. "Weiter", then "Löschen" on a not-yet-booked item → dialog uses the NOT_BOOKED wording (no "delete booking" text); remove all → BADI back to normal state without booking confirmation. 4. Change `range-start` in the URL (+7 d) → roster re-fetched for the new range, list of available HPs updated.
> Expect: as listed.
> Oracle: DOM state + captured roster requests (`from`/`to`) after the URL change; no `POST …/assignment` sent in 1–3.
> Evidence: screenshots per step, api-index.jsonl.
> Source: 12344229921#5, #11, #13, #15; POMA-BADI-02/03.

### BKG-20 BADI cancel of a booked item removes the PEP shift

> Data prerequisite: availability of `{{HPF}}` on `{{HPF_FREE2}}`; `{{HPF_MA}}`.
> Pre: `writeShiftsOnPrem` = true (BKG-25 checks the off case).
> Steps: 1. BADI: book `{{HPF}}` on `{{HPF_FREE2}}` (SUCCESS). 2. In the same booking list press "Löschen" on that booked item → BOOKED dialog → accept; capture `PUT /api/private/assignments/{id}/cancel`. 3. DB oracle. 4. myPP `{{HPF}}`: availability back; NC cancellation row.
> Expect: cancel 2xx; PLANUNG row of that Dienst gone (PPCLOUD-11044 / 12473); availability restored; NC `BOOKING` cancellation.
> Oracle: DB before/after; day view; NC.
> Evidence: JSON, oracle-pl-before/after.txt, nc-hpf.json.
> Source: 12344229921#17, #38; POMA-BADI-04, N-03.

## Family RR — resource replacement (planner web app; PEP stand-in by API)

### BKG-21 Resource replacement end to end (cloud-write mode)

> Data prerequisite: P5 `{{ER}}` has a presence planning on `{{RR_DAY}}` (future, inside the roster window or painted); candidates `{{HPG}}`, `{{HPH}}` free on `{{RR_DAY}}`; employee/employment/node ids from the DB (data-plan §2); a plannable absence Dienst id `{{ABS_DEF}}` on `{{ER}}`'s Planblatt.
> Pre: `writeResourceReplacementShiftsToPep` = true; RR created through the public API (PEP stand-in) until a pep-verify flow exists (BKG-32).
> Steps: 1. As `{{SP2}}` (bearer from the planner app): `POST {{API}}/api/v1/resource-replacement` with `shift_request` (start/end UTC of `{{ER}}`'s shift, shift*type, employee_id, employment_id, node_id), `pep_service` (PA code, position, title, icon), `pep_roster` (Planblatt id/name/path), `pep_pool` = [`{{HPG}}`, `{{HPH}}`] (template: `useful-stuff/bruno/poma/flows/resource-replacement-flow/resource-replacement/create resource replacement.bru`); response `url` = `{{POMA}}?opportunity=<id>`. 2. Open the URL → RR page (state PENDING): two candidates listed (conflict info), `#absence-type-field` "Absenzgrund" offers only plannable absences → choose `{{ABS_DEF}}`; message in `#comment-text-area-field` → publish; capture `PUT …/resource-replacement/{rrId}/absence-shifts/{id}` and `POST /api/private/opportunities/{id}/active-participants`. 3. Side menu "Anfragen verwalten" → status "Aktiv" lists it. 4. myPP `{{HPG}}`: NC row (N-08) → tap → `…/calendar/opportunity-details/<id>` → "Zusagen" ▸ "Ja, aber" + comment; myPP `{{HPH}}`: "Zusagen". 5. SP NC (`{{SP2}}` via myPP): N-10 rows. 6. Planner details: answers "Ja, aber" and "Zugesagt"; "Erinnerung senden" disabled (< 15 min). 7. "Bestätigen" on `{{HPG}}` → dialog "Ressourcenersatz … wird von <name> übernommen" (conflicts → "Trotzdem abschliessen?") → "Abschliessen"; capture `POST /api/private/opportunities/{id}/final-selection` and `POST /api/private/resource-replacement/shift-plannings?opportunity-id=` (+ `apply-contexts/{ctx}`). 8. DB oracle `{{ER}}` and `{{HPG}}` on `{{RR_DAY}}`. 9. "Anfragen verwalten": default "Aktiv" no longer lists it; status "Bestätigt" does. 10. myPP: `{{HPG}}` NC selection (N-11); `{{HPH}}` NC rejection (N-12) and its detail shows the finished state ("Bestätigt"/no answer buttons).
> Expect: as listed; `{{ER}}`'s PLANUNG row becomes the absence PA `{{ABS_DEF}}`; `{{HPG}}` gets the RR Dienst; opportunity state FINALIZED.
> Oracle: opportunity JSON states; DB rows; NC rows per the oracle table.
> Evidence: rr-create.json, 02-publish.png, active-participants.json, applications-summary.json, final-selection.json, shift-plannings.json, oracle-pl-*.txt, nc-\_.json, 10-hph-detail.png.
> Source: 11465293970#0–#8, 10046210711#3–#5, #9–#12, 12008062977#1–#5; POMA-OPP-02..05, MYPP-OPP-01, N-08, N-10, N-11, N-12.

### BKG-22 RR reminders and cancellation

> Data prerequisite: second RR for `{{ER}}` on `{{RR_DAY2}}` with candidates `{{HPG}}`, `{{HPH}}` (same creation recipe as BKG-21).
> Steps: 1. Create + publish to both. 2. Immediately: "Erinnerung senden" disabled ("Eine Benachrichtigung wurde kürzlich versendet…"); `GET …/reminders/available-trigger` says not available. 3. `{{HPG}}` answers "Zusagen"; wait ≥ 15 min (worker sleeps via the harness wait loop). 4. "Erinnerung senden" → `POST …/reminders`; "reminder sent" dialog. 5. NC: `{{HPH}}` (no answer) has a reminder row (N-14), `{{HPG}}` has none. 6. Planner: "Anfrage annullieren" → confirm; capture `DELETE /api/private/opportunities/{id}`. 7. NC: `{{HPG}}` cancellation row (N-13); myPP detail shows "Abgesagt", no answer buttons.
> Expect: as listed; state CANCELLED; no `PL|` change for `{{HPG}}`.
> Oracle: reminder trigger JSON, opportunity state, NC rows.
> Evidence: JSON per step, screenshots 02, 04, 07.
> Source: 12008062977#6; gap G-RR-1 (POMA-OPP-04, N-13, N-14).

## Family IP — internal pool opportunity

### BKG-23 Internal pool opportunity end to end (cloud-write mode)

> Data prerequisite: P3 pool `E2E-BKG-IPO` = `{{HPG}}`, `{{HPH}}`; `{{IPO_DAY}}` free for both (≠ `{{RR_DAY}}`); P4 the target Planblatt's day Dienste flagged "für interne Pool-Anfragen verfügbar" in PEP; `{{ROSTER}}` = Planblatt id.
> Pre: `writeShiftsOnPrem` = true (the v2 API requires it).
> Steps: 1. As `{{SP2}}`: `POST {{API}}/api/v2/internal-pool-opportunity {"date":"{{IPO_DAY}}","roster_id":"{{ROSTER}}"}` (PEP "Neue Anfrage" stand-in) → `url`. 2. Open it → "Interne Pool-Anfrage": Datum preset, Dienst list = only internal-pool Dienste (compare with `GET /api/private/shift-definition/roster?…available-for-internal-pool=true`), Pools `E2E-BKG-IPO` → "Weiter"; capture `PUT /api/private/internal-pool-opportunity?opportunity-id=`. 3. "Mögliche Mitarbeitende": both HPs; a never-logged-in member shows the icon with tooltip "Benutzer hat sich nie angemeldet" (if P3 added one); comment → publish; confirmation. 4. myPP `{{HPG}}` "Zusagen", `{{HPH}}` "Ja, aber". 5. Planner details → "Bestätigen" on `{{HPG}}` → dialog "Einsatz buchen": Datum Einsatz, Dienst, Zielkategorie (+ Anstellung) → OK; conflicts → "Trotzdem Buchen?"; capture `POST /api/private/internal-pool-opportunity/shift-plannings?opportunity-id=`. 6. DB oracle `{{HPG}}` on `{{IPO_DAY}}`. 7. NC: invites (N-07), SP responses (N-10), selection (N-11), rejection for `{{HPH}}` (N-12).
> Expect: state FINALIZED; PLANUNG row for `{{HPG}}` with the chosen Dienst; NC rows as the oracle table.
> Oracle: opportunity JSON, DB, NC.
> Evidence: ipo-create.json, 02-pending.png, enrich.json, 03-candidates.png, shift-plannings.json, oracle-pl-hpg.txt, nc-\*.json.
> Source: 11466702849#0–#5, 12008062977#7–#11; POMA-OPP-06..08, N-07, N-10..N-12.

### BKG-24 IPO: cancel a draft, cancel a published request, whole-day fallback

> Data prerequisite: as BKG-23 with `{{IPO_DAY2}}`.
> Steps: 1. Create a minimal IPO (API) → open → "Abbrechen" in DRAFT → `DELETE /api/private/opportunities/{id}`; it never appears as "Aktiv". 2. Create, enrich with a Dienst whose shift request has no block times, publish to both HPs; read the opportunity JSON: shift request spans the whole day with the next-day end flag honoured (PPCLOUD-14529). 3. `{{HPG}}` "Zusagen". 4. Planner "Anfrage annullieren" → NC cancellation row for `{{HPG}}` (N-13).
> Expect: as listed; no NC rows for the draft; state CANCELLED for 2.
> Oracle: opportunity states, shift request times, NC.
> Evidence: JSON per step.
> Source: 12008062977#12; gap G-IP-1 (POMA-OPP-06/07, PPCLOUD-14529).

## Family X — exclusive configuration and on-prem side effects

### BKG-25 PEP-pull mode: classic booking and final selection handed to PEP

> Data prerequisite (part 1, before the window, while the write flags are still ON): `{{HPD}}` availability on `{{HPD_FREE5}}`; `{{HPF}}` availability on `{{HPF_FREE4}}` (step 7); a published RR for `{{ER}}` on `{{RR_DAY3}}` (recipe BKG-21) and a published IPO on `{{IPO_DAY3}}` (recipe BKG-23; v1 creation is not available to agents) with positive applicants `{{HPG}}` / `{{HPH}}`. Part 2 runs in window W-X-WRITE-OFF state 2 (after swap SWP-14): sets `writeShiftsOnPrem` = false (already false after the swap hand-over), `writeResourceReplacementShiftsToPep` = false, `simulatePEP` = true; restores all three.
> Pre: the worker flips the flags inside the active window (`portal-ops.mjs … flag set`), waits for propagation; the planner harness runs with `--console info` (bridge lines).
> Steps: 1. Find HP for `{{HPD_FREE5}}` → "Buchen" → classic dialog (pool + comment) → `POST /api/private/assignments`; booking lands in Manage shift bookings with the "sync" column visible. 2. DB oracle: no PLANUNG row written by the cloud. 3. RR details → "Bestätigen" on a positive applicant: no cloud dialog; `final-selection` 2xx; console shows `triggerFinalSelection(<opp>, <emp>) called on simulatePEP rich client`. 4. Same on the IPO. 5. RR publish page of a new RR: no "Absenzgrund" field. 6. Cancel the classic booking → availability restored, no PEP delete call. 7. BADI (BKG-20 recipe) with `writeShiftsOnPrem` off: book + cancel → record whether the PLANUNG row stays (expected per code: it stays — open question Q3).
> Expect: as listed.
> Oracle: assignment `sync_pep` false / sync column; console lines; DB rows; absence of `shift-plannings` calls.
> Evidence: JSON, console.log, oracle-pl-\*.txt, screenshots.
> Source: 11465293970#6 (PEP variant), 11466702849#4 (PEP variant), 12344229921#38; POMA-FINDHP-02, POMA-BOOK-03, gap G-X-1.

### BKG-26 PEP planning on an availability day cancels the availability (AVAILABILITY_DELETED)

> Data prerequisite: `{{HPF}}` availability on `{{HPF_FREE3}}`; `{{HPF_MA}}`; the paint path: `pp-plan.sh` (api-pp `direct-shift-planning`), PEP UI only as fallback under the db lock `locks/<env>~pep`.
> Steps: 1. The worker paints a presence Dienst for `{{HPF}}` on `{{HPF_FREE3}}` (`pp-plan.sh <env> {{HPF_MA}} {{HPF_FREE3}} <day Dienst> FULL`; fallback `pe-paint.sh` under the PEP lock). 2. Wait ≤ 5 min; myPP `{{HPF}}` day view + NC. 3. If nothing changed: inside the job window J-X-JOBS run `portal-ops.mjs … job run poma-core AvailabilityConflictChecker --tenant <env-id>` (portal ops → Monitor → Job Management; refused without `tenantIds`) and re-read. 4. Remove the painted planning (`pp-plan.sh … DELETE`).
> Expect: availability removed for that day; NC row type `AVAILABILITY` (N-04, via inbound event `AvailabilityAssignmentStatus`) or, after the job, removal with a DELETED event (POMA-JOB-01); partner `v1/AvailabilityDeleted` (BKG-27). Record which path fired.
> Oracle: day view before/after; NC; job run response.
> Evidence: day-view-before/after.json, nc-hpf.json, job.json, pe-paint output.
> Source: gap G-AV-2 (POMA-EVENT-06a, N-04, POMA-JOB-01).

### BKG-33 Overlapping series: booking and cancel restore exactly one availability

> Data prerequisite: `{{HPB}}` free weeks after BKG-06.
> Pre: series flag on.
> Steps: 1. Series S1 Mo–Fr Tagdienst 2 weeks; series S2 Mo–Fr Spätdienst same 2 weeks (different Dienstgruppe; if the backend refuses overlap, record `AVAILABILITY_VALIDATION_ERROR_ALREADY_EXISTS` and stop = PASS of the guard). 2. Delete Wednesday of S1 (iteration). 3. Find HP (Spätdienst Dienst) Wednesday → book `{{HPB}}`. 4. myPP Wednesday: no availability left that day. 5. Cancel the booking. 6. myPP Wednesday.
> Expect: after 5 exactly one availability (S2, Spätdienst) is back on Wednesday; S1's deleted iteration stays deleted.
> Oracle: day-view JSON before/after; assignment status.
> Evidence: JSON per step.
> Source: 12481757204#6 (2024 bug).

## Family NT — notification channels

### BKG-27 Partner event channel for every booking / RR / IPO event

> Data prerequisite: the steward's run partner `{{PARTNER_NAME}}` (id `{{PARTNER_ID}}`, S-CT-REG) with tenant access to DM-X and Debug logging ON; subscriptions as created by the steward. **Read only**: never save, edit or toggle the partner (a save switches logging off and deletes every logged event). The area's own partner `e2e-bkg-<run>` is dropped (S1).
> Pre: runs after BKG-12, 14, 17, 20, 21, 22, 23, 24, 26 (reads their ids from the results folder).
> Steps: 1. `portal-ops.mjs … partner logs {{PARTNER_ID}}` (= `GET …/integration-partners/{id}/logs?start=<run start>`, page through `after`); one screenshot of the Debug tab. 2. For each expected event (oracle table) find the CloudEvent by `type` and the opportunity / assignment / availability id in `data`.
> Expect: one event per expected notification and recipient; `type` = `v1/<Subclass>`; tenant = env id; involved user = the recipient's subject. `v1/AvailabilityDeleted` is expected to be missing (SD-30 → KNOWN-FAIL SD-30 if so).
> Oracle: matching table (expected vs found) in `partner-match.json`.
> Evidence: partner-log.json (all pages), partner-match.json, 01-debug-tab.png.
> Source: 11741921430#0, 11465293970#0, 11466702849#0, 12008062977 Partner column, 12007276651 (2023 ⚠ "not to subscription"); POMA-EVENT-07, PORT-PART-02.

### BKG-28 Notification centre content and tap routing per event

> Data prerequisite: the NC rows produced by BKG-12, 14, 21, 22, 23, 24, 26 (read-only; filter by object ids).
> Steps: 1. myPP as each recipient → `/flows/profile/notification-center` (header bell); capture `GET …/notifications` and `…/all-unread`. 2. Check type filter chips (Buchung, Ressourcenersatz, interne Pool-Anfrage, Verfügbarkeit). 3. Tap one row per event kind → route reached: booking → `…/calendar/booking-details/<id>`; invite / reminder / selection → `…/calendar/opportunity-details/<id>`; rejection / cancellation / availability → notification centre (stays). 4. Mark all read → unread counter 0.
> Expect: every expected row present with German title (`translated_title.de` non-empty, no raw keys); routes as listed (`MYPP/shared/services/navigation/navigation.service.ts:75-86`).
> Oracle: NC JSON vs expected table; final URL per tap.
> Evidence: nc-<user>.json, one screenshot per tapped route.
> Source: 11741921430#0, 11465293970#3, 11466702849#3; MYPP-NOTIF-01, MYPP-NOTIF-04.
