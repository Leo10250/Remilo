# Architecture

React Native presents Remilo's main interface. Ordinary Kotlin classes own durable
content, scheduling, actions and recovery. Expo module instances, React contexts,
activities, JavaScript timers and network availability are not engine lifetimes.
[Product](product.md) owns user-visible semantics; [Calendar](calendar.md) owns the
optional integration protocol; [verification](verification.md) owns how changes
are checked. Exact versions and data structures remain executable source.

## Source map and mutation ownership

| Area | Source |
|---|---|
| Engine and one serialized mutation path | [AlarmEngine](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/AlarmEngine.kt), [SeriesCoordinator](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/SeriesCoordinator.kt), [RoutineCoordinator](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/RoutineCoordinator.kt) |
| Private content and operational storage | [ContentDatabase](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/ContentDatabase.kt), [OperationalDatabase](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/OperationalDatabase.kt) |
| Pure timing/identity policies | [core](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/core) |
| Android registration, delivery, audio and presentation | [system](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system) |
| Native bridge and public types | [RemiloAlarmModule](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/RemiloAlarmModule.kt), [bridge types](../modules/remilo-alarm/src/RemiloAlarm.types.ts) |
| Main routes, presentation and process-only controllers | [src/app](../src/app), [src/ui](../src/ui), [src/domain](../src/domain) |
| Calendar native ownership/transport | [calendar](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/calendar) |
| Native widget projection/actions | [widget](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/widget) |
| Native policy, migration and lifecycle regressions | [native tests](../modules/remilo-alarm/android/src/test/java/com/remilo/alarm) |

UI and system actions enter the same serialized native mutation worker. Coordinators
reuse it rather than introduce independent queues or state owners. Database reads
that need reconciliation use this owner before projecting results. UI queries,
optimistic drafts, observers and previews do not schedule or persist independently.
Calendar HTTPS, authorization, photo decoding and archive streaming use separate
I/O execution, posting guarded results back to the owner. Slow I/O must not block
alarm actions. A bridge/activity teardown cannot cancel already captured durable work.

Commands capture operation identity, complete input and appropriate content revision,
delivery generation, session/date and member scope. Reusing an operation ID with
different input is rejected. Exact receipt lookup precedes validation against newer
live state, so a lost reply can acknowledge its original result without repeating
work. A new action still validates current eligibility. UI uncertainty retains the
same request; an acknowledgement is distinct from successful OS registration or
remote synchronization. Report Scheduled, Blocked, Pending, Partial and rejection
according to actual native outcomes.

Database commits and Android registration are not atomic. Fence older generations
before acknowledging alarm-affecting commands; durable pending projections/outboxes
reconcile OS effects idempotently. Every callback rechecks eligibility and generation.
Journals recording old history cannot overwrite newer operational state. Unknown
outcomes never justify an automatically allocated replacement operation.

## Storage, privacy and compatibility

| Store | Authority and allowed data | Exclusions |
|---|---|---|
| Credential-protected Room (CE) | Private definitions, event/due/authored alert, lists, history, immutable routine versions/dated progress, Calendar state and durable private operation data | Must not be opened before unlock |
| Device-protected Room (DP) | Current operational eligibility/targets/generations, allowlisted recurrence/delivery profiles, sessions, native action receipts, pending completion, minimal global appearance/language/Postpone mirrors | Titles, notes, list/category identities, routine steps/checks, user image paths, Calendar content/account labels/tokens and credentials |
| Credential-protected files/cache | Immutable custom images, prepared bounded imports, leased export snapshots and share files | No permanent picker URI as authored image identity |
| Portable backup | Authored content, portable next alerts, history, lists, retained recurrence exclusions, routines/dated progress and referenced images | Credentials, Calendar links/jobs/cache/permissions, settings/language/appearance, OS handles, operational generations/receipts, running alarm sessions and widget configuration |

Current source declares CE **17**, DP **10** and portable format **9** in the linked
databases and [BackupCodec](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/BackupCodec.kt).
Room schemas/migrations and their tests own exact compatibility. Do not infer
compatibility from a matching version integer alone. DP10 accepts the two known
version-8 schema lineages and Routines version 9 while preserving their receipts and
fields; unknown version-8 identities fail closed. Never install/open older incompatible
storage through downgrade/destructive fallback, uninstall/data clear or a new key.

A settings mutation commits CE preferences, updates its allowlisted DP mirror and
then acknowledges. Exact retry repairs an interrupted mirror. Mirrors contain only
needed non-private enums/revisions or Tomorrow clock-minute integers. Appearance,
language or shortcut edits do not change occurrence generations, targets or history.
Before unlock a missing Postpone mirror makes Tomorrow unavailable rather than
substituting guessed settings; unlocked reconciliation repairs it.

Purge commits minimal anti-resurrection identity and receipt with private record,
history/outbox and payload removal. Materialization/import/completion replay respect
those exclusions. Recurring exclusions restore before replenishment. Late Calendar
or engine callbacks cannot restore erased content. This is logical deletion, not
secure erasure of database pages or external backups.

Native failure diagnostics use a bounded allowlist of failure category, numeric
migration versions and safe exception class. Arbitrary exception messages, SQL,
paths, identity hashes, content and credentials must not enter diagnostics. Rejected
newer schemas preserve their data/version and cannot trigger alarm cancellation or
registration as a side effect.

## Android delivery and recovery

Application/providers, receivers, service and Activity must all be safe before first
unlock. Keep one process and defer CE/React startup until needed after unlock.
Protected scheduling and actions require neither React/Expo nor network. Android
source under `android/` is owned; do not regenerate it with Prebuild.

Independent registrations carry occurrence/generation identity. Scheduling policies
are pure Kotlin; Android adapters translate them to supported platform APIs. Alarm
requires its capabilities without silent mode substitution. Notification may use
its explicit approximate fallback. Recovery reconciles durable future eligibility;
it never restarts interrupted audio or replays elapsed work.

The engine constructs an actionable notification snapshot before dispatching the
non-exported service intent. Foreground promotion does not wait for another Room
query on the main thread or display an actionless placeholder. Public/pre-unlock
variants use generic text. Refresh updates the same notification with captured
member generations; stale PendingIntents remain harmless through native validation.

Ringing session state owns member identity and first-member presentation/audio.
The service/audio controller uses a monotonic original five-minute deadline.
Arrivals do not extend it. Detaching the last member durably ends the session and
signals audio directly, before optional CE materialization/history work. A stale
callback cannot stop a newer session. Timeout/interruption leaves work unfinished.
Routine member date-expiry can detach that member without shortening another
ordinary member's session deadline.

CompleteDelivery/DoneAll and compatible Stop/StopAll atomically commit protected
completion, fences, command-bound receipts and pending CE projection. New group
commands bind displayed member/generation snapshots; legacy command semantics remain
compatible. After unlock, pending completion writes the same nominal occurrence,
revision and one Done history entry at the original action instant. A matching
history operation proves that projection already committed; a lost DP acknowledgement
cannot recomplete a later Reopen. Historical Stopped actions remain unfinished.

SnoozeAll/PostponeAll first validate the entire captured ordinary set in one DP
transaction. Capture kind, member fingerprint, original action/common target,
generations and recoverable per-member registration outcomes before detachment.
PostponeAll is not a UI loop of single commands. Exact retries retain targets/results,
exclude later arrivals and cannot override newer generations or move elapsed targets.
Receipt lookup precedes new-action future-time validation.

[PostponeTimePolicy](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/core/PostponeTimePolicy.kt)
is the shared read-only elapsed/Tomorrow/custom resolver. Native draft saved state
contains operational scope, exact target, captured zone/settings and picker state,
never private titles. An unsubmitted draft closes on confirmed terminal session;
a submitted unknown command remains frozen. The native chooser lives inside
AlarmActivity's window; child pickers inherit secure/show-when-locked policy.

Ordinary notification Postpone uses a direct immutable Activity PendingIntent to
MainActivity/Home with only allowlisted captured IDs/generations/session members.
MainActivity retains cold/warm intents; app routing gives every arrival a distinct
presentation identity. A process-owned controller preserves draft and exact pending
command across Home/Details, queues competing requests and revalidates eligibility.
Opening this request is read-only and private Home waits for normal keyguard unlock.
No notification trampoline, timer or schema is introduced by routing.

SoundPreviewController is a separate process-owned native controller serialized
with engine requests. It owns identified callbacks and five-second audio release;
backgrounding, replacement and real alarm startup stop it. Module instances only
observe/query. An accepted request is not Playing until actual playback confirms,
and fallback/failure is exposed. Preview failure cannot prevent a real alarm.

## Civil recurrence and queries

[CivilTime](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/core/CivilTime.kt)
and [Recurrence](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/core/Recurrence.kt)
own conversion and nominal slots using `java.time`. Identity is segment plus original
nominal slot, not a postponed target. Event duration is elapsed; linked due/alert
offsets are civil values resolved independently. Gap resolution shifts by gap size;
folds choose the earlier offset. Untouched existing instants, including later-fold
instants, are preserved. Floating travel changes eligible future ordinary work only;
old unresolved/postponed occurrences retain their resolved identity/timing.

Protected plans contain an explicit non-private rule/delivery allowlist. Replenish
two independently registered future ordinary occurrences before presentation;
postponed/single-edited exceptions are additional registrations. A nominal cursor
retains missed history beyond that window after long absence. Valid nominal COUNT
includes individually completed/skipped work; invalid dates do not consume it.

Series changes fence future generations and journal their intended definition before
CE commit. Recovery distinguishes committed changes from the prior rule. Following
edits bound an old segment and add a new one; whole edits retain archived segments.
Pause spans the active family while preserving exceptions, and editing preserves
pause. Reopen/restore of an occurrence stays an independent exception and never
widens the ordinary coverage window or replays an elapsed target. Source validation
bounds (years 1970–9999, intervals 1–999, counts 1–100,000 and bounded timing offsets)
are parser/product limits, not Android registration limits.

Native Agenda/collection queries capture clock and zone once. Filter, group, order
and aggregate the full matching dataset before slicing a page. Overdue is a pure
[authored-boundary policy](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/core/OverduePolicy.kt),
independent of next delivery/Due. Collection timestamps derive from recorded relevant
history with deterministic legacy fallback. Family queries aggregate retained
segments without creating another definition or scheduler. Foreground invalidation
and minute refresh change presentation only; explicit pull owns its separate spinner.

Lists have CE identities/revisions. Remove clears memberships across current,
terminal, exceptional and archived content/templates without series edits or target
changes; stale references fail. Restore preserves whole-family conflicts, remaps
explicit copies deterministically and keeps empty lists/name-collision explanations.

## Routines, media and widgets

RoutineCoordinator reuses the engine worker. Immutable versions contain ordered
day-specific steps, General/Exercise preset and authoring metadata. Stable materialized
IDs survive rename/reorder; legacy Shared links are explicit identities, never names
or ordinals. Opening a legacy plan converts only a process draft; Save creates an
independent ByWeekday revision. Closed sessions keep their exact version revision.

A dated session owns explicit completed IDs, revision, correction history and an
irreversible ended flag. Queries/actions/recovery settle operations and close past
dates first. Commands bind operation, occurrence/date, stable step and session
revision, with receipt-first retry. Ordinary completion/series actions reject routine
targets. Progress captures desired explicit state/action time, fences aggregate DP
delivery, then commits snapshot/header/history/receipt together. Today edits append a
version and reconcile the open snapshot while preserving identity/checks; ended
history is untouched. Pause, family Trash, final progress and date closure fence the
appropriate generation. Neither recovery nor a changed rule can revive a competing
occurrence for an ended date.

DP routine profiles/receipts contain only operational expiry/prompted/ended flags
and captured command/target results, not titles/steps/checks. Quiet Notification
callbacks may deliver once within their original open date; Alarm retains ordinary
lateness policy. Explicit routine Snooze stays within that date. Start confirms
Dismiss before opening exact dated content. Metadata corrections never rearm delivery.

Custom photo transport/decoding is separate from the engine and retains no Activity
reference. [ExerciseImages](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/ExerciseImages.kt)
stores orientation-correct, metadata-free immutable SHA-256 WebPs in CE files
(2048 px maximum edge, 4 MiB/file; selected sources bounded to 50 MiB). Draft/export
leases, historical versions, dated snapshots and Trash protect referenced images.
Unreferenced interrupted copies may be collected after 24 hours; unlocked cleanup
opportunities are bounded to once/hour. Durable content stores no picker URI.

Glance configuration, WidgetCoordinator and WidgetActionRunner read/project the same
native sessions/query results. Widget instances retain their own dated completion
identities and guarded Undo/Retry/configuration; another surface's changes are not
silently reversed. Pending actions show delayed Saving/confirmed feedback without
blocking the next acknowledged action. Date/session/configuration changes invalidate
old eligibility. Summary/large-text layouts open app actions rather than clip
controls. Launcher refresh can lag; command guards remain authoritative. No React,
JS timer, network or second progress store is involved; widget configuration/actions
are local and excluded from portable backup.

## Portable data and platform handoffs

[BackupCodec](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/BackupCodec.kt)
validates complete portable data before content mutation. Format 9 carries structured
targets in existing immutable version/session JSON, preserving authored legacy text.
Readers retain formats 1–8. The current .remilo transport is a streaming ZIP containing
content.json plus exactly its referenced media files; legacy JSON remains readable
when it requires no missing custom-image payloads.

[PortableFiles](../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/PortableFiles.kt)
bounds compressed/expanded archives to 200 MiB and content JSON to 10,000,000 bytes;
BackupCodec bounds principal collections to 10,000 records and history to 100,000.
Validate entry paths/uniqueness, references, hashes, dimensions, decodability and
structured-target/shared-link consistency before installing files and atomic content
commit. Restore remaps family/segment/occurrence/list/media references consistently,
restores exclusions before replenishment and never imports operational sessions.

The UI holds a prepared native import handle rather than archive/image bytes. An
uncertain import retains handle, copy choices and operation ID until definitive
acknowledgement/rejection. Native receipts survive process loss; the UI's process
memory is not a promise to recover every screen draft after process death. A
confirmed content import with registration warnings is not an unknown import.

Export holds a snapshot/media lease through streaming. Share files are private CE
cache and can later be reclaimed by Android. Export/Diagnostics launch only from
the owning foreground page; returning from a share sheet permits captured feedback,
while route departure invalidates late launch/feedback. Retry retains the prepared
file/report where supported. A share handoff cannot prove receipt or external saving.

## Presentation and build boundaries

The shared appearance resolver is independent of brightness. Foreground automatic
changes coalesce while editing/transient decisions or uncertain work own a hold,
preserving composition/focus/caret/scroll. Each new native session captures a resolved
pair and keeps it across arrivals, refresh, rotation, unlock and clock boundaries.
Bundled assets/mirrors work before unlock; missing artwork cannot block audio,
foreground promotion or actions. Exact roles/crops/geometry live in current source,
with intent in [visual direction](visual-direction.md).

Native language reconciliation and read-only clock observers feed one confirmed
formatting context. Clock preferences remain independent of interface language.
Observer teardown cannot cancel engine work. Offline catalog generation and Chinese
terminology are owned by the [localization contract](../localization/README.md).

One form owner handles system/IME insets and measured footer clearance. Native
geometry observation exposes only opaque field identities/bounds, not engine state
or text. Stable form parents preserve IME ownership; parent scroll does not force
focus back. App confirmations use one process-only host with captured owner/request
identity and focus return; cancellation/blur invalidates callbacks without mutation.
Preferences, Postpone, save/restore and bulk controllers retain exact pending commands.
None is a second durable authority. Route/search/selection guards precede navigation.

The opt-in UI fixture preview is web-only, memory-only and uses a Metro replacement
restricted to platform=web. Android always resolves the real bridge. Fixture controls
cannot authorize Google, access durable data, schedule alarms or prove native behavior.

The owned native app/module compile against the app's selected Compose runtime API.
Release tooling compares resolved compile/runtime graphs before tests/lint/assembly;
module-only tests do not establish packaged binary compatibility. Pinned Robolectric
SDK/resource jars are resolved through Gradle before tests; download failure is not
a skipped/pass result. Exact tool versions live in package/build source and README.

Two scoped compatibility exceptions remain consequential: K1 lint only for affected
third-party Worklets/Reanimated Kotlin-script parsing, with owned lint still enforced;
and a checksum-guarded packaging-only ESM-to-CommonJS decoder conversion for Router's
patched URI decoder. Remove these after a verified compatible upstream upgrade;
never broadly disable lint/tests or force incompatible Expo/native downgrades.
