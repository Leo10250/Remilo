# R10 — Data/Help: Export, Restore and Diagnostics

Revision 1 · 8 October 2026 · **Proposed layouts and image brief; not yet accepted.**

[A32 intake](r10-data-help-intake.json) records the owner's continuation on
Data/Help and repeated requirement to use all R3 images for color/style while
retaining established UX. [Fourteen prospective captures](r10-data-help-fixtures.json)
make the workflow and exceptional states reviewable. This refinement generates
no new images and implements no app/native behavior. It is a review batch within
the existing shared foundations, appearance, navigation and acceptance plans,
not an additional implementation milestone. Task status stays in
[backlog](../backlog.md).

## Authority and all eight visual references

Use [the canonical corrections](approved-ui-r3-r4.md), accepted R4–R8 shared
component language, [product](../product.md) and [architecture](../architecture.md).
R9 remains a separate proposed family. Every R3 Light/Dark image was inspected;
the global scene identity and independent brightness carry across these utility
workflows, including app-owned reading, loading, error and feedback surfaces.

| Atmosphere | Light reference and shared roles | Dark reference and shared roles |
|---|---|---|
| Sunrise | [01](remilo-r3-atmospheres/01-sunrise-light.png): peach/gold sunrise/lake/conifers; warm off-white canvas, white raised surface, burnt-orange primary/light content. | [02](remilo-r3-atmospheres/02-sunrise-dark.png): same sunrise; soft charcoal canvas/raised charcoal, pale-apricot primary/dark content. |
| Sky | [03](remilo-r3-atmospheres/03-sky-light.png): clear blue clouds/lake/green banks; pale cool-blue canvas/white surface, saturated-blue primary/light content. | [04](remilo-r3-atmospheres/04-sky-dark.png): same **daytime** clouds/lake; blue-slate canvas/raised slate, pale-sky-blue primary/dark content. |
| Evening | [05](remilo-r3-atmospheres/05-evening-light.png): coral/rose sunset, sun/reflection; pale rose/off-white canvas/white surface, muted-plum primary/light content. | [06](remilo-r3-atmospheres/06-evening-dark.png): same sunset; plum-charcoal canvas/raised plum, pale-rose primary/dark content. |
| Night | [07](remilo-r3-atmospheres/07-night-light.png): crescent/stars and moonlit lake; icy-blue canvas/white surface, deep-blue primary/light content. | [08](remilo-r3-atmospheres/08-night-dark.png): same moonlit scene; navy-slate canvas/raised navy, pale-periwinkle primary/dark content. |

Use matching shared canvas **and** elevated roles; no utility-specific black,
glass reading plane, sampled PNG hex or backup-derived scenery. Sky Dark remains
daytime; Night Light retains a Light reading plane. Final art abstraction is still
deferred. Upload/download/info/refresh/Back glyphs and ordinary metadata stay
neutral; actual actions, selected copy switches and focus use primary with its
paired content. Errors/warnings have stable semantic roles and explicit meaning.

## Shared layout, navigation and platform handoffs

- Review one readable screenshot per state at 360 × 800 dp. Use approximately
  96 dp of secondary opening below the status inset, including a 56 dp toolbar
  and shallow scene crop. Keep 16 dp gutters/corners, 16 sp body/14 sp support,
  opaque grouped surfaces, at least 48 dp targets and 56 dp prominent actions.
  Long titles, feedback and labels wrap/grow and scroll; art yields first.
- Settings keeps its accepted category order. Data contains **Export backup** and
  **Restore backup**; Help contains **Diagnostics** and factual app/version copy.
  Export stays inline in Settings. Restore and Diagnostics are secondary pages
  returning to Settings's prior scroll position, then its invoking root. No new
  Data/Help root, Export page, Add FAB, support chat or cloud dashboard.
- Preserve secondary origin context. Current routes use stack Back with an
  Agenda fallback rather than explicit origin parameters; verify Settings return
  and origin preservation during P05 integration instead of claiming that done.
- Restore's action footer is outside the scroll viewport, on the same inset-aware
  usable region. Stack the filled main action and outlined Cancel preview; reserve
  measured clearance and one system-inset owner. Footer labels remain readable
  at 200% text; feedback and final preview rows cannot sit behind it.
- These app forms need no text input/keyboard. Android owns its document chooser
  and share sheet, including provider search/IME and brightness. App scenery and
  tokens do not reskin those OS surfaces. Capture app-owned pre/post-handoff states;
  provider names, share targets or a cancellation result are not guaranteed.

[SDK 57 DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/)
opens the system document UI and supports cache copying for immediate reading.
[SDK 57 Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/)
opens a file-share sheet and returns a void promise. These platform contracts and
the current local implementations constrain the feedback below; no new provider,
storage permission or incoming-share integration is introduced.

## A. Settings Data/Help and Export

Use the accepted Settings composition, scrolled to Data/Help, with a compact
Back + Settings opening. Disclosure rows remain neutral; Export is an action
that opens the platform share workflow, Restore/Diagnostics navigate. Supporting
copy explains that backups include lists and reminders, except one-off Trash;
recurring deletion exclusions are retained. Add concise factual disclosure that
the backup includes titles and notes; it differs from diagnostics' content-free
report. No encrypted-file claim, Last successful backup badge or automatic backup.

The existing single Settings action guard prevents duplicate Export presses and
conflicting test/permission actions. Show **Preparing backup…** beside Data;
do not fabricate a progress percentage or take over the whole page. The native
snapshot is prepared into credential-protected app cache and passed to Sharing.
Do not imply it exports just the currently visible list.

After the share promise resolves, show **Backup prepared for sharing.** This
confirms preparation/handoff only; no Saved/Sent/recipient/destination confirmation.
Android cancellation is not exposed as a useful export outcome by this API.
On share availability/preparation/file-write/share-open error, show contextual
error with an available deliberate **Export backup** action. Another Export makes
a new snapshot/file; do not label it Retry sharing of the same file, since no
captured-file retry controller exists. A prepared file followed by a share error
must not be called successfully saved externally.

No import guard is needed for a read/export handoff. Current Settings has no
export navigation/background lifetime guard and no export-cache cleanup policy.
Implementation must prevent late page updates or a stale share launch after the
origin is gone/backgrounded and scope feedback to its request. Refine file lifetime
without deleting a file while a provider still needs it. These are documented
integration gaps, not implemented cancellation or durable export-resume features.

### Existing portability boundary

Current native export is backup **format 3**, with readers for **1/2/3**. It carries
durable lists including empty lists, series segments/templates/rules/states,
reminder content/timing/mode/sound, retained occurrence history and portable eligible
next-alert targets. One-off Trash is excluded; recurring deletion exclusions remain
portable. Global preferences/atmosphere/brightness, generations, ringing sessions,
OS handles and credentials are not exported. The plain JSON exporter does not
encrypt titles/notes/list names. Do not reuse diagnostics' private-content exclusion
copy for a backup or add a theme/settings restore choice.

Parser/export limits are application bounds: 10 MB UTF-8, 10,000 reminder records,
10,000 series segments, 10,000 lists and 100,000 history entries. They are not
Android alarm-capacity claims. Appearance portability proposals in
[P04C](../plans/redesign/p04-fixed-appearance.md) remain separately scoped/refined;
R10 does not approve format 4 or reintroduce deferred manual reminder themes.

## B. Restore: choose, read and preview

Toolbar **Restore backup**, compact explanation **Preview a backup before
restoring. Existing reminders are preserved; elapsed alarms stay silent.**
Keep the same Trash/backup qualification. Idle offers **Choose backup file**;
there is no Restore footer before a valid preview exists. Reading says **Reading
backup…**, guards duplicate selection/Back and leaves content readable.

File choice/read/validation is distinct from native import. Picker cancellation
preserves any existing preview/copy choices; it performs no import. First-file
read/invalid-format error says **This file could not be read as a valid Remilo
backup. Nothing was imported.** If choosing a replacement fails, preserve the
previous valid preview and label the error as applying to the new selection.
No invalid filename, unsupported version or oversized file becomes an import.
No arbitrary JSON viewer, schema editor or instruction execution from file text.

Current UI retains JSON/preview but not filename/size/export date metadata. The
brief shows no invented file details. Any later metadata header needs safely
captured picker/native fields; paths or an untrusted title are not authoritative.

Preview count means **N reminders or series**: one-off entries plus whole series
families, not lists, segments, history rows, all materialized occurrences or future
alert total. Keep a separate **Lists · N** group and a reminder/series entry group.
Use the native order (one-offs then family entries); no fabricated category badges,
task checkboxes, select-all, overwrite choice or per-occurrence family copy.

### Lists and identity conflicts

List preview is informational and icon-free under A27's provisional list-icon
direction. Matching local identity keeps local metadata/name. Distinct identities
with colliding names receive the native restored suffix and remain distinct lists;
empty lists are included. Show source name and **Name on restore: [restoredName]**
when it differs, otherwise **Keep local list** / **Add list** from the current
preview. These are preview decisions, not already-completed changes. The global
helper explains matching identities and suffixes; no list-name editor/copy switch.
Native import recomputes conflicts against current content, so do not freeze a
preview as proof of the eventual names if local data changes meanwhile.

New reminder/series entries are added automatically. Existing identities are
preserved by default; only conflicts expose **Restore a separate copy** switches.
Give each a readable title and support **Keep existing** when off / **Restore a
copy** when on, with full title/action association for TalkBack. A switch does not
choose overwriting or exclude a new entry. A selected repeating conflict copies
its whole family, retained segments, exceptions and history under new retry-stable
identities. Copying one child occurrence is not a supported preview choice.

Use the existing first-25 reminder/series preview limit and **Show 25 more preview
entries**. List rows currently have no page limit and remain scrollable. Loaded
preview visibility does not constrain what the import applies. Lists-only backups
can have zero reminder/series entries and still restore lists. A valid empty backup
is distinct from malformed data; preserve current supported semantics rather than
declare it invalid from appearance or disable a lists-only restore.

### Timing is informational, not scheduling

The preview's `futureAlert` boolean is weak timing information. One-off preview
can fall back to original defined alert time when no portable next target exists,
whereas import alert eligibility requires a portable target and excludes terminal
records. Family preview checks active future rule slots, omitting retained independent
exception targets. Therefore use **Future time indicated** / **No future time
indicated**, with **Preview timing does not confirm delivery. Alerts are checked
after restore.** Do not claim Scheduled or promise silence from a false family
boolean. Do not draw exact dates/modes or a next target absent from ImportPreview.
This is a proposed truthful label correction, not new scheduling semantics.

## C. Import, uncertainty and outcome

One persistent filled **Restore backup** is the proposed clearer label for the
existing Restore selected data action; **Cancel preview** is outlined below it.
Helper text explains that all new entries/lists are restored and switches only
control separate copies of conflicts. Cancel clears the reviewed preview/copy
selection when idle. Ordinary idle Back may leave; previewing itself writes no
imported content. There is no extra destructive overwrite confirmation.

On deliberate Restore, freeze JSON, selected copy IDs and operation ID. Show
**Restoring…** / **Restoring backup…**, with controls disabled and frozen choices
rendered as readable **Keep existing** / **Restore a copy** rows. Choose another,
Cancel preview, competing actions and ordinary navigation cannot abandon an
applying or unconfirmed import. No synthetic count-up progress or Cancel restore.
Keep applying/unconfirmed feedback immediately above the persistent footer actions,
with measured space outside the preview scroll, so recovery remains visible while
reviewing frozen choices. This is a proposed placement correction to the current
top-of-content feedback; never duplicate the message or cover the final row.

On a lost/unconfirmed reply, show **Restore not confirmed. Retry the same restore;
your backup and copy selection are kept.** The main action is **Retry same restore**,
reusing that exact job. Do not say Nothing was imported or start a different file/
copy job disguised as Retry. Source `RestoreOperation` coalesces rapid presses and
keeps the snapshot through an exception; native receipts fence repeated identities.
This is current mounted-controller behavior, not a demonstrated process-restart
recovery feature. Do not imply an in-memory pending job survives process death.

Confirmed fresh import clears preview/copies and refreshes native queries. Present
actual `added` / `preserved` as **Restored N; preserved M existing reminder or series
entries.** Those counts exclude lists/individual recurrence records. If `blocked`
is nonzero, add **Some alerts could not be scheduled. Review Alert problems in
Agenda.** Use singular/plural entry labels from the actual count. Do not always
attribute Blocked to permissions: native registration
failure can also produce it. Content acknowledgement does not prove every future
alert Scheduled, all pending work complete or audibility. Keep results on the
Restore page with Back/Choose backup file; no automatic root jump or success hero.

A receipt retry returns **Applied + retry**, without added/preserved/blocked totals.
Say **Your previous restore was confirmed.** Do not manufacture zero counts or
reuse speculative preview totals. Refresh current outcomes separately; this branch
does not establish complete series recovery or alarm readiness. Confirmed Blocked
content is distinct from an unconfirmed import; do not keep a retry guard solely
because some delivery is blocked.

Elapsed alerts stay silent; completed/skipped records retain their work state.
Portable future Snooze/Postpone targets stay concrete. Paused ordinary series
remain paused while independent exception targets retain their native eligibility.
Restore preserves conflicting local identities instead of silently replacing them.

**Validation/bridge gap:** `RestoreOperation` releases a frozen job on structured
Rejected results, but real import validation errors currently throw through the
bridge, and all exceptions are conservatively retained as uncertain. Refine a
definitive pre-commit rejection/reconciliation contract before promising editable
preview/new-job recovery from those errors. Never solve this by abandoning an
unknown import, hiding Retry or generating a fresh operation. The static rejected-
map controller test is not proof of actual bridge rejection behavior.

## D. Diagnostics

Toolbar **Diagnostics** with neutral **Refresh report** glyph (replace the current
undo-shaped glyph). Introduction retains **This snapshot helps investigate
delivery. It does not verify that an alarm was heard.** Show **Observed [device-zone
date/time]** from report `observedAtMs`, not time when the page opened. Use an opaque
**Alarm snapshot** group for labeled operational counts, plus **Pending reminder
updates**, informational capabilities and compact technical metadata. Section
placement and exposing already-returned metadata are presentation proposals.

Counts are all retained operational alert rows, including Completed/Deleted/Skipped;
they are not unfinished tasks, families or guaranteed future alarms. Use a stable
known-state order and readable mappings (e.g. Ringing, Alarm stopped,
Alert blocked, Scheduling, Notification sent, No alert); replace the current
permission-only Blocked label because registration failure can also block delivery.
Missing states are
omitted, unknown names remain neutral data. No green health grade, reliability
chart or “Everything works” assurance. A successful `states: {}` report says
**No operational alerts in this snapshot**, not No report available.

`pendingOperations` counts credential-store pending reminder projections only.
The proposed **Pending reminder updates** replaces overly broad Awaiting recovery;
it does not count pending-series jobs, unreplayed history or OS/session work.
Capabilities can show exact-alarm access, app notifications, both channels,
full-screen access and unlock state using labeled values. Keep capability
observation time separate where it differs from outer report time. Required
flags/channels are distinct; full-screen Limited concerns presentation. No live
Settings controls, Check permissions CTA or repair action is invented here.

Technical metadata contains actual **Content schema 4** / **Delivery schema 3**.
It need not dominate the first viewport. This report has no app/build/OS version,
source/APK identity, volume/route or audio observation. Settings's current
**0.4.0 · Android** is static app copy, not diagnostics evidence of a tested build.

Initial Loading/initial error/no report/unsupported Android state are distinct.
Native unavailable shows **Use the Android app to view diagnostics**, without
futile native Retry. Refresh retains the old report and its observed time;
**Refreshing report…** cannot label it freshly checked. Failure says **Could not
refresh. Showing the previous report.** with **Retry** and retained rows. Success
says **Diagnostic report refreshed.** only after native acknowledgement.
Zero counts never repair permissions or prove sound. Background/return and native
invalidations may refresh data as well as the toolbar; treat observation dates as
snapshot facts, not a guaranteed live meter.

### Share diagnostic report

One labeled **Share diagnostic report** action opens the existing text-share flow.
Disclosure: **Delivery permissions, state counts and technical metadata. Reminder
titles and notes are excluded.** The JSON also contains schema/observation metadata
and an opaque active-session identifier; no titles, notes, list names, authored
schedules, credentials, occurrence IDs or raw logs. Do not say Permissions and
counts only, conflate this report with a backup, or add automatic upload/email.

Show **Opening share sheet…** for the captured report; disable duplicate Share.
Refresh may produce a newer visible report, but the shared payload must remain
the captured snapshot and must not be relabeled as the newer one. Feedback says
**Diagnostic report opened in the share sheet**, or **Could not open the share
sheet. Try again.** It does not say Sent. RN 0.86's Android Share contract resolves
with sharedAction; it does not expose the iOS dismissed-action distinction, so do
not generate an Android Sharing cancelled screenshot merely from page return.
[RN 0.86 Share](https://reactnative.dev/docs/0.86/share) supports this boundary.

Current refresh/share lifetimes have no unified request ticket or page-unmount
guard; late results can overwrite newer feedback. Implement stable captured report,
request-specific feedback and safe navigation/background handling, without adding
an import-style uncertainty/discard guard to read-only diagnostics.

## Source gaps and next verification

| Area | Existing behavior / implementation checkpoint |
|---|---|
| Export | Inline guard/cache/share workflow exists; no same-file Retry sharing, external save confirmation or cleanup/lifetime guarantee. |
| Preview timing | `futureAlert` is weaker than restored eligibility; use informational copy and no Scheduled/silent promise. |
| List names | Native recomputes identity/name collisions at import. Preview names are prospective, not immutable results. |
| Import acknowledgement | Receipt retry lacks totals/blocked and full series-recovery evidence. Confirm import identity; refresh delivery separately. |
| Import validation | Real bridge exceptions keep the job frozen. Resolve definitive rejection versus uncertainty before enabling preview replacement after import failure. |
| Diagnostics | Actual observation/capabilities/schema fields exist; proposed clearer display/count scope/privacy copy is not already shipped. |
| Routing/lifetime | Stack origin works in ordinary paths; verify retained Settings scroll, mounted job guard and stale share/refresh response handling. |

Inspect [Settings](../../src/app/settings.tsx), [Restore UI](../../src/app/backup.tsx),
[Diagnostics UI](../../src/app/diagnostics.tsx), [restore controller/tests](../../src/domain/restore.ts),
[controller tests](../../src/domain/restore.test.ts), [bridge types](../../modules/remilo-alarm/src/RemiloAlarm.types.ts),
[native engine](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/AlarmEngine.kt),
[codec](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/BackupCodec.kt)
and [native tests](../../modules/remilo-alarm/android/src/test/java/com/remilo/alarm/engine/AlarmEngineTest.kt).
These findings document existing guarantees and gaps; they do not authorize
behavior/schema changes, weaken native tests or change milestone ownership.

The [fourteen captures](r10-data-help-fixtures.json) cover Settings Data/Help,
export handoff, Restore idle/conflicts/busy/unconfirmed, Diagnostics populated/
retained error, invalid file, confirmed blocked import, receipt-only confirmation,
share unavailable/error and weak legacy preview timing. First-eight coverage uses
all eight R3 pairs. Empty/lists-only previews, chooser cancellation with old preview,
many lists/25-entry paging, definitive rejection, process/lifecycle edges, zero/
unknown diagnostic states and large-text/OS handoffs remain component/native cases.

Future generation notes must call out inconsistent icon/accent/canvas roles,
oversized art, fabricated filenames/counts/delivery claims, copy switches on new
entries, missing recovery controls and footer clipping. Synthetic images are
qualitative references, not measured contrast/target/IME/TalkBack or native/physical
acceptance. [Refinement evidence](../evidence/2026-10-08-r10-data-help-refinement.md)
records actual source/reference/static checks only. Remaining Agenda/detail/editor
exceptions follow; R9 image review is still separate and pending.
