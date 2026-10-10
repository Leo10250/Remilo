# P4-A: optional Google Calendar publishing

Approved scope: manual publication of each saved, unfinished one-off, including
existing reminders. Connecting publishes nothing. One confirmed account and one
default owned calendar; no imports, automatic backfill, recurring publication,
linked updates or background synchronization. Those remain P4-B–P4-D.

## Product and privacy contract

Settings → Google Calendar is secondary navigation with the existing origin and
retained Settings scroll. Connection, destination selection, saved jobs and
Disconnect use the shared atmosphere roles, connected groups and sheets.
Details → More → Publish opens a native-derived review of destination, exact title
and notes, event range and named zone. Cancel sends nothing. Publish captures
native revision guards and an operation UUID before any I/O. An unresolved job
blocks replacement publication while ordinary local reminder actions remain usable.

Google receives summary/title, description/notes and event start/end. Timed
values retain their instants and IANA zone. All-day values are dates with an
exclusive end. Confirming a floating reminder pins the preview's device zone
in CE, preserving event, due, authored alert and delivery instants. Alarm
generations, sessions and registrations are unchanged. Events are private and
Busy, have no attendees, and disable all Calendar reminders.

Published status retains the original destination and Google link. A changed
event fingerprint reports that the current reminder differs; P4-A never updates
or deletes an existing event. Done, Trash, Restore and Purge retain local meaning.
Trash cancels unsent work and releases its unused binding; a restored unfinished
reminder can be deliberately reviewed again, retaining the same remote event ID.
Purge clears captured payload and private display
metadata, retaining identity/receipt evidence for already-started reconciliation.
It also removes remote links and etags; late acknowledgements do not restore
erased metadata. Recovery selects the original account again when its email was
erased and still verifies the stable Google subject before any remote lookup.
Disconnect fences new requests and attempts Google revocation. Sent requests can
finish and remote events remain; failed revocation is reported as unconfirmed.

## Native authority and lifecycle

CE Room 6→7 adds `calendar_connection`, `calendar_publications` and
`calendar_operations`. DP stays 6; portable backup stays 4, with no connection,
Calendar bindings, network jobs or credentials. Tokens are transient native values,
never exposed to JS, persisted or logged. Google account `sub` binds work; email
is display/account-selection metadata. There is no backend, embedded client secret,
refresh-token storage or startup publishing.

The engine's serialized mutation worker owns Calendar state. A separate process
I/O executor runs authorization and HTTPS, posting each result back to that worker.
Bridge teardown does not cancel a started operation. Interrupted Publishing jobs
become Unconfirmed when Calendar state is next explicitly opened; recovery is manual.

A versioned canonical JSON tuple (subject, calendar ID, occurrence ID) produces
a stable UUID encoded as 32 lowercase hex characters, an allowed Calendar event ID.
Private publication markers authenticate its Remilo identity. Every attempt reads
that exact ID before insert; duplicate/lost replies reconcile it without overwriting
remote edits. Foreign identities and cancelled remote events are visible conflicts.
Same-operation retries retain immutable content and destination; late errors cannot
downgrade confirmed success. Default/account changes never retarget captured work.
One explicit retry action permits at most two transient attempts; permission and
authentication failures require visible recovery rather than indefinite retry.

`CalendarAuthorization` and `CalendarTransport` are injectable host-test seams.
Authorization uses pinned `play-services-auth:22.0.0` and a non-exported,
credential-only Activity Result activity. It starts only after unlock and a user
action. Owned CalendarList pagination uses `minAccessRole=owner`, checks each entry,
and revalidates ownership immediately before publication.
Partial consent leaves the confirmed connection intact. All four scopes must be
granted; invalid cached access tokens are cleared and require visible reauthorization.

## Development Google setup

The owner manually reported completed setup and resolved the duplicate test-user
message (the account was already listed). These Console results are owner-reported,
not agent-inspected configuration or successful Android OAuth evidence.

- Project ID: `remilo-511205`.
- Android client ID: `711179923041-iblrdkl8q8ce1rq1cjs3f34vmf2ef6dd.apps.googleusercontent.com`.
- Android package: `com.remilo.app`.
- Existing release certificate SHA-1:
  `46:5B:6C:DC:64:5D:E1:95:56:BB:05:52:65:D2:5E:DC:96:BA:11:49`.
- Calendar API enabled; External audience; publishing status must remain Testing;
  authorized testers must be individually listed.
- Requested scopes: `calendar.calendarlist.readonly`, `calendar.events.owned`,
  `openid`, `email` (Console may show `userinfo.email`).
- Designated owned test calendar: **Remilo Reminders**. Its exact ID and tester
  email stay in ignored local acceptance configuration, not the production bundle.

The Android AuthorizationClient discovers the client from package and signer;
P4-A does not request a server auth code or need a web client/secret. No OAuth
configuration JSON or Calendar ID is embedded in production. Future builds must
retain the registered signing identity. No new key should be created to fix OAuth.

Official references: [Android authorization](https://developer.android.com/identity/authorization),
[Auth 22 release](https://developers.google.com/android/guides/releases),
[Calendar scopes](https://developers.google.com/workspace/calendar/api/auth),
[owned listing](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list),
[event mapping](https://developers.google.com/workspace/calendar/api/guides/create-events),
[event IDs and fields](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert),
[error recovery](https://developers.google.com/workspace/calendar/api/guides/errors),
[account subject](https://developers.google.com/identity/openid-connect/openid-connect).

## Signed-device acceptance procedure

Use the identified signed bundled build and the designated account/calendar only.
Record APK SHA-256, device/OS, observer, date and each actual outcome. Do not touch
unrelated events. The fixture preview uses synthetic metadata and memory only;
its authorization button cannot contact Google or issue HTTP writes.

1. Connect, cancel an account change, reconnect and select an owned destination.
   Confirm connecting sends no reminder. Confirm a shared non-owned calendar is absent.
2. Publish one timed and one all-day synthetic reminder after reviewing content,
   destination and zone. Inspect remote range, private/Busy, no attendees and no reminders.
3. Publish a floating reminder with independent Due/authored alert and a current
   Snooze/Postpone target; verify pinning preserves all four instants and local delivery.
4. Disable connectivity before Publish, leave Details, reopen Settings, restore
   connectivity and retry the same saved job. Confirm one event identity only.
5. Edit remote content and retry a lost acknowledgement; confirm no overwrite.
   Edit local event fields; confirm the difference notice and no remote update.
6. Cancel consent/revoke access/change account; recover with the original account.
   Disconnect; confirm no further requests and truthful revocation reporting.
7. Done/Trash/Restore/Purge remain local. Cancel an unsent Trash job, and reconcile
   an already-sent job after Purge without sending its erased content again.
8. Review all eight atmosphere/brightness pairs, narrow 200% English/Chinese,
   reduced motion, keyboard/Back, wrapping, 48 dp targets and persistent 56 dp Publish.

Unobserved cases remain pending. P4-A completion requires documented signed-device
publishing acceptance as well as host checks. G4 remains pending through P4-B–P4-D.
