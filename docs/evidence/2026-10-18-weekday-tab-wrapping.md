# Weekday tab wrapping correction — 18 October 2026

The owner's phone screenshot showed Monday–Saturday followed by a stranded Sunday.
The previous strip combined fractional tab widths with automatic flex wrapping;
the earlier bounds checks did not assert row composition. The corrected production
component uses explicit non-wrapping row groups and equal flex cells. At least
348 dp of content space supports seven 48 dp targets with six 2 dp gaps; narrower
space or enlarged text uses four/three cells with 4 dp gaps. An invisible fourth
slot shares the real cells' border/padding budget, preserving equal column widths.
It is excluded from accessibility. Selected/disabled aliases preserve the same
state semantics in the native and web presentations.

Colors, type, corner treatment, selection outline, dots, editing and native data
ownership are unchanged. Current design, verification and phone acceptance guidance
now explicitly reject six/one row grouping.

## Observed checks

Actual production component geometry passed 84 layout checks: 18 widths from
320–720 dp in English/Chinese at 100%/200% text, four capture rechecks, and empty
routine checks in all eight appearance pairs. Row counts, non-wrapping parents,
equal cell widths, 48 dp targets, page bounds and selected-day navigation passed.
There were no browser script errors. Twelve successful captures were produced;
representative normal/narrow, enlarged-text and Chinese captures were inspected.
The 460 dp/1.25-density capture is 575 pixels wide, matching the supplied image's
proportions without claiming its device configuration was measured.

At normal text, observed grouping was four/three at 320 and 379 dp viewport widths,
and seven at 380 and 460 dp. The 380 dp viewport has 348 dp content width and
exactly 48 dp cells. At 460 dp the cells measured approximately 59.43 dp.

`npm run release:prepare -- --json` passed at `2026-10-19T05:30:41.150Z`
(22:30 PDT on 18 October). Localization/design, TypeScript, ESLint, 333 shared tests
and 105 tooling tests passed. Unchanged native test/lint tasks were up to date;
the passing reports retain 589 tests in 44 suites, zero failures/errors/skips,
and zero module/app lint errors. Existing lint warnings and preserved-master
resolution limitations remain unchanged. Signed assembly passed, and the final
bundle source map matched the corrected routine builder source.

Private evidence: `verification/local/weekday-wrap/summary.json`,
`weekday-wrap-release.log`, `weekday-wrap-summary.json` and `release-summary.json`.
Browser evidence establishes layout behavior, while the signed-phone rotation,
font, TalkBack and launcher observations remain on the
[consolidated checklist](../device-acceptance.md#day-tabs-and-structured-targets-follow-up--18-october-2026).

## Local artifact

`android/app/build/outputs/apk/release/app-release.apk`: `com.remilo.app`,
0.4.0 (4), arm64-v8a, min/target SDK 34/36, signed, nondebuggable and bundled
JavaScript; 95,959,599 bytes.

- APK SHA-256: `416af9a382b6733dfe7da7a5fa5aa4cdfa9a047792f42dc17cc8392ffa303080`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

No installation, distribution or publishing accompanied this correction.
