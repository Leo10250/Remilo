# Architecture and consequential decisions

## ADR 001: Shared UI, autonomous Android implementation

Accepted: React Native/Expo SDK 57 UI; tracked Android native project; local Expo
module as a thin bridge to normal Kotlin classes. SDK 36, minimum API 34.
No Prebuild after bootstrap, no OTA, no iOS until the last optional phase.

An Expo module coroutine can be cancelled on teardown. The engine has its own
application-context lifetime and serialized executor; committed operations remain
recoverable independently of their bridge promise. Receivers/services never load JS.

## ADR 002: Storage protection and authority

Credential-protected Room owns content, event/due timing, completion and history.
Device-protected Room owns current operational eligibility, targets, generations,
sessions and native action records. No content or credentials belong in the latter.

Definition-derived schedule changes have narrowly scoped pending-operation records.
Stop/Snooze journal records describe history; replay never changes newer operational
state. Alarm-affecting commands fence stale generations before acknowledgement.
OS registration and database commits are not atomic: reconcile idempotently and
return Scheduled/Blocked/Pending distinctly. Every callback rechecks eligibility.

The serialized engine constructs a complete notification snapshot before service
dispatch and passes it in the explicit, non-exported service intent. Foreground
promotion is immediate and never waits for another Room query on the main thread.
There is no actionless placeholder. Subsequent member refreshes update the same
notification; actions retain the delivery generation from their snapshot and stale
ones are rejected. Before unlock, the snapshot contains generic text only.

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
controls use the saved appearance after unlock, and system appearance before unlock.

## ADR 004: Unified presentation without another state authority

The 0.4.0 redesign adds agenda/overdue/completed query views without a Room schema
change. Membership derives from completion/due time; grouping derives from event
time. Group rank, event start and occurrence ID order all matching rows before the
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
Notification Stop all carries immutable session identity and rejects an old session.

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
