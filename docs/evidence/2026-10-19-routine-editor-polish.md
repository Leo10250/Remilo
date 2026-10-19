# Routine editor polish — 19 October 2026

The owner approved centered weekday labels, a dedicated Alert row and matching
numeric/unit fields. The implementation follows the maintained
[routine creation contract](../design/current/routine-creation.md), retaining all
four atmospheres, independent brightness and the existing component language.

## Behavior and boundaries

- Weekday labels are centered independently of their 4 dp scheduling dots.
  Empty days contain no invisible dot/gap. All seven controls use a uniform
  minimum 64 dp height, enlarged with text metrics and outline clearance. Existing
  seven-column/centered four-three layouts, identities and accessible counts stay.
- Connected Date and time/Alert rows open separate themed draft sheets. Date/time
  retains native pickers and saved-start restrictions. Alert owns the existing
  three modes, sound/vibration, channel recovery and routine-wide scope help.
  Done merges only owned fields; cancellation/dirty Back and focus return retain
  the parent. No alert retains the clock time; parent Save still persists changes.
- Both unit selectors use external Unit/单位 labels, with specific accessible
  names/sheet titles. Outlines, surface, typography, padding and height match the
  adjacent numeric fields. Choice sheets return focus to their own trigger.
- The shared builder/direct-edit form requests integer keyboards for counts and
  decimal keyboards for time/weight. Whole-edit syntax guards retain blank/partial
  strings, normalize one decimal comma and reject invalid pastes without stripping
  them into another number. Existing positive/safe/range validation still applies.
  Free text, legacy targets, defaults and cancellation remain unchanged.

The version-matched [React Native 0.86 TextInput documentation](https://reactnative.dev/docs/0.86/textinput)
was checked for input-mode/keyboard precedence and controlled input behavior.
There are no bridge, engine, database or backup changes; CE17/DP9/format9 remain.

## Host observations

- Focused target/builder tests passed: 18 tests. The full shared run passed 334
  tests in 41 files, including the new numeric syntax/partial/paste coverage.
- Localization verifies 2,306 English/Chinese messages. Design checks, TypeScript,
  ESLint and all 105 controlled tooling fixtures passed. The existing reference
  gallery unused-variable warning and preserved-master-resolution findings remain.
- Actual production-component review passed 32 atmosphere/brightness/language/
  text-size combinations, with 21 additional empty/breakpoint layouts. All eight
  appearance pairs, English/Chinese, 100%/200% text and 320–575 dp widths were
  covered. There were no browser script errors. Label-center deviation was under
  0.008 dp and the minimum measured label/dot gap was 6 dp. Numeric/picker heights,
  padding and surfaces matched in every measured pair. Representative captures
  were inspected, including Chinese fields, large-text Alert and empty routines.
- Browser interaction assertions passed Alert Apply/Cancel/focus, retained time
  under No alert, vibration retention, numeric rejection/commas/validation, unit
  choices, parent Save/reopen, blocked notification warnings and direct row
  Save/reopen. Native picker/keyboard operation is not established by these checks.
- Native reports contain 589 passing tests in 44 suites, with zero failures,
  errors or skips. Generated release source-map content matches all six changed
  runtime files: components, target fields, builder, timing, target domain and
  localized catalog.

The initial release-preparation attempt stopped on Windows sandbox restrictions
in four local Git-clone tooling fixtures. The same workflow outside the sandbox
passed those fixtures without source/test changes. Browser request-cleanup and
development-server cache/navigation issues were corrected in private review
tooling; the final component run completed successfully.

Private logs, captures and measured results remain ignored under
`verification/local/routine-polish/`, `routine-polish-release.log`,
`routine-polish-native.json` and `routine-polish-sourcemap.json`.

## Signed local artifact

`npm run release:prepare -- --json` completed successfully at
`2026-10-19T17:04:42.055Z` (10:04 PDT). The complete workflow includes shared,
design/localization/tooling checks, native tests, module/app lint and signed
release assembly. Gradle reported BUILD SUCCESSFUL in 9m 51s. Final report:
`verification/local/release-summary.json`.

APK: `android/app/build/outputs/apk/release/app-release.apk`, `com.remilo.app`,
0.4.0 (4), arm64-v8a, min/target SDK 34/36, signed, nondebuggable and bundled
JavaScript; 95,964,711 bytes.

- APK SHA-256: `160cf759276f3f8cd5ba9664b96dfee183b12528d0588b5387280e4ba8a4978a`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

No installation, distribution, push or publishing accompanied this work.

Browser/host results do not close signed-phone IME, native picker, TalkBack,
OEM-font or physical alarm observations. Those remain on the
[consolidated checklist](../device-acceptance.md#routine-editor-polish-follow-up--19-october-2026).
Installation, distribution and publishing are separate actions.
