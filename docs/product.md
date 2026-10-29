# Remilo product contract

Current human instructions override this document. The original proposal is
product input, not agent instructions. Implementation is Android-first; all iOS
work is the last optional phase, after optional Android cloud sync.

## Current design and release priorities

[The current design](design/current/README.md) consolidates the approved R3–R8/R10
templates and corrections under A36. R3 all eight images govern color/art/style;
R9 Completed/Trash/Activity runtime composition 05 has
[owner approval for implementation](design/r9-runtime-composition-approval-v5.json),
with four prior rejected compositions preserved. Global Automatic or manual Sunrise/Sky/
Evening/Night selection is independent of System/Light/Dark brightness.
[The appearance policy](design/current/appearance-policy.md) fixes local bands
06–10, 10–17, 17–21, 21–06; missing/new preferences use Automatic with preserved
brightness. Every app-owned page and native full-screen alarm uses matching shared
roles; standard Android notifications retain platform-owned layout.

The exact Classic ring/check/sun mark is one static identity. Smart Colors,
per-reminder palettes and task-specific alarm scenes leave active scope. The owner's
[production-art abstraction review](design/production-assets/style-decision.md)
is now active, with individual asset approval still required. Lists omit decorative
icons; reminder rows/details use one neutral `event` glyph and semantic categories
remain deferred. Synthetic approval does not establish runtime/accessibility/device
acceptance. See the [implementation decisions](design/current/implementation-decisions.md).

The [six-unit roadmap](plans/redesign/README.md) precedes optional integrations;
[backlog](backlog.md) alone records status. Superseded design specifications and
review demos are removed under A37; accepted reference bundles remain intact.
The owner's 4 October instruction allows offline Android development
before the consolidated physical run. The owner's [9 October G1–G3 attestation](evidence/2026-10-09-owner-g1-g3-attestation.md)
records subsequent gate acceptance without inventing device/scenario observations;
BETA-04 remains open and unrelated statuses remain unchanged.

The [9 October alert experience correction](design/current/alert-experience.md)
governs Done, original-alert overdue, inline Alert choices and shared terminal
cards. Earlier [beta corrections](design/current/beta-fixes.md) retain four roots,
alert-first browsing, stationary covers and splash requirements.

App-owned discard/reload, list-removal, Calendar decisions and unconfirmed-action
notices share a themed confirmation. It follows the same atmosphere/brightness,
typography and action semantics as existing themed sheets. Back/cancellation
preserves drafts and pending-operation recovery; only an explicit confirming
choice executes the captured callback. A newer route cannot inherit an old choice.
Longer destructive reviews keep their existing sheet. Android permission, picker,
sharing, authorization and launcher surfaces remain platform-owned; native brief
status messages do not become extra blocking decisions.

## Release sequence

1. Offline Android alarm reliability on a signed bundled APK, Android 14+.
2. Useful one-off private beta, then polished management and recurrence.
3. Optional scoped Google Calendar integration.
4. Android daily-workflow extension: reusable workouts, Today view/widget and digest.
5. Android external assistant actions, capability-gated; AI is not a core dependency.
6. Optional Android cloud data/primary-device coordination.
7. Optional iOS 26+ port with honest capability differences.

## Required behavior

The owner's 28 October [uniform Postpone contract](design/current/postpone-chooser.md)
governs ordinary native single/member/group controls and the Reminder Details chooser.
Ordinary ringing surfaces expose Mark as done/Postpone (and their group counterparts).
Routine alerts retain Start routine/Snooze/Dismiss and their dated-session expiry.
Ordinary notifications show Mark as done/Postpone and corresponding captured group
actions. Unresolved notifications expose eligible Postpone. Notification Postpone
opens Home with the chooser after any required unlock; Agenda More > Postpone and
ordinary active-group Postpone all use that same Home chooser. Legacy Snooze intents,
non-ringing app quick actions and Snooze preferences remain supported.
Opening the chooser leaves playback and the original five-minute deadline running;
only confirmation changes the captured occurrences' next alerts. One eight-tile
layout offers 15/30/60 minutes, 24 elapsed hours, the three configured Tomorrow
clock times and a separate Custom step. The opening default remains 15 minutes.
The full-screen alarm chooser stays inside its lock-capable Activity window and
does not require navigating Home. Private Home content remains behind keyguard.

- Interface language is System default, English or Simplified Chinese. New
  installations follow supported phone languages; upgrades retain English until
  changed. Manual choice persists and synchronizes with Android's per-app language.
  All app-owned presentation, native alarms and notifications are localized offline.
  Authored/imported content, device clock preferences and durable scheduling/work
  semantics remain independent. See the [language contract](design/current/localization.md).
  Its 18 October wording correction uses contextual Chinese: 动作 for a fitness
  item, 步骤 for a General item and 日常计划 for routine destinations. Calendar
  copies use 添加 wording; marking completed work unfinished is distinct from
  opening a page or restoring Trash. These are presentation changes only.

The owner's 11 October wording correction labels every work-completion action
**Mark as done**, and captured group completion **Mark all as done (N)**, across
app pages, row/swipe accessibility actions, native alarms and private/public
notifications. Longer labels wrap at large text sizes. Internal Done command and
history identities, completion semantics and non-completion Done selecting/IME
actions stay distinct. See the [current alert contract](design/current/alert-experience.md).

The latest UX follow-up uses device-owned clock formatting in app/native alarm
presentation without changing saved times. Title quietly shows Required with
blank Save disabled. Custom repeats lead with upcoming alerts and explain only
relevant skipped-date rules. Save feedback distinguishes confirmed scheduling
from saved Blocked/Pending and preserves captured unknown retries. The four-root
bar uses a current-destination Go to sheet when full scaled labels cannot fit.
A genuine unscoped, unconstrained empty All Agenda offers Create a reminder in
place of the floating +. Native repeat boundaries and retained history stay intact.

Calendar setup follows the [compact setup and feedback contract](design/current/calendar-management.md#calendar-setup-and-feedback--14-october-2026):
account and dedicated source stay together, directional choices explain what is
added, and problems own their next action. All-day alert time is a surfaced
interactive row. Submitted setup shows saved progress and actual outcomes;
authorization launch and finished collection scanning do not mean all reminders
are synchronized. Advanced manual tools retain a separate publishing destination.

Optional [P4-A Google Calendar publishing](calendar-publishing.md) is manual per
saved unfinished reminder or supported recurring family after native review and confirmation. Connecting publishes
nothing; existing reminders are never backfilled. One account and an owned default
calendar are supported. Google receives title, notes and authored event range with
its Calendar reminders disabled; local alarms/actions remain authoritative. Durable
native jobs recover by the same event identity. Publishing alone grants no linked update permission.
[P4-B imports and linked updates](calendar-linking.md) add explicit individual
or reviewed all-event imports from owned calendars and per-field manually
confirmed resolution. The owner's follow-up makes the Start/End dates inclusive,
keeps them ordered, and removes associated/pending sources from the browser.
Import review defaults to Alarm while keeping Google reminders unless explicitly
disabled; personal timed/single-day all-day events and the
[native recurrence subset](calendar-recurrence.md) are supported. Existing
published copies require deliberate linking.

The owner's 12 October follow-up assigns automatic updates and the related status,
button, review-notice and history refinements to [P4-D](calendar-sync.md), after
P4-C recurrence mapping. It transfers ordinary compatible-field edits in
both directions automatically, using the last confirmed common values; genuine
conflicts and unresolved outcomes require manual review. Event-wide timestamps
are context, not a latest-edit-wins rule. Deliberate activation, independent local
alerts/Trash and truthful native background opportunities remain explicit. This
implementation retains historical manual links until explicit activation.
New import/link reviews select automatic sync by default and permit opting out.
Native hourly connected work is an opportunity, with Android determining execution.

The owner's next iteration, [P4-E managed Calendar sync](calendar-managed-sync.md),
adds a confirmed calendar-level setup: reuse an eligible known/named Remilo
secondary calendar or create one, automatically import ongoing/upcoming supported
events and publish eligible new reminders with a Local only override. Existing
reminders require reviewed selection; historical links keep their sources. The
continuing imported-alert default is Alarm. Initial recovery from an existing
calendar on a fresh installation uses No alert; an existing installation or a
newly created calendar uses its reviewed policy. Ownership, interrupted creation,
deduplication and saved removal decisions remain explicit. Ordinary local actions
and delivery retain P4-D's independent authority.

The Calendar attention refinement keeps healthy permission quiet, puts actual
local reminder timing first and shows review as a surfaced home action. Optional
per-reminder Sync now and recorded Calendar-only history live in collapsed Sync
details. Explicit checks show durable scoped outcomes; an unchanged agreement is
not an update, authorization is not completed synchronization, and routine
background success does not interrupt. Current issues outrank old success.

The owner's 29 October Calendar Settings correction separates that latest result
from a persistent Automatic sync **On / Paused / Off** configuration summary.
Up to date means a native-confirmed completed global check with its timestamp;
enabled permission or a per-reminder timestamp cannot prove it. Current review,
access, pending/held work, uncertain outcomes and scope changes supersede old
success. Checking is syncing; offline/queued work remains waiting. Specific
recovery stays visible, healthy Sync now stays secondary and Resume retains its
reviewed flow. Global status/Sync now cover all authorized synchronization;
managed-calendar controls leave other link permissions independent. See the
[current Settings contract](design/current/calendar-management.md#calendar-settings-status-and-controls--29-october-2026).

The owner's [Calendar hierarchy/independent Trash correction](design/current/calendar-management.md)
places a compact Calendar entry after the reminder's local Details information.
Its separate management page reads saved status until an explicit Check or review.
Confirmed Google deletion keeps the local alert, with Agenda/Details cancellation
notices and a local Trash action. Local Trash/Unlink never changes Google; restoring
either copy never reopens the other or reauthorizes old writes. A fresh reviewed
resolution is required before a suspended link resumes.

- Principal UI: React Native / TypeScript / Expo. Autonomous Kotlin engine and Room.
- Local use needs no account, network, server, Metro or active JavaScript.
- Event, due and alarm are separate. Event duration defaults to 30 minutes; due
  follows event start, alert follows due. Linked offsets move together; explicit
  independent times are preserved. All-day due boundary is next local midnight;
  default alert is 9 AM.
- Modes: Alarm, Notification, No alert. No silent downgrade of an alarm.
- The editor leads with Title and alert Date/Time before the visible mode choices.
  Ordinary linked schedules follow this primary alert edit; explicitly separate
  or non-default event/due timing and existing Calendar publication context are
  preserved. Calendar event details are optional and collapsed, and their edits
  preserve the selected alert. No alert uses Scheduled for. Opening event details
  does not publish anything. Main Details shows Event for publication context;
  other full event ranges remain accessible in Schedule details.
- Ordinary alarm Done completes the selected current occurrence and silences its delivery.
  Done all (N) completes the displayed captured session members; later arrivals
  are excluded and remain independently actionable. Snooze all and Postpone all use one common
  future target and leaves all captured work unfinished, with per-item scheduling results.
  Future recurring occurrences retain their identity/rule and scheduling. Snooze and
  Postpone remain postponements; timeout and interrupted playback remain unfinished.
  Earlier Stopped history is preserved as unfinished. Sound-preview Stop and Android
  Active Apps Stop retain their distinct meanings. Done also completes and cancels.
- Reopen clears completed and skipped state while preserving occurrence identity
  and guards. It never replays an elapsed alert; Restore retains skipped state.
- Every ordinary ringing delivery, including one re-triggered by Snooze, provides native
  Mark as done and Postpone. Single-reminder notifications include Done/Snooze from their first post;
  ordinary-only grouped notifications offer Done all/Snooze all and open native per-reminder controls.
  Ordinary Notification offers Done/Snooze without alarm audio or full-screen UI;
  posting or dismissing it never completes work. Android controls
  compact/expanded presentation, so also retain the native alarm screen.
- Quick Snooze defaults to 10 minutes and uses the current globally mirrored setting.
  New controls bind their displayed duration; committed retries keep their original
  target even after a preference change. Postpone: 15/30/60 minutes, 24 elapsed hours, tomorrow
  10 AM/2 PM/5 PM (editable), or custom. Confirm the actual future instant.
- For ordinary reminders, Postpone replaces the selected Snooze target and changes
  only the current occurrence's next alert. Routine Snooze keeps its dated-session bounds.
- Native audio session ends at five minutes from playback start. Arrivals keep
  the original deadline/sound. One sound; independently actionable members.
- Timeout leaves unresolved items unfinished with silent Snooze/Postpone actions.
  Missed is independent of overdue; overdue uses the original authored alert for
  Alarm/Notification, When for timed No alert and next local midnight after the
  scheduled date for all-day No alert. Independent Due does not override it.
- Normal callbacks up to five minutes late may ring; later ones become Missed.
  Reboot, upgrade, restore and recovery never replay past alerts or interrupted sound.
- Before first unlock: generic text, ordinary native Mark as done/Postpone, notification
  quick Snooze, protected scheduling
  data only, plus reviewed minimal non-private appearance data for bundled global
  theming. Routine Alarm uses the actions in the [weekly routine contract](design/current/weekly-routines.md#native-routine-alarm-presentation).
  Private reminder content and credentials remain credential-protected.
- Unlocked: actionable heads-up/ongoing notification where permitted. Locked:
  native alarm screen where permitted. No overlay permission or forced takeover.
- Permissions/capabilities and Test Alarm are visible; scheduling is not proof of audibility.

## Recurrence and management

- Daily/weekday/selected weekday, every N days/weeks/months, annual;
  numbered monthly day, ordinal weekday, last weekday, date/count endings.
- Preview at least three dates. Skip/edit one, this-and-following, whole series,
  pause/resume. Keep missed/postponed old occurrences independently visible.
- Floating schedules follow device zone; Calendar linkage pins a named zone with preview.
- DST gaps shift by gap size; folds use earlier offset. Invalid days/fifth weekdays/
  Feb 29 are skipped and do not consume count. Postponements remain concrete instants.
- One unified agenda contains one-off and repeating occurrences. Next/intended alert
  time sets the date group; No alert uses When. Strictly past original-alert or
  No alert boundaries determine unfinished Overdue, regardless of future Snooze/
  Postpone. Overdue sorts by its boundary then ID; other groups retain alert-anchor
  ordering. Groups are Overdue, Earlier, Today, Tomorrow and explicit future dates.
  Collapse groups without merging occurrence identities. Stopped/missed/timed-out
  reminders stay visible until resolved.
- Search, membership, overdue and Alert problems filters are local dataset controls.
  Alert problems includes Missed, Timed out, Interrupted, Blocked and Failed delivery;
  it excludes No alert, Stopped, Notification sent and Updating. Attention stays internal.
  Agenda / Lists / Completed / Trash are the four labeled roots. Lists separates
  Built-in views (Repeats) from Your lists (No list and named lists). Repeats remains
  visible when empty and is never list membership. Repeats, named lists, Settings,
  list-scoped collections and details are secondary to their invoking origin and
  retain queries/filters/scroll; sheets and IME close before navigation.
  Repeats shows one entry per family and Active, Paused and Ended filters. Family
  details retain unfinished occurrences from earlier segments. Completed and Trash
  load on demand, search titles/notes and filter by list. Their newest relevant
  completion/skip/deletion comes first; Completed has Show skipped inside Filters.
  Collection headers use icon-only Filters beside Search/More, showing an active
  optional-filter count and a complete spoken label. Agenda's content-row Filters
  retains its label, and applied removable chips remain visible on both surfaces.
  Agenda refreshes cached rows quietly on native changes, foregrounding and its
  minute-based date/status update. Only a deliberate pull-to-refresh activates
  the top refresh indicator; initial loading and pagination keep separate feedback.
  Back from a non-Agenda root returns to Agenda; secondary pages return to their origin.
  Search/sheets, draft guards and unconfirmed operations take precedence over root Back.
  Each destination retains its own filters and scroll position, including Completed
  and Trash. Details provide Activity through More, duplicate, Trash/Restore, Reopen
  and explicit occurrence/family scope actions.
- The latest 9 October R9 instruction authorizes selected-occurrence Reopen and
  Move to Trash in Completed, and Restore in Trash, overriding the earlier
  no-bulk restriction. Normal collection rows keep single Reopen/Restore in their
  three-dot menus without repeated inline buttons. Explicit selection mode adds
  separate 48 dp selection checkboxes and contextual footer actions of at least
  56 dp; terminal details retains its existing persistent action. Select all
  loaded includes only the current loaded matching records, never unloaded or
  newly paginated rows. Query/scope/Show skipped edits stay disabled while
  selecting; Back/Done selecting clears the selection before origin navigation
  unless an operation is pending or unconfirmed.
- Selected operations capture occurrence IDs/revisions and an independent native
  operation UUID per item, then submit existing guarded commands sequentially
  through the serialized mutation worker. Results are per item, not atomic. Keep
  confirmed partial outcomes, stop on an unknown reply and freeze the selected
  snapshot/remaining queue until the same unresolved command is retried and
  definitively acknowledged or rejected. Do not issue fresh operations for
  applied/unresolved items, promise rollback or invent an atomic batch Undo.
  After definitive completion, keep selection mode with the truthful summary,
  clear selected IDs and refresh; rejected items require a new deliberate action.
  Restore retains completed/skipped state; Reopen still clears both without
  replaying elapsed alerts. The owner's subsequent 9 October instruction adds
  confirmed permanent deletion for individual and selected Trash occurrences. Composition
  05's [R9 review](design/current/screens/completed-trash-activity.md) is closed by
  the explicit owner approval; actual Android acceptance remains pending.
- Lists have durable credential-protected identities, names and revisions, with
  optional single membership and No list as the default. Empty lists are retained.
  Create/Rename/Remove are explicit. New names are trimmed and case-insensitively
  unique; distinct legacy names remain intact. Rename changes metadata only; Remove
  moves all retained reminders and templates to No list without changing alert targets.
  A removed list reference is rejected. Named lists retain Agenda grouping, with
  fixed membership and access to their Completed/Trash records. Counts mean overdue
  occurrences, rather than every future occurrence of an infinite repeat.
- Active browsing cards lead with alert time or No alert, then consequential
  relative overdue/delivery information and a readable repeat indicator. No alert
  includes its scheduled When. Ringing may take visible precedence; ordinary rows
  do not repeat Missed/Timed out/Interrupted/Notification sent badges. Details and advanced
  editing retain full event/due data. Primary Agenda alert time uses the device zone.
- Browsing covers expand to 200 dp below the status inset, including a nominal
  56 dp toolbar. Artwork stays fixed while opaque content scrolls over it, ending
  at a pinned opaque toolbar. The canvas-colored header surface blends from 66%
  to opaque over the last 64 dp of cover travel, with stable onSurface title/icons
  and a 40 dp feather below measured labels/controls. Reduced motion retains the
  direct scroll relationship without timed animation. Restore content, scene
  occlusion and header opacity together. Constrained height/large text and editing
  workflows use compact toolbars. Preserve existing artwork and hero focal metadata.
- Original accessible design, dark/light themes, large text and screen readers.
- Versioned export/restore; no restored session or stale OS handle is replayed.
  Series conflicts are preserved as a whole family unless explicitly restored as
  a separate copy. Editing a paused series keeps its future ordinary alerts paused.

## Android weekly routines

The owner's 18 October [generic-routine contract](design/current/routine-creation.md)
supersedes unified creation and workout-only setup below. Create offers separate
reminder/routine destinations. New routines are empty General/ByWeekday sequences
with Day tabs; nonempty weekdays are scheduled automatically. Optional Exercise
changes fields/tools without seeding content. Copying creates independent day-specific
steps. Existing Shared plans convert only on Save, with notice and materialized IDs
preserved. Existing content and ended snapshots retain their presentation.
The daily-reset, native delivery, immediate editing and frozen-history rules remain.
CE17/DP9 and portable format9 preserve authoring intent and legacy content/imports.

The former unified editor/type selector is retired. Create opens New reminder or
New routine; /edit and /routine-edit own separate drafts. New General routines
edit independent sequences through weekday tabs; the old arrangement switch and
Days picker are retired. Exercise is an optional presentation
preset, not another task type. One parent Save commits nested draft changes.
One owning recurring reminder supplies a shared clock; immutable versions supply
ordered steps for each scheduled weekday or the internal empty Rest representation.
Ordinary reminders cannot be converted in v1. Duplication creates independent
routine and materialized weekday identities.
Use the same Alarm / Notification / No alert control as ordinary reminders.
The routine editor exposes it through a dedicated Alert row beside Date and time.
Each sheet applies only its own fields to the parent draft; parent Save persists.
Weekday labels remain centered as scheduling dots appear. Numeric target fields
guard whole/decimal entry and pair with matching outlined Unit selectors in both
builder and direct editing; free-text authored targets remain unchanged.
Notification uses a separate quiet-by-default channel; Android controls its
settings after creation. Alarm uses normal sound/vibration and access checks,
with Start routine / Snooze / Dismiss alarm. These actions do not check exercises.

Every scheduled routine is available throughout its device-local date, even before its
notification time or when created after that time. A late creation/resume/recovery
does not replay elapsed prompts. Rest days create neither actionable Agenda work
nor notifications. The UI derives repeat weekdays from the non-rest definitions.

Each closed dated snapshot freezes exercise names, free-text targets, guidance, overall
Notes, Alert/time/sound/vibration and stable identities. Each date references an
immutable plan revision; another edit using the same effective date after a clock
change cannot rewrite its content or invalidate its backup. Complete & continue checks
one exercise and advances the illustrated Focus card only after native confirmation; selecting previous
exercises changes only the view. Explicit Undo completion remains available after
the final exercise. Skip today retains partial checks and has an explicit Undo
while the day is open. Notification opening/dismissal never changes progress.
Today/future exercise rows also expose a neutral pencil + Edit control which
opens the existing fields directly, independently of Focus selection. Its single
Save edits the exact weekday/step immediately and converts legacy Shared to
independent days with notice, preserving all materialized IDs and matching checks;
adding/removing/reordering stays in the routine builder. Past rows retain checkmark correction without this
direct plan-edit control. Revision conflicts retain drafts for explicit reload.

Local midnight ends the session without making unfinished work overdue. Native
reads/actions/recovery enforce closure without requiring a midnight wake-up.
Completed sessions can appear in Completed; skips follow Show skipped. Unfinished
ended work belongs only in routine history. History corrections retain their actual
action timestamps and never reopen Agenda or delivery. The owner's 17 October
correction makes plan/Alert/time/Notes/photo changes apply immediately on Save.
Reconcile today's open definition while preserving occurrence identity, matching
stable-ID checks and intentional Skip; closed dates remain unchanged. Newly added
scheduled weekdays are available today; unscheduling removes today's actionable work.
An elapsed or already-posted prompt never replays. Pause suppresses
new dates and prompts while an existing today session can still finish.

The routine library lives within Lists. Agenda uses one ordinary compact surface
per dated routine with a compact bar and informational exercise counts, with no whole-workout Done
or completion swipe. Its informational leading ring shares the ordinary
completion-control column, keeping glyphs/titles/metadata/More aligned. A separate
progress footer adapts from inline bar/count to stacked content at narrow/large
text sizes. Calendar publication/linking is unavailable for routines.
All authored content, progress and correction records remain credential-protected.
Text is the exercise-guidance fallback until individually approved bundled
illustrations exist. No personal workout is automatically seeded on installation.
See the [routine design contract](design/current/weekly-routines.md).

## Planned Android daily workflows (before iOS)

The Android home-screen widget supports independent Routine Focus and Today
configurations. Focus offers the first unfinished exercise, target, daily count,
one primary Done action that completes the displayed exercise directly in the
native session, advances after confirmation and offers named Undo. Exercise text
shows the authored name without an added number. The header shows the localized
full weekday; the full date and original exercise position remain accessible.
Compact unfilled Undo sits to the left of trailing Done, with a reserved disabled
slot before eligibility. Enabled/disabled Undo has identical glyph size; disabled
is clearly dimmed neutral ink and cannot act. Undo can reverse multiple completions
from that widget's current dated session, newest first, one per tap, including
after final completion. It remains enabled while eligible records remain and
survives process restart. Each target must still match that widget's native
completion; changes from other surfaces are preserved. Date/session/configuration
changes discard the old history. Reminder rows and setup previews
fit both complete name/time lines with native text metrics; undersized placed
widgets use summary rather than clipping the time. Saving appears only for a pending action after 250 ms;
a brief check acknowledges confirmed native progress without delaying the next
valid action. Progress uses the app's accent/soft roles, with exactly one segment
per exercise through twelve and continuous fill above twelve. Exercise text
opens its exact dated details. Uncertain widget actions retain exact Retry. Today places an
optional pinned Focus above today's and overdue ordinary reminders from all lists;
reminder rows open their existing Details. Rest days remain informational and
unfinished ended workouts never enter the overdue list. Summary/large-text views
open Remilo for actions. Settings and routine contextual actions open native setup.
No React Native process or network is required for widget refresh, completion or recovery. Background
refresh is an OS-controlled opportunity; explicit dated actions reject stale work
even when launcher pixels are delayed. Widget IDs/configuration/actions are local
presentation state outside portable backups. See the [widget contract](design/current/home-screen-widget.md).

Widget setup always presents a preview: clearly labelled inert example content
regardless of current data, with the real app theme and visible loading/error feedback. New Focus
drafts default to the first available routine; saved unavailable selections never
retarget automatically. Real empty widgets explain their state and open Agenda.
Compact Today shows one full reminder row or the selected routine's focused
exercise, with primary Done. Healthy Focus has no reserved action footer or
permanent Refresh. A quiet bottom-left line identifies the next unfinished
exercise in compact and expanded Focus. Healthy compact Focus aligns the action
group with the bottom of the current-text/Next column, retaining optional
prescriptions. Its reserved Next line keeps controls fixed when the last exercise
has no Next and through eligible final Undo. Compact Today uses that same Focus
layout above a separate trailing Agenda link. Last/terminal/summary/compact
recovery views omit Next. Actual failed loads/conflicts or captured uncertain
actions expose their recovery control.
Rest days show one outcome and View routine without exercise completion controls.

- A broader date-aware in-app Today presentation may supplement the widget without
  requiring a new permanent tab. Native day/zone resolution remains authoritative.
- An optional configurable daily agenda notification summarizes what is due
  today and any planned workout, without becoming a second alarm. Calendar items
  may be included only after optional scoped Calendar authorization; this is
  presentation, not an additional Calendar sync implementation.
- External Android assistant commands may request a reminder or alarm via tested
  platform entry points, with a readable preview and user confirmation before
  durable creation. Gemini/Pixel, Samsung/Gemini and Bixby are independently
  supported only where their documented and tested app action surfaces permit.
  Android does not guarantee that every assistant routes to any one API.
  Unavailable assistants never block manual creation or local alarms.
- Optional natural-language drafting may start with deterministic local parsing;
  device AI, if available, can improve the draft with explicit opt-in and fallback.
  No assistant, network, inference engine or cloud account is needed for normal
  reminder operation. All external writes use the existing native validation,
  serialized mutations, stable operation identities and permission feedback.

## Deferred integrations

- Google is optional and scoped to app-managed or explicitly selected imports,
  owned calendars only. Manual publishing until explicit opt-in; backfill separate.
- Event-compatible fields synchronize. Completion, alarm sound/mode, due overrides
  and postponements stay local. Preserve independent timings and show conflicts.
- App-created Calendar reminders are suppressed; import suppression needs consent.
  Unrelated events remain untouched. Sync is eventual and never blocks local alarms.
- Cloud is optional, foreground/manual initially. One primary ringing device;
  normal handoff needs cancellation acknowledgement, offline override discloses duplicates.
  Calendar writer is separate from ringing primary.
- iOS comes last, after the Android daily-workflow acceptance gate and cloud phase. No early Swift, Xcode, AlarmKit or unused platform scaffolding.

## Confirmed boundaries

Power off, force-stop, revoked permissions, locked Private Space and OS restrictions
can prevent desired behavior. Active Apps Stop differs from force-stop. Record real
device evidence; do not claim universal OEM delivery from Pixel-only results.

No AI chat, collaboration suite, location triggers, watches, attachments, generic
calendar import or visual cloning is in the initial product.

## Presentation contract (0.4.0)

The owner's [10 October UX refinement](design/current/ux-refinement.md) supersedes
earlier presentation details below: alert-first Details/cards, explicit Search
focus, transactional filters, preserved All day custom timing and reorganized
Settings. Native timing/actions, privacy, backup and Calendar behavior are retained.

This section describes the implemented baseline, including Browse and the geometric
R. The [redesign specification](appearance-redesign.md) defines approved replacement
requirements (bottom navigation and exact supplied Classic identity); individual
plans/owner approvals govern when those changes may be implemented. Do not describe
planned presentation as already shipped or discard baseline behavioral guarantees.

- Neutral light/charcoal surfaces and blue primary actions. Green/amber/red are
  status accents with text and icons; permissions never imply guaranteed audibility.
- Familiar icon app bars and one Add floating button. Minimum 48 dp interaction
  targets; content grows/scrolls for large text. No bottom navigation is required.
- Reminder rows lead with title and event time, supporting due/delivery text and
  a labeled completion action at the trailing edge. Completion is separate from
  contextual deletion. Optional swipe completion has a visible equivalent. Undo
  reopens only the captured completed revision; a later change is not reversed.
  Unfinished Trash requires confirmation explaining alert cancellation. A completed
  occurrence can be moved to Trash directly through its menu or swipe reveal and tap.
  Revision-guarded Undo restores only the captured deletion. Restore preserves prior
  completed/skipped state and never replays elapsed alerts. Trash stays in the local
  installation until restored or explicitly permanently deleted; no automatic expiry. The latest
  owner-directed selected-occurrence actions above supersede the old no-bulk
  restriction without introducing Empty Trash.
  Backups exclude one-off Trash but retain recurring deletion exclusions.
  Trash row menus and deleted-reminder details offer Delete permanently; selection
  mode offers Delete selected permanently for only captured loaded occurrences.
  Both require a confirmation explaining content/activity removal and no Undo or
  Trash Restore. A repeating plan and other occurrences remain intact. Native Purge
  requires the captured deleted revision, atomically removes the reminder/activity/
  pending content schedule and retains content-free identity exclusions and exact
  retry receipts. Local recovery and older backup imports into the same installation
  cannot resurrect that identity by default; an explicitly requested backup copy
  has a separate identity. Existing
  exported files are unchanged. Backup format 9 retains minimal repeating exclusions,
  weekly plans, dated progress and correction history, and adds private exercise
  photos, authoring/preset metadata, structured targets and whole-routine Trash. Formats 1–8 remain
  readable. Unknown replies keep the existing command/batch
  guards; retry uses the same operation, and batches report confirmed partial results.
- One editor supports one-off/repeat creation. Common repeat rules precede Custom
  repeat; independent due/end/all-day/zone controls are advanced. Drafts apply only
  on explicit Save. Unsaved drafts require a discard confirmation. Pending saves
  remain retryable, rather than issuing a different uncertain operation.
- Saving a new reminder returns to Agenda, or its originating list, with contextual acknowledgement and an
  optional View action. Saved-but-blocked and pending scheduling remain visible;
  acknowledgement never proves audibility. One-off Edit opens the editor directly;
  repeating Edit asks for scope. A stale editor retains the local draft for review
  against current native content, including conflicts in timing and recurrence.
  If its series segment was replaced, offer current-family reload or a separate copy.
- Time zones are selected by city/region with the offset at the edited date; raw
  IANA identifiers remain supporting information. Pinned fields display in that
  zone. Changing the zone preserves authored wall times and resolves through the
  native gap/fold policy. Merely opening or saving untouched fields preserves their
  original instants. Linked event/due/alert offsets and independent times stay explicit.
- Reminder details lead with alert mode/time and consequential state. Event is
  visible for all-day, differing alert timing or existing publication context;
  hidden full range stays in Schedule details. Independent/non-default Due stays
  visible, including independent coincident timing. Ordinary linked timing is
  concise; independent relationships, adjustments, consequential zones and occurrence
  exceptions have Schedule details. All-day linked Due reads By end of day. A stopped,
  missed, interrupted or timed-out target is never described as a future alert.
  Overdue means still unfinished past the original alert or No alert boundary.
  Done silences and completes; historical Stopped outcomes remain unfinished.
  Completed timestamps come from recorded Done events, never sorting fallbacks.
  Activity renders only recorded events and meaningful targets; empty history says
  No recorded activity and does not claim a complete audit trail.
  Done/Reopen/Restore stay persistent for their states. Ringing ordinary Reminder Details exposes only
  Mark as done and Postpone; Postpone opens the uniform chooser.
  Custom Postpone starts with a future target and rejects past targets without mutation.
- Android Back exits transient Agenda search; clearing its query is a separate
  action. Nested sheets handle Back within their draft. Loading, retry, action
  progress and failures are visible. Reduced motion, large text and screen-reader
  focus are supported; timed feedback respects accessibility timeout preferences.
- Settings order is Sound & vibration, Snooze & postpone, Appearance, Permissions
  & alarm check, Google Calendar, Backups and Help. The compact alarm-check page
  owns permission/Test workflow. Valid preferences save automatically, serially,
  with one captured recovery beside the owning group even after closing a sheet.
  Permission observations refresh on return and never establish audible delivery.
- Settings and editor share explicit radio selection and separate Play/Stop controls
  for Remilo tone and System alarm tone. Preview never selects or saves a tone.
  Editor sound/vibration are Alarm options, separate from Schedule options. Preview
  is identified, native-owned, bounded to five seconds and stopped on close, Back,
  navigation or background. Real alarms take priority. Playback feedback comes from
  native Starting/Playing/Ended/Interrupted/Failed state and reports packaged fallback.
- Restore applies one selected backup as a whole. New reminders and lists,
  including empty lists and entries outside the visible preview page, are included
  automatically. Existing identities stay unchanged; explicit **Keep existing** /
  **Add a separate copy** choices only decide whether to add the backup version
  under a new identity. Conflict detection uses stored identity, not title matching.
  These controls edit the draft preview and perform no import until Restore is
  confirmed. The app distinguishes reading a file from importing its preview. An unconfirmed
  import freezes its backup, copy selection and operation ID until the same restore
  is acknowledged or rejected. It cannot be abandoned through ordinary navigation
  or replaced with another selection during that uncertainty. Diagnostics provide
  visible refresh/retry/share feedback without claiming a share sheet sent a report.
- Creation/editing exposes Alarm/Notification/No alert inline, defaulting to Alarm.
  This default applies to ordinary reminders; direct new-routine entry defaults
  to Notification, while a new-draft type switch preserves its selected Alert.
  The visible single-selection group adapts to large text without a mode sheet;
  alarm sound/vibration only appears for Alarm. Draft/save guards remain intact.
- Completed/skipped/Trash use the same card geometry and borderless 48 dp More target
  as Agenda. They have one terminal state label and no completion control or empty
  placeholder; explicit selection mode retains selection checkboxes. Preserve
  historical schedule/alert, independent Due, details navigation and existing menus.
- Ordinary completion/Postpone controls never start React Native. Routine Start
  opens the dated app session after confirmed dismissal and unlock. A confirmed ended session dismisses
  when no submitted command remains unconfirmed, including timeout/external
  termination. An unknown submitted command retains its frozen recovery view.
  An initial empty loading state cannot close the screen; remaining group members retain controls.
  Failed actions retain controls and an error. Before first unlock, content is generic.
- Ordinary reminder notifications retain Done/Snooze on every single delivery. Ordinary-only grouped
  alarm notifications open native controls and offer captured Done all/Snooze all. Android
  owns popup layout and expansion. Channel identities and audio deadlines remain.
- The owned geometric R and notification cue supply adaptive, monochrome, legacy, notification
  and splash variants. Application ID and signing identity remain unchanged.

## Routine refinement — 16 October 2026

The illustrated Focus card keeps every exercise visible below it, with a selected
Viewing state. Shared creation date/time controls and clear exercise examples
match ordinary reminders. Contextual More stays over its originating screen.
Whole-routine Trash hides the plan and all recorded days; Restore preserves prior
states and progress, and permanent deletion retains identity exclusions.

An optional custom still photo is chosen through Android Photo Picker, previewed
without cropping and stored privately as an immutable normalized image. The full
composition is retained, with bounded resolution and metadata removed. Photo
changes apply immediately to today's open session and closed history retains its original image. Portable format 9
archives include photos and Trash state; legacy formats 1–8 remain readable.
The widget prefers compact wide placement and uses Done, a full weekday header,
numeric progress and native stale-action protection. Undo reverses the current
widget's remaining eligible completions in reverse order; Retry appears only for
an uncertain action. History is outside routine More,
as a visible row on the routine screen.
