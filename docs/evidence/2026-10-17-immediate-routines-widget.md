# Immediate routine edits and direct widget completion

Source baseline: `b1df15e`. The owner's 17 October correction supersedes both
tomorrow-effective edits and Resume-only widget navigation. Task status belongs
only in the backlog. No artwork or dependency was added.

## Behavior and native authority

Save appends an immediately effective immutable plan revision and reconciles
today's open snapshot in the same CE transaction. Retain its occurrence/nominal
identity, matching stable-ID checks, intentional Skip and action audit. Added
weekdays become available today; Rest removes actionable Agenda work and cancels
delivery without inventing completion. Extending a completed open day updates
its aggregate. Closed days, including irreversibly ended dates after clock
travel, keep their exact content/photo/revision references. No elapsed or
already-posted prompt is replayed.

A captured EditRoutine journal fences the open day's delivery before the private
commit. Recovery settles the same operation; receipt lookup precedes revision
checks. Time/mode changes update the content-free DP alert at this fence. Ordinary
exercise completion/Undo retains a deliberately Snoozed target. Today's retained
day-started exception can deliver from its archived recurrence segment, subject
to the existing generation/date/expiry/unprompted guards. Pause fences this owned
alert before commit; Trash still fences all family members. Ordinary reminder
paths retain their existing behavior.

The regression suite caught the archived-segment delivery guard rejecting an
edited day's alarm. The correction retains the guard for other segments, adds
the explicit owned-open-day exception and tests locked Alarm/Notification,
Pause and stale callbacks. The failed intermediate run remains local under
`verification/local/widget-immediate-release-final.log`; final evidence must
come from the subsequent verified run.

Agenda timing/repeat presentation and widget progress resolve the same applicable
dated revision. Current authoring/save feedback now explains immediate application
in English and Simplified Chinese. History is a visible routine-screen row and
is absent from shared overflow menus.

CE16/DP9 and portable format 7 remain unchanged. Backup validation retains original
occurrence identity while validating updated time against the recurrence kernel's
gap-forward/earlier-fold resolution. It accepts empty Rest snapshots and retains
removed-step audit references against immutable prior revisions. Legacy readers
for formats 1–6 remain covered; copies retain independent family/progress identity.

## Widget and previews

The single primary Done completes only the displayed exercise through the
existing native descriptor. Advance follows native confirmation. Named Undo
remains available after the final exercise, and uncertain Retry keeps its exact
operation rather than retargeting another step. Compact Focus puts Undo in the
header in place of branding so completion does not force a 200 dp widget into
summary mode. Today retains View Agenda alongside Undo when readable. No permanent
Refresh or compact Next is added. Exercise text opens the exact dated app exercise.

Setup always uses labelled, localized inert sample content with the actual app
appearance, independent of personal titles, empty data or today's Rest outcome.
Save still captures only the real selected configuration. Missing saved selections
never silently retarget. The preview height adapts to scaled text, and the native
host fills its measured bounds. Setup chip colors use current semantic roles.

Generated picker previews offer interactive 280×240 and expanded compositions;
they no longer offer the tiny three-label summary that a launcher can stretch.
Publishing observes Glance 1.2's actual success/rate-limit result and a bounded
refresh cadence for appearance/language/date/composition changes. Android may
retain cached picker pixels. Production still uses exact launcher constraints,
with an intentional small/large-text summary and truthful empty/rest states.

## Design evidence and limits

[Google widget quality](https://developer.android.com/docs/quality-guidelines/widget-quality)
informs readable controls, meaningful empty states and representative previews.
[Google's generated-preview documentation](https://developer.android.com/develop/ui/compose/glance/generated-previews)
explains responsive preview sizes and rate-limited publication. The version-matched
local Glance 1.2 API was inspected for its result constants and preview composer.
[Apple's widget guidance](https://developer.apple.com/design/human-interface-guidelines/widgets)
includes direct task completion; Android conventions and Remilo tokens govern
this implementation. [Hollman et al.](https://formative.jmir.org/2025/1/e59477/)
supports attention to navigation, progress retention and correction, with limited
generalization from its small usability study. These sources do not establish an
ideal button count or that immediate edits improve adherence; those are owner
workflow decisions.

## Observed host checks

The final native suite reports 548 tests in 41 suites, zero failures/errors/skips;
55 RoutineEngineTest and 15 WidgetRenderTest cases. Coverage includes immediate
Saturday availability, reorder/check retention, workout/Rest transitions, completed
day extension, Skip, removed-step audit, journal checkpoints, stale widget actions,
receipt retries, locked delivery, Pause, Snooze, DST and backup round trips.

Actual production RemoteViews were inspected across all eight appearance pairs
and English/Chinese, with compact Done/Undo, expanded Next, curated examples and
narrow/intermediate text-scale cases. Bounds assertions cover action text and all
clipping ancestors. The generated picker path itself is tested with minimum
provider dimensions and 120% text, asserting representative interactive content
instead of private Rest data. Inert preview actions and existing native privacy,
date/revision, query and ordinary reminder regressions remain covered.

Local captures include `verification/local/widget-immediate-review.png` and
the ignored module `build/widget-captures/` directory. These are native host
renders, not launcher or signed-phone observations. Native setup, launcher cache/
resize behavior, real app/widget convergence, TalkBack, keyboard, reboot and alarm
audio remain separate [owner acceptance cases](../device-acceptance.md).

## Final checks and local artifact

`npm run release:prepare -- --json` passed on the final runtime source at
2026-10-17T08:14:50.341Z. Localization (2,140 EN/ZH pairs), maintained design/
preserved references, TypeScript, ESLint, 313 shared tests in 38 files, 97 tooling
tests, all 548 native tests, module/app lint and signed release assembly passed.
Module/app lint retains 27/20 existing warnings and zero errors. The preserved
scene master-resolution limitations and frozen R8 warning remain unchanged.

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), ARM64 `arm64-v8a`, min/target SDK 34/36,
bundled JavaScript, nondebuggable, 95,706,199 bytes.

- APK SHA-256: `9c1eedb103c2ad19c840b9c735f74bc21fb53e2246055823b70e97cdb7d3dfee`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Final log: `verification/local/widget-immediate-release-verified.log`.
- Combined local summary: `verification/local/widget-immediate-summary.json`;
  repository workflow summary: `verification/local/release-summary.json`.

No installation, publication or distribution accompanied these checks. Host
captures/build success do not establish physical-device acceptance.
