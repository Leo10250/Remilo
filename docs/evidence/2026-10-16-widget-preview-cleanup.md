# Widget preview, empty states and compact hierarchy

Source baseline: `4159a15`. The owner supplied five current phone captures and a
preferred clean reference. Those captures demonstrate the reported layout, not
the installed APK's source identity. Task status belongs only in the backlog.

## Causes and changes

Setup previously returned before building a preview when Routine Focus had no
selection. It also discarded preview-render exceptions. WidgetSetup now selects
the first available routine only for an unselected Focus draft, including mode
switching. An existing selection remains unchanged even if unavailable. A newly
allocated widget ID no longer overwrites the routine-context setup defaults with
an unsaved default configuration. Cancel never commits these draft choices.

When no usable content exists, setup shows localized, labelled example content
through the production composition. A no-routine Focus draft still cannot Save;
Today can Save with no routine or reminders. Examples remain process-only data,
with no persisted plan, reminder, progress or command descriptor. The real empty
widget shows its empty message, short explanation and View Agenda. Setup has
visible loading and failed-render feedback with retry. Its preview host measures
independently of whether RemoteViews exist, and its child explicitly fills the
measured width/height. Preview controls are inert and the native host is hidden
from accessibility in favor of a descriptive Compose preview label.

The compact layout keeps one reading surface, neutral Classic mark/date, title,
numeric/bar progress and one exercise beside Resume. Done is a separate text
action; only Resume is filled. Footer labels have intrinsic text height centered
in measured action boxes, instead of fill-height TextViews. Footer space sits
outside the bounded list region. Compact Today without a routine renders one
complete reminder row and an accurate pre-limit Agenda count, rather than a
second obscured row. Expanded collections retain native order and scrolling.

Rest day appears once, with No exercises scheduled today and neutral View routine,
without Resume or Done. Completed/skipped/ended states use native outcomes. Pause
with an existing open session still receives its native Ready/InProgress projection
and preserves completion eligibility. Missing selections retain explicit recovery.

Title/progress/exercise spacing is 12/16 dp. Actions preserve 56/48 dp targets,
current 16 dp button corners, shared atmosphere/brightness roles and existing
14/16/18/22 sp hierarchy. Production uses Glance Exact sizing and switches to
summary when actual dp/font scale cannot fit controls. No artwork, dependency,
storage schema, native progress, action identity or scheduling authority changed.
The Android picker example uses localized nonpersonal data and the current date.

## Design evidence

- [Google widget quality](https://developer.android.com/docs/quality-guidelines/widget-quality)
  requires intentional empty states, accurate previews, functional uncropped
  content, manual refresh where appropriate and minimum 48 dp targets. Its
  [sizing guidance](https://developer.android.com/design/ui/mobile/guides/widgets/sizing)
  treats grid dimensions as starting points, with tested breakpoints and optional
  content adjusted to available dimensions.
- [Apple widget guidance](https://developer.apple.com/design/human-interface-guidelines/widgets?changes=__7&language=objc)
  favors simple relevant ideas and essential information at a glance; both sparse
  and overly dense presentation can reduce usefulness. The public page's body
  required JavaScript in this research session; current indexed official excerpts
  supported those principles. Android remains the implementation authority.
- [Hollman et al., 2025](https://formative.jmir.org/2025/1/e59477/) used workshops
  and a two-week pilot with 14 inactive adults. Reported text burden, text that did
  not fit, hard-to-find tracking and unsaved progress support concise content,
  retained native progress and explicit corrections. This was not a widget-layout
  comparison or evidence of adherence effects for Remilo.
- [While et al., CHI 2024](https://arxiv.org/abs/2403.12343) studied glanceable
  smartwatch charts in older adults and found age-related differences, especially
  at 75+. It motivates readability checks and explicit numerical information,
  not a claim that this phone-widget arrangement is optimal.
- [Yerrakalva et al., 2025](https://www.nature.com/articles/s41746-025-01785-x)
  found an association between downloading Active 10's home-screen widget and a
  smaller later decline in brisk walking. The observational analysis does not
  establish widget causality or select Remilo's visual layout.

## Actual host observations

The first focused native render run caught an ellipsized View routine label in
the 300 dp Rest layout. The corrected action has enough measured width and uses
neutral text treatment. The subsequent 11-test WidgetRenderTest run passed.
Assertions inspect transformed text, glyph baselines, text width/ellipsis and all
clipping ancestors for Agenda/Resume/Done/View routine/Undo labels. They cover
Today with/without Focus, Rest, empty content, 300/360 dp widths, native counts
beyond the displayed limit and the setup selection/example rules.

Actual production RemoteViews captures cover eight atmosphere/brightness pairs,
English/Chinese, compact/expanded and enlarged-text summary behavior. The compact
16-image review sheet was inspected, along with example, rest, empty and enlarged
text captures. Authored fixture titles/exercises remain English in the language
matrix intentionally; localized example projections separately verify Chinese
sample content. No browser or mockup screenshot substitutes for these views.

Private captures are under `modules/remilo-alarm/android/build/widget-captures/`;
retained review copies are under `verification/local/widget-clean/`. Focused logs:
`verification/local/widget-clean-render.log` (initial failure) and
`verification/local/widget-clean-render-fixed.log` (corrected pass).

Signed-phone native setup, launcher pinning/resizing, visual accessibility,
TalkBack, stale/date-bound actions and offline end-to-end observations remain
separate [owner acceptance cases](../device-acceptance.md). No installation or
distribution accompanies this source change.

## Final verification and artifact

`npm run release:prepare -- --json` passed on the final source after the enlarged
text icon and failed-data-load feedback corrections. It verified 2,140 EN/ZH
catalog pairs, current design/preserved-reference rules, TypeScript and ESLint,
313 shared tests in 38 files, 97 tooling tests and 537 native tests in 41 suites
(zero failures/errors/skips). WidgetRenderTest's 11 tests ran again. Module/app
lint has zero errors and the existing 27/20 warnings. The frozen R8 unused-variable
warning and approved scene master-resolution limitations remain unchanged.

The final Gradle run completed in 5m 18s (76 executed tasks, 956 up-to-date).
Logs: `verification/local/widget-clean-final-release.log`; combined artifact and
check summary: `verification/local/widget-clean-summary.json`. The preceding full
pass is retained separately in `widget-clean-release.log`; it is not the final
artifact after the two small presentation corrections.

Final signed build at `2026-10-17T02:26:33.071Z` (16 October locally):

- Package `com.remilo.app`, version 0.4.0 (4), ARM64, min SDK 34 / target 36.
- Bundled JavaScript, not debuggable, existing beta signing identity.
- APK `android/app/build/outputs/apk/release/app-release.apk`, 95,690,271 bytes.
- SHA-256 `43cf96121d2788ef1d78ee403ae70c7824198aa87e639a9834f1ba9560c68be7`.
- Signer SHA-256 `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

Final enlarged-text captures confirm the normal 20 dp Refresh glyph within its
larger target. Current-theme compact captures and empty/rest/example captures
were retained under `verification/local/widget-clean/`. No runtime source changed
after final assembly. Post-documentation design checks and `git diff --check`
also passed. Native configuration/launcher/TalkBack and end-to-end physical cases
remain unobserved; this build has not been installed, distributed or published.
