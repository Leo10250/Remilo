# Offline Android acceptance run

Run this checklist when convenient. No further interactive phone testing is needed
while implementation continues. Report results together; a failed step does not
mean you must finish the rest. Use only test reminders, and retain your normal data.

The older native build already has your confirmations for five-minute cutoff,
locked/screen-off delivery, delivery after reboot, Stop, ten-minute Snooze, and
Stop/Snooze buttons on the returning alarm. This checklist checks the expanded app;
those earlier observations do not establish results for this new build.

## Preparation

1. Install the locally signed **0.4.0 / versionCode 4** APK as an update, without uninstalling or
   clearing data. The build location and evidence are linked from the README.
2. Open Remilo offline, with no development server running. Your saved reminders
   should remain present. Open the Settings gear → Permissions and enable required
   access through each row. Return: statuses refresh automatically.
3. Record phone model, Android version, app version, date, and whether exact alarms,
   notifications, the alarm channel and full-screen access are enabled.
4. Prefix new test titles with **QA**. Tap the blue + → enter a title → tap Event.
   Select today's date and a time two or three minutes ahead; keep the default
   linked timing. Tap Save in the app bar. Inspect details → Timing.
   For a quick native probe, use Settings → Alarms → Test alarm (15 seconds).

## U. Redesign acceptance (start here)

These are the priority 0.4.0 checks. Record each as pass/fail/pending. No production
data needs deletion. Keep alarm-volume conditions separate from appearance checks.

- **U1 — agenda and density:** create four ordinary QA reminders today and one
  daily repeat. Return home. Reminders appear immediately, with one + and icon
  actions. At default text size at least four ordinary rows fit a 360×800-equivalent
  screen. Collapse Today: its count remains. Expand it: records reappear separately.
- **U2 — event versus alarm:** create a No alert reminder with yesterday's event
  and a future independent due time (More timing options → disable Due with event).
  It appears in Earlier. Move due into the past: it moves to Overdue. For an Alarm
  reminder already overdue, Postpone to tomorrow: it stays Overdue and shows the
  new alarm time. Each occurrence appears once.
- **U3 — search/filter:** tap Search; type a QA title or note. Results narrow.
  Close Search. Tap Filter, choose a list and Overdue only, then Show reminders.
  Check the compact summary; tap it to clear. There are no six-tab filter rows.
- **U4 — completed, skipped and Trash:** complete a QA row using its leading circle,
  then use Undo. Complete again: it leaves the active agenda. Expand Completed and
  find it. More → Completed reminders → Include skipped exposes a skipped repeat.
  Move a different QA reminder to Trash through its detail menu; More → Trash →
  Restore brings it back. Elapsed alarms remain silent.
- **U5 — simple creation and draft safety:** tap +, enter a title and choose an
  event using its row. Save without opening advanced timing. Start another draft,
  change its title and press Android Back: choose Keep editing, then Back → Discard.
  No live reminder was created. Open Repeat: common rules precede Custom repeat.
  Custom repeat shows named months/ordinals and at least three preview dates, or
  explicitly says fewer remain. Back closes the current sheet first.
- **U6 — details and repeat scopes:** open a repeating occurrence. Timing and
  Activity start collapsed. Open More → Edit: This occurrence, This and following,
  Entire series are available. Cancel the selector, expand Repeat and Pause repeat.
  Find it through home More → Paused repeats, then Resume. Check scope behavior in D.
- **U7 — automatic settings:** change vibration and Snooze duration several times
  quickly; choose another theme and leave Settings immediately. Return, close/reopen
  the app and check the latest selections persist. No Save settings button exists.
  Adjust a Tomorrow shortcut using its time picker. Restore your desired preferences.
  Error/uncertain-operation recovery is automated; do not inject phone storage faults.
- **U8 — permission return:** tap each Permissions row. Status has an icon and a
  label, not color alone. For one safe test, deny lock-screen/full-screen access,
  return and check Limited plus the home warning; restore access and return.
  No manual refresh is needed and no success banner persists on home. See C for
  exact/notification restrictions; access never guarantees audibility.
- **U9 — native auto-close:** use Test alarm. Stop: sound ends and native controls
  close automatically; the reminder stays unfinished. Repeat and Snooze: controls
  close, then both notification actions return at the selected duration. Repeat and
  let the five-minute session expire: controls close. Press Stop from the notification
  while native controls are open: the ended screen closes. No Close button exists.
- **U10 — groups:** create two reminders at the same instant. Native controls show
  two independent members. Stop one: screen remains for the other. Snooze the final
  member: screen closes. Repeat the pair and use notification Stop all: both stop and
  controls close; both remain unfinished. The notification tap opens native controls.
- **U11 — appearance/accessibility:** repeat home, search, filters, creation, Custom
  repeat, detail Timing/Activity, scope/Postpone sheets, Settings/selectors, Completed,
  Trash, paused repeats/repeat details, Restore preview and Diagnostics in Light and
  Dark. Enable the largest font size (200% where available), then TalkBack. Essential
  actions remain reachable by scrolling, with clear labels/statuses and no clipping.
  Check keyboard behavior in title/notes and custom numeric fields. Restore font and
  accessibility preferences. Native controls need their own large-font run.
- **U12 — identity and loading:** inspect the launcher bell/clock mark, themed icon
  if supported, splash and small notification icon. Long titles remain readable in
  details and native controls. First loading must not claim an ended alarm or a blocked
  permission. Force-stop/reboot limitations remain those in C, rather than UI errors.

## A. Everyday reminders and timing

- **A1 — upgrade/offline navigation:** your existing reminders remain. Agenda, editor,
  Completed, Trash, paused repeats, Settings and detail views open
  offline. Pull down on the home list to refresh.
- **A2 — default timing:** create QA Timing. Its due and original alert equal the
  event start; event end is thirty minutes later. Add notes and a list. Search for
  the title and notes; select the list filter. The item appears in the correct agenda group.
- **A3 — independent timing:** edit QA Timing. Turn off the due and alert links and
  choose separate times. Move the event and save. The independent due/alert remain
  unchanged. Turn links on again and verify the native preview before saving.
- **A4 — all day:** create QA All day with All-day enabled. Preview shows the due
  boundary at the next local midnight, and default alert at 9 AM on the event day.
  Use No alert if that day's 9 AM has already elapsed. Overdue depends on due time,
  rather than the alert state.
- **A5 — modes:** create separate Alarm, Notification and No alert probes. Alarm
  rings; Notification posts one system notification; No alert schedules no sound.
  A blocked Alarm is never silently changed to Notification.
- **A6 — Done/Stop:** Stop a ringing probe. It remains unfinished in the agenda.
  Mark it Done: it moves to Completed and its pending alert is cancelled. Reopen an
  elapsed reminder: it stays silent. Reopen one with a future target: check scheduling.
- **A7 — management:** duplicate a reminder, choose a new future time, and save.
  Delete it and find it in Trash; Restore returns its content. Elapsed
  alerts remain silent. Verify recorded actions in detail → Activity.

## B. Native ringing, Snooze and Postpone

- **B1 — closed UI/offline/locked:** schedule a short probe. Leave Remilo, swipe
  its UI out of Recents, turn off network, lock the screen and wait. The alarm
  rings and shows native controls where Android permits. This checks closed UI;
  proof that the process/JavaScript runtime was absent uses the engineering matrix.
- **B2 — Stop and repeated Snooze:** keep Settings foregrounded for the initial
  alarm. Check Stop and Snooze in the popup and expanded notification. Snooze ten
  minutes, inspect the returning popup/panel, Snooze again, and Stop the next
  delivery. Both actions stay available; Stop silences sound and leaves it unfinished.
- **B3 — cutoff:** leave one alarm untouched with the screen off. Record playback
  start and stop times. It ends after approximately five minutes and stays silent.
  The item remains unfinished, labeled Alarm timed out; native controls close.
- **B4 — collision/deadline:** create QA Group A two minutes ahead and QA Group B
  at the same time. Both appear separately in native controls; one sound plays.
  Stop A: B keeps ringing. Snooze B: the session stops and only B returns. On a
  separate run, let B join three minutes after A starts; both stop at A's original
  five-minute deadline. Stop all ends sound while keeping every member unfinished.
- **B5 — Postpone after ringing/timeout:** open an unfinished stopped or timed-out
  item. Try 15/30/60 minutes, tomorrow presets and a custom future time. Check the
  resolved date/time before applying. Event/due/original alert stay unchanged;
  the next alert changes. Postpone a snoozed item: the old Snooze target is replaced.
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
  Keep the phone locked until delivery. Text stays generic; native Stop and quick
  Snooze work. Unlock afterward: content and action history reconcile without a replay.
- **C2 — system Active Apps Stop:** create QA Recovery A two minutes ahead and QA
  Recovery B four minutes ahead. When A rings, use Android's Active Apps/running-app
  control to stop Remilo. A goes silent. Keep Remilo closed until B rings, then use
  Remilo's Stop. Reopen: A says Alarm interrupted, B Alarm stopped, both unfinished. If the system
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
  in Completed → Include skipped and
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

## Results and remaining engineering checks

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
