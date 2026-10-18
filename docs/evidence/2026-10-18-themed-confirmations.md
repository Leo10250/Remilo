# Themed app-owned confirmations — 18 October 2026

The owner approved the reviewed centered Discard design and requested consistency
with similar existing popups. The shared confirmation hook now renders one
app-owned Modal using canonical foundation roles, 24 dp corners/padding, the
shared heading/body/Chinese typography and production Buttons. Destructive and
outlined actions retain the existing sheet geometry, semantic colors, focus and
pressed treatment. Long content scrolls within the inset-safe window. Existing
Trash/permanent-delete reviews, menus and forms keep their themed sheets.

All 27 production confirmation calls across 16 screens/components use this path:
reminder/routine/day/exercise Discard and reload, list removal, Calendar decisions,
and unconfirmed Save/import/restore/test/bulk-action notices. No app source still
calls `Alert.alert`. The store is process-only: it captures localized descriptors,
original callbacks and presentation/owner identities, never native mutation state.
Cancellation and acknowledgement return connected focus. Explicit confirmation
clears its request before running the callback; duplicate/older choices cannot
replay it. Repeated Back cannot replace a captured decision. Route blur/unmount
invalidates the request and fences late presentation. Pending-command guards,
receipt/retry identities, scheduling, databases and backup formats stay unchanged.

Android permissions/Settings, authorization, photo/document pickers, sharing,
launcher and keyboard/notification surfaces remain platform-owned. Native date/time
interactions and brief status Toasts retain their current behavior. This increment
does not claim full runtime theming of the native date/time library.

## Render and behavioral observations

The opt-in fixture renders the actual host, hook, sheet and Button components.
36 browser checks covered 32 Discard combinations (all eight appearance pairs,
English/Chinese and 100%/200% text), plus informational acknowledgement, list
removal, a long authored list name and a confirmation over an existing sheet.
There were no script errors. All 32 cancellation checks retained the input and
returned keyboard focus to the initiating button. Measured cancellation targets
remained at least 56 dp high and within the 360 dp preview width. Inspected renders
included dark Evening, large Chinese, long text and the retained parent sheet.
These are isolated React Native Web observations, not Android phone observations.

The confirmation regression tests cover exact-once callbacks, safe cancellation,
explicit noncancelable notices, open-copy translation with authored names intact,
duplicate Back, route blur/unmount, reentrant/throwing callbacks, stale action and
focus frames, caller-array mutation and subscriptions. The focused confirmation
and design-isolation suites passed all 33 checks. Existing design fixture loaders
were updated for the new dependencies without removing their assertions. The
initial restricted full run could not create the controlled Git fixture's MSYS
objects; the final repository workflow ran with the needed local permissions.

## Final repository checks and artifact

`npm run release:prepare -- --json` passed at
`2026-10-18T08:59:31.345Z` (01:59 PDT on 18 October). Catalog verification retained
2,150 English/Chinese messages. Design/preserved-reference checks, TypeScript,
ESLint, all 316 shared tests in 39 files, all 104 tooling tests, all 575 native
tests in 42 suites, module/app lint and signed release assembly passed. Native
test reports contain zero failures, errors or skips. ESLint retains the frozen
R8 gallery's existing unused-variable warning. Module/app lint reports zero errors
and 29/20 warnings, unchanged from the preceding widget build.

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), `arm64-v8a`, min/target SDK 34/36, bundled
JavaScript, nondebuggable, 95,764,967 bytes.

- APK SHA-256: `ddeb0e844e06168dee696895fc605e9a758525a122e275a8cc2a5f28812d5077`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Workflow summary: `verification/local/release-summary.json`.
- Retained task summary: `verification/local/themed-confirmations-summary.json`.
- Workflow log: `verification/local/themed-confirmations-release.log`.
- Private browser observations: `verification/local/confirmation-renders/summary.json`.

No installation or distribution accompanied these checks. Native Modal stacking,
TalkBack, keyboard/IME, landscape/scaled-font and system-UI observations remain on
the [consolidated phone checklist](../device-acceptance.md#themed-confirmation-follow-up--18-october-2026).
