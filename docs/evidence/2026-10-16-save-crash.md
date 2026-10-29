# Reminder Save native crash

The owner reported the app closing after Save while creating a reminder/event.
The inspected checkout started at `8544c93`; that revision is not an attribution
of the installed APK. Task status belongs in [the backlog](../backlog.md).

## Observed evidence and diagnosis

Read-only device discovery found one authorized Pixel 9 Pro XL on API 37.
The repository's normal Remilo-tagged snapshot was empty. A bounded read of
Android's existing crash buffer retained only records identifying `com.remilo.app`,
under ignored `verification/local/logs`; no logs were cleared and no app data,
device settings, navigation or installation was changed.

Seven retained crashes dated 13–16 October have the same native exception:
`IllegalStateException: addViewAt: failed to insert view`, caused by
`The specified child already has a parent`. The stack enters Fabric's
`SurfaceMountingManager.addViewAt` and `ReactClippingViewManager.addView`.
These records do not identify which reminder was being saved or whether its
native command committed.

Source inspection identifies a matching transition: Save sets `preparing`, which
freezes the editor's layout-only wrapper by changing `pointerEvents` from `auto`
to `none`, `importantForAccessibility` to `no-hide-descendants`, and
`accessibilityElementsHidden` to true. React Native 0.86.3's installed
`ViewShadowNode.cpp` makes those non-default props form a native stacking context;
the idle layout-only wrapper can be flattened. That transition reparents existing
native controls. The Repeat sheet has the same busy-state transition.

This is the source-supported cause addressed by the repair, inferred from the
crash signature and code rather than a newly performed phone reproduction.
React Native's version-matched [View documentation](https://reactnative.dev/docs/0.86/view#collapsable)
defines `collapsable={false}` as retaining the View in the native hierarchy.
The [0.86.3 implementation](https://github.com/react/react-native/blob/v0.86.3/packages/react-native/ReactCommon/react/renderer/components/view/ViewShadowNode.cpp)
also confirms that this prop keeps the stacking context present in both states.

## Focused change

The editor form and Repeat sheet now set `collapsable={false}` on their guarded
parent Views. Save, timing conversion, Repeat Apply, review and uncertain-retry
transitions retain that native parent. The existing touch/accessibility guards,
captured operation IDs, scheduling, durable content and navigation are preserved.

## Verification

`npm run verify` passed: 2,118 English/Chinese message pairs, the current-design
and preserved-reference audit, TypeScript, ESLint, 311 shared tests in 38 files,
and 97 controlled tooling tests. ESLint retains the existing frozen R8 gallery's
unused-variable warning. The original approved scenery master-resolution
limitation remains recorded by the design audit.

The first sandbox run passed the shared checks but four tooling fixtures could
not start Git's local clone subprocess (`NtCreateDirectoryObject` access denied).
The unchanged suite passed outside that sandbox; no tests were weakened.
The final verification log remains under ignored `verification/local`.

`npm run verify:android` passed native verification, owned-module/app lint and
signed bundled ARM64 assembly/inspection. The native unit-test task was
`UP-TO-DATE`; its 41 existing reports contain 525 passing tests with zero
failures, errors or skips. This UI-only repair does not add native unit-test
coverage. Gradle completed successfully in 2m 11s (31 executed tasks and 1,001
up-to-date). The post-documentation design audit and `git diff --check` also passed.

The assembled local APK is `com.remilo.app` 0.4.0 (4), signed with the existing
identity, with SHA-256
`6d51874ad532e5c506e6b3325c10c90c3c9c72e88d38e6fa4f9127faf78b4770`.
No runtime sources changed after assembly. The APK was not installed or
distributed, and the previously installed build's source was not attributed.

Host checks cannot reproduce or certify Android Fabric mounting, IME or TalkBack
behavior. No new source-shape assertion is presented as a native crash regression
test; the actual renderer scenario remains in the signed-phone follow-up below.

## Signed-phone follow-up

On an identified updated signed build, create one-off and repeating reminders in
Alarm, Notification and No alert modes. Save with Title/Notes focused and with
the keyboard closed; confirm one saved item, the actual scheduling feedback and
the expected return destination. Apply a repeat preset and Custom repeat, change
timing, save edits and exercise a definitive rejection/unknown-reply retry without
losing the draft. Include a routine Save because it shares the same parent.
Check restored touch/TalkBack access after a recoverable failure and collect any
new matching native crash record. These observations have not been performed
for this repair; host checks do not establish the crash is resolved on the phone.
