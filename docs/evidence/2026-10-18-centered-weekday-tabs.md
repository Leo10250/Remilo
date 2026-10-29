# Centered partial weekday row — 18 October 2026

The owner approved centering Friday–Sunday below Monday–Thursday when the weekday
selector needs two rows. The production component retains explicit non-wrapping
rows, equal cell widths, existing gaps, order, selection/dots and 48 dp targets.
Seven days still fill one row when space permits. No placeholder control remains.

A partial row uses a centered percentage-width wrapper and a half-gap correction
inside it. The three cells therefore keep the full row's cell width and spacing.
Percentage layout also resizes both rows together without waiting for a second
JavaScript measurement of each cell. This is the approved composition refinement;
no new scheduling, persistence, native command or routine-edit behavior is added.

Actual production component checks passed 84 layouts across 18 widths from
320–720 dp, English/Chinese, 100%/200% text, capture rechecks and all eight appearance
pairs. Assertions cover seven or four/three row grouping, equal cell widths,
unchanged 4 dp fallback gaps, symmetric lower-row insets, complete targets,
page bounds, seven accessible tabs and selected-day navigation. There were no
browser script errors. At a 320 dp viewport the tabs were 69 dp wide and the lower
row had equal 36.5 dp left/right insets. Representative renders were inspected.

`npm run release:prepare -- --json` passed at `2026-10-19T06:27:03.122Z`
(23:27 PDT on 18 October). Localization/design, TypeScript, ESLint, 333 shared tests
and 105 tooling tests passed. Unchanged native test/lint tasks were up to date;
the passing reports retain 589 tests in 44 suites with zero failures/errors/skips.
Existing warnings/preserved-master resolution limitations remain unchanged. Signed
assembly passed, and final bundle source-map content matched the routine builder.

Private evidence remains under `verification/local/`: `centered-weekdays/`,
`centered-weekdays-release.log`, `centered-weekdays-summary.json` and
`release-summary.json`. These captures establish host layout evidence; signed-phone
font/rotation/TalkBack observations remain on the
[consolidated checklist](../device-acceptance.md#day-tabs-and-structured-targets-follow-up--18-october-2026).

APK: `android/app/build/outputs/apk/release/app-release.apk`, `com.remilo.app`,
0.4.0 (4), arm64-v8a, min/target SDK 34/36, signed, nondebuggable and bundled
JavaScript; 95,959,723 bytes.

- APK SHA-256: `6d2caacca01199e002337f763d22d3cecc79779d601797e806050899775948cf`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

No installation, distribution or publishing accompanied this change.
