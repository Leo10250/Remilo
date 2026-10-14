# P4-E: managed Google Calendar setup and automatic reminder import

The owner's 13 October 2026 direction makes this the next Calendar iteration.
This contract adds deliberate calendar-level permission to the existing P4-C
recurrence and P4-D synchronization contracts. Task status belongs only in the
[backlog](backlog.md); host checks and signed-phone/live Google acceptance remain
separate evidence.

## Setup, policy and defaults

Local use continues without Google. Connecting an account alone neither creates
a calendar nor authorizes automatic import/publication. An explicit managed-sync
setup review identifies the account, the existing calendar or proposed creation,
import behavior, new-reminder export behavior, local alert consequences and
separate Google-reminder suppression consent. Confirmation captures native
permission and immutable work; outcomes appear through saved projections.

One connected Google account and one managed secondary calendar are supported
per installation. The predetermined underlying calendar name is **Remilo**.
Setup defaults to automatic import and automatic publication of eligible new
Remilo reminders. Each reminder or repeating family can be **Local only**.
Existing local reminders require reviewed selection; enabling managed sync does
not backfill the local database. Existing links retain their original calendars.

The continuing import alert policy defaults to **Alarm**. Users can instead
select Notification or No alert. Timed imports use the event start; single-day
all-day imports use the selected calendar's named zone and a configurable civil
time, initially 09:00. Permissions produce Scheduled, Blocked or Pending without
substituting modes. Google reminder settings change only with separate consent.

Initial recovery distinguishes installation provenance rather than guessing from
an empty reminder list:

| Initial setup context | Initial incoming alert policy |
|---|---|
| Existing installation enables an existing calendar | The reviewed import policy, initially Alarm |
| Fresh installation finds an existing calendar | No alert for initial recovery; the continuing policy applies to later new events |
| Setup creates a genuinely new calendar | The reviewed continuing policy, initially Alarm |

Portable backup restore does not restore Calendar permissions or links. A fresh
installation's first recovery stays quiet even if local reminders were restored.
An initial recovery item can acquire an alert through a separate explicit local
edit/review. Changing an import default never rewrites already imported alerts.

## Discovery, ownership and creation recovery

Discovery prefers the saved calendar ID in the same connected subject, including
after a rename. Without an eligible saved identity, inspect all pages of the
owned calendar list before declaring no match. The name comparison uses Unicode
NFC, surrounding-whitespace trimming and case folding of the underlying summary;
the account's display-name override is presentation, not calendar identity.

Only a secondary calendar with owner access and a verified data-owner email equal
to the connected account is eligible for automatic managed adoption. Email
comparison ignores case but performs no alias, plus-address or domain heuristics.
Unknown ownership requires review/access recovery; manager access alone does not
prove data ownership. Shared/read-only calendars and the primary calendar are
outside managed scope.

One eligible named or marked match is proposed in setup. Multiple plausible
matches require a selected native candidate. A name-only candidate is deliberate
adoption in the confirmed setup review; its title is not proof of prior Remilo use.
Failure, incomplete discovery, unavailable saved resources and revoked access
never mean that no calendar exists. A previously working missing calendar pauses
and requires reviewed recovery or replacement.

New-calendar creation uses the selected account and reviewed named zone, leaving
sharing permissions unchanged. Its description is exactly:

```text
Remilo managed calendar v1
Setup reference: <canonical operation UUID>
```

The description is visible, editable and contains no credentials. It is a
recovery/discovery hint; strict identity and ownership guards remain mandatory.
Adopted calendar names/descriptions are left intact. Renaming a bound calendar
does not trigger replacement.

Google's calendar insertion has no documented caller-chosen calendar ID or
idempotency key. Capture the creation operation and sent checkpoint before
dispatch. After an uncertain sent result, inspect the exact creation marker
across completed discovery pages and never blindly POST again. One verified
matching identity can acknowledge creation; zero or several matches remain
**Creation result not confirmed**. A known returned calendar ID is durably saved
before later validation, so recovery can inspect that identity directly.

Only explicit reviewed replacement can capture a fresh creation attempt while
explaining the unresolved prior attempt. Concurrent phones can still create
different calendars without cloud coordination. Remilo neither promises global
exactly-once calendar creation nor automatically deletes/merges duplicate calendars.

Discovery, creation, calendar verification and native permission capture use the
existing I/O executor and serialized mutation worker. Every page checkpoints
candidates and continuation together. A run inspects at most ten pages and yields
within the shared two-minute budget; interrupted pagination resumes rather than
claiming no match. A delayed authorization grant refreshes completed discovery
before creation. Account/revision/permission changes fence stale outcomes.

Use existing calendar-list read and owned-event scopes for discovery and legacy
adoption. Request `calendar.app.created` incrementally when confirmed setup needs
calendar creation. It does not replace the calendar-list discovery scope. Workers
stop with saved access recovery when consent is needed; only explicit foreground
actions launch Google authorization. Partial scope grants preserve local use and
disable the unavailable capability.

These boundaries follow [Google's scope definitions](https://developers.google.com/workspace/calendar/api/auth),
[CalendarList ownership metadata](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList),
[calendar creation request](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert)
and [OAuth guidance](https://developers.google.com/identity/protocols/oauth2/resources/best-practices).

## Automatic import, publication and identity

Within the confirmed managed calendar, supported ongoing and upcoming events
become linked native reminders or repeating families. Include an event still in
progress, a future event and a supported recurring master with future work even
when its original DTSTART is years old. Already-ended newly discovered events
stay outside automatic import, including earlier events today. Older events are
available through explicit reviewed history import and never replay elapsed alerts.

The importer reuses P4-C's canonical rule, master, original nominal instance and
following-segment identities. It does not expand a family into unbounded ordinary
rows. Meetings, special events, unsupported recurrence and ambiguous identities
require clear exclusions/review. A supported event changing into an unsupported
form remains observable and pauses its existing relationship.

New eligible Remilo reminders capture automatic publication after their local
content commit. Local saving/scheduling does not wait for Google. Publication
uses the existing stable event IDs, durable immutable payload, per-resource
outcomes and source-identity adoption machinery. It becomes an automatic linked
association only after the required common baseline is confirmed. Unsupported,
unsafe or excluded reminders remain local with truthful recovery context.

Imported events are never exported as second events. Deduplicate exact
account/calendar/event identity, supported recurring resource identity and
reliable native logical identity. The linked pair renders as one Agenda item.
Titles and times can suggest possible duplicate review but cannot authorize a
merge. Copied, missing or contradictory Remilo event markers require identity
validation; editable markers never grant permission.

Discovery transport reuses P4-D's consistent unexpanded deletion-aware event
collection query. The moving import time window is applied locally because
Google sync-token queries cannot contain date, text or extended-property filters.
Persist only compatible candidate/association snapshots needed for work and
minimal suppression/exclusion identity; discard unrelated historical content.
Commit page observations and pending candidate work before advancing the token.
HTTP 410 rebuilds transport state without clearing local content or disposition.

Sources: [Google incremental query contract](https://developers.google.com/workspace/calendar/api/v3/reference/events/list),
[event creation identity guidance](https://developers.google.com/workspace/calendar/api/guides/create-events)
and [editable event properties](https://developers.google.com/workspace/calendar/api/guides/extended-properties).

## Compatible edits, delivery and lifecycle

P4-D still compares Title, Notes and Schedule with the last confirmed common
values. Schedule includes supported timing, named zone, recurrence, exceptions
and following segments. One-sided changes transfer; identical edits acknowledge;
different changes to the same group preserve both versions and require review.
Timestamps never select a winner. Sparse conditional writes preserve unrelated
Google data, and uncertain writes are inspected before another attempt.

Completion, Skip, Trash, local list membership, alert mode, sound/vibration,
independent Due/Alarm and Snooze/Postpone remain local. Existing linked reminders
continue to synchronize after their event time passes. Valid inbound schedule
changes preserve independent timing and future postponement. Elapsed proposed
alerts require review. Schedule transfer during ringing defers and recomputes
after the session ends; metadata transfers do not disturb delivery.

Native removal dispositions prevent automatic import from undoing user actions:

| Local or remote action | Managed behavior |
|---|---|
| Mark as done | Preserve local completion; do not recreate that work from the retained Google event |
| Skip | Preserve that occurrence; eligible future work can continue |
| Trash | Stop applicable transfers and prevent automatic re-import |
| Purge | Erase private content; retain only minimal identity needed to prevent resurrection |
| Local only / Unlink | Preserve both copies and local delivery; prevent automatic re-adoption |
| Google event deletion | Preserve local content/delivery and suspend the relationship |
| Restore, Reopen, remote restoration or Relink | Require fresh reviewed permission for the affected relationship |
| Managed calendar removal or ownership/access change | Pause and expose specific setup recovery |
| Disconnect, pause or disable | Fence unsent work; reconcile sent outcomes without reactivation |

Suppression survives restarts and same-installation reconnection. Explicit Import
again or relinking may supersede a suppression after fresh review. Disabling
managed sync leaves copies and Google reminder settings intact. Pause holds
applicable pending managed work; a reviewed resume revalidates it. Disabled work
does not resume simply because the account reconnects.

Fresh-install recovery restores only supported Calendar content and schedules.
It cannot reconstruct local completion, Skip, Snooze, sound or device alarm
preferences from ordinary Google events. Multiple devices may synchronize
content, but delivery preferences remain device-local. Primary-device delivery
coordination and complete cloud restoration are outside this iteration.

## Presentation, native interfaces and acceptance

Settings presents the account, managed calendar, setup phase, import/export
policy, first-recovery policy, saved run status and current problems. Setup review
shows actual candidate selections, proposed local work, exclusions and alert
consequences. It reports captured work separately from eventual import/link/
publication outcomes; partial completion never appears as full success.

Details remains reminder-first with its compact Calendar navigation row. Calendar
management retains P4-D's status/action hierarchy and saved-only navigation reads.
Local only has a reviewed meaning consistent with Unlink. The review queue
distinguishes affected reminders, incoming events not yet saved and setup/access
issues; recurring families count once. Agenda filters retain their state.
Notifications remain quiet, generic and deduplicated. Routine success stays quiet.

The bridge exposes saved managed state, bounded discovery/setup previews,
guarded capture/resume/policy/disposition commands and paginated incoming review
issues. JavaScript supplies native IDs and choices, never authoritative remote
payloads or comparisons. CE 11→12 adds installation provenance, managed binding/
policy, native previews, setup/candidate/export operations, cache, dispositions,
minimal suppression, issues and receipts. Migration grants no permissions or
network work. DP 6 and portable backup 4 remain unchanged.

The native interface uses `getManagedCalendarState()` and
`getCalendarReminderDisposition(id)` for saved reads. Explicit foreground actions
call `previewManagedCalendarSetup`, `previewManagedCalendarPolicyChange`,
`previewManagedCalendarResume`, `previewManagedCalendarCandidate` or
`previewManagedCalendarRecoveredAlerts`. Setup may show a read-only one-page
contents sample, labelled with its inspected resource count and whether more
pages remain; it is never represented as the complete import total.

Confirmation commands carry an operation UUID, native preview identity and
selected native item identities. The native receipt compares the complete input,
returns the original acknowledgement after lost replies or preview expiry, and
rejects a changed request with `OPERATION_REUSED`. A selected Resume child keeps
its own immutable identity and authorization epoch; another Pause fences unsent
automatic phases. Separate manual import/resolution permission remains explicit.
Policy changes preserve captured initial-cohort defaults and creation authority.
A failed read-only discovery updates its own checkpoint rather than changing an
already enabled binding.

Creation persists the returned identity before reading CalendarList ownership.
Server failures from the non-idempotent creation endpoint require inspection;
definitively unsent or rejected attempts can retry the same captured request.
Persistent retry time starts at one minute and caps at one hour. A recurring
import retains bounded audit progress and revalidates captured instance versions
in six-read slices before applying local content. Cache or permission changes
invalidate that proof; restarting cannot silently reuse a changed exception.

Exact publication-derived identities and retained marker evidence extend backup
review when Calendar recovery arrived first. Existing work is retained by default.
A separately restored reminder or family gets fresh local identities and stays
Local only. Marker copies, title/time similarity and `iCalUID` do not authorize a
merge, and legacy source-less imported backups may remain unreconcilable.

Retain P4-C/P4-D regressions and add discovery rename/name ambiguity, strict
ownership, incomplete/empty pagination, delayed consent, lost create replies,
simultaneous setup, marker collisions, initial-mode provenance, ongoing/upcoming
eligibility, old recurring masters, guarded import/export, exact deduplication,
Local only/removal suppression, backup/reinstall recovery and late-result fences.
Exercise bounded native work without JavaScript and responsive alarm actions
under blocked Calendar I/O.

Review all eight atmosphere/brightness pairs, narrow portrait, landscape, 200%
text, long English/Chinese, reduced motion, Android Back/keyboard ordering and
TalkBack. Run shared verification and Android verification sequentially, then
identify a signed beta by source relationship, hash and signer. Signed-phone/live
Google observations remain required. Build preparation does not authorize
installation, distribution or acceptance claims.
