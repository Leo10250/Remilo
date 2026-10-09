# TD-02 evidence — global appearance

Recorded 9 October 2026 from the uncommitted implementation workspace on branch
`theme-update`, based on HEAD `1d62f6b1bba81241120c4f31e600a3d7bbce0ae3`.
That HEAD identifies the base; it does not identify a committed redesign or a built
APK. This handoff records implemented interfaces and observed host checks. Live
task status belongs only in [backlog](../backlog.md).

## Scope and consumed contracts

The checked native persistence/interfaces were subsequently committed as
`d704c34`, and shared appearance/controller foundations as `9d73dd8`, on
`theme-update`. See [TD-06](redesign-td-06.md#subsequent-source-commits) for the
complete source sequence and build relationship.

The [TD-02 plan](../plans/redesign/td-02-global-appearance.md), [current design](../design/current/README.md),
[appearance policy](../design/current/appearance-policy.md), [architecture](../architecture.md)
and [9 October implementation decisions](../design/current/implementation-decisions.md)
govern this implementation. A36, dated 8 October, fixes the Automatic default and
local periods; the current implementation instruction authorizes production work.
Original R8 held-clock/manual-only pixels remain references, not the resolver.
All eight R3 images govern visual identity; production scenes and exact revisions
are recorded in [TD-04's asset evidence](redesign-td-04.md#consumed-artwork-and-presentation).

One global `automatic | sunrise | sky | evening | night` selection is independent
of `system | light | dark` brightness. Automatic resolves the current device-local
hour: Sunrise [06:00,10:00), Sky [10:00,17:00), Evening [17:00,21:00), Night
[21:00,06:00). Manual choices persist across clock/zone changes. Unknown/missing
selection resolves Automatic without overwriting the original stored value.
System brightness resolves the actual device Light/Dark configuration. Reminder
timing/content does not select a scene.

The companion app integration uses the existing serialized Preferences controller,
the five-choice Appearance dropdown and foreground-only resolution. It reconciles
on next boundary, foreground return and native change events; transient workflow
holds coalesce automatic scene changes, while explicit selection updates the
preview. This adds no cosmetic alarm, closed-app worker or network dependency.
Host policy tests do not demonstrate actual device-clock broadcasts, editing or
IME behavior; those observations remain below.

## Delivered interfaces and storage

| Source | Delivered contract |
|---|---|
| [AppearancePolicy.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/core/AppearancePolicy.kt), [appearance.ts](../../src/domain/appearance.ts) | Native/app four-period resolution, manual and unknown-value rules; native independently resolves brightness. |
| [ContentDatabase.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/ContentDatabase.kt), [schema 5](../../modules/remilo-alarm/android/schemas/com.remilo.alarm.data.ContentDatabase/5.json) | CE 4→5 adds `settings.atmosphere TEXT NOT NULL DEFAULT 'automatic'`; existing brightness, revisions, setting receipt and content survive. |
| [OperationalDatabase.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/OperationalDatabase.kt), [schema 4](../../modules/remilo-alarm/android/schemas/com.remilo.alarm.data.OperationalDatabase/4.json) | DP 3→4 adds only `appearance_preferences(id, atmosphere, theme)` and nullable migrated session capture fields. Existing targets, generations, sound and deadlines survive. |
| [AlarmEngine.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/AlarmEngine.kt) | Serialized CE-authoritative settings write, DP mirror repair before acknowledgement, normalized reads, native session resolution/capture. |
| [RemiloAlarm.types.ts](../../modules/remilo-alarm/src/RemiloAlarm.types.ts), [module bridge](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/RemiloAlarmModule.kt) | `AtmosphereSelection`, required `AppSettings.atmosphere`; existing `Settings` command gains an optional atmosphere patch. |
| [Appearance page](../../src/app/appearance.tsx), [theme provider](../../src/ui/theme.tsx), [preferences controller](../../src/domain/preferences.ts) | Independent brightness controls, five-value dropdown, retained serialized autosave/retry, workflow holds without remounting the editing state. |
| [shared fixture](../../verification/fixtures/appearance-boundaries.json), [app tests](../../src/domain/appearance.test.ts), [native tests](../../modules/remilo-alarm/android/src/test/java/com/remilo/alarm/core/AppearancePolicyTest.kt) | One 23-vector contract consumed by both resolvers. |

The native settings operation commits CE first, then updates the allowlisted DP
mirror and any explicit Snooze preference projection in one DP transaction. A
mirror failure is unacknowledged. Retrying the same `lastOperationId` repairs DP
and acknowledges without another CE revision. Init/recovery attempts mirror repair
when credential storage is available; presentation repair failure does not become
a prerequisite for scheduling recovery. Appearance-only changes leave reminder
targets, generations, eligibility, history, current audio and session capture
unchanged.

DP appearance contains enum preferences only: no title, notes, list/category,
credentials, image paths or arbitrary settings/content blob. Before unlock the
resolver reads DP preferences and bundled roles/assets. An absent/invalid mirror
uses Automatic/System. A malformed captured pair uses a fixed Night/Dark emergency
presentation. Private content stays in CE; backup remains format 3 and excludes
global settings/session appearance. Old schema files are retained alongside the
new exported schemas; no destructive migration or old palette migration was added.

## Actual host evidence

The focused native invocation is reproduced in [TD-04](redesign-td-04.md#actual-focused-command-and-result).
It finished successfully in 56 seconds, compiling the changed production/test
Kotlin and running **89 tests, zero failures/errors**. Test XML timestamps begin
`2026-10-09T08:35:13.948Z`. It predates the later native header/card presentation
correction recorded in TD-04; consolidated compilation/render/release evidence
for that newer source remains separate. TD-04 records the subsequent scoped
production/test compilation and 3/3 geometry policy run; no rendering/device result
is inferred from it.

| Suite | Tests | Relevant evidence |
|---|---:|---|
| AppearancePolicyTest | 6 | Inclusive edges/midnight, all four manual choices, brightness independence, unknown/missing defaults, DST gap/fold/travel, captured emergency pair and shared 23 vectors. |
| MigrationTest | 7 | Historical upgrades plus CE4→5 brightness/revision/receipt preservation and DP3→4 preserved delivery/deadline with no invented legacy capture; appearance table columns are exactly the allowlist. |
| AlarmEngineTest | 72 | Cosmetic immutability; injected post-CE mirror write failure followed by same-ID repair without a second revision; unknown raw preference preservation; Direct Boot generic content/public actions and frozen new-session pair. Existing scheduling/action/recovery regressions also ran. |
| FormGeometryPolicyTest | 3 | Actual-resize residual overlap and parent-scroll invariance; details and runtime limits are in TD-04. |
| AtmosphereAssetsTest | 1 | Bundled native decode bounds for all eight scene files; this is not a rendered screenshot test. |

The shared fixture has **23 vectors**, not 23 native test methods: midnight and
both sides of each 06/10/17/21 boundary, missing/unknown selection, four manual
overrides, DST gap/fold and one instant in Los Angeles/New York/Shanghai. An
earlier focused `npx vitest run src/domain/appearance.test.ts` invocation passed
**26 tests**: those 23 vectors plus manual normalization, nested workflow hold/
explicit-change coalescing and next-boundary planning. The final Kotlin suite
consumed the same JSON fixture. A scoped `git diff --check -- modules/remilo-alarm`
also passed. These results are scoped host evidence, not the full integrated
release or proof that an actual draft/caret survives a device transition.

## Failures corrected and evidence limits

Mirror fault injection deliberately demonstrated CE revision 2 committed while DP
still held the prior preferences. The native retry repairs the mirror before
returning Applied and retains revision 2. Missing/unknown display defaults are
normalized without silently replacing the raw CE value. Migration fixtures were
corrected to recreate exported optional indexes so Room validates the real
historical schema rather than an incomplete test database. The observed final
focused run passed with these stronger checks.

The final native audit also corrected committed Restore retry classification,
recorded in TD-04. Captured Test alarm/Restore identity, skipped Reopen and form
geometry are shared native interfaces delivered during this integration, not new
appearance-driven alarm behavior.

No native scene screenshot, signed update, phone installation or physical
observation was produced by this focused work. The following remain unobserved
on the redesign's specifically identified signed build:

- Automatic switching at every real boundary, manual clock jumps, timezone/DST
  changes, foreground return after long absence and manual-choice persistence;
  System/Light/Dark changes independently of scene selection.
- Dropdown/selection accessibility and autosave/retry with actual touch/TalkBack;
  nested editors, pickers, confirmations and acknowledgement-uncertain operations
  retain composing text, caret, focus, scroll and captured IDs during a transition.
- Reduced motion and all eight role/scene pairs in actual RN/Compose rendering,
  including large text, landscape/constrained windows and preserved landmarks.
- In-place signed CE4/DP3 upgrade with retained real data/brightness and safe
  first-unlock mirror initialization; actual reboot/Direct Boot fallback, native
  appearance failure and a later unlock without recoloring an active session.
- The full native action/audio/privacy and IME cases listed in
  [TD-04](redesign-td-04.md#unobserved-device-cases) and the consolidated
  [owner run](../device-acceptance.md).

## Final integrated host verification — 9 October 2026

The results below retain the earlier 17:01 UTC integrated pass. The final 17:18
UTC pass and current APK identity are recorded in [TD-06](redesign-td-06.md);
the local summary was overwritten by that latest result. The native XML remains
the same successful 120-test run, reused as up-to-date in the later preparation.

The earlier sequential `npm run release:prepare` exited successfully. At that
snapshot, local `verification/local/release-summary.json` recorded
`ok: true` and completion at `2026-10-09T17:01:30.626Z`; the
private `verification/local/ui-redesign/release-prepare-final.log` records
design/evidence checks, typecheck, app lint, **115 shared tests in 17 files**,
**75 tooling tests**, native unit tests, module/app lint and release assembly
passing. Gradle finished `BUILD SUCCESSFUL in 2m 34s` with 1032 actionable tasks
(103 executed, 929 up-to-date).

The final native XML contains **120 tests in 13 suites, zero failures/errors/
skips**. It reruns AppearancePolicyTest **6**, MigrationTest **7**, AlarmEngineTest
**72**, FormGeometryPolicyTest **3** and AtmosphereAssetsTest **1** against the
final integrated source. The appearance, migration and engine suite timestamps
are respectively `2026-10-09T16:59:28.584Z`, `16:59:30.979Z` and `16:59:33.272Z`.
The shared fixture still contains **23 vectors**. Final XML includes the
credential-committed mirror-failure/same-ID repair, raw unknown preference,
cosmetic immutability, frozen session/Direct Boot/public privacy, captured Test
and Restore retry regressions. This supersedes the earlier focused evidence's
compilation scope, while retaining its recorded history.

The then-inspected release APK was
`android/app/build/outputs/apk/release/app-release.apk`, SHA-256
`8b92576fdc7cf8b7269a8b5bd65205ea5394feeecc911577348d5316517cef93`.
The summary identifies `com.remilo.app`, version `0.4.0`/code 4, arm64-v8a,
minimum SDK 34/target SDK 36, non-debuggable, signed and bundled JavaScript. It
was built from the uncommitted `theme-update` workspace based on the HEAD recorded
above; that base commit alone does not identify these build inputs. The older
`verification/local/build-receipt.json` is dated 5 October and is not evidence for
this APK. [TD-04](redesign-td-04.md#final-integrated-host-verification--9-october-2026)
records the complete native suite breakdown and final presentation correction.

This preparation did not install or publish the APK. The summary explicitly
retains `physicalObservations: pending`; the unobserved cases above and in TD-04
remain physical acceptance work. A passing build does not approve a page
composition or establish phone alarm reliability. Live task status remains solely
in [backlog](../backlog.md).
