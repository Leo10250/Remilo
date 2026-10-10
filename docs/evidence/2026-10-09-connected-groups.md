# Connected editor, Lists and Settings groups

Owner-approved 9 October 2026 presentation correction, implemented on top of
`9adf9452697c7e074ba3d80df03e55200c8b1d4c`. Task status belongs to BETA-06 in
[the backlog](../backlog.md). The current contracts distinguish 2 dp connected
seams from 12 dp independent-group spacing, with 16 dp outside and 4 dp inside
corners. Existing colors, typography, switch geometry and functional behavior
remain authoritative. No storage migration, engine API, dependency, artwork,
installation or distribution change applies.

## Source changes

- Canonical presentation tokens generate shared TypeScript and native Kotlin
  constants. ConnectedGroup filters hidden direct children before calculating
  corners, preserves explicit keys and paints each unit over a transparent parent.
  A private row context gives switches/navigation matching treatment and resets
  at Sheet boundaries. Helpers/errors/recovery use item/footer insets.
- Editor main units are Date/Time, Alert, conditional Repeat and List. Schedule
  groups are All day/Ends, Due linkage/Due, alert linkage/applicable linked time,
  and Time zone. Sound/Vibration share one group. Existing Date/Time division,
  all-day behavior, radio geometry, linkage, Notes and Save remain.
- Lists library/management remove the continuous white wrapper and old 12 dp
  internal spacing. Counts remain inside entries, decorative list icons remain
  omitted and More retains an independent 48 dp target. Stale-list/count-retry
  feedback belongs to the list group footer.
- Entire Settings uses connected groups with explanations/feedback attached to
  their controls. Preference recovery has one owner across groups. Test recovery
  and conditional View test reminder share a group; channels/version are passive
  information. Prepared-export recovery belongs to Export.
- Narrow 200% text review found trailing permission status squeezing labels into
  broken words. Connected navigation rows now place that status below the label
  at font scale >=1.6 (fixture or system), preserving the same action semantics.

## Isolated fixture review

Reviewed actual React Native web fixture components via the isolated preview
server, not a native build. All eight Sunrise/Sky/Evening/Night × Light/Dark pairs
were captured for editor, Lists and Settings at 412×915: 24 captures, no document
horizontal overflow. Seams and theme fills are visible. DOM measurements confirm
2 px connected gaps and 16/4 px corners; focused All day and Vibration borders
remain inside their item corners. Vibration is 64 px high with its leading icon;
All day is 56 px and More is independently 48×48 px.

Final spacing review identified that Page's inherited spacing was still 16 dp
between top-level Settings/Lists groups. Scoped content wrappers now use 12 dp;
the final rendered Settings and Lists both measured 12 px group spacing and
2 px item seams after the final build. `settings-light.png` and
`lists-final-light.png` record that follow-up. The preview browser temporarily
stalled during rebundling, then recovered; no native result is inferred from it.

At 360×800 and 200% text, reviewed Light/Dark editor and Settings, long bilingual
Lists/management names, passive permission channels, blocked/unavailable access,
recovery text and lower-page scrolling. Date/Time stacks; labels/values grow;
Save stays in the persistent footer. The revised permission status layout is
readable and document width stays 360 px. Native pickers are deliberately inactive
in this web fixture, so no Android picker or IME result is claimed.

UI exercises include All day hiding Time/Ends and restoring singleton corners;
unlinking Due and alert time; Alarm/Notification/No alert visibility; creation
versus editing (Repeat omitted while editing); closing the List sheet without
losing the long title; empty/single/multiple named Lists; More opening its separate
actions sheet; unavailable/blocked permission queries; and two queued preferences
with lost replies. Preference recovery shows one retry, confirms Vibration,
then moves to Snooze, and finally confirms 15 minutes. Captured Test lost-reply
retry reveals View test reminder without another creation. Prepared-export
share failure reveals recovery inside Export and retry changes its feedback.

The export fixture stores only synthetic backup text in memory and simulates
share outcomes; it never opens an external share sheet or sends a file. File/
share adapters and fixture permissions/list counts apply only to the opt-in web
bundle. Resolver isolation and identified Test retries have automated checks.
Stable keyed direct units were reviewed in source for conditional retention;
actual native picker lifetime/focus acceptance remains pending.

Private captures/geometry are under ignored
`verification/local/connected-groups/`, including `theme-matrix.json`, the 24
theme captures, `settings-light.png`, `export-recovery.png`, narrow 200% captures,
blocked/error permission views and long-name management. These contain synthetic
fixture data only and are not uploaded.

## Automated checks and local artifact

The final shared check ran before the final Android check, with application
sources held constant through assembly:

| Check | Actual result |
|---|---|
| `npm run verify` equivalent using bundled Node 22.23.3 (`scripts/verify.mjs --json`) | Passed, completed 10 October 2026 04:03:10.697 UTC. Design audit, TypeScript, lint, 374 shared tests and 80 tooling tests. |
| `npm run verify:android` equivalent (`scripts/android.mjs verify --json`) | Passed, completed 10 October 2026 04:05:32.778 UTC. Native compilation, unit tests, lint and release assembly. |
| Native XML results | 183 tests in 19 suites; zero failures, errors or skips. |
| Focused fixture isolation/recovery suite | 16 tests passed before the full checks; included in the 80 tooling tests. |

The existing gallery `expectedScreenIds` unused-variable lint warning remains;
lint reports zero errors. Preserved artwork master-resolution limitations remain
diagnostics in the design audit; approved pixels were unchanged. Shared/native
results and build JSON are retained privately in `verify-shared.log` and
`verify-android.log` under the capture directory.

Final signed release APK: `android/app/build/outputs/apk/release/app-release.apk`.
Package/version **com.remilo.app 0.4.0 / code 4**, ARM64, min SDK 34/target 36,
bundled JavaScript and `debuggable=false`, using the existing signer.
SHA-256: `56f235df7a931b79a56fe4867736f57434095ee10f369ad7bd4817928313d445`.
The build used the uncommitted application-source correction on top of the base
revision above; source did not change between the final shared verification and
assembly. Subsequent evidence/status edits do not change that application source.
This supersedes the earlier local Trash/editor acceptance artifact without
claiming installation, physical acceptance or beta distribution.

## Acceptance limits

Browser fixtures and host/native checks do not establish physical Android,
TalkBack, native focus, system font scaling, date/time picker, IME or share-sheet
acceptance. No app installation, launch, user-data change or distribution was
performed. [U25](../device-acceptance.md) adds these observations to the existing
consolidated owner acceptance run. P4-A remains the next planned implementation
after this correction; pending physical gates still block a verified beta.
