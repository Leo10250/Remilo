# Resume-only widget

Source baseline: `3602e11`. The owner explicitly requested a Resume-only compact
widget, removal of Done and permanent Refresh, conditional recovery and Next only
when expanded. This supersedes the earlier Resume + Done preference. Task status
belongs only in the backlog.

## Resulting behavior

Healthy compact Focus contains the current neutral Classic/date header, title,
native progress, current exercise/prescription and primary Resume. It has no Done,
Refresh, Retry, Next or reserved footer strip. Completion/correction is inside
Remilo; its native commits update the existing widget projection. The 56 dp Resume
keeps the exact routine/date/exercise link and current theme/corner treatment.

Shared WidgetSizing supplies a 300×200 compact Focus preview, or 240 dp when
selected-routine Today/recovery requires a footer. Actual launcher dp/font scale
still determines summary fallback. Today retains its Agenda link/count and one
complete compact reminder row; expanded layouts retain upcoming exercises/native
Today results. Next is confined to expanded presentation and omitted when larger
text requires less secondary information. Static and generated picker previews
match the new action set; no artwork, dependency or localization change was added.

Only known recovery state exposes controls: failed load/conflict Refresh, a
previously captured uncertain operation's exact Retry, or eligible named Undo for
an earlier widget completion. The current composition never creates a Done
PendingIntent, even if a legacy native projection contains a completion token.
Existing descriptor/receipt compatibility remains for previously cached actions;
their date/configuration/revision guards are unchanged. Tiny failed widgets can
refresh through the whole surface with a full accessible error description.

A successful explicit refresh acknowledges only that instance's saved notice,
through AlarmEngine's serialized worker. Otherwise a stale conflict notice could
keep Refresh permanently visible after Done is removed. A failed read does not
acknowledge it. Pending operations, receipts, progress and configuration remain
intact; background refreshes do not acknowledge notices. No schema, backup or
scheduling change is introduced.

The maintained [widget contract](../design/current/home-screen-widget.md) records
the current anatomy. [Google widget guidance](https://developer.android.com/design/ui/mobile/guides/widgets)
and [Apple widget guidance](https://developer.apple.com/design/human-interface-guidelines/widgets)
support focused, glanceable presentation. The [preceding research record](2026-10-16-widget-preview-cleanup.md#design-evidence)
retains modern papers and their limits; none establishes an ideal button count.
Resume-only is the owner's workflow decision, not a claimed universal finding.

## Verification observations

The initial targeted 12-test WidgetRenderTest pass succeeded before the final
native feedback-acknowledgement change. Actual compact/expanded, conflict and
empty captures were inspected. The compact Focus render is 200 dp high and has
no empty footer; expanded presentation labels the next exercise once.
Logs are local under `verification/local/widget-resume-render.log`.

Current checks add explicit absence assertions for Done/permanent Refresh/compact
Next, production/inert-preview parity, all eight appearance pairs and both
languages, current sizing, failed-load/conflict recovery, legacy uncertain Retry
and named Undo. Native feedback tests verify that explicit refresh preserves the
session/configuration and an uncertain action's identity. Native convergence,
date guards and ordinary reminders retain their existing behavioral coverage.

Signed-phone configuration/launcher/TalkBack, real app-to-widget updates, stale
cached views, offline/reboot/privacy and end-to-end acceptance remain separate
[owner cases](../device-acceptance.md). No installation or distribution accompanies
this source change.

## Final checks and build

`npm run release:prepare -- --json` passed on the final runtime source. Checks:
2,140 EN/ZH catalog pairs, design/preserved-reference audit, TypeScript, ESLint,
313 shared tests in 38 files, 97 tooling tests and 539 native tests in 41 suites,
with zero native failures/errors/skips. WidgetRenderTest ran 13 cases, including
the final acknowledgement regression. Module/app lint has zero errors and the
existing 27/20 warnings. The frozen R8 unused-variable warning and preserved
scene master-resolution limitations remain unchanged.

Actual RemoteViews assertions cover both modes in all eight appearance pairs and
both languages, plus compact/expanded/recovery/empty/large-text cases. The 16-image
compact Focus review sheet was inspected, along with compact/expanded and error
captures. Authored fixture names intentionally remain English in the language
matrix; app-owned labels and separate example projections are localized. Retained
private renders: `verification/local/widget-resume/`.

Final Gradle completion: 4m 37s, 91 executed tasks / 941 up-to-date. Log:
`verification/local/widget-resume-release.log`; combined summary:
`verification/local/widget-resume-summary.json`.

Build at `2026-10-17T03:38:43.884Z` (16 October locally):

- `com.remilo.app`, version 0.4.0 (4), ARM64, min SDK 34 / target SDK 36.
- Bundled JavaScript, not debuggable, existing beta signing identity.
- APK `android/app/build/outputs/apk/release/app-release.apk`, 95,690,143 bytes.
- SHA-256 `5c60d597910d17cc988a58ce9e27db70c202d8ea5215cf12fb5c611c23c0f774`.
- Signer SHA-256 `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

No runtime source changed after assembly. Post-documentation design verification
and `git diff --check` also passed. No installation or distribution was performed;
the consolidated signed-phone gates remain unobserved for this artifact.
