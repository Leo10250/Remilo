# P08 Native Presentation

**7 October 2026 refinement:** read
[the approved R3/R4/R5 contract](../../design/approved-ui-r3-r4.md) and
[the R6 alarm/Postpone specification](../../design/r6-alarm-postpone-specification.md).
A22 accepts seven R6 templates and rejects the plain R6-04; A23 requires softer
Dark surfaces matching the existing themes. [A24](../../design/approved-ui-r6-themed-alarm-acceptance.json)
accepts the four corrected R6-04 Dark variants as starting templates, with
background/color matching to the corresponding existing theme and later
coloring/visual-polish flexibility. This is not P08 implementation authorization. Use the same global
atmosphere and independent brightness as the
app. Task-specific Meadow and richer per-member environments are deferred.
The current plan supersedes those older P08 visual assumptions while preserving
historical P01 approvals and all native action/session/privacy guarantees.
Android owns notification layout and expansion; retain supported templates.

## 1. Objective and user-visible outcome

Real native alarm controls use the shared global atmosphere, stay independently
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

Integrate global P04A descriptors with P02 native tokens/assets and P03 notification icon.
Render single and multiple alarms using the selected global atmosphere, with a
proposed session-stable captured canvas. Category badges may identify members when
private data is available; do not add per-member scenic themes. Preserve action ownership/loading/refresh behavior
and show current ringing delivery versus consequential event timing. Apply supported
standard notification accent/monochrome identity with generic public presentation.
Before first unlock, retain generic text while using the selected global theme
through a reviewed minimal non-private native-safe appearance source. Asset failure
keeps usable emergency controls without React startup.

## 4. Explicit non-goals

No audio/channel/permission/cutoff/lateness/scheduling redesign, notification layout
replacement, custom remote-view marketing mockup, classifier work on delivery,
private reminder/content-derived data in DP, icon aliases or installation. No native controls
implemented in React and no second session/action authority.

## 5. Prerequisites and dependencies

Hard prerequisites: P02, P04A.
Integration dependencies: P03, P04B, P09, P10.

Require the accepted current P02 native/global visual catalog and P04A
descriptor/privacy/fallback contract. P03 branding, P04B manual identities and
P09/P10 automatic resolution are recorded integration gates, not blockers for
core capture/rendering with actual compatible global descriptors. Reconcile the
deferred P04B/P10 task-specific scope during intake; historical dependency entries
do not authorize it. Refine snapshot ownership/lifetime and multi-member
composition after inspecting the actual engine and refining R6's technical proposals.
Read [architecture](../../architecture.md), [verification](../../verification.md),
[approvals](../../design/approvals.md) and dependency [handoffs](../../handoffs/README.md).

## 6. Relevant product requirements

Use the selected global atmosphere, including for Water plants. The proposed R6
policy captures it once per session rather than deriving it from the first member.
New arrivals/removals/unlock refresh never recolor that canvas. Each member retains
Stop/Snooze; Stop all carries immutable session identity. Audio deadline/sound and
initial notification actions stay unchanged. Before first unlock, generic content
uses bundled global-theme art/tokens through a safe appearance source, never
content-derived art. Preserve the captured canvas while unlocked member content
may refresh safely; do not perform synchronous credential access during Direct Boot.

## 7. Approved visual references

Use the accepted R3 global scenes, R4/R5 component roles and current P02 catalog.
The [R6 fixture brief](../../design/r6-alarm-postpone-fixtures.json) identifies the
single/multiple/privacy-safe/error states; [A22 exact acceptance](../../design/approved-ui-r6-acceptance.json)
and [per-image corrections](../../design/remilo-r6-alarm-postpone/review-notes.json)
identify the accepted representatives and rejected plain screen.
[A24's four themed variants](../../design/remilo-r6-alarm-postpone/themed-alarms/gallery.html)
retain exact image identities with per-image background/color conditions.
Historical P01 Meadow renders remain evidence of their bounded earlier prototype, not current task-specific
visual authority. Platform notification examples must be identified as host/system
examples, not claims that Android allows reference-board layouts.

## 8. Required design decisions

Consume the accepted current [component/role contract](../../design/approved-ui-r3-r4.md),
the R6 visual specification and compatible [notification research/adaptations](../../design/p01-pattern-evaluation.md). Use standard
native templates and actual native actions; reference pastel notification mockups are
not a promise of OEM/lock-screen/heads-up layout. No unexplained close/menu affordances.

**Approved:** one global atmosphere, independent brightness, independent native
member actions, stable presentation across member changes, generic pre-unlock/public
privacy and supported standard notifications. Native Stop is separate from Done.

**Accepted R6 visual intent:** larger single/compact multi-member openings,
measured persistent footers, 64 dp single/Stop all controls, 56 dp member controls,
explicit alert versus Event/Due labels and retained-content error feedback.
All native states support four atmospheres in Light/Dark with shared geometry and
softer elevated surfaces; generic private-text protection does not remove theming.
Under A24, full-page base backgrounds and elevated surfaces use the existing
theme's shared semantic roles. Do not adopt generated black/gradient samples as
exact production values. Detailed coloring and overall visual polish may be refined.

**Technical proposals still to refine:** exact capture owner/lifetime, minimal
safe appearance mirror and its update/compatibility/automatic-resolution policy,
plus asset-failure rendering. Approve that technical contract before integration
and actual component renders afterward; the accepted template need not be reapproved.

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
  before unlock. A valid safe descriptor supplies bundled global scenery/tokens
  while reminder content remains generic. Missing safe state uses the reviewed
  themed default; asset failure retains usable emergency controls without blocking audio.
- Single notification has Stop/Snooze from first post and re-trigger; grouped
  controls and session-specific Stop all remain. Promotion never waits for artwork.
- No titles, categories or content-derived assets enter DP/public presentation;
  channel IDs, modes, audio/lateness/cutoff and privacy boundary remain intact.

## 11. Visual acceptance criteria

Match the approved R3 environmental family and R4/R5 role/component policy. Review
single/multiple/generic/loading/error, light/dark and 200% long English/Chinese at
360x800/larger/expanded across all four atmospheres. Other targets are >=48 dp;
R6 single/Stop all are >=64 dp, member Stop/Snooze >=56 dp, scroll-reachable and distinguish
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

Authorize/refine core after accepted hard artifacts; approve frozen-canvas/fallback
contract, then actual single/multiple/generic render matrix and action layout.
Record exact render/snapshot revision. Physical outcome approval remains P12.

## 15. Completion and handoff requirements

Hand P09 stable descriptor/session capture boundaries. Retain the existing native
Starting/Active guard used by P11; P11 does not await this visual redesign.
Record section 5 branding/identity integration gates before combined acceptance.
Record supported notification roles, actual tests, privacy/fallback behavior,
accepted renders and deferred phone evidence. Update contracts/backlog and standard
handoff, then stop without installation or appearance work in audio startup.

## 16. Fresh-chat execution prompt

```text
Verify accepted hard prerequisite artifacts/owner approvals and record integration gates.
Execute P08 Native Presentation only after authorization. Read AGENTS.md, core docs,
redesign specification/index, docs/plans/redesign/p08-native-presentation.md,
docs/design/approved-ui-r3-r4.md, the R6 alarm/Postpone specification and fixture brief,
approval ledger and accepted P02/P04A capabilities, plus available P03/P04B/P09/P10
integrations. Inspect actual session/Activity/Compose/notification state; stop on
missing hard approvals, not unfinished unrelated integrations. Record gates and
obtain my approval of the capture/fallback contract.
Integrate the approved global environmental art and reviewed native descriptor/capture
contract. Water plants uses the same selected scene as the app, not Meadow.
Preserve the session canvas across arrivals/removals/refresh; do not implement
deferred per-reminder scenery or infer new automatic period/default policies.
Preserve independent Stop/Snooze, stale guards, initial notifications, immediate
promotion, five-minute audio deadline and generic pre-unlock/public privacy.
Never initialize React/classifier on delivery. Verify actual Compose single/multiple/
generic/large-text renders and shared/native reliability tests serially. Record exact
owner approvals, evidence, backlog and P08 handoff. No deployment, aliases or P09 work.
```
