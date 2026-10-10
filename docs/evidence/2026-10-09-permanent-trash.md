# Permanent Trash deletion

9 October 2026 (Pacific) · branch `trash-permanent-delete`.

The owner authorized individual and selected permanent deletion after reporting
the missing Trash option. This supersedes the earlier no-purge contract. The Alert
selector fix was already committed separately and is preserved unchanged.

## Behavior and storage

Trash row menus and deleted-reminder details offer Delete permanently. Selection
mode offers it for captured loaded occurrences. A shared confirmation identifies
the item or count, explains content/activity removal and no Undo/Restore, and
retains Cancel/Back dismissal. Repeating plans and other occurrences remain.

Native Purge requires the captured deleted revision. A single CE transaction
removes reminder content, activity and pending content schedules, and records a
content-free identity exclusion plus an exact operation/identity/revision receipt.
CE migrates 5→6 without discarding existing records. DP stays 6; its terminal
generation guards remain. Recovery/materialization and private completion/history
replay skip purged identities. Unknown replies retain the same command or batch;
details keep Retry visible even after the queried record disappears.

Backup format 4 carries only minimal recurring exclusions. Versions 1–3 remain
readable. Default older-backup restore preserves local purged identities; an
explicit copy creates a separate identity. Family copies remap exclusions before
replenishment. Existing exported files remain unchanged. This is logical app
record deletion, without a claim of secure SQLite or external-file erasure.

## Actual host results

| Check | Result |
|---|---|
| Design implementation/preserved evidence audit | Passed |
| TypeScript | Passed |
| ESLint | Zero errors; one existing unused-variable warning in the R8 gallery |
| Shared tests | 51 files, 368 tests passed |
| Controlled tooling tests | 77 passed |
| Native tests | 19 suites, 183 tests; zero failures/errors/skips |
| Owned native lint and app release lint | Passed |
| Final signed bundled ARM64 release assembly and APK inspection | Passed |

The checks used the repository Node/runtime and workflow scripts:
`scripts/verify.mjs` and `scripts/android.mjs verify`. The native verification was
rerun after the final restore-retry correction, details Retry rendering correction
and confirmation closing-title polish.
The latter is a text-only adjustment checked with targeted ESLint after the full
shared run. Native XML was read from
`modules/remilo-alarm/android/build/test-results/testDebugUnitTest`.

The new regressions exercise eligibility/stale restore, exact receipt binding,
unrelated content preservation, transactional rollback, committed lost-reply
retries/restart, late callbacks/history, recurring recovery, restored Direct Boot
exclusions, committed import retry before DP projection, legacy restore/default
conflict handling, explicit copies and family
remapping. Backup decoding rejects malformed, overlapping and duplicate exclusion
identities; the CE migration retains Trash/history/preferences/lists.

An initial native run failed four new test-fixture assumptions (the CreateSeries
reply shape and CompletableFuture exception wrapping); those fixtures were
corrected and the final native run passed. An ESLint check caught render-time
ref access in the Retry title; that access was removed without weakening checks.

## Artifact and remaining observations

The isolated memory-only preview eventually loaded after initial navigation and
bundling timeouts. At 412×915 CSS px it showed the item menu and named confirmation.
Cancel preserved the item. Selecting two of three loaded reminders showed the
captured count; confirmation removed those two and reported `2 of 2 permanently
deleted`, while the unrelated skipped item remained. A simulated committed
lost reply on deleted-reminder Details removed the item while retaining Retry;
retry confirmed the same command and returned to Trash with the other two items.
The closing confirmation now uses the generic title instead of a transient
zero-item count. The local confirmation capture is private in
`verification/local/trash-confirmation.jpg`. These synthetic observations do not
exercise native durability, accessibility services or Android modal behavior.

Application sources were held constant during the final assembly. It built the
uncommitted application changes in this branch, based on `a4e07e5`; that base's
file tree matches the already-merged `origin/main` revision `08d07bee`. Documentation
and Git metadata updates after assembly do not change the application's contents.

- Package/version: `com.remilo.app`, `0.4.0` (4), release, ARM64, signed.
- APK: `android/app/build/outputs/apk/release/app-release.apk`.
- SHA-256: `d350531f9e63ba08e2b3f94f7c63b64978a50d26e787cc18138bbb469510b52b`.

No installation, phone-data deletion, APK distribution or physical observation
was performed. Android confirmation/Back/accessibility/large-font layout,
return navigation, installed upgrade, recurring recovery and transfer acceptance
remain pending in the consolidated run defined by `docs/verification.md`. Host
results do not establish those observations or alarm reliability.

## Owner's button correction

The owner rejected the original Delete permanently action because its container
was indistinguishable from the sheet. The shared `dangerSurface` alias pointed to
`surface`, with error-colored text. The corrected shared destructive button uses
`error` / `onError`, a full round shape, a leading icon and 8 dp label gap. Cancel
is a lower-emphasis neutral outlined button. Both retain the 56 dp minimum and
grow with text. Pressing changes the corners to 16 dp and uses a contrasting
state fill; keyboard focus adds a contrasting border. These scoped styles follow
[Material 3 Expressive button guidance](https://github.com/material-components/material-components-android/blob/master/docs/components/CommonButton.md)
and [Material's paired color roles](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md).
Native alarm error messages now explicitly use `error` on `surface`, preserving
their prior colors when the destructive-button aliases change.

The isolated preview measured a 380×56 CSS px destructive button at a 412×915
viewport in Evening Light, with a white label/icon on the red fill. Keyboard
focus was visible, and Cancel retained the reminder. Evening Dark at 200% text
used a 32 px label and grew the button to 72 px, without horizontal label overflow;
both actions remained visible. Private captures are
`verification/local/trash-button-light.jpg` and `trash-button-dark-large.jpg`.
These are web fixture observations, not Android or TalkBack acceptance.

Label/icon contrast is 7.19:1 in Light and 7.72:1 in Dark; pressed-state contrast
is 6.00:1 and 6.45:1. The existing contrast regressions now cover these shared
destructive pairs in all eight appearances.

Design audit, TypeScript, ESLint (zero errors and the existing R8-gallery warning)
and all 368 shared tests passed in `scripts/verify.mjs`. Its tooling stage initially
failed because the synthetic generator fixture omitted the new `onError` and
`errorPressed` roles. Adding those fixture roles retained the drift-rejection
assertion; the targeted `scripts/tooling-tests.mjs` rerun passed all 77 tests.
The subsequent `scripts/android.mjs verify` passed all 19 native suites / 183 tests,
with zero failures/errors/skips, native/app lint, and signed bundled ARM64 assembly
and APK inspection.

Application sources were held constant during that build: the uncommitted button
correction atop `bd2f2e7`. Later evidence, backlog and Git metadata updates do not
change the application's contents. The latest local release APK retains package
`com.remilo.app`, version `0.4.0` (4), and has SHA-256
`4d201963daac025f58fd3f777eead9e07d445fb59b6bc68957ecd2509d7ec3e3`.
It replaces the earlier local artifact recorded above. No installation or APK
distribution was performed; the consolidated physical observations remain pending.

## Owner's confirmation, timing and feedback correction

The inspected source used `useAppearanceConfirmation` / React Native `Alert`
for unfinished Move to Trash, which renders the Android dialog outside Remilo's
React theme. Agenda and Details now share `TrashConfirmation`, composed from the
existing themed Sheet and Expressive filled/outlined buttons. Opening captures
the displayed occurrence/revision; confirmation submits that captured revision.
Completed/skipped moves retain their existing direct action. Cancel, close and
Back do not submit a mutation. Repeating confirmations explain occurrence scope.

The editor used DateField's default date-then-time mode. Separate Date and Time
rows now pass `dateOnly` and `timeOnly` respectively; all-day hides Time. The
existing selected-zone civil merge and native conversion keep the other component
and linked duration/Due/Alert semantics. The installed 9.1.0 picker's
[official API](https://github.com/react-native-datetimepicker/datetimepicker/blob/v9.1.0/README.md)
supports independently opened date/time dialogs. Actual Android picker interaction
is still pending.

Both Trash success messages in the current UI were app-owned: `notifyTrash`
created the snackbar, while command recovery retained green inline success.
The inspected ordinary Trash path has no Android Toast call. Confirmed Delete
now suppresses redundant inline success in Agenda/Completed/Details; guarded and
error feedback remains. The snackbar uses shared inverse roles and scaled action
text, following [Material Snackbar guidance](https://github.com/material-components/material-components-android/blob/master/docs/components/Snackbar.md).
Notice identity resets its deadline. Failed accessibility queries fall back to
five seconds (ordinary) or ten seconds (Undo), while longer Android accessibility
timeouts and screen-reader explicit dismissal remain. Cancelled touch gestures
also release the interaction pause.

At 412×915, isolated Evening Dark preview confirmed the named Trash sheet and
380×56 filled Move to Trash button. Cancel kept the reminder. Agenda, Details
return and Completed each showed exactly one success message; Undo restored the
reminder and completed work state. Evening Light at 200% text grew the action to
380×72 without horizontal overflow. A simulated committed-but-lost reply kept
Retry and disabled destinations; retry cleared recovery and showed one success
snackbar. Evening Light creation showed separate Date/Time; toggling All day
left Date only. Evening Dark at 200% text measured both rows at 112 px high with
no horizontal overflow.

Private fixture captures:

- `verification/local/trash-confirmation-dark.jpg`
- `verification/local/trash-confirmation-light-large.jpg`
- `verification/local/trash-single-snackbar-dark.jpg`
- `verification/local/trash-retry-snackbar-light-large.jpg`
- `verification/local/editor-date-time-light.jpg`
- `verification/local/editor-date-time-dark-large.jpg`

React Native Web 0.21's accessibility implementation always resolves screen-reader
enabled, so that preview exercised explicit message dismissal rather than normal
expiry. Six new timer tests passed ordinary/Undo deadlines, extended accessibility
timeouts, query failures, reader retention, stale async cancellation and invalid
durations. Existing civil-merge, DST/linked draft and captured-operation tests
also pass. The successful `scripts/verify.mjs --json` run passed design audit,
TypeScript, lint (zero errors, the existing R8-gallery warning), all 374 shared
tests and all 77 tooling tests. Its first run caught a missing Back-callback
dependency; correcting the dependency resolved the compiler/lint check without
changing rules or assertions.

`scripts/android.mjs beta --json` then passed release assembly and APK inspection
at **10 October 2026, 01:30:43.653 UTC** (9 October local time). Application
sources were held constant throughout: the UI correction above, uncommitted atop
`ce65aa26ba4c4106bced14b950021cf9ee305cc2`. The later evidence/checklist/Git updates
do not alter those application contents. This UI-only follow-up did not change
Kotlin/storage or rerun the earlier 183 native unit tests; their passing result
above belongs to the preceding native verification. The new artifact is signed,
non-debuggable, bundled ARM64 `com.remilo.app` **0.4.0 (4)**, minSdk 34 / targetSdk
36, with SHA-256
`740bdbd93b3e4bb2f0bbc79841357fb572b2d95ba6a8bb841651218a8e19e502`.
The sandboxed first build attempt could not open the existing Gradle cache lock;
the authorized local build rerun completed successfully, retaining the signer.
This latest local artifact replaces the button-only artifact recorded above.

These are source and web fixture observations, not physical Android acceptance.
No installation, launch, phone-data mutation or APK distribution was requested
or performed. Native picker ordering/cancellation, normal timeout and TalkBack
remain part of the consolidated signed-phone acceptance run.
