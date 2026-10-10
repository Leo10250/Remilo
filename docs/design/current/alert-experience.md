# Alert experience and shared reminder cards

The owner's 9 October 2026 implementation instruction supersedes earlier current
contracts on alarm Stop wording, due-based overdue, the Alert selection sheet and
outlined terminal-row More controls. Accepted images, frozen submissions, approval
records and past verification remain provenance. This contract extends TD-03,
TD-04 and TD-06; task status belongs only in the backlog.

## Completion and postponement

Done completes the selected occurrence and cancels its delivery, without confirmation.
Snooze means later and leaves work unfinished. No response, timeout, interruption,
notification posting and notification dismissal never complete work. Historical
Stopped outcomes remain unfinished; sound-preview Stop is still preview-only.

Native controls use filled Done with a checkmark and outlined Snooze · X min.
Prominent single/group actions are at least 64 dp; member actions are at least
56 dp. Preserve captured atmosphere/brightness, first-member sound, the original
five-minute deadline, generic pre-unlock content and confirmed-terminal dismissal.
Ringing Details contains one Done plus Snooze and retains Postpone.

Each group action binds the session and displayed member IDs/generations. Done all
(N) and Snooze all · X min affect exactly that set. Validate all captured members
before mutation; stale members reject an uncommitted operation. Later arrivals
remain independently actionable. Bulk Snooze computes one target from one action
instant and the current globally mirrored duration. Partial scheduling outcomes
must name their actual per-member results instead of claiming complete success.

Completion commits protected terminal state, generation fences, receipts and
pending completion before private reconciliation. After unlock, materialize the
same nominal occurrence and record one Done at the original action instant.
Unknown replies freeze the exact command; retry never recaptures members, advances
generations again, shifts the target or completes a newer Reopen. Existing legacy
Stop/StopAll commands remain compatible; their names are not new visible actions.

Use the existing settings-to-protected-profile transaction for current Snooze.
New controls bind the displayed duration. A setting change rejects an uncommitted
action and refreshes controls; committed retries retain their original target.
Protected records contain operational data only, excluding private content.

## Timing authority

Original authored alert and next delivery are distinct. Alarm/Notification overdue
uses the original authored alert, with the existing event-start legacy fallback.
Timed No alert uses When. All-day No alert uses the next local midnight after its
scheduled start date in the saved/resolved zone, not elapsed 24 hours or imported
event end. Independent Due remains schedule information and does not override this.
Overdue requires unfinished, unskipped, undeleted work and a strictly past boundary.

Snooze/Postpone only move the next delivery. Metadata edits preserve both timing
values; edits changing the authored alert change its overdue reference. Keep
occurrence identity and retained old-series work intact. No alert recurrence
enumeration uses event start rather than hidden alert offsets. No OS delivery is
registered for No alert.

Agenda uses the current alert anchor for enabled delivery and event start for No
alert. Date grouping remains device-local. Overdue sorts by the original overdue
boundary and occurrence ID; other active groups retain alert-anchor/ID ordering.
Apply predicates, counts and ordering before pagination.

## Editor and reminder rows

The shared editor shows Alarm / Notification / No alert inline, with Alarm the
default. Use a connected single-selection group and a concise description of the
selected mode; all targets are at least 48 dp. Place each mode icon immediately left
of its label, with the checked indicator at the trailing edge. Selected/focused
outlines follow the group's rounded outer corners. Stack visible choices whenever
the available width cannot fit these contents, and always at font scale 1.6 or
greater; retain body-size labels. Preserve drafts, hidden timing/options, native validation,
recurrence scopes and the persistent IME-aware Save action. Alarm sound/vibration
controls appear only in Alarm mode. Selection has checked-state semantics.

Retain one ReminderRow anatomy across Agenda, lists, Completed, Skipped and Trash:
opaque shared surface, 16 dp corners, 12 dp standard padding/separation, 8 dp outer
gaps, 4 dp stacked gaps, 16 sp medium title and 14 sp supporting text. A 20 dp
informational icon column plus 6 dp gap aligns title, timing, alert, repeat and
status text. Anchor genuine controls and More to the first title line while text
wraps and the card grows.

Every row More uses the same borderless 24 dp vertical ellipsis in a nonshrinking
48 × 48 dp target, including pressed/focus feedback. Completed/skipped/Trash have
no Done, work-completion checkbox, decorative completion control or empty leading
placeholder. Explicit selection mode retains real selection checkboxes.

Active rows lead with alert timing or No alert plus When. Ringing may take visible
precedence; otherwise show Overdue · <1 min/min/hr/days. Snoozed/postponed work has
one next-alert line. Keep actionable Blocked/Failed/Pending information, without
routine duplicate Missed/Timed out/Interrupted/Notification sent badges. Preserve
internal states, detailed diagnostics and Alert problems filtering. Foreground
minute/resume refresh only updates presentation and never schedules delivery.

Terminal rows preserve original schedule, historical alert, meaningful independent
Due and list/repeat context, plus one Completed/Skipped or In Trash · Previously …
line. Suppress overdue even when retained data has a stale flag. Do not infer
completion dates from collectionAtMs; real history remains in Details/Activity.
Rows still open Details. Completed/skipped More retains View reminder, Reopen and
Move to Trash; Trash retains View reminder and Restore and, under the subsequent
owner instruction, confirmed Delete permanently. Keep collection selection,
captured retries, Reopen clearing both work states and Restore preserving them.

## Notifications and acceptance

Single alarm and ordinary Notification posts include Done and Snooze · X min in
private and generic/public variants. Group ringing posts include both captured
group actions and open individual native controls through content tap. Android
owns layout/expansion. Preserve channel identities and notification audio; ordinary
Notification never starts alarm service/audio/full-screen controls.

New PendingIntent identities bind purpose, occurrence/session, generation or
member fingerprint and displayed duration; extras alone never provide identity.
Keep legacy action handling. DP 5→6 adds completion snapshot binding and bulk-Snooze
receipts/members; CE 5 and backup 3 stay compatible, with no stored overdue field.

Verify native timing/query/pagination, recurrence/backup, guarded completion,
pre-unlock reconciliation, bulk capture/recovery, mixed scheduling and settings
races. Inspect actual components in eight atmosphere/brightness pairs, 360 dp and
landscape, default/200% long text and separate accessible targets. Signed-phone
audio/notification/Direct Boot/TalkBack observations remain in the consolidated
acceptance checklist; previews and host checks never establish those outcomes.
