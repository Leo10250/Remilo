# Calendar recurrence and automatic synchronization evidence

This record covers the P4-C prerequisite and P4-D implementation requested by the
owner. Source is on `calendar-automatic-sync`, based on `9c12394`. The retained
artifact uses runtime commit `44eb69fa1decd4889ee6c85f5b4e59b8b95c8077`.

## Delivered behavior

Native recurrence mapping uses the existing recurrence kernel, retained master,
original nominal instance and following-segment identities. Full-family
publication and reviewed import capture independent resource outcomes. A partial
Schedule never advances the common Schedule baseline. Cancellation preserves
local content and delivery; completion, Skip and Trash remain local actions.

Automatic permission requires a deliberately confirmed native preview and
successful baseline establishment. Existing migrated links remain manual. The
native comparator merges ordinary changes to distinct groups and preserves both
versions of genuine conflicts. Unknown sent writes are inspected before any
further write; a newer local edit remains dirty after an earlier outcome is
acknowledged. Conditional rejection refreshes comparison without choosing by
timestamp. Account, lifecycle, Unlink and Purge fences invalidate permission.

Consistent allowlisted collection queries persist page checkpoints and cursors.
An expired sync token rebuilds the remote cache without removing local reminders,
alarms, links, baselines or operations. WorkManager requests hourly connected work
with a 15-minute flex window and bounded continuations. Native runs have two-minute,
ten-page and fifty-association budgets. Direct Boot remains independent of CE
storage and Calendar work; synchronization needs no JavaScript or Activity.

Saved projections supply shared status, reviewed bulk activation, a persistent
review queue and separate CE Calendar Activity. Quiet grouped review notifications
use generic public content, stable delivery fingerprints and an explicit setting.
CE migrates 9→10→11; DP 6 and portable backup 4 remain unchanged.

## Checks and fixture observations

Shared verification passed 242 tests in 31 files and 91 controlled tooling tests,
with TypeScript, ESLint and design checks. The existing unused `expectedScreenIds` warning
and preserved artwork master-resolution limitations remain unchanged. The native
suite passed 329 tests; `npm run verify:android` completed native tests, lint and
release assembly successfully. Shared verification preceded Android verification;
Android verification was repeated for subsequent native recovery corrections.
Failures encountered during development were corrected, including
whole-family versus per-resource Schedule comparison, unsupported Calendar zones,
and idempotent suspension Activity. Existing cancellation tests now explicitly
assert the new Activity entry while retaining equality of all local fields,
generation, target, Snooze and local history. The merged app manifest excludes
only WorkManager's default initializer metadata; other Startup initializers remain.

Deterministic native tests cover the five comparison outcomes, clears and
different-group merges; manual migration/opt-out and guarded atomic activation;
durable full/incremental/empty-page cursors and expired-token rebuild; conditional
re-comparison, lost replies, own-write recovery and newer local edits; linked and
independent timing, future postponement, elapsed review and ringing deferral;
recurring master/instance/following jobs, floating-family pinning and partial
recovery; deletion/terminal/access fencing, CE migration and backup exclusion;
worker construction, constraints, bounded continuations; notification privacy,
permission/channel changes, dismissal and durable preference/restart fingerprints;
and idempotent Activity. The final audit also added regressions for definitively
unsent budget expiry, failed inspection of an earlier sent write, and native
automatic capture rejecting selections that contradict its own comparison. An
earlier acknowledged write with newer local dirty content retains a worker
continuation, including when no new operation has been captured yet.

Runtime commits group the recurrence kernel and resource transport first, then
the baseline comparator, shared native storage/operation integration, and the
bridge/presentation. CE ownership and operation hooks shared by multiple D units
remain together rather than leaving intermediate integrations incomplete.

Memory-only production component previews were inspected for automatic management
at 360×800 in Sunrise Light, manual management in Sky Light, narrow Night Dark
conflict management, and long bilingual resolution choices. The resolution
confirmation stayed disabled until all differing groups were selected. The
outlined unlink target measured 56 px high in the narrow fixture. A local
screenshot is retained under
`verification/local/p4-calendar-ui/night-dark-review.jpg`. The browser repeatedly
timed out on navigation and focus; the eight-pair, landscape and 200% matrix has
not yet been established. No fixture calls native storage, OAuth or Google.

## Signed acceptance

`npm run build:beta -- --json` succeeded after Android verification. The retained
artifact was inspected by the repository tooling:

- Built at `2026-10-13T07:57:27.156Z` (00:57 PDT).
- Package/version: `com.remilo.app`, `0.4.0` (`4`).
- Release ABI: `arm64-v8a`; min SDK 34, target SDK 36.
- Bundled JavaScript, non-debuggable, signed with the existing beta identity.
- APK SHA-256: `fa17f7a00646ef3f170b77d6898a9b8ed08c833728fbde276f4d2e7096e23a75`.
- Signer certificate SHA-256:
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Retained APK: `verification/local/calendar-sync-44eb69f-app-release.apk`.
- Private build record: `verification/local/calendar-sync-build.json`.
- Local logs: `verification/local/p4-calendar-shared.log`,
  `verification/local/p4-calendar-android.log`, `verification/local/p4-calendar-beta.log`.

Runtime files were committed before this final build and remained unchanged during
assembly and inspection. Documentation edits and the unrelated owner
`.vscode/settings.json` change were outside the APK inputs. Later documentation
commits do not change the recorded runtime source relationship. Temporary preview
processes and the browser tab were closed, and the viewport override was reset.

Installation and distribution are separate from this implementation. No phone or
live Google observations have been performed for this change. The
[consolidated owner checklist](../device-acceptance.md) retains recurrence,
background, both-direction, offline/access, conditional-race, deletion and
notification cases. Host tests and synthetic fixtures do not close G4.
