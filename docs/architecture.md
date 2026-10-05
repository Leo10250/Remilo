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

Add recurrence projections and two future registrations per series only in phase 3.
Calendar compatibility uses observed mismatches, not speculative DST repair.
Supabase is isolated to optional phase 5; auth/sync foreground/manual initially.
No iOS implementation or database placeholders exist before phase 6.
