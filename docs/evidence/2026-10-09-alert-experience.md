# Alert experience and shared reminder cards

9 October 2026 · branch `beta-fixes` · production source revision
`f772647eac203c898ee8c65bb82fef8a75f831eb`.

## Implemented behavior

The owner's [alert experience contract](../design/current/alert-experience.md)
is implemented through the existing serialized native engine and shared UI.

- Original authored alert determines Alarm/Notification urgency. Timed No alert
  uses When; all-day No alert uses the next civil midnight in its resolved zone.
  Native projections, filters, counts and ordering share the strict unfinished
  predicate before pagination. Snooze/Postpone retain original urgency. No alert
  recurrence enumeration uses event start while retaining hidden alert offsets,
  nominal identities and retained unfinished occurrences.
- CompleteDelivery and captured DoneAll commit protected terminal receipts before
  playback termination and private reconciliation. SnoozeAll durably binds its
  displayed membership, generations, duration and common target. Crash recovery
  preserves that snapshot and reports per-member scheduling outcomes. Legacy
  Stop/StopAll remain compatible. DP migrates 5→6; CE stays 5 and backup stays 3.
- App/native/notification controls use Done and the captured current quick Snooze
  duration. Notification-only delivery stays independent of alarm audio/activity.
  PendingIntent identities include the action purpose and captured operational
  scope. Unknown replies retain the exact command across refresh/recreation.
- The editor shows three connected inline Alert choices with checked semantics,
  stacking at large fonts. Shared ReminderRow uses the same surface, keylines,
  typography and borderless More target across active and terminal states.
  Terminal browsing has no work-completion controls or empty control placeholder;
  selection checkboxes, menus, Details and collection operations remain available.
- Browsing prioritizes Ringing/relative Overdue and consequential scheduling
  problems without routine duplicate delivery badges. Details/Activity retain
  delivery diagnostics and actual completion timestamps. Timed No alert browsing
  uses device-local dates; terminal schedules and all-day civil dates retain their
  authored-zone meaning.

Final review also repaired single Snooze/Postpone receipt retries that could
claim success while their unchanged target remained Blocked/Pending, and bounded
root-navigation text so large-font labels can wrap within their own targets.

## Completed host checks

| Check | Actual result |
|---|---|
| Design/asset/reference audit | Passed; no findings; accepted pixels and provenance preserved |
| TypeScript | Passed |
| ESLint | Zero errors; one existing unused-variable warning in the retained R8 gallery |
| Shared tests | 51 files, 367 tests passed |
| Controlled Node tooling tests | 77 passed |
| Native unit tests | 18 suites, 172 tests, zero failures/errors/skips |
| Native module lint and app release lint | Passed |
| Signed bundled ARM64 release assembly and APK inspection | Passed |

These shared and native totals were observed during final sequential preparation
after the production source commits. `npm run release:prepare -- --json` completed
at **2026-10-09 22:01:25.394 UTC**. Native XML was read from
`modules/remilo-alarm/android/build/test-results/testDebugUnitTest`.

Meaningful regressions cover:

- Strict alert/When/all-day boundaries, independent Due, DST, mode-specific
  recurrence preview/catch-up/travel/exhaustion, metadata edits and retained work.
- Full query/count/order consistency beyond 50 rows, stable occurrence-ID ties,
  terminal exclusions and mutable Snooze/Postpone targets.
- Completion generation/revision races, pre-first-unlock completion, missing
  finite-series private projections, durable commit-boundary recovery, original
  action timestamps and exactly one Done history event after unlock/Reopen.
- Captured group membership, later arrivals, all-or-nothing stale validation,
  common Snooze target, mixed registration outcomes, four bulk crash checkpoints,
  superseded/elapsed recovery and duration changes before/after receipt commit.
- Ordinary/public notifications, dismissal remaining unfinished, no alarm service
  for Notification/No alert, DP migration, current-setting mirror/outbox repair,
  frozen native activity commands and truthful single-action receipt retries.
- Terminal status suppression, meaningful timing metadata, relative overdue
  spoken units, Partial feedback, exact retry identity and timed No alert zones.

The first preparation attempt stopped before Gradle on a tooling assertion tied
to the previous native dismissal expression. Its replacement verifies the stronger
pending-action guard, frozen callbacks, deferred intents and restore ordering;
behavioral tests were preserved. An intermediate preparation then passed, before
the final timezone/navigation/retry corrections. Only the final artifact identity
below identifies the completed source.

## Fixture review and its limits

The isolated fixture at 360×800 CSS px exercised Agenda, Completed with skipped
enabled, mixed Trash, terminal Details, row menus and selection. Completed/skipped
menus retained View reminder/Reopen/Move to Trash; Trash retained View reminder/
Restore. Terminal rows had no completion checkbox or Done. Selection-only targets
reported selection semantics. Actual completion history remained in Details.

All eight atmosphere/brightness pairs were rendered and inspected for Completed,
at default text and with 200% long English/Chinese titles/list names. More measured
48×48 CSS px and stayed aligned with the first title line; normal targets used
transparent surfaces/borders, with focus feedback when activated. The long-text
cards grew vertically. The 200% inline Alert selector exposed all three checked
choices, measured 72 px high per target, hid Alarm options in No alert, and retained
the persistent Save footer in 800×360 landscape.

The browser later stalled on debugger/navigation requests, including a new-tab
and runtime-reset recovery attempt. Consequently post-correction navigation
wrapping, the default horizontal selector, broader named-list/family/landscape
card review, and rendered group/Partial/frozen-retry controls were **not observed**
in this run. Their source/domain/native tests are separate evidence. The final
navigation correction passed typecheck/lint but has no post-fix browser capture.
Viewport reset and closure of the active review tab succeeded; closure of other
temporary failed tabs could not be confirmed. Captures are private under
`verification/local/alert-experience` and show synthetic reminders only.

Web fixture geometry does not establish Android font scaling, TalkBack, IME,
gestures, audio, notification layout, Direct Boot or lifecycle acceptance.
The [consolidated owner checklist](../device-acceptance.md) retains those actual
signed-phone observations. No installation or distribution was performed.

## Source/build relationship

Native commit `397d6f7` and shared UI/bridge commit `f772647` contain the final
production inputs. Final preparation started after both commits; only maintained
documentation/evidence/backlog changes remained in the working tree. No production
source was edited during that final preparation. The following documentation commit
does not change bundled inputs. The unchanged 0.4.0 version alone is insufficient
to identify the build.

## Final signed artifact identity

- Package/version: `com.remilo.app`, `0.4.0`, versionCode `4`.
- Variant/ABI: release, `arm64-v8a`; minSdk `34`, targetSdk `36`.
- Bundled JavaScript: yes. Debuggable: no. Signed: yes.
- APK SHA-256: `aed83392c9a84e451555fddc308d46df28b9c417157d717ea43667bca7e539f4`.
- Retained signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- APK: `android/app/build/outputs/apk/release/app-release.apk`.
- Private preparation summary: `verification/local/release-summary.json`.

Preparation installed/published nothing and did not run an emulator or physical
phone. Current physical/accessibility acceptance remains unobserved. Approved
scene masters retain the existing disclosed 1672×941 resolution limitation;
no artwork, approval or historical evidence was replaced.
