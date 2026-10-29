# Calendar Settings status and controls — 29 October 2026

## Source and behavior

Branch `calendar-sync-status` starts from fetched `origin/main`
`219ab82b2e26ceeb1d2b5a4aa8fd6aaeb66489a7`, including the merged Routine,
localization and compatible Postpone changes. Existing private attachment files
were left untouched. This work changes Calendar Settings presentation and native
freshness projection, not scheduling, database versions, portable formats or
Google authorization permissions.

The leading card distinguishes a completed current-scope Up to date result,
native active Syncing, intentional managed Pause and actionable Error. Queued,
offline, held, unconfirmed, unread and changed-scope results retain explicit
neutral/review states. Only a completed native AllAuthorized request can supply
the green outcome and its completed-check timestamp. Per-reminder success and
collection-observation timestamps are not aggregate proof.

Automatic sync is a connected disclosure with persistent On/Paused/Off and a
policy-only explanation. Global progress/error is never attributed to the selected
calendar. Pause/Turn off remain contextual; Resume retains the reviewed native
flow, and turn-off retains the themed confirmation. Short scope labels distinguish
global checks from managed-calendar controls; full scope help is in Sync details.
Zero pending/held counts omit their support row rather than reserving an empty
connected member or losing the final visible row's outside corners.

Native saved-success projections now yield to live managed imports/exports,
held/review/access/uncertain work and incomplete managed collection scans. New
global receipts capture the managed binding revision, so policy changes fence
older results. Legacy receipts keep their identity and existing guards; an
incomplete rescan prevents their earlier success from being presented as current.
Association scope, receipt-before-stale handling and exact captured retries remain.

## Contract discrepancies resolved

- Settings Sync now is AllAuthorized; the approved mock's narrower calendar-only
  status explanation could not be copied literally. Managed controls keep their
  separate scope, including when other authorized calendars are actively syncing.
- Resume requires the existing native review. A mock's simplified transition is
  not permission to skip that review.
- `successfulAtMs` in managed state is per-link aggregate timing, not a complete
  whole-scope check. It remains optional detail rather than green-status proof.
- Pending background work is not an exposed native in-flight signal. It remains
  waiting; only native CheckingEvents is labeled as an active sync. Capturing and
  reading a request receive their own truthful feedback and submission guards.

## Automated evidence

`npm.cmd run release:prepare -- --json` completed successfully on the finalized
source, using the repository release skill/workflow. The `.cmd` invocation keeps
PowerShell argument forwarding intact; it invokes the same `release:prepare` script.

| Check | Observed result |
|---|---|
| Shared TypeScript tests | 395 passed in 46 files |
| Controlled tooling fixtures | 119 passed |
| Localization | 2,371 English/Chinese messages verified |
| Design/preserved-evidence checks | Passed, no new findings |
| Typechecking and repository lint | Passed; one existing unused-variable warning in the frozen R8 gallery remains |
| Android unit tests | 662 tests in 57 suites; zero failures, errors or skipped tests |
| Module/app Android lint and signed assembly | Passed |
| Compose dependency alignment | 26 native-compile and 26 app-runtime components checked |

Regression coverage includes persisted success, scope/completion/timestamp guards,
real Checking versus queued work, live pending/held/review overrides, paused/off
controls with another calendar's current work or error, uncertainty/read failures,
reviewed Resume and Chinese copy. Fixture tests cover inert saved-result seeding,
scope separation, connection fencing and request identity. Six native additions
cover live managed work, access/uncertainty, policy revision, pause/off fencing and
legacy incomplete scans. Existing captured-action and stale-scope cases still pass.

The workflow also reports existing preserved artwork resolution limitations and
upstream SDK/Gradle deprecations. These were not changed or suppressed.

## Rendering and independent review

The isolated production-component preview initially measured 128 combinations:
four states × eight appearance pairs × English/Chinese × 100%/200% text, at
320 dp. No text overflow or targets below 48 dp were recorded. These records are
private at `verification/local/calendar-sync-status/render-matrix.json`.

After the copy/policy refinement, another 48 measured combinations passed, saved
at `verification/local/calendar-sync-status/followup-render-matrix.json`. The last
empty-row/corner correction was checked in source and in a fresh production Night
Dark/English 390 dp capture, saved as `final-up-to-date-night-dark-en.png` in the
same private directory. The independent audit also reviewed that correction.
Browser evidence is layout evidence; it does not exercise a real account, Android
pickers, phone TalkBack or the launcher. Cold compilation, a stale generated-catalog
hot reload and browser timeouts interrupted the attempted complete second matrix;
uncompleted measurements are not counted as passing. The initial complete matrix
and the completed follow-up measurements are retained separately.

A separate agent completed the owner's requested
[independent research/internal-style audit](2026-10-29-calendar-sync-design-audit.md).
It checked Google, Apple and Samsung primary guidance and modern empirical UX
research, independently inspected representative production components, calculated
canonical enabled contrast, and identified two scope problems that were corrected.
No remaining blocking design issue was identified in that reviewed scope. This
does not certify usability or accessibility, or prove the exact arrangement is
universally optimal.

## Identified signed artifact

Prepared at `2026-10-29T08:21:03.190Z`:

| Property | Observed value |
|---|---|
| Package | `com.remilo.app` |
| Version | `0.4.0` (4) |
| Variant / ABI | Release / `arm64-v8a` |
| Minimum / target SDK | 34 / 36 |
| Bundled JavaScript / debuggable | Yes / No |
| Size | 96,191,095 bytes |
| APK SHA-256 | `b6a0f51ccc370a5aa89ad1dbbd2590c03ba7689656e7dac17775770c31687a69` |
| Signer SHA-256 | `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556` |

Local artifact: `android/app/build/outputs/apk/release/app-release.apk`.
Private workflow summary: `verification/local/calendar-sync-status/release-summary.json`
(also the current `verification/local/release-summary.json`). No installation,
launch, distribution or Google-account mutation was performed.

## Physical acceptance

The [consolidated owner checklist](../device-acceptance.md) retains signed-phone
TalkBack/focus, actual authorization and reviewed Resume, offline/interruption
recovery, Android background opportunities and text/device rendering observations.
Neither browser fixtures nor a signed host build close those gates. Task status
is recorded only in the live backlog.
