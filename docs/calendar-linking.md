# P4-B: explicit Calendar import and manually linked updates

The owner's 12 October 2026 implementation instruction activates this scope after
P4-A sign-off. Task status belongs only in [backlog.md](backlog.md).
[P4-A publishing](calendar-publishing.md) continues to create deliberate copies;
existing copies do not become linked automatically.

## User contract

Settings → Google Calendar → Import from Google Calendar browses one owned source
calendar independently of the default publishing destination. Account and source
are visible. The browser labels **Start date** and **End date**, includes both
dates, and keeps the earlier date first when either picker changes. It initially
covers today through 29 days later (30 included local days), accepts ranges of
1–366 days, and loads 100 server results per page. The native Google query retains
its exclusive next-day upper bound; civil-day arithmetic handles DST boundaries.
Unsupported rows explain their restriction; an empty supported page never hides
a next page. Query/account changes invalidate earlier cursors/results. Browsing
does not create reminders or modify Google. Retained associations, erased sources
and captured unresolved imports are hidden, including when returning to a cached
browser. Their status/recovery lives in Calendar settings and Details. Detached
sources stay hidden and can be explicitly relinked from the existing reminder.

The owner's follow-up authorizes **Import all** alongside individual import. This
reads every page of the selected range, skips unsupported/already-associated/
pending events, and shows the complete eligible count before confirmation.
The review defaults to Alarm/No list/keeping Google reminders, permits common
choices and per-event Title/alert/reminder overrides, and rejects elapsed alerts
until a future time or No alert is explicitly chosen. Large sets require narrowing
the range rather than silently importing a partial list; one review is bounded
to 500 eligible events. The row browser's Load more does not limit Import all.

Each imported entry is a personal, non-recurring event without attendees. Timed and
single-day all-day events are supported. Meetings/incomplete attendee data,
recurring masters/instances, locked/private-copy/special/cancelled events,
unspecified ends, multi-day all-day ranges, malformed dates and incompatible or
unsupported zones cannot be imported. Oversized titles/notes require correction
in Google, rather than silent truncation. A missing title is Required and may be
filled locally. Imported descriptions are plain data.

Review defaults to Alarm, No list, current global sound/vibration and **keeping
Google reminders**. Timed Due/Alarm start at event start; all-day Due uses next
local midnight and Alarm uses 9 AM. Event/end instants and the named event zone,
falling back to the calendar zone, are preserved. The reminder is pinned.
An elapsed proposed alert requires a deliberate future time or No alert.
A changed alert time becomes independent. Save reports native Scheduled,
Blocked/Pending or Applied; it never substitutes another alert mode.

An unchecked Disable this event's Google reminders option is independent of the
Remilo alert mode, including No alert. Review warns when
both apps may alert. Suppression is a separately captured, conditional Google
change after local creation. Blocked/Pending scheduling defers suppression until
an explicit retry succeeds. Disconnect/Unlink never restores Google reminders.

## Linked review

Imported events receive a retained source association. Published copies require
Enable linked updates. Initial adoption compares current local/Google values;
there is no invented historical baseline for an old publication.

The owner's subsequent [Calendar management correction](design/current/calendar-management.md)
keeps Title/local alert first in Details. A compact Google Calendar row follows
Schedule details and opens a separate management page with explicit Check,
review, Google link and visible Unlink; Reminder actions retains its shortcut.
Opening local pages reads saved metadata only. Check/preview reads never apply
compatible fields. Completed/skipped/trashed records allow read-only checks.

Confirmed Google deletion keeps the reminder and its exact local alert, including
Snooze/Postpone. Agenda shows mode-specific cancellation metadata; Details adds a
state-aware notice with local Trash and Calendar details. A failed/offline check
preserves that observation. An ambiguous 404 means unavailable, not deleted.
Restored Google events require fresh reviewed resolution before updates resume;
they never reopen terminal local work. Local Trash cancels only Remilo delivery;
Restore preserves work state, never replays elapsed delivery and does not revive
old writes. Unlink keeps both copies and never restores Google reminders.

Title, Notes and Schedule have separate Remilo/Google choices. Schedule includes
start, end, all-day and named zone as one unit. Equal values are selected locally;
one-sided changes select the changed side against the last confirmed baseline;
different changes on both sides require a choice. Initial adoption without a
common baseline requires choices for every differing group. Confirmation shows
the resolution and applies it to both sides.

Only title/notes/event range/zone transfer. Local completion/list/mode/sound/
vibration, independent Due/Alarm and Snooze/Postpone stay local. Linked timings
follow the chosen schedule using existing validation. A current future
postponement target survives inbound authored schedule changes. Changed local
revision/generation or a ringing session rejects application. New elapsed
authored alerts are rejected rather than replayed.

Removed/cancelled/newly unsupported events suspend review; local reminders stay.
No remote deletion or replacement creation is introduced. Unlink fences future
writes and retains source identity. The same event cannot accidentally import a
second reminder; detached existing reminders can be explicitly relinked.

## Native authority, storage and recovery

Content schema 7→8 adds CE-only calendar_links and calendar_link_operations;
8→9 adds structured remote observations, original account labels and required
review state. Migration initializes unknown availability without interpreting old
messages, retains historical attempt time and performs no Google work.
DP remains 6; portable backup remains 4. Existing publication tables/jobs/receipts
are retained unchanged and upgrade performs no linking, backfill or network work.
Calendar associations/snapshots/jobs/credentials are excluded from backups.
Ordinary imported content remains portable; separate restored copies are unlinked.

One worker owns local mutations. Import commits reminder, association, receipt,
operation checkpoint and pending scheduling in the same CE transaction, with
one durably allocated occurrence ID. Linked edits reuse native validation,
generation fencing and the pending projection with an internal preserve-adjustment
policy. Calendar I/O and authorization run separately and cannot block alarms.

The bridge adds event listing, import/link/update previews, saved links and
operations. Commands capture a native preview ID, operation UUID and field
selections, never arbitrary Google JSON from JavaScript. Previews are bounded,
native-owned and expire after ten minutes. `checkCalendarLink` records structured
availability and comparisons without advancing the baseline or scheduling.
Observation commits validate connection/source/link/content revisions after I/O.
Deletion tombstones are inspected before field mapping; explicit deleted-resource
errors differ from generic/expired-sync 410 responses. Recovery modes distinguish
retry from read-only confirmation of an already-sent outcome.
Saved operations retain immutable
identity/content and separate local status/remote progress across process death.

ImportCalendarEvents captures all reviewed per-event jobs plus one immutable
batch receipt in a single CE transaction, before dispatching any Calendar I/O.
The receipt retains only a request hash and allocated child operation IDs.
Retrying a lost batch acknowledgement returns those same jobs; different input
with its operation ID is rejected. Each child's existing local/remote phases
report actual outcomes independently. Startup performs no batch network work;
saved child operations retain explicit manual recovery. CE is now 9/DP 6/backup 4.

Before local application, revalidate the original account, ownership, event
eligibility, etag, compatible fields and local guards. Sparse Google patches send
If-Match and leave unrelated properties untouched. For URLConnection variants
without direct PATCH, use Google's documented POST + X-HTTP-Method-Override:
PATCH fallback. HTTP 412 requires new review; tokens/private response text never
enter logs, JavaScript or durable storage.

Local commit precedes optional remote patch. There is no cross-service atomicity
or rollback promise. Capture acknowledgements do not establish remote success.
Unknown replies freeze the original operation; retry reads the same remote
identity, skips acknowledged local work and confirms matching intended fields
before another write. A changed precondition becomes Conflict. Permanent
rejections permit a new deliberate review; Blocked/NeedsAccess/Unconfirmed retain
the same operation. Startup resumes committed local projections only; Calendar
network recovery is manual.

Disconnect/account changes fence unsent requests, including an invocation whose
account was disconnected and reconnected while its event read was outstanding.
A deliberate retry can bind the original-account operation to the new connection
revision. Destination changes do not retarget captured work. Sent requests may
finish. Unlink and Trash clear pending write permission even if the reminder is
later relinked or restored; a previously sent outcome may only be reconciled.
Purge erases private snapshots
and payloads, keeps minimal identity/receipt evidence and prevents late replies
restoring content. Removed/erased operations cannot issue further writes.

## Acceptance and official references

Host/domain/transport/migration tests and fixture renders supplement identified
signed-device acceptance. They do not prove Google OAuth, actual conditional
writes/reminder suppression, physical audibility, Android pickers/Back/TalkBack or
OEM behavior. Use the consolidated [owner checklist](device-acceptance.md).
P4-C recurrence and P4-D incremental/background synchronization remain separate.

- [Google event listing](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- [Conditional resource modifications](https://developers.google.com/workspace/calendar/api/guides/version-resources)
- [Sparse event patches](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch)
- [Google client method override](https://github.com/googleapis/google-api-java-client/blob/main/google-api-client/src/main/java/com/google/api/client/googleapis/MethodOverride.java)
- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/sdk/expo/)
- [Expo module promise API](https://docs.expo.dev/modules/module-api/)
