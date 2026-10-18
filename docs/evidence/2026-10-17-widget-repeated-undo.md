# Repeated widget Undo

Source baseline: `1252c6c`. The owner requested repeated reversals after accidental
Done actions, replacing the earlier single consumable Undo rule. The compact
unfilled control remains to the left of Done with the same geometry, themes,
disabled opacity, pending guard and confirmation treatment.
Task status belongs only in the backlog.

## Native ownership and compatibility

CE widget preferences now retain an ordered `undoHistory` of completion identities
for that instance's current configuration and dated occurrence. No exercise checks
are copied. Snapshot reconciliation verifies each target against the native checked
step and its latest change ID; entries overwritten by another surface or removed
from the plan are discarded. Edits retaining an exercise ID preserve its eligible
completion. Unrelated app and other-widget changes remain intact.

Each Undo descriptor captures the current native revision and its `undoOf`
completion token. A confirmed reversal removes exactly that record, making the
previous eligible completion available. Progress and the first unfinished exercise
come from the native session after confirmation. Replayed receipts never consume
another record or recreate an undone completion. Uncertain commands keep their
exact descriptor and block new actions until resolved. Native action guards,
receipts, mutation serialization and presentation timers remain unchanged.
Pending projections now supply the captured exercise name and action direction
to feedback: Retry of an Undo acknowledges a reversal, rather than incorrectly
describing it as a new completion. It still executes only the original descriptor.

History survives process restart and final completion. Retain every eligible
record through the existing 100-exercise session limit, plus the existing bounded
56 stale descriptors for receipt recovery. The old installed `last` record upgrades
to a single history entry; cached legacy Undo and committed pending recovery remain
compatible. Earlier completions that the old version did not retain are not invented.

Reconfiguration and widget-ID restore discard the history. Date/session changes,
closed/deleted content and unavailable/trashed projections discard invalid entries;
clock rollback cannot revive an ended day's Undo. Skip suspends controls until
undone. Pause follows native eligibility for an already open day.

No bridge, database schema, portable backup format, localization, artwork, color,
layout or dependency changed. Widget action identities remain local CE state
excluded from portable backup.

## Regression scope

Native integration coverage exercises repeated reversal after final completion
and restart, duplicate Done/Undo receipts, Done after Undo, independent widget/app
completions, app recompletion of a target, stale Undo rejection, immediate plan
removal/rename/reorder and all 100 exercises with identical names. Native capture,
fence and commit interruptions verify exact recovery without consuming the next
record. Installed legacy state and cached/committed legacy Undo are covered.
Skip/Undo Skip, Pause, Trash/Restore, midnight and clock rollback retain native
eligibility. Existing configuration/widget-ID restore and locked-host tests remain.

A coordinator regression injects a storage failure before native capture, recreates
the process owner and checks exact Retry, disabled controls while pending, receipt
replay and preservation of the earlier completion. Presentation regressions check
exact Retry action/name feedback. Existing production RemoteViews tests continue
to cover the fixed Undo target, named accessibility, enabled/disabled
graphic/opacity, progress colors/segments and scaled-text bounds.

Signed-phone launcher timing, repeated-tap feedback, resizing and TalkBack require
the [consolidated owner acceptance run](../device-acceptance.md). Host checks do not
establish these observations. Installation and distribution are separate actions.

## Final checks and local artifact

`npm run release:prepare -- --json` passed on 17 October 2026 at 18:23 PDT
(`2026-10-18T01:23:34.819Z`). Localization (2,150 EN/ZH messages), maintained design
and preserved references, TypeScript, ESLint, 316 shared tests in 39 files,
97 tooling tests, all 571 native tests in 42 suites, module/app lint and signed
release assembly passed. Native results contain zero failures, errors or skips.
The routine, widget presentation and widget render suites contain 64, 9 and 20
cases respectively. Module/app lint retains 27/20 existing warnings with zero
errors; the frozen R8 gallery warning remains unchanged.

The final run includes accurate Retry direction/name feedback. An earlier full
run passed 570 native tests before that additional presentation regression.
The initial focused run exposed a new Skip fixture carrying an exercise ID;
the fixture now uses the actual day-level command shape and preserves the same
assertions for suspension and retained checks. No existing test was weakened.

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), ARM64 `arm64-v8a`, min/target SDK 34/36,
bundled JavaScript, nondebuggable, 95,759,539 bytes.

- APK SHA-256: `95a690a6940cf218289114b487b6c5da290f5ffe70c64a7cb8fe4c9212318989`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Workflow summary: `verification/local/release-summary.json`.
- Retained task summary: `verification/local/widget-repeated-undo-summary.json`.
- Final design audit: `verification/local/widget-repeated-undo-design-final.json`.

No installation or distribution accompanied these checks. The corrected
signed-phone repeated-Undo, launcher and TalkBack cases remain unobserved.
