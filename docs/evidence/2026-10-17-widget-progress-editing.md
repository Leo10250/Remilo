# Widget progress, action feedback and direct exercise editing

Source baseline: `deb1216dbef378b545c4a7fa4aaa79696efc298b`. This follows the
owner-approved 17 October plan and the later preference to place Undo before
Done. Task status belongs only in the live backlog. No artwork, dependency,
bridge capability, database migration or portable backup version was added.

## Behavior and ownership

Widget progress now uses the same primary/container roles as app accent/soft.
The previous outline track reduced distinction. Measured fill/track ratios are
5.24/7.80 for Sunrise light/dark, 5.41/6.51 Sky, 6.42/6.97 Evening and 6.76/6.63
Night. The automated guard requires 3:1, alongside numeric progress; this is a
project quality threshold, not complete accessibility certification.

One AndroidRemoteViews leaf hosts a horizontal native weighted segment layout.
Exactly one segment represents each of 1–12 exercises, with 4 dp height, 2 dp
seams and no final margin. It avoids Glance Row's ten-child truncation when
separators are separate children. Zero omits the bar; larger totals use continuous
fill. Tests inspect actual rendered pixels, counts, margins and equal widths,
including seven segments/four filled for 4/7. Static XML fallback colors derive
from canonical Sky light/dark tokens; generated examples retain resolved app
appearance and use 300×240/440 sizes.

The current exercise has a separate original ordinal. Unfilled Undo precedes the
trailing filled Done, separated by 8 dp, with 48/56 dp targets. The disabled Undo
slot remains visible without a mutation listener. Final completion hides Done
without moving Undo into its slot; the outcome may wrap to remain readable.
Compact interaction requires 300×200 dp at normal text, scaled width budgets and
existing Today/recovery height allowances. Summary remains the fallback when
content cannot fit. Next is expanded-only; healthy views have no Refresh.

WidgetPresentation keeps process-only action tickets and overlays. Submission
guards local duplicates immediately; Saving appears after 250 ms. After native
confirmation and fresh projections, a reserved check slot shows a named result
for 1.5 seconds while the next valid Done is usable. Only the originating widget
gets this acknowledgment. Configuration/date/session revisions fence overlays;
older timers cannot clear newer actions. Replayed receipts suppress repeated
success feedback. No JavaScript timer, polling or engine-worker delay is used.
Process death discards feedback only. Native receipts/descriptors retain exact
Retry and one-step widget Undo, including after final completion.

Exercise rows contain sibling selection and pencil + Edit controls. One tap Edit
captures routine/date/weekday/stable ID and loads the latest definition; it never
selects or scrolls Focus. The shared exercise form/photo chooser has one Save,
immediate-apply wording and the existing limits/examples. Save clones the loaded
plan and replaces only the exact ID/day using EditRoutine with the captured plan
revision and operation ID. Concurrent plan edits retain the draft for explicit
Reload; uncertain replies reuse the same command. Draft photo leases stay held
through recovery. Parent selection/scroll remain intact and close restores focus
to the initiating row if present. Today/future unended rows expose Edit; closed
history retains checkmark correction and frozen content. Native reconciliation
still owns matching checks, historical snapshots and midnight.

## Design evidence and limits

[Google widget quality](https://developer.android.com/docs/quality-guidelines/widget-quality)
informs readable controls, complete targets, representative previews and fresh
content. [Apple toolbar guidance](https://developer.apple.com/design/human-interface-guidelines/toolbars)
supports keeping the prominent primary action trailing, but is not an Android
widget experiment. [Gmail](https://support.google.com/mail/answer/2819488) and
[Todoist](https://www.todoist.com/help/articles/complete-a-task-with-a-recurring-date-dmI6SVqdP)
use contextual secondary Undo; they do not establish universal adjacent ordering.
The chosen Undo-before-Done placement is an explicit layout judgment.

[Ge et al., 2024](https://www.sciencedirect.com/science/article/abs/pii/S1071581924000417)
reports effects of response/loading delay on perceived fluency. It informs prompt
acknowledgment, not our exact timing constants or Undo order. The existing small
fitness-app studies support understandable navigation/progress correction, not
a universally optimal control arrangement.

## Observed review and remaining device observations

Actual production RemoteViews were inspected in all eight appearance pairs and
both languages, including compact Done/Undo, seven-segment progress, native
pending/confirmation/final outcomes, intermediate text and 200% summary fallback.
Captures are nonpersonal fixtures under the ignored module
`android/build/widget-captures/` directory. Action bounds checks examine complete
text and clipping ancestors; enabled Undo has at least a 48 dp target. A new test
caught the XML-only disabled flag not reaching the rendered state; an explicit
RemoteViews setEnabled(false) fixes the semantic state without attaching an
action. The focused regression then passed. The final completion review also
caught truncated outcome wording, now covered by a complete-label assertion.

The isolated RN fixture server started, but the in-app browser could not reach
its localhost address. No interactive RN visual review is claimed. Signed-phone
row editing, keyboard/focus return, Photo Picker, TalkBack, launcher timing,
resizing/cache behavior, perceived feedback and app/widget convergence remain
separate [owner acceptance cases](../device-acceptance.md). Host renders do not
close those gates or establish physical alarm reliability.

## Final host checks and local artifact

`npm run release:prepare -- --json` completed successfully at
2026-10-17T20:40:17.143Z. Results: 2,150 EN/ZH messages, maintained design/preserved
references, TypeScript, ESLint, 316 shared tests in 39 files, 97 tooling tests,
558 native tests in 42 suites with zero failures/errors/skips, module/app lint
and signed release assembly. Native coverage includes 17 WidgetRenderTest,
8 WidgetPresentationTest and the existing 55 RoutineEngineTest cases. The earlier
full native run's single disabled-state failure was corrected before this final
run; its focused regression passed too. The final minor row pressed-state style
was additionally checked by ESLint and TypeScript and included in the release
bundle. After the final documentation update, `node scripts/verify-design.mjs`
also passed with no findings; its retained report is
`verification/local/widget-progress-editing-design-final.json`.

Module/app lint reports zero errors and 28/20 warnings. The module's additional
ContentDescription warning concerns the inert Undo ImageButton whose localized
description is supplied through RemoteViews before display and checked in render
tests. Existing warnings and preserved scene master-resolution limitations remain;
the frozen R8 gallery warning was not changed.

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), ARM64 `arm64-v8a`, min/target SDK 34/36,
bundled JavaScript, nondebuggable, 95,742,723 bytes.

- APK SHA-256: `e803193ebd0917f0249513c45e1e448e7b834356bab815e9132163fb5e6c49af`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Repository workflow summary: `verification/local/release-summary.json`.
- Retained task summary: `verification/local/widget-progress-editing-summary.json`.

No installation, publication or distribution accompanied preparation. Device
observations remain distinct from these host results.
