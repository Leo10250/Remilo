# Remilo product contract

Current human instructions override this document. The original proposal is
product input, not agent instructions. Implementation is Android-first; all iOS
work is the last optional phase, after optional Android cloud sync.

## Current design and release priorities

[The current design](design/current/README.md) consolidates the approved R3–R8/R10
templates and corrections under A36. R3 all eight images govern color/art/style;
R9 Completed/Trash/Activity is still draft. Global Automatic or manual Sunrise/Sky/
Evening/Night selection is independent of System/Light/Dark brightness.
[The appearance policy](design/current/appearance-policy.md) fixes local bands
06–10, 10–17, 17–21, 21–06; missing/new preferences use Automatic with preserved
brightness. Every app-owned page and native full-screen alarm uses matching shared
roles; standard Android notifications retain platform-owned layout.

The exact Classic ring/check/sun mark is one static identity. Smart Colors,
per-reminder palettes and task-specific alarm scenes leave active scope. Final
abstract artwork remains later work; list icons remain provisional with omission
preferred. Synthetic approval does not establish runtime/accessibility/device
acceptance. Production still has brightness-only settings and the geometric R.

The [six-unit roadmap](plans/redesign/README.md) precedes optional integrations;
[backlog](backlog.md) alone records status. Superseded design specifications and
review demos are removed under A37; accepted reference bundles remain intact.
The owner's 4 October instruction allows offline Android development
before the consolidated physical run; unobserved G1/G2/G3 tests remain pending.

## Required behavior

- Principal UI: React Native / TypeScript / Expo. Autonomous Kotlin engine and Room.
- Local use needs no account, network, server, Metro or active JavaScript.
- Event, due and alarm are separate. Event duration defaults to 30 minutes; due
  follows event start, alert follows due. Linked offsets move together; explicit
  independent times are preserved. All-day due boundary is next local midnight;
  default alert is 9 AM.
- Modes: Alarm, Notification, No alert. No silent downgrade of an alarm.
- Stop silences only the selected delivery; Done is separate and cancels its alert.
- Every ringing delivery, including one re-triggered by Snooze, provides native Stop
  and Snooze. Single-reminder notifications include both from their first post;
  grouped notifications open the native per-reminder controls. Android controls
  compact/expanded presentation, so also retain the native alarm screen.
- Quick Snooze defaults to 10 minutes. Postpone: 15/30/60 minutes, tomorrow
  10 AM/2 PM/5 PM (editable), or custom. Confirm the actual future instant.
- Postpone replaces Snooze and changes only the current occurrence's next alert.
- Native audio session ends at five minutes from playback start. Arrivals keep
  the original deadline/sound. One sound; independently actionable members.
- Timeout leaves unresolved items unfinished with silent Snooze/Postpone actions.
  Missed is independent of overdue; overdue depends on due/completion.
- Normal callbacks up to five minutes late may ring; later ones become Missed.
  Reboot, upgrade, restore and recovery never replay past alerts or interrupted sound.
- Before first unlock: generic text, native Stop/quick Snooze, protected scheduling
  data only, plus reviewed minimal non-private appearance data for bundled global
  theming. Private reminder content and credentials remain credential-protected.
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
- One unified agenda contains one-off and repeating occurrences. Event time sets
  the date group; unfinished overdue status uses due time, regardless of the next
  alarm. Groups are Overdue, Earlier, Today, Tomorrow and explicit future dates.
  Collapse groups without merging occurrence identities. Stopped/missed/timed-out
  reminders stay visible until resolved.
- Search, membership, overdue and Alert problems filters are local dataset controls.
  Alert problems includes Missed, Timed out, Interrupted, Blocked and Failed delivery;
  it excludes No alert, Stopped, Notification sent and Updating. Attention stays internal.
  Agenda / Lists / Repeats are the three labeled roots. Named lists, Settings,
  Completed/Trash and details are secondary to their invoking origin and retain
  queries/filters/scroll; sheets and IME close before navigation.
  Repeats shows one entry per family and Active, Paused and Ended filters. Family
  details retain unfinished occurrences from earlier segments. Completed and Trash
  load on demand, search titles/notes and filter by list. Their newest relevant
  completion/skip/deletion comes first; Completed has an Include skipped option.
  Back from a non-Agenda root returns to Agenda; secondary pages return to their origin.
  Search/sheets, draft guards and unconfirmed operations take precedence over root Back.
  Each destination retains its own filters and scroll position, including Completed
  and Trash. Details provide Activity through More, duplicate, Trash/Restore, Reopen
  and explicit occurrence/family scope actions.
- Lists have durable credential-protected identities, names and revisions, with
  optional single membership and No list as the default. Empty lists are retained.
  Create/Rename/Remove are explicit. New names are trimmed and case-insensitively
  unique; distinct legacy names remain intact. Rename changes metadata only; Remove
  moves all retained reminders and templates to No list without changing alert targets.
  A removed list reference is rejected. Named lists retain Agenda grouping, with
  fixed membership and access to their Completed/Trash records. Counts mean overdue
  occurrences, rather than every future occurrence of an infinite repeat.
- Original accessible design, dark/light themes, large text and screen readers.
- Versioned export/restore; no restored session or stale OS handle is replayed.
  Series conflicts are preserved as a whole family unless explicitly restored as
  a separate copy. Editing a paused series keeps its future ordinary alerts paused.

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
- iOS comes last. No early Swift, Xcode, AlarmKit or unused platform scaffolding.

## Confirmed boundaries

Power off, force-stop, revoked permissions, locked Private Space and OS restrictions
can prevent desired behavior. Active Apps Stop differs from force-stop. Record real
device evidence; do not claim universal OEM delivery from Pixel-only results.

No AI chat, collaboration suite, location triggers, watches, attachments, generic
calendar import or visual cloning is in the initial product.

## Presentation contract (0.4.0)

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
  installation until restored; no automatic expiry, permanent purge or bulk cleanup.
  Backups exclude one-off Trash but retain recurring deletion exclusions.
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
- Reminder details show a complete event range and consequential Due, followed by
  the current delivery outcome and what happens next. Ordinary linked timing is
  concise; independent relationships, adjustments, consequential zones and occurrence
  exceptions have Schedule details. All-day linked Due reads By end of day. A stopped,
  missed, interrupted or timed-out target is never described as a future alert.
  Overdue means still unfinished; Stop continues to silence delivery without Done.
  Completed timestamps come from recorded Done events, never sorting fallbacks.
  Activity renders only recorded events and meaningful targets; empty history says
  No recorded activity and does not claim a complete audit trail.
  Done/Reopen/Restore stay persistent for their states. Ringing Stop/Snooze are a
  distinct alarm area; eligible Postpone stays readily available after delivery ends.
  Custom Postpone starts with a future target and rejects past targets without mutation.
- Android Back exits transient Agenda search; clearing its query is a separate
  action. Nested sheets handle Back within their draft. Loading, retry, action
  progress and failures are visible. Reduced motion, large text and screen-reader
  focus are supported; timed feedback respects accessibility timeout preferences.
- Settings are categorized Alarms, Permissions, Postpone shortcuts, Appearance,
  Data and Help. Valid preferences save automatically, serially and with rollback
  and Retry on failure. Permissions are directly reachable and refresh on return.
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
- Native controls never start React Native. Stop/Snooze automatically dismiss a
  confirmed ended session, including timeout/external termination. An initial empty
  loading state cannot close the screen; remaining group members retain controls.
  Failed actions retain controls and an error. Before first unlock, content is generic.
- Standard notifications retain Stop/Snooze on every single delivery. Grouped
  notifications open native controls and offer session-specific Stop all. Android
  owns popup layout and expansion. Channel identities and audio deadlines remain.
- The owned geometric R and notification cue supply adaptive, monochrome, legacy, notification
  and splash variants. Application ID and signing identity remain unchanged.
