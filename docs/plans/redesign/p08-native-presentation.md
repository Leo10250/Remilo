# P08 Native Presentation

## 1. Objective and user-visible outcome

Real native alarm controls use approved full environments, stay independently
actionable during collisions and refresh errors, and retain private generic fallbacks.

## 2. Current relevant repository state

`AlarmActivity.kt` owns session observation/actions and delegates rendering to actual
`AlarmControlsScreen.kt`. Debug fixtures render that component with immutable fake
snapshots and no engine/audio acquisition. Production session/notifications retain
generation/session checks, immediate foreground promotion and first-member audio.
Inspect `SessionPresentation.kt`, `AlarmNotifications.kt`, `RingingService.kt` and
actual engine snapshots. P01 prototype approval is not production native completion.
See [baseline](../../evidence/2026-10-06-redesign-reassessment.md).

## 3. Scope

Integrate P04 descriptors with P02 native tokens/assets and P03 notification icon.
Render single and multiple alarms with an initially captured immutable ambient
canvas and richer per-member art. Preserve action ownership/loading/refresh behavior
and show current ringing delivery versus consequential event timing. Apply supported
standard notification accent/monochrome identity with generic public presentation.
Retain generic Classic/system pre-unlock and error fallback without React startup.

## 4. Explicit non-goals

No audio/channel/permission/cutoff/lateness/scheduling redesign, notification layout
replacement, custom remote-view marketing mockup, classifier work on delivery,
credential-derived data in DP, icon aliases or installation. No native controls
implemented in React and no second session/action authority.

## 5. Prerequisites and dependencies

Dependencies: P01, P02, P03, P04.

Require P01's owner-approved Meadow render/style, P02 native catalog, P03 supported
brand silhouette and P04 descriptor/privacy/fallback contract. Refine snapshot
ownership/lifetime and mixed-member composition after inspecting actual engine.
Read [architecture](../../architecture.md), [verification](../../verification.md),
[approvals](../../design/approvals.md) and dependency [handoffs](../../handoffs/README.md).

## 6. Relevant product requirements

The initial presented member determines ambient identity; a single Water plants
alarm is full Meadow. Capture once per session, not on current-first-member refresh.
New arrivals/removals/unlock refresh never recolor that canvas. Each member retains
Stop/Snooze; Stop all carries immutable session identity. Audio deadline/sound and
initial notification actions stay unchanged. Before first unlock, generic Classic/
system without content-derived art. A session first presented generically retains
its generic canvas while unlocked member content may refresh safely.

## 7. Approved visual references

Use accepted P01 actual native Water plants capture/style and P02 catalog.
[Desired botanical reference](../../design/references/desired-water-plants-reference.png)
guides composition. Platform notification examples must be identified as host/system
examples, not claims that Android allows reference-board layouts.

## 8. Required design decisions

**Approved:** full Meadow/single identity policy, frozen initial canvas, independent
member actions, generic pre-unlock/public privacy and supported standard notifications.

**Proposed:** exact initial-capture owner/lifetime, fallback when CE is unavailable,
mixed-member art grouping, scroll/action placement and current/event labels.
Approve contract before integration and actual single/multiple renders afterward.

**Agent choices:** minimal snapshot/Compose implementation using existing session
tickets/serialized worker. Keep appearance failure unable to block promotion/audio.
Validate official version-matched Compose/notification APIs before changes.

## 9. Expected deliverables

Production native environment integration, immutable presentation policy, per-member
rendering, notification accent/icon/public fallback, native state/race tests,
actual Compose capture matrix, privacy/manifest review, evidence and
`docs/handoffs/redesign-p08.md`.

## 10. Functional acceptance criteria

- New/removing/stopping first or later members never changes captured session canvas,
  deadline, first sound or other members' target/action identities. New session
  captures afresh; stale refresh/action/session Stop all is rejected.
- Initial loading cannot dismiss; confirmed terminal state does. Partial action
  retains remaining controls; refresh/action error retains known content with Retry.
- Native startup does not instantiate React/classifier or query credential storage
  before unlock. Appearance absence/failure falls back to usable generic controls.
- Single notification has Stop/Snooze from first post and re-trigger; grouped
  controls and session-specific Stop all remain. Promotion never waits for artwork.
- No titles, categories or content-derived assets enter DP/public presentation;
  channel IDs, modes, audio/lateness/cutoff and privacy boundary remain intact.

## 11. Visual acceptance criteria

Match P01 environmental quality, not a standalone sprig on old geometry. Review
single/multiple/generic/loading/error, light/dark and 200% long English/Chinese at
360x800/larger/expanded. Actions are >=48 dp, scroll-reachable and distinguish
silencing from completion. Measure composited contrast using P02 thresholds.
Host snapshots do not approve OEM notification layout or phone accessibility.

## 12. Verification requirements

Run shared verification for bridge changes and full relevant native tests/lint/
release assembly serially. Extend actual Compose captures plus pure session/race/
fallback tests, privacy checks and merged manifest isolation. Keep native audio/action
regressions intact. No deployment now; physical notifications/Direct Boot/collisions/
five-minute cutoff remain P12 identified signed-build observations.

## 13. Regression risks

Mutable-member-derived canvas, session re-creation recoloring, credential access
before unlock, blocking foreground startup with art, changing initial actions or
large-text multi-member content hiding Stop. Never weaken reliability tests.

## 14. User approval checkpoints

Authorize/refine after all direct dependencies; approve frozen-canvas/fallback
contract, then actual single/multiple/generic render matrix and action layout.
Record exact render/snapshot revision. Physical outcome approval remains P12.

## 15. Completion and handoff requirements

Hand P09 stable descriptor/session capture boundaries and P11 Starting/Active guard
contract. Record supported notification roles, actual tests, privacy/fallback behavior,
accepted renders and deferred phone evidence. Update contracts/backlog and standard
handoff, then stop without installation or appearance work in audio startup.

## 16. Fresh-chat execution prompt

```text
Verify all listed prerequisite completion, accepted handoffs and owner approvals.
Execute P08 Native Presentation only after authorization. Read AGENTS.md, core docs,
redesign specification/index, docs/plans/redesign/p08-native-presentation.md, approval ledger and accepted
P01/P02/P03/P04 handoffs. Inspect actual session/Activity/Compose/notification state;
stop on missing approvals. Refine and obtain my approval of the capture/fallback contract.
Integrate approved environmental art and native descriptors; full Meadow Water plants
uses a canvas captured once per session and unchanged by arrivals/removals/refresh.
Preserve independent Stop/Snooze, stale guards, initial notifications, immediate
promotion, five-minute audio deadline and generic pre-unlock/public privacy.
Never initialize React/classifier on delivery. Verify actual Compose single/multiple/
generic/large-text renders and shared/native reliability tests serially. Record exact
owner approvals, evidence, backlog and P08 handoff. No deployment, aliases or P09 work.
```
