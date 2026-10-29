# Compact widget actions aligned with the Next line

Source baseline: `85f9e49`. The owner selected **Bottom of Next line** from the
comparison and supplied its screenshot. This updates compact Focus composition
while retaining current Remilo tokens, the authored name, full weekday, optional
prescription and native Done/repeated Undo ownership. Task status belongs only
in the backlog.

## Composition and regression scope

Healthy compact Routine and Today share a left column containing the current
exercise/prescription in a region of at least 56 scaled dp (growing for native
font metrics), then a 2 dp gap and a supporting Next line. The Next band uses
native StaticLayout fallback-font metrics and padding across all session names,
with a floor of 20 scaled dp. Measurement requires no View or Looper.
The complete 56 dp action group aligns with that band's bottom; its 48 dp
Undo target remains centered beside Done. Next retains end ellipsis and its
complete accessible label. Its band remains reserved on the last exercise and
through eligible final Undo to avoid moving the controls. Empty prescriptions
retain the current-text region's height.

Today retains its separate full Agenda footer below Focus.
Shared size calculations account for both regions; undersized hosts still use
summary. Expanded lists, recovery, terminal navigation, native mutations,
receipts, repeated Undo, feedback and scheduling are unchanged. The static XML
fallback follows the same grouping and the generated-preview key advances.
No theme, artwork, localization catalog, database, backup or bridge changed.

Production RemoteViews regressions check bottom-band alignment, shared action
centerlines, full controls and text, no-prescription/last/final stability, separate
Agenda bounds, English/Chinese, all eight appearances and scaled-text behavior.
Static XML, inert preview and existing repeated-Undo/recovery regressions remain.
Phone font, launcher resizing/update and TalkBack observations stay on the
[consolidated checklist](../device-acceptance.md); host renders cannot supply them.

## Final checks and local artifact

`npm run release:prepare -- --json` passed at 23:47 PDT on 17 October 2026
(`2026-10-18T06:47:19.442Z`). Localization (2,150 EN/ZH messages), maintained design
and preserved references, TypeScript, ESLint, 316 shared tests in 39 files,
97 tooling tests, all 575 native tests in 42 suites, module/app lint and signed
release assembly passed. Native results contain zero failures, errors or skips.
The production widget render suite contains 24 cases.

Focused checks first exposed the compact Today height budget and Chinese
fallback-font clipping at 150%. Measurements were corrected while retaining the
full glyph and ancestor-bound assertions. All four focused checks then passed,
followed by the full workflow. Visual review covered the eight appearance pairs,
English/Chinese, the no-prescription reference, 150% text, last exercise and final
Undo. These are host renders of production RemoteViews, not phone observations.

Module/app lint reports 29/20 warnings with zero errors. Two additional static
preview advisories concern baseline measurement optimization and combining the
Undo image with Done text. They do not identify a failing rendered bound;
separate Undo/Done views intentionally mirror production controls. The frozen
R8 gallery warning and prior lint findings remain.

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), ARM64 `arm64-v8a`, min/target SDK 34/36,
bundled JavaScript, nondebuggable, 95,759,687 bytes.

- APK SHA-256: `38ea8f1850d1c761a329633b8442deea40550e2d0372c7899f14a39ae1af1c4d`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Workflow summary: `verification/local/release-summary.json`.
- Retained task summary: `verification/local/widget-bottom-actions-summary.json`.
- Final design audit: `verification/local/widget-bottom-design-final.json`.

No installation or distribution accompanied these checks. Signed-phone font,
launcher resizing/update and TalkBack observations remain pending.
