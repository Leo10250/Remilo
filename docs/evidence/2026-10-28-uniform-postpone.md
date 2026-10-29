# Uniform Postpone chooser — 28 October 2026

## Delivered behavior

The owner approved the uniform tile mockup and detailed implementation plan, then
requested implementation plus correction of main's Android pipeline failure and
Simplified Chinese support. The [current contract](../design/current/postpone-chooser.md)
records the resulting behavior; task status remains in the backlog.

Native single/member/group alerts and ringing Details offer Mark as done/Postpone
and their group counterparts. Both render the same eight-tile anatomy and retain
the 15-minute default. Custom Date/Time values stay provisional until Use this
time; Back restores the previous selection. Exact previews/confirmation remain
outside the choices scroller. Unselected previews refresh only in the foreground.
The native audio deadline remains independent of choosing/cancelling.

The Kotlin time policy distinguishes 24 elapsed hours from calendar Tomorrow and
uses CivilTime gap-forward/earlier-fold resolution. Captured IDs/generations,
settings and zone stay fixed while choosing. PostponeAll uses the existing
serialized durable group pipeline with a distinct absolute-target fingerprint,
per-member Postpone history, recovery outcomes and exact-command retries.

DP7→8 preserves legacy receipt values while adding kind/nullable duration and an
allowlisted Tomorrow preference mirror. CE13 and backup4 remain unchanged. A
missing locked-upgrade mirror disables only the Tomorrow choices until unlocked
repair. Operational saved state contains no reminder title or notes.

## Main pipeline failure and correction

The supplied main log reports CalendarAutomaticTest.classMethod failing inside
MavenArtifactFetcher with ExecutionException/SocketException, before an application
assertion. Robolectric fetches its Android SDK jars through a separate runtime
downloader; Gradle dependency success does not make that fetch reliable. The log
does not identify the lower-level reason the connection failed. Re-running or
warming one machine's cache leaves the same cold-run dependency path in place.

Following [Robolectric's upstream guidance](https://robolectric.org/blog/2023/11/11/improving-android-all-downloading/),
the module now resolves pinned Android 14/API34 and Android 15/API35 instrumented
jars through two independent Gradle configurations, stages both before Test tasks,
and supplies robolectric.dependency.dir. Separate configurations prevent Gradle
version-conflict resolution from discarding API34. Under the pinned JDK17,
Robolectric4.17 uses API34 for these tests and API35 for resource compilation.
Both jars were present during the successful local native suite. Missing downloads
remain dependency failures; no test is skipped or failure reclassified as success.

At the initial implementation handoff, the focused CI-only local commit e912c7b
on fix-robolectric-sdk-downloads had not been pushed: automatic approval review
rejected external publication without explicit owner authorization. That handoff
did not claim a new GitHub run or repaired main-branch result.

The owner then explicitly authorized pushing both prepared branches and opening
draft PRs. Both pushes succeeded: [CI fix #19](https://github.com/Leo10250/Remilo/pull/19)
targets main, and [chooser #20](https://github.com/Leo10250/Remilo/pull/20) targets
the CI branch for a focused stacked diff. Merge #19 first; then update/rebase the
chooser branch as needed and retarget #20 to main. A squash/rebase merge of #19
requires removing its already-landed commit from the chooser stack. At PR creation,
both heads had running shared/Android checks; no merge or remote passing result
was observed. Live status remains in the backlog.

## Automated evidence

- Repository shared verification passed: catalog generation/parity, design and
  preserved-reference checks, TypeScript, ESLint, **300 shared tests** and
  **97 controlled tooling tests**.
- Native verification passed with **495 tests across 42 suites**, zero failures
  or errors, plus native/app lint and signed ARM64 release assembly. The final
  command result is recorded in the ignored local log.
- The native suite covers absolute group target/capture/staleness, operation
  reuse, four fault checkpoints, newer actions, recurrence/authored timing,
  locked Relative/Custom behavior, mirror repair and DP7→8 preservation.
- Pure draft/time cases cover DST, month/year/leap-day boundaries, supported
  durations, custom cancellation, expiry, late async replies, immutable captures
  and saved operational state.
- **1,870 English/Simplified Chinese catalog entries** are generated from the
  source catalog. New native assertions verify Chinese tile/action/custom/locked
  and partial-result copy without changing command identity or scheduling.
- The lifecycle isolation fixture now checks guarded draft dismissal, deferred
  session routing and unresolved-command ownership rather than requiring the
  obsolete immediate-finish source spelling.

## Boundaries and outstanding observations

The ordinary fixture server reported bundles but repeated browser navigation
attempts timed out before rendering (30, 120 and 300 second bounds). No actual
eight-pair visual review, large-text render, measured new-component contrast or
browser interaction pass is claimed from these attempts. The server was stopped.

The local verification assembled com.remilo.app 0.4.0 (4), ARM64, signed, in the
standard release output. It was built from the implementation working tree;
this record does not infer an installed APK or device/source association. Private
logs and reports remain in ignored verification/local; keys and APKs stay out of Git.
The final release source map matches the current PostponeChooser source. APK
SHA-256: `2516722a62662895001663bb4c04bd8a92b4ccca10efdccfc7e7b215711fc8fa`.

No installation, distribution or physical observation was performed. Native
picker/Back/rotation behavior, all eight visual pairs, English/Chinese 100–200%
text, TalkBack, locked/Direct Boot, continued audio while choosing and original
cutoff remain in the [consolidated acceptance checklist](../device-acceptance.md#uniform-postpone-follow-up-alert-06).
Host checks and a signed assembly do not close beta or distribution gates.
