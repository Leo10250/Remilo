# English and Simplified Chinese localization — 15 October 2026

## Source and scope

Implementation source is `8c4260425cf7846f9e1eedd4ba22cd3c28d1588d`, based on
`6bc513bfcdae1582bff99c4e8ffb9edbf11fcc4a`, on `Chinese-localization`. The signed
artifact below was assembled from these runtime sources before the implementation
commit was recorded. Later evidence/backlog edits do not change runtime source.

The native owner persists System default / English / Simplified Chinese, initializes
fresh versus upgraded/unopened installations, reconciles Android's per-app selector,
and publishes the existing presentation snapshot/event with language and clock
preferences. CE/DP schemas are **13/7**; portable backups remain **4** and exclude
language settings. Protected language storage contains enums and reconciliation
metadata. Authored/imported content and Calendar identities/payloads remain data.

The canonical catalog contains **1,839 English/Simplified Chinese message pairs**.
Generated TypeScript helpers, native typed descriptors and Android resources share
that source. App/domain text, native controls/notifications, retained feedback and
Calendar statuses use the catalog. Recognized historical Calendar copy acquires
descriptors while retaining original prose/outcomes; unknown historical details
use a neutral localized fallback. Typography uses the system sans-serif with shared
Chinese size/leading/weight metrics. No font, dependency or artwork was added.

## Recorded host verification

The final commands ran sequentially: `npm run verify`, then
`npm run verify:android`. Both exited **0**.

| Check | Observed result |
|---|---|
| Catalog coverage, placeholders, plurals, escaping and generated-file parity | 1,839 pairs verified |
| Design contracts, TypeScript and ESLint | Passed; existing frozen-gallery unused-variable warning remains |
| Shared behavior | 35 files / **292 tests passed** |
| Tooling and production-component fixtures | **97 tests passed** |
| Native unit tests | 38 suites / **462 tests passed**, zero failures/errors |
| Native module debug lint and app release lint | Passed |
| Signed release assembly | Passed; arm64-v8a |

Language cases include ordered Hans/Hant/region matching, explicit pre-launch choice,
fresh/unopened metadata initialization, legacy migration, interrupted projection,
newer external selection, exact retry identities, stale-language rejection, clock
independence, retained feedback/confirmation replacement, native/JS count copy and
unknown legacy Calendar prose. Existing scheduling, recurrence, Calendar and backup
checks remain intact.

The ringing-language integration test compares protected members, generations,
targets, session lifetime/deadline, scheduling registrations, authored title and
portable backup before/after switching. A separate injected locale-service failure
test delivers an existing alarm before unlock using generic content, while projection
remains retryable. These are host observations, not physical audio/reboot acceptance.

The final Android run reported `BUILD SUCCESSFUL` (3m 47s; 1,032 actionable tasks,
70 executed / 962 up-to-date). SDK XML/tooling and Gradle/Kotlin deprecation/unchecked
warnings did not fail the required checks. Raw local command logs and test reports
remain under ignored local verification/build directories.

## Signed local artifact

- Package/version: `com.remilo.app` **0.4.0 (4)**.
- Variant/ABI: signed bundled release, **arm64-v8a**.
- Path: `android/app/build/outputs/apk/release/app-release.apk`.
- Size: **89,065,948 bytes**.
- Written: **2026-10-15 21:16:11 UTC**.
- SHA-256: `c075f634143355381e465b88b512a327d380e883443ec72f0ca5a5da13c1846d`.

No installation, launch, APK upload, distribution or live Google operation was
performed for this change. Signing files and private local diagnostics remain ignored.

## Presentation observations and limits

Production-component fixtures exercised both languages at 100%/200% text across all
eight atmosphere/brightness pairs, including surface colors, role metrics, sheets,
focus treatment and reduced-motion behavior. The language fixture switches confirmed
snapshots without changing authored content, clock preference or operation receipt.
These fixture assertions do not perform Android layout or raster acceptance.

The browser was reviewed at 360 × 800 with Chinese Agenda, Settings and language
selection in Automatic/light, including mixed English authored content and Chinese
dates/ages/actions. Selecting English updated the open Settings route and language
sheet in place. Subsequent fresh editor/200% preview navigations and captures stalled
in the browser connection; they were not recorded as passing. The temporary preview
server was stopped and its viewport override was reset.

The remaining full-screen raster matrix, landscape, dense/long mixed content, loading,
error, destructive, recurrence, Calendar review and restore cases remain unobserved.
Signed-phone system-selector synchronization, IME/caret preservation, TalkBack, OEM
fonts, JS-absent alarms, locked/pre-unlock privacy and language switching during real
ringing remain in [the consolidated owner checklist](../device-acceptance.md).
The existing owner instruction permits implementation to finish before that run;
it does not establish beta acceptance or authorize distribution.
