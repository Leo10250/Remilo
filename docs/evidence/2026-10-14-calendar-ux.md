# Calendar setup and outcome feedback observations — 14 October 2026

## Source and scope

Implementation source is `ccd0835005fdae19bf023123a339bbc9452bd666`
(durable native projections and authorization outcomes), followed by
`ba5cbdd872bad2fca31018ba6ece02334ac824bb` (production UI, shared presentation,
fixtures and checkbox semantics). The subsequent documentation commit changes no
application source. The owner's unrelated `.vscode/settings.json` edit was
preserved. No installation, Google account operation, push or distribution was
performed.

Calendar status reads remain native saved projections, with no discovery or
network dispatch on overview navigation. New receipt metadata correlates logical
children without rewriting historical receipts. Authorization launch and verified
outcome are separate. Reconnecting a fenced source returns to review. CE/DP/backup
versions remain **12/6/4**.

## Automated observations

Checks ran sequentially with the repository commands:

| Check | Observed result |
|---|---|
| `npm run verify` | Passed: 33 source test files, 263 source tests and 91 tooling tests; type checking, lint and contract/asset checks completed |
| `npm run verify:android` | Passed: native tests, module lint and release assembly; final run `BUILD SUCCESSFUL in 1m 52s` |
| Native XML reports | 36 suites, 432 tests, zero failures, errors or skipped tests |
| Focused native status tests | Nine tests covering authorization immutability/reuse, pending scan/import separation, review deduplication, stale scope, historical correlation, reviewed reconnect and post-import dirty edits |

The final shared log is `verification/local/calendar-ux-verify.log`; the final
Android log is `verification/local/calendar-ux-android-final.log`. The latter run
rebundled the final UI source after the earlier full native compilation/test run.
Up-to-date native reports are retained for that unchanged native source.

Initial sandbox attempts could not use the existing Windows Git fixture and
Gradle cache facilities. The same commands then passed with approved local
execution. Existing warnings remain: the frozen appearance-gallery JavaScript
contains an unused `expectedScreenIds`, existing native casts/deprecations and
Gradle deprecation warnings. Historical artwork-resolution observations remain;
no artwork was regenerated for this change.

Shared tests include verified authorization versus launch/cancellation, account
recovery, a completed scan with pending work, uncertain creation and directional
presentation. Existing P4-B/C/D/E native regressions remain in the passing suite.
These are host results, not live Google or phone observations.

## Identified local artifact

Final assembly output is a signed, bundled-JavaScript, non-debuggable
`com.remilo.app` **0.4.0 (4)** ARM64 APK, min SDK 34, target SDK 36. It was inspected
with the repository `inspectApk` helper, including certificate verification.

- Preserved copy: `verification/local/calendar-ux-remilo-0.4.0-ba5cbdd-arm64.apk`
- Size: **87,566,243 bytes**
- APK SHA-256: `ba09baf8a48c59e5111f56a305a1bf364d80ca2c8241320f59099a1359e600ec`
- Signer certificate SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`
- Source relationship: application source at `ba5cbdd`; only documentation and
  the unrelated editor preference were dirty during final assembly.

The artifact is local evidence. Assembly does not establish installation,
authorization, alarm delivery or physical acceptance.

## Production-component fixture observations

The isolated `scripts/preview-ui.mjs --port 8094` server supplied synthetic,
memory-only Calendar state. Browser actions could not call Google or native
authorization. Private captures are under `verification/local/calendar-ux/`.

Observed interactions and presentation:

- Setup groups the account and managed source above directional choices. Its
  Alert type and All-day alert time share one surfaced group. The clock row has
  a value, clock icon, chevron, visible focus treatment and calendar-zone helper.
  Its measured web row height was 70 CSS pixels. The Android time-picker handoff
  was not exercised by the web substitute.
- Changing a default showed Checking settings and disabled confirmation until
  the native-preview substitute returned. One confirmation press replaced the
  editable form with saved outcome/count presentation and Back to Calendar.
  That synthetic result does not prove completion of a real Google operation.
- The access-needed overview keeps warning, consequence and Continue
  authorization together; account/source identity follows in one connected
  group. Advanced manual tools remains separately labeled.
- The mixed activation fixture shows two ready checkboxes and one Needs review
  item, Test. Test has the conflicting-values reason and Review changes inside
  its own padded card, with no disabled selection control. Checkbox accessibility
  state and the selected-count footer agreed after the explicit web checked-state
  attribute was added.
- At 200% text, long English/Chinese reminder labels wrapped in growing rows.
  Review actions and the primary label wrapped. Reduced-motion fixture settings
  were enabled. In landscape, measured DOM size was 667×300 CSS pixels and the
  wrapped primary target was approximately 73 CSS pixels high, within the
  viewport. These observations do not establish native font scaling or TalkBack.

The viewport API's requested pixel size and the browser's zoomed CSS size differed
(for example, a 432×960 request produced 360×800 CSS pixels). Some captures also
contained stale scaled raster/white margins. Those images are retained as capture
limitations, not accepted proof of app clipping. The normal-viewport loaded
overview captures are reliable for their recorded state. Loading-only frames are
not appearance acceptance.

Loaded overview states were inspected in Sunrise Light, Sunrise Dark, Sky Light
and Evening Dark. The normal-viewport Sunrise Light and Sky Light captures show
the contextual recovery card, account/source and directional preference rows.
Other pair/state combinations remain unobserved. Repeated navigation deadlines,
delayed fixture hydration and a browser-control timeout prevented completing the
matrix during this run; a loading frame was not counted as a completed review.

## Remaining observations

The full state-by-appearance matrix, all recovery/cancellation flows, actual
native pickers, Android Back/IME ordering, TalkBack, system font scaling and
comprehension checks require further observation. Browser fixtures do not prove
those results. Preserve the existing P4-D/P4-E and G4 signed-phone/live Google
requirements, including creation/access recovery, both directions, recurrence,
offline/conditional races, local-alert independence and review notifications.

No physical acceptance is asserted by this record.
