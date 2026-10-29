# Postpone notification routing and locked presentation — 28 October 2026

The owner reported that tapping Postpone on the full-screen alarm closes it or
returns to the lock screen instead of showing the selector. The owner also
requested notification Postpone to open Home with that selector and confirmed
ordinary notifications should show Mark as done/Postpone. Routine controls retain
their separately confirmed Start routine/Snooze/Dismiss behavior.

## Observed evidence and limits

A read-only installed/local APK comparison matched SHA-256
`4837ac0afdbd379d98ac01b5ef7126307e94e3dbbd9191bf6f6f4ee4ed2d0340`.
The matching APK contains the native PostponeChooser class and integrated Room10
identity. This establishes that the report cannot simply be dismissed as the
earlier compatible Routines restoration without a chooser. It does not attribute
the exact source revision or prove that the chooser was displayed.

The phone disconnected before the first fresh log attempt. After the owner
reconnected it, scoped repository log collection succeeded with zero Remilo-tagged
entries, including immediately after another owner reproduction. The owner then
reported **Alarm interrupted. Still unfinished**. The existing tag filter excludes
AndroidRuntime, so an opt-in bounded crash-buffer reader was added. It filters
exact `com.remilo.app` process/PID blocks in memory before persistence, excluding
other apps and withholding raw output on read failure. It found four crashes,
including the latest reproduced attempt: **NoSuchMethodError** for
`ModalBottomSheet-dYc4hso` from `PostponeChooser.kt:112`, called by AlarmActivity.
This establishes a packaged Compose API/ABI mismatch on opening the chooser.
The process crash stops playback; interrupted recovery leaves work unfinished.
Historical recovery logs are separate storage-incident evidence.
A read-only DEX check of that exact failing APK found 79 unique direct static
Compose targets across 32 chooser classes. Only the invoked
`ModalBottomSheet-dYc4hso` signature lacked a packaged definition; the owner class
instead declared `ModalBottomSheet-YbuCTN8`. SDK dexdump independently confirmed
the invocation and absent definition. This is binary evidence of the failure,
not a conclusion inferred solely from dependency declarations.
No installation, unlock, navigation, reminder mutation or alarm test was performed
by this investigation.

Source review found that native Postpone only captures a draft; it does not issue
an engine command, navigate Home or finish the Activity. The previous Material3
ModalBottomSheet creates a separate dialog window, while AlarmActivity carries
show-when-locked eligibility. That extra window motivated in-window presentation
hardening; its visibility was not established as the cause. The crash trace
identifies the missing library method instead. Normal private Home navigation
legitimately waits for keyguard unlock and must remain private.

## Change and regression boundaries

Expo SDK 57's @expo/ui requires Material3 1.5.0-alpha17 and its published graph
selects Compose 1.11.0-beta02. Remilo's former local BOM compiled native code
against Material3 1.3.2. The native module and UI tests now use the same selected
Material3/Compose API as the app. The release helper compares actual resolved
native releaseCompileClasspath and app releaseRuntimeClasspath components across
Material3/UI/foundation/runtime, including Android variants, before starting
tests/lint/assembly. Drift or a malformed/incomplete report fails the build.
Controlled regressions include the observed 1.3.2/1.5.0-alpha17 mismatch and prove
that assembly is not started on failure. No Expo dependency is forced back to the
older library, and no test/lint failure is bypassed.

The native chooser shares AlarmActivity's window through an in-window sheet.
Underlying controls are disabled/hidden from accessibility while it is open.
Custom picker windows explicitly inherit secure/show-when-locked policy without
unlocking or waking the device again. Existing draft, picker, timeout and exact
pending-command ownership remain independent of presentation.

Ordinary single/group notifications replace visible quick Snooze with captured
Postpone/Postpone all. Unresolved notifications expose Postpone without changing
completion eligibility. Immutable explicit Activity PendingIntents carry only
operational IDs/generations/session membership to Home. Content taps, Routine
controls, channels and legacy Snooze intents retain their existing roles.

The app shares a process-owned chooser/controller between Home and Details.
Agenda Postpone and ordinary active-group Postpone all open the Home selector.
Cold/warm/repeated native arrivals retain distinct presentation identity; another
request waits for the current draft or unknown submitted command. Loading a link
does not apply an action. Exact operation, target and captured membership survive
route replacement, and stale requests require a fresh deliberate action.

Four new English/Simplified Chinese messages cover invalid request, loading
failure, queued request and Home return. All existing translations are preserved;
the generated catalog contains 2,341 pairs. CE17/DP10/backup9 remain unchanged.

## Automated and host observations — 29 October 2026

`npm run verify` passed TypeScript, ESLint, localization/design preservation,
**377 shared tests across 44 files** and **119 tooling tests**. The catalog has
2,341 complete English/Simplified Chinese pairs. Controlled tooling cases verify
exact-package crash extraction and failure before assembly on Compose graph drift.

The focused native run passed, followed by **656 native tests across 57 suites**
with zero failures/errors/skips in the full run. Native host tests compose the real
chooser, verify a visible preset/confirmation and scroll-reachable Custom, confirm
no additional Dialog, fence/restore keyboard focus, and exercise Back/collapse and
picker flags. The real native action opens only a captured draft with no initialized
engine, pending command, started Activity or finish. Notification/engine tests
retain Routine/legacy Snooze, captured identity, privacy and no-mutation coverage.
These are host observations, not Android phone visual or audio acceptance.

The new fixtures initially exposed two test issues: preference was asserted from
the old registrar snapshot instead of the protected delivery row, and a manually
hosted Activity lacked keyboard mode/window focus events. Both fixtures were
corrected while retaining their behavioral assertions; no test was skipped or
relaxed. Widget rendering passed without widget/dispatcher changes.

`npm run verify:android` completed successfully, including the resolved Compose
gate, full native suite, module/app lint and signed ARM64 release assembly. Release
lint reports zero errors and 20 warnings. No lint baseline/rule was weakened.
The APK is **com.remilo.app 0.4.0 (4), ARM64, signed**, SHA-256
`3805f4d4b483c9a8e32d84cc7784e9f84d6beae7091a6d4b3593c3655b27499e`.

Release source maps exactly match Home, native-intent, Details, both request/
controller modules, host/chooser, Routines and the generated catalog. The APK
contains the new native host/notification routing and unchanged integrated Room10
identity. Read-only DEX inspection of all five DEX files finds **94 unique direct
static Compose targets across 45 chooser/host classes**, all with packaged static
definitions. It requires the new BottomSheetScaffold call and AlarmModalHost scope
and rejects any scoped ModalBottomSheet call. This verifies the specific binary
linkage boundary that failed in the old APK; indirect calls, reflection, resources,
device class-loader state and physical behavior remain outside this check.

## Physical acceptance

The new candidate has not been installed by this work. Actual locked-sheet and
picker visibility, notification unlock-to-Home handoff, modal/focus appearance,
TalkBack, continued sound and the original five-minute cutoff require an identified
signed-phone run. Host tests cannot establish these outcomes. The consolidated
checklist records the scenarios; beta acceptance and distribution are not declared.
Private logs, captures, device identities and build artifacts remain ignored.
