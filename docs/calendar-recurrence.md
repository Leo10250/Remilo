# P4-C: native Calendar recurrence mapping

Calendar recurrence uses the existing civil recurrence kernel and the existing
family, segment and nominal occurrence identities. A moved Google instance keeps
its originalStartTime identity. Instance writes use the ID returned by Google;
Remilo never constructs an instance event ID from a timestamp.

Supported personal events use one RRULE: daily, weekly with selected weekdays,
monthly day, monthly ordinal, last weekday and yearly patterns, with the native
interval/count/until limits and Monday week starts. Timed and single-day all-day
ranges use a named zone. EXDATE/RDATE, additional rules, meetings, special events,
ambiguous identities and incompatible expansion require review. A Google DTSTART
outside its pattern is unsupported because its COUNT interpretation differs from
the native kernel. Publishing selects the first actual native nominal occurrence
as DTSTART while preserving the native interval and count.

Explicit review inspects at most 100 collection pages and 500 retained future
exceptions. It compares three ordinary future slots with Google's instances
endpoint, including DST and ending rules. Imported future cancellations are
represented as skipped occurrences. Cancellation of an already-linked occurrence
keeps local content and delivery, suspends the family relationship and records
the affected nominal scope. Local completion, Skip and Trash never cancel Google
events. Purged and terminal scopes are excluded from further compatible transfers.

Publishing an existing family captures its root, following masters and authored
future exceptions together. A following edit trims the old master and uses the
new native segment's stable publication identity. Titles/notes, timing, rule,
supported exceptions and following segments are compared as the native P4-D
groups; all recurrence timing belongs to one Schedule group. Snooze/Postpone
delivery targets never become authored Calendar exceptions.

CE 9→10 adds resource identities and immutable per-resource jobs. Each resource
retains its original version, intended sparse patch, sent marker and confirmed
checkpoint. Lost replies inspect the same identity. Confirmed children do not
replay; unmatched sent outcomes require review. New following masters remain
part of an existing deliberately captured relationship. Independently discovered
Google masters never acquire linking permission by discovery.

P4-D's migration follows this schema without changing DP 6 or backup 4. Restored
portable reminder copies remain unlinked. Calendar mapping cannot own alarms,
audio, completion or scheduling. Native commits use the serialized engine worker
and its existing scheduling outbox; transport uses the separate Calendar executor.

See [automatic synchronization](calendar-sync.md),
[Google recurring events](https://developers.google.com/workspace/calendar/api/guides/recurringevents)
and [instance lookup](https://developers.google.com/workspace/calendar/api/v3/reference/events/instances).
