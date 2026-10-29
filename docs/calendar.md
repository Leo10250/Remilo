# Google Calendar

Google Calendar is optional. Local reminders, routine progress and delivery remain
usable without a connection or network. Calendar content, account metadata, jobs,
cursors and permissions are credential-protected and excluded from portable backups
and device-protected storage. [Product](product.md) owns local behavior and
[architecture](architecture.md) owns the serialized native mutation boundary.

## Connection, permissions and relationship types

One connected Google account is supported per installation. Its stable Google
subject (`sub`), not its email/display label, binds captured work. Authorization
and HTTPS run outside the alarm mutation worker. Tokens are transient native values:
never expose them to JavaScript, persist/log them, embed a client secret, or require
a backend/refresh-token service. Background work can reuse granted access but cannot
open consent UI. Foreground authorization starts only after unlock and a user action.

These relationships have different permission:

| Relationship | Meaning |
|---|---|
| Published once, unlinked | A deliberately reviewed copy exists; no ongoing compatible-field updates |
| Explicit manual link | Source identity is retained; changes require reviewed resolution until automatic permission is deliberately activated |
| Automatic link | Compatible ordinary changes transfer under its captured permission; conflicts/uncertainty require review |
| Managed calendar | Confirmed calendar-level setup authorizes eligible automatic incoming events and eligible genuinely new Remilo publications under reviewed policies |
| Local only / unlinked | Keep both copies and local delivery; do not automatically adopt or restore the relationship |

Connecting alone creates/imports/publishes nothing. Changing a manual publishing
destination does not configure a managed source, retarget saved work or authorize
existing links. Existing manual links do not acquire automatic write permission
through migration. New import/link reviews disclose automatic synchronization,
select it by default and allow opting out. Old published copies require deliberate
identity/baseline adoption before linking. All source content/descriptions are data.

Discovery/manual work uses owned-calendar access. The required base scopes are
`calendar.calendarlist.readonly`, `calendar.events.owned`, `openid` and `email`.
Managed creation requests `calendar.app.created` incrementally when needed; it does
not replace discovery scope. Partial grants preserve local use and existing confirmed
connection while disabling unavailable capabilities. Authentication/permission errors
remain explicit recovery; do not silently downgrade or repeatedly launch consent.

Disconnect fences new/unsent work and attempts Google revocation. Already-sent work
can finish and is reconciled read-only; events remain in Google. Unconfirmed
revocation is reported honestly. Reconnection does not revive old write permission.

## Managed setup and calendar identity

Settings keeps account, dedicated source calendar, directional defaults and imported
alert policy in one compact setup review. Show the exact candidate or proposed
creation, incoming/outgoing behavior, alert consequences and separate Google-reminder
suppression consent. Confirmation captures native permission and immutable work;
authorization launch or command capture is not completed synchronization.

One managed secondary calendar is supported. Its proposed underlying name is Remilo.
Prefer a saved eligible ID in the same subject, including after rename. Otherwise
finish owned-list discovery before declaring no match. Compare underlying names
with Unicode NFC, surrounding-whitespace trimming and case folding; a display-name
override is not identity. Eligible adoption requires owner access and verified
data-owner email matching the connected account, case-insensitively, without alias,
plus-address or domain heuristics. Primary/shared/read-only calendars and unknown
ownership are outside automatic adoption.

One eligible named/marked match can be proposed. Multiple matches require a native
candidate selection. A name-only candidate is deliberate adoption, not proof of
prior Remilo ownership. Failure, partial discovery, missing saved resources or
revoked access never means no calendar exists. A missing previously bound calendar
pauses and needs reviewed recovery/replacement. Adoption leaves its name/description
unchanged; renaming a bound calendar never triggers replacement.

New creation uses the reviewed named zone and leaves sharing permissions unchanged.
Its description is an editable recovery hint with this protocol shape:

```text
Remilo managed calendar v1
Setup reference: <canonical operation UUID>
```

Capture the creation operation and sent checkpoint before dispatch. Google calendar
creation has no caller-selected calendar ID/idempotency key. Save a returned ID
before later ownership validation. After an uncertain sent result, inspect that
identity or the exact marker across completed discovery; never blindly POST again.
Zero/multiple matching results remain unconfirmed. A new creation attempt requires
explicit reviewed replacement explaining the unresolved prior attempt. Concurrent
phones can create distinct calendars; no global exactly-once/merge/deletion promise
is made. Editable markers never grant permission or replace ownership checks.

Discovery checkpoints candidates and continuation together, yielding after ten pages
or the two-minute I/O budget. Resume incomplete discovery rather than claim an empty
result. Revalidate discovery after delayed consent and fence stale account/revision/
permission results. Only foreground actions can request missing consent.

## Import, publication and recovery policies

Managed setup defaults to importing supported ongoing/upcoming events and publishing
eligible genuinely new ordinary Remilo reminders. Existing local reminders require
reviewed selection; enabling setup does not backfill them. Each reminder/family can
be Local only. Existing links keep their original source calendars, including ones
outside the managed calendar. Routine authored data is not Calendar-publication or
linking input.

Continuing import defaults to Alarm, with Notification/No alert alternatives. Timed
imports use event start. Single-day all-day imports use the calendar's named zone
and a configurable civil alert clock, initially 09:00; Due is next local midnight.
Changing a default never rewrites previously imported alerts. Initial recovery has
its own installation-provenance rule:

| Confirmed setup context | Initial incoming alert policy |
|---|---|
| Existing installation, existing calendar | Reviewed policy, initially Alarm |
| Fresh installation, existing calendar | No alert for initial recovery; continuing policy applies to later new events |
| Genuinely newly created calendar | Reviewed continuing policy, initially Alarm |

An empty database or restored backup does not establish installation provenance.
Recovered items may gain alerts only through deliberate local edit/review. Calendar
recovery cannot reconstruct completion, Skip, Snooze, sound or device preferences.
Portable restores do not restore Calendar permission/links. Separate restored copies
receive new native identities and remain unlinked/Local only.

Automatic import includes an event still in progress and recurring masters with
future work even when DTSTART is old. Newly discovered already-ended events stay
outside automatic import; explicit history import can review them without replaying
elapsed alerts. Do not expand an unbounded family into ordinary rows. Unsupported
changes remain visible and pause an existing relationship rather than erase it.

Manual import browses an owned source independently of the publishing destination.
Start/End dates are inclusive and ordered, initially today through 29 days later;
accepted ranges span 1–366 days. Native queries use an exclusive next-day upper bound
with civil DST arithmetic. Pages contain 100 server results; unsupported rows explain
why and do not hide later pages. Query/account changes invalidate cursors. Browsing
never creates reminders or changes Google. Associated, erased, detached and pending
sources stay hidden even in cached results; explicitly relink detached sources from
the existing reminder.

Import all scans every page of the range, skips unsupported/associated/pending sources
and reviews the complete eligible count before confirmation, bounded to 500 events.
Narrow larger ranges rather than silently import a partial set. Default review is
Alarm, No list, current sound/vibration and keeping Google's reminders; common and
per-event choices are explicit. A missing title needs a local value; oversized text
requires correction in Google rather than truncation. Elapsed proposed alerts require
a deliberate future time or No alert. A changed alert becomes independent.

Google reminder suppression is a separate unchecked consent, independent of Remilo
mode. Warn when both apps may alert. Commit local creation before conditional remote
suppression; Blocked/Pending local scheduling defers it until explicit successful
retry. Unlink/Disconnect does not restore Google reminder settings.

Manual publication reviews destination, exact title/notes, event range and named zone
before confirmation. Cancel sends nothing. A floating reminder pins the reviewed zone
without changing its instants or generations. Published events are private and Busy,
have no attendees and disable Google reminders. Timed JSON uses RFC3339 seconds,
preserving original instant/milliseconds and IANA zone; all-day uses date/exclusive
end. An unlinked copy reports later local differences but is not silently overwritten.

Eligible automatic publication begins after local content commit, so saving/scheduling
never waits for Google. It becomes linked only after identity and common baseline
are confirmed. Imported events are not exported again. Local Trash retires that
captured managed export; late failures cannot reopen it or affect a replacement.
A sent publication retains only its original read-only result-check identity.
Checking cannot recreate the local reminder, republish or delete the Google copy.

## Supported event and recurrence mapping

Support personal timed or single-day all-day events with complete ends and a supported
named zone. Meetings/attendees (including incomplete attendee information), special,
locked/private-copy/cancelled events, malformed timing, multi-day all-day events and
ambiguous identities require exclusion/review. A generic 404 means unavailable,
not proof of deletion; explicit cancellation/deleted-resource observations are typed.

Recurring events use the existing native kernel and one supported RRULE: daily,
weekly with selected weekdays, numbered monthly day, monthly ordinal/last weekday
or yearly, with native interval/count/until limits and Monday week starts. EXDATE,
RDATE, extra rules and incompatible expansion require review. A DTSTART outside its
pattern is unsupported because COUNT semantics differ. Publication chooses the first
actual native nominal occurrence as DTSTART while preserving interval/count.

Moved instances retain originalStartTime/nominal identity. Use Google's returned
instance ID; never synthesize it from timestamps. Preserve native family/segment and
following-master identities. Reviewed publication captures the root, following masters
and authored future exceptions. Compare three ordinary future slots through Google's
instances endpoint, including DST/end rules. Explicit review bounds collection reads
to 100 pages and retained future exceptions to 500. Imported future cancellations are
skips; cancellation of already-linked work retains local content/delivery and
suspends that relationship. Snooze/Postpone never becomes an authored Google exception.

Deduplicate exact subject/calendar/event and supported recurring/logical identities.
Titles/times, copied markers and iCalUID can suggest review but never authorize a merge.
Calendar-first recovery plus backup restore preserves existing logical work by default;
legacy source-less imported backups may remain unreconcilable. Source identity remains
reserved when needed to prevent accidental re-import after Unlink/Trash/Purge.

## Compatible fields and independent local actions

Only Title, Notes and Schedule transfer. Schedule is one group containing start,
end, all-day state, named zone and supported recurrence/exceptions/following segments.
Compare each group to the last values confirmed common to both copies:

| Remilo versus common baseline | Google versus baseline | Result |
|---|---|---|
| Unchanged | Unchanged | No compatible-field write |
| Changed | Unchanged | Transfer Remilo value |
| Unchanged | Changed | Transfer Google value |
| Both changed identically | Both changed identically | Acknowledge agreement |
| Both changed differently | Both changed differently | Preserve both and require review |

Different groups may merge. A pending one-sided transfer is not a conflict. Advance
the baseline only after confirmed local/remote agreement; never invent it for adopting
an old publication. A fresh manual review chooses each differing group and confirms
both-side resolution. Remote updated timestamps provide whole-event context only;
they do not identify which field changed or select a latest-edit-wins result.

Completion, Skip, Trash, list membership, mode, sound/vibration, independent Due/Alarm
and Snooze/Postpone stay local. Valid inbound Schedule recalculates linked timing but
preserves independent values and an existing future postponement. Ringing Schedule
changes defer/recompute; metadata updates do not disturb playback. New elapsed alerts
require review, not tomorrow substitution or replay. Show the local target actually
in effect and retain Scheduled/Blocked/Pending truth without mode downgrade.

| Action | Relationship behavior |
|---|---|
| Local completion/Skip | Keep local outcome; do not recreate it from Google; future eligible recurrence may continue |
| Local Trash | Cancel local delivery/transfers; Google remains; suppress automatic re-import |
| Purge | Erase private snapshots/payloads; retain minimal exclusion/receipt identity; late results cannot restore content |
| Local only/Unlink | Keep both copies/local delivery; stop adoption/transfers; Google reminder settings stay unchanged |
| Confirmed Google deletion | Keep local content and exact next alert; suspend and show cancellation/recovery |
| Restore/Reopen/remote restoration/Relink | Do not revive old permissions; require fresh affected-scope review |
| Disconnect/Pause/disable or loss of source/ownership | Fence unsent work; reconcile already-sent outcomes without reactivation |

Suppression survives restart and same-installation reconnect. Explicit Import again/
relinking may supersede it after fresh review. Pause holds managed work; Resume reviews
and revalidates selected captured children. Other calendars' link permissions remain
independent. A default destination change never retargets an existing operation.

## Durable native protocol and background opportunities

CalendarRuntime executes I/O separately; engine serialization owns native previews,
permission/epoch capture, local mutations, observations, receipts and checkpoints.
JavaScript supplies native IDs/choices, never authoritative Google JSON/comparisons.
Previews are bounded and expire; confirmed commands bind the preview/selected items,
operation UUID and complete input. Lost acknowledgements return original receipts,
including after preview expiry; changed input returns OPERATION_REUSED.

Import captures reminder/association/receipt/operation checkpoint and scheduling
outbox atomically with a single allocated identity. Import-all captures child jobs
and a hash/child-ID parent receipt in one CE transaction before dispatch. Children
retain independent local/remote outcomes; partial work is not cross-service atomicity
or a rollback promise. Startup repairs committed local projections; captured manual
operations retain explicit recovery, while permitted automatic work uses native
foreground/background opportunities.

Remote writes are sparse and If-Match conditional, preserving unrelated fields;
the documented POST + X-HTTP-Method-Override: PATCH fallback preserves semantics.
Revalidate account, ownership, eligibility, local revision/generation and permission
before every write/commit. HTTP412 stops stale application and requires fresh
comparison; etag change alone does not prove a conflict. After an uncertain sent
write, inspect the same remote identity, skip confirmed local phases and acknowledge
matching intended fields before considering another write. Unsent transient failures
may back off; unresolved/conflicting sent outcomes require visible recovery.

Publication uses stable native-derived remote event identity and retained markers;
read that ID before insert. Foreign identity/cancelled resources remain conflicts.
Same-operation retry never captures new content/account/destination. Late failure
cannot downgrade confirmed success. Account changes, terminal actions, Unlink,
Restore, Relink and Purge fence obsolete permission even across reconnect races.

Incremental queries are consistent per subject/calendar and deletion-aware. Their
moving import window is applied locally because sync-token queries cannot include
incompatible time/text/extended-property filters. Checkpoint observations and pending
candidate work before advancing a token. HTTP410 rebuilds remote cache only, retaining
local reminders, bindings, dispositions and delivery. Persist only necessary allowlisted
snapshots and identity exclusions, not unrelated historical Calendar content.

Native WorkManager offers one unique hourly connected-network request with 15-minute
flex and unique one-time pending/continuation work. Execution remains OS-controlled.
Runs use a two-minute I/O budget, at most ten collection pages/fifty association
attempts and durable fair continuations. Unsent transient backoff begins at one minute
and caps at one hour. No JS timer, exact cosmetic alarm, unlocked requirement bypass
or background consent UI is introduced. Locked boot never initializes Calendar work
or opens CE storage. Multiple devices may transfer content but do not coordinate a
primary ringing device; cloud/device coordination is separate future scope.

## Saved status, review and navigation

Details stays reminder-first: local alert/Title/Schedule precede a compact Calendar
entry leading to its separate management page. Opening pages, expanding disclosures
and reading status uses saved projections and performs no network work. Expose
explicit read-only Check, result inspection, review and Sync now with distinct effects.
Terminal reminders keep read-only context. Show Google cancellation on Agenda/Details
with an appropriate local Trash action; failed checks preserve the saved observation.

Settings separates the latest check result from persistent Automatic sync On/Paused/
Off configuration. Up to date requires a native-confirmed completed AllAuthorized
check whose entire captured scope remains current/fully inspected, with its completed
check timestamp. A connection, Ready state, enabled permission, per-link/source
timestamp or no eligible work alone cannot prove global success. A checked empty
collection can prove No changes; unfinished/legacy pagination cannot.

Current access/review problems, pending/held work, uncertain outcomes and changed
scope supersede old success. Checking means active native work; offline/queued
continuation means waiting. Sync now remains AllAuthorized, while managed controls
apply to that calendar; disclose this scope. Resume uses its reviewed native flow.
Neither status projection nor a new request may grant permission or retarget an
already captured command. Saved statuses distinguish checking, no changes, synced,
pending, review/access required, unconfirmed, paused, failed, scope changed and not checked.

Explicit synchronization captures immutable scope/UUID. Acknowledgement means capture;
separate durable progress counts checked/changed/imported/published logical families
without inflating totals for multiple fields/resources. Agreement without a content
change counts checked only. Missing historical correlation never becomes invented
batch success. A completed item does not clear unrelated global problems.

Current problems own specific Review/Reconnect/Check result actions; healthy Sync now
is secondary. Unlink is a separate neutral action explaining unchanged copies/alerts,
not a Trash icon. Open in Google Calendar is compact external navigation. Optional
timestamps, per-item checks and Calendar-only Activity are collapsed details. Do not
surface raw operation IDs/native errors or old resolved failures as current warnings.

Persistent in-app review notices survive dismissed notifications. Background discovery
may emit one quiet grouped generic notification on a separate non-alarm channel,
respecting preferences/permission/privacy and deduplicating unchanged issues across
restarts. Routine success and transient self-recoverable errors stay quiet. A tap
opens current review, never an automatic resolution. In-app recovery works even when
notifications are disabled. Partial setup/scan completion never claims all work synced.

## Development setup and source references

Android authorization selects its client by package and signer. The existing
registration uses project remilo-511205, package com.remilo.app and Android client
711179923041-iblrdkl8q8ce1rq1cjs3f34vmf2ef6dd.apps.googleusercontent.com. Keep the
registered signing identity; do not create a new key to repair OAuth. Calendar API
and the required scopes/tester access must be configured in Google Console. Current
console/account state must be checked when troubleshooting rather than inferred from
this document. Private tester emails/calendar IDs/configuration remain ignored;
production embeds no OAuth secret, calendar ID or authorization JSON.

Implementation is in the native [Calendar package](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/calendar)
and its [tests](../modules/remilo-alarm/android/src/test/java/com/remilo/alarm/calendar),
with presentation policy tests in [src/domain](../src/domain). Preserve those behavior
regressions when changing this contract. [Verification](verification.md) distinguishes
host/fixture checks, actual Google/device observations and installation/distribution.

Protocol references: [authorization](https://developer.android.com/identity/authorization),
[scope definitions](https://developers.google.com/workspace/calendar/api/auth),
[recurring identity](https://developers.google.com/workspace/calendar/api/guides/recurringevents),
[incremental sync](https://developers.google.com/workspace/calendar/api/guides/sync),
[event list constraints](https://developers.google.com/workspace/calendar/api/v3/reference/events/list),
[creation](https://developers.google.com/workspace/calendar/api/guides/create-events),
[calendar insertion](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert)
and [error semantics](https://developers.google.com/workspace/calendar/api/guides/errors).
