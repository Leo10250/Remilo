# Collection Filters header follow-up — 10 October 2026

The owner approved icon-only Filters beside Search/More in Completed and Trash,
an active-count badge, and the labeled Agenda content-row action. The maintained
[UX contract](../design/current/ux-refinement.md) records this presentation;
task status belongs only to [UX-20 in backlog](../backlog.md).

## Behavior and scope

Collection Filters reuses the shared neutral 24 dp toolbar icon and minimum
48 dp target, including scenic, focused, pressed and disabled treatment. A small
neutral badge appears only for active editable optional filters. It ignores
pointer input and is hidden from accessibility; the button's name includes the
count, with explicit expanded/disabled state. Larger text reserves badge space
without covering the glyph. Agenda keeps Filters / Filters · N in its content
row. Applied chips, queries, draft Apply/Cancel, guards, selection, scroll and
fixed membership keep their existing behavior.

Current product/page contracts, TD-03 and U29 were amended. No artwork, palette,
dependency, native command/storage, backup or Calendar behavior changed.

## Actual checks and artifact

- Final shared verification passed **2026-10-11T04:38:16.566Z** (10 October local):
  design audit, TypeScript, lint, **192 source tests in 22 files** and **82 tooling
  tests**. The existing frozen R8 gallery unused-variable warning remains.
- Final Android verification passed **2026-10-11T04:42:45.801Z**: module/app lint
  and signed bundled ARM64 release assembly, **BUILD SUCCESSFUL in 1m 48s**;
  31 tasks executed, 1001 up-to-date. The native test task was **UP-TO-DATE**;
  retained XML reports contain **216 tests in 21 suites**, zero failures/errors,
  with latest report timestamp 2026-10-10T06:13:04.6531012Z. This is cached native
  coverage, not a new execution of unchanged engine tests.
- Application source: **de70441a317d6b77e1dd5aa4d7f75cf50ceeb94d**. The checkout
  was clean at that revision throughout final Android assembly. Subsequent
  evidence/backlog edits do not change the built application.
- Artifact: `android/app/build/outputs/apk/release/app-release.apk`, signed,
  non-debuggable, bundled JavaScript, ARM64; **com.remilo.app 0.4.0 / code 4**,
  minimum SDK 34, target SDK 36.
- APK SHA-256:
  `3a651ad1a283cb349dfabd01e3fa8d819126e632f44cfb493f6582cc2c818d11`.
- Existing signer SHA-256:
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

The first Android invocation could not write the existing Gradle cache under
workspace sandboxing; the authorized invocation with cache access succeeded.
No installation, launch or distribution occurred. Logs, metadata and screenshots
remain private under ignored `verification/local/filter-header/`.

## Fixture observations and limits

The isolated production-component preview at 360×800 showed icon-only Completed
Filters, a badge of 2 after applying Personal + Show skipped, and both removable
chips. Reviewed header captures cover Sunrise Light/Dark, Sky Light/Dark and
Evening Light. Night Dark at 200% text and reduced motion was also reviewed:
the initial badge overlap was corrected, with a 72×48 CSS-pixel button reserving
space for scaled text. Ordinary-size measurement was 48×48 CSS pixels; the badge
was aria-hidden, the spoken DOM name included the count, and expanded state was
true with the sheet open and false after Apply.

Initial preview connection/navigation timed out before bundling finished. The
browser later recovered for the observations above, then the broader atmosphere
review timed out after five captured pairs. No full eight-pair, landscape,
long-content, Trash or Agenda render pass is claimed. The preview server was
stopped, the viewport override reset and the working fixture tab closed.

U29's actual Android TalkBack, font-scale, touch, filter and guard observations
remain pending in the consolidated signed-device run. Prior evidence retains
its original scope; Calendar's load-view error remains deferred.
