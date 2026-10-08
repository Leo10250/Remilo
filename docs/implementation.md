# Delivery contracts

This is the approved Android-first implementation sequence. Task state belongs
only in backlog.md. Product semantics belong in product.md; that contract and
current human instructions govern every phase. iOS feasibility is last.

## Phase 0: foundation

Pin Node/JDK/dependency versions; commit the once-generated Android project and
Gradle wrapper. Use a local Android Expo module, asynchronous engine calls and
development builds. Configure API 34 minimum, API 36 target, no OTA, local private
signing, CI and reproducible verification commands. Keep tooling/keys ignored.

The AI-first repository has one product contract, one backlog, concise ownership
decisions and explicit verification procedures. An agent selects a bounded task,
reads its dependencies, changes the relevant contract, runs appropriate checks and
records actual evidence. A signed bundled APK installed offline on a Pixel passes G0.

## Phase 1: native alarm proof

1. Room content/operational storage, recoverable scheduling intents, native command
   receipts and native action history. Current generations fence obsolete callbacks.
2. Independent AlarmManager registrations, native receiver, systemExempted FGS,
   monotonic five-minute audio session, silent notification channel, native
   Stop/quick Snooze and generic pre-unlock controls.
3. Lifecycle reconciliation, safe application/provider startup, process-death
   silence, crash/retry tests and physical evidence.

Use a minimal creation/readiness/test screen for the native proof. The owner's
4 October instruction now authorizes wider offline implementation while physical
acceptance remains pending, followed by one consolidated owner-operated test run.
Critical paths have no React/Expo ownership, no network and no JavaScript timers.
Each operation is serialized; Room and OS alarm registration are not atomic.
Saved/registered, blocked, pending and stale failures remain distinguishable.

G1 requires a signed Pixel build: ordinary cold process, other foreground app,
locked/offline delivery, reboot before unlock, native actions, idle cutoff,
independent future registrations, stale callbacks and interrupted writes. A failed
scenario blocks a verified beta release. Deferred phone testing leaves this gate
pending; under the owner's updated instruction it does not block implementation.

## Phase 2: complete one-off private beta

Deliver quick creation and advanced independent event/due/alarm timing; Alarm,
Notification and No alert modes; unified agenda/details/inline permissions; Done
separate from Stop; Snooze and Postpone before/after timeout. Postpone replaces
Snooze without changing due/event timing. Offer 15/30/60 minutes, editable Tomorrow
10 AM/2 PM/5 PM and custom dates; show the resolved future instant before applying.

Support independent session members, Stop All, one sound and the first member's
deadline. Add editable presets, sound preview, vibration, Test Alarm and redacted
local diagnostics. Add versioned export/restore and non-destructive upgrade tests
before regular beta use. Restore applies the whole selected backup, includes all
new reminders/lists automatically, previews identity conflicts and preserves existing records
by default and makes copies only by explicit selection. Exclude credentials,
device identity, OS handles and active sessions; future registrations are rebuilt,
elapsed ones stay silent. Explicit platform backup/transfer exclusions protect
operational state.

G2 includes all one-off actions, collisions, restore and upgrade safety on the
signed build. Host-only results cannot close it.

## Phase 3: recurrence and polished Android

Implement a pure Kotlin java.time kernel using shared JSON fixtures and fake
clocks. Rules include daily/weekly/interval, monthly dates/ordinal weekdays/last
weekday, annual, date/count endings and at least three-date previews. Floating
rules follow the device zone; pinned rules keep their zone. Gap/fold/invalid-date
behavior is explicit in product.md. Invalid dates do not consume count.

Occurrence identity uses the segment and original nominal slot, never its postponed
trigger. Preserve unresolved/postponed old occurrences during pause/resume and
series edits. Add skip, instance reschedule, this-and-following and whole-series
edits. Maintain two independent future registrations per active series plus
postponed exceptions; replenish before presentation using minimal protected rule
data. Resource/registration failures remain visible.

Add search, lists, history, duplicate, delete/undo, Reopen, original visual tokens,
themes, accessibility and large-text layouts. No KMP during Android delivery.
G3 covers fixtures and physical travel/DST/exception collisions plus API 34–37
behavior. Pixel evidence alone cannot support broad manufacturer claims.

The approved 0.4.0 presentation milestone belongs to Phase 3 and precedes Calendar.
It delivers unified agenda queries and reusable presentation, one-off/repeat editors
and details, automatic settings with inline permissions, native session dismissal,
standard notification controls and its historically recorded identity. No timing,
completion, protection or account semantics change. Relevant host tests and signed
assembly precede the consolidated device/UI/accessibility acceptance run.

## Current time-of-day presentation release

After the shipped 0.4.0 baseline, [TD-01–TD-06](plans/redesign/README.md) implement
[the approved current design](design/current/README.md): shared R3 roles/scenes,
Automatic plus four manual atmospheres, all app-owned pages/native alarms and
one static Classic ring/check/sun identity. Preserve independent brightness,
keyboard-safe forms, native privacy/action ownership and whole-backup behavior.
Current documentation approval does not implement a runtime preference/migration.
Old P01/P02 prototypes remain historical; no eight-palette/classifier/manual-task
chooser/backup-v4/dynamic-icon requirement precedes this release.

## Phase 4: optional Google Calendar

- 4A: optional native authorization and owned calendar selection, one-off publishing,
  stable retry identity, automatic-publishing opt-in, separate backfill preview and
  consent, disabled Calendar reminders for app-created events.
- 4B: selected import, manual/foreground linked pulls, etags, visible conflicts and
  deletion handling. Imported notification changes require separate consent.
- 4C: pinned-zone preview, standard recurrence, exceptions and series splitting;
  compare Google instances against timing fixtures. Add DST/COUNT compatibility
  exceptions only after demonstrated mismatches.
- 4D: durable outbound retries, calendar-wide incremental streams with an app-side
  managed/imported allowlist, pagination, throttling, reconnect, 410 reset and native
  WorkManager opportunities. Sync-token streams cannot use the metadata filter as
  the server-side allowlist.

Keep account/calendar identity, parent/instance IDs and original Google instance
start separate from local occurrence identity. Completion, due overrides, alert
preferences and postponement stay local. G4 proves both directions after documented
sync opportunities, untouched unrelated events, no duplicate retries and offline
alarm independence.

## Phase 5: optional Android cloud

No backend infrastructure before this phase. Isolate Supabase Auth/PostgreSQL
behind its adapter. Foreground/manual React Native auth/sync exchanges changes
persisted natively while JavaScript was absent. Local saved alarms require no token.

Provide optional accounts, migration preview, idempotent push/pull, revisions,
cursors/tombstones, visible concurrent edits, device registration and primary
ringing selection. Include export, logout, unlink, deletion and recovery. Normal
handoff waits for the old primary's cancellation acknowledgement. Explicit offline
override discloses duplicate ringing. Calendar writer ownership and credentials
remain separate from ringing-primary selection. G5 requires two Android devices
to converge after stated sync opportunities and verified handoff behavior.

## Phase 6: optional iOS, last

First prove AlarmKit authorization, locked actions, persistence, scheduling capacity,
sound and extension/countdown behavior on a real iPhone. Only then add shared screens,
Swift/App Intents, required extension, GRDB SQLite, timing conformance, Calendar and
optional cloud. Use relative weekly scheduling only when full semantics match;
otherwise fixed occurrences with measured visible coverage. Do not invent a 32-alarm
limit. System-controlled duration is the approved fallback if five-minute cutoff
cannot be controlled; presentation/grouping differences remain visible. Android
release does not depend on any iOS gate.

## Release discipline

Run the relevant shared/native checks, build with the same signing identity, run
physical scenarios against that commit, record outcomes/limitations, then distribute
only after the milestone passes and distribution is authorized. Never restore past
alerts or active sessions on upgrade/reopen. Estimate the next milestone using
evidence from the preceding one; no completion date is assumed.
