# Calendar imports and protected linked updates — 12 October 2026

## Source and implementation

Branch: `calendar-import-linked-updates`. The final tested runtime source is
`24b207d81af31f36111630805f625c7ac0b3ff1a`. The owner’s existing
`.vscode/settings.json` change was preserved and excluded from feature commits.
Subsequent evidence/backlog edits do not change the runtime source.

The [current contract](../calendar-linking.md) defines single-event imports from
owned calendars, timed/single-day all-day mapping, default Alarm, independent
Google reminder consent, explicit adoption of published copies and per-field
Title/Notes/Schedule review. Imports create ordinary offline reminders. Current
global sound/vibration, independent timings, list membership, completion and
Snooze/Postpone stay under local engine authority.

CE schema 8 adds retained source identity and immutable phased operations;
DP schema 6 and backup format 4 remain unchanged. Import and linked edit reuse
the serialized engine transaction, receipts, generation fences and scheduling
outbox. HTTPS/authorization remain on the separate Calendar executor. Sparse
patches require the reviewed etag; startup performs no Calendar network recovery.
Unlink/Trash/account changes fence outstanding work. Erasure prevents late
acknowledgements from restoring snapshots. Conflict-rejected operations cannot
be revived after a replacement review.

## Completed host checks

The final repository release preparation entry point was
`node scripts/prepare.mjs release --json` (the `npm run release:prepare -- --json`
script), using the pinned Node runtime and existing signing configuration.
It ran shared checks before native verification and assembly, sequentially.
It completed successfully at **2026-10-12 09:03:18 UTC**.

| Check | Actual result |
|---|---|
| Current design/evidence audit | Passed |
| TypeScript | Passed |
| ESLint | Passed; existing reference-gallery unused-variable warning retained |
| Shared source tests | 230 passed in 29 suites |
| Controlled tooling tests | 89 passed; zero failures |
| Native unit tests | 254 passed in 23 suites; zero failures, errors or skips |
| Native module lint and app release lint | Passed |
| Signed release assembly and APK inspection | Passed; Gradle BUILD SUCCESSFUL in 2m 1s |
| Git whitespace checks | Passed |

The native suite includes 28 new Calendar link tests against a real serialized
AlarmEngine/Room state owner and injected synthetic transport/registrar. Coverage
includes mapping/DST, retained identity, operation reuse, transactional crash
checkpoints, blocked suppression, lost replies, mixed resolutions, independent
timing, preserved postponement, remote/local conflicts, terminal guards,
disconnect/reconnect, Unlink/Trash/Restore/Purge and private-storage exclusions.
Existing publication regressions remain. Migration tests preserve version-7
publication/account/job data through version 8 without automatically linking.
HTTP request tests check ordered 100-result browsing, If-Match, sparse fields,
HTTP 412 and bounded safe failures. Shared/VM checks isolate the memory fixtures
from Google, authorization, native scheduling and persistent storage.

An initial request test exposed URLConnection implementations that reject direct
PATCH. The transport now uses Google's documented POST method override when
needed, retaining If-Match and the approved sparse body. A tooling run exposed
the strict fixture loader's missing allowlist entries; only the new pure adapter
and comparison helper were added. Final review added regressions for obsolete
conflict retries and separately consented suppression with No alert. No tests
were weakened to obtain the final results.

## Fixture observations

The isolated production-component preview used memory-only Calendar state.
The final all-day import review was inspected at a measured **360×800 CSS**
viewport in Sunrise, Sky, Evening and Night, each Light and Dark. Title/notes
wrapped, Alarm remained selected, No list was the default, Google consent was
unchecked, and the persistent Import/Cancel actions stayed visible.

Additional focused observations included the timed import review, a conflict
with separate Google Title and Remilo Notes choices, disabled Apply before
resolution, the resulting values and a confirmed memory-only outcome. Long
English/Chinese content and 200% text were inspected in portrait and at measured
**960×432 CSS** landscape with the reduced-motion fixture enabled. The blocked
result retained Google reminders and exposed explicit retry. The partial result
showed the local save separately from the unconfirmed Google outcome. No alert
left the Google suppression switch independently usable. Owned source selection,
unsupported meeting/recurrence explanations and explicit Load more were observed
in the event browser.

Early browser navigation acknowledgements and viewport changes were unreliable;
the final checks selected the correct tab, measured dimensions and waited for
the populated review. Loading/error views were seen during that work. These
observations are focused renders, not a completed cross-product of every state,
size, atmosphere, language and accessibility setting. Remaining full matrix and
Android keyboard/hardware Back/TalkBack observations belong to the consolidated
owner run. Fixtures establish no actual OAuth, Google patch or audible alarm pass.

## Identified signed artifact

The release workflow built from the source commit above, with no runtime edits
during its final checks/assembly. The private build summary is
`verification/local/release-summary.json`; final output is
`verification/local/p4b-release-final.log`. APK inspection confirms:

| Attribute | Actual value |
|---|---|
| Package/version | `com.remilo.app` / `0.4.0` / version code `4` |
| Variant/ABI | Release / `arm64-v8a` |
| Minimum/target SDK | 34 / 36 |
| Runtime | Bundled JavaScript; non-debuggable |
| Signing | Existing beta identity; signature verified |
| Signer certificate SHA-256 | `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556` |
| APK SHA-256 | `f3548df54cc7c9d9c7e4505ec64895f5f0717895419e04c826f8423e68b50883` |

Build output: `android/app/build/outputs/apk/release/app-release.apk`.
An identical private retained copy is
`verification/local/p4b-24b207d-app-release.apk`, with its source/hash record in
`verification/local/p4b-build.json`. These artifacts and diagnostics remain
ignored and local.

No installation, distribution, Google authorization or live remote write was
performed. No physical or emulator acceptance result is claimed. Use the updated
[consolidated owner checklist](../device-acceptance.md) on an identified signed
build for imports, suppression, mixed conflicts, interrupted requests, offline
local delivery, terminal states, upgrade and accessibility. P4-A's existing
owner sign-off, CAL-01's unreported individual observation and G4's separate
requirements remain distinct.
