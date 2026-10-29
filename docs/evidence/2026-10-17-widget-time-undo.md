# Widget reminder time and Undo state correction

Source baseline: `c49f2c0`. The owner's phone screenshots show clipped 09:00 in
Today setup and insufficient visual distinction/unequal graphic size between
Undo states. This correction preserves current atmosphere/brightness roles,
unfilled Undo before Done, native action ownership and intentional summaries.
Task status belongs only in the backlog.

## Causes and corrections

The compact reminder row had a fixed 56 dp height with 16 dp vertical padding.
The remaining 40 dp did not safely budget both text lines at increased text size
or with taller vendor font metrics. WidgetSizing now uses complete font top/bottom
metrics plus scaled 24/20 dp line-height floors for the 16/14 sp title/time.
The same calculation budgets the row, Today header/title/footer minimum and setup
preview height. The real launcher uses summary when that complete content cannot
fit. Expanded reminder rows share the calculation with their previous minimum.
Apply this additional budget only to views with actual reminder rows. Empty,
locked, unconfigured and error views keep their existing compact composition;
the full suite caught and corrected an intermediate recovery-height regression
that would have hidden the dedicated Refresh control at 200 dp.
No text shrinking, overlap or altered scheduling/time value was introduced.

Enabled Undo used Glance's icon frame while disabled used a separately padded
native ImageButton. Both now use one shared 24 dp drawable frame containing the
same 20 dp glyph. Target size/position and image geometry do not change with
eligibility. The enabled neutral tint remains onSurfaceVariant. Disabled no longer
uses the opaque disabled text role, which was close to enabled ink on this
surface. It uses the same neutral tint at image alpha 97/255 (approximately 38%).
The alpha is applied to the image, separately from its color filter, to avoid
opaque SRC_ATOP tint blending. The static fallback matches this treatment.

The disabled control remains semantically disabled with no callback. It now also
has a localized XML fallback description as well as its runtime label. Native
receipt/revision/date guards, one-step Undo eligibility and pending/retry behavior
are unchanged. Picker preview composition keys change so refreshed examples can
be republished, subject to the launcher's cache and platform rate limits.

[Google's icon-button defaults](https://developer.android.com/reference/kotlin/androidx/compose/material3/IconButtonDefaults)
distinguish disabled content through alpha; [Android accessibility guidance](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility)
informs complete targets and scalable content. The 2:1 enabled/disabled rendered
ink distinction guard is a project quality threshold, separately from the
enabled-control/surface 3:1 guard; it is not a claim of complete accessibility
certification or a minimum contrast requirement for disabled controls.

## Observed render checks

Two focused production RemoteViews regressions passed before the full workflow.
They inspect full reminder title/time glyphs and every clipping ancestor at
300/360 dp widths, English/Chinese and 100/110/120/150% text. The 200% case asserts
the intentional summary instead of clipped reminder content. Clock preference is
captured/restored around the 09:00 fixture.

Undo checks compare enabled, disabled and inert-preview graphic masks in all eight
appearance pairs at normal/150% text, with matching intrinsic size and pixel
bounds, full/97 alpha, minimum targets, disabled semantics and no disabled action.
The full regression also checks matched graphic centers, at least 2:1 state
distinction and enabled icon/surface contrast of at least 3:1.

Actual native renders were visually inspected across all eight appearance pairs,
including the reported Evening dark combination, and both languages' Today time
previews at normal/increased text sizes. Nonpersonal captures are in the ignored
module `android/build/widget-captures/` directory. These are host renders, not
observations of the user's launcher or vendor fonts on the corrected APK.

No artwork generation, bridge/API capability, schema, backup format or progress
storage changed. The [consolidated device checklist](../device-acceptance.md)
retains signed-phone vendor-font, launcher, text-size and TalkBack observations.
Installation and distribution remain separate actions.

## Final checks and local artifact

`npm run release:prepare -- --json` passed on 17 October 2026 at 17:39 PDT
(`2026-10-18T00:39:14.819Z`). Localization (2,150 EN/ZH messages), maintained
design/preserved references, TypeScript, ESLint, 316 shared tests in 39 files,
97 tooling tests, all 560 native tests in 42 suites with zero failures/errors/
skips, module/app lint and signed release assembly passed. WidgetRenderTest now
contains 19 cases. The focused time/recovery regression also passed after the
measurement scope correction. Final documentation/reference verification and
diff whitespace checks passed separately.

Module/app lint retains 27/20 warnings and zero errors. The old dynamic-label
ContentDescription warning is removed by the localized XML fallback. Existing
frozen R8 gallery and scene master-resolution limitations remain unchanged.

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), ARM64 `arm64-v8a`, min/target SDK 34/36,
bundled JavaScript, nondebuggable, 95,743,155 bytes.

- APK SHA-256: `20102951a7340d3c41cbb1bf5e2d0c4c92aa9cce757bcfd9b787bd940f0ebff7`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Workflow summary: `verification/local/release-summary.json`.
- Retained task summary: `verification/local/widget-time-undo-summary.json`.
- Final design audit: `verification/local/widget-time-undo-design-final.json`.

No installation or distribution accompanied these checks; corrected signed-phone
vendor-font, resizing and TalkBack observations remain unclaimed.
