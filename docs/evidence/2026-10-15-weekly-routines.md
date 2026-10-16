# Weekly routines implementation evidence — 15 October 2026

Scope: owner-approved RW-01/RW-02 implementation on `event-routines`, based on
`11b14f0`. The [product contract](../product.md#android-weekly-routines),
[design contract and research](../design/current/weekly-routines.md), and
[architecture](../architecture.md#weekly-routine-lifecycle-and-durable-progress)
describe the resulting behavior. Task status remains in [backlog](../backlog.md).

## Host results

- `npm run verify`: localization/design checks, TypeScript, ESLint, 35 shared
  test files / 292 tests, and 97 tooling tests passed. The existing unused
  `expectedScreenIds` warning in the frozen R8 gallery remains; no lint errors.
- `npm run verify:android`: 481 native tests passed, including 19 routine tests;
  native Debug lint, app Release lint and Release assembly passed.
- Room schema exports: CE14 and DP8. Legacy migration test builders retain their
  assertions and apply the appended 13→14 / 7→8 migrations. Ordinary records
  default to no routine association and the ordinary delivery profile.
- Portable backup format 5 round-trips plans, effective revisions, dated snapshots,
  exercise checks and corrections. Existing formats 1–4 remain supported. The
  existing privacy/exclusion tests were updated to expect the new format, without
  removing their Calendar/privacy/deletion assertions.
- Local assembly: `com.remilo.app` 0.4.0 (4), `arm64-v8a`, signed with the existing
  configured identity. Output is the ignored local
  `android/app/build/outputs/apk/release/app-release.apk`. No installation,
  distribution, remote publication or physical acceptance accompanies this work.

The first sandboxed tooling run could not create Git's Windows process objects;
the approved rerun passed. Gradle required access to the existing cache. Build
logs retain the existing Android SDK XML-version and Gradle deprecation warnings.
Raw local logs and test artifacts remain under ignored local/build directories.

## Behavioral coverage

The native fixture reproduces the owner's exact 21-exercise week, including
Sunday Rest and no invented weight for Friday's 1-arm row. It is not installation
seed data. Coverage includes independent dates, duplicate/stale actions, explicit
Undo after the final step, every progress/final-step journal boundary, restart,
today's availability after an elapsed prompt, rest exclusion, Skip/Undo, ended-day
corrections and their real timestamps, repeated future-only edits, pause/resume,
mixed query pagination, Trash/Restore/Purge, backup copies, native Calendar guards,
quiet notification privacy/actions/timeout, denied notifications, DST and clock
rewind, Direct Boot closure and a single prompt per date after a rewind.

Ordinary Alarm / Notification / No alert overdue behavior is tested alongside an
ended routine; the pre-existing recurrence, alert-action, privacy and recovery
suite remains intact. No claim of OEM scheduling reliability follows from these
Robolectric tests.

## Actual component review

The opt-in memory-only web adapter rendered the production RN components. All
eight atmosphere/brightness pairs were inspected across English and Simplified
Chinese; authored English exercise names/targets remained unchanged. Reviews
included 360/390 dp narrow layouts, wide layouts, 200% text and reduced motion.

Observed interactions: Done advanced Bird-dog to Front plank and changed 0/4 to
1/4; Previous showed the checked exercise without undoing it; explicit Undo
completion remained available. The existing compact editor retained Title,
Date/Time, Alert, derived Repeat, Routine, List and its persistent Save footer.
The weekly sheet showed Sunday Rest; its day editor selected Rest without
requiring an exercise and returned to the unsaved weekly draft. Exercise edit
exposed name, target, guidance and contextual reorder/removal controls.

This is fixture evidence, not Android IME, TalkBack or signed-phone verification.
The consolidated phone run still needs the complete device matrix, notification
permissions/channel overrides, reboot/unlock/travel, native keyboard and task-based
usability observations defined in [verification](../verification.md).
No approved exercise illustration exists in the current production assets; the
components use authored text/guidance. The Android widget is the next RW-03
milestone and the broader daily digest remains RW-04.
