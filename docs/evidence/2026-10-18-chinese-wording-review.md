# Simplified Chinese wording review — 18 October 2026

The owner identified 练习 in the exercise builder and requested an app-wide
Chinese review against real Chinese product usage. All 2,226 existing catalog
messages were reviewed in six indexed batches, including plural variants, native
errors/notifications, widget copy, accessibility and recovery. This updates 528
existing messages and adds three complete count/unit labels (2,229 total).
Remaining hardcoded Chinese was inspected: language endonyms, the unknown-history
fallback and the bilingual pre-bootstrap Retry remain intentional.

The [maintained terminology contract](../design/current/localization.md#simplified-chinese-wording-review--owner-correction-18-october-2026)
records first-party usage references from Huawei Health/Calendar, Dida/TickTick,
Apple Reminders and Google Calendar. Individual fitness items use 动作; the
Exercise preset uses 锻炼, while General items remain 步骤. Routine setup/widget
destinations consistently use 日常计划 and 计划进度, distinct from Calendar 日程.
Weekday scope uses 星期 instead of incorrectly implying Monday–Friday 工作日.

Other corrections distinguish marking work unfinished from navigation/Trash
restore; standardize 回收站, settings, direct voice and preview actions; explain
clock gaps/folds naturally; and replace user-facing terminal/native/schema/write
jargon with outcomes and actions. Calendar copy creation uses 添加到日历, distinct
from ongoing 同步. Historical English Calendar templates and all existing typed
arguments remain unchanged, preserving recognition of stored messages. Authored
titles, notes, exercise names, Calendar content, immutable IDs and commands remain
untouched. The four backup help messages also received current English wording
to accurately describe the existing unencrypted photo-inclusive archive.

Calendar bulk import, captured group completion and repeat-interval labels now
use complete localized messages, fixing Chinese opening parentheses paired with
an appended English closing parenthesis. Their counts, submission handlers and
captured operation membership are unchanged. Themes, geometry, assets, CE17/DP9,
portable format 8, scheduling and native mutation ownership are unchanged.

## Render and behavior observations

66 actual-component browser captures cover 32 routine combinations (both presets,
all eight appearance pairs and 100%/200% text at 360/320 dp), 30 main-page cases,
the exercise form, custom-repeat field, captured completion count and Calendar
bulk-import count. Main pages include Agenda, Lists, Completed, Trash, Details,
Settings, Appearance, permissions, backup, Calendar setup/import/recovery,
Activity and diagnostics. One additional English smoke check preserved the saved
Weekly workout input; nested editing preserved Bird-dog. No browser script errors
occurred. Representative renders were inspected, including large Chinese, the
exercise form, full localized parentheses and native widget examples.

Routine Save targets remained at least 56 dp high and within the gutters. The
existing root-navigation invisible text-measurement elements can enlarge the web
document's intrinsic width; viewport captures and actual control bounds were used
instead of mistaking those hidden measurements for visible clipping. These are
isolated React Native Web/native RemoteViews host observations, not phone evidence.

The first native run passed 582 tests and failed the old expected translation for
Start routine (开始训练). Its expectation was updated to 开始计划, retaining every
captured-command-kind and action-separation assertion. The final full run passed
all 583 tests with zero failures, errors or skips. No behavioral test was removed
or weakened.

## Final verification and artifact

`npm run release:prepare -- --json` passed at `2026-10-18T23:33:54.001Z`
(16:33 PDT). Localization verified 2,229 pairs. Design/preserved-reference checks,
TypeScript, ESLint, 327 shared tests in 40 files, 104 tooling tests, 583 native
tests in 43 suites, module/app lint and signed release assembly passed. The frozen
R8 gallery's existing ESLint warning remains. Native lint has zero errors and
29 module/20 app warnings, unchanged from the preceding build.

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), `arm64-v8a`, min/target SDK 34/36,
nondebuggable, bundled JavaScript, 95,876,651 bytes.

- APK SHA-256: `8a3742c96466abec721659e1c77a215bc58aa648e0fb1fb30e78cfa13231ddbf`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Workflow summary: `verification/local/release-summary.json`.
- Retained catalog/render/artifact proof: `verification/local/zh-audit/summary.json`.
- Final workflow log: `verification/local/zh-audit/release-final.log`.
- Private change review: `verification/local/zh-audit/changes.json`.

Bundled source-map contents match the current generated catalog and all three
changed UI call sites. No install or distribution occurred. Signed-phone IME,
TalkBack, OEM-font, launcher and full in-context acceptance remain on the
[consolidated checklist](../device-acceptance.md#chinese-wording-follow-up--18-october-2026).
