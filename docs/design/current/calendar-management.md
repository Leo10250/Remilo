# Calendar management — owner-approved 12 October 2026

The owner approved independent deletion, a separate management screen, and
cancellation notices in both Agenda and Details. This correction governs P4-B
presentation and supersedes the earlier placement of full Calendar status before
the reminder title. Task status belongs only in the backlog.

## Hierarchy and navigation

Details order is Title, primary alert time, local operational state/permissions,
conditional concise Calendar exception, Event/Due, Repeat, List/Notes, Schedule
details, then a compact Google Calendar navigation row. Existing persistent local
actions retain their behavior. The row uses shared neutral icon/chevron geometry;
normal status says Linked with the last actual observation, never Synced.

The separate compact Calendar management page shows the reminder context, original
account/calendar, last observation and later failed attempt, manual review policy,
current outcomes and an initially collapsed operation history. Opening it performs
local reads only. Check is explicit and may be abandoned; Back ignores late UI
results. Review performs its own fresh native preview. Terminal records permit
checks without editing or reopening. Unlink is a visible neutral action here and
remains a shortcut in Reminder actions. Unknown mutations retain captured recovery.

## Independent copies and cancellation

Google deletion never stops Remilo delivery. Once observed, active Agenda rows
show Google event deleted with mode-specific local consequences and spoken text.
Details shows the actual scheduled/postponed/intended/ringing/elapsed presentation,
not a promise of audibility, plus Move reminder to Trash and Calendar details.
Completed/skipped/trashed reminders retain the remote condition inside read-only
context. Offline failures preserve the last known deletion. Missing/inaccessible
responses say unavailable rather than deleted. Fresh remote availability clears
the cancellation notice but requires confirmed review before linked updates resume.

Unlink keeps both copies, local scheduling and existing Google reminder settings.
Its confirmation identifies those effects and conditionally explains that a sent
request may still finish. Relinking needs fresh identity/ownership/field review.
Local Trash cancels Remilo delivery only; shared Trash/Purge confirmation states
Google Calendar will not be changed. Restore retains work state and never replays
past alerts or previously approved Google writes. No automatic deletion/restoration
or Google reminder restoration is introduced.

Individual and all-event import explain that the reminder has its own alert and
that deleting Google does not stop it. Default Alarm, future-time validation,
explicit Google reminder consent and per-side outcome reporting are unchanged.

## Appearance, accessibility and rationale

Use the approved eight atmosphere/brightness pairs, connected geometry, at least
48 dp targets, wrapping 56 dp primary review actions and current device clock
formatting. Preserve long English/Chinese, 200% text, landscape, reduced motion,
keyboard and Back behavior. Routine Calendar administration stays secondary;
an actionable exception is concise and follows primary local timing.

This applies [Material 3 Expressive's emphasis on core journeys](https://design.google/library/expressive-material-design-google-research),
[Android secondary-action guidance](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
and [Apple hierarchy/progressive disclosure guidance](https://developer.apple.com/design/human-interface-guidelines/layout).
Placement and independent deletion are owner-approved Remilo decisions; the sources
do not experimentally prescribe this exact cross-app behavior.
