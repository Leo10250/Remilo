# TD-04 evidence — native presentation and contracts

Recorded 9 October 2026 from the uncommitted implementation workspace on branch
`theme-update`, based on HEAD `1d62f6b1bba81241120c4f31e600a3d7bbce0ae3`.
The base HEAD is not a committed redesign or APK source identity. Live task status
belongs only in [backlog](../backlog.md). This evidence accompanies [TD-02](redesign-td-02.md)
and the [TD-04 plan](../plans/redesign/td-04-native-presentation.md).

## Consumed artwork and presentation

The checked native interfaces, persistence and presentation were subsequently
committed as `d704c34` on `theme-update`. The shared source sequence and measured
build relationship are recorded in [TD-06](redesign-td-06.md#subsequent-source-commits).

The [current design](../design/current/README.md), [appearance policy](../design/current/appearance-policy.md),
[alarm/Postpone contract](../design/current/screens/alarm-postpone.md),
[architecture](../architecture.md) and [9 October corrections](../design/current/implementation-decisions.md)
govern behavior. A22 (7 October) accepts seven R6 templates and rejects original
plain R6-04; A23 requires corresponding softer atmosphere surfaces. A24 (7 October)
accepts the four themed R6-04 Dark starting templates with the matching shared
background/surface condition, retaining later color/polish review. These records
are [A22/A23](../design/approved-ui-r6-acceptance.json) and
[A24](../design/approved-ui-r6-themed-alarm-acceptance.json). The current owner
implementation instruction supplies production authorization; historical template
records do not establish runtime approval. All eight R3 images govern style.

The [production registry](../design/production-assets/manifest.json) binds actual
approved sources and byte hashes. Native consumes Sunrise/Sky/Evening **v1** and
Night **v2**; superseded Night v1 is not selected.

| Pair | Individual approval |
|---|---|
| Sunrise Light / Dark v1 | [Light](../design/production-assets/approvals/sunrise-light-v1.json), [Dark](../design/production-assets/approvals/sunrise-dark-v1.json) |
| Sky Light / Dark v1 | [Light](../design/production-assets/approvals/sky-light-v1.json), [Dark](../design/production-assets/approvals/sky-dark-v1.json) |
| Evening Light / Dark v1 | [Light](../design/production-assets/approvals/evening-light-v1.json), [Dark](../design/production-assets/approvals/evening-dark-v1.json) |
| Night Light / Dark v2 | [Light](../design/production-assets/approvals/night-light-v2.json), [Dark](../design/production-assets/approvals/night-dark-v2.json) |

Actual masters are 1672×941 PNG against the recorded 2048×1152 source target;
the source resolution requirement is not claimed satisfied. The RN/native copies
are identical opaque lossless 1440×810 WebP derivatives. This records the existing
approved exports, not new source detail or physical runtime acceptance.

[presentation.json](../../assets/atmospheres/presentation.json) and
[presentation.mjs](../../scripts/presentation.mjs) generate the app/native roles,
normal type sizes, spacing, shapes, geometry, asset identities and crop centers.
[AtmosphereTokens.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/presentation/AtmosphereTokens.kt)
supplies canvas/surface/onSurface/onSurfaceVariant/primary/onPrimary/container/
outline plus semantic, disabled, inverse and state aliases. Compose uses these
roles rather than sampling raster pixels or inventing an alarm-only black.
Native normal body/support/label sizes and gutters/corners/action heights consume
generated constants; the single-alarm 28sp title/32sp time hierarchy is deliberate.

The hero crop is source-normalized center `(0.5, 0.500534)` for all eight files.
The compact center is `(0.5, 0.460321)` for Sunrise/Sky/Evening and
`(0.5, 0.430160)` for Night v2. Native uses source-center/clamped pixel alignment,
matching RN rather than interpreting the numbers as overflow alignment. Single
alarms use the 200dp opening budget when space permits; reduced openings/grouped
alarms use the 96dp profile, and art yields first under large text/constrained
height. Identity/count labels sit directly on the quiet left side of the art
rather than an opaque panel. Shared header ink and a translucent fading scrim
protect contrast while retaining the right-hand landmark. The scrim covers the
actual label container, then fades; it is not a filled label/button container.
Actual crop/readability acceptance is still a device/render observation.

## Delivered files and native ownership

| Sources | Delivered contract |
|---|---|
| [AlarmEngine.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/AlarmEngine.kt), [AppearancePolicy.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/core/AppearancePolicy.kt), [OperationalDatabase.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/OperationalDatabase.kt) | DP-safe resolution; persist `resolvedAtmosphere` and actual `resolvedBrightness` with the new session's first member before service dispatch. |
| [AlarmActivity.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmActivity.kt), [AlarmControlsScreen.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmControlsScreen.kt) | Frozen colors/art, single/grouped/loading/progress/retained-error presentation, native refresh/dismissal guards, measured action footer and heading semantics. |
| [AlarmNotifications.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmNotifications.kt) | First-post generation-safe controls and explicit generic public variants in supported Android templates. |
| [ContentDatabase.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/data/ContentDatabase.kt), [schema 5](../../modules/remilo-alarm/android/schemas/com.remilo.alarm.data.ContentDatabase/5.json), [schema 4](../../modules/remilo-alarm/android/schemas/com.remilo.alarm.data.OperationalDatabase/4.json) | CE5/DP4 migrations and retry/privacy boundaries described in TD-02; backup remains version 3. |
| [RemiloAlarmModule.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/RemiloAlarmModule.kt), [bridge TS](../../modules/remilo-alarm/src/RemiloAlarmModule.ts), [types](../../modules/remilo-alarm/src/RemiloAlarm.types.ts) | `scheduleTestAlarm(operationId)`; `overdueOnly` query intersection; atmosphere setting contract. |
| [FormGeometryModule.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/presentation/FormGeometryModule.kt), [FormGeometryPolicy.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/presentation/FormGeometryPolicy.kt), [module registration](../../modules/remilo-alarm/expo-module.config.json), [FormViewport](../../src/ui/form-viewport.tsx) | UI-only actual-window geometry, no engine dependency/content payload; residual IME overlap and same-frame caret/viewport/scroll samples. |
| [AppearancePolicyTest](../../modules/remilo-alarm/android/src/test/java/com/remilo/alarm/core/AppearancePolicyTest.kt), [MigrationTest](../../modules/remilo-alarm/android/src/test/java/com/remilo/alarm/data/MigrationTest.kt), [AlarmEngineTest](../../modules/remilo-alarm/android/src/test/java/com/remilo/alarm/engine/AlarmEngineTest.kt), [FormGeometryPolicyTest](../../modules/remilo-alarm/android/src/test/java/com/remilo/alarm/presentation/FormGeometryPolicyTest.kt), [AtmosphereAssetsTest](../../modules/remilo-alarm/android/src/test/java/com/remilo/alarm/system/AtmosphereAssetsTest.kt) | Actual focused host evidence below. |

Native sessions retain their captured pair through new arrivals, member removal,
refresh, recreation/rotation, clock/zone/System-brightness/preferences changes and
unlock. A new session resolves again. Migrated session fields are nullable; a
surviving active session still becomes Interrupted silently on process recovery,
without resuming playback or inventing a historical scene. The existing first
sound/vibration and five-minute monotonic deadline from confirmed audio startup
remain independent of presentation; arrivals do not extend the deadline.

Private optional member projection contains the CE title/Event range/Due/all-day/
zone/link state only after the unlock guard. Before unlock or a private projection
read failure, native cards use generic Reminder plus the DP operational alert
target/actions. Event/Due are never fabricated from that target. After first
unlock, CE availability still does not authorize public-notification disclosure:
explicit public variants contain generic titles/counts with the same guarded
Stop/Snooze/Stop-all handles. DP contains no private member text or content-derived
scene. Scene decode runs asynchronously off the UI thread; decode failure/OOM
leaves opaque token-backed controls available and does not gate promotion/audio.

Single Stop/Snooze and Stop-all targets remain at least 64dp; grouped member
targets remain at least 56dp, ordinary refresh at least 48dp. Information is
scrollable above a measured sibling footer; when that footer exceeds available
space, one accessible scroller contains both instead of clipping targets. Titles
are complete, time/state is explicit, neutral reminder glyph has no category model,
and identity/member titles carry heading semantics. Ordinary-width grouped member
actions share a row with equal measured heights; larger text/narrower width stacks
them with a 12dp gap. Timing labels use 14sp and values 16sp, with a separate larger
single-alarm time. Retained refresh errors render above the known member cards,
while action uncertainty stays beside footer actions. Progress reserves one scalable
line and announces the full selected-member description. A failed refresh retains
cards/actions and its own retry message; only a confirmed ended snapshot dismisses
the activity. Stop still leaves the reminder unfinished. Custom Postpone/Done stay
in the app workflow.

### Adjacent native corrections

- `overdueOnly` composes with agenda/list/family/search/delivery-problem filters
  before grouping/count/pagination.
- Reopen clears both completed and skipped flags, retaining revision/generation
  fences, Skip history and independent recurrence exception identity. An elapsed
  target becomes Missed silently; it never replays audio. Trash Restore preserves
  skipped state.
- An identified Test alarm uses the ordinary Create receipt. A same-ID retry
  returns the original reminder and alert instant; it cannot create a second test
  or move that instant to a new `now + 15 seconds` value. The app's captured retry
  controller passes that identity through the bridge.
- A new Restore returns structured Rejected only for proven validation before
  mutation. Once a receipt proves commitment, retry checks it before decoding a
  new payload and marks outbox replay as possibly mutating. Replay/storage failure
  remains transport-uncertain so the app retains the same backup/choices/ID. After
  repair, retry acknowledges the same receipt without duplicating restored data.

### Form geometry integration

The observer uses its attached Activity/RN Modal Dialog root's insets/focus; it is
not a MainActivity-only keyboard observer. WindowManager's stable task bounds and
the observed region's actual screen bounds compensate only the overlap left after
adjustResize. The present RN Modal is a full-window Dialog; smaller future dialog
types would need their own stable window-bounds validation.

The bridge emits geometry/state and opaque field IDs, never field text, selection
content, composition content, persistence or logs. Active selection-endpoint line
rectangles and the owning ScrollView viewport/native offset share one frame and
screen coordinate system. Logical caret signatures cancel deliberate parent
scrolling; only focus/caret/selection/internal-scroll/viewport/inset changes request
another reveal. JS reveals the native caret immediately without animated chasing.
The native helper does not consume insets or change text/selection; the shared
FormViewport owns remaining padding/footer/scroll compensation.

## Actual focused command and result

The following command used the repository's configured Java/Gradle environment;
it ran native unit tests and Kotlin compilation, not release assembly/install:

```powershell
node --input-type=module -e 'import {androidTools} from "./scripts/lib/android-tools.mjs"; import {checked,root} from "./scripts/tools.mjs"; const taskTools=androidTools(); await checked(taskTools.java,["-Xmx64m","-Xms64m","-Dorg.gradle.appname=gradlew","-classpath",root+"/android/gradle/wrapper/gradle-wrapper.jar","org.gradle.wrapper.GradleWrapperMain",":remilo-alarm:testDebugUnitTest","--tests","com.remilo.alarm.core.AppearancePolicyTest","--tests","com.remilo.alarm.data.MigrationTest","--tests","com.remilo.alarm.engine.AlarmEngineTest","--tests","com.remilo.alarm.presentation.FormGeometryPolicyTest","--tests","com.remilo.alarm.system.AtmosphereAssetsTest","--console=plain","--no-daemon"],{cwd:root+"/android",env:taskTools.env,stream:true,timeout:900000});'
```

Observed result before the later header/card presentation correction below:
`BUILD SUCCESSFUL in 56s`; 106 actionable tasks, 8 executed and 98
up-to-date. Production/test Kotlin compiled; **89/89 tests passed**, zero failures
or errors. At that run, local XML under
`modules/remilo-alarm/android/build/test-results/testDebugUnitTest/` recorded:

| Suite | Tests | XML timestamp UTC |
|---|---:|---|
| AppearancePolicyTest | 6 | 2026-10-09T08:35:13.948Z |
| MigrationTest | 7 | 2026-10-09T08:35:16.153Z |
| AlarmEngineTest | 72 | 2026-10-09T08:35:18.091Z |
| FormGeometryPolicyTest | 3 | 2026-10-09T08:35:23.266Z |
| AtmosphereAssetsTest | 1 | 2026-10-09T08:35:23.269Z |

This is five filtered suites, not a claim that every native suite or Android lint
ran. The run retained existing stale generation, first/re-triggered notification,
Stop-versus-Done, grouped action/session, process interruption, recurrence and
deadline regressions in AlarmEngineTest. New named regressions cover:

- `credentialCommittedMirrorFailureRetriesTheSameOperationWithoutAnotherRevision`
  and `appearanceWritesNeverChangeReminderTargetsGenerationsOrHistory`.
- `directBootUsesTheSavedManualGlobalPairAndOnlyGenericContent`,
  `nativeSessionFreezesItsPairAcrossChangesArrivalsRemovalAndUnlock` and
  `publicRingingNotificationRedactsPrivateContentButKeepsGenerationSafeControls`.
- `identifiedTestAlarmRetriesKeepTheOriginalReminderAndInstant`,
  `reopeningSkippedOccurrenceClearsSkippedAndPreservesRecordedSkipAndSiblingIdentity`
  and the overdue filter intersection.
- Invalid Restore choices/zone precommit rejection without receipt/content/
  operational changes, and `committedRestoreRetryNeverReportsPrecommitRejection`:
  malformed retry payload acknowledges the prior receipt; a validation-shaped
  replay fault remains a transport error; repair retries the exact receipt without
  duplicates.

AppearancePolicyTest consumes the same **23-vector** boundary/manual/DST/zone JSON
as the app's earlier **26/26** focused appearance run; see [TD-02](redesign-td-02.md#actual-host-evidence).
FormGeometryPolicyTest covers full/partial/no actual resize, hidden IME, upward/
downward manual parent-scroll invariance and real caret/focus/selection/internal
scroll/viewport/overlap changes. AtmosphereAssetsTest validates all eight native
decode dimensions; it does not render Compose. Scoped `git diff --check --
modules/remilo-alarm` passed. Existing unchecked-cast/Gradle deprecation and SDK
metadata warnings appeared; no build failure remained in this focused run.

## Substantive failures corrected

The final audit found Restore's receipt-retry replay could throw a validation-like
exception while `mutationStarted` was false, incorrectly releasing a captured
operation as precommit Rejected after an existing commit. Receipt lookup now
precedes payload decoding and replay crosses the mutation boundary; the focused
fault regression proves transport uncertainty and same-ID recovery.

Earlier native geometry compilation required nonnullable event values with
explicit `hasCaret`/`hasViewport` flags. Geometry also mixed viewport coordinate
bases and reacted to parent scrolling as a new caret, risking repeated reveal
and stale JS offsets. The integrated observer now emits same-frame screen rects/
native offset and a logical change gate; pure resize/scroll regressions passed.
The initial crop alignment treated source focal coordinates as overflow bias;
native source-center/clamp math now matches the canonical RN crop contract.
These code/host corrections are not claims of rendered or real-IME acceptance.

### Later reference-guided presentation correction

After the focused run, the owner rejected opaque top text/button treatment in
the app review and requested reference-guided transparent headers. Native code
was revised after directly viewing these accepted R6 files:

- [R6-01 single Sky Light](../design/remilo-r6-alarm-postpone/01-single-alarm-sky-light.png).
- [R6-02 grouped Night Dark](../design/remilo-r6-alarm-postpone/02-multiple-alarms-night-dark.png).
- [R6-03 retained refresh error Evening Dark](../design/remilo-r6-alarm-postpone/03-refresh-failure-evening-dark.png).

All three place the Remilo identity on artwork without an opaque label panel;
grouped examples add a count line on the art. The working native source now
follows that anatomy, increases the undersized identity to canonical 24sp/32sp
line height, uses 16sp/24sp count text and consumes the shared header ink/scrim
contract. Opaque reading cards/footer remain intact. The grouped glyph/title and
label/value rows are compact, ordinary member actions are paired with a large-text/
narrow-width stacked fallback, and the refresh-error banner moves above retained
member cards as R6-03 shows. Native engine/storage/action semantics were unchanged
by this presentation revision.

The 89-test record above predates these later Compose/Activity rendering edits.
The shared generated header contract now provides `headerInk`, `headerScrim` and
`headerScrimAlpha=0.54`: white scrim/dark ink for Sunrise/Sky/Evening Light,
black scrim/white ink for the remaining pairs including Night Light. Native uses
the same contract, protecting the actual label container before the fade;
`typeDisplay=32` supplies the large single-alarm time.

After this correction, the same repository Java/Gradle wrapper invocation above
was run with only these task/filter arguments:

```text
:remilo-alarm:testDebugUnitTest --tests com.remilo.alarm.presentation.FormGeometryPolicyTest --console=plain --no-daemon
```

Observed result: `BUILD SUCCESSFUL in 38s`, production/test Kotlin compilation
passed, **3/3 geometry policy tests** passed with zero failures/errors. The XML
timestamp is `2026-10-09T09:00:02.468Z`. This later run validates compilation of
the revised Compose/Activity source; it does not rerun or replace the earlier
89-test engine/privacy evidence, render Compose, assemble/install an APK or observe
a real IME. At that focused run, the integrator's consolidated release was still
unobserved. The final integrated host result is recorded below; actual rendering/
physical checks remain separate.

## Unobserved device cases

No APK was built/installed by this focused invocation and no new phone/emulator
UI observations were made. The redesign's identified signed build still needs the
consolidated [owner run](../device-acceptance.md) and applicable
[verification gates](../verification.md), including:

- All eight Light/Dark atmosphere pairs on actual native single/grouped/loading/
  action-progress/retained-refresh-error surfaces, full and compact crops, missing
  art fallback, complete long titles, authentic Event/Due/all-day ranges, 200%
  English/Chinese text, narrow/landscape/short windows, target measurements and
  TalkBack heading/action/state order and announcements.
- Clock/zone/System-brightness/preferences changes during a real ringing session,
  arrivals/removals/first-member Stop, recreation/rotation/unlock retaining the
  pair/deadline, followed by a genuinely new session resolving the new choice.
- Cold/closed/offline/no-JS delivery, another foreground app, screen-off/locked
  presentation, reboot before first unlock, generic native content with usable
  Stop/Snooze, later CE/history reconciliation and generic public notifications
  even when credential storage is available after first unlock.
- Initial and re-triggered Android notification actions, grouped Stop-all versus
  later sessions, stale handles/callbacks, exact/notification/channel/full-screen
  restrictions and restored permissions. Supported OS template presentation and
  final Classic notification branding remain actual runtime checks.
- Physical audio onset/stop/quick Snooze, nondefault Snooze duration, co-arrival
  first sound, five-minute cutoff without extension, idle/screen-off, audio focus/
  routing interruptions, Active Apps Stop/process death, Force stop limitations,
  storage/asset failure and retained refresh uncertainty. Host service-intent
  assertions do not prove audibility or foreground promotion timing on a phone.
- Signed in-place CE4/DP3 upgrade retaining real content/brightness/current targets,
  nullable legacy session interruption without playback, mirror repair/fallback
  and storage failure recovery; real Test/Restore lost-acknowledgement workflows
  retain their ID/input and avoid duplicates; elapsed skipped-Reopen remains silent.
- Real Android Title/lower Notes/numeric editing at 360×800 and 200% English/
  Chinese, taller/emoji keyboards, multiline selection/composition, actual Modal
  Dialog insets, first-tap Save, Back, orientation/constrained-window changes,
  footer clearance and deliberate scrolling without caret pullback. Pure policy
  tests prove arithmetic/signatures, not actual OS IME event behavior.

Earlier observations on older builds do not establish any of these redesign
results. No physical approval or distribution authority is inferred from asset
approval, a template, compilation or host tests.

## Final integrated host verification — 9 October 2026

The results below retain the earlier 17:01 UTC integrated pass. The final 17:18
UTC pass and current APK identity are recorded in [TD-06](redesign-td-06.md);
the local summary was overwritten by that latest result. The native XML remains
the same successful 120-test run, reused as up-to-date in the later preparation.

The earlier sequential `npm run release:prepare` exited successfully. At that
snapshot, local `verification/local/release-summary.json` recorded
`ok: true` at `2026-10-09T17:01:30.626Z`; the
private `verification/local/ui-redesign/release-prepare-final.log` records
design/evidence checks, typecheck, app lint, **115 shared tests in 17 files**,
**75 tooling tests**, native unit tests, module/app lint and release assembly
passing. Gradle finished `BUILD SUCCESSFUL in 2m 34s` with 1032 actionable tasks
(103 executed, 929 up-to-date).

Final native XML at
`modules/remilo-alarm/android/build/test-results/testDebugUnitTest` records:

| Suite | Tests |
|---|---:|
| AgendaTest | 3 |
| AlarmPolicyTest | 4 |
| AppearancePolicyTest | 6 |
| CivilTimeTest | 4 |
| RecurrenceTest | 5 |
| SessionPresentationTest | 3 |
| BackupCodecTest | 4 |
| MigrationTest | 7 |
| AlarmEngineTest | 72 |
| TimeZoneCatalogTest | 1 |
| FormGeometryPolicyTest | 3 |
| AtmosphereAssetsTest | 1 |
| SoundPreviewControllerTest | 7 |
| **Total — 13 suites** | **120** |

All suites have **zero failures, errors and skips**, with timestamps from
`2026-10-09T16:59:28.397Z` to `2026-10-09T16:59:39.602Z`. Final XML explicitly
includes the frozen session/Direct Boot/public-notification privacy, same-ID
appearance mirror repair, identified Test receipt, skipped Reopen and precommit/
committed Restore retry cases listed above. The same **23-vector** atmosphere
fixture is consumed by both app/native policy tests. These final results rerun
the earlier focused contracts against the later transparent header/card source.

The first integrated attempt exposed an actual Compose lint error: the header
used `BoxWithConstraints` without reading its constraints. It was replaced with
`Box`; the two responsive containers that use height/width constraints remain.
No suppression or baseline was added. Focused `:remilo-alarm:compileDebugKotlin`
then passed in 33 seconds (64 tasks, 3 executed/61 up-to-date). The final combined
run above subsequently passed native lint and release compilation/assembly.

The inspected APK is `android/app/build/outputs/apk/release/app-release.apk`,
SHA-256 `8b92576fdc7cf8b7269a8b5bd65205ea5394feeecc911577348d5316517cef93`.
The summary identifies `com.remilo.app`, version `0.4.0`/code 4, arm64-v8a,
minimum SDK 34/target SDK 36, non-debuggable, signed and bundled JavaScript. It
was built from the uncommitted `theme-update` workspace based on the HEAD recorded
above; that commit alone does not identify the redesign build inputs. The old
`verification/local/build-receipt.json` is dated 5 October and does not attest this
APK. The summary records `installed: false`, `published: false` and
`physicalObservations: pending`.

### Final bulk/native contract audit

The owner's later bulk-selection instruction is implemented in
[bulk-actions.ts](../../src/domain/bulk-actions.ts),
[bulk-actions.tsx](../../src/ui/bulk-actions.tsx) and
[records.tsx](../../src/app/records.tsx). It captures eligible unique loaded
occurrences, command kind, revision and a separate UUID for each child before
issuing ordinary native commands sequentially. Native CE receipts validate kind/
occurrence before revision checks, remain retained, and repair pending work on
same-ID retry. A lost reply pauses at that exact child; acknowledged prefixes
remain retained and structured Rejected results are counted separately before
continuing. Six shared controller cases cover capture, eligibility, duplicate
presses, lost postcommit replies, partial rejection/delivery outcomes and Restore.
The flow does not promise atomicity or add permanent deletion.

Reopen clears completed/skipped, Delete retains them, and Restore clears deleted
while retaining previous work state; elapsed targets remain silent and recurring
Reopen/Restore retain exception behavior. Accepted Blocked/Pending scheduling
results count as acknowledged content changes with separate delivery warnings.
`nextAlertMs` can retain a historical target, and deleting completed content can
return delivery state Completed with `deleted=true`; collection meaning must use
content flags and actual delivery presentation. Final single Restore feedback
uses that presentation rather than interpreting non-null target as scheduling.
The final read-only audit found no critical native/bulk correctness issue.

This integrated preparation supplies host/build evidence only. It does not approve
the final page composition, demonstrate physical IME/TalkBack/crop behavior,
prove phone audio/reliability, install or distribute. The unobserved device cases
above remain owed. This handoff changes no task status; [backlog](../backlog.md)
is the sole live source.
