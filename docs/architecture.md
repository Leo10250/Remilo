# Architecture and consequential decisions

The [current four-atmosphere design](design/current/README.md) and
[appearance policy](design/current/appearance-policy.md) govern presentation.
The [9 October implementation decisions](design/current/implementation-decisions.md)
activate the six TD units while retaining native storage/lifecycle authority.

## ADR 001: Shared UI, autonomous Android implementation

The ordinary fixture preview remains opt-in and web-only. Metro substitutes its
synthetic native bridge only for that preview; Android resolves the real bridge.
Preview state is memory-only and cannot schedule alarms or access durable storage.
Obsolete review entrypoints, catalogs and Compose snapshot demos were removed
under A37. Production AlarmActivity retains its lifecycle, observation and actions,
delegating default rendering to AlarmControlsScreen. Reusable presentation slots
remain available to isolated fixtures. Production components consume generated
atmosphere roles and bundled scene/crop mappings.

App-owned confirmations use a process-only external presentation store and one
React Native Modal host under the root theme/preview providers. Existing screens
retain `useAppearanceConfirmation` and their captured action callbacks. The host
opens above the active page or sheet and reads canonical foundation roles rather
than a scenic toolbar override. A request retains localized descriptors, owner
identity, unique presentation ID and initiating focus node; it stores no engine
state. Language changes update copy without replacing the request. Completion
clears presentation before running a callback, so duplicates/older closures cannot
replay it. Repeated presentation requests are ignored while one decision is open;
owner blur/unmount invalidates it without executing a callback. Cancellation/acknowledgment
returns connected focus with a generation-guarded frame callback. Automatic
atmosphere holds and reduced motion stay presentation-only. No database, backup,
native scheduling, Calendar operation or system permission contract changes.

The [current roadmap](plans/redesign/README.md) owns scope: TD-01 shared
roles, TD-02 preferences/native-safe mirror, TD-03 pages, TD-04 native presentation,
TD-05 static Classic and TD-06 acceptance. Current credential/operational/backup
versions are 17/10/9. [P4-A](calendar-publishing.md) adds CE-only Calendar connection,
publication bindings and immutable jobs through 6→7; network/authorization runs
on a separate I/O executor and cannot block the serialized alarm worker. Calendar
state is excluded from DP and portable backups. CE 4→5 adds global atmosphere with Automatic default and
preserves brightness/revisions. DP 3→4 adds only an allowlisted appearance
singleton and nullable migrated session presentation fields. Every new session
captures its resolved atmosphere and actual Light/Dark pair; legacy sessions
follow silent Interrupted recovery. Settings/session presentation stays outside
portable backup format 9 (legacy readers 1–8).

[P4-B linking](calendar-linking.md) adds CE 7→8 links and immutable phased
operations. Local import/edit, link checkpoints, receipts and scheduling outbox
commit together through the existing worker; the internal Calendar edit policy
preserves current future Snooze/Postpone targets. Remote writes use sparse
If-Match patches, including Google's method-override fallback where needed,
with local/remote outcomes acknowledged separately. Preview checks are manual;
startup never resumes network work. Existing publications require explicit adoption.

Reviewed all-event import reuses those per-event jobs. One CE transaction captures
every child and a hash/child-ID batch receipt before dispatch; a lost parent reply
returns the same allocated jobs. Child saves/scheduling/remote phases remain
independent and manually recoverable. No schema/version change is needed.
Current-account source references in native link/job views let cached browser rows
hide associated and pending events without requiring Google reads on navigation.

CE 8→9 adds typed remote availability, original account labels, observed/attempt
times, remote comparisons and a required-review flag to Calendar links. This data
stays outside DP/portable backups. An explicit Check uses the I/O executor and
then validates the captured connection, source, link and reminder revisions on
the serialized worker; it changes no reminder fields or scheduling projections.
Confirmed cancellation preserves local alarms, while unavailable/unsupported
events suspend transfers. Trash/Unlink fence unsent work; a sent outcome may be
acknowledged without reactivating the association. Restore and remote availability
do not clear required review. Old message text never supplies an inferred observation.

CE 9→10 adds recurrence master/instance/following identities and immutable scoped
resource jobs. CE 10→11 adds automatic activation/revisions, common-baseline
versions, dirty authored revisions, operation provenance, allowlisted cursors and
snapshots, persistent review issues and delivery fingerprints, notification
preferences, saved run summaries and separate Calendar Activity. Historical links
remain manual; neither migration performs network work or grants automatic permission.

[P4-D](calendar-sync.md) reuses common compatible-field values for automatic
one-sided transfers and manual true-conflict recovery. The application-context
adapter dispatches authorization/HTTPS outside the alarm worker;
immutable job capture, activation/version fencing, local scheduling checkpoints,
observations and confirmed baselines stay on the serialized worker. Incremental
tokens/cache and synchronization records stay CE-only. Expired-token recovery
rebuilds the remote cache without clearing reminder data. One on-demand
WorkManager 2.12.0 hourly connected request and unique pending work offer bounded
native opportunities without an Activity, Expo module or JavaScript. Direct Boot
does not initialize WorkManager or Calendar storage. Calendar Activity is merged
into the local Activity projection, separately from portable history. Confirmed
partial resource outcomes remain visible and cannot roll local changes back.

[P4-E](calendar-managed-sync.md) adds CE 11→12 installation provenance, a reviewed
managed secondary-calendar binding/policy, setup previews and immutable operations,
incoming candidates/cache, outbound captures, local dispositions, minimal source
suppression, issues and receipts. Migration grants no Calendar-level permission.
The I/O adapter performs complete bounded discovery and feature-scoped creation
authorization; page, sent/result and permission checkpoints use the engine worker.
Calendar creation has no caller-specified Google ID, so uncertain sent attempts
inspect their exact visible operation marker and cannot blindly create again.
Managed import/export reuses P4-C resource identity and P4-D phased mutation owners.
Fresh-install initial recovery is quiet; installation provenance is CE-only and
not portable backup history. DP and backup versions remain 6 and 4.

The Calendar UX correction extends CE 12 projections without a schema migration.
Explicit synchronization requests use immutable CalendarSyncRequest JSON receipts
and separate CalendarSyncProgress checkpoints in the existing CE receipt table.
Native confirmed commits update deduplicated checked/changed/imported/published
family sets; scope guards fence identity/permission changes. Saved reads use
non-recovering link-store adapters so an active Sending write is not mistaken for
an interrupted process. Root store startup retains interruption recovery. The
existing serialized runtime/worker resumes bounded pending requests. No new
synchronization owner, Room entity, DP state or portable backup field is added.
Run failures carry their connection revision/subject and authorization epoch;
late failures cannot alter a replacement scope. An enabled empty managed source
uses the existing access-recovery issue/fence even when no linked reminder exists.
CalendarStatusStore reads existing setup jobs, binding-scoped candidates/exports,
association jobs and receipts. Scan completion, imports, pending/held/review work
and recorded local-save outcomes stay separate; Ready alone cannot prove all work
finished. New managed receipts retain immutable logical selections and scope
epochs for delayed publication correlation. Historical incomplete receipts use
conservative review rather than invented batch completion. Erased jobs cannot
expose titles or recreate work through the read API.

Authorization has a request UUID and an immutable launch receipt. A separate
deterministic outcome receipt records Authorized, Cancelled or Failed on the
serialized worker and emits onChange. Launch acknowledgement grants nothing.
The Activity confirms Google scopes/account through the existing I/O owner before
reporting Authorized; no token is persisted. A lost launch reply reads that same
request. Confirmed access to a fenced bound scope returns to Reviewing; fresh
Resume remains required. Existing manual authorization entrypoints delegate to
the same implementation.

Calendar timed payloads encode instants as RFC 3339 UTC timestamps with seconds
and retain the captured IANA zone. The HTTPS adapter reencodes older captured
minute-only strings without rewriting durable jobs, content, destination or
identity. Same-operation recovery still reads the original event ID first.
HTTP 400 has a distinct non-private rejection code; response bodies and tokens
remain excluded from JS, storage and logs. No schema, alarm or backup change is
introduced by this encoding repair.

Managed publication failures bind to their captured operation identity and cannot
revive retired exports or downgrade confirmed ones. CalendarStore startup repairs
older terminal export-review records locally. Retirement preserves suppression of
captured remote identities so a late Google collection echo cannot recreate the
deleted reminder. A confirmed publication can finish its eligible managed link
in the same worker checkpoint; retired copies remain read-only. Explicit
publication checks acknowledge after bounded native I/O and return the saved
result rather than treating queue dispatch as completion. No schema/backup/DP
change is needed for these lifecycle fences.

Accepted: React Native/Expo SDK 57 UI; tracked Android native project; local Expo
module as a thin bridge to normal Kotlin classes. SDK 36, minimum API 34.
No Prebuild after bootstrap, no OTA, no iOS until the last optional phase.

An Expo module coroutine can be cancelled on teardown. The engine has its own
application-context lifetime and serialized executor; committed operations remain
recoverable independently of their bridge promise. Receivers/services never load JS.

## ADR 002: Storage protection and authority

Language adds CE schema 13 and DP schema 7; portable backup format remains 4.
CE settings mirror only allowlisted language enums/reconciliation metadata to DP.
Existing migrations default to English; native bootstrap distinguishes fresh,
empty-settings and unopened upgraded installations. Explicit Android pre-launch
choices are respected. The serialized native owner projects app choices to
LocaleManager and imports external selections with revision checks. Pending
projection survives acknowledgement loss; observed newer choices invalidate stale
writes. Native locale observation requires no activity, Expo instance, JS or network.

The device-presentation snapshot/event adds language preference, resolved language
and formatting locale. Clock reads use explicit device settings or system locales,
ignoring app-language overrides. Native rendering shares the confirmed snapshot.
Text refresh retains delivery identities/deadlines and existing notification channels.
An unavailable locale service leaves its projection pending and uses the last
confirmed protected presentation for autonomous delivery; it cannot prevent an
already durable alarm, protected completion or recovery. Settings writes still
require reconciliation and retain their captured retry until acknowledged.
The canonical offline catalog generates TS/native resources. Calendar message
keys/arguments remain CE-only; recognized historical prose maps without changing
original prose or outcomes. Unknown historical copy uses a neutral localized fallback.

The original UX-25 method/event names are retained. Its clock observation remains
read-only; the language extension adds the persisted selection described above.
Native locale observation, clock observers and foreground reconciliation feed one
frontend formatting context; native alarms use the same snapshot. Reading
non-private device preferences before unlock is permitted. Observer teardown
never cancels a captured engine operation.

Credential-protected Room owns content, event/due timing, completion and history.
Device-protected Room owns current operational eligibility, targets, generations,
sessions and native action records. No content or credentials belong in the latter.

Definition-derived schedule changes have narrowly scoped pending-operation records.
Snooze and historical Stop journal records describe history; replay never changes
newer operational state. Native Done reuses protected completion receipts and the
pending-completion journal introduced by DP 4→5. DP 5→6 binds captured completion
membership and adds durable bulk-Snooze receipt/member records. CE and backup
schemas were unchanged by that alert correction. Alarm-affecting commands fence stale generations before acknowledgement.
OS registration and database commits are not atomic: reconcile idempotently and
return Scheduled/Blocked/Pending distinctly. Every callback rechecks eligibility.

The owner's confirmed permanent Trash deletion adds CE 5→6 `purged_occurrences`,
containing only occurrence ID, optional segment ID and nominal slot. Purge accepts
only a captured deleted revision and commits exclusion, reminder/history/outbox
removal and a revision-bound receipt in one CE transaction. Trash already fenced
delivery; protected terminal records and old command receipts remain operational
guards. Series materialization and private history/completion replay skip purged
identities. Restored recurring exclusions project Deleted into DP before protected
replenishment. The later language migration extends DP to version 7 with only
allowlisted presentation metadata; it never gains private content.

Backup format 4 carries only recurring purge exclusions, separate from reminder
content/history. It prevents an older importer silently ignoring them; readers
retain versions 1–3. Strict decoding validates unique, disjoint deterministic
occurrence IDs and segment/nominal references. Family-copy restore remaps exclusions
with the whole family before replenishing; local one-off purge identities are
conflicts preserved by default, with separate copies only on explicit selection.
Existing external backups are unchanged. Permanent deletion removes logical app
records; it does not claim secure erasure of SQLite pages or external copies.

The serialized engine constructs a complete notification snapshot before service
dispatch and passes it in the explicit, non-exported service intent. Foreground
promotion is immediate and never waits for another Room query on the main thread.
There is no actionless placeholder. Subsequent member refreshes update the same
notification; actions retain the delivery generation from their snapshot and stale
ones are rejected. Before unlock, the snapshot contains generic text only.

A22's [R6 visual correction](design/r6-alarm-postpone-specification.md) requires
global theming even for that generic content. The allowlisted non-private mirror
identifies bundled atmosphere and brightness policy without credential reads in
Direct Boot. The native serialized mutation worker commits credential preferences,
updates the mirror, then acknowledges. An identical operation retry repairs an
interrupted mirror write. Appearance-only writes do not change reminder targets,
generations, history or audio. Titles, notes, categories, list identities,
credentials and content-derived appearance stay excluded from DP.

Agenda queries apply optional `overdueOnly` alongside other intersections and
apply group ordering/counts before pagination. The read-only `agendaAtMs` anchor
is event start for No alert, otherwise operational target → configured alert → event
fallback. Capture query time/device zone once; order active results by group rank,
anchor and ID before the 50-row page. Today/Upcoming use only anchor dates.
Overdue uses original configured alert, timed No alert event start or next local
midnight after the No alert date; its rows sort by that reference and ID. One pure
OverduePolicy and captured query clock govern filtering, grouping, counts and
the derived overdueAtMs projection. History collections retain recorded-time ordering.
`scheduleTestAlarm(operationId)` returns an identified receipt; a same-ID retry
returns the original committed test/target. Whole-backup Restore returns structured
Rejected only for definitive precommit validation; possible commits remain
uncertain and retain their captured operation/choices until acknowledgement.

UI geometry is presentation-only: the form observer reads its Activity/Modal
window's bounds and native text-layout rectangles without consuming insets. Only
geometry/state and opaque field identities cross the bridge. It cannot read the
engine or persist text/composition. Native caret/viewport/scroll samples share one
frame and coordinate system; deliberate parent scrolling does not force focus
back into view.

Export and Diagnostics prepare/share only from their owning foreground page.
After a share-sheet opens, acknowledgement waits for that page to return to the
foreground and is abandoned after route departure. Wording confirms handoff only,
not receipt or saving by another app. A retry retains the captured prepared file/
report. Backup files contain private content in credential-protected app cache;
they are retained for provider access/retry and may later be reclaimed by the OS.

Native commands return field/error metadata for rejected input; JavaScript form
validation is presentation assistance. Dates and generations must be finite
integers in their supported range. A rejected command cannot leave a partial
definition or scheduling intent. Error messages never embed private field values.

Application startup and providers must be safe before unlock, not just receivers.
Keep one process and avoid credential storage until UserManager says unlocked.

## ADR 003: Independent registrations and bounded audio

One-off deliveries have independent explicit immutable PendingIntent identities
(purpose, occurrence, generation). Extras alone are not identity. A failed earlier
callback must not remove the only future wake-up for unrelated reminders.

Construct the alarm-clock show handle using explicit launcher resolution with both
Direct Boot match flags. Default launcher lookup hides the credential-protected
product activity before unlock; it cannot be a prerequisite for alarm registration.
Creating a handle does not start that activity. The UI remains unavailable until
unlock; actual pre-unlock controls belong to the Direct Boot aware native activity.

This is the current baseline. Static Classic branding preserves stable native
activity/notification entry points; app-controlled aliases or launcher matching
are not part of this redesign. Existing session guards remain native ownership.

One native audio session with an elapsed-time deadline. New members do not extend
it. Audio termination is independent of persistence. FGS is systemExempted while
exact-alarm eligibility holds; promote before requesting audio. Native wakefulness
is bounded. A second OS alarm is not proof of the five-minute cutoff.

## Build compatibility exceptions

AGP 8.12's K2 lint crashes parsing applied Kotlin scripts in Worklets/Reanimated.
Only these third-party projects use K1 lint; owned app/module checks remain K2 and
lint errors still fail verification. Remove this exception after a verified tooling
upgrade. Native compile job pools bound memory use without changing app behavior.

Expo 57 Router uses CommonJS query-string 7, whose URI decoder has a known malformed
input denial-of-service advisory. Pin upstream decode-uri-component 0.5.0 and apply
a checksum-guarded packaging-only ESM-to-CommonJS conversion in postinstall. Its
algorithm is unchanged. Shared tests exercise actual Router query parsing and long
malformed input. Remove the override/conversion when the SDK supports the patched
decoder itself. npm audit retains separate upstream tooling advisories; record them
honestly instead of forcing an incompatible Expo/React Native downgrade.

- [Decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
- [Upstream patched release](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0)
- [AndroidX precedent for scoped K1 lint fallback](https://android.googlesource.com/platform/frameworks/support/+/a1a3372020aa57f26b48d23e366ffb84d4716551%5E%21/)

## Deferred integrations

Recurrence projections and two future registrations per series belong to phase 3.
Calendar compatibility uses observed mismatches, not speculative DST repair.
Supabase is isolated to optional phase 5; auth/sync foreground/manual initially.
No iOS implementation or database placeholders exist before phase 6.

## One-off product commands and upgrades

Version 2 migrations retain v1 definitions, operational targets, generations,
receipts and history. A definition's original alert belongs in credential storage;
the current delivery target still belongs exclusively in protected operational
storage. Editing text/list metadata preserves a pending Snooze/Postpone. A changed
alarm definition replaces it. Done and deletion fence old callbacks before the
content transaction; undo/reopen can reconstruct a future target but never replay
an elapsed one.

An operational Changing row retains the prior eligibility for interrupted-command
recovery. If the content transaction never committed, recover the last committed
definition and prior target with the new generation. If it committed, its pending
intent supplies the new target. Recovery never revives an already stopped session.

Sound/vibration choices are operational snapshots. A session preserves the first
member's choices. User preferences and notes remain credential-protected; only
non-private delivery settings needed before unlock reach protected records.
Notification mode uses exact delivery when authorized and approximate Android
scheduling otherwise. The five-minute lateness policy still applies; this is
visible in the editor and never a substitute for Alarm mode.

Backups validate all entries before their content transaction. Conflicts are
preserved by default; selected copies get retry-stable identities. The same import
operation ID is retained for retry. Definitions/history and portable pending alert
times are exported, excluding generations, running sessions and OS handles.
The current defensive import bound is 10 MB / 10,000 reminders; it is an application
parser bound, not an Android scheduling-limit claim.

File selection and sharing use SDK 57 FileSystem/DocumentPicker/Sharing. The native
project remains owned and tracked; no regeneration or new config plugin is used.
- [SDK 57 FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/)
- [SDK 57 DocumentPicker cache-copy behavior](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/)
- [SDK 57 Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/)

## Recurrence authority and series changes

The pure Kotlin kernel uses civil nominal slots and java.time. Each occurrence ID
derives from its segment plus original nominal slot; its current postponed instant
is never identity. Timed event duration is elapsed duration; due/alert offsets are
civil offsets resolved independently. All-day end/due use the next local midnight.
Gap resolution shifts by the gap size and folds use the earlier offset, matching
[Java 17 LocalDateTime.atZone](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/time/LocalDateTime.html#atZone(java.time.ZoneId)).

Credential storage owns private templates, rules, revisions and retained segments.
Protected series plans have an explicit rule-field allowlist and delivery profiles;
they contain no templates, titles or notes. SeriesCoordinator executes on the
existing engine worker and does not introduce another queue or mutation owner.
Before presentation, native delivery replenishes two independently registered future
ordinary occurrences; postponed/single-edited exceptions are additional independent
registrations. Registration failures remain visible as Blocked. Protected rules can
replenish before unlock; content materializes only after unlock.
Reopen and Undo deletion restore recurring occurrences as independent exceptions,
preserving their original target without enlarging the ordinary coverage window.
Detaching the final ringing member ends its durable session before another arrival
can join. The component-owned audio controller receives a direct, session-checked
stop signal; it does not wait for credential history or recurrence materialization.

Series-changing commands fence future ordinary generations before their credential
transaction. Narrow pending-series records recover a committed change. A protected
Changing plan without a committed change recovers from its prior credential rule.
Whole edits archive old segments; following edits bound the old segment at the
original slot and create a new one. Earlier unresolved and postponed occurrences
keep their old content, targets and identities. Pause/resume operates across the
active family, retaining exceptions. Editing a paused family preserves pause.
Command receipts record both source and resulting segments to reject operation reuse.

Floating travel updates eligible future ordinary targets and their generations;
resolved per-occurrence zones preserve old timing. Elapsed alerts never revive even
when their new local-zone instant would be future. Postponements stay concrete.
A protected nominal cursor retains silent missed occurrences beyond the two-alert
window after a long outage. A finite COUNT counts valid nominal slots, including
ones completed/skipped individually, and excludes invalid dates.

Version 3 migrations preserve both earlier beta schemas. Portable backup version 2
includes series definitions and saved exceptions; version 1 imports remain supported.
An existing series family is preserved as a unit by default. Explicit copies get
new retry-stable family/segment IDs and derived occurrence IDs. Paused normal alerts
remain paused during restore; independent exceptions remain eligible. No operational
generation, session or Android handle is restored. Backup bounds are explicit parser
limits. Recurrence authoring supports years 1970–9999, intervals 1–999, counts
1–100,000 and timing offsets up to 366 days; these are application validation bounds.

The editor retains an uncertain save's command snapshot and operation ID for retry.
It holds edits until that save is confirmed or rejected, preventing a disappearing
bridge response from creating a second reminder on the next Save press.

File-sharing providers remain credential-only in the merged manifest; alarm
receivers/services/activity are Direct Boot aware. MainApplication still defers
React/Expo startup until the principal UI is requested after unlock. The new native
controls currently use saved brightness after unlock and system brightness before
unlock. TD-02/TD-04 add the planned native-safe global atmosphere under A36.

## ADR 004: Unified presentation without another state authority

The 0.4.0 redesign adds agenda/overdue/completed query views without a Room schema
change. The later beta correction replaces event grouping with alert-anchor
grouping and date membership. Group rank, anchor and occurrence ID order all
matching active rows before the
50-row page is sliced. Aggregate counts cover the full filtered query. Read-only
series/rule/adjustment information decorates rows; it never schedules an alarm.
Existing internal views remain available while principal routes use the agenda.
Foreground return and native changes invalidate queries. A foreground-only minute
refresh updates due/date presentation; it is not an alarm timer or scheduler.

One module-lifetime Preferences controller coalesces partial UI changes, serializes
writes, and refreshes the confirmed revision before the next command. Optimistic
preferences are presentation drafts, not another persisted store. Uncertain jobs
retain their operation ID through acknowledgement/read failures. Newer pending
selections are applied afterward; failed values revert to the confirmed snapshot.
Navigating away does not cancel this controller.

The native alarm activity consumes an explicit session snapshot (ID, durable state,
members, appearance) from the existing engine worker. Its initial state is loading.
An intent/refresh ticket rejects callbacks for another session or an earlier
refresh. Only a confirmed terminal state dismisses the activity, including timeout
or external termination; a partial action leaves remaining members visible.
New group notification actions carry immutable session/member generation snapshots
and reject stale captured members. Later arrivals are excluded. Legacy Stop all
retains its original session guard and installed-action compatibility.

Expo SDK 57 Symbols supplies Android Material icons. Router's SDK 57 public
`expo-router/react-navigation` export supplies draft removal guards; no separate
React Navigation package/context is introduced. Compose remains native-only.
Android resources are edited directly; the SVG master/exporter is owned source.
SDK 57's SymbolView implementation scales a Text glyph inside a fixed frame.
Android uses its documented Material image-source API to keep icons independent
of accessibility font size, with a SymbolView fallback if rendering fails. Text
labels still scale. This beta API remains encapsulated in the Icon component.

Visual review can opt into synthetic web fixtures through REMILO_UI_PREVIEW. The
Metro replacement is restricted to platform=web; Android always uses the real
native bridge. This is a local review surface, not a web product or alarm simulator.

## ADR 005: Collection queries and civil-time editing

Completed/Trash are query views over existing native state. The original Collections
intermediary is superseded by ADR 006. The repeat
family query groups retained segments by `seriesId`, chooses a current representative
and derives Active/Paused/Ended state, upcoming slots and unfinished count. A family
occurrence filter includes its retained earlier segments. Neither aggregation creates
another mutation owner or changes occurrence identity. Completed/Trash sort by the
latest relevant native history event before pagination; `collectionAtMs` carries
that timestamp, with a deterministic event-time fallback for imported records
without the relevant history.
Occurrence projections also expose a derived editable rule for the shared complete
repeat summary. This field is presentation data, not another stored definition.

The timezone catalog and civil-time conversion live in ordinary Kotlin classes using
`java.time`, reached through the serialized bridge. The catalog returns supported
zone IDs, human-readable city/region labels and offsets at the requested instant.
New selectable IDs are canonical ICU system zones also supported by Java time;
conversion continues accepting valid stored aliases without rewriting them.
React Native presents city search and gives Android's picker the explicit zone.
Picker civil fields and authored zone changes resolve through the same native gap
and earlier-fold policy used by recurrence. JavaScript does not own scheduling.
Untouched instants remain unchanged, including an existing later-fold instant.

Stale editor recovery compares the original editable snapshot, local draft and latest
native content. Independent text fields can incorporate unrelated changes; timing
and recurrence are reviewed as complete groups to avoid combining incompatible
definitions. Operational state and native revisions are not editable draft fields.
A replaced segment is recovered through its family representative or saved as a
separate definition, rather than overwriting an archived segment.

UI Undo captures a completed occurrence revision and verifies it against native state
before issuing Reopen. Native expected-revision validation remains the final guard.
An uncertain backup import retains the exact payload, copy choice and operation ID;
the screen blocks changing or abandoning that job until native acknowledgement or
explicit rejection. A confirmed restore with blocked alerts is an acknowledged content
import with delivery warnings, not an uncertain import. This in-memory UI guard does
not claim recovery of its screen draft across Android process death; native receipts
and committed content remain the durable authority.

## ADR 006: Shipped Browse routing, presentation and native preview ownership

The Browse-root navigation below describes the shipped baseline. TD-03 replaces
its visual routing; the latest beta correction uses Agenda / Lists / Completed /
Trash roots, Repeats secondary to Lists, and secondary origin returns;
query keys, history truth and native preview ownership are retained.

Browse is a modal control over explicit Agenda, list, Repeats, Completed and Trash
roots. Root switching replaces the root context; Settings, editor, detail and Activity
remain secondary pages. Destination state is keyed independently, including the two
record queries sharing a route. Focus-scoped Back handlers yield to transient UI,
search, draft and uncertain-operation guards. Navigation introduces no scheduler.

Shared presentation separates work status from delivery outcome. Original alert
or the No alert boundary controls Overdue; historical Stopped, Missed and timeout
remain outcomes for unfinished work. Alarm Done completes only its occurrence. Conditional
schedule detail preserves independent relationships even at coincident timestamps.
Recorded Done time is separate from collection sorting fallback. Activity renders
stored history without inventing missing lifecycle events or field differences.
Alert problems filtering occurs natively before pagination and counts.

SoundPreviewController is an ordinary process-owned native class. Its identified
requests and callbacks run through the engine executor; AlarmAudio owns focus,
release and the five-second cutoff. Replacement and real alarm startup wait for
previous preview release. Late callbacks cannot alter a newer preview. Native
Application lifecycle observation stops preview on background; module instances
only observe/query it. Selection and preference/draft mutation remain separate.
Actual playback callbacks expose tone fallback and failure rather than treating
an accepted start request as Playing. The ringing session's five-minute policy,
deadline, first-member sound and independent member actions remain unchanged.

## ADR 007: Credential-protected managed Lists and portable identities

Content schema 4 adds ListRecord (identity, name, revision) and nullable listId on
reminders and every retained series template. Operational schema remains 3; names
and list identities are not added to device-protected scheduling storage. Exact
legacy names, including case variants, migrate to separate stable identities.
New Create/Rename reject trimmed case-insensitive duplicates on the serialized
mutation path. Empty lists are retained independently of reminder queries.

Membership queries distinguish omitted listId (all lists) from null (No list).
Rename changes metadata only. Remove clears memberships across completed, skipped,
trashed, exceptional and archived content/templates, incrementing affected content
revisions without EditSeries, generation changes or alarm registration. Native
validation rejects removed references, including stale editors. Names are resolved
projection metadata rather than membership authority.

Backup format 3 carries empty lists and membership references; versions 1/2 remain
readable. Matching local IDs retain local metadata. Distinct imported identities
with colliding names receive a stable restored suffix visible in preview, rather
than being merged. Retry uses the same mapping. The shared template codec retains
membership IDs instead of decoding through the old version-one representation.
Restore retains whole-family conflict semantics, current operational generations
and no replay of elapsed targets. One-off Trash stays outside export; recurring
deletion exclusions remain portable to prevent occurrence regeneration.

## ADR 008: Current visual roles and keyboard layout contract

The [7 October R3/R4 amendment](design/approved-ui-r3-r4.md) accepts the visual
template with documented corrections. Structural icons use shared neutral roles;
intentional actions/focus, category identity and labeled status have distinct
roles. A single global atmosphere replaces task-specific screen environments in
the current direction. A36 fixes Automatic/manual policy and defaults;
legacy per-reminder appearance proposals are historical, not active migration work.
These decisions do not add an engine, scheduling or storage authority.

The planned editor uses one persistent Save footer outside form scrolling but
inside the same Android IME-aware usable region. One owner handles IME/system
insets; the scroll viewport accounts for the measured footer and keeps focused
Title/Notes/caret/error content reachable. The current toolbar Save/basic keyboard
resize is not acceptance evidence for that layout. TD-03 implements the client
presentation while preserving native command identity, validation and retry;
TD-06 records real keyboard/TalkBack observations in the consolidated run.

## ADR 009: Alarm completion receipts and scroll-driven browsing

The [alert experience](design/current/alert-experience.md) supersedes visible Stop
wording while preserving legacy commands. On the existing serialized worker,
CompleteDelivery/DoneAll and compatible Stop/StopAll atomically commit protected
operational Completed state, generation fences, command-bound receipts and pending
completion rows. New DoneAll binds the displayed members/generations and validates
all before mutation; legacy StopAll snapshots current session members. The final
member detaches and ends audio before CE completion/materialization, including
before first unlock. Legacy receipt checks preserve historical retry semantics.

Before CE queries, mutations/revision checks, import and export, materialize missing
recurring content and project pending completion into one CE transaction: increment
the revision, complete the same nominal occurrence, and write one Done at the
original completion instant. A matching history operation proves that transaction already
committed; a lost protected acknowledgement never re-completes a later Reopen.
Receipts bind occurrence/generation or session and retain the original result across
restart. That completion correction left CE 5 and portable backup 3 unchanged; old Stopped actions do not
retroactively complete content. Timeout/interruption still leave work unfinished.

SnoozeAll atomically captures its session/member fingerprint, current mirrored
duration, action instant/common target, new generations and deterministic Snooze
journals in DP6 before detachment and registration. Stored per-member outcomes
support exact retries of unfinished registrations without recapturing members,
moving the target or overriding newer generations. Mixed results return Partial;
unknown replies retain the captured command. Elapsed recovery targets stay silent.
Existing settings transactions already synchronize snoozeMinutes on all protected
alerts/plans; no additional preference store is introduced. New single Snooze
checks expectedSnoozeMinutes after receipt lookup. Legacy omitted guards retain
their behavior. Capabilities exposes activeSessionActions; occurrences expose
overdueAtMs/quickSnoozeMinutes, all read-only native projections.

Shared browsing chrome has one native Animated scroll value. Stable expanded hero
composition stays fixed while the opaque reading plane translates over decoration.
The 11 October header correction also drives a static canvas gradient's opacity
from the same value using native smoothstep arithmetic, with stable onSurface
foreground and no threshold/per-scroll React appearance updates. The last 64 dp
blends a 66% scrim to opaque; measured control/subtitle bounds precede a 40 dp
feather. Expo SDK 57 LinearGradient supplies the native/Web view. A nominal 200 dp opening
contains a measured 56 dp toolbar. Editing/utilities, usable height below 480 dp or
font scale at least 1.6 use compact chrome. Saved content offset initializes both
scroll, cover and surface opacity. Reduced motion preserves this direct relationship.
Safe-area/IME/footer geometry retains one owner.
Native alarms retain dedicated layout and captured session appearance; supported
notification accents and non-private loading extras use that same pair.

The 10 October UX refinement adds frontend-only applied/draft filter state,
date-section card context, semantic timing formatting, owned input refs and an
ephemeral timed editor snapshot (civil clock, elapsed duration, linked offsets).
The snapshot is never serialized into commands/backups/storage; transitions use
the existing native civil converter and serialized timing-update guard. Preview
identity excludes Title/Notes and uses a non-private placeholder. The compact
alarm-check page owns captured Test recovery; lifetime preference ownership stays
in the existing singleton. UTC carrier dates adapt minutes-of-day picker values
without converting a shortcut into a dated alarm. No engine/bridge/database/
backup version, eligibility or overdue authority changes in this refinement.

## Weekly routine lifecycle and durable progress

### Day tabs and structured targets — owner correction, 18 October 2026

New authoring drafts are General/ByWeekday. Tabs select a weekday; its nonempty
sequence determines scheduling. Copying allocates independent materialized IDs and
shares immutable image references. Existing Shared versions remain readable; UI
Save converts the new revision to ByWeekday, preserving IDs/checks and stripping
links. Direct row Save edits only the captured weekday and performs that conversion.
Opening/cancelling never persists conversion. Historical versions remain untouched.

RoutineExercise gains optional exerciseTarget: sets/reps/repsMax, duration(value,
sec/min/hr), eachSide, weight(value,kg/lb), additionalText. Nonempty legacy target
text and exerciseTarget are exclusive. Numeric entry strings remain process-only;
normalized optional numbers are validated natively before capture. No derived
summary is stored; matching RN/Kotlin localized formatting consumes immutable data.
Whole-edit numeric syntax guards preserve transient strings and normalize a single
decimal comma without changing that native authority. The separate routine Date
and time/Alert sheets capture process-only drafts and merge only their own fields
into the parent. Picker-field styling and centered weekday dots add no stored state.
JSON already lives in credential-protected versions/sessions, so CE17/DP9 stay.
Format9 validates structured targets and snapshot consistency before atomic import,
retains formats1–8, and never parses legacy target text. All authoring still uses
the serialized command path, revision guards and receipt-first exact retries.

### Generic authoring correction — 18 October 2026

CE17 adds authoringMode (Shared/ByWeekday) and presentationPreset (General/Exercise)
to immutable versions. Migration16→17 defaults legacy versions to ByWeekday/Exercise,
without changing day/snapshot JSON, checks or immutable IDs. DP remains9 and private
authoring metadata never enters its delivery profile. Shared definitions still use
seven arrays and unique day-specific step IDs; sharedStepId explicitly links siblings.
Validation requires identical ordered shared keys/content across scheduled days.
Completion remains dated/materialized-ID based; direct edit resolves exact ID to
shared key, never title/ordinal matching. Reorder/content edits preserve both IDs.
Unsaved off/on caches copies; saved unscheduled days remain empty Rest definitions.

Separate routes share fields, not owning submission lifecycles. Child Add/Done is
draft-only; the later Day tabs direct-edit path uses captured EditRoutine, converts
Shared to independent and updates only the captured weekday. Legacy missing Edit
metadata inherits the loaded version; legacy Create
uses ByWeekday/Exercise. Receipts preserve exact captured retry identity before stale
checks. Session presentation resolves preset from versionRevision, freezing history.

Portable format9 includes both metadata fields, shared links and structured targets
in the existing photo archive. Format8 metadata remains readable; formats1–7 import
with legacy defaults. Validate linkage and targets before commit;
retain whole-family copy/conflict identities, media leases, streaming, integrity and
resource bounds. Invalid metadata cannot partially mutate content. Curated preview
content stays inert; native reconciliation/delivery authority is unchanged.

The 15 October owner-approved routine extension adds a nullable `routineId` to
CE reminders (default null), keeping ordinary reminders' overdue and delivery
semantics intact. CE14 added plans, effective-date versions, dated snapshots and
routine operation receipts. Each snapshot freezes ordered exercise content and
stores explicit completed IDs, an independent irreversible `ended` flag, revision
and correction history. Local dates use the recurrence kernel's Monday=1 convention.
Rest is authored plan data; only workout weekdays enter weekly floating recurrence.

`RoutineCoordinator` runs only on `AlarmEngine`'s serialized mutation worker.
It resolves today's slot with the existing segment/nominal identity even after
the notification time. Reads, actions and recovery settle pending operations and
close past dates before projecting results. Ended routines are excluded before
active filtering/sorting/counting/pagination; they have no overdue boundary.
Ordinary Done/Reopen/Snooze and series mutations reject routine targets. Dedicated
exercise commands bind operation ID, date, occurrence, stable step ID and expected
session revision. Committed receipts are checked before revision validation.

Progress first captures a CE operation containing the desired explicit state and
actual action timestamp. Aggregate completion/skip changes fence the DP generation
and cancel delivery, then snapshot/header/history/receipt commit in one CE
transaction. Reconciliation finishes interrupted operations before generic schedule
recovery. A history correction can change completion without clearing `ended` or
registering delivery. Plan/Alert/time/Notes/sound/photo edits replace recurrence
from the saved local date. A captured EditRoutine journal fences today's delivery,
then appends the immutable revision and updates an open today's snapshot/header in
the same CE transaction. Preserve the original occurrence/nominal identity and
matching stable-ID checks; revision advances reject cached exercise/widget commands.
Retain removed-step action audit against previous plan revisions. Rest has an empty
snapshot, no completion requirement and cancelled delivery. Ended days are never
rewritten, including after clock travel. Reconciliation suppresses elapsed/already
posted delivery. Today's edited DP alert is a day-started exception retaining its
original segment identity. A scheduled, unprompted open-day exception may deliver
from an Archived segment; Paused/Changing plans do not grant that exception.
Pause fences the owned day's alert before its CE commit, and Trash fences all
family members. Generation/date/expiry checks remain mandatory before unlock.
Updating the plan clock changes that alert's content-free target at the edit
fence; ordinary completion/Undo preserves explicit Snooze targets.
Pause intervals exclude newly materialized paused dates;
an existing session can still finish. Resume never replays elapsed prompts.

DP8 added a content-free `RoutineQuiet` profile on plans/alerts, an alert
day-expiry instant and irreversible day-ended/prompted delivery flags. It contains
no routine titles, exercise definitions, checks or
correction history. The stored profile name remains backward-compatible; actual
Alert mode selects Alarm or Notification. CE15 adds versioned overall Notes, sound and vibration with safe migration defaults.
It also replaces the effective-date primary key with `(routineId, revision)` and
binds each dated session to its exact immutable `versionRevision`. Legacy CE14
rows receive deterministic IDs in authored insertion order and existing sessions
retain their exact date-to-revision references. Effective dates are availability
boundaries, not identities: repeated edits after clock travel append revisions
instead of overwriting content referenced by a closed day. The newest authored
eligible revision governs a new day. Dated projections resolve Notes, Alert/time,
sound, vibration and exercises from their saved revision, never the latest plan.
Only removal of a deleted list reference normalizes historical version rows.

The existing scheduler/receiver handles routine Notification
with approximate fallback. A registered delayed callback may deliver once within
its original date; recovery does not post elapsed targets. The separate low-importance
channel defaults to no sound/vibration and remains user-controlled. Posted prompts
have a remaining-day timeout and reconciliation cancellation, no Done/Snooze
controls, and generic public/pre-unlock text. Deep links retain occurrence identity.

Portable format 6 includes plan and immutable revision IDs, exact dated revision
references and applicable revisions (including Notes/sound/
vibration), snapshots and action history,
but no routine operation receipts, Android generations/handles, alarm sessions or
Calendar state. Readers retain formats 1–5, defaulting omitted new fields. Restore remaps plan/family/segment/date
identities together for conflict copies, restores purge exclusions first and
preserves retry-stable imports. Routine authored data is excluded by native Calendar
publication/link/export guards. The widget uses these same queries
and guarded commands; React state and presentation refresh timers have no durable
progress or scheduling authority.

## Routine Alarm delivery and reversible progress

Routine Alarm follows normal exact-alarm/access/audio registration. Ordinary
completion and bulk actions reject routine members; a routine alert has dedicated
Dismiss/Snooze commands. Start first confirms Dismiss, then opens its selected
occurrence/date after keyguard dismissal. Mixed sessions retain per-member
controls and never expose ambiguous whole-group completion.

DP9 adds content-free routine alert receipts with command identity, input
fingerprint, captured occurrence/date/generation/session, action timestamp, frozen
Snooze target and settled result. Matching receipts precede live date/revision
checks; retries acknowledge the captured result and cannot retarget another day.
All command namespaces protect these identities, including Calendar operations.
The operational outbox remains separate from durable retry receipts. No authored
content, exercise checks or private Notes enter DP or portable operational state.

Routine Alarm retains the ordinary bounded callback-lateness policy; only its
quiet Notification callback may arrive later within the original open date.
Recovery, resume and creation never replay elapsed targets. Explicit Snooze can
rearm prompted eligibility for a same-day future target; blocked registration
never silently becomes Notification. Final exercise/Skip/Pause/deletion and day
closure detach only the affected ringing member. The native service requests the
earlier routine member-expiry boundary without shortening an ordinary member’s
shared session deadline. Read/action/recovery guards remain authoritative when
clock or zone changes. An already-started date that ceases to be today ends
irreversibly; untouched future registrations remain future work. A frozen session
owns its plan/date across replacement segments. Recovery writes terminal protected
exclusions for competing occurrences before publishing a replacement rule, so a
crash or Direct Boot cannot revive that date. Queries also reject those competing
occurrences; the original dated session and its correction history remain intact.

## Native home-screen widget

RW-03 uses Glance 1.2.0 and native Compose configuration inside the owned Android
module. The bridge only exposes widget support and opening setup. Glance reads
WidgetSnapshot through AlarmEngine.request; WidgetCoordinator projects the same
dated routine session and a native Today/overdue ordinary-reminder query. The
union is selected before ordering/counting/pagination, capped at 20 widget rows.
No reminder delivery, recurrence or progress authority moves into Glance.

The CE `remilo-widgets-v1` preferences contain versioned per-instance configuration,
captured command descriptors and per-instance completion identity history. AlarmEngine's
single worker owns all reads/mutations. Descriptors bind configuration revision,
date, occurrence, stable exercise ID, expected session revision and operation ID.
Routine receipts precede stale checks for committed retries. A pending identity
survives an uncertain outcome; the refreshed widget offers the exact Retry, and a
committed receipt reconstructs progress/Undo after process death. No copied
exercise checks, DP content, database migration or portable backup change is added.
Widget-ID restore copies configuration only and mints fresh action descriptors.

The CE `undoHistory` array stores completion token, stable exercise ID, date,
occurrence and configuration revision in confirmed order. Snapshot reconciliation
retains only current, non-ended/non-deleted session entries whose checked exercise's
latest native change is that recorded widget completion. It selects the newest
remaining entry and captures a fresh revision-guarded Undo descriptor with an
`undoOf` completion token. Confirmation removes exactly that entry, exposing the
preceding eligible completion. Unrelated app/other-widget changes remain intact;
overwritten or removed targets drop out. Reconfiguration/date/session replacement,
Trash/unavailability and widget-ID restore discard the history. Skip suspends its
controls; Pause follows existing open-session eligibility. Retain all eligible
entries up to the native 100-exercise limit plus 56 bounded stale retry descriptors.
Pending Undo recovery consumes its captured entry once, including after process
death. Receipt replay without matching pending state never changes the history.
An installed legacy `last` entry upgrades to one eligible record using its retained
descriptor; cached legacy Undo descriptors and pending receipts remain compatible.
Pending projections also carry the captured action's direction and exercise name
for accurate Retry confirmation. This presentation metadata never changes its
descriptor, target or native eligibility.

Native commit/presentation hooks enqueue coalesced WorkManager refreshes without
depending on bridge observers. Active widgets also retain a 30-minute recovery
opportunity and a one-time next midnight/atmosphere-boundary request. Final-widget
removal cancels periodic/boundary work and prunes preferences. WorkManager is not
initialized before first unlock; the direct-boot path sends generic RemoteViews
without CE or Glance access. Unsupported hosts receive generic content. Home-screen
and `not_keyguard` metadata limit placement; Android/launchers retain control of
cached pixels and refresh timing. Every mutation still checks native date/revision.

An active Glance session collects a discardable StateFlow of native projections;
`updateAll` alone does not rerun the initial `provideGlance` data load. Refresh
workers and exercise callbacks reload through the native worker before publishing.
A process-local native projection epoch rejects late older query results, while
language/clock/zone/font presentation changes invalidate the view. This cache
never validates commands or stores progress durably and is pruned with instances.

WidgetSetup resolves first-routine defaults only inside configuration drafts and
constructs localized inert example projections for every setup/picker preview. It never
mutates plans or persisted widget state. A missing saved routine remains missing.
Production uses Glance SizeMode.Exact; setup supplies the measured dp width and
height to the same composition and fills its RemoteViews host explicitly. Fixed
footer actions remain outside bounded list content; compact Today renders one
complete reminder row, while expanded native collections remain scrollable.
WidgetSizing budgets both reminder text lines using native font top/bottom
metrics and scaled line-height floors, plus padding. Today minimum/preview height
also budgets header/title and Agenda footer; small actual hosts fall back to
summary. A fixed 56 dp text row no longer clips the reminder time.
WidgetSizing shares interactive and selected-routine-footer preview heights with
production breakpoints and increases setup height for scaled text. Healthy Focus
has no action footer. In healthy compact Focus, a current-text region of at least 56 scaled dp
and a reserved native-font Next band form the left column. The complete Done/Undo
group aligns to its bottom, retaining center alignment within the action group.
StaticLayout includes fallback-font spacing and padding across the session's
authored names; measurement does not instantiate Views or require a main Looper.
The reserved band preserves action coordinates when the prescription or Next is
absent and through eligible final Undo. Compact Today uses the same composition
above its separate full Agenda footer. Expanded/recovery layouts retain their
existing grouping. Expanded views retain one Next label with upcoming content. Next is
derived from the same session's second unfinished stable step, never tomorrow's
plan. No visible ordinal is added to the exercise name. The header formats the
projection date as a full localized weekday; the complete localized date and
exercise position remain accessible. Routes/descriptors still carry exact dates.
Done invokes the native callback with its captured descriptor;
there is no ambiguous Resume navigation button. A reserved unfilled 48 dp Undo
target precedes trailing Done, disabled without an eligible descriptor and held
in place after final completion. Interactive Focus requires 300×200 dp at normal
text and wider/scaled budgets thereafter; Today/recovery uses a separate footer.
Undo's enabled Glance and inert native paths share one 24 dp drawable frame with
a 20 dp inner glyph. Disabled uses the same neutral tint with image alpha 97/255;
it never swaps to an opaque disabled text color or a differently sized graphic.
The inactive native control has a localized XML description plus the runtime
named label and disabled state, with no attached callback.
Only known failures expose Refresh. Native app/widget completion commits drive
the same projections; no progress or scheduling ownership changes.
An explicit successful refresh acknowledges only that instance's saved conflict
notice through the serialized native worker. It preserves pending operation and
receipt identities, so refresh cannot discard or retarget an uncertain command.
Background refreshes do not acknowledge feedback automatically.

The progress leaf is a weighted horizontal AndroidRemoteViews layout, one native
ImageView per segment for 1–12 steps, avoiding Glance's ten-child Row cap.
Primary/container roles exactly match app accent/soft for segmented/continuous
progress. Generated previews use the same composition at 300×240/440; canonical
Sky light/dark resources supply the host-brightness XML fallback.

WidgetPresentation owns discardable process-only action tickets keyed by widget
and captured token/context/revision. It guards local duplicate submissions and
publishes the captured projection immediately, adding Saving after 250 ms without
an extra read queued behind the engine. After command confirmation and fresh
native projections, only the initiating instance gets a 1.5-second named check;
later actions/timers cannot overwrite newer feedback. Replayed receipts never
recreate success feedback or Undo. Native coroutine timers sit outside the
serialized worker, with no JavaScript timer or polling. Privacy, configuration,
date and session revision changes fence overlays. Process death loses only the
overlay; durable descriptors/receipts still own recovery and progress.

Exercise-row editing captures routine/date/weekday/stable ID, loads the latest
definition and shares the weekly editor's form/photo chooser. Its Save replaces
only that ID in the captured weekly draft through existing EditRoutine, with
one operation ID and expected plan revision. Concurrent plan edits reject and
retain the draft for explicit reload; native open-day reconciliation preserves
matching checkmarks and ended snapshots. Image leases persist through uncertain
Save. Selection and Edit are sibling controls; only today/future unended rows
expose Edit. No new bridge, schema, backup format or progress store is introduced.

## Routine media, family Trash and portable archives

CE15→16 adds routine prior-state/Trash interval metadata, immutable exercise image
metadata and family purge exclusions. DP9 remains unchanged. A captured journaled
Trash/Restore/Purge operation fences each family's DP plans/alert generations,
then commits CE ownership and its receipt on the existing serialized worker.
Recovery settles captured family operations before series replenishment. Queries
exclude trashed children before counts/order/pagination and emit one typed
RoutineFamily Trash projection. Restore never uses occurrence UndoDelete and
retains preexisting child deletion, completion, skip and ended states.
Trash and Restore advance occurrence/session revisions without changing those
states, so an uncommitted cached command cannot revive after ownership is restored.

The bridge launches a transient Photo Picker transport; the engine holds no
Activity/React reference. Bounded decoding/I/O runs separately. Full-frame,
orientation-correct, metadata-free WebP files (2048 px long edge, <=4 MiB) live in
CE files under immutable SHA-256 IDs; source selection is capped at 50 MiB.
Only metadata, references and draft leases mutate on the engine worker. GC keeps
all plan revisions, frozen sessions, Trash, draft and export leases; abandoned
unreferenced images and interrupted source copies become eligible for cleanup
after 24 hours. Unlocked engine reads offer cleanup at most hourly; referenced
history never expires. Durable content contains no picker URI.

Portable format 9 is a streaming .remilo ZIP: content.json (existing 10 MB bound)
plus media/<hash>.webp, with a 200 MiB archive/expanded bound. Validate entry paths,
uniqueness, manifest, hashes, dimensions and decodability before installing files
and atomically committing content references. Prepared CE import handles replace
raw JSON in the UI; receipt-first retries bind the same handle/copy choices.
Legacy JSON versions 1–6 and format-7/8 archives remain readable. Widgets, OS handles, generations and
private operational sessions remain excluded. Widget progress/actions retain
native authority; exercise navigation retains an exact exercise ID in the dated deep link.
Format-7/8 validation accepts immediately edited snapshots whose original nominal
identity differs from the updated alert time, checking current definition/metadata
and the original segment identity. Rest snapshots remain empty/uncompleted, and
removed-step audit references must resolve to retained immutable plan revisions.
CE17 adds authoring/preset metadata as described above; DP9 stays unchanged.
Portable version 9 adds optional structured targets to version/snapshot JSON;
version8 linkage remains readable along with formats1–7. Invalid targets reject
before committing media/content, and closed snapshots are never reformatted in storage.

## ADR 010: Uniform Postpone and durable absolute group targets

The owner's 28 October chooser correction adds read-only resolvePostponeTime and
PostponeAll. A pure Kotlin policy resolves elapsed 15/30/60/1440-minute selections,
calendar Tomorrow clock values and custom civil time through CivilTime. App/native
drafts capture settings and device zone; selected targets are fixed instants, with
expired confirmation rejected. Custom fields are provisional until Use this time.
Choosing/cancelling never changes delivery or its original audio deadline.

PostponeAll binds kind, session, sorted captured IDs/generations and absolute target
to a distinct fingerprint. One serialized DP transaction validates the complete
captured set, creates new generations, recurring exceptions, Postpone journals and
recoverable registration members before audio detachment/registration. Later
arrivals stay excluded; exact receipt lookup precedes new-action future validation.
Retries preserve targets/results and never override newer work or retime elapsed
targets. Legacy Done/Snooze identities and notification actions remain compatible.

The integrated DP10 upgrade retains the bulk_snooze_receipts/members SQL identities while adding a kind
defaulted to SnoozeAll and nullable duration. The receipt table is rebuilt with
unchanged legacy values. A separate postpone_preferences record mirrors only three
clock-minute integers and source settings revision. The Routines CE17 and backup9 remain unchanged.
Direct upgrades recognize both known version-8 schema identities and preserve their
receipts and fields, as well as the existing Routines version-9 data. Unknown
version-8 identities fail closed. No downgrade or destructive fallback is used.
Absent/corrupt pre-unlock mirrors leave Tomorrow choices unavailable; relative and
Custom continue. CE settings/retry/unlocked recovery repairs the mirror.

The native activity owns an editable operational draft separately from pending
commands, saves exact alarmAtMs/scope/picker state, defers replacement intents and
re-reads private titles. RN Details likewise binds its opening generation. Native
timeouts dismiss unsubmitted pickers; unknown submitted commands remain frozen.

The owner confirmed that Routine Start/Snooze/Dismiss controls and dated-session
expiry remain unchanged. The uniform chooser and PostponeAll apply to ordinary
reminders; mixed groups retain the existing per-member controls.
