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
normal status distinguishes Linked · Manual updates and Linked · Automatic sync.
Successful sync, remote observation and failed attempts remain separate facts.

The separate compact Calendar management page shows the reminder context, original
account/calendar, last successful sync, last observation and later failed attempt,
the shared sync policy and current problems. Opening it performs local reads only.
Foreground synchronization is independent of navigation. Check is explicit for
manual/read-only context and may be abandoned; Back ignores late UI
results. Review performs its own fresh native preview. Terminal records permit
checks without editing or reopening. Unlink is a visible neutral action here and
remains a shortcut in Reminder actions. Unknown mutations retain captured recovery.

[P4-D](../../calendar-sync.md#status-buttons-and-review-notices) distinguishes
Not linked, manual links, automatic links, pending work, true conflicts, paused
relationships and unknown sent writes. Review changes is prominent when needed;
Sync now and Check update result have phase-specific meanings. Neutral outlined
Unlink with an unlink symbol occupies its own lower group. Open in Google Calendar
is a wrapping external-link text action near source information, with at least
48 dp height. Review confirmations retain 56 dp targets. Management has no
Previous Calendar operations section; confirmed user history appears in Activity.

Agenda retains its filters while an unfiltered count opens a secondary Calendar
review queue. A repeating family counts once, with affected occurrence scopes
and current local alert consequences. Quiet grouped review notifications open the
current queue and never apply a resolution. Dismissal does not clear saved issues.

The [P4-E managed-calendar extension](../../calendar-managed-sync.md) adds explicit
setup and policy review before automatic calendar creation/import/publication.
Settings shows the bound calendar and actual setup phase, selected import/export
behavior and initial recovery alert consequences. Existing calendar candidates,
unknown creation results and access/ownership problems receive specific recovery
actions. The review queue distinguishes incoming events that have not yet become
reminders from existing reminder problems; a recurring family counts once.
Captured work and confirmed outcomes remain separate. Local only preserves both
copies and delivery while stopping applicable transfers/re-adoption. This adds no
full administrative block before Details' primary local reminder information.

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
