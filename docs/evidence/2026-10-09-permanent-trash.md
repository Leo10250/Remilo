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
