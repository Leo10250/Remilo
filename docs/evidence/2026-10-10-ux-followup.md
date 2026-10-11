# UX follow-up verification — 10 October 2026

## Delivered behavior

The owner-approved UX-21–28 follow-up preserves the alarm-first editor, optional
Calendar event range, artwork, four destinations and native timing authority.
Custom repeat previews lead with mode-specific alert/scheduled dates and relevant
skip-date support. Recurring-edit scope identifies the original authored occurrence
and retains the native nominal boundary. Save confirmation uses the captured
operation and definitive native result; unknown replies retain one exact retry.
Title has a quiet Required cue and blank Save remains disabled. Root navigation
uses measured full-label fit and a Go to sheet. A genuinely empty, unconstrained
All Agenda has one direct Create action instead of its floating +.

The approved read-only clock method/event observes Android's clock preference and
locale independently of reminder mutations. Explicit formatting options reach app
text, pickers and native alarm controls. Failed reads retain the last observation;
late reads cannot replace newer observations or outlive their owner. No schema,
backup, command, recurrence-boundary, eligibility or overdue-policy change is made.

## Actual checks

Final application source: `f788be7dabab648f15eb4d5536e3e2426ec968cb`.
The checkout was clean at this revision throughout final Android verification.
Subsequent evidence, acceptance-plan and backlog edits do not change the APK.

| Command | Actual result |
|---|---|
| `npm run verify` | Passed TypeScript, ESLint, design audit, **215 source tests in 27 files** and **82 controlled tooling tests**; completed 2026-10-11 06:13:13 UTC. |
| `npm run verify:design` | Passed separately; completed 2026-10-11 06:13:41 UTC. Preserved approved master-resolution limitations remain reported. |
| `npm run verify:android -- --json` | Passed native unit-test task, module/app lint and signed bundled ARM64 release assembly; final build completed **2026-10-11T06:15:43.859Z**. Gradle: **31 executed, 1001 up-to-date** tasks. |

Native tests actually executed in this session's preceding integration run at
`ac62a77`: **216 tests in 21 suites**, zero failures/errors/skips, with reports
written 2026-10-11 06:09:27 UTC. Final verification reused these reports as
UP-TO-DATE after the frontend-only confirmed-repeat-target correction. Its lint
tasks and release bundle/assembly were rerun. The preceding integration assembly
also passed (82 executed, 950 up-to-date); its APK is superseded by the final one.

ESLint retains one existing unused-variable warning in the frozen R8 gallery
generator; no lint errors. Gradle retains its existing deprecation warning.
Design verification preserves the approved 1672×941 masters and reports that the
requested 2048×1152 resolution remains unmet; no artwork was changed.

Meaningful new domain/controller coverage includes schedule-only repeat identity,
rule-specific explanations and preset/endings classification; captured save kinds,
explicit eligible targets versus populated unconfirmed/terminal targets, partial
results and fresh mode-specific access routing; clock overrides/Chinese locale,
midnight/noon/23:59, zones/DST, complete spoken dates and unchanged minute clocks;
failed/late/foreground observation; measured navigation fit boundaries; and genuine
empty-query eligibility. Existing operation retry, recurrence, scope, Undo,
navigation, timing, restore and scheduling checks remain intact.

## Signed artifact

- File: `android/app/build/outputs/apk/release/app-release.apk`.
- SHA-256: `347ca1beac47fcb6ecf0ee48917d31939422f67762626003f5b681acd63b819e`.
- Existing signer SHA-256:
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Package `com.remilo.app`, version **0.4.0**, code **4**, min SDK **34**, target
  SDK **36**, ARM64, non-debuggable, bundled JavaScript, signed release.

No installation, launch, merge, APK distribution or public release was performed.

## Isolated production-component review

The repository's memory-only fixture adapter does not exercise Android scheduling,
permissions, IME, TalkBack or audible delivery. Private captures/logs remain under
ignored `verification/local/ux-followup/` and `verification/local/ux-followup-*.log`.

- Captured Empty Agenda, editor and custom-repeat sheets in all eight manual
  atmosphere/color-mode combinations at **360×800**, **100% and 200% text**.
  Captured the Go to sheet in all eight pairs at 200%. Required labels, wrapping,
  selected choices, connected surfaces and persistent repeat/Save footer geometry
  were inspected. The empty state has one Create action and no floating +.
- Additional **720×360 landscape**, long English/Chinese content, 200-character
  Title, reduced motion, explicit English 12/24-hour and Chinese clock-locale cases
  were reviewed. Wide layouts showed the ordinary four full navigation labels;
  narrow layouts used the compact control when the measured labels did not fit.
  Repeat Apply/Cancel remained reachable in the short landscape viewport.
- Blank Title did not prevent current custom-repeat dates from resolving. Alarm,
  Notification and No alert previews exposed their appropriate headings and full
  dates. A monthly 31 rule showed its relevant explanation and skipped November
  in the synthetic preview; ordinary daily rules had no skip-date paragraph.
  Cancel retained Does not repeat in the editor.
- The 200% recurring-edit sheet showed title plus Original alarm with a full date
  above the three plain-language scope choices. Closing it retained the reminder.
- The final lost-reply fixture showed one Save not confirmed message and Retry
  save, with Title, mode, timing, Repeat and List frozen. Retrying produced exactly
  one reminder and one Alarm set confirmation with View and Dismiss actions.

Some initial web captures include unresolved SymbolView glyphs before the web
symbol font settled. They support text/layout observations, **not glyph-conformance
claims**. Later editor, navigation-sheet, scope and confirmation captures showed
resolved glyphs. Unhydrated/loading captures are excluded from passing evidence.
The eight-pair matrix is not a complete cross-product of every recovery/rule state
and orientation. Browser text scaling is a fixture approximation; nonlinear Android
font scaling and keyboard-visible geometry require the signed-device observations.
The preview server was stopped and the temporary tab/viewport override removed.

## Remaining device acceptance

[U32–U35](../device-acceptance.md#ux-follow-up--u32u35-pending) remain pending:
repeat/scope and postponed identity; required Title, confirmation/recovery and same
operation retry; system clock/locale observation, picker/native-text agreement and
unchanged stored timing; large-text navigation, TalkBack/focus/rotation/guards and
empty-state creation. Existing U27–U31 keyboard/permissions/audio observations are
also unclaimed. No host or browser result establishes physical alarm reliability.
The Calendar load-view issue remains deferred.
