# Android home-screen widget evidence — 15 October 2026

Scope: owner-approved RW-03 on `event-routines`, based on `fb7571a`. The
[product contract](../product.md), [widget design and research](../design/current/home-screen-widget.md)
and [native architecture](../architecture.md) describe the implementation. Task
status belongs in [backlog](../backlog.md).

## Host verification

- `npm run verify`: localization/design checks, TypeScript, ESLint, 35 shared
  test files / 292 tests and 97 tooling tests passed. The existing unused
  `expectedScreenIds` warning in the frozen R8 gallery remains; no lint errors.
  The generated catalog contains 1,990 messages.
- `npm run verify:android`: 494 native tests passed, including 27 routine-engine
  tests and five widget render/lifecycle tests. Native Debug lint, app Release
  lint and Release assembly passed.
- Local assembly: `com.remilo.app` 0.4.0 (4), `arm64-v8a`, signed with the existing
  configured identity. The APK is the ignored local
  `android/app/build/outputs/apk/release/app-release.apk`.
- CE14, DP8 and portable backup format 5 are unchanged. Widget instance IDs,
  configuration and action descriptors are excluded from portable backup.

Gradle used the existing local cache. Logs retain the existing Android SDK XML
and Gradle deprecation warnings. Raw logs and captures remain in ignored local
and module build directories. No signing material or private device diagnostics
were added to the repository.

## Behavioral coverage

Routine Focus and Today share the existing native dated-session query and
serialized exercise commands. Tests cover independent widget configurations,
duplicate callbacks, stale revisions across widgets and app actions, explicit
Undo after the final exercise, process restart and receipt recovery after an
uncertain commit. An uncommitted Retry retains its operation identity until the
original day ends. Stale Monday controls cannot complete Tuesday's exercises.

The existing exact 21-exercise fixture covers Sunday Rest, Skip/Undo and paused
routine eligibility. Tests also cover draft preview/cancellation, successful
pin binding, configuration restoration without action descriptors (including
unchanged numeric widget IDs), removal,
locked/unsupported hosts, local midnight/DST refresh boundaries and ordinary
Today/overdue selection before limiting a mixed collection above 50 records.
The ordinary-reminder regression suite remains intact.

A running Glance composition is tested directly: a new native projection
updates its RemoteViews without restarting the session, and a late older
projection cannot replace the newer frame. The in-process projection stream is
discardable presentation state; progress and action validation remain native.

## Actual component review

Robolectric native graphics rendered the production Glance composition in all
eight atmosphere/brightness pairs, in English and Simplified Chinese. Captures
also cover 180×110 and 300×280 dp summaries at 200% text, interactive Focus,
Undo at 150% text and Rest/locked/unavailable/error states. Compact routine
summaries retain the selected routine's visible identity and numerical progress.
Controls use the existing roles, neutral glyphs, connected geometry and opaque
reading surfaces. A read-only safety and UX review informed the compact-title
correction.

The setup preview and host captures use the production row components with a
static subset of reminder rows. Runtime widgets use Glance's scrollable
collection. These captures do not verify a launcher's collection adapter,
resizing, pin confirmation or native configuration activity interaction.

## Remaining physical acceptance

No installation, distribution or phone acceptance was performed. The consolidated
signed-phone run must still exercise native setup/cancellation/reconfiguration,
launcher pinning/removal/restore, real scrolling and size negotiation, TalkBack,
large text and keyboard behavior, denied notifications, reboot/first unlock,
offline use without React Native, clock/travel changes and deferred refresh.
Record task success, errors, assistance and misunderstandings before declaring
the beta verified. Host results do not establish OEM background reliability or
exact-midnight display updates.

The widget research and its limitations are recorded in the design contract.
No causal adherence benefit is claimed. The broader daily digest remains RW-04.
