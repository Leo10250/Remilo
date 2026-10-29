# Remilo product contract

Remilo is an Android-first, offline reminder app. Local reminders, recurring work,
routines and alarm actions need no account, network, server, Metro or running
JavaScript. React Native presents the main interface; the native implementation
owns durable state and delivery. Current human instructions take precedence.

This document owns intended behavior. [Architecture](architecture.md) explains
ownership and recovery; [Calendar](calendar.md) defines the optional integration;
[visual direction](visual-direction.md) describes the current presentation; and
[localization](../localization/README.md) owns English and Simplified Chinese.
[Backlog](backlog.md) contains open work, not a history of completed changes.

## Scope

Android 14+ is the primary platform. Google Calendar is optional and cannot become
a dependency of local use. Daily digest, assistant actions, category suggestions,
cloud coordination and dynamic launcher icons are future work until separately
implemented. iOS comes last, after the Android extensions and optional cloud phase;
do not add unused platform or integration scaffolding.

The app has one static Classic ring/check/sun identity. Appearance is global:
By time of day, Sunrise, Sky, Evening or Night, independently of Color mode:
Match device, Light or Dark. Automatic uses the device-local clock:

| Atmosphere | Start inclusive, end exclusive |
|---|---|
| Sunrise | 06:00–10:00 |
| Sky | 10:00–17:00 |
| Evening | 17:00–21:00 |
| Night | 21:00–06:00 |

Missing/invalid atmosphere preferences resolve to Automatic without rewriting an
unknown stored value; existing brightness is preserved. Manual selections persist.
These are clock periods, not weather, location or astronomical observations.
Every app-owned page and new native full-screen alarm uses the shared atmosphere
and brightness roles. Android owns notification, permission, picker, sharing,
authorization and launcher presentation. Per-reminder themes, task-specific alarm
scenes and automatic launcher switching are outside current behavior.

## Reminder timing and delivery

Event, Due and Alert are separate. New event duration defaults to 30 minutes;
Due follows Event start and Alert follows Due. Linked edits move those relationships
together; deliberately independent values remain independent. All-day Due is the
next local midnight and the default alert clock is 09:00. Choosing a language does
not change zones, clock preferences, calendar system or scheduling.

Modes are Alarm, Notification and No alert. New ordinary reminders default to Alarm;
direct routine creation defaults to Notification. These creation defaults never
replace an existing or explicitly selected mode when routes or presets change.
Never silently substitute another mode when access or registration fails.
Notification may use approximate delivery when
exact delivery is unavailable; this is disclosed and does not turn Alarm into
Notification. No alert retains a scheduled When and creates no delivery.

Ordinary unfinished work is Overdue strictly after its original authored Alert for
Alarm/Notification, its When for timed No alert, or the next local midnight after
its date for all-day No alert. Independent Due, a future Snooze/Postpone, and delivery
outcomes do not move this boundary. Missed, Timed out and Interrupted are delivery
outcomes, not completion. Historical Stopped work stays unfinished.

Each occurrence is independently registered. An eligible callback no more than five
minutes late may deliver; a later ordinary callback becomes Missed. Recovery after
reboot, upgrade, restore, process interruption or clock travel never replays elapsed
alerts or interrupted sound. Permission/capability displays and a scheduled result
are not proof of audibility.

A ringing session plays one sound for at most five minutes from its original start.
Later arrivals retain that deadline and first-member sound/vibration. Members remain
independently actionable; one member's action must not silently resolve another.
Timeout, interruption, system Back and dismissing a notification leave unfinished
work unfinished. Sound-preview Stop ends preview only.

Before first unlock, native controls use generic content, operational time and
allowlisted non-private preferences. Titles, notes, list names, images, Calendar
content and credentials remain private. Unlocking does not authorize revealing
private content on public notifications. Android may restrict full-screen, exact
alarm, notification and audio behavior; no overlay permission or forced takeover
is part of the product. Power off, force-stop, locked Private Space, revoked access
and OEM restrictions can prevent delivery.

## Completion and postponement

Every ordinary work-completion action is labeled **Mark as done**; group completion
is **Mark all as done (N)**. Completion silences/cancels that occurrence and records
it completed. Native legacy Stop commands retain compatible completion semantics;
old Stopped history is not rewritten. Done selecting and keyboard Done retain their
own interaction meaning.

Ordinary ringing native controls and Reminder Details offer Mark as done/Postpone.
Ordinary Alarm and Notification notifications expose those actions from their first
post; unresolved notifications retain eligible Postpone. Group actions apply only
to an ordinary-only captured group. Capture displayed occurrence IDs/generations,
session and count; later arrivals are excluded. Mixed ordinary/routine groups keep
per-member actions rather than ambiguous bulk completion or Postpone.

Postpone changes only the captured occurrences' next delivery and leaves them
unfinished. It preserves original overdue, Event/Due and future recurring slots.
Native alarms and app presentation use one eight-choice chooser: 15, 30 and 60
minutes; 1 day; three saved Tomorrow clocks; and Custom. The default selected target
is now plus 15 minutes. The default Tomorrow clocks are 10:00, 14:00 and 17:00.
Legacy Snooze intents and the global quick-Snooze preference remain compatible;
quick Snooze defaults to ten minutes and uses the current native-mirrored setting.

Relative choices use elapsed time, including exactly 24 hours for 1 day. Tomorrow
uses the next local date and saved clock in the chooser's captured device zone.
Custom civil time uses the shared native gap-forward/earlier-fold policy. Capture
the shortcut values and zone when opening. A selected target is a fixed instant:
waiting, recreation, settings changes and retries never rebase it. Show its exact
future date/time; an expired target requires another selection.

Custom is a provisional Date/Time step. Use this time commits the selection to the
draft; Back to choices discards provisional edits. Back closes a picker, then the
custom step, then the chooser. Opening, choosing and cancelling never mutate work
or stop playback; the original sound deadline continues. The native chooser stays
inside the lock-capable alarm Activity; private Home remains behind keyguard.

Notification Postpone and Agenda More > Postpone open the same chooser over Home
after any required unlock. Repeated/cold/warm requests preserve captured scope;
a second request waits while a draft or uncertain command owns the chooser.
Loading or opening a request performs no mutation. Stale members reject an
uncommitted action. An unknown submitted result freezes the exact operation,
membership and target for retry. Registration can report partial, Blocked or Pending
outcomes without claiming every alert is scheduled. Missing protected Tomorrow
preferences disable those choices with an unlock explanation; do not guess them.

## Browsing, editing and management

Agenda, Lists, Completed and Trash are labeled roots. Repeats is a built-in view
under Lists, distinct from named-list membership. Details, editors, Settings,
Activity and list-scoped pages return to their invoking origin. Each destination
retains its own query, filters and scroll. Back closes IME/transient controls first,
then selection or draft guards, then navigates; non-Agenda root Back returns to Agenda.

Agenda combines one-off and recurring occurrences. Next/intended delivery anchors
date membership; No alert uses When. Groups are Overdue, Earlier, Today, Tomorrow
and explicit future dates. Native filtering, ordering and full-query counts precede
pagination. Overdue sorts by its original boundary then ID. Search and list, overdue
and Alert problems filters are local dataset controls. Alert problems includes
Missed, Timed out, Interrupted, Blocked and Failed, excluding No alert, Stopped,
Notification sent and Updating. Draft filters require Apply; Cancel preserves the
applied query. A quiet automatic refresh is distinct from deliberate pull-to-refresh.

Cards lead with local alert time or No alert, then meaningful timing/repeat context.
Do not add ordinary completion controls to routine or terminal collection rows.
Routine progress and Activity glyphs are informational. Structural reminder/list
icons use the shared neutral event/checklist roles; categories remain deferred.
A genuine unconstrained empty All Agenda offers creation without duplicate actions.
Retained query errors keep known content and contextual recovery.

Ordinary editors lead with required Title, then alert Date/Time and visible Alarm /
Notification / No alert choices. Date and Time have independent pickers; all-day
uses Date only. Constrained layouts stack controls without shrinking targets.
Optional Calendar event details are collapsed. Preserve independent Event/Due/Alert,
existing publication context and untapped instants; opening details publishes nothing.
An All day round trip preserves the draft's timed values. No alert hides inapplicable
clock controls without destroying the draft time. Preview describes schedule only.

Creation focuses the empty title. One persistent Save stays above the real IME,
with focused fields, caret and validation reachable. Nested forms merge only their
owned draft fields; cancellation leaves the parent intact. Save confirmation follows
native acknowledgement. Leaving a dirty editor offers Keep editing or Discard.
Stale content retains the draft for explicit review/reload; a pending or uncertain
Save holds its exact request and blocks replacement submission and departure until
definitively confirmed or rejected. A newer
route cannot inherit an old confirmation. App-owned confirmations use the common
theme and captured choice; Android-owned surfaces keep platform behavior.

Lists own durable identities, names and revisions. Optional single membership
defaults to No list; empty lists persist. New names are trimmed and case-insensitively
unique, while distinct legacy names remain intact. Rename changes metadata only.
Remove moves all retained content/templates to No list without changing alert targets;
stale references are rejected. Overdue counts count occurrences, not infinite futures.

Moving unfinished ordinary work to Trash requires confirmation explaining that its
alert will be cancelled; completed/skipped work moves directly. Completion/Trash
Undo revalidates the captured resulting revision and eligible state, preserving
unrelated or newer changes.

Completed and Trash load on demand and sort by relevant completion/skip/deletion
history, with search/list filters and optional Show skipped. Reopen clears completion
and skip without replaying elapsed alerts. Restore retains those states. Single-item
Reopen/Restore lives in row menus; terminal Details retains its primary action.
Explicit selection adds separate selection controls and contextual actions. Select
all loaded captures only loaded matching identities, never later pagination.
Query/scope changes wait until selection ends.

Selected operations run existing guarded native commands sequentially, with a
separate operation ID/revision per item. Results are per item, not an atomic batch.
Retain acknowledged outcomes; an unknown reply stops at that exact child until its
original command is resolved. Rejected items require a new deliberate action; do not
invent rollback or batch Undo. Individual/selected permanent Trash deletion requires
confirmation. Purge removes private logical records and keeps minimal anti-resurrection
identities; it does not promise secure SQLite erasure or delete external backups.
Activity presents recorded history without inventing lifecycle events or changes.

## Recurrence

Support daily, selected weekday/weekly, every N days/weeks/months, numbered monthly
day, ordinal weekday, last weekday and annual patterns, with date/count endings.
Preview at least three occurrences. Skip/edit one, this and following, whole family,
pause/resume and retained earlier unfinished/postponed occurrences have explicit scope.

Occurrence identity derives from the original nominal slot, never the postponed
instant. Floating schedules follow device zone; Calendar linkage pins a named zone
after review. DST gaps shift by gap size and folds choose the earlier offset.
Untouched stored instants remain unchanged. Invalid monthly days, fifth weekdays
and February 29 are skipped without consuming COUNT. Count includes valid nominal
slots even when their occurrences are individually skipped/completed.

Following edits retain prior segments and their exceptions. Pause applies to ordinary
future work across the active family without erasing independent exceptions; editing
a paused family keeps it paused. Reopen/restore cannot replay elapsed targets.
Validation bounds are application limits, not claims about Android alarm capacity.

## Routines and widgets

Create offers separate reminder and routine destinations with separate owning drafts.
New routines are empty General/ByWeekday plans; nonempty weekdays determine scheduling.
Exercise is an optional presentation preset, not another task type and not sample
content. Weekday tabs keep seven equal targets in one row or centered four/three
rows when needed. Copying creates independent day-specific steps after replacement
review; rename/reorder preserves IDs. Each day supports up to 100 steps; pending
removal retains room for Undo. One parent Save commits nested draft changes.

General steps support name, amount/duration, instructions and image. Exercise adds
optional sets/reps/range, duration, each side and weight with units. Numeric entry
preserves partial draft strings, validates natively and never parses legacy free
text into structured targets. Switching presets must preserve authored data.
Existing Shared plans convert to independent weekdays only on Save, preserving
materialized IDs/checks and frozen history; opening/cancelling performs no conversion.

One owning recurring reminder supplies a shared clock and Alarm / Notification /
No alert. Dedicated Date and time/Alert sheets change only their own draft fields.
Routine Alarm offers Start routine, Snooze and Dismiss alarm. Start dismisses the
captured alert before opening its date; none of these checks a step. Routine
Notification uses a separate quiet-by-default, Android-controlled channel. No alert
retains dated availability without delivery. Alarm never silently becomes Notification.

A scheduled routine is available throughout its device-local date, including before
its prompt time or after late creation. Progress binds stable step IDs to that dated
session. Completion advances only after native confirmation; viewing another step
changes selection only. Skip today and Undo Skip today have dated scope. At date
closure the session ends irreversibly; unfinished routines do not become ordinary
overdue reminders. History corrections never reopen that day or its delivery.

Saved edits apply immediately to today's open session while retaining its occurrence
and matching stable-ID checks. Added weekdays may become available today; unscheduling
today cancels delivery. Ended dates retain exact immutable snapshots. Elapsed or
already-posted prompts never replay. Direct today/future step editing uses the same
validated form and captured revision; ordinary reminder commands reject routine targets.

Routine Trash/Restore/Purge operates on the whole family, retaining prior child
completion, skip, deletion and ended state. Photos are full-frame authored content,
not decorative replacement artwork. History and Trash retain referenced images.

Native widgets support independent Routine Focus and Today configurations. Focus
shows the current unfinished step, intact target and count, direct Done, conditional
named Undo and next-step context. Undo may reverse that widget's still-valid
completions newest first within its current dated session, including after final
completion, without overwriting changes from other surfaces. Unknown results keep
exact Retry. Text opens the exact dated details. Today may pin Focus above today's
and overdue ordinary reminders from all lists. Rest/empty/error states explain their
state; constrained/large-text layouts use useful summaries rather than clipping.

Setup/picker previews use labeled inert examples in the real theme with visible
loading/errors. A new Focus draft may default to the first available routine; a saved
missing selection never silently retargets. Widgets require no React/network for
refresh, completion or recovery. OS refresh timing is approximate; stale action guards
remain authoritative even if launcher pixels lag. Widget configuration is not portable.

## Settings, language and portable data

Preference changes save through one native-confirmed controller. Failed/uncertain
changes retain exact recovery without losing newer queued choices. Sound selection,
preview and saved preference are separate. Preview has its own native identity and
five-second cutoff; replacement, backgrounding and real alarm startup stop/release it.
A preview error cannot block a real alarm. Permissions and Test Alarm show contextual
outcomes; an accepted Test request is not proof of sound.

English and Simplified Chinese are required for every new or changed app-owned feature,
including native/widget/notification/accessibility copy and error/recovery states.
System default, English and 简体中文 are persisted interface choices synchronized
with Android's per-app selector. Fresh installations follow supported system languages;
upgrades preserve English until changed. Authored/imported content is never translated.
Device 12/24-hour preference remains independent. See the [localization contract](../localization/README.md)
for contextual vocabulary and evidence-based Chinese review.

Export produces a private portable backup, including routine definitions, dated
progress, referenced custom images and retained recurrence exclusions. Ordinary
one-off Trash is excluded. Settings/appearance/language, Calendar credentials/links/jobs,
OS handles, operational generations, running alarm sessions and widget configuration
are excluded. Treat backup files as private; the product provides no encrypted-backup
or secure-erasure guarantee.

Restore applies the whole selected backup: new entries/lists are included automatically.
Conflicts default to Keep existing; Add separate copy is explicit and applies to a
whole repeating/routine family, with retry-stable remapped identities. Preview
pagination does not restrict import, and lists-only backups are valid. Validate all
metadata/media before atomic content application. Never replay elapsed alerts or restore
a running alarm. Restored copies are unlinked/Local only; Calendar-derived collision
review must preserve existing logical work by default.

An applying/uncertain restore freezes its prepared input, copy choices and operation
ID until definitive acknowledgement/rejection. A receipt-only retry confirms the
previous restore without invented added/preserved/blocked totals. A content import
with delivery warnings is an acknowledged import, not an uncertain one.

Export/diagnostic sharing confirms preparation or opening the share sheet only,
never external saving, sending or receipt. Retain the captured prepared file/report
for its supported retry; route departure invalidates stale launches/feedback.
Diagnostics shows an observed snapshot of capabilities, schema versions and scoped
state/pending counts. Zero counts do not repair access or establish audibility.
Private authored content and credentials never belong in diagnostics or automatic uploads.
