# Offline Android acceptance run

Run this checklist when convenient. No further interactive phone testing is needed
while implementation continues. Report results together; a failed step does not
mean you must finish the rest. Use only test reminders, and retain your normal data.

The older native build already has your confirmations for five-minute cutoff,
locked/screen-off delivery, delivery after reboot, Stop, ten-minute Snooze, and
Stop/Snooze buttons on the returning alarm. This checklist checks the expanded app;
those earlier observations do not establish results for this new build.

## Optional Calendar acceptance

The [P4-A publishing procedure](calendar-publishing.md#signed-device-acceptance-procedure)
is a separate signed-device run using the owner-designated account and
**Remilo Reminders** calendar. Connecting alone publishes nothing. Record the new
APK identity and actual device/observer outcomes for connect/cancel/reconnect,
owned selection, timed/all-day publishing, disabled Calendar reminders, offline
recovery, disconnect and unchanged local alarms. These Calendar observations remain
pending; the owner's [9 October G1–G3 attestation](evidence/2026-10-09-owner-g1-g3-attestation.md)
does not establish them. BETA-04 remains open because the Recents afterimage still
reproduces.

The [Calendar implementation evidence](evidence/2026-10-09-calendar-publishing.md)
identifies the signed bundled ARM64 build prepared **10 October 2026 at
06:14:43.215 UTC** (9 October local), **com.remilo.app 0.4.0 / code 4**.
APK SHA-256: `0a010b846b21ae67a1b870990cce77dd9867601b4ebe4e3cfd05a961d04666c4`.
It has not been installed or physically accepted.

## Current sheet, Details and Lists acceptance artifact

The [sheet, Details and Lists evidence](evidence/2026-10-09-sheet-details-lists.md)
identifies the latest signed bundled ARM64 build prepared **10 October 2026 at
04:33:35.078 UTC** (9 October local time). It adds corrected header More sheet
colors, connected Details rows and leading list glyphs to the preceding changes.
Package/version remain **com.remilo.app 0.4.0 / code 4**, with the existing signer.
APK SHA-256: `47fb75e5c6d03f507e7c93e10cebfe33f9fde2db5e4af0a4c31df857717c8a07`.
The evidence states the application-source/build relationship. No installation
or physical result is established. U26 and all other observations remain pending
for this artifact until the owner records them.

## Earlier connected-group artifact (historical)

The [connected-group evidence](evidence/2026-10-09-connected-groups.md) identifies
the latest signed bundled ARM64 build prepared **10 October 2026 at
04:05:32.778 UTC** (9 October local time). It includes the editor, Lists and entire
Settings grouping correction plus the preceding Trash/editor changes.
Package/version remain **com.remilo.app 0.4.0 / code 4**, with the existing signer.
APK SHA-256: `56f235df7a931b79a56fe4867736f57434095ee10f369ad7bd4817928313d445`.
The evidence states the application-source/build relationship. No installation
or physical result is established. U25 and all other observations remain pending
for this artifact until the owner records them.

## Earlier Trash and editor artifact (historical)

The [Trash and editor correction evidence](evidence/2026-10-09-permanent-trash.md)
identifies the earlier local signed bundled ARM64 build prepared **10 October 2026
at 02:15:28.364 UTC** (9 October local time). It includes permanent Trash deletion,
the themed Move to Trash sheet, compact independent Date/Time controls and one success snackbar.
Package/version remain **com.remilo.app 0.4.0 / code 4**, with the existing signer.
APK SHA-256: `b4464d21a26f8e58e20500518e9facbdd47f9f22cfb1c445c56fbca42e71fccf`.
The linked evidence states the application-source/build relationship. No
installation or physical result is established. All observations in this checklist
remain pending for this artifact, including normal expiry and TalkBack dismissal.

## Earlier alert experience artifact (historical)

The [alert experience contract](design/current/alert-experience.md) supersedes
earlier Stop wording, Due-based overdue checks and outlined terminal-card More
controls in this checklist. The [alert experience evidence](evidence/2026-10-09-alert-experience.md)
identifies the signed bundled ARM64 build prepared **9 October 2026 at
22:01:25.394 UTC**, from production source revision
`f772647eac203c898ee8c65bb82fef8a75f831eb`. Package/version are
**com.remilo.app 0.4.0 / code 4**; the existing signer is retained.
APK SHA-256: `aed83392c9a84e451555fddc308d46df28b9c417157d717ea43667bca7e539f4`.
No installation or physical observation was performed or authorized by preparation.
All checks below remain pending for this artifact until the owner records actual
results. The evidence also lists remaining browser-render observations after the
fixture browser stalled, including post-fix large-text navigation and group controls.

## Earlier prepared beta-fix artifact (historical)

The [beta-fix evidence](evidence/2026-10-09-beta-fixes.md) identifies the signed
bundled ARM64 build prepared **9 October 2026 at 20:19:05.680 UTC**, including
Stop completion, four roots, alert-first Agenda and stationary artwork covered
by scrolling content. Package/version remain **com.remilo.app 0.4.0 / code 4**.
APK SHA-256: `f8f07454eebcd9c98215966a452e93db10af5acacb23a299708eeaeda563a1f9`.
The existing signer is retained. No installation or physical observation was
performed. This identity records the earlier beta fixes and does not establish
results for the subsequent alert experience changes. Apply the
[beta acceptance additions](verification.md#beta-fix-acceptance-additions-9-october).

Check browsing art at the top, partway and fully covered: it stays stationary
while the opaque body rises over it and the toolbar remains reachable. Reverse
scroll and return from another page must preserve the appropriate occlusion.
Repeat with short/empty content, landscape, reduced motion and large text.

## Earlier prepared redesign artifact (historical)

[TD-06 integration evidence](handoffs/redesign-td-06.md) records successful local
preparation on **9 October 2026 at 17:18:00.718 UTC**, after the final candidate 05
presentation/wording corrections. The release APK is
**com.remilo.app 0.4.0 / versionCode 4**, **arm64-v8a**, minSdk 34/targetSdk 36,
signed with bundled JavaScript and not debuggable. Its SHA-256 is
`927482ad16efe01290fcc63057cffac137185db4074bf8bc6a800050834669d3`;
the retained signer SHA-256 is
`880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
Preparation installed/published nothing and leaves every physical observation
pending. The working-tree/build relationship is recorded in TD-06; the base
commit and version alone do not identify these bytes.

The owner [approved composition 05 for implementation](design/r9-runtime-composition-approval-v5.json),
closing R9 composition review while physical observations remain pending.
This checklist is for the later
consolidated owner run against the specifically reviewed final artifact, not an
instruction to resume phone testing now. If further runtime edits require another
artifact, record that build/hash before observing it instead of relying on the
unchanged 0.4.0 version label. Earlier toolbar/Browse build observations retain
their historical scope and do not establish this redesign's behavior.

1. When starting the owner run, install the specifically identified signed APK as
   an update without uninstalling or clearing data. Preserve the recorded artifact
   hash/source relationship; the local build path is
   `android/app/build/outputs/apk/release/app-release.apk`.
2. Open Remilo offline, with no development server running. Your saved reminders
   should remain present. Open Settings from the current root's More menu, then
   Permissions, and enable required
   access through each row. Return: statuses refresh automatically.
3. Record phone model, Android version, app version, date, and whether exact alarms,
   notifications, the alarm channel and full-screen access are enabled.
4. Prefix new test titles with **QA**. Tap Add reminder → enter a title → tap Date.
   Select today's date, then tap Time directly and choose two or three minutes
   ahead; keep the default linked timing. Tap the persistent Save footer. Confirm return to Agenda or the
   invoking named list and the saved
   alert message; use its View action to inspect details → Schedule details when present.
   For a quick native probe, use Settings → Alarms → Test alarm (15 seconds).

## U. Current time-of-day redesign acceptance (after implementation)

Use [the current design](design/current/README.md) and [appearance policy](design/current/appearance-policy.md).
This is a future observation checklist, not a claim that the documentation PR
changed the installed app. Preserve the A–E native/recovery/recurrence/data scenarios.

These are the current redesign checks. Record each as pass/fail/pending. No production
data needs deletion. Keep alarm-volume conditions separate from appearance checks.

- **U1 — agenda and density:** create four ordinary QA reminders today and one
  daily repeat. Return home. Reminders appear immediately, with one + and icon
  actions. At default text size at least four ordinary rows fit a 360×800-equivalent
  screen. Collapse Today: its count remains. Expand it: records reappear separately.
- **U2 — event versus alarm:** create a timed No alert reminder with yesterday's
  When and a future independent Due. It is Overdue from When; changing Due does
  not change its overdue age. An all-day No alert reminder becomes overdue after
  the next local midnight after its start date, even across a DST boundary. For an Alarm
  reminder already overdue, Postpone to tomorrow: it stays Overdue and shows the
  new alarm time. Each occurrence appears once.
- **U3 — search/filter:** tap Search; type a QA title or note. Results narrow.
  Open a result, return, and check the query/filter context remains. Press Android
  Back with the keyboard visible, then repeat with it hidden: search exits without
  leaving Agenda. Clear query empties text while keeping search open; Exit search
  closes it. Tap Filter, choose a list and Overdue only, then Show reminders.
  Check the compact summary; tap it to clear. There are no six-tab filter rows.
- **U4 — completed, skipped and Trash:** complete a QA row using its leading completion target,
  then use Undo. Complete again: it leaves the active agenda. Find it through
  the secondary Completed destination. Filters → Show skipped exposes a skipped repeat.
  Move a different QA reminder to Trash through its detail menu; confirm the
  themed request after checking Keep reminder/Back first. Check that one snackbar
  with Undo appears, with no lasting green duplicate; ordinary Undo feedback expires
  after ten seconds or the configured accessibility extension. Undo restores the
  captured deletion. Move it again, then the Trash root → row More → Restore recovers
  its content. Completed/Skipped row More → Reopen clears both terminal states
  without replaying elapsed alerts. Single row actions are not repeated inline.
  Search/filter both collections, including a list containing only Trash items.
  Complete/delete QA reminders in a different order from their event dates:
  the newest completion/deletion appears first. Elapsed alarms remain silent.
- **U5 — simple creation and draft safety:** tap +, enter a title and choose an
  event using Date and Time side by side on one row. Constrained widths/larger
  text stack the controls while preserving readable targets. Time opens directly without Date;
  Date opens directly without Time. Changing either keeps the other component,
  and cancelling a picker keeps both. All day shows Date only. Save without
  opening advanced timing: Agenda acknowledges the
  actual saved alert, with a View action. Start another draft,
  change its title and press Android Back: choose Keep editing, then Back → Discard.
  No live reminder was created. Open Repeat: common rules precede Custom repeat.
  Custom repeat shows named months/ordinals. Apply it and check at least three
  preview dates, or explicit text saying fewer remain. Reopen Custom, change the
  interval/weekday/ending, then Cancel changes: the previously applied rule remains.
  Repeat using Android Back, which closes the current nested sheet first. Close
  Repeat without applying: neither the draft rule nor the saved reminder changes.
- **U6 — details and repeat scopes:** open a repeating occurrence. Its normal
  schedule is shown once; Schedule details appears only when useful. Activity
  opens through More. Title, schedule, delivery and notes take priority over compact
  bottom actions. Tap Edit: This occurrence, This and following,
  Entire series are available. Cancel the selector, open Repeat details and Pause repeat.
  Find it through Repeats → Paused, then Resume. Inspect
  Active and Ended filters and verify one entry per family after following/whole
  edits. Family details retain earlier unfinished and postponed occurrences.
  Check scope behavior in D. Long-press a one-off row → Edit opens its editor
  directly. Repeating Edit opens the scope selector on each separate invocation.
- **U7 — automatic settings:** change vibration and Snooze duration several times
  quickly; choose another theme and leave Settings immediately. Return, close/reopen
  the app and check the latest selections persist. No Save settings button exists.
  Adjust a Tomorrow shortcut using its time picker. Restore your desired preferences.
  Error/uncertain-operation recovery is automated; do not inject phone storage faults.
- **U8 — permission return:** tap each Permissions row. Status has an icon and a
  label, not color alone. For one safe test, deny lock-screen/full-screen access,
  return and check Limited plus the home warning; restore access and return.
  No manual refresh is needed. Saved-but-blocked/pending feedback remains visible
  until acknowledged, including after reopening a future completed probe. See C for
  exact/notification restrictions; access never guarantees audibility.
- **U9 — native auto-close:** use Test alarm. Done: sound ends and native controls
  close automatically; the occurrence appears in Completed. Repeat and Snooze: controls
  close, then both notification actions return at the selected duration. Repeat and
  let the five-minute session expire: controls close. Press Done from the notification
  while native controls are open: the ended screen closes. No Close button exists.
- **U10 — groups:** create two reminders at the same instant. Native controls show
  two independent members. Done one: screen remains for the other. Snooze the final
  member: screen closes. Repeat with Done all (2): both appear in Completed. Repeat
  with Snooze all: both remain unfinished and share one next alert instant. The
  notification tap opens individual native controls. A captured group action excludes
  later arrivals; controlled stale-member/retry cases belong to engineering checks.
- **U11 — appearance/accessibility:** repeat home, search, filters, creation, Custom
  repeat, detail Schedule details and More → Activity, scope/Postpone sheets, Settings/selectors, Completed,
  Trash, Lists/Repeats and repeat details, Restore preview and Diagnostics in Light and
  Dark. Enable the largest font size (200% where available), then TalkBack. Essential
  actions remain reachable by scrolling, with clear labels/statuses and no clipping.
  Check keyboard behavior in title/notes and custom numeric fields, including bottom
  action reachability. Enable reduced motion and repeat sheet/row transitions. Restore font and
  accessibility preferences. Native controls need their own large-font run.
- **U12 — identity and loading:** inspect the static Classic ring/check/sun launcher,
  adaptive/monochrome system treatment, splash and small notification icon. The
  main ring/check is centered with the sun/rays offset; inspect actual round/
  adaptive OEM masks and small sizes without treating full artwork bounds as the
  ring center. There is no app-controlled theme/alias switching. Long titles remain readable in
  details and native controls. First loading must not claim an ended alarm or a blocked
  permission. Force-stop/reboot limitations remain those in C, rather than UI errors.
- **U13 — city/zone authoring:** choose a city/region for a pinned QA reminder
  using its searchable Time zone picker. Check the selected date's offset and the
  When/due/alert labels. Change between Los Angeles and Tokyo: authored clock times
  are kept while the resolved instant changes. Cancel either stage of a date/time
  picker: the old value stays. Repeat with all-day and independent due/alert fields.
  For a pinned repeat near a clock change, move When and verify linked civil offsets
  stay the same while event duration remains elapsed; check the gap/fold preview in D15.
- **U14 — swipe and safe Undo:** swipe a QA row to reveal Done, then release:
  it remains unfinished until the revealed button is pressed. Swipe back or tap
  the row to close the reveal. Try vertical scrolling and a cancelled drag: neither
  completes nor deletes. Complete using the visible button and Undo it. For a safe
  stale-Undo case when a controlled QA-only second writer is available, complete
  again and change the same reminder before pressing the captured Undo. Confirm
  it cannot reverse the newer revision. Leave this case pending without that setup.
  Completed swipe reveals Trash and requires tapping it; a swipe alone never deletes.
- **U15 — stale editor recovery:** when a QA-only controlled second writer is
  available, leave a local draft open and change its saved title/notes/timing/repeat
  externally. Save the old draft: it is kept for Review changes. Inspect Yours and
  Latest, cancel/close review, and confirm the draft is still kept and cannot bypass
  review. Accept a reviewed draft, then explicitly Save. If the old series segment
  was replaced, verify Save as new and confirmed Reload current repeat choices.
  Leave second-writer cases pending if the controlled setup is unavailable; do not
  inject database/storage faults into your normal phone data.
- **U16 — restore and action feedback:** Settings → Restore backup distinguishes
  Reading backup from Restoring backup. Cancel Android's file picker: an existing
  preview stays. Cancel a preview: no data is imported. During a restore, selection
  and Back are guarded. A controlled lost-reply fixture must retain the file, copy
  selection and operation ID for Retry same restore; leave that fault case pending
  without the engineering setup. Saved-but-blocked or pending scheduling must show
  a warning rather than claim delivery. Check Test alarm, sound preview, backup
  export and diagnostics refresh/share progress and errors; dismissing a share sheet
  must not claim that a report was sent.

- **U17 — roots and origin:** switch Agenda / Lists / Completed / Trash using the labeled
  bottom roots. Open named lists, Completed/Trash, Settings, details and Activity
  from their invoking origins; return with their independent queries, filters and
  scroll retained. Hide root navigation inside editor/details/modal workflows.
  Sheets and search/IME close before navigation; uncertain saves/restores remain guarded.
- **U18 — managed lists:** create an empty QA list from Lists; it remains after
  leaving/reopening. Create a reminder inside it: Save returns to that list with
  acknowledgement and View. Choose No list, rename the QA list, and check alerts
  keep their times. Remove the list: reminders move to No list with completion,
  Trash and repeat exceptions preserved. A stale draft referencing that removed
  list is rejected. Inspect list-scoped Completed/Trash and backup restored names.
- **U19 — state and cleanup:** inspect an overdue stopped reminder: Still
  unfinished and no next alert are explicit; Done and Postpone remain distinct.
  Inspect adjusted, blocked, No alert and paused/ended repeat exceptions. Alert
  problems filters failed delivery without including Stopped or Notification sent.
  Activity shows recorded actions, with empty history labeled No recorded activity.
  Move a completed QA occurrence to Trash without a modal; Undo restores completion.
  Restore from Trash returns it to Completed. Check a newer change prevents stale
  Undo. Trash explains indefinite local retention and the one-off backup exclusion.
- **U20 — truthful sound preview:** in Settings and the editor, select and preview
  both tones separately. Play does not select/save; Stop ends playback. Switch
  previews, close/Back, navigate and background: the old preview ends. Observe
  Starting then Playing, five-second cutoff and actual fallback if the system tone
  is unavailable. Let a QA real alarm arrive during preview: it takes priority.
  Repeat with TalkBack/large text; leave unavailable failure cases pending.

- **U21 — four atmospheres and Automatic:** select each manual scene and verify
  matching app pages/sheets/native alarms in Light and Dark, including Sky Dark
  daytime clouds and Night Light reading surfaces. Check System brightness separately.
  Select Automatic and test local 06:00/10:00/17:00/21:00 using a controlled QA clock;
  preserve system time on a personal device. Verify missing/new atmosphere preference
  uses Automatic while upgrade brightness remains. Manual selection survives reopen.
  Retain edits/caret/scroll through clock/zone changes; reduced motion is immediate.
  A ringing session keeps its captured scene; the next session resolves anew.
  Leave unavailable controlled-clock/upgrade cases pending instead of changing normal data.

- **U22 — selected collection actions:** in Completed/Trash, normal browsing shows
  labeled single Reopen/Restore through the row's three-dot menu, with independent
  row-open targets. Toolbar More → Select reminders adds selection checkboxes and
  a selected count; these checkboxes mean selected, not completed/restored. Select
  several QA completed/skipped occurrences and use contextual Reopen or Move to
  Trash. In Trash select QA occurrences and Restore: completed/skipped state is
  preserved and elapsed alerts stay silent. Select all loaded includes only
  loaded matching rows; Load more does not select new rows. Query/list/Include
  skipped stay fixed while selecting. Back/Done selecting clears selection before
  origin navigation; open sheets close first. Targets remain separate/reachable at
  200% text and with TalkBack; contextual footer/feedback never covers content.
  Partial/stale/lost-reply cases require a controlled QA setup: confirm truthful
  per-item results, frozen captured selection/queue and exact unresolved-operation
  Retry before remaining items. There is no atomic rollback, bulk Undo or permanent
  Trash deletion. Leave unavailable fault setups pending; do not alter normal data
  to force them.
- **U23 — whole-backup inclusion and handoff:** export QA new reminders plus an
  empty QA list and restore that backup. New identities, empty lists and entries
  outside the current preview page are included automatically. Existing identity
  conflicts offer Keep existing / Add a separate copy; matching titles alone do
  not create conflicts. In a controlled lost-reply case the backup/choices/operation
  remain frozen until the same restore is acknowledged or definitively rejected;
  a receipt-only result supplies no invented totals. Diagnostics retains its last
  observation timestamp after a failed refresh. Export/Diagnostics reports opening
  the Android share sheet, not proof another app received or saved the file.
- **U24 — captured Test alarm:** one deliberate Test alarm request commits one
  test and target. Rapid taps do not duplicate the pending request. In a controlled
  uncertain-reply case Retry returns the original test/target under the captured
  operation identity; a new test requires a new deliberate request. Leave unavailable
  fault setup pending and use only QA probes. Scheduling feedback does not prove
  audibility; native delivery remains covered by B/C.

- **U25 — connected editor, Lists and Settings:** check 2 dp seams between related
  items and 12 dp between groups, 16 dp outside/4 dp inside corners and full
  singleton corners. Switches and navigation rows share the same surfaces. Toggle
  All day and Due/alert linkage, select Alarm/Notification/No alert and open/close
  the editor pickers; drafts and selections survive, hidden rows update corners,
  and focus outlines stay unclipped. Check all eight appearance pairs, narrow
  width and 200% system text. Permission statuses move beneath readable labels;
  passive channel statuses/build info have no extra tiles or chevrons. Inspect
  empty/single/multiple and long-name Lists, management and separate More targets.
  Confirm one preference retry across affected groups, Test recovery/conditional
  View test reminder, and prepared-backup retry inside Export with truthful
  handoff feedback. TalkBack order, touch targets, native pickers and sharing
    remain pending until observed on the signed Android build.

- **U26 — header sheets, Details and list glyphs:** in Night Light, open Agenda
  and Lists header More. Title, Close, Settings and Manage lists must contrast with
  the sheet surface; focus/pressed treatment must use surface roles rather than
  white scenic-header foregrounds. Compare all eight atmosphere/brightness pairs
  and Completed/Trash menus. Details Schedule uses 2 dp connected seams and 16/4 dp
  corners, including conditional independent Due, Next alert and Notes. List
  navigation and its focus border remain functional/unclipped. Repeat recovery
  and zone guidance stay with their group. Library No list and named/management
  lists show the same neutral checklist glyph/container; overdue text and separate
  More actions remain accessible. Check narrow width, 200% system text, long names,
  scrolling, sheets, Back and TalkBack reading order on the signed build. These
  observations remain pending; host fixtures do not establish Android acceptance.

## A. Everyday reminders and timing

- **A1 — upgrade/offline navigation:** your existing reminders remain. Agenda, editor,
  Lists, Completed, Trash, Repeats, Settings and detail views open
  offline. Pull down on the home list to refresh.
- **A2 — default timing:** create QA Timing. Its due and original alert equal the
  event start; event end is thirty minutes later. Add notes and a list. Search for
  the title and notes; select the list filter. The item appears in the correct agenda group.
- **A3 — independent timing:** edit QA Timing. Turn off the due and alert links and
  choose separate times. Move the event and save. The independent due/alert remain
  unchanged. Turn links on again and verify the native preview before saving.
- **A4 — all day:** create QA All day with All-day enabled. Preview says Due by end
  of day, with the default alert at 9 AM on the event day.
  Use No alert if that day's 9 AM has already elapsed. No alert becomes overdue at
  the next local midnight after its start date; Alarm/Notification overdue follows
  the original alert, independently of Due and delivery state.
- **A5 — modes:** create separate Alarm, Notification and No alert probes. Alarm
  rings; Notification posts one system notification; No alert schedules no sound.
  A blocked Alarm is never silently changed to Notification.
- **A6 — Done:** use Done on a ringing probe. Its occurrence moves to Completed; any
  future repeat slots retain scheduling.
  Mark it Done: it moves to Completed and its pending alert is cancelled. Reopen an
  elapsed reminder: it stays silent. Reopen one with a future target: check scheduling.
- **A7 — management:** duplicate a reminder, choose a new future time, and save.
  Delete it and find it in Trash; Restore returns its content. Elapsed
  alerts remain silent. Verify recorded actions in detail → More → Activity.

## B. Native ringing, Snooze and Postpone

- **B1 — closed UI/offline/locked:** schedule a short probe. Leave Remilo, swipe
  its UI out of Recents, turn off network, lock the screen and wait. The alarm
  rings and shows native controls where Android permits. This checks closed UI;
  proof that the process/JavaScript runtime was absent uses the engineering matrix.
- **B2 — Done and repeated Snooze:** keep Settings foregrounded for the initial
  alarm. Check Done and Snooze · X min in the popup and expanded notification. Snooze ten
  minutes, inspect the returning popup/panel, Snooze again, and use Done on the next
  delivery. Both actions stay available; Done silences sound and completes only
  that occurrence.
- **B3 — cutoff:** leave one alarm untouched with the screen off. Record playback
  start and stop times. It ends after approximately five minutes and stays silent.
  The item remains unfinished, shows its overdue age in browsing and records
  Alarm timed out in Details/Activity; native controls close.
- **B4 — collision/deadline:** create QA Group A two minutes ahead and QA Group B
  at the same time. Both appear separately in native controls; one sound plays.
  Done A: B keeps ringing. Snooze B: the session stops and only B returns. On a
  separate run, let B join three minutes after A starts; both stop at A's original
  five-minute deadline. Done all completes exactly the displayed captured members;
  later arrivals continue separately. Snooze all uses the displayed global duration
  and one common target, retaining unfinished work. Timeout keeps every unresolved
  member unfinished.
- **B5 — Postpone after ringing/timeout:** open a historical unfinished stopped or timed-out
  item. Try 15/30/60 minutes, tomorrow presets and a custom future time. Check the
  resolved date/time before applying. Event/due/original alert stay unchanged;
  the next alert changes. Postpone a snoozed item: the old Snooze target is replaced.
  Close and reopen Postpone: its custom target starts in the future each time.
  Choose a past custom time: it is rejected without changing the current target.
- **B6 — preferences:** change quick Snooze to two minutes, edit tomorrow presets,
  preview both tones, and toggle vibration. Test the new Snooze button and target.
  Restore your preferred settings afterward. Changing defaults affects new
  reminders; a ringing group keeps its first member's sound and deadline.
- **B7 — audio environment:** repeat a short alarm with your usual volume,
  Bluetooth/headphones and a call or competing media session. Record routing,
  focus interruption and audibility separately. A focus interruption never extends
  the original cutoff. Restore your original audio settings.

## C. Recovery and permissions

- **C1 — before first unlock:** schedule a probe several minutes ahead; reboot.
  Keep the phone locked until delivery. Text stays generic; native Done and quick
  Snooze work. Unlock afterward: one completion with the original action instant
  and its history reconcile without a replay.
- **C2 — system Active Apps Stop:** create QA Recovery A two minutes ahead and QA
  Recovery B four minutes ahead. When A rings, use Android's Active Apps/running-app
  control to stop Remilo. A goes silent. Keep Remilo closed until B rings, then use
  Remilo's Done. Open the app: A records Alarm interrupted and is unfinished; B is
  Completed. If the system
  control is unavailable, record unavailable rather than substituting Force stop.
- **C3 — exact access:** save a future Alarm with exact-alarm access denied.
  It is saved but blocked. Grant before its target and refresh: it becomes scheduled.
  Separately, leave access denied past a probe's target; granting/reopening marks
  it Missed silently.
- **C4 — presentation restrictions:** deny notifications, disable the alarm
  channel, and deny full-screen access in separate runs. Readiness reflects each
  state directly in Settings. Restore access and return. Record actual presentation; full-screen access
  does not establish volume or audibility.
- **C5 — Force stop:** schedule a probe, use Android app settings → Force stop,
  and leave the app closed past its target. Delivery is not expected under this OS
  limitation. Reopen afterward: the elapsed item is Missed and stays silent.

## D. Recurrence and series actions

Create repeat probes with + → Repeat → Custom repeat. Use the preview to check the
following rules; pause preview-only series afterward to avoid leaving test alarms.

| ID | Input | Expected preview |
|---|---|---|
| D1 | Daily / every 2 days | consecutive nominal dates two days apart |
| D2 | Selected weekdays, Monday/Friday, every 2 weeks; anchor 5 Jan 2027 at 9 AM | 8 Jan, 18 Jan, 22 Jan |
| D3 | Day of month 31; anchor 31 Jan 2027; count 3 | 31 Jan, 31 Mar, 31 May; February does not consume count |
| D4 | Ordinal weekday, third Tuesday; anchor 1 Jan 2027 | 19 Jan, 16 Feb, 16 Mar |
| D5 | Last weekday; anchor 1 Jan 2027 | 29 Jan, 26 Feb, 31 Mar |
| D6 | Annual, month 2/day 29; anchor 1 Jan 2027; count 3 | 2028, 2032, 2036 |
| D7 | Fifth Monday; anchor 1 Jan 2027 | 29 Mar, 31 May, 30 Aug |
| D8 | Date ending | no slot after the inclusive nominal end date |

- **D9 — series lifecycle:** create a daily series with five occurrences, first
  alert a few minutes ahead. Future occurrences appear in the agenda; the engine
  independently registers two ordinary targets. Skip the first occurrence: find it
  in Completed → Filters → Show skipped and
  another future ordinary occurrence fills the window. Count is still five nominal slots.
- **D10 — individual exception:** Postpone an occurrence, then edit its notes.
  The chosen next alert survives. Edit that occurrence's alert definition instead:
  only its next alert changes; other ordinary dates retain the series rule.
  Mark a future occurrence Done and Reopen it, or Delete/Undo it: the restored
  occurrence is independent, while two ordinary future registrations remain.
- **D11 — pause/resume:** postpone one occurrence, then Pause series. Ordinary
  future alerts pause; the independent postponed alert remains. Resume re-arms
  future ordinary alerts, retaining elapsed items silently. Check split segments too.
- **D12 — edits:** from an occurrence choose Edit this and following. The original
  nominal slot is the boundary, even if postponed; the inherited count is the
  remaining count. Change the new rule and save. Earlier items and old postponed
  exceptions remain. Edit whole series replaces future ordinary segments, retains
  old unresolved/postponed items and preserves a paused family's paused state.
- **D13 — postponed/successor collision:** postpone an occurrence to its successor's
  alert instant. When that date arrives, two separate occurrences share one sound
  and retain separate native actions. This can be an overnight follow-up.
- **D14 — travel:** compare a floating and a pinned series, plus one postponed
  occurrence. Change the device time zone and return/refresh. Floating future
  ordinary dates follow that zone; pinned dates retain their named zone; the
  postponed instant stays fixed. An elapsed alert is never revived. Restore your zone.
- **D15 — DST:** check previews around a clock change in America/Los_Angeles.
  A daily 2:30 AM shifts forward on 14 March 2027; a daily 1:30 AM uses the earlier
  offset on 7 November 2027. All-day due boundaries follow local midnight. Host
  fixtures verify exact instants; real transition delivery remains a separate check.
- **D16 — downtime:** leave a recurring series unopened over several nominal dates.
  On recovery, elapsed occurrences are retained as Missed silently and only future
  ordinary occurrences are armed. Old postponed exceptions remain separate.

## E. Data and accessibility

- **E1 — backup:** export a one-off, completed item, active series, paused series
  and postponed exception. Save the file using the Android share menu. Restore it
  on the same app: preview identifies conflicts and preserves them by default.
  Select a separate series copy: its rules, exceptions/history and paused state
  survive. Only future eligible alerts are reconstructed. The copy may create
  additional future alarms, so pause/delete the test copies afterward.
- **E2 — malformed file:** choose an unrelated or malformed JSON file. Import
  fails before changing any reminders. Cancel a valid preview: nothing changes.
- **E3 — upgrade:** retain records across a signed in-place update; notes, lists,
  preferences, completion and current postponed targets remain. Never uninstall as
  an upgrade test. Automatic Android backup/device transfer is explicitly excluded;
  a second-device transfer check needs a separate device/setup.
- **E4 — readability:** switch light/dark/system themes. Enable large font/display
  size and TalkBack. Create/edit, navigate details, use native alarm actions and
  restore preview. Labels remain understandable, controls reachable and content
  scrollable without clipped essential actions. Restore accessibility settings.
- **E5 — diagnostics:** Settings → diagnostics shows aggregate readiness/state
  information without titles, notes or occurrence identities. Sharing is an explicit
  user action. Backups intentionally contain private content; diagnostics do not.
  Refresh shows progress and an acknowledgement; a failed query has Retry. Sharing
  shows progress and reports opening/cancellation only as far as Android confirms.

- **E6 — editor keyboard and visual consistency:** part of the same consolidated
  acceptance run; no separate phone run is requested by this documentation update.
  Create with Title focused: Save stays above the real Android keyboard and the
  caret remains visible. Scroll to List/Notes without dismissing IME. Focus Notes
  near the bottom, grow it over many lines, select text and move the caret to
  earlier/later lines. Repeat at 200% English/Chinese text and with a taller
  keyboard/emoji panel. No focused text is behind Save/IME; draft and composing
  text survive. Lower validation errors/inputs remain reachable. Show/hide IME,
  switch Title/Notes and return from a picker. First Back dismisses IME; later
  navigation retains draft guards. First deliberate Save tap creates one guarded
  operation, with no double inset gap or duplicate toolbar Save. Compare the same
  controls in Light/Dark and the four atmospheres: neutral ordinary icons,
  intentional action/focus/category/status colors, shared geometry. Record actual
  results/build/device; [references and corrections](design/approved-ui-r3-r4.md)
  are not passing observations.

## F. Alert experience and card consistency

- **F1 — visible alert choices:** the editor continuously shows Alarm,
  Notification and No alert. Alarm is the default. Switch among them: hidden
  authored timing and Alarm options survive; sound/vibration appear only for
  Alarm. At 200% text all three choices remain visible in a stacked group. Check
  selected/checked TalkBack announcements and the IME-aware Save footer.
- **F2 — Notification mode:** let a Notification reminder deliver. Done completes
  it once; Snooze · X min keeps it unfinished and posts another Notification
  without alarm sound or a full-screen activity. Posting, swiping and dismissing
  a notification do not complete work. Inspect generic lock-screen actions and
  actual OS action visibility without changing channel preferences.
- **F3 — timing and browsing:** compare different original alerts, When and Due,
  then Snooze/Postpone in a different order. Overdue age/order follows original
  alert for Alarm/Notification and When for timed No alert. Ringing takes visible
  precedence while Details retains overdue. Missed/Timed out/Interrupted/
  Notification sent stay available in Details/Activity rather than duplicate row
  badges. Inspect independent Due, blocked targets and scheduling warnings.
- **F4 — consistent terminal cards:** compare Agenda, named-list Agenda,
  Completed with Show skipped, mixed Trash and family occurrences. All use
  shared keylines, wrapping and the borderless vertical-ellipsis target. Normal
  Completed/Skipped/Trash has no completion checkbox, Done or empty placeholder;
  selection mode uses selection-only checkboxes. One terminal state line retains
  useful original schedule/alert and list/repeat context. Row tap opens Details;
  More offers Reopen/Move to Trash or Restore/Delete permanently as appropriate. Compare
  all four atmospheres in both brightnesses, portrait/landscape and 200% text.
- **F5 — captured actions and retries:** controlled QA engineering setups cover
  later arrivals, stale generations, changed Snooze settings, lost replies,
  registration failures, restart and pre-first-unlock recovery. Done all count
  must match captured members; Snooze all retains a common target and truthful
  per-member Scheduled/Blocked/Pending/superseded/elapsed results. Unknown results
  retry the identical operation rather than resnoozing. Leave unavailable fault
  cases pending; do not inject failures into normal phone data.

## Results and remaining engineering checks

### UX refinement additions — U27–U31 (pending)

Use one identified signed bundled build; record APK/source identity, device/OS,
conditions and observer. These are new observations, not inferred from earlier
G1–G3 attestation or web/host results. The deferred consolidated run remains.

- **U27 — keyboard handoff:** blank create focuses Title once; edit/duplicate
  start closed. First-tap Save works above IME. Success/discard closes keyboard
  before returning. Restored Agenda/Completed/Trash search keeps text/filters
  without reopening keyboard. Explicit Search/text tap focuses normally. Long
  Title grows to three lines then scrolls; 200% English/Chinese/IME composition,
  Notes caret, validation, Done and hardware Back remain usable.
- **U28 — timing:** review Title → one Alarm/Notification Date/Time → alert type;
  No alert uses Scheduled for. Calendar event starts collapsed; changing a normal
  alarm moves its default schedule, but separate/published/coincident independent
  event times survive. Event edits and All day event retain the alert clock; No
  alert All day keeps its date boundary. Test round trips, fields, changed date/zone,
  relink and initial-all-day 9 AM/30-minute fallback without advancing tomorrow.
  Cancel native pickers keeps old values. Check DST cases and stale-review choices.
- **U29 — filters:** Apply/Cancel/close/backdrop/Back; unchanged Apply retains exact
  scroll/pages. Changed criteria caps at covered-art boundary without remount.
  Show skipped chip/removal/reset and list/search independence; fixed list scope
  cannot broaden. Selection/pending/unknown actions disable competing filters.
- **U30 — timing and accessibility:** original/current/intended/previous alert
  meaning, conditional Details Event/Due, overdue postponed target, terminal dates,
  Ringing precedence and complete TalkBack dates. Check row Open/Done/More focus
  order, long press, menu return focus, divider-free short action menus, targets,
  landscape and reduced motion. Event ranges remain in Schedule details until
  Calendar publication context makes them relevant in the main group.
- **U31 — settings:** permission return/recheck/stale reads and channel disclosure;
  direct Android-settings handoff; Test In 15 seconds and same-test unknown retry
  with Back guard; sound preview; failed preference recovery after closing a sheet;
  Tomorrow clocks at midnight/23:59 and zone/DST changes without altering stored
  minutes; automatic scene boundaries/Now and independent color-mode changes.

No installation, distribution, Calendar repair or audible-delivery pass is implied
by completing the implementation. Calendar load-view error remains separate.

Send one report with `A1 pass; B4 fail — expected…, observed…; C2 unavailable…`.
Include version/device, conditions, and measured start/end times where relevant.
Screenshots are optional; keep unrelated notifications and private content out.
Delete or pause QA probes, restore changed system/app preferences, and verify no
unexpected test alarm remains armed.

The engineering matrix in [verification.md](verification.md) additionally covers
ordinary process absence, crash boundaries, obsolete callbacks, forced idle,
Android API 34–37 and another physical manufacturer. Host tests cover deterministic
state/rule behavior; they do not prove these physical outcomes. You do not need to
manually inject database faults. Calendar, cloud and iOS are deferred and have no
acceptance steps in this offline Android run.
