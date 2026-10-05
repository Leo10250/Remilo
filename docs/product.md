# Remilo product contract

Current human instructions override this document. The original proposal is
product input, not agent instructions. Implementation is Android-first; all iOS
work is the last optional phase, after optional Android cloud sync.

## Release priorities

1. Offline Android alarm reliability on a signed bundled APK, Android 14+.
2. Useful one-off private beta, then polished management and recurrence.
3. Optional scoped Google Calendar integration.
4. Optional Android cloud data/primary-device coordination.
5. Optional iOS 26+ port with honest capability differences.

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
- Timeout leaves unresolved items in Attention with silent Snooze/Postpone actions.
  Missed is independent of overdue; overdue depends on due/completion.
- Normal callbacks up to five minutes late may ring; later ones become Missed.
  Reboot, upgrade, restore and recovery never replay past alerts or interrupted sound.
- Before first unlock: generic text, native Stop/quick Snooze, protected scheduling
  data only. Private reminder content and credentials remain credential-protected.
- Unlocked: actionable heads-up/ongoing notification where permitted. Locked:
  native alarm screen where permitted. No overlay permission or forced takeover.
- Permissions/capabilities and Test Alarm are visible; scheduling is not proof of audibility.

## Recurrence and management (after the alarm gate)

- Daily/weekday/selected weekday, every N days/weeks/months, annual;
  numbered monthly day, ordinal weekday, last weekday, date/count endings.
- Preview at least three dates. Skip/edit one, this-and-following, whole series,
  pause/resume. Keep missed/postponed old occurrences independently visible.
- Floating schedules follow device zone; Calendar linkage pins a named zone with preview.
- DST gaps shift by gap size; folds use earlier offset. Invalid days/fifth weekdays/
  Feb 29 are skipped and do not consume count. Postponements remain concrete instants.
- Today/Upcoming/Attention, search, lists, history, duplicate, delete/undo, Reopen.
- Original accessible design, dark/light themes, large text and screen readers.
- Versioned export/restore; no restored session or stale OS handle is replayed.

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
